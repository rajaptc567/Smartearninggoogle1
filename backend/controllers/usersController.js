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

// Helper to execute plan purchase logic (reusable for manual and auto)
const executePlanPurchase = async (user, plan, isAuto = false, settings, exchangeRates, defaultRates, allPlans) => {
    user.activePlan = plan.name;
    if (!user.activePlans) user.activePlans = [];
    user.activePlans.push({
        planId: plan._id,
        planName: plan.name,
        price: plan.price,
        purchaseDate: new Date()
    });

    await user.save();

    const transaction = await Transaction.create({
        userId: user._id,
        userName: user.username,
        currency: user.currency,
        type: 'Plan Purchase',
        amount: isAuto ? 0 : -plan.price,
        description: isAuto ? `Automated upgrade to ${plan.name} from held funds` : `Purchased ${plan.name} plan`,
        status: 'Approved'
    });

    await Notification.create({
        userId: user._id,
        message: isAuto 
            ? `Congratulations! Your account has been automatically upgraded to the ${plan.name} plan using reserved funds.`
            : `You successfully purchased the ${plan.name} plan for ${user.currency}${plan.price.toFixed(2)}.`
    });

    // Check for held commissions that this new plan might unlock
    const heldCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
    if (heldCommissions.length > 0) {
        let totalReleased = 0;
        for (const comm of heldCommissions) {
            // Check if transaction is a "Hold Position" - we DON'T release those as they belong to heldBalance
            // We now use the isHoldPosition flag instead of brittle description parsing
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
                message: `Purchasing ${plan.name} has unlocked ${user.currency}${totalReleased.toFixed(2)} in previously held commissions.`
            });
        }
    }

    // Trigger upline commissions for THIS purchase
    await distributeCommissions(user, plan, settings, exchangeRates, defaultRates, allPlans);

    return { user, transaction };
};

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
            excludeFromTicker: false
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
        if (user.status === 'Blocked') {
            return res.status(403).json({ success: false, error: 'Your account has been blocked. Please contact support.' });
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
            const sponsorActivePlanIds = (user.activePlans || []).map(p => String(p.planId));
            hasEquivalentPlan = sponsorActivePlanIds.some(id => groupPlanIds.includes(id));
        } else {
            hasEquivalentPlan = (user.activePlans || []).some(p => String(p.planId) === referralPlanId);
        }
        if (!hasEquivalentPlan) canRelease = false;

    } else if (settings.requireActivePlanForCommission) {
        const hasAnyPlan = user.activePlans && user.activePlans.length > 0;
        if (!hasAnyPlan) canRelease = false;
    }

    return canRelease;
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) {
            return res.status(404).json({ success: false, error: `User not found` });
        }
        const userBeforeUpdate = userToUpdate.toObject();

        if (req.body.status && req.body.status !== userBeforeUpdate.status) {
            const newStatus = req.body.status;
            const oldStatus = userBeforeUpdate.status;
            let message = '';
            if (newStatus === 'Blocked') { message = 'Your account has been blocked by the administrator. Please contact support.'; }
            else if (newStatus === 'Paused') { message = 'Your account has been paused by the administrator. Financial activities are restricted.'; }
            else if (newStatus === 'Active') {
                if (oldStatus === 'Blocked') { message = 'Your account has been unblocked. You can now access all features.'; }
                else if (oldStatus === 'Paused') { message = 'Your account has been resumed. Restrictions have been lifted.'; }
                else { message = 'Your account is now active.'; }
            }
            if (message) { await Notification.create({ userId: userBeforeUpdate._id, message }); }
        }

        if (req.body.phone && req.body.phone !== userBeforeUpdate.phone) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your contact phone number was updated.` }); }
        if (req.body.password) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your account password has been changed.` }); }
        
        if (req.body.restrictions) {
            const oldR = userBeforeUpdate.restrictions || {};
            const newR = req.body.restrictions;
            if (newR.deposit !== oldR.deposit) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your ability to Deposit funds has been ${newR.deposit ? 'Disabled' : 'Enabled'} by admin.` }); }
            if (newR.withdrawal !== oldR.withdrawal) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your ability to Withdraw funds has been ${newR.withdrawal ? 'Disabled' : 'Enabled'} by admin.` }); }
            if (newR.transfer !== oldR.transfer) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your ability to Transfer funds has been ${newR.transfer ? 'Disabled' : 'Enabled'} by admin.` }); }
            if (newR.earning !== oldR.earning) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your ability to Earn Commissions has been ${newR.earning ? 'Paused' : 'Resumed'} by admin.` }); }
            if (newR.dispute !== oldR.dispute) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your ability to raise Disputes has been ${newR.dispute ? 'Disabled' : 'Enabled'} by admin.` }); }
            if (newR.excludeFromTicker !== oldR.excludeFromTicker) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your activities are now ${newR.excludeFromTicker ? 'hidden from' : 'visible on'} the public activity ticker.` });}
        }

        const oldCurrency = userBeforeUpdate.currency;
        const oldBalance = userBeforeUpdate.walletBalance;

        let newCurrency = oldCurrency;
        if (req.body.country && req.body.country !== userBeforeUpdate.country) {
            if (req.body.country.toLowerCase() === 'pakistan') {
                newCurrency = 'PKR';
            } else if (europeanCountries.map(c => c.toLowerCase()).includes(req.body.country.toLowerCase())) { 
                newCurrency = 'EUR'; 
            } else { 
                newCurrency = 'USD'; 
            }
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
            await Transaction.updateMany({ userId: updatedUser._id, originalCurrency: oldCurrency }, { $mul: { originalAmount: conversionRate }, $set: { originalCurrency: newCurrency } });
            await Transfer.updateMany({ senderId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate, fee: conversionRate, totalDeducted: conversionRate }, $set: { currency: newCurrency } });
            await Transfer.updateMany({ recipientId: updatedUser._id, currency: updatedUser.currency === 'USD' ? 'USD' : (updatedUser.currency === 'PKR' ? 'PKR' : 'EUR') }, { $mul: { amount: conversionRate, fee: conversionRate, totalDeducted: conversionRate }, $set: { currency: newCurrency } });

            await createLog('User Currency Change', updatedUser.username, `Admin changed country to ${updatedUser.country}, converting records from ${oldCurrency} to ${newCurrency}.`, 'admin');
            await Notification.create({ userId: updatedUser._id, message: `Your account currency has been updated to ${newCurrency}. Your balance and history have been converted.` });
        }
        
        if (req.body.restrictions && req.body.restrictions.earning === false && userBeforeUpdate.restrictions?.earning === true) {
            const settings = await Setting.getSettings();
            const allPlans = await InvestmentPlan.find(); 
            const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });

            let releasedAmount = 0;
            for (const comm of pendingCommissions) {
                // DON'T release Hold Position commissions (they stay in heldBalance)
                if (comm.isHoldPosition === true) continue;

                if (canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                    comm.status = 'Approved';
                    await comm.save();
                    releasedAmount += comm.amount;
                }
            }

            if (releasedAmount > 0) {
                updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
                updatedUser = await updatedUser.save(); 
                await Notification.create({
                    userId: updatedUser._id,
                    message: `${updatedUser.currency}${releasedAmount.toFixed(2)} in held commissions have been released to your wallet.`
                });
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
        
        let query = {};
        if (targetType === 'all') {
            query = {};
        } else if (targetType === 'plan' && targetIds && targetIds.length > 0) {
            query = { 'activePlans.planId': { $in: targetIds } };
        } else if (targetType === 'single' && targetIds && targetIds.length > 0) {
            query = { _id: { $in: targetIds } };
        } else {
            return res.status(400).json({ success: false, error: 'Invalid target configuration' });
        }

        const usersToUpdate = await User.find(query);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find(); 
        
        let updatedCount = 0;
        const notifications = [];

        for (const user of usersToUpdate) {
            let currentRestrictions = user.restrictions || {
                deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false
            };
            
            let hasChange = false;
            let shouldReleaseCommissions = false;
            
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    let newValue;
                    if (action === 'enable') newValue = true; 
                    else if (action === 'disable') newValue = false; 
                    else if (action === 'toggle') newValue = !currentRestrictions[key];
                    
                    if (currentRestrictions[key] !== newValue) {
                        if (key === 'earning' && currentRestrictions.earning === true && newValue === false) {
                            shouldReleaseCommissions = true;
                        }
                        currentRestrictions[key] = newValue;
                        hasChange = true;
                    }
                }
            }

            if (hasChange) {
                user.restrictions = currentRestrictions;
                
                if (shouldReleaseCommissions) {
                    const pendingCommissions = await Transaction.find({
                        userId: user._id,
                        type: 'Commission',
                        status: 'Pending'
                    });

                    let releasedAmount = 0;

                    for (const comm of pendingCommissions) {
                        // EXCLUDE Hold Position items
                        if (comm.isHoldPosition === true) continue;

                       if (canReleaseCommission(comm, user, settings, allPlans)) {
                            comm.status = 'Approved';
                            await comm.save();
                            releasedAmount += comm.amount;
                        }
                    }

                    if (releasedAmount > 0) {
                        user.walletBalance = Number((user.walletBalance + releasedAmount).toFixed(2));
                        if (sendNotification) {
                            notifications.push({
                                userId: user._id,
                                message: `Restrictions removed! ${user.currency}${releasedAmount.toFixed(2)} in held commissions have been released to your wallet.`
                            });
                        }
                    }
                }

                await user.save();
                updatedCount++;
                if (sendNotification && !shouldReleaseCommissions) {
                    notifications.push({
                        userId: user._id,
                        message: `Your account permissions have been updated by the administrator. Please check your profile settings.`
                    });
                }
            }
        }

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }

        res.status(200).json({ success: true, message: `Updated restrictions for ${updatedCount} users.` });

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
        await PasswordResetRequest.deleteMany({ userId: user._id });
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
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ success: false, error: 'Please provide an array of user IDs.' });
        }

        await Deposit.deleteMany({ userId: { $in: ids } });
        await Withdrawal.deleteMany({ userId: { $in: ids } });
        await Transaction.deleteMany({ userId: { $in: ids } });
        await Notification.deleteMany({ userId: { $in: ids } });
        await PasswordResetRequest.deleteMany({ userId: { $in: ids } });
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
            userId: updatedUser._id,
            userName: updatedUser.username,
            currency: updatedUser.currency, 
            type: amount > 0 ? 'Manual Credit' : 'Manual Debit',
            amount: amount,
            description: description || 'Admin manual adjustment',
            status: 'Approved'
        });
        
        const notifMessage = amount > 0 
            ? `Admin credited ${updatedUser.currency}${amount.toFixed(2)} to your wallet. Reason: ${description || 'Manual Adjustment'}`
            : `Admin debited ${updatedUser.currency}${Math.abs(amount).toFixed(2)} from your wallet. Reason: ${description || 'Manual Adjustment'}`;

        await Notification.create({
            userId: updatedUser._id,
            message: notifMessage
        });
        
        await createLog('Wallet Adjusted', updatedUser.username, `Adjusted balance by ${amount}. Reason: ${description}`, 'admin');

        res.status(200).json({ success: true, data: { user: updatedUser, transaction }});
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
}

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

        const amountInUSD = amount / fromRate;
        const convertedAmount = amountInUSD * toRate;
        return Number(convertedAmount.toFixed(2));
    };
    
    const calculateAmount = (commissionConfig, planPrice) => {
        if (!commissionConfig) return 0;
        const value = parseFloat(commissionConfig.value);
        if (isNaN(value)) return 0;
        return commissionConfig.type === 'percentage' ? (planPrice * value) / 100 : value;
    };

    const checkEligibility = (uplineUser, purchasePlanId) => {
        let status = 'Approved', message = '';
        if (uplineUser.restrictions && uplineUser.restrictions.earning) {
            return { status: 'Pending', message: `Commission Held! Your earnings are currently paused by the administrator.` };
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
                const requiredPlanName = targetPlan ? `${targetPlan.name} (${targetPlan.currency})` : 'the required equivalent plan';
                return { status: 'Pending', message: `Commission Held! Purchase ${requiredPlanName} to release commission earned from ${user.username}.` };
            }
        } else if (settings.requireActivePlanForCommission) {
            const hasAnyPlan = (uplineUser.activePlans || []).length > 0;
            if (!hasAnyPlan) return { status: 'Pending', message: `Commission Held! Purchase any plan to activate your earnings from ${user.username}.` };
        }
        return { status, message };
    };

    let currentUplineUsername = user.sponsor;
    const indirectCommissionLevels = plan.indirectCommissions || [];
    const totalCommissionLevels = 1 + indirectCommissionLevels.length;
    let isPreviousUplineEligible = true;

    for (let level = 0; level < totalCommissionLevels; level++) {
        if (!currentUplineUsername) break;
        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } });
        if (!uplineUser || uplineUser.status === 'Blocked') break;

        if (settings.requireUplineEligibility && level > 0 && !isPreviousUplineEligible) break;
        
        let eligibility = checkEligibility(uplineUser, plan._id);
        isPreviousUplineEligible = (eligibility.status === 'Approved');

        let commissionConfig;
        let referralCount = 0; 
        let isHoldSlot = false;

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

            const sponsorMatchingActivePlan = (uplineUser.activePlans || []).find(ap => 
                equivIds.includes(String(ap.planId))
            );
            
            const sponsorPlanConfig = sponsorMatchingActivePlan 
                ? allPlans.find(p => p._id.toString() === String(sponsorMatchingActivePlan.planId))
                : plan; 

            referralCount = await Transaction.countDocuments({
                userId: uplineUser._id,
                type: 'Commission',
                relatedPlanId: { $in: equivIds },
                level: 1,
                status: { $in: ['Approved', 'Pending'] }
            });

            const currentSlotNum = referralCount + 1;
            const limit = sponsorPlanConfig?.directReferralLimit || 0;
            isHoldSlot = sponsorPlanConfig?.holdPosition?.enabled && sponsorPlanConfig.holdPosition.slots.includes(currentSlotNum);

            if (isHoldSlot) {
                const nextPlanId = sponsorPlanConfig.autoUpgrade?.toPlanId;
                const alreadyOwnsUpgrade = uplineUser.activePlans && uplineUser.activePlans.some(p => String(p.planId) === String(nextPlanId));
                
                if (alreadyOwnsUpgrade) {
                    // Don't hold if goal is already met
                    isHoldSlot = false; // Override for transaction tagging
                    eligibility.status = 'Approved';
                    eligibility.message = `Direct Slot #${currentSlotNum} Commission from ${user.username} (${plan.name})`;
                } else {
                    const nextPlan = allPlans.find(p => p._id.toString() === String(nextPlanId));
                    const upName = nextPlan ? nextPlan.name : 'your next plan level';
                    eligibility.status = 'Pending';
                    eligibility.message = `Hold Commission for upgrade: Slot #${currentSlotNum} (${user.username}) reserved for auto-upgrade to ${upName}.`;
                }
            } 
            else if (limit > 0 && referralCount >= limit) {
                await Transaction.create({
                    userId: uplineUser._id,
                    userName: uplineUser.username,
                    currency: uplineUser.currency,
                    type: 'Commission',
                    amount: 0,
                    level: 1,
                    sourceUserId: user._id,
                    description: `Plan Overflow: Slot #${currentSlotNum} from ${user.username} - Limit (${limit}) Reached`,
                    status: 'Rejected',
                    relatedPlanId: plan._id
                });
                await Notification.create({
                    userId: uplineUser._id,
                    message: `⚠️ Slot Limit Reached! Your referral ${user.username} activated '${plan.name}', but your ${limit} direct slots for this level are full.`
                });
                currentUplineUsername = uplineUser.sponsor;
                continue; 
            }

            if (plan.directCommissions?.length > 0) {
                commissionConfig = referralCount < plan.directCommissions.length ? plan.directCommissions[referralCount] : plan.directCommissions[plan.directCommissions.length - 1];
            } else {
                commissionConfig = { type: 'percentage', value: 0 }; 
            }
        } else { 
            commissionConfig = (plan.indirectCommissions || [])[level - 1];
        }

        if (!commissionConfig) {
            currentUplineUsername = uplineUser.sponsor;
            continue;
        }
        
        if (settings.oneTimeCommissionPerGroup) {
            const sponsorActivePlanIds = (uplineUser.activePlans || []).map(p => String(p.planId));
            const exceptionPlanIds = settings.recurringCommissionPlanIds || [];
            const sponsorHasRecurringRights = sponsorActivePlanIds.some(id => exceptionPlanIds.includes(id));

            if (!sponsorHasRecurringRights) {
                const existingCommission = await Transaction.findOne({
                    userId: uplineUser._id,
                    sourceUserId: user._id,
                    type: 'Commission',
                    status: 'Approved',
                    amount: { $gt: 0 }
                });

                if (existingCommission) {
                    currentUplineUsername = uplineUser.sponsor;
                    continue; 
                }
            }
        }

        const rawAmount = calculateAmount(commissionConfig, plan.price);
        if (rawAmount <= 0) {
            currentUplineUsername = uplineUser.sponsor;
            continue;
        }

        const finalAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);

        if (eligibility.status === 'Approved') {
            uplineUser.walletBalance = Number((uplineUser.walletBalance + finalAmount).toFixed(2));
            await Notification.create({ userId: uplineUser._id, message: `You earned a Level ${level + 1} commission of ${uplineUser.currency}${finalAmount.toFixed(2)} from ${user.username}.` });
        } else if (eligibility.status === 'Pending') {
            // Check if this is specifically a hold position reservation
            if (isHoldSlot) {
                uplineUser.heldBalance = Number((uplineUser.heldBalance + finalAmount).toFixed(2));
                
                // AUTOMATED UPGRADE CHECK
                // Find current plan to see its upgrade target
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
                
                const sponsorMatchingActivePlan = (uplineUser.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
                const sponsorPlanConfig = sponsorMatchingActivePlan ? allPlans.find(p => p._id.toString() === String(sponsorMatchingActivePlan.planId)) : null;

                if (sponsorPlanConfig?.autoUpgrade?.enabled) {
                    const toId = sponsorPlanConfig.autoUpgrade.toPlanId;
                    const upgradePlan = allPlans.find(p => p._id.toString() === String(toId));
                    
                    if (upgradePlan && uplineUser.heldBalance >= upgradePlan.price) {
                        uplineUser.heldBalance = Number((uplineUser.heldBalance - upgradePlan.price).toFixed(2));
                        await executePlanPurchase(uplineUser, upgradePlan, true, settings, exchangeRates, defaultRates, allPlans);
                        await createLog('Auto-Upgrade', uplineUser.username, `Auto-upgraded to ${upgradePlan.name} using reserved funds.`, 'system');
                    }
                }
            }
            
            await Notification.create({ 
                userId: uplineUser._id, 
                message: `${eligibility.message || 'Commission Held!'}. Amount reserved: ${uplineUser.currency}${finalAmount.toFixed(2)}` 
            });
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
            originalAmount: rawAmount,
            originalCurrency: user.currency,
            exchangeRate: exchangeRates[user.currency.toUpperCase()] || 1,
            isHoldPosition: isHoldSlot // Use explicit boolean flag instead of string searching later
        });
        
        await uplineUser.save();
        currentUplineUsername = uplineUser.sponsor;
    }
};

export const adminActivatePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        
        if (user.currency !== plan.currency) {
            return res.status(400).json({ success: false, error: `This plan is in ${plan.currency}, but user account is in ${user.currency}.` });
        }

        const alreadyOwnsPlan = user.activePlans && user.activePlans.some(p => String(p.planId) === String(plan._id));
        if (alreadyOwnsPlan) {
            return res.status(400).json({ success: false, error: `User already owns the ${plan.name} plan.` });
        }

        const settingsDoc = await Setting.getSettings();
        const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc;
        const allPlans = await InvestmentPlan.find();

        const { user: updatedUser, transaction } = await executePlanPurchase(
            user, plan, false, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans
        );
        
        await createLog('Plan Activated', user.username, `Admin manually activated ${plan.name} plan.`, 'admin');

        res.status(200).json({ success: true, data: { user: updatedUser, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        
        const settingsDoc = await Setting.getSettings(); 
        const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc; 
        const exchangeRates = settings.exchangeRates || {};
        const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.50 };

        const allPlans = await InvestmentPlan.find(); 

        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        
        if (user.currency !== plan.currency) {
            return res.status(400).json({ success: false, error: `This plan is in ${plan.currency}, but your account is in ${user.currency}.` });
        }

        const alreadyOwnsPlan = user.activePlans && user.activePlans.some(p => String(p.planId) === String(plan._id));
        if (alreadyOwnsPlan) {
            return res.status(400).json({ success: false, error: `You have already purchased the ${plan.name} plan. You cannot purchase the same plan twice.` });
        }

        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        
        const { user: updatedUser, transaction } = await executePlanPurchase(
            user, plan, false, settings, exchangeRates, defaultRates, allPlans
        );
        
        res.status(200).json({ success: true, data: { user: updatedUser, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const userRequestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(200).json({ success: true, data: 'If a user with this email exists, a request has been sent to the admin.' });
        }

        const existingRequest = await PasswordResetRequest.findOne({ userId: user._id, status: 'Pending' });
        if (existingRequest) {
            return res.status(200).json({ success: true, data: 'A request is already pending for this user.' });
        }

        await PasswordResetRequest.create({
            userId: user._id,
            userEmail: user.email,
            userName: user.username,
        });

        res.status(200).json({ success: true, data: 'Your request has been sent to the administrator.' });
    } catch (err) {
        console.error('Error in userRequestPasswordReset:', err);
        res.status(200).json({ success: true, data: 'If a user with this email exists, a request has been sent to the admin.' });
    }
};


export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const resetToken = randomBytes(20).toString('hex');

        user.passwordResetToken = createHash('sha256')
            .update(resetToken)
            .digest('hex');

        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
        
        await user.save();
        
        await createLog('Password Reset Initiated', user.username, `Admin generated a password reset link.`, 'admin');

        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const resetToken = req.params.token;
        const hashedToken = createHash('sha256')
            .update(resetToken)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'Invalid or expired token.' });
        }

        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        res.status(200).json({ success: true, data: 'Token verified. You have 10 minutes to reset your password.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const resetToken = req.params.token;
        const hashedToken = createHash('sha256')
            .update(resetToken)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ success: false, error: 'Invalid or expired token.' });
        }

        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        await Notification.create({
            userId: user._id,
            message: 'Your password has been successfully reset.'
        });

        res.status(200).json({ success: true, data: 'Password reset successful.' });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};