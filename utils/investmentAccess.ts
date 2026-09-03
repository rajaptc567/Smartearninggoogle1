import { User, Settings } from '../types';

/**
 * Client-Side Centralized Investment Module Access Decision
 * 
 * Matrix:
 * 1. Admin/Super Admin -> ALWAYS true (supports admin preview)
 * 2. If Master Toggle (investmentModuleEnabled !== false && isInvestmentModuleEnabled !== false) -> true
 * 3. If Master Toggle is OFF:
 *    a) If investmentActivePlanBypassEnabled === true AND user has active plans -> true
 *    b) If investmentManualWhitelistEnabled === true AND user ID is in whitelist -> true
 *    c) Otherwise -> false
 */
export const canAccessInvestmentModule = (
    user: User | null | undefined, 
    settings: Settings | null | undefined
): boolean => {
    if (!user) return false;

    // 1. Administrators and Super Admins always have access
    if (
        user.role === 'admin' || 
        user.role === 'super_admin' || 
        user.email === 'studio56.pk@gmail.com' || 
        user.email === 'smartexn.com@gmail.com'
    ) {
        return true;
    }

    // 2. Check Master Investment Module Toggle
    const isMasterEnabled = settings?.investmentModuleEnabled !== false && settings?.isInvestmentModuleEnabled !== false;
    if (isMasterEnabled) {
        return true;
    }

    // 3. Active Plan Bypass
    if (settings?.investmentActivePlanBypassEnabled) {
        const hasActivePlans = (Array.isArray(user.activePlans) && user.activePlans.length > 0) ||
                               (Boolean(user.activePlan) && user.activePlan !== 'None');
        if (hasActivePlans) {
            return true;
        }
    }

    // 4. Manual Member Whitelist
    if (settings?.investmentManualWhitelistEnabled) {
        const whitelist = Array.isArray(settings.investmentManualWhitelistUserIds)
            ? settings.investmentManualWhitelistUserIds
            : [];
        const userIdStr = String(user._id || (user as any).id || '');
        if (userIdStr && whitelist.some(id => String(id) === userIdStr)) {
            return true;
        }
    }

    return false;
};

/**
 * Check if the Master Toggle itself is currently OFF globally.
 */
export const isMasterInvestmentDisabled = (settings: Settings | null | undefined): boolean => {
    if (!settings) return false;
    return settings.investmentModuleEnabled === false || settings.isInvestmentModuleEnabled === false;
};
