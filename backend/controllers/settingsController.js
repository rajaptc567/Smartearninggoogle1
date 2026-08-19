
import Setting from '../models/Setting.js';

export const getSettings = async (req, res) => {
    try {
        const settings = await Setting.getSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(200).json({ success: false, data: {}, error: err.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const prevSettings = await Setting.findOne();
        const emailBecameRequired = req.body.emailVerificationRequired && (!prevSettings || !prevSettings.emailVerificationRequired);
        const whatsappBecameRequired = req.body.whatsappVerificationRequired && (!prevSettings || !prevSettings.whatsappVerificationRequired);

        const settings = await Setting.findOneAndUpdate({}, { 
            ...req.body, 
            dataVersion: Date.now() 
        }, {
            new: true,
            upsert: true,
            runValidators: true,
        });

        // If verification was newly enabled, mark all existing users as verified
        if (emailBecameRequired || whatsappBecameRequired) {
            try {
                const User = (await import('../models/User.js')).default;
                const updateFields = {};
                if (emailBecameRequired) updateFields.emailVerified = true;
                if (whatsappBecameRequired) updateFields.whatsappVerified = true;
                
                await User.updateMany({}, { $set: updateFields });
            } catch (userErr) {
                console.error('Failed to auto-verify existing users:', userErr);
            }
        }
        
        // Notify all clients via socket.io for instant real-time reflections
        const io = req.app.get('io');
        if (io) {
            io.emit('DATA_CHANGED');
        }
        
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// Standardized version polling to prevent infinite loops
export const getDataVersion = async (req, res) => {
    try {
        const settings = await Setting.findOne().select('dataVersion');
        res.status(200).json({ 
            success: true, 
            version: settings?.dataVersion || 1 
        });
    } catch (err) {
        // Return a stable version on error to prevent re-fetch loops
        res.status(200).json({ success: true, version: 1 });
    }
};
