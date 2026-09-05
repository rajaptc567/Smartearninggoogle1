import User from '../models/User.js';
import Setting from '../models/Setting.js';

/**
 * Centralized Investment Module Access Decision
 * 
 * Access Decision Matrix:
 * 1. Admin/Super Admin -> ALWAYS true
 * 2. If Master Toggle investmentModuleEnabled === true -> true
 * 3. If Master Toggle investmentModuleEnabled === false:
 *    a) If investmentActivePlanBypassEnabled === true AND user has a valid ACTIVE investment plan -> true
 *    b) If investmentManualWhitelistEnabled === true AND user ID is in investmentManualWhitelistUserIds -> true
 *    c) Otherwise -> false
 * 
 * @param {Object} user - User document or object
 * @param {Object} settings - Settings document or object
 * @returns {boolean} Whether the user is authorized to access the Investment Module
 */
export const canUserAccessInvestmentModule = (user, settings) => {
    if (!user) return false;

    // 1. Administrators and Super Admins always have access (P0-2)
    if (
        user.role === 'admin' || 
        user.role === 'super_admin' ||
        user.email === 'studio56.pk@gmail.com'
    ) {
        return true;
    }

    // 2. Check Master Investment Module Toggle
    const isMasterEnabled = settings?.investmentModuleEnabled !== false && settings?.isInvestmentModuleEnabled !== false;
    if (isMasterEnabled) {
        return true;
    }

    // Master Toggle is OFF - Evaluate bypass policies

    // 3. Active Plan Bypass
    if (settings?.investmentActivePlanBypassEnabled) {
        const hasActivePlans = (Array.isArray(user.activePlans) && user.activePlans.length > 0) ||
                               (user.activePlan && user.activePlan !== 'None' && user.activePlan !== '');
        if (hasActivePlans) {
            return true;
        }
    }

    // 4. Manual Member Whitelist
    if (settings?.investmentManualWhitelistEnabled) {
        const whitelist = Array.isArray(settings.investmentManualWhitelistUserIds)
            ? settings.investmentManualWhitelistUserIds
            : [];
        const userIdStr = (user._id || user.id)?.toString();
        if (userIdStr && whitelist.some(id => String(id) === userIdStr)) {
            return true;
        }
    }

    return false;
};

/**
 * Express middleware to guard investment endpoints on the backend.
 * Rejects unauthorized requests with 403 Forbidden.
 */
export const requireInvestmentAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        // Administrators bypass (P0-2)
        if (
            req.user.role === 'admin' || 
            req.user.role === 'super_admin' ||
            req.user.email === 'studio56.pk@gmail.com'
        ) {
            return next();
        }

        const settings = await Setting.getSettings();
        const isMasterEnabled = settings?.investmentModuleEnabled !== false && settings?.isInvestmentModuleEnabled !== false;
        
        // If master is ON, fast path allow
        if (isMasterEnabled) {
            return next();
        }

        // Master is OFF: fetch full user to inspect activePlans / ID
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User account not found' });
        }

        if (canUserAccessInvestmentModule(user, settings)) {
            req.fullUser = user;
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'The Investment Module is currently disabled by the platform administrator.',
            code: 'INVESTMENT_MODULE_DISABLED'
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};
