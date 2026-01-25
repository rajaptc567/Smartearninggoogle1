
import Log from '../models/Log.js';

export const getLogs = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        
        if (!isAdmin) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // Safe Pagination Logic (Logs are high volume)
        const page = parseInt(req.query.page, 10) || 1;
        let limit = parseInt(req.query.limit, 10) || 20; 
        if (limit > 100) limit = 100;
        const skip = (page - 1) * limit;

        const totalRecords = await Log.countDocuments();
        const logs = await Log.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({ 
            success: true, 
            count: logs.length, 
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                currentPage: page,
                pageSize: limit
            },
            data: logs 
        });
    } catch (err) {
        res.status(200).json({ success: false, data: [] });
    }
};

export const clearLogs = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        if (!isAdmin) return res.status(403).json({ success: false, message: 'Forbidden' });

        await Log.deleteMany({});
        res.status(200).json({ success: true, data: [] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
