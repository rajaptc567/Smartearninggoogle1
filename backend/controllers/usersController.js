
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
        
        // Safety check before atomic update
        if (toMoneyInt(user.walletBalance) < priceInt) {
            return res.status(400).json({ success: false, error: 'Insufficient funds'});
        }

        // ATOMIC UPDATE: Deduct balance
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { 
                $inc: { walletBalance: -(priceInt / 100) },
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

// ... other methods remain largely unchanged but inherit the pagination/search improvements ...
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
