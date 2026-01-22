
import Transaction from '../models/Transaction.js';

export const getTransactions = async (req, res) => {
    try {
        let query = {};
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';

        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        } else if (!isAdmin) {
            // Unauthenticated requests get nothing
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const transactions = await Transaction.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, count: transactions.length, data: transactions });
    } catch (err) {
        res.status(200).json({ success: false, data: [], error: err.message });
    }
};
