
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

const getEquivalentIds = (planId, settings, allPlans) => {
    const ids = new Set([String(planId)]);
    const group = settings.planEquivalencyGroups?.find(g =>
        String(g.usdPlanId) === String(planId) ||
        String(g.pkrPlanId) === String(planId) ||
        String(g.eurPlanId) === String(planId)
    );
    if (group) {
        if (group.usdPlanId) ids.add(String(group.usdPlanId));
        if (group.pkrPlanId) ids.add(String(group.pkrPlanId));
        if (group.eurPlanId) ids.add(String(group.eurPlanId));
    }
    return ids;
};

const checkAndTriggerAutoUpgrade = async (user, sourcePlan, settings, allPlans) => {
    if (!sourcePlan.autoUpgrade?.enabled || !sourcePlan.autoUpgrade?.toPlanId) return;

    const contextIds = Array.from(getEquivalentIds(sourcePlan._id, settings, allPlans));

    const heldTransactions = await Transaction.find({
        userId: user._id,
        type: 'Commission',
        status: 'Pending',
        relatedPlanId: { $in: contextIds },
        description: { $regex: /Hold:/ }
    });

    const totalHeld = heldTransactions.reduce((sum, t) => sum + t.amount, 0);

    const targetPlan = await InvestmentPlan.findById(sourcePlan.autoUpgrade.toPlanId);
    if (!targetPlan) return;

    if (totalHeld >= targetPlan.price) {
        user.activePlans.push({
            planId: targetPlan._id,
            planName: targetPlan.name,
            price: targetPlan.price,
            purchaseDate: Date.now()
        });
        user.activePlan = targetPlan.name;
        await user.save();

        for (const tx of heldTransactions) {
            tx.status = 'Approved';
            tx.description = tx.description.replace('Hold:', 'Used for Upgrade:');
            await tx.save();
        }

        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Plan Purchase',
            amount: 0, 
            description: `Auto-Upgrade to ${targetPlan.name} (Funded by held commissions)`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            subject: '🚀 Account Upgraded!',
            message: `Congratulations! Your held commissions reached ${user.currency} ${targetPlan.price.toFixed(2)} and you have been automatically upgraded to the ${targetPlan.name} plan.`,
            isPopup: true
        });
        
        await createLog('Auto-Upgrade', user.username, `Upgraded to ${targetPlan.name} via held funds`, 'system');
    }
};

const distributeCommissions = async (buyer, plan) => {
    const settings = await Setting.getSettings();
    let currentSponsorName = buyer.sponsor;
    let level = 1;
    const allPlans = await InvestmentPlan.find();

    while (currentSponsorName && level <= 10) {
        const sponsor = await User.findOne({ username: currentSponsorName });
        if (!sponsor) break;

        let isEligible = true;
        let holdReason = '';
        let status = 'Approved';
        let isHoldPosition = false;

        if (sponsor.restrictions?.earning) {
            isEligible = false;
            holdReason = 'Account Restricted';
        }

        if (isEligible && settings.requireActivePlanForCommission && (!sponsor.activePlans || sponsor.activePlans.length === 0)) {
            isEligible = false;
            holdReason = 'No Active Plan';
        }

        if (isEligible && settings.requirePlanMatchForCommission) {
            const equivIds = getEquivalentIds(plan._id, settings, allPlans);
            const hasMatch = sponsor.activePlans?.some(ap => equivIds.has(String(ap.planId)));
            if (!hasMatch) {
                isEligible = false;
                holdReason = 'Plan Mismatch';
            }
        }

        let commissionConfig = null;
        if (level === 1) {
            const slotOccupyingTransactions = await Transaction.countDocuments({
                userId: sponsor._id,
                type: 'Commission',
                level: 1,
                status: { $in: ['Approved', 'Pending'] },
                relatedPlanId: { $in: Array.from(getEquivalentIds(plan._id, settings, allPlans)) }
            });

            const currentSlot = slotOccupyingTransactions + 1;

            if (plan.directReferralLimit > 0 && currentSlot > plan.directReferralLimit) {
                if (plan.overflowEnabled) {
                    await Transaction.create({
                        userId: sponsor._id,
                        userName: sponsor.username,
                        currency: sponsor.currency,
                        type: 'Commission',
                        amount: 0,
                        status: 'Rejected',
                        description: `Overflow: Direct limit (${plan.directReferralLimit}) reached for ${plan.name}`,
                        level: 1,
                        sourceUserId: buyer._id,
                        relatedPlanId: plan._id
                    });
                }
                currentSponsorName = sponsor.sponsor;
                level++;
                continue;
            }

            if (plan.holdPosition?.enabled && plan.holdPosition.slots.includes(currentSlot)) {
                isHoldPosition = true;
                status = 'Pending';
                holdReason = `Hold: Slot #${currentSlot} Reserved for Upgrade`;
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

            if (!isEligible && !isHoldPosition) status = 'Pending';

            await Transaction.create({
                userId: sponsor._id,
                userName: sponsor.username,
                currency: sponsor.currency,
                type: 'Commission',
                amount: Number(commissionAmount.toFixed(2)),
                status,
                description: holdReason || `Commission from ${buyer.username} (Level ${level})`,
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

            if (isHoldPosition) {
                await checkAndTriggerAutoUpgrade(sponsor, plan, settings, allPlans);
            }
        }
        if (settings.requireUplineEligibility && !isEligible) break;
        currentSponsorName = sponsor.sponsor;
        level++;
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await User.find().sort({ registrationDate: -1 });
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createUser = async (req, res) => {
    try {
        const user = await User.create(req.body);
        await createLog('User Created', user.username, 'Admin created new user manually', 'admin');
        res.status(201).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        const userObj = user.toObject();
        delete userObj.password;
        res.status(200).json({ success: true, data: userObj });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        
        const userBeforeUpdate = userToUpdate.toObject();
        Object.assign(userToUpdate, req.body);
        const updatedUser = await userToUpdate.save();

        if (req.body.status && req.body.status !== userBeforeUpdate.status) {
            await Notification.create({ userId: updatedUser._id, message: `Your account status is now ${updatedUser.status}.` });
        }

        res.status(200).json({ success: true, data: updatedUser });
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
        await user.save();

        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: amount >= 0 ? 'Manual Credit' : 'Manual Debit',
            amount,
            description: description || 'Admin adjustment',
            status: 'Approved'
        });

        await createLog('Wallet Adjusted', user.username, `Amount: ${amount}, Desc: ${description}`, 'admin');
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found' });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient balance' });

        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: Date.now() });
        user.activePlan = plan.name;
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

        await distributeCommissions(user, plan);
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found' });

        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: Date.now() });
        user.activePlan = plan.name;
        await user.save();

        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Plan Purchase',
            amount: 0,
            description: `Manual Activation: ${plan.name}`,
            status: 'Approved'
        });

        await distributeCommissions(user, plan);
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const adminRemoveUserPlan = async (req, res) => {
    const { reason } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const planInstance = user.activePlans.id(req.params.planInstanceId);
        if (!planInstance) return res.status(404).json({ success: false, error: 'Plan not found' });

        const planName = planInstance.planName;
        user.activePlans.pull(req.params.planInstanceId);
        await user.save();

        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Plan Removal',
            amount: 0,
            description: `Admin removed ${planName}. Reason: ${reason}`,
            status: 'Approved'
        });

        await Notification.create({ userId: user._id, message: `Admin removed your ${planName} plan. Reason: ${reason}` });
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        await User.deleteMany({ _id: { $in: req.body.ids } });
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const bulkUpdateRestrictions = async (req, res) => {
    const { targetType, targetIds, restrictions, action } = req.body;
    try {
        let query = {};
        if (targetType === 'single') query = { _id: { $in: targetIds } };
        else if (targetType === 'plan') query = { 'activePlans.planId': { $in: targetIds } };
        
        const users = await User.find(query);
        for (const user of users) {
            Object.keys(restrictions).forEach(key => {
                if (action === 'enable') user.restrictions[key] = false;
                else if (action === 'disable') user.restrictions[key] = true;
                else user.restrictions[key] = !user.restrictions[key];
            });
            await user.save();
        }
        res.status(200).json({ success: true, message: 'Restrictions updated' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) {
            await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        }
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const token = randomBytes(20).toString('hex');
        const user = await User.findById(req.params.id);
        user.passwordResetToken = createHash('sha256').update(token).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save();
        res.status(200).json({ success: true, data: { resetToken: token } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const verifyAndStartResetTimer = async (req, res) => {
    const token = createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, error: 'Invalid/Expired' });
    res.status(200).json({ success: true });
};

export const resetPasswordWithToken = async (req, res) => {
    const token = createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, error: 'Invalid/Expired' });
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.status(200).json({ success: true });
};
