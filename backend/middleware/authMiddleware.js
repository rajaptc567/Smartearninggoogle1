import jwt from 'jsonwebtoken';

/**
 * PASSIVE AUTH MIDDLEWARE
 * Attempts to identify the user via JWT.
 * Does NOT block requests.
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
 * ROLE AUTHORIZATION MIDDLEWARE (Boot-Safe)
 */
export const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        if (allowedRoles.length === 0) return next();

        // Master Bypass
        if (req.user && (req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com')) {
            return next();
        }

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            // BOOT-SAFE: If frontend is just trying to populate cache via GET, don't crash it
            if (req.method === 'GET') {
                return res.status(200).json({ success: true, data: req.path.includes('settings') ? {} : [] });
            }
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        next();
    };
};