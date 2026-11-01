import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Setting from '../models/Setting.js';

/**
 * PASSIVE AUTH MIDDLEWARE
 * Attempts to identify the user via JWT.
 * Does NOT block requests (does not return 401).
 * Attaches user to req.user if found.
 */
export const authMiddleware = (req, res, next) => {
    let token;

    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    if (authHeader && typeof authHeader === 'string') {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        token = match ? match[1].trim() : authHeader.trim();
    }

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = {
            id: decoded.id || decoded._id || decoded.userId,
            role: decoded.role ? String(decoded.role).trim().toLowerCase() : 'user',
            email: decoded.email
        };
        
        next();
    } catch (err) {
        req.user = null;
        next();
    }
};

/**
 * ROLE AUTHORIZATION & BACKEND VERIFICATION ENFORCEMENT MIDDLEWARE
 * Blocks access based on roles and enforces pending verification status.
 * @param {Array} allowedRoles - List of roles permitted to access the route
 */
export const authorize = (allowedRoles = []) => {
    return async (req, res, next) => {
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

        const role = req.user.role;
        const isAdmin = role === 'super_admin' || role === 'admin' || role === 'finance' || role === 'support';

        // 3. Role Check
        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // 4. Backend Verification Enforcement for regular users
        if (!isAdmin && allowedRoles.includes('user')) {
            const path = req.originalUrl || req.path || '';
            const isVerificationRoute = path.includes('/verify-email') || path.includes('/verify-whatsapp') || path.includes('/resend-email') || path.includes('/resend-whatsapp');

            if (!isVerificationRoute) {
                try {
                    const dbUser = await User.findById(req.user.id).select('emailVerified whatsappVerified status restrictions').lean();
                    if (!dbUser || dbUser.status === 'Blocked' || dbUser.restrictions?.loginBlocked) {
                        return res.status(403).json({ success: false, error: 'Account restricted or blocked.' });
                    }
                    const settings = await Setting.getSettings();
                    if (!settings || typeof settings.emailVerificationRequired !== 'boolean' || typeof settings.whatsappVerificationRequired !== 'boolean') {
                        return res.status(500).json({ success: false, error: 'Configuration error: Verification settings unavailable or invalid.' });
                    }
                    const needsEmail = settings.emailVerificationRequired && !dbUser.emailVerified;
                    const needsWa = settings.whatsappVerificationRequired && !dbUser.whatsappVerified;

                    if (needsEmail || needsWa) {
                        return res.status(403).json({
                            success: false,
                            error: 'Account verification required.',
                            pendingVerification: true,
                            needsEmailVerification: needsEmail,
                            needsWhatsappVerification: needsWa
                        });
                    }
                } catch (err) {
                    console.error('Backend verification enforcement error:', err);
                    return res.status(500).json({ success: false, error: 'Internal server error during verification enforcement.' });
                }
            }
        }

        next();
    };
};
