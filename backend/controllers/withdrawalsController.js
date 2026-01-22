
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Setting from '../models/Setting.js';

export const getWithdrawals = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        let query = {};
        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        } else if (!isAdmin) {
            return res.status(200).json({ success: true, data: [] });
        }

        const withdrawals = await Withdrawal.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, count: withdrawals.length, data: withdrawals });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const getWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id);
        res.status(200).json({ success: true, data: withdrawal || {} });
    } catch (err) { res.status(200).json({ success: true, data: {} }); }
};

export const createWithdrawal = async (req, res) => {
    try {
        const user = await User.findById(req.body.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (user.walletBalance < req.body.amount) return res.status(400).json({ success: false, error: 'Insufficient balance' });

        // Deduct immediately upon request
        user.walletBalance = Number((user.walletBalance - req.body.amount).toFixed(2));
        await user.save();

        const withdrawal = await Withdrawal.create(req.body);
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Withdrawal Request',
            amount: -withdrawal.amount,
            status: 'Pending',
            description: `Pending Withdrawal #${withdrawal._id}`
        });

        res.status(201).json({ success: true, data: { withdrawal, user, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateWithdrawal = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const oldWithdrawal = await Withdrawal.findById(req.params.id);
        if (!oldWithdrawal) return res.status(404).json({ success: false, error: 'Not found' });

        const withdrawal = await Withdrawal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        const user = await User.findById(withdrawal.userId);

        // HANDLING REJECTION: Refund the user
        if (status === 'Rejected' && oldWithdrawal.status !== 'Rejected') {
            user.walletBalance = Number((user.walletBalance + withdrawal.amount).toFixed(2));
            await user.save();
            
            await Transaction.create({
                userId: user._id,
                userName: user.username,
                currency: user.currency,
                type: 'Withdrawal Refund',
                amount: withdrawal.amount,
                status: 'Approved',
                description: `Refund for Rejected Withdrawal #${withdrawal._id}`
            });
        }

        res.status(200).json({ success: true, data: { withdrawal, user } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteWithdrawal = async (req, res) => {
    try {
        await Withdrawal.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
