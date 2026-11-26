import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

import {
    IDLE_TIMEOUT_MS,
    registerTokenActivity,
    isTokenSessionIdleExpired,
    touchTokenActivity,
    invalidateTokenSession,
    clearAllTrackedSessions
} from './backend/utils/sessionActivity.js';
import { authMiddleware, authorize } from './backend/middleware/authMiddleware.js';
import { createSocketAuthMiddleware } from './backend/utils/socketRealtime.js';

const ROOT = process.cwd();

const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
    return res;
};

async function runTests() {
    let passed = 0;
    const test = async (name, fn) => {
        try {
            await fn();
            passed++;
            console.log(`PASS: ${name}`);
        } catch (err) {
            console.error(`FAIL: ${name}`);
            throw err;
        }
    };

    const prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test_secret_idle_suite';

    try {
        await test('1. sessionActivity enforces exact 10-minute sliding idle timeout and explicit logout invalidation', () => {
            clearAllTrackedSessions();
            assert.equal(IDLE_TIMEOUT_MS, 10 * 60 * 1000);

            const t0 = 1_700_000_000_000;
            const tok = 'jwt_sample_token_1';
            registerTokenActivity(tok, t0);

            assert.equal(isTokenSessionIdleExpired(tok, t0 + 9 * 60 * 1000), false);
            assert.equal(touchTokenActivity(tok, t0 + 9 * 60 * 1000), true);
            // Extended from 9m -> valid at 18m (9m after touch), expired at 19m (10m after touch)
            assert.equal(isTokenSessionIdleExpired(tok, t0 + 18 * 60 * 1000), false);
            assert.equal(isTokenSessionIdleExpired(tok, t0 + 19 * 60 * 1000), true);
            assert.equal(touchTokenActivity(tok, t0 + 19 * 60 * 1000 + 1000), false);

            const tok2 = 'jwt_sample_token_2';
            registerTokenActivity(tok2, t0);
            invalidateTokenSession(tok2);
            assert.equal(isTokenSessionIdleExpired(tok2, t0 + 1000), true);
        });

        await test('2. authMiddleware + authorize return 401 SESSION_IDLE_EXPIRED after 10m idle and ignore X-Background-Sync', async () => {
            clearAllTrackedSessions();
            const token = jwt.sign({ id: 'u1', role: 'user', email: 'u1@example.com' }, process.env.JWT_SECRET, { expiresIn: '24h' });
            const tPast = Date.now() - (9 * 60 * 1000 + 30 * 1000);
            registerTokenActivity(token, tPast);

            // Background sync GET must NOT reset the 10-min idle clock
            const bgReq = {
                method: 'GET',
                originalUrl: '/api/v1/tasks',
                headers: {
                    authorization: `Bearer ${token}`,
                    'x-background-sync': '1'
                }
            };
            let nextCalled = false;
            authMiddleware(bgReq, createMockRes(), () => { nextCalled = true; });
            assert.equal(nextCalled, true);
            assert.equal(bgReq.user?.id, 'u1');

            // Still expires 31 seconds later (total 10m01s from tPast)
            assert.equal(isTokenSessionIdleExpired(token, tPast + 10 * 60 * 1000 + 1000), true);

            // Expired request hits authorize -> 401 SESSION_IDLE_EXPIRED
            const expiredReq = {
                method: 'GET',
                originalUrl: '/api/v1/users/u1',
                headers: { authorization: `Bearer ${token}` }
            };
            authMiddleware(expiredReq, createMockRes(), () => {});
            assert.equal(expiredReq.sessionIdleExpired, true);
            assert.equal(expiredReq.user, null);

            const authzRes = createMockRes();
            await authorize(['user'])(expiredReq, authzRes, () => {});
            assert.equal(authzRes.statusCode, 401);
            assert.equal(authzRes.body.code, 'SESSION_IDLE_EXPIRED');
        });

        await test('3. Socket auth rejects idle-expired tokens with AUTH_IDLE_EXPIRED', async () => {
            clearAllTrackedSessions();
            const token = jwt.sign({ id: 'u2', role: 'user', email: 'u2@example.com' }, process.env.JWT_SECRET, { expiresIn: '24h' });
            registerTokenActivity(token, Date.now() - (11 * 60 * 1000));

            const mw = createSocketAuthMiddleware({
                getJwtSecret: () => process.env.JWT_SECRET,
                findUserById: async (id) => ({ _id: id, role: 'user', status: 'Active' })
            });

            let errReceived = null;
            await mw({ handshake: { auth: { token }, headers: {} } }, (err) => { errReceived = err || null; });
            assert.ok(errReceived, 'Expected socket auth rejection for idle-expired token');
            assert.equal(errReceived.data?.code, 'AUTH_IDLE_EXPIRED');
        });

        await test('4. Frontend DataContext enforces 9m warning, 10m same-screen lock overlay, and pre-reset expiry check', () => {
            const dcSrc = fs.readFileSync(path.join(ROOT, 'context/DataContext.tsx'), 'utf8');
            assert.ok(dcSrc.includes('INACTIVITY_WARNING_MS = 9 * 60 * 1000'));
            assert.ok(dcSrc.includes('INACTIVITY_LIMIT_MS = 10 * 60 * 1000'));
            assert.ok(dcSrc.includes('Stay Active'));
            assert.ok(dcSrc.includes('Session Expired'));
            assert.ok(dcSrc.includes('Sign In Again'));
            assert.ok(dcSrc.includes('smartexn:session-idle-expired'));
            assert.ok(dcSrc.includes("AUTH_IDLE_EXPIRED"));
            assert.ok(dcSrc.includes('backgroundSync: true'));
        });

        await test('5. Auth pages use rotating spinner loading indicators without blocking UI flow', () => {
            const loginSrc = fs.readFileSync(path.join(ROOT, 'pages/Login.tsx'), 'utf8');
            const regSrc = fs.readFileSync(path.join(ROOT, 'pages/Register.tsx'), 'utf8');
            const forgotSrc = fs.readFileSync(path.join(ROOT, 'pages/ForgotPassword.tsx'), 'utf8');
            const resetSrc = fs.readFileSync(path.join(ROOT, 'pages/ResetPassword.tsx'), 'utf8');

            assert.ok(loginSrc.includes('isLoading={isLoading || isRedirecting}'));
            assert.ok(loginSrc.includes('Opening Dashboard...'));
            assert.ok(regSrc.includes('isLoading={isSubmitting}'));
            assert.ok(regSrc.includes('Creating Account...'));
            assert.ok(forgotSrc.includes('isLoading={isLoading}'));
            assert.ok(resetSrc.includes('isLoading={isLoading}') && resetSrc.includes('animate-spin'));
        });

        console.log(`\nALL ${passed} SESSION INACTIVITY & SPINNER TESTS PASSED.`);
    } finally {
        clearAllTrackedSessions();
        if (prevSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = prevSecret;
    }
}

runTests().catch((err) => {
    console.error(err);
    process.exit(1);
});
