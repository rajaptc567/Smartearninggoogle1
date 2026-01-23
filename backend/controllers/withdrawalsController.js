
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';

const toMoneyInt = (val) => Math.round(parseFloat(val || 0) * 100);
const toMoneyDec = (val) => Number((val / 100).toFixed(2));

export const getWithdrawals = async (req, res) => {
    try {
        const { page = 1, limit = 20, searchTerm, statusFilter } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};
        if (statusFilter) query.status = statusFilter;
        if (searchTerm) {
            query.$or = [
                { userName: { $regex: searchTerm, $options: 'i' } },
                { _id: { $regex: searchTerm, $options: 'i' } },
                { method: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        const totalCount = await Withdrawal.countDocuments(query);
        const withdrawals = await Withdrawal.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ date: -1 })
            .populate({
                path: 'matchedDepositIds',
                select: 'amount date status receiptUrl userName transactionId method'
            });
            
        res.status(200).json({ 
            success: true, 
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
        const user = await User.findById(req.body.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.withdrawal)) {
            return res.status(403).json({ success: false, error: `Withdrawals disabled.` });
        }
        
        const balanceInt = toMoneyInt(user.walletBalance);
        const requestAmtInt = toMoneyInt(req.body.amount);

        if (balanceInt < requestAmtInt) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        // ATOMIC UPDATE: Deduct balance
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $inc: { walletBalance: -req.body.amount } },
            { new: true }
        );
        
        const withdrawalData = { ...req.body, currency: user.currency };
        const withdrawal = await Withdrawal.create(withdrawalData);
        
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Withdrawal Request',
            amount: -withdrawal.amount,
            status: 'Pending',
            description: `Pending Withdrawal #${withdrawal._id}`
        });

        await Notification.create({
            userId: user._id,
            message: `Withdrawal request for ${user.currency}${withdrawal.amount.toFixed(2)} submitted.`
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
            // ATOMIC REFUND
            const updatedUser = await User.findByIdAndUpdate(
                user._id,
                { $inc: { walletBalance: withdrawal.amount } },
                { new: true }
            );
            
            await Transaction.create({
                userId: user._id, userName: user.username, currency: user.currency,
                type: 'Withdrawal Refund', amount: withdrawal.amount,
                status: 'Approved', description: `Refund for rejected withdrawal #${withdrawal._id}`
            });

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                await originalTransaction.save();
            }
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
