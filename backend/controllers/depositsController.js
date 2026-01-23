
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

export const getDeposits = async (req, res) => {
    try {
        const { page = 1, limit = 20, searchTerm, statusFilter } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};
        if (statusFilter) query.status = statusFilter;
        if (searchTerm) {
            query.$or = [
                { userName: { $regex: searchTerm, $options: 'i' } },
                { transactionId: { $regex: searchTerm, $options: 'i' } },
                { _id: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        const totalCount = await Deposit.countDocuments(query);
        const deposits = await Deposit.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ date: -1 });

        res.status(200).json({ 
            success: true, 
            data: deposits,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
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
            depositData.receiptUrl = await uploadStream(req.file.buffer, 'deposits');
        }

        const deposit = await Deposit.create(depositData);
        
        await Transaction.create({
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

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { deposit, transaction: {} } });
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
        
        if (originalStatus !== 'Approved' && status === 'Approved') {
            // ATOMIC UPDATE: Credit user wallet
            await User.findByIdAndUpdate(deposit.userId, { $inc: { walletBalance: deposit.amount } });
            await Transaction.findOneAndUpdate({ description: { $regex: deposit._id } }, { status: 'Approved' });
        } else if (originalStatus === 'Approved' && status !== 'Approved') {
            // ATOMIC UPDATE: Revert/Deduct if was approved but now rejected
            await User.findByIdAndUpdate(deposit.userId, { $inc: { walletBalance: -deposit.amount } });
            await Transaction.findOneAndUpdate({ description: { $regex: deposit._id } }, { status: 'Rejected' });
        }

        deposit.status = status;
        deposit.adminNotes = adminNotes;
        await deposit.save();
        
        global.appDataVersion = Date.now();
        const updatedUser = await User.findById(deposit.userId);
        res.status(200).json({ success: true, data: { deposit, user: updatedUser } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteDeposit = async (req, res) => {
    try {
        await Deposit.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
