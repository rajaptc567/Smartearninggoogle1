
import Transaction from '../models/Transaction.js';

// @desc    Get all transactions (Paginated)
// @route   GET /api/v1/transactions
export const getTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const totalCount = await Transaction.countDocuments();
        const transactions = await Transaction.find()
            .skip(skip)
            .limit(limit)
            .sort({ date: -1 });

        res.status(200).json({ 
            success: true, 
            count: transactions.length, 
            data: transactions,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
