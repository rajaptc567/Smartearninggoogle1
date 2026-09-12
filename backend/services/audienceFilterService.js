import mongoose from 'mongoose';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import Withdrawal from '../models/Withdrawal.js';
import Deposit from '../models/Deposit.js';
import Transaction from '../models/Transaction.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';

/**
 * Reusable Audience Filtering Service
 * Channel-neutral: Supports Email now and future WhatsApp automation with identical criteria.
 */

/**
 * Builds the set of eligible user IDs based on advanced audience criteria.
 * @param {Object} filters Filter criteria from admin request
 * @param {Object} options Options including channel ('email' | 'whatsapp' | 'all')
 * @returns {Promise<{ userQuery: Object, matchedUserIds: string[] | null }>}
 */
export const buildAudienceQuery = async (filters = {}, options = {}) => {
    const channel = options.channel || 'email';
    const userQuery = {};

    // 1. Channel Constraints
    if (channel === 'email') {
        userQuery.email = { $exists: true, $ne: '', $regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i };
    } else if (channel === 'whatsapp') {
        // Group channel eligibility in $and separately to prevent $or collisions with other filters
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { phone: { $exists: true, $ne: '' } },
                { whatsapp: { $exists: true, $ne: '' } }
            ]
        });

        // Enforce verified recipients for WhatsApp channel if existing product rule requires it
        try {
            const currentSettings = await Setting.getSettings();
            if (currentSettings?.whatsappVerificationRequired) {
                userQuery.whatsappVerified = true;
            }
        } catch (err) {
            // Non-blocking fallback
        }
    }

    // 2. User Status (All / Active / Non-active)
    if (filters.userStatus && filters.userStatus !== 'all') {
        if (filters.userStatus === 'active') {
            userQuery.status = { $in: ['Active', 'Verified'] };
        } else if (filters.userStatus === 'non_active') {
            userQuery.status = { $in: ['Blocked', 'Pending', 'Paused'] };
        } else {
            userQuery.status = filters.userStatus;
        }
    }

    // 3. Registration Date (From / To / Month / New Users)
    const dateQuery = {};
    if (filters.regMonth && filters.regMonth !== 'all') {
        // e.g. "2026-08"
        const [yearStr, monthStr] = filters.regMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1; // 0-indexed
        if (!isNaN(year) && !isNaN(month)) {
            const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
            const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            dateQuery.$gte = startOfMonth;
            dateQuery.$lte = endOfMonth;
        }
    } else {
        if (filters.regDateFrom) {
            const fromDate = new Date(filters.regDateFrom);
            if (!isNaN(fromDate.getTime())) {
                fromDate.setUTCHours(0, 0, 0, 0);
                dateQuery.$gte = fromDate;
            }
        }
        if (filters.regDateTo) {
            const toDate = new Date(filters.regDateTo);
            if (!isNaN(toDate.getTime())) {
                toDate.setUTCHours(23, 59, 59, 999);
                dateQuery.$lte = toDate;
            }
        }
    }

    // New Users filter (e.g. registered in last 7 or 30 days)
    if (filters.isNewUser === true || filters.isNewUser === 'true' || filters.newUsersWindow) {
        const days = parseInt(filters.newUsersWindow, 10) || 7;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        dateQuery.$gte = cutoff;
    }

    if (Object.keys(dateQuery).length > 0) {
        userQuery.registrationDate = dateQuery;
    }

    // 4. Plan Status (Active Plan / No Active Plan / Specific Plan)
    if (filters.planStatus && filters.planStatus !== 'all') {
        if (filters.planStatus === 'has_active_plan') {
            userQuery.$and = userQuery.$and || [];
            userQuery.$and.push({
                $or: [
                    { activePlan: { $nin: ['None', '', null] } },
                    { 'activePlans.0': { $exists: true } }
                ]
            });
        } else if (filters.planStatus === 'no_active_plan') {
            userQuery.$and = userQuery.$and || [];
            userQuery.$and.push({
                $or: [
                    { activePlan: 'None' },
                    { activePlan: '' },
                    { activePlan: { $exists: false } },
                    { activePlan: null }
                ]
            });
            userQuery.$and.push({
                $or: [
                    { activePlans: { $size: 0 } },
                    { activePlans: { $exists: false } }
                ]
            });
        } else if (filters.planStatus === 'specific_plan') {
            const planIds = (Array.isArray(filters.specificPlanIds) && filters.specificPlanIds.length > 0)
                ? filters.specificPlanIds.filter(Boolean)
                : (filters.specificPlanId ? [filters.specificPlanId] : []);

            if (planIds.length > 0) {
                userQuery.$and = userQuery.$and || [];
                const orConditions = [];

                // Match in activePlan (string plan ID or plan name)
                orConditions.push({ activePlan: { $in: planIds } });

                // Match in activePlans.planId (ObjectId)
                const validObjectIds = planIds
                    .filter(id => mongoose.Types.ObjectId.isValid(id))
                    .map(id => new mongoose.Types.ObjectId(id));
                if (validObjectIds.length > 0) {
                    orConditions.push({ 'activePlans.planId': { $in: validObjectIds } });
                }

                userQuery.$and.push({ $or: orConditions });
            }
        }
    }

    // Plan Purchasers
    if (filters.isPlanPurchaser === 'yes' || filters.isPlanPurchaser === true) {
        userQuery['activePlans.0'] = { $exists: true };
    } else if (filters.isPlanPurchaser === 'no' || filters.isPlanPurchaser === false) {
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { activePlans: { $size: 0 } },
                { activePlans: { $exists: false } }
            ]
        });
    }

    // 5. Country & Currency
    if (filters.country && filters.country !== 'all') {
        userQuery.country = { $regex: new RegExp(`^${filters.country.trim()}$`, 'i') };
    }
    if (filters.currency && filters.currency !== 'all') {
        userQuery.currency = filters.currency.trim().toUpperCase();
    }

    // 6. Verification Statuses
    if (filters.emailVerified === 'verified' || filters.emailVerified === true || filters.emailVerified === 'true') {
        userQuery.emailVerified = true;
    } else if (filters.emailVerified === 'unverified' || filters.emailVerified === false || filters.emailVerified === 'false') {
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { emailVerified: false },
                { emailVerified: { $exists: false } }
            ]
        });
    }

    if (filters.whatsappVerified === 'verified' || filters.whatsappVerified === true || filters.whatsappVerified === 'true') {
        userQuery.whatsappVerified = true;
    } else if (filters.whatsappVerified === 'unverified' || filters.whatsappVerified === false || filters.whatsappVerified === 'false') {
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { whatsappVerified: false },
                { whatsappVerified: { $exists: false } }
            ]
        });
    }

    // 6b. Marketing & Legal Consent Filters
    if (filters.emailMarketingConsent === 'opted_in' || filters.emailMarketingConsent === true || filters.emailMarketingConsent === 'true') {
        userQuery.emailMarketingConsent = true;
    } else if (filters.emailMarketingConsent === 'opted_out' || filters.emailMarketingConsent === false || filters.emailMarketingConsent === 'false') {
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { emailMarketingConsent: false },
                { emailMarketingConsent: { $exists: false } }
            ]
        });
    }

    if (filters.whatsappMarketingConsent === 'opted_in' || filters.whatsappMarketingConsent === true || filters.whatsappMarketingConsent === 'true') {
        userQuery.whatsappMarketingConsent = true;
    } else if (filters.whatsappMarketingConsent === 'opted_out' || filters.whatsappMarketingConsent === false || filters.whatsappMarketingConsent === 'false') {
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { whatsappMarketingConsent: false },
                { whatsappMarketingConsent: { $exists: false } }
            ]
        });
    }

    if (filters.termsAccepted === 'accepted' || filters.termsAccepted === true || filters.termsAccepted === 'true') {
        userQuery.termsAccepted = true;
    } else if (filters.termsAccepted === 'not_accepted' || filters.termsAccepted === false || filters.termsAccepted === 'false') {
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { termsAccepted: false },
                { termsAccepted: { $exists: false } }
            ]
        });
    }

    if (filters.privacyAcknowledged === 'acknowledged' || filters.privacyAcknowledged === true || filters.privacyAcknowledged === 'true') {
        userQuery.privacyPolicyAcknowledged = true;
    } else if (filters.privacyAcknowledged === 'not_acknowledged' || filters.privacyAcknowledged === false || filters.privacyAcknowledged === 'false') {
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({
            $or: [
                { privacyPolicyAcknowledged: false },
                { privacyPolicyAcknowledged: { $exists: false } }
            ]
        });
    }

    // Explicit marketing broadcast target enforcement
    if (filters.marketingOnly === true || filters.marketingOnly === 'true' || filters.audienceType === 'marketing_opted_in') {
        if (channel === 'whatsapp') {
            userQuery.whatsappMarketingConsent = true;
        } else {
            userQuery.emailMarketingConsent = true;
        }
    }

    // 7. Keyword Search (username, fullName, email, phone)
    if (filters.search && String(filters.search).trim()) {
        const term = String(filters.search).trim();
        const searchRegex = new RegExp(term, 'i');
        const searchConditions = [
            { username: searchRegex },
            { fullName: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
            { whatsapp: searchRegex }
        ];
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({ $or: searchConditions });
    }

    // 8. Manual individual selection or exclusion
    if (Array.isArray(filters.selectedUserIds) && filters.selectedUserIds.length > 0) {
        const validIds = filters.selectedUserIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length > 0) {
            userQuery._id = { $in: validIds.map(id => new mongoose.Types.ObjectId(id)) };
        }
    }
    if (Array.isArray(filters.excludedUserIds) && filters.excludedUserIds.length > 0) {
        const excludeIds = filters.excludedUserIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (excludeIds.length > 0) {
            userQuery._id = userQuery._id || {};
            userQuery._id.$nin = excludeIds.map(id => new mongoose.Types.ObjectId(id));
        }
    }

    // 9. Relational Criteria: Payout / Deposit / Activity Filters
    let intersectedUserIds = null;

    // Payout filters using existing Withdrawal records (status 'Approved' or 'Paid')
    if (filters.payoutStatus && filters.payoutStatus !== 'all') {
        const payoutAgg = await Withdrawal.aggregate([
            { $match: { status: { $in: ['Approved', 'Paid'] } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]);

        const payoutCounts = new Map();
        payoutAgg.forEach(p => {
            if (p._id) payoutCounts.set(String(p._id), p.count);
        });

        if (filters.payoutStatus === 'never_paid') {
            // User has 0 successful payouts
            const paidUserIds = Array.from(payoutCounts.keys()).filter(id => mongoose.Types.ObjectId.isValid(id));
            userQuery.$and = userQuery.$and || [];
            userQuery.$and.push({
                _id: { $nin: paidUserIds.map(id => new mongoose.Types.ObjectId(id)) }
            });
        } else {
            let targetUserIds = [];
            if (filters.payoutStatus === 'at_least_one_payout' || filters.payoutStatus === 'paid_once') {
                targetUserIds = Array.from(payoutCounts.entries())
                    .filter(([_, count]) => count >= 1)
                    .map(([id]) => id);
            } else if (filters.payoutStatus === 'first_payout') {
                targetUserIds = Array.from(payoutCounts.entries())
                    .filter(([_, count]) => count === 1)
                    .map(([id]) => id);
            } else if (filters.payoutStatus === 'second_payout') {
                targetUserIds = Array.from(payoutCounts.entries())
                    .filter(([_, count]) => count === 2)
                    .map(([id]) => id);
            } else if (filters.payoutStatus === 'three_plus_payouts' || filters.payoutStatus === 'frequent_payout') {
                targetUserIds = Array.from(payoutCounts.entries())
                    .filter(([_, count]) => count >= 3)
                    .map(([id]) => id);
            }

            const validTargetObjectIds = targetUserIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
            userQuery.$and = userQuery.$and || [];
            userQuery.$and.push({ _id: { $in: validTargetObjectIds } });
        }
    }

    // Task Activity Filter using UserTaskSubmission
    if (filters.taskActivity && filters.taskActivity !== 'all') {
        const taskQuery = {};
        const now = Date.now();
        const activity = String(filters.taskActivity).toLowerCase();

        if (activity.includes('7d')) {
            taskQuery.createdAt = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
        } else if (activity.includes('30d')) {
            taskQuery.createdAt = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        }

        if (activity.startsWith('approved')) {
            taskQuery.status = { $in: ['Approved', 'Paid'] };
        } else if (activity.startsWith('rejected')) {
            taskQuery.status = 'Rejected';
        } else if (activity.startsWith('pending') || activity.startsWith('submitted')) {
            taskQuery.status = 'Pending';
        }

        const distinctWorkerIds = await UserTaskSubmission.distinct('workerId', taskQuery);
        const validWorkerObjectIds = distinctWorkerIds
            .filter(id => id && mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({ _id: { $in: validWorkerObjectIds } });
    }

    // Deposit filters using existing Deposit records (status 'Approved')
    if (filters.depositStatus && filters.depositStatus !== 'all') {
        const depositedUserIds = await Deposit.distinct('userId', { status: 'Approved' });
        const validDepositedIds = depositedUserIds.filter(id => id && mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

        userQuery.$and = userQuery.$and || [];
        if (filters.depositStatus === 'has_deposit') {
            userQuery.$and.push({ _id: { $in: validDepositedIds } });
        } else if (filters.depositStatus === 'no_deposit') {
            userQuery.$and.push({ _id: { $nin: validDepositedIds } });
        }
    }

    // Activity Type Filters (Work & Earn vs. Investment)
    if (filters.activityType && filters.activityType !== 'all') {
        userQuery.$and = userQuery.$and || [];
        if (filters.activityType === 'work_and_earn') {
            userQuery.$and.push({
                $or: [
                    { 'completedTasks.0': { $exists: true } },
                    { taskWalletBalance: { $gt: 0 } },
                    { taskEarningsBalance: { $gt: 0 } }
                ]
            });
        } else if (filters.activityType === 'investment') {
            userQuery.$and.push({
                $or: [
                    { 'activePlans.0': { $exists: true } },
                    { activePlan: { $nin: ['None', '', null] } }
                ]
            });
        }
    }

    return { userQuery, intersectedUserIds };
};

/**
 * Resolves the full list of matching users for a given audience filter set.
 * @param {Object} filters 
 * @param {Object} options 
 * @returns {Promise<Array<Object>>}
 */
export const resolveAudienceUsers = async (filters = {}, options = {}) => {
    const { userQuery } = await buildAudienceQuery(filters, options);
    const limit = options.limit || 0; // 0 = no limit

    let query = User.find(userQuery)
        .select('username fullName email phone whatsapp currency country status activePlan activePlans registrationDate walletBalance taskWalletBalance')
        .lean();

    if (limit > 0) {
        query = query.limit(limit);
    }

    return await query.exec();
};

/**
 * Gets audience count and statistical summary for instant preview before sending.
 * @param {Object} filters 
 * @param {Object} options 
 * @returns {Promise<{ eligibleCount: number, totalUsers: number, sampleUsers: Array<Object> }>}
 */
export const getAudienceCount = async (filters = {}, options = {}) => {
    const { userQuery } = await buildAudienceQuery(filters, options);
    const [eligibleCount, totalUsers, sampleUsers] = await Promise.all([
        User.countDocuments(userQuery),
        User.countDocuments(),
        User.find(userQuery)
            .select('username fullName email phone whatsapp currency country status activePlan')
            .limit(10)
            .lean()
    ]);

    return {
        eligibleCount,
        totalUsers,
        sampleUsers
    };
};
