
import { User, Task, UserTask, UserTaskSubmission, Settings } from '../types';

export const isUserEligibleForUserTask = (
    user: User,
    settings: Settings,
    tasks: Task[],
    userTasks: UserTask[],
    submissions: UserTaskSubmission[]
): boolean => {
    if (!settings.mandatoryWithdrawalRequirement?.enabled) return false;

    const reqTaskId = settings.mandatoryWithdrawalRequirement.requiredTaskId;
    if (!reqTaskId) return false;

    // 1. Check if it's a UserTask
    const ut = (userTasks || []).find((t: any) => String(t._id) === reqTaskId);
    if (ut) {
        if (ut.status === 'On Hold') return false;
        
        // Targeting check
        const reqMode = ut.requirementMode || (ut.isMandatoryForAllUsers ? 'mandatory_all' : 'optional');
        if (reqMode === 'mandatory_targeted' && ut.targeting) {
            const targeting = ut.targeting;
            const userCountry = (user.country || '').trim().toLowerCase();
            const userCurrency = (user.currency || '').trim().toUpperCase();
            const userIdStr = String(user._id || '');

            if (Array.isArray(targeting.countries) && targeting.countries.length > 0) {
                if (userCountry && !targeting.countries.map((c: string) => c.trim().toLowerCase()).includes(userCountry)) return false;
            }
            if (Array.isArray(targeting.currencies) && targeting.currencies.length > 0) {
                if (userCurrency && !targeting.currencies.map((c: string) => c.trim().toUpperCase()).includes(userCurrency)) return false;
            }
            if (Array.isArray(targeting.selectedUserIds) && targeting.selectedUserIds.length > 0) {
                if (userIdStr && !targeting.selectedUserIds.map((id: string) => String(id).trim()).includes(userIdStr)) return false;
            }
        }

        // Completion check
        const isSurvey = Boolean(ut.isSurvey);
        const reqVersion = Number(settings.mandatoryWithdrawalRequirement.requiredTaskVersion) || 1;
        
        const sub = submissions.find((s: any) =>
            String(s.taskId) === reqTaskId &&
            String(s.workerId) === String(user._id)
        );
        const isApproved = sub && (sub.status === 'Approved' || sub.status === 'Paid');
        const isQualified = isSurvey ? (sub?.surveyQualificationStatus !== 'Disqualified' && sub?.surveyQualificationStatus !== 'Screenout') : true;
        const versionMatch = isSurvey && reqVersion ? (Number(sub?.surveyVersion) || 1) === reqVersion : true;

        if (isApproved && isQualified && versionMatch) return false;
        return true;
    }

    // 2. Check if it's an Admin Task
    const at = (tasks || []).find((t: any) => String(t._id) === reqTaskId);
    if (at) {
        const now = new Date();
        const userCountry = (user.country || '').trim().toLowerCase();
        const userCurrency = (user.currency || '').trim().toUpperCase();

        if (at.status !== 'Active') return false;
        if (at.activeFrom && now < new Date(at.activeFrom)) return false;
        if (at.activeTo && now > new Date(at.activeTo)) return false;
        if (Array.isArray(at.targetCountries) && at.targetCountries.length > 0) {
            if (!userCountry || !at.targetCountries.some((c: any) => typeof c === 'string' && c.trim().toLowerCase() === userCountry)) return false;
        }
        if (Array.isArray(at.targetCurrencies) && at.targetCurrencies.length > 0) {
            if (!userCurrency || !at.targetCurrencies.some((c: any) => typeof c === 'string' && c.trim().toUpperCase() === userCurrency)) return false;
        }

        // Completion check
        const approved = (user.completedTasks || []).some((ct: any) =>
            ct && ct.status === 'Approved' && String(ct.taskId?._id || ct.taskId) === reqTaskId
        );
        if (approved) return false;
        return true;
    }

    return false;
};
