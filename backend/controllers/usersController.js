import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; 
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const safeRound = (val) => Number(Number(val).toFixed(2));

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

/**
 * 🔗 MLM TRANSACTION ENGINE
 * Runs inside a Mongoose Session to guarantee atomicity.
 */
const distributeCommissions = async (user, plan, settings, exchangeRates, defaultRates, allPlans, session) => {
    if (!user.sponsor) return;

    const convertCurrency = (amount, from, to) => {
        if (!from || !to) return safeRound(amount);
        const fromKey = from.toUpperCase(); const toKey = to.toUpperCase();
        if (fromKey === toKey) return safeRound(amount);
        const getRate = (curr) => { const r = exchangeRates[curr]; if (r !== undefined && r !== null && r !== 0) return r; return defaultRates[curr] || 1; };
        const fromRate = getRate(fromKey); const toRate = getRate(toKey);
        if (fromRate === 0) return 0;
        return safeRound((amount / fromRate) * toRate);
    };

    const calculateAmount = (commissionConfig, planPrice) => {
        if (!commissionConfig) return 0;
        const value = parseFloat(commissionConfig.value);
        return safeRound(commissionConfig.type === 'percentage' ? (planPrice * value) / 100 : value);
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

    for (let level = 0; level < totalCommissionLevels; level++) {
        if (!currentUplineUsername) break;
        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } }).session(session);
        if (!uplineUser || uplineUser.status === 'Blocked' || uplineUser.restrictions?.login) break;
        if (settings.requireUplineEligibility && level > 0 && !isPreviousUplineEligible) break;

        const commissionConfig = level === 0 ? plan.directCommissions[0] : plan.indirectCommissions[level - 1];
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
            await User.updateOne({ _id: uplineUser._id }, { $inc: { walletBalance: finalAmount } }, { session });
            await Notification.create([{
                userId: uplineUser._id,
                subject: 'Commission Received!',
                message: `You earned ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username}'s purchase.`
            }], { session });
        } else if (eligibility.status === 'Pending') {
            await Notification.create([{
                userId: uplineUser._id,
                subject: 'Commission Locked 🔐',
                message: `A reward of ${uplineUser.currency}${finalAmount.toFixed(2)} from @${user.username} is being held. Reason: ${eligibility.message}`
            }], { session });
        }

        await Transaction.create([{ 
            userId: uplineUser._id, 
            userName: uplineUser.username, 
            currency: uplineUser.currency, 
            type: 'Commission', 
            amount: finalAmount, 
            level: level + 1, 
            sourceUserId: user._id, 
            description: eligibility.message || `Referral Commission (L${level + 1})`, 
            status: eligibility.status, 
            relatedPlanId: plan._id 
        }], { session });

        currentUplineUsername = uplineUser.sponsor;
    }
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
        
        req.body.activePlans = [];
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
        
        const user = await User.create(req.body);
        
        if (sponsorUser) {
            await Notification.create({
                userId: sponsorUser._id,
                subject: 'New Team Member!',
                message: `Great news! @${user.username} has joined your network.`
            });
        }

        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.username}!` });
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked' || user.restrictions?.login) return res.status(403).json({ success: false, error: 'Account restricted.' });
        
        const token = generateToken(user._id);
        const userData = user.toObject();
        delete userData.password;
        userData.token = token;

        res.status(200).json({ success: true, data: userData });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUsers = async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page, 10) : null;
        const limit = parseInt(req.query.limit, 10) || 100;
        let query = User.find().sort({ registrationDate: -1 });
        if (page !== null) query = query.skip((page - 1) * limit).limit(limit);
        const users = await query;
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
        
        if (req.body.status && req.body.status !== userToUpdate.status) {
            await Notification.create({
                userId: userToUpdate._id,
                subject: 'Account Status Updated',
                message: `Your account status has been changed to: ${req.body.status}.`,
                isPopup: true
            });
        }

        Object.assign(userToUpdate, req.body);
        let updatedUser = await userToUpdate.save();
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; 
                comm.description = `Unlocked: Commission released.`;
                await comm.save(); 
                releasedAmount = safeRound(releasedAmount + comm.amount);
            }
        }
        if (releasedAmount > 0) {
            updatedUser = await User.findByIdAndUpdate(updatedUser._id, { $inc: { walletBalance: releasedAmount } }, { new: true });
            await Notification.create({ 
                userId: updatedUser._id, 
                subject: 'Commission Unlocked 🔓',
                message: `A total of ${updatedUser.currency}${releasedAmount.toFixed(2)} has been released to your wallet.` 
            });
        }
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(req.params.id).session(session);
        const plan = await InvestmentPlan.findById(req.body.planId).session(session);
        if (!user || !plan) throw new Error('Not found');
        
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        const updatedUser = await user.save({ session });
        
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find().session(session);
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans, session);
        
        await session.commitTransaction();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) {
        await session.abortTransaction();
        res.status(400).json({ success: false, error: err.message });
    } finally { session.endSession(); }
};

export const purchasePlan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(req.params.id).session(session);
        const plan = await InvestmentPlan.findById(req.body.planId).session(session);
        if (!user || !plan) throw new Error('Not found');
        if (user.walletBalance < plan.price) throw new Error('Insufficient funds');
        
        const updatedUser = await User.findByIdAndUpdate(user._id, { 
            $inc: { walletBalance: -safeRound(plan.price) },
            $push: { activePlans: { planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() } }
        }, { session, new: true });
        
        await Transaction.create([{ 
            userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', 
            amount: -safeRound(plan.price), description: `Purchased ${plan.name} plan`, status: 'Approved' 
        }], { session });
        
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find().session(session);
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans, session);
        
        await session.commitTransaction();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) {
        await session.abortTransaction();
        res.status(400).json({ success: false, error: err.message });
    } finally { session.endSession(); }
};

export const adjustWallet = async (req, res) => {
    try {
        const { amount, description } = req.body;
        const safeAmt = safeRound(amount);
        const user = await User.findByIdAndUpdate(req.params.id, { $inc: { walletBalance: safeAmt } }, { new: true });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        await Notification.create({
            userId: user._id,
            subject: 'Wallet Adjusted',
            message: `Admin has ${safeAmt > 0 ? 'credited' : 'debited'} your wallet by ${user.currency}${Math.abs(safeAmt)}. Reason: ${description || 'Manual adjustment'}`
        });

        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: safeAmt > 0 ? 'Manual Credit' : 'Manual Debit', amount: safeAmt, description: description || 'Admin manual adjustment', status: 'Approved' });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        if (!Array.isArray(targetIds)) return res.status(400).json({ success: false, error: 'IDs must be an array.' });
        
        // 🔒 NoSQL INJECTION GUARD: Validate all IDs
        const safeIds = targetIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        let query = {};
        if (targetType === 'plan') query = { 'activePlans.planId': { $in: safeIds } };
        else if (targetType === 'single') query = { _id: { $in: safeIds } };
        
        const usersToUpdate = await User.find(query);
        for (const user of usersToUpdate) {
            let cur = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    cur[key] = action === 'enable' ? true : action === 'disable' ? false : !cur[key];
                }
            }
            user.restrictions = cur;
            await user.save();
        }
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, message: `Bulk updated users.` });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        const safeIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        await Deposit.deleteMany({ userId: { $in: safeIds } });
        await Withdrawal.deleteMany({ userId: { $in: safeIds } });
        await Transaction.deleteMany({ userId: { $in: safeIds } });
        await Notification.deleteMany({ userId: { $in: safeIds } });
        await Transfer.deleteMany({ $or: [{ senderId: { $in: safeIds } }, { recipientId: { $in: safeIds } }] });
        await User.deleteMany({ _id: { $in: safeIds } });
        global.appDataVersion = Date.now();
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
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true, data: 'Admin notified.' });
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