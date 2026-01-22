
import jwt from 'jsonwebtoken';

/**
 * PASSIVE AUTH MIDDLEWARE
 * Attempts to identify the user via JWT.
 * Does NOT block requests (does not return 401).
 * Attaches user to req.user if found.
 */
export const authMiddleware = (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach identity to request
        req.user = {
            id: decoded.id,
            role: decoded.role,
            email: decoded.email
        };
        
        next();
    } catch (err) {
        // Token is invalid or expired - silently fail and continue as guest
        req.user = null;
        next();
    }
};
