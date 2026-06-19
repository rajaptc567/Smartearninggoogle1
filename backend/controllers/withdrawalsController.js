
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';

export const getWithdrawals = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        const query = isAdmin ? {} : { userId: req.user?.id };

        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const withdrawals = await Withdrawal.find(query)
            .sort({ date: -1 })
            .populate({
                path: 'matchedDepositIds',
                select: 'amount date status receiptUrl userName transactionId method'
            });
            
        res.status(200).json({ success: true, count: withdrawals.length, data: withdrawals });
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

        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        if (!isAdmin && withdrawal.userId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to this record' });
        }

        res.status(200).json({ success: true, data: withdrawal });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createWithdrawal = async (req, res) => {
    try {
        const user = await User.findById(req.body.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.withdrawal)) {
            return res.status(403).json({ success: false, error: `Withdrawals are currently disabled for your account.` });
        }
        
        const settings = await Setting.getSettings();
        if (settings.withdrawalFrequency && settings.withdrawalFrequency.enabled) {
            const { value, unit } = settings.withdrawalFrequency;
            const lastWithdrawal = await Withdrawal.findOne({ userId: user._id }).sort({ date: -1 });
            
            if (lastWithdrawal) {
                const lastDate = new Date(lastWithdrawal.date).getTime();
                const now = Date.now();
                let durationMs = 0;

                switch (unit) {
                    case 'hours': durationMs = value * 60 * 60 * 1000; break;
                    case 'days': durationMs = value * 24 * 60 * 60 * 1000; break;
                    case 'weeks': durationMs = value * 7 * 24 * 60 * 60 * 1000; break;
                    case 'months': durationMs = value * 30 * 24 * 60 * 60 * 1000; break;
                }

                const nextAllowedTime = lastDate + durationMs;
                
                if (now < nextAllowedTime) {
                    const remainingMs = nextAllowedTime - now;
                    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    let timeString = '';
                    if (days > 0) timeString += `${days} days, `;
                    if (hours > 0) timeString += `${hours} hours, `;
                    timeString += `${minutes} minutes`;

                    return res.status(400).json({ 
                        success: false, 
                        error: `Withdrawal frequency limit reached. You can make your next withdrawal in: ${timeString}.`
                    });
                }
            }
        }

        if (user.walletBalance < req.body.amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        user.walletBalance -= req.body.amount;
        
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
            message: `Your withdrawal request for ${user.currency}${withdrawal.amount.toFixed(2)} has been submitted for review.`
        });
        
        await user.save();
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(201).json({ success: true, data: { withdrawal, user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateWithdrawal = async (req, res) => {
    try {
        const { status, adminNotes, p2pName, p2pAccountTitle, p2pAccountNumber, p2pInstructions, p2pLogoUrl, p2pCustomFields } = req.body;
        
        let withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        const user = await User.findById(withdrawal.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

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
            user.walletBalance = Number((user.walletBalance + withdrawal.amount).toFixed(2));
            
            await Transaction.create({
                userId: user._id,
                userName: user.username,
                currency: user.currency,
                type: 'Withdrawal Refund',
                amount: withdrawal.amount,
                status: 'Approved',
                description: `Refund for rejected withdrawal #${withdrawal._id}`
            });

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                originalTransaction.description = `Rejected Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }

             await Notification.create({
                userId: user._id,
                message: `Your withdrawal for ${user.currency}${withdrawal.amount.toFixed(2)} was rejected. The amount has been refunded to your wallet.`
            });
        }
        
        if (status === 'Paid' || status === 'Approved') {
            if (originalTransaction) {
                originalTransaction.status = status === 'Paid' ? 'Approved' : status;
                originalTransaction.description = `${status} Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }
            const message = status === 'Paid' 
                ? `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been successfully paid.`
                : `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been approved.`;
            await Notification.create({ userId: user._id, message });
        }
        
        withdrawal.status = status;
        withdrawal.adminNotes = adminNotes;
        
        await withdrawal.save();
        await user.save();
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: { withdrawal, user } });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        if (withdrawal.status === 'Matching') {
             await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }
        
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
