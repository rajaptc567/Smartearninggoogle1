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
 * HELPER: Determine if a pending commission can be released based on user's current plans
 */
const canReleaseCommission = (commission, user, settings, allPlans) => {
    let canRelease = true;
    if (settings.requirePlanMatchForCommission && commission.relatedPlanId) {
        const referralPlanId = String(commission.relatedPlanId);
        const group = (settings.planEquivalencyGroups || []).find(g => 
            String(g.usdPlanId) === referralPlanId || 
            String(g.pkrPlanId) === referralPlanId || 
            String(g.eurPlanId) === referralPlanId
        );
        let hasEquivalentPlan = false;
        if (group) {
            const groupPlanIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
            hasEquivalentPlan = (user.activePlans || []).some(p => groupPlanIds.includes(String(p.planId)));
        } else {
            hasEquivalentPlan = (user.activePlans || []).some(p => String(p.planId) === referralPlanId);
        }
        if (!hasEquivalentPlan) canRelease = false;
    } else if (settings.requireActivePlanForCommission) {
        if (!user.activePlans || user.activePlans.length === 0) canRelease = false;
    }
    return canRelease;
};

/**
 * REUSABLE PLAN ACTIVATION LOGIC
 */
const executePlanPurchase = async (user, plan, triggerType, settings, exchangeRates, defaultRates, allPlans) => {
    user.activePlan = plan.name;
    if (!user.activePlans) user.activePlans = [];
    
    const alreadyOwns = user.activePlans.some(p => p.planId.toString() === plan._id.toString());
    if (alreadyOwns) {
        throw new Error(`User already has the ${plan.name} plan active.`);
    }

    user.activePlans.push({
        planId: plan._id,
        planName: plan.name,
        price: plan.price,
        purchaseDate: new Date()
    });

    let logAmount = 0;
    let logDescription = '';
    
    if (triggerType === 'user') {
        logAmount = -plan.price;
        logDescription = `Purchased ${plan.name} plan`;
    } else if (triggerType === 'auto') {
        logAmount = 0; 
        logDescription = `Automated upgrade to ${plan.name} from reserved funds`;
    } else if (triggerType === 'admin') {
        logAmount = 0; 
        logDescription = `Plan ${plan.name} manually activated by Administrator`;
    }

    const transaction = await Transaction.create({
        userId: user._id,
        userName: user.username,
        currency: user.currency,
        type: 'Plan Purchase',
        amount: logAmount,
        description: logDescription,
        status: 'Approved'
    });

    await Notification.create({
        userId: user._id,
        message: logDescription
    });

    await user.save();

    const pendingCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
    if (pendingCommissions.length > 0) {
        let totalReleased = 0;
        for (const comm of pendingCommissions) {
            // Only release standard pending commissions, NOT hold positions
            const isHold = comm.description && comm.description.includes('Hold Commission for upgrade');
            if (!isHold && canReleaseCommission(comm, user, settings, allPlans)) {
                comm.status = 'Approved';
                await comm.save();
                totalReleased += comm.amount;
            }
        }
        if (totalReleased > 0) {
            user.walletBalance = Number((user.walletBalance + totalReleased).toFixed(2));
            await user.save(); 
            await Notification.create({
                userId: user._id,
                message: `Activation of ${plan.name} has unlocked ${user.currency}${totalReleased.toFixed(2)} in held commissions.`
            });
        }
    }

    await distributeCommissions(user, plan, settings, exchangeRates, defaultRates, allPlans);

    return { user, transaction };
};

/**
 * CORE COMMISSION PIPELINE (v1.10.13 - FIXED EXECUTION ORDER)
 */
const distributeCommissions = async (user, plan, settings, exchangeRates, defaultRates, allPlans) => {
    if (!user.sponsor) return;

    const convertCurrency = (amount, from, to) => {
        if (!from || !to) return amount;
        const fromKey = from.toUpperCase();
        const toKey = to.toUpperCase();
        if (fromKey === toKey) return Number(amount.toFixed(2));
        
        const getRate = (curr) => {
            const r = exchangeRates[curr];
            if (r !== undefined && r !== null && r !== 0) return r;
            return defaultRates[curr] || 1;
        };

        const fromRate = getRate(fromKey);
        const toRate = getRate(toKey);
        if (fromRate === 0) return 0;
        return Number(((amount / fromRate) * toRate).toFixed(2));
    };
    
    const calculateRawCommission = (commissionConfig, planPrice) => {
        if (!commissionConfig) return 0;
        const value = parseFloat(commissionConfig.value);
        if (isNaN(value)) return 0;
        return commissionConfig.type === 'percentage' ? (planPrice * value) / 100 : value;
    };

    const checkSponsorEligibility = (uplineUser, purchasePlanId) => {
        if (uplineUser.restrictions && uplineUser.restrictions.earning) {
            return { status: 'Pending', message: `Commission Held! Earnings currently paused by admin.` };
        }
        
        if (settings.requirePlanMatchForCommission) {
            const referralPlanId = String(purchasePlanId);
            const group = (settings.planEquivalencyGroups || []).find(g => 
                String(g.usdPlanId) === referralPlanId ||
                String(g.pkrPlanId) === referralPlanId || 
                String(g.eurPlanId) === referralPlanId
            );
            
            let hasEquivalentPlan = false;
            if (group) {
                const groupPlanIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
                hasEquivalentPlan = (uplineUser.activePlans || []).some(p => groupPlanIds.includes(String(p.planId)));
            } else {
                hasEquivalentPlan = (uplineUser.activePlans || []).some(p => String(p.planId) === referralPlanId);
            }

            if (!hasEquivalentPlan) return { status: 'Pending', message: `Commission Held! Matching plan required.` };
        } else if (settings.requireActivePlanForCommission) {
            if (!(uplineUser.activePlans?.length > 0)) return { status: 'Pending', message: `Commission Held! Active plan required.` };
        }
        return { status: 'Approved', message: '' };
    };

    let currentUplineUsername = user.sponsor;
    const totalLevels = 1 + (plan.indirectCommissions?.length || 0);
    let isPreviousUplineEligible = true;

    for (let level = 0; level < totalLevels; level++) {
        if (!currentUplineUsername) break;
        
        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } });
        if (!uplineUser || uplineUser.status === 'Blocked') break;

        if (settings.requireUplineEligibility && level > 0 && !isPreviousUplineEligible) break;
        
        let eligibility = checkSponsorEligibility(uplineUser, plan._id);
        isPreviousUplineEligible = (eligibility.status === 'Approved');

        let commissionConfig;
        let isHoldSlot = false;
        let isOverflow = false;
        let slotNum = 1;

        if (level === 0) { 
            const equivIds = [plan._id.toString()];
            if (settings.planEquivalencyGroups) {
                const group = settings.planEquivalencyGroups.find(g => 
                    String(g.usdPlanId) === plan._id.toString() || 
                    String(g.pkrPlanId) === plan._id.toString() || 
                    String(g.eurPlanId) === plan._id.toString()
                );
                if (group) {
                    if (group.usdPlanId) equivIds.push(String(group.usdPlanId));
                    if (group.pkrPlanId) equivIds.push(String(group.pkrPlanId));
                    if (group.eurPlanId) equivIds.push(String(group.eurPlanId));
                }
            }

            // 1. CALCULATE SLOT NUMBER FIRST (MANDATORY: Include Pending to count reserved spots)
            const referralCount = await Transaction.countDocuments({
                userId: uplineUser._id,
                type: 'Commission',
                relatedPlanId: { $in: equivIds },
                level: 1,
                status: { $in: ['Approved', 'Pending'] }
            });

            slotNum = referralCount + 1;
            
            const sponsorPlanConfig = (uplineUser.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
            const activePlanDoc = sponsorPlanConfig ? allPlans.find(p => p._id.toString() === String(sponsorPlanConfig.planId)) : plan;

            // 2. HOLD CHECK (MUST COME FIRST - Hold overrides Overflow)
            isHoldSlot = activePlanDoc?.holdPosition?.enabled && activePlanDoc.holdPosition.slots.includes(slotNum);

            // 3. OVERFLOW CHECK (ONLY IF NOT A HOLD SLOT)
            if (!isHoldSlot) {
                const limit = activePlanDoc?.directReferralLimit || 0;
                if (limit > 0 && slotNum > limit) {
                    isOverflow = true;
                }
            }

            if (isOverflow) {
                await Transaction.create({
                    userId: uplineUser._id,
                    userName: uplineUser.username,
                    currency: uplineUser.currency,
                    type: 'Commission',
                    amount: 0,
                    level: 1,
                    sourceUserId: user._id,
                    description: `Overflow: Limit reached (Slot #${slotNum})`,
                    status: 'Rejected',
                    relatedPlanId: plan._id
                });
                currentUplineUsername = uplineUser.sponsor;
                continue; 
            }

            if (plan.directCommissions?.length > 0) {
                commissionConfig = referralCount < plan.directCommissions.length ? plan.directCommissions[referralCount] : plan.directCommissions[plan.directCommissions.length - 1];
            }
        } else { 
            commissionConfig = (plan.indirectCommissions || [])[level - 1];
        }

        // Apply One-Time Check (unless recurring rights)
        if (settings.oneTimeCommissionPerGroup) {
            const hasRecurring = (uplineUser.activePlans || []).some(p => (settings.recurringCommissionPlanIds || []).includes(String(p.planId)));
            if (!hasRecurring) {
                const existing = await Transaction.findOne({ userId: uplineUser._id, sourceUserId: user._id, type: 'Commission', status: 'Approved', amount: { $gt: 0 } });
                if (existing) {
                    currentUplineUsername = uplineUser.sponsor;
                    continue;
                }
            }
        }

        const rawAmount = calculateRawCommission(commissionConfig, plan.price);
        const finalAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);

        if (isHoldSlot) {
            // HOLD logic: Add to held balance and check auto-upgrade
            uplineUser.heldBalance = Number((uplineUser.heldBalance + finalAmount).toFixed(2));
            
            const upgradeToId = plan.autoUpgrade?.toPlanId;
            const upgradePlan = allPlans.find(p => p._id.toString() === String(upgradeToId));
            if (upgradePlan && uplineUser.heldBalance >= upgradePlan.price) {
                uplineUser.heldBalance = Number((uplineUser.heldBalance - upgradePlan.price).toFixed(2));
                await executePlanPurchase(uplineUser, upgradePlan, 'auto', settings, exchangeRates, defaultRates, allPlans);
            }
        } else if (eligibility.status === 'Approved') {
            uplineUser.walletBalance = Number((uplineUser.walletBalance + finalAmount).toFixed(2));
            await Notification.create({ userId: uplineUser._id, message: `You earned ${uplineUser.currency}${finalAmount.toFixed(2)} from ${user.username}.` });
        }

        await Transaction.create({
            userId: uplineUser._id,
            userName: uplineUser.username,
            currency: uplineUser.currency,
            type: 'Commission',
            amount: finalAmount,
            level: level + 1,
            sourceUserId: user._id,
            description: isHoldSlot ? `Hold Commission for upgrade: Slot #${slotNum} (${user.username}) reserved.` : (eligibility.message || `Level ${level + 1} Commission from ${user.username}`),
            status: (isHoldSlot || eligibility.status === 'Pending') ? 'Pending' : 'Approved',
            relatedPlanId: plan._id
        });
        
        await uplineUser.save();
        currentUplineUsername = uplineUser.sponsor;
    }
};

export const createUser = async (req, res, next) => {
    try {
        const { fullName, username, email, password, phone, sponsor, country } = req.body;
        if (!country) return res.status(400).json({ success: false, error: 'Country is required' });
        if (sponsor) {
            const sponsorExists = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorExists) return res.status(400).json({ success: false, error: `Sponsor '${sponsor}' not found` });
            req.body.sponsor = sponsorExists.username;
        }
        let currency = 'USD';
        if (country.toLowerCase() === 'pakistan') currency = 'PKR';
        else if (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase())) currency = 'EUR';
        req.body.currency = currency;
        const user = await User.create(req.body);
        res.status(201).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        const userResponse = user.toObject(); delete userResponse.password;
        res.status(200).json({ success: true, data: userResponse });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUsers = async (req, res) => {
    try { const users = await User.find(); res.status(200).json({ success: true, data: users }); } 
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUser = async (req, res) => {
     try { const user = await User.findById(req.params.id); res.status(200).json({ success: true, data: user }); } 
     catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const oldCurrency = user.currency;
        const oldBalance = user.walletBalance;
        Object.assign(user, req.body);
        if (oldCurrency !== user.currency) {
            const settings = await Setting.getSettings();
            user.walletBalance = Number(((oldBalance / (settings.exchangeRates[oldCurrency] || 1)) * (settings.exchangeRates[user.currency] || 1)).toFixed(2));
        }
        await user.save();
        if (req.body.restrictions?.earning === false) {
            const settings = await Setting.getSettings();
            const allPlans = await InvestmentPlan.find(); 
            const pending = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
            let total = 0;
            for (const c of pending) { 
                const isHold = c.description && c.description.includes('Hold Commission for upgrade');
                if (!isHold && canReleaseCommission(c, user, settings, allPlans)) { 
                    c.status = 'Approved'; await c.save(); total += c.amount; 
                } 
            }
            if (total > 0) { user.walletBalance = Number((user.walletBalance + total).toFixed(2)); await user.save(); }
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        let query = targetType === 'all' ? {} : (targetType === 'plan' ? { 'activePlans.planId': { $in: targetIds } } : { _id: { $in: targetIds } });
        const users = await User.find(query);
        for (const u of users) {
            Object.keys(restrictions).forEach(k => { if(restrictions[k]) u.restrictions[k] = action === 'enable' ? true : (action === 'disable' ? false : !u.restrictions[k]); });
            await u.save();
        }
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try { await User.findByIdAndDelete(req.params.id); res.status(200).json({ success: true }); } 
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try { await User.deleteMany({ _id: { $in: req.body.ids } }); res.status(200).json({ success: true }); } 
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        user.walletBalance = Number((user.walletBalance + req.body.amount).toFixed(2));
        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: req.body.amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: req.body.amount, description: req.body.description || 'Admin adjustment', status: 'Approved' });
        await user.save();
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const result = await executePlanPurchase(user, plan, 'admin', settings, settings.exchangeRates, { USD: 1, EUR: 0.92, PKR: 278 }, allPlans);
        res.status(200).json({ success: true, data: result });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds' });
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const result = await executePlanPurchase(user, plan, 'user', settings, settings.exchangeRates, { USD: 1, EUR: 0.92, PKR: 278 }, allPlans);
        res.status(200).json({ success: true, data: result });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true });
    } catch (err) { res.status(200).json({ success: true }); }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const token = randomBytes(20).toString('hex');
        user.passwordResetToken = createHash('sha256').update(token).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save();
        res.status(200).json({ success: true, data: { resetToken: token } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const hashed = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(404).json({ success: false });
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const hashed = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false });
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};
