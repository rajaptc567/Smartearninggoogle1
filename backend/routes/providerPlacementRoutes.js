import express from 'express';
import User from '../models/User.js';
import {
    getAvailablePlacements,
    launchProviderPlacement,
    getAllAdminPlacements,
    getAdminCatalog,
    createAdminPlacement,
    updateAdminPlacement,
    deleteAdminPlacement,
    previewAdminPlacementEligibility,
    getAdminAuditLogs
} from '../controllers/providerPlacementController.js';

const router = express.Router();

/**
 * Explicit Worker Authentication Middleware
 * Ensures req.user exists and possesses a valid user ID.
 */
const requireAuth = (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }
    next();
};

/**
 * Strict Admin Role Authorization Middleware
 * Verifies admin / super_admin role from JWT token or performs database check if role is stale.
 */
const requireAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const role = req.user.role ? String(req.user.role).trim().toLowerCase() : '';
    if (['admin', 'super_admin'].includes(role)) {
        return next();
    }

    // Database verification fallback for stale JWT tokens
    try {
        const user = await User.findById(req.user.id).select('role status restrictions');
        if (user && user.status !== 'Blocked' && ['admin', 'super_admin'].includes(user.role)) {
            req.user.role = user.role;
            return next();
        }
    } catch (_) {}

    return res.status(403).json({ success: false, error: 'Access denied: Administrative privileges required.' });
};

// ==========================================
// WORKER ROUTES (Protected by requireAuth)
// ==========================================

// Get placements eligible for the authenticated user under a specific parent tab
router.get('/available/:parentTabId', requireAuth, getAvailablePlacements);

// Re-evaluate eligibility & launch provider session
router.post('/:placementId/launch', requireAuth, launchProviderPlacement);

// ==========================================
// ADMIN ROUTES (Protected by requireAdmin)
// ==========================================

// Get all provider placement records with safe provider metadata
router.get('/admin', requireAuth, requireAdmin, getAllAdminPlacements);

// Get safe provider catalog for creating placements
router.get('/admin/catalog', requireAuth, requireAdmin, getAdminCatalog);

// Create new placement (defaults OFF)
router.post('/admin', requireAuth, requireAdmin, createAdminPlacement);

// Update existing placement
router.put('/admin/:placementId', requireAuth, requireAdmin, updateAdminPlacement);

// Delete placement
router.delete('/admin/:placementId', requireAuth, requireAdmin, deleteAdminPlacement);

// Preview placement eligibility for test user (zero wallet/transaction mutations)
router.post('/admin/:placementId/preview', requireAuth, requireAdmin, previewAdminPlacementEligibility);

// Get placement audit logs
router.get('/admin/audit', requireAuth, requireAdmin, getAdminAuditLogs);

export default router;
