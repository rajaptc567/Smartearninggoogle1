import Log from '../models/Log.js';

export const getLogs = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        if (!isMaster) {
            return res.status(200).json({ success: true, data: [] });
        }

        const logs = await Log.find().sort({ timestamp: -1 }).limit(100);
        res.status(200).json({ success: true, data: logs });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const clearLogs = async (req, res) => {
    try {
        await Log.deleteMany({});
        res.status(200).json({ success: true, data: [] });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};