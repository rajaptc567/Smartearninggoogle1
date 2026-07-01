import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; 
import { sendAutomatedMessage } from '../utils/automation.js';
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';
import jwt from 'jsonwebtoken';

const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];

const canReleaseCommission = async (commission, user, settings, allPlans) => {
    if (commission.status !== 'Pending') return false;
    let targetPlanId = commission.relatedPlanId ? String(commission.relatedPlanId) : null;
    if (!targetPlanId) return false;
    if (settings.oneTimeCommissionPerGroup) {
        const recurringPlanIds = settings.recurringCommissionPlanIds || [];
        const hasRecurringPlan = (user.activePlans || []).some(ap => recurringPlanIds.includes(String(ap.planId)));
        if (!hasRecurringPlan) {
            const alreadyReceived = await Transaction.findOne({
                userId: user._id, sourceUserId: commission.sourceUserId, type: 'Commission', status: 'Approved', _id: { $ne: commission._id }
            });
            if (alreadyReceived) {
                commission.status = 'Rejected';
                commission.description = `[Limit] One-time commission already received from @${commission.userName || 'referral'}.`;
                await commission.save();
                return false;
            }
        }
    }
    let equivIds = [targetPlanId];
    if (settings.planEquivalencyGroups) {
        const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === targetPlanId || String(g.pkrPlanId) === targetPlanId || String(g.eurPlanId) === targetPlanId);
        if (group) equivIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
    }
    const qualifyingActivePlan = (user.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
    if (settings.requirePlanMatchForCommission) {
        if (!qualifyingActivePlan) return false;
    } else if (settings.requireActivePlanForCommission) {
        if ((user.activePlans || []).length === 0) return false;
    }
    const planConfig = allPlans.find(p => p._id.toString() === String(qualifyingActivePlan?.planId));
    if (commission.level === 1 && qualifyingActivePlan && planConfig) {
        const limit = planConfig.directReferralLimit || 0;
        if (limit > 0) {
            const approvedCount = await Transaction.countDocuments({ userId: user._id, type: 'Commission', relatedPlanId: { $in: equivIds }, level: 1, status: 'Approved' });
            if (approvedCount >= limit) {
                commission.status = 'Rejected';
                commission.description = `[Overflow] Slot Limit reached for ${planConfig.name}.`;
                await commission.save();
                return false;
            }
        }
    }
    return true;
};

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
        if (settings.oneTimeCommissionPerGroup) {
            const recurringPlanIds = settings.recurringCommissionPlanIds || [];
            const hasRecurringPlan = (uplineUser.activePlans || []).some(ap => recurringPlanIds.includes(String(ap.planId)));
            if (!hasRecurringPlan) {
                const alreadyReceived = await Transaction.findOne({ userId: uplineUser._id, sourceUserId: referralId, type: 'Commission', status: 'Approved' });
                if (alreadyReceived) return { status: 'Rejected', message: `[Limit] One-time commission limit reached.` };
            }
        }
        const equivIds = [purchasePlanId.toString()];
        if (settings.planEquivalencyGroups) {
            const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === purchasePlanId.toString() || String(g.pkrPlanId) === purchasePlanId.toString() || String(g.eurPlanId) === purchasePlanId.toString());
            if (group) [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).forEach(id => equivIds.push(String(id)));
        }
        const qualifyingActivePlan = (uplineUser.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
        if (settings.requirePlanMatchForCommission) {
            if (!qualifyingActivePlan) return { status: 'Pending', message: `Commission Held! Equivalent plan required.` };
        } else if (settings.requireActivePlanForCommission) {
            if ((uplineUser.activePlans || []).length === 0) return { status: 'Pending', message: `Commission Held! Active plan required.` };
        }
        if (level === 1 && qualifyingActivePlan) {
            const planConfig = allPlans.find(p => p._id.toString() === String(qualifyingActivePlan.planId));
            const limit = planConfig?.directReferralLimit || 0;
            if (limit > 0) {
                const approvedCount = await Transaction.countDocuments({ userId: user._id, type: 'Commission', relatedPlanId: { $in: equivIds }, level: 1, status: 'Approved' });
                if (approvedCount >= limit) return { status: 'Rejected', message: `[Overflow] Slot Limit reached.` };
            }
        }
        return { status: 'Approved', message: '' };
    };
    const getSlotIndex = async (sponsorUsername, planId) => {
        const sponsor = await User.findOne({ username: sponsorUsername });
        if (!sponsor) return 0;
        let equivIds = [planId.toString()];
        if (settings.planEquivalencyGroups) {
            const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === planId.toString() || String(g.pkrPlanId) === planId.toString() || String(g.eurPlanId) === planId.toString());
            if (group) equivIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
        }
        const existingCount = await Transaction.countDocuments({ userId: sponsor._id, type: 'Commission', level: 1, relatedPlanId: { $in: equivIds }, status: { $in: ['Approved', 'Pending'] } });
        return existingCount;
    };
    let currentUplineUsername = user.sponsor;
    const totalCommissionLevels = 1 + (plan.indirectCommissions || []).length;
    let isPreviousUplineEligible = true;
    const firstSponsorUsername = user.sponsor;
    const slotIndexForStrategy = await getSlotIndex(firstSponsorUsername, plan._id);
    const directCommsArr = plan.directCommissions || [];
    const slotStrategy = directCommsArr[Math.min(slotIndexForStrategy, directCommsArr.length - 1)];
    for (let level = 0; level < totalCommissionLevels; level++) {
        if (!currentUplineUsername) break;
        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } });
        if (!uplineUser || uplineUser.status === 'Blocked') break;
        if (settings.requireUplineEligibility && level > 0 && !isPreviousUplineEligible) break;
        let commissionConfig;
        if (level === 0) commissionConfig = slotStrategy;
        else {
            const overrides = slotStrategy?.indirectOverrides || [];
            commissionConfig = overrides[level - 1] || plan.indirectCommissions[level - 1];
        }
        if (!commissionConfig || commissionConfig.enabled === false) { currentUplineUsername = uplineUser.sponsor; continue; }
        let eligibility = await checkInitialEligibility(uplineUser, plan._id, level + 1, user._id);
        isPreviousUplineEligible = (eligibility.status === 'Approved');
        const rawAmount = calculateAmount(commissionConfig, plan.price);
        if (rawAmount <= 0) { currentUplineUsername = uplineUser.sponsor; continue; }
        const finalAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);
        if (eligibility.status === 'Approved') {
            uplineUser.walletBalance = Number((uplineUser.walletBalance + finalAmount).toFixed(2));
            await uplineUser.save();
            await Notification.create({ userId: uplineUser._id, subject: 'Commission Received!', message: `You earned ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username}'s plan purchase.` });
            if (level === 0 && plan.directReferralLimit > 0) {
                const equivIds = [plan._id.toString()];
                if (settings.planEquivalencyGroups) {
                    const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === plan._id.toString() || String(g.pkrPlanId) === plan._id.toString() || String(g.eurPlanId) === plan._id.toString());
                    if (group) [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).forEach(id => equivIds.push(String(id)));
                }
                const approvedCount = await Transaction.countDocuments({ userId: uplineUser._id, type: 'Commission', relatedPlanId: { $in: equivIds }, level: 1, status: 'Approved' });
                if (approvedCount === plan.directReferralLimit) {
                    const admin = await User.findOne({ username: 'admin' });
                    if (admin) await Notification.create({ userId: admin._id, subject: '⚠️ Slot Limit Reached', message: `User @${uplineUser.username} filled slots for ${plan.name}.`, isPopup: true });
                    await Notification.create({ userId: uplineUser._id, subject: '⚠️ Slot Limit Reached!', message: `Slots for ${plan.name} are now FULL.`, isPopup: true });
                }
            }
        } else if (eligibility.status === 'Rejected') {
            const isLimitRejected = eligibility.message.includes('[Limit]');
            if (!isLimitRejected || (isLimitRejected && settings.notifySponsorOnCommissionLimit)) {
                await Notification.create({ userId: uplineUser._id, subject: 'Commission Missed', message: `${eligibility.message} commission of ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username} was lost.`, isPopup: level === 0 });
            }
        } else if (eligibility.status === 'Pending') {
            await Notification.create({ userId: uplineUser._id, subject: 'Commission Locked 🔐', message: `A commission of ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username} has been held.` });
        }
        const isLimitRejectedTx = eligibility.status === 'Rejected' && eligibility.message.includes('[Limit]');
        if (!isLimitRejectedTx || (isLimitRejectedTx && settings.showRejectedCommissionTransaction)) {
            await Transaction.create({ userId: uplineUser._id, userName: uplineUser.username, currency: uplineUser.currency, type: 'Commission', amount: finalAmount, level: level + 1, sourceUserId: user._id, description: eligibility.message || `Commission from ${user.username} (L${level + 1})`, status: eligibility.status, relatedPlanId: plan._id });
        }
        currentUplineUsername = uplineUser.sponsor;
    }
};

export const getUsers = async (req, res) => {
    try {
        let users;
        const isMasterAdmin = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMasterAdmin || req.user?.role === 'admin';

        if (isAdmin) {
            users = await User.find();
        } else if (req.user) {
            const results = await User.aggregate([
                { 
                    $match: { email: req.user.email } 
                },
                {
                    $graphLookup: {
                        from: 'users',
                        startWith: '$username',
                        connectFromField: 'username',
                        connectToField: 'sponsor',
                        as: 'downline'
                    }
                }
            ]);

            if (results.length > 0) {
                users = [results[0], ...results[0].downline];
            } else {
                users = [];
            }
        } else {
            users = [];
        }
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) { res.status(200).json({ success: false, data: [], error: err.message }); }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(200).json({ success: false, data: {} });

        const loggedInUserId = req.user?.id;
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';

        if (!isAdmin && String(loggedInUserId) !== String(user._id)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot access other users profiles.' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(200).json({ success: false, data: {} }); }
};

export const createUser = async (req, res) => {
    try {
        const { fullName, username, email, password, phone, sponsor, country } = req.body;
        if (!country) return res.status(400).json({ success: false, error: 'Country is required.' });
        let sponsorUser = null;
        if (sponsor) {
            sponsorUser = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorUser) return res.status(400).json({ success: false, error: `Sponsor '${sponsor}' not found.` });
            req.body.sponsor = sponsorUser.username;
        }
        req.body.currency = country.toLowerCase() === 'pakistan' ? 'PKR' : (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase()) ? 'EUR' : 'USD');
        req.body.activePlans = [];
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, loginBlocked: false, purchaseBlocked: false };
        const user = await User.create(req.body);
        if (sponsorUser) await Notification.create({ userId: sponsorUser._id, subject: 'New Team Member!', message: `Great news! @${user.username} has joined your network.` });
        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.username}!` });
        
        // Automated welcome notifications
        const settings = await Setting.getSettings();
        if (settings && settings.autoWelcomeEnabled) {
            const welcomeMsg = `Hello ${user.fullName || user.username || 'User'},\n\nWelcome to SmartEarning! Your account has been registered successfully.\n\nUsername: ${user.username}\nEmail: ${user.email}\nSponsor: ${user.sponsor || 'None'}\n\nWe are excited to have you on board. Start growing your network and earning today!\n\nBest Regards,\nSmartEarning Team`;
            sendAutomatedMessage({
                toEmail: user.email,
                toPhone: user.whatsapp || user.phone,
                subject: 'Welcome to SmartEarning!',
                messageText: welcomeMsg
            });
        }

        res.status(201).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const inputVal = email ? String(email).trim() : '';
        const user = await User.findOne({
            $or: [
                { email: { $regex: new RegExp(`^${inputVal}$`, 'i') } },
                { username: { $regex: new RegExp(`^${inputVal}$`, 'i') } }
            ]
        }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked' || user.restrictions?.loginBlocked) return res.status(403).json({ success: false, error: 'Account restricted.' });
        
        const token = jwt.sign({ id: user._id, role: user.role || 'user', email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        
        res.status(200).json({ success: true, token, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });

        // SECURITY: Verify that logged-in user matches target user, or is an admin
        const loggedInUserId = req.user?.id;
        const targetUserId = req.params.id;
        const isMasterAdmin = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com' || req.user?.email === 'smartexn.com@gmail.com';
        const isAdmin = isMasterAdmin || req.user?.role === 'admin' || req.user?.role === 'finance' || req.user?.role === 'support';

        if (!isAdmin && String(loggedInUserId) !== String(targetUserId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot update other users profiles.' });
        }

        // SECURITY: Role-aware field whitelisting
        
        // Fields standard users are allowed to modify
        const userWhitelist = ['fullName', 'email', 'phone', 'whatsapp', 'country'];
        
        // Fields admins are allowed to modify via this specific endpoint
        const adminWhitelist = [...userWhitelist, 'status', 'restrictions', 'role', 'activePlans', 'walletBalance', 'sponsor'];

        const allowedFields = isAdmin ? adminWhitelist : userWhitelist;
        
        const filteredUpdate = {};
        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) {
                // Additional protection: Only Super Admin can promote someone to Super Admin
                if (key === 'role' && req.body[key] === 'super_admin' && !isMasterAdmin) {
                    return;
                }
                filteredUpdate[key] = req.body[key];
            }
        });

        if (filteredUpdate.status && filteredUpdate.status !== userToUpdate.status) {
            await Notification.create({ 
                userId: userToUpdate._id, 
                subject: 'Account Status Updated', 
                message: `Your status changed to: ${filteredUpdate.status}.`, 
                isPopup: true 
            });
        }

        // Apply filtered updates instead of raw req.body
        Object.assign(userToUpdate, filteredUpdate);
        let updatedUser = await userToUpdate.save();

        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`;
                await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, subject: 'Commission Unlocked 🔓', message: `Success! ${updatedUser.currency}${releasedAmount.toFixed(2)} in commissions released.` });
        }
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
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
                comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`;
                await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, subject: 'Commission Unlocked 🔓', message: `Released ${updatedUser.currency}${releasedAmount.toFixed(2)}.` });
        }
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const loggedInUserId = req.user?.id;
        const targetUserId = req.params.id;
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com' || req.user?.email === 'smartexn.com@gmail.com';

        if (!isAdmin && String(loggedInUserId) !== String(targetUserId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot purchase plan on behalf of other users.' });
        }

        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        if (user.restrictions?.purchaseBlocked) return res.status(403).json({ success: false, error: 'Purchases disabled.' });
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
                comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`;
                await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, subject: 'Commission Unlocked 🔓', message: `Released ${updatedUser.currency}${releasedAmount.toFixed(2)}.` });
        }
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        let query = {};
        if (targetType === 'plan') query = { 'activePlans.planId': { $in: targetIds } };
        else if (targetType === 'single') query = { _id: { $in: targetIds } };
        const usersToUpdate = await User.find(query);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        for (const user of usersToUpdate) {
            let cur = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, loginBlocked: false, purchaseBlocked: false };
            let changed = false; let checkRel = false;
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    let newVal = action === 'enable' ? true : action === 'disable' ? false : !cur[key];
                    if (cur[key] !== newVal) { if (key === 'earning' && cur.earning === true && newVal === false) checkRel = true; cur[key] = newVal; changed = true; }
                }
            }
            if (changed) {
                user.restrictions = cur;
                if (checkRel) {
                    const pending = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
                    let rel = 0;
                    for (const comm of pending) { if (await canReleaseCommission(comm, user, settings, allPlans)) { comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`; await comm.save(); rel += comm.amount; } }
                    if (rel > 0) { user.walletBalance = Number((user.walletBalance + rel).toFixed(2)); await Notification.create({ userId: user._id, subject: 'Commission Unlocked 🔓', message: `Released ${user.currency}${rel.toFixed(2)}.` }); }
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
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const { amount, description } = req.body;
        user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
        await user.save();
        await Notification.create({ userId: user._id, subject: 'Wallet Adjusted', message: `Admin adjusted balance by ${user.currency}${Math.abs(amount)}.` });
        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: amount, description: description || 'Admin manual adjustment', status: 'Approved' });
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, sponsor, balance, country, currency, usernames } = req.body;
        const s = await User.findOne({ username: sponsor });
        if (!s) return res.status(404).json({ success: false, error: 'Sponsor not found' });
        const createOne = async (uname) => {
            const existing = await User.findOne({ username: uname });
            if (existing) return; 
            await User.create({ fullName: `Dummy ${uname}`, username: uname, email: `${uname}@test-${Math.floor(Math.random() * 1000)}.com`, password: 'password123', phone: '000000', country, currency, walletBalance: balance, sponsor: s.username });
        };
        if (usernames && Array.isArray(usernames) && usernames.length > 0) {
            for (const uname of usernames) { if (uname.trim()) await createOne(uname.trim()); }
        } else {
            const iterations = parseInt(count) || 0;
            for (let i = 0; i < iterations; i++) { const suf = Math.floor(1000 + Math.random() * 9000); await createOne(`user_${suf}`); }
        }
        res.status(201).json({ success: true, message: 'Process completed' });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const emailInput = req.body?.email ? String(req.body.email).trim() : '';
        const user = await User.findOne({ email: { $regex: new RegExp(`^${emailInput}$`, 'i') } });
        if (user) {
            // Create a default password reset request log
            const resetRequest = await PasswordResetRequest.create({ 
                userId: user._id, 
                userEmail: user.email, 
                userName: user.username,
                process: 'User submitted request; awaiting admin response',
                sendType: 'None',
                channel: 'None',
                status: 'Pending'
            });

            // Create system bell notification for admin
            try {
                const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
                const notificationMsg = `User @${user.username} (${user.email}) requested a password reset.`;
                if (admins.length > 0) {
                    for (const admin of admins) {
                        await Notification.create({
                            userId: admin._id,
                            senderType: 'System',
                            subject: 'Password Reset Request',
                            message: notificationMsg,
                            isPopup: false
                        });
                    }
                } else {
                    // Fallback to creating a notification for the requesting user itself
                    // (since admin retrieves all notifications with query = {}, this works perfectly too)
                    await Notification.create({
                        userId: user._id,
                        senderType: 'System',
                        subject: 'Password Reset Request',
                        message: notificationMsg,
                        isPopup: false
                    });
                }
            } catch (notifErr) {
                console.error('Failed to dispatch password reset admin notifications:', notifErr);
            }

            req.app.get('io')?.emit('DATA_CHANGED');
            
            // Automatic Password Reset handling wrapped in localized try-catch so it won't crash DB writes
            try {
                const settings = await Setting.getSettings();
                if (settings && settings.autoPasswordResetEnabled) {
                    const resetToken = randomBytes(20).toString('hex');
                    user.passwordResetToken = createHash('sha256').update(resetToken).digest('hex');
                    user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
                    await user.save();

                    const origin = req.get('origin') || `https://${req.get('host')}`;
                    const link = `${origin}/#/reset-password?token=${resetToken}`;
                    
                    const resetMsg = `Hello ${user.fullName || user.username || 'User'},\n\nWe received a request to reset your password on SmartEarning. Here is your secure, single-use link to reset your password. This link is valid for 48 hours:\n\n${link}\n\nIf you did not request this, you can safely ignore this message.\n\nBest Regards,\nSmartEarning Support`;

                    await sendAutomatedMessage({
                        toEmail: user.email,
                        toPhone: user.whatsapp || user.phone,
                        subject: 'Password Reset Request - SmartEarning',
                        messageText: resetMsg,
                        forceEmail: true,
                        forceWhatsApp: true
                    });

                    // Update request details as auto-sent
                    resetRequest.process = 'Auto-sent reset link to user';
                    resetRequest.sendType = 'Automatic';
                    resetRequest.channel = 'Email & WhatsApp';
                    resetRequest.sentAt = new Date();
                    resetRequest.resetLink = link;
                    resetRequest.resetToken = resetToken;
                    await resetRequest.save();
                }
            } catch (autoErr) {
                console.error('Automation failed during userRequestPasswordReset:', autoErr);
            }
            req.app.get('io')?.emit('DATA_CHANGED');
        } else {
            console.warn(`userRequestPasswordReset: No registered user found for email "${emailInput}"`);
        }
        res.status(200).json({ success: true, data: 'Admin notified.' });
    } catch (err) {
        console.error('Error in userRequestPasswordReset:', err);
        res.status(200).json({ success: true }); // Prevent enumeration but handle gracefully
    }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const resetToken = randomBytes(20).toString('hex');
        user.passwordResetToken = createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
        await user.save();

        req.app.get('io')?.emit('DATA_CHANGED');

        // Also trigger automatic send if enabled, wrapped in localized try-catch so it won't crash DB write
        try {
            const settings = await Setting.getSettings();
            if (settings && (settings.emailAutomationEnabled || settings.whatsappAutomationEnabled)) {
                const origin = req.get('origin') || `https://${req.get('host')}`;
                const link = `${origin}/#/reset-password?token=${resetToken}`;
                const resetMsg = `Hello ${user.fullName || user.username || 'User'},\n\nHere is your secure link to reset your password on SmartEarning. This link is valid for 48 hours:\n\n${link}\n\nRegards,\nSmartEarning Support`;
                
                // Dispatched asynchronously in background so link is generated instantly
                sendAutomatedMessage({
                    toEmail: user.email,
                    toPhone: user.whatsapp || user.phone,
                    subject: 'Password Reset Request - SmartEarning',
                    messageText: resetMsg,
                    forceEmail: true,
                    forceWhatsApp: true
                }).catch(autoErr => {
                    console.error('Automation background send failed during adminInitiatePasswordReset:', autoErr);
                });
            }
        } catch (autoErr) {
            console.error('Automation failed during adminInitiatePasswordReset:', autoErr);
        }

        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) { 
        console.error('Error in adminInitiatePasswordReset:', err);
        res.status(500).json({ success: false, error: err.message }); 
    }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const hashedToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(404).json({ success: false, error: 'Your password reset link is invalid or has expired. Please request a new link.' });
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message || 'Server error verifying reset token.' }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const hashedToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Your password reset link has expired or is invalid. Please request a new one.' });
        user.password = req.body.password;
        user.passwordResetToken = undefined; user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message || 'Server error during password reset.' }); }
};

export const sendCustomAdminMessage = async (req, res) => {
    try {
        const { toEmail, toPhone, subject, messageText } = req.body;
        await sendAutomatedMessage({
            toEmail,
            toPhone,
            subject: subject || 'Message - SmartEarning',
            messageText,
            forceEmail: true,
            forceWhatsApp: true
        });
        res.status(200).json({ success: true, message: 'Message sent successfully.' });
    } catch (err) {
        console.error('sendCustomAdminMessage failed:', err);
        res.status(400).json({ success: false, error: err.message });
    }
};