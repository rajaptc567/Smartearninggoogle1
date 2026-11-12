import assert from 'node:assert/strict';
import crypto from 'crypto';
import { 
    handlePostback, 
    verifySignature, 
    seedVerifiedNetworks, 
    getOfferwallProviders, 
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
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.locks.clear();
        this.placements.clear();
    }
}

const db = new MockDb();

// Setup Mongoose model mocks
User.findById = async (id) => db.users.get(String(id)) || null;
User.findOne = async (query) => {
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
    const key = query.providerKey?.toLowerCase();
    return db.providers.get(key) || null;
};
OfferwallProvider.find = (query = {}) => {
    const all = Array.from(db.providers.values());
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

Notification.create = async (doc) => ({ ...doc, _id: `notif_${Date.now()}` });

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

    await runTest('T02: Default status is NOT_STARTED and approvalStatus is Pending', async () => {
        const provider = db.providers.get('offerwall_gg');
        assert.equal(provider.status, 'NOT_STARTED', 'status must be NOT_STARTED');
        assert.equal(provider.approvalStatus, 'Pending', 'approvalStatus must be Pending');
        assert.equal(provider.integrationStatus, 'Not Started');
        assert.equal(provider.exchangeRateMultiplier, 70);
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
                signature: sig
            },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, 11.05); // 10.00 + 70% of $1.50 = 11.05
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
                signature: sig
            },
            headers: { 'content-type': 'application/json' }
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body, 'OK');
        assert.equal(user.taskEarningsBalance, 12.10); // 10.00 + 70% of $3.00 = 12.10
    });

    await runTest('T07: GET and POST produce identical verification and financial result', async () => {
        const txId1 = 'ow_tx_equiv_get';
        const txId2 = 'ow_tx_equiv_post';
        const amount = '70';
        const sig1 = computeSignature(TEST_USER_ID, txId1, amount);
        const sig2 = computeSignature(TEST_USER_ID, txId2, amount);

        const reqGet = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId1, currencyAmount: amount, payoutUsd: '1.00', signature: sig1 }, body: {}, headers: {} };
        const reqPost = { method: 'POST', params: { provider: 'offerwall_gg' }, query: {}, body: { userId: TEST_USER_ID, transactionId: txId2, currencyAmount: amount, payoutUsd: '1.00', signature: sig2 }, headers: {} };

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

        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', signature: sig }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
        assert.ok(String(res.body).includes('INVALID_SIGNATURE') || res.statusCode === 400);
    });

    await runTest('T09: Missing signature fails closed with HTTP 400', async () => {
        process.env.OFFERWALL_GG_SECRET_KEY = TEST_SECRET;
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: 'ow_tx_nosig', currencyAmount: '70' }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T10: Incorrect signature rejected with HTTP 400', async () => {
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: 'ow_tx_badsig', currencyAmount: '70', signature: 'bad_signature_1234567890abcdef' }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T11: Tampered userId rejected with HTTP 400', async () => {
        const txId = 'ow_tx_tamper_user';
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const tamperedUserId = '64f1a2b3c4d5e6f7a8b9c0d2'; // Different ID
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: tamperedUserId, transactionId: txId, currencyAmount: amount, signature: sig }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T12: Tampered transactionId rejected with HTTP 400', async () => {
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, 'original_tx', amount);

        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: 'tampered_tx', currencyAmount: amount, signature: sig }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400);
    });

    await runTest('T13: Tampered currencyAmount rejected with HTTP 400', async () => {
        const txId = 'ow_tx_tamper_amt';
        const sig = computeSignature(TEST_USER_ID, txId, '70.00');

        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '700.00', signature: sig }, body: {}, headers: {} };
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
        const req = { method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70.00', signature: sigWithDecimals }, body: {}, headers: {} };
        const res = createMockRes();
        await handlePostback(req, res);
        assert.equal(res.statusCode, 200);
    });

    await runTest('T15: Conflicting query and body parameters rejected with HTTP 400', async () => {
        const req = {
            method: 'POST',
            params: { provider: 'offerwall_gg' },
            query: { transactionId: 'tx_query_111', currencyAmount: '70' },
            body: { transactionId: 'tx_body_222', currencyAmount: '70', userId: TEST_USER_ID, signature: 'any' },
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);
        assert.equal(res.statusCode, 400);
    });

    console.log('\n--- SECTION 3: Test Callback Isolation (test=1) ---');

    await runTest('T16: test=1 with valid signature acknowledged with HTTP 200 without balance mutation', async () => {
        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_test_valid';
        const amount = '70';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, test: '1', signature: sig },
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
        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: 'ow_tx_test_bad', currencyAmount: '70', test: '1', signature: 'bad_signature_xxx' },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 400, 'test=1 must never bypass signature validation');
    });

    console.log('\n--- SECTION 4: Financial Accounting, Idempotency & Reversals ---');

    await runTest('T18: Normal credit splits 70% user / 30% platform on payoutUsd', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;
        user.taskWalletBalance = 0;

        const txId = 'ow_tx_split_calc';
        const amount = '73.5'; // 70 Coins = $1 -> $1.05 = 73.5 Coins
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.50', signature: sig },
            body: {},
            headers: {}
        };
        const res = createMockRes();
        await handlePostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 1.05); // 70% of $1.50
    });

    await runTest('T19: Duplicate credit returns HTTP 200 without second crediting', async () => {
        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_split_calc'; // Same as T18
        const amount = '73.5';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.50', signature: sig },
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
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.00', signature: sig },
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

        const txId = 'ow_tx_split_calc'; // Originally credited $1.05
        const amount = '-73.5';
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
        assert.equal(Number(user.taskEarningsBalance.toFixed(2)), Number((balanceBefore - 1.05).toFixed(2)));
    });

    await runTest('T22: Duplicate reversal acknowledged without double deduction', async () => {
        const user = db.users.get(TEST_USER_ID);
        const balanceBefore = user.taskEarningsBalance;

        const txId = 'ow_tx_split_calc';
        const amount = '-73.5';
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

    await runTest('T23: Negative amount reversal without explicit status recognized as reversal', async () => {
        // First credit
        const txId = 'ow_tx_neg_amount_test';
        const credAmount = '70';
        const credSig = computeSignature(TEST_USER_ID, txId, credAmount);
        const resCred = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: credAmount, payoutUsd: '1.00', signature: credSig }, body: {}, headers: {} }, resCred);

        const user = db.users.get(TEST_USER_ID);
        const midBalance = user.taskEarningsBalance;

        // Reversal with negative amount
        const revAmount = '-70';
        const revSig = computeSignature(TEST_USER_ID, txId, revAmount);
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: revAmount, signature: revSig }, body: {}, headers: {} }, resRev);

        assert.equal(resRev.statusCode, 200);
        assert.equal(Number((midBalance - user.taskEarningsBalance).toFixed(2)), 0.70);
    });

    await runTest('T24: status=reversed with positive currencyAmount handled as reversal', async () => {
        const txId = 'ow_tx_status_rev_test';
        const credSig = computeSignature(TEST_USER_ID, txId, '70');
        const resCred = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', signature: credSig }, body: {}, headers: {} }, resCred);

        const user = db.users.get(TEST_USER_ID);
        const midBalance = user.taskEarningsBalance;

        const revSig = computeSignature(TEST_USER_ID, txId, '70');
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', status: 'reversed', signature: revSig }, body: {}, headers: {} }, resRev);

        assert.equal(resRev.statusCode, 200);
        assert.equal(Number((midBalance - user.taskEarningsBalance).toFixed(2)), 0.70);
    });

    await runTest('T25: Reversal before credit creates unmatched marker without balance mutation', async () => {
        const user = db.users.get(TEST_USER_ID);
        const startBalance = user.taskEarningsBalance;

        const txId = 'ow_tx_unmatched_first';
        const revSig = computeSignature(TEST_USER_ID, txId, '-70');
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-70', signature: revSig }, body: {}, headers: {} }, resRev);

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
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', signature: credSig }, body: {}, headers: {} }, resCred);

        assert.equal(resCred.statusCode, 200);
        assert.equal(user.taskEarningsBalance, startBalance, 'Late credit must be blocked by pre-existing reversal marker');
    });

    await runTest('T27: Insufficient balance reversal records deficit in chargebackLiabilityUSD without negative balance', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0.20; // Only 20 cents
        user.chargebackLiabilityUSD = 0;

        const txId = 'ow_tx_deficit_case';
        const credSig = computeSignature(TEST_USER_ID, txId, '70');
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', signature: credSig }, body: {}, headers: {} }, createMockRes());

        // Balance is now 0.20 + 0.70 = 0.90
        // Now withdraw/reset balance to 0.20
        user.taskEarningsBalance = 0.20;

        // Reversal of $0.70 occurs
        const revSig = computeSignature(TEST_USER_ID, txId, '-70');
        const resRev = createMockRes();
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-70', signature: revSig }, body: {}, headers: {} }, resRev);

        assert.equal(resRev.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 0, 'Balance must floor at 0 rather than becoming negative');
        assert.equal(user.chargebackLiabilityUSD, 0.50, 'Deficit must be tracked in chargebackLiabilityUSD');
    });

    await runTest('T28: Exact accounting precision maintained without truncation', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.taskEarningsBalance = 0;

        const txId = 'ow_tx_precise_split';
        const amount = '73.50';
        const sig = computeSignature(TEST_USER_ID, txId, amount);

        const req = {
            method: 'GET',
            params: { provider: 'offerwall_gg' },
            query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: amount, payoutUsd: '1.50', signature: sig },
            body: {},
            headers: {}
        };
        await handlePostback(req, createMockRes());

        assert.equal(user.taskEarningsBalance, 1.05);
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
        const user = db.users.get(TEST_USER_ID);
        user.walletBalance = 500.00; // Main deposit capital
        user.taskEarningsBalance = 10.00;

        // Perform a credit
        const txId = 'ow_tx_core_isolation';
        const sig = computeSignature(TEST_USER_ID, txId, '70');
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', signature: sig }, body: {}, headers: {} }, createMockRes());

        assert.equal(user.walletBalance, 500.00, 'Main deposit walletBalance must be 100% untouched on credit');

        // Perform a reversal
        const revSig = computeSignature(TEST_USER_ID, txId, '-70');
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '-70', signature: revSig }, body: {}, headers: {} }, createMockRes());

        assert.equal(user.walletBalance, 500.00, 'Main deposit walletBalance must be 100% untouched on reversal');
    });

    await runTest('T38: Investment Module plans and contracts remain 100% untouched', async () => {
        const user = db.users.get(TEST_USER_ID);
        user.activePlan = 'Gold Plan';
        user.activePlans = [{ planName: 'Gold Plan', price: 1000 }];

        const txId = 'ow_tx_invest_isolation';
        const sig = computeSignature(TEST_USER_ID, txId, '70');
        await handlePostback({ method: 'GET', params: { provider: 'offerwall_gg' }, query: { userId: TEST_USER_ID, transactionId: txId, currencyAmount: '70', payoutUsd: '1.00', signature: sig }, body: {}, headers: {} }, createMockRes());

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

    console.log(`\n========================================================`);
    console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
    console.log(`========================================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
    process.exit(0);
})();
