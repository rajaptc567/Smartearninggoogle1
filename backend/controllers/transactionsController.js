import Transaction from '../models/Transaction.js';

// @desc    Get all transactions (Role-Aware)
// @route   GET /api/v1/transactions
export const getTransactions = async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page, 10) : null;
        const limit = parseInt(req.query.limit, 10) || 200;
        
        // 🛡️ ROLE-BASED FILTERING
        let filter = {};
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            filter = { userId: req.user.id };
        }

        let query = Transaction.find(filter).sort({ date: -1 });

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