
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

export const getDeposits = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        
        // Safe Pagination Logic
        const page = parseInt(req.query.page, 10) || 1;
        let limit = parseInt(req.query.limit, 10) || 20;
        if (limit > 100) limit = 100;
        const skip = (page - 1) * limit;

        const query = isAdmin ? {} : { userId: req.user?.id };
        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const totalRecords = await Deposit.countDocuments(query);
        const deposits = await Deposit.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({ 
            success: true, 
            count: deposits.length, 
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                currentPage: page,
                pageSize: limit
            },
            data: deposits 
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
        
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        if (!isAdmin && deposit.userId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to this record' });
        }

        res.status(200).json({ success: true, data: deposit });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createDeposit = async (req, res) => {
    try {
        const depositData = { ...req.body };
        const user = await User.findById(depositData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.deposit)) {
            return res.status(403).json({ success: false, error: `Deposits disabled.` });
        }
        
        depositData.currency = user.currency;

        if (req.file) {
            try {
                depositData.receiptUrl = await uploadStream(req.file.buffer, 'deposits');
            } catch (uploadErr) {
                return res.status(500).json({ success: false, error: 'Image upload to Cloudinary failed.' });
            }
        }

        const deposit = await Deposit.create(depositData);
        
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Deposit',
            amount: deposit.amount,
            status: 'Pending',
            description: `Pending Deposit #${deposit._id}`
        });
        
        await Notification.create({
            userId: deposit.userId,
            message: `Your deposit request #${deposit._id} is pending review.`
        });

        if (deposit.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
            if (withdrawal) {
                const currentRemaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
                withdrawal.matchRemainingAmount = Number((currentRemaining - deposit.amount).toFixed(2));
                if (!withdrawal.matchedDepositIds) withdrawal.matchedDepositIds = [];
                withdrawal.matchedDepositIds.push(deposit._id);
                await withdrawal.save();

                if (withdrawal.matchRemainingAmount <= 0) {
                    await PaymentMethod.findOneAndDelete({ p2pWithdrawalId: withdrawal._id });
                }
            }
        }
        
        await Setting.bumpVersion();
        res.status(201).json({ success: true, data: { deposit, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateDeposit = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });

        const originalStatus = deposit.status;
        deposit.status = status;
        deposit.adminNotes = adminNotes;

        let user = await User.findById(deposit.userId);
        if (originalStatus !== 'Approved' && status === 'Approved') {
            user.walletBalance = Number((user.walletBalance + deposit.amount).toFixed(2));
            await user.save();
            await Transaction.findOneAndUpdate({ description: { $regex: deposit._id } }, { status: 'Approved' });
        }
        await deposit.save();
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: { deposit, user } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteDeposit = async (req, res) => {
    try {
        await Deposit.findByIdAndDelete(req.params.id);
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
