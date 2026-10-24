import express from 'express';
import { 
    handlePostback, 
    handleTheoremReachEventWebhook,
    getOfferwallProviders, 
    updateOfferwallProvider, 
    getOfferwallLogs, 
    simulatePostback,
    createToroxSession
} from '../controllers/postbackController.js';

const router = express.Router();

// Admin auth middleware helper
const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        return res.status(403).json({ success: false, error: 'Admin authorization required' });
    }
    next();
};

// Authenticated user middleware helper
const requireAuth = (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    next();
};

// Public/Member read of enabled providers
router.get('/providers', getOfferwallProviders);

// Dedicated authenticated endpoint for Torox offerwall session creation
router.post('/torox/session', requireAuth, createToroxSession);

// Admin management endpoints
router.put('/providers/:providerKey', requireAdmin, updateOfferwallProvider);
router.get('/logs', requireAdmin, getOfferwallLogs);
router.post('/simulate', requireAdmin, simulatePostback);

// Dedicated Inbound TheoremReach Event Webhook Endpoints
router.post('/theoremreach/events', handleTheoremReachEventWebhook);
router.all('/theoremreach/events', handleTheoremReachEventWebhook);
router.post('/events', handleTheoremReachEventWebhook);

// Generic & Network-Specific Postback Webhook Endpoints (supports both GET and POST)
router.all('/:provider', handlePostback);
router.all('/', handlePostback);

export default router;
