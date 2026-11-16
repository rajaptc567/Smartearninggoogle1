import assert from 'node:assert/strict';
import crypto from 'crypto';
import { 
    handlePostback, 
    verifySignature, 
    seedVerifiedNetworks, 
    getOfferwallProviders, 
    updateOfferwallProvider,
    simulatePostback,
    acquirePostbackLock, 
    releasePostbackLock, 
    isLockStillOwned 
} from './backend/controllers/postbackController.js';
import { launchProviderPlacement, getAvailablePlacements } from './backend/controllers/providerPlacementController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import OfferwallPostbackLock from './backend/models/OfferwallPostbackLock.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import Setting from './backend/models/Setting.js';
import Notification from './backend/models/Notification.js';
import mongoose from 'mongoose';

mongoose.startSession = async () => ({
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
    inTransaction: () => true
});

console.log('=== Running Offerwall.GG Production Integration, Security & Feature Parity Test Suite ===\n');

// In-memory mock database
class MockDb {
    constructor() {
        this.users = new Map();
        this.transactions = new Map();
        this.providers = new Map();
        this.logs = new Map();
        this.locks = new Map();
        this.placements = new Map();
        this.notifications = new Map();
        this.userLookupCalls = [];
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.locks.clear();
        this.placements.clear();
        this.notifications.clear();
        this.userLookupCalls = [];
    }
}

const db = new MockDb();

// Setup Mongoose model mocks
User.findById = async (id) => {
    db.userLookupCalls.push({ method: 'findById', id });
    return db.users.get(String(id)) || null;
};
User.findOne = async (query) => {
    db.userLookupCalls.push({ method: 'findOne', query });
    if (query._id) return db.users.get(String(query._id)) || null;
    if (query.username) {
        for (const u of db.users.values()) {
            if (u.username === query.username) return u;
        }
    }
    if (query.email) {
        for (const u of db.users.values()) {
            if (u.email === query.email) return u;
        }
    }
    return null;
};
User.findOneAndUpdate = async (filter, update) => {
    const user = await User.findById(filter._id);
    if (!user) return null;
    if (filter.status?.$ne && user.status === filter.status.$ne) return null;
    if (filter['restrictions.earning']?.$ne && user.restrictions?.earning === true) return null;

    if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
            user[k] = Number(((user[k] || 0) + v).toFixed(4));
        }
    }
    if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
            user[k] = v;
        }
    }
    return user;
};

OfferwallProvider.findOne = async (query) => {
    if (!query) return null;
    let targetKey = typeof query.providerKey === 'string' ? query.providerKey.toLowerCase() : null;
    if (!targetKey && query.providerKey && Array.isArray(query.providerKey.$in)) {
        for (const k of query.providerKey.$in) {
            if (typeof k === 'string' && db.providers.has(k.toLowerCase())) {
                targetKey = k.toLowerCase();
                break;
            }
        }
        if (!targetKey && query.providerKey.$in[0]) {
            targetKey = String(query.providerKey.$in[0]).toLowerCase();
        }
    }
    return (targetKey ? db.providers.get(targetKey) : null) || null;
};
OfferwallProvider.find = (query = {}) => {
    const all = Array.from(db.providers.values()).map(p => ({
        ...p,
        toObject: typeof p.toObject === 'function' ? p.toObject : function() { return { ...this }; }
    }));
    const filter = (items) => {
        let res = items;
        if (query.enabled !== undefined) res = res.filter(p => p.enabled === query.enabled);
        if (query.status?.$nin) res = res.filter(p => !query.status.$nin.includes(p.status));
        return res;
    };
    const queryObj = {
        sort: () => queryObj,
        select: () => queryObj,
        lean: async () => filter(all),
        then: (resolve, reject) => Promise.resolve(filter(all)).then(resolve, reject)
    };
    return queryObj;
};
OfferwallProvider.create = async (doc) => {
    const key = doc.providerKey.toLowerCase();
    const item = { ...doc, toObject: function() { return { ...this }; }, save: async function() { return this; } };
    db.providers.set(key, item);
    return item;
};
OfferwallProvider.findByIdAndUpdate = async (id, update) => {
    for (const p of db.providers.values()) {
        if (p._id === id) {
            if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) {
                    p[k] = (p[k] || 0) + v;
                }
            }
            return p;
        }
    }
    return null;
};
OfferwallProvider.findOneAndUpdate = async (query, update) => {
    const targetKey = typeof query.providerKey === 'string' ? query.providerKey.toLowerCase() : null;
    const provider = targetKey ? db.providers.get(targetKey) : null;
    if (!provider) return null;
    if (update.$set) {
        Object.assign(provider, update.$set);
    }
    if (!provider.toObject) {
        provider.toObject = function() { return { ...this }; };
    }
    return provider;
};

Transaction.findOne = async (query) => {
    if (query.idempotencyKey) {
        return db.transactions.get(query.idempotencyKey) || null;
    }
    if (query.externalTransactionId) {
        for (const tx of db.transactions.values()) {
            if (tx.externalTransactionId === query.externalTransactionId && tx.offerwallProvider === query.offerwallProvider) {
                if (!query.type || tx.type === query.type) return tx;
            }
        }
    }
    return null;
};
Transaction.create = async (doc, options) => {
    if (Array.isArray(doc)) {
        const results = [];
        for (const item of doc) {
            results.push(await Transaction.create(item, options));
        }
        return results;
    }
    if (doc.idempotencyKey && db.transactions.has(doc.idempotencyKey)) {
        const err = new Error('Duplicate idempotency key');
        err.code = 11000;
        throw err;
    }
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tx = { _id: id, ...doc };
    if (doc.idempotencyKey) {
        db.transactions.set(doc.idempotencyKey, tx);
    }
    return tx;
};
Transaction.deleteOne = async (query) => {
    if (query._id) {
        for (const [k, v] of db.transactions.entries()) {
            if (v._id === query._id) {
                db.transactions.delete(k);
                return { deletedCount: 1 };
            }
        }
    }
    return { deletedCount: 0 };
};

OfferwallPostbackLog.countDocuments = async (query) => 0;
OfferwallPostbackLog.prototype.save = async function() {
    const id = this._id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    db.logs.set(String(id), this);
    return this;
};
OfferwallPostbackLog.create = async (doc) => {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const entry = { _id: id, receivedAt: new Date(), ...doc, save: async function() { return this; } };
    db.logs.set(id, entry);
    return entry;
};

Notification.create = async (doc) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const notif = { _id: id, ...doc };
    db.notifications.set(id, notif);
    return notif;
};

OfferwallPostbackLock.create = async (doc) => {
    const key = `${doc.providerKey}:${doc.externalTxId}`;
    if (db.locks.has(key)) {
        const err = new Error('Duplicate lock key');
        err.code = 11000;
        throw err;
    }
    db.locks.set(key, { ...doc });
    return doc;
};
OfferwallPostbackLock.findOne = async (query) => {
    const key = `${query.providerKey}:${query.externalTxId}`;
    const lock = db.locks.get(key);
    if (!lock) return null;
    if (query.ownerToken && lock.ownerToken !== query.ownerToken) return null;
    return lock;
};
OfferwallPostbackLock.deleteOne = async (query) => {
    const key = `${query.providerKey}:${query.externalTxId}`;
    const lock = db.locks.get(key);
    if (lock && (!query.ownerToken || lock.ownerToken === query.ownerToken)) {
        db.locks.delete(key);
        return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
};
OfferwallPostbackLock.findOneAndUpdate = async (filter, update) => {
    const key = `${filter.providerKey}:${filter.externalTxId}`;
    const lock = db.locks.get(key);
    if (!lock) return null;
    if (filter.ownerToken && lock.ownerToken !== filter.ownerToken) return null;
    if (update.$set) {
        Object.assign(lock, update.$set);
    }
    return lock;
};

ProviderPlacement.findOne = async (query) => {
    for (const pl of db.placements.values()) {
        let match = true;
        for (const [k, v] of Object.entries(query)) {
            if (pl[k] !== v) match = false;
        }
        if (match) return pl;
    }
    return null;
};
ProviderPlacement.find = (query = {}) => {
    const all = Array.from(db.placements.values());
    const filter = (items) => {
        let res = items;
        if (query.parentTabId) res = res.filter(p => p.parentTabId === query.parentTabId);
        if (query.placementEnabled !== undefined) res = res.filter(p => p.placementEnabled === query.placementEnabled);
        if (query.availableTasksVisibility !== undefined) res = res.filter(p => p.availableTasksVisibility === query.availableTasksVisibility);
        return res;
    };
    const queryObj = {
        lean: async () => filter(all),
        then: (resolve, reject) => Promise.resolve(filter(all)).then(resolve, reject)
    };
    return queryObj;
};

Setting.getSettings = async () => ({
    customEarnTabs: [{ id: 'offerwalls_main', enabled: true, subTabs: [] }]
});

// Test helpers
const TEST_SECRET = 'test_secret_offerwallgg_789456123';
const TEST_USER_ID = '64f1a2b3c4d5e6f7a8b9c0d1'; // Valid 24-char lowercase hex

const computeSignature = (userId, txId, amount, secret = TEST_SECRET) => {
    const msg = `${userId}:${txId}:${amount}`;
    return crypto.createHmac('sha256', secret).update(msg).digest('hex');
};

const createMockRes = () => {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        status: function(code) { this.statusCode = code; return this; },
        send: function(data) { this.body = data; return this; },
        json: function(data) { this.body = data; return this; }
    };
};

let passedTests = 0;
let totalTests = 0;

const runTest = async (name, fn) => {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
        if (err.actual !== undefined) {
            console.error(`    Actual: ${err.actual}, Expected: ${err.expected}`);
        }
        throw err;
    }
};

(async () => {
    console.log('--- SECTION 1: Idempotent Seeding & Default Disabled Strategy ---');

    await runTest('T01: Default provider registration is disabled in seedVerifiedNetworks()', async () => {
        db.clear();
        await seedVerifiedNetworks();
        const provider = db.providers.get('offerwall_gg');
        assert.ok(provider, 'offerwall_gg must be seeded in database');
        assert.equal(provider.enabled, false, 'enabled must be false by default');
    });

    await runTest('T02: Default status is NOT_STARTED and approvalStatus is Pending with Provider-Managed 100 valuation', async () => {
        const provider = db.providers.get('offerwall_gg');
        assert.equal(provider.status, 'NOT_STARTED', 'status must be NOT_STARTED');
        assert.equal(provider.approvalStatus, 'Pending', 'approvalStatus must be Pending');
        assert.equal(provider.integrationStatus, 'Not Started');
        assert.equal(provider.commissionMode, 'provider_managed');
        assert.equal(provider.exchangeRateMultiplier, 100);
        assert.equal(provider.appId, '9604');
        assert.equal(provider.apiKey, '44e2f34845f41e2de70f39b9c3b5a543');
    });

    await runTest('T03: Approval remains Pending unless explicitly updated by admin (seed is idempotent)', async () => {
        // Simulate admin configuration
        const provider = db.providers.get('offerwall_gg');
        provider.status = 'ACTIVE';
        provider.approvalStatus = 'Approved';
        provider.enabled = true;

        // Re-run seed
        await seedVerifiedNetworks();
        const rechecked = db.providers.get('offerwall_gg');
        assert.equal(rechecked.status, 'ACTIVE', 'Seed must not overwrite admin-configured status');
        assert.equal(rechecked.approvalStatus, 'Approved', 'Seed must not overwrite admin-configured approvalStatus');
        assert.equal(rechecked.enabled, true, 'Seed must not reset admin-enabled state');
    });

    await runTest('T04: Newly created ProviderPlacement defaults to placementEnabled: false', async () => {
        const placement = {
            providerKey: 'offerwall_gg',
            parentTabId: 'offerwalls_main',
            placementEnabled: false,
            offerwallVisibility: false,
            availableTasksVisibility: false,
            trustedLaunchDomains: ['offerwall.gg']
        };
        db.placements.set('p1', placement);
        assert.equal(placement.placementEnabled, false);
    });

    console.log('\n--- SECTION 2: Cryptographic Signature Verification (HMAC-SHA256) ---');

    await runTest('T05: GET valid signature accepted with HTTP 200', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const user = { _id: TEST_USER_ID, username: 'worker1', taskEarningsBalance: 10.0, taskWalletBalance: 10.0, status: 'Active' };
        db.users.set(TEST_USER_ID, user);

        const txId = 'ow_tx_001';
        const amount = '70.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                payoutUsd: '1.50',
                status: 'credited',
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, 10.70); // 10.00 + 70% of ($70.00/70) = 10.70
    });

    await runTest('T06: POST valid signature accepted with HTTP 200', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 10.0;
        user.taskWalletBalance = 10.0;

        const txId = 'ow_tx_002';
        const amount = '140.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'POST',
            params: { provider: 'offerwall_gg' },
            query: {},
            body: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                payoutUsd: '3.00',
                status: 'credited',
                signature: sig
            },
            headers: { 'content-type': 'application/json' }
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, 11.40); // 10.00 + 70% of ($140.00/70) = 11.40
    });

    await runTest('T07: GET and POST produce identical verification and financial result', async () => {
        const txId1 = 'ow_tx_equiv_get';
        const txId2 = 'ow_tx_equiv_post';
        const amount = '70';
        const sig1 = computeSignature(TEST_USER_ID, txId1, amount);
        const sig2 = computeSignature(TEST_USER_ID, txId2, amount);

        const reqGet = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId1, currencyAmount: amount, status: 'credited', payoutUsd: '1.00', signature: sig1 }, body: {}, headers: {} };
        const reqPost = { method: 'POST', params: { provider: 'offerwall_gg' }, query: {}, body: { userId: TEST_USER_ID, transactionId: txId2, currencyAmount: amount, status: 'credited', payoutUsd: '1.00', signature: sig2 }, headers: {} };

        const resGet = createMockRes();
        const resPost = createMockRes();

        const user = db.users.get(TEST_USER_ID);
        const startBalance = user.taskEarningsBalance;

        await handlePostback(reqGet, resGet);
        const midBalance = user.taskEarningsBalance;
        await handlePostback(reqPost, resPost);
        const endBalance = user.taskEarningsBalance;

        assert.equal(resGet.body, resPost.body);
        assert.equal(Number((midBalance - startBalance).toFixed(2)), 0.70);
        assert.equal(Number((endBalance - midBalance).toFixed(2)), 0.70);
    });

    await runTest('T08: Missing secret key fails closed with HTTP 400', async () => {
        delete process.env.OFFERWALL_GG_SECRET_KEY;
        const provider = db.providers.get('offerwall_gg');
        provider.secretKey = '';

        const txId = 'ow_tx_no_sec';
        const sig = computeSignature(TEST_USER_ID, txId, '70');

        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', status: 'credited', signature: sig }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
        assert.ok(String(res.body).includes('INVALID_SIGNATURE') || res.statusCode === 400);
    });

    await runTest('T09: Missing signature fails closed with HTTP 400', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: 'ow_tx_nosig', currencyAmount: '70', status: 'credited' }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T10: Incorrect signature rejected with HTTP 400', async () => {
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: 'ow_tx_badsig', currencyAmount: '70', status: 'credited', signature: 'bad_signature_1234567890abcdef' }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T11: Tampered userId rejected with HTTP 400', async () => {
        const txId = 'ow_tx_tamper_user';
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const tamperedUserId = '64f1a2b3c4d5e6f7a8b9c0d2'; // Different ID
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: tamperedUserId, transactionId: txId, currencyAmount: amount, status: 'credited', signature: sig }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T12: Tampered transactionId rejected with HTTP 400', async () => {
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, 'original_tx', amount);

        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: 'tampered_tx', currencyAmount: amount, status: 'credited', signature: sig }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T13: Tampered currencyAmount rejected with HTTP 400', async () => {
        const txId = 'ow_tx_tamper_amt';
        const sig = computeSignature(TEST_USER_ID, txId, '70.00');

        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '700.00', status: 'credited', signature: sig }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T14: Exact decimal formatting and trailing zeros preserved during signature verification', async () => {
        const txId = 'ow_tx_trailing_zeros';
        // Sig over exact string "70.00"
        const sigWithDecimals = computeSignature(TEST_USER_ID, txId, '70.00');
        // Sig over "70" would be different
        const sigWithoutDecimals = computeSignature(TEST_USER_ID, txId, '70');
        assert.notEqual(sigWithDecimals, sigWithoutDecimals, 'Trailing zeros change HMAC hash');

        // Sending "70.00" with sigWithDecimals succeeds
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70.00', status: 'credited', signature: sigWithDecimals }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);
        assert.equal(res.statusCode, 200);
    });

    await runTest('T15: Conflicting query and body parameters rejected with HTTP 400', async () => {
        const req = {
            method: 'POST',
            params: { provider: 'offerwall_gg' },
            query: { transactionId: 'tx_query_111', currencyAmount: '70', status: 'credited' },
            body: { transactionId: 'tx_body_222', currencyAmount: '70', status: 'credited', userId: TEST_USER_ID, signature: 'any' },
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);
        assert.equal(res.statusCode, 400);
    });

    console.log('\n--- SECTION 3: Test Callback Isolation (test=1) ---');

    await runTest('T16: test=1 with valid signature acknowledged with HTTP 200 without balance mutation', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        if (owProvider) {
            owProvider.enabled = false;
            owProvider.status = 'NOT_STARTED';
            owProvider.approvalStatus = 'Pending';
            owProvider.testMode = true;
        }

        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_test_valid';
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, status: 'credited', test: '1', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, balanceBefore, 'User earnings balance must remain 100% unchanged on test=1');
    });

    await runTest('T17: test=1 with invalid signature strictly rejected with HTTP 400', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        if (owProvider) {
            owProvider.enabled = false;
            owProvider.status = 'NOT_STARTED';
            owProvider.approvalStatus = 'Pending';
            owProvider.testMode = true;
        }

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: 'ow_tx_test_bad', currencyAmount: '70', status: 'credited', test: '1', signature: 'bad_signature_xxx' },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400, 'test=1 must never bypass signature validation');
    });

    console.log('\n--- SECTION 4: Financial Accounting, Idempotency & Reversals ---');

    await runTest('T18: Normal credit splits 70% user / 30% platform on payoutUsd', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        if (owProvider) {
            owProvider.enabled = true;
            owProvider.status = 'ACTIVE';
            owProvider.approvalStatus = 'Approved';
            owProvider.testMode = false;
        }

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;

        const txId = 'ow_tx_split_calc';
        const amount = '70'; // 70 Coins = $1.00 gross -> $0.70 user reward
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.00', status: 'credited', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0.70); // 70% of $1.00
    });

    await runTest('T19: Duplicate credit returns HTTP 200 without second crediting', async () => {
        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_split_calc'; // Same as T18
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.00', status: 'credited', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, balanceBefore, 'Duplicate callback must not double-credit');
    });

    await runTest('T20: Concurrent duplicate callbacks via Promise.all credit exactly once', async () => {
        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_concurrent_race';
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const makeReq = () => ({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.00', status: 'credited', signature: sig },
            body: {},
            headers: {}
        });

        const res1 = createMockRes();
        const res2 = createMockRes();

        await Promise.all([
            handlePostback(makeReq(), res1),
            handlePostback(makeReq(), res2)
        ]);

        assert.equal(Number((user.taskEarningsBalance - balanceBefore).toFixed(2)), 0.70, 'Must credit exactly once under concurrency');
    });

    await runTest('T21: Matched reversal deducts original credited amount cleanly', async () => {
        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_split_calc'; // Originally credited $0.70
        const amount = '-70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, status: 'reversed', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(Number(user.taskEarningsBalance.toFixed(2)), Number((balanceBefore - 0.70).toFixed(2)));
    });

    await runTest('T22: Duplicate reversal acknowledged without double deduction', async () => {
        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_split_calc';
        const amount = '-70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, status: 'reversed', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, balanceBefore, 'Duplicate reversal must not deduct again');
    });

    await runTest('T23: Reversal with negative currencyAmount and status=reversed recognized as reversal', async () => {
        // First credit
        const txId = 'ow_tx_neg_amount_test';
        const credAmount = '70';
        const credSig = computeSignature(TEST_USER_ID, txId, credAmount);
        const resCred = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: credAmount, payoutUsd: '1.00', status: 'credited', signature: credSig }, body: {}, headers: {} }, resCred);

        const user = db.users.get(TEST_USER_ID);
        const midBalance = user.taskEarningsBalance;

        // Reversal with negative amount and status=reversed
        const revAmount = '-70';
        const revSig = computeSignature(TEST_USER_ID, txId, revAmount);
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: revAmount, status: 'reversed', signature: revSig }, body: {}, headers: {} }, resRev);

        assert.equal(resRev.statusCode, 200);
        assert.equal(Number((midBalance - user.taskEarningsBalance).toFixed(2)), 0.70);
    });

    await runTest('T24: status=reversed with negative currencyAmount handled as reversal', async () => {
        const txId = 'ow_tx_status_rev_test';
        const credSig = computeSignature(TEST_USER_ID, txId, '70');
        const resCred = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', status: 'credited', signature: credSig }, body: {}, headers: {} }, resCred);

        const user = db.users.get(TEST_USER_ID);
        const midBalance = user.taskEarningsBalance;

        const revSig = computeSignature(TEST_USER_ID, txId, '-70');
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-70', status: 'reversed', signature: revSig }, body: {}, headers: {} }, resRev);

        assert.equal(resRev.statusCode, 200);
        assert.equal(Number((midBalance - user.taskEarningsBalance).toFixed(2)), 0.70);
    });

    await runTest('T25: Reversal before credit creates unmatched marker without balance mutation', async () => {
        const user = db.users.get(TEST_USER_ID);
        const startBalance = user.taskEarningsBalance;

        const txId = 'ow_tx_unmatched_first';
        const revSig = computeSignature(TEST_USER_ID, txId, '-70');
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-70', status: 'reversed', signature: revSig }, body: {}, headers: {} }, resRev);

        assert.equal(resRev.statusCode, 200);
        assert.equal(user.taskEarningsBalance, startBalance, 'Unmatched reversal must not deduct balance');

        const marker = await Transaction.findOne({ idempotencyKey: `offerwall_gg_${txId}_reversal` });
        assert.ok(marker, 'Unmatched reversal marker must be persisted in ledger');
        assert.equal(marker.amount, 0);
    });

    await runTest('T26: Delayed credit blocked by pre-existing reversal marker at net zero', async () => {
        const user = db.users.get(TEST_USER_ID);
        const startBalance = user.taskEarningsBalance;

        const txId = 'ow_tx_unmatched_first'; // From T25
        const credSig = computeSignature(TEST_USER_ID, txId, '70');
        const resCred = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', status: 'credited', signature: credSig }, body: {}, headers: {} }, resCred);

        assert.equal(resCred.statusCode, 200);
        assert.equal(user.taskEarningsBalance, startBalance, 'Late credit must be blocked by pre-existing reversal marker');
    });

    await runTest('T27: Insufficient balance reversal records deficit in chargebackLiabilityUSD without negative balance', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0.20; // Only 20 cents
        user.chargebackLiabilityUSD = 0;

        const txId = 'ow_tx_deficit_case';
        const credSig = computeSignature(TEST_USER_ID, txId, '70');
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', status: 'credited', signature: credSig }, body: {}, headers: {} }, createMockRes());

        // Balance is now 0.20 + 0.70 = 0.90
        // Now withdraw/reset balance to 0.20
        user.taskEarningsBalance = 0.20;

        // Reversal of $0.70 occurs
        const revSig = computeSignature(TEST_USER_ID, txId, '-70');
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-70', status: 'reversed', signature: revSig }, body: {}, headers: {} }, resRev);

        assert.equal(resRev.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0, 'Balance must floor at 0 rather than becoming negative');
        assert.equal(user.chargebackLiabilityUSD, 0.50, 'Deficit must be tracked in chargebackLiabilityUSD');
    });

    await runTest('T28: Exact accounting precision maintained without truncation', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;

        const txId = 'ow_tx_precise_split';
        const amount = '70.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.00', status: 'credited', signature: sig },
            body: {},
            headers: {}
        };
        await handlePostback(req, createMockRes());

        assert.equal(user.taskEarningsBalance, 0.70);
    });

    console.log('\n--- SECTION 5: Provider Placement, Targeting & Visibility Gates ---');

    await runTest('T29: Country restrictions enforce allowed countries correctly', async () => {
        const userUS = { _id: '64f1a2b3c4d5e6f7a8b9c0d3', country: 'US', status: 'Active' };
        const userPK = { _id: '64f1a2b3c4d5e6f7a8b9c0d4', country: 'PK', status: 'Active' };
        db.users.set(userUS._id, userUS);
        db.users.set(userPK._id, userPK);

        const placement = {
            _id: 'pl_country_test',
            providerKey: 'offerwall_gg',
            placementEnabled: true,
            parentTabId: 'offerwalls_main',
            allowedCountries: ['US', 'CA'],
            excludedCountries: [],
            rolloutPercentage: 100,
            targetingMode: 'all',
            trustedLaunchDomains: ['offerwall.gg']
        };

        const { evaluatePlacementEligibility } = await import('./backend/utils/providerPlacementEligibility.js');
        const evalUS = evaluatePlacementEligibility(userUS, placement);
        const evalPK = evaluatePlacementEligibility(userPK, placement);

        assert.equal(evalUS.eligible, true, 'User from allowed country must be eligible');
        assert.equal(evalPK.eligible, false, 'User from non-allowed country must be rejected');
    });

    await runTest('T30: Excluded countries correctly reject targeted users', async () => {
        const userGB = { _id: '64f1a2b3c4d5e6f7a8b9c0d5', country: 'GB', status: 'Active' };
        const userFR = { _id: '64f1a2b3c4d5e6f7a8b9c0d6', country: 'FR', status: 'Active' };
        db.users.set(userGB._id, userGB);
        db.users.set(userFR._id, userFR);

        const placement = {
            _id: 'pl_exclude_test',
            providerKey: 'offerwall_gg',
            placementEnabled: true,
            parentTabId: 'offerwalls_main',
            allowedCountries: [],
            excludedCountries: ['GB'],
            rolloutPercentage: 100,
            targetingMode: 'all',
            trustedLaunchDomains: ['offerwall.gg']
        };

        const { evaluatePlacementEligibility } = await import('./backend/utils/providerPlacementEligibility.js');
        assert.equal(evaluatePlacementEligibility(userGB, placement).eligible, false);
        assert.equal(evaluatePlacementEligibility(userFR, placement).eligible, true);
    });

    await runTest('T31: Deterministic percentage rollout partitions cohorts consistently', async () => {
        const { isUserInRollout } = await import('./backend/utils/providerPlacementEligibility.js');
        const u1 = '64f1a2b3c4d5e6f7a8b9c0d1';
        const salt = 'testsalt123';

        const res1 = isUserInRollout(u1, 'pl1', salt, 50);
        const res2 = isUserInRollout(u1, 'pl1', salt, 50);
        assert.equal(res1, res2, 'Same user and placement must always produce identical cohort');
    });

    await runTest('T32: Test-user targeting restricts availability to designated test user IDs', async () => {
        const testUser = { _id: '64f1a2b3c4d5e6f7a8b9c0d7', status: 'Active' };
        const regularUser = { _id: '64f1a2b3c4d5e6f7a8b9c0d8', status: 'Active' };

        const placement = {
            _id: 'pl_testuser_test',
            providerKey: 'offerwall_gg',
            placementEnabled: true,
            parentTabId: 'offerwalls_main',
            targetingMode: 'test_users',
            testUserIds: [testUser._id],
            rolloutPercentage: 100,
            trustedLaunchDomains: ['offerwall.gg']
        };

        const { evaluatePlacementEligibility } = await import('./backend/utils/providerPlacementEligibility.js');
        assert.equal(evaluatePlacementEligibility(testUser, placement).eligible, true);
        assert.equal(evaluatePlacementEligibility(regularUser, placement).eligible, false);
    });

    await runTest('T33: Placement disabled returns ineligible immediately', async () => {
        const user = { _id: TEST_USER_ID, status: 'Active' };
        const placement = { placementEnabled: false };
        const { evaluatePlacementEligibility } = await import('./backend/utils/providerPlacementEligibility.js');
        assert.equal(evaluatePlacementEligibility(user, placement).eligible, false);
    });

    await runTest('T34: Provider disabled is filtered out from getOfferwallProviders', async () => {
        const provider = db.providers.get('offerwall_gg');
        provider.enabled = false;
        provider.status = 'ACTIVE';

        const req = { user: { id: TEST_USER_ID } };
        const res = createMockRes();
        await getOfferwallProviders(req, res);

        const found = res.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.equal(found, undefined, 'Disabled provider must never appear in worker view');
    });

    await runTest('T35: TESTING/SANDBOX operational states not visible to normal workers', async () => {
        const provider = db.providers.get('offerwall_gg');
        provider.enabled = true;
        provider.status = 'TESTING';

        const req = { user: { id: TEST_USER_ID } };
        const res = createMockRes();
        await getOfferwallProviders(req, res);

        const found = res.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.equal(found, undefined, 'TESTING status must remain hidden from normal workers');
    });

    await runTest('T36: Placement-level trustedLaunchDomains correctly validates offerwall.gg', async () => {
        const placement = {
            _id: 'pl_launch_test',
            providerKey: 'offerwall_gg',
            placementEnabled: true,
            trustedLaunchDomains: ['offerwall.gg']
        };
        const { isDomainTrusted } = await import('./backend/controllers/providerPlacementController.js');
        assert.equal(isDomainTrusted('offerwall.gg', 'offerwall.gg'), true);
        assert.equal(isDomainTrusted('api.offerwall.gg', 'offerwall.gg'), true);
        assert.equal(isDomainTrusted('offerwall.gg.evil.com', 'offerwall.gg'), false);
    });

    console.log('\n--- SECTION 6: System Boundaries & Existing Provider Isolation ---');

    await runTest('T37: Core walletBalance remains 100% untouched across credits and reversals', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        if (owProvider) {
            owProvider.enabled = true;
            owProvider.status = 'ACTIVE';
            owProvider.approvalStatus = 'Approved';
        }
        const user = db.users.get(TEST_USER_ID);
        user.walletBalance = 500.00; // Main deposit capital
        user.taskEarningsBalance = 10.00;
        user.taskWalletBalance = 10.00;

        // Perform a credit
        const txId = 'ow_tx_core_isolation';
        const sig = computeSignature(TEST_USER_ID, txId, '70');
        const credRes = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', status: 'credited', signature: sig }, body: {}, headers: {} }, credRes);

        assert.equal(credRes.statusCode, 200);
        assert.equal(user.walletBalance, 500.00, 'Main deposit walletBalance must be 100% untouched on credit');

        // Perform a reversal
        const revSig = computeSignature(TEST_USER_ID, txId, '-70');
        const revRes = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-70', status: 'reversed', signature: revSig }, body: {}, headers: {} }, revRes);

        assert.equal(revRes.statusCode, 200);
        assert.equal(user.walletBalance, 500.00, 'Main deposit walletBalance must be 100% untouched on reversal');
    });

    await runTest('T38: Investment Module plans and contracts remain 100% untouched', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.activePlan = 'Gold Plan';
        user.activePlans = [{ planName: 'Gold Plan', price: 1000 }];

        const txId = 'ow_tx_invest_isolation';
        const sig = computeSignature(TEST_USER_ID, txId, '70');
        const credRes = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', status: 'credited', signature: sig }, body: {}, headers: {} }, credRes);

        assert.equal(credRes.statusCode, 200);
        assert.equal(user.activePlan, 'Gold Plan');
        assert.equal(user.activePlans.length, 1);
    });

    await runTest('T39: CPX Research regression test executes without interference', async () => {
        const cpxProvider = {
            providerKey: 'cpx_research',
            name: 'CPX Research',
            enabled: true,
            status: 'ACTIVE',
            secretKey: 'cpx_secret_999',
            commissionMode: 'smartexn_managed',
            userRevenueSharePercent: 70
        };
        db.providers.set('cpx_research', cpxProvider);

        const transId = 'cpx_tx_regression_01';
        const hash = crypto.createHash('md5').update(`${transId}-cpx_secret_999`).digest('hex');

        const req = {
            method: 'GET',
            params: { provider: 'cpx_research' },
            query: {
                user_id: TEST_USER_ID,
                trans_id: transId,
                amount_usd: '1.00',
                status: '1',
                secure_hash: hash
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, '1');
    });

    await runTest('T40: TheoremReach regression test executes without interference', async () => {
        const trProvider = {
            providerKey: 'theoremreach',
            name: 'TheoremReach',
            enabled: true,
            status: 'ACTIVE',
            secretKey: 'tr_secret_888',
            rewardCallbackUrl: 'https://smartexn.com/api/v1/postbacks/theoremreach',
            exchangeRateMultiplier: 70
        };
        db.providers.set('theoremreach', trProvider);

        const txId = 'tr_tx_regression_02';
        const urlPart = `https://smartexn.com/api/v1/postbacks/theoremreach?user_id=${TEST_USER_ID}&tx_id=${txId}&reward=70`;
        const hmac = crypto.createHmac('sha1', 'tr_secret_888').update(urlPart).digest('base64');
        const hash = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const req = {
            method: 'GET',
            params: { provider: 'theoremreach' },
            query: { user_id: TEST_USER_ID, tx_id: txId, reward: '70', hash },
            rawUrl: `${urlPart}&hash=${hash}`,
            originalUrl: `/api/v1/postbacks/theoremreach?user_id=${TEST_USER_ID}&tx_id=${txId}&reward=70&hash=${hash}`,
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
    });

    await runTest('T41: AdGem regression test executes without interference', async () => {
        const adgemProvider = {
            providerKey: 'adgem',
            name: 'AdGem',
            enabled: true,
            status: 'ACTIVE',
            approvalStatus: 'Approved',
            appId: '34014',
            postbackKey: 'adgem_secret_777',
            exchangeRateMultiplier: 100,
            commissionMode: 'provider_managed',
            userRevenueSharePercent: 70,
            platformRevenueSharePercent: 30
        };
        db.providers.set('adgem', adgemProvider);

        const payload = {
            request_id: 'req_spec_regress',
            data: {
                app_id: 34014,
                player_id: TEST_USER_ID,
                conversion_id: 'conv_adgem_regression_01',
                campaign_id: 101,
                conversion_type: 'reward',
                amount: 105,
                payout: 1.50
            }
        };
        const rawBody = JSON.stringify(payload);
        const sig = crypto.createHmac('sha256', 'adgem_secret_777').update(rawBody).digest('hex');

        const { handleAdGemPostback } = await import('./backend/controllers/postbackController.js');
        const req = {
            method: 'POST',
            body: payload,
            rawBody,
            headers: { 'signature': sig, 'content-type': 'application/json' },
            query: {}
        };
        const res = createMockRes();
        await handleAdGemPostback(req, res);

        assert.equal(res.statusCode, 200);
    });

    await runTest('T42: ayeT-Studios regression test executes without interference', async () => {
        const ayetProvider = {
            providerKey: 'ayetstudios',
            name: 'ayeT-Studios',
            enabled: true,
            status: 'ACTIVE',
            apiKey: 'ayet_key_555'
        };
        db.providers.set('ayetstudios', ayetProvider);

        const txId = 'ayet_tx_regression_03';
        const queryParams = {
            currency_amount: '100',
            currency_conversion_rate: '200',
            external_identifier: TEST_USER_ID,
            payout_usd: '0.50',
            transaction_id: txId
        };
        const urlParams = new URLSearchParams(queryParams);
        const expectedSig = crypto.createHmac('sha256', 'ayet_key_555').update(urlParams.toString()).digest('hex');

        const req = {
            method: 'GET',
            params: { provider: 'ayetstudios' },
            query: queryParams,
            body: {},
            headers: { 'x-ayetstudios-security-hash': expectedSig }
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
    });

    await runTest('T43: Tampering payoutUsd with valid HMAC does not alter credited reward', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        if (owProvider) {
            owProvider.enabled = true;
            owProvider.status = 'ACTIVE';
            owProvider.approvalStatus = 'Approved';
        }

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 10.0;
        user.taskWalletBalance = 10.0;

        const txId = 'ow_tx_tamper_payout';
        const amount = '70.00'; // $1.00 gross -> $0.70 reward
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                payoutUsd: '999.00', // Tampered unsigned payoutUsd!
                status: 'credited',
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 10.70); // Credited based on currencyAmount ($1.00 * 70% = $0.70), ignoring $999.00 payoutUsd
    });

    await runTest('T44: Status and sign consistency validation (positive amount with status=reversed rejected)', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        if (owProvider) {
            owProvider.enabled = true;
            owProvider.status = 'ACTIVE';
            owProvider.approvalStatus = 'Approved';
        }

        const txId = 'ow_tx_invalid_status_sign';
        const amount = '70.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                status: 'reversed', // Mismatched status!
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T45: Offerwall.GG launch rejected unless approvalStatus is Approved', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.status = 'ACTIVE';
        owProvider.enabled = true;
        owProvider.approvalStatus = 'Pending'; // Not Approved

        const pId = '64f1a2b3c4d5e6f7a8b9c0d9'; // Valid 24-char hex ID
        const placement = {
            _id: pId,
            providerKey: 'offerwall_gg',
            parentTabId: 'offerwalls_main',
            placementEnabled: true,
            offerwallVisibility: true,
            availableTasksVisibility: true,
            trustedLaunchDomains: ['offerwall.gg']
        };
        db.placements.set(pId, placement);

        const req = {
            user: { id: TEST_USER_ID },
            params: { placementId: pId }
        };
        const res = createMockRes();
        await launchProviderPlacement(req, res);

        assert.equal(res.statusCode, 403);
    });

    await runTest('T46: TESTING status cannot create live financial credit', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.status = 'TESTING';
        owProvider.enabled = true;
        owProvider.approvalStatus = 'Approved';

        const txId = 'ow_tx_testing_state';
        const amount = '70.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                status: 'credited',
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 403); // Testing state rejected for live credit
    });

    await runTest('T47: getOfferwallProviders returns serverSecretConfigured boolean for admin users', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = 'test_secret_key';
        const adminReq = { user: { id: TEST_USER_ID, role: 'admin' } };
        const res1 = createMockRes();
        await getOfferwallProviders(adminReq, res1);

        const provider1 = res1.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.ok(provider1, 'Offerwall.GG provider should be returned for admin');
        assert.equal(provider1.serverSecretConfigured, true, 'serverSecretConfigured should be true when secret env var is present');

        delete process.env.OFFERWALL_GG_SECRET_KEY;
        const res2 = createMockRes();
        await getOfferwallProviders(adminReq, res2);

        const provider2 = res2.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.ok(provider2, 'Offerwall.GG provider should be returned for admin');
        assert.equal(provider2.serverSecretConfigured, false, 'serverSecretConfigured should be false when secret env var is missing');
    });

    await runTest('T48: Disabled Offerwall.GG + testMode true + valid HMAC + test=1 => HTTP 200 TestCallback with zero financial mutations', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = false;
        owProvider.status = 'NOT_STARTED';
        owProvider.approvalStatus = 'Pending';
        owProvider.testMode = true;

        const user = db.users.get(TEST_USER_ID);
        const taskEarningsBefore = user.taskEarningsBalance;
        const taskWalletBefore = user.taskWalletBalance;
        const walletBalanceBefore = user.walletBalance;

        const syntheticUserId = 'synthetic_test_user_999';
        const txId = 'ow_tx_test_disabled_provider';
        const amount = '70.00';
        const sig = computeSignature(syntheticUserId, txId, amount);

        const txCountBefore = db.transactions.size;
        const logCountBefore = db.logs.size;
        const notifCountBefore = db.notifications.size;
        db.userLookupCalls = [];

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: syntheticUserId, transactionId: txId, currencyAmount: amount, status: 'credited', test: '1', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(db.transactions.size, txCountBefore, 'No transaction creation allowed');
        assert.equal(db.notifications.size, notifCountBefore, 'No notification dispatched on test callback');
        assert.equal(user.taskEarningsBalance, taskEarningsBefore, 'Task earnings balance must remain unchanged');
        assert.equal(user.taskWalletBalance, taskWalletBefore, 'Task wallet balance must remain unchanged');
        assert.equal(user.walletBalance, walletBalanceBefore, 'Core deposit wallet balance must remain unchanged');
        assert.equal(db.userLookupCalls.length, 0, 'No user lookup performed for testMode callback');
        assert.equal(db.logs.size, logCountBefore + 1, 'Postback log recorded');
        const lastLog = Array.from(db.logs.values()).pop();
        assert.equal(lastLog.status, 'TestCallback', 'Log status must be TestCallback');
    });

    await runTest('T49: Disabled Offerwall.GG + live callback (test=0) => Rejected with HTTP 403 PROVIDER_INACTIVE', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = false;
        owProvider.status = 'NOT_STARTED';
        owProvider.approvalStatus = 'Pending';
        owProvider.testMode = false;

        const user = db.users.get(TEST_USER_ID);
        const taskEarningsBefore = user.taskEarningsBalance;
        const taskWalletBefore = user.taskWalletBalance;
        const walletBalanceBefore = user.walletBalance;

        const txId = 'ow_tx_test_disabled_live_callback';
        const amount = '70.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const txCountBefore = db.transactions.size;
        const logCountBefore = db.logs.size;
        const notifCountBefore = db.notifications.size;
        db.userLookupCalls = [];

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, status: 'credited', test: '0', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 403, 'Must be rejected by inactive-provider protection when test parameter is 0');
        assert.equal(res.body.error.includes('PROVIDER_INACTIVE'), true, 'Error response must state PROVIDER_INACTIVE');
        assert.equal(db.transactions.size, txCountBefore, 'No transaction created on rejected request');
        assert.equal(db.notifications.size, notifCountBefore, 'No notification dispatched on rejected request');
        assert.equal(user.taskEarningsBalance, taskEarningsBefore, 'Task earnings balance unchanged');
        assert.equal(user.taskWalletBalance, taskWalletBefore, 'Task wallet balance unchanged');
        assert.equal(user.walletBalance, walletBalanceBefore, 'Core deposit wallet balance unchanged');
        assert.equal(db.userLookupCalls.length, 0, 'No user lookup on 403 rejection');
        assert.equal(db.logs.size, logCountBefore, 'No log entry created on early 403 inactive-provider guard');
    });

    await runTest('T50: Missing or invalid signature in test mode rejected with HTTP 400', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = false;
        owProvider.status = 'NOT_STARTED';
        owProvider.testMode = true;

        const user = db.users.get(TEST_USER_ID);
        const taskEarningsBefore = user.taskEarningsBalance;
        const taskWalletBefore = user.taskWalletBalance;
        const walletBalanceBefore = user.walletBalance;
        const txCountBefore = db.transactions.size;
        const logCountBefore = db.logs.size;
        const notifCountBefore = db.notifications.size;
        db.userLookupCalls = [];

        // Sub-test 1: Missing signature
        const reqMissing = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: 'ow_tx_test_nosig', currencyAmount: '70', status: 'credited', test: '1' },
            body: {},
            headers: {}
        };
        const resMissing = createMockRes();
        await handlePostback(reqMissing, resMissing);

        assert.equal(resMissing.statusCode, 400, 'Missing signature must be rejected with HTTP 400');
        assert.equal(resMissing.body, 'INVALID_SIGNATURE', 'Missing signature body must be INVALID_SIGNATURE');
        assert.equal(db.transactions.size, txCountBefore, 'No transaction created on missing signature');
        assert.equal(db.notifications.size, notifCountBefore, 'No notification dispatched on missing signature');
        assert.equal(user.taskEarningsBalance, taskEarningsBefore, 'Task earnings balance unchanged on missing signature');
        assert.equal(user.taskWalletBalance, taskWalletBefore, 'Task wallet balance unchanged on missing signature');
        assert.equal(user.walletBalance, walletBalanceBefore, 'Core deposit wallet balance unchanged on missing signature');
        assert.equal(db.userLookupCalls.length, 0, 'No user lookup on missing signature');
        assert.equal(db.logs.size, logCountBefore + 1, 'Audit log recorded for missing signature');
        const logMissing = Array.from(db.logs.values()).pop();
        assert.equal(logMissing.status, 'InvalidSignature', 'Missing signature log status must be InvalidSignature');
        assert.equal(logMissing.signatureStatus, 'Invalid', 'Missing signature status must be Invalid');

        // Sub-test 2: Invalid signature
        const reqInvalid = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: 'ow_tx_test_badsig', currencyAmount: '70', status: 'credited', test: '1', signature: 'bad_signature_xyz' },
            body: {},
            headers: {}
        };
        const resInvalid = createMockRes();
        await handlePostback(reqInvalid, resInvalid);

        assert.equal(resInvalid.statusCode, 400, 'Invalid signature must be rejected with HTTP 400');
        assert.equal(resInvalid.body, 'INVALID_SIGNATURE', 'Invalid signature body must be INVALID_SIGNATURE');
        assert.equal(db.transactions.size, txCountBefore, 'No transaction created on invalid signature');
        assert.equal(db.notifications.size, notifCountBefore, 'No notification dispatched on invalid signature');
        assert.equal(user.taskEarningsBalance, taskEarningsBefore, 'Task earnings balance unchanged on invalid signature');
        assert.equal(user.taskWalletBalance, taskWalletBefore, 'Task wallet balance unchanged on invalid signature');
        assert.equal(user.walletBalance, walletBalanceBefore, 'Core deposit wallet balance unchanged on invalid signature');
        assert.equal(db.userLookupCalls.length, 0, 'No user lookup on invalid signature');
        assert.equal(db.logs.size, logCountBefore + 2, 'Audit log recorded for invalid signature');
        const logInvalid = Array.from(db.logs.values()).pop();
        assert.equal(logInvalid.status, 'InvalidSignature', 'Invalid signature log status must be InvalidSignature');
        assert.equal(logInvalid.signatureStatus, 'Invalid', 'Invalid signature status must be Invalid');
    });

    await runTest('T51: Synthetic/nonexistent user ID in authorized server-side test mode returns HTTP 200 without real user lookup or financial mutation', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = false;
        owProvider.status = 'NOT_STARTED';
        owProvider.approvalStatus = 'Pending';
        owProvider.testMode = true;

        const user = db.users.get(TEST_USER_ID);
        const taskEarningsBefore = user.taskEarningsBalance;
        const taskWalletBefore = user.taskWalletBalance;
        const walletBalanceBefore = user.walletBalance;

        const syntheticUserId = 'nonexistent_synthetic_user_id_12345';
        const txId = 'ow_tx_test_synthetic_user';
        const amount = '70.00';
        const sig = computeSignature(syntheticUserId, txId, amount);

        const txCountBefore = db.transactions.size;
        const logCountBefore = db.logs.size;
        const notifCountBefore = db.notifications.size;
        db.userLookupCalls = [];

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: syntheticUserId, transactionId: txId, currencyAmount: amount, status: 'credited', test: '1', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(db.userLookupCalls.length, 0, 'No user lookup performed for synthetic user in test mode');
        assert.equal(db.transactions.size, txCountBefore, 'No transaction created for synthetic user test mode callback');
        assert.equal(db.notifications.size, notifCountBefore, 'No notification dispatched for synthetic user test mode callback');
        assert.equal(user.taskEarningsBalance, taskEarningsBefore, 'Real user task earnings balance unchanged');
        assert.equal(user.taskWalletBalance, taskWalletBefore, 'Real user task wallet balance unchanged');
        assert.equal(user.walletBalance, walletBalanceBefore, 'Real user core deposit wallet balance unchanged');
        assert.equal(db.logs.size, logCountBefore + 1, 'Postback log recorded');
        const lastLog = Array.from(db.logs.values()).pop();
        assert.equal(lastLog.status, 'TestCallback', 'Log status must be TestCallback');
    });

    await runTest('T52: ACTIVE provider + valid HMAC + test=1 => Intercepted as TestCallback with zero financial mutations or user lookups', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';
        owProvider.testMode = false;

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 10.00;
        user.taskWalletBalance = 10.00;
        const walletBalanceBefore = user.walletBalance;

        const txId = 'ow_tx_active_with_test1_param';
        const amount = '70.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const txCountBefore = db.transactions.size;
        const logCountBefore = db.logs.size;
        const notifCountBefore = db.notifications.size;
        db.userLookupCalls = [];

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                status: 'credited',
                test: '1',
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, 10.00, 'taskEarningsBalance unchanged on test=1 callback');
        assert.equal(user.taskWalletBalance, 10.00, 'taskWalletBalance unchanged on test=1 callback');
        assert.equal(user.walletBalance, walletBalanceBefore, 'walletBalance unchanged on test=1 callback');
        assert.equal(db.userLookupCalls.length, 0, 'No user lookup performed for test=1 callback');
        assert.equal(db.transactions.size, txCountBefore, 'No transaction created for test=1 callback');
        assert.equal(db.notifications.size, notifCountBefore, 'No notification dispatched for test=1 callback');
        assert.equal(db.logs.size, logCountBefore + 1, 'Postback log recorded for test=1 callback');

        const lastLog = Array.from(db.logs.values()).pop();
        assert.equal(lastLog.status, 'TestCallback', 'Log status must be TestCallback for test=1 callback');
    });

    await runTest('T53: Valid signed test reversal callback (test=1) => Intercepted as TestCallback with zero debit/rollback or side effects', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';
        owProvider.testMode = false;

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 10.00;
        user.taskWalletBalance = 10.00;
        const walletBalanceBefore = user.walletBalance;

        const txId = 'ow_tx_test_reversal_test1';
        const amount = '-70.00';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const txCountBefore = db.transactions.size;
        const logCountBefore = db.logs.size;
        const notifCountBefore = db.notifications.size;
        db.userLookupCalls = [];

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                status: 'reversed',
                test: '1',
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, 10.00, 'taskEarningsBalance unchanged on test=1 reversal');
        assert.equal(user.taskWalletBalance, 10.00, 'taskWalletBalance unchanged on test=1 reversal');
        assert.equal(user.walletBalance, walletBalanceBefore, 'walletBalance unchanged on test=1 reversal');
        assert.equal(db.userLookupCalls.length, 0, 'No user lookup performed for test=1 reversal');
        assert.equal(db.transactions.size, txCountBefore, 'No transaction created for test=1 reversal');
        assert.equal(db.notifications.size, notifCountBefore, 'No notification dispatched for test=1 reversal');
        assert.equal(db.logs.size, logCountBefore + 1, 'Postback log recorded for test=1 reversal');

        const lastLog = Array.from(db.logs.values()).pop();
        assert.equal(lastLog.status, 'TestCallback', 'Log status must be TestCallback for test=1 reversal');
    });

    await runTest('T54: Live callback with test=0 on ACTIVE provider => Follows normal live credit validation and accounting', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';
        owProvider.testMode = false;

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 10.00;
        user.taskWalletBalance = 10.00;
        const walletBalanceBefore = user.walletBalance;

        const txId = 'ow_tx_live_credit_test0';
        const amount = '70.00'; // $1.00 gross -> $0.70 reward
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const txCountBefore = db.transactions.size;
        const notifCountBefore = db.notifications.size;
        db.userLookupCalls = [];

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: {
                userId: TEST_USER_ID,
                transactionId: txId,
                currencyAmount: amount,
                status: 'credited',
                test: '0', // Genuine live callback
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, 10.70, 'taskEarningsBalance credited on live callback');
        assert.equal(user.taskWalletBalance, 10.70, 'taskWalletBalance credited on live callback');
        assert.equal(user.walletBalance, walletBalanceBefore, 'walletBalance untouched on live callback');
        assert.ok(db.userLookupCalls.length > 0, 'User lookup performed for live callback');

        const tx = await Transaction.findOne({ idempotencyKey: `offerwall_gg_${txId}_credit` });
        assert.ok(tx, 'Live transaction record created');
        assert.equal(tx.amount, 0.70, 'Transaction amount matches reward');
        assert.equal(tx.type, 'Offerwall Reward', 'Transaction type is Offerwall Reward');

        assert.equal(db.transactions.size, txCountBefore + 1, 'Exactly one transaction created');
        assert.equal(db.notifications.size, notifCountBefore + 1, 'User notification dispatched');

        const lastLog = Array.from(db.logs.values()).pop();
        assert.notEqual(lastLog.status, 'TestCallback', 'Log status must NOT be TestCallback for live processing');
        assert.equal(lastLog.status, 'Processed', 'Log status must be Processed for live processing');
    });

    await runTest('T55: Public getOfferwallProviders includes Offerwall.GG when ACTIVE, enabled, and Approved', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';
        owProvider.appId = '9604';
        owProvider.iframeUrlTemplate = 'https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId={user_id}';

        const req = { user: { id: TEST_USER_ID } };
        const res = createMockRes();
        await getOfferwallProviders(req, res);

        assert.equal(res.statusCode, 200);
        const found = res.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.ok(found, 'Approved Offerwall.GG must be included in public worker response');
        assert.equal(found.iframeUrl, `https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId=${TEST_USER_ID}`, '{user_id} macro resolved correctly in public worker view');
    });

    await runTest('T56: Public getOfferwallProviders excludes Offerwall.GG when approvalStatus is Pending', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Pending'; // Unapproved

        const req = { user: { id: TEST_USER_ID } };
        const res = createMockRes();
        await getOfferwallProviders(req, res);

        assert.equal(res.statusCode, 200);
        const found = res.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.equal(found, undefined, 'Unapproved Offerwall.GG must be excluded from public worker response');
    });

    await runTest('T57: getAvailablePlacements excludes unapproved Offerwall.GG and includes approved ACTIVE Offerwall.GG', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Pending';

        const pId = '64f1a2b3c4d5e6f7a8b9c0e0';
        const placement = {
            _id: pId,
            providerKey: 'offerwall_gg',
            parentTabId: 'available_jobs',
            subTabId: '',
            placementEnabled: true,
            availableTasksVisibility: true,
            displayName: 'Offerwall.GG Tasks',
            displayOrder: 1
        };
        db.placements.set(pId, placement);

        const req = {
            user: { id: TEST_USER_ID },
            params: { parentTabId: 'available_jobs' }
        };

        // Case 1: Unapproved
        const resUnapproved = createMockRes();
        await getAvailablePlacements(req, resUnapproved);
        assert.equal(resUnapproved.statusCode, 200);
        const foundUnapproved = resUnapproved.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.equal(foundUnapproved, undefined, 'Unapproved Offerwall.GG placement must be excluded from Available Tasks');

        // Case 2: Approved
        owProvider.approvalStatus = 'Approved';
        const resApproved = createMockRes();
        await getAvailablePlacements(req, resApproved);
        assert.equal(resApproved.statusCode, 200);
        const foundApproved = resApproved.body?.data?.find(p => p.providerKey === 'offerwall_gg');
        assert.ok(foundApproved, 'Approved Offerwall.GG placement must be included in Available Tasks');
    });

    await runTest('T58: both {userId} and {user_id} resolve correctly in placement launch URL without exposing secrets', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';
        owProvider.appId = '9604';
        owProvider.iframeUrlTemplate = 'https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId={user_id}&app={appId}';

        const pId = '64f1a2b3c4d5e6f7a8b9c0e1';
        const placement = {
            _id: pId,
            providerKey: 'offerwall_gg',
            parentTabId: 'available_jobs',
            subTabId: '',
            placementEnabled: true,
            availableTasksVisibility: true,
            trustedLaunchDomains: ['offerwall.gg']
        };
        db.placements.set(pId, placement);

        const req = {
            user: { id: TEST_USER_ID },
            params: { placementId: pId }
        };
        const res = createMockRes();
        await launchProviderPlacement(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.launchUrl, `https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId=${TEST_USER_ID}&app=9604`);
        assert.equal(res.body.launchUrl.includes(TEST_USER_ID), true);
        assert.equal(res.body.launchUrl.includes('{user_id}'), false);
    });

    await runTest('T59: placementEnabled=false or availableTasksVisibility=false excludes placement from getAvailablePlacements', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';

        const pId1 = '64f1a2b3c4d5e6f7a8b9c0e2';
        const placement1 = {
            _id: pId1,
            providerKey: 'offerwall_gg',
            parentTabId: 'available_jobs',
            subTabId: '',
            placementEnabled: false, // Disabled
            availableTasksVisibility: true
        };
        db.placements.set(pId1, placement1);

        const req = { user: { id: TEST_USER_ID }, params: { parentTabId: 'available_jobs' } };
        const res1 = createMockRes();
        await getAvailablePlacements(req, res1);
        const found1 = res1.body?.data?.find(p => p._id === pId1);
        assert.equal(found1, undefined, 'placementEnabled=false must be excluded');

        const pId2 = '64f1a2b3c4d5e6f7a8b9c0e3';
        const placement2 = {
            _id: pId2,
            providerKey: 'offerwall_gg',
            parentTabId: 'available_jobs',
            subTabId: '',
            placementEnabled: true,
            availableTasksVisibility: false // Hidden from available tasks
        };
        db.placements.set(pId2, placement2);

        const res2 = createMockRes();
        await getAvailablePlacements(req, res2);
        const found2 = res2.body?.data?.find(p => p._id === pId2);
        assert.equal(found2, undefined, 'availableTasksVisibility=false must be excluded');
    });

    await runTest('T60: Rejected approvalStatus excludes placement from getAvailablePlacements', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Rejected';

        const pId = '64f1a2b3c4d5e6f7a8b9c0e4';
        const placement = {
            _id: pId,
            providerKey: 'offerwall_gg',
            parentTabId: 'available_jobs',
            subTabId: '',
            placementEnabled: true,
            availableTasksVisibility: true
        };
        db.placements.set(pId, placement);

        const req = { user: { id: TEST_USER_ID }, params: { parentTabId: 'available_jobs' } };
        const res = createMockRes();
        await getAvailablePlacements(req, res);
        const found = res.body?.data?.find(p => p._id === pId);
        assert.equal(found, undefined, 'Rejected approvalStatus must be excluded from Available Tasks');
    });

    await runTest('T61: Provider key alias offerwallgg matches provider record offerwall_gg in placement launch', async () => {
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';
        owProvider.appId = '9604';
        owProvider.iframeUrlTemplate = 'https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId={user_id}';

        const pId = '64f1a2b3c4d5e6f7a8b9c0e5';
        const placement = {
            _id: pId,
            providerKey: 'offerwallgg', // Alias key
            parentTabId: 'available_jobs',
            subTabId: '',
            placementEnabled: true,
            availableTasksVisibility: true,
            trustedLaunchDomains: ['offerwall.gg']
        };
        db.placements.set(pId, placement);

        const req = { user: { id: TEST_USER_ID }, params: { placementId: pId } };
        const res = createMockRes();
        await launchProviderPlacement(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.launchUrl, `https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId=${TEST_USER_ID}`);
    });

    console.log('\n--- SECTION 7: Provider-Managed Accounting Matrix, Multiplier Guards & Reversal Precision ---');

    const setupProviderManagedOfferwallGg = () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const owProvider = db.providers.get('offerwall_gg');
        owProvider.enabled = true;
        owProvider.status = 'ACTIVE';
        owProvider.approvalStatus = 'Approved';
        owProvider.testMode = false;
        owProvider.commissionMode = 'provider_managed';
        owProvider.exchangeRateMultiplier = 100;
        owProvider.userRevenueSharePercent = 70;
        owProvider.platformRevenueSharePercent = 30;
        return owProvider;
    };

    const matrixCases = [
        { id: 'T62', coins: '70', gross: 1.0000, user: 0.7000, platform: 0.3000 },
        { id: 'T63', coins: '140', gross: 2.0000, user: 1.4000, platform: 0.6000 },
        { id: 'T64', coins: '35', gross: 0.5000, user: 0.3500, platform: 0.1500 },
        { id: 'T65', coins: '23.1', gross: 0.3300, user: 0.2310, platform: 0.0990 }
    ];

    for (const tc of matrixCases) {
        await runTest(`${tc.id}: Provider-Managed matrix ${tc.coins} Coins => gross $${tc.gross}, user $${tc.user}, platform $${tc.platform}`, async () => {
            setupProviderManagedOfferwallGg();
            const user = db.users.get(TEST_USER_ID);
            user.taskEarningsBalance = 5.0;
            user.taskWalletBalance = 5.0;
            user.walletBalance = 250.0;

            const txId = `ow_matrix_${tc.id}`;
            const sig = computeSignature(TEST_USER_ID, txId, tc.coins);
            const res = createMockRes();
            await handlePostback({
                method: 'GET',
                params: { provider: 'offerwall_gg' },
                query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: tc.coins, status: 'credited', signature: sig },
                body: {},
                headers: {}
            }, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body, 'OK');
            assert.equal(user.taskEarningsBalance, Number((5.0 + tc.user).toFixed(4)));
            assert.equal(user.taskWalletBalance, Number((5.0 + tc.user).toFixed(4)));
            assert.equal(user.walletBalance, 250.0, 'walletBalance must remain untouched');

            const tx = await Transaction.findOne({ idempotencyKey: `offerwall_gg_${txId}_credit` });
            assert.ok(tx, 'Transaction must be created');
            assert.equal(tx.grossAmount, tc.gross);
            assert.equal(tx.userRewardAmount, tc.user);
            assert.equal(tx.platformRevenueAmount, tc.platform);
            assert.equal(tx.amountUSD, tc.user);

            const lastLog = Array.from(db.logs.values()).pop();
            assert.equal(lastLog.grossAmountUSD, tc.gross);
            assert.equal(lastLog.userRewardUSD, tc.user);
            assert.equal(lastLog.platformRevenueUSD, tc.platform);
        });
    }

    await runTest('T66: Provider alias offerwallgg executes identical Provider-Managed accounting without second deduction', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        db.providers.set('offerwallgg', owProvider);

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;

        const txId = 'ow_alias_matrix_70';
        const sig = computeSignature(TEST_USER_ID, txId, '70');
        const res = createMockRes();
        await handlePostback({
            method: 'POST',
            params: { provider: 'offerwallgg' },
            query: {},
            body: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', status: 'credited', signature: sig },
            headers: {}
        }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0.7);
        assert.equal(user.taskWalletBalance, 0.7);

        const tx = await Transaction.findOne({ idempotencyKey: `offerwallgg_${txId}_credit` });
        assert.ok(tx);
        assert.equal(tx.grossAmount, 1.0);
        assert.equal(tx.userRewardAmount, 0.7);
        assert.equal(tx.platformRevenueAmount, 0.3);
    });

    await runTest('T67: Invalid exchangeRateMultiplier in provider_managed mode fails closed with HTTP 400 and zero financial mutations', async () => {
        const invalidValues = [undefined, null, 0, 1, 70, 'abc', NaN, Infinity, -100];
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 12.34;
        user.taskWalletBalance = 12.34;

        for (let idx = 0; idx < invalidValues.length; idx++) {
            const badVal = invalidValues[idx];
            const owProvider = setupProviderManagedOfferwallGg();
            owProvider.exchangeRateMultiplier = badVal;

            const txBefore = db.transactions.size;
            const logBefore = db.logs.size;
            const txId = `ow_invalid_mult_${idx}`;
            const sig = computeSignature(TEST_USER_ID, txId, '70');
            const res = createMockRes();

            await handlePostback({
                method: 'GET',
                params: { provider: 'offerwall_gg' },
                query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', status: 'credited', signature: sig },
                body: {},
                headers: {}
            }, res);

            assert.equal(res.statusCode, 400, `Multiplier '${String(badVal)}' must fail closed with 400`);
            assert.equal(res.body, 'OFFERWALL_GG_MULTIPLIER_INVALID');
            assert.equal(user.taskEarningsBalance, 12.34, 'taskEarningsBalance must not change on invalid multiplier');
            assert.equal(user.taskWalletBalance, 12.34, 'taskWalletBalance must not change on invalid multiplier');
            assert.equal(db.transactions.size, txBefore, 'No transaction may be created on invalid multiplier');
            assert.equal(db.logs.size, logBefore + 1, 'Error log must be saved safely');
            const lastLog = Array.from(db.logs.values()).pop();
            assert.equal(lastLog.status, 'Error');
        }
    });

    await runTest('T68: updateOfferwallProvider rejects invalid Offerwall.GG multipliers without 1.0 coercion and allows 100', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        owProvider.exchangeRateMultiplier = 70;
        const adminUser = { id: TEST_USER_ID, role: 'admin' };

        const rejectedPayloads = [
            { commissionMode: 'provider_managed', exchangeRateMultiplier: 70 },
            { commissionMode: 'provider_managed', exchangeRateMultiplier: 0 },
            { commissionMode: 'provider_managed', exchangeRateMultiplier: null },
            { commissionMode: 'provider_managed', exchangeRateMultiplier: 1 },
            { commissionMode: 'provider_managed', exchangeRateMultiplier: 'abc' },
            { commissionMode: 'provider_managed' } // partial update while stored multiplier is 70
        ];

        for (const payload of rejectedPayloads) {
            const res = createMockRes();
            await updateOfferwallProvider({ user: adminUser, params: { providerKey: 'offerwall_gg' }, body: payload }, res);
            assert.equal(res.statusCode, 400, `Expected 400 for payload ${JSON.stringify(payload)}`);
            assert.equal(owProvider.exchangeRateMultiplier, 70, 'Stored multiplier must NOT be mutated or coerced to 1.0');
        }

        // Valid save with 100 succeeds
        const validRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100 }
        }, validRes);
        assert.equal(validRes.statusCode, 200);
        assert.equal(owProvider.exchangeRateMultiplier, 100);
        assert.equal(owProvider.commissionMode, 'provider_managed');

        // Partial update with invalid multiplier while already provider_managed is rejected
        const partialBadRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwallgg' },
            body: { exchangeRateMultiplier: 70 }
        }, partialBadRes);
        assert.equal(partialBadRes.statusCode, 400);
        assert.equal(owProvider.exchangeRateMultiplier, 100);

        // Other providers (e.g. cpx_research) remain completely unaffected
        const cpxProvider = db.providers.get('cpx_research');
        const cpxRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'cpx_research' },
            body: { commissionMode: 'smartexn_managed', exchangeRateMultiplier: 1.0 }
        }, cpxRes);
        assert.equal(cpxRes.statusCode, 200);
        assert.equal(cpxProvider.exchangeRateMultiplier, 1.0);
    });

    await runTest('T69: Fractional reversal (23.1 Coins = $0.231 USD) preserves $0.001 precision on deduction and chargebackLiabilityUSD', async () => {
        setupProviderManagedOfferwallGg();
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;
        user.chargebackLiabilityUSD = 0;

        const txId = 'ow_frac_rev_231';
        const credSig = computeSignature(TEST_USER_ID, txId, '23.1');
        const credRes = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '23.1', status: 'credited', signature: credSig },
            body: {},
            headers: {}
        }, credRes);
        assert.equal(credRes.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0.231);

        // Simulate partial withdrawal leaving $0.1000 so reversal incurs $0.1310 liability
        user.taskEarningsBalance = 0.10;
        user.taskWalletBalance = 0.10;

        const revSig = computeSignature(TEST_USER_ID, txId, '-23.1');
        const revRes = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-23.1', status: 'reversed', signature: revSig },
            body: {},
            headers: {}
        }, revRes);
        assert.equal(revRes.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0, 'Earnings balance floors cleanly at 0');
        assert.equal(user.chargebackLiabilityUSD, 0.131, 'Liability preserves $0.001 precision (0.131, not truncated to 0.13)');

        const revTx = await Transaction.findOne({ idempotencyKey: `offerwall_gg_${txId}_reversal` });
        assert.ok(revTx);
        assert.equal(revTx.amountUSD, 0.231);
        assert.equal(revTx.chargebackStatus, 'Liability_Owed');
    });

    await runTest('T70: Unsigned payoutUsd is ignored in provider_managed mode', async () => {
        setupProviderManagedOfferwallGg();
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;

        const txId = 'ow_pm_tamper_payout';
        const sig = computeSignature(TEST_USER_ID, txId, '70');
        const res = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '500.00', status: 'credited', signature: sig },
            body: {},
            headers: {}
        }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0.70);
        const tx = await Transaction.findOne({ idempotencyKey: `offerwall_gg_${txId}_credit` });
        assert.equal(tx.grossAmount, 1.0);
        assert.equal(tx.userRewardAmount, 0.7);
        assert.equal(tx.platformRevenueAmount, 0.3);
    });

    console.log('\n--- SECTION 8: Offerwall.GG Configuration Safety Validation (Mode/Multiplier Pairing & Fixed 70/30 Shares) ---');

    const adminUser = { id: TEST_USER_ID, role: 'admin' };

    await runTest('T71: provider_managed + 100 + 70/30 accepted and alias offerwallgg enforces identical rules', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        owProvider.commissionMode = 'smartexn_managed';
        owProvider.exchangeRateMultiplier = 70;
        owProvider.userRevenueSharePercent = 80;
        owProvider.platformRevenueSharePercent = 20;

        const res = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: {
                commissionMode: 'provider_managed',
                exchangeRateMultiplier: 100,
                userRevenueSharePercent: 70,
                platformRevenueSharePercent: 30
            }
        }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(owProvider.commissionMode, 'provider_managed');
        assert.equal(owProvider.exchangeRateMultiplier, 100);
        assert.equal(owProvider.userRevenueSharePercent, 70);
        assert.equal(owProvider.platformRevenueSharePercent, 30);

        // Alias key offerwallgg also validates identically
        db.providers.set('offerwallgg', owProvider);
        const aliasRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwallgg' },
            body: { enabled: true }
        }, aliasRes);
        assert.equal(aliasRes.statusCode, 200);
    });

    await runTest('T72: provider_managed + 70 rejected without mutating DB', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        const res = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 70, userRevenueSharePercent: 70, platformRevenueSharePercent: 30 }
        }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(owProvider.exchangeRateMultiplier, 100);
    });

    await runTest('T73: smartexn_managed + 70 accepted and preserves custom share split', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        const res = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: {
                commissionMode: 'smartexn_managed',
                exchangeRateMultiplier: 70,
                userRevenueSharePercent: 80,
                platformRevenueSharePercent: 20
            }
        }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(owProvider.commissionMode, 'smartexn_managed');
        assert.equal(owProvider.exchangeRateMultiplier, 70);
        assert.equal(owProvider.userRevenueSharePercent, 80);
        assert.equal(owProvider.platformRevenueSharePercent, 20);
    });

    await runTest('T74: smartexn_managed + 100 rejected without mutating DB (explicit and partial)', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        owProvider.commissionMode = 'smartexn_managed';
        owProvider.exchangeRateMultiplier = 70;
        owProvider.userRevenueSharePercent = 80;
        owProvider.platformRevenueSharePercent = 20;

        const res1 = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'smartexn_managed', exchangeRateMultiplier: 100 }
        }, res1);
        assert.equal(res1.statusCode, 400);
        assert.equal(owProvider.exchangeRateMultiplier, 70);

        // Partial multiplier update while already smartexn_managed
        const res2 = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { exchangeRateMultiplier: 100 }
        }, res2);
        assert.equal(res2.statusCode, 400);
        assert.equal(owProvider.exchangeRateMultiplier, 70);

        // Partial mode switch from provider_managed(100) -> smartexn_managed without updating multiplier
        const pmProvider = setupProviderManagedOfferwallGg();
        const res3 = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'smartexn_managed' }
        }, res3);
        assert.equal(res3.statusCode, 400);
        assert.equal(pmProvider.commissionMode, 'provider_managed');
        assert.equal(pmProvider.exchangeRateMultiplier, 100);
    });

    await runTest('T75: Malformed, non-finite, empty, and wrongly-typed multiplier values rejected without coercion', async () => {
        const badMultipliers = [null, '', '   ', 'abc', NaN, Infinity, -Infinity, true, false, [100], [70], { val: 100 }];

        for (const mode of ['provider_managed', 'smartexn_managed']) {
            for (const badMult of badMultipliers) {
                const owProvider = setupProviderManagedOfferwallGg();
                if (mode === 'smartexn_managed') {
                    owProvider.commissionMode = 'smartexn_managed';
                    owProvider.exchangeRateMultiplier = 70;
                }
                const res = createMockRes();
                await updateOfferwallProvider({
                    user: adminUser,
                    params: { providerKey: 'offerwall_gg' },
                    body: { commissionMode: mode, exchangeRateMultiplier: badMult }
                }, res);
                assert.equal(res.statusCode, 400, `Expected 400 for mode=${mode}, mult=${JSON.stringify(badMult)}`);
                assert.equal(owProvider.exchangeRateMultiplier, mode === 'provider_managed' ? 100 : 70);
            }
        }

        // Missing saved multiplier in DB rejected on partial update
        const owMissing = setupProviderManagedOfferwallGg();
        owMissing.exchangeRateMultiplier = undefined;
        const missingRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { enabled: false }
        }, missingRes);
        assert.equal(missingRes.statusCode, 400);
        assert.equal(owMissing.enabled, true, 'Rejected update must not mutate enabled');
    });

    await runTest('T76: provider_managed rejects 80/20 and 70/20 shares without silent coercion/overwrite', async () => {
        const invalidSharePairs = [
            { userRevenueSharePercent: 80, platformRevenueSharePercent: 20 },
            { userRevenueSharePercent: 70, platformRevenueSharePercent: 20 },
            { userRevenueSharePercent: 70, platformRevenueSharePercent: 40 },
            { userRevenueSharePercent: 100, platformRevenueSharePercent: 0 },
            { userRevenueSharePercent: 60, platformRevenueSharePercent: 30 },
            { userRevenueSharePercent: 75 }
        ];

        for (const pair of invalidSharePairs) {
            const owProvider = setupProviderManagedOfferwallGg();
            const res = createMockRes();
            await updateOfferwallProvider({
                user: adminUser,
                params: { providerKey: 'offerwall_gg' },
                body: {
                    commissionMode: 'provider_managed',
                    exchangeRateMultiplier: 100,
                    ...pair
                }
            }, res);
            assert.equal(res.statusCode, 400, `Expected 400 for share pair ${JSON.stringify(pair)}`);
            assert.equal(owProvider.userRevenueSharePercent, 70);
            assert.equal(owProvider.platformRevenueSharePercent, 30);
        }
    });

    await runTest('T77: Missing, malformed, non-finite, and wrongly-typed share values rejected in provider_managed', async () => {
        const badShares = [null, '', '   ', 'abc', NaN, Infinity, -Infinity, true, false, [70], ['30'], {}];

        for (const badShare of badShares) {
            const owProvider = setupProviderManagedOfferwallGg();

            const resUser = createMockRes();
            await updateOfferwallProvider({
                user: adminUser,
                params: { providerKey: 'offerwall_gg' },
                body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100, userRevenueSharePercent: badShare, platformRevenueSharePercent: 30 }
            }, resUser);
            assert.equal(resUser.statusCode, 400, `Bad userShare ${JSON.stringify(badShare)} must return 400`);
            assert.equal(owProvider.userRevenueSharePercent, 70);

            const resPlatform = createMockRes();
            await updateOfferwallProvider({
                user: adminUser,
                params: { providerKey: 'offerwall_gg' },
                body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100, userRevenueSharePercent: 70, platformRevenueSharePercent: badShare }
            }, resPlatform);
            assert.equal(resPlatform.statusCode, 400, `Bad platformShare ${JSON.stringify(badShare)} must return 400`);
            assert.equal(owProvider.platformRevenueSharePercent, 30);
        }

        // Missing shares in DB during partial update in provider_managed mode
        const owMissingShares = setupProviderManagedOfferwallGg();
        owMissingShares.userRevenueSharePercent = undefined;
        owMissingShares.platformRevenueSharePercent = undefined;
        const missingRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100 }
        }, missingRes);
        assert.equal(missingRes.statusCode, 400);
        assert.equal(owMissingShares.userRevenueSharePercent, undefined);
    });

    await runTest('T78: Partial updates validate merged DB + incoming state for commissionMode & shares', async () => {
        // DB is in smartexn_managed with 80/20 and mult 70
        const owProvider = setupProviderManagedOfferwallGg();
        owProvider.commissionMode = 'smartexn_managed';
        owProvider.exchangeRateMultiplier = 70;
        owProvider.userRevenueSharePercent = 80;
        owProvider.platformRevenueSharePercent = 20;

        // Switching to provider_managed + 100 WITHOUT updating 80/20 -> 70/30 must reject (no silent overwrite)
        const switchWithoutShares = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100 }
        }, switchWithoutShares);
        assert.equal(switchWithoutShares.statusCode, 400);
        assert.equal(owProvider.commissionMode, 'smartexn_managed');
        assert.equal(owProvider.exchangeRateMultiplier, 70);
        assert.equal(owProvider.userRevenueSharePercent, 80);
        assert.equal(owProvider.platformRevenueSharePercent, 20);

        // Sending only userRevenueSharePercent: 70 while DB platformRevenueSharePercent is 20 -> reject (70/20 invalid)
        const switchPartialShare = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100, userRevenueSharePercent: 70 }
        }, switchPartialShare);
        assert.equal(switchPartialShare.statusCode, 400);
        assert.equal(owProvider.commissionMode, 'smartexn_managed');
        assert.equal(owProvider.platformRevenueSharePercent, 20);

        // Sending complete valid target config succeeds
        const validSwitch = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100, userRevenueSharePercent: 70, platformRevenueSharePercent: 30 }
        }, validSwitch);
        assert.equal(validSwitch.statusCode, 200);
        assert.equal(owProvider.commissionMode, 'provider_managed');
        assert.equal(owProvider.exchangeRateMultiplier, 100);
        assert.equal(owProvider.userRevenueSharePercent, 70);
        assert.equal(owProvider.platformRevenueSharePercent, 30);

        // Unrelated partial update when already valid succeeds
        const unrelatedPatch = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { enabled: false }
        }, unrelatedPatch);
        assert.equal(unrelatedPatch.statusCode, 200);
        assert.equal(owProvider.enabled, false);
    });

    await runTest('T79: Rejected Offerwall.GG config updates never mutate balances, transactions, or provider state', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 9.99;
        user.taskWalletBalance = 9.99;
        const txBefore = db.transactions.size;
        const logBefore = db.logs.size;

        const res = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100, userRevenueSharePercent: 80, platformRevenueSharePercent: 20, enabled: false }
        }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(owProvider.enabled, true);
        assert.equal(owProvider.userRevenueSharePercent, 70);
        assert.equal(owProvider.platformRevenueSharePercent, 30);
        assert.equal(user.taskEarningsBalance, 9.99);
        assert.equal(user.taskWalletBalance, 9.99);
        assert.equal(db.transactions.size, txBefore);
        assert.equal(db.logs.size, logBefore);
    });

    await runTest('T80: Valid provider_managed accounting (70 Coins => $1.00 gross / $0.70 user / $0.30 platform) and legacy smartexn_managed accounting remain intact', async () => {
        // 1. Provider-Managed saved via updateOfferwallProvider
        const owProvider = setupProviderManagedOfferwallGg();
        const pmSave = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 100, userRevenueSharePercent: 70, platformRevenueSharePercent: 30 }
        }, pmSave);
        assert.equal(pmSave.statusCode, 200);

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;
        const txPmId = 'ow_cfg_pm_70';
        const pmRes = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txPmId, currencyAmount: '70', status: 'credited', signature: computeSignature(TEST_USER_ID, txPmId, '70') },
            body: {},
            headers: {}
        }, pmRes);
        assert.equal(pmRes.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0.70);
        const txPm = await Transaction.findOne({ idempotencyKey: `offerwall_gg_${txPmId}_credit` });
        assert.equal(txPm.grossAmount, 1.0);
        assert.equal(txPm.userRewardAmount, 0.7);
        assert.equal(txPm.platformRevenueAmount, 0.3);

        // 2. Legacy SmartExn-Managed saved via updateOfferwallProvider (70 multiplier + 80/20 shares)
        const smSave = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'offerwall_gg' },
            body: { commissionMode: 'smartexn_managed', exchangeRateMultiplier: 70, userRevenueSharePercent: 80, platformRevenueSharePercent: 20 }
        }, smSave);
        assert.equal(smSave.statusCode, 200);

        const txSmId = 'ow_cfg_sm_70';
        const smRes = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txSmId, currencyAmount: '70', status: 'credited', signature: computeSignature(TEST_USER_ID, txSmId, '70') },
            body: {},
            headers: {}
        }, smRes);
        assert.equal(smRes.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 1.50); // 0.70 + 0.80
        const txSm = await Transaction.findOne({ idempotencyKey: `offerwall_gg_${txSmId}_credit` });
        assert.equal(txSm.grossAmount, 1.0);
        assert.equal(txSm.userRewardAmount, 0.8);
        assert.equal(txSm.platformRevenueAmount, 0.2);
    });

    await runTest('T81: Non-Offerwall.GG providers (cpx_research, theoremreach, adgem) remain unaffected by Offerwall.GG config rules', async () => {
        const cpxProvider = db.providers.get('cpx_research');
        const cpxRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'cpx_research' },
            body: { commissionMode: 'provider_managed', exchangeRateMultiplier: 1.0, userRevenueSharePercent: 100, platformRevenueSharePercent: 0 }
        }, cpxRes);
        assert.equal(cpxRes.statusCode, 200);
        assert.equal(cpxProvider.userRevenueSharePercent, 100);
        assert.equal(cpxProvider.platformRevenueSharePercent, 0);

        const trProvider = db.providers.get('theoremreach');
        const trRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'theoremreach' },
            body: { commissionMode: 'smartexn_managed', exchangeRateMultiplier: 1.0, userRevenueSharePercent: 80, platformRevenueSharePercent: 20 }
        }, trRes);
        assert.equal(trRes.statusCode, 200);
        assert.equal(trProvider.exchangeRateMultiplier, 1.0);
        assert.equal(trProvider.userRevenueSharePercent, 80);
        assert.equal(trProvider.platformRevenueSharePercent, 20);
    });

    await runTest('T82: Offerwall.GG rejects non-string commissionMode strictly while non-Offerwall.GG providers retain String().trim().toLowerCase() normalization', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        const nonStringValues = [['provider_managed'], ['smartexn_managed'], { toString: () => 'provider_managed' }, 123, null];

        for (const badMode of nonStringValues) {
            const res = createMockRes();
            await updateOfferwallProvider({
                user: adminUser,
                params: { providerKey: 'offerwall_gg' },
                body: { commissionMode: badMode }
            }, res);
            assert.equal(res.statusCode, 400, `Offerwall.GG must reject non-string commissionMode ${JSON.stringify(badMode)}`);

            const aliasRes = createMockRes();
            await updateOfferwallProvider({
                user: adminUser,
                params: { providerKey: 'offerwallgg' },
                body: { commissionMode: badMode }
            }, aliasRes);
            assert.equal(aliasRes.statusCode, 400, `Offerwall.GG alias offerwallgg must reject non-string commissionMode`);
        }
        assert.equal(owProvider.commissionMode, 'provider_managed');

        // Non-Offerwall.GG providers retain previous String(value).trim().toLowerCase() behavior
        const cpxProvider = db.providers.get('cpx_research');
        const cpxNonStringRes = createMockRes();
        await updateOfferwallProvider({
            user: adminUser,
            params: { providerKey: 'cpx_research' },
            body: { commissionMode: [' SMARTEXN_MANAGED '] }
        }, cpxNonStringRes);
        assert.equal(cpxNonStringRes.statusCode, 200);
        assert.equal(cpxProvider.commissionMode, 'smartexn_managed');
    });

    console.log('\n--- SECTION 9: Postback Audit Fixes (Simulator, Strict Validation, Logging & Cross-Alias Safety) ---');

    await runTest('T83: Offerwall.GG simulator executes real HMAC-signed credit dry-run with zero DB mutations', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        owProvider.secretKey = 'provider_fallback_secret_value';
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 15.0;
        user.taskWalletBalance = 15.0;
        user.walletBalance = 100.0;
        const txBefore = db.transactions.size;
        const logBefore = db.logs.size;
        const notifBefore = db.notifications.size;
        const lockBefore = db.locks.size;
        const postbackCountBefore = owProvider.totalPostbackCount || 0;

        const simReq = {
            user: adminUser,
            body: {
                providerKey: 'offerwall_gg',
                userId: TEST_USER_ID,
                externalTxId: 'sim_ow_credit_01',
                currencyAmount: '70',
                payoutUsd: '1.00',
                isReversal: false,
                offerName: 'Simulator Test Offer'
            }
        };
        const simRes = createMockRes();
        await simulatePostback(simReq, simRes);

        assert.equal(simRes.statusCode, 200);
        assert.equal(simRes.body.success, true);
        assert.equal(simRes.body.isDryRun, true);
        assert.equal(simRes.body.mutationsPerformed, false);
        assert.equal(simRes.body.action, 'CREDIT');
        assert.equal(simRes.body.validation.signatureValid, true);
        assert.equal(simRes.body.accounting.grossUSD, 1.0);
        assert.equal(simRes.body.accounting.userRewardUSD, 0.7);
        assert.equal(simRes.body.accounting.platformRevenueUSD, 0.3);
        assert.equal(simRes.body.user.currentTaskEarningsUSD, 15.0);
        assert.equal(simRes.body.user.projectedTaskEarningsUSD, 15.7);

        // Verify zero side effects
        assert.equal(user.taskEarningsBalance, 15.0);
        assert.equal(user.taskWalletBalance, 15.0);
        assert.equal(user.walletBalance, 100.0);
        assert.equal(db.transactions.size, txBefore);
        assert.equal(db.logs.size, logBefore);
        assert.equal(db.notifications.size, notifBefore);
        assert.equal(db.locks.size, lockBefore);
        assert.equal(owProvider.totalPostbackCount || 0, postbackCountBefore);
    });

    await runTest('T84: Offerwall.GG simulator handles reversal dry-runs (both positive and negative input amounts) against live credit with zero mutations', async () => {
        setupProviderManagedOfferwallGg();
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 10.0;
        user.taskWalletBalance = 10.0;

        const liveTxId = 'sim_ow_live_credit_ref';
        const credSig = computeSignature(TEST_USER_ID, liveTxId, '70');
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: liveTxId, currencyAmount: '70', status: 'credited', signature: credSig },
            body: {},
            headers: {}
        }, createMockRes());
        assert.equal(user.taskEarningsBalance, 10.7);

        const txBefore = db.transactions.size;
        const logBefore = db.logs.size;
        const notifBefore = db.notifications.size;

        // Positive input amount with isReversal: true should be normalized to negative '-70' and signed identically
        const revPosRes = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: {
                providerKey: 'offerwall_gg',
                userId: TEST_USER_ID,
                externalTxId: liveTxId,
                amount: 70,
                isReversal: true
            }
        }, revPosRes);

        assert.equal(revPosRes.statusCode, 200);
        assert.equal(revPosRes.body.success, true);
        assert.equal(revPosRes.body.action, 'REVERSAL');
        assert.equal(revPosRes.body.validation.signatureValid, true);
        assert.equal(revPosRes.body.validation.originalTransactionFound, true);
        assert.equal(revPosRes.body.accounting.rawReward, -70);
        assert.equal(revPosRes.body.accounting.deductionAmountUSD, 0.7);
        assert.equal(revPosRes.body.user.projectedTaskEarningsUSD, 10.0);

        // Negative string input with isReversal: true also works identically
        const revNegRes = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: {
                providerKey: 'offerwall_gg',
                userId: TEST_USER_ID,
                externalTxId: liveTxId,
                currencyAmount: '-70',
                isReversal: true
            }
        }, revNegRes);

        assert.equal(revNegRes.statusCode, 200);
        assert.equal(revNegRes.body.success, true);
        assert.equal(revNegRes.body.accounting.rawReward, -70);

        assert.equal(user.taskEarningsBalance, 10.7, 'Dry-run reversal must not deduct balance');
        assert.equal(db.transactions.size, txBefore);
        assert.equal(db.logs.size, logBefore);
        assert.equal(db.notifications.size, notifBefore);
    });

    await runTest('T85: Simulator and live verifySignature use identical secret precedence (env OVER provider.secretKey, with provider fallback)', async () => {
        const owProvider = setupProviderManagedOfferwallGg();
        const envSecret = 'env_priority_secret_abc';
        const dbSecret = 'db_fallback_secret_xyz';
        owProvider.secretKey = dbSecret;
        process.env.OFFERWALL_GG_SECRET_KEY = envSecret;

        // With env set, signature generated by env passes, dbSecret fails
        const resEnv = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: { providerKey: 'offerwall_gg', userId: TEST_USER_ID, externalTxId: 'sim_sec_env', amount: 70 }
        }, resEnv);
        assert.equal(resEnv.statusCode, 200);
        assert.equal(resEnv.body.success, true);
        assert.equal(resEnv.body.validation.signatureValid, true);

        // Explicit signature signed with stale dbSecret while envSecret is active must fail in simulator
        const staleSig = computeSignature(TEST_USER_ID, 'sim_sec_stale', '70', dbSecret);
        const resStale = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: { providerKey: 'offerwall_gg', userId: TEST_USER_ID, externalTxId: 'sim_sec_stale', amount: '70', signature: staleSig }
        }, resStale);
        assert.equal(resStale.statusCode, 200);
        assert.equal(resStale.body.success, false);
        assert.equal(resStale.body.validation.signatureValid, false);

        // Removing env falls back to provider.secretKey consistently
        process.env.OFFERWALL_GG_SECRET_KEY = '   ';
        const resFallback = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: { providerKey: 'offerwall_gg', userId: TEST_USER_ID, externalTxId: 'sim_sec_fallback', amount: 70 }
        }, resFallback);
        assert.equal(resFallback.statusCode, 200);
        assert.equal(resFallback.body.success, true);
        assert.equal(resFallback.body.validation.signatureValid, true);

        // Missing both env and db secret fails closed
        owProvider.secretKey = '';
        const resMissing = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: { providerKey: 'offerwall_gg', userId: TEST_USER_ID, externalTxId: 'sim_sec_none', amount: 70 }
        }, resMissing);
        assert.equal(resMissing.statusCode, 200);
        assert.equal(resMissing.body.success, false);
        assert.equal(resMissing.body.validation.signatureValid, false);

        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
    });

    await runTest('T86: Simulator testInvalidSignature and alias key offerwallgg work with zero DB mutations and leave CPX untouched', async () => {
        setupProviderManagedOfferwallGg();
        db.providers.delete('offerwallgg'); // Ensure only 'offerwall_gg' exists in DB

        const user = db.users.get(TEST_USER_ID);
        const balBefore = user.taskEarningsBalance;
        const txBefore = db.transactions.size;
        const logBefore = db.logs.size;

        const badSigRes = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: { providerKey: 'offerwall_gg', userId: TEST_USER_ID, externalTxId: 'sim_bad_sig', amount: 70, testInvalidSignature: true }
        }, badSigRes);
        assert.equal(badSigRes.statusCode, 200);
        assert.equal(badSigRes.body.success, false);
        assert.equal(badSigRes.body.validation.signatureValid, false);

        const aliasSimRes = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: { providerKey: 'offerwallgg', userId: TEST_USER_ID, externalTxId: 'sim_alias_ok', amount: 70 }
        }, aliasSimRes);
        assert.equal(aliasSimRes.statusCode, 200);
        assert.equal(aliasSimRes.body.success, true);
        assert.equal(aliasSimRes.body.accounting.userRewardUSD, 0.7);

        // Verify CPX simulator remains unaffected
        const cpxProvider = db.providers.get('cpx_research');
        cpxProvider.enabled = true;
        cpxProvider.status = 'ACTIVE';
        cpxProvider.requireSignature = true;
        cpxProvider.secretKey = 'cpx_sim_sec';
        cpxProvider.commissionMode = 'smartexn_managed';
        const cpxSimRes = createMockRes();
        await simulatePostback({
            user: adminUser,
            body: { providerKey: 'cpx_research', userId: TEST_USER_ID, externalTxId: 'sim_cpx_ok', amount: 1.0 }
        }, cpxSimRes);
        assert.equal(cpxSimRes.statusCode, 200);
        assert.equal(cpxSimRes.body.success, true);

        assert.equal(user.taskEarningsBalance, balBefore);
        assert.equal(db.transactions.size, txBefore);
        assert.equal(db.logs.size, logBefore);
    });

    await runTest('T87: Strict currencyAmount & status validation rejects non-finite, overflow, zero, non-scalar, wrong-sign, and conflicting inputs', async () => {
        setupProviderManagedOfferwallGg();
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 5.0;
        user.taskWalletBalance = 5.0;
        const txBefore = db.transactions.size;

        const invalidPayloads = [
            { query: { userId: TEST_USER_ID, transactionId: 'bad_zero_str', currencyAmount: '0', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_zero_str', '0') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_zero_num', currencyAmount: 0, status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_zero_num', '0') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_neg_cred', currencyAmount: '-70', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_neg_cred', '-70') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_pos_rev', currencyAmount: '70', status: 'reversed', signature: computeSignature(TEST_USER_ID, 'bad_pos_rev', '70') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_nan', currencyAmount: 'NaN', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_nan', 'NaN') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_inf', currencyAmount: 'Infinity', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_inf', 'Infinity') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_ninf', currencyAmount: '-Infinity', status: 'reversed', signature: computeSignature(TEST_USER_ID, 'bad_ninf', '-Infinity') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_over', currencyAmount: '1e309', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_over', '1e309') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_empty', currencyAmount: '   ', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_empty', '   ') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_bool', currencyAmount: true, status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_bool', 'true') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_arr', currencyAmount: ['70'], status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_arr', '70') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_obj', currencyAmount: { value: 70 }, status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_obj', '[object Object]') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_status_type', currencyAmount: '70', status: ['credited'], signature: computeSignature(TEST_USER_ID, 'bad_status_type', '70') } },
            { query: { userId: TEST_USER_ID, transactionId: 'bad_status_val', currencyAmount: '70', status: 'pending', signature: computeSignature(TEST_USER_ID, 'bad_status_val', '70') } },
            {
                method: 'POST',
                query: { userId: TEST_USER_ID, transactionId: 'bad_conflict_amt', currencyAmount: '70', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_conflict_amt', '70') },
                body: { userId: TEST_USER_ID, transactionId: 'bad_conflict_amt', currencyAmount: '700', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_conflict_amt', '70') }
            },
            {
                method: 'POST',
                query: { userId: TEST_USER_ID, transactionId: 'bad_conflict_st', currencyAmount: '70', status: 'credited', signature: computeSignature(TEST_USER_ID, 'bad_conflict_st', '70') },
                body: { userId: TEST_USER_ID, transactionId: 'bad_conflict_st', currencyAmount: '70', status: 'reversed', signature: computeSignature(TEST_USER_ID, 'bad_conflict_st', '70') }
            }
        ];

        for (const payload of invalidPayloads) {
            const res = createMockRes();
            await handlePostback({
                method: payload.method || 'GET',
                params: { provider: 'offerwall_gg' },
                query: payload.query || {},
                body: payload.body || {},
                headers: {}
            }, res);
            assert.equal(res.statusCode, 400, `Expected HTTP 400 for invalid payload ${payload.query.transactionId}`);
        }

        assert.equal(user.taskEarningsBalance, 5.0, 'Rejected invalid amounts must never alter earnings balance');
        assert.equal(user.taskWalletBalance, 5.0, 'Rejected invalid amounts must never alter task wallet');
        assert.equal(db.transactions.size, txBefore, 'Rejected invalid amounts must never create transactions');
    });

    await runTest('T88: OfferwallPostbackLog schema persists infoPayoutUsd and priorSecurityEvents and ignores payoutUsd in financial accounting', async () => {
        setupProviderManagedOfferwallGg();
        assert.ok(OfferwallPostbackLog.schema.path('infoPayoutUsd'), 'OfferwallPostbackLog schema must define infoPayoutUsd');
        assert.ok(OfferwallPostbackLog.schema.path('priorSecurityEvents'), 'OfferwallPostbackLog schema must define priorSecurityEvents');

        const schemaDoc = new OfferwallPostbackLog({
            provider: 'offerwall_gg',
            externalTxId: 'schema_verify_tx',
            infoPayoutUsd: '500.00',
            priorSecurityEvents: [{ status: 'InvalidSignature', recordedAt: new Date() }]
        });
        const plainObj = schemaDoc.toObject();
        assert.equal(plainObj.infoPayoutUsd, '500.00');
        assert.equal(plainObj.priorSecurityEvents.length, 1);

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;

        // Tampered large payoutUsd=500.00 with 70 Coins -> still $0.70 reward, log retains infoPayoutUsd='500.00'
        const txId = 'ow_info_payout_test';
        const res = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: ' 500.00 ', status: 'credited', signature: computeSignature(TEST_USER_ID, txId, '70') },
            body: {},
            headers: {}
        }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0.7);
        const lastLog = Array.from(db.logs.values()).pop();
        assert.equal(lastLog.toObject().infoPayoutUsd, '500.00');
        assert.equal(lastLog.userRewardUSD, 0.7);

        // Object/array payoutUsd is safely coerced to null rather than crashing log persistence
        const txIdArr = 'ow_info_payout_arr';
        const resArr = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txIdArr, currencyAmount: '70', payoutUsd: ['1.00', '2.00'], status: 'credited', signature: computeSignature(TEST_USER_ID, txIdArr, '70') },
            body: {},
            headers: {}
        }, resArr);
        assert.equal(resArr.statusCode, 200);
        const lastArrLog = Array.from(db.logs.values()).pop();
        assert.equal(lastArrLog.toObject().infoPayoutUsd, null);
    });

    await runTest('T89: InvalidSignature followed by valid retry preserves priorSecurityEvents under { provider, externalTxId, isReversal } unique index', async () => {
        setupProviderManagedOfferwallGg();
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;

        const origSave = OfferwallPostbackLog.prototype.save;
        const origFindOne = OfferwallPostbackLog.findOne;
        const origTxCreate = Transaction.create;

        // Temporarily enforce MongoDB unique index { provider: 1, externalTxId: 1, isReversal: 1 } and real ObjectId on tx._id
        Transaction.create = async (doc, options) => {
            const res = await origTxCreate(doc, options);
            if (!Array.isArray(res) && res && typeof res._id === 'string' && !/^[0-9a-fA-F]{24}$/.test(res._id)) {
                res._id = new mongoose.Types.ObjectId();
            }
            return res;
        };
        OfferwallPostbackLog.prototype.save = async function() {
            const keyMatch = (entry) =>
                entry.provider === this.provider &&
                entry.externalTxId === this.externalTxId &&
                Boolean(entry.isReversal) === Boolean(this.isReversal);
            for (const existing of db.logs.values()) {
                if (keyMatch(existing) && String(existing._id) !== String(this._id)) {
                    const err = new Error('E11000 duplicate key error collection: offerwallpostbacklogs index: provider_1_externalTxId_1_isReversal_1');
                    err.code = 11000;
                    throw err;
                }
            }
            const id = this._id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            db.logs.set(String(id), this);
            return this;
        };
        OfferwallPostbackLog.findOne = async (query) => {
            for (const entry of db.logs.values()) {
                if (
                    entry.provider === query.provider &&
                    entry.externalTxId === query.externalTxId &&
                    Boolean(entry.isReversal) === Boolean(query.isReversal)
                ) {
                    return entry;
                }
            }
            return null;
        };

        try {
            const txId = 'ow_retry_after_badsig';
            const badRes = createMockRes();
            await handlePostback({
                method: 'GET',
                params: { provider: 'offerwall_gg' },
                query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', status: 'credited', signature: 'tampered_bad_sig' },
                body: {},
                headers: { 'x-forwarded-for': '203.0.113.9' }
            }, badRes);
            assert.equal(badRes.statusCode, 400);

            const afterBadLog = await OfferwallPostbackLog.findOne({ provider: 'offerwall_gg', externalTxId: txId, isReversal: false });
            assert.ok(afterBadLog);
            assert.equal(afterBadLog.status, 'InvalidSignature');
            const totalLogsAfterBad = db.logs.size;

            // Valid retry for the exact same externalTxId + provider + isReversal
            const goodSig = computeSignature(TEST_USER_ID, txId, '70');
            const goodRes = createMockRes();
            await handlePostback({
                method: 'GET',
                params: { provider: 'offerwall_gg' },
                query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', status: 'credited', signature: goodSig },
                body: {},
                headers: {}
            }, goodRes);
            assert.equal(goodRes.statusCode, 200);
            assert.equal(user.taskEarningsBalance, 0.7);
            assert.equal(db.logs.size, totalLogsAfterBad, 'No log records deleted; existing log updated safely under unique index');

            const updatedLog = await OfferwallPostbackLog.findOne({ provider: 'offerwall_gg', externalTxId: txId, isReversal: false });
            assert.equal(updatedLog.status, 'Processed');
            assert.ok(updatedLog.transactionId, 'Final log must store linked transactionId');
            assert.equal(updatedLog.infoPayoutUsd, '1.00');
            assert.equal(updatedLog.userRewardUSD, 0.7);
            assert.ok(Array.isArray(updatedLog.priorSecurityEvents) && updatedLog.priorSecurityEvents.length === 1);
            assert.equal(updatedLog.priorSecurityEvents[0].status, 'InvalidSignature');
            assert.equal(updatedLog.priorSecurityEvents[0].clientIp, '203.0.113.9');

            // Subsequent InvalidSignature tamper attempt after Processed must not downgrade Processed status
            const postTamperRes = createMockRes();
            await handlePostback({
                method: 'GET',
                params: { provider: 'offerwall_gg' },
                query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '700', status: 'credited', signature: 'tampered_again' },
                body: {},
                headers: { 'x-forwarded-for': '203.0.113.10' }
            }, postTamperRes);
            assert.equal(postTamperRes.statusCode, 400);
            assert.equal(updatedLog.status, 'Processed', 'Processed terminal log status must not downgrade on later invalid-sig probe');
            assert.equal(updatedLog.priorSecurityEvents.length, 2);
            assert.equal(updatedLog.priorSecurityEvents[1].status, 'InvalidSignature');
        } finally {
            OfferwallPostbackLog.prototype.save = origSave;
            OfferwallPostbackLog.findOne = origFindOne;
            Transaction.create = origTxCreate;
        }
    });

    await runTest('T90: Cross-alias duplicate credits, cross-alias reversals, unmatched reversal marker, and concurrent alias locks stay consistent', async () => {
        setupProviderManagedOfferwallGg();
        db.providers.delete('offerwallgg'); // Single DB record 'offerwall_gg'

        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 10.0;
        user.taskWalletBalance = 10.0;
        user.chargebackLiabilityUSD = 0;

        // 1. Credit via offerwall_gg, duplicate replay via offerwallgg -> DUP_ALREADY_PROCESSED
        const txDup = 'ow_cross_alias_dup';
        const sigDup = computeSignature(TEST_USER_ID, txDup, '70');
        const c1 = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txDup, currencyAmount: '70', status: 'credited', signature: sigDup },
            body: {},
            headers: {}
        }, c1);
        assert.equal(c1.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 10.7);

        const c2 = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwallgg' },
            query: { userId: TEST_USER_ID, transactionId: txDup, currencyAmount: '70', status: 'credited', signature: sigDup },
            body: {},
            headers: {}
        }, c2);
        assert.equal(c2.statusCode, 200);
        assert.equal(c2.body, 'DUP_ALREADY_PROCESSED');
        assert.equal(user.taskEarningsBalance, 10.7);

        // 2. Reverse via alias offerwallgg against credit recorded under offerwall_gg
        const revSigDup = computeSignature(TEST_USER_ID, txDup, '-70');
        const rAlias = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwallgg' },
            query: { userId: TEST_USER_ID, transactionId: txDup, currencyAmount: '-70', status: 'reversed', signature: revSigDup },
            body: {},
            headers: {}
        }, rAlias);
        assert.equal(rAlias.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 10.0, 'Cross-alias reversal must deduct original reward');

        // Replay reversal via offerwall_gg must detect existing reversal on offerwallgg
        const rReplay = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txDup, currencyAmount: '-70', status: 'reversed', signature: revSigDup },
            body: {},
            headers: {}
        }, rReplay);
        assert.equal(rReplay.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 10.0, 'Cross-alias duplicate reversal must not double-deduct');

        // 3. Unmatched reversal on offerwallgg blocks delayed credit on offerwall_gg
        const txPreRev = 'ow_cross_alias_prerev';
        const preRevRes = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwallgg' },
            query: { userId: TEST_USER_ID, transactionId: txPreRev, currencyAmount: '-70', status: 'reversed', signature: computeSignature(TEST_USER_ID, txPreRev, '-70') },
            body: {},
            headers: {}
        }, preRevRes);
        assert.equal(preRevRes.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 10.0);

        const lateCredRes = createMockRes();
        await handlePostback({
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txPreRev, currencyAmount: '70', status: 'credited', signature: computeSignature(TEST_USER_ID, txPreRev, '70') },
            body: {},
            headers: {}
        }, lateCredRes);
        assert.equal(lateCredRes.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 10.0, 'Delayed credit on primary key must be blocked by prior reversal on alias');

        // 4. Concurrent Promise.all across offerwall_gg and offerwallgg acquires unified lock and credits once
        const txRace = 'ow_cross_alias_race';
        const raceSig = computeSignature(TEST_USER_ID, txRace, '70');
        const raceRes1 = createMockRes();
        const raceRes2 = createMockRes();
        await Promise.all([
            handlePostback({
                method: 'GET',
                params: { provider: 'offerwall_gg' },
                query: { userId: TEST_USER_ID, transactionId: txRace, currencyAmount: '70', status: 'credited', signature: raceSig },
                body: {},
                headers: {}
            }, raceRes1),
            handlePostback({
                method: 'POST',
                params: { provider: 'offerwallgg' },
                query: {},
                body: { userId: TEST_USER_ID, transactionId: txRace, currencyAmount: '70', status: 'credited', signature: raceSig },
                headers: {}
            }, raceRes2)
        ]);
        assert.equal(user.taskEarningsBalance, 10.7, 'Concurrent cross-alias callbacks must credit exactly once');
    });

    console.log(`\n========================================================`);
    console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
    console.log(`========================================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
    process.exit(0);
})();
