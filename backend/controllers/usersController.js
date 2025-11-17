import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import createLog from '../utils/logger.js';

// @desc    Register a new user
// @route   POST /api/v1/users
// @access  Public
export const createUser = async (req, res, next) => {
    try {
        const { fullName, username, email, password, phone, sponsor } = req.body;

        if (sponsor) {
            const sponsorExists = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorExists) {
                return res.status(400).json({ success: false, error: `Sponsor with username '${sponsor}' not found.` });
            }
            req.body.sponsor = sponsorExists.username;
        }

        const user = await User.create(req.body);
        
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({ success: true, data: userResponse });
    } catch (err) {
        let errorMessage = 'An unexpected error occurred.';
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue)[0];
            errorMessage = `An account with that ${field} already exists.`;
        } else if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
        } else {
            errorMessage = err.message;
        }
        res.status(400).json({ success: false, error: errorMessage });
    }
};

// @desc    Auth user & get token
// @route   POST /api/v1/users/login
// @access  Public
export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Please provide an email and password' });
        }
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({ success: true, data: userResponse });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};


// @desc    Get all users
// @route   GET /api/v1/users
export const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get single user
// @route   GET /api/v1/users/:id
export const getUser = async (req, res) => {
     try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update user
// @route   PUT /api/v1/users/:id
export const updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Admin manually adjusts user wallet
// @route   POST /api/v1/users/:id/adjust-wallet
export const adjustWallet = async (req, res) => {
    const { amount, description } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        user.walletBalance += amount;
        await user.save();

        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            type: amount > 0 ? 'Manual Credit' : 'Manual Debit',
            amount: amount,
            description: description || 'Admin manual adjustment',
            status: 'Approved'
        });
        
        await createLog('Wallet Adjusted', user.username, `Adjusted balance by ${amount}. Reason: ${description}`, 'admin');

        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
}

// @desc    User purchases an investment plan
// @route   POST /api/v1/users/:id/purchase-plan
export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);

        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        
        user.walletBalance -= plan.price;
        user.activePlan = plan.name;
        await user.save();
        
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            type: 'Plan Purchase',
            amount: -plan.price,
            description: `Purchased ${plan.name} plan`,
            status: 'Approved'
        });

        // TODO: Add commission logic for sponsors
        
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};