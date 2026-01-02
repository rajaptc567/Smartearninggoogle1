
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
// @route   POST /api/v1/users
// @access  Public
export const createUser = async (req, res, next) => {
    try {
        const { fullName, username, email, password, phone, sponsor, country } = req.body;

        if (!country) {
            return res.status(400).json({ success: false, error: 'Country is a required field.' });
        }

        if (sponsor) {
            const sponsorExists = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorExists) {
                return res.status(400).json({ success: false, error: `Sponsor with username '${sponsor}' not found.` });
            }
            req.body.sponsor = sponsorExists.username;
        }

        // Auto-assign currency based on country
        let currency;
        if (country.toLowerCase() === 'pakistan') {
            currency = 'PKR';
        } else if (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase())) {
            currency = 'EUR';
        } else {
            currency = 'USD';
        }
        req.body.currency = currency;


        req.body.activePlans = [];
        req.body.restrictions = {
            deposit: false,
            withdrawal: false,
            transfer: false,
            earning: false,
            dispute: false,
            excludeFromTicker: false,
            login: false,
            purchase: false
        };

        const user = await User.create(req.body);
        
        await Notification.create({
            userId: user._id,
            message: `Welcome to SmartEarning, ${user.fullName}! Your account has been successfully created.`
        });

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({ success: true, data: userResponse });
    } catch (err) {
        let errorMessage = 'An unexpected error occurred.';
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue)[0];
            errorMessage = `An account with that ${field} already exists.`;
        } else if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
        } else {
            errorMessage = err.message;
        }
        res.status(400).json({ success: false, error: errorMessage });
    }
};

// @desc    Auth user & get token
// @route   POST /api/v1/users/login
// @access  Public
export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Please provide an email and password' });
        }
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        if (user.status === 'Blocked' || user.restrictions?.login) {
            return res.status(403).json({ success: false, error: 'Your account access has been restricted. Please contact support.' });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({ success: true, data: userResponse });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};


// @desc    Get all users
// @route   GET /api/v1/users
export const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get single user
// @route   GET /api/v1/users/:id
export const getUser = async (req, res) => {
     try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// Helper function for checking commission release eligibility
const canReleaseCommission = async (commission, user, settings, allPlans) => {
    if (commission.status !== 'Pending') return false;

    let canRelease = true;
    let targetPlanId = commission.relatedPlanId ? String(commission.relatedPlanId) : null;
    
    if (settings.requirePlanMatchForCommission && targetPlanId) {
        const group = (settings.planEquivalencyGroups || []).find(g => 
            String(g.usdPlanId) === targetPlanId ||
            String(g.pkrPlanId) === targetPlanId || 
            String(g.eurPlanId) === targetPlanId
        );

        let hasEquivalentPlan = false;
        let equivIds = [targetPlanId];

        if (group) {
            equivIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
            const sponsorActivePlanIds = (user.activePlans || []).map(p => String(p.planId));
            hasEquivalentPlan = sponsorActivePlanIds.some(id => equivIds.includes(id));
        } else {
            hasEquivalentPlan = (user.activePlans || []).some(p => String(p.planId) === targetPlanId);
        }

        if (!hasEquivalentPlan) return false;

        if (commission.level === 1) {
             const activePlan = (user.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
             if (!activePlan) return false;

             const planConfig = allPlans.find(p => p._id.toString() === String(activePlan.planId));
             const limit = planConfig?.directReferralLimit || 0;

             if (limit > 0) {
                 const approvedCount = await Transaction.countDocuments({
                     _id: { $ne: commission._id },
                     userId: user._id,
                     type: 'Commission',
                     relatedPlanId: { $in: equivIds },
                     level: 1,
                     status: 'Approved'
                 });

                 if (approvedCount >= limit) {
                     commission.status = 'Rejected';
                     commission.description = `[Overflow] Slot Limit (${limit}) reached before release.`;
                     await commission.save();
                     return false;
                 }
             }
        }

    } else if (settings.requireActivePlanForCommission) {
        const hasAnyPlan = user.activePlans && user.activePlans.length > 0;
        if (!hasAnyPlan) return false;
    }

    return canRelease;
};

// @desc    Update user
// @route   PUT /api/v1/users/:id
export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) {
            return res.status(404).json({ success: false, error: `User not found` });
        }
        const userBeforeUpdate = userToUpdate.toObject();

        if (req.body.status && req.body.status !== userBeforeUpdate.status) {
            const newStatus = req.body.status;
            let message = '';
            if (newStatus === 'Blocked') { message = 'Your account has been blocked by the administrator.'; }
            else if (newStatus === 'Paused') { message = 'Your account has been paused by the administrator.'; }
            else if (newStatus === 'Active') { message = 'Your account is now active.'; }
            if (message) { await Notification.create({ userId: userBeforeUpdate._id, message }); }
        }

        // Handle Sponsor Change
        if (req.body.sponsor !== undefined && req.body.sponsor !== userBeforeUpdate.sponsor) {
            if (req.body.sponsor) {
                const sponsorExists = await User.findOne({ username: req.body.sponsor });
                if (!sponsorExists) return res.status(400).json({ success: false, error: 'Sponsor user not found.' });
                if (sponsorExists._id.toString() === userToUpdate._id.toString()) return res.status(400).json({ success: false, error: 'User cannot be their own sponsor.' });
            }
            await createLog('Sponsor Changed', userToUpdate.username, `Admin changed sponsor from ${userBeforeUpdate.sponsor || 'None'} to ${req.body.sponsor || 'None'}.`, 'admin');
        }

        const oldCurrency = userBeforeUpdate.currency;
        const oldBalance = userBeforeUpdate.walletBalance;
        let newCurrency = oldCurrency;
        if (req.body.country && req.body.country !== userBeforeUpdate.country) {
            if (req.body.country.toLowerCase() === 'pakistan') { newCurrency = 'PKR'; } 
            else if (europeanCountries.map(c => c.toLowerCase()).includes(req.body.country.toLowerCase())) { newCurrency = 'EUR'; } 
            else { newCurrency = 'USD'; }
        }

        Object.assign(userToUpdate, req.body);

        if (oldCurrency !== newCurrency) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates;
            const balanceInUSD = oldBalance / (rates[oldCurrency] || 1);
            const newBalance = balanceInUSD * (rates[newCurrency] || 1);
            userToUpdate.walletBalance = Number(newBalance.toFixed(2));
        }

        let updatedUser = await userToUpdate.save();

        if (oldCurrency !== newCurrency) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates;
            const conversionRate = (rates[newCurrency] || 1) / (rates[oldCurrency] || 1);
            await Deposit.updateMany({ userId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate }, $set: { currency: newCurrency } });
            await Withdrawal.updateMany({ userId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate, fee: conversionRate, finalAmount: conversionRate, matchRemainingAmount: conversionRate }, $set: { currency: newCurrency } });
            await Transaction.updateMany({ userId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate }, $set: { currency: newCurrency } });
            await Notification.create({ userId: updatedUser._id, message: `Account currency updated to ${newCurrency}.` });
        }
        
        if (req.body.restrictions && req.body.restrictions.earning === false && userBeforeUpdate.restrictions?.earning === true) {
            const settings = await Setting.getSettings();
            const allPlans = await InvestmentPlan.find();
            const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
            let releasedAmount = 0;
            for (const comm of pendingCommissions) {
                if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
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
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Bulk update user restrictions
export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action, sendNotification } = req.body;
        let query = {};
        if (targetType === 'all') { query = {}; } 
        else if (targetType === 'plan') { query = { 'activePlans.planId': { $in: targetIds } }; } 
        else if (targetType === 'single') { query = { _id: { $in: targetIds } }; }
        const usersToUpdate = await User.find(query);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        
        for (const user of usersToUpdate) {
            let currentRestrictions = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
            let hasChange = false;
            let shouldReleaseCommissions = false;
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    let newValue = action === 'enable' ? true : action === 'disable' ? false : !currentRestrictions[key];
                    if (currentRestrictions[key] !== newValue) {
                        if (key === 'earning' && currentRestrictions.earning === true && newValue === false) { shouldReleaseCommissions = true; }
                        currentRestrictions[key] = newValue;
                        hasChange = true;
                    }
                }
            }
            if (hasChange) {
                user.restrictions = currentRestrictions;
                if (shouldReleaseCommissions) {
                    const pendingCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
                    let releasedAmount = 0;
                    for (const comm of pendingCommissions) {
                       if (await canReleaseCommission(comm, user, settings, allPlans)) {
                            comm.status = 'Approved';
                            await comm.save();
                            releasedAmount += comm.amount;
                        }
                    }
                    if (releasedAmount > 0) { user.walletBalance = Number((user.walletBalance + releasedAmount).toFixed(2)); }
                }
                await user.save();
            }
        }
        res.status(200).json({ success: true, message: `Bulk updated users.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        await Deposit.deleteMany({ userId: user._id });
        await Withdrawal.deleteMany({ userId: user._id });
        await Transaction.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });
        await Transfer.deleteMany({ $or: [{ senderId: user._id }, { recipientId: user._id }] });
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
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
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
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
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
}

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
    const checkEligibility = (uplineUser, purchasePlanId) => {
        if (uplineUser.restrictions?.earning) return { status: 'Pending', message: `Commission Held! Earnings paused.` };
        if (settings.requirePlanMatchForCommission) {
            const referralPlanId = purchasePlanId.toString();
            const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === referralPlanId || String(g.pkrPlanId) === referralPlanId || String(g.eurPlanId) === referralPlanId);
            let hasEquivalentPlan = false;
            if (group) {
                const groupPlanIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
                const sponsorActivePlanIds = (uplineUser.activePlans || []).map(p => String(p.planId));
                hasEquivalentPlan = sponsorActivePlanIds.some(id => groupPlanIds.includes(id));
            } else { hasEquivalentPlan = (uplineUser.activePlans || []).some(p => String(p.planId) === referralPlanId); }
            if (!hasEquivalentPlan) return { status: 'Pending', message: `Commission Held! Equivalent plan required.` };
        } else if (settings.requireActivePlanForCommission) { if ((uplineUser.activePlans || []).length === 0) return { status: 'Pending', message: `Commission Held! Active plan required.` }; }
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
        let eligibility = checkEligibility(uplineUser, plan._id);
        isPreviousUplineEligible = (eligibility.status === 'Approved');
        let commissionConfig = level === 0 ? (plan.directCommissions?.[0] || {type: 'percentage', value: 0}) : (plan.indirectCommissions || [])[level - 1];
        if (!commissionConfig) break;
        const rawAmount = calculateAmount(commissionConfig, plan.price);
        if (rawAmount <= 0) { currentUplineUsername = uplineUser.sponsor; continue; }
        const finalAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);
        if (eligibility.status === 'Approved') { uplineUser.walletBalance = Number((uplineUser.walletBalance + finalAmount).toFixed(2)); await uplineUser.save(); }
        await Transaction.create({
            userId: uplineUser._id, userName: uplineUser.username, currency: uplineUser.currency, 
            type: 'Commission', amount: finalAmount, level: level + 1, sourceUserId: user._id, 
            description: eligibility.message || `Level ${level + 1} Commission from ${user.username}`, 
            status: eligibility.status, relatedPlanId: plan._id
        });
        currentUplineUsername = uplineUser.sponsor;
    }
};

export const adminActivatePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        if (user.currency !== plan.currency) return res.status(400).json({ success: false, error: 'Currency mismatch' });
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        await user.save();
        await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', amount: 0, description: `Admin manually activated ${plan.name} plan`, status: 'Approved' });
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(user, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        res.status(200).json({ success: true, data: { user, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        if (user.restrictions?.purchase) return res.status(403).json({ success: false, error: 'Plan purchases are disabled for your account.' });
        if (user.currency !== plan.currency) return res.status(400).json({ success: false, error: 'Currency mismatch' });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        await user.save();
        await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', amount: -plan.price, description: `Purchased ${plan.name} plan`, status: 'Approved' });
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(user, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        res.status(200).json({ success: true, data: { user, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, sponsor, balance, country, currency, planId } = req.body;
        const sponsorUser = await User.findOne({ username: sponsor });
        if (!sponsorUser) return res.status(404).json({ success: false, error: 'Sponsor not found' });
        const plan = planId ? await InvestmentPlan.findById(planId) : null;
        for (let i = 0; i < count; i++) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            await User.create({ fullName: `Dummy User ${randomSuffix}`, username: `user_${randomSuffix}`, email: `user_${randomSuffix}@test.com`, password: 'password123', phone: '000000', country, currency, walletBalance: balance, sponsor: sponsorUser.username });
        }
        res.status(201).json({ success: true, message: 'Created dummy users' });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
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
