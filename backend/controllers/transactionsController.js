import Transaction from '../models/Transaction.js';

export const getTransactions = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        let query = {};
        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        } else if (!isAdmin) {
            // Non-logged in or non-admin users shouldn't see anything
            return res.status(200).json({ success: true, data: [] });
        }

        const transactions = await Transaction.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, data: transactions });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};