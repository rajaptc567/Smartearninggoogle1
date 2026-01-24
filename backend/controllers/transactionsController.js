
import Transaction from '../models/Transaction.js';

// @desc    Get all transactions (Paginated)
// @route   GET /api/v1/transactions
export const getTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        /**
         * SECURITY ENFORCEMENT:
         * Admin sees everything. Regular members see ONLY their own transactions.
         * This allows the frontend to calculate user-specific totals/referral earnings correctly.
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
