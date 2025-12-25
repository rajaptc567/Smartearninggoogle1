
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

// Helper to get equivalent IDs for plan tracks
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

// @desc    Unlock Escrowed Commissions after upgrade (Atomic Process)
const unlockHeldCommissions = async (user, newPlanId) => {
    try {
        const settings = await Setting.getSettings();
        
        // Find all commissions held for this user
        const heldCommissions = await Transaction.find({
            userId: user._id,
            status: { $in: ['hold_upgrade', 'hold_slot'] }
        });

        let totalUnlockedAmount = 0;
        const userActivePlanIds = user.activePlans.map(ap => String(ap.planId));

        for (let tx of heldCommissions) {
            const requiredIds = getEquivalentIds(tx.required_plan_id, settings);
            const hasRequiredPlan = userActivePlanIds.some(id => requiredIds.has(id));

            if (hasRequiredPlan) {
                // Update status and credit balance
                tx.status = 'Approved';
                tx.description = `Unlocked: ${tx.description}`;
                tx.hold_reason = `Unlocked by upgrade to plan matching ${tx.required_plan_id}`;
                await tx.save();

                user.walletBalance = Number((user.walletBalance + tx.amount).toFixed(2));
                totalUnlockedAmount += tx.amount;

                await createLog('Commission Unlocked', user.username, `Tx ${tx._id} released by upgrade`, 'system');
            }
        }

        if (totalUnlockedAmount > 0) {
            await user.save();
            await Notification.create({
                userId: user._id,
                message: `Congratulations! Your upgrade released ${user.currency} ${totalUnlockedAmount.toFixed(2)} in held commissions.`
            });
        }
    } catch (err) {
        console.error('Commission Unlock Error:', err.message);
    }
};

// @desc    Distribute MLM Commissions with Mandatory Decision Tree
const distributeCommissions = async (buyer, plan) => {
    const settings = await Setting.getSettings();
    let currentSponsorName = buyer.sponsor;
    let level = 1;

    while (currentSponsorName && level <= 10) {
        const sponsor = await User.findOne({ username: { $regex: new RegExp(`^${currentSponsorName}$`, 'i') } });
        if (!sponsor || sponsor.status === 'Blocked') break;

        const trackIds = getEquivalentIds(plan._id, settings);

        // 1. Identify Authoritative Plan for this Track
        let sponsorPlanTrack = plan; 
        if (sponsor.activePlans && sponsor.activePlans.length > 0) {
            const matchingActivePlanEntry = sponsor.activePlans
                .filter(ap => trackIds.has(String(ap.planId)))
                .sort((a, b) => b.price - a.price)[0];
            
            if (matchingActivePlanEntry) {
                const fullDetails = await InvestmentPlan.findById(matchingActivePlanEntry.planId);
                if (fullDetails) sponsorPlanTrack = fullDetails;
            }
        }

        // 2. Determine Slot Index (Mandatory sequence preservation)
        // Count transactions where status is approved, hold_slot, or hold_upgrade
        let targetIndex = 0;
        if (level === 1) {
            const occupiedSlots = await Transaction.countDocuments({
                userId: sponsor._id,
                type: 'Commission',
                level: 1,
                relatedPlanId: { $in: Array.from(trackIds) },
                status: { $in: ['Approved', 'hold_slot', 'hold_upgrade'] }
            });
            targetIndex = occupiedSlots + 1;
        }

        // 3. Calculate Commission Configuration
        const commConfig = level === 1 
            ? sponsorPlanTrack.directCommissions[Math.min(targetIndex - 1, sponsorPlanTrack.directCommissions.length - 1)]
            : sponsorPlanTrack.indirectCommissions[level - 2];

        if (!commConfig) {
            currentSponsorName = sponsor.sponsor;
            level++;
            continue;
        }

        let baseAmount = commConfig.type === 'percentage' ? (plan.price * commConfig.value) / 100 : commConfig.value;
        let amount = baseAmount;
        
        // Currency conversion
        if (sponsor.currency !== plan.currency) {
            const rates = settings.exchangeRates;
            amount = (amount / (rates[plan.currency] || 1)) * (rates[sponsor.currency] || 1);
        }

        // 4. THE DECISION ENGINE (Linear Audit Order)
        let finalStatus = 'Approved';
        let holdReason = '';

        // Step A: Check Slot Strategy Hold
        const isSlotHold = level === 1 && (
            (sponsorPlanTrack.holdPosition?.enabled && sponsorPlanTrack.holdPosition.slots.includes(targetIndex)) ||
            (sponsorPlanTrack.hold_slots && sponsorPlanTrack.hold_slots.includes(targetIndex))
        );

        // Step B: Check Eligibility Hold
        let isEligible = true;
        if (sponsor.restrictions?.earning) {
            isEligible = false;
            holdReason = 'Account Restricted';
        } else if (settings.requirePlanMatchForCommission) {
            const hasMatch = sponsor.activePlans?.some(ap => trackIds.has(String(ap.planId)));
            if (!hasMatch) {
                isEligible = false;
                holdReason = 'Higher Plan Required';
            }
        }

        // 5. THE ESCROW PATH (Lossless Priority)
        if (isSlotHold || !isEligible) {
            finalStatus = isSlotHold ? 'hold_slot' : 'hold_upgrade';
            holdReason = isSlotHold ? `🔒 Held – Slot #${targetIndex} Reserved` : `🔒 Held – Upgrade Required`;
            
            await Transaction.create({
                userId: sponsor._id, userName: sponsor.username, currency: sponsor.currency,
                type: 'Commission', amount: Number(amount.toFixed(2)), original_amount: Number(amount.toFixed(2)),
                status: finalStatus, description: `Held commission from ${buyer.username} (Level ${level})`,
                level, sourceUserId: buyer._id, relatedPlanId: plan._id,
                slot_index: level === 1 ? targetIndex : undefined,
                required_plan_id: plan._id, hold_reason: holdReason, unlock_on_upgrade: true
            });
            
            // Exit chain logic if needed, but important to skip overflow check
        } 
        // 6. THE OVERFLOW PATH (Last Resort)
        else if (level === 1 && sponsorPlanTrack.directReferralLimit > 0 && targetIndex > sponsorPlanTrack.directReferralLimit) {
            await Transaction.create({
                userId: sponsor._id, userName: sponsor.username, currency: sponsor.currency,
                type: 'Commission', amount: 0, original_amount: Number(amount.toFixed(2)),
                status: 'overflow', description: `Overflow: Limit reached for ${sponsorPlanTrack.name} (Slot #${targetIndex})`,
                level, sourceUserId: buyer._id, relatedPlanId: plan._id,
                slot_index: targetIndex, hold_reason: 'Direct limit exceeded'
            });
        }
        // 7. APPROVAL
        else {
            await Transaction.create({
                userId: sponsor._id, userName: sponsor.username, currency: sponsor.currency,
                type: 'Commission', amount: Number(amount.toFixed(2)), original_amount: Number(amount.toFixed(2)),
                status: 'Approved', description: `Commission from ${buyer.username} (Level ${level})`,
                level, sourceUserId: buyer._id, relatedPlanId: plan._id,
                slot_index: level === 1 ? targetIndex : undefined
            });

            sponsor.walletBalance = Number((sponsor.walletBalance + amount).toFixed(2));
            await sponsor.save();
        }

        // Stop chain if upline eligibility is mandatory and failed
        if (settings.requireUplineEligibility && !isEligible && finalStatus !== 'overflow') break;
        
        currentSponsorName = sponsor.sponsor;
        level++;
    }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found' });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient balance' });
        
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        await user.save();

        await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: 'Plan Purchase', amount: -plan.price, status: 'Approved', description: `Purchased ${plan.name} plan`
        });

        // Trigger lossless commission distribution
        await distributeCommissions(user, plan);

        // Trigger unlock process for upline/self holds
        await unlockHeldCommissions(user, plan._id);

        res.status(200).json({ success: true, data: { user } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found' });
        
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        await user.save();

        await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: 'Plan Purchase', amount: 0, status: 'Approved', description: `Manual Activation: ${plan.name}`
        });

        await distributeCommissions(user, plan);
        await unlockHeldCommissions(user, plan._id);

        res.status(200).json({ success: true, data: { user } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
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

export const manualUpgradeFromHold = async (req, res) => {
    try {
        const { userId, fromPlanId } = req.body;
        const user = await User.findById(userId);
        const sourcePlan = await InvestmentPlan.findById(fromPlanId);
        
        if (!user || !sourcePlan || !sourcePlan.autoUpgrade?.toPlanId) {
            return res.status(404).json({ success: false, error: 'User, Plan, or Upgrade target not found' });
        }

        const targetPlan = await InvestmentPlan.findById(sourcePlan.autoUpgrade.toPlanId);

        // Mark relevant hold commissions as Approved (Manual Force)
        await Transaction.updateMany({
            userId: user._id,
            status: { $in: ['hold_upgrade', 'hold_slot'] },
            required_plan_id: fromPlanId
        }, {
            status: 'Approved',
            hold_reason: 'Forced by Admin'
        });

        user.activePlans.push({
            planId: targetPlan._id,
            planName: targetPlan.name,
            price: targetPlan.price,
            purchaseDate: new Date()
        });
        
        await user.save();
        await unlockHeldCommissions(user, targetPlan._id);

        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const adminRemoveUserPlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        user.activePlans = user.activePlans.filter(p => String(p._id) !== String(req.params.planInstanceId));
        await user.save();
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
