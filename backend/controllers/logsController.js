
import Log from '../models/Log.js';

export const getLogs = async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 });
        res.status(200).json({ success: true, data: logs });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
