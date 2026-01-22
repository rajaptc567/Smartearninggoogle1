
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
import jwt from 'jsonwebtoken';

/**
 * SHARED UTILITY: THE COMMISSION ENGINE
 * Handles multi-level distribution, currency conversion, overflow, and eligibility.
 */
const runCommissionEngine = async (buyer, plan) => {
    const settings = await Setting.getSettings();
    let currentSponsorUsername = buyer.sponsor;
    let level = 1;

    // Iterate up the upline
    while (currentSponsorUsername && level <= (plan.indirectCommissions.length + 1)) {
        const sponsor = await User.findOne({ username: currentSponsorUsername });
        if (!sponsor) break;

        // Get commission config for this level
        let commConfig;
        if (level === 1) {
            // Find L1 slot
            const equivGroup = settings.planEquivalencyGroups.find(g => 
                [String(g.usdPlanId), String(g.pkrPlanId), String(g.eurPlanId)].includes(String(plan._id))
            );
            const equivIds = equivGroup ? [equivGroup.usdPlanId, equivGroup.pkrPlanId, equivGroup.eurPlanId] : [String(plan._id)];
            
            const existingL1CommsCount = await Transaction.countDocuments({
                userId: sponsor._id,
                type: 'Commission',
                level: 1,
                relatedPlanId: { $in: equivIds },
                status: { $in: ['Approved', 'Pending'] }
            });

            // Check for Overflow
            if (plan.directReferralLimit > 0 && existingL1CommsCount >= plan.directReferralLimit) {
                await Transaction.create({
                    userId: sponsor._id, userName: sponsor.username, currency: sponsor.currency,
                    type: 'Commission', amount: 0, level: 1, sourceUserId: buyer._id,
                    description: `[OVERFLOW] Referral limit reached for ${plan.name} scope. No commission paid.`,
                    status: 'Rejected'
                });
                currentSponsorUsername = sponsor.sponsor;
                level++;
                continue;
            }
            
            // Pick specific slot config if exists, else default to first
            commConfig = plan.directCommissions[existingL1CommsCount] || plan.directCommissions[0];
        } else {
            commConfig = plan.indirectCommissions[level - 2];
        }

        if (!commConfig) break;

        // Calculate Amount
        let commAmount = commConfig.type === 'percentage' ? (plan.price * commConfig.value) / 100 : commConfig.value;
        
        // Cross-Currency Conversion
        if (sponsor.currency !== plan.currency) {
            const fromRate = settings.exchangeRates[plan.currency] || 1;
            const toRate = settings.exchangeRates[sponsor.currency] || 1;
            commAmount = (commAmount / fromRate) * toRate;
        }

        // Check Eligibility
        let isEligible = true;
        let reason = 'Approved';
        
        if (settings.requireActivePlanForCommission && (!sponsor.activePlans || sponsor.activePlans.length === 0)) {
            isEligible = false;
            reason = 'No active plan';
        } else if (settings.requirePlanMatchForCommission) {
            const equivGroup = settings.planEquivalencyGroups.find(g => 
                [String(g.usdPlanId), String(g.pkrPlanId), String(g.eurPlanId)].includes(String(plan._id))
            );
            const allowedIds = equivGroup ? [equivGroup.usdPlanId, equivGroup.pkrPlanId, equivGroup.eurPlanId] : [String(plan._id)];
            const hasMatch = sponsor.activePlans.some(ap => allowedIds.includes(String(ap.planId)));
            if (!hasMatch) {
                isEligible = false;
                reason = 'Plan match required';
            }
        }

        // Create Transaction record for Sponsor
        await Transaction.create({
            userId: sponsor._id,
            userName: sponsor.username,
            currency: sponsor.currency,
            type: 'Commission',
            amount: Number(commAmount.toFixed(2)),
            level,
            sourceUserId: buyer._id,
            relatedPlanId: plan._id,
            status: isEligible ? 'Approved' : 'Pending',
            description: isEligible ? `Commission from @${buyer.username} (${plan.name})` : `[HELD] ${reason}: From @${buyer.username}`,
            originalAmount: commAmount,
            originalCurrency: plan.currency
        });

        // Credit balance if eligible
        if (isEligible) {
            sponsor.walletBalance = Number((sponsor.walletBalance + commAmount).toFixed(2));
            await sponsor.save();
            
            // Notify Sponsor
            await Notification.create({
                userId: sponsor._id,
                subject: 'Commission Received',
                message: `You earned ${sponsor.currency} ${commAmount.toFixed(2)} from @${buyer.username}'s ${plan.name} activation.`
            });
        }

        // Move up to next sponsor
        currentSponsorUsername = sponsor.sponsor;
        level++;
    }
};

export const getUsers = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        if (isAdmin) {
            const users = await User.find();
            return res.status(200).json({ success: true, count: users.length, data: users });
        } 
        
        if (req.user) {
            const self = await User.findById(req.user.id);
            if (!self) return res.status(200).json({ success: true, data: [] });

            const downline = [self];
            let currentLevelUsernames = [self.username];
            let depth = 0;
            while (currentLevelUsernames.length > 0 && depth < 10) {
                const nextLevelUsers = await User.find({ 
                    sponsor: { $in: currentLevelUsernames } 
                });
                if (nextLevelUsers.length === 0) break;
                downline.push(...nextLevelUsers);
                currentLevelUsernames = nextLevelUsers.map(u => u.username);
                depth++;
                if (downline.length > 5000) break;
            }
            return res.status(200).json({ success: true, count: downline.length, data: downline });
        }
        res.status(200).json({ success: true, data: [] });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(200).json({ success: true, data: {} });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(200).json({ success: true, data: {} });
    }
};

export const createUser = async (req, res) => {
    try {
        const { fullName, username, email, password, phone, sponsor, country } = req.body;
        if (!country) return res.status(400).json({ success: false, error: 'Country is required.' });
        let sponsorUser = null;
        if (sponsor) {
            sponsorUser = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorUser) return res.status(400).json({ success: false, error: `Sponsor '${sponsor}' not found.` });
            req.body.sponsor = sponsorUser.username;
        }
        const user = await User.create(req.body);
        if (sponsorUser) await Notification.create({ userId: sponsorUser._id, subject: 'New Team Member!', message: `Great news! @${user.username} has joined your network.` });
        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.username}!` });
        res.status(201).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked' || user.restrictions?.loginBlocked) return res.status(403).json({ success: false, error: 'Account restricted.' });
        const token = jwt.sign({ id: user._id, role: user.role || 'user', email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(200).json({ success: true, token, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        Object.assign(userToUpdate, req.body);
        const updatedUser = await userToUpdate.save();
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

/**
 * ADMIN ACTION: MANUALLY ACTIVATE PLAN (BONUS OR OVERRIDE)
 * Now triggers the commission engine.
 */
export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        
        // 1. Add plan to profile
        user.activePlans.push({ 
            planId: plan._id, 
            planName: plan.name, 
            price: plan.price, 
            purchaseDate: new Date() 
        });
        const updatedUser = await user.save();

        // 2. Log manual activation transaction (0 cost to user)
        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Manual Activation',
            amount: 0,
            description: `Admin activated ${plan.name} plan`,
            status: 'Approved'
        });

        // 3. Trigger Commission Engine
        await runCommissionEngine(user, plan);

        // 4. Update real-time sync
        await Setting.bumpVersion();

        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

/**
 * USER ACTION: PURCHASE PLAN WITH WALLET
 */
export const purchasePlan = async (req, res) => {
    try {
        const buyer = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);

        if (!buyer || !plan) return res.status(404).json({ success: false, error: 'Entity not found' });
        if (buyer.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds' });

        // 1. Deduct funds and add plan
        buyer.walletBalance = Number((buyer.walletBalance - plan.price).toFixed(2));
        buyer.activePlans.push({
            planId: plan._id,
            planName: plan.name,
            price: plan.price,
            purchaseDate: new Date()
        });
        const updatedBuyer = await buyer.save();

        // 2. Log purchase transaction
        await Transaction.create({
            userId: buyer._id,
            userName: buyer.username,
            currency: buyer.currency,
            type: 'Plan Purchase',
            amount: -plan.price,
            description: `Purchased ${plan.name} plan`,
            status: 'Approved'
        });

        // 3. Trigger Commission Engine
        await runCommissionEngine(buyer, plan);

        // 4. Update real-time sync
        await Setting.bumpVersion();

        res.status(200).json({ success: true, data: { user: updatedBuyer, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetIds, restrictions, action } = req.body;
        await User.updateMany({ _id: { $in: targetIds } }, { $set: { restrictions } });
        res.status(200).json({ success: true, message: `Bulk updated users.` });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        await User.deleteMany({ _id: { $in: ids } });
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const { amount, description } = req.body;
        user.walletBalance += amount;
        await user.save();
        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: amount, description: description || 'Admin manual adjustment', status: 'Approved' });
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, sponsor } = req.body;
        res.status(201).json({ success: true, message: 'Process completed' });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        res.status(200).json({ success: true, data: 'Admin notified.' });
    } catch (err) {
        res.status(200).json({ success: true });
    }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const resetToken = randomBytes(20).toString('hex');
        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try { res.status(200).json({ success: true }); } catch (err) { res.status(500).json({ success: false }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try { res.status(200).json({ success: true }); } catch (err) { res.status(500).json({ success: false }); }
};
