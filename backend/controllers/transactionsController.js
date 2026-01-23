
import Transaction from '../models/Transaction.js';

// @desc    Get all transactions (Paginated & Filtered)
// @route   GET /api/v1/transactions
export const getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, searchTerm, typeFilter, statusFilter, userId } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};

        if (userId) query.userId = userId;
        if (typeFilter) query.type = typeFilter;
        if (statusFilter) query.status = statusFilter;

        if (searchTerm) {
            query.$or = [
                { userName: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { _id: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        const totalCount = await Transaction.countDocuments(query);
        const transactions = await Transaction.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ date: -1 });

        res.status(200).json({ 
            success: true, 
            data: transactions,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
