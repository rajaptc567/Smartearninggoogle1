import { createHash } from 'crypto';

export const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SESSION_RETENTION_MS = 25 * 60 * 60 * 1000; // Clean entries older than 25h (past 24h JWT expiry)
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 50000;

/**
 * In-memory sliding idle session tracker keyed by SHA-256 token digest.
 * Avoids per-request DB writes while enforcing strict 10-minute inactivity expiration.
 */
const sessionActivityMap = new Map();

export const hashSessionToken = (token) => {
    if (typeof token !== 'string' || !token.trim()) return null;
    return createHash('sha256').update(token.trim()).digest('hex');
};

export const pruneExpiredSessions = (now = Date.now()) => {
    for (const [key, entry] of sessionActivityMap.entries()) {
        const age = now - (entry.createdAt || entry.lastActivity || 0);
        if (age > MAX_SESSION_RETENTION_MS) {
            sessionActivityMap.delete(key);
        }
    }
    while (sessionActivityMap.size > MAX_ENTRIES) {
        const oldestKey = sessionActivityMap.keys().next().value;
        if (!oldestKey) break;
        sessionActivityMap.delete(oldestKey);
    }
};

const pruneTimer = setInterval(() => {
    pruneExpiredSessions();
}, PRUNE_INTERVAL_MS);

if (typeof pruneTimer.unref === 'function') {
    pruneTimer.unref();
}

export const registerTokenActivity = (token, now = Date.now()) => {
    const key = hashSessionToken(token);
    if (!key) return;
    if (sessionActivityMap.size >= MAX_ENTRIES) {
        pruneExpiredSessions(now);
    }
    sessionActivityMap.set(key, {
        lastActivity: now,
        createdAt: now,
        invalidated: false
    });
};

export const isTokenSessionIdleExpired = (token, now = Date.now()) => {
    const key = hashSessionToken(token);
    if (!key) return false;
    const entry = sessionActivityMap.get(key);
    if (!entry) {
        // First time seeing an already-valid JWT (e.g., after server restart): start idle clock now
        sessionActivityMap.set(key, {
            lastActivity: now,
            createdAt: now,
            invalidated: false
        });
        return false;
    }
    if (entry.invalidated) {
        return true;
    }
    if (now - entry.lastActivity >= IDLE_TIMEOUT_MS) {
        entry.invalidated = true;
        return true;
    }
    return false;
};

export const touchTokenActivity = (token, now = Date.now()) => {
    const key = hashSessionToken(token);
    if (!key) return false;
    const entry = sessionActivityMap.get(key);
    if (!entry) {
        sessionActivityMap.set(key, {
            lastActivity: now,
            createdAt: now,
            invalidated: false
        });
        return true;
    }
    if (entry.invalidated || now - entry.lastActivity >= IDLE_TIMEOUT_MS) {
        entry.invalidated = true;
        return false;
    }
    entry.lastActivity = now;
    return true;
};

export const invalidateTokenSession = (token) => {
    const key = hashSessionToken(token);
    if (!key) return;
    sessionActivityMap.set(key, {
        lastActivity: 0,
        createdAt: Date.now(),
        invalidated: true
    });
};

export const clearAllTrackedSessions = () => {
    sessionActivityMap.clear();
};

export const getTrackedSessionState = (token) => {
    const key = hashSessionToken(token);
    if (!key) return null;
    return sessionActivityMap.get(key) || null;
};
