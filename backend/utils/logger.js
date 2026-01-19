
import Log from '../models/Log.js';

const createLog = async (action, affectedUser = 'N/A', details = '', performedBy = 'system', req = null) => {
    try {
        const logData = {
            action,
            affectedUser,
            details,
            performedBy,
        };

        if (req) {
            logData.ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            if (req.user) {
                logData.actorId = req.user._id;
                logData.performedBy = req.user.username;
            }
        }

        await Log.create(logData);
    } catch (error) {
        console.error('Failed to create immutable log entry:', error.message);
    }
};

export default createLog;
