
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';

const toMoneyInt = (val) => Math.round(parseFloat(val || 0) * 100);
const toMoneyDec = (val) => Number((val / 100).toFixed(2));

export const getWithdrawals = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const totalCount = await Withdrawal.countDocuments();
        const withdrawals = await Withdrawal.find()
            .skip(skip)
            .limit(limit)
            .sort({ date: -1 })
            .populate({
                path: 'matchedDepositIds',
                select: 'amount date status receiptUrl userName transactionId method'
            });
            
        res.status(200).json({ 
            success: true, 
            count: withdrawals.length, 
            data: withdrawals,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        res.status(200).json({ success: true, data: withdrawal });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createWithdrawal = async (req, res) => {
    try {
        const userId = req.body.userId;
        const settings = await Setting.getSettings();
        
        // 1. SECURITY: Enforce Mandatory Task Completion (Backend Guard)
        const mandatoryTasks = await Task.find({ status: 'Active', isRequiredForWithdrawal: true });
        if (mandatoryTasks.length > 0) {
            const user = await User.findById(userId);
            const completedTaskIds = (user.completedTasks || [])
                .filter(ct => ct.status === 'Approved')
                .map(ct => ct.taskId.toString());
            
            const pendingTasks = mandatoryTasks.filter(t => !completedTaskIds.includes(t._id.toString()));
            
            if (pendingTasks.length > 0) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Access Restricted: You must complete all mandatory verification tasks before withdrawing.' 
                });
            }
        }

        // 2. SECURITY: Enforce Withdrawal Frequency (Cooldown)
        if (settings.withdrawalFrequency?.enabled) {
            const lastWithdrawal = await Withdrawal.findOne({ userId }).sort({ date: -1 });
            if (lastWithdrawal) {
                const lastDate = new Date(lastWithdrawal.date).getTime();
                const now = Date.now();
                const { value, unit } = settings.withdrawalFrequency;
                let durationMs = 0;
                switch (unit) {
                    case 'hours': durationMs = value * 3600000; break;
                    case 'days': durationMs = value * 86400000; break;
                    case 'weeks': durationMs = value * 604800000; break;
                    case 'months': durationMs = value * 2592000000; break;
                }

                if (now < lastDate + durationMs) {
                    return res.status(403).json({ 
                        success: false, 
                        error: `Withdrawal restricted: Frequency limit reached. Please try again later.` 
                    });
                }
            }
        }

        // 3. PRECISION: Convert to integers for safe arithmetic and normalize balance
        const amountInt = toMoneyInt(req.body.amount);
        const feeInt = toMoneyInt(req.body.fee);
        const finalAmtInt = amountInt - feeInt;
        
        const amountDec = toMoneyDec(amountInt);

        // ATOMIC DEDUCTION WITH PRECISION NORMALIZATION
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, walletBalance: { $gte: amountDec } },
            [
                { 
                    $set: { 
                        walletBalance: { 
                            $round: [{ $subtract: ["$walletBalance", amountDec] }, 2] 
                        } 
                    } 
                }
            ],
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ success: false, error: 'Insufficient balance or concurrent transaction interference.' });
        }

        if (updatedUser.status === 'Blocked' || (updatedUser.restrictions && updatedUser.restrictions.withdrawal)) {
            // Rollback if blocked and normalize
            await User.findByIdAndUpdate(userId, [
                { $set: { walletBalance: { $round: [{ $add: ["$walletBalance", amountDec] }, 2] } } }
            ]);
            return res.status(403).json({ success: false, error: `Withdrawals disabled.` });
        }
        
        const withdrawalData = { 
            ...req.body, 
            amount: amountDec,
            fee: toMoneyDec(feeInt),
            finalAmount: toMoneyDec(finalAmtInt),
            currency: updatedUser.currency 
        };
        const withdrawal = await Withdrawal.create(withdrawalData);
        
        const transaction = await Transaction.create({
            userId: updatedUser._id,
            userName: updatedUser.username,
            currency: updatedUser.currency,
            type: 'Withdrawal Request',
            amount: -withdrawal.amount,
            status: 'Pending',
            description: `Pending Withdrawal #${withdrawal._id}`
        });

        await Notification.create({
            userId: updatedUser._id,
            message: `Withdrawal request for ${updatedUser.currency}${withdrawal.amount.toFixed(2)} submitted.`
        });
        
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { withdrawal, user: updatedUser, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateWithdrawal = async (req, res) => {
    try {
        const { status, adminNotes, p2pName, p2pAccountTitle, p2pAccountNumber, p2pInstructions, p2pLogoUrl, p2pCustomFields } = req.body;
        
        let withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        
        const user = await User.findById(withdrawal.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const originalStatus = withdrawal.status;

        if (status === 'Matching') {
            const remainingAmount = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
            const methodData = {
                name: p2pName || `Gateway - ${withdrawal.method}`,
                type: 'Deposit',
                currency: withdrawal.currency,
                accountTitle: p2pAccountTitle || withdrawal.accountTitle,
                accountNumber: p2pAccountNumber || withdrawal.accountNumber,
                minAmount: 1,
                maxAmount: remainingAmount,
                feePercent: 0,
                status: 'Enabled',
                instructions: p2pInstructions || '', 
                logoUrl: p2pLogoUrl || '',
                p2pWithdrawalId: withdrawal._id,
                customFields: p2pCustomFields || []
            };

            if (originalStatus === 'Matching') {
                await PaymentMethod.findOneAndUpdate({ p2pWithdrawalId: withdrawal._id }, methodData);
            } else {
                await PaymentMethod.create(methodData);
                if (withdrawal.matchRemainingAmount === undefined) {
                    withdrawal.matchRemainingAmount = withdrawal.finalAmount;
                }
            }
        }

        if (originalStatus === 'Matching' && status !== 'Matching') {
            await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }

        if (originalStatus === status) {
            withdrawal.adminNotes = adminNotes || withdrawal.adminNotes;
            await withdrawal.save();
            return res.status(200).json({ success: true, data: { withdrawal, user } });
        }
        
        const originalTransaction = await Transaction.findOne({
            userId: user._id,
            type: 'Withdrawal Request',
            description: { $regex: `Withdrawal #${withdrawal._id}` }
        });

        if ((originalStatus === 'Pending' || originalStatus === 'Matching') && status === 'Rejected') {
            // ATOMIC REFUND WITH PRECISION NORMALIZATION
            const updatedUser = await User.findByIdAndUpdate(user._id, [
                { $set: { walletBalance: { $round: [{ $add: ["$walletBalance", withdrawal.amount] }, 2] } } }
            ], { new: true });
            
            await Transaction.create({
                userId: user._id, userName: user.username, currency: user.currency,
                type: 'Withdrawal Refund', amount: withdrawal.amount,
                status: 'Approved', description: `Refund for rejected withdrawal #${withdrawal._id}`
            });

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                await originalTransaction.save();
            }

            withdrawal.status = status;
            withdrawal.adminNotes = adminNotes;
            await withdrawal.save();
            global.appDataVersion = Date.now();
            return res.status(200).json({ success: true, data: { withdrawal, user: updatedUser } });
        }
        
        if (status === 'Paid' || status === 'Approved') {
            if (originalTransaction) {
                originalTransaction.status = status === 'Paid' ? 'Approved' : status;
                await originalTransaction.save();
            }
        }
        
        withdrawal.status = status;
        withdrawal.adminNotes = adminNotes;
        
        await withdrawal.save();
        global.appDataVersion = Date.now();
        const finalUser = await User.findById(user._id);
        res.status(200).json({ success: true, data: { withdrawal, user: finalUser } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
        if (!withdrawal) return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        if (withdrawal.status === 'Matching') await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
