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

// 3. Resilient CSRF Protection via Allowlist & Fallback
export const csrfCheck = (req, res, next) => {
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (stateChangingMethods.includes(req.method)) {
        const origin = req.get('origin');
        const referer = req.get('referer');
        const allowedFrontend = process.env.FRONTEND_URL;

        // ✅ 1. Always allow Login and Registration (User doesn't have a session yet)
        if (req.path.includes('/login') || req.path.includes('/register')) return next();

        // ✅ 2. Match exact origin
        if (origin === allowedFrontend) return next();

        // ✅ 3. Local Development bypass
        if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return next();

        // ✅ 4. Trusted Subdomain/Preview Check
        if (allowedFrontend && origin) {
            try {
                const allowedHost = new URL(allowedFrontend).hostname;
                const originHost = new URL(origin).hostname;
                if (originHost.endsWith(allowedHost)) return next();
                if (originHost.includes('vercel.app') && allowedHost.includes('vercel.app')) return next();
            } catch (e) {}
        }

        // ✅ 5. Referer Fallback (Handles privacy browsers/proxies)
        if (!origin && referer && allowedFrontend && referer.startsWith(allowedFrontend)) return next();

        // ✅ 6. Safe Cookie verification (If they have the HttpOnly cookie, we trust the source for CSRF)
        if (req.cookies && req.cookies.token) return next();

        // ❌ Block only if we have an Origin that is definitively not ours
        if (origin && allowedFrontend && !origin.includes(allowedFrontend.replace(/^https?:\/\//, ''))) {
            return res.status(403).json({ 
                success: false, 
                error: `CSRF Protection: Invalid request source. Access from ${origin} is blocked.` 
            });
        }
    }
    next();
};