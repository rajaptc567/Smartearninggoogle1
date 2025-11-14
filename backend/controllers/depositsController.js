import Deposit from '../models/Deposit.js';

// @desc    Get all deposits
// @route   GET /api/v1/deposits
// @access  Private/Admin
export const getDeposits = async (req, res, next) => {
    try {
        const deposits = await Deposit.find().sort({ date: -1 });
        res.status(200).json({ success: true, count: deposits.length, data: JSON.parse(JSON.stringify(deposits)) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create deposit
// @route   POST /api/v1/deposits
// @access  Private/User
export const createDeposit = async (req, res, next) => {
    try {
        const deposit = await Deposit.create(req.body);
        res.status(201).json({ success: true, data: JSON.parse(JSON.stringify(deposit)) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update deposit
// @route   PUT /api/v1/deposits/:id
// @access  Private/Admin
export const updateDeposit = async (req, res, next) => {
    try {
        // Exclude fields that should not be updatable by this endpoint
        const { userId, userName, amount, method, ...updateData } = req.body;

        const deposit = await Deposit.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        if (!deposit) {
            return res.status(404).json({ success: false, error: `Deposit not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: JSON.parse(JSON.stringify(deposit)) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};