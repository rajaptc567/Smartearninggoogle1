
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
        let currency;
        if (country.toLowerCase() === 'pakistan') currency = 'PKR';
        else if (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase())) currency = 'EUR';
        else currency = 'USD';
        req.body.currency = currency;
        req.body.activePlans = [];
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false };
        const user = await User.create(req.body);
        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.fullName}! Your account has been successfully created.` });
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(201).json({ success: true, data: userResponse });
    } catch (err) {
        let errorMessage = err.message;
        if (err.code === 11000) errorMessage = `An account with that ${Object.keys(err.keyValue)[0]} already exists.`;
        res.status(400).json({ success: false, error: errorMessage });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) return res.status(400).json({ success: false, error: 'Please provide an email and password' });
        const user = await User.findOne({ email }).select('+password');
        if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked') return res.status(403).json({ success: false, error: 'Your account has been blocked.' });
        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        const userResponse = user.toObject();
        delete userResponse.password;
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

const canReleaseCommission = (commission, user, settings, allPlans) => {
    if (settings.requirePlanMatchForCommission && commission.relatedPlanId) {
        const referralPlanId = commission.relatedPlanId.toString();
        const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === referralPlanId || String(g.pkrPlanId) === referralPlanId || String(g.eurPlanId) === referralPlanId);
        if (group) {
            const groupPlanIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
            return (user.activePlans || []).some(p => groupPlanIds.includes(String(p.planId)));
        }
        return (user.activePlans || []).some(p => String(p.planId) === referralPlanId);
    } else if (settings.requireActivePlanForCommission) {
        return (user.activePlans || []).length > 0;
    }
    return true;
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        const userBeforeUpdate = userToUpdate.toObject();
        Object.assign(userToUpdate, req.body);
        let updatedUser = await userToUpdate.save();
        if (req.body.restrictions && req.body.restrictions.earning === false && userBeforeUpdate.restrictions?.earning === true) {
            const settings = await Setting.getSettings();
            const allPlans = await InvestmentPlan.find();
            const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
            let releasedAmount = 0;
            for (const comm of pendingCommissions) {
                if (canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                    comm.status = 'Approved';
                    await comm.save();
                    releasedAmount += comm.amount;
                }
            }
            if (releasedAmount > 0) {
                updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
                updatedUser = await updatedUser.save();
                await Notification.create({ userId: updatedUser._id, message: `${updatedUser.currency}${releasedAmount.toFixed(2)} in held commissions released.` });
            }
        }
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action, sendNotification } = req.body;
        let query = targetType === 'all' ? {} : (targetType === 'plan' ? { 'activePlans.planId': { $in: targetIds } } : { _id: { $in: targetIds } });
        const usersToUpdate = await User.find(query);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        let updatedCount = 0;
        for (const user of usersToUpdate) {
            let currentR = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false };
            let hasChange = false, shouldRelease = false;
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) {
                    const newVal = action === 'enable' ? true : (action === 'disable' ? false : !currentR[key]);
                    if (currentR[key] !== newVal) {
                        if (key === 'earning' && currentR.earning === true && newVal === false) shouldRelease = true;
                        currentR[key] = newVal;
                        hasChange = true;
                    }
                }
            }
            if (hasChange) {
                user.restrictions = currentR;
                if (shouldRelease) {
                    const pendingComms = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
                    let releasedAmt = 0;
                    for (const comm of pendingComms) { if (canReleaseCommission(comm, user, settings, allPlans)) { comm.status = 'Approved'; await comm.save(); releasedAmt += comm.amount; } }
                    if (releasedAmt > 0) user.walletBalance = Number((user.walletBalance + releasedAmt).toFixed(2));
                }
                await user.save();
                updatedCount++;
            }
        }
        res.status(200).json({ success: true, message: `Updated ${updatedCount} users.` });
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
        await PasswordResetRequest.deleteMany({ userId: user._id });
        await Transfer.deleteMany({ $or: [{ senderId: user._id }, { recipientId: user._id }] });
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        await Deposit.deleteMany({ userId: { $in: ids } });
        await Withdrawal.deleteMany({ userId: { $in: ids } });
        await Transaction.deleteMany({ userId: { $in: ids } });
        await Notification.deleteMany({ userId: { $in: ids } });
        await PasswordResetRequest.deleteMany({ userId: { $in: ids } });
        await Transfer.deleteMany({ $or: [{ senderId: { $in: ids } }, { recipientId: { $in: ids } }] });
        await User.deleteMany({ _id: { $in: ids } });
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
        const transaction = await Transaction.create({ userId: updatedUser._id, userName: updatedUser.username, currency: updatedUser.currency, type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: amount, description: description || 'Admin adjustment', status: 'Approved' });
        await Notification.create({ userId: updatedUser._id, message: `Admin adjusted your wallet by ${updatedUser.currency}${amount}.` });
        res.status(200).json({ success: true, data: { user: updatedUser, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

// HELPER: Refined Commission logic for Hold and Overflow
const distributeCommissions = async (user, plan, settings, exchangeRates, defaultRates, allPlans) => {
    if (!user.sponsor) return;
    const convert = (amount, from, to) => {
        const fK = from.toUpperCase(), tK = to.toUpperCase();
        if (fK === tK) return Number(amount.toFixed(2));
        const fromR = exchangeRates[fK] || defaultRates[fK] || 1;
        const toR = exchangeRates[tK] || defaultRates[tK] || 1;
        return Number(((amount / fromR) * toR).toFixed(2));
    };
    const checkElig = (u, pId) => {
        if (u.restrictions?.earning) return { status: 'Pending', message: 'Earnings Paused.' };
        if (settings.requirePlanMatchForCommission) {
            const group = (settings.planEquivalencyGroups || []).find(g => [g.usdPlanId, g.pkrPlanId, g.eurPlanId].includes(String(pId)));
            const equivIds = group ? [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id)) : [String(pId)];
            const hasMatch = (u.activePlans || []).some(ap => equivIds.includes(String(ap.planId)));
            if (!hasMatch) return { status: 'Pending', message: 'Plan Upgrade Required.' };
        } else if (settings.requireActivePlanForCommission && (u.activePlans || []).length === 0) {
            return { status: 'Pending', message: 'No Active Plan.' };
        }
        return { status: 'Approved', message: '' };
    };

    let upline = user.sponsor;
    const indirect = plan.indirectCommissions || [];
    for (let level = 0; level < (1 + indirect.length); level++) {
        if (!upline) break;
        const u = await User.findOne({ username: { $regex: new RegExp(`^${upline}$`, 'i') } });
        if (!u || u.status === 'Blocked') break;
        let elig = checkElig(u, plan._id);
        let config = level === 0 ? plan.directCommissions[0] : indirect[level - 1];
        
        if (level === 0) {
            const equivIds = [plan._id.toString()];
            if (settings.planEquivalencyGroups) {
                const group = settings.planEquivalencyGroups.find(g => [g.usdPlanId, g.pkrPlanId, g.eurPlanId].includes(plan._id.toString()));
                if (group) [group.usdPlanId, group.pkrPlanId, group.eurPlanId].forEach(id => id && equivIds.push(String(id)));
            }
            const usedCount = await Transaction.countDocuments({ userId: u._id, type: 'Commission', relatedPlanId: { $in: equivIds }, level: 1, status: { $in: ['Approved', 'Pending'] } });
            
            // 1. OVERFLOW LOGIC: Amount 0, status Rejected, description 'Slot Limit Reached'
            if (plan.directReferralLimit > 0 && usedCount >= plan.directReferralLimit) {
                await Transaction.create({ userId: u._id, userName: u.username, currency: u.currency, type: 'Commission', amount: 0, level: 1, sourceUserId: user._id, description: 'Slot Limit Reached', status: 'Rejected', relatedPlanId: plan._id });
                await Notification.create({ userId: u._id, message: `Overflow! Referral ${user.username} activated ${plan.name} but your slots are full.` });
                upline = u.sponsor; continue;
            }
            
            // 2. HOLD POSITION LOGIC: status Pending, description 'Held for Upgrade'
            if (plan.holdPosition?.enabled && plan.holdPosition.slots.includes(usedCount + 1)) {
                elig.status = 'Pending';
                elig.message = 'Held for Upgrade';
            }
        }

        if (!config) { upline = u.sponsor; continue; }
        const rawAmt = config.type === 'percentage' ? (plan.price * config.value) / 100 : config.value;
        const finalAmt = convert(rawAmt, user.currency, u.currency);
        if (elig.status === 'Approved') { u.walletBalance = Number((u.walletBalance + finalAmt).toFixed(2)); await u.save(); }
        await Transaction.create({ 
            userId: u._id, userName: u.username, currency: u.currency, type: 'Commission', amount: finalAmt, level: level + 1, sourceUserId: user._id, 
            description: elig.message || `Level ${level + 1} Commission from ${user.username}`, status: elig.status, relatedPlanId: plan._id 
        });
        upline = u.sponsor;
    }
};

export const adminActivatePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id), plan = await InvestmentPlan.findById(planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User/Plan not found'});
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        await user.save();
        const settings = await Setting.getSettings(), allPlans = await InvestmentPlan.find();
        await distributeCommissions(user, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        res.status(200).json({ success: true, data: { user, transaction: { type: 'Grant' } } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id), plan = await InvestmentPlan.findById(planId);
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        await user.save();
        const settings = await Setting.getSettings(), allPlans = await InvestmentPlan.find();
        await distributeCommissions(user, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        res.status(200).json({ success: true, data: { user, transaction: { type: 'Purchase' } } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user) await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true, data: 'Request processed.' });
    } catch (err) { res.status(200).json({ success: true, data: 'Request processed.' }); }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
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
        res.status(200).json({ success: true, data: 'Verified.' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const hashedToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token.' });
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ success: true, data: 'Success.' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
