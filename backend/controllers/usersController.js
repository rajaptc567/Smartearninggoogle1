
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

// Helper to get all equivalent plan IDs for a given plan
const getEquivalentIds = (planId, settings) => {
    const ids = new Set([String(planId)]);
    if (settings.planEquivalencyGroups) {
        const group = settings.planEquivalencyGroups.find(g =>
            String(g.usdPlanId) === String(planId) ||
            String(g.pkrPlanId) === String(planId) ||
            String(g.eurPlanId) === String(planId)
        );
        if (group) {
            if (group.usdPlanId) ids.add(String(group.usdPlanId));
            if (group.pkrPlanId) ids.add(String(group.pkrPlanId));
            if (group.eurPlanId) ids.add(String(group.eurPlanId));
        }
    }
    return ids;
};

// Helper to calculate and distribute commissions
const distributeCommissions = async (buyer, plan) => {
    const settings = await Setting.getSettings();
    let currentSponsorName = buyer.sponsor;
    let level = 1;

    while (currentSponsorName && level <= 10) {
        const sponsor = await User.findOne({ username: currentSponsorName });
        if (!sponsor) break;

        let isEligible = true;
        let holdReason = '';
        let status = 'Approved';
        let currentSlot = 0;

        // Eligibility Checks
        if (sponsor.restrictions?.earning) {
            isEligible = false;
            holdReason = 'Account Restricted';
        }

        if (isEligible && settings.requireActivePlanForCommission && (!sponsor.activePlans || sponsor.activePlans.length === 0)) {
            isEligible = false;
            holdReason = 'No Active Plan';
        }

        if (isEligible && settings.requirePlanMatchForCommission) {
            const equivIds = getEquivalentIds(plan._id, settings);
            const hasMatch = sponsor.activePlans?.some(ap => equivIds.has(String(ap.planId)));
            if (!hasMatch) {
                isEligible = false;
                holdReason = 'Plan Mismatch';
            }
        }

        let commissionConfig = null;
        if (level === 1) {
            // Count total successful/held commissions on this equivalent track to find the Slot #
            const equivIds = getEquivalentIds(plan._id, settings);
            const existingCommsCount = await Transaction.countDocuments({
                userId: sponsor._id,
                type: 'Commission',
                level: 1,
                relatedPlanId: { $in: Array.from(equivIds) }
            });

            currentSlot = existingCommsCount + 1;
            const limit = plan.directReferralLimit || 0;

            // OVERFLOW LOGIC
            if (limit > 0 && currentSlot > limit) {
                if (plan.overflowEnabled) {
                    await Transaction.create({
                        userId: sponsor._id,
                        userName: sponsor.username,
                        currency: sponsor.currency,
                        type: 'Commission',
                        amount: 0,
                        status: 'Rejected',
                        description: `Overflow: Limit reached for ${plan.name} (Slot #${currentSlot})`,
                        level: 1,
                        sourceUserId: buyer._id,
                        relatedPlanId: plan._id
                    });
                }
                currentSponsorName = sponsor.sponsor;
                level++;
                continue;
            }

            // HOLD POSITION LOGIC
            if (plan.holdPosition?.enabled && plan.holdPosition.slots.includes(currentSlot)) {
                status = 'Pending';
                holdReason = `Hold Commission: Slot #${currentSlot} Reserved for Auto-Upgrade`;
            }

            commissionConfig = plan.directCommissions[Math.min(currentSlot - 1, plan.directCommissions.length - 1)];
        } else {
            commissionConfig = plan.indirectCommissions[level - 2];
        }

        if (commissionConfig) {
            let commissionAmount = commissionConfig.type === 'percentage' 
                ? (plan.price * commissionConfig.value) / 100 
                : commissionConfig.value;

            if (sponsor.currency !== plan.currency) {
                const rateFrom = settings.exchangeRates[plan.currency] || 1;
                const rateTo = settings.exchangeRates[sponsor.currency] || 1;
                commissionAmount = (commissionAmount / rateFrom) * rateTo;
            }

            if (!isEligible && !holdReason) {
                status = 'Pending';
                holdReason = `Held: Eligibility Criteria Not Met (Level ${level})`;
            }

            const desc = holdReason || `Commission from ${buyer.username} (Level ${level}${level === 1 ? `, Slot #${currentSlot}` : ''})`;

            await Transaction.create({
                userId: sponsor._id,
                userName: sponsor.username,
                currency: sponsor.currency,
                type: 'Commission',
                amount: Number(commissionAmount.toFixed(2)),
                status,
                description: desc,
                level,
                sourceUserId: buyer._id,
                relatedPlanId: plan._id,
                originalAmount: commissionConfig.type === 'percentage' ? plan.price : commissionConfig.value,
                originalCurrency: plan.currency
            });

            if (status === 'Approved') {
                sponsor.walletBalance = Number((sponsor.walletBalance + commissionAmount).toFixed(2));
                await sponsor.save();
            }
        }

        if (settings.requireUplineEligibility && !isEligible) break;

        currentSponsorName = sponsor.sponsor;
        level++;
    }
};

export const manualUpgradeFromHold = async (req, res) => {
    try {
        const { userId, fromPlanId } = req.body;
        const user = await User.findById(userId);
        const sourcePlan = await InvestmentPlan.findById(fromPlanId);
        
        if (!user || !sourcePlan) {
            return res.status(404).json({ success: false, error: 'User or Plan not found' });
        }

        if (!sourcePlan.autoUpgrade?.enabled || !sourcePlan.autoUpgrade?.toPlanId) {
            return res.status(400).json({ success: false, error: 'This plan is not configured for auto-upgrade.' });
        }

        const targetPlan = await InvestmentPlan.findById(sourcePlan.autoUpgrade.toPlanId);
        if (!targetPlan) return res.status(404).json({ success: false, error: 'Target upgrade plan not found.' });

        // 1. Gather all pending 'Hold' commissions for this user and plan
        const heldTransactions = await Transaction.find({
            userId: user._id,
            status: 'Pending',
            relatedPlanId: fromPlanId,
            description: { $regex: /Hold Commission/ }
        });

        const totalHeld = heldTransactions.reduce((sum, tx) => sum + tx.amount, 0);

        // 2. Activate Plan
        user.activePlans.push({
            planId: targetPlan._id,
            planName: targetPlan.name,
            price: targetPlan.price,
            purchaseDate: new Date()
        });

        // 3. Update transactions to show they were used
        for (const tx of heldTransactions) {
            tx.status = 'Approved';
            tx.description = tx.description.replace('Hold Commission:', 'Used for Upgrade:');
            await tx.save();
        }

        await user.save();

        // 4. Create Activation Record
        const upgradeTx = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Plan Purchase',
            amount: 0,
            status: 'Approved',
            description: `Upgrade Activation: ${targetPlan.name} (Using ${user.currency}${totalHeld.toFixed(2)} held funds)`
        });

        await Notification.create({
            userId: user._id,
            message: `Congratulations! You have been upgraded to ${targetPlan.name}.`,
            isPopup: true
        });

        await createLog('Manual Upgrade Triggered', user.username, `Upgraded from ${sourcePlan.name} to ${targetPlan.name}`, req.body.adminUsername || 'admin');

        res.status(200).json({ success: true, data: { user, transaction: upgradeTx } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await User.find().sort({ registrationDate: -1 });
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createUser = async (req, res) => {
    try {
        const user = await User.create(req.body);
        await createLog('User Created', user.username, `Registration`, 'system');
        res.status(201).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        await User.deleteMany({ _id: { $in: req.body.ids } });
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        user.walletBalance = Number((user.walletBalance + req.body.amount).toFixed(2));
        await user.save();
        const transaction = await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: req.body.amount >= 0 ? 'Manual Credit' : 'Manual Debit',
            amount: req.body.amount, status: 'Approved', description: req.body.description
        });
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found' });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient balance' });
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price });
        await user.save();
        const transaction = await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: 'Plan Purchase', amount: -plan.price, status: 'Approved', description: `Purchased ${plan.name} plan`
        });
        await distributeCommissions(user, plan);
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found' });
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price });
        await user.save();
        const transaction = await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: 'Plan Purchase', amount: 0, status: 'Approved', description: `Manual Activation: ${plan.name}`
        });
        await distributeCommissions(user, plan);
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminRemoveUserPlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        user.activePlans = user.activePlans.filter(p => String(p._id) !== String(req.params.planInstanceId));
        await user.save();
        res.status(200).json({ success: true, data: { user } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const token = randomBytes(20).toString('hex');
        const user = await User.findById(req.params.id);
        user.passwordResetToken = createHash('sha256').update(token).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save();
        res.status(200).json({ success: true, data: { resetToken: token } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const token = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Token invalid or expired' });
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.status(200).json({ success: true }); // Secure response
        await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const token = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token' });
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetIds, restrictions, action } = req.body;
        const update = action === 'enable' ? { $set: { restrictions } } : { $set: { restrictions } };
        await User.updateMany({ _id: { $in: targetIds } }, update);
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
