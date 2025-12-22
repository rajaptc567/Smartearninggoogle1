
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

// Helper to calculate and distribute commissions
const distributeCommissions = async (buyer, plan) => {
    const settings = await Setting.getSettings();
    let currentSponsorName = buyer.sponsor;
    let level = 1;

    // Fetch all plans once to handle equivalency checks
    const allPlans = await InvestmentPlan.find();

    while (currentSponsorName && level <= 10) { // Limit depth for safety
        const sponsor = await User.findOne({ username: currentSponsorName });
        if (!sponsor) break;

        // --- CHECK ELIGIBILITY ---
        let isEligible = true;
        let holdReason = '';
        let status = 'Approved';
        let isHoldPosition = false;

        // Rule 1: Admin Restrictions
        if (sponsor.restrictions?.earning) {
            isEligible = false;
            holdReason = 'Account Restricted';
        }

        // Rule 2: Active Plan Requirement
        if (isEligible && settings.requireActivePlanForCommission && (!sponsor.activePlans || sponsor.activePlans.length === 0)) {
            isEligible = false;
            holdReason = 'No Active Plan';
        }

        // Rule 3: Plan Match / Equivalency Requirement
        if (isEligible && settings.requirePlanMatchForCommission) {
            const equivIds = getEquivalentIds(plan._id, settings, allPlans);
            const hasMatch = sponsor.activePlans?.some(ap => equivIds.has(String(ap.planId)));
            if (!hasMatch) {
                isEligible = false;
                holdReason = 'Plan Mismatch';
            }
        }

        // --- CALCULATION ---
        let commissionConfig = null;
        if (level === 1) {
            // Level 1 logic: Dynamic based on referral slot
            const directReferrals = await Transaction.countDocuments({
                userId: sponsor._id,
                type: 'Commission',
                level: 1,
                relatedPlanId: { $in: Array.from(getEquivalentIds(plan._id, settings, allPlans)) }
            });

            const currentSlot = directReferrals + 1;

            // CHECK DIRECT LIMIT & OVERFLOW
            if (plan.directReferralLimit > 0 && currentSlot > plan.directReferralLimit) {
                if (plan.overflowEnabled) {
                    await Transaction.create({
                        userId: sponsor._id,
                        userName: sponsor.username,
                        currency: sponsor.currency,
                        type: 'Commission',
                        amount: 0,
                        status: 'Rejected',
                        description: `Overflow: Direct limit reached for ${plan.name}`,
                        level: 1,
                        sourceUserId: buyer._id,
                        relatedPlanId: plan._id
                    });
                }
                // Skip further processing for this level if limit reached
                currentSponsorName = sponsor.sponsor;
                level++;
                continue;
            }

            // CHECK HOLD POSITION
            if (plan.holdPosition?.enabled && plan.holdPosition.slots.includes(currentSlot)) {
                isHoldPosition = true;
                status = 'Pending';
                holdReason = `Hold: Slot #${currentSlot} Reserved for Upgrade`;
            }

            // Get commission config
            commissionConfig = plan.directCommissions[Math.min(currentSlot - 1, plan.directCommissions.length - 1)];
        } else {
            // Indirect levels
            commissionConfig = plan.indirectCommissions[level - 2];
        }

        if (commissionConfig) {
            let commissionAmount = commissionConfig.type === 'percentage' 
                ? (plan.price * commissionConfig.value) / 100 
                : commissionConfig.value;

            // Handle Currency Conversion if needed
            if (sponsor.currency !== plan.currency) {
                const rateFrom = settings.exchangeRates[plan.currency] || 1;
                const rateTo = settings.exchangeRates[sponsor.currency] || 1;
                commissionAmount = (commissionAmount / rateFrom) * rateTo;
            }

            if (!isEligible) status = 'Pending';

            const tx = await Transaction.create({
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
        }

        // Pass-through eligibility check
        if (settings.requireUplineEligibility && !isEligible) break;

        currentSponsorName = sponsor.sponsor;
        level++;
    }
};

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

// ... (existing updateUser, adminRemoveUserPlan functions)

// @desc    Admin manually activates a plan for a user
export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found' });

        const activePlanData = {
            planId: plan._id,
            planName: plan.name,
            price: plan.price,
            purchaseDate: Date.now()
        };

        user.activePlans.push(activePlanData);
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

        // Trigger commissions
        await distributeCommissions(user, plan);

        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Purchase investment plan
export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);

        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found' });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient balance' });

        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({
            planId: plan._id,
            planName: plan.name,
            price: plan.price,
            purchaseDate: Date.now()
        });
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

        // Trigger commissions
        await distributeCommissions(user, plan);

        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
