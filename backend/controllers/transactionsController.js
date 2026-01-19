
import Transaction from '../models/Transaction.js';

// @desc    Get all transactions (Conditional Pagination)
// @route   GET /api/v1/transactions
export const getTransactions = async (req, res) => {
    try {
        /**
         * CONDITIONAL PAGINATION:
         * We check for 'page' query param. If missing, we return the whole history.
         * This prevents a 'Pagination Wall' on the current UI.
         */
        const page = req.query.page ? parseInt(req.query.page, 10) : null;
        const limit = parseInt(req.query.limit, 10) || 200;
        
        let query = Transaction.find().sort({ date: -1 });

        if (page !== null) {
            const skip = (page - 1) * limit;
            query = query.skip(skip).limit(limit);
        }

        const transactions = await query;
        res.status(200).json({ success: true, count: transactions.length, data: transactions });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
