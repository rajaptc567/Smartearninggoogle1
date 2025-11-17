
import Rule from '../models/Rule.js';

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
        const rule = await Rule.create(req.body);
        res.status(201).json({ success: true, data: rule });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteRule = async (req, res) => {
    try {
        const rule = await Rule.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
