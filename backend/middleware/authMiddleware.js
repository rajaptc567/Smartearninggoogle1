import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    // 🔒 AUTH HARDENING: Support both Header (mobile/apps) and Cookie (web)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        console.warn(`[AUTH] Session validation failed: No token found in headers or cookies.`);
        return res.status(401).json({ success: false, error: 'Not authorized, session token missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        
        if (!req.user) {
            console.warn(`[AUTH] Session rejected: User ID ${decoded.id} no longer exists.`);
            return res.status(401).json({ success: false, error: 'Authorization failed: Identity unknown.' });
        }
        
        if (req.user.status === 'Blocked' || req.user.restrictions?.login) {
            console.warn(`[AUTH] Session rejected: User ${req.user.username} is restricted/blocked.`);
            return res.status(403).json({ success: false, error: 'Access Denied: Account restricted.' });
        }
        
        next();
    } catch (error) {
        console.error(`[AUTH] JWT Error: ${error.message}`);
        res.status(401).json({ success: false, error: 'Not authorized, session invalid or expired.' });
    }
};

/**
 * 🛡️ ROLE-BASED ACCESS CONTROL (RBAC)
 * Removed hardcoded magic email. Identity is now strictly tied to the DB 'role' field.
 */
export const admin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        console.warn(`[AUTH] Admin access denied for user: ${req.user?.username || 'GUEST'}`);
        res.status(403).json({ success: false, error: 'Access Denied: Administrator privileges required.' });
    }
};