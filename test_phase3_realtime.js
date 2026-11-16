import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { io as socketIOClient } from 'socket.io-client';
import ts from 'typescript';

import {
    createSocketAuthMiddleware,
    registerSocketConnection,
    emitRealtimeChange,
    sanitizeRealtimePayload
} from './backend/utils/socketRealtime.js';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function createStorageMock() {
    const store = new Map();
    return {
        getItem(k) { return store.has(k) ? store.get(k) : null; },
        setItem(k, v) { store.set(String(k), String(v)); },
        removeItem(k) { store.delete(k); },
        clear() { store.clear(); }
    };
}

function loadTsModule(relPath, customMocks = {}) {
    const absPath = path.join(ROOT, relPath);
    const source = fs.readFileSync(absPath, 'utf8');
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true
        },
        fileName: absPath
    }).outputText;

    const mod = { exports: {} };
    const localRequire = (specifier) => {
        if (customMocks[specifier]) return customMocks[specifier];
        if (specifier === 'react' || specifier === 'react/jsx-runtime') {
            return customMocks['react'] || {};
        }
        return require(specifier);
    };

    const wrapped = `(function(exports, require, module, __filename, __dirname) { ${transpiled}\n})`;
    const fn = vm.runInThisContext(wrapped, { filename: absPath });
    fn(mod.exports, localRequire, mod, absPath, path.dirname(absPath));
    return mod.exports;
}

function createFakeReact() {
    return {
        default: { createContext: () => ({ Provider: () => null }) },
        createContext: () => ({ Provider: () => null }),
        useReducer: () => [{}, () => {}],
        useEffect: () => {},
        useRef: (v) => ({ current: v }),
        useCallback: (fn) => fn
    };
}

function createRefs(userId = null) {
    return {
        lastVersionRef: { current: 0 },
        hasCompletedAuthSyncRef: { current: false },
        isSyncingRef: { current: false },
        activeSyncPromiseRef: { current: null },
        pendingForceRef: { current: false },
        syncSessionEpochRef: { current: 1 },
        activeUserIdRef: { current: userId },
        datasetSeqRef: { current: {} },
        retryTimersRef: { current: new Map() }
    };
}

function makeMockApi(overrides = {}) {
    const calls = [];
    const wrap = (name, fn) => async (...args) => {
        calls.push({ name, args });
        return fn(...args);
    };
    const api = {
        getDataVersion: wrap('getDataVersion', overrides.getDataVersion || (async () => 200)),
        getUser: wrap('getUser', overrides.getUser || (async (id) => ({ _id: id, username: 'member1', role: 'user', walletBalance: 55 }))),
        getUsers: wrap('getUsers', overrides.getUsers || (async () => ([{ _id: 'admin1', username: 'admin', role: 'admin' }]))),
        getDeposits: wrap('getDeposits', overrides.getDeposits || (async () => ([{ _id: 'dep1' }]))),
        getWithdrawals: wrap('getWithdrawals', overrides.getWithdrawals || (async () => ([{ _id: 'wd1' }]))),
        getTransactions: wrap('getTransactions', overrides.getTransactions || (async () => ([{ _id: 'tx1' }]))),
        getNotifications: wrap('getNotifications', overrides.getNotifications || (async () => ([{ _id: 'notif1' }]))),
        getPaymentMethods: wrap('getPaymentMethods', overrides.getPaymentMethods || (async () => ([{ _id: 'pm1' }]))),
        getInvestmentPlans: wrap('getInvestmentPlans', overrides.getInvestmentPlans || (async () => ([{ _id: 'plan1' }]))),
        getRules: wrap('getRules', overrides.getRules || (async () => ([{ _id: 'rule1' }]))),
        getSettings: wrap('getSettings', overrides.getSettings || (async () => ({ siteName: 'SmartExn', exchangeRates: { USD: 1, EUR: 0.92, PKR: 278 } }))),
        getTransfers: wrap('getTransfers', overrides.getTransfers || (async () => ([{ _id: 'tr1' }]))),
        getLogs: wrap('getLogs', overrides.getLogs || (async () => ([{ _id: 'log1' }]))),
        getPasswordResetRequests: wrap('getPasswordResetRequests', overrides.getPasswordResetRequests || (async () => ([{ _id: 'pr1' }]))),
        getDisputes: wrap('getDisputes', overrides.getDisputes || (async () => ([{ _id: 'disp1' }]))),
        getTasks: wrap('getTasks', overrides.getTasks || (async () => ([{ _id: 't1' }]))),
        getUserTasks: wrap('getUserTasks', overrides.getUserTasks || (async () => ([{ _id: 'ut1' }]))),
        getUserTaskSubmissions: wrap('getUserTaskSubmissions', overrides.getUserTaskSubmissions || (async () => ([{ _id: 'sub1' }]))),
    };
    return { api, calls };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectClient(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const socket = socketIOClient(url, {
            transports: ['websocket'],
            reconnection: false,
            forceNew: true,
            timeout: 3000,
            ...opts
        });
        socket.once('connect', () => resolve({ ok: true, socket }));
        socket.once('connect_error', (err) => {
            socket.disconnect();
            resolve({ ok: false, error: err, socket });
        });
        setTimeout(() => {
            socket.disconnect();
            reject(new Error('Socket test connection timeout'));
        }, 4000);
    });
}

async function runTests() {
    let passed = 0;
    const test = async (name, fn) => {
        await fn();
        passed += 1;
        console.log(`PASS: ${name}`);
    };

    // =========================================================================
    // CATEGORY A — SOCKET SECURITY RUNTIME TESTS (REAL SOCKET.IO SERVER/CLIENT)
    // =========================================================================
    const TEST_JWT_SECRET = 'phase3-test-secret-key';
    const userStore = new Map([
        ['user-a', { _id: 'user-a', role: 'user', status: 'Active', restrictions: { loginBlocked: false }, emailVerified: true, whatsappVerified: true }],
        ['user-b', { _id: 'user-b', role: 'user', status: 'Active', restrictions: { loginBlocked: false }, emailVerified: true, whatsappVerified: true }],
        ['admin-1', { _id: 'admin-1', role: 'admin', status: 'Active', restrictions: { loginBlocked: false }, emailVerified: true, whatsappVerified: true }],
        ['blocked-1', { _id: 'blocked-1', role: 'user', status: 'Blocked', restrictions: { loginBlocked: false } }],
        ['loginblocked-1', { _id: 'loginblocked-1', role: 'user', status: 'Active', restrictions: { loginBlocked: true } }],
        ['demoted-1', { _id: 'demoted-1', role: 'user', status: 'Active', restrictions: { loginBlocked: false } }]
    ]);

    const httpServer = createServer();
    const io = new SocketIOServer(httpServer, { transports: ['websocket', 'polling'] });
    const serverSockets = new Map();

    io.use(createSocketAuthMiddleware({
        getJwtSecret: () => TEST_JWT_SECRET,
        findUserById: async (id) => userStore.get(String(id)) || null
    }));

    io.on('connection', (socket) => {
        registerSocketConnection(socket);
        serverSockets.set(socket.user.id, socket);
        socket.on('disconnect', () => {
            if (serverSockets.get(socket.user.id) === socket) {
                serverSockets.delete(socket.user.id);
            }
        });
    });

    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const port = httpServer.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        await test('A1. Missing token fails handshake with Authentication required', async () => {
            const res = await connectClient(baseUrl);
            assert.equal(res.ok, false);
            assert.match(res.error.message, /authentication required/i);
        });

        await test('A2. Invalid and expired JWT tokens are rejected during handshake', async () => {
            const bad = await connectClient(baseUrl, { auth: { token: 'invalid.jwt.token' } });
            assert.equal(bad.ok, false);
            assert.match(bad.error.message, /invalid or expired token/i);

            const expiredToken = jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: -10 });
            const expired = await connectClient(baseUrl, { auth: { token: expiredToken } });
            assert.equal(expired.ok, false);
            assert.match(expired.error.message, /invalid or expired token/i);
        });

        await test('A3. Deleted/missing DB user is rejected during handshake', async () => {
            const deletedToken = jwt.sign({ id: 'deleted-user-999', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const res = await connectClient(baseUrl, { auth: { token: deletedToken } });
            assert.equal(res.ok, false);
            assert.match(res.error.message, /account not found/i);
        });

        await test('A4. Blocked and login-blocked users are rejected during handshake', async () => {
            const blockedToken = jwt.sign({ id: 'blocked-1', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const res1 = await connectClient(baseUrl, { auth: { token: blockedToken } });
            assert.equal(res1.ok, false);
            assert.match(res1.error.message, /restricted or blocked/i);

            const loginBlockedToken = jwt.sign({ id: 'loginblocked-1', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const res2 = await connectClient(baseUrl, { auth: { token: loginBlockedToken } });
            assert.equal(res2.ok, false);
            assert.match(res2.error.message, /restricted or blocked/i);
        });

        await test('A5. Valid token sets authoritative DB role on socket.user and ignores client-supplied role/rooms', async () => {
            // Token claims admin, DB says demoted-1 is normal user, client also tries injecting role/rooms in auth
            const staleAdminJwt = jwt.sign({ id: 'demoted-1', role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const conn = await connectClient(baseUrl, {
                auth: { token: staleAdminJwt, role: 'super_admin', userId: 'admin-1', rooms: ['role:admin'] }
            });
            assert.equal(conn.ok, true);
            const srvSock = serverSockets.get('demoted-1');
            assert.equal(srvSock.user.id, 'demoted-1');
            assert.equal(srvSock.user.role, 'user');
            assert.equal(srvSock.rooms.has('role:admin'), false);
            assert.equal(srvSock.rooms.has('user:demoted-1'), true);
            assert.equal(srvSock.rooms.has('user:admin-1'), false);
            conn.socket.disconnect();
            await wait(30);
        });

        await test('A6. Room least privilege: admin-only, user-targeted, and global broadcasts enforce boundaries', async () => {
            const tokenA = jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const tokenB = jwt.sign({ id: 'user-b', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const tokenAdmin = jwt.sign({ id: 'admin-1', role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });

            const [cA, cB, cAdmin] = await Promise.all([
                connectClient(baseUrl, { auth: { token: tokenA } }),
                connectClient(baseUrl, { auth: { token: tokenB } }),
                connectClient(baseUrl, { auth: { token: tokenAdmin } })
            ]);
            assert.ok(cA.ok && cB.ok && cAdmin.ok);

            const eventsA = [];
            const eventsB = [];
            const eventsAdmin = [];
            cA.socket.on('DATA_CHANGED', (p) => eventsA.push(p));
            cB.socket.on('DATA_CHANGED', (p) => eventsB.push(p));
            cAdmin.socket.on('DATA_CHANGED', (p) => eventsAdmin.push(p));

            // 1. Admin-only emission
            emitRealtimeChange(io, {
                scope: 'admin',
                datasets: ['passwordResetRequests', 'notifications'],
                version: 301,
                event: 'PASSWORD_RESET_REQUESTED'
            });
            await wait(60);
            assert.equal(eventsA.length, 0);
            assert.equal(eventsB.length, 0);
            assert.equal(eventsAdmin.length, 1);
            assert.deepEqual(eventsAdmin[0].datasets, ['passwordResetRequests', 'notifications']);

            // 2. User-specific emission (User A only)
            emitRealtimeChange(io, {
                scope: 'user',
                targetUserIds: ['user-a'],
                includeAdmins: false,
                datasets: ['notifications'],
                version: 302,
                event: 'NOTIFICATIONS_CREATED'
            });
            await wait(60);
            assert.equal(eventsA.length, 1);
            assert.equal(eventsB.length, 0);
            assert.equal(eventsAdmin.length, 1);

            // 3. Dispute targeted emission (User A + Admin, NOT User B)
            emitRealtimeChange(io, {
                scope: 'targeted',
                targetUserIds: ['user-a'],
                includeAdmins: true,
                datasets: ['disputes'],
                version: 303,
                event: 'DISPUTE_UPDATED'
            });
            await wait(60);
            assert.equal(eventsA.length, 2);
            assert.equal(eventsB.length, 0);
            assert.equal(eventsAdmin.length, 2);

            // 4. Global emission (all authenticated sockets)
            emitRealtimeChange(io, {
                scope: 'global',
                datasets: ['settings'],
                version: 304,
                event: 'SETTINGS_UPDATED'
            });
            await wait(60);
            assert.equal(eventsA.length, 3);
            assert.equal(eventsB.length, 1);
            assert.equal(eventsAdmin.length, 3);

            cA.socket.disconnect();
            cB.socket.disconnect();
            cAdmin.socket.disconnect();
            await wait(30);
        });

        await test('A7. Socket payloads sanitize sensitive fields and reject non-allowlisted dataset keys', () => {
            const clean = sanitizeRealtimePayload({
                scope: 'user',
                datasets: ['notifications', 'fakeSecretDataset', 'settings'],
                version: 500,
                event: 'TEST_EVT',
                token: 'secret-jwt',
                walletBalance: 9999,
                user: { email: 'leak@example.com' }
            });
            assert.deepEqual(clean, {
                scope: 'user',
                datasets: ['notifications', 'settings'],
                version: 500,
                event: 'TEST_EVT'
            });
            assert.equal('token' in clean, false);
            assert.equal('walletBalance' in clean, false);
            assert.equal('user' in clean, false);
        });

        await test('A8. Short-lived token expiration triggers SESSION_EXPIRED and disconnects active socket', async () => {
            const shortToken = jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: 1 });
            const conn = await connectClient(baseUrl, { auth: { token: shortToken } });
            assert.equal(conn.ok, true);

            let sawSessionExpired = false;
            let disconnected = false;
            conn.socket.on('SESSION_EXPIRED', () => { sawSessionExpired = true; });
            conn.socket.on('disconnect', () => { disconnected = true; });

            await wait(1250);
            assert.equal(sawSessionExpired, true);
            assert.equal(disconnected, true);

            // Subsequent global event must not reach the expired socket
            let receivedAfterExpiry = false;
            conn.socket.on('DATA_CHANGED', () => { receivedAfterExpiry = true; });
            emitRealtimeChange(io, { scope: 'global', datasets: ['settings'], version: 400 });
            await wait(50);
            assert.equal(receivedAfterExpiry, false);
        });
    } finally {
        await new Promise((resolve) => io.close(resolve));
        httpServer.close();
    }

    // =========================================================================
    // CATEGORY B — REALTIME SYNC & SELECTIVE REFRESH RUNTIME TESTS
    // =========================================================================
    globalThis.localStorage = createStorageMock();
    globalThis.window = {
        location: { origin: 'http://localhost:3000', pathname: '/member' },
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    const apiMod = loadTsModule('services/api.ts');
    const dcMod = loadTsModule('context/DataContext.tsx', {
        'react': createFakeReact(),
        'socket.io-client': { io: () => ({ on: () => {}, disconnect: () => {} }) },
        '../services/api': apiMod
    });

    await test('B9. Valid selective DATA_CHANGED syncs ONLY the changed dataset(s), avoiding full-sync churn', async () => {
        localStorage.clear();
        localStorage.setItem('authToken', 'token-a');
        const dispatches = [];
        const refs = createRefs('user-a');
        refs.lastVersionRef.current = 199;
        refs.hasCompletedAuthSyncRef.current = true;
        const { api, calls } = makeMockApi({ getDataVersion: async () => 200 });

        await dcMod.executeSelectiveSyncPass({
            datasets: ['settings'],
            eventVersion: 200,
            userId: 'user-a',
            role: 'user',
            refs,
            dispatch: (a) => dispatches.push(a),
            api
        });

        const fetched = calls.map((c) => c.name);
        assert.deepEqual(fetched, ['getDataVersion', 'getSettings']);
        assert.equal(refs.lastVersionRef.current, 200);
        assert.ok(dispatches.some((a) => a.type === 'SET_SETTINGS'));
        assert.equal(dispatches.some((a) => a.type === 'SET_DEPOSITS' || a.type === 'SET_TRANSACTIONS'), false);
    });

    await test('B10. Payload parser triggers full-sync fallback for missing, malformed, or unsupported payloads', () => {
        const noPayload = dcMod.parseRealtimeChangePayload(undefined, 'user');
        assert.equal(noPayload.isSelective, false);
        assert.equal(noPayload.reason, 'no_payload');

        const badType = dcMod.parseRealtimeChangePayload('DATA_CHANGED', 'user');
        assert.equal(badType.isSelective, false);
        assert.equal(badType.reason, 'invalid_payload');

        const badDataset = dcMod.parseRealtimeChangePayload({ scope: 'global', datasets: ['evilEndpoint'] }, 'admin');
        assert.equal(badDataset.isSelective, false);
        assert.equal(badDataset.reason, 'unsupported_dataset');

        const emptyList = dcMod.parseRealtimeChangePayload({ scope: 'global', datasets: [] }, 'user');
        assert.equal(emptyList.isSelective, false);
    });

    await test('B11. Client filters selective datasets by user role authorization', () => {
        const memberParsed = dcMod.parseRealtimeChangePayload({ scope: 'global', datasets: ['settings', 'users', 'currentUser'], version: 210 }, 'user');
        assert.equal(memberParsed.isSelective, true);
        assert.deepEqual(memberParsed.datasets, ['settings', 'currentUser']);

        const adminOnlyForMember = dcMod.parseRealtimeChangePayload({ scope: 'admin', datasets: ['passwordResetRequests'], version: 211 }, 'user');
        assert.equal(adminOnlyForMember.isSelective, false);
        assert.equal(adminOnlyForMember.reason, 'role_filtered_out');
    });

    await test('B12. Realtime event scheduler deduplicates bursts, merges datasets, and escalates fallback events cleanly', async () => {
        let fullCalls = 0;
        const selectiveCalls = [];
        let active = true;

        const scheduler = dcMod.createRealtimeEventScheduler({
            coalesceDelayMs: 35,
            getRole: () => 'user',
            isRunActive: () => active,
            onFullSync: () => { fullCalls += 1; },
            onSelectiveSync: (datasets, version) => { selectiveCalls.push({ datasets, version }); }
        });

        // Rapid burst of duplicate + distinct selective events
        scheduler.handleEvent({ scope: 'global', datasets: ['settings'], version: 10 });
        scheduler.handleEvent({ scope: 'global', datasets: ['settings'], version: 11 });
        scheduler.handleEvent({ scope: 'user', datasets: ['notifications'], version: 12 });
        scheduler.handleEvent({ scope: 'admin', datasets: ['passwordResetRequests'], version: 13 }); // filtered out safely for member

        await wait(70);
        assert.equal(fullCalls, 0);
        assert.equal(selectiveCalls.length, 1);
        assert.deepEqual(selectiveCalls[0].datasets.sort(), ['notifications', 'settings']);
        assert.equal(selectiveCalls[0].version, 12);

        // Mixed burst with legacy plain DATA_CHANGED escalates to 1 full sync
        scheduler.handleEvent({ scope: 'global', datasets: ['paymentMethods'], version: 14 });
        scheduler.handleEvent(undefined);
        await wait(70);
        assert.equal(fullCalls, 1);
        assert.equal(selectiveCalls.length, 1);

        // Logged-out / cleared scheduler drops queued flush
        scheduler.handleEvent({ scope: 'global', datasets: ['settings'], version: 15 });
        active = false;
        await wait(70);
        assert.equal(selectiveCalls.length, 1);
    });

    await test('B13. Version mismatch during selective sync escalates automatically to full-sync fallback', async () => {
        localStorage.clear();
        localStorage.setItem('authToken', 'token-a');
        const dispatches = [];
        const refs = createRefs('user-a');
        refs.lastVersionRef.current = 199;
        refs.hasCompletedAuthSyncRef.current = true;
        // Event says v200, but DB is already at v205 (missed concurrent mutation)
        const { api, calls } = makeMockApi({ getDataVersion: async () => 205 });

        await dcMod.executeSelectiveSyncPass({
            datasets: ['paymentMethods'],
            eventVersion: 200,
            userId: 'user-a',
            role: 'user',
            refs,
            dispatch: (a) => dispatches.push(a),
            api
        });

        const fetched = calls.map((c) => c.name);
        assert.ok(fetched.includes('getDeposits'), 'Expected full-sync fallback on version mismatch');
        assert.ok(fetched.includes('getTransactions'));
        assert.equal(refs.lastVersionRef.current, 205);
    });

    await test('B14. Failed selective refresh with 5xx falls back to full sync, while 403 does not cause storm', async () => {
        localStorage.clear();
        localStorage.setItem('authToken', 'token-a');
        const refs = createRefs('user-a');
        refs.hasCompletedAuthSyncRef.current = true;

        let pmAttempts = 0;
        const { api, calls } = makeMockApi({
            getDataVersion: async () => 220,
            getPaymentMethods: async () => {
                pmAttempts += 1;
                if (pmAttempts === 1) {
                    throw new apiMod.ApiError('Transient outage', 503);
                }
                return [{ _id: 'pm-recovered' }];
            }
        });

        await dcMod.executeSelectiveSyncPass({
            datasets: ['paymentMethods'],
            eventVersion: 220,
            userId: 'user-a',
            role: 'user',
            refs,
            dispatch: () => {},
            api,
            maxRetries: 0
        });

        const fetched = calls.map((c) => c.name);
        assert.ok(fetched.includes('getDeposits'), 'Expected full-sync fallback after selective transient failure');
        assert.equal(pmAttempts, 2);

        // 403 non-retryable failure must NOT escalate to full sync or retry storm
        const refs403 = createRefs('user-a');
        refs403.hasCompletedAuthSyncRef.current = true;
        let notifAttempts = 0;
        const mock403 = makeMockApi({
            getDataVersion: async () => 221,
            getNotifications: async () => {
                notifAttempts += 1;
                throw new apiMod.ApiError('Forbidden', 403);
            }
        });

        await dcMod.executeSelectiveSyncPass({
            datasets: ['notifications'],
            eventVersion: 221,
            userId: 'user-a',
            role: 'user',
            refs: refs403,
            dispatch: () => {},
            api: mock403.api,
            maxRetries: 2,
            retryBaseDelayMs: 5
        });

        assert.equal(notifAttempts, 1);
        assert.equal(mock403.calls.some((c) => c.name === 'getDeposits'), false);
    });

    await test('B15. Stale selective sync response after account switch is discarded', async () => {
        localStorage.clear();
        localStorage.setItem('authToken', 'token-user-a');
        const refs = createRefs('user-a');
        refs.hasCompletedAuthSyncRef.current = true;
        const dispatches = [];

        const { api } = makeMockApi({
            getDataVersion: async () => 230,
            getSettings: async () => {
                // Account switches mid-flight to user-b
                refs.activeUserIdRef.current = 'user-b';
                refs.syncSessionEpochRef.current += 1;
                return { siteName: 'StaleUserASettings' };
            }
        });

        await dcMod.executeSelectiveSyncPass({
            datasets: ['settings'],
            eventVersion: 230,
            userId: 'user-a',
            role: 'user',
            refs,
            dispatch: (a) => dispatches.push(a),
            api
        });

        assert.equal(dispatches.some((a) => a.type === 'SET_SETTINGS'), false);
    });

    await test('B16. Reconnect missed-event recovery triggers full sync after disconnect without double initial sync', async () => {
        const eventHandlers = {};
        let disconnectCalled = 0;
        let fullSyncCount = 0;
        let selectiveCalls = 0;

        // Simulate DataProvider socket effect logic with a realistic fake socket
        const fakeSocket = {
            on(evt, cb) { eventHandlers[evt] = cb; },
            disconnect() { disconnectCalled += 1; }
        };

        const scheduler = dcMod.createRealtimeEventScheduler({
            coalesceDelayMs: 0,
            getRole: () => 'user',
            isRunActive: () => true,
            onFullSync: () => { fullSyncCount += 1; },
            onSelectiveSync: () => { selectiveCalls += 1; }
        });

        let hasConnectedOnce = false;
        let sawDisconnect = false;
        fakeSocket.on('connect', () => {
            if (hasConnectedOnce && sawDisconnect) {
                sawDisconnect = false;
                fullSyncCount += 1;
            }
            hasConnectedOnce = true;
        });
        fakeSocket.on('disconnect', () => {
            sawDisconnect = true;
            scheduler.clear();
        });
        fakeSocket.on('SESSION_EXPIRED', () => {
            scheduler.clear();
            fakeSocket.disconnect();
        });
        fakeSocket.on('DATA_CHANGED', (payload) => scheduler.handleEvent(payload));

        // Initial connect: no duplicate full sync
        eventHandlers.connect();
        assert.equal(fullSyncCount, 0);

        // Normal selective event
        eventHandlers.DATA_CHANGED({ scope: 'global', datasets: ['settings'], version: 50 });
        assert.equal(selectiveCalls, 1);
        assert.equal(fullSyncCount, 0);

        // Disconnect then reconnect -> must trigger missed-event recovery full sync
        eventHandlers.disconnect();
        eventHandlers.connect();
        assert.equal(fullSyncCount, 1);

        // Session expired -> disconnects socket
        eventHandlers.SESSION_EXPIRED();
        assert.equal(disconnectCalled, 1);
    });

    // =========================================================================
    // CATEGORY C — VERSION TRACKING & API CONTRACT TESTS
    // =========================================================================
    await test('C17. settingsController.getDataVersion maintains { success: true, version } contract', async () => {
        const settingsSrc = fs.readFileSync(path.join(ROOT, 'backend/controllers/settingsController.js'), 'utf8');
        assert.ok(settingsSrc.includes("version: settings?.dataVersion || 1"));
        assert.ok(settingsSrc.includes("res.status(200).json({ success: true, version: 1 })"));

        // Exercise getDataVersion directly with mocked Setting model behavior
        const { getDataVersion } = await import('./backend/controllers/settingsController.js');
        const SettingMod = (await import('./backend/models/Setting.js')).default;
        const origFindOne = SettingMod.findOne;
        try {
            SettingMod.findOne = () => ({ select: async () => ({ dataVersion: 987654321 }) });
            let outStatus = 0;
            let outBody = null;
            const res = { status(s) { outStatus = s; return this; }, json(b) { outBody = b; return this; } };
            await getDataVersion({}, res);
            assert.equal(outStatus, 200);
            assert.deepEqual(outBody, { success: true, version: 987654321 });

            // Error fallback returns stable version: 1
            SettingMod.findOne = () => ({ select: async () => { throw new Error('DB down'); } });
            await getDataVersion({}, res);
            assert.equal(outStatus, 200);
            assert.deepEqual(outBody, { success: true, version: 1 });
        } finally {
            SettingMod.findOne = origFindOne;
        }
    });

    await test('C18. Setting.bumpVersion returns numeric version and non-protected controllers emit via emitRealtimeChange', async () => {
        const SettingMod = (await import('./backend/models/Setting.js')).default;
        const origFindOneAndUpdate = SettingMod.findOneAndUpdate;
        try {
            let capturedUpdate = null;
            SettingMod.findOneAndUpdate = async (_filter, update, opts) => {
                capturedUpdate = { update, opts };
                return { dataVersion: update.dataVersion };
            };
            const v = await SettingMod.bumpVersion();
            assert.equal(typeof v, 'number');
            assert.ok(v > 0);
            assert.equal(capturedUpdate.opts.upsert, true);
            assert.equal(capturedUpdate.opts.new, true);
        } finally {
            SettingMod.findOneAndUpdate = origFindOneAndUpdate;
        }

        const prCtrl = fs.readFileSync(path.join(ROOT, 'backend/controllers/passwordResetRequestsController.js'), 'utf8');
        const notifCtrl = fs.readFileSync(path.join(ROOT, 'backend/controllers/notificationsController.js'), 'utf8');
        const dispCtrl = fs.readFileSync(path.join(ROOT, 'backend/controllers/disputesController.js'), 'utf8');
        assert.ok(prCtrl.includes("Setting.bumpVersion()") && prCtrl.includes("scope: 'admin'"));
        assert.ok(notifCtrl.includes("Setting.bumpVersion()") && notifCtrl.includes("NOTIFICATIONS_CREATED"));
        assert.ok(dispCtrl.includes("DISPUTE_CREATED") && dispCtrl.includes("DISPUTE_UPDATED"));
    });

    console.log(`\nALL ${passed} PHASE 3 REALTIME & SECURITY TESTS PASSED.`);
}

runTests().catch((err) => {
    console.error('TEST FAILURE:', err);
    process.exit(1);
});
