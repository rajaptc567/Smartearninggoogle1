
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

/**
 * 🛡️ SECURITY HARDENING: SECURE HEADERS & CSP
 * Blocks unauthorized script execution and cross-site leaks.
 * REMOVED: 'unsafe-inline' to prevent XSS.
 */
export const secureHeaders = helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https://smartearning-api.onrender.com", "http://localhost:5000"],
            frameSrc: ["'self'", "https://www.youtube.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    hidePoweredBy: true,
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// 3. Transparent Always-On CSRF Protection via Origin Verification
export const csrfCheck = (req, res, next) => {
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (stateChangingMethods.includes(req.method)) {
        const origin = req.get('origin');
        const referer = req.get('referer');
        const host = req.get('host');

        const allowedFrontend = process.env.FRONTEND_URL;

        if (origin) {
            const originIsAllowed = allowedFrontend ? origin === allowedFrontend : origin.includes(host);
            if (!originIsAllowed && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
                return res.status(403).json({ success: false, error: 'CSRF Protection: Invalid request origin' });
            }
        } else if (!referer) {
            return res.status(403).json({ success: false, error: 'CSRF Protection: Missing request identifiers' });
        }
    }
    next();
};
