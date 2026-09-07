
import InvestmentPlan from '../models/InvestmentPlan.js';
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import { canUserAccessInvestmentModule } from '../utils/investmentAccess.js';

export const getInvestmentPlans = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin) {
            const settings = await Setting.getSettings();
            const user = req.user ? await User.findById(req.user.id) : null;
            if (!canUserAccessInvestmentModule(user, settings)) {
                return res.status(200).json({ success: true, count: 0, data: [] });
            }
        }
        const plans = await InvestmentPlan.find();
        res.status(200).json({ success: true, count: plans.length, data: plans });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getInvestmentPlan = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin) {
            const settings = await Setting.getSettings();
            const user = req.user ? await User.findById(req.user.id) : null;
            if (!canUserAccessInvestmentModule(user, settings)) {
                return res.status(403).json({
                    success: false,
                    error: 'The Investment Module is currently disabled.',
                    code: 'INVESTMENT_MODULE_DISABLED'
                });
            }
        }
        const plan = await InvestmentPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Investment plan not found' });
        }
        res.status(200).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createInvestmentPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.create(req.body);
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(201).json({ success: true, data: plan });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, error: `A plan with this name already exists for the selected currency.` });
        }
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateInvestmentPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Investment plan not found' });
        }
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: plan });
    } catch (err) {
         if (err.code === 11000) {
            return res.status(400).json({ success: false, error: `A plan with this name already exists for the selected currency.` });
        }
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteInvestmentPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.findByIdAndDelete(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Investment plan not found' });
        }
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
