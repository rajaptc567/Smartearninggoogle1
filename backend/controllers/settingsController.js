
import Setting from '../models/Setting.js';

export const getSettings = async (req, res) => {
    try {
        const settings = await Setting.getSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const settings = await Setting.findOneAndUpdate({}, { 
            ...req.body, 
            dataVersion: Date.now() // Trigger persistent version bump
        }, {
            new: true,
            upsert: true,
            runValidators: true,
        });
        
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get current data version for polling
// @route   GET /api/v1/settings/version
export const getDataVersion = async (req, res) => {
    try {
        const settings = await Setting.findOne().select('dataVersion');
        res.status(200).json({ 
            success: true, 
            version: settings?.dataVersion || Date.now() 
        });
    } catch (err) {
        res.status(200).json({ success: true, version: Date.now() });
    }
};
