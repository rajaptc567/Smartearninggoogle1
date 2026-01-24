
import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; 
import jwt from 'jsonwebtoken';
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';

const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];

const toMoneyInt = (val) => Math.round(parseFloat(val || 0) * 100);
const toMoneyDec = (val) => Number((val / 100).toFixed(2));

// Helper for sending token in cookie
const sendTokenResponse = (user, statusCode, res) => {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE) || 7;
    const options = {
        expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none'
    };

    res.status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            data: user
        });
};

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

    const convertCurrency = (amountInt, from, to) => {
        if (!from || !to) return amountInt;
        const fromKey = from.toUpperCase(); const toKey = to.toUpperCase();
        if (fromKey === toKey) return amountInt;
        
        const getRate = (curr) => { 
            const r = exchangeRates[curr]; 
            if (r !== undefined && r !== null && r !== 0) return r; 
            return defaultRates[curr] || 1; 
        };
        
        const fromRate = getRate(fromKey); 
        const toRate = getRate(toKey);
        
        if (fromRate === 0) return 0;
        return Math.round((amountInt / fromRate) * toRate);
    };

    const calculateAmountInt = (commissionConfig, planPrice) => {
        if (!commissionConfig) return 0;
        const value = parseFloat(commissionConfig.value);
        if (commissionConfig.type === 'percentage') {
            return Math.round((toMoneyInt(planPrice) * value) / 100);
        }
        return toMoneyInt(value);
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

        const amountInt = calculateAmountInt(commissionConfig, plan.price);
        if (amountInt <= 0) { currentUplineUsername = uplineUser.sponsor; continue; }
        const finalAmountInt = convertCurrency(amountInt, user.currency, uplineUser.currency);

        if (eligibility.status === 'Approved') {
            const amountToCredit = toMoneyDec(finalAmountInt);
            // ATOMIC CREDIT WITH PRECISION NORMALIZATION
            await User.findByIdAndUpdate(uplineUser._id, [
                { $set: { walletBalance: { $round: [{ $add: ["$walletBalance", amountToCredit] }, 2] } } }
            ]);
            
            await Notification.create({
                userId: uplineUser._id,
                subject: 'Commission Received!',
                message: `You earned ${uplineUser.currency}${amountToCredit} from @${user.username}'s plan purchase.`
            });
            
            if (level === 0) {
                const equivIds = [plan._id.toString()];
                if (settings.planEquivalencyGroups) {
                    const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === plan._id.toString() || String(g.pkrPlanId) === plan._id.toString() || String(g.eurPlanId) === plan._id.toString());
                    if (group) [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).forEach(id => equivIds.push(String(id)));
                }
                const approvedCount = await Transaction.countDocuments({ userId: uplineUser._id, type: 'Commission', relatedPlanId: { $in: equivIds }, level: 1, status: 'Approved' });
                if (plan.directReferralLimit > 0 && approvedCount === plan.directReferralLimit) {
                    const admin = await User.findOne({ username: 'admin' });
                    if (admin) {
                        await Notification.create({
                            userId: admin._id,
                            subject: '⚠️ Slot Limit Reached',
                            message: `User @${uplineUser.username} has filled all ${plan.directReferralLimit} slots in their ${plan.name} plan group.`,
                            isPopup: true
                        });
                    }
                }
            }
        } else if (eligibility.status === 'Rejected') {
            const isLimitRejected = eligibility.message.includes('[Limit]');
            if (!isLimitRejected || (isLimitRejected && settings.notifySponsorOnCommissionLimit)) {
                await Notification.create({ 
                    userId: uplineUser._id, 
                    subject: 'Commission Missed', 
                    message: `${eligibility.message} Commission of ${uplineUser.currency}${toMoneyDec(finalAmountInt)} from @${user.username} was lost.`, 
                    isPopup: level === 0 
                });
            }
        } else if (eligibility.status === 'Pending') {
            await Notification.create({
                userId: uplineUser._id,
                subject: 'Commission Locked 🔐',
                message: `A commission of ${uplineUser.currency}${toMoneyDec(finalAmountInt)} from @${user.username} has been held. Reason: ${eligibility.message}`
            });
        }
        
        const isLimitRejectedTx = eligibility.status === 'Rejected' && eligibility.message.includes('[Limit]');
        if (!isLimitRejectedTx || (isLimitRejectedTx && settings.showRejectedCommissionTransaction)) {
            await Transaction.create({ 
                userId: uplineUser._id, 
                userName: uplineUser.username, 
                currency: uplineUser.currency, 
                type: 'Commission', 
                amount: toMoneyDec(finalAmountInt), 
                level: level + 1, 
                sourceUserId: user._id, 
                description: eligibility.message || `Commission from ${user.username} (L${level + 1})`, 
                status: eligibility.status, 
                relatedPlanId: plan._id 
            });
        }
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
        
        req.body.currency = country.toLowerCase() === 'pakistan' ? 'PKR' : (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase()) ? 'EUR' : 'USD');
        req.body.activePlans = [];
        req.body.walletBalance = 0; // Enforce zero balance on registration
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
        
        const user = await User.create(req.body);
        
        if (sponsorUser) {
            await Notification.create({
                userId: sponsorUser._id,
                subject: 'New Team Member!',
                message: `Great news! @${user.username} has joined your network using your link.`
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
        
        sendTokenResponse(user, 200, res);
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const logout = (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({ success: true, data: {} });
};

export const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const totalCount = await User.countDocuments();
        const users = await User.find().skip(skip).limit(limit).sort({ registrationDate: -1 });

        res.status(200).json({ 
            success: true, 
            count: users.length, 
            data: users,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
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

        // SECURITY: Allow-list updates based on user role
        const isAdmin = req.user.username === 'admin' || req.user.email === 'studio56.pk@gmail.com';
        const updates = {};
        
        // Fields allowed for everyone
        const commonFields = ['fullName', 'phone', 'whatsapp', 'country'];
        commonFields.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        // Fields only allowed for admin
        if (isAdmin) {
            const adminOnlyFields = ['email', 'status', 'restrictions', 'sponsor', 'password', 'walletBalance'];
            adminOnlyFields.forEach(field => {
                if (req.body[field] !== undefined) updates[field] = req.body[field];
            });
        }

        if (updates.status && updates.status !== userToUpdate.status) {
            await Notification.create({
                userId: userToUpdate._id,
                subject: 'Account Status Updated',
                message: `Your account status has been changed to: ${updates.status}.`,
                isPopup: true
            });
        }

        Object.assign(userToUpdate, updates);
        // Normalize balance if updated manually
        if (updates.walletBalance !== undefined) {
            userToUpdate.walletBalance = toMoneyDec(toMoneyInt(updates.walletBalance));
        }
        
        let updatedUser = await userToUpdate.save();

        // Check if commissions can be released if earnings were unblocked
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        
        let releasedAmountInt = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; 
                comm.description = `Unlocked: Commission from referral payout.`;
                await comm.save(); 
                releasedAmountInt += toMoneyInt(comm.amount);
            }
        }
        
        if (releasedAmountInt > 0) {
            const amountToCredit = toMoneyDec(releasedAmountInt);
            // ATOMIC CREDIT WITH PRECISION NORMALIZATION
            updatedUser = await User.findByIdAndUpdate(updatedUser._id, [
                { $set: { walletBalance: { $round: [{ $add: ["$walletBalance", amountToCredit] }, 2] } } }
            ], { new: true });
            
            await Notification.create({ 
                userId: updatedUser._id, 
                subject: 'Commission Unlocked 🔓',
                message: `Success! A total of ${updatedUser.currency}${amountToCredit} in held commissions has been released.` 
            });
        }
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        
        // Use findByIdAndUpdate for reliability
        const updatedUser = await User.findByIdAndUpdate(user._id, {
            $push: { activePlans: { planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() } }
        }, { new: true });
        
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        
        // PRECISION: Use integers for price matching
        const priceInt = toMoneyInt(plan.price);
        const priceDec = toMoneyDec(priceInt);
        
        // ATOMIC CHECK AND DEDUCT WITH PRECISION NORMALIZATION
        const updatedUser = await User.findOneAndUpdate(
            { _id: user._id, walletBalance: { $gte: priceDec } },
            [
                { 
                    $set: { 
                        walletBalance: { $round: [{ $subtract: ["$walletBalance", priceDec] }, 2] },
                        activePlans: { $concatArrays: ["$activePlans", [{ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() }]] }
                    } 
                }
            ],
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ success: false, error: 'Insufficient funds or account modified concurrenty.' });
        }
        
        await Transaction.create({ 
            userId: user._id, 
            userName: user.username, 
            currency: user.currency, 
            type: 'Plan Purchase', 
            amount: -plan.price, 
            description: `Purchased ${plan.name} plan`, 
            status: 'Approved' 
        });
        
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const { amount, description } = req.body;
        const amountInt = toMoneyInt(amount);
        const amountToAdjust = toMoneyDec(amountInt);
        
        // ATOMIC ADJUSTMENT WITH PRECISION NORMALIZATION
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            [
                { $set: { walletBalance: { $round: [{ $add: ["$walletBalance", amountToAdjust] }, 2] } } }
            ],
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        await Notification.create({
            userId: user._id,
            subject: 'Wallet Adjusted',
            message: `Admin has ${amountToAdjust > 0 ? 'credited' : 'debited'} your wallet by ${user.currency}${Math.abs(amountToAdjust)}.`
        });
        
        const transaction = await Transaction.create({ 
            userId: user._id, 
            userName: user.username, 
            currency: user.currency, 
            type: amountToAdjust > 0 ? 'Manual Credit' : 'Manual Debit', 
            amount: amountToAdjust, 
            description: description || 'Admin manual adjustment', 
            status: 'Approved' 
        });
        
        global.appDataVersion = Date.now();
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
            await User.create({
                fullName: `Dummy ${uname}`,
                username: uname,
                email: `${uname}@test-${Math.floor(Math.random() * 1000)}.com`,
                password: 'password123',
                phone: '000000',
                country,
                currency,
                walletBalance: balance,
                sponsor: s.username
            });
        };
        
        if (usernames && Array.isArray(usernames) && usernames.length > 0) {
            for (const uname of usernames) {
                if (uname.trim()) await createOne(uname.trim());
            }
        } else {
            const iterations = parseInt(count) || 0;
            for (let i = 0; i < iterations; i++) {
                const suf = Math.floor(1000 + Math.random() * 9000);
                await createOne(`user_${suf}`);
            }
        }
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, message: 'Process completed' });
    } catch (err) { 
        res.status(400).json({ success: false, error: err.message }); 
    }
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
            let cur = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
            let changed = false;
            let checkRel = false;
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    let newVal = action === 'enable' ? true : action === 'disable' ? false : !cur[key];
                    if (cur[key] !== newVal) {
                        if (key === 'earning' && cur.earning === true && newVal === false) checkRel = true;
                        cur[key] = newVal; changed = true;
                    }
                }
            }
            if (changed) {
                user.restrictions = cur;
                if (checkRel) {
                    const pending = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
                    let relInt = 0;
                    for (const comm of pending) {
                        if (await canReleaseCommission(comm, user, settings, allPlans)) { 
                            comm.status = 'Approved'; 
                            comm.description = `Unlocked: Commission from referral payout.`;
                            await comm.save(); 
                            relInt += toMoneyInt(comm.amount); 
                        }
                    }
                    if (relInt > 0) {
                        const amountToCredit = toMoneyDec(relInt);
                        // ATOMIC CREDIT WITH PRECISION NORMALIZATION
                        await User.findByIdAndUpdate(user._id, [
                            { $set: { walletBalance: { $round: [{ $add: ["$walletBalance", amountToCredit] }, 2] } } }
                        ]);
                        await Notification.create({ 
                            userId: user._id, 
                            subject: 'Commission Unlocked 🔓',
                            message: `Success! ${user.currency}${amountToCredit} released.` 
                        });
                    }
                }
                await user.save();
            }
        }
        global.appDataVersion = Date.now();
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
