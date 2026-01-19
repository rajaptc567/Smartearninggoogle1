
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';

// @desc    Get all withdrawals (Paginated & Optimized)
// @route   GET /api/v1/withdrawals
export const getWithdrawals = async (req, res) => {
    try {
        // PERF OPTIMIZATION: Pagination and Selective Population
        // Defaults to 100 recent records if no params provided to avoid breaking existing UI
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 100;
        const skip = (page - 1) * limit;

        const withdrawals = await Withdrawal.find()
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'matchedDepositIds',
                // SELECT ONLY NECESSARY FIELDS to reduce payload weight
                select: 'amount date status userName transactionId method'
            });
            
        // Response format remains identical [ARRAY] for backward compatibility with frontend
        res.status(200).json({ 
            success: true, 
            count: withdrawals.length, 
            data: withdrawals 
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get single withdrawal
// @route   GET /api/v1/withdrawals/:id
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

// @desc    Create new withdrawal request
// @route   POST /api/v1/withdrawals
export const createWithdrawal = async (req, res) => {
    try {
        const userId = req.body.userId;
        const amount = Number(req.body.amount);

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

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
                    return res.status(400).json({ success: false, error: `Withdrawal frequency limit reached.` });
                }
            }
        }

        if (user.walletBalance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -Number(amount.toFixed(2)) } }, { new: true });
        
        const withdrawalData = { ...req.body, currency: user.currency };
        const withdrawal = await Withdrawal.create(withdrawalData);
        
        const transaction = await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: 'Withdrawal Request', amount: -withdrawal.amount,
            status: 'Pending', description: `Pending Withdrawal #${withdrawal._id}`
        });

        await Notification.create({
            userId: user._id,
            message: `Your withdrawal request for ${user.currency}${withdrawal.amount.toFixed(2)} has been submitted for review.`
        });
        
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { withdrawal, user: updatedUser, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

// @desc    Update withdrawal (Approve/Reject)
// @route   PUT /api/v1/withdrawals/:id
export const updateWithdrawal = async (req, res) => {
    try {
        const { status, adminNotes, p2pName, p2pAccountTitle, p2pAccountNumber, p2pInstructions, p2pLogoUrl, p2pCustomFields } = req.body;
        
        let withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        
        const originalStatus = withdrawal.status;

        if (status === 'Matching') {
            const remainingAmount = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
            const methodData = {
                name: p2pName || `Gateway - ${withdrawal.method}`,
                type: 'Deposit', currency: withdrawal.currency,
                accountTitle: p2pAccountTitle || withdrawal.accountTitle,
                accountNumber: p2pAccountNumber || withdrawal.accountNumber,
                minAmount: 1, maxAmount: remainingAmount, feePercent: 0, status: 'Enabled',
                instructions: p2pInstructions || '', logoUrl: p2pLogoUrl || '',
                p2pWithdrawalId: withdrawal._id, customFields: p2pCustomFields || []
            };
            if (originalStatus === 'Matching') {
                await PaymentMethod.findOneAndUpdate({ p2pWithdrawalId: withdrawal._id }, methodData);
            } else {
                await PaymentMethod.create(methodData);
                if (withdrawal.matchRemainingAmount === undefined) withdrawal.matchRemainingAmount = withdrawal.finalAmount;
            }
        }

        if (originalStatus === 'Matching' && status !== 'Matching') {
            await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }

        if (originalStatus === status) {
            withdrawal.adminNotes = adminNotes || withdrawal.adminNotes;
            await withdrawal.save();
            const u = await User.findById(withdrawal.userId);
            return res.status(200).json({ success: true, data: { withdrawal, user: u } });
        }
        
        const originalTransaction = await Transaction.findOne({
            userId: withdrawal.userId, type: 'Withdrawal Request', description: { $regex: `Withdrawal #${withdrawal._id}` }
        });

        let updatedUser;
        if ((originalStatus === 'Pending' || originalStatus === 'Matching') && status === 'Rejected') {
            updatedUser = await User.findByIdAndUpdate(withdrawal.userId, { $inc: { walletBalance: Number(withdrawal.amount.toFixed(2)) } }, { new: true });
            
            await Transaction.create({
                userId: withdrawal.userId, userName: withdrawal.userName, currency: withdrawal.currency,
                type: 'Withdrawal Refund', amount: withdrawal.amount,
                status: 'Approved', description: `Refund for rejected withdrawal #${withdrawal._id}`
            });

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                originalTransaction.description = `Rejected Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }

             await Notification.create({
                userId: withdrawal.userId,
                message: `Your withdrawal for ${withdrawal.currency}${withdrawal.amount.toFixed(2)} was rejected. The amount has been refunded to your wallet.`
            });
        } else {
            updatedUser = await User.findById(withdrawal.userId);
        }
        
        if (status === 'Paid' || status === 'Approved') {
            if (originalTransaction) {
                originalTransaction.status = status === 'Paid' ? 'Approved' : status;
                originalTransaction.description = `${status} Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }
            await Notification.create({ 
                userId: withdrawal.userId, 
                message: `Your withdrawal for ${withdrawal.currency}${withdrawal.finalAmount.toFixed(2)} has been ${status === 'Paid' ? 'successfully paid' : 'approved'}.` 
            });
        }
        
        withdrawal.status = status;
        withdrawal.adminNotes = adminNotes;
        await withdrawal.save();
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { withdrawal, user: updatedUser } });

    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

// @desc    Delete withdrawal
// @route   DELETE /api/v1/withdrawals/:id
export const deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
        if (!withdrawal) return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        if (withdrawal.status === 'Matching') await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
