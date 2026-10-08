import AdminSurveyTemplate from '../models/AdminSurveyTemplate.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import UserTask from '../models/UserTask.js';

/**
 * Survey Requirement Evaluation Service
 * 
 * PHASE 1 ARCHITECTURE:
 * Handles the data contract and evaluation logic for:
 * - 'optional' (default)
 * - 'mandatory_all'
 * - 'mandatory_before_withdrawal'
 * 
 * IMPORTANT:
 * Actual withdrawal enforcement remains OFF in Phase 1 to preserve 
 * 100% financial integrity in withdrawalsController.js.
 */

export const REQUIREMENT_MODES = {
    OPTIONAL: 'optional',
    MANDATORY_ALL: 'mandatory_all',
    MANDATORY_TARGETED: 'mandatory_targeted',
    MANDATORY_BEFORE_WITHDRAWAL: 'mandatory_before_withdrawal'
};

export const RECOMPLETION_POLICIES = {
    NEVER: 'never',
    ON_VERSION_CHANGE: 'on_version_change',
    EVERY_X_DAYS: 'every_x_days'
};

/**
 * Checks if a specific user has satisfied requirement contracts for active templates.
 * @param {string} userId - Target user ID
 * @param {string} context - 'all' or 'withdrawal'
 * @returns {Promise<{ isCompliant: boolean, isEnforcementActive: boolean, pendingTemplates: Array }>}
 */
export const checkUserSurveyRequirements = async (userId, context = 'all') => {
    try {
        if (!userId) {
            return {
                isCompliant: true,
                isEnforcementActive: false,
                pendingTemplates: [],
                message: 'No user provided'
            };
        }

        // Filter templates based on context
        const query = { enabled: true };
        if (context === 'withdrawal') {
            query['requirementConfig.mode'] = REQUIREMENT_MODES.MANDATORY_BEFORE_WITHDRAWAL;
        } else {
            query['requirementConfig.mode'] = {
                $in: [REQUIREMENT_MODES.MANDATORY_ALL, REQUIREMENT_MODES.MANDATORY_BEFORE_WITHDRAWAL]
            };
        }

        const requiredTemplates = await AdminSurveyTemplate.find(query).lean();
        if (!requiredTemplates || requiredTemplates.length === 0) {
            return {
                isCompliant: true,
                isEnforcementActive: false,
                pendingTemplates: []
            };
        }

        const pendingTemplates = [];

        for (const tmpl of requiredTemplates) {
            // Find user tasks created from or matching this survey template
            const matchingTasks = await UserTask.find({
                isSurvey: true,
                $or: [
                    { 'surveyConfig.title': tmpl.surveyConfig?.title },
                    { title: tmpl.name }
                ]
            }).select('_id').lean();

            const taskIds = matchingTasks.map(t => t._id);

            if (taskIds.length === 0) {
                // If no active campaign has been published from this template yet, do not block user
                continue;
            }

            // Find completed submissions by user for these tasks
            const submissions = await UserTaskSubmission.find({
                userId,
                taskId: { $in: taskIds },
                status: 'Approved'
            }).sort({ createdAt: -1 }).lean();

            if (submissions.length === 0) {
                pendingTemplates.push({
                    templateId: tmpl._id,
                    name: tmpl.name,
                    requirementMode: tmpl.requirementConfig.mode,
                    reason: 'Not yet completed'
                });
                continue;
            }

            const latestSubmission = submissions[0];

            // Re-completion policy check
            const policy = tmpl.recompletionPolicy?.policy || RECOMPLETION_POLICIES.NEVER;
            if (policy === RECOMPLETION_POLICIES.ON_VERSION_CHANGE) {
                const submissionVersion = latestSubmission.surveyVersion || 1;
                if (submissionVersion < tmpl.version) {
                    pendingTemplates.push({
                        templateId: tmpl._id,
                        name: tmpl.name,
                        requirementMode: tmpl.requirementConfig.mode,
                        reason: `Survey updated to version ${tmpl.version}`
                    });
                }
            } else if (policy === RECOMPLETION_POLICIES.EVERY_X_DAYS) {
                const intervalDays = tmpl.recompletionPolicy?.intervalDays || 30;
                const expirationMs = intervalDays * 24 * 60 * 60 * 1000;
                const submissionAge = Date.now() - new Date(latestSubmission.createdAt).getTime();

                if (submissionAge > expirationMs) {
                    pendingTemplates.push({
                        templateId: tmpl._id,
                        name: tmpl.name,
                        requirementMode: tmpl.requirementConfig.mode,
                        reason: `Required re-completion every ${intervalDays} days`
                    });
                }
            }
        }

        return {
            // In Phase 1, enforcement is prepared but kept inactive for withdrawal protection:
            isCompliant: pendingTemplates.length === 0,
            isEnforcementActive: false, // Explicitly false per Phase 1 rule
            pendingTemplates
        };
    } catch (err) {
        console.error('[SURVEY REQUIREMENT SERVICE ERROR]', err);
        return {
            isCompliant: true,
            isEnforcementActive: false,
            pendingTemplates: []
        };
    }
};
