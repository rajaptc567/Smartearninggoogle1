import Template from '../models/Template.js';

// @desc    Get all message templates (seeds if empty)
// @route   GET /api/v1/templates
export const getTemplates = async (req, res) => {
    try {
        const templates = await Template.getTemplates();
        res.status(200).json({ success: true, count: templates.length, data: templates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Bulk update message templates
// @route   PUT /api/v1/templates/bulk
export const bulkUpdateTemplates = async (req, res) => {
    try {
        const { keys, isEnabled } = req.body;
        if (!Array.isArray(keys) || keys.length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide an array of template keys' });
        }
        if (typeof isEnabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Please provide a boolean value for isEnabled' });
        }
        
        await Template.updateMany(
            { key: { $in: keys } },
            { $set: { isEnabled } }
        );
        
        const templates = await Template.getTemplates();
        res.status(200).json({ success: true, message: `Successfully updated ${keys.length} templates`, data: templates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update a specific message template
// @route   PUT /api/v1/templates/:key
export const updateTemplate = async (req, res) => {
    try {
        const { subject, body, isEnabled, graphicTheme } = req.body;
        const template = await Template.findOneAndUpdate(
            { key: req.params.key },
            { subject, body, isEnabled, graphicTheme },
            { new: true, runValidators: true }
        );
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.status(200).json({ success: true, data: template });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Reset all templates to system defaults
// @route   POST /api/v1/templates/reset
export const resetTemplates = async (req, res) => {
    try {
        await Template.deleteMany({});
        const templates = await Template.getTemplates();
        res.status(200).json({ success: true, message: 'All templates reset to defaults successfully', data: templates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
