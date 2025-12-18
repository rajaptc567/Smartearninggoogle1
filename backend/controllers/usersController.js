
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

        let currency = country.toLowerCase() === 'pakistan' ? 'PKR' : (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase()) ? 'EUR' : 'USD');
        req.body.currency = currency;
        req.body.activePlans = [];
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false };

        const user = await User.create(req.body);
        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.fullName}! Your account has been successfully created.` });
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(201).json({ success: true, data: userResponse });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) return res.status(400).json({ success: false, error: 'Please provide an email and password' });
        const user = await User.findOne({ email }).select('+password');
        if (!user || user.status === 'Blocked') return res.status(401).json({ success: false, error: 'Invalid credentials or account blocked' });
        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(200).json({ success: true, data: userResponse });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getUser = async (req, res) => {
     try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const canReleaseCommission = (commission, user, settings, allPlans) => {
    if (user.restrictions?.earning) return false;
    if (settings.requirePlanMatchForCommission && commission.relatedPlanId) {
        const referralPlanId = commission.relatedPlanId.toString();
        const group = (settings.planEquivalencyGroups || []).find(g => g.usdPlanId === referralPlanId || g.pkrPlanId === referralPlanId || g.eurPlanId === referralPlanId);
        if (group) {
            const groupPlanIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean);
            return (user.activePlans || []).some(p => groupPlanIds.includes(p.planId.toString()));
        }
        return (user.activePlans || []).some(p => p.planId.toString() === referralPlanId);
    }
    if (settings.requireActivePlanForCommission) return user.activePlans && user.activePlans.length > 0;
    return true;
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        const userBeforeUpdate = userToUpdate.toObject();

        if (req.body.status && req.body.status !== userBeforeUpdate.status) {
            await Notification.create({ userId: userBeforeUpdate._id, message: `Your account status changed to ${req.body.status}.` });
        }

        const oldCurrency = userBeforeUpdate.currency;
        const oldBalance = userBeforeUpdate.walletBalance;
        Object.assign(userToUpdate, req.body);

        if (req.body.country && req.body.country !== userBeforeUpdate.country) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates;
            const newCurrency = userToUpdate.country.toLowerCase() === 'pakistan' ? 'PKR' : (europeanCountries.map(c => c.toLowerCase()).includes(userToUpdate.country.toLowerCase()) ? 'EUR' : 'USD');
            const balanceInUSD = oldBalance / (rates[oldCurrency] || 1);
            userToUpdate.walletBalance = Number((balanceInUSD * (rates[newCurrency] || 1)).toFixed(2));
            userToUpdate.currency = newCurrency;
        }

        let updatedUser = await userToUpdate.save();

        if (req.body.restrictions?.earning === false && userBeforeUpdate.restrictions?.earning === true) {
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
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
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
                    let newValue = action === 'enable' ? true : (action === 'disable' ? false : !currentR[key]);
                    if (currentR[key] !== newValue) {
                        if (key === 'earning' && currentR.earning === true && newValue === false) shouldRelease = true;
                        currentR[key] = newValue;
                        hasChange = true;
                    }
                }
            }
            if (hasChange) {
                user.restrictions = currentR;
                if (shouldRelease) {
                    const pending = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
                    let released = 0;
                    for (const comm of pending) {
                        if (canReleaseCommission(comm, user, settings, allPlans)) {
                            comm.status = 'Approved';
                            await comm.save();
                            released += comm.amount;
                        }
                    }
                    if (released > 0) user.walletBalance = Number((user.walletBalance + released).toFixed(2));
                }
                await user.save();
                updatedCount++;
            }
        }
        res.status(200).json({ success: true, message: `Updated ${updatedCount} users.` });
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

export const adjustWallet = async (req, res) => {
    const { amount, description } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
        const updatedUser = await user.save();
        await Transaction.create({ userId: updatedUser._id, userName: updatedUser.username, currency: updatedUser.currency, type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount, description: description || 'Admin adjustment', status: 'Approved' });
        res.status(200).json({ success: true, data: { user: updatedUser }});
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();

        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        if (user.currency !== plan.currency) return res.status(400).json({ success: false, error: `Currency mismatch. Plan is in ${plan.currency}.` });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});

        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        if (!user.activePlans) user.activePlans = [];
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        user.activePlan = plan.name;
        await user.save();
        
        await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', amount: -plan.price, description: `Purchased ${plan.name}`, status: 'Approved' });
        await Notification.create({ userId: user._id, message: `Successfully purchased ${plan.name} for ${user.currency}${plan.price}.` });

        // Release previously held commissions
        const held = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
        let released = 0;
        for (const comm of held) {
            if (canReleaseCommission(comm, user, settings, allPlans)) {
                comm.status = 'Approved';
                await comm.save();
                released += comm.amount;
            }
        }
        if (released > 0) {
            user.walletBalance = Number((user.walletBalance + released).toFixed(2));
            await user.save();
            await Notification.create({ userId: user._id, message: `Unlocked ${user.currency}${released.toFixed(2)} in held commissions!` });
        }

        // Commission Distribution
        if (user.sponsor) {
            const convert = (amt, from, to) => {
                if (from === to) return Number(amt.toFixed(2));
                const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278.50 };
                const fromRate = rates[from] || 1, toRate = rates[to] || 1;
                return Number(((amt / fromRate) * toRate).toFixed(2));
            };

            let currentUpline = user.sponsor;
            const levels = [plan.directCommissions[0] || {type:'percentage', value:0}, ...plan.indirectCommissions];

            for (let i = 0; i < levels.length; i++) {
                if (!currentUpline) break;
                const upline = await User.findOne({ username: { $regex: new RegExp(`^${currentUpline}$`, 'i') } });
                if (!upline || upline.status === 'Blocked') break;

                const commCfg = levels[i];
                const commInUserCurr = commCfg.type === 'percentage' ? (plan.price * commCfg.value) / 100 : commCfg.value;
                const finalAmt = convert(commInUserCurr, user.currency, upline.currency);

                if (i === 0) { // Direct Level
                    const paidCount = await Transaction.countDocuments({ userId: upline._id, type: 'Commission', relatedPlanId: plan._id, level: 1, amount: { $gt: 0 }, status: 'Approved' });
                    
                    if (plan.directReferralLimit > 0 && paidCount >= plan.directReferralLimit) {
                        // Notify Sponsor only
                        await Notification.create({ userId: upline._id, message: `⚠️ Limit Reached! Referral ${user.username} joined ${plan.name}, but your direct referral slots for this plan are full.` });
                        await Transaction.create({ userId: upline._id, userName: upline.username, currency: upline.currency, type: 'Missed Commission', amount: 0, level: 1, sourceUserId: user._id, description: `Limit Reached (${plan.directReferralLimit}) for ${plan.name}. Referral: ${user.username}`, status: 'Rejected', relatedPlanId: plan._id });
                        currentUpline = upline.sponsor;
                        continue;
                    }

                    // Recovery Check - Notify Sponsor only
                    const wasMissed = await Transaction.exists({ userId: upline._id, sourceUserId: user._id, type: 'Missed Commission' });
                    if (wasMissed) {
                        await Notification.create({ userId: upline._id, message: `🎉 Recovered Commission! Referral ${user.username} upgraded to ${plan.name}. Since you have available slots for this plan, you earned a commission of ${upline.currency}${finalAmt.toFixed(2)}!` });
                    }
                    
                    // Hold Position Logic - Notify Sponsor only
                    const slotNum = paidCount + 1;
                    const isHold = plan.holdPosition?.enabled && plan.holdPosition.slots.includes(slotNum);
                    
                    if (isHold) {
                        await Transaction.create({ userId: upline._id, userName: upline.username, currency: upline.currency, type: 'Commission', amount: finalAmt, level: 1, sourceUserId: user._id, description: `Slot #${slotNum} Held for Auto-Upgrade (${plan.name})`, status: 'Pending', relatedPlanId: plan._id });
                        await Notification.create({ userId: upline._id, message: `Slot #${slotNum} filled by ${user.username}. Commission of ${upline.currency}${finalAmt.toFixed(2)} has been held/earmarked to fund your next auto-upgrade.` });
                    } else {
                        const elig = canReleaseCommission({relatedPlanId: plan._id}, upline, settings, allPlans);
                        if (elig) upline.walletBalance = Number((upline.walletBalance + finalAmt).toFixed(2));
                        await Transaction.create({ userId: upline._id, userName: upline.username, currency: upline.currency, type: 'Commission', amount: finalAmt, level: 1, sourceUserId: user._id, description: `Direct Commission from ${user.username} (${plan.name})`, status: elig ? 'Approved' : 'Pending', relatedPlanId: plan._id });
                        await Notification.create({ userId: upline._id, message: `You earned ${upline.currency}${finalAmt.toFixed(2)} from ${user.username}'s purchase of ${plan.name}.` });
                    }
                } else {
                    // Indirect Logic
                    const elig = canReleaseCommission({relatedPlanId: plan._id}, upline, settings, allPlans);
                    if (elig) upline.walletBalance = Number((upline.walletBalance + finalAmt).toFixed(2));
                    await Transaction.create({ userId: upline._id, userName: upline.username, currency: upline.currency, type: 'Commission', amount: finalAmt, level: i + 1, sourceUserId: user._id, description: `Level ${i+1} Commission: ${user.username} (${plan.name})`, status: elig ? 'Approved' : 'Pending', relatedPlanId: plan._id });
                    await Notification.create({ userId: upline._id, message: `Level ${i+1} commission of ${upline.currency}${finalAmt.toFixed(2)} earned from ${user.username}.` });
                }

                await upline.save();
                currentUpline = upline.sponsor;
            }
        }
        res.status(200).json({ success: true, data: { user } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const userRequestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user) await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true, data: 'If email exists, admin notified.' });
    } catch (err) {
        res.status(200).json({ success: true });
    }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const token = randomBytes(20).toString('hex');
        user.passwordResetToken = createHash('sha256').update(token).digest('hex');
        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
        await user.save();
        res.status(200).json({ success: true, data: { resetToken: token } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const hashed = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(404).json({ success: false, error: 'Invalid token' });
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const hashed = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token' });
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        await Notification.create({ userId: user._id, message: 'Your password has been successfully reset.' });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};
