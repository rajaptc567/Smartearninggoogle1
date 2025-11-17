
import InvestmentPlan from '../models/InvestmentPlan.js';

// @desc    Get all investment plans
// @route   GET /api/v1/investment-plans
export const getInvestmentPlans = async (req, res) => {
    try {
        const plans = await InvestmentPlan.find();
        res.status(200).json({ success: true, count: plans.length, data: plans });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get single investment plan
// @route   GET /api/v1/investment-plans/:id
export const getInvestmentPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Investment plan not found' });
        }
        res.status(200).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create new investment plan
// @route   POST /api/v1/investment-plans
export const createInvestmentPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update investment plan
// @route   PUT /api/v1/investment-plans/:id
export const updateInvestmentPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Investment plan not found' });
        }
        res.status(200).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete investment plan
// @route   DELETE /api/v1/investment-plans/:id
export const deleteInvestmentPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.findByIdAndDelete(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Investment plan not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};