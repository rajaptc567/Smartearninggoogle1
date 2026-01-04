
import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; 
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';

const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];

/**
 * Helper: Checks if a held commission can be released.
 * Enforces: Plan Ownership, Direct Referral Limits, and One-Time Rules.
 */
const canReleaseCommission = async (commission, user, settings, allPlans) => {
    if (commission.status !== 'Pending') return false;

    let targetPlanId = commission.relatedPlanId ? String(commission.relatedPlanId) : null;
    if (!targetPlanId) return false;

    // --- 1. ONE-TIME COMMISSION CHECK ---
    if (settings.oneTimeCommissionPerGroup) {
        const recurringPlanIds = settings.recurringCommissionPlanIds || [];
        const hasRecurringPlan = (user.activePlans || []).some(ap => recurringPlanIds.includes(String(ap.planId)));

        if (!hasRecurringPlan) {
            const alreadyReceived = await Transaction.findOne({
                userId: user._id,
                sourceUserId: commission.sourceUserId,
                type: 'Commission',
                status: 'Approved',
                _id: { $ne: commission._id }
            });

            if (alreadyReceived) {
                commission.status = 'Rejected';
                commission.description = `[Limit] One-time commission already received from @${commission.userName || 'referral'}.`;
                await commission.save();
                return false;
            }
        }
    }

    // Determine equivalency group IDs
    let equivIds = [targetPlanId];
    if (settings.planEquivalencyGroups) {
        const group = (settings.planEquivalencyGroups || []).find(g => 
            String(g.usdPlanId) === targetPlanId ||
            String(g.pkrPlanId) === targetPlanId || 
            String(g.eurPlanId) === targetPlanId
        );
        if (group) {
            equivIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
        }
    }

    // 2. Eligibility Check (Ownership)
    const sponsorActivePlanIds = (user.activePlans || []).map(p => String(p.planId));
    const qualifyingActivePlan = (user.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));

    if (settings.requirePlanMatchForCommission) {
        if (!qualifyingActivePlan) return false;
    } else if (settings.requireActivePlanForCommission) {
        if (sponsorActivePlanIds.length === 0) return false;
    }

    // 3. Direct Referral Limit Check (Level 1 only)
    if (commission.level === 1 && qualifyingActivePlan) {
        const planConfig = allPlans.find(p => p._id.toString() === String(qualifyingActivePlan.planId));
        const limit = planConfig?.directReferralLimit || 0;

        if (limit > 0) {
            const approvedCount = await Transaction.countDocuments({
                userId: user._id,
                type: 'Commission',
                relatedPlanId: { $in: equivIds },
                level: 1,
                status: 'Approved'
            });

            if (approvedCount >= limit) {
                commission.status = 'Rejected';
                commission.description = `[Overflow] Slot Limit (${limit}) reached for ${planConfig.name}.`;
                await commission.save();
                
                // Only notify for Level 1
                await Notification.create({
                    userId: user._id,
                    subject: 'Slot Limit Reached',
                    message: `Held commission from ${commission.userName} overflowed because your slots for ${planConfig.name} are full. Note: You can still earn from this referral when a slot is available in any higher plan and your referral buys that plan, then you get commission.`,
                    isPopup: true
                });
                return false;
            }
        }
    }

    return true;
};

/**
 * Distributes commissions up the sponsor chain.
 */
const distributeCommissions = async (user, plan, settings, exchangeRates, defaultRates, allPlans) => {
    if (!user.sponsor) return;

    const convertCurrency = (amount, from, to) => {
        if (!from || !to) return amount;
        const fromKey = from.toUpperCase(); const toKey = to.toUpperCase();
        if (fromKey === toKey) return Number(amount.toFixed(2));
        const getRate = (curr) => { const r = exchangeRates[curr]; if (r !== undefined && r !== null && r !== 0) return r; return defaultRates[curr] || 1; };
        const fromRate = getRate(fromKey); const toRate = getRate(toKey);
        if (fromRate === 0) return 0;
        return Number(((amount / fromRate) * toRate).toFixed(2));
    };

    const calculateAmount = (commissionConfig, planPrice) => {
        if (!commissionConfig) return 0;
        const value = parseFloat(commissionConfig.value);
        return commissionConfig.type === 'percentage' ? (planPrice * value) / 100 : value;
    };

    const checkInitialEligibility = async (uplineUser, purchasePlanId, level, referralId) => {
        if (uplineUser.restrictions?.earning) return { status: 'Pending', message: `Commission Held! Earnings paused.` };

        // --- 1. ONE-TIME COMMISSION CHECK (ALL LEVELS) ---
        if (settings.oneTimeCommissionPerGroup) {
            const recurringPlanIds = settings.recurringCommissionPlanIds || [];
            const hasRecurringPlan = (uplineUser.activePlans || []).some(ap => recurringPlanIds.includes(String(ap.planId)));

            if (!hasRecurringPlan) {
                const alreadyReceived = await Transaction.findOne({
                    userId: uplineUser._id,
                    sourceUserId: referralId,
                    type: 'Commission',
                    status: 'Approved'
                });

                if (alreadyReceived) {
                    return { 
                        status: 'Rejected', 
                        message: `[Limit] One-time commission limit reached for this referral.` 
                    };
                }
            }
        }

        const equivIds = [purchasePlanId.toString()];
        if (settings.planEquivalencyGroups) {
            const group = (settings.planEquivalencyGroups || []).find(g => 
                String(g.usdPlanId) === purchasePlanId.toString() || 
                String(g.pkrPlanId) === purchasePlanId.toString() || 
                String(g.eurPlanId) === purchasePlanId.toString()
            );
            if (group) {
                [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).forEach(id => equivIds.push(String(id)));
            }
        }

        const qualifyingActivePlan = (uplineUser.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));

        // 2. Ownership Check
        if (settings.requirePlanMatchForCommission) {
            if (!qualifyingActivePlan) return { status: 'Pending', message: `Commission Held! Equivalent plan required.` };
        } else if (settings.requireActivePlanForCommission) {
            if ((uplineUser.activePlans || []).length === 0) return { status: 'Pending', message: `Commission Held! Active plan required.` };
        }

        // 3. Direct Referral Limit Check (L1)
        if (level === 1 && qualifyingActivePlan) {
            const planConfig = allPlans.find(p => p._id.toString() === String(qualifyingActivePlan.planId));
            const limit = planConfig?.directReferralLimit || 0;

            if (limit > 0) {
                const approvedCount = await Transaction.countDocuments({
                    userId: uplineUser._id,
                    type: 'Commission',
                    relatedPlanId: { $in: equivIds },
                    level: 1,
                    status: 'Approved'
                });

                if (approvedCount >= limit) {
                    return { 
                        status: 'Rejected', 
                        message: `[Overflow] Slot Limit (${limit}) reached for ${planConfig.name}.` 
                    };
                }
            }
        }

        return { status: 'Approved', message: '' };
    };

    let currentUplineUsername = user.sponsor;
    const totalCommissionLevels = 1 + (plan.indirectCommissions || []).length;
    let isPreviousUplineEligible = true;

    for (let level = 0; level < totalCommissionLevels; level++) {
        if (!currentUplineUsername) break;
        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } });
        if (!uplineUser || uplineUser.status === 'Blocked') break;

        if (settings.requireUplineEligibility && level > 0 && !isPreviousUplineEligible) break;

        let eligibility = await checkInitialEligibility(uplineUser, plan._id, level + 1, user._id);
        isPreviousUplineEligible = (eligibility.status === 'Approved');

        // --- IMPROVED COMMISSION CONFIG SELECTION ---
        let commissionConfig;
        if (level === 0) {
            // Direct Referral Logic: Select based on slot index
            const directComms = plan.directCommissions || [];
            if (directComms.length === 0) {
                commissionConfig = { type: 'percentage', value: 0 };
            } else {
                // Determine equivalency group IDs for counting slots
                let targetPlanId = plan._id.toString();
                let equivIds = [targetPlanId];
                if (settings.planEquivalencyGroups) {
                    const group = (settings.planEquivalencyGroups || []).find(g => 
                        String(g.usdPlanId) === targetPlanId ||
                        String(g.pkrPlanId) === targetPlanId || 
                        String(g.eurPlanId) === targetPlanId
                    );
                    if (group) {
                        equivIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
                    }
                }

                // Count how many Level 1 commissions this sponsor has ALREADY received for this plan group
                const existingSlotCount = await Transaction.countDocuments({
                    userId: uplineUser._id,
                    type: 'Commission',
                    level: 1,
                    relatedPlanId: { $in: equivIds },
                    status: { $in: ['Approved', 'Pending'] }
                });

                // Use the slot count as index. If count is 0, gets index 0 (1st ref). 
                // Cap at the last element if count exceeds defined list.
                const slotIndex = Math.min(existingSlotCount, directComms.length - 1);
                commissionConfig = directComms[slotIndex];
            }
        } else {
            // Indirect logic (standard leveling)
            commissionConfig = (plan.indirectCommissions || [])[level - 1];
        }

        if (!commissionConfig) break;

        const rawAmount = calculateAmount(commissionConfig, plan.price);
        if (rawAmount <= 0) { currentUplineUsername = uplineUser.sponsor; continue; }

        const finalAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);

        if (eligibility.status === 'Approved') {
            uplineUser.walletBalance = Number((uplineUser.walletBalance + finalAmount).toFixed(2));
            await uplineUser.save();
        } else if (eligibility.status === 'Rejected') {
            const isOneTimeHit = eligibility.message.includes('[Limit]');
            const isDirect = (level === 0);

            if (isOneTimeHit && isDirect) {
                // Fetch recurring plan names for the notification
                const recurringPlanIds = settings.recurringCommissionPlanIds || [];
                const recurringPlanNames = allPlans
                    .filter(p => recurringPlanIds.includes(p._id.toString()))
                    .map(p => p.name)
                    .join(', ');

                await Notification.create({
                    userId: uplineUser._id,
                    subject: 'One-Time Limit Reached',
                    message: `Commission of ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username} was lost. Plz update or join recurring plan (${recurringPlanNames || 'Available Recurring Plans'}) to get repeated Commission everytime your ref upgrade or join more plans.`,
                    isPopup: true
                });
            } else if (!isOneTimeHit || isDirect) {
                let note = '';
                if (eligibility.message.includes('[Overflow]')) {
                    note = ' Note: You can still earn from this referral when a slot is available in any higher plan and your referral buys that plan, then you get commission.';
                }

                await Notification.create({
                    userId: uplineUser._id,
                    subject: 'Commission Missed',
                    message: `${eligibility.message.replace('[Limit] ', '').replace('[Overflow] ', '')} Commission of ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username} was lost.${note}`,
                    isPopup: isDirect
                });
            }
        }

        await Transaction.create({
            userId: uplineUser._id, userName: uplineUser.username, currency: uplineUser.currency, 
            type: 'Commission', amount: finalAmount, level: level + 1, sourceUserId: user._id, 
            description: eligibility.message || `Commission from ${user.username} (L${level + 1})`, 
            status: eligibility.status, relatedPlanId: plan._id
        });

        currentUplineUsername = uplineUser.sponsor;
    }
};

// @desc    Register a new user
export const createUser = async (req, res, next) => {
    try {
        const { fullName, username, email, password, phone, sponsor, country } = req.body;
        if (!country) return res.status(400).json({ success: false, error: 'Country is a required field.' });
        if (sponsor) {
            const sponsorExists = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorExists) return res.status(400).json({ success: false, error: `Sponsor with username '${sponsor}' not found.` });
            req.body.sponsor = sponsorExists.username;
        }
        let currency = country.toLowerCase() === 'pakistan' ? 'PKR' : (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase()) ? 'EUR' : 'USD');
        req.body.currency = currency;
        req.body.activePlans = [];
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
        const user = await User.create(req.body);
        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.fullName}! Account created.` });
        const userResponse = user.toObject(); delete userResponse.password;
        res.status(201).json({ success: true, data: userResponse });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

// @desc    Auth user
export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked' || user.restrictions?.login) return res.status(403).json({ success: false, error: 'Account restricted.' });
        const userResponse = user.toObject(); delete userResponse.password;
        res.status(200).json({ success: true, data: userResponse });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        Object.assign(userToUpdate, req.body);
        let updatedUser = await userToUpdate.save();
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, message: `Profile update released ${updatedUser.currency}${releasedAmount.toFixed(2)} in held commissions.` });
        }
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        let updatedUser = await user.save();
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, message: `Activation of ${plan.name} released ${updatedUser.currency}${releasedAmount.toFixed(2)} in held commissions.` });
        }
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        let updatedUser = await user.save();
        await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', amount: -plan.price, description: `Purchased ${plan.name} plan`, status: 'Approved' });
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, message: `Purchase of ${plan.name} released ${updatedUser.currency}${releasedAmount.toFixed(2)} in held commissions.` });
        }
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        let query = {};
        if (targetType === 'all') query = {};
        else if (targetType === 'plan') query = { 'activePlans.planId': { $in: targetIds } };
        else if (targetType === 'single') query = { _id: { $in: targetIds } };
        const usersToUpdate = await User.find(query);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        for (const user of usersToUpdate) {
            let currentRestrictions = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
            let hasChange = false;
            let shouldCheckRelease = false;
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    let newValue = action === 'enable' ? true : action === 'disable' ? false : !currentRestrictions[key];
                    if (currentRestrictions[key] !== newValue) {
                        if (key === 'earning' && currentRestrictions.earning === true && newValue === false) shouldCheckRelease = true;
                        currentRestrictions[key] = newValue; hasChange = true;
                    }
                }
            }
            if (hasChange) {
                user.restrictions = currentRestrictions;
                if (shouldCheckRelease) {
                    const pendingCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
                    let releasedAmount = 0;
                    for (const comm of pendingCommissions) {
                       if (await canReleaseCommission(comm, user, settings, allPlans)) {
                            comm.status = 'Approved'; await comm.save(); releasedAmount += comm.amount;
                        }
                    }
                    if (releasedAmount > 0) user.walletBalance = Number((user.walletBalance + releasedAmount).toFixed(2));
                }
                await user.save();
            }
        }
        res.status(200).json({ success: true, message: `Bulk updated users.` });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        await Deposit.deleteMany({ userId: { $in: ids } });
        await Withdrawal.deleteMany({ userId: { $in: ids } });
        await Transaction.deleteMany({ userId: { $in: ids } });
        await Notification.deleteMany({ userId: { $in: ids } });
        await Transfer.deleteMany({ $or: [{ senderId: { $in: ids } }, { recipientId: { $in: ids } }] });
        await User.deleteMany({ _id: { $in: ids } });
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        await Deposit.deleteMany({ userId: user._id });
        await Withdrawal.deleteMany({ userId: user._id });
        await Transaction.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    const { amount, description } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
        const updatedUser = await user.save();
        const transaction = await Transaction.create({
            userId: updatedUser._id, userName: updatedUser.username, currency: updatedUser.currency, 
            type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: amount, 
            description: description || 'Admin manual adjustment', status: 'Approved'
        });
        await Notification.create({ userId: updatedUser._id, message: `Admin adjusted balance by ${updatedUser.currency}${amount}.` });
        res.status(200).json({ success: true, data: { user: updatedUser, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, sponsor, balance, country, currency, planId } = req.body;
        const sponsorUser = await User.findOne({ username: sponsor });
        if (!sponsorUser) return res.status(404).json({ success: false, error: 'Sponsor not found' });
        for (let i = 0; i < count; i++) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            await User.create({ fullName: `Dummy User ${randomSuffix}`, username: `user_${randomSuffix}`, email: `user_${randomSuffix}@test.com`, password: 'password123', phone: '000000', country, currency, walletBalance: balance, sponsor: sponsorUser.username });
        }
        res.status(201).json({ success: true, message: 'Created dummy users' });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (email) => {
    const { email: emailInput } = req.body;
    try {
        const user = await User.findOne({ email: emailInput });
        if (!user) return res.status(200).json({ success: true, data: 'Admin notified.' });
        await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true, data: 'Sent to admin.' });
    } catch (err) { res.status(200).json({ success: true }); }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const resetToken = randomBytes(20).toString('hex');
        user.passwordResetToken = createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
        await user.save();
        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const hashedToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(404).json({ success: false, error: 'Invalid token.' });
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const hashedToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token.' });
        user.password = req.body.password;
        user.passwordResetToken = undefined; user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};
