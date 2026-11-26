import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isTokenSessionIdleExpired } from './sessionActivity.js';

export const ALLOWED_REALTIME_DATASETS = new Set([
    'currentUser',
    'users',
    'deposits',
    'withdrawals',
    'transactions',
    'notifications',
    'paymentMethods',
    'investmentPlans',
    'rules',
    'settings',
    'transfers',
    'logs',
    'passwordResetRequests',
    'disputes',
    'tasks',
    'userTasks',
    'userTaskSubmissions'
]);

const ALLOWED_SCOPES = new Set(['global', 'admin', 'user', 'targeted']);

const createSocketAuthError = (message, code) => {
    const err = new Error(message);
    err.data = { code };
    return err;
};

export const extractSocketToken = (socket) => {
    if (!socket || !socket.handshake) return null;

    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string') {
        const trimmed = authToken.trim();
        if (trimmed && trimmed !== 'null' && trimmed !== 'undefined') {
            return trimmed.replace(/^Bearer\s+/i, '').trim();
        }
    }

    const headers = socket.handshake.headers || {};
    const headerToken = headers.authorization || headers['x-auth-token'];
    if (typeof headerToken === 'string') {
        const trimmed = headerToken.trim();
        if (trimmed && trimmed !== 'null' && trimmed !== 'undefined') {
            const match = trimmed.match(/^Bearer\s+(.+)$/i);
            return match ? match[1].trim() : trimmed;
        }
    }

    return null;
};

export const createSocketAuthMiddleware = (deps = {}) => {
    const verifyJwt = deps.verifyJwt || ((token, secret) => jwt.verify(token, secret));
    const findUserById = deps.findUserById || ((id) =>
        User.findById(id)
            .select('role status restrictions emailVerified whatsappVerified emailVerificationEnforced whatsappVerificationEnforced')
            .lean()
    );
    const getJwtSecret = deps.getJwtSecret || (() => process.env.JWT_SECRET);

    return async (socket, next) => {
        try {
            const token = extractSocketToken(socket);
            if (!token) {
                return next(createSocketAuthError('Authentication required', 'AUTH_MISSING_TOKEN'));
            }

            const secret = getJwtSecret();
            if (!secret) {
                return next(createSocketAuthError('Authentication service unavailable', 'AUTH_CONFIG_ERROR'));
            }

            let decoded;
            try {
                decoded = verifyJwt(token, secret);
            } catch {
                return next(createSocketAuthError('Invalid or expired token', 'AUTH_INVALID_TOKEN'));
            }

            if (isTokenSessionIdleExpired(token)) {
                return next(createSocketAuthError('Session expired due to inactivity.', 'AUTH_IDLE_EXPIRED'));
            }

            const userId = decoded?.id || decoded?._id || decoded?.userId;
            if (!userId) {
                return next(createSocketAuthError('Invalid or expired token', 'AUTH_INVALID_TOKEN'));
            }

            const dbUser = await findUserById(userId);
            if (!dbUser) {
                return next(createSocketAuthError('Account not found', 'AUTH_USER_NOT_FOUND'));
            }

            if (dbUser.status === 'Blocked' || dbUser.status === 'Banned' || dbUser.restrictions?.loginBlocked) {
                return next(createSocketAuthError('Account restricted or blocked', 'AUTH_ACCOUNT_BLOCKED'));
            }

            const role = dbUser.role ? String(dbUser.role).trim().toLowerCase() : 'user';

            socket.user = {
                id: String(dbUser._id || userId),
                role,
                status: dbUser.status || 'Active',
                emailVerified: Boolean(dbUser.emailVerified),
                whatsappVerified: Boolean(dbUser.whatsappVerified),
                emailVerificationEnforced: Boolean(dbUser.emailVerificationEnforced),
                whatsappVerificationEnforced: Boolean(dbUser.whatsappVerificationEnforced),
                tokenExp: typeof decoded.exp === 'number' ? decoded.exp : null
            };

            return next();
        } catch (err) {
            console.error('Socket authentication verification failed:', err?.message || err);
            return next(createSocketAuthError('Authentication failed', 'AUTH_ERROR'));
        }
    };
};

export const registerSocketConnection = (socket) => {
    if (!socket || !socket.user?.id) {
        if (socket && typeof socket.disconnect === 'function') {
            socket.disconnect(true);
        }
        return () => {};
    }

    const userRoom = `user:${socket.user.id}`;
    socket.join('authenticated');
    socket.join(userRoom);

    if (socket.user.role === 'admin' || socket.user.role === 'super_admin') {
        socket.join('role:admin');
    }

    let expiryTimer = null;
    if (typeof socket.user.tokenExp === 'number' && Number.isFinite(socket.user.tokenExp)) {
        const msUntilExpiry = socket.user.tokenExp * 1000 - Date.now();
        if (msUntilExpiry <= 0) {
            socket.emit('SESSION_EXPIRED');
            socket.disconnect(true);
            return () => {};
        }
        if (msUntilExpiry <= 2147483647) {
            expiryTimer = setTimeout(() => {
                expiryTimer = null;
                if (socket.connected) {
                    socket.emit('SESSION_EXPIRED');
                    socket.disconnect(true);
                }
            }, msUntilExpiry);
            if (typeof expiryTimer.unref === 'function') {
                expiryTimer.unref();
            }
        }
    }

    const cleanup = () => {
        if (expiryTimer) {
            clearTimeout(expiryTimer);
            expiryTimer = null;
        }
    };

    if (typeof socket.on === 'function') {
        socket.on('disconnect', cleanup);
    }

    return cleanup;
};

export const sanitizeRealtimePayload = (options = {}) => {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        return null;
    }

    if (typeof options.scope !== 'string' || !ALLOWED_SCOPES.has(options.scope)) {
        return null;
    }

    const scope = options.scope;
    const rawDatasets = Array.isArray(options.datasets) ? options.datasets : [];
    const datasets = Array.from(new Set(
        rawDatasets
            .filter((item) => typeof item === 'string' && ALLOWED_REALTIME_DATASETS.has(item))
    ));

    const payload = { scope };
    if (datasets.length > 0) {
        payload.datasets = datasets;
    }
    if (typeof options.version === 'number' && Number.isFinite(options.version) && options.version > 0) {
        payload.version = options.version;
    }
    if (typeof options.event === 'string' && options.event.trim()) {
        payload.event = options.event.trim();
    }
    return payload;
};

export const emitRealtimeChange = (io, options = {}) => {
    if (!io || typeof io.to !== 'function') return false;

    const payload = sanitizeRealtimePayload(options);
    if (!payload) {
        return false;
    }

    const { scope } = payload;

    if (scope === 'admin') {
        io.to('role:admin').emit('DATA_CHANGED', payload);
        return true;
    }

    if (scope === 'user' || scope === 'targeted') {
        const rooms = [];
        const rawTargetIds = Array.isArray(options.targetUserIds)
            ? options.targetUserIds
            : (options.targetUserId ? [options.targetUserId] : []);

        for (const id of rawTargetIds) {
            const normalized = String(id || '').trim();
            if (normalized) {
                rooms.push(`user:${normalized}`);
            }
        }

        if (options.includeAdmins !== false) {
            rooms.push('role:admin');
        }

        const uniqueRooms = Array.from(new Set(rooms));
        if (uniqueRooms.length === 0) {
            return false;
        }

        let target = io.to(uniqueRooms[0]);
        for (let i = 1; i < uniqueRooms.length; i += 1) {
            target = target.to(uniqueRooms[i]);
        }
        target.emit('DATA_CHANGED', payload);
        return true;
    }

    if (scope === 'global') {
        io.to('authenticated').emit('DATA_CHANGED', payload);
        return true;
    }

    return false;
};

export const revokeUserSockets = (io, userId, options = {}) => {
    const normalizedId = String(userId || '').trim();
    if (!io || !normalizedId || typeof io.in !== 'function') {
        return false;
    }

    const room = `user:${normalizedId}`;
    const roomOperator = io.in(room);
    if (!roomOperator) {
        return false;
    }

    if (options.terminateSession === true && typeof roomOperator.emit === 'function') {
        roomOperator.emit('SESSION_EXPIRED', {
            reason: typeof options.reason === 'string' && options.reason ? options.reason : 'session_revoked'
        });
    }

    if (typeof roomOperator.disconnectSockets === 'function') {
        roomOperator.disconnectSockets(true);
        return true;
    }

    return false;
};
