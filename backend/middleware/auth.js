
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * PROTECT MIDDLEWARE
 * Enforces JWT validation via HttpOnly Cookies.
 */
export const protect = async (req, res, next) => {
    let token;

    // Standard Cookie Extraction
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // Fail if no token found in secure storage
    if (!token) {
        return res.status(401).json({ success: false, error: 'Session expired. Please login again.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user to request for downstream logic
        req.user = await User.findById(decoded.id);

        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Account no longer exists.' });
        }

        // Prevent blocked users from making any further requests
        if (req.user.status === 'Blocked') {
            return res.status(403).json({ success: false, error: 'Account access has been suspended.' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Not authorized: Invalid security token.' });
    }
};

/**
 * AUTHORIZE ADMIN MIDDLEWARE
 * Restricts route to Master Admin email or the 'admin' username.
 */
export const authorizeAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const isMasterAdmin = req.user.email === 'studio56.pk@gmail.com';
    const isUsernameAdmin = req.user.username === 'admin';

    if (!isMasterAdmin && !isUsernameAdmin) {
        return res.status(403).json({ 
            success: false,
            error: `Access Denied: Administrative privileges required.` 
        });
    }
    next();
};
