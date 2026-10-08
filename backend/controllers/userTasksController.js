import mongoose from 'mongoose';
import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Setting from '../models/Setting.js';
import { canUserAccessInvestmentModule } from '../utils/investmentAccess.js';
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import { sendTemplateNotification } from '../utils/automation.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';
import { isUserEligibleForUserTask } from '../utils/userTaskEligibility.js';

// Centralized admin role check
const isUserAdmin = (user) => Boolean(user && (user.role === 'admin' || user.role === 'super_admin'));

/**
 * Evaluates whether an authenticated user is authorized to access the Micro Task Hub as a worker.
 * 
 * Access Rules:
 * 1. Admin / Super Admin -> ALWAYS true
 * 2. If settings.hubEnabled === false -> false for normal workers
 * 3. If settings.hubEnabled !== false:
 *    - hubAccessMode === 'all' (or unset) -> true
 *    - hubAccessMode === 'manual' -> true ONLY if user's _id is in settings.hubAllowedUserIds
 *    - hubAccessMode === 'plan' -> true ONLY if user has at least one active plan matching settings.hubAllowedPlanIds
 * 
 * @param {Object} user - User document or object
 * @param {Object} settings - System settings document or object
 * @returns {boolean} Whether worker access to Micro Task Hub is granted
 */
export const canUserAccessMicroTaskHub = (user, settings) => {
    if (!user) return false;

    // 1. Administrators and Super Admins always have access
    if (isUserAdmin(user)) {
        return true;
    }

    // 2. Check Global Micro Task Hub Master Switch
    if (settings?.hubEnabled === false) {
        return false;
    }

    // 3. Evaluate Access Mode
    const accessMode = settings?.hubAccessMode || 'all';

    if (accessMode === 'all') {
        return true;
    }

    if (accessMode === 'manual') {
        const allowedUserIds = Array.isArray(settings?.hubAllowedUserIds)
            ? settings.hubAllowedUserIds
            : [];
        const userIdStr = (user._id || user.id)?.toString();
        if (!userIdStr) return false;
        return allowedUserIds.some(id => id && String(id) === userIdStr);
    }

    if (accessMode === 'plan') {
        const allowedPlanIds = Array.isArray(settings?.hubAllowedPlanIds)
            ? settings.hubAllowedPlanIds
            : [];
        if (allowedPlanIds.length === 0) {
            return false;
        }

        const normalizedAllowedPlanIds = allowedPlanIds
            .filter(Boolean)
            .map(id => String(id).trim());

        if (normalizedAllowedPlanIds.length === 0) {
            return false;
        }

        // Match against user.activePlans[].planId
        if (Array.isArray(user.activePlans) && user.activePlans.length > 0) {
            const hasMatchingPlan = user.activePlans.some(ap => {
                const pId = (ap?.planId?._id || ap?.planId || ap?.id)?.toString()?.trim();
                return pId && normalizedAllowedPlanIds.includes(pId);
            });
            if (hasMatchingPlan) {
                return true;
            }
        }

        return false;
    }

    return false;
};

// Helper for multi-document ACID transactions when replica set is available, with safe fallback
const executeWithOptionalTransaction = async (workFn) => {
    let session = null;
    let useSession = false;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        useSession = true;
    } catch (_) {
        if (session) {
            try { await session.endSession(); } catch (_) {}
            session = null;
        }
        useSession = false;
    }

    try {
        const result = await workFn(useSession ? session : null);
        if (useSession && session) {
            await session.commitTransaction();
        }
        return result;
    } catch (err) {
        if (useSession && session) {
            try { await session.abortTransaction(); } catch (_) {}
        }
        throw err;
    } finally {
        if (session) {
            try { await session.endSession(); } catch (_) {}
        }
    }
};

const toWorkerSafeUserTask = (task) => {
    if (!task) return task;
    const safeTask = {};
    const allowedFields = [
        '_id',
        'userId',
        'userName',
        'category',
        'subType',
        'title',
        'description',
        'link',
        'targetQuantity',
        'currentCompletions',
        'rewardPerTask',
        'currency',
        'requireTextProof',
        'textProofInstruction',
        'requireUsername',
        'usernameInstruction',
        'requireUserId',
        'userIdInstruction',
        'requireEmail',
        'emailInstruction',
        'requireScreenshot',
        'screenshotInstruction',
        'requiredProofs',
        'status',
        'reviewRequested',
        'resubmittedForReview',
        'userReviewMessage',
        'isSurvey',
        'surveyEstimatedMinutes',
        'surveyQuestionsCount',
        'surveyConfig',
        'surveyVersion',
        'isAdminResearchSurvey',
        'isMandatoryForAllUsers',
        'isUnlimitedResponses',
        'campaignFundingStatus',
        'sourceAdminSurveyTemplateId',
        'createdAt',
        'updatedAt',
        'date'
    ];

    for (const field of allowedFields) {
        if (task[field] !== undefined) {
            safeTask[field] = task[field];
        }
    }

    if (task.isUnlimitedResponses) {
        safeTask.campaignHasAvailableReward = task.rewardPerTask === 0
            ? true
            : Boolean(
                (task.campaignAvailableBalanceUSD || 0) >= task.rewardPerTask &&
                task.campaignFundingStatus !== 'paused_insufficient_funds'
            );
    } else {
        safeTask.campaignHasAvailableReward = true;
    }

    return safeTask;
};

// Concurrency-safe atomic completion slot claiming (Phase D-3 & Parts E, F, G, N)
const claimTaskCompletionSlot = async (taskId, workerId) => {
    if (!taskId || !workerId) return null;

    const workerObjId = mongoose.Types.ObjectId.isValid(workerId)
        ? new mongoose.Types.ObjectId(workerId)
        : workerId;

    const targetTask = await UserTask.findById(taskId).lean();
    if (!targetTask) return null;

    let updatedTask = null;

    if (targetTask.isUnlimitedResponses) {
        if (targetTask.rewardPerTask === 0) {
            // Free Unlimited Survey: No cap on slots, only verify not completed yet and active status
            updatedTask = await UserTask.findOneAndUpdate(
                {
                    _id: taskId,
                    status: { $in: ['Approved', 'Paid', 'Active'] },
                    completedUsers: { $ne: workerObjId }
                },
                {
                    $inc: { currentCompletions: 1 },
                    $addToSet: { completedUsers: workerObjId }
                },
                { new: true }
            );
        } else {
            // Paid Unlimited Survey: Atomically check and deduct reward from available balance
            const reward = Number((targetTask.rewardPerTask || 0).toFixed(2));
            updatedTask = await UserTask.findOneAndUpdate(
                {
                    _id: taskId,
                    status: { $in: ['Approved', 'Paid', 'Active'] },
                    campaignFundingStatus: { $ne: 'paused_insufficient_funds' },
                    campaignAvailableBalanceUSD: { $gte: reward },
                    completedUsers: { $ne: workerObjId }
                },
                {
                    $inc: { 
                        currentCompletions: 1,
                        campaignAvailableBalanceUSD: -reward,
                        campaignTotalSpentUSD: reward
                    },
                    $addToSet: { completedUsers: workerObjId }
                },
                { new: true }
            );

            if (updatedTask) {
                // If balance is now below the reward needed for the next completion, mark as paused_insufficient_funds
                if (updatedTask.campaignAvailableBalanceUSD < reward) {
                    try {
                        await UserTask.findByIdAndUpdate(updatedTask._id, {
                            $set: { 
                                campaignFundingStatus: 'paused_insufficient_funds',
                                status: 'On Hold'
                            },
                            $push: {
                                history: {
                                    action: 'Funding Pause',
                                    previousStatus: updatedTask.status,
                                    newStatus: 'On Hold',
                                    timestamp: new Date(),
                                    performedBy: 'System Engine',
                                    details: `Campaign automatically paused due to zero/insufficient campaign available balance ($${updatedTask.campaignAvailableBalanceUSD.toFixed(2)} USD remaining).`
                                }
                            }
                        });
                        updatedTask.campaignFundingStatus = 'paused_insufficient_funds';
                        updatedTask.status = 'On Hold';
                    } catch (pErr) {
                        console.error('Warning: Failed to update funding status to paused_insufficient_funds:', pErr.message);
                    }
                }

                // Low Balance Warning Check (Idempotent: Trigger once per threshold crossing)
                const thresholdPercent = updatedTask.lowBalanceThresholdPercent || 10;
                const totalFunded = updatedTask.campaignTotalFundedUSD || 0;
                const warningThreshold = totalFunded * (thresholdPercent / 100);

                if (totalFunded > 0 && updatedTask.campaignAvailableBalanceUSD <= warningThreshold && !updatedTask.lowBalanceWarningSent) {
                    try {
                        await UserTask.findByIdAndUpdate(updatedTask._id, { $set: { lowBalanceWarningSent: true } });
                        updatedTask.lowBalanceWarningSent = true;

                        // Create administrative notification
                        await Notification.create({
                            title: 'Survey Campaign Low Balance Warning',
                            message: `Survey campaign "${updatedTask.title}" has reached a low balance of $${updatedTask.campaignAvailableBalanceUSD.toFixed(2)} USD (at/below ${thresholdPercent}% of $${totalFunded.toFixed(2)} USD total budget). Please add campaign funds to keep it running.`,
                            type: 'system_alert',
                            targetRole: 'admin',
                            category: 'campaign',
                            relatedId: updatedTask._id
                        }).catch(() => {});
                    } catch (notifErr) {
                        console.error('Warning: Low balance notification error:', notifErr.message);
                    }
                }
            }
        }
    } else {
        // Limited Task / Survey: Standard targetQuantity slot reservation
        updatedTask = await UserTask.findOneAndUpdate(
            {
                _id: taskId,
                status: { $ne: 'Rejected' },
                $expr: { $lt: ['$currentCompletions', '$targetQuantity'] },
                completedUsers: { $ne: workerObjId }
            },
            {
                $inc: { currentCompletions: 1 },
                $addToSet: { completedUsers: workerObjId }
            },
            { new: true }
        );

        if (updatedTask && updatedTask.currentCompletions >= updatedTask.targetQuantity && updatedTask.status !== 'Completed') {
            try {
                await UserTask.findByIdAndUpdate(updatedTask._id, { $set: { status: 'Completed' } });
                updatedTask.status = 'Completed';
            } catch (statusErr) {
                console.error('Warning: Failed to update UserTask status to Completed:', statusErr.message);
                updatedTask.status = 'Completed';
            }
        }
    }

    return updatedTask;
};

// Compensation helper to release a slot if subsequent submission processing fails
const releaseTaskCompletionSlot = async (taskId, workerId) => {
    if (!taskId || !workerId) return null;

    const workerObjId = mongoose.Types.ObjectId.isValid(workerId)
        ? new mongoose.Types.ObjectId(workerId)
        : workerId;

    const targetTask = await UserTask.findById(taskId).lean();
    if (!targetTask) return null;

    let updateDoc = {
        $inc: { currentCompletions: -1 },
        $pull: { completedUsers: workerObjId }
    };

    if (targetTask.isUnlimitedResponses && targetTask.rewardPerTask > 0) {
        const reward = Number((targetTask.rewardPerTask || 0).toFixed(2));
        updateDoc.$inc.campaignAvailableBalanceUSD = reward;
        updateDoc.$inc.campaignTotalSpentUSD = -reward;
    }

    const updatedTask = await UserTask.findOneAndUpdate(
        {
            _id: taskId,
            completedUsers: workerObjId
        },
        updateDoc,
        { new: true }
    );

    if (updatedTask && updatedTask.status === 'Completed' && !updatedTask.isUnlimitedResponses && updatedTask.currentCompletions < updatedTask.targetQuantity) {
        try {
            await UserTask.findByIdAndUpdate(updatedTask._id, { $set: { status: 'Approved' } });
            updatedTask.status = 'Approved';
        } catch (statusErr) {
            console.error('Warning: Failed to update UserTask status to Approved during slot release:', statusErr.message);
            updatedTask.status = 'Approved';
        }
    }

    return updatedTask;
};

export const getUserTasks = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required to access user tasks.' });
        }

        // For admin/super_admin, preserve administrative access to all UserTask records
        if (isUserAdmin(req.user)) {
            const tasks = await UserTask.find().sort({ createdAt: -1 });
            return res.status(200).json({ success: true, count: tasks.length, data: tasks });
        }

        const user = await User.findById(req.user.id).lean();
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        const settings = await Setting.getSettings();
        const isHubAccessible = canUserAccessMicroTaskHub(user, settings);
        const isTasksEnabled = settings ? settings.isTasksEnabled !== false : true;

        const tasks = await UserTask.find().sort({ createdAt: -1 }).lean();

        // Check if worker tasks can be retrieved (either via normal Hub access or via mandatory-all Admin Surveys)
        const hasMandatoryAllSurveys = tasks.some(t => Boolean(t.isAdminResearchSurvey && t.isMandatoryForAllUsers));
        const shouldEvaluateWorkerTasks = (isHubAccessible && isTasksEnabled) || hasMandatoryAllSurveys;

        // E1: Preload worker submissions for tasks referenced in completionRules or surveyAnswerRules (N+1 protection)
        let workerSubmissions = [];
        if (shouldEvaluateWorkerTasks) {
            const referencedTaskIdsSet = new Set();
            for (const task of tasks) {
                const isMandatoryAllAdminSurvey = Boolean(task.isAdminResearchSurvey && task.isMandatoryForAllUsers);
                const isWorkerCandidate = isMandatoryAllAdminSurvey || (isHubAccessible && isTasksEnabled);
                if (!isWorkerCandidate) continue;

                const t = task.targeting;
                if (t) {
                    if (Array.isArray(t.completionRules)) {
                        for (const cr of t.completionRules) {
                            if (cr.taskId) referencedTaskIdsSet.add(cr.taskId);
                        }
                    }
                    if (Array.isArray(t.surveyAnswerRules)) {
                        for (const sr of t.surveyAnswerRules) {
                            if (sr.taskId) referencedTaskIdsSet.add(sr.taskId);
                        }
                    }
                }
            }

            if (referencedTaskIdsSet.size > 0) {
                workerSubmissions = await UserTaskSubmission.find({
                    workerId: user._id,
                    taskId: { $in: Array.from(referencedTaskIdsSet) }
                }).sort({ createdAt: -1 }).lean();
            }
        }
        const eligibilityContext = { submissions: workerSubmissions };

        const filteredTasks = [];

        for (const task of tasks) {
            const isOwner = task.userId && String(task.userId) === String(user._id);
            if (isOwner) {
                // Return full task for campaign owner
                if (task.isUnlimitedResponses) {
                    task.campaignHasAvailableReward = task.rewardPerTask === 0
                        ? true
                        : Boolean(
                            (task.campaignAvailableBalanceUSD || 0) >= task.rewardPerTask &&
                            task.campaignFundingStatus !== 'paused_insufficient_funds'
                        );
                } else {
                    task.campaignHasAvailableReward = true;
                }
                filteredTasks.push(task);
            } else {
                const isMandatoryAllAdminSurvey = Boolean(task.isAdminResearchSurvey && task.isMandatoryForAllUsers);
                const isWorkerAllowed = isMandatoryAllAdminSurvey || (isHubAccessible && isTasksEnabled);

                if (isWorkerAllowed) {
                    const isLiveStatus = task.status === 'Approved' || task.status === 'Paid' || task.status === 'Active';
                    const hasAvailableSlots = task.isUnlimitedResponses
                        ? (task.rewardPerTask === 0 || (task.campaignAvailableBalanceUSD >= task.rewardPerTask && task.campaignFundingStatus !== 'paused_insufficient_funds'))
                        : ((task.currentCompletions || 0) < (task.targetQuantity || 0));

                    const alreadyCompleted = Array.isArray(task.completedUsers) && task.completedUsers.some(cu => String(cu?._id || cu) === String(user._id));

                    if (isLiveStatus && hasAvailableSlots && !alreadyCompleted && isUserEligibleForUserTask(user, task, eligibilityContext)) {
                        // Return sanitized worker-safe task for eligible non-owner
                        filteredTasks.push(toWorkerSafeUserTask(task));
                    }
                }
            }
        }

        res.status(200).json({ success: true, count: filteredTasks.length, data: filteredTasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createUserTask = async (req, res) => {
    let adminBudgetReserved = false;
    let reservedAmountUSD = 0;
    let createdTask = null;
    let createdTransaction = null;
    let settingId = null;
    let isCreatedByAdmin = false;
    let user = null;
    let totalAmountUSD = 0;
    let finalIdempotencyKey = null;
    try {
        const { 
            userId, category, subType, title, description, link, targetQuantity, rewardPerTask,
            requireTextProof, textProofInstruction,
            requireUsername, usernameInstruction,
            requireUserId, userIdInstruction,
            requireEmail, emailInstruction,
            requireScreenshot, screenshotInstruction,
            requiredProofs
        } = req.body;

        isCreatedByAdmin = Boolean(req.user && isUserAdmin(req.user));
        // Server-side authoritative flag: A non-admin user can NEVER set isAdminResearchSurvey or isMandatoryForAllUsers
        const isAdminResearchSurvey = Boolean(isCreatedByAdmin && (req.body.isAdminResearchSurvey === true || req.body.sourceAdminSurveyTemplateId));
        const isMandatoryForAllUsers = Boolean(isAdminResearchSurvey && req.body.isMandatoryForAllUsers === true);
        const sourceAdminSurveyTemplateId = (isAdminResearchSurvey && req.body.sourceAdminSurveyTemplateId) 
            ? req.body.sourceAdminSurveyTemplateId 
            : null;

        const effectiveUserId = (!isCreatedByAdmin) 
            ? req.user?.id 
            : (userId || req.user?.id);

        if (!effectiveUserId) {
            return res.status(400).json({ success: false, error: 'User ID is required.' });
        }

        const isSurveyTask = String(category || '').trim().toLowerCase() === 'survey' || Boolean(req.body.isSurvey);
        const effectiveLink = isSurveyTask ? (link || 'https://internal.survey') : link;

        if (effectiveLink) {
            const urlString = String(effectiveLink).trim();
            if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
                return res.status(400).json({ success: false, error: 'Task URL must start with http:// or https://' });
            }
        }

        const isUnlimitedResponses = Boolean(isAdminResearchSurvey && req.body.isUnlimitedResponses === true);
        const qtyNum = isUnlimitedResponses ? 0 : Number(targetQuantity !== undefined ? targetQuantity : req.body.workersNeeded);
        const rewardNum = Number(rewardPerTask);

        if (!isUnlimitedResponses && (isNaN(qtyNum) || !isFinite(qtyNum) || qtyNum <= 0)) {
            return res.status(400).json({ success: false, error: 'Target quantity must be a valid positive number.' });
        }

        if (isAdminResearchSurvey) {
            // Authorized Admin Research Survey: 0 (No Reward) or custom non-negative finite number allowed
            if (isNaN(rewardNum) || !isFinite(rewardNum) || rewardNum < 0) {
                return res.status(400).json({ success: false, error: 'Reward per task must be a valid non-negative number.' });
            }
        } else {
            // Normal user or standard paid task: strictly positive reward required
            if (isNaN(rewardNum) || !isFinite(rewardNum) || rewardNum <= 0) {
                return res.status(400).json({ success: false, error: 'Target quantity and reward per task must be valid positive numbers.' });
            }
        }
        
        const settings = await Setting.getSettings();
        settingId = settings?._id;
        if (settings.isUserTaskEnabled === false) {
            return res.status(400).json({ success: false, error: 'User task submissions are currently disabled by administrator.' });
        }

        const isSurveyGloballyEnabled = settings.surveyCampaignsEnabled !== false && 
                                        settings.taskCategoryPresets?.survey?.enabled !== false;
        if (isSurveyTask && !isAdminResearchSurvey && !isSurveyGloballyEnabled) {
            return res.status(400).json({ success: false, error: 'Survey campaigns are currently disabled by administrator.' });
        }

        const surveyConfig = req.body.surveyConfig || null;
        let minSurveyRewardRequired = 0;
        if (isSurveyTask) {
            if (!surveyConfig || !Array.isArray(surveyConfig.questions) || surveyConfig.questions.length === 0) {
                return res.status(400).json({ success: false, error: 'Survey campaigns require at least one question in surveyConfig.' });
            }

            // Backend cycle detection, max options enforcement, and check question integrity validation
            const questionIds = new Set(surveyConfig.questions.map(q => q.id));
            for (let i = 0; i < surveyConfig.questions.length; i++) {
                const q = surveyConfig.questions[i];
                if (!q.id || !q.title) {
                    return res.status(400).json({ success: false, error: `Survey question at position ${i + 1} must have an id and title.` });
                }

                // Enforce maximum answer options (default 10 for standard users, up to 30 for authorized admin research surveys)
                const maxOptionsAllowed = isAdminResearchSurvey
                    ? (settings.surveyConfig?.maxAdminOptionsPerQuestion || 30)
                    : (settings.surveyConfig?.maxOptionsPerQuestion || 10);
                if (['single_choice', 'multiple_choice', 'dropdown'].includes(q.type)) {
                    if (Array.isArray(q.options) && q.options.length > maxOptionsAllowed) {
                        return res.status(400).json({ 
                            success: false, 
                            error: `Question "${q.title}" exceeds the maximum limit of ${maxOptionsAllowed} answer options.` 
                        });
                    }
                }

                // Validate check questions
                if (q.isCheckQuestion) {
                    if (!q.sourceQuestionId || !questionIds.has(q.sourceQuestionId)) {
                        return res.status(400).json({ success: false, error: `Check question "${q.title}" references a non-existent source question.` });
                    }
                    const sourceIdx = surveyConfig.questions.findIndex(sq => sq.id === q.sourceQuestionId);
                    if (sourceIdx >= i) {
                        return res.status(400).json({ success: false, error: `Check question "${q.title}" must appear after its source question.` });
                    }
                }

                // Validate branching logic
                if (Array.isArray(q.logicRules)) {
                    for (const rule of q.logicRules) {
                        if (rule.action === 'goto_question' && rule.targetQuestionId) {
                            if (!questionIds.has(rule.targetQuestionId)) {
                                return res.status(400).json({ success: false, error: `Logic rule in "${q.title}" points to invalid target question ID.` });
                            }
                            const targetIdx = surveyConfig.questions.findIndex(tq => tq.id === rule.targetQuestionId);
                            if (targetIdx <= i) {
                                return res.status(400).json({ success: false, error: `Logic rule in "${q.title}" creates an invalid loop or backward jump.` });
                            }
                        }
                    }
                }
            }

            // Honor admin rotation policies
            if (surveyConfig.enableQuestionRotation && settings.surveyConfig?.rotationRules?.allowQuestionRotation === false) {
                surveyConfig.enableQuestionRotation = false;
            }
            if (surveyConfig.enableOptionRotation && settings.surveyConfig?.rotationRules?.allowOptionRotation === false) {
                surveyConfig.enableOptionRotation = false;
            }

            // Backend Pricing Calculation: Never trust frontend reward amounts
            const pricingRules = settings.surveyConfig?.pricingRules || {};
            const baseRate = Number(pricingRules.baseReward || 0.15);
            const perQuestionRate = Number(pricingRules.perQuestionRate || 0.02);
            const estMinutes = Number(surveyConfig.estimatedTimeMinutes) || 5;
            const timeSurcharge = estMinutes > 5 ? (estMinutes - 5) * 0.03 : 0;
            minSurveyRewardRequired = Number((baseRate + (surveyConfig.questions.length * perQuestionRate) + timeSurcharge).toFixed(2));
        }

        const presets = settings.taskCategoryPresets;
        if (presets && !isAdminResearchSurvey) {
            const catLower = category.toLowerCase();
            const platKey = catLower === 'website' ? 'paidSignUp' : catLower;
            const platformConfig = presets[platKey];
            if (platformConfig && platformConfig.enabled === false) {
                return res.status(400).json({ success: false, error: `${category} category is currently disabled by administrator.` });
            }

            // Subtype checks
            let subtypeEnabled = true;
            if (platKey === 'youtube') {
                if (subType === 'Subscribe' && presets.youtube?.subscriber?.enabled === false) subtypeEnabled = false;
                if (subType === 'Like' && presets.youtube?.likes?.enabled === false) subtypeEnabled = false;
                if (subType === 'Comment' && presets.youtube?.comments?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'facebook') {
                if (subType === 'Follow' && presets.facebook?.likeFollow?.enabled === false) subtypeEnabled = false;
                if (subType === 'Like' && presets.facebook?.videoLike?.enabled === false) subtypeEnabled = false;
                if (subType === 'Comment' && presets.facebook?.comments?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'instagram') {
                if (subType === 'Follow' && presets.instagram?.profileFollow?.enabled === false) subtypeEnabled = false;
                if (subType === 'Like' && presets.instagram?.postLike?.enabled === false) subtypeEnabled = false;
                if (subType === 'Comment' && presets.instagram?.comments?.enabled === false) subtypeEnabled = false;
                if (subType === 'Watch Time' && presets.instagram?.reelView?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'google') {
                if (subType === 'Review' && presets.google?.reviews?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'paidSignUp') {
                if (subType === 'Sign-up' && presets.paidSignUp?.simpleSignUp?.enabled === false) subtypeEnabled = false;
                if (subType === 'Other' && presets.paidSignUp?.activePlanPurchase?.enabled === false) subtypeEnabled = false;
            } else if (platformConfig) {
                // Check custom subcategory/subType
                const subKey = Object.keys(platformConfig).find(k => k.toLowerCase() === subType.toLowerCase() || (platformConfig[k] && platformConfig[k].displayName && platformConfig[k].displayName.toLowerCase() === subType.toLowerCase()));
                if (subKey && platformConfig[subKey] && platformConfig[subKey].enabled === false) {
                    subtypeEnabled = false;
                }
            }

            if (!subtypeEnabled) {
                return res.status(400).json({ success: false, error: `The micro-service ${subType} for ${category} is currently disabled by administrator.` });
            }
        }

        const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10, campaignFeeEnabled: false, campaignFeeAmount: 1.00 };
        if (!isUnlimitedResponses && qtyNum < config.minQuantity) {
            return res.status(400).json({ success: false, error: `Minimum target quantity is ${config.minQuantity}.` });
        }

        // CRITICAL SAFETY RULE: Minimum pricing exemption applies ONLY to authorized Admin Research Surveys
        if (!isAdminResearchSurvey) {
            if (rewardNum < config.minRewardAmount) {
                return res.status(400).json({ success: false, error: `Minimum reward amount per task is ${config.minRewardAmount} USD.` });
            }
            if (isSurveyTask && rewardNum < minSurveyRewardRequired) {
                return res.status(400).json({ success: false, error: `Minimum reward amount for this survey based on question complexity and duration is ${minSurveyRewardRequired} USD.` });
            }
        }

        user = await User.findById(effectiveUserId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // Entire setup in USD
        const effectiveRewardPerTask = Number(rewardNum.toFixed(2));
        let subtotal = 0;
        let adminCommission = 0;
        let totalBudget = 0;
        let baseFeeCharged = 0;
        totalAmountUSD = 0;
        let initialFundingAllocatedUSD = 0;

        if (isUnlimitedResponses) {
            if (effectiveRewardPerTask === 0) {
                // Free unlimited survey: zero financial commitment
                subtotal = 0;
                adminCommission = 0;
                totalBudget = 0;
                baseFeeCharged = 0;
                totalAmountUSD = 0;
                initialFundingAllocatedUSD = 0;
            } else {
                // Paid unlimited survey: admin specifies initial campaign funding
                const initialFund = Number(req.body.initialFundingUSD !== undefined ? req.body.initialFundingUSD : req.body.totalBudget);
                if (isNaN(initialFund) || !isFinite(initialFund) || initialFund <= 0) {
                    return res.status(400).json({ success: false, error: 'Please specify a valid initial funding amount for this paid unlimited campaign.' });
                }
                initialFundingAllocatedUSD = Number(initialFund.toFixed(2));
                subtotal = initialFundingAllocatedUSD;
                adminCommission = 0;
                totalBudget = initialFundingAllocatedUSD;
                baseFeeCharged = 0;
                totalAmountUSD = initialFundingAllocatedUSD;
            }
        } else {
            subtotal = Number((qtyNum * effectiveRewardPerTask).toFixed(2));
            adminCommission = (isAdminResearchSurvey && effectiveRewardPerTask === 0) 
                ? 0 
                : Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
            totalBudget = Number((subtotal + adminCommission).toFixed(2));

            // Upfront Deduction Base Fee logic: No base fee liability for free/zero-reward admin research surveys
            baseFeeCharged = (isAdminResearchSurvey && effectiveRewardPerTask === 0)
                ? 0
                : (config.campaignFeeEnabled ? (config.campaignFeeAmount || 0) : 0);
            totalAmountUSD = Number((totalBudget + baseFeeCharged).toFixed(2));
        }

        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        let deductionInUserCurr = totalAmountUSD * (rates[userCurr] || 1);
        deductionInUserCurr = Number(deductionInUserCurr.toFixed(2));

        const creatorType = isCreatedByAdmin ? 'admin' : 'member';
        const fundingSourceType = isCreatedByAdmin ? 'admin_budget' : 'member_wallet';
        const adminBudgetAllocatedUSD = isCreatedByAdmin ? totalAmountUSD : 0;

        // Idempotency / Request Key logic
        const rawClientIdempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.idempotencyKey || req.body.requestId || req.body.requestKey;
        finalIdempotencyKey = typeof rawClientIdempotencyKey === 'string' ? rawClientIdempotencyKey.trim() : (rawClientIdempotencyKey || null);

        if (finalIdempotencyKey) {
            const existingTx = await Transaction.findOne({ idempotencyKey: finalIdempotencyKey });
            if (existingTx) {
                // Verify that this is the expected campaign-creation transaction
                const isExpectedType = existingTx.type === 'Campaign Creation';
                const hasValidCampaign = Boolean(existingTx.campaignId);
                const amountMatches = Math.abs(Number(existingTx.amountUSD || existingTx.amount) - totalAmountUSD) < 0.001;
                const userMatches = String(existingTx.userId) === String(user._id);

                if (!isExpectedType || !hasValidCampaign || !amountMatches || !userMatches) {
                    return res.status(409).json({
                        success: false,
                        error: `Idempotency key collision detected for ${finalIdempotencyKey}: transaction type, amount, or campaign mismatch.`
                    });
                }

                const existingTask = await UserTask.findById(existingTx.campaignId);
                if (!existingTask) {
                    return res.status(409).json({
                        success: false,
                        error: `Idempotency key collision detected for ${finalIdempotencyKey}: referenced campaign not found.`
                    });
                }
                const latestSettings = isCreatedByAdmin ? await Setting.findOne() : null;
                return res.status(200).json({ success: true, data: { task: existingTask, user, settings: latestSettings, transaction: existingTx } });
            }
        }

        createdTask = null;
        createdTransaction = null;
        adminBudgetReserved = false;
        reservedAmountUSD = 0;

        if (isCreatedByAdmin) {
            if (totalAmountUSD > 0) {
                // Atomic conditional update on Setting: only succeeds if budget is enabled AND remainingBudgetUSD >= totalAmountUSD (NEVER with Mongo session)
                const updatedSetting = await Setting.findOneAndUpdate(
                    {
                        _id: settings._id,
                        'adminCampaignBudget.enabled': true,
                        'adminCampaignBudget.remainingBudgetUSD': { $gte: totalAmountUSD }
                    },
                    {
                        $inc: { 'adminCampaignBudget.remainingBudgetUSD': -totalAmountUSD },
                        $set: { dataVersion: Date.now() }
                    },
                    { new: true }
                );

                if (!updatedSetting) {
                    const currentSetting = await Setting.getSettings();
                    if (!currentSetting.adminCampaignBudget?.enabled) {
                        return res.status(400).json({ success: false, error: 'Admin Campaign Budget is currently disabled in System Settings.' });
                    }
                    const availableBudget = Number((currentSetting.adminCampaignBudget?.remainingBudgetUSD || 0).toFixed(2));
                    return res.status(400).json({
                        success: false,
                        error: `Insufficient Admin Campaign Budget. Required: $${totalAmountUSD.toFixed(2)} USD, Available: $${availableBudget.toFixed(2)} USD.`
                    });
                }

                adminBudgetReserved = true;
                reservedAmountUSD = totalAmountUSD;
            } else {
                adminBudgetReserved = false;
                reservedAmountUSD = 0;
            }
        }

        const txResult = await executeWithOptionalTransaction(async (session) => {
            // Step 1: Idempotency check inside transaction (only if key is provided by client)
            if (finalIdempotencyKey) {
                const existingTx = await Transaction.findOne({ idempotencyKey: finalIdempotencyKey }).session(session || null);
                if (existingTx) {
                    const isExpectedType = existingTx.type === 'Campaign Creation';
                    const hasValidCampaign = Boolean(existingTx.campaignId);
                    const amountMatches = Math.abs(Number(existingTx.amountUSD || existingTx.amount) - totalAmountUSD) < 0.001;
                    const userMatches = String(existingTx.userId) === String(user._id);

                    if (!isExpectedType || !hasValidCampaign || !amountMatches || !userMatches) {
                        return { collision: true, existingTransaction: existingTx };
                    }

                    const existingTask = await UserTask.findById(existingTx.campaignId).session(session || null);
                    if (!existingTask) {
                        return { collision: true, existingTransaction: existingTx };
                    }
                    return { alreadyExists: true, task: existingTask, transaction: existingTx };
                }
            }

            let sourceFromInvestment = 0;
            let sourceFromTaskEarnings = 0;
            let sourceFromRefunds = 0;
            let deductedFromTaskWallet = false;

            if (!isCreatedByAdmin) {
                // Re-fetch user in transaction to ensure balance is strictly accurate and locked
                const userInTx = await User.findById(user._id).session(session || null);
                if (!userInTx) {
                    throw new Error('User not found.');
                }

                if ((userInTx.taskWalletBalance || 0) >= totalAmountUSD) {
                    const curSources = userInTx.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                    let remainingToDeduct = totalAmountUSD;

                    const deductRefunds = Math.min(curSources.fromRefundsUSD || 0, remainingToDeduct);
                    sourceFromRefunds = deductRefunds;
                    remainingToDeduct = Number((remainingToDeduct - deductRefunds).toFixed(2));

                    const deductInv = Math.min(curSources.fromInvestmentUSD || 0, remainingToDeduct);
                    sourceFromInvestment = deductInv;
                    remainingToDeduct = Number((remainingToDeduct - deductInv).toFixed(2));

                    const deductEarn = Math.min(curSources.fromTaskEarningsUSD || 0, remainingToDeduct);
                    sourceFromTaskEarnings = deductEarn;
                    remainingToDeduct = Number((remainingToDeduct - deductEarn).toFixed(2));

                    if (remainingToDeduct > 0) {
                        sourceFromInvestment = Number((sourceFromInvestment + remainingToDeduct).toFixed(2));
                    }

                    userInTx.campaignWalletSources = {
                        fromInvestmentUSD: Math.max(0, Number(((curSources.fromInvestmentUSD || 0) - sourceFromInvestment).toFixed(2))),
                        fromTaskEarningsUSD: Math.max(0, Number(((curSources.fromTaskEarningsUSD || 0) - sourceFromTaskEarnings).toFixed(2))),
                        fromRefundsUSD: Math.max(0, Number(((curSources.fromRefundsUSD || 0) - sourceFromRefunds).toFixed(2)))
                    };

                    userInTx.taskWalletBalance = Number(((userInTx.taskWalletBalance || 0) - totalAmountUSD).toFixed(2));
                    deductedFromTaskWallet = true;
                } else if (userInTx.walletBalance >= deductionInUserCurr) {
                    userInTx.walletBalance = Number((userInTx.walletBalance - deductionInUserCurr).toFixed(2));
                    sourceFromInvestment = totalAmountUSD;
                } else {
                    throw new Error(`Insufficient Task Wallet balance. Required: $${totalAmountUSD} USD, Available Task Wallet: $${(userInTx.taskWalletBalance || 0).toFixed(2)} USD`);
                }

                await userInTx.save(session ? { session } : undefined);
            }

            const shouldPublishNow = Boolean(isCreatedByAdmin && req.body.publishNow === true);
            const initialStatus = shouldPublishNow ? 'Approved' : 'Pending';
            const initialHistory = shouldPublishNow ? [{
                action: 'Approved',
                previousStatus: 'Pending',
                newStatus: 'Approved',
                timestamp: new Date(),
                performedBy: req.user ? req.user.id.toString() : user._id.toString(),
                details: 'Admin published campaign immediately upon creation.'
            }] : [];

            const effectiveSurveyVersion = isSurveyTask ? (Number(req.body.surveyVersion || surveyConfig?.version) || 1) : 1;
            if (isSurveyTask && surveyConfig) {
                surveyConfig.version = effectiveSurveyVersion;
            }

            let normalizedTargeting = undefined;
            if (req.body.targeting && typeof req.body.targeting === 'object') {
                const rawTargeting = req.body.targeting;
                const countries = Array.isArray(rawTargeting.countries)
                    ? rawTargeting.countries.map(c => String(c).trim()).filter(c => c.length > 0)
                    : [];
                const currencies = Array.isArray(rawTargeting.currencies)
                    ? rawTargeting.currencies.map(c => String(c).trim().toUpperCase()).filter(c => c.length > 0)
                    : [];
                const genders = Array.isArray(rawTargeting.genders)
                    ? rawTargeting.genders.map(g => String(g).trim()).filter(g => g.length > 0)
                    : [];

                let minAge = null;
                if (rawTargeting.minAge !== undefined && rawTargeting.minAge !== null && rawTargeting.minAge !== '') {
                    const parsedMin = Number(rawTargeting.minAge);
                    if (Number.isFinite(parsedMin) && !isNaN(parsedMin) && parsedMin >= 0) {
                        minAge = parsedMin;
                    }
                }

                let maxAge = null;
                if (rawTargeting.maxAge !== undefined && rawTargeting.maxAge !== null && rawTargeting.maxAge !== '') {
                    const parsedMax = Number(rawTargeting.maxAge);
                    if (Number.isFinite(parsedMax) && !isNaN(parsedMax) && parsedMax >= 0) {
                        maxAge = parsedMax;
                    }
                }

                // Advanced E1 Targeting Fields normalization & security validation
                const selectedUserIds = Array.isArray(rawTargeting.selectedUserIds)
                    ? Array.from(new Set(rawTargeting.selectedUserIds.map(id => String(id).trim()).filter(id => id.length > 0))).slice(0, 500)
                    : [];

                const validAccountStatuses = ['any', 'active', 'inactive'];
                const accountStatus = validAccountStatuses.includes(String(rawTargeting.accountStatus || '').toLowerCase())
                    ? String(rawTargeting.accountStatus).toLowerCase()
                    : 'any';

                const validOperators = ['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in'];
                const bannedProfileKeys = ['__proto__', 'constructor', 'prototype', 'username', 'email', 'password', 'role', 'phone', 'whatsapp', 'country', 'address', 'city', 'postalCode', 'telegram', 'gender', 'dateOfBirth', 'currency', 'walletBalance', 'taskWalletBalance', 'taskEarningsBalance', 'status', 'restrictions'];

                const completionRules = Array.isArray(rawTargeting.completionRules)
                    ? rawTargeting.completionRules
                        .map(rule => ({
                            taskId: String(rule?.taskId || '').trim(),
                            completed: Boolean(rule?.completed)
                        }))
                        .filter(rule => rule.taskId.length > 0 && mongoose.Types.ObjectId.isValid(rule.taskId))
                        .slice(0, 20)
                    : [];

                const profileRules = Array.isArray(rawTargeting.profileRules)
                    ? rawTargeting.profileRules
                        .map(rule => {
                            const fieldKey = String(rule?.fieldKey || '').trim();
                            const operator = String(rule?.operator || '').trim().toLowerCase();
                            const value = rule?.value;
                            if (!fieldKey || !validOperators.includes(operator)) return null;
                            if (/[.$]/.test(fieldKey)) return null; // reject dot or dollar
                            // Security: Profile targeting may ONLY read customFields (implied by model structure, but we block protected core fields here)
                            if (bannedProfileKeys.some(b => fieldKey.toLowerCase() === b.toLowerCase())) return null; 
                            if (value === undefined || value === null) return null;
                            return { fieldKey, operator, value };
                        })
                        .filter(Boolean)
                        .slice(0, 20)
                    : [];

                const surveyAnswerRules = Array.isArray(rawTargeting.surveyAnswerRules)
                    ? rawTargeting.surveyAnswerRules
                        .map(rule => {
                            const taskId = String(rule?.taskId || '').trim();
                            const questionId = String(rule?.questionId || '').trim();
                            const operator = String(rule?.operator || '').trim().toLowerCase();
                            const value = rule?.value;
                            if (!taskId || !questionId || !validOperators.includes(operator)) return null;
                            if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
                            if (value === undefined || value === null) return null;
                            return { taskId, questionId, operator, value };
                        })
                        .filter(Boolean)
                        .slice(0, 20)
                    : [];

                normalizedTargeting = {
                    countries,
                    currencies,
                    genders,
                    minAge,
                    maxAge,
                    selectedUserIds,
                    accountStatus,
                    completionRules,
                    profileRules,
                    surveyAnswerRules
                };
            }

            const [task] = await UserTask.create([{
                userId: user._id,
                userName: user.username,
                creatorType,
                fundingSourceType,
                adminBudgetAllocatedUSD,
                isUnlimitedResponses,
                campaignFundingStatus: 'funded',
                campaignAvailableBalanceUSD: isUnlimitedResponses ? initialFundingAllocatedUSD : 0,
                campaignTotalFundedUSD: isUnlimitedResponses ? initialFundingAllocatedUSD : 0,
                campaignTotalSpentUSD: 0,
                lowBalanceThresholdPercent: Number(req.body.lowBalanceThresholdPercent) || 10,
                lowBalanceWarningSent: false,
                category,
                subType: subType || 'Like',
                title,
                description,
                link: effectiveLink,
                targetQuantity: qtyNum,
                rewardPerTask: effectiveRewardPerTask,
                totalBudget,
                adminCommission,
                baseFeeCharged,
                fundingSourceBreakdown: {
                    fromInvestmentUSD: sourceFromInvestment,
                    fromTaskEarningsUSD: sourceFromTaskEarnings,
                    fromRefundsUSD: sourceFromRefunds
                },
                currency: 'USD',
                requireTextProof: Boolean(requireTextProof),
                textProofInstruction: textProofInstruction || '',
                requireUsername: Boolean(requireUsername),
                usernameInstruction: usernameInstruction || '',
                requireUserId: Boolean(requireUserId),
                userIdInstruction: userIdInstruction || '',
                requireEmail: Boolean(requireEmail),
                emailInstruction: emailInstruction || '',
                requireScreenshot: requireScreenshot !== undefined ? Boolean(requireScreenshot) : !isSurveyTask,
                screenshotInstruction: screenshotInstruction || (isSurveyTask ? 'Survey responses recorded automatically.' : 'Please upload screenshot proof of completion.'),
                requiredProofs: (Array.isArray(requiredProofs) && requiredProofs.length > 0)
                    ? requiredProofs
                    : (Array.isArray(req.body.proofRequirements) ? req.body.proofRequirements : []),
                isSurvey: isSurveyTask,
                surveyEstimatedMinutes: isSurveyTask ? (Number(req.body.surveyEstimatedMinutes || surveyConfig?.estimatedTimeMinutes) || 5) : 5,
                surveyQuestionsCount: isSurveyTask ? (Array.isArray(surveyConfig?.questions) ? surveyConfig.questions.length : (Number(req.body.surveyQuestionsCount) || 0)) : 0,
                surveyApprovalMode: isSurveyTask ? (req.body.surveyApprovalMode || surveyConfig?.approvalMode || 'auto').toLowerCase() : 'auto',
                surveyConfig: isSurveyTask ? surveyConfig : null,
                surveyVersion: effectiveSurveyVersion,
                isAdminResearchSurvey: Boolean(isAdminResearchSurvey),
                isMandatoryForAllUsers: Boolean(isMandatoryForAllUsers),
                sourceAdminSurveyTemplateId: sourceAdminSurveyTemplateId || null,
                targeting: normalizedTargeting,
                status: initialStatus,
                history: initialHistory
            }], session ? { session } : {});

            let tx = null;
            if (isCreatedByAdmin) {
                if (totalAmountUSD > 0) {
                    [tx] = await Transaction.create([{
                        userId: user._id,
                        userName: user.username,
                        currency: 'USD',
                        type: 'Task Budget Deduction',
                        amount: -totalAmountUSD,
                        amountUSD: totalAmountUSD,
                        campaignId: task._id,
                        sourceWallet: 'System',
                        destinationWallet: 'CampaignEscrow',
                        description: `Admin Campaign Budget: ${title} (Budget + Base Fee of ${baseFeeCharged} USD reserved from Admin Budget)`,
                        status: 'Approved',
                        ...(finalIdempotencyKey ? { idempotencyKey: finalIdempotencyKey } : {})
                    }], session ? { session } : {});
                }
            } else {
                [tx] = await Transaction.create([{
                    userId: user._id,
                    userName: user.username,
                    currency: deductedFromTaskWallet ? 'USD' : userCurr,
                    type: 'Task Budget Deduction',
                    amount: -(deductedFromTaskWallet ? totalAmountUSD : deductionInUserCurr),
                    amountUSD: totalAmountUSD,
                    campaignId: task._id,
                    sourceWallet: deductedFromTaskWallet ? 'CampaignFunds' : 'Investment',
                    destinationWallet: 'CampaignEscrow',
                    sourceBreakdown: {
                        fromInvestmentUSD: sourceFromInvestment,
                        fromTaskEarningsUSD: sourceFromTaskEarnings,
                        fromRefundsUSD: sourceFromRefunds
                    },
                    description: `Submitted User Task: ${title} (Budget + Base Fee of ${baseFeeCharged} USD)`,
                    status: 'Approved',
                    ...(finalIdempotencyKey ? { idempotencyKey: finalIdempotencyKey } : {})
                }], session ? { session } : {});
            }

            return { task, transaction: tx };
        });

        if (txResult.collision) {
            if (adminBudgetReserved && reservedAmountUSD > 0) {
                try {
                    const targetSettingId = settingId || (await Setting.getSettings())?._id;
                    if (targetSettingId) {
                        await Setting.findOneAndUpdate(
                            { _id: targetSettingId },
                            {
                                $inc: { 'adminCampaignBudget.remainingBudgetUSD': reservedAmountUSD },
                                $set: { dataVersion: Date.now() }
                            },
                            { new: true }
                        );
                    }
                } catch (refundErr) {
                    console.error('Failed compensating refund for collision campaign creation:', refundErr);
                }
                adminBudgetReserved = false;
            }
            return res.status(409).json({
                success: false,
                error: `Idempotency key collision detected for ${finalIdempotencyKey}: transaction type, amount, or campaign mismatch.`
            });
        }

        if (txResult.alreadyExists) {
            if (adminBudgetReserved && reservedAmountUSD > 0) {
                try {
                    const targetSettingId = settingId || (await Setting.getSettings())?._id;
                    if (targetSettingId) {
                        await Setting.findOneAndUpdate(
                            { _id: targetSettingId },
                            {
                                $inc: { 'adminCampaignBudget.remainingBudgetUSD': reservedAmountUSD },
                                $set: { dataVersion: Date.now() }
                            },
                            { new: true }
                        );
                    }
                } catch (refundErr) {
                    console.error('Failed compensating refund for duplicate campaign creation:', refundErr);
                }
                adminBudgetReserved = false;
            }
            global.appDataVersion = Date.now();
            const latestSettings = isCreatedByAdmin ? await Setting.findOne() : null;
            return res.status(200).json({
                success: true,
                message: 'Campaign already created (idempotency key matched).',
                data: {
                    task: txResult.task || {},
                    user,
                    settings: latestSettings,
                    transaction: txResult.transaction
                }
            });
        }

        createdTask = txResult.task;
        createdTransaction = txResult.transaction;

        const shouldPublishNow = Boolean(isCreatedByAdmin && req.body.publishNow === true);

        // Send Notification to Campaign Creator (non-blocking, outside of transaction)
        try {
            if (shouldPublishNow) {
                await Notification.create({
                    userId: user._id,
                    subject: 'Campaign Approved! 🟢',
                    message: `Congratulations! Your admin campaign "${createdTask.title}" has been published and is now live for workers to complete.`,
                    senderType: 'System'
                });
            } else {
                await Notification.create({
                    userId: user._id,
                    subject: 'Campaign Submitted ⏳',
                    message: `Your campaign "${createdTask.title}" has been successfully submitted for Admin approval. It will go live once reviewed.`,
                    senderType: 'System'
                });
            }
        } catch (notifErr) {
            console.error('Failed to notify campaign creator of submission:', notifErr);
        }

        // Send Email & WhatsApp automated templates
        sendTemplateNotification({
            userId: user._id,
            templateKey: 'task_campaign_created_email',
            variables: {
                taskTitle: createdTask.title,
                amount: totalAmountUSD,
                currency: 'USD',
                txId: createdTask._id.toString()
            }
        }).catch(err => console.error('Failed to send campaign created email:', err));

        sendTemplateNotification({
            userId: user._id,
            templateKey: 'task_campaign_created_whatsapp',
            variables: {
                taskTitle: createdTask.title,
                amount: totalAmountUSD,
                currency: 'USD',
                txId: createdTask._id.toString()
            }
        }).catch(err => console.error('Failed to send campaign created whatsapp:', err));

        // Send Notification to Admins
        try {
            const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
            for (const admin of admins) {
                await Notification.create({
                    userId: admin._id,
                    subject: shouldPublishNow ? 'New Campaign Published 🚀' : 'New Campaign Submission 📋',
                    message: shouldPublishNow
                        ? `Admin @${user.username} has published a new campaign "${createdTask.title}" directly to live status.`
                        : `User @${user.username} has submitted a new campaign "${createdTask.title}" for review.`,
                    senderType: 'System'
                });
            }
        } catch (adminErr) {
            console.error('Failed to notify admins of new campaign:', adminErr);
        }

        global.appDataVersion = Date.now();
        const latestSettings = isCreatedByAdmin ? await Setting.findOne() : null;
        res.status(201).json({ success: true, data: { task: createdTask, user, settings: latestSettings } });
    } catch (err) {
        if (createdTransaction) {
            try {
                await Transaction.findByIdAndDelete(createdTransaction._id);
            } catch (cleanTxErr) {
                console.error('Failed to cleanup orphan transaction on creation error:', cleanTxErr);
            }
        }
        if (createdTask) {
            try {
                await UserTask.findByIdAndDelete(createdTask._id);
            } catch (cleanTaskErr) {
                console.error('Failed to cleanup orphan task on creation error:', cleanTaskErr);
            }
        }
        if (adminBudgetReserved && reservedAmountUSD > 0) {
            try {
                const targetSettingId = settingId || (await Setting.getSettings())?._id;
                if (targetSettingId) {
                    await Setting.findOneAndUpdate(
                        { _id: targetSettingId },
                        { 
                            $inc: { 'adminCampaignBudget.remainingBudgetUSD': reservedAmountUSD },
                            $set: { dataVersion: Date.now() }
                        },
                        { new: true }
                    );
                }
            } catch (rollbackErr) {
                console.error('Failed to rollback Admin Campaign Budget on creation error:', rollbackErr);
            }
            adminBudgetReserved = false;
        }
        if (finalIdempotencyKey && (err.code === 11000 || (err.message && err.message.includes('duplicate key')))) {
            const existingTx = await Transaction.findOne({ idempotencyKey: finalIdempotencyKey });
            if (existingTx) {
                const isExpectedType = existingTx.type === 'Campaign Creation';
                const hasValidCampaign = Boolean(existingTx.campaignId);
                const amountMatches = Math.abs(Number(existingTx.amountUSD || existingTx.amount) - totalAmountUSD) < 0.001;
                const userMatches = user ? (String(existingTx.userId) === String(user._id)) : false;

                if (!isExpectedType || !hasValidCampaign || !amountMatches || !userMatches) {
                    return res.status(409).json({
                        success: false,
                        error: `Idempotency key collision detected for ${finalIdempotencyKey}: transaction type, amount, or campaign mismatch.`
                    });
                }

                const existingTask = await UserTask.findById(existingTx.campaignId);
                if (!existingTask) {
                    return res.status(409).json({
                        success: false,
                        error: `Idempotency key collision detected for ${finalIdempotencyKey}: referenced campaign not found.`
                    });
                }
                const latestSettings = isCreatedByAdmin ? await Setting.findOne() : null;
                return res.status(200).json({
                    success: true,
                    message: 'Campaign already created (idempotent concurrent resolution).',
                    data: {
                        task: existingTask,
                        user,
                        settings: latestSettings,
                        transaction: existingTx
                    }
                });
            }
        }
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateUserTaskStatus = async (req, res) => {
    try {
        const { status, adminNotes, reviewRequested, userReviewMessage } = req.body;
        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Campaign not found.' });

        // Check ownership & authorization
        if (req.user) {
            const isOwner = task.userId?.toString() === req.user.id?.toString();
            const isAdmin = isUserAdmin(req.user);
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to modify this campaign.' });
            }
        }

        // If user is requesting a one-time review
        if (reviewRequested === true) {
            if (task.status !== 'Rejected') {
                return res.status(400).json({ success: false, error: 'Only rejected campaigns can be submitted for review.' });
            }
            if (task.resubmittedForReview === true) {
                return res.status(400).json({ success: false, error: 'This campaign has already been submitted for a one-time review.' });
            }

            const user = await User.findById(task.userId);
            if (!user) {
                return res.status(404).json({ success: false, error: 'Campaign creator not found.' });
            }

            const settings = await Setting.getSettings();
            const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10, campaignFeeEnabled: false, campaignFeeAmount: 1.00 };
            
            // Re-calculate budget to deduct
            const subtotal = task.targetQuantity * task.rewardPerTask;
            const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
            const totalBudget = Number((subtotal + adminCommission).toFixed(2));

            // Upfront Deduction Base Fee logic for resubmission
            const baseFeeCharged = config.campaignFeeEnabled ? (config.campaignFeeAmount || 0) : 0;
            const totalAmountUSD = Number((totalBudget + baseFeeCharged).toFixed(2));

            const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
            const userCurr = user.currency || 'USD';
            let deductionInUserCurr = totalAmountUSD * (rates[userCurr] || 1);
            deductionInUserCurr = Number(deductionInUserCurr.toFixed(2));

            if (user.walletBalance < deductionInUserCurr) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Insufficient wallet balance to re-submit campaign. Required: ${deductionInUserCurr} ${userCurr} (${totalAmountUSD} USD: ${totalBudget} Budget + ${baseFeeCharged} Base Fee), Available: ${user.walletBalance} ${userCurr}` 
                });
            }

            // Deduct from wallet
            user.walletBalance = Number((user.walletBalance - deductionInUserCurr).toFixed(2));
            await user.save();

            // Create budget deduction transaction
            await Transaction.create({
                userId: user._id,
                userName: user.username,
                currency: userCurr,
                type: 'Task Budget Deduction',
                amount: -deductionInUserCurr,
                description: `Resubmitted User Task For Review (USD): ${task.title} (Budget + Base Fee of ${baseFeeCharged} USD)`,
                status: 'Approved'
            });

            // Set state to pending review
            task.status = 'Pending';
            task.reviewRequested = true;
            task.resubmittedForReview = true;
            task.baseFeeCharged = baseFeeCharged; // Update stored fee charged
            task.userReviewMessage = userReviewMessage || '';
            task.adminNotes = ''; // Clear previous rejection notes

            if (!task.history) task.history = [];
            task.history.push({
                action: 'Resubmitted For Review',
                previousStatus: 'Rejected',
                newStatus: 'Pending',
                timestamp: new Date(),
                performedBy: req.user ? req.user.id.toString() : task.userId.toString(),
                details: userReviewMessage || 'Campaign resubmitted for admin review.'
            });

            await task.save();

            // Send notification to creator
            await Notification.create({
                userId: user._id,
                subject: 'Campaign Resubmitted 🔄',
                message: `Your campaign "${task.title}" has been resubmitted for a final one-time review. If approved, it will go live immediately.`,
                senderType: 'System'
            });

            // Send notification to Admins
            try {
                const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
                for (const admin of admins) {
                    await Notification.create({
                        userId: admin._id,
                        subject: 'Resubmitted Campaign for Review 🔄',
                        message: `User @${user.username} has resubmitted their campaign "${task.title}" with notes: "${userReviewMessage || ''}"`,
                        senderType: 'System'
                    });
                }
            } catch (adminErr) {
                console.error('Failed to notify admins of campaign resubmission:', adminErr);
            }

            global.appDataVersion = Date.now();
            return res.status(200).json({ success: true, message: 'Campaign resubmitted for review successfully.', data: { task, user } });
        }

        // Core Rules Edit Blocked validation
        const coreFields = [
            'category', 'subType', 'title', 'description', 'link', 'targetQuantity', 'rewardPerTask',
            'requireTextProof', 'textProofInstruction', 'requireUsername', 'usernameInstruction',
            'requireUserId', 'userIdInstruction', 'requireEmail', 'emailInstruction',
            'requireScreenshot', 'screenshotInstruction'
        ];
        
        const isAttemptingToEditCore = coreFields.some(field => req.body[field] !== undefined && req.body[field] !== task[field]);
        if (isAttemptingToEditCore) {
            return res.status(400).json({ 
                success: false, 
                error: '🔒 Edit Blocked: Campaign core rules (payout, link, category, platform, limits) cannot be edited once created.' 
            });
        }

        const oldStatus = task.status;
        const requestedStatus = status || task.status;

        const isAdmin = Boolean(req.user && isUserAdmin(req.user));

        // Enforce role-based lifecycle permissions (Bug 1 fix)
        if (!isAdmin) {
            // Non-admin owner can ONLY:
            // 1. Pause an already live campaign: On Hold when oldStatus is Approved/Active
            // 2. Resume a paused campaign: Approved/Active when oldStatus is On Hold
            if (requestedStatus === 'On Hold') {
                if (oldStatus === 'On Hold') {
                    return res.status(400).json({ success: false, error: 'Campaign is already paused.' });
                }
                if (oldStatus !== 'Approved' && oldStatus !== 'Active') {
                    return res.status(400).json({ success: false, error: 'Unable to pause campaign.' });
                }
            } else if (requestedStatus === 'Approved' || requestedStatus === 'Active') {
                if (oldStatus !== 'On Hold') {
                    return res.status(403).json({ success: false, error: 'Campaign creators cannot approve their own campaigns.' });
                }
            } else if (requestedStatus === 'Rejected') {
                return res.status(403).json({ success: false, error: 'Only administrators can reject campaigns.' });
            } else if (requestedStatus !== oldStatus) {
                return res.status(403).json({ success: false, error: 'Unauthorized campaign status transition.' });
            }
        } else {
            // Admin validation for pause
            if (requestedStatus === 'On Hold') {
                if (oldStatus === 'On Hold') {
                    return res.status(400).json({ success: false, error: 'Campaign is already paused.' });
                }
                if (oldStatus !== 'Approved' && oldStatus !== 'Active') {
                    return res.status(400).json({ success: false, error: 'Unable to pause campaign.' });
                }
            }
        }

        // Universal guard: completed or paid campaigns cannot be rejected
        if (requestedStatus === 'Rejected') {
            if (oldStatus === 'Completed' || oldStatus === 'Paid') {
                return res.status(400).json({ success: false, error: 'Completed or paid campaigns cannot be rejected.' });
            }
        }

        // Dedicated, concurrent-safe handler for Admin Campaign Budget rejection
        if (requestedStatus === 'Rejected' && task.fundingSourceType === 'admin_budget') {
            const refundKey = `admin_budget_refund:rejection:${task._id}`;

            // Case 1: Campaign is already settled or rejected
            if (task.adminBudgetRefundStatus === 'settled' || oldStatus === 'Rejected') {
                if (adminNotes !== undefined && adminNotes !== task.adminNotes) {
                    await UserTask.updateOne({ _id: task._id }, { $set: { adminNotes } });
                    task.adminNotes = adminNotes;
                }
                const freshTask = await UserTask.findById(task._id);
                global.appDataVersion = Date.now();
                return res.status(200).json({ success: true, message: 'Campaign updated successfully.', data: freshTask || task });
            }

            if (oldStatus === 'Paid') {
                return res.status(400).json({ success: false, error: 'Paid campaigns cannot be rejected.' });
            }

            const baseFee = task.baseFeeCharged || 0;
            const totalRefundUSD = Number((task.totalBudget + baseFee).toFixed(2));
            let adminRefundUSD = 0;
            if (task.adminBudgetRefundStatus === 'claimed' || task.adminBudgetRefundStatus === 'budget_refunded') {
                // Authoritative persisted refund amount: once claimed, NEVER recalculate
                adminRefundUSD = Number((task.adminBudgetRefundAmountUSD || 0).toFixed(2));
            } else if (oldStatus === 'Pending') {
                adminRefundUSD = totalRefundUSD;
            } else if (task.isUnlimitedResponses) {
                adminRefundUSD = Number((task.campaignAvailableBalanceUSD || 0).toFixed(2));
            } else {
                const remainingSlots = Math.max(0, task.targetQuantity - (task.currentCompletions || 0));
                if (remainingSlots > 0 && task.targetQuantity > 0) {
                    const costPerSlotUSD = task.rewardPerTask + (task.adminCommission / task.targetQuantity);
                    adminRefundUSD = Number((remainingSlots * costPerSlotUSD).toFixed(2));
                }
            }

            const effectiveAdminNotes = adminNotes !== undefined ? adminNotes : (task.adminNotes || '');
            const historyEntry = {
                action: 'Rejected',
                previousStatus: oldStatus,
                newStatus: 'Rejected',
                timestamp: new Date(),
                performedBy: req.user ? req.user.id.toString() : task.userId.toString(),
                details: `Campaign rejected. Reason: ${effectiveAdminNotes || 'No reason specified.'}`
            };

            if (adminRefundUSD <= 0) {
                await UserTask.updateOne(
                    { _id: task._id },
                    { 
                        $set: { 
                            status: 'Rejected', 
                            reviewRequested: false,
                            adminBudgetRefundStatus: 'settled', 
                            adminNotes: effectiveAdminNotes 
                        },
                        $push: { history: historyEntry }
                    }
                );
            } else {
                let claimWon = false;
                await executeWithOptionalTransaction(async (session) => {
                    const currentSettings = await Setting.getSettings();
                    const isAlreadyCreditedInSetting = Array.isArray(currentSettings.adminCampaignBudget?.processedRefundKeys) &&
                        currentSettings.adminCampaignBudget.processedRefundKeys.includes(refundKey);

                    // Step 1: Claim refund operation atomically on UserTask if not yet credited
                    if (!isAlreadyCreditedInSetting && task.adminBudgetRefundStatus !== 'budget_refunded') {
                        const claim = await UserTask.findOneAndUpdate(
                            {
                                _id: task._id,
                                fundingSourceType: 'admin_budget',
                                status: { $nin: ['Paid'] },
                                $or: [
                                    { adminBudgetRefundStatus: 'none' },
                                    { adminBudgetRefundStatus: { $exists: false } },
                                    { adminBudgetRefundStatus: null },
                                    { adminBudgetRefundStatus: 'claimed', adminBudgetRefundClaimedAt: { $lt: new Date(Date.now() - 30000) } }
                                ]
                            },
                            {
                                $set: { 
                                    adminBudgetRefundStatus: 'claimed',
                                    adminBudgetRefundClaimedAt: new Date(),
                                    adminBudgetRefundAmountUSD: adminRefundUSD,
                                    adminNotes: effectiveAdminNotes
                                }
                            },
                            { new: true, ...(session ? { session } : {}) }
                        );

                        if (!claim) {
                            // Another concurrent request claimed or settled this refund
                            return;
                        }
                    }

                    claimWon = true;

                    // Step 2: Complete Admin Budget refund in Setting idempotently
                    if (!isAlreadyCreditedInSetting) {
                        await Setting.findOneAndUpdate(
                            { 
                                _id: currentSettings._id,
                                'adminCampaignBudget.processedRefundKeys': { $ne: refundKey }
                            },
                            { 
                                $inc: { 'adminCampaignBudget.remainingBudgetUSD': adminRefundUSD },
                                $addToSet: { 'adminCampaignBudget.processedRefundKeys': refundKey },
                                $set: { dataVersion: Date.now() }
                            },
                            { new: true }
                        );

                        await UserTask.updateOne(
                            { _id: task._id },
                            { $set: { adminBudgetRefundStatus: 'budget_refunded' } },
                            session ? { session } : {}
                        );
                    }

                    // Step 3: Create Transaction with deterministic idempotencyKey
                    const existingTx = await Transaction.findOne({ idempotencyKey: refundKey }).session(session || null);
                    if (existingTx) {
                        if (Number(existingTx.amountUSD?.toFixed(2)) !== Number(adminRefundUSD.toFixed(2)) || String(existingTx.campaignId) !== String(task._id)) {
                            throw new Error(`Idempotency key collision detected for ${refundKey}: amount or campaign mismatch.`);
                        }
                    } else {
                        const user = await User.findById(task.userId).session(session || null);
                        try {
                            await Transaction.create([
                                {
                                    userId: user?._id || task.userId,
                                    userName: user?.username || task.userName,
                                    currency: 'USD',
                                    type: 'Task Refund',
                                    amount: adminRefundUSD,
                                    amountUSD: adminRefundUSD,
                                    campaignId: task._id,
                                    sourceWallet: 'CampaignEscrow',
                                    destinationWallet: 'System',
                                    description: `Restored remaining budget for rejected admin campaign to Admin Budget: ${task.title} ($${adminRefundUSD.toFixed(2)} USD)`,
                                    status: 'Approved',
                                    idempotencyKey: refundKey
                                }
                            ], session ? { session } : {});
                        } catch (txErr) {
                            if (txErr.code === 11000) {
                                const concurrentTx = await Transaction.findOne({ idempotencyKey: refundKey }).session(session || null);
                                if (concurrentTx && (Number(concurrentTx.amountUSD?.toFixed(2)) !== Number(adminRefundUSD.toFixed(2)) || String(concurrentTx.campaignId) !== String(task._id))) {
                                    throw new Error(`Idempotency key collision detected for ${refundKey}: amount or campaign mismatch.`);
                                }
                            } else {
                                throw txErr;
                            }
                        }
                    }

                    // Step 4: Durably mark settled and update status to Rejected
                    await UserTask.updateOne(
                        { _id: task._id },
                        { 
                            $set: { 
                                adminBudgetRefundStatus: 'settled', 
                                status: 'Rejected',
                                reviewRequested: false,
                                adminNotes: effectiveAdminNotes
                            },
                            $push: { history: historyEntry }
                        },
                        session ? { session } : {}
                    );
                });

                if (!claimWon) {
                    // Another concurrent request claimed or settled this refund.
                    // DO NOT call task.save() or overwrite database state with stale document!
                    const freshTask = await UserTask.findById(task._id);
                    global.appDataVersion = Date.now();
                    return res.status(200).json({ success: true, message: 'Campaign updated successfully.', data: freshTask || task });
                }
            }

            // Only the winning processor proceeds to notifications & response:
            const updatedTask = await UserTask.findById(task._id);

            if (oldStatus !== 'Rejected') {
                await Notification.create({
                    userId: task.userId,
                    subject: 'Campaign Rejected ❌',
                    message: `Your campaign "${task.title}" was rejected by the Admin. Reason: ${effectiveAdminNotes || 'No reason specified'}.`,
                    senderType: 'System'
                });

                sendTemplateNotification({
                    userId: task.userId,
                    templateKey: 'task_campaign_rejected_email',
                    variables: {
                        taskTitle: task.title,
                        amount: task.totalBudget,
                        currency: 'USD',
                        txId: task._id.toString(),
                        notes: effectiveAdminNotes || 'No reason specified'
                    }
                }).catch(err => console.error('Failed to send campaign rejected email:', err));

                sendTemplateNotification({
                    userId: task.userId,
                    templateKey: 'task_campaign_rejected_whatsapp',
                    variables: {
                        taskTitle: task.title,
                        amount: task.totalBudget,
                        currency: 'USD',
                        txId: task._id.toString(),
                        notes: effectiveAdminNotes || 'No reason specified'
                    }
                }).catch(err => console.error('Failed to send campaign rejected whatsapp:', err));
            }

            global.appDataVersion = Date.now();
            return res.status(200).json({ success: true, message: 'Campaign updated successfully.', data: updatedTask || task });
        }

        task.status = requestedStatus;
        if (adminNotes !== undefined) task.adminNotes = adminNotes;

        if (req.body.surveyVersion !== undefined) {
            const sv = Math.max(1, parseInt(req.body.surveyVersion, 10) || 1);
            task.surveyVersion = sv;
            if (task.surveyConfig) {
                task.surveyConfig.version = sv;
                task.markModified('surveyConfig');
            }
        } else if (req.body.surveyConfig && typeof req.body.surveyConfig === 'object') {
            task.surveyConfig = req.body.surveyConfig;
            if (req.body.surveyConfig.version) {
                task.surveyVersion = Math.max(1, parseInt(req.body.surveyConfig.version, 10) || 1);
            }
            task.markModified('surveyConfig');
        }

        let wonMemberRejectionClaim = false;

        // If rejected and was pending/approved/active/on hold (not yet paid/completed), refund user unused portion atomically
        if (requestedStatus === 'Rejected') {
            const effectiveAdminNotes = adminNotes !== undefined ? adminNotes : (task.adminNotes || '');
            const historyEntry = {
                action: 'Rejected',
                previousStatus: oldStatus,
                newStatus: 'Rejected',
                timestamp: new Date(),
                performedBy: req.user ? req.user.id.toString() : task.userId.toString(),
                details: `Campaign rejected. Reason: ${effectiveAdminNotes || 'No reason specified.'}`
            };

            await executeWithOptionalTransaction(async (session) => {
                // Step 1: Atomic conditional claim on UserTask to prevent concurrent duplicate rejections
                const claimedTask = await UserTask.findOneAndUpdate(
                    {
                        _id: task._id,
                        status: { $nin: ['Rejected', 'Paid', 'Completed'] }
                    },
                    {
                        $set: {
                            status: 'Rejected',
                            reviewRequested: false,
                            ...(adminNotes !== undefined ? { adminNotes } : {})
                        },
                        $push: { history: historyEntry }
                    },
                    { new: false, ...(session ? { session } : {}) }
                );

                if (!claimedTask) {
                    wonMemberRejectionClaim = false;
                    if (adminNotes !== undefined && adminNotes !== task.adminNotes) {
                        await UserTask.updateOne({ _id: task._id }, { $set: { adminNotes } }, session ? { session } : {});
                    }
                    return;
                }

                wonMemberRejectionClaim = true;

                // Step 2: Calculate refund using the authoritative pre-rejection task state
                let refundAmountUSD = 0;
                if (claimedTask.status === 'Pending') {
                    const baseFee = claimedTask.baseFeeCharged || 0;
                    refundAmountUSD = Number((claimedTask.totalBudget + baseFee).toFixed(2));
                } else {
                    const remainingSlots = Math.max(0, claimedTask.targetQuantity - (claimedTask.currentCompletions || 0));
                    if (remainingSlots > 0 && claimedTask.targetQuantity > 0) {
                        const costPerSlotUSD = claimedTask.rewardPerTask + (claimedTask.adminCommission / claimedTask.targetQuantity);
                        refundAmountUSD = Number((remainingSlots * costPerSlotUSD).toFixed(2));
                    } else {
                        refundAmountUSD = 0;
                    }
                }

                if (refundAmountUSD > 0) {
                    const user = await User.findById(claimedTask.userId).session(session || null);
                    if (user) {
                        const taskFunding = claimedTask.fundingSourceBreakdown || { fromInvestmentUSD: refundAmountUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                        const totalOriginalFunded = Number(((taskFunding.fromInvestmentUSD || 0) + (taskFunding.fromTaskEarningsUSD || 0) + (taskFunding.fromRefundsUSD || 0)).toFixed(2)) || refundAmountUSD;

                        let refundFromInvestment = 0;
                        let refundFromTaskEarnings = 0;
                        let refundFromRefunds = 0;

                        if (claimedTask.status === 'Pending' || refundAmountUSD >= totalOriginalFunded) {
                            refundFromInvestment = taskFunding.fromInvestmentUSD || 0;
                            refundFromTaskEarnings = taskFunding.fromTaskEarningsUSD || 0;
                            refundFromRefunds = taskFunding.fromRefundsUSD || 0;
                        } else {
                            const ratio = Math.min(1, refundAmountUSD / totalOriginalFunded);
                            refundFromRefunds = Number(((taskFunding.fromRefundsUSD || 0) * ratio).toFixed(2));
                            refundFromInvestment = Number(((taskFunding.fromInvestmentUSD || 0) * ratio).toFixed(2));
                            refundFromTaskEarnings = Number(((taskFunding.fromTaskEarningsUSD || 0) * ratio).toFixed(2));

                            const allocatedSum = Number((refundFromRefunds + refundFromInvestment + refundFromTaskEarnings).toFixed(2));
                            const diff = Number((refundAmountUSD - allocatedSum).toFixed(2));
                            if (diff !== 0) {
                                refundFromInvestment = Number((refundFromInvestment + diff).toFixed(2));
                            }
                        }

                        // Refund directly to Task Wallet Balance in USD and restore source attribution to campaignWalletSources
                        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + refundAmountUSD).toFixed(2));
                        const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                        user.campaignWalletSources = {
                            fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + refundFromInvestment).toFixed(2)),
                            fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + refundFromTaskEarnings).toFixed(2)),
                            fromRefundsUSD: Number(((curSources.fromRefundsUSD || 0) + refundFromRefunds).toFixed(2))
                        };
                        await user.save(session ? { session } : undefined);

                        const refundKey = `member_task_refund:rejection:${claimedTask._id}`;
                        await Transaction.create([{
                            userId: user._id,
                            userName: user.username,
                            currency: 'USD',
                            type: 'Task Refund',
                            amount: refundAmountUSD,
                            amountUSD: refundAmountUSD,
                            campaignId: claimedTask._id,
                            sourceWallet: 'CampaignEscrow',
                            destinationWallet: 'CampaignFunds',
                            sourceBreakdown: {
                                fromInvestmentUSD: refundFromInvestment,
                                fromTaskEarningsUSD: refundFromTaskEarnings,
                                fromRefundsUSD: refundFromRefunds
                            },
                            description: `Refund for rejected user task credited to Campaign Wallet: ${claimedTask.title} ($${refundAmountUSD.toFixed(2)} USD)`,
                            status: 'Approved',
                            idempotencyKey: refundKey
                        }], session ? { session } : {});

                        await UserTask.updateOne(
                            { _id: claimedTask._id },
                            {
                                $set: {
                                    refundedBreakdown: {
                                        fromInvestmentUSD: refundFromInvestment,
                                        fromTaskEarningsUSD: refundFromTaskEarnings,
                                        fromRefundsUSD: refundFromRefunds
                                    }
                                }
                            },
                            session ? { session } : {}
                        );
                    }
                }
            });

            // Re-fetch fresh task to return authoritative response
            const updatedTask = await UserTask.findById(task._id);
            task = updatedTask || task;
        } else {
            task.status = requestedStatus;
            if (adminNotes !== undefined) task.adminNotes = adminNotes;

            if (req.body.surveyVersion !== undefined) {
                const sv = Math.max(1, parseInt(req.body.surveyVersion, 10) || 1);
                task.surveyVersion = sv;
                if (task.surveyConfig) {
                    task.surveyConfig.version = sv;
                    task.markModified('surveyConfig');
                }
            } else if (req.body.surveyConfig && typeof req.body.surveyConfig === 'object') {
                task.surveyConfig = req.body.surveyConfig;
                if (req.body.surveyConfig.version) {
                    task.surveyVersion = Math.max(1, parseInt(req.body.surveyConfig.version, 10) || 1);
                }
                task.markModified('surveyConfig');
            }

            if (requestedStatus === 'Approved') {
                task.reviewRequested = false;
            }

            if (!task.history) task.history = [];
            let historyAction = 'Status Changed';
            let historyDetails = `Campaign status changed from ${oldStatus} to ${requestedStatus}`;

            if (requestedStatus === 'On Hold') {
                historyAction = 'Paused';
                historyDetails = 'Campaign paused by owner.';
            } else if ((requestedStatus === 'Approved' || requestedStatus === 'Active') && oldStatus === 'On Hold') {
                historyAction = 'Resumed';
                historyDetails = 'Campaign resumed by owner.';
            } else if (requestedStatus === 'Approved' && oldStatus !== 'Approved') {
                historyAction = 'Approved';
                historyDetails = 'Campaign approved by admin.';
            }

            task.history.push({
                action: historyAction,
                previousStatus: oldStatus,
                newStatus: requestedStatus,
                timestamp: new Date(),
                performedBy: req.user ? req.user.id.toString() : task.userId.toString(),
                details: historyDetails
            });

            await task.save();
        }

        // System notifications & Audit Logging
        if (requestedStatus === 'On Hold' && oldStatus !== 'On Hold') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Paused ⏸',
                message: `Your campaign "${task.title}" has been paused. Workers will not be able to join or submit new tasks until you resume it.`,
                senderType: 'System'
            });
            try {
                await Log.create({
                    action: 'CAMPAIGN_PAUSED',
                    affectedUser: task.userName,
                    details: `Campaign "${task.title}" (ID: ${task._id}) paused`,
                    performedBy: req.user ? (req.user.username || req.user.id) : 'owner'
                });
            } catch (logErr) {
                console.error('Failed to write Log:', logErr);
            }
        } else if ((requestedStatus === 'Approved' || requestedStatus === 'Active') && oldStatus === 'On Hold') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Resumed ▶',
                message: `Your campaign "${task.title}" has been resumed and is now active for workers to complete.`,
                senderType: 'System'
            });
            try {
                await Log.create({
                    action: 'CAMPAIGN_RESUMED',
                    affectedUser: task.userName,
                    details: `Campaign "${task.title}" (ID: ${task._id}) resumed`,
                    performedBy: req.user ? (req.user.username || req.user.id) : 'owner'
                });
            } catch (logErr) {
                console.error('Failed to write Log:', logErr);
            }
        } else if (requestedStatus === 'Approved' && oldStatus !== 'Approved' && oldStatus !== 'On Hold') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Approved! 🟢',
                message: `Congratulations! Your campaign "${task.title}" has been approved and is now live for workers to complete.`,
                senderType: 'System'
            });

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_approved_email',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString()
                }
            }).catch(err => console.error('Failed to send campaign approved email:', err));

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_approved_whatsapp',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString()
                }
            }).catch(err => console.error('Failed to send campaign approved whatsapp:', err));

        } else if (requestedStatus === 'Rejected' && (wonMemberRejectionClaim || (oldStatus !== 'Rejected' && task.fundingSourceType === 'admin_budget'))) {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Rejected ❌',
                message: `Your campaign "${task.title}" was rejected by the Admin. Reason: ${adminNotes || 'No reason specified'}.`,
                senderType: 'System'
            });

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_rejected_email',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString(),
                    notes: adminNotes || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send campaign rejected email:', err));

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_rejected_whatsapp',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString(),
                    notes: adminNotes || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send campaign rejected whatsapp:', err));
        }

        global.appDataVersion = Date.now();
        const successMsg = requestedStatus === 'On Hold'
            ? 'Campaign paused successfully.'
            : (oldStatus === 'On Hold' ? 'Campaign resumed successfully.' : 'Campaign updated successfully.');

        return res.status(200).json({ success: true, message: successMsg, data: task });
    } catch (err) {
        try {
            const refundKey = `admin_budget_refund:rejection:${req.params.id}`;
            const freshSettings = await Setting.getSettings();
            const isCredited = Array.isArray(freshSettings.adminCampaignBudget?.processedRefundKeys) &&
                freshSettings.adminCampaignBudget.processedRefundKeys.includes(refundKey);
            if (!isCredited) {
                // Setting was not credited, restore state so immediate retry can re-claim
                await UserTask.updateOne(
                    { _id: req.params.id, adminBudgetRefundStatus: 'claimed' },
                    { 
                        $set: { 
                            adminBudgetRefundStatus: 'none', 
                            adminBudgetRefundClaimedAt: null 
                        } 
                    }
                );
            } else {
                // Setting was credited, mark budget_refunded so retry skips Setting increment
                await UserTask.updateOne(
                    { _id: req.params.id },
                    { $set: { adminBudgetRefundStatus: 'budget_refunded' } }
                );
            }
        } catch (_) {}
        return res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteUserTask = async (req, res) => {
    let originalStatus = null;
    try {
        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
        originalStatus = task.status;

        if (req.user) {
            const isOwner = String(task.userId) === String(req.user.id);
            const isAdmin = isUserAdmin(req.user);
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to delete this campaign.' });
            }
        }

        // Dedicated, concurrent-safe handler for Admin Campaign Budget deletion
        if (task.fundingSourceType === 'admin_budget') {
            const refundKey = `admin_budget_refund:deletion:${task._id}`;
            let refundAmountUSD = 0;

            if (task.adminBudgetRefundStatus === 'settled' || originalStatus === 'Rejected') {
                refundAmountUSD = 0;
            } else if (task.adminBudgetRefundStatus === 'claimed' || task.adminBudgetRefundStatus === 'budget_refunded') {
                // Authoritative persisted refund amount: once claimed, NEVER recalculate from status or slots on retry
                refundAmountUSD = Number((task.adminBudgetRefundAmountUSD || 0).toFixed(2));
            } else if (originalStatus === 'Pending') {
                const baseFee = task.baseFeeCharged || 0;
                refundAmountUSD = Number((task.totalBudget + baseFee).toFixed(2));
            } else if (task.isUnlimitedResponses) {
                refundAmountUSD = Number((task.campaignAvailableBalanceUSD || 0).toFixed(2));
            } else {
                const remainingSlots = Math.max(0, task.targetQuantity - (task.currentCompletions || 0));
                if (remainingSlots > 0 && task.targetQuantity > 0) {
                    const costPerSlotUSD = task.rewardPerTask + (task.adminCommission / task.targetQuantity);
                    refundAmountUSD = Number((remainingSlots * costPerSlotUSD).toFixed(2));
                } else {
                    refundAmountUSD = 0;
                }
            }

            let deletionClaimWon = false;

            if (refundAmountUSD > 0) {
                await executeWithOptionalTransaction(async (session) => {
                    const currentSettings = await Setting.getSettings();
                    const isAlreadyCreditedInSetting = Array.isArray(currentSettings.adminCampaignBudget?.processedRefundKeys) &&
                        currentSettings.adminCampaignBudget.processedRefundKeys.includes(refundKey);

                    // Re-read latest UserTask inside transaction to ensure authoritative state
                    const freshTask = await UserTask.findById(task._id).session(session || null);
                    if (!freshTask) {
                        deletionClaimWon = false;
                        return;
                    }

                    // Authoritative persisted amount rule: if previously claimed/budget_refunded, use persisted amount
                    if (freshTask.adminBudgetRefundStatus === 'settled') {
                        refundAmountUSD = 0;
                    } else if (freshTask.adminBudgetRefundStatus === 'claimed' || freshTask.adminBudgetRefundStatus === 'budget_refunded') {
                        refundAmountUSD = Number((freshTask.adminBudgetRefundAmountUSD || refundAmountUSD).toFixed(2));
                    }

                    // Step 1: Atomically claim deletion refund operation on UserTask
                    if (!isAlreadyCreditedInSetting && freshTask.adminBudgetRefundStatus !== 'budget_refunded') {
                        const claim = await UserTask.findOneAndUpdate(
                            {
                                _id: task._id,
                                fundingSourceType: 'admin_budget',
                                $or: [
                                    { adminBudgetRefundStatus: 'none' },
                                    { adminBudgetRefundStatus: { $exists: false } },
                                    { adminBudgetRefundStatus: null },
                                    { adminBudgetRefundStatus: 'claimed', adminBudgetRefundClaimedAt: { $lt: new Date(Date.now() - 30000) } }
                                ]
                            },
                            {
                                $set: {
                                    status: 'On Hold',
                                    adminBudgetRefundStatus: 'claimed',
                                    adminBudgetRefundClaimedAt: new Date(),
                                    adminBudgetRefundAmountUSD: refundAmountUSD
                                }
                            },
                            { new: true, ...(session ? { session } : {}) }
                        );

                        if (!claim) {
                            // Another concurrent delete request is already processing
                            deletionClaimWon = false;
                            return;
                        }
                    } else if (freshTask.adminBudgetRefundStatus === 'budget_refunded' || isAlreadyCreditedInSetting) {
                        // Atomic claim for retry/recovery phase: ensure only ONE retry process proceeds with completion
                        const claimRecovery = await UserTask.findOneAndUpdate(
                            {
                                _id: task._id,
                                fundingSourceType: 'admin_budget',
                                $or: [
                                    { adminBudgetRefundClaimedAt: null },
                                    { adminBudgetRefundClaimedAt: { $lt: new Date(Date.now() - 30000) } },
                                    { adminBudgetRefundClaimedAt: { $exists: false } }
                                ]
                            },
                            {
                                $set: {
                                    status: 'On Hold',
                                    adminBudgetRefundClaimedAt: new Date(),
                                    adminBudgetRefundAmountUSD: refundAmountUSD
                                }
                            },
                            { new: true, ...(session ? { session } : {}) }
                        );

                        if (!claimRecovery) {
                            deletionClaimWon = false;
                            return;
                        }
                    }

                    deletionClaimWon = true;

                    // Step 2: Complete Admin Budget refund in Setting safely and idempotently
                    if (!isAlreadyCreditedInSetting) {
                        await Setting.findOneAndUpdate(
                            { 
                                _id: currentSettings._id,
                                'adminCampaignBudget.processedRefundKeys': { $ne: refundKey }
                            },
                            { 
                                $inc: { 'adminCampaignBudget.remainingBudgetUSD': refundAmountUSD },
                                $addToSet: { 'adminCampaignBudget.processedRefundKeys': refundKey },
                                $set: { dataVersion: Date.now() }
                            },
                            { new: true }
                        );

                        // Durably mark budget_refunded
                        await UserTask.updateOne(
                            { _id: task._id },
                            { $set: { adminBudgetRefundStatus: 'budget_refunded' } },
                            session ? { session } : {}
                        );
                    }

                    // Step 3: Create refund transaction safely and idempotently
                    const existingTx = await Transaction.findOne({ idempotencyKey: refundKey }).session(session || null);
                    if (existingTx) {
                        if (Number(existingTx.amountUSD?.toFixed(2)) !== Number(refundAmountUSD.toFixed(2)) || String(existingTx.campaignId) !== String(task._id)) {
                            throw new Error(`Idempotency key collision detected for ${refundKey}: amount or campaign mismatch.`);
                        }
                    } else {
                        const user = await User.findById(task.userId).session(session || null);
                        try {
                            await Transaction.create([
                                {
                                    userId: user?._id || task.userId,
                                    userName: user?.username || task.userName,
                                    currency: 'USD',
                                    type: 'Task Refund',
                                    amount: refundAmountUSD,
                                    amountUSD: refundAmountUSD,
                                    campaignId: task._id,
                                    sourceWallet: 'CampaignEscrow',
                                    destinationWallet: 'System',
                                    description: `Restored remaining budget from deleted admin campaign to Admin Budget: ${task.title} ($${refundAmountUSD.toFixed(2)} USD)`,
                                    status: 'Approved',
                                    idempotencyKey: refundKey
                                }
                            ], session ? { session } : {});
                        } catch (txErr) {
                            if (txErr.code === 11000) {
                                const concurrentTx = await Transaction.findOne({ idempotencyKey: refundKey }).session(session || null);
                                if (concurrentTx && (Number(concurrentTx.amountUSD?.toFixed(2)) !== Number(refundAmountUSD.toFixed(2)) || String(concurrentTx.campaignId) !== String(task._id))) {
                                    throw new Error(`Idempotency key collision detected for ${refundKey}: amount or campaign mismatch.`);
                                }
                            } else {
                                throw txErr;
                            }
                        }
                    }

                    // Step 6: Durably mark settled
                    await UserTask.updateOne(
                        { _id: task._id },
                        { $set: { adminBudgetRefundStatus: 'settled' } },
                        session ? { session } : {}
                    );
                });

                if (!deletionClaimWon) {
                    // Another concurrent request owns the deletion/refund operation.
                    // Immediately stop all deletion processing:
                    // DO NOT modify submissions
                    // DO NOT refund
                    // DO NOT create a Transaction
                    // DO NOT call findByIdAndDelete()
                    // DO NOT send duplicate deletion notifications
                    const freshTask = await UserTask.findById(task._id);
                    global.appDataVersion = Date.now();
                    return res.status(200).json({ 
                        success: true, 
                        message: 'Campaign deletion is already being processed by another request.', 
                        data: freshTask || {} 
                    });
                }
            } else {
                // When refundAmountUSD === 0, use atomic findOneAndDelete so exactly one request deletes
                const deleted = await UserTask.findOneAndDelete({ _id: task._id });
                if (!deleted) {
                    global.appDataVersion = Date.now();
                    return res.status(200).json({ success: true, message: 'Campaign was already deleted.', data: {} });
                }
                await UserTaskSubmission.updateMany(
                    { taskId: req.params.id, status: 'Pending' },
                    { $set: { status: 'Rejected', rejectionReason: 'Campaign was deleted or stopped by the creator.' } }
                );
                global.appDataVersion = Date.now();
                return res.status(200).json({ success: true, data: {} });
            }

            // Step 7: Clean up pending submissions associated with this deleted campaign (only winner reaches here!)
            await UserTaskSubmission.updateMany(
                { taskId: req.params.id, status: 'Pending' },
                { $set: { status: 'Rejected', rejectionReason: 'Campaign was deleted or stopped by the creator.' } }
            );

            // Step 8: Permanent UserTask deletion (only winner reaches here!)
            await UserTask.findByIdAndDelete(task._id);
            global.appDataVersion = Date.now();
            return res.status(200).json({ success: true, data: {} });
        }

        const user = await User.findById(task.userId);
        if (user) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
            const userCurr = user.currency || 'USDT';
                // If pending, refund the ENTIRE budget to Task Wallet
                if (task.status === 'Pending') {
                    const baseFee = task.baseFeeCharged || 0;
                    const totalRefundUSD = Number((task.totalBudget + baseFee).toFixed(2));

                    user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + totalRefundUSD).toFixed(2));
                    const taskFunding = task.fundingSourceBreakdown || { fromInvestmentUSD: totalRefundUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                    const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                    user.campaignWalletSources = {
                        fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + (taskFunding.fromInvestmentUSD || 0)).toFixed(2)),
                        fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + (taskFunding.fromTaskEarningsUSD || 0)).toFixed(2)),
                        fromRefundsUSD: Number(((curSources.fromRefundsUSD || 0) + (taskFunding.fromRefundsUSD || 0)).toFixed(2))
                    };
                    await user.save();
                    await Transaction.create({
                        userId: user._id,
                        userName: user.username,
                        currency: 'USD',
                        type: 'Task Refund',
                        amount: totalRefundUSD,
                        amountUSD: totalRefundUSD,
                        campaignId: task._id,
                        sourceWallet: 'CampaignEscrow',
                        destinationWallet: 'CampaignFunds',
                        sourceBreakdown: {
                            fromInvestmentUSD: taskFunding.fromInvestmentUSD || 0,
                            fromTaskEarningsUSD: taskFunding.fromTaskEarningsUSD || 0,
                            fromRefundsUSD: taskFunding.fromRefundsUSD || 0
                        },
                        description: `Refund for deleted user task credited to Campaign Wallet: ${task.title} ($${totalRefundUSD.toFixed(2)} USD)`,
                        status: 'Approved'
                    });
                } else {
                    // Refund remaining slots' budget to Task Wallet proportionally
                    const remainingSlots = task.targetQuantity - task.currentCompletions;
                    if (remainingSlots > 0) {
                        const costPerSlotUSD = task.rewardPerTask + (task.adminCommission / task.targetQuantity);
                        const refundUSD = Number((remainingSlots * costPerSlotUSD).toFixed(2));
                        const refundRatio = task.targetQuantity > 0 ? (remainingSlots / task.targetQuantity) : 1;

                        const taskFunding = task.fundingSourceBreakdown || { fromInvestmentUSD: refundUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                        const refundFromInv = Number(((taskFunding.fromInvestmentUSD || 0) * refundRatio).toFixed(2));
                        const refundFromEarn = Number(((taskFunding.fromTaskEarningsUSD || 0) * refundRatio).toFixed(2));
                        const refundFromRef = Number(((taskFunding.fromRefundsUSD || 0) * refundRatio).toFixed(2));

                        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + refundUSD).toFixed(2));
                        const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                        user.campaignWalletSources = {
                            fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + refundFromInv).toFixed(2)),
                            fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + refundFromEarn).toFixed(2)),
                            fromRefundsUSD: Number(((curSources.fromRefundsUSD || 0) + refundFromRef).toFixed(2))
                        };
                        await user.save();
                        await Transaction.create({
                            userId: user._id,
                            userName: user.username,
                            currency: 'USD',
                            type: 'Task Refund',
                            amount: refundUSD,
                            amountUSD: refundUSD,
                            campaignId: task._id,
                            sourceWallet: 'CampaignEscrow',
                            destinationWallet: 'CampaignFunds',
                            sourceBreakdown: {
                                fromInvestmentUSD: refundFromInv,
                                fromTaskEarningsUSD: refundFromEarn,
                                fromRefundsUSD: refundFromRef
                            },
                            description: `Refund for remaining ${remainingSlots} slots of stopped task credited to Campaign Wallet: ${task.title} ($${refundUSD.toFixed(2)} USD)`,
                            status: 'Approved'
                        });
                    }
                }
        }

        // Clean up pending submissions associated with this deleted campaign
        await UserTaskSubmission.updateMany(
            { taskId: req.params.id, status: 'Pending' },
            { $set: { status: 'Rejected', rejectionReason: 'Campaign was deleted or stopped by the creator.' } }
        );

        await UserTask.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        try {
            const refundKey = `admin_budget_refund:deletion:${req.params.id}`;
            const freshSettings = await Setting.getSettings();
            const isCredited = Array.isArray(freshSettings.adminCampaignBudget?.processedRefundKeys) &&
                freshSettings.adminCampaignBudget.processedRefundKeys.includes(refundKey);
            if (!isCredited) {
                // Setting was not credited, restore original status so it is not stuck in 'On Hold' and can be retried cleanly
                await UserTask.updateOne(
                    { _id: req.params.id, adminBudgetRefundStatus: 'claimed' },
                    { 
                        $set: { 
                            status: (!originalStatus || originalStatus === 'On Hold') ? 'Pending' : originalStatus,
                            adminBudgetRefundStatus: 'none', 
                            adminBudgetRefundClaimedAt: null 
                        } 
                    }
                );
            } else {
                // Setting was credited, mark budget_refunded so retry skips Setting increment
                await UserTask.updateOne(
                    { _id: req.params.id },
                    { $set: { adminBudgetRefundStatus: 'budget_refunded' } }
                );
            }
        } catch (_) {}
        res.status(400).json({ success: false, error: err.message });
    }
};

export const renewUserTask = async (req, res) => {
    try {
        const { extraSlots } = req.body;
        if (!extraSlots || extraSlots <= 0) {
            return res.status(400).json({ success: false, error: 'Please specify a valid number of slots to add.' });
        }

        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        if (req.user) {
            const isOwner = String(task.userId) === String(req.user.id);
            const isAdmin = isUserAdmin(req.user);
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to renew this campaign.' });
            }
        }

        const user = await User.findById(task.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const settings = await Setting.getSettings();
        const config = settings.userTaskConfig || { commissionPercent: 10 };

        // Cost of extra slots
        const extraSubtotal = extraSlots * task.rewardPerTask;
        const extraCommission = Number((extraSubtotal * (config.commissionPercent / 100)).toFixed(2));
        const totalExtraBudget = Number((extraSubtotal + extraCommission).toFixed(2));

        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
        const userCurr = user.currency || 'USD';
        let costInUserCurr = totalExtraBudget * (rates[userCurr] || 1);
        costInUserCurr = Number(costInUserCurr.toFixed(2));

        if (user.walletBalance < costInUserCurr) {
            return res.status(400).json({
                success: false,
                error: `Insufficient wallet balance. Required: ${costInUserCurr} ${userCurr}, Available: ${user.walletBalance} ${userCurr}`
            });
        }

        // Deduct from wallet
        user.walletBalance = Number((user.walletBalance - costInUserCurr).toFixed(2));
        await user.save();

        // Create transaction
        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: userCurr,
            type: 'Task Budget Deduction',
            amount: -costInUserCurr,
            description: `Renewed User Task: Added ${extraSlots} slots to campaign: ${task.title}`,
            status: 'Approved'
        });

        // Update campaign
        task.targetQuantity = task.targetQuantity + Number(extraSlots);
        task.totalBudget = Number((task.totalBudget + totalExtraBudget).toFixed(2));
        task.adminCommission = Number((task.adminCommission + extraCommission).toFixed(2));
        
        // If status was 'Completed' or 'On Hold' or similar, reset back to 'Approved'
        if (task.status === 'Completed' || task.status === 'On Hold') {
            task.status = 'Approved';
        }
        
        await task.save();

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { task, user } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const autoApproveStaleSubmissions = async () => {
    try {
        const settings = await Setting.getSettings();
        
        // 1. Auto-approve normal pending proofs
        const timeoutDays = settings.systemLimits?.approvalTimeoutDays || 3;
        const cutoffDate = new Date(Date.now() - timeoutDays * 24 * 60 * 60 * 1000);

        const staleSubmissions = await UserTaskSubmission.find({
            status: 'Pending',
            createdAt: { $lte: cutoffDate }
        });

        for (const submission of staleSubmissions) {
            const claimedTask = await claimTaskCompletionSlot(submission.taskId, submission.workerId);
            if (!claimedTask) {
                // Target completion limit reached or worker already completed. Skip auto-approval/rewarding.
                continue;
            }

            try {
                const updatedSub = await UserTaskSubmission.findOneAndUpdate(
                    { _id: submission._id, rewardClaimed: { $ne: true } },
                    {
                        $set: {
                            status: 'Approved',
                            paid: true,
                            isAutoApproved: true,
                            autoApproved: true,
                            approvalType: 'auto',
                            rewardClaimed: true,
                            rewardPaidAt: new Date(),
                            adminNotes: `Auto-approved: creator did not review within the ${timeoutDays}-day limit.`
                        }
                    },
                    { new: true }
                );

                if (!updatedSub) {
                    // Submission was already claimed/rewarded in parallel; revert claimed completion slot
                    await releaseTaskCompletionSlot(submission.taskId, submission.workerId);
                    continue;
                }

                const worker = await User.findById(updatedSub.workerId);
                if (worker) {
                    let rewardInUSD = updatedSub.rewardAmount;
                    if (rewardInUSD > 0) {
                        worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + rewardInUSD).toFixed(2));
                        await worker.save();

                        const existingTx = await Transaction.findOne({ submissionId: updatedSub._id, type: 'Task Reward' });
                        if (!existingTx) {
                            const tx = await Transaction.create({
                                userId: worker._id,
                                userName: worker.username,
                                currency: 'USD',
                                type: 'Task Reward',
                                amount: rewardInUSD,
                                description: `Completed User Task (Auto-Approved): ${updatedSub.taskTitle || 'Engagement Task'}`,
                                status: 'Approved',
                                submissionId: updatedSub._id,
                                campaignId: updatedSub.taskId
                            });
                            updatedSub.rewardTransactionId = tx._id;
                            await updatedSub.save();
                        }
                    }

                    await Notification.create({
                        userId: worker._id,
                        subject: 'Task Auto-Approved! ⏱️✅',
                        message: rewardInUSD > 0
                            ? `Your proof for campaign "${updatedSub.taskTitle}" was automatically approved because the creator did not review it within the ${timeoutDays}-day time limit. You earned ${updatedSub.rewardAmount} USD!`
                            : `Your submission for campaign "${updatedSub.taskTitle}" was approved. Thank you for your participation!`,
                        senderType: 'System'
                    });
                }
            } catch (err) {
                await releaseTaskCompletionSlot(submission.taskId, submission.workerId);
                console.error('Error auto-approving stale submission:', err);
            }
        }

        // 2. Auto-approve disputed submissions in CreatorReview stage whose disputeReviewDeadline has passed
        const disputeReviewDays = settings.systemLimits?.disputeReviewTimeoutDays || 3;
        const staleDisputed = await UserTaskSubmission.find({
            status: 'Disputed',
            disputeStage: 'CreatorReview',
            disputeReviewDeadline: { $lte: new Date() }
        });

        for (const submission of staleDisputed) {
            const claimedTask = await claimTaskCompletionSlot(submission.taskId, submission.workerId);
            if (!claimedTask) {
                // Target completion limit reached or worker already completed. Skip auto-approval/rewarding.
                continue;
            }

            try {
                const updatedSub = await UserTaskSubmission.findOneAndUpdate(
                    { _id: submission._id, rewardClaimed: { $ne: true } },
                    {
                        $set: {
                            status: 'Approved',
                            paid: true,
                            isAutoApproved: true,
                            autoApproved: true,
                            approvalType: 'auto',
                            rewardClaimed: true,
                            rewardPaidAt: new Date(),
                            disputeStage: 'Resolved',
                            adminNotes: `Auto-approved dispute: creator did not review the dispute within the ${disputeReviewDays}-day limit.`
                        }
                    },
                    { new: true }
                );

                if (!updatedSub) {
                    // Submission was already claimed/rewarded in parallel; revert claimed completion slot
                    await releaseTaskCompletionSlot(submission.taskId, submission.workerId);
                    continue;
                }

                // Mark Dispute document as resolved/closed
                if (updatedSub.disputeId) {
                    await Dispute.findByIdAndUpdate(updatedSub.disputeId, {
                        status: 'Resolved',
                        verdict: 'ReleaseToWorker',
                        adminResponse: 'Auto-approved because creator did not review dispute in time.'
                    });
                }

                const worker = await User.findById(updatedSub.workerId);
                if (worker) {
                    let rewardInUSD = updatedSub.rewardAmount;
                    if (rewardInUSD > 0) {
                        worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + rewardInUSD).toFixed(2));
                        await worker.save();

                        const existingTx = await Transaction.findOne({ submissionId: updatedSub._id, type: 'Task Reward' });
                        if (!existingTx) {
                            const tx = await Transaction.create({
                                userId: worker._id,
                                userName: worker.username,
                                currency: 'USD',
                                type: 'Task Reward',
                                amount: rewardInUSD,
                                description: `Completed User Task (Auto-Approved Dispute): ${updatedSub.taskTitle || 'Engagement Task'}`,
                                status: 'Approved',
                                submissionId: updatedSub._id,
                                campaignId: updatedSub.taskId
                            });
                            updatedSub.rewardTransactionId = tx._id;
                            await updatedSub.save();
                        }
                    }

                    await Notification.create({
                        userId: worker._id,
                        subject: 'Dispute Auto-Approved! ⏱️⚖️✅',
                        message: rewardInUSD > 0
                            ? `Your dispute for campaign "${updatedSub.taskTitle}" was automatically approved because the creator did not review it within the ${disputeReviewDays}-day time limit. You earned ${updatedSub.rewardAmount} USD!`
                            : `Your dispute for campaign "${updatedSub.taskTitle}" was resolved and approved.`,
                        senderType: 'System'
                    });
                }
            } catch (err) {
                await releaseTaskCompletionSlot(submission.taskId, submission.workerId);
                console.error('Error auto-approving stale dispute:', err);
            }
        }
    } catch (err) {
        console.error('Error in autoApproveStaleSubmissions:', err);
    }
};

export const getUserTaskSubmissions = async (req, res) => {
    try {
        await autoApproveStaleSubmissions();
        const isAdmin = isUserAdmin(req.user);
        let query = {};

        if (isAdmin) {
            if (req.query.taskId) query.taskId = req.query.taskId;
            const submissions = await UserTaskSubmission.find(query).sort({ createdAt: -1 });
            return res.status(200).json({ success: true, count: submissions.length, data: submissions });
        }

        if (req.user && req.user.id) {
            const userId = req.user.id;
            const myTasks = await UserTask.find({ userId }).select('_id');
            const myTaskIds = myTasks.map(t => t._id);

            if (req.query.taskId) {
                const isTaskCreator = myTaskIds.some(id => String(id) === String(req.query.taskId));
                if (isTaskCreator) {
                    query.taskId = req.query.taskId;
                } else {
                    query.taskId = req.query.taskId;
                    query.workerId = userId;
                }
            } else {
                query.$or = [
                    { workerId: userId },
                    { taskId: { $in: myTaskIds } }
                ];
            }

            const submissions = await UserTaskSubmission.find(query).sort({ createdAt: -1 });
            return res.status(200).json({ success: true, count: submissions.length, data: submissions });
        }

        // Unauthenticated users receive empty array
        return res.status(200).json({ success: true, count: 0, data: [] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const applySurveyProfileMappings = async (user, task, surveyResponses, isScreenout, submission) => {
    try {
        if (!task || !task.isSurvey || isScreenout) return;
        
        // Fix 3: Profile mapping must not accept low-quality / invalid profile data
        if (submission && (submission.attentionCheckPassed === false || (Array.isArray(submission.qualityFlags) && submission.qualityFlags.length > 0) || submission.surveyQualificationStatus === 'Disqualified' || submission.surveyQualificationStatus === 'Screenout')) {
            console.warn(`[D2 Profile Mapping Skipped] Survey submission for task ${task._id} failed quality checks or qualification.`);
            return;
        }

        const surveyConfig = task.surveyConfig || {};
        const questions = Array.isArray(surveyConfig.questions) ? surveyConfig.questions : [];
        if (questions.length === 0) return;

        // Build Response Lookup map
        const responseMap = new Map();
        for (const r of surveyResponses) {
            if (r && r.questionId) {
                responseMap.set(String(r.questionId), r);
            }
        }

        const updatesToApply = {};

        for (const q of questions) {
            const mapping = q.profileMapping;
            if (!mapping || !mapping.enabled || !mapping.fieldKey) continue;

            const fieldKey = String(mapping.fieldKey).trim();
            if (!fieldKey) continue;

            // Fix 5: Strict security checks for fieldKey
            if (/[.$]/.test(fieldKey)) continue; // reject dot or dollar operators
            const bannedKeys = ['__proto__', 'constructor', 'prototype', 'username', 'email', 'password', 'role', 'phone', 'whatsapp', 'country', 'address', 'city', 'postalCode', 'telegram', 'gender', 'dateOfBirth', 'currency', 'walletBalance', 'taskWalletBalance', 'taskEarningsBalance', 'status', 'restrictions'];
            if (bannedKeys.some(b => fieldKey.toLowerCase() === b.toLowerCase())) continue;

            const response = responseMap.get(String(q.id));
            if (!response) continue; // no actual response -> DO NOT MAP

            // Required Fix: Explicitly verify answered/reached/non-skipped questions using submission metadata
            if (submission) {
                const skippedArr = Array.isArray(submission.skippedQuestions) ? submission.skippedQuestions.map(String) : [];
                if (skippedArr.includes(String(q.id))) {
                    continue; // skipped question -> DO NOT MAP
                }

                const answeredPathArr = Array.isArray(submission.answeredPath) ? submission.answeredPath.map(String) : [];
                if (answeredPathArr.length > 0 && !answeredPathArr.includes(String(q.id))) {
                    continue; // not in valid reached/answered path -> DO NOT MAP
                }
            }

            let val = response.value;
            if (val === undefined || val === null || val === '') continue;

            // Value Normalization
            if (typeof val === 'string') {
                val = val.trim();
                if (val.length > 500) {
                    val = val.substring(0, 500);
                }
            } else if (Array.isArray(val)) {
                val = val.map(v => (typeof v === 'string') ? v.trim().substring(0, 200) : v).filter(Boolean);
                if (val.length === 0) continue;
            }

            // Construct Provenance Metadata (Fix 4)
            updatesToApply[fieldKey] = {
                value: val,
                source: 'survey',
                sourceTaskId: task._id.toString(),
                sourceSurveyVersion: Number(task.surveyVersion || surveyConfig.version) || 1,
                sourceQuestionId: q.id.toString(),
                updatedAt: new Date()
            };
        }

        const keysCount = Object.keys(updatesToApply).length;
        if (keysCount === 0) return;

        // Fix 1: Make custom field update safe against concurrent writes via atomic MongoDB dot-notation update operations
        // This updates ONLY the specific mapped customFields keys without replacing or removing unrelated customFields.
        const updateOps = {};
        for (const [k, v] of Object.entries(updatesToApply)) {
            updateOps[`customFields.${k}`] = v;
        }

        const updateResult = await User.updateOne(
            { _id: user._id },
            { $set: updateOps }
        );

        if (!updateResult || updateResult.matchedCount === 0) {
            console.error(`[D2 Profile Mapping Error] User ${user._id} not found during atomic customFields update for task ${task._id}`);
        } else {
            console.log(`[D2 Profile Mapping Success] Successfully mapped ${keysCount} profile attribute(s) atomically for user ${user._id} from task ${task._id}`);
        }
    } catch (err) {
        // Fix 2: Do not silently hide profile mapping failures; log with rich context but do not break survey submission
        console.error(`[D2 Profile Mapping Failure] Error occurred while mapping profile attributes for user ${user?._id} on task ${task?._id}:`, err);
    }
};

export const submitUserTaskProof = async (req, res) => {
    try {
        const taskId = req.params.id || req.body.taskId;
        const task = await UserTask.findById(taskId);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        const workerId = (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') 
            ? req.user.id 
            : (req.body.workerId || req.body.userId || req.user?.id);

        if (!workerId) {
            return res.status(400).json({ success: false, error: 'Worker ID is required' });
        }

        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin' && String(task.userId) === String(req.user.id)) {
            return res.status(400).json({ success: false, error: 'You cannot submit proof to your own campaign.' });
        }

        const { proofText, proofUsername, proofUserIdVal, proofEmail, proofImage, submittedProofs } = req.body;
        if (task.status === 'On Hold') {
            return res.status(400).json({ success: false, error: 'This task campaign is currently paused by the creator.' });
        }
        if (task.status !== 'Approved' && task.status !== 'Paid' && task.status !== 'Active') {
            return res.status(400).json({ success: false, error: 'This task campaign is not active or approved yet.' });
        }
        if (!task.isUnlimitedResponses && task.currentCompletions >= task.targetQuantity) {
            return res.status(400).json({ success: false, error: 'This task campaign has already reached its target completions.' });
        }
        if (task.isUnlimitedResponses && task.rewardPerTask > 0 && (task.campaignAvailableBalanceUSD < task.rewardPerTask || task.campaignFundingStatus === 'paused_insufficient_funds')) {
            return res.status(400).json({ success: false, error: 'This survey campaign is currently paused due to insufficient campaign funding balance.' });
        }

        const worker = await User.findById(workerId);
        if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

        const settings = await Setting.getSettings();

        // Enforce Global Micro Task Hub Access Policy
        const isMandatoryAllAdminSurvey = Boolean(task.isAdminResearchSurvey && task.isMandatoryForAllUsers);
        if (!isUserAdmin(req.user) && !isMandatoryAllAdminSurvey && !canUserAccessMicroTaskHub(worker, settings)) {
            return res.status(403).json({
                success: false,
                error: 'Micro Task Hub access is currently disabled or restricted for your account.'
            });
        }

        // Audience Targeting Enforcement (Phase D-2A & E1)
        const isOwner = task.userId && String(task.userId) === String(worker._id);
        if (!isOwner) {
            const referencedTaskIds = [];
            const t = task.targeting || {};
            if (Array.isArray(t.completionRules)) {
                for (const cr of t.completionRules) {
                    if (cr.taskId) referencedTaskIds.push(cr.taskId);
                }
            }
            if (Array.isArray(t.surveyAnswerRules)) {
                for (const sr of t.surveyAnswerRules) {
                    if (sr.taskId) referencedTaskIds.push(sr.taskId);
                }
            }

            let workerSubmissions = [];
            if (referencedTaskIds.length > 0) {
                workerSubmissions = await UserTaskSubmission.find({
                    workerId: worker._id,
                    taskId: { $in: referencedTaskIds }
                }).sort({ createdAt: -1 }).lean();
            }

            const isEligible = isUserEligibleForUserTask(worker, task, { submissions: workerSubmissions });
            if (!isEligible) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not eligible for this task based on its audience requirements.'
                });
            }
        }

        // Prevent duplicate submission by same worker for same task/survey
        const isWorkerAlreadyCompleted = Array.isArray(task.completedUsers) && task.completedUsers.some(cu => String(cu?._id || cu) === String(worker._id));
        const existing = await UserTaskSubmission.findOne({ taskId: task._id, workerId: worker._id });
        if (existing || isWorkerAlreadyCompleted) {
            return res.status(400).json({ success: false, error: 'You have already submitted proof for this task.' });
        }

        const isSurveyTask = Boolean(task.isSurvey) || String(task.category || '').toLowerCase().includes('survey');

        // Killswitch: Reject survey submission if survey campaigns are disabled
        if (isSurveyTask && (settings.surveyCampaignsEnabled === false || settings.taskCategoryPresets?.survey?.enabled === false)) {
            return res.status(400).json({ success: false, error: 'Survey campaigns are currently disabled by platform administration.' });
        }

        const surveyResponses = req.body.surveyResponses || [];
        const surveyCompletionTimeSeconds = Number(req.body.surveyCompletionTimeSeconds) || 0;
        let surveyQualificationStatus = req.body.surveyQualificationStatus || 'Completed';
        const consentAgreed = req.body.consentAgreed !== false && req.body.consentAgreed !== 'false';
        const answeredPath = req.body.answeredPath || [];
        const skippedQuestions = req.body.skippedQuestions || [];
        let attentionCheckPassed = req.body.attentionCheckPassed !== false && req.body.attentionCheckPassed !== 'false';
        const checkQuestionResults = [];
        const qualityFlags = [];
        let qualityScore = 100;
        if (!attentionCheckPassed) {
            qualityFlags.push('Failed attention verification trap');
            qualityScore = Math.max(0, qualityScore - 40);
        }

        // Authoritative validation: NEVER trust frontend surveyConfig; load strictly from DB task
        if (isSurveyTask) {
            const surveyConfig = task.surveyConfig || {};
            const questions = Array.isArray(surveyConfig.questions) ? surveyConfig.questions : [];

            // Consent validation when required
            if (surveyConfig.consentRequired || surveyConfig.voluntaryConsentRequired) {
                if (!consentAgreed) {
                    return res.status(400).json({ success: false, error: 'Informed consent is required before submitting survey responses.' });
                }
            }

            if (questions.length > 0 && (!Array.isArray(surveyResponses) || surveyResponses.length === 0)) {
                return res.status(400).json({ success: false, error: 'Survey responses cannot be empty.' });
            }

            // Build response lookup map
            const responseMap = new Map();
            for (const r of surveyResponses) {
                if (r && r.questionId) {
                    responseMap.set(String(r.questionId), r);
                }
            }

            // Question-by-question authoritative validation
            for (const q of questions) {
                // Evaluate conditional showIf
                let isVisible = true;
                if (q.showIf && q.showIf.questionId) {
                    const parentAns = responseMap.get(String(q.showIf.questionId));
                    const parentVal = parentAns ? parentAns.value : undefined;
                    const expected = q.showIf.value;
                    const op = q.showIf.operator || 'equals';

                    if (op === 'equals') {
                        isVisible = String(parentVal ?? '').trim().toLowerCase() === String(expected ?? '').trim().toLowerCase();
                    } else if (op === 'not_equals') {
                        isVisible = String(parentVal ?? '').trim().toLowerCase() !== String(expected ?? '').trim().toLowerCase();
                    } else if (op === 'contains') {
                        if (Array.isArray(parentVal)) {
                            isVisible = parentVal.some(v => String(v).trim().toLowerCase() === String(expected).trim().toLowerCase());
                        } else {
                            isVisible = String(parentVal ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
                        }
                    } else if (op === 'not_contains') {
                        if (Array.isArray(parentVal)) {
                            isVisible = !parentVal.some(v => String(v).trim().toLowerCase() === String(expected).trim().toLowerCase());
                        } else {
                            isVisible = !String(parentVal ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
                        }
                    } else if (op === 'answered') {
                        isVisible = parentVal !== undefined && parentVal !== null && parentVal !== '';
                    } else if (op === 'not_answered') {
                        isVisible = parentVal === undefined || parentVal === null || parentVal === '';
                    }
                }

                const userAns = responseMap.get(String(q.id));
                const val = userAns ? userAns.value : undefined;
                const isRequired = Boolean(q.required || q.validation?.required);

                if (isVisible && isRequired) {
                    const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
                    if (isEmpty && surveyQualificationStatus !== 'Disqualified') {
                        return res.status(400).json({ success: false, error: `Question "${q.title}" is required.` });
                    }
                }

                if (val !== undefined && val !== null && val !== '') {
                    const allowedOpts = (q.options || []).map(o => typeof o === 'object' && o !== null ? (o.value || o.text || '') : String(o));

                    if (q.type === 'single_choice' || q.type === 'dropdown') {
                        const strVal = String(val).trim();
                        const isOther = q.allowOther && (strVal.toLowerCase().startsWith('other') || strVal.toLowerCase() === 'other');
                        const optionMatched = allowedOpts.some(opt => String(opt).trim().toLowerCase() === strVal.toLowerCase());
                        if (!optionMatched && !isOther && allowedOpts.length > 0) {
                            return res.status(400).json({ success: false, error: `Invalid option selected for question "${q.title}".` });
                        }
                        if (userAns.otherValue && typeof userAns.otherValue === 'string' && userAns.otherValue.length > 255) {
                            return res.status(400).json({ success: false, error: `Other text for question "${q.title}" cannot exceed 255 characters.` });
                        }
                    } else if (q.type === 'multiple_choice') {
                        if (!Array.isArray(val)) {
                            return res.status(400).json({ success: false, error: `Answer for question "${q.title}" must be an array of selections.` });
                        }
                        const minSel = q.validation?.minSelections || (isRequired ? 1 : 0);
                        const maxSel = q.validation?.maxSelections || (allowedOpts.length > 0 ? allowedOpts.length : 20);
                        if (val.length < minSel && surveyQualificationStatus !== 'Disqualified') {
                            return res.status(400).json({ success: false, error: `Question "${q.title}" requires at least ${minSel} selection(s).` });
                        }
                        if (val.length > maxSel) {
                            return res.status(400).json({ success: false, error: `Question "${q.title}" allows at most ${maxSel} selection(s).` });
                        }
                    } else if (q.type === 'top_n') {
                        if (!Array.isArray(val)) {
                            return res.status(400).json({ success: false, error: `Top-N ranking for question "${q.title}" must be an array.` });
                        }
                        const topLimit = q.validation?.topN || q.validation?.maxSelections || 3;
                        if (val.length > topLimit) {
                            return res.status(400).json({ success: false, error: `Question "${q.title}" allows at most ${topLimit} selections.` });
                        }
                        if (isRequired && val.length === 0 && surveyQualificationStatus !== 'Disqualified') {
                            return res.status(400).json({ success: false, error: `Question "${q.title}" requires at least 1 selection.` });
                        }
                    } else if (q.type === 'rating' || q.type === 'opinion_scale') {
                        const minR = q.validation?.minRating ?? q.minRating ?? 1;
                        const maxR = q.validation?.maxRating ?? q.maxRating ?? (q.type === 'opinion_scale' ? 10 : 5);
                        const numVal = Number(val);
                        if (isNaN(numVal) || numVal < minR || numVal > maxR) {
                            return res.status(400).json({ success: false, error: `Rating for "${q.title}" must be a number between ${minR} and ${maxR}.` });
                        }
                    } else if (q.type === 'short_text' || q.type === 'long_text') {
                        const strVal = String(val).trim();
                        const minLen = q.validation?.minLength ?? (isRequired ? 1 : 0);
                        const maxLen = q.validation?.maxLength ?? (q.type === 'long_text' ? 2000 : 255);
                        if (strVal.length < minLen && surveyQualificationStatus !== 'Disqualified') {
                            return res.status(400).json({ success: false, error: `Text answer for "${q.title}" must be at least ${minLen} characters.` });
                        }
                        if (strVal.length > maxLen) {
                            return res.status(400).json({ success: false, error: `Text answer for "${q.title}" exceeds maximum allowed length of ${maxLen} characters.` });
                        }
                    }
                }
            }

            // Attention Checks Validation
            for (const q of questions) {
                if (q.isAttentionCheck && q.expectedAnswer) {
                    const ans = surveyResponses.find(r => String(r.questionId) === String(q.id));
                    if (!ans || String(ans.value || '').trim().toLowerCase() !== String(q.expectedAnswer).trim().toLowerCase()) {
                        attentionCheckPassed = false;
                        qualityFlags.push(`Failed Attention Check on Question: "${q.title}"`);
                        qualityScore = Math.max(0, qualityScore - 40);
                    }
                }
            }

            // Check Questions Verification
            for (const q of questions) {
                if (q.isCheckQuestion && q.sourceQuestionId) {
                    const sourceAnsObj = surveyResponses.find(r => String(r.questionId) === String(q.sourceQuestionId));
                    const checkAnsObj = surveyResponses.find(r => String(r.questionId) === String(q.id));
                    const sourceVal = sourceAnsObj ? sourceAnsObj.value : undefined;
                    const checkVal = checkAnsObj ? checkAnsObj.value : undefined;

                    let passed = false;
                    const compMethod = q.checkComparisonMethod || 'case_insensitive';

                    if (sourceVal !== undefined && checkVal !== undefined) {
                        if (compMethod === 'exact') {
                            passed = String(sourceVal) === String(checkVal);
                        } else if (compMethod === 'trim_spaces') {
                            passed = String(sourceVal).replace(/\s+/g, '') === String(checkVal).replace(/\s+/g, '');
                        } else if (compMethod === 'numeric') {
                            passed = !isNaN(Number(sourceVal)) && !isNaN(Number(checkVal)) && Number(sourceVal) === Number(checkVal);
                        } else if (compMethod === 'date') {
                            const d1 = new Date(sourceVal).getTime();
                            const d2 = new Date(checkVal).getTime();
                            passed = !isNaN(d1) && !isNaN(d2) && d1 === d2;
                        } else if (compMethod === 'normalized') {
                            const norm1 = String(sourceVal).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                            const norm2 = String(checkVal).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                            passed = norm1 === norm2;
                        } else {
                            passed = String(sourceVal).trim().toLowerCase() === String(checkVal).trim().toLowerCase();
                        }
                    }

                    const failureAction = q.checkFailureAction || 'flag';
                    checkQuestionResults.push({
                        checkQuestionId: q.id,
                        checkQuestionTitle: q.title,
                        sourceQuestionId: q.sourceQuestionId,
                        originalAnswer: sourceVal,
                        verificationAnswer: checkVal,
                        comparisonMethod: compMethod,
                        result: passed ? 'PASS' : 'FAIL',
                        failureAction,
                        timestamp: new Date()
                    });

                    if (!passed) {
                        qualityFlags.push(`Inconsistent Answer between "${q.title}" and source question`);
                        qualityScore = Math.max(0, qualityScore - 30);
                        if (failureAction === 'disqualify') {
                            surveyQualificationStatus = 'Disqualified';
                        }
                    }
                }
            }

            // Anti-Speeding Verification
            const minTimeRatio = (settings.surveyConfig?.securityRules?.minCompletionTimeRatio) || 0.25;
            const estimatedSec = (task.surveyEstimatedMinutes || 5) * 60;
            const minAllowedSec = Math.floor(estimatedSec * minTimeRatio);
            if (settings.surveyConfig?.securityRules?.enforceAntiSpeeding && surveyCompletionTimeSeconds < minAllowedSec && surveyQualificationStatus !== 'Disqualified') {
                return res.status(400).json({
                    success: false,
                    error: `Survey completion was too fast (${surveyCompletionTimeSeconds}s). Please take time to carefully read and answer each question thoughtfully.`
                });
            }
        }

        const finalProofText = isSurveyTask 
            ? `Survey responses recorded (${surveyResponses.length} answered in ${surveyCompletionTimeSeconds}s, qualification: ${surveyQualificationStatus}, quality score: ${qualityScore}).` 
            : (proofText || '');

        const surveyApprovalMode = (task.surveyApprovalMode || settings.surveyConfig?.approvalSettings?.mode || 'auto').toLowerCase();

        const submission = await UserTaskSubmission.create({
            taskId: task._id,
            workerId: worker._id,
            workerName: worker.username,
            proofText: finalProofText,
            proofUsername: proofUsername || '',
            proofUserIdVal: proofUserIdVal || '',
            proofEmail: proofEmail || '',
            proofImage: proofImage || '',
            submittedProofs: submittedProofs || [],
            rewardAmount: task.rewardPerTask,
            currency: task.currency || 'USD',
            taskTitle: task.title,
            taskCategory: task.category,
            surveyResponses: isSurveyTask ? surveyResponses : [],
            surveyCompletionTimeSeconds: isSurveyTask ? surveyCompletionTimeSeconds : 0,
            surveyQualificationStatus: isSurveyTask ? surveyQualificationStatus : 'Completed',
            attentionCheckPassed: isSurveyTask ? attentionCheckPassed : true,
            consentAgreed: isSurveyTask ? consentAgreed : true,
            surveyVersion: isSurveyTask ? (Number(task.surveyVersion || task.surveyConfig?.version) || 1) : 1,
            checkQuestionResults: isSurveyTask ? checkQuestionResults : [],
            qualityFlags: isSurveyTask ? qualityFlags : [],
            qualityScore: isSurveyTask ? qualityScore : 100,
            answeredPath: isSurveyTask ? answeredPath : [],
            skippedQuestions: isSurveyTask ? skippedQuestions : [],
            approvalMode: isSurveyTask ? surveyApprovalMode : 'auto',
            status: 'Pending'
        });

        const checkQuestionsPassed = checkQuestionResults.every(r => r.result === 'PASS');
        const canAutoApprove = isSurveyTask && 
            surveyApprovalMode === 'auto' && 
            settings.campaignLiveRules?.autoApproval !== false && 
            attentionCheckPassed && 
            checkQuestionsPassed &&
            surveyQualificationStatus !== 'Disqualified';

        const isScreenout = isSurveyTask && (surveyQualificationStatus === 'Disqualified' || surveyQualificationStatus === 'Screenout');
        const allowScreeningReward = Boolean(settings.surveyConfig?.rateRules?.allowScreeningReward);

        // If survey task and autoApproval conditions met, auto-approve and credit worker immediately
        if (canAutoApprove) {
            const claimedTask = await claimTaskCompletionSlot(task._id, worker._id);
            if (claimedTask) {
                try {
                    submission.status = 'Approved';
                    submission.paid = true;
                    submission.rewardClaimed = true;
                    submission.rewardPaidAt = new Date();
                    submission.isAutoApproved = true;
                    submission.autoApproved = true;
                    submission.approvalType = 'auto';
                    submission.adminNotes = 'Survey auto-approved upon passing all attention, consistency, and qualification checks.';
                    await submission.save();

                    if (task.rewardPerTask > 0) {
                        worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + task.rewardPerTask).toFixed(2));
                        await worker.save();

                        const tx = await Transaction.create({
                            userId: worker._id,
                            userName: worker.username,
                            currency: 'USD',
                            type: 'Survey Reward',
                            amount: task.rewardPerTask,
                            amountUSD: task.rewardPerTask,
                            campaignId: task._id,
                            submissionId: submission._id,
                            sourceWallet: 'CampaignEscrow',
                            destinationWallet: 'TaskEarnings',
                            description: `Earned reward for completing survey: "${task.title}"`,
                            status: 'Approved',
                            idempotencyKey: `survey_reward_${submission._id}`
                        });
                        submission.rewardTransactionId = tx._id;
                        await submission.save();
                    }
                } catch (autoApproveErr) {
                    await releaseTaskCompletionSlot(task._id, worker._id);
                    throw autoApproveErr;
                }
            } else {
                // Capacity limit reached or worker already completed task. Keep submission as Pending.
                submission.status = 'Pending';
                submission.paid = false;
                submission.rewardClaimed = false;
                submission.adminNotes = 'Survey completed, but campaign target completions limit was reached.';
                await submission.save();
            }
        } else if (isScreenout && allowScreeningReward && attentionCheckPassed && checkQuestionsPassed) {
            // Screenout Micro-Reward Automation
            const rawConfiguredReward = settings.surveyConfig?.rateRules?.screeningRewardAmount ?? 
                                        settings.surveyConfig?.rateRules?.qualificationReward ?? 
                                        0.01;
            let screeningRewardAmount = Number(parseFloat(rawConfiguredReward).toFixed(2));
            if (isNaN(screeningRewardAmount) || screeningRewardAmount <= 0) {
                screeningRewardAmount = 0.01;
            }
            // Strict server-side bounds: capped at task.rewardPerTask
            screeningRewardAmount = Math.min(screeningRewardAmount, Number((task.rewardPerTask || 0).toFixed(2)));
            screeningRewardAmount = Number(screeningRewardAmount.toFixed(2));

            // Duplicate Payout & Idempotency Safeguard
            const existingScreenoutTx = await Transaction.findOne({
                userId: worker._id,
                campaignId: task._id,
                type: { $in: ['Survey Screenout Reward', 'Survey Reward', 'Task Reward'] }
            });

            if (!existingScreenoutTx && screeningRewardAmount > 0) {
                const claimSub = await UserTaskSubmission.findOneAndUpdate(
                    { _id: submission._id, rewardClaimed: { $ne: true } },
                    {
                        $set: {
                            status: 'Approved',
                            paid: true,
                            rewardClaimed: true,
                            rewardPaidAt: new Date(),
                            rewardAmount: screeningRewardAmount,
                            isAutoApproved: true,
                            autoApproved: true,
                            approvalType: 'auto',
                            adminNotes: `Screenout micro-reward ($${screeningRewardAmount.toFixed(2)}) automatically credited on survey disqualification.`
                        }
                    },
                    { new: true }
                );

                if (claimSub) {
                    submission.status = 'Approved';
                    submission.paid = true;
                    submission.rewardClaimed = true;
                    submission.rewardPaidAt = claimSub.rewardPaidAt;
                    submission.rewardAmount = screeningRewardAmount;
                    submission.adminNotes = claimSub.adminNotes;

                    // Strictly credit Task Earnings balance (Preserve wallet separation)
                    worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + screeningRewardAmount).toFixed(2));
                    await worker.save();

                    // Create ledger entry using existing financial mechanism
                    const tx = await Transaction.create({
                        userId: worker._id,
                        userName: worker.username,
                        currency: 'USD',
                        type: 'Survey Screenout Reward',
                        amount: screeningRewardAmount,
                        amountUSD: screeningRewardAmount,
                        campaignId: task._id,
                        submissionId: claimSub._id,
                        sourceWallet: 'CampaignEscrow',
                        destinationWallet: 'TaskEarnings',
                        description: `Screenout micro-reward for survey: "${task.title}"`,
                        status: 'Approved'
                    });

                    claimSub.rewardTransactionId = tx._id;
                    await claimSub.save();
                    submission.rewardTransactionId = tx._id;
                }
            }
        }

        // Notify Campaign Creator (only for non-screenout submissions)
        if (!isScreenout) {
            await Notification.create({
                userId: task.userId,
                subject: 'New Task Submission 📥',
                message: `Worker @${worker.username} has submitted a proof of completion for your campaign "${task.title}". Please review it.`,
                senderType: 'System'
            });

            // Send Email & WhatsApp automated templates to Employer
            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_submission_received_email',
                variables: {
                    taskTitle: task.title,
                    amount: task.rewardPerTask,
                    currency: 'USD',
                    workerName: worker.username,
                    txId: submission._id.toString()
                }
            }).catch(err => console.error('Failed to send task submission email:', err));

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_submission_received_whatsapp',
                variables: {
                    taskTitle: task.title,
                    amount: task.rewardPerTask,
                    currency: 'USD',
                    workerName: worker.username,
                    txId: submission._id.toString()
                }
            }).catch(err => console.error('Failed to send task submission whatsapp:', err));
        }

        // Notify Worker
        if (submission.paid && isScreenout) {
            await Notification.create({
                userId: worker._id,
                subject: 'Survey Screenout Reward Credited 💵',
                message: `You received a screening compensation of $${submission.rewardAmount.toFixed(2)} USD for participating in survey "${task.title}". Credited to your Task Earnings balance.`,
                senderType: 'System'
            });
        } else if (submission.paid) {
            await Notification.create({
                userId: worker._id,
                subject: 'Survey Reward Credited! 🎉',
                message: `Your survey submission for "${task.title}" was approved. $${submission.rewardAmount.toFixed(2)} USD has been credited to your Task Earnings balance.`,
                senderType: 'System'
            });
        } else {
            await Notification.create({
                userId: worker._id,
                subject: 'Proof Submitted Successfully! 📤',
                message: `Your completion proof for campaign "${task.title}" has been successfully submitted and is pending review.`,
                senderType: 'System'
            });
        }
        
        // STEP D2: Apply Survey Answer to Profile Attribute Mapping (only on successful non-screenout valid answers)
        if (isSurveyTask && !isScreenout) {
            await applySurveyProfileMappings(worker, task, surveyResponses, isScreenout, submission);
        }

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: submission });
    } catch (err) {
        if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
            return res.status(400).json({
                success: false,
                error: 'You have already submitted proof for this task.'
            });
        }
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateSubmissionStatus = async (req, res) => {
    try {
        const { status, adminNotes, rejectionReason } = req.body;
        const submission = await UserTaskSubmission.findById(req.params.subId);
        if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });

        const task = await UserTask.findById(submission.taskId);

        // Ownership and Role Verification
        if (req.user) {
            const isAdmin = isUserAdmin(req.user);
            const isCreator = task && String(task.userId) === String(req.user.id);
            const isWorker = String(submission.workerId) === String(req.user.id);

            if (isWorker && !isAdmin && !isCreator) {
                return res.status(403).json({ success: false, error: 'Workers cannot approve or review their own submissions.' });
            }
            if (!isAdmin && !isCreator) {
                return res.status(403).json({ success: false, error: 'You are not authorized to review this submission.' });
            }
            if (task && task.isSurvey && task.surveyApprovalMode === 'admin' && !isAdmin) {
                return res.status(403).json({ success: false, error: 'This survey campaign is configured for Admin-only review and approval.' });
            }
        }

        const oldStatus = submission.status;
        submission.status = status || submission.status;
        if (adminNotes !== undefined) submission.adminNotes = adminNotes;
        
        if (status === 'Rejected') {
            const reason = rejectionReason || adminNotes || 'No reason specified';
            submission.rejectionReason = reason;
            submission.rejectedAt = new Date();
            const settings = await Setting.getSettings();
            if (oldStatus === 'Disputed' && submission.disputeStage === 'CreatorReview') {
                submission.disputeStage = 'RejectedByCreator';
                submission.disputeCreatorNotes = reason;
                const secondDisputeHours = settings.systemLimits?.secondDisputeTimeLimitHours || 48;
                submission.secondDisputeDeadline = new Date(Date.now() + secondDisputeHours * 60 * 60 * 1000);
                submission.disputeOpened = false; // Reset so they can escalate to admin
                
                if (submission.disputeId) {
                    await Dispute.findByIdAndUpdate(submission.disputeId, {
                        messages: [
                            { sender: 'System', message: `System Log: Creator rejected the dispute on ${new Date()}. Reason: ${reason}` }
                        ]
                    });
                }
            } else {
                const disputeHours = settings.systemLimits?.disputeTimeLimitHours || 48;
                submission.disputeDeadline = new Date(Date.now() + disputeHours * 60 * 60 * 1000);
                submission.disputeOpened = false; // Reset disputeOpened so they can dispute again if rejected again
            }
        }

        let targetSubmission = submission;

        if (status === 'Approved' && oldStatus !== 'Approved') {
            if (task && task.status === 'Rejected') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot approve submission: the campaign associated with this submission has been rejected.'
                });
            }

            // First claim completion slot atomically
            const claimedTask = await claimTaskCompletionSlot(submission.taskId, submission.workerId);
            if (!claimedTask) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot approve submission: campaign target completion limit has been reached.'
                });
            }

            try {
                // Atomic update to claim reward idempotently
                const updatedSub = await UserTaskSubmission.findOneAndUpdate(
                    { _id: req.params.subId, rewardClaimed: { $ne: true } },
                    {
                        $set: {
                            status: 'Approved',
                            paid: true,
                            rewardClaimed: true,
                            rewardPaidAt: new Date(),
                            adminNotes: adminNotes !== undefined ? adminNotes : submission.adminNotes,
                            ...(oldStatus === 'Disputed' ? { disputeStage: 'Resolved' } : {})
                        }
                    },
                    { new: true }
                );

                if (!updatedSub) {
                    // Reward was ALREADY claimed or approved. Revert claimed slot and return existing submission record safely.
                    await releaseTaskCompletionSlot(submission.taskId, submission.workerId);
                    const currentSub = await UserTaskSubmission.findById(req.params.subId);
                    return res.status(200).json({ success: true, data: currentSub, task: task || null, message: 'Submission already processed or rewarded.' });
                }

                targetSubmission = updatedSub;

                if (oldStatus === 'Disputed') {
                    if (targetSubmission.disputeId) {
                        await Dispute.findByIdAndUpdate(targetSubmission.disputeId, {
                            status: 'Resolved',
                            verdict: 'ReleaseToWorker',
                            adminResponse: 'Resolved directly by the campaign creator.'
                        });
                    } else {
                        await Dispute.updateMany({ submissionId: targetSubmission._id, status: { $ne: 'Resolved' } }, {
                            status: 'Resolved',
                            verdict: 'ReleaseToWorker',
                            adminResponse: 'Resolved directly by the campaign creator.'
                        });
                    }
                }

                const worker = await User.findById(targetSubmission.workerId);
                if (worker) {
                    let rewardInUSD = targetSubmission.rewardAmount;
                    if (rewardInUSD > 0) {
                        worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + rewardInUSD).toFixed(2));
                        await worker.save();

                        // Prevent duplicate transaction
                        const existingTx = await Transaction.findOne({ submissionId: targetSubmission._id, type: 'Task Reward' });
                        if (!existingTx) {
                            const tx = await Transaction.create({
                                userId: worker._id,
                                userName: worker.username,
                                currency: 'USD',
                                type: 'Task Reward',
                                amount: rewardInUSD,
                                description: `Completed User Task: ${targetSubmission.taskTitle || 'Engagement Task'}`,
                                status: 'Approved',
                                submissionId: targetSubmission._id,
                                campaignId: targetSubmission.taskId,
                                idempotencyKey: `task_reward_${targetSubmission._id}`
                            });
                            targetSubmission.rewardTransactionId = tx._id;
                            await targetSubmission.save();
                        }
                    }
                }
            } catch (approveErr) {
                await releaseTaskCompletionSlot(submission.taskId, submission.workerId);
                throw approveErr;
            }
        } else {
            await targetSubmission.save();
        }

        // Send Notification to Worker on Approval or Rejection
        if (status === 'Approved' && oldStatus !== 'Approved') {
            await Notification.create({
                userId: submission.workerId,
                subject: 'Task Approved! ✅',
                message: `Your proof for campaign "${submission.taskTitle}" was approved! You earned ${submission.rewardAmount} USD task reward.`,
                senderType: 'System'
            });

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_approved_email',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString()
                }
            }).catch(err => console.error('Failed to send task submission approved email:', err));

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_approved_whatsapp',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString()
                }
            }).catch(err => console.error('Failed to send task submission approved whatsapp:', err));

        } else if (status === 'Rejected' && oldStatus !== 'Rejected') {
            const settings = await Setting.getSettings();
            if (oldStatus === 'Disputed') {
                const secondDisputeHours = settings.systemLimits?.secondDisputeTimeLimitHours || 48;
                await Notification.create({
                    userId: submission.workerId,
                    subject: 'Dispute Rejected by Creator ⚖️❌',
                    message: `The creator has rejected your dispute for campaign "${submission.taskTitle}". You have ${secondDisputeHours} hours to escalate this dispute directly to the Admin.`,
                    senderType: 'System'
                });
            } else {
                const disputeHours = settings.systemLimits?.disputeTimeLimitHours || 48;
                await Notification.create({
                    userId: submission.workerId,
                    subject: 'Task Rejected ❌',
                    message: `Your proof for campaign "${submission.taskTitle}" was rejected. Reason: "${submission.rejectionReason || 'No reason specified'}". You have ${disputeHours} hours to open a dispute if you believe this is an error.`,
                    senderType: 'System'
                });
            }

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_rejected_email',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString(),
                    notes: submission.rejectionReason || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send task submission rejected email:', err));

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_rejected_whatsapp',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString(),
                    notes: submission.rejectionReason || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send task submission rejected whatsapp:', err));
        }

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: targetSubmission, task: task || null });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteSubmission = async (req, res) => {
    try {
        const submission = await UserTaskSubmission.findById(req.params.subId);
        if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });

        if (req.user) {
            const isWorker = String(submission.workerId) === String(req.user.id);
            const isAdmin = isUserAdmin(req.user);
            if (!isWorker && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to delete this submission.' });
            }
        }

        await UserTaskSubmission.findByIdAndDelete(req.params.subId);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const convertUserCurrency = async (req, res) => {
    try {
        const { userId, amount, fromCurrency, toCurrency } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = isUserAdmin(req.user);
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only convert currency for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];
        
        let allowedCurrency = user.currency || 'USD';
        if (user.country === 'Pakistan') allowedCurrency = 'PKR';
        else if (europeanCountries.includes(user.country)) allowedCurrency = 'EUR';

        if (toCurrency !== allowedCurrency) {
            return res.status(400).json({ success: false, error: `You can only convert to your registered country currency (${allowedCurrency}).` });
        }

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };

        let amountInUSD = amount;
        if (fromCurrency === 'PKR') amountInUSD = amount / (rates.PKR || 278);
        else if (fromCurrency === 'EUR') amountInUSD = amount / (rates.EUR || 0.92);
        else if (fromCurrency === 'USD') amountInUSD = amount / (rates.USD || 1);

        if ((user.taskWalletBalance || 0) < amountInUSD) {
            return res.status(400).json({ success: false, error: 'You do not have enough amount for conversion.' });
        }

        let convertedAmount = amountInUSD * (rates[toCurrency] || 1);
        convertedAmount = Number(convertedAmount.toFixed(2));

        user.taskWalletBalance = Number((user.taskWalletBalance - amountInUSD).toFixed(2));
        user.walletBalance = Number((user.walletBalance + convertedAmount).toFixed(2));
        user.currency = toCurrency;
        await user.save();

        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: toCurrency,
            type: 'Currency Conversion',
            amount: convertedAmount,
            description: `Converted ${amount} USD to ${convertedAmount} ${toCurrency}`,
            status: 'Approved'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                fromAmount: amount,
                fromCurrency: 'USD',
                toAmount: convertedAmount,
                toCurrency,
                rates,
                user
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const openTaskDispute = async (req, res) => {
    try {
        const submission = await UserTaskSubmission.findById(req.params.subId);
        if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });
        if (submission.status !== 'Rejected') {
            return res.status(400).json({ success: false, error: 'Only rejected submissions can be disputed.' });
        }
        if (submission.disputeOpened) {
            return res.status(400).json({ success: false, error: 'Dispute already opened for this submission.' });
        }

        const task = await UserTask.findById(submission.taskId);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        const worker = await User.findById(submission.workerId);
        const creator = await User.findById(task.userId);

        let proofUrl = req.body.proofUrl || '';
        if (req.file) {
            try {
                proofUrl = await uploadStream(req.file.buffer, 'disputes');
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Cloudinary upload failed: ' + err.message });
            }
        }

        const settings = await Setting.getSettings();

        if (submission.disputeStage === 'RejectedByCreator') {
            // Level 2 Escalation directly to Admin
            if (submission.secondDisputeDeadline && new Date() > new Date(submission.secondDisputeDeadline)) {
                const escalationHours = settings.systemLimits?.secondDisputeTimeLimitHours || 48;
                return res.status(400).json({ success: false, error: `The ${escalationHours}-hour escalation window has expired.` });
            }

            let dispute = await Dispute.findById(submission.disputeId);
            if (!dispute) {
                dispute = await Dispute.create({
                    userId: worker._id,
                    userName: worker.username,
                    type: 'UserTask',
                    taskId: task._id,
                    submissionId: submission._id,
                    creatorId: creator ? creator._id : null,
                    referenceId: String(submission._id),
                    description: req.body.description || `Dispute escalated to Admin for task: ${task.title}`,
                    proofUrl: proofUrl,
                    messages: [
                        { sender: 'System', message: `System Log: Worker submitted proof on ${submission.createdAt}` },
                        { sender: 'System', message: `System Log: Creator rejected submission. Reason: ${submission.rejectionReason}` },
                        { sender: 'System', message: `System Log: Worker opened dispute.` },
                        { sender: 'System', message: `System Log: Creator rejected dispute again. Reason: ${submission.disputeCreatorNotes}` },
                        { sender: 'System', message: `System Log: Worker escalated dispute directly to Admin.` },
                        { sender: 'User', message: req.body.description || 'Dispute escalated to Admin by worker.', attachmentUrl: proofUrl || undefined }
                    ],
                    status: 'Open',
                    adminUnread: true,
                    userUnread: false
                });
            } else {
                dispute.messages.push(
                    { sender: 'System', message: `System Log: Creator rejected dispute again. Reason: ${submission.disputeCreatorNotes}` },
                    { sender: 'System', message: `System Log: Worker escalated dispute to Admin on ${new Date()}` },
                    { sender: 'User', message: req.body.description || 'Dispute escalated to Admin by worker.', attachmentUrl: proofUrl || undefined }
                );
                if (proofUrl) dispute.proofUrl = proofUrl;
                dispute.status = 'Open';
                dispute.adminUnread = true;
                dispute.userUnread = false;
                await dispute.save();
            }

            submission.disputeStage = 'Escalated';
            submission.disputeOpened = true;
            submission.status = 'Disputed';
            if (req.body.description) submission.disputeReason = req.body.description;
            if (proofUrl) submission.disputeProofUrl = proofUrl;
            await submission.save();

            task.escrowFrozen = true;
            await task.save();

            // Notify Worker
            await Notification.create({
                userId: worker._id,
                subject: 'Dispute Escalated to Admin ⚖️🏛️',
                message: `Your dispute for the campaign "${task.title}" has been escalated to the Admin. The Admin will review it and make a final decision.`,
                senderType: 'System'
            });

            // Notify Creator
            if (creator) {
                await Notification.create({
                    userId: creator._id,
                    subject: 'Dispute Escalated to Admin ⚖️🏛️',
                    message: `Worker @${worker.username} has escalated their dispute for campaign "${task.title}" to the Admin. The Admin will make the final decision.`,
                    senderType: 'System'
                });
            }

            // Notify Admins
            try {
                const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
                for (const admin of admins) {
                    await Notification.create({
                        userId: admin._id,
                        subject: 'Escalated Task Dispute ⚖️🏛️',
                        message: `Worker @${worker.username} has escalated their dispute on campaign "${task.title}" to the Admin after creator rejection.`,
                        senderType: 'System'
                    });
                }
            } catch (adminErr) {
                console.error('Failed to notify admins of escalated dispute:', adminErr);
            }

            global.appDataVersion = Date.now();
            return res.status(201).json({ success: true, data: dispute });

        } else {
            // Level 1 Dispute: Worker vs. Creator
            if (submission.disputeDeadline && new Date() > new Date(submission.disputeDeadline)) {
                const disputeHours = settings.systemLimits?.disputeTimeLimitHours || 48;
                return res.status(400).json({ success: false, error: `The ${disputeHours}-hour dispute window has expired.` });
            }

            const disputeReviewDays = settings.systemLimits?.disputeReviewTimeoutDays || 3;
            submission.disputeReviewDeadline = new Date(Date.now() + disputeReviewDays * 24 * 60 * 60 * 1000);
            submission.disputeStage = 'CreatorReview';

            const dispute = await Dispute.create({
                userId: worker._id,
                userName: worker.username,
                type: 'UserTask',
                taskId: task._id,
                submissionId: submission._id,
                creatorId: creator ? creator._id : null,
                referenceId: String(submission._id),
                description: req.body.description || `Dispute raised for rejected task: ${task.title}. Rejection reason: ${submission.rejectionReason}`,
                proofUrl: proofUrl,
                messages: [
                    { sender: 'System', message: `System Log: Worker submitted proof on ${submission.createdAt}` },
                    { sender: 'System', message: `System Log: Creator rejected submission on ${submission.rejectedAt || new Date()}. Reason: ${submission.rejectionReason}` },
                    { sender: 'System', message: `System Log: Worker opened dispute. Creator has ${disputeReviewDays} days to review/resolve.` },
                    { sender: 'User', message: req.body.description || 'Dispute initiated by worker.', attachmentUrl: proofUrl || undefined }
                ],
                status: 'Open',
                adminUnread: true,
                userUnread: false
            });

            submission.disputeOpened = true;
            submission.status = 'Disputed';
            submission.disputeId = dispute._id;
            submission.disputeReason = req.body.description || `Dispute raised for rejected task: ${task.title}. Rejection reason: ${submission.rejectionReason}`;
            submission.disputeProofUrl = proofUrl || '';
            await submission.save();

            task.escrowFrozen = true;
            await task.save();

            // Notify Worker
            await Notification.create({
                userId: worker._id,
                subject: 'Dispute Raised ⚖️',
                message: `Your dispute for campaign "${task.title}" has been raised. The creator has ${disputeReviewDays} days to review/resolve it. If they do not, it will be automatically approved.`,
                senderType: 'System'
            });

            // Notify Creator
            if (creator) {
                await Notification.create({
                    userId: creator._id,
                    subject: 'Dispute Raised by Worker ⚖️',
                    message: `Worker @${worker.username} has raised a dispute against your rejection of their proof for campaign "${task.title}". You have ${disputeReviewDays} days to review and either approve or reject/dismiss their dispute.`,
                    senderType: 'System'
                });
            }

            global.appDataVersion = Date.now();
            return res.status(201).json({ success: true, data: dispute });
        }
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const convertTaskWalletBalance = async (req, res) => {
    try {
        const { userId } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = isUserAdmin(req.user);
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const taskBalUSD = user.taskWalletBalance || 0;
        if (taskBalUSD <= 0) {
            return res.status(400).json({ success: false, error: 'No task wallet balance available to transfer.' });
        }

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        const convertedAmount = Number((taskBalUSD * rate).toFixed(2));
        const curSources = user.campaignWalletSources || { fromInvestmentUSD: taskBalUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };

        user.walletBalance = Number((user.walletBalance + convertedAmount).toFixed(2));
        user.taskWalletBalance = 0;
        user.campaignWalletSources = { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
        await user.save();

        await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: userCurr,
            type: 'Task Wallet Transfer',
            amount: convertedAmount,
            amountUSD: taskBalUSD,
            originalAmount: convertedAmount,
            originalCurrency: userCurr,
            exchangeRate: rate,
            sourceWallet: 'CampaignFunds',
            destinationWallet: 'Investment',
            sourceBreakdown: {
                fromInvestmentUSD: curSources.fromInvestmentUSD || 0,
                fromTaskEarningsUSD: curSources.fromTaskEarningsUSD || 0,
                fromRefundsUSD: curSources.fromRefundsUSD || 0
            },
            description: `Transferred Task Wallet ($${taskBalUSD.toFixed(2)} USD) to Main Wallet (${convertedAmount} ${userCurr})`,
            status: 'Approved'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, convertedAmount, currency: userCurr } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const simulateTaskReward = async (req, res) => {
    try {
        const { userId, rewardAmount, networkName, offerTitle, externalTransactionId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const amt = Number(rewardAmount);
        if (isNaN(amt) || amt <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid reward amount' });
        }

        const providerName = networkName || 'Offerwall';
        const extTxId = externalTransactionId || `sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        // Compound Idempotency Check: (offerwallProvider + externalTransactionId)
        const existingReward = await Transaction.findOne({
            offerwallProvider: providerName,
            externalTransactionId: extTxId
        });
        if (existingReward) {
            return res.status(200).json({
                success: true,
                message: 'Reward already processed and credited (idempotency key matched).',
                transaction: existingReward,
                user
            });
        }

        // Credit to Task Earnings Wallet (Worker earnings)
        user.taskEarningsBalance = Number(((user.taskEarningsBalance || 0) + amt).toFixed(2));
        await user.save();

        const newTrx = await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: 'USD',
            type: 'Task Reward',
            amount: amt,
            amountUSD: amt,
            sourceWallet: 'External',
            destinationWallet: 'TaskEarnings',
            offerwallProvider: providerName,
            externalTransactionId: extTxId,
            description: `Earned $${amt.toFixed(2)} USD from ${providerName} Offer: "${offerTitle || 'Micro-Task'}"`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            subject: 'Task Reward Credited! 🪙',
            message: `You have successfully earned $${amt.toFixed(2)} USD from "${offerTitle || 'Micro-Task'}" via ${providerName}. The reward has been added to your Task Earnings Wallet!`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, user, transaction: newTrx });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const transferInvestmentToTaskWallet = async (req, res) => {
    try {
        const { userId, amountUserCurr, amountUSD } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = isUserAdmin(req.user);
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const settings = await Setting.getSettings();
        if (!isAdmin && !canUserAccessInvestmentModule(user, settings)) {
            return res.status(403).json({
                success: false,
                error: 'The Investment Module is currently disabled. Transfers from the Investment Wallet are unavailable.'
            });
        }

        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        let transferInUserCurr = Number(amountUserCurr);
        let transferInUSD = Number(amountUSD);

        if (!transferInUserCurr && transferInUSD) {
            transferInUserCurr = Number((transferInUSD * rate).toFixed(2));
        } else if (transferInUserCurr && !transferInUSD) {
            transferInUSD = Number((transferInUserCurr / rate).toFixed(2));
        }

        if (isNaN(transferInUserCurr) || transferInUserCurr <= 0) {
            return res.status(400).json({ success: false, error: 'Please enter a valid transfer amount.' });
        }

        if (user.walletBalance < transferInUserCurr) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient Investment Wallet balance. Available: ${user.walletBalance.toFixed(2)} ${userCurr}, Requested: ${transferInUserCurr.toFixed(2)} ${userCurr}` 
            });
        }

        // Deduct from Main/Investment Wallet, credit Task Wallet
        user.walletBalance = Number((user.walletBalance - transferInUserCurr).toFixed(2));
        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + transferInUSD).toFixed(2));

        // Update campaignWalletSources
        const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
        user.campaignWalletSources = {
            fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + transferInUSD).toFixed(2)),
            fromTaskEarningsUSD: curSources.fromTaskEarningsUSD || 0,
            fromRefundsUSD: curSources.fromRefundsUSD || 0
        };
        await user.save();

        // Create transaction history record
        await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: userCurr,
            type: 'Investment To Task Wallet Transfer',
            amount: -transferInUserCurr,
            amountUSD: transferInUSD,
            originalAmount: -transferInUserCurr,
            originalCurrency: userCurr,
            exchangeRate: rate,
            sourceWallet: 'Investment',
            destinationWallet: 'CampaignFunds',
            sourceBreakdown: {
                fromInvestmentUSD: transferInUSD,
                fromTaskEarningsUSD: 0,
                fromRefundsUSD: 0
            },
            description: `Transferred ${transferInUserCurr} ${userCurr} ($${transferInUSD} USD) from Investment Wallet to Task Wallet`,
            status: 'Approved'
        });

        // Notification
        await Notification.create({
            userId: user._id,
            subject: 'Task Wallet Funded 💳',
            message: `Successfully transferred ${transferInUserCurr} ${userCurr} ($${transferInUSD} USD) from your Investment Wallet to your Task Wallet.`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                user,
                transferredUserCurr: transferInUserCurr,
                transferredUSD: transferInUSD,
                currency: userCurr
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const transferTaskEarningsToCampaignWallet = async (req, res) => {
    try {
        const { userId, amountUSD } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = isUserAdmin(req.user);
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const transferAmtUSD = Number(amountUSD);
        if (isNaN(transferAmtUSD) || transferAmtUSD <= 0) {
            return res.status(400).json({ success: false, error: 'Please enter a valid transfer amount.' });
        }

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        const currentTaskEarnings = Number((user.taskEarningsBalance || 0).toFixed(2));

        if (currentTaskEarnings < transferAmtUSD - 0.001) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient Task Earnings. Available: $${currentTaskEarnings.toFixed(2)} USD, Requested: $${transferAmtUSD.toFixed(2)} USD.` 
            });
        }

        user.taskEarningsBalance = Number(Math.max(0, currentTaskEarnings - transferAmtUSD).toFixed(2));
        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + transferAmtUSD).toFixed(2));

        // Update campaignWalletSources
        const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
        user.campaignWalletSources = {
            fromInvestmentUSD: curSources.fromInvestmentUSD || 0,
            fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + transferAmtUSD).toFixed(2)),
            fromRefundsUSD: curSources.fromRefundsUSD || 0
        };
        await user.save();

        const newTrx = await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: 'USD',
            type: 'Task Reward Transfer',
            amount: transferAmtUSD,
            amountUSD: transferAmtUSD,
            exchangeRate: rate,
            sourceWallet: 'TaskEarnings',
            destinationWallet: 'CampaignFunds',
            sourceBreakdown: {
                fromInvestmentUSD: 0,
                fromTaskEarningsUSD: transferAmtUSD,
                fromRefundsUSD: 0
            },
            description: `Converted $${transferAmtUSD.toFixed(2)} USD from Task Earnings Wallet to Campaign Wallet for campaign funding`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            subject: 'Campaign Wallet Funded 🪙',
            message: `Successfully converted $${transferAmtUSD.toFixed(2)} USD from Task Earnings Wallet to Campaign Wallet.`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                user,
                transferredUSD: transferAmtUSD,
                transaction: newTrx
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const transferWalletToCampaign = async (req, res) => {
    try {
        const { userId, amountUserCurr, amountUSD, sourceWallet } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = isUserAdmin(req.user);
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        let transferInUserCurr = Number(amountUserCurr);
        let transferInUSD = Number(amountUSD);

        if (!transferInUserCurr && transferInUSD) {
            transferInUserCurr = Number((transferInUSD * rate).toFixed(2));
        } else if (transferInUserCurr && !transferInUSD) {
            transferInUSD = Number((transferInUserCurr / rate).toFixed(2));
        }

        if (isNaN(transferInUserCurr) || transferInUserCurr <= 0) {
            return res.status(400).json({ success: false, error: 'Please enter a valid transfer amount.' });
        }

        const source = sourceWallet === 'Investment' ? 'Investment' : 'Main';
        const availableBalance = source === 'Investment' 
            ? ((user.investmentBalance !== undefined && user.investmentBalance !== null && user.investmentBalance > 0) ? user.investmentBalance : (user.walletBalance || 0))
            : (user.walletBalance || 0);

        if (availableBalance < transferInUserCurr - 0.001) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient balance in ${source} Wallet. Available: ${availableBalance.toFixed(2)} ${userCurr}, Requested: ${transferInUserCurr.toFixed(2)} ${userCurr}` 
            });
        }

        if (source === 'Investment' && user.investmentBalance !== undefined && user.investmentBalance !== null && user.investmentBalance > 0) {
            user.investmentBalance = Number(Math.max(0, user.investmentBalance - transferInUserCurr).toFixed(2));
        } else {
            user.walletBalance = Number(Math.max(0, (user.walletBalance || 0) - transferInUserCurr).toFixed(2));
        }

        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + transferInUSD).toFixed(2));
        await user.save();

        const newTrx = await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: userCurr,
            type: source === 'Investment' ? 'Investment To Task Wallet Transfer' : 'Main To Campaign Wallet Transfer',
            amount: -transferInUserCurr,
            amountUSD: transferInUSD,
            originalAmount: -transferInUserCurr,
            originalCurrency: userCurr,
            exchangeRate: rate,
            description: `Transferred ${transferInUserCurr.toFixed(2)} ${userCurr} ($${transferInUSD.toFixed(2)} USD) from ${source} Wallet to Campaign Wallet`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            subject: 'Campaign Wallet Funded 💳',
            message: `Successfully transferred ${transferInUserCurr.toFixed(2)} ${userCurr} ($${transferInUSD.toFixed(2)} USD) from your ${source} Wallet to your Campaign Wallet.`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                user,
                transferredUserCurr: transferInUserCurr,
                transferredUSD: transferInUSD,
                currency: userCurr,
                transaction: newTrx
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Admin erase/reset all Work and Earn module data for target user(s)
// @route   POST /api/v1/user-tasks/admin-reset-data
export const resetWorkAndEarnData = async (req, res) => {
    try {
        const { 
            userIds, 
            resetAllMatching, 
            activePlanFilter, 
            allowedAccessFilter,
            resetOptions // optional object: { campaigns: true, submissions: true, disputes: true, transactions: true, hubWithdrawals: true, hubDeposits: true, resetBalances: true, logs: true, notifications: true }
        } = req.body;

        // Default all options to true if not explicitly provided
        const options = {
            campaigns: resetOptions?.campaigns !== false,
            submissions: resetOptions?.submissions !== false,
            disputes: resetOptions?.disputes !== false,
            transactions: resetOptions?.transactions !== false,
            hubWithdrawals: resetOptions?.hubWithdrawals !== false,
            hubDeposits: resetOptions?.hubDeposits !== false,
            resetBalances: resetOptions?.resetBalances !== false,
            logs: resetOptions?.logs !== false,
            notifications: resetOptions?.notifications !== false,
        };

        // Fetch settings if needed for allowed access
        const settings = await Setting.findOne() || {};

        let targetUsers = [];

        if (Array.isArray(userIds) && userIds.length > 0) {
            targetUsers = await User.find({ _id: { $in: userIds } });
        } else if (resetAllMatching || activePlanFilter || allowedAccessFilter) {
            let query = { role: 'user' };

            if (activePlanFilter && activePlanFilter !== 'all') {
                if (activePlanFilter === 'none') {
                    query.$or = [{ activePlan: 'None' }, { activePlan: { $exists: false } }, { activePlan: '' }];
                } else {
                    query.activePlan = activePlanFilter;
                }
            }

            if (allowedAccessFilter && allowedAccessFilter !== 'all') {
                const allowedSet = new Set(settings.userTaskAllowedUserIds || []);
                if (allowedAccessFilter === 'allowed') {
                    query._id = { $in: Array.from(allowedSet) };
                } else if (allowedAccessFilter === 'not_allowed') {
                    query._id = { $nin: Array.from(allowedSet) };
                }
            }

            targetUsers = await User.find(query);
        }

        if (!targetUsers || targetUsers.length === 0) {
            return res.status(400).json({ success: false, error: 'No matching users found for Work & Earn reset.' });
        }

        const targetUserIds = targetUsers.map(u => u._id);
        const targetUsernames = targetUsers.map(u => u.username).filter(Boolean);
        const targetEmails = targetUsers.map(u => u.email).filter(Boolean);

        // 1. Delete UserTask campaigns created by target users
        if (options.campaigns) {
            await UserTask.deleteMany({ userId: { $in: targetUserIds } });
        }

        // 2. Delete UserTaskSubmissions submitted by target users OR on tasks created by target users
        if (options.submissions) {
            await UserTaskSubmission.deleteMany({
                $or: [
                    { workerId: { $in: targetUserIds } },
                    { workerName: { $in: targetUsernames } },
                    { proofEmail: { $in: targetEmails } }
                ]
            });
        }

        // 3. Delete related disputes
        if (options.disputes) {
            await Dispute.deleteMany({
                $or: [
                    { userId: { $in: targetUserIds } },
                    { complainantId: { $in: targetUserIds } },
                    { respondentId: { $in: targetUserIds } }
                ]
            });
        }

        // 4. Delete Work & Earn related transactions
        if (options.transactions) {
            await Transaction.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { type: 'Task Reward' },
                    { type: 'Task Budget Deduction' },
                    { type: 'Task Refund' },
                    { type: 'Task Wallet Transfer' },
                    { type: 'Investment To Task Wallet Transfer' },
                    { description: { $regex: /task/i } },
                    { description: { $regex: /campaign/i } },
                    { description: { $regex: /micro/i } },
                    { description: { $regex: /work/i } }
                ]
            });
        }

        // 5. Delete Hub Withdrawals
        if (options.hubWithdrawals) {
            const Withdrawal = (await import('../models/Withdrawal.js')).default;
            await Withdrawal.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { isHub: true },
                    { isTaskWallet: true },
                    { userNotes: { $regex: /hub/i } },
                    { userNotes: { $regex: /task/i } }
                ]
            });
        }

        // 6. Delete Hub Deposits
        if (options.hubDeposits) {
            const Deposit = (await import('../models/Deposit.js')).default;
            await Deposit.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { isHub: true },
                    { userNotes: { $regex: /hub/i } },
                    { userNotes: { $regex: /task/i } }
                ]
            });
        }

        // 7. Delete Work & Earn related Logs
        if (options.logs) {
            const Log = (await import('../models/Log.js')).default;
            await Log.deleteMany({
                $or: [
                    { affectedUser: { $in: targetUsernames } },
                    { details: { $regex: /task/i } },
                    { details: { $regex: /campaign/i } },
                    { details: { $regex: /work & earn/i } }
                ]
            });
        }

        // 8. Delete Work & Earn Notifications
        if (options.notifications) {
            await Notification.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { subject: { $regex: /task/i } },
                    { subject: { $regex: /campaign/i } },
                    { subject: { $regex: /work & earn/i } },
                    { message: { $regex: /task/i } },
                    { message: { $regex: /campaign/i } }
                ]
            });
        }

        // 9. Reset user Task Wallet & Task Earnings balances strictly to 0
        if (options.resetBalances) {
            await User.updateMany(
                { _id: { $in: targetUserIds } },
                { 
                    $set: { 
                        taskWalletBalance: 0,
                        taskEarningsBalance: 0
                    } 
                }
            );
        }

        // 10. Send fresh reset notification to users
        for (const user of targetUsers) {
            await Notification.create({
                userId: user._id,
                subject: 'Work & Earn Module Journey Reset 🔄',
                message: 'Your Work & Earn module activity, balances, earnings, campaigns, and submissions have been reset by administrator.',
                senderType: 'Admin'
            });
        }

        global.appDataVersion = Date.now();

        return res.status(200).json({
            success: true,
            message: `Successfully erased Work & Earn module data for ${targetUsers.length} user(s).`,
            resetCount: targetUsers.length
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Server error resetting Work & Earn data.' });
    }
};

/**
 * Aggregated analytics and responses for a Survey Campaign
 */
export const getSurveyCampaignAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await UserTask.findById(id);
        if (!task) return res.status(404).json({ success: false, error: 'Survey campaign not found' });

        const isOwner = req.user && String(task.userId) === String(req.user.id);
        const isAdmin = isUserAdmin(req.user);
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, error: 'Unauthorized to view survey analytics' });
        }

        const submissions = await UserTaskSubmission.find({ taskId: task._id }).sort({ createdAt: -1 });
        const totalSubmissions = submissions.length;
        const completed = submissions.filter(s => s.surveyQualificationStatus === 'Completed' || s.status === 'Approved');
        const disqualified = submissions.filter(s => s.surveyQualificationStatus === 'Disqualified');
        const attentionPassed = submissions.filter(s => s.attentionCheckPassed !== false).length;
        
        let totalTime = 0;
        let countWithTime = 0;
        submissions.forEach(s => {
            if (s.surveyCompletionTimeSeconds > 0) {
                totalTime += s.surveyCompletionTimeSeconds;
                countWithTime++;
            }
        });
        const averageTimeSeconds = countWithTime > 0 ? Math.round(totalTime / countWithTime) : 0;

        const questions = (task.surveyConfig && task.surveyConfig.questions) || [];
        const questionAnalytics = questions.map((q, idx) => {
            const answers = [];
            const counts = {};
            let numericSum = 0;
            let numericCount = 0;

            submissions.forEach(s => {
                const response = (s.surveyResponses || []).find(r => r.questionId === q.id);
                if (response && response.value !== undefined && response.value !== null && response.value !== '') {
                    answers.push({
                        workerName: isAdmin || isOwner ? s.workerName : 'Participant',
                        value: response.value,
                        submittedAt: s.createdAt
                    });

                    if (Array.isArray(response.value)) {
                        response.value.forEach(val => {
                            counts[val] = (counts[val] || 0) + 1;
                        });
                    } else {
                        counts[response.value] = (counts[response.value] || 0) + 1;
                    }

                    const numVal = Number(response.value);
                    if (!isNaN(numVal) && isFinite(numVal)) {
                        numericSum += numVal;
                        numericCount++;
                    }
                }
            });

            return {
                id: q.id,
                order: idx + 1,
                title: q.title,
                type: q.type,
                options: q.options || [],
                totalAnswers: answers.length,
                counts,
                average: numericCount > 0 ? Number((numericSum / numericCount).toFixed(2)) : null,
                recentAnswers: answers.slice(-25)
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                task: {
                    id: task._id,
                    title: task.title,
                    category: task.category,
                    subType: task.subType,
                    status: task.status,
                    targetQuantity: task.targetQuantity,
                    currentCompletions: task.currentCompletions,
                    rewardPerTask: task.rewardPerTask,
                    totalBudget: task.totalBudget,
                    surveyEstimatedMinutes: task.surveyEstimatedMinutes,
                    createdAt: task.createdAt
                },
                metrics: {
                    totalSubmissions,
                    approvedSubmissions: submissions.filter(s => s.status === 'Approved').length,
                    pendingSubmissions: submissions.filter(s => s.status === 'Pending').length,
                    rejectedSubmissions: submissions.filter(s => s.status === 'Rejected').length,
                    completedSubmissions: completed.length,
                    disqualifiedSubmissions: disqualified.length,
                    attentionPassedCount: attentionPassed,
                    averageCompletionTimeSeconds: averageTimeSeconds,
                    completionRate: task.targetQuantity > 0 ? Math.min(100, Math.round((task.currentCompletions / task.targetQuantity) * 100)) : 0
                },
                questions: questionAnalytics,
                rawSubmissions: submissions.map(s => ({
                    id: s._id,
                    workerName: s.workerName,
                    status: s.status,
                    rewardAmount: s.rewardAmount,
                    completionTimeSeconds: s.surveyCompletionTimeSeconds,
                    qualificationStatus: s.surveyQualificationStatus,
                    attentionCheckPassed: s.attentionCheckPassed,
                    responses: s.surveyResponses,
                    createdAt: s.createdAt
                }))
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

export const addAdminCampaignFunds = async (req, res) => {
    let settingDeducted = false;
    let deductedAmountUSD = 0;
    let taskCredited = false;
    let targetSettingId = null;
    try {
        if (!req.user || !isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Administrative authorization required to add campaign funds.' });
        }

        const taskId = req.params.id;
        if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ success: false, error: 'Invalid campaign ID.' });
        }

        const task = await UserTask.findById(taskId);
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task campaign not found.' });
        }

        const amountNum = Number(req.body.amount);
        if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ success: false, error: 'Please specify a valid, positive funding amount.' });
        }
        const fundAmountUSD = Number(amountNum.toFixed(2));

        const rawIdempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.idempotencyKey;
        const idempotencyKey = typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : '';

        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid Idempotency-Key header or idempotencyKey in request body.'
            });
        }

        const existingTx = await Transaction.findOne({ idempotencyKey });
        if (existingTx) {
            const typeMatches = existingTx.type === 'Admin Campaign Funding';
            const campaignMatches = String(existingTx.campaignId) === String(task._id);
            const userMatches = String(existingTx.userId) === String(req.user._id || req.user.id);
            const txAmount = Number(existingTx.amountUSD != null ? existingTx.amountUSD : existingTx.amount);
            const amountMatches = !isNaN(txAmount) && Math.abs(txAmount - fundAmountUSD) < 0.001;

            if (!typeMatches || !campaignMatches || !userMatches || !amountMatches) {
                return res.status(409).json({
                    success: false,
                    error: `Idempotency key collision detected for ${idempotencyKey}: type, campaign, user, or amount mismatch.`
                });
            }
            const freshTask = await UserTask.findById(taskId);
            const currentSettings = await Setting.getSettings();
            return res.status(200).json({
                success: true,
                message: 'Funding request already processed (idempotent).',
                task: freshTask,
                transaction: existingTx,
                settings: currentSettings
            });
        }

        const settings = await Setting.getSettings();
        targetSettingId = settings?._id;

        // Atomically deduct from Admin Campaign Budget in Setting (no Mongo session to preserve capped collection safety)
        const updatedSetting = await Setting.findOneAndUpdate(
            {
                _id: settings._id,
                'adminCampaignBudget.enabled': true,
                'adminCampaignBudget.remainingBudgetUSD': { $gte: fundAmountUSD }
            },
            {
                $inc: { 'adminCampaignBudget.remainingBudgetUSD': -fundAmountUSD },
                $set: { dataVersion: Date.now() }
            },
            { new: true }
        );

        if (!updatedSetting) {
            const currentSetting = await Setting.getSettings();
            if (!currentSetting.adminCampaignBudget?.enabled) {
                return res.status(400).json({ success: false, error: 'Admin Campaign Budget is currently disabled in System Settings.' });
            }
            const availableBudget = Number((currentSetting.adminCampaignBudget?.remainingBudgetUSD || 0).toFixed(2));
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient Admin Campaign Budget. Required: $${fundAmountUSD.toFixed(2)} USD, Available: $${availableBudget.toFixed(2)} USD.` 
            });
        }

        settingDeducted = true;
        deductedAmountUSD = fundAmountUSD;

        // Atomically add funds to the SAME UserTask without creating a new campaign or resetting completedUsers
        const updateFields = {
            $inc: {
                campaignAvailableBalanceUSD: fundAmountUSD,
                campaignTotalFundedUSD: fundAmountUSD,
                adminBudgetAllocatedUSD: fundAmountUSD,
                totalBudget: fundAmountUSD
            },
            $set: {
                lowBalanceWarningSent: false
            },
            $push: {
                history: {
                    action: 'Funds Added',
                    previousStatus: task.status,
                    newStatus: task.status,
                    timestamp: new Date(),
                    performedBy: req.user.username || req.user.id || 'Admin',
                    details: `Added $${fundAmountUSD.toFixed(2)} USD funding from Admin Campaign Budget.`
                }
            }
        };

        if (task.campaignFundingStatus === 'paused_insufficient_funds' || task.campaignFundingStatus === 'low_balance') {
            updateFields.$set.campaignFundingStatus = 'funded';
        }

        const updatedTask = await UserTask.findByIdAndUpdate(taskId, updateFields, { new: true });
        taskCredited = true;

        const tx = await Transaction.create({
            userId: req.user._id,
            userName: req.user.username,
            currency: 'USD',
            type: 'Admin Campaign Funding',
            amount: fundAmountUSD,
            amountUSD: fundAmountUSD,
            campaignId: task._id,
            sourceWallet: 'AdminBudget',
            destinationWallet: 'CampaignEscrow',
            description: `Added $${fundAmountUSD.toFixed(2)} USD funding to campaign: "${task.title}"`,
            status: 'Approved',
            idempotencyKey: idempotencyKey
        });

        return res.status(200).json({
            success: true,
            message: `Successfully added $${fundAmountUSD.toFixed(2)} USD to campaign "${task.title}". Available balance: $${updatedTask.campaignAvailableBalanceUSD.toFixed(2)} USD.`,
            task: updatedTask,
            transaction: tx,
            settings: updatedSetting
        });
    } catch (err) {
        if (taskCredited && deductedAmountUSD > 0) {
            try {
                await UserTask.findByIdAndUpdate(req.params.id, {
                    $inc: {
                        campaignAvailableBalanceUSD: -deductedAmountUSD,
                        campaignTotalFundedUSD: -deductedAmountUSD,
                        adminBudgetAllocatedUSD: -deductedAmountUSD,
                        totalBudget: -deductedAmountUSD
                    }
                });
            } catch (revertTaskErr) {
                console.error('Failed to revert task credit on error in addAdminCampaignFunds:', revertTaskErr);
            }
        }
        if (settingDeducted && deductedAmountUSD > 0 && targetSettingId) {
            try {
                await Setting.findOneAndUpdate(
                    { _id: targetSettingId },
                    {
                        $inc: { 'adminCampaignBudget.remainingBudgetUSD': deductedAmountUSD },
                        $set: { dataVersion: Date.now() }
                    },
                    { new: true }
                );
            } catch (refundErr) {
                console.error('CRITICAL: Failed compensating refund to Admin Campaign Budget in addAdminCampaignFunds:', refundErr);
            }
        }
        if (idempotencyKey && (err.code === 11000 || (err.message && err.message.includes('duplicate key')))) {
            const existingTx = await Transaction.findOne({ idempotencyKey });
            if (existingTx) {
                const currentCampaignId = (task && task._id) ? String(task._id) : String(req.params.id);
                const typeMatches = existingTx.type === 'Admin Campaign Funding';
                const campaignMatches = String(existingTx.campaignId) === currentCampaignId;
                const userMatches = String(existingTx.userId) === String(req.user._id || req.user.id);
                const txAmount = Number(existingTx.amountUSD != null ? existingTx.amountUSD : existingTx.amount);
                const amountMatches = !isNaN(txAmount) && Math.abs(txAmount - fundAmountUSD) < 0.001;

                if (!typeMatches || !campaignMatches || !userMatches || !amountMatches) {
                    return res.status(409).json({
                        success: false,
                        error: `Idempotency key collision detected for ${idempotencyKey}: type, campaign, user, or amount mismatch.`
                    });
                }
                const freshTask = await UserTask.findById(taskId);
                const currentSettings = await Setting.getSettings();
                return res.status(200).json({
                    success: true,
                    message: 'Funding request already processed (idempotent concurrent resolution).',
                    task: freshTask,
                    transaction: existingTx,
                    settings: currentSettings
                });
            }
        }
        return res.status(400).json({ success: false, error: err.message });
    }
};

export const resumeAdminCampaign = async (req, res) => {
    try {
        if (!req.user || !isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Administrative authorization required.' });
        }

        const taskId = req.params.id;
        const task = await UserTask.findById(taskId);
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task campaign not found.' });
        }

        if (task.isUnlimitedResponses && task.rewardPerTask > 0 && (task.campaignAvailableBalanceUSD || 0) < task.rewardPerTask) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot resume campaign: Available balance ($${(task.campaignAvailableBalanceUSD || 0).toFixed(2)} USD) is less than reward per task ($${task.rewardPerTask.toFixed(2)} USD). Please add funds first.` 
            });
        }

        const previousStatus = task.status;
        task.status = 'Approved';
        task.campaignFundingStatus = 'funded';
        task.history.push({
            action: 'Resumed',
            previousStatus,
            newStatus: 'Approved',
            timestamp: new Date(),
            performedBy: req.user.username || req.user.id,
            details: 'Campaign manually resumed by administrator.'
        });
        await task.save();

        return res.status(200).json({ success: true, message: `Campaign "${task.title}" has been resumed.`, task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const pauseAdminCampaign = async (req, res) => {
    try {
        if (!req.user || !isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Administrative authorization required.' });
        }

        const taskId = req.params.id;
        const task = await UserTask.findById(taskId);
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task campaign not found.' });
        }

        const previousStatus = task.status;
        task.status = 'On Hold';
        task.history.push({
            action: 'Paused',
            previousStatus,
            newStatus: 'On Hold',
            timestamp: new Date(),
            performedBy: req.user.username || req.user.id,
            details: 'Campaign manually paused by administrator.'
        });
        await task.save();

        return res.status(200).json({ success: true, message: `Campaign "${task.title}" has been paused.`, task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
