import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function createStorageMock() {
    const store = new Map();
    return {
        getItem(k) { return store.has(k) ? store.get(k) : null; },
        setItem(k, v) { store.set(String(k), String(v)); },
        removeItem(k) { store.delete(k); },
        clear() { store.clear(); },
        _dump() { return Object.fromEntries(store.entries()); }
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
        getDataVersion: wrap('getDataVersion', overrides.getDataVersion || (async () => 100)),
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

async function runTests() {
    globalThis.localStorage = createStorageMock();
    globalThis.window = {
        location: { origin: 'http://localhost:3000', pathname: '/member' },
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    const apiMod = loadTsModule('services/api.ts');
    const reactFake = createFakeReact();
    const dcMod = loadTsModule('context/DataContext.tsx', {
        'react': reactFake,
        'socket.io-client': { io: () => ({ on: () => {}, disconnect: () => {} }) },
        '../services/api': apiMod
    });
    const placementMod = loadTsModule('services/providerPlacementService.ts', {
        './api': apiMod
    });

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

    await test('1. Normal member sync never calls admin-only endpoints & refreshes own user', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-member');
        const refs = createRefs('user-1');
        const { api, calls } = makeMockApi();
        const actions = [];
        await dcMod.executeMasterDataSyncPass({
            force: true,
            userId: 'user-1',
            role: 'user',
            refs,
            dispatch: (a) => actions.push(a),
            api
        });
        const calledNames = calls.map(c => c.name);
        assert.equal(calledNames.includes('getUsers'), false, 'Member must not call getUsers');
        assert.equal(calledNames.includes('getLogs'), false, 'Member must not call getLogs');
        assert.equal(calledNames.includes('getPasswordResetRequests'), false, 'Member must not call getPasswordResetRequests');
        assert.equal(calledNames.includes('getUser'), true, 'Member must call getUser(self)');
        const userCall = calls.find(c => c.name === 'getUser');
        assert.deepEqual(userCall.args, ['user-1']);
        assert.ok(actions.some(a => a.type === 'UPDATE_USER' && a.payload._id === 'user-1'));
        assert.equal(refs.lastVersionRef.current, 100);
        assert.equal(refs.hasCompletedAuthSyncRef.current, true);
    });

    await test('2. 401/403 client errors do not trigger batch retry storm', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-member');
        const refs = createRefs('user-2');
        const { api, calls } = makeMockApi({
            getNotifications: async () => { throw new apiMod.ApiError('Forbidden', 403); }
        });
        const actions = [];
        await dcMod.executeMasterDataSyncPass({
            force: true,
            userId: 'user-2',
            role: 'user',
            refs,
            dispatch: (a) => actions.push(a),
            api,
            retryBaseDelayMs: 5
        });
        await new Promise(r => setTimeout(r, 30));
        const notifCalls = calls.filter(c => c.name === 'getNotifications').length;
        const depositCalls = calls.filter(c => c.name === 'getDeposits').length;
        assert.equal(notifCalls, 1, '403 must not retry');
        assert.equal(depositCalls, 1, 'Other endpoints must not repeat');
        assert.equal(refs.retryTimersRef.current.size, 0);
        assert.ok(actions.some(a => a.type === 'SET_DEPOSITS'));
    });

    await test('3. Admin & super_admin receive authorized datasets and SET_USERS updates currentUser', async () => {
        for (const role of ['admin', 'super_admin']) {
            globalThis.localStorage.setItem('authToken', 'tok-admin');
            const refs = createRefs('admin-1');
            const { api, calls } = makeMockApi({
                getUsers: async () => ([{ _id: 'admin-1', username: 'boss', role, walletBalance: 999 }])
            });
            let state = {
                ...dcMod.dataReducer(undefined, { type: 'UNKNOWN' })
            };
            // Seed initial currentUser via SET_CURRENT_USER
            const initRes = dcMod.dataReducer(
                { currentUser: null, users: [], deposits: [], withdrawals: [], transfers: [], paymentMethods: [], investmentPlans: [], transactions: [], rules: [], tasks: [], userTasks: [], userTaskSubmissions: [], settings: {}, notifications: [], logs: [], passwordResetRequests: [], disputes: [], isLoading: false, isSyncing: false, isTasksLoading: false },
                { type: 'SET_CURRENT_USER', payload: { user: { _id: 'admin-1', username: 'boss', role, walletBalance: 0 }, token: 'tok-admin' } }
            );
            state = initRes;
            await dcMod.executeMasterDataSyncPass({
                force: true,
                userId: 'admin-1',
                role,
                refs,
                dispatch: (a) => { state = dcMod.dataReducer(state, a); },
                api
            });
            const calledNames = new Set(calls.map(c => c.name));
            assert.ok(calledNames.has('getUsers'));
            assert.ok(calledNames.has('getLogs'));
            assert.ok(calledNames.has('getPasswordResetRequests'));
            assert.equal(state.users.length, 1);
            assert.equal(state.logs.length, 1);
            assert.equal(state.passwordResetRequests.length, 1);
            assert.equal(state.currentUser.walletBalance, 999);
        }
    });

    await test('4. Fast datasets commit progressively without waiting for slow endpoints', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-member');
        const refs = createRefs('user-4');
        let releaseSlow;
        const slowPromise = new Promise(res => { releaseSlow = res; });
        const { api } = makeMockApi({
            getTransactions: async () => {
                await slowPromise;
                return [{ _id: 'tx-slow' }];
            }
        });
        const actions = [];
        const syncPromise = dcMod.executeMasterDataSyncPass({
            force: true,
            userId: 'user-4',
            role: 'user',
            refs,
            dispatch: (a) => actions.push(a),
            api
        });
        await new Promise(r => setTimeout(r, 15));
        assert.ok(actions.some(a => a.type === 'SET_NOTIFICATIONS'), 'Fast notifications must commit while slow endpoint is still pending');
        assert.ok(actions.some(a => a.type === 'SET_DEPOSITS'), 'Fast deposits must commit while slow endpoint is still pending');
        assert.equal(actions.some(a => a.type === 'SET_TRANSACTIONS'), false, 'Slow transactions not committed yet');
        releaseSlow();
        await syncPromise;
        assert.ok(actions.some(a => a.type === 'SET_TRANSACTIONS'));
    });

    await test('5 & 6. Partial failure preserves valid state and retries ONLY the failed 5xx dataset', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-member');
        const refs = createRefs('user-5');
        let wdAttempt = 0;
        const { api, calls } = makeMockApi({
            getWithdrawals: async () => {
                wdAttempt++;
                if (wdAttempt < 2) {
                    throw new apiMod.ApiError('Service Unavailable', 503);
                }
                return [{ _id: 'wd-recovered' }];
            }
        });
        let state = dcMod.dataReducer(
            { currentUser: { _id: 'user-5', role: 'user' }, users: [], deposits: [], withdrawals: [{ _id: 'wd-existing' }], transfers: [], paymentMethods: [], investmentPlans: [], transactions: [], rules: [], tasks: [], userTasks: [], userTaskSubmissions: [], settings: {}, notifications: [], logs: [], passwordResetRequests: [], disputes: [], isLoading: false, isSyncing: false, isTasksLoading: false },
            { type: 'SET_WITHDRAWALS', payload: [{ _id: 'wd-existing' }] }
        );
        await dcMod.executeMasterDataSyncPass({
            force: true,
            userId: 'user-5',
            role: 'user',
            refs,
            dispatch: (a) => { state = dcMod.dataReducer(state, a); },
            api,
            retryBaseDelayMs: 10
        });
        // Immediately after initial pass fails for withdrawals, prior valid withdrawals must still be preserved
        assert.deepEqual(state.withdrawals, [{ _id: 'wd-existing' }]);
        assert.equal(refs.lastVersionRef.current, 0, 'Version not bumped until failed dataset recovers');

        await new Promise(r => setTimeout(r, 40));
        assert.equal(wdAttempt, 2, 'Only failed dataset retried once');
        assert.equal(calls.filter(c => c.name === 'getDeposits').length, 1, 'Successful dataset was NOT refetched');
        assert.deepEqual(state.withdrawals, [{ _id: 'wd-recovered' }]);
        assert.equal(refs.lastVersionRef.current, 100, 'Version bumped after isolated retry succeeded');
    });

    await test('7 & 8. getDataVersion() === null allows initial/forced sync without poisoning lastVersionRef', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-member');
        const refs = createRefs('user-7');
        const { api, calls } = makeMockApi({
            getDataVersion: async () => null
        });
        const actions = [];
        await dcMod.executeMasterDataSyncPass({
            force: false, // initial sync even without force must proceed when hasCompletedAuthSyncRef is false
            userId: 'user-7',
            role: 'user',
            refs,
            dispatch: (a) => actions.push(a),
            api
        });
        assert.equal(refs.hasCompletedAuthSyncRef.current, true);
        assert.equal(refs.lastVersionRef.current, 0, 'Must never store unverified version when getDataVersion returns null');
        assert.ok(actions.some(a => a.type === 'SET_DEPOSITS'));

        // Passive check while version is still null must skip without loop
        const callsBeforePassive = calls.length;
        await dcMod.executeMasterDataSyncPass({
            force: false,
            userId: 'user-7',
            role: 'user',
            refs,
            dispatch: (a) => actions.push(a),
            api
        });
        assert.equal(calls.length, callsBeforePassive + 1, 'Passive check calls only getDataVersion and returns');

        // Forced refresh when version is null must still run
        await dcMod.executeMasterDataSyncPass({
            force: true,
            userId: 'user-7',
            role: 'user',
            refs,
            dispatch: (a) => actions.push(a),
            api
        });
        assert.ok(calls.filter(c => c.name === 'getDeposits').length === 2);
        assert.equal(refs.lastVersionRef.current, 0);
    });

    await test('9. isTasksLoading waits for BOTH getTasks and getUserTasks and settles on success or failure', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-member');
        const refs = createRefs('user-9');
        let resolveTasks, rejectUserTasks;
        const tasksGate = new Promise(res => { resolveTasks = res; });
        const userTasksGate = new Promise((_, rej) => { rejectUserTasks = rej; });

        const { api } = makeMockApi({
            getTasks: async () => tasksGate,
            getUserTasks: async () => userTasksGate
        });
        let state = { currentUser: { _id: 'user-9', role: 'user' }, users: [], deposits: [], withdrawals: [], transfers: [], paymentMethods: [], investmentPlans: [], transactions: [], rules: [], tasks: [], userTasks: [], userTaskSubmissions: [], settings: {}, notifications: [], logs: [], passwordResetRequests: [], disputes: [], isLoading: false, isSyncing: true, isTasksLoading: true };
        const syncP = dcMod.executeMasterDataSyncPass({
            force: true,
            userId: 'user-9',
            role: 'user',
            refs,
            dispatch: (a) => { state = dcMod.dataReducer(state, a); },
            api,
            maxRetries: 0
        });
        resolveTasks([{ _id: 't1' }]);
        await new Promise(r => setTimeout(r, 10));
        assert.equal(state.isTasksLoading, true, 'Still loading until getUserTasks settles too');
        rejectUserTasks(new apiMod.ApiError('Server Error', 500));
        await syncP;
        assert.equal(state.isTasksLoading, false, 'Must not stay true permanently even if one task endpoint fails');
    });

    await test('10. services/api.ts getUser(id) hits /users/:id, rejects fake {} responses, and throws ApiError(403)', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-self');
        const origFetch = globalThis.fetch;
        try {
            let requestedUrl = '';
            globalThis.fetch = async (url) => {
                requestedUrl = url;
                return new Response(JSON.stringify({ success: true, data: { _id: 'u123', username: 'me' } }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            };
            const u = await apiMod.getUser('u123');
            assert.ok(requestedUrl.endsWith('/api/v1/users/u123'));
            assert.equal(u._id, 'u123');

            globalThis.fetch = async () => new Response(JSON.stringify({ success: false, data: {} }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            });
            const missing = await apiMod.getUser('u123');
            assert.equal(missing, null);

            globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
                status: 403,
                headers: { 'content-type': 'application/json' }
            });
            await assert.rejects(() => apiMod.getUser('other-user'), (err) => err instanceof apiMod.ApiError && err.status === 403);
        } finally {
            globalThis.fetch = origFetch;
        }
    });

    await test('11. Account switching clears private state and blocks stale responses from User A contaminating User B', async () => {
        globalThis.localStorage.setItem('authToken', 'tok-A');
        let state = {
            currentUser: { _id: 'user-A', role: 'user' },
            users: [], deposits: [{ _id: 'dep-A' }], withdrawals: [{ _id: 'wd-A' }], transfers: [],
            paymentMethods: [], investmentPlans: [{ _id: 'public-plan' }], transactions: [], rules: [],
            tasks: [], userTasks: [], userTaskSubmissions: [], settings: { siteName: 'SmartExn' },
            notifications: [{ _id: 'notif-A' }], logs: [], passwordResetRequests: [], disputes: [],
            isLoading: false, isSyncing: false, isTasksLoading: false
        };

        const refs = createRefs('user-A');
        let resolveUserADeposits;
        const userADepositsGate = new Promise(res => { resolveUserADeposits = res; });
        const { api } = makeMockApi({
            getDeposits: async () => userADepositsGate
        });

        const syncAPromise = dcMod.executeMasterDataSyncPass({
            force: true,
            userId: 'user-A',
            role: 'user',
            refs,
            dispatch: (a) => { state = dcMod.dataReducer(state, a); },
            api
        });

        // Switch account to user-B while user-A request is still in-flight!
        state = dcMod.dataReducer(state, {
            type: 'SET_CURRENT_USER',
            payload: { user: { _id: 'user-B', role: 'user' }, token: 'tok-B' }
        });
        assert.deepEqual(state.deposits, [], 'Private deposits cleared immediately on account switch');
        assert.deepEqual(state.notifications, [], 'Private notifications cleared immediately on account switch');
        assert.equal(state.settings.siteName, 'SmartExn', 'Shared public settings preserved');
        assert.equal(state.investmentPlans.length, 1, 'Shared investmentPlans preserved');

        refs.activeUserIdRef.current = 'user-B';
        refs.syncSessionEpochRef.current += 1;

        // Now resolve User A's delayed deposit response
        resolveUserADeposits([{ _id: 'dep-FROM-USER-A' }]);
        await syncAPromise;
        assert.deepEqual(state.deposits, [], 'Stale User A response must NOT contaminate User B state');
    });

    await test('12 & 13. Other Tasks cache/dedup + Offerwall.GG 6d539cba compliance check preserved/restored', async () => {
        const origFetch = globalThis.fetch;
        let fetchCount = 0;
        try {
            globalThis.fetch = async () => {
                fetchCount++;
                return new Response(JSON.stringify({
                    success: true,
                    data: [{ _id: 'p1', providerKey: 'offerwall_gg', providerInfo: { name: 'Offerwall.GG', status: 'ACTIVE', enabled: true, approvalStatus: 'Pending' } }]
                }), { status: 200, headers: { 'content-type': 'application/json' } });
            };
            const [r1, r2] = await Promise.all([
                placementMod.fetchAndCacheAvailablePlacements('u1', 'other_tasks'),
                placementMod.fetchAndCacheAvailablePlacements('u1', 'other_tasks')
            ]);
            assert.equal(fetchCount, 1, 'Concurrent identical requests deduplicated');
            assert.equal(r1[0].providerInfo.approvalStatus, 'Pending');
            assert.equal(placementMod.getCachedAvailablePlacements('u1', 'other_tasks').length, 1);
            placementMod.clearPlacementCache();
            assert.equal(placementMod.getCachedAvailablePlacements('u1', 'other_tasks'), null);
        } finally {
            globalThis.fetch = origFetch;
        }

        const mgrSrc = fs.readFileSync(path.join(ROOT, 'pages/admin/ProviderPlacementManager.tsx'), 'utf8');
        assert.ok(mgrSrc.includes("prov.approvalStatus !== 'Approved'"), 'Offerwall.GG approvalStatus check restored');
        assert.ok(mgrSrc.includes('isOfferwallGg'), 'Offerwall.GG key matching restored');
    });

    await test('14 & 15. Mandatory survey race guards & TheoremReach 20s waiting behavior remain intact', () => {
        const panelSrc = fs.readFileSync(path.join(ROOT, 'components/ProviderPlacementPanel.tsx'), 'utf8');
        const dashSrc = fs.readFileSync(path.join(ROOT, 'pages/user/UserWorkAndEarnDashboard.tsx'), 'utf8');
        const subSrc = fs.readFileSync(path.join(ROOT, 'pages/user/UserTasksSubmit.tsx'), 'utf8');
        assert.ok(panelSrc.includes('IFRAME_WAIT_THRESHOLD_SECONDS = 20'));
        assert.ok(panelSrc.includes('activeSessionIdRef.current = nextSessionId') || panelSrc.includes('activeSessionIdRef'));
        assert.ok(dashSrc.includes('mandatoryRequestSeqRef') && dashSrc.includes('activeMandatoryUserIdRef'));
        assert.ok(subSrc.includes('mandatoryRequestSeqRef') && subSrc.includes('activeMandatoryUserIdRef'));
    });

    console.log(`\nALL ${passed} PHASE 1 REGRESSION TESTS PASSED.`);
}

runTests().catch((err) => {
    console.error(err);
    process.exit(1);
});
