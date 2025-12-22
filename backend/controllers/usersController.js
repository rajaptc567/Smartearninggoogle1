
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

// ... (previous functions: createUser, loginUser, getUsers, getUser)

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
                if (canReleaseCommission(comm, updatedUser, settings, allPlans)) {
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

// @desc    Admin manually removes an active plan from a user
// @route   DELETE /api/v1/users/:id/plans/:planInstanceId
export const adminRemoveUserPlan = async (req, res) => {
    const { reason } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const planInstance = user.activePlans.id(req.params.planInstanceId);
        if (!planInstance) return res.status(404).json({ success: false, error: 'Plan instance not found on user account' });

        const planName = planInstance.planName;
        
        // Remove from activePlans array
        user.activePlans.pull(req.params.planInstanceId);
        
        // Update activePlan string field if it matched
        if (user.activePlan === planName) {
            user.activePlan = user.activePlans.length > 0 ? user.activePlans[user.activePlans.length - 1].planName : 'None';
        }

        await user.save();

        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Plan Removal',
            amount: 0,
            description: `Admin removed ${planName} plan. Reason: ${reason || 'Manual removal by admin'}`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            message: `Administrator has removed the ${planName} plan from your account. Reason: ${reason || 'Administrative action.'}`
        });

        await createLog('Plan Removed', user.username, `Admin removed ${planName} plan. Purpose: ${reason}`, 'admin');

        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ... (rest of the file: bulkUpdateRestrictions, deleteUser, bulkDeleteUsers, adjustWallet, distributeCommissions, adminActivatePlan, purchasePlan, userRequestPasswordReset, adminInitiatePasswordReset, verifyAndStartResetTimer, resetPasswordWithToken)
