import User from '../models/User.js';

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find().lean();
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
        const { sponsor } = req.body;

        // If a sponsor is provided, validate that they exist
        if (sponsor) {
            // Use a case-insensitive regex to find the sponsor
            const sponsorExists = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorExists) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Sponsor with username '${sponsor}' not found. Please check the username or leave the field blank.` 
                });
            }
             // Normalize the sponsor username to match the database casing for data integrity
            req.body.sponsor = sponsorExists.username;
        }

        const user = await User.create(req.body);
        // In a real app, you would hash the password here before saving
        // and return a JWT token for authentication.
        res.status(201).json({ success: true, data: user });
    } catch (err) {
        let errorMessage = 'An unexpected error occurred during registration.';

        if (err.code === 11000) {
            // Handle E11000 duplicate key error from MongoDB
            const field = Object.keys(err.keyValue)[0]; // e.g., 'username' or 'email'
            const value = err.keyValue[field];
            errorMessage = `An account with the ${field} '${value}' already exists. Please choose a different ${field}.`;
        } else if (err.name === 'ValidationError') {
            // Handle other Mongoose validation errors (e.g., required fields)
            errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
        } else {
            // Fallback for other types of errors
            errorMessage = err.message;
        }
        
        res.status(400).json({ success: false, error: errorMessage });
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