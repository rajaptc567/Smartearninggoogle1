import Setting from '../models/Setting.js';

export const getSettings = async (req, res) => {
    try {
        const settings = await Setting.getSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(200).json({ success: true, data: {} });
    }
};

export const updateSettings = async (req, res) => {
    try {
        // Only Super Admin or Owner can update global settings
        const settings = await Setting.findOneAndUpdate({}, req.body, { new: true, upsert: true });
        // Global Change: Bumping version triggers re-fetch in frontends
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: settings });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getDataVersion = async (req, res) => {
    try {
        const settings = await Setting.findOne().select('dataVersion');
        res.status(200).json({ 
            success: true, 
            version: settings?.dataVersion || 1 
        });
    } catch (err) {
        // Critical: Fallback to 1 to prevent endless "detected change" polling loops
        res.status(200).json({ success: true, version: 1 });
    }
};