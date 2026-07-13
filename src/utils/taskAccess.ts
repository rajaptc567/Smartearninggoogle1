import { User, Settings } from '../types';

export function canUserAccessTasks(currentUser: User | null, settings: Settings): boolean {
    if (!currentUser) return false;
    const mode = settings.userTaskAccessMode || 'all';
    if (mode === 'all') return true;
    if (mode === 'manual') {
        const allowed = settings.userTaskAllowedUserIds || [];
        return allowed.includes(currentUser._id) || allowed.includes(currentUser.email) || allowed.includes(currentUser.username);
    }
    if (mode === 'plan') {
        const allowedPlans = settings.userTaskAllowedPlanIds || [];
        const userPlans = currentUser.activePlans || [];
        if (allowedPlans.length === 0) {
            return userPlans.length > 0;
        }
        return userPlans.some(p => allowedPlans.includes(p.planId));
    }
    return true;
}
