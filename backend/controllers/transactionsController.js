
import Transaction from '../models/Transaction.js';

// @desc    Get all transactions (Paginated)
// @route   GET /api/v1/transactions
export const getTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        /**
         * SECURITY ENFORCEMENT (P0):
         * Filter results by userId unless the requester is an authorized administrator.
         * This prevents authenticated users from accessing the global financial ledger via manual API calls.
         */
        const isAdmin = req.user.email === 'studio56.pk@gmail.com' || req.user.username === 'admin';
        const filter = isAdmin ? {} : { userId: req.user._id };

        const totalCount = await Transaction.countDocuments(filter);
        const transactions = await Transaction.find(filter)
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
