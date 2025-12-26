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
 * Handles: User Purchase, Auto-Upgrade, and Admin Manual Activation
 */
const executePlanPurchase = async (user, plan, triggerType, settings, exchangeRates, defaultRates, allPlans) => {
    // 1. Update User Plan State
    user.activePlan = plan.name;
    if (!user.activePlans) user.activePlans = [];
    
    // Check if user already has this exact plan active to prevent duplicates
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

    // 2. Determine Transaction Log Details
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

    // 3. Notify User
    await Notification.create({
        userId: user._id,
        message: logDescription
    });

    // 4. SAVE USER STATE
    await user.save();

    // 5. RECONCILIATION: Release Standard Held Commissions
    const pendingCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
    if (pendingCommissions.length > 0) {
        let totalReleased = 0;
        for (const comm of pendingCommissions) {
            if (comm.isHoldPosition !== true && canReleaseCommission(comm, user, settings, allPlans)) {
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
                message: `Activation of ${plan.name} has unlocked ${user.currency}${totalReleased.toFixed(2)} in previously held commissions.`
            });
        }
    }

    // 6. DISTRIBUTE UPLINE COMMISSIONS
    await distributeCommissions(user, plan, settings, exchangeRates, defaultRates, allPlans);

    return { user, transaction };
};

/**
 * CORE COMMISSION PIPELINE
 * Processes commissions through Slotting, Hold Position, Overflow, and Eligibility checks.
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
            let targetPlanId = referralPlanId;

            if (group) {
                const groupPlanIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
                const sponsorActivePlanIds = (uplineUser.activePlans || []).map(p => String(p.planId));
                hasEquivalentPlan = sponsorActivePlanIds.some(id => groupPlanIds.includes(id));
                
                const currencyKey = `${uplineUser.currency.toLowerCase()}PlanId`;
                if (group[currencyKey]) targetPlanId = group[currencyKey];
                else if (group.usdPlanId) targetPlanId = group.usdPlanId;
            } else {
                hasEquivalentPlan = (uplineUser.activePlans || []).some(p => String(p.planId) === referralPlanId);
            }

            if (!hasEquivalentPlan) {
                const targetPlan = allPlans.find(p => p._id.toString() === String(targetPlanId));
                const requiredPlanName = targetPlan ? `${targetPlan.name} (${targetPlan.currency})` : 'matching plan';
                return { status: 'Pending', message: `Commission Held! Purchase ${requiredPlanName} to release.` };
            }
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
        let currentSlotNum = 1;

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

            const referralCount = await Transaction.countDocuments({
                userId: uplineUser._id,
                type: 'Commission',
                relatedPlanId: { $in: equivIds },
                level: 1,
                status: { $in: ['Approved', 'Pending'] }
            });

            currentSlotNum = referralCount + 1;
            const sponsorMatchingActivePlan = (uplineUser.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
            const planConfigForSponsor = sponsorMatchingActivePlan 
                ? allPlans.find(p => p._id.toString() === String(sponsorMatchingActivePlan.planId))
                : plan;

            isHoldSlot = planConfigForSponsor?.holdPosition?.enabled && planConfigForSponsor.holdPosition.slots.includes(currentSlotNum);

            if (isHoldSlot) {
                const nextPlanId = planConfigForSponsor.autoUpgrade?.toPlanId;
                if (nextPlanId && (uplineUser.activePlans || []).some(p => p.planId.toString() === nextPlanId.toString())) {
                    isHoldSlot = false;
                }
            }
            
            if (!isHoldSlot) {
                const limit = planConfigForSponsor?.directReferralLimit || 0;
                if (limit > 0 && referralCount >= limit) {
                    await Transaction.create({
                        userId: uplineUser._id,
                        userName: uplineUser.username,
                        currency: uplineUser.currency,
                        type: 'Commission',
                        amount: 0,
                        level: 1,
                        sourceUserId: user._id,
                        description: `Slot Overflow: Your ${limit} direct slots for '${plan.name}' are full.`,
                        status: 'Rejected',
                        relatedPlanId: plan._id
                    });
                    currentUplineUsername = uplineUser.sponsor;
                    continue; 
                }
            }

            if (plan.directCommissions?.length > 0) {
                commissionConfig = referralCount < plan.directCommissions.length ? plan.directCommissions[referralCount] : plan.directCommissions[plan.directCommissions.length - 1];
            } else {
                commissionConfig = { type: 'percentage', value: 0 }; 
            }
        } else { 
            commissionConfig = (plan.indirectCommissions || [])[level - 1];
        }

        // Apply One-Time Check
        if (settings.oneTimeCommissionPerGroup) {
            const hasRecurring = (uplineUser.activePlans || []).some(p => (settings.recurringCommissionPlanIds || []).includes(String(p.planId)));
            if (!hasRecurring) {
                const existing = await Transaction.findOne({ userId: uplineUser._id, sourceUserId: user._id, type: 'Commission', status: 'Approved', amount: { $gt: 0 } });
                if (existing) {
                    await Transaction.create({
                        userId: uplineUser._id,
                        userName: uplineUser.username,
                        currency: uplineUser.currency,
                        type: 'Commission',
                        amount: 0,
                        level: level + 1,
                        sourceUserId: user._id,
                        description: `Commission Capped: You already earned from ${user.username} (One-time policy).`,
                        status: 'Rejected',
                        relatedPlanId: plan._id
                    });
                    currentUplineUsername = uplineUser.sponsor;
                    continue;
                }
            }
        }

        const rawAmount = calculateRawCommission(commissionConfig, plan.price);
        const finalAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);

        if (eligibility.status === 'Approved') {
            if (finalAmount > 0) {
                uplineUser.walletBalance = Number((uplineUser.walletBalance + finalAmount).toFixed(2));
                await Notification.create({ userId: uplineUser._id, message: `You earned a Level ${level + 1} commission of ${uplineUser.currency}${finalAmount.toFixed(2)} from ${user.username}.` });
            }
        } else if (eligibility.status === 'Pending' && isHoldSlot) {
            uplineUser.heldBalance = Number((uplineUser.heldBalance + finalAmount).toFixed(2));
            const upgradePlan = allPlans.find(p => p._id.toString() === String(plan.autoUpgrade?.toPlanId));
            if (upgradePlan && uplineUser.heldBalance >= upgradePlan.price) {
                uplineUser.heldBalance = Number((uplineUser.heldBalance - upgradePlan.price).toFixed(2));
                await executePlanPurchase(uplineUser, upgradePlan, 'auto', settings, exchangeRates, defaultRates, allPlans);
            }
        }

        await Transaction.create({
            userId: uplineUser._id,
            userName: uplineUser.username,
            currency: uplineUser.currency,
            type: 'Commission',
            amount: finalAmount,
            level: level + 1,
            sourceUserId: user._id,
            description: eligibility.message || `Level ${level + 1} Commission from ${user.username} (${plan.name})`,
            status: eligibility.status,
            relatedPlanId: plan._id,
            isHoldPosition: isHoldSlot 
        });
        
        await uplineUser.save();
        currentUplineUsername = uplineUser.sponsor;
    }
};

export const createUser = async (req, res, next) => {
    try {
        const { fullName, username, email, password, phone, sponsor, country } = req.body;
        if (!country) return res.status(400).json({ success: false, error: 'Country is a required field.' });
        if (sponsor) {
            const sponsorExists = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorExists) return res.status(400).json({ success: false, error: `Sponsor '${sponsor}' not found.` });
            req.body.sponsor = sponsorExists.username;
        }
        let currency = 'USD';
        if (country.toLowerCase() === 'pakistan') currency = 'PKR';
        else if (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase())) currency = 'EUR';
        req.body.currency = currency;
        const user = await User.create(req.body);
        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.fullName}!` });
        const userResponse = user.toObject(); delete userResponse.password;
        res.status(201).json({ success: true, data: userResponse });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        const userResponse = user.toObject(); delete userResponse.password;
        res.status(200).json({ success: true, data: userResponse });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUsers = async (req, res) => {
    try { const users = await User.find(); res.status(200).json({ success: true, count: users.length, data: users }); } 
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUser = async (req, res) => {
     try { const user = await User.findById(req.params.id); if (!user) return res.status(404).json({ success: false, error: `User not found` }); res.status(200).json({ success: true, data: user }); } 
     catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        const oldCurrency = userToUpdate.currency;
        const oldBalance = userToUpdate.walletBalance;
        Object.assign(userToUpdate, req.body);
        if (oldCurrency !== userToUpdate.currency) {
            const settings = await Setting.getSettings();
            userToUpdate.walletBalance = Number(((oldBalance / (settings.exchangeRates[oldCurrency] || 1)) * (settings.exchangeRates[userToUpdate.currency] || 1)).toFixed(2));
        }
        let updatedUser = await userToUpdate.save();
        if (req.body.restrictions?.earning === false) {
            const settings = await Setting.getSettings();
            const allPlans = await InvestmentPlan.find(); 
            const pending = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending', isHoldPosition: { $ne: true } });
            let totalReleased = 0;
            for (const comm of pending) {
                if (canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                    comm.status = 'Approved'; await comm.save(); totalReleased += comm.amount;
                }
            }
            if (totalReleased > 0) {
                updatedUser.walletBalance = Number((updatedUser.walletBalance + totalReleased).toFixed(2));
                updatedUser = await updatedUser.save();
            }
        }
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        let query = {};
        if (targetType === 'all') query = {};
        else if (targetType === 'plan') query = { 'activePlans.planId': { $in: targetIds } };
        else if (targetType === 'single') query = { _id: { $in: targetIds } };
        const users = await User.find(query);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find(); 
        for (const user of users) {
            let current = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false };
            let hasChange = false;
            let shouldRelease = false;
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    let newValue = action === 'enable' ? true : action === 'disable' ? false : !current[key];
                    if (current[key] !== newValue) {
                        if (key === 'earning' && current.earning === true && newValue === false) shouldRelease = true;
                        current[key] = newValue; hasChange = true;
                    }
                }
            }
            if (hasChange) {
                user.restrictions = current;
                if (shouldRelease) {
                    const pending = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending', isHoldPosition: { $ne: true } });
                    let relAmount = 0;
                    for (const comm of pending) {
                       if (canReleaseCommission(comm, user, settings, allPlans)) {
                            comm.status = 'Approved'; await comm.save(); relAmount += comm.amount;
                        }
                    }
                    if (relAmount > 0) user.walletBalance = Number((user.walletBalance + relAmount).toFixed(2));
                }
                await user.save();
            }
        }
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try { await User.deleteMany({ _id: { $in: req.body.ids } }); res.status(200).json({ success: true, data: {} }); } 
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        user.walletBalance = Number((user.walletBalance + req.body.amount).toFixed(2));
        const updatedUser = await user.save(); 
        const transaction = await Transaction.create({ userId: updatedUser._id, userName: updatedUser.username, currency: updatedUser.currency, type: req.body.amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: req.body.amount, description: req.body.description || 'Admin adjustment', status: 'Approved' });
        res.status(200).json({ success: true, data: { user: updatedUser, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found' });
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const result = await executePlanPurchase(user, plan, 'admin', settings, settings.exchangeRates, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        res.status(200).json({ success: true, data: result });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found' });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds' });
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const result = await executePlanPurchase(user, plan, 'user', settings, settings.exchangeRates, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        res.status(200).json({ success: true, data: result });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true, data: 'Request processed' });
    } catch (err) { res.status(200).json({ success: true, data: 'Request processed' }); }
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
