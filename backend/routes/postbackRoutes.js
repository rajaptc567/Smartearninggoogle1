import express from 'express';
import User from '../models/User.js';
import { 
    handlePostback, 
    handleTheoremReachEventWebhook,
    getOfferwallProviders, 
    updateOfferwallProvider, 
    getOfferwallLogs, 
    simulatePostback,
    createToroxSession,
    getTheoremReachEntryUrl,
    isAuthorizedAdmin
} from '../controllers/postbackController.js';

const router = express.Router();

// Admin auth middleware helper
const requireAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(403).json({ success: false, error: 'Admin authorization required' });
    }

    try {
        // ALWAYS fetch from DB to verify current account status and role
        const dbUser = await User.findById(req.user.id).select('role status restrictions');
        
        if (!dbUser || dbUser.status === 'Blocked' || dbUser.restrictions?.loginBlocked) {
            return res.status(403).json({ success: false, error: 'Admin authorization required' });
        }

        if (isAuthorizedAdmin(dbUser)) {
            req.user.role = dbUser.role; // Update role to authoritative DB role
            return next();
        }
    } catch (err) {
        console.error('Database error in requireAdmin:', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }

    return res.status(403).json({ success: false, error: 'Admin authorization required' });
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

// Dedicated authenticated endpoint for TheoremReach signed entry URL creation
router.get('/theoremreach/entry', requireAuth, getTheoremReachEntryUrl);

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
