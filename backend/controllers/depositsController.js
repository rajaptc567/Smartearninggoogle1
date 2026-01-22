import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

export const getDeposits = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        let query = {};
        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        } else if (!isAdmin) {
            return res.status(200).json({ success: true, data: [] });
        }

        const deposits = await Deposit.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, count: deposits.length, data: deposits });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const getDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        res.status(200).json({ success: true, data: deposit || {} });
    } catch (err) { res.status(200).json({ success: true, data: {} }); }
};

export const createDeposit = async (req, res) => {
    try {
        const depositData = { ...req.body };
        const user = await User.findById(depositData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        if (req.file) {
            depositData.receiptUrl = await uploadStream(req.file.buffer, 'deposits');
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
        
        res.status(201).json({ success: true, data: { deposit, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateDeposit = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const deposit = await Deposit.findByIdAndUpdate(req.params.id, { status, adminNotes }, { new: true });
        if (status === 'Approved') {
            await User.findByIdAndUpdate(deposit.userId, { $inc: { walletBalance: deposit.amount } });
        }
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: { deposit } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteDeposit = async (req, res) => {
    try {
        await Deposit.findByIdAndDelete(req.params.id);
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};