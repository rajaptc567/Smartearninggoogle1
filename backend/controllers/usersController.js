
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

const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];

const canReleaseCommission = async (transaction, user, settings, allPlans) => {
    if (!transaction.relatedPlanId) return true;
    if (!settings.requireActivePlanForCommission && !settings.requirePlanMatchForCommission) return true;
    if (settings.requireActivePlanForCommission && (!user.activePlans || user.activePlans.length === 0)) return false;
    if (settings.requirePlanMatchForCommission) {
        const relatedPlan = allPlans.find(p => p._id.toString() === transaction.relatedPlanId.toString());
        if (!relatedPlan) return false;
        let isMatch = user.activePlans?.some(ap => ap.planId.toString() === transaction.relatedPlanId.toString());
        if (!isMatch && settings.planEquivalencyGroups) {
            const group = settings.planEquivalencyGroups.find(g => g.usdPlanId === transaction.relatedPlanId.toString() || g.pkrPlanId === transaction.relatedPlanId.toString() || g.eurPlanId === transaction.relatedPlanId.toString());
            if (group) {
                const equivIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean);
                isMatch = user.activePlans?.some(ap => equivIds.includes(ap.planId.toString()));
            }
        }
        if (!isMatch) return false;
    }
    return true;
};

const distributeCommissions = async (purchaser, plan, settings, rates, defaultRates, allPlans) => {
    if (!purchaser.sponsor) return;
    const getRate = (curr) => {
        const r = rates[curr];
        if (curr === 'PKR' && (r === 1 || !r)) return defaultRates.PKR;
        if (curr === 'EUR' && (r === 0 || !r)) return defaultRates.EUR;
        return (r !== undefined && r !== null && r !== 0) ? r : (defaultRates[curr] || 1);
    };
    let currentSponsorUsername = purchaser.sponsor;
    let level = 1;
    let totalLevels = 1 + (plan.indirectCommissions?.length || 0);
    while (level <= totalLevels && currentSponsorUsername) {
        const sponsor = await User.findOne({ username: currentSponsorUsername });
        if (!sponsor) break;
        if (sponsor.restrictions?.earning) {
            currentSponsorUsername = sponsor.sponsor; level++; continue;
        }
        let commissionConfig = level === 1 ? plan.directCommissions?.[0] : plan.indirectCommissions?.[level - 2];
        if (!commissionConfig) break;
        if (level === 1 && plan.directReferralLimit > 0) {
            const equivIds = new Set();
            equivIds.add(plan._id.toString());
            const group = settings.planEquivalencyGroups?.find(g => String(g.usdPlanId) === plan._id.toString() || String(g.pkrPlanId) === plan._id.toString() || String(g.eurPlanId) === plan._id.toString());
            if (group) { [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean).forEach(id => equivIds.add(id.toString())); }
            const usedSlots = await Transaction.countDocuments({ userId: sponsor._id, type: 'Commission', level: 1, relatedPlanId: { $in: Array.from(equivIds) }, status: { $in: ['Approved', 'Pending'] } });
            if (usedSlots >= plan.directReferralLimit) {
                if (settings.showRejectedCommissionTransaction) { await Transaction.create({ userId: sponsor._id, userName: sponsor.username, currency: sponsor.currency, type: 'Commission', amount: 0, status: 'Rejected', description: `Overflow: Slot limit reached for ${plan.name} from @${purchaser.username}`, level, sourceUserId: purchaser._id, relatedPlanId: plan._id }); }
                if (settings.notifySponsorOnCommissionLimit) { await Notification.create({ userId: sponsor._id, subject: 'Slot Limit Reached', message: `You missed a commission from @${purchaser.username} because your ${plan.name} direct slots are full. Upgrade to a higher plan to increase capacity.` }); }
                currentSponsorUsername = sponsor.sponsor; level++; continue;
            } else if (plan.directCommissions && plan.directCommissions.length > usedSlots) {
                commissionConfig = plan.directCommissions[usedSlots];
            }
        }
        if (commissionConfig.disabledLevels?.includes(level)) { currentSponsorUsername = sponsor.sponsor; level++; continue; }
        let amountInPurchaserCurrency = commissionConfig.type === 'percentage' ? (plan.price * commissionConfig.value) / 100 : commissionConfig.value;
        let amountInSponsorCurrency = amountInPurchaserCurrency;
        let exRate = 1;
        if (purchaser.currency !== sponsor.currency) {
            const pRate = getRate(purchaser.currency);
            const sRate = getRate(sponsor.currency);
            amountInSponsorCurrency = (amountInPurchaserCurrency / pRate) * sRate;
            exRate = sRate / pRate;
        }
        amountInSponsorCurrency = Number(amountInSponsorCurrency.toFixed(2));
        const txData = { userId: sponsor._id, userName: sponsor.username, currency: sponsor.currency, type: 'Commission', amount: amountInSponsorCurrency, level, sourceUserId: purchaser._id, relatedPlanId: plan._id, originalAmount: amountInPurchaserCurrency, originalCurrency: purchaser.currency, exchangeRate: exRate };
        if (await canReleaseCommission(txData, sponsor, settings, allPlans)) {
            txData.status = 'Approved'; txData.description = `Commission (L${level}) from @${purchaser.username} for ${plan.name}`;
            sponsor.walletBalance = Number((sponsor.walletBalance + amountInSponsorCurrency).toFixed(2)); await sponsor.save();
        } else {
            txData.status = 'Pending'; txData.description = `Held: Commission (L${level}) from @${purchaser.username} - Requirements not met`;
        }
        await Transaction.create(txData);
        if (settings.requireUplineEligibility && txData.status === 'Pending') break;
        currentSponsorUsername = sponsor.sponsor; level++;
    }
};

export const getUsers = async (req, res) => {
    try {
        const isMasterAdmin = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMasterAdmin || req.user?.role === 'admin';

        // Safe Pagination Logic
        const page = parseInt(req.query.page, 10) || 1;
        let limit = parseInt(req.query.limit, 10) || 20;
        if (limit > 100) limit = 100;
        const skip = (page - 1) * limit;

        let users;
        let totalRecords;

        if (isAdmin) {
            totalRecords = await User.countDocuments();
            users = await User.find()
                .sort({ registrationDate: -1 })
                .skip(skip)
                .limit(limit);
        } else if (req.user) {
            const results = await User.aggregate([
                { $match: { email: req.user.email } },
                {
                    $graphLookup: {
                        from: 'users',
                        startWith: '$username',
                        connectFromField: 'username',
                        connectToField: 'sponsor',
                        as: 'downline'
                    }
                }
            ]);

            if (results.length > 0) {
                const fullList = [results[0], ...results[0].downline];
                totalRecords = fullList.length;
                users = fullList.slice(skip, skip + limit);
            } else {
                totalRecords = 0;
                users = [];
            }
        } else {
            totalRecords = 0;
            users = [];
        }

        res.status(200).json({ 
            success: true, 
            count: users.length,
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                currentPage: page,
                pageSize: limit
            },
            data: users 
        });
    } catch (err) { res.status(200).json({ success: false, data: [], error: err.message }); }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(200).json({ success: false, data: {} });
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(200).json({ success: false, data: {} }); }
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
        req.body.currency = country.toLowerCase() === 'pakistan' ? 'PKR' : (europeanCountries.map(c => c.toLowerCase()).includes(country.toLowerCase()) ? 'EUR' : 'USD');
        req.body.activePlans = [];
        req.body.restrictions = { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, loginBlocked: false, purchaseBlocked: false };
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
        
        const token = jwt.sign({ id: user._id, role: user.role || 'user', email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        
        res.status(200).json({ success: true, token, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.id);
        if (!userToUpdate) return res.status(404).json({ success: false, error: `User not found` });
        if (req.body.status && req.body.status !== userToUpdate.status) await Notification.create({ userId: userToUpdate._id, subject: 'Account Status Updated', message: `Your status changed to: ${req.body.status}.`, isPopup: true });
        Object.assign(userToUpdate, req.body);
        let updatedUser = await userToUpdate.save();
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`;
                await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, subject: 'Commission Unlocked 🔓', message: `Success! ${updatedUser.currency}${releasedAmount.toFixed(2)} in commissions released.` });
        }
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        let updatedUser = await user.save();
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`;
                await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, subject: 'Commission Unlocked 🔓', message: `Released ${updatedUser.currency}${releasedAmount.toFixed(2)}.` });
        }
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        if (user.restrictions?.purchaseBlocked) return res.status(403).json({ success: false, error: 'Purchases disabled.' });
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        user.walletBalance = Number((user.walletBalance - plan.price).toFixed(2));
        user.activePlans.push({ planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() });
        let updatedUser = await user.save();
        await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: 'Plan Purchase', amount: -plan.price, description: `Purchased ${plan.name} plan`, status: 'Approved' });
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        await distributeCommissions(updatedUser, plan, settings, settings.exchangeRates || {}, { USD: 1, EUR: 0.92, PKR: 278.50 }, allPlans);
        const pendingCommissions = await Transaction.find({ userId: updatedUser._id, type: 'Commission', status: 'Pending' });
        let releasedAmount = 0;
        for (const comm of pendingCommissions) {
            if (await canReleaseCommission(comm, updatedUser, settings, allPlans)) {
                comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`;
                await comm.save(); releasedAmount += comm.amount;
            }
        }
        if (releasedAmount > 0) {
            updatedUser.walletBalance = Number((updatedUser.walletBalance + releasedAmount).toFixed(2));
            updatedUser = await updatedUser.save();
            await Notification.create({ userId: updatedUser._id, subject: 'Commission Unlocked 🔓', message: `Released ${updatedUser.currency}${releasedAmount.toFixed(2)}.` });
        }
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action } = req.body;
        let query = {};
        if (targetType === 'plan') query = { 'activePlans.planId': { $in: targetIds } };
        else if (targetType === 'single') query = { _id: { $in: targetIds } };
        const usersToUpdate = await User.find(query);
        const settings = await Setting.getSettings();
        const allPlans = await InvestmentPlan.find();
        for (const user of usersToUpdate) {
            let cur = user.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, loginBlocked: false, purchaseBlocked: false };
            let changed = false; let checkRel = false;
            for (const key of Object.keys(restrictions)) {
                if (restrictions[key]) { 
                    let newVal = action === 'enable' ? true : action === 'disable' ? false : !cur[key];
                    if (cur[key] !== newVal) { if (key === 'earning' && cur.earning === true && newVal === false) checkRel = true; cur[key] = newVal; changed = true; }
                }
            }
            if (changed) {
                user.restrictions = cur;
                if (checkRel) {
                    const pending = await Transaction.find({ userId: user._id, type: 'Commission', status: 'Pending' });
                    let rel = 0;
                    for (const comm of pending) { if (await canReleaseCommission(comm, user, settings, allPlans)) { comm.status = 'Approved'; comm.description = `Unlocked: Commission from referral payout.`; await comm.save(); rel += comm.amount; } }
                    if (rel > 0) { user.walletBalance = Number((user.walletBalance + rel).toFixed(2)); await Notification.create({ userId: user._id, subject: 'Commission Unlocked 🔓', message: `Released ${user.currency}${rel.toFixed(2)}.` }); }
                }
                await user.save();
            }
        }
        res.status(200).json({ success: true, message: `Bulk updated users.` });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        await Deposit.deleteMany({ userId: { $in: ids } });
        await Withdrawal.deleteMany({ userId: { $in: ids } });
        await Transaction.deleteMany({ userId: { $in: ids } });
        await Notification.deleteMany({ userId: { $in: ids } });
        await Transfer.deleteMany({ $or: [{ senderId: { $in: ids } }, { recipientId: { $in: ids } }] });
        await User.deleteMany({ _id: { $in: ids } });
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
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const { amount, description } = req.body;
        user.walletBalance = Number((user.walletBalance + amount).toFixed(2));
        await user.save();
        await Notification.create({ userId: user._id, subject: 'Wallet Adjusted', message: `Admin adjusted balance by ${user.currency}${Math.abs(amount)}.` });
        const transaction = await Transaction.create({ userId: user._id, userName: user.username, currency: user.currency, type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: amount, description: description || 'Admin manual adjustment', status: 'Approved' });
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
}

export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, sponsor, balance, country, currency, usernames } = req.body;
        const s = await User.findOne({ username: sponsor });
        if (!s) return res.status(404).json({ success: false, error: 'Sponsor not found' });
        const createOne = async (uname) => {
            const existing = await User.findOne({ username: uname });
            if (existing) return; 
            await User.create({ fullName: `Dummy ${uname}`, username: uname, email: `${uname}@test-${Math.floor(Math.random() * 1000)}.com`, password: 'password123', phone: '000000', country, currency, walletBalance: balance, sponsor: s.username });
        };
        if (usernames && Array.isArray(usernames) && usernames.length > 0) {
            for (const uname of usernames) { if (uname.trim()) await createOne(uname.trim()); }
        } else {
            const iterations = parseInt(count) || 0;
            for (let i = 0; i < iterations; i++) { const suf = Math.floor(1000 + Math.random() * 9000); await createOne(`user_${suf}`); }
        }
        res.status(201).json({ success: true, message: 'Process completed' });
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
