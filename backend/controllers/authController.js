import User from '../models/User.js';

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
export const login = async (req, res, next) => {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Please provide an email and password' });
    }

    try {
        // Check for user. Use a case-insensitive regex for better UX.
        const userDoc = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }).select('+password');

        if (!userDoc) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Check if password matches
        // In a real production application, you should use a library like bcrypt to compare hashed passwords.
        // const isMatch = await bcrypt.compare(password, user.password);
        const isMatch = password === userDoc.password;

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        // Create a clean object for the response to avoid any serialization issues.
        const userResponse = JSON.parse(JSON.stringify(userDoc));
        
        // Ensure the password is not sent back in the response
        delete userResponse.password;

        res.status(200).json({ success: true, data: userResponse });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
};