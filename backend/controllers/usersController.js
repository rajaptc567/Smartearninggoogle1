
import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; 
import jwt from 'jsonwebtoken';
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';

// Financial Helpers
const toMoneyInt = (val) => Math.round(parseFloat(val || 0) * 100);
const toMoneyDec = (val) => Number((val / 100).toFixed(2));

// Helper for sending token in cookie
const sendTokenResponse = (user, statusCode, res) => {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE) || 7;
    const options = {
        expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none'
    };

    res.status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            data: user
        });
};

export const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, searchTerm, statusFilter, planFilter } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let query = {};

        // Server-side Search
        if (searchTerm) {
            query.$or = [
                { username: { $regex: searchTerm, $options: 'i' } },
                { fullName: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
                { phone: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Server-side Filters
        if (statusFilter) query.status = statusFilter;
        if (planFilter) {
            if (planFilter === 'NO_PLAN') {
                query.$or = [{ activePlans: { $exists: false } }, { activePlans: { $size: 0 } }];
            } else {
                query['activePlans.planId'] = planFilter;
            }
        }

        const totalCount = await User.countDocuments(query);
        const users = await User.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ registrationDate: -1 });

        res.status(200).json({ 
            success: true, 
            data: users,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const purchasePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found'});
        
        const priceInt = toMoneyInt(plan.price);
        const balanceInt = toMoneyInt(user.walletBalance);
        
        // Safety check before atomic update
        if (balanceInt < priceInt) {
            return res.status(400).json({ success: false, error: 'Insufficient funds'});
        }

        // ATOMIC UPDATE: Deduct balance
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { 
                $inc: { walletBalance: -(plan.price) },
                $push: { activePlans: { planId: plan._id, planName: plan.name, price: plan.price, purchaseDate: new Date() } }
            },
            { new: true }
        );
        
        await Transaction.create({ 
            userId: user._id, 
            userName: user.username, 
            currency: user.currency, 
            type: 'Plan Purchase', 
            amount: -plan.price, 
            description: `Purchased ${plan.name} plan`, 
            status: 'Approved' 
        });
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user: updatedUser, transaction: {} } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adjustWallet = async (req, res) => {
    try {
        const { amount, description } = req.body;
        
        // ATOMIC UPDATE
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $inc: { walletBalance: parseFloat(amount) } },
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        const transaction = await Transaction.create({ 
            userId: user._id, 
            userName: user.username, 
            currency: user.currency, 
            type: amount > 0 ? 'Manual Credit' : 'Manual Debit', 
            amount: amount, 
            description: description || 'Admin manual adjustment', 
            status: 'Approved' 
        });
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.status === 'Blocked' || user.restrictions?.login) return res.status(403).json({ success: false, error: 'Account restricted.' });
        
        sendTokenResponse(user, 200, res);
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createUser = async (req, res) => {
    try {
        const user = await User.create(req.body);
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const logout = async (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ success: true, data: {} });
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        await User.deleteMany({ _id: { $in: ids } });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const userRequestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            await PasswordResetRequest.create({
                userId: user._id,
                userEmail: user.email,
                userName: user.username
            });
        }
        res.status(200).json({ success: true, message: 'Request sent to admin' });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const resetToken = randomBytes(20).toString('hex');
        user.passwordResetToken = createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

        await user.save();
        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const resetToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: resetToken,
            passwordResetExpires: { $gt: Date.now() }
        });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token' });
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const resetPasswordWithToken = async (req, res) => {
    try {
        const resetToken = createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: resetToken,
            passwordResetExpires: { $gt: Date.now() }
        });
        if (!user) return res.status(400).json({ success: false, error: 'Invalid token' });

        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const bulkUpdateRestrictions = async (req, res) => {
    try {
        const { targetType, targetIds, restrictions, action, sendNotification } = req.body;
        let query = {};
        if (targetType === 'plan') query = { 'activePlans.planId': { $in: targetIds } };
        else if (targetType === 'single') query = { _id: { $in: targetIds } };

        const users = await User.find(query);
        for (const user of users) {
            const currentRes = user.restrictions || {};
            Object.keys(restrictions).forEach(key => {
                if (action === 'enable') currentRes[key] = true;
                else if (action === 'disable') currentRes[key] = false;
                else if (action === 'toggle') currentRes[key] = !currentRes[key];
            });
            user.restrictions = currentRes;
            await user.save();
            if (sendNotification) {
                await Notification.create({
                    userId: user._id,
                    message: `Account restrictions updated by administrator.`
                });
            }
        }
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createBulkDummyUsers = async (req, res) => {
    try {
        const { count, usernames, sponsor, balance, country, currency } = req.body;
        const generated = [];
        const loopCount = usernames ? usernames.length : count;
        for (let i = 0; i < loopCount; i++) {
            const uname = usernames ? usernames[i] : `user_${randomBytes(3).toString('hex')}`;
            generated.push({
                username: uname,
                fullName: uname.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                email: `${uname}@example.com`,
                password: 'password123',
                phone: '0000000000',
                country,
                currency,
                walletBalance: balance,
                sponsor,
                status: 'Active'
            });
        }
        await User.insertMany(generated);
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, count: generated.length });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const adminActivatePlan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(req.body.planId);
        if (!user || !plan) return res.status(404).json({ success: false, error: 'Not found' });

        user.activePlans.push({
            planId: plan._id,
            planName: plan.name,
            price: plan.price,
            purchaseDate: new Date()
        });

        await user.save();
        const transaction = await Transaction.create({
            userId: user._id, userName: user.username, currency: user.currency,
            type: 'Plan Purchase', amount: 0, status: 'Approved',
            description: `Admin Activated: ${plan.name}`
        });

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
