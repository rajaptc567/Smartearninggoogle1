import express from 'express';
import { 
    handlePostback, 
    getOfferwallProviders, 
    updateOfferwallProvider, 
    getOfferwallLogs, 
    simulatePostback 
} from '../controllers/postbackController.js';

const router = express.Router();

// Admin auth middleware helper
const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        return res.status(403).json({ success: false, error: 'Admin authorization required' });
    }
    next();
};

// Public/Member read of enabled providers
router.get('/providers', getOfferwallProviders);

// Admin management endpoints
router.put('/providers/:providerKey', requireAdmin, updateOfferwallProvider);
router.get('/logs', requireAdmin, getOfferwallLogs);
router.post('/simulate', requireAdmin, simulatePostback);

// Generic & Network-Specific Postback Webhook Endpoints (supports both GET and POST)
router.all('/:provider', handlePostback);
router.all('/', handlePostback);

export default router;
