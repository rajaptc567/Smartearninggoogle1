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
 * ROLE AUTHORIZATION MIDDLEWARE (Fail-Safe Boot)
 */
export const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        if (allowedRoles.length === 0) return next();

        // 1. MASTER ADMIN BYPASS (studio56.pk@gmail.com)
        if (req.user && (req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com')) {
            return next();
        }

        // 2. CHECK AUTHORIZATION
        const isAuthorized = req.user && allowedRoles.includes(req.user.role);

        if (!isAuthorized) {
            // 3. FAIL-SAFE FOR BOOT SEQUENCE (GET Requests)
            // Critical: Frontend components expect specific shapes.
            if (req.method === 'GET') {
                const isObjectPath = req.path.toLowerCase().includes('settings') || req.path.toLowerCase().includes('profile');
                return res.status(200).json({
                    success: true,
                    data: isObjectPath ? {} : []
                });
            }

            // 4. BLOCK WRITE ACTIONS (POST/PUT/DELETE)
            return res.status(403).json({
                success: false,
                message: 'Unauthorized action blocked.'
            });
        }

        next();
    };
};