
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach identity to request
        // Fail-safe: if role is missing in token, default to 'user'
        req.user = {
            id: decoded.id,
            role: decoded.role || 'user',
            email: decoded.email
        };
        
        next();
    } catch (err) {
        req.user = null;
        next();
    }
};

/**
 * ROLE AUTHORIZATION MIDDLEWARE
 * Blocks access based on roles.
 * @param {Array} allowedRoles - List of roles permitted to access the route
 */
export const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        // 1. If no roles are specified, allow by default (unprotected route)
        if (allowedRoles.length === 0) {
            return next();
        }

        // 2. Check if user was identified by authMiddleware
        if (!req.user) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // 3. MASTER BYPASS: Super Admin always has access
        if (req.user.role === 'super_admin') {
            return next();
        }

        // 4. Role Check
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        next();
    };
};
