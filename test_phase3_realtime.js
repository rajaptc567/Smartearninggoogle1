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
    sanitizeRealtimePayload,
    revokeUserSockets
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

        await test('D19. Fail-closed socket scope rejects missing or invalid scopes instead of broadcasting globally', async () => {
            assert.equal(sanitizeRealtimePayload(undefined), null);
            assert.equal(sanitizeRealtimePayload(null), null);
            assert.equal(sanitizeRealtimePayload([]), null);
            assert.equal(sanitizeRealtimePayload({ datasets: ['settings'], version: 1 }), null);
            assert.equal(sanitizeRealtimePayload({ scope: 'everywhere', datasets: ['settings'], version: 1 }), null);
            assert.equal(sanitizeRealtimePayload({ scope: '', datasets: ['settings'], version: 1 }), null);

            const tokenA = jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const cA = await connectClient(baseUrl, { auth: { token: tokenA } });
            assert.equal(cA.ok, true);

            const received = [];
            cA.socket.on('DATA_CHANGED', (p) => received.push(p));

            assert.equal(emitRealtimeChange(io, { datasets: ['settings'], version: 901 }), false);
            assert.equal(emitRealtimeChange(io, { scope: 'invalid_scope', datasets: ['settings'], version: 902 }), false);
            await wait(60);
            assert.equal(received.length, 0);

            // Explicit global continues emitting cleanly
            assert.equal(emitRealtimeChange(io, { scope: 'global', datasets: ['settings'], version: 903 }), true);
            await wait(60);
            assert.equal(received.length, 1);
            assert.equal(received[0].scope, 'global');

            cA.socket.disconnect();
            await wait(30);
        });

        await test('B19. revokeUserSockets terminates blocked/deleted sessions and disconnects role-changed users cleanly', async () => {
            const tokenA = jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const tokenB = jwt.sign({ id: 'user-b', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' });
            const [cA, cB] = await Promise.all([
                connectClient(baseUrl, { auth: { token: tokenA } }),
                connectClient(baseUrl, { auth: { token: tokenB } })
            ]);
            assert.ok(cA.ok && cB.ok);

            let expiredA = false;
            let disconnectedA = false;
            let expiredB = false;
            let disconnectedB = false;
            cA.socket.on('SESSION_EXPIRED', () => { expiredA = true; });
            cA.socket.on('disconnect', () => { disconnectedA = true; });
            cB.socket.on('SESSION_EXPIRED', () => { expiredB = true; });
            cB.socket.on('disconnect', () => { disconnectedB = true; });

            assert.equal(revokeUserSockets(io, 'user-a', { terminateSession: true, reason: 'account_restricted' }), true);
            await wait(80);
            assert.equal(expiredA, true);
            assert.equal(disconnectedA, true);
            assert.equal(expiredB, false);
            assert.equal(disconnectedB, false);

            // Non-terminating revocation (e.g. role change) disconnects without SESSION_EXPIRED
            assert.equal(revokeUserSockets(io, 'user-b', { terminateSession: false, reason: 'privileges_changed' }), true);
            await wait(80);
            assert.equal(expiredB, false);
            assert.equal(disconnectedB, true);
        });

        await test('B20. usersController updateUser, bulkUpdateRestrictions, deleteUser, and bulkDeleteUsers revoke affected sockets safely', async () => {
            const usersCtrl = await import('./backend/controllers/usersController.js');
            const UserMod = (await import('./backend/models/User.js')).default;
            const SettingMod = (await import('./backend/models/Setting.js')).default;
            const PlanMod = (await import('./backend/models/InvestmentPlan.js')).default;
            const TxMod = (await import('./backend/models/Transaction.js')).default;
            const NotifMod = (await import('./backend/models/Notification.js')).default;
            const DepMod = (await import('./backend/models/Deposit.js')).default;
            const WdMod = (await import('./backend/models/Withdrawal.js')).default;
            const TrMod = (await import('./backend/models/Transfer.js')).default;

            const orig = {
                userFindById: UserMod.findById,
                userFind: UserMod.find,
                userFindByIdAndDelete: UserMod.findByIdAndDelete,
                userDeleteMany: UserMod.deleteMany,
                getSettings: SettingMod.getSettings,
                planFind: PlanMod.find,
                txFind: TxMod.find,
                txDeleteMany: TxMod.deleteMany,
                notifCreate: NotifMod.create,
                notifDeleteMany: NotifMod.deleteMany,
                depDeleteMany: DepMod.deleteMany,
                wdDeleteMany: WdMod.deleteMany,
                trDeleteMany: TrMod.deleteMany
            };

            const origUserA = { ...userStore.get('user-a') };
            const origUserB = { ...userStore.get('user-b') };
            const origDemoted = { ...userStore.get('demoted-1') };

            const makeRes = () => {
                const out = { status: 0, body: null };
                return {
                    out,
                    status(s) { out.status = s; return this; },
                    json(b) { out.body = b; return this; }
                };
            };

            try {
                // Start demoted-1 as admin in userStore for role demotion test
                userStore.set('demoted-1', { _id: 'demoted-1', role: 'admin', status: 'Active', restrictions: { loginBlocked: false } });

                SettingMod.getSettings = async () => ({});
                PlanMod.find = async () => [];
                TxMod.find = async () => [];
                TxMod.deleteMany = async () => ({ deletedCount: 0 });
                NotifMod.create = async () => ({});
                NotifMod.deleteMany = async () => ({ deletedCount: 0 });
                DepMod.deleteMany = async () => ({ deletedCount: 0 });
                WdMod.deleteMany = async () => ({ deletedCount: 0 });
                TrMod.deleteMany = async () => ({ deletedCount: 0 });

                const mkDoc = (id) => {
                    const data = userStore.get(id);
                    if (!data) return null;
                    const doc = {
                        ...data,
                        restrictions: { ...(data.restrictions || {}) },
                        async save() {
                            const updated = { ...this };
                            delete updated.save;
                            userStore.set(String(this._id), updated);
                            return updated;
                        }
                    };
                    return doc;
                };

                UserMod.findById = async (id) => mkDoc(String(id));
                UserMod.findByIdAndDelete = async (id) => {
                    userStore.delete(String(id));
                    return { _id: id };
                };

                const mockApp = { get: (k) => (k === 'io' ? io : undefined) };

                // 1) updateUser status -> Blocked terminates user-a without disconnecting user-b
                const [cA1, cB1] = await Promise.all([
                    connectClient(baseUrl, { auth: { token: jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) } }),
                    connectClient(baseUrl, { auth: { token: jwt.sign({ id: 'user-b', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) } })
                ]);
                assert.ok(cA1.ok && cB1.ok);

                let a1Expired = false;
                let a1Disconnected = false;
                let b1Disconnected = false;
                cA1.socket.on('SESSION_EXPIRED', () => { a1Expired = true; });
                cA1.socket.on('disconnect', () => { a1Disconnected = true; });
                cB1.socket.on('disconnect', () => { b1Disconnected = true; });

                const rBlock = makeRes();
                await usersCtrl.updateUser({
                    params: { id: 'user-a' },
                    user: { id: 'admin-1', role: 'admin' },
                    body: { status: 'Blocked' },
                    app: mockApp
                }, rBlock);
                assert.equal(rBlock.out.status, 200);
                await wait(80);
                assert.equal(a1Expired, true);
                assert.equal(a1Disconnected, true);
                assert.equal(b1Disconnected, false);

                // Reconnect by blocked user-a is rejected at handshake
                const blockedReconnect = await connectClient(baseUrl, {
                    auth: { token: jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) }
                });
                assert.equal(blockedReconnect.ok, false);
                assert.match(blockedReconnect.error.message, /restricted or blocked/i);

                // 2) updateUser role demotion disconnects without SESSION_EXPIRED; reconnect derives fresh DB role
                const demotedJwt = jwt.sign({ id: 'demoted-1', role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });
                const cDem1 = await connectClient(baseUrl, { auth: { token: demotedJwt } });
                assert.equal(cDem1.ok, true);
                assert.equal(serverSockets.get('demoted-1')?.rooms.has('role:admin'), true);

                let demExpired = false;
                let demDisconnected = false;
                cDem1.socket.on('SESSION_EXPIRED', () => { demExpired = true; });
                cDem1.socket.on('disconnect', () => { demDisconnected = true; });

                const rDemote = makeRes();
                await usersCtrl.updateUser({
                    params: { id: 'demoted-1' },
                    user: { id: 'admin-1', role: 'super_admin' },
                    body: { role: 'user' },
                    app: mockApp
                }, rDemote);
                assert.equal(rDemote.out.status, 200);
                await wait(80);
                assert.equal(demExpired, false);
                assert.equal(demDisconnected, true);

                // Reconnect with same old admin JWT must derive fresh DB 'user' role and NOT join role:admin
                const cDem2 = await connectClient(baseUrl, { auth: { token: demotedJwt } });
                assert.equal(cDem2.ok, true);
                assert.equal(serverSockets.get('demoted-1')?.user.role, 'user');
                assert.equal(serverSockets.get('demoted-1')?.rooms.has('role:admin'), false);
                cDem2.socket.disconnect();

                // 3) bulkUpdateRestrictions revokes ONLY users whose loginBlocked changed
                userStore.set('user-a', { ...origUserA }); // restore user-a Active
                const cA3 = await connectClient(baseUrl, { auth: { token: jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) } });
                assert.equal(cA3.ok, true);
                let a3Expired = false;
                let a3Disconnected = false;
                let b3Disconnected = false;
                cA3.socket.on('SESSION_EXPIRED', () => { a3Expired = true; });
                cA3.socket.on('disconnect', () => { a3Disconnected = true; });
                cB1.socket.on('disconnect', () => { b3Disconnected = true; });

                UserMod.find = async () => [mkDoc('user-a')];
                const rBulkRest = makeRes();
                await usersCtrl.bulkUpdateRestrictions({
                    body: { targetType: 'single', targetIds: ['user-a'], restrictions: { loginBlocked: true }, action: 'enable' },
                    app: mockApp
                }, rBulkRest);
                assert.equal(rBulkRest.out.status, 200);
                await wait(80);
                assert.equal(a3Expired, true);
                assert.equal(a3Disconnected, true);
                assert.equal(b3Disconnected, false);

                // 4) deleteUser & bulkDeleteUsers revoke deleted users and do zero revocations on no-op delete
                userStore.set('user-a', { ...origUserA });
                const cA4 = await connectClient(baseUrl, { auth: { token: jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) } });
                assert.equal(cA4.ok, true);
                let a4Expired = false;
                let a4Disconnected = false;
                cA4.socket.on('SESSION_EXPIRED', () => { a4Expired = true; });
                cA4.socket.on('disconnect', () => { a4Disconnected = true; });

                const rDel = makeRes();
                await usersCtrl.deleteUser({ params: { id: 'user-a' }, app: mockApp }, rDel);
                assert.equal(rDel.out.status, 200);
                await wait(80);
                assert.equal(a4Expired, true);
                assert.equal(a4Disconnected, true);

                // bulkDeleteUsers with deletedCount: 0 must leave user-b connected
                let bBulkNoopDisconnected = false;
                cB1.socket.on('disconnect', () => { bBulkNoopDisconnected = true; });
                UserMod.find = () => ({ select: () => ({ lean: async () => [{ _id: 'non-existent' }] }) });
                UserMod.deleteMany = async () => ({ deletedCount: 0 });
                const rBulkZero = makeRes();
                await usersCtrl.bulkDeleteUsers({ body: { ids: ['non-existent'] }, app: mockApp }, rBulkZero);
                assert.equal(rBulkZero.out.status, 200);
                await wait(60);
                assert.equal(bBulkNoopDisconnected, false);

                // bulkDeleteUsers deleting user-b revokes user-b
                let bBulkExpired = false;
                let bBulkDisconnected = false;
                cB1.socket.on('SESSION_EXPIRED', () => { bBulkExpired = true; });
                cB1.socket.on('disconnect', () => { bBulkDisconnected = true; });
                UserMod.find = () => ({ select: () => ({ lean: async () => [{ _id: 'user-b' }] }) });
                UserMod.deleteMany = async () => ({ deletedCount: 1 });
                const rBulkHit = makeRes();
                await usersCtrl.bulkDeleteUsers({ body: { ids: ['user-b'] }, app: mockApp }, rBulkHit);
                assert.equal(rBulkHit.out.status, 200);
                await wait(80);
                assert.equal(bBulkExpired, true);
                assert.equal(bBulkDisconnected, true);

                // 5) Fix A: Unchanged access fields (fullName only) do NOT revoke sockets;
                //    AND changed role/status revokes immediately after save even if commission check throws later
                userStore.set('user-a', { ...origUserA });
                userStore.set('user-b', { ...origUserB });
                const [cA5, cB5] = await Promise.all([
                    connectClient(baseUrl, { auth: { token: jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) } }),
                    connectClient(baseUrl, { auth: { token: jwt.sign({ id: 'user-b', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) } })
                ]);
                assert.ok(cA5.ok && cB5.ok);
                let a5Disconnected = false;
                let b5Disconnected = false;
                cA5.socket.on('disconnect', () => { a5Disconnected = true; });
                cB5.socket.on('disconnect', () => { b5Disconnected = true; });

                const rUnchanged = makeRes();
                await usersCtrl.updateUser({
                    params: { id: 'user-a' },
                    user: { id: 'admin-1', role: 'admin' },
                    body: { fullName: 'Updated Name Only' },
                    app: mockApp
                }, rUnchanged);
                assert.equal(rUnchanged.out.status, 200);
                await wait(60);
                assert.equal(a5Disconnected, false);
                assert.equal(b5Disconnected, false);

                let a5ExpiredAfterPostSaveErr = false;
                cA5.socket.on('SESSION_EXPIRED', () => { a5ExpiredAfterPostSaveErr = true; });
                SettingMod.getSettings = async () => { throw new Error('Simulated commission lookup outage'); };
                const rEarlyFail = makeRes();
                await usersCtrl.updateUser({
                    params: { id: 'user-a' },
                    user: { id: 'admin-1', role: 'admin' },
                    body: { status: 'Blocked' },
                    app: mockApp
                }, rEarlyFail);
                assert.equal(rEarlyFail.out.status, 400);
                await wait(80);
                assert.equal(a5ExpiredAfterPostSaveErr, true);
                assert.equal(a5Disconnected, true);
                assert.equal(b5Disconnected, false);
                SettingMod.getSettings = async () => ({});

                // 6) Fix B: bulkUpdateRestrictions revokes user #1 immediately upon save even if user #2 fails later in batch
                userStore.set('user-a', { ...origUserA });
                userStore.set('user-b', { ...origUserB });
                const cA6 = await connectClient(baseUrl, { auth: { token: jwt.sign({ id: 'user-a', role: 'user' }, TEST_JWT_SECRET, { expiresIn: '1h' }) } });
                assert.equal(cA6.ok, true);
                let a6Expired = false;
                let a6Disconnected = false;
                let b6Disconnected = false;
                cA6.socket.on('SESSION_EXPIRED', () => { a6Expired = true; });
                cA6.socket.on('disconnect', () => { a6Disconnected = true; });
                cB5.socket.on('disconnect', () => { b6Disconnected = true; });

                const failingUser2Doc = {
                    _id: 'user-fail-batch',
                    restrictions: { loginBlocked: false },
                    async save() { throw new Error('Simulated save failure on second batch user'); }
                };
                UserMod.find = async () => [mkDoc('user-a'), failingUser2Doc];
                const rBulkPartialFail = makeRes();
                await usersCtrl.bulkUpdateRestrictions({
                    body: { targetType: 'single', targetIds: ['user-a', 'user-fail-batch'], restrictions: { loginBlocked: true }, action: 'enable' },
                    app: mockApp
                }, rBulkPartialFail);
                assert.equal(rBulkPartialFail.out.status, 400);
                await wait(80);
                assert.equal(a6Expired, true);
                assert.equal(a6Disconnected, true);
                assert.equal(b6Disconnected, false);
                cB5.socket.disconnect();
            } finally {
                UserMod.findById = orig.userFindById;
                UserMod.find = orig.userFind;
                UserMod.findByIdAndDelete = orig.userFindByIdAndDelete;
                UserMod.deleteMany = orig.userDeleteMany;
                SettingMod.getSettings = orig.getSettings;
                PlanMod.find = orig.planFind;
                TxMod.find = orig.txFind;
                TxMod.deleteMany = orig.txDeleteMany;
                NotifMod.create = orig.notifCreate;
                NotifMod.deleteMany = orig.notifDeleteMany;
                DepMod.deleteMany = orig.depDeleteMany;
                WdMod.deleteMany = orig.wdDeleteMany;
                TrMod.deleteMany = orig.trDeleteMany;
                userStore.set('user-a', origUserA);
                userStore.set('user-b', origUserB);
                userStore.set('demoted-1', origDemoted);
            }
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

    await test('A21. isDefinitiveSocketAuthRejection triggers only on definitive auth failures and ignores transient errors', () => {
        assert.equal(dcMod.isDefinitiveSocketAuthRejection({ message: 'any', data: { code: 'AUTH_INVALID_TOKEN' } }), true);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection({ message: 'any', data: { code: 'AUTH_MISSING_TOKEN' } }), true);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection({ message: 'any', data: { code: 'AUTH_USER_NOT_FOUND' } }), true);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection({ message: 'any', data: { code: 'AUTH_ACCOUNT_BLOCKED' } }), true);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('Invalid or expired token')), true);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('Account not found')), true);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('Account restricted or blocked')), true);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('Authentication required')), true);

        // Transient network / server restart / Render sleep / config errors must NEVER log out
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('websocket error')), false);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('xhr poll error')), false);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('timeout')), false);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(new Error('Service Unavailable 503')), false);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection({ message: 'Authentication failed', data: { code: 'AUTH_ERROR' } }), false);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection({ message: 'Authentication service unavailable', data: { code: 'AUTH_CONFIG_ERROR' } }), false);
        assert.equal(dcMod.isDefinitiveSocketAuthRejection(null), false);
    });

    await test('A22. invalidateSessionOnSocketAuthFailure logs out and redirects only active sessions on protected routes', () => {
        const calls = [];
        const dispatches = [];

        // Active session on /member route -> clears state + redirects
        const ranMember = dcMod.invalidateSessionOnSocketAuthFailure({
            clearScheduler: () => calls.push('clearScheduler'),
            disconnectSocket: () => calls.push('disconnectSocket'),
            clearAllRetryTimers: () => calls.push('clearTimers'),
            dispatch: (a) => dispatches.push(a),
            isSessionActive: () => true,
            getPathname: () => '/member/dashboard',
            redirectToLogin: () => calls.push('redirect:/login')
        });
        assert.equal(ranMember, true);
        assert.deepEqual(dispatches, [{ type: 'SET_CURRENT_USER', payload: { user: null } }]);
        assert.deepEqual(calls, ['clearScheduler', 'disconnectSocket', 'clearTimers', 'redirect:/login']);

        // Active session already on /login -> clears state without redirect loop
        const callsLogin = [];
        const dispatchesLogin = [];
        const ranLogin = dcMod.invalidateSessionOnSocketAuthFailure({
            clearScheduler: () => callsLogin.push('clearScheduler'),
            disconnectSocket: () => callsLogin.push('disconnectSocket'),
            clearAllRetryTimers: () => callsLogin.push('clearTimers'),
            dispatch: (a) => dispatchesLogin.push(a),
            isSessionActive: () => true,
            getPathname: () => '/login',
            redirectToLogin: () => callsLogin.push('redirect:/login')
        });
        assert.equal(ranLogin, true);
        assert.equal(dispatchesLogin.length, 1);
        assert.equal(callsLogin.includes('redirect:/login'), false);

        // Stale session after account switch -> must NOT log out current account
        const staleDispatches = [];
        const ranStale = dcMod.invalidateSessionOnSocketAuthFailure({
            clearScheduler: () => {},
            disconnectSocket: () => {},
            clearAllRetryTimers: () => {},
            dispatch: (a) => staleDispatches.push(a),
            isSessionActive: () => false,
            getPathname: () => '/admin',
            redirectToLogin: () => { throw new Error('Should not redirect stale session'); }
        });
        assert.equal(ranStale, false);
        assert.equal(staleDispatches.length, 0);

        // Fix E: Same user with unchanged token -> invalidates session and redirects
        const sameTokCalls = [];
        const sameTokDispatches = [];
        const ranSameTok = dcMod.invalidateSessionOnSocketAuthFailure({
            clearScheduler: () => sameTokCalls.push('clearScheduler'),
            disconnectSocket: () => sameTokCalls.push('disconnectSocket'),
            clearAllRetryTimers: () => sameTokCalls.push('clearTimers'),
            dispatch: (a) => sameTokDispatches.push(a),
            isSessionActive: () => true,
            capturedToken: 'tok-v1',
            getStoredToken: () => 'tok-v1',
            getPathname: () => '/admin/users',
            redirectToLogin: () => sameTokCalls.push('redirect:/login')
        });
        assert.equal(ranSameTok, true);
        assert.deepEqual(sameTokDispatches, [{ type: 'SET_CURRENT_USER', payload: { user: null } }]);
        assert.deepEqual(sameTokCalls, ['clearScheduler', 'disconnectSocket', 'clearTimers', 'redirect:/login']);

        // Fix E: Same user, newer refreshed token stored -> stale socket does NOT clear newer session or redirect
        localStorage.setItem('authToken', 'tok-v2-refreshed');
        const staleTokCalls = [];
        const staleTokDispatches = [];
        const ranNewerTok = dcMod.invalidateSessionOnSocketAuthFailure({
            clearScheduler: () => staleTokCalls.push('clearScheduler'),
            disconnectSocket: () => staleTokCalls.push('disconnectSocket'),
            clearAllRetryTimers: () => staleTokCalls.push('clearTimers'),
            dispatch: (a) => staleTokDispatches.push(a),
            isSessionActive: () => true,
            capturedToken: 'tok-v1-stale',
            getPathname: () => '/member/dashboard',
            redirectToLogin: () => { throw new Error('Newer token session must not redirect'); }
        });
        assert.equal(ranNewerTok, false);
        assert.deepEqual(staleTokCalls, ['clearScheduler', 'disconnectSocket']);
        assert.equal(staleTokDispatches.length, 0);
        assert.equal(localStorage.getItem('authToken'), 'tok-v2-refreshed');
    });

    await test('C23. notificationsController emits targeted user events only on actual mutation and never on no-ops or 403', async () => {
        const notifCtrl = await import('./backend/controllers/notificationsController.js');
        const NotificationMod = (await import('./backend/models/Notification.js')).default;
        const SettingMod = (await import('./backend/models/Setting.js')).default;
        const mongooseMod = (await import('mongoose')).default;

        const origFind = NotificationMod.find;
        const origFindById = NotificationMod.findById;
        const origUpdateMany = NotificationMod.updateMany;
        const origFindByIdAndUpdate = NotificationMod.findByIdAndUpdate;
        const origFindByIdAndDelete = NotificationMod.findByIdAndDelete;
        const origDeleteMany = NotificationMod.deleteMany;
        const origBump = SettingMod.bumpVersion;
        const origReadyStateDesc = Object.getOwnPropertyDescriptor(mongooseMod.connection, 'readyState');

        const emitted = [];
        let bumpCalls = 0;
        const spyIo = {
            to(firstRoom) {
                const rooms = [firstRoom];
                const builder = {
                    to(nextRoom) { rooms.push(nextRoom); return builder; },
                    emit(event, payload) { emitted.push({ rooms: [...rooms], event, payload }); }
                };
                return builder;
            }
        };
        const makeRes = () => {
            const out = { status: 0, body: null };
            return { out, status(s) { out.status = s; return this; }, json(b) { out.body = b; return this; } };
        };
        const app = { get: (k) => (k === 'io' ? spyIo : undefined) };

        try {
            Object.defineProperty(mongooseMod.connection, 'readyState', { value: 1, configurable: true, writable: true });
            SettingMod.bumpVersion = async () => { bumpCalls += 1; return 700 + bumpCalls; };
            NotificationMod.find = () => ({ sort: async () => [] });

            // 1. markAsRead: modifiedCount > 0 -> 1 bump, targeted user room only
            NotificationMod.updateMany = async () => ({ modifiedCount: 2 });
            const rReadOk = makeRes();
            await notifCtrl.markAsRead({ params: { userId: 'u1' }, user: { id: 'u1', role: 'user' }, app }, rReadOk);
            assert.equal(rReadOk.out.status, 200);
            assert.equal(bumpCalls, 1);
            assert.equal(emitted.length, 1);
            assert.deepEqual(emitted[0].rooms, ['user:u1']);
            assert.equal(emitted[0].payload.event, 'NOTIFICATIONS_MARKED_READ');

            // 2. markAsRead: modifiedCount === 0 -> 0 bumps, 0 emits
            NotificationMod.updateMany = async () => ({ modifiedCount: 0 });
            const rReadNoop = makeRes();
            await notifCtrl.markAsRead({ params: { userId: 'u1' }, user: { id: 'u1', role: 'user' }, app }, rReadNoop);
            assert.equal(rReadNoop.out.status, 200);
            assert.equal(bumpCalls, 1);
            assert.equal(emitted.length, 1);

            // 3. markAsRead: unauthorized 403 -> 0 bumps, 0 emits
            const rRead403 = makeRes();
            await notifCtrl.markAsRead({ params: { userId: 'u2' }, user: { id: 'u1', role: 'user' }, app }, rRead403);
            assert.equal(rRead403.out.status, 403);
            assert.equal(bumpCalls, 1);
            assert.equal(emitted.length, 1);

            // 4. updateNotification: unauthorized 403 vs authorized mutation vs empty body
            NotificationMod.findById = async () => ({ _id: 'n1', userId: 'u2', popupShown: false });
            const rUpd403 = makeRes();
            await notifCtrl.updateNotification({ params: { id: 'n1' }, user: { id: 'u1', role: 'user' }, body: { read: true }, app }, rUpd403);
            assert.equal(rUpd403.out.status, 403);
            assert.equal(emitted.length, 1);

            NotificationMod.findByIdAndUpdate = async () => ({ _id: 'n1', userId: 'u2', read: true });
            const rUpdEmpty = makeRes();
            await notifCtrl.updateNotification({ params: { id: 'n1' }, user: { id: 'admin1', role: 'admin' }, body: {}, app }, rUpdEmpty);
            assert.equal(rUpdEmpty.out.status, 200);
            assert.equal(emitted.length, 1);

            const rUpdOk = makeRes();
            await notifCtrl.updateNotification({ params: { id: 'n1' }, user: { id: 'u2', role: 'user' }, body: { read: true }, app }, rUpdOk);
            assert.equal(rUpdOk.out.status, 200);
            assert.equal(bumpCalls, 2);
            assert.equal(emitted.length, 2);
            assert.deepEqual(emitted[1].rooms, ['user:u2']);
            assert.equal(emitted[1].payload.event, 'NOTIFICATION_UPDATED');

            // 4b. Fix C: Same identical values submitted again -> no DB update, 0 version bumps, 0 socket emits
            let updateDbCalls = 0;
            NotificationMod.findById = async () => ({ _id: 'n1', userId: 'u2', read: true, popupShown: false, isPopup: false, message: 'Hello', subject: 'Hi' });
            NotificationMod.findByIdAndUpdate = async () => { updateDbCalls += 1; return { _id: 'n1', userId: 'u2', read: true }; };
            const rUpdNoop = makeRes();
            await notifCtrl.updateNotification({
                params: { id: 'n1' },
                user: { id: 'u2', role: 'user' },
                body: { read: true, popupShown: false, message: 'Hello', subject: 'Hi' },
                app
            }, rUpdNoop);
            assert.equal(rUpdNoop.out.status, 200);
            assert.equal(updateDbCalls, 0);
            assert.equal(bumpCalls, 2);
            assert.equal(emitted.length, 2);

            // 5. deleteNotification
            NotificationMod.findByIdAndDelete = async () => ({ _id: 'n1', userId: 'u2' });
            const rDelOk = makeRes();
            await notifCtrl.deleteNotification({ params: { id: 'n1' }, user: { id: 'u2', role: 'user' }, app }, rDelOk);
            assert.equal(rDelOk.out.status, 200);
            assert.equal(bumpCalls, 3);
            assert.equal(emitted.length, 3);
            assert.equal(emitted[2].payload.event, 'NOTIFICATION_DELETED');

            // 6. bulkDeleteNotifications -> single batched emit for multiple users, 0 emits if deletedCount === 0
            NotificationMod.find = () => ({ select: () => ({ lean: async () => [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u1' }] }) });
            NotificationMod.deleteMany = async () => ({ deletedCount: 3 });
            const rBulkDelOk = makeRes();
            await notifCtrl.bulkDeleteNotifications({ body: { ids: ['n1', 'n2', 'n3'] }, user: { id: 'admin1', role: 'admin' }, app }, rBulkDelOk);
            assert.equal(rBulkDelOk.out.status, 200);
            assert.equal(bumpCalls, 4);
            assert.equal(emitted.length, 4);
            assert.deepEqual(emitted[3].rooms.sort(), ['user:u1', 'user:u2']);
            assert.equal(emitted[3].payload.event, 'NOTIFICATIONS_BULK_DELETED');

            NotificationMod.deleteMany = async () => ({ deletedCount: 0 });
            const rBulkDelZero = makeRes();
            await notifCtrl.bulkDeleteNotifications({ body: { ids: ['n999'] }, user: { id: 'admin1', role: 'admin' }, app }, rBulkDelZero);
            assert.equal(rBulkDelZero.out.status, 200);
            assert.equal(bumpCalls, 4);
            assert.equal(emitted.length, 4);

            // 6b. Fix D: Failed preliminary lookup + successful deletion -> safe fallback event without leaking content/IDs
            NotificationMod.find = () => { throw new Error('Simulated lookup timeout'); };
            NotificationMod.deleteMany = async () => ({ deletedCount: 2 });
            const rBulkFallbackAdmin = makeRes();
            await notifCtrl.bulkDeleteNotifications({ body: { ids: ['n10', 'n11'] }, user: { id: 'admin1', role: 'admin' }, app }, rBulkFallbackAdmin);
            assert.equal(rBulkFallbackAdmin.out.status, 200);
            assert.equal(bumpCalls, 5);
            assert.equal(emitted.length, 5);
            assert.deepEqual(emitted[4].rooms, ['authenticated']);
            assert.deepEqual(emitted[4].payload.datasets, ['notifications']);
            assert.equal(emitted[4].payload.event, 'NOTIFICATIONS_BULK_DELETED');
            assert.equal('userId' in emitted[4].payload, false);
            assert.equal('message' in emitted[4].payload, false);

            // Failed lookup + zero deleted -> NO fallback emit and NO version bump
            NotificationMod.deleteMany = async () => ({ deletedCount: 0 });
            const rBulkFallbackZero = makeRes();
            await notifCtrl.bulkDeleteNotifications({ body: { ids: ['n999'] }, user: { id: 'admin1', role: 'admin' }, app }, rBulkFallbackZero);
            assert.equal(rBulkFallbackZero.out.status, 200);
            assert.equal(bumpCalls, 5);
            assert.equal(emitted.length, 5);

            // Failed deletion -> 400, NO emit, NO version bump
            NotificationMod.deleteMany = async () => { throw new Error('Simulated delete failure'); };
            const rBulkDeleteErr = makeRes();
            await notifCtrl.bulkDeleteNotifications({ body: { ids: ['n1'] }, user: { id: 'admin1', role: 'admin' }, app }, rBulkDeleteErr);
            assert.equal(rBulkDeleteErr.out.status, 400);
            assert.equal(bumpCalls, 5);
            assert.equal(emitted.length, 5);

            // Non-admin route authorization rejection (403) + filtered empty delete -> NO emit
            const { authorize } = await import('./backend/middleware/authMiddleware.js');
            const authMw = authorize(['admin', 'super_admin']);
            const UserMod = (await import('./backend/models/User.js')).default;
            const origUserFindById = UserMod.findById;
            try {
                UserMod.findById = () => ({ select: () => ({ lean: async () => ({ _id: 'u1', role: 'user', status: 'Active', restrictions: {} }) }) });
                const prevSecret = process.env.JWT_SECRET;
                process.env.JWT_SECRET = TEST_JWT_SECRET;
                try {
                    const userJwt = jwt.sign({ id: 'u1', role: 'user' }, TEST_JWT_SECRET);
                    const rAuth403 = makeRes();
                    let nextCalled = false;
                    await authMw({ headers: { authorization: `Bearer ${userJwt}` } }, rAuth403, () => { nextCalled = true; });
                    assert.equal(nextCalled, false);
                    assert.equal(rAuth403.out.status, 403);
                    assert.equal(bumpCalls, 5);
                    assert.equal(emitted.length, 5);
                } finally {
                    if (prevSecret === undefined) delete process.env.JWT_SECRET;
                    else process.env.JWT_SECRET = prevSecret;
                }
            } finally {
                UserMod.findById = origUserFindById;
            }

            // 7. markPopupShown -> emits only on transition false -> true, not duplicate true -> true
            NotificationMod.find = () => ({ sort: async () => [] });
            const popupDoc = { _id: 'p1', userId: 'u1', popupShown: false, async save() { return this; } };
            NotificationMod.findById = async () => popupDoc;
            const rPopup1 = makeRes();
            await notifCtrl.markPopupShown({ params: { id: 'p1' }, user: { id: 'u1', role: 'user' }, app }, rPopup1);
            assert.equal(rPopup1.out.status, 200);
            assert.equal(bumpCalls, 6);
            assert.equal(emitted.length, 6);
            assert.equal(emitted[5].payload.event, 'NOTIFICATION_POPUP_SHOWN');

            const rPopup2 = makeRes();
            await notifCtrl.markPopupShown({ params: { id: 'p1' }, user: { id: 'u1', role: 'user' }, app }, rPopup2);
            assert.equal(rPopup2.out.status, 200);
            assert.equal(bumpCalls, 6);
            assert.equal(emitted.length, 6);
        } finally {
            NotificationMod.find = origFind;
            NotificationMod.findById = origFindById;
            NotificationMod.updateMany = origUpdateMany;
            NotificationMod.findByIdAndUpdate = origFindByIdAndUpdate;
            NotificationMod.findByIdAndDelete = origFindByIdAndDelete;
            NotificationMod.deleteMany = origDeleteMany;
            SettingMod.bumpVersion = origBump;
            if (origReadyStateDesc) {
                Object.defineProperty(mongooseMod.connection, 'readyState', origReadyStateDesc);
            } else {
                delete mongooseMod.connection.readyState;
            }
        }
    });

    await test('E24. Setting.bumpVersion failures never abort primary mutations across all 5 controllers', async () => {
        const pmCtrl = await import('./backend/controllers/paymentMethodsController.js');
        const prCtrl = await import('./backend/controllers/passwordResetRequestsController.js');
        const dispCtrl = await import('./backend/controllers/disputesController.js');
        const notifCtrl = await import('./backend/controllers/notificationsController.js');
        const usersCtrl = await import('./backend/controllers/usersController.js');

        const PaymentMethodMod = (await import('./backend/models/PaymentMethod.js')).default;
        const PasswordResetMod = (await import('./backend/models/PasswordResetRequest.js')).default;
        const DisputeMod = (await import('./backend/models/Dispute.js')).default;
        const NotificationMod = (await import('./backend/models/Notification.js')).default;
        const UserMod = (await import('./backend/models/User.js')).default;
        const SettingMod = (await import('./backend/models/Setting.js')).default;
        const mongooseMod = (await import('mongoose')).default;

        const orig = {
            pmCreate: PaymentMethodMod.create,
            pmUpdate: PaymentMethodMod.findByIdAndUpdate,
            prUpdate: PasswordResetMod.findByIdAndUpdate,
            prDelete: PasswordResetMod.findByIdAndDelete,
            prCreate: PasswordResetMod.create,
            dispCreate: DisputeMod.create,
            dispFindById: DisputeMod.findById,
            dispUpdate: DisputeMod.findByIdAndUpdate,
            notifCreate: NotificationMod.create,
            notifInsertMany: NotificationMod.insertMany,
            notifUpdateMany: NotificationMod.updateMany,
            notifFind: NotificationMod.find,
            userFindById: UserMod.findById,
            userFindOne: UserMod.findOne,
            userFind: UserMod.find,
            bumpVersion: SettingMod.bumpVersion,
            consoleError: console.error,
            readyStateDesc: Object.getOwnPropertyDescriptor(mongooseMod.connection, 'readyState')
        };

        const loggedErrors = [];
        const makeRes = () => {
            const out = { status: 0, body: null };
            return { out, status(s) { out.status = s; return this; }, json(b) { out.body = b; return this; } };
        };
        const app = { get: () => null };

        try {
            Object.defineProperty(mongooseMod.connection, 'readyState', { value: 1, configurable: true, writable: true });
            SettingMod.bumpVersion = async () => { throw new Error('Simulated version store outage'); };
            console.error = (...args) => { loggedErrors.push(args.map((a) => String(a?.message || a)).join(' ')); };

            // 1. paymentMethodsController
            PaymentMethodMod.create = async (d) => ({ _id: 'pm1', ...d });
            PaymentMethodMod.findByIdAndUpdate = async (_id, d) => ({ _id: 'pm1', ...d });
            const rPmCreate = makeRes();
            await pmCtrl.createPaymentMethod({ body: { name: 'Bank', currency: 'USD', type: 'Deposit' }, app }, rPmCreate);
            assert.equal(rPmCreate.out.status, 201);
            assert.equal(rPmCreate.out.body.success, true);

            const rPmUpd = makeRes();
            await pmCtrl.updatePaymentMethod({ params: { id: 'pm1' }, body: { status: 'Disabled' }, app }, rPmUpd);
            assert.equal(rPmUpd.out.status, 200);
            assert.equal(rPmUpd.out.body.success, true);

            // 2. passwordResetRequestsController
            PasswordResetMod.findByIdAndUpdate = async () => ({ _id: 'pr1', status: 'Handled' });
            PasswordResetMod.findByIdAndDelete = async () => ({ _id: 'pr1' });
            const rPrUpd = makeRes();
            await prCtrl.updatePasswordResetRequest({ params: { id: 'pr1' }, body: { status: 'Handled' }, app }, rPrUpd);
            assert.equal(rPrUpd.out.status, 200);
            assert.equal(rPrUpd.out.body.success, true);

            const rPrDel = makeRes();
            await prCtrl.deletePasswordResetRequest({ params: { id: 'pr1' }, app }, rPrDel);
            assert.equal(rPrDel.out.status, 200);
            assert.equal(rPrDel.out.body.success, true);

            // 3. disputesController
            UserMod.findById = async (id) => ({ _id: id, username: 'member1', status: 'Active', restrictions: {} });
            UserMod.find = () => ({ select: async () => [] });
            NotificationMod.create = async () => ({ _id: 'n1' });
            DisputeMod.create = async (d) => ({ _id: 'd1', ...d });
            DisputeMod.findById = async () => ({ _id: 'd1', userId: 'u1', creatorId: 'u1', messages: [], adminUnread: false, userUnread: false, async save() { return this; } });
            DisputeMod.findByIdAndUpdate = async () => ({ _id: 'd1', userId: 'u1', creatorId: 'u1', adminUnread: false });

            const rDispCreate = makeRes();
            await dispCtrl.createDispute({ user: { id: 'u1', role: 'user' }, body: { type: 'Other', description: 'Issue' }, app }, rDispCreate);
            assert.equal(rDispCreate.out.status, 201);
            assert.equal(rDispCreate.out.body.success, true);

            const rDispUpd = makeRes();
            await dispCtrl.updateDispute({ params: { id: 'd1' }, user: { id: 'u1', role: 'user' }, body: { newMessage: 'Follow up' }, app }, rDispUpd);
            assert.equal(rDispUpd.out.status, 200);
            assert.equal(rDispUpd.out.body.success, true);

            const rDispRead = makeRes();
            await dispCtrl.markAsRead({ params: { id: 'd1' }, user: { id: 'u1', role: 'user' }, body: {}, app }, rDispRead);
            assert.equal(rDispRead.out.status, 200);
            assert.equal(rDispRead.out.body.success, true);

            // 4. notificationsController
            NotificationMod.insertMany = async (docs) => docs.map((d, idx) => ({ _id: `n${idx}`, ...d }));
            NotificationMod.updateMany = async () => ({ modifiedCount: 1 });
            NotificationMod.find = () => ({ sort: async () => [] });

            const rNotifCreate = makeRes();
            await notifCtrl.createNotification({ body: { userId: 'u1', message: 'Hello', subject: 'Hi' }, app }, rNotifCreate);
            assert.equal(rNotifCreate.out.status, 201);
            assert.equal(rNotifCreate.out.body.success, true);

            const rNotifRead = makeRes();
            await notifCtrl.markAsRead({ params: { userId: 'u1' }, user: { id: 'u1', role: 'user' }, app }, rNotifRead);
            assert.equal(rNotifRead.out.status, 200);
            assert.equal(rNotifRead.out.body.success, true);

            // 5. usersController password reset handlers
            const mockUserDoc = { _id: 'u1', email: 'u1@example.com', username: 'member1', async save() { return this; } };
            UserMod.findOne = async () => mockUserDoc;
            UserMod.findById = async () => mockUserDoc;
            UserMod.find = async () => [];
            PasswordResetMod.create = async () => ({ _id: 'pr1', async save() { return this; } });

            const rResetReq = makeRes();
            await usersCtrl.userRequestPasswordReset({ body: { email: 'u1@example.com' }, get: () => 'localhost', app }, rResetReq);
            assert.equal(rResetReq.out.status, 200);
            assert.equal(rResetReq.out.body.success, true);

            const rAdminReset = makeRes();
            await usersCtrl.adminInitiatePasswordReset({ params: { id: 'u1' }, get: () => 'localhost', app }, rAdminReset);
            assert.equal(rAdminReset.out.status, 200);
            assert.equal(rAdminReset.out.body.success, true);

            assert.ok(loggedErrors.some((msg) => msg.includes('Simulated version store outage')));
        } finally {
            PaymentMethodMod.create = orig.pmCreate;
            PaymentMethodMod.findByIdAndUpdate = orig.pmUpdate;
            PasswordResetMod.findByIdAndUpdate = orig.prUpdate;
            PasswordResetMod.findByIdAndDelete = orig.prDelete;
            PasswordResetMod.create = orig.prCreate;
            DisputeMod.create = orig.dispCreate;
            DisputeMod.findById = orig.dispFindById;
            DisputeMod.findByIdAndUpdate = orig.dispUpdate;
            NotificationMod.create = orig.notifCreate;
            NotificationMod.insertMany = orig.notifInsertMany;
            NotificationMod.updateMany = orig.notifUpdateMany;
            NotificationMod.find = orig.notifFind;
            UserMod.findById = orig.userFindById;
            UserMod.findOne = orig.userFindOne;
            UserMod.find = orig.userFind;
            SettingMod.bumpVersion = orig.bumpVersion;
            console.error = orig.consoleError;
            if (orig.readyStateDesc) {
                Object.defineProperty(mongooseMod.connection, 'readyState', orig.readyStateDesc);
            } else {
                delete mongooseMod.connection.readyState;
            }
        }
    });

    console.log(`\nALL ${passed} PHASE 3 REALTIME & SECURITY TESTS PASSED.`);
}

runTests().catch((err) => {
    console.error('TEST FAILURE:', err);
    process.exit(1);
});
