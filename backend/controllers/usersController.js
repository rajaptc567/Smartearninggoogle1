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
        logAmount = 0; // Funds were already in heldBalance, handled as internal transition
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
    // If this new plan satisfies a "Require Plan Match" or "Active Plan" rule for pending commissions
    const pendingCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
    if (pendingCommissions.length > 0) {
        let totalReleased = 0;
        for (const comm of pendingCommissions) {
            // EXCLUDE "Hold Position" items - they stay in heldBalance reservoir for THE NEXT upgrade
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
    // This triggers the full pipeline for the sponsors
    await distributeCommissions(user, plan, settings, exchangeRates, defaultRates, allPlans);

    return { user, transaction };
};

/**
 * CORE COMMISSION PIPELINE
 * Processes commissions through Slotting, Hold Position, Overflow, and Eligibility checks.
 */
const distributeCommissions = async (user, plan, settings, exchangeRates, defaultRates, allPlans) => {
    if (!user.sponsor) return;

    // Helper for multi-currency conversion using USD as base
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
    
    const calculateRawCommission = (commissionConfig, planPrice) => {
        if (!commissionConfig) return 0;
        const value = parseFloat(commissionConfig.value);
        if (isNaN(value)) return 0;
        return commissionConfig.type === 'percentage' ? (planPrice * value) / 100 : value;
    };

    const checkSponsorEligibility = (uplineUser, purchasePlanId) => {
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
        return { status: 'Approved', message: '' };
    };

    let currentUplineUsername = user.sponsor;
    const indirectLevelsCount = plan.indirectCommissions?.length || 0;
    const totalLevelsToProcess = 1 + indirectLevelsCount;
    let isPreviousUplineEligible = true;

    for (let level = 0; level < totalLevelsToProcess; level++) {
        if (!currentUplineUsername) break;
        
        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } });
        if (!uplineUser || uplineUser.status === 'Blocked') break;

        // Pass-through rule check
        if (settings.requireUplineEligibility && level > 0 && !isPreviousUplineEligible) break;
        
        let eligibility = checkSponsorEligibility(uplineUser, plan._id);
        isPreviousUplineEligible = (eligibility.status === 'Approved');

        let commissionConfig;
        let isHoldSlot = false;

        // PHASE A: Level 1 (Direct) Slotting & Hold Position
        if (level === 0) { 
            // 1. Identify Slot Number
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

            const currentSlotNum = referralCount + 1;

            // 2. Hold Position Check (Priority 1)
            // Identify which plan configuration determines the hold position (Equivalency check)
            const sponsorMatchingActivePlan = (uplineUser.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
            const planConfigForSponsor = sponsorMatchingActivePlan 
                ? allPlans.find(p => p._id.toString() === String(sponsorMatchingActivePlan.planId))
                : plan;

            isHoldSlot = planConfigForSponsor?.holdPosition?.enabled && planConfigForSponsor.holdPosition.slots.includes(currentSlotNum);

            // 3. LOOPHOLE PREVENTION: Override hold if user already owns the upgrade
            if (isHoldSlot) {
                const nextPlanId = planConfigForSponsor.autoUpgrade?.toPlanId;
                if (nextPlanId) {
                    const alreadyHasUpgrade = (uplineUser.activePlans || []).some(p => p.planId.toString() === nextPlanId.toString());
                    if (alreadyHasUpgrade) {
                        isHoldSlot = false; // Bypass savings reservoir
                        eligibility.message = `Direct Slot #${currentSlotNum} Commission from ${user.username}`;
                    } else {
                        const upgradePlan = allPlans.find(p => p._id.toString() === String(nextPlanId));
                        eligibility.status = 'Pending';
                        eligibility.message = `Hold Commission for upgrade: Slot #${currentSlotNum} (${user.username}) reserved for auto-upgrade to ${upgradePlan?.name || 'next level'}.`;
                    }
                }
            }
            
            // 4. OVERFLOW CHECK (Priority 2) - Only if NOT a hold slot
            else {
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
                        description: `Plan Overflow: Slot #${currentSlotNum} from ${user.username} - Limit (${limit}) reached.`,
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
            }

            // Select config based on slot number (or use last available)
            if (plan.directCommissions?.length > 0) {
                commissionConfig = referralCount < plan.directCommissions.length ? plan.directCommissions[referralCount] : plan.directCommissions[plan.directCommissions.length - 1];
            } else {
                commissionConfig = { type: 'percentage', value: 0 }; 
            }
        } 
        // Level 2+ Logic
        else { 
            commissionConfig = (plan.indirectCommissions || [])[level - 1];
        }

        if (!commissionConfig) {
            currentUplineUsername = uplineUser.sponsor;
            continue;
        }

        // ONE-TIME COMMISSION CHECK
        if (settings.oneTimeCommissionPerGroup) {
            const exceptionPlanIds = settings.recurringCommissionPlanIds || [];
            const hasRecurringRights = (uplineUser.activePlans || []).some(p => exceptionPlanIds.includes(String(p.planId)));

            if (!hasRecurringRights) {
                const existing = await Transaction.findOne({
                    userId: uplineUser._id,
                    sourceUserId: user._id,
                    type: 'Commission',
                    status: 'Approved',
                    amount: { $gt: 0 }
                });
                if (existing) {
                    currentUplineUsername = uplineUser.sponsor;
                    continue;
                }
            }
        }

        // Calculation & Conversion
        const rawAmount = calculateRawCommission(commissionConfig, plan.price);
        if (rawAmount <= 0) {
            currentUplineUsername = uplineUser.sponsor;
            continue;
        }

        const finalConvertedAmount = convertCurrency(rawAmount, user.currency, uplineUser.currency);

        // PHASE E: Balance Update & Auto-Upgrade Trigger
        if (eligibility.status === 'Approved') {
            uplineUser.walletBalance = Number((uplineUser.walletBalance + finalConvertedAmount).toFixed(2));
            await Notification.create({ 
                userId: uplineUser._id, 
                message: `You earned a Level ${level + 1} commission of ${uplineUser.currency}${finalConvertedAmount.toFixed(2)} from ${user.username}.` 
            });
        } 
        else if (eligibility.status === 'Pending') {
            if (isHoldSlot) {
                // ADD TO RESERVOIR
                uplineUser.heldBalance = Number((uplineUser.heldBalance + finalConvertedAmount).toFixed(2));
                
                // CHECK AUTO-UPGRADE
                const sponsorMatchingActivePlan = (uplineUser.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
                const planConfig = sponsorMatchingActivePlan ? allPlans.find(p => p._id.toString() === String(sponsorMatchingActivePlan.planId)) : null;

                if (planConfig?.autoUpgrade?.enabled) {
                    const toId = planConfig.autoUpgrade.toPlanId;
                    const upgradePlan = allPlans.find(p => p._id.toString() === String(toId));
                    
                    if (upgradePlan && uplineUser.heldBalance >= upgradePlan.price) {
                        uplineUser.heldBalance = Number((uplineUser.heldBalance - upgradePlan.price).toFixed(2));
                        // Recursively activate the new plan for the sponsor
                        await executePlanPurchase(uplineUser, upgradePlan, 'auto', settings, exchangeRates, defaultRates, allPlans);
                        await createLog('Auto-Upgrade', uplineUser.username, `Auto-upgraded to ${upgradePlan.name} using reserved funds.`, 'system');
                    }
                }
            }
            
            await Notification.create({ 
                userId: uplineUser._id, 
                message: `${eligibility.message || 'Commission Held!'}. Amount reserved: ${uplineUser.currency}${finalConvertedAmount.toFixed(2)}` 
            });
        }

        await Transaction.create({
            userId: uplineUser._id,
            userName: uplineUser.username,
            currency: uplineUser.currency,
            type: 'Commission',
            amount: finalConvertedAmount,
            level: level + 1,
            sourceUserId: user._id,
            description: eligibility.message || `Level ${level + 1} Commission from ${user.username} (${plan.name})`,
            status: eligibility.status,
            relatedPlanId: plan._id,
            originalAmount: rawAmount,
            originalCurrency: user.currency,
            exchangeRate: exchangeRates[user.currency.toUpperCase()] || 1,
            isHoldPosition: isHoldSlot 
        });
        
        await uplineUser.save();
        currentUplineUsername = uplineUser.sponsor;
    }
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

/**
 * ADMIN MANUAL ACTIVATION
 */
export const adminActivatePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        
        const alreadyOwnsPlan = user.activePlans && user.activePlans.some(p => String(p.planId) === String(plan._id));
        if (alreadyOwnsPlan) {
            return res.status(400).json({ success: false, error: `User already owns the ${plan.name} plan.` });
        }

        const settingsDoc = await Setting.getSettings();
        const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc;
        const allPlans = await InvestmentPlan.find();

        // Use unified activation logic with 'admin' trigger (amount 0)
        const { user: updatedUser, transaction } = await executePlanPurchase(
            user, plan, 'admin', settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans
        );
        
        await createLog('Plan Activated', user.username, `Admin manually activated ${plan.name} plan.`, 'admin');

        res.status(200).json({ success: true, data: { user: updatedUser, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

/**
 * USER PURCHASE HANDLER
 */
export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        
        if (user.currency !== plan.currency) {
            return res.status(400).json({ success: false, error: `This plan is in ${plan.currency}, but your account is in ${user.currency}.` });
        }

        const alreadyOwnsPlan = user.activePlans && user.activePlans.some(p => String(p.planId) === String(plan._id));
        if (alreadyOwnsPlan) {
            return res.status(400).json({ success: false, error: `You have already purchased the ${plan.name} plan.` });
        }

        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        
        // Deduct Balance
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        
        const settingsDoc = await Setting.getSettings(); 
        const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc; 
        const allPlans = await InvestmentPlan.find(); 

        // Use unified activation logic with 'user' trigger (amount -price)
        const { user: updatedUser, transaction } = await executePlanPurchase(
            user, plan, 'user', settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans
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
