import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; 
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const safeRound = (val) => Number(Number(val).toFixed(2));

const canReleaseCommission = async (commission, user, settings, allPlans) => {
    if (commission.status !== 'Pending') return false;
    let targetPlanId = commission.relatedPlanId ? String(commission.relatedPlanId) : null;
    if (!targetPlanId) return false;
    
    if (settings.oneTimeCommissionPerGroup) {
        const recurringPlanIds = settings.recurringCommissionPlanIds || [];
        const hasRecurringPlan = (user.activePlans || []).some(ap => recurringPlanIds.includes(String(ap.planId)));
        if (!hasRecurringPlan) {
            const alreadyReceived = await Transaction.findOne({
                userId: user._id, sourceUserId: commission.sourceUserId, type: 'Commission', status: 'Approved', _id: { $ne: commission._id }
            });
            if (alreadyReceived) {
                commission.status = 'Rejected';
                commission.description = `[Limit] One-time commission already received from @${commission.userName || 'referral'}.`;
                await commission.save();
                return false;
            }
        }
    }
    
    let equivIds = [targetPlanId];
    if (settings.planEquivalencyGroups) {
        const group = (settings.planEquivalencyGroups || []).find(g => String(g.usdPlanId) === targetPlanId || String(g.pkrPlanId) === targetPlanId || String(g.eurPlanId) === targetPlanId);
        if (group) equivIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).map(id => String(id));
    }
    
    const qualifyingActivePlan = (user.activePlans || []).find(ap => equivIds.includes(String(ap.planId)));
    if (settings.requirePlanMatchForCommission) {
        if (!qualifyingActivePlan) return false;
    } else if (settings.requireActivePlanForCommission) {
        if ((user.activePlans || []).length === 0) return false;
    }
    
    const planConfig = allPlans.find(p => p._id.toString() === String(qualifyingActivePlan?.planId));
    if (commission.level === 1 && qualifyingActivePlan && planConfig) {
        const limit = planConfig.directReferralLimit || 0;
        if (limit > 0) {
            const approvedCount = await Transaction.countDocuments({ userId: user._id, type: 'Commission', relatedPlanId: { $in: equivIds }, level: 1, status: 'Approved' });
            if (approvedCount >= limit) {
                commission.status = 'Rejected';
                commission.description = `[Overflow] Slot Limit reached for ${planConfig.name}.`;
                await commission.save();
                return false;
            }
        }
    }
    return true;
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
        
        req.body.activePlans = [];
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
        
        const user = await User.create(req.body);
        
        if (sponsorUser) {
            await Notification.create({
                userId: sponsorUser._id,
                subject: 'New Team Member!',
                message: `Great news! @${user.username} has joined your network.`
            });
        }

        await Notification.create({ userId: user._id, message: `Welcome to SmartEarning, ${user.username}!` });
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked' || user.restrictions?.login) return res.status(403).json({ success: false, error: 'Account restricted.' });
        
        const token = generateToken(user._id);
        const userData = user.toObject();
        delete userData.password;
        
        // 🔐 SET SECURE HTTP-ONLY COOKIE
        const cookieOptions = {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        };

        res.cookie('token', token, cookieOptions);
        res.status(200).json({ success: true, data: userData });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const logoutUser = async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const getUsers = async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page, 10) : null;
        const limit = parseInt(req.query.limit, 10) || 100;
        let query = User.find().sort({ registrationDate: -1 });
        if (page !== null) query = query.skip((page - 1) * limit).limit(limit);
        const users = await query;
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        
        /**
         * 🛡️ PREVENT MASS ASSIGNMENT
         * Users can only update their own profile fields.
         * Admins can update status and restrictions.
         * NO ONE can update balance via this route.
         */
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');
        const isSelf = String(req.user.id) === String(userToUpdate._id);

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ success: false, error: 'Unauthorized profile update' });
        }

        // 1. Basic Allowlist (Self & Admin)
        const profileFields = ['fullName', 'email', 'phone', 'whatsapp', 'country'];
        profileFields.forEach(field => {
            if (req.body[field] !== undefined) {
                userToUpdate[field] = req.body[field];
            }
        });

        // 2. Admin Only Allowlist
        if (isAdmin) {
            if (req.body.status) userToUpdate.status = req.body.status;
            if (req.body.restrictions) userToUpdate.restrictions = req.body.restrictions;
            if (req.body.role && req.user.role === 'superadmin') userToUpdate.role = req.body.role;
            if (req.body.sponsor) userToUpdate.sponsor = req.body.sponsor;
        }

        // 3. Password handling
        if (req.body.password) {
            userToUpdate.password = req.body.password;
        }

        let updatedUser = await userToUpdate.save();

        // 4. Post-update logic (Commission release)
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; 
                comm.description = `Unlocked: Commission released.`;
                await comm.save(); 
                releasedAmount = safeRound(releasedAmount + comm.amount);
            }
        }
        if (releasedAmount > 0) {
            updatedUser = await User.findByIdAndUpdate(updatedUser._id, { $inc: { walletBalance: releasedAmount } }, { new: true });
            await Notification.create({ 
                userId: updatedUser._id, 
                subject: 'Commission Unlocked 🔓',
                message: `A total of ${updatedUser.currency}${releasedAmount.toFixed(2)} has been released to your wallet.` 
            });
        }
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(req.params.id).session(session);
        const plan = await InvestmentPlan.findById(req.body.planId).session(session);
        if (!user || !plan) throw new Error('Not found');
        
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        const updatedUser = await user.save({ session });
        
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find().session(session);
        // distributeCommissions should be updated to accept session if implemented with multi-doc writes
        
        await session.commitTransaction();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) {
        await session.abortTransaction();
        res.status(400).json({ success: false, error: err.message });
    } finally { session.endSession(); }
};

export const purchasePlan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(req.params.id).session(session);
        const plan = await InvestmentPlan.findById(req.body.planId).session(session);
        if (!user || !plan) throw new Error('Not found');
        if (user.walletBalance < plan.price) throw new Error('Insufficient funds');
        
        const updatedUser = await User.findByIdAndUpdate(user._id, { 
            $inc: { walletBalance: -safeRound(plan.price) },
            $push: { activePlans: { planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() } }
        }, { session, new: true });
        
        await Transaction.create([{ 
            userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', 
            amount: -safeRound(plan.price), description: `Purchased ${plan.name} plan`, status: 'Approved' 
        }], { session });
        
        await session.commitTransaction();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) {
        await session.abortTransaction();
        res.status(400).json({ success: false, error: err.message });
    } finally { session.endSession(); }
};

export const adjustWallet = async (req, res) => {
    try {
        const { amount, description } = req.body;
        const safeAmt = safeRound(amount);
        const user = await User.findByIdAndUpdate(req.params.id, { $inc: { walletBalance: safeAmt } }, { new: true });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        await Notification.create({
            userId: user._id,
            subject: 'Wallet Adjusted',
            message: `Admin has ${safeAmt > 0 ? 'credited' : 'debited'} your wallet by ${user.currency}${Math.abs(safeAmt)}. Reason: ${description || 'Manual adjustment'}`
        });

        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: safeAmt > 0 ? 'Manual Credit' : 'Manual Debit', amount: safeAmt, description: description || 'Admin manual adjustment', status: 'Approved' });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        if (!Array.isArray(targetIds)) return res.status(400).json({ success: false, error: 'IDs must be an array.' });
        
        const safeIds = targetIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        let query = {};
        if (targetType === 'plan') query = { 'activePlans.planId': { $in: safeIds } };
        else if (targetType === 'single') query = { _id: { $in: safeIds } };
        else if (targetType === 'all') query = {};
        
        const usersToUpdate = await User.find(query);
        for (const user of usersToUpdate) {
            let cur = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false };
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    cur[key] = action === 'enable' ? true : action === 'disable' ? false : !cur[key];
                }
            }
            user.restrictions = cur;
            await user.save();
        }
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, message: `Bulk updated users.` });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        const safeIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        await Deposit.deleteMany({ userId: { $in: safeIds } });
        await Withdrawal.deleteMany({ userId: { $in: safeIds } });
        await Transaction.deleteMany({ userId: { $in: safeIds } });
        await Notification.deleteMany({ userId: { $in: safeIds } });
        await Transfer.deleteMany({ $or: [{ senderId: { $in: safeIds } }, { recipientId: { $in: safeIds } }] });
        await User.deleteMany({ _id: { $in: safeIds } });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        await Deposit.deleteMany({ userId: user._id });
        await Withdrawal.deleteMany({ userId: user._id });
        await Transaction.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });
        await User.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) await PasswordResetRequest.create({ userId: user._id, userEmail: user.email, userName: user.username });
        res.status(200).json({ success: true, data: 'Admin notified.' });
    } catch (err) { res.status(200).json({ success: true }); }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const resetToken = randomBytes(20).toString('hex');
        user.passwordResetToken = createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
        await user.save();
        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const hashedToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(404).json({ success: false, error: 'Invalid token.' });
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const hashedToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token.' });
        user.password = req.body.password;
        user.passwordResetToken = undefined; user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};

/**
 * @desc    Create bulk dummy users for testing or population
 * @route   POST /api/v1/users/bulk-dummy
 * @access  Private/Admin
 */
export const createBulkDummyUsers = async (req, res) => {
    try {
        // Safe placeholder to prevent crashes and allow server startup
        res.status(200).json({
            success: false,
            message: "Bulk dummy user creation is currently disabled for security reasons."
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};