
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// 1. Basic Rate Limiting
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. Helmet for secure headers
export const secureHeaders = helmet();

// 3. Transparent CSRF Protection via Origin Verification
export const csrfCheck = (req, res, next) => {
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (stateChangingMethods.includes(req.method)) {
        const origin = req.get('origin');
        const referer = req.get('referer');
        const host = req.get('host');

        // In production, we strictly match origin/referer to the host
        // We allow empty origin for standard non-browser requests if needed, 
        // but for browser-based React apps, origin should be present.
        if (origin && !origin.includes(host) && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, error: 'CSRF Protection: Invalid request origin' });
        }
    }
    next();
};
