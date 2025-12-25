
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

// Helper to get all IDs in the same equivalency group
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

// @desc    Distribute MLM Commissions with Refined Audit Logic
const distributeCommissions = async (buyer, plan) => {
    const settings = await Setting.getSettings();
    let currentSponsorName = buyer.sponsor;
    let level = 1;

    while (currentSponsorName && level <= 10) {
        const sponsor = await User.findOne({ username: { $regex: new RegExp(`^${currentSponsorName}$`, 'i') } });
        if (!sponsor || sponsor.status === 'Blocked') break;

        const trackIds = getEquivalentIds(plan._id, settings);

        // 1. Identify the Sponsor's authoritative plan for this track
        // We pick the sponsor's matching plan with the highest price/limit to avoid false overflows
        let sponsorPlanTrack = plan; // Fallback to buyer's plan settings if sponsor has no match
        if (sponsor.activePlans && sponsor.activePlans.length > 0) {
            const matchingActivePlanEntry = sponsor.activePlans
                .filter(ap => trackIds.has(String(ap.planId)))
                .sort((a, b) => b.price - a.price)[0];
            
            if (matchingActivePlanEntry) {
                const fullDetails = await InvestmentPlan.findById(matchingActivePlanEntry.planId);
                if (fullDetails) sponsorPlanTrack = fullDetails;
            }
        }

        let status = 'Approved';
        let holdReason = '';
        let isEligible = true;

        // 2. Determine Slot Index
        // Count ALL transactions (Approved, Pending, Rejected) to maintain correct slot sequence
        let currentSlot = 0;
        if (level === 1) {
            const existingCommsCount = await Transaction.countDocuments({
                userId: sponsor._id,
                type: 'Commission',
                level: 1,
                relatedPlanId: { $in: Array.from(trackIds) },
                description: { $not: /Used for Upgrade/i }
            });
            currentSlot = existingCommsCount + 1;
        }

        // 3. Calculate Commission Amount (based on what was PAID by the buyer)
        const commConfig = level === 1 
            ? sponsorPlanTrack.directCommissions[Math.min(currentSlot - 1, sponsorPlanTrack.directCommissions.length - 1)]
            : sponsorPlanTrack.indirectCommissions[level - 2];

        if (!commConfig) {
            currentSponsorName = sponsor.sponsor;
            level++;
            continue;
        }

        let amount = commConfig.type === 'percentage' ? (plan.price * commConfig.value) / 100 : commConfig.value;
        
        // Currency conversion
        if (sponsor.currency !== plan.currency) {
            const rates = settings.exchangeRates;
            amount = (amount / (rates[plan.currency] || 1)) * (rates[sponsor.currency] || 1);
        }

        // 4. THE DECISION ENGINE (Linear Audit Order)
        
        // A. Check Overflow (Strict Denial)
        if (level === 1 && sponsorPlanTrack.directReferralLimit > 0 && currentSlot > sponsorPlanTrack.directReferralLimit) {
            status = 'Rejected';
            amount = 0;
            holdReason = `Overflow: Limit reached for ${sponsorPlanTrack.name} (Slot #${currentSlot})`;
        } 
        // B. Check Strategy Hold (Slot-Based Upgrade Strategy)
        else if (level === 1 && sponsorPlanTrack.holdPosition?.enabled && sponsorPlanTrack.holdPosition.slots.includes(currentSlot)) {
            status = 'Pending';
            holdReason = `Hold Commission for upgrade: Slot #${currentSlot} Reserved`;
        }
        // C. Check General Eligibility (Restrictions & Account Status)
        else {
            if (sponsor.restrictions?.earning) {
                isEligible = false;
                holdReason = 'Account Restricted';
            } else if (settings.requirePlanMatchForCommission) {
                const hasMatch = sponsor.activePlans?.some(ap => trackIds.has(String(ap.planId)));
                if (!hasMatch) {
                    isEligible = false;
                    holdReason = 'Plan Mismatch: Requires equivalent plan';
                }
            }

            if (!isEligible) {
                status = 'Pending';
                holdReason = `Held: ${holdReason}`;
            }
        }

        // 5. Commit to Ledger
        await Transaction.create({
            userId: sponsor._id, userName: sponsor.username, currency: sponsor.currency,
            type: 'Commission', amount: Number(amount.toFixed(2)), status,
            description: holdReason || `Commission from ${buyer.username} (Level ${level})`,
            level, sourceUserId: buyer._id, relatedPlanId: plan._id
        });

        if (status === 'Approved') {
            sponsor.walletBalance = Number((sponsor.walletBalance + amount).toFixed(2));
            await sponsor.save();
        }

        // Stop chain if upline eligibility is required and this sponsor failed
        if (settings.requireUplineEligibility && !isEligible && status !== 'Rejected') break;
        
        currentSponsorName = sponsor.sponsor;
        level++;
    }
};

// @desc    Admin manually upgrades user using held funds
// @route   POST /api/v1/users/upgrade-from-hold
export const manualUpgradeFromHold = async (req, res) => {
    try {
        const { userId, fromPlanId } = req.body;
        const user = await User.findById(userId);
        const sourcePlan = await InvestmentPlan.findById(fromPlanId);
        
        if (!user || !sourcePlan || !sourcePlan.autoUpgrade?.toPlanId) {
            return res.status(404).json({ success: false, error: 'User, Plan, or Upgrade target not found' });
        }

        const targetPlan = await InvestmentPlan.findById(sourcePlan.autoUpgrade.toPlanId);

        // Fetch pending hold commissions for this track
        const heldTxs = await Transaction.find({
            userId: user._id,
            status: 'Pending',
            relatedPlanId: fromPlanId,
            description: { $regex: /Hold Commission/i }
        });

        // Mark as Used
        for (let tx of heldTxs) {
            tx.status = 'Approved';
            tx.description = tx.description.replace('Hold Commission for upgrade:', 'Used for Upgrade:');
            await tx.save();
        }

        user.activePlans.push({
            planId: targetPlan._id,
            planName: targetPlan.name,
            price: targetPlan.price,
            purchaseDate: new Date()
        });
        
        await user.save();

        await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: 'Plan Purchase', amount: 0, status: 'Approved',
            description: `Upgrade Activation: ${targetPlan.name} (Using held funds)`
        });

        await Notification.create({
            userId: user._id,
            message: `Congratulations! You have been upgraded to ${targetPlan.name}.`,
            isPopup: true
        });

        await createLog('Admin Upgrade Forced', user.username, `Migrated from ${sourcePlan.name} to ${targetPlan.name}`, req.body.adminUsername || 'admin');

        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Admin removes a specific user plan instance
// @route   DELETE /api/v1/users/:id/plans/:planInstanceId
export const adminRemoveUserPlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        // Remove specific plan instance while keeping historical data intact
        user.activePlans = user.activePlans.filter(p => String(p._id) !== String(req.params.planInstanceId));
        await user.save();

        await createLog('Plan Instance Deleted', user.username, `Admin deleted plan instance ${req.params.planInstanceId}`, 'admin');
        
        res.status(200).json({ success: true, data: user });
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
        if (!user) return res.status(200).json({ success: true }); 
        await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetToken = async (req, res) => {
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
