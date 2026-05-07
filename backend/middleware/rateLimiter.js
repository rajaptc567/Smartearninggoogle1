
import rateLimit from 'express-rate-limit';

/**
 * GLOBAL LIMITER
 * Applied to all API routes to prevent general DoS.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per window
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * AUTH LIMITER
 * Strict limits for Login, Register, and Password Reset to block brute-force.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 attempts per 15 mins
    message: {
        success: false,
        error: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * FINANCIAL ACTION LIMITER
 * Prevents automated spam of deposits, withdrawals, and transfers.
 */
export const financeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 actions per 15 mins
    message: {
        success: false,
        error: 'Transaction frequency limit exceeded. Please wait 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
