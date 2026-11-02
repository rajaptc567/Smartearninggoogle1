import express from 'express';
import User from '../models/User.js';
import { authorize } from '../middleware/authMiddleware.js';
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
 * Strict Admin Role Authorization Middleware
 * Always verifies admin / super_admin role against the database on every request.
 * Rejects stale JWT claims if user is no longer admin/super_admin or is blocked.
 */
const requireAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    try {
        const user = await User.findById(req.user.id).select('role status restrictions');
        if (!user || user.status === 'Blocked' || (typeof user.status === 'string' && user.status.includes('Blocked')) || user.restrictions?.loginBlocked) {
            return res.status(403).json({ success: false, error: 'Access denied: Account restricted or blocked.' });
        }

        const role = user.role ? String(user.role).trim().toLowerCase() : '';
        if (['admin', 'super_admin'].includes(role)) {
            req.user.role = user.role;
            return next();
        }
    } catch (err) {
        console.error('[Placement requireAdmin Error]:', err.message);
    }

    return res.status(403).json({ success: false, error: 'Access denied: Administrative privileges required.' });
};

// ==========================================
// WORKER ROUTES (Protected by authorize(['user', 'admin', 'super_admin']))
// ==========================================

// Get placements eligible for the authenticated user under a specific parent tab
router.get('/available/:parentTabId', authorize(['user', 'admin', 'super_admin']), getAvailablePlacements);

// Re-evaluate eligibility & launch provider session
router.post('/:placementId/launch', authorize(['user', 'admin', 'super_admin']), launchProviderPlacement);

// ==========================================
// ADMIN ROUTES (Protected by requireAdmin)
// ==========================================

// Get all provider placement records with safe provider metadata
router.get('/admin', requireAdmin, getAllAdminPlacements);

// Get safe provider catalog for creating placements
router.get('/admin/catalog', requireAdmin, getAdminCatalog);

// Create new placement (defaults OFF)
router.post('/admin', requireAdmin, createAdminPlacement);

// Update existing placement
router.put('/admin/:placementId', requireAdmin, updateAdminPlacement);

// Delete placement
router.delete('/admin/:placementId', requireAdmin, deleteAdminPlacement);

// Preview placement eligibility for test user (zero wallet/transaction mutations)
router.post('/admin/:placementId/preview', requireAdmin, previewAdminPlacementEligibility);

// Get placement audit logs
router.get('/admin/audit', requireAdmin, getAdminAuditLogs);

export default router;
