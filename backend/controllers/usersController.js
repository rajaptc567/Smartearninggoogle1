
import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; 
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';

const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET missing');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

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
                const approvedCount = await Transaction.countDocuments({ userId: uplineUser._id, type: 'Commission', relatedPlanId: { $in: equivIds }, level: 1, status: 'Approved' });
                if (approvedCount >= limit) return { status: 'Rejected', message: `[Overflow] Slot Limit reached.` };
            }
        }
        return { status: 'Approved', message: '' };
    };

    let currentUplineUsername = user.sponsor;
    const totalCommissionLevels = 1 + (plan.indirectCommissions || []).length;
    let isPreviousUplineEligible = true;
    
    // Determine which slot index this user is for the sponsor to decide overriding commissions
    const firstSponsor = await User.findOne({ username: user.sponsor });
    let slotIndexForStrategy = 0;
    if (firstSponsor) {
        slotIndexForStrategy = await Transaction.countDocuments({ userId: firstSponsor._id, type: 'Commission', level: 1, relatedPlanId: plan._id, status: { $in: ['Approved', 'Pending'] } });
    }

    const directCommsArr = plan.directCommissions || [];
    const slotStrategy = directCommsArr[Math.min(slotIndexForStrategy, directCommsArr.length - 1)];

    for (let level = 0; level < totalCommissionLevels; level++) {
        if (!currentUplineUsername) break;
        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } });
        if (!uplineUser || uplineUser.status === 'Blocked') break;
        if (settings.requireUplineEligibility && level > 0 && !isPreviousUplineEligible) break;

        let commissionConfig;
        if (level === 0) {
            commissionConfig = slotStrategy;
        } else {
            const overrides = slotStrategy?.indirectOverrides || [];
            commissionConfig = overrides[level - 1] || plan.indirectCommissions[level - 1];
        }

        if (!commissionConfig || commissionConfig.enabled === false) {
            currentUplineUsername = uplineUser.sponsor;
            continue; 
        }

        let eligibility = await checkInitialEligibility(uplineUser, plan._id, level + 1, user._id);
        isPreviousUplineEligible = (eligibility.status === 'Approved');

        const rawAmount = calculateAmount(commissionConfig, plan.price);
        if (rawAmount <= 0) { currentUplineUsername = uplineUser.sponsor; continue; }
        const finalAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);

        if (eligibility.status === 'Approved') {
            uplineUser.walletBalance = Number((uplineUser.walletBalance + finalAmount).toFixed(2));
            await uplineUser.save();
            await Notification.create({ userId: uplineUser._id, subject: 'Commission Received!', message: `You earned ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username}'s plan purchase.` });
        } else if (eligibility.status === 'Pending') {
            await Notification.create({ userId: uplineUser._id, subject: 'Commission Locked 🔐', message: `A commission has been held. Reason: ${eligibility.message}` });
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

export const createUser = async (req, res) => {
    try {
        const { country, sponsor } = req.body;
        if (!country) return res.status(400).json({ success: false, error: 'Country is required.' });
        
        if (sponsor) {
            const sponsorUser = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorUser) return res.status(400).json({ success: false, error: `Sponsor '${sponsor}' not found.` });
            req.body.sponsor = sponsorUser.username;
        }
        
        req.body.role = 'user';
        const user = await User.create(req.body);
        
        if (req.body.sponsor) {
            const sponsorObj = await User.findOne({ username: req.body.sponsor });
            if (sponsorObj) await Notification.create({ userId: sponsorObj._id, subject: 'New Team Member!', message: `Great news! @${user.username} has joined your network.` });
        }

        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.username}!` });
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { ...user.toObject(), token: generateToken(user._id) } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked' || user.restrictions?.login) return res.status(403).json({ success: false, error: 'Account restricted.' });
        
        const userData = user.toObject();
        delete userData.password;
        res.status(200).json({ success: true, data: { ...userData, token: generateToken(user._id) } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, data: users });
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
        
        const isAdmin = req.user && req.user.role === 'admin';
        const restricted = ['walletBalance', 'activePlans', 'role', 'username'];
        const safeBody = {};
        Object.keys(req.body).forEach(k => { if (isAdmin || !restricted.includes(k)) safeBody[k] = req.body[k]; });

        Object.assign(userToUpdate, safeBody);
        let updatedUser = await userToUpdate.save();
        
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const pending = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        
        let releasedAmount = 0;
        for (const comm of pending) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; 
                await comm.save(); 
                releasedAmount += comm.amount;
            }
        }
        
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, subject: 'Commission Unlocked 🔓', message: `Success! Held commissions released.` });
        }
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        // Cleanup associated data
        await Transaction.deleteMany({ userId: user._id });
        await Deposit.deleteMany({ userId: user._id });
        await Withdrawal.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });
        await User.findByIdAndDelete(req.params.id);

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, message: 'User deleted' });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        await Transaction.deleteMany({ userId: { $in: ids } });
        await Deposit.deleteMany({ userId: { $in: ids } });
        await Withdrawal.deleteMany({ userId: { $in: ids } });
        await User.deleteMany({ _id: { $in: ids } });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const { amount, description } = req.body;
        user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
        await user.save();
        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount, description: description || 'Admin adjustment', status: 'Approved' });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds' });
        
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price });
        await user.save();
        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', amount: -plan.price, description: `Purchased ${plan.name}`, status: 'Approved' });
        
        const settings = await Setting.getSettings();
        await distributeCommissions(user, plan, settings, settings.exchangeRates, { USD: 1, EUR: 0.92, PKR: 278 }, await InvestmentPlan.find());
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price });
        await user.save();
        const settings = await Setting.getSettings();
        await distributeCommissions(user, plan, settings, settings.exchangeRates, { USD: 1, EUR: 0.92, PKR: 278 }, await InvestmentPlan.find());
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const token = randomBytes(20).toString('hex');
        const user = await User.findById(req.params.id);
        user.passwordResetToken = createHash('sha256').update(token).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000 * 48; // 48 hours
        await user.save();
        res.status(200).json({ success: true, data: { resetToken: token } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const token = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired token' });
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const token = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token' });
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        let query = {};
        if (targetType === 'plan') query = { 'activePlans.planId': { $in: targetIds } };
        else if (targetType === 'single') query = { _id: { $in: targetIds } };

        const update = {};
        Object.keys(restrictions).forEach(k => { if (restrictions[k]) update[`restrictions.${k}`] = (action === 'enable'); });
        await User.updateMany(query, { $set: update });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, sponsor, balance, country, currency, usernames } = req.body;
        const docs = [];
        const loopCount = usernames ? usernames.length : count;
        for (let i = 0; i < loopCount; i++) {
            const uname = usernames ? usernames[i] : `user_${Math.random().toString(36).substr(2, 5)}`;
            docs.push({ username: uname, fullName: uname.toUpperCase(), email: `${uname}@dummy.com`, password: 'password123', phone: '000', country, currency, walletBalance: balance, sponsor });
        }
        await User.insertMany(docs);
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, count: docs.length });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
