
import Log from '../models/Log.js';

export const getLogs = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        
        if (!isAdmin) {
            // Return empty data instead of 403 to prevent frontend boot failure
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const logs = await Log.find().sort({ timestamp: -1 }).limit(100);
        res.status(200).json({ success: true, data: logs });
    } catch (err) {
        res.status(200).json({ success: false, data: [] });
    }
};

export const clearLogs = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        if (!isAdmin) return res.status(403).json({ success: false, message: 'Forbidden' });

        await Log.deleteMany({});
        res.status(200).json({ success: true, data: [] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
