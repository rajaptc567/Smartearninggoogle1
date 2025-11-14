import User from '../models/User.js';

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private/Admin
export const getUser = async (req, res, next) => {
     try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: `User not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create user (Register)
// @route   POST /api/v1/users
// @access  Public
export const createUser = async (req, res, next) => {
    try {
        const user = await User.create(req.body);
        // In a real app, you would hash the password here before saving
        // and return a JWT token for authentication.
        res.status(201).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
export const updateUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!user) {
            return res.status(404).json({ success: false, error: `User not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
         if (!user) {
            return res.status(404).json({ success: false, error: `User not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
