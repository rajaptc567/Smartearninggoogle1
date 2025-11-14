import Transaction from '../models/Transaction.js';

// @desc    Get all transactions
// @route   GET /api/v1/transactions
export const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ date: -1 });
        res.status(200).json({ success: true, count: transactions.length, data: transactions });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
