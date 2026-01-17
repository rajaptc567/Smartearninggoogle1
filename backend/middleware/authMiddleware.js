
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            // SECURITY: Strictly use environment variable. No hardcoded fallback.
            if (!process.env.JWT_SECRET) {
                console.error("CRITICAL: JWT_SECRET is not defined in environment variables.");
                return res.status(500).json({ success: false, error: 'Server configuration error.' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id);
            
            if (!req.user) {
                return res.status(401).json({ success: false, error: 'User not found' });
            }

            next();
        } catch (error) {
            console.error('JWT Error:', error.message);
            res.status(401).json({ success: false, error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }
};

export const admin = (req, res, next) => {
    // SECURITY FIX: Decouple admin status from specific emails or usernames.
    // Use the verified 'role' field from the database.
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, error: 'Access denied. Administrator privileges required.' });
    }
};
