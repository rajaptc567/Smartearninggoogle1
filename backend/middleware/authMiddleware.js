
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Protect routes - verify JWT token
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
    }

    try {
        // Verify token (uses JWT_SECRET from env or fallback for local dev)
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartearning_secret_key_2024');

        req.user = await User.findById(decoded.id);
        
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        if (req.user.status === 'Blocked') {
            return res.status(403).json({ success: false, error: 'Account is blocked' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
    }
};

// Grant access to specific roles
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                error: `User role ${req.user.role} is not authorized to access this route` 
            });
        }
        next();
    };
};
