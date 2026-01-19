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
 */
export const secureHeaders = helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https://smartearning-api.onrender.com", "http://localhost:5000", "http://localhost:5173", "http://localhost:5174"],
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

// 3. Resilient CSRF Protection via Origin & Referer Verification
export const csrfCheck = (req, res, next) => {
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (stateChangingMethods.includes(req.method)) {
        const origin = req.get('origin');
        const referer = req.get('referer');
        const allowedFrontend = process.env.FRONTEND_URL;

        // ✅ Accept if origin matches exactly
        if (origin === allowedFrontend) return next();

        // ✅ Accept localhost/dev environments
        if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return next();

        // ✅ Fallback for Preview URLs / Subdomains / Proxies
        if (allowedFrontend && origin && origin.startsWith(allowedFrontend.split('//')[0])) {
            // Check if the domain parts match roughly to allow subdomains/previews
            const allowedDomain = allowedFrontend.replace('https://', '').replace('http://', '');
            if (origin.includes(allowedDomain)) return next();
        }

        // ✅ Accept if referer is valid (Handles browsers that hide Origin)
        if (!origin && referer && allowedFrontend && referer.startsWith(allowedFrontend)) return next();

        // ✅ Accept if request has a valid session token in headers (Manual API call)
        if (req.headers.authorization) return next();

        // ❌ Fail only if we have NO identifier and it's a cross-site suspicion
        if (origin || referer) {
            return res.status(403).json({ 
                success: false, 
                error: `CSRF Protection: Invalid request source. Access from ${origin || 'unknown'} is blocked.` 
            });
        }
    }
    next();
};
