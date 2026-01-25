
import Transaction from '../models/Transaction.js';

export const getTransactions = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        
        // Safe Pagination Logic
        const page = parseInt(req.query.page, 10) || 1;
        let limit = parseInt(req.query.limit, 10) || 20; // Safe default
        if (limit > 100) limit = 100; // Hard cap to prevent abuse
        const skip = (page - 1) * limit;

        let query = {};
        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        } else if (!isAdmin) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const totalRecords = await Transaction.countDocuments(query);
        const transactions = await Transaction.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({ 
            success: true, 
            count: transactions.length, 
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                currentPage: page,
                pageSize: limit
            },
            data: transactions 
        });
    } catch (err) {
        res.status(200).json({ success: false, data: [], error: err.message });
    }
};
