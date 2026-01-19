
import Log from '../models/Log.js';

const createLog = async (action, affectedUser = 'N/A', details = '', performedBy = 'system') => {
    try {
        await Log.create({
            action,
            affectedUser,
            details,
            performedBy,
        });
    } catch (error) {
        console.error('Failed to create log entry:', error);
    }
};

export default createLog;
