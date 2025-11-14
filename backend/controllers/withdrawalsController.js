import Withdrawal from '../models/Withdrawal.js';

// @desc    Get all withdrawals
// @route   GET /api/v1/withdrawals
// @access  Private/Admin
export const getWithdrawals = async (req, res, next) => {
    try {
        const withdrawals = await Withdrawal.find().sort({ date: -1 }).lean();
        res.status(200).json({ success: true, count: withdrawals.length, data: withdrawals });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create withdrawal
// @route   POST /api/v1/withdrawals
// @access  Private/User
export const createWithdrawal = async (req, res, next) => {
    try {
        const withdrawal = await Withdrawal.create(req.body);
        res.status(201).json({ success: true, data: withdrawal });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update withdrawal
// @route   PUT /api/v1/withdrawals/:id
// @access  Private/Admin
export const updateWithdrawal = async (req, res, next) => {
    try {
         // Exclude fields that should not be updatable by this endpoint
        const { userId, userName, amount, method, ...updateData } = req.body;

        const withdrawal = await Withdrawal.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        if (!withdrawal) {
            return res.status(404).json({ success: false, error: `Withdrawal not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: withdrawal });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};