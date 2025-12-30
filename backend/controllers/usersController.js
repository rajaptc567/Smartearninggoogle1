
import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; // Import Setting model
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
            // Default to USD for rest of world
            currency = 'USD';
        }
        req.body.currency = currency;


        // Initialize activePlans as empty array
        req.body.activePlans = [];
        // Initialize restrictions
        req.body.restrictions = {
            deposit: false,
            withdrawal: false,
            transfer: false,
            earning: false,
            dispute: false,
            excludeFromTicker: false
        };

        const user = await User.create(req.body);
        
        // Create Welcome Notification
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

// Helper function for checking commission release eligibility with slot limit enforcement
const canReleaseCommission = async (commission, user, settings, allPlans) => {
    if (commission.status !== 'Pending') return false;

    let canRelease = true;
    let targetPlanId = commission.relatedPlanId ? String(commission.relatedPlanId) : null;
    
    if (settings.requirePlanMatchForCommission && targetPlanId) {
        // Find the equivalency group this plan belongs to
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

        // --- SLOT LIMIT CHECK DURING RELEASE ---
        if (commission.level === 1) {
             const activePlan = (user.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
             if (!activePlan) return false;

             const planConfig = allPlans.find(p => p._id.toString() === String(activePlan.planId));
             const limit = planConfig?.directReferralLimit || 0;

             if (limit > 0) {
                 // Important: Exclude the current commission transaction itself from the count 
                 // to see if there is ROOM for it.
                 const approvedCount = await Transaction.countDocuments({
                     _id: { $ne: commission._id },
                     userId: user._id,
                     type: 'Commission',
                     relatedPlanId: { $in: equivIds },
                     level: 1,
                     status: 'Approved'
                 });

                 if (approvedCount >= limit) {
                     // This commission is now an overflow because slots were filled while it was held
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
        // Make a plain copy for comparisons before any changes are applied
        const userBeforeUpdate = userToUpdate.toObject();

        // Handle Status Change Notifications
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

        // Handle Security/Profile Change Notifications
        if (req.body.phone && req.body.phone !== userBeforeUpdate.phone) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your contact phone number was updated.` }); }
        if (req.body.password) { await Notification.create({ userId: userBeforeUpdate._id, message: `Your account password has been changed.` }); }
        
        // Handle Granular Restrictions Notifications
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

        // --- Currency Conversion Logic ---
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

        // Apply all updates from the request body to the Mongoose document
        Object.assign(userToUpdate, req.body);

        // If currency is changing, convert the wallet balance BEFORE saving
        if (oldCurrency !== newCurrency) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates;
            // Convert old balance to USD, then from USD to new currency
            const balanceInUSD = oldBalance / (rates[oldCurrency] || 1);
            const newBalance = balanceInUSD * (rates[newCurrency] || 1);
            userToUpdate.walletBalance = Number(newBalance.toFixed(2));
        }

        // Save the user. The pre-save hook will handle setting the currency field and hashing the password.
        let updatedUser = await userToUpdate.save();

        // --- Post-Save Historical Data Conversion ---
        if (oldCurrency !== newCurrency) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates;
            // Calculate direct conversion factor: (new rate / old rate) relative to USD base
            const conversionRate = (rates[newCurrency] || 1) / (rates[oldCurrency] || 1);

            // Use updateMany for efficiency
            await Deposit.updateMany({ userId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate }, $set: { currency: newCurrency } });
            await Withdrawal.updateMany({ userId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate, fee: conversionRate, finalAmount: conversionRate, matchRemainingAmount: conversionRate }, $set: { currency: newCurrency } });
            await Transaction.updateMany({ userId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate }, $set: { currency: newCurrency } });
            await Transaction.updateMany({ userId: updatedUser._id, originalCurrency: oldCurrency }, { $mul: { originalAmount: conversionRate }, $set: { originalCurrency: newCurrency } });
            await Transfer.updateMany({ senderId: updatedUser._id, currency: oldCurrency }, { $mul: { amount: conversionRate, fee: conversionRate, totalDeducted: conversionRate }, $set: { currency: newCurrency } });
            await Transfer.updateMany({ recipientId: updatedUser._id, currency: updatedUser.currency === 'USD' ? 'USD' : (updatedUser.currency === 'PKR' ? 'PKR' : 'EUR') }, { $mul: { amount: conversionRate, fee: conversionRate, totalDeducted: conversionRate }, $set: { currency: newCurrency } });

            await createLog('User Currency Change', updatedUser.username, `Admin changed country to ${updatedUser.country}, converting records from ${oldCurrency} to ${newCurrency}.`, 'admin');
            await Notification.create({ userId: updatedUser._id, message: `Your account currency has been updated to ${newCurrency}. Your balance and history have been converted.` });
        }
        
        // --- RELEASE LOGIC: If earning restriction was removed, release pending commissions ---
        if (req.body.restrictions && req.body.restrictions.earning === false && userBeforeUpdate.restrictions?.earning === true) {
            const settings = await Setting.getSettings();
            const allPlans = await InvestmentPlan.find(); // Fetch all plans for equivalency check
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
                updatedUser = await updatedUser.save(); // Re-save to finalize balance
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

// @desc    Bulk update user restrictions
// @route   PUT /api/v1/users/bulk-restrictions
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
        const allPlans = await InvestmentPlan.find(); // Fetch for equivalency check
        
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
                    if (action === 'enable') newValue = true; // Blocked/Enabled Restriction
                    else if (action === 'disable') newValue = false; // Allowed/Disabled Restriction
                    else if (action === 'toggle') newValue = !currentRestrictions[key];
                    
                    if (currentRestrictions[key] !== newValue) {
                        // Logic for Earning Unblock
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
                
                // --- RELEASE LOGIC START ---
                if (shouldReleaseCommissions) {
                    const pendingCommissions = await Transaction.find({
                        userId: user._id,
                        type: 'Commission',
                        status: 'Pending'
                    });

                    let releasedAmount = 0;

                    for (const comm of pendingCommissions) {
                       if (await canReleaseCommission(comm, user, settings, allPlans)) {
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
                // --- RELEASE LOGIC END ---

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

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
export const deleteUser = async (req, res) => {
    try {
        // Cascade Delete: Find the user first to get IDs needed for cleanup
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });

        // 1. Delete Associated Data
        await Deposit.deleteMany({ userId: user._id });
        await Withdrawal.deleteMany({ userId: user._id });
        await Transaction.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });
        await PasswordResetRequest.deleteMany({ userId: user._id });
        await Transfer.deleteMany({ $or: [{ senderId: user._id }, { recipientId: user._id }] });

        // 2. Finally, delete the user
        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Bulk Delete Users
// @route   DELETE /api/v1/users/bulk
export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ success: false, error: 'Please provide an array of user IDs.' });
        }

        // Perform cascading deletes for all IDs
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

// @desc    Admin manually adjusts user wallet
// @route   POST /api/v1/users/:id/adjust-wallet
export const adjustWallet = async (req, res) => {
    const { amount, description } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
        const updatedUser = await user.save(); // Capture the saved document which includes hook modifications

        const transaction = await Transaction.create({
            userId: updatedUser._id,
            userName: updatedUser.username,
            currency: updatedUser.currency, // Use currency from the reliably saved user object
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

// Helper function to distribute commissions (Reused by purchasePlan and adminActivatePlan)
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
            const referralPlanId = purchasePlanId.toString();
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

        if (level === 0) { // Direct Commission Logic
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
            
            // Limit is enforced ONLY if the sponsor has a plan in the matching group.
            const sponsorPlanConfig = sponsorMatchingActivePlan 
                ? allPlans.find(p => p._id.toString() === sponsorMatchingActivePlan.planId.toString())
                : null;

            if (sponsorPlanConfig) {
                const limit = sponsorPlanConfig.directReferralLimit || 0;
                
                // --- ROBUST SLOT COUNTING ---
                // Query only Level 1 direct commissions (Approved or Pending) for THIS plan group.
                referralCount = await Transaction.countDocuments({
                    userId: uplineUser._id,
                    type: 'Commission',
                    relatedPlanId: { $in: equivIds },
                    level: 1,
                    status: { $in: ['Approved', 'Pending'] }
                });

                if (limit > 0 && referralCount >= limit) {
                    const currentSlotNum = referralCount + 1;
                    const overflowDescription = `[Overflow] Slot #${currentSlotNum} from ${user.username} - Limit (${limit}) Reached`;
                    
                    await Transaction.create({
                        userId: uplineUser._id,
                        userName: uplineUser.username,
                        currency: uplineUser.currency,
                        type: 'Commission',
                        amount: 0,
                        level: 1,
                        sourceUserId: user._id,
                        description: overflowDescription,
                        status: 'Rejected',
                        relatedPlanId: plan._id
                    });
                    
                    await Notification.create({
                        userId: uplineUser._id,
                        subject: 'Referral Limit Reached',
                        message: `⚠️ Slot Limit Reached! Your referral ${user.username} activated '${plan.name}', but your ${limit} direct slots for this level are full.`
                    });
                    
                    currentUplineUsername = uplineUser.sponsor;
                    continue; 
                }
            }

            // Calculate commission value
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
        
        // --- ONE-TIME RULE BYPASS FOR RECURRING PLANS ---
        if (settings.oneTimeCommissionPerGroup) {
            const sponsorActivePlanIds = (uplineUser.activePlans || []).map(p => p.planId.toString());
            const recurringPlanIds = settings.recurringCommissionPlanIds || [];
            
            // Check if sponsor owns any plan listed as a Recurring Commission Plan
            const sponsorHasRecurringRights = sponsorActivePlanIds.some(id => recurringPlanIds.includes(id));

            if (!sponsorHasRecurringRights) {
                // If NO recurring rights, enforce one-time restriction
                const existingCommission = await Transaction.findOne({
                    userId: uplineUser._id,
                    sourceUserId: user._id,
                    type: 'Commission',
                    status: { $in: ['Approved', 'Pending'] },
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
            await uplineUser.save();
            await Notification.create({ userId: uplineUser._id, message: `You earned a Level ${level + 1} commission of ${uplineUser.currency}${finalAmount.toFixed(2)} from ${user.username}.` });
        } else if (eligibility.status === 'Pending') {
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
            exchangeRate: exchangeRates[user.currency.toUpperCase()] || 1
        });
        
        currentUplineUsername = uplineUser.sponsor;
    }
};

// @desc    Admin manually activates a plan for a user (No deduction)
// @route   POST /api/v1/users/:id/activate-plan
export const adminActivatePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        
        // Currency Check
        if (user.currency !== plan.currency) {
            return res.status(400).json({ success: false, error: `This plan is in ${plan.currency}, but user account is in ${user.currency}.` });
        }

        const alreadyOwnsPlan = user.activePlans && user.activePlans.some(p => p.planId.toString() === plan._id.toString());
        if (alreadyOwnsPlan) {
            return res.status(400).json({ success: false, error: `User already owns the ${plan.name} plan.` });
        }

        // Add to Active Plans (Admin Grant)
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
            amount: 0,
            description: `Admin manually activated ${plan.name} plan`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            message: `Administrator has manually activated the ${plan.name} plan for your account.`
        });

        const settingsDoc = await Setting.getSettings();
        const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc;
        const allPlans = await InvestmentPlan.find();

        // --- RELEASE HELD COMMISSIONS LOGIC ---
        const heldCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
        if (heldCommissions.length > 0) {
            let totalReleased = 0;
            for (const comm of heldCommissions) {
                if (await canReleaseCommission(comm, user, settings, allPlans)) {
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
                    message: `Manual activation of ${plan.name} has unlocked ${user.currency}${totalReleased.toFixed(2)} in previously held commissions.`
                });
            }
        }

        // --- COMMISSION DISTRIBUTION LOGIC ---
        await distributeCommissions(user, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        
        await createLog('Plan Activated', user.username, `Admin manually activated ${plan.name} plan.`, 'admin');

        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    User purchases an investment plan
// @route   POST /api/v1/users/:id/purchase-plan
export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        
        const settingsDoc = await Setting.getSettings(); // Fetch settings for commission logic
        const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc; 
        const exchangeRates = settings.exchangeRates || {};
        const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.50 };

        const allPlans = await InvestmentPlan.find(); // Fetch all plans for equivalency check

        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        
        // Currency Check
        if (user.currency !== plan.currency) {
            return res.status(400).json({ success: false, error: `This plan is in ${plan.currency}, but your account is in ${user.currency}.` });
        }

        // Check if user already owns this specific plan
        const alreadyOwnsPlan = user.activePlans && user.activePlans.some(p => p.planId.toString() === plan._id.toString());
        if (alreadyOwnsPlan) {
            return res.status(400).json({ success: false, error: `You have already purchased the ${plan.name} plan. You cannot purchase the same plan twice.` });
        }

        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        
        // 1. Deduct Balance - Precision Fix
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        
        // 2. Add to Active Plans
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
            amount: -plan.price,
            description: `Purchased ${plan.name} plan`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            message: `You successfully purchased the ${plan.name} plan for ${user.currency}${plan.price.toFixed(2)}.`
        });

        // --- RELEASE HELD COMMISSIONS LOGIC ---
        const heldCommissions = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });

        if (heldCommissions.length > 0) {
            let totalReleased = 0;
            for (const comm of heldCommissions) {
                if (await canReleaseCommission(comm, user, settings, allPlans)) {
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
                    message: `Congratulations! Purchasing ${plan.name} has unlocked ${user.currency}${totalReleased.toFixed(2)} in previously held commissions.`
                });
            }
        }

        // --- COMMISSION DISTRIBUTION LOGIC ---
        await distributeCommissions(user, plan, settings, exchangeRates, defaultRates, allPlans);
        
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Bulk Create Dummy Users
// @route   POST /api/v1/users/bulk-dummy
export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, sponsor, balance, country, currency, planId } = req.body;
        
        if (!count || isNaN(count) || count <= 0) {
            return res.status(400).json({ success: false, error: 'Please provide a valid count.' });
        }

        const numCount = parseInt(count);
        const numBalance = parseFloat(balance) || 0;
        
        // Find sponsor
        const sponsorUser = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
        if (!sponsorUser) {
            return res.status(404).json({ success: false, error: `Sponsor '${sponsor}' not found.` });
        }

        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const plan = planId ? await InvestmentPlan.findById(planId) : null;

        const usersCreated = [];
        
        for (let i = 0; i < numCount; i++) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const username = `dummy_${randomSuffix}_${i}`;
            const email = `dummy_${randomSuffix}_${i}@smartearning.com`;
            
            const userData = {
                fullName: `Dummy Member ${randomSuffix}`,
                username,
                email,
                password: 'password123',
                phone: `0000${randomSuffix}${i}`,
                whatsapp: `0000${randomSuffix}${i}`,
                country: country || sponsorUser.country,
                currency: currency || sponsorUser.currency,
                walletBalance: numBalance,
                sponsor: sponsorUser.username,
                status: 'Active',
                restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false }
            };

            const user = await User.create(userData);

            // If a plan is selected, activate it and trigger commissions
            if (plan) {
                user.activePlan = plan.name;
                user.activePlans.push({
                    planId: plan._id,
                    planName: plan.name,
                    price: plan.price,
                    purchaseDate: new Date()
                });
                await user.save();
                
                await distributeCommissions(user, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
            }

            usersCreated.push(user);
        }

        await createLog('Bulk Dummy Users Created', sponsorUser.username, `Created ${numCount} dummy users under sponsor ${sponsorUser.username}. Balance: ${numBalance}. Plan: ${plan?.name || 'None'}`, 'admin');

        res.status(201).json({ success: true, count: usersCreated.length, message: `Successfully created ${usersCreated.length} dummy users.` });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    User requests a password reset
// @route   POST /api/v1/users/request-password-reset
// @access  Public
export const userRequestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            // To prevent email enumeration, we send a generic success response.
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


// @desc    Admin initiates password reset for a user
// @route   POST /api/v1/users/:id/admin-reset-password
// @access  Private/Admin
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

        // Set token to expire in 48 hours
        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
        
        await user.save();
        
        await createLog('Password Reset Initiated', user.username, `Admin generated a password reset link.`, 'admin');

        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Verify token and start 10-minute timer
// @route   POST /api/v1/users/verify-reset-token/:token
// @access  Public
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

        // Token is valid, now start the 10-minute timer for the actual reset
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        res.status(200).json({ success: true, data: 'Token verified. You have 10 minutes to reset your password.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Reset password using a token
// @route   PUT /api/v1/users/reset-password/:token
// @access  Public
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

        // Set new password
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
