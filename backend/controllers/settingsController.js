
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
        const settings = await Setting.findOneAndUpdate({}, req.body, {
            new: true,
            upsert: true, // Create if it doesn't exist
            runValidators: true,
        });
        
        // Trigger real-time sync update
        global.appDataVersion = Date.now();
        
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get current data version for polling
// @route   GET /api/v1/settings/version
export const getDataVersion = async (req, res) => {
    res.status(200).json({ 
        success: true, 
        version: global.appDataVersion || Date.now() 
    });
};
