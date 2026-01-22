import Rule from '../models/Rule.js';
import Setting from '../models/Setting.js';

export const getRules = async (req, res) => {
    try {
        const rules = await Rule.find();
        res.status(200).json({ success: true, data: rules });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createRule = async (req, res) => {
    try {
        // Check if rule already exists for this plan
        const existingRule = await Rule.findOne({ targetPlanId: req.body.targetPlanId });
        if (existingRule) {
            const updatedRule = await Rule.findByIdAndUpdate(existingRule._id, req.body, { new: true, runValidators: true });
            // MAJOR GLOBAL CHANGE: Bump version
            await Setting.bumpVersion();
            return res.status(200).json({ success: true, data: updatedRule });
        }

        const rule = await Rule.create(req.body);
        // MAJOR GLOBAL CHANGE: Bump version
        await Setting.bumpVersion();
        res.status(201).json({ success: true, data: rule });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateRule = async (req, res) => {
    try {
        const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!rule) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }
        // MAJOR GLOBAL CHANGE: Bump version
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: rule });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteRule = async (req, res) => {
    try {
        const rule = await Rule.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
        // MAJOR GLOBAL CHANGE: Bump version
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};