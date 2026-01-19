import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// 1. Basic Rate Limiting
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    // 🚀 PREFLIGHT BYPASS: Never block OPTIONS requests
    skip: (req) => req.method === 'OPTIONS', 
});

/**
 * 🛡️ SECURITY HARDENING: SECURE HEADERS & CSP
 */
export const secureHeaders = helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["*"], // 🔓 ALLOW CONNECTIONS TO/FROM ANY SOURCE
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

/**
 * 🛡️ HARDENED CSRF PROTECTION
 */
export const csrfCheck = (req, res, next) => {
    // 🚀 PREFLIGHT BYPASS: Immediately return 204 for OPTIONS
    if (req.method === 'OPTIONS') return res.status(204).end();

    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (stateChangingMethods.includes(req.method)) {
        const origin = req.get('origin');
        const customHeader = req.get('x-smartearning-request');

        // Always allow public entry points
        if (req.path.includes('/login') || req.path.includes('/register')) {
            return next();
        }

        // Check for Custom Header presence
        if (!customHeader && process.env.NODE_ENV === 'production') {
            console.warn(`[SECURITY] CSRF BLOCK: Missing custom header on ${req.path}`);
            return res.status(403).json({ 
                success: false, 
                error: `CSRF Protection: Security Header Missing.` 
            });
        }
    }
    next();
};