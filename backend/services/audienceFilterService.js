import mongoose from 'mongoose';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import Deposit from '../models/Deposit.js';
import Transaction from '../models/Transaction.js';

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
        userQuery.$or = [
            { phone: { $exists: true, $ne: '' } },
            { whatsapp: { $exists: true, $ne: '' } }
        ];
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
                ],
                $or: [
                    { activePlans: { $size: 0 } },
                    { activePlans: { $exists: false } }
                ]
            });
        } else if (filters.planStatus === 'specific_plan' && filters.specificPlanId) {
            userQuery.$and = userQuery.$and || [];
            const planIdOrName = filters.specificPlanId;
            const isObjectId = mongoose.Types.ObjectId.isValid(planIdOrName);
            const orConditions = [{ activePlan: planIdOrName }];
            if (isObjectId) {
                orConditions.push({ 'activePlans.planId': new mongoose.Types.ObjectId(planIdOrName) });
            }
            userQuery.$and.push({ $or: orConditions });
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
        userQuery.$or = userQuery.$or || [];
        userQuery.$or.push({ emailVerified: false }, { emailVerified: { $exists: false } });
    }

    if (filters.whatsappVerified === 'verified' || filters.whatsappVerified === true || filters.whatsappVerified === 'true') {
        userQuery.whatsappVerified = true;
    } else if (filters.whatsappVerified === 'unverified' || filters.whatsappVerified === false || filters.whatsappVerified === 'false') {
        userQuery.$or = userQuery.$or || [];
        userQuery.$or.push({ whatsappVerified: false }, { whatsappVerified: { $exists: false } });
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
        if (userQuery.$or) {
            userQuery.$and = userQuery.$and || [];
            userQuery.$and.push({ $or: searchConditions });
        } else {
            userQuery.$or = searchConditions;
        }
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
            if (filters.payoutStatus === 'first_payout') {
                targetUserIds = Array.from(payoutCounts.entries())
                    .filter(([_, count]) => count === 1)
                    .map(([id]) => id);
            } else if (filters.payoutStatus === 'second_payout') {
                targetUserIds = Array.from(payoutCounts.entries())
                    .filter(([_, count]) => count === 2)
                    .map(([id]) => id);
            } else if (filters.payoutStatus === 'three_plus_payouts') {
                targetUserIds = Array.from(payoutCounts.entries())
                    .filter(([_, count]) => count >= 3)
                    .map(([id]) => id);
            }

            const validTargetObjectIds = targetUserIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
            userQuery.$and = userQuery.$and || [];
            userQuery.$and.push({ _id: { $in: validTargetObjectIds } });
        }
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
