import assert from 'node:assert/strict';
import crypto from 'crypto';
import { handlePostback, handleTheoremReachEventWebhook, updateOfferwallProvider, acquirePostbackLock, releasePostbackLock, isLockStillOwned } from './backend/controllers/postbackController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import Notification from './backend/models/Notification.js';
import OfferwallPostbackLock from './backend/models/OfferwallPostbackLock.js';
import TheoremReachWebhookEvent from './backend/models/TheoremReachWebhookEvent.js';

console.log('Running SmartExn Offerwall Commission Modes & Debug Callback Test Suite...\n');

// In-memory mock database
class MockDb {
    constructor() {
        this.users = new Map();
        this.transactions = new Map();
        this.providers = new Map();
        this.logs = new Map();
        this.notifications = new Map();
        this.locks = new Map();
        this.webhookEvents = new Map();
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.notifications.clear();
        this.locks.clear();
        this.webhookEvents.clear();
    }
}

const db = new MockDb();

// Override Mongoose model methods
User.findById = async (id) => db.users.get(String(id)) || null;
User.findOne = async (query) => {
    if (query._id) {
        return db.users.get(String(query._id)) || null;
    }
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
let simulateUserUpdateFailure = false;
let simulateCompensationFailure = false;
let simulateCompensationNull = false;
let simulateTxDeleteFailure = false;
User.findOneAndUpdate = async (filter, update) => {
    await new Promise(r => setTimeout(r, 10));
    if (simulateCompensationFailure && update.$inc && (update.$inc.taskEarningsBalance > 0 || update.$inc.taskWalletBalance > 0)) {
        throw new Error('Database connection reset during compensation rollback');
    }
    if (simulateCompensationNull && update.$inc && (update.$inc.taskEarningsBalance > 0 || update.$inc.taskWalletBalance > 0)) {
        return null;
    }
    if (simulateUserUpdateFailure) {
        throw new Error('Database connection reset during balance update');
    }
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
            if (k.includes('.')) {
                const parts = k.split('.');
                let curr = user;
                for (let i = 0; i < parts.length - 1; i++) {
                    curr[parts[i]] = curr[parts[i]] || {};
                    curr = curr[parts[i]];
                }
                curr[parts[parts.length - 1]] = v;
            } else {
                user[k] = v;
            }
        }
    }
    return user;
};
User.findByIdAndUpdate = async (id, update) => {
    await new Promise(r => setTimeout(r, 10));
    if (simulateUserUpdateFailure) {
        throw new Error('Database connection reset during balance update');
    }
    const user = await User.findById(id);
    if (!user) return null;
    if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
            user[k] = Number(((user[k] || 0) + v).toFixed(4));
        }
    }
    if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
            if (k.includes('.')) {
                const parts = k.split('.');
                let curr = user;
                for (let i = 0; i < parts.length - 1; i++) {
                    curr[parts[i]] = curr[parts[i]] || {};
                    curr = curr[parts[i]];
                }
                curr[parts[parts.length - 1]] = v;
            } else {
                user[k] = v;
            }
        }
    }
    return user;
};

TheoremReachWebhookEvent.findOne = async (query) => {
    if (query.encSalt) {
        return db.webhookEvents.get(query.encSalt) || null;
    }
    return null;
};
TheoremReachWebhookEvent.create = async (doc) => {
    if (db.webhookEvents.has(doc.encSalt)) {
        const err = new Error('Duplicate key: encSalt');
        err.code = 11000;
        throw err;
    }
    const evt = { ...doc, _id: `evt_${Date.now()}` };
    db.webhookEvents.set(doc.encSalt, evt);
    return evt;
};

Transaction.find = async (query) => {
    const results = [];
    if (query.externalTransactionId) {
        for (const tx of db.transactions.values()) {
            if (tx.externalTransactionId === query.externalTransactionId && tx.offerwallProvider === query.offerwallProvider) {
                results.push(tx);
            }
        }
    }
    return results;
};

Transaction.findOne = async (query) => {
    if (query.$or && Array.isArray(query.$or)) {
        for (const sub of query.$or) {
            const found = await Transaction.findOne(sub);
            if (found) return found;
        }
        return null;
    }
    if (query.idempotencyKey) {
        return db.transactions.get(query.idempotencyKey) || null;
    }
    if (query.externalTransactionId) {
        for (const tx of db.transactions.values()) {
            if (tx.externalTransactionId === query.externalTransactionId && tx.offerwallProvider === query.offerwallProvider) {
                if (query.type && tx.type !== query.type) continue;
                return tx;
            }
        }
    }
    return null;
};

let simulateTxCreateFailure = false;
Transaction.create = async (doc) => {
    await new Promise(r => setTimeout(r, 10));
    if (simulateTxCreateFailure) {
        throw new Error('Database write constraint violation');
    }
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tx = { ...doc, _id: id };
    if (doc.idempotencyKey) {
        if (db.transactions.has(doc.idempotencyKey)) {
            const err = new Error('Duplicate key');
            err.code = 11000;
            throw err;
        }
        db.transactions.set(doc.idempotencyKey, tx);
    }
    return tx;
};

Transaction.deleteOne = async (query) => {
    if (simulateTxDeleteFailure) {
        return { deletedCount: 0, acknowledged: true };
    }
    if (query._id) {
        for (const [key, tx] of db.transactions.entries()) {
            if (tx._id === query._id) {
                db.transactions.delete(key);
                return { deletedCount: 1, acknowledged: true };
            }
        }
    }
    return { deletedCount: 0, acknowledged: true };
};

OfferwallPostbackLock.create = async (doc) => {
    const key = `${doc.providerKey}_${doc.externalTxId}`;
    if (db.locks.has(key)) {
        const err = new Error('Duplicate lock');
        err.code = 11000;
        throw err;
    }
    const record = { ...doc, createdAt: new Date() };
    db.locks.set(key, record);
    return record;
};

OfferwallPostbackLock.findOne = async (query) => {
    const key = `${query.providerKey}_${query.externalTxId}`;
    const lock = db.locks.get(key) || null;
    if (!lock) return null;
    if (query.ownerToken && lock.ownerToken !== query.ownerToken) return null;
    return lock;
};

OfferwallPostbackLock.findOneAndUpdate = async (filter, update, options) => {
    const key = `${filter.providerKey}_${filter.externalTxId}`;
    const lock = db.locks.get(key);
    if (!lock) return null;
    if (filter.expiresAt?.$lt && !(lock.expiresAt && new Date(lock.expiresAt) < filter.expiresAt.$lt)) {
        return null;
    }
    if (filter.ownerToken && lock.ownerToken !== filter.ownerToken) {
        return null;
    }
    const updated = { ...lock, ...update.$set };
    db.locks.set(key, updated);
    return updated;
};

OfferwallPostbackLock.deleteOne = async (query) => {
    const key = `${query.providerKey}_${query.externalTxId}`;
    const lock = db.locks.get(key);
    if (lock) {
        if (query.ownerToken && lock.ownerToken !== query.ownerToken) {
            return { deletedCount: 0 };
        }
        db.locks.delete(key);
        return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
};

OfferwallProvider.findOne = async (query) => {
    const key = query.providerKey?.toLowerCase();
    return db.providers.get(key) || null;
};
OfferwallProvider.findOneAndUpdate = async (filter, update) => {
    const key = filter.providerKey?.toLowerCase();
    const existing = db.providers.get(key);
    if (!existing) return null;
    const updated = { ...existing, ...update.$set };
    db.providers.set(key, updated);
    return updated;
};
OfferwallProvider.findByIdAndUpdate = async (id, update) => {
    for (const [key, p] of db.providers.entries()) {
        if (p._id === id) {
            if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) {
                    p[k] = (p[k] || 0) + v;
                }
            }
            if (update.$set) {
                for (const [k, v] of Object.entries(update.$set)) {
                    p[k] = v;
                }
            }
            return p;
        }
    }
    return null;
};

OfferwallPostbackLog.countDocuments = async () => 0;

OfferwallPostbackLog.create = async (doc) => {
    const id = doc.externalTxId || `log_${Date.now()}`;
    const log = { ...doc, _id: id };
    db.logs.set(id, log);
    return log;
};

OfferwallPostbackLog.prototype.save = async function() {
    db.logs.set(this.externalTxId || `log_${Date.now()}`, this);
    return this;
};


Notification.create = async (doc) => {
    const id = `notif_${Date.now()}`;
    const n = { ...doc, _id: id };
    db.notifications.set(id, n);
    return n;
};

const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(data) {
            this.body = data;
            return this;
        },
        json(data) {
            this.jsonData = data;
            this.body = data;
            return this;
        }
    };
    return res;
};

async function runTests() {
    const testSecret = 'secret_theorem_key_123';

    const signTheoremReach = (query, secret) => {
        const parts = [];
        for (const [k, v] of Object.entries(query)) {
            if (k === 'hash' || k === 'signature' || k === 'sig') continue;
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
        const candidate = `/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`;
        const hmac = crypto.createHmac('sha1', secret).update(candidate).digest('base64');
        query.hash = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return query;
    };

    const sign = (query) => signTheoremReach(query, testSecret);

    // Seed test providers
    const seedProviders = () => {
        db.clear();
        db.providers.set('theoremreach', {
            _id: 'prov_theoremreach',
            providerKey: 'theoremreach',
            name: 'TheoremReach',
            category: 'survey',
            enabled: true,
            secretKey: testSecret,
            requireSignature: true,
            signatureType: 'hmac_sha1',
            exchangeRateMultiplier: 1.0,
            commissionMode: 'provider_managed', // Default explicit mode
            userRevenueSharePercent: 70,
            platformRevenueSharePercent: 30,
            riskThresholdUSD: 50.0
        });

        db.providers.set('torox', {
            _id: 'prov_torox',
            providerKey: 'torox',
            name: 'Torox',
            category: 'offerwall',
            enabled: true,
            secretKey: 'torox_secret',
            requireSignature: true,
            signatureType: 'md5',
            exchangeRateMultiplier: 1.0,
            commissionMode: 'smartexn_managed',
            userRevenueSharePercent: 80,
            platformRevenueSharePercent: 20
        });

        // Seed test user
        db.users.set('507f1f77bcf86cd799439011', {
            _id: '507f1f77bcf86cd799439011',
            username: 'alice_worker',
            taskEarningsBalance: 100.0,
            taskWalletBalance: 100.0,
            chargebackLiabilityUSD: 0.0,
            status: 'Active',
            restrictions: { earning: false }
        });
    };

    // TEST 1: Test callback with debug=true causes ZERO balance mutations and creates NO transaction
    console.log('Test 1: Test callback with debug=true is safely isolated...');
    seedProviders();
    const req1 = {
        params: { provider: 'theoremreach' },
        query: sign({
            user_id: '507f1f77bcf86cd799439011',
            tx_id: 'test_tx_debug_001',
            reward_amount: '5.00',
            debug: 'true'
        }),
        body: {},
        headers: {}
    };
    const res1 = createMockRes();
    await handlePostback(req1, res1);

    const user1 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(res1.statusCode, 200, 'Test callback should receive HTTP 200 OK');
    assert.equal(res1.body, 'OK');
    assert.equal(user1.taskEarningsBalance, 100.0, 'taskEarningsBalance must remain unmodified on debug=true');
    assert.equal(user1.taskWalletBalance, 100.0, 'taskWalletBalance must remain unmodified on debug=true');
    assert.equal(db.transactions.size, 0, 'No transaction record must be created on debug=true');
    console.log('✓ Passed Test 1: Debug test callback safely bypassed all balance mutations and transactions.\n');

    // TEST 2: Provider-Managed mode credits 100% of payout without additional platform deduction
    console.log('Test 2: Provider-Managed mode credits 100% of payout with zero platform deduction...');
    seedProviders();
    const req2 = {
        params: { provider: 'theoremreach' },
        query: sign({
            user_id: '507f1f77bcf86cd799439011',
            tx_id: 'prov_managed_001',
            reward_amount: '10.00'
        }),
        body: {},
        headers: {}
    };
    const res2 = createMockRes();
    await handlePostback(req2, res2);

    const user2 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(res2.statusCode, 200);
    // In provider_managed mode: 100% credited to user, 0 platform deduction
    assert.equal(user2.taskEarningsBalance, 110.0, 'User should receive 100% of reported reward ($10.00)');
    assert.equal(user2.taskWalletBalance, 110.0);
    assert.equal(db.transactions.size, 1);
    const tx2 = db.transactions.get('theoremreach_prov_managed_001_credit');
    assert.ok(tx2, 'Credit transaction must exist');
    assert.equal(tx2.amountUSD, 10.0, 'Transaction amountUSD must equal full $10.00');
    assert.equal(tx2.userRewardAmount, 10.0);
    assert.equal(tx2.platformRevenueAmount, 0.0, 'Platform revenue must be 0 in provider_managed mode');
    console.log('✓ Passed Test 2: Provider-Managed mode credited 100% with zero double-deduction.\n');

    // TEST 3: Duplicate transaction ID is rejected idempotently
    console.log('Test 3: Duplicate tx_id does not credit twice...');
    const req3 = {
        params: { provider: 'theoremreach' },
        query: sign({
            user_id: '507f1f77bcf86cd799439011',
            tx_id: 'prov_managed_001',
            reward_amount: '10.00'
        }),
        body: {},
        headers: {}
    };
    const res3 = createMockRes();
    await handlePostback(req3, res3);

    const user3 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(res3.statusCode, 200);
    assert.equal(res3.body, 'DUP_ALREADY_PROCESSED');
    assert.equal(user3.taskEarningsBalance, 110.0, 'Balance must remain 110.0, no double credit');
    console.log('✓ Passed Test 3: Duplicate transaction detected and safely rejected.\n');

    // TEST 4: Reversal callback in provider_managed mode deducts full net reward
    console.log('Test 4: Reversal callback deducts reward and logs reversal...');
    const req4 = {
        params: { provider: 'theoremreach' },
        query: sign({
            user_id: '507f1f77bcf86cd799439011',
            tx_id: 'prov_managed_001',
            reward_amount: '10.00',
            isReversal: 'true'
        }),
        body: {},
        headers: {}
    };
    const res4 = createMockRes();
    await handlePostback(req4, res4);

    const user4 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(res4.statusCode, 200);
    assert.equal(user4.taskEarningsBalance, 100.0, 'User balance must return to initial 100.0 after reversal deduction');
    assert.ok(db.transactions.has('theoremreach_prov_managed_001_reversal'), 'Reversal transaction must be recorded');
    console.log('✓ Passed Test 4: Reversal deducted original reward and created reversal ledger entry.\n');

    // TEST 5: Balance rollback on transaction creation failure
    console.log('Test 5: Transaction failure rolls back balance increment...');
    seedProviders();
    simulateTxCreateFailure = true;
    const req5 = {
        params: { provider: 'theoremreach' },
        query: sign({
            user_id: '507f1f77bcf86cd799439011',
            tx_id: 'failed_tx_001',
            reward_amount: '10.00'
        }),
        body: {},
        headers: {}
    };
    const res5 = createMockRes();
    await handlePostback(req5, res5);
    simulateTxCreateFailure = false;

    assert.equal(res5.statusCode, 500, 'HTTP 500 should be returned to trigger provider retry on write error');
    assert.ok(res5.body?.includes('POSTBACK_ERROR'), 'Response body should indicate POSTBACK_ERROR');
    const user5 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(user5.taskEarningsBalance, 100.0, 'User balance must be rolled back to 100.0 on write failure');
    console.log('✓ Passed Test 5: Atomic rollback restored user balance on transaction persistence failure.\n');

    // TEST 6: SmartExn-Managed mode applies retained share at 20%, 30%, and 40%
    console.log('Test 6: SmartExn-Managed mode applies retained share at 20%, 30%, and 40%...');
    seedProviders();

    // 6a: Switch to smartexn_managed with 20% retained
    const adminReq20 = {
        user: { role: 'admin' },
        params: { providerKey: 'theoremreach' },
        body: { commissionMode: 'smartexn_managed', platformRevenueSharePercent: 20 }
    };
    const adminRes20 = createMockRes();
    await updateOfferwallProvider(adminReq20, adminRes20);
    assert.equal(adminRes20.statusCode, 200);
    const p20 = db.providers.get('theoremreach');
    assert.equal(p20.commissionMode, 'smartexn_managed');
    assert.equal(p20.platformRevenueSharePercent, 20);
    assert.equal(p20.userRevenueSharePercent, 80);

    // Verify callback at 20% retained: gross $1.00 -> user $0.80, platform $0.20
    const testReq20 = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'rev20_tx', reward_amount: '1.00' }),
        body: {},
        headers: {}
    };
    await handlePostback(testReq20, createMockRes());
    const txAt20 = db.transactions.get('theoremreach_rev20_tx_credit');
    assert.equal(txAt20.userRewardAmount, 0.80);
    assert.equal(txAt20.platformRevenueAmount, 0.20);

    // 6b: Set retained to 30%
    const adminReq30 = {
        user: { role: 'admin' },
        params: { providerKey: 'theoremreach' },
        body: { platformRevenueSharePercent: 30 }
    };
    const adminRes30 = createMockRes();
    await updateOfferwallProvider(adminReq30, adminRes30);
    assert.equal(adminRes30.statusCode, 200);
    const p30 = db.providers.get('theoremreach');
    assert.equal(p30.platformRevenueSharePercent, 30);
    assert.equal(p30.userRevenueSharePercent, 70);

    // Verify callback at 30% retained: gross $1.00 -> user $0.70, platform $0.30
    const testReq30 = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'rev30_tx', reward_amount: '1.00' }),
        body: {},
        headers: {}
    };
    await handlePostback(testReq30, createMockRes());
    const txAt30 = db.transactions.get('theoremreach_rev30_tx_credit');
    assert.equal(txAt30.userRewardAmount, 0.70);
    assert.equal(txAt30.platformRevenueAmount, 0.30);

    // 6c: Set retained to 40%
    const adminReq40 = {
        user: { role: 'admin' },
        params: { providerKey: 'theoremreach' },
        body: { platformRevenueSharePercent: 40 }
    };
    const adminRes40 = createMockRes();
    await updateOfferwallProvider(adminReq40, adminRes40);
    assert.equal(adminRes40.statusCode, 200);
    const p40 = db.providers.get('theoremreach');
    assert.equal(p40.platformRevenueSharePercent, 40);
    assert.equal(p40.userRevenueSharePercent, 60);

    // Verify callback at 40% retained: gross $1.00 -> user $0.60, platform $0.40
    const testReq40 = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'rev40_tx', reward_amount: '1.00' }),
        body: {},
        headers: {}
    };
    await handlePostback(testReq40, createMockRes());
    const txAt40 = db.transactions.get('theoremreach_rev40_tx_credit');
    assert.equal(txAt40.userRewardAmount, 0.60);
    assert.equal(txAt40.platformRevenueAmount, 0.40);

    console.log('✓ Passed Test 6: SmartExn-Managed mode correctly applied 20%, 30%, and 40% retained shares.\n');

    // TEST 7: Invalid commissionMode rejected with HTTP 400
    console.log('Test 7: Invalid commissionMode rejected with HTTP 400...');
    const adminReqInvalidMode = {
        user: { role: 'admin' },
        params: { providerKey: 'theoremreach' },
        body: { commissionMode: 'unsupported_mode' }
    };
    const adminResInvalidMode = createMockRes();
    await updateOfferwallProvider(adminReqInvalidMode, adminResInvalidMode);
    assert.equal(adminResInvalidMode.statusCode, 400, 'Invalid commissionMode must be rejected with 400');

    // Invalid retained percentage rejected
    const adminReqInvalidPct = {
        user: { role: 'admin' },
        params: { providerKey: 'theoremreach' },
        body: { platformRevenueSharePercent: 120 }
    };
    const adminResInvalidPct = createMockRes();
    await updateOfferwallProvider(adminReqInvalidPct, adminResInvalidPct);
    assert.equal(adminResInvalidPct.statusCode, 400, 'Invalid share > 100 must be rejected');

    console.log('✓ Passed Test 7: Invalid commissionMode and out-of-bounds percentages rejected with HTTP 400.\n');

    // TEST 8: Legacy provider fallback defaults safely to provider_managed
    console.log('Test 8: Legacy provider fallback defaults to provider_managed...');
    db.providers.set('legacy_net', {
        _id: 'prov_legacy',
        providerKey: 'legacy_net',
        name: 'Legacy Net Provider',
        category: 'survey',
        enabled: true,
        secretKey: 'legacy_secret',
        requireSignature: false,
        signatureType: 'none',
        exchangeRateMultiplier: 1.0,
        // Notice: commissionMode is undefined (legacy document)
        userRevenueSharePercent: 70
    });

    const testReqLegacy = {
        params: { provider: 'legacy_net' },
        query: { user_id: '507f1f77bcf86cd799439011', tx_id: 'legacy_tx_001', reward_amount: '5.00' },
        body: {},
        headers: {}
    };
    await handlePostback(testReqLegacy, createMockRes());
    const txLegacy = db.transactions.get('legacy_net_legacy_tx_001_credit');
    assert.equal(txLegacy.userRewardAmount, 5.00, 'Legacy record must credit 100% without accidental 30% deduction');
    assert.equal(txLegacy.platformRevenueAmount, 0.00);
    console.log('✓ Passed Test 8: Legacy provider record defaulted safely to provider_managed without extra deduction.\n');

    // TEST 9: Other providers remain untouched
    console.log('Test 9: Other providers (e.g. Torox) settings and shares remain unchanged...');
    const torox = db.providers.get('torox');
    assert.equal(torox.commissionMode, 'smartexn_managed');
    assert.equal(torox.platformRevenueSharePercent, 20);
    assert.equal(torox.userRevenueSharePercent, 80);
    assert.equal(torox.signatureType, 'md5');
    console.log('✓ Passed Test 9: Unrelated providers preserved without collateral impact.\n');

    // TEST 10: Missing and invalid signatures fail closed
    console.log('Test 10: Missing or invalid signature fails closed with HTTP 400...');
    seedProviders();
    const pTheorem = db.providers.get('theoremreach');
    pTheorem.requireSignature = true;
    pTheorem.signatureType = 'md5';

    // 10a: Missing signature
    const reqMissingSig = {
        params: { provider: 'theoremreach' },
        query: { user_id: '507f1f77bcf86cd799439011', tx_id: 'no_sig_tx', reward_amount: '5.00' },
        body: {},
        headers: {}
    };
    const resMissingSig = createMockRes();
    await handlePostback(reqMissingSig, resMissingSig);
    assert.equal(resMissingSig.statusCode, 400);
    assert.equal(resMissingSig.body, 'INVALID_SIGNATURE');

    // 10b: Invalid signature
    const reqInvalidSig = {
        params: { provider: 'theoremreach' },
        query: { user_id: '507f1f77bcf86cd799439011', tx_id: 'bad_sig_tx', reward_amount: '5.00', hash: 'bogus_hash' },
        body: {},
        headers: {}
    };
    const resInvalidSig = createMockRes();
    await handlePostback(reqInvalidSig, resInvalidSig);
    assert.equal(resInvalidSig.statusCode, 400);
    assert.equal(resInvalidSig.body, 'INVALID_SIGNATURE');

    console.log('✓ Passed Test 10: Missing and invalid signatures fail closed with HTTP 400.\n');

    // TEST 11: Out-of-order reversal (reversal arrives first, then credit) blocks spendable reward
    console.log('Test 11: Out-of-order reversal arriving before credit blocks spendable reward...');
    seedProviders();
    const userObj = db.users.get('507f1f77bcf86cd799439011');
    const startBalance = userObj.taskEarningsBalance || 0;

    const revFirstReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'out_of_order_tx_1', reward_amount: '10.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const resRevFirst = createMockRes();
    await handlePostback(revFirstReq, resRevFirst);
    assert.equal(resRevFirst.statusCode, 200);
    assert.equal(userObj.taskEarningsBalance, startBalance, 'Unmatched reversal must not deduct balance or credit anything');

    // Now send the delayed credit for the same tx_id
    const creditAfterRevReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'out_of_order_tx_1', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resCreditAfterRev = createMockRes();
    await handlePostback(creditAfterRevReq, resCreditAfterRev);
    assert.equal(resCreditAfterRev.statusCode, 200);
    assert.equal(userObj.taskEarningsBalance, startBalance, 'Credit arriving after pre-existing reversal must not make reward spendable (net zero balance change)');
    console.log('✓ Passed Test 11: Out-of-order reversal successfully blocked subsequent reward credit.\n');

    // TEST 12: Mandatory TheoremReach signature enforcement (ignores ip_only, requireSignature: false, missing secret/signature)
    console.log('Test 12: Mandatory TheoremReach signature enforcement tests...');
    seedProviders();
    const pTr = db.providers.get('theoremreach');
    pTr.signatureType = 'ip_only';
    pTr.requireSignature = false;

    // 12a: Missing signature fails closed even with ip_only or requireSignature: false
    const reqMissingTrSig = {
        params: { provider: 'theoremreach' },
        query: { user_id: '507f1f77bcf86cd799439011', tx_id: 'tr_sig_test_1', reward_amount: '5.00' },
        body: {},
        headers: {}
    };
    const resMissingTrSig = createMockRes();
    await handlePostback(reqMissingTrSig, resMissingTrSig);
    assert.equal(resMissingTrSig.statusCode, 400);
    assert.equal(resMissingTrSig.body, 'INVALID_SIGNATURE');

    // 12b: Missing secret fails closed
    pTr.secretKey = '';
    const reqNoSecret = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'tr_sig_test_2', reward_amount: '5.00' }),
        body: {},
        headers: {}
    };
    const resNoSecret = createMockRes();
    await handlePostback(reqNoSecret, resNoSecret);
    assert.equal(resNoSecret.statusCode, 400);
    assert.equal(resNoSecret.body, 'INVALID_SIGNATURE');
    console.log('✓ Passed Test 12: TheoremReach signature enforcement strictly fails closed.\n');

    // TEST 13: Debug flag isolation (TheoremReach honors debug=true; Torox does NOT support debug bypass)
    console.log('Test 13: Debug flag isolation across providers...');
    seedProviders();
    const reqToroxDebug = {
        params: { provider: 'torox' },
        query: { user_id: '507f1f77bcf86cd799439011', oid: 'offer_1', reward: '5.00', debug: 'true', sig: 'invalid_sig' },
        body: {},
        headers: {}
    };
    const resToroxDebug = createMockRes();
    await handlePostback(reqToroxDebug, resToroxDebug);
    assert.equal(resToroxDebug.statusCode, 400, 'Torox must not treat debug=true as test bypass; invalid signature must be rejected');
    console.log('✓ Passed Test 13: Debug flag isolated to TheoremReach only; other providers validate signatures.\n');

    // TEST 14: Unmatched reversal dry-run causes zero database writes
    console.log('Test 14: Unmatched reversal dry-run causes zero database writes...');
    seedProviders();
    const initialTxCount = db.transactions.size;
    const reqDryRunReversal = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'nonexistent_dryrun_tx', reward_amount: '5.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    reqDryRunReversal.__isSimulatorDryRun = true;
    reqDryRunReversal.__simulatedByAdmin = true;
    const resDryRunReversal = createMockRes();
    await handlePostback(reqDryRunReversal, resDryRunReversal);
    assert.equal(resDryRunReversal.statusCode, 200);
    assert.equal(db.transactions.size, initialTxCount, 'Dry-run must create zero transaction writes or reversal markers');
    console.log('✓ Passed Test 14: Unmatched reversal dry-run produced zero database writes.\n');

    // TEST 15: Marker persistence failure handling
    console.log('Test 15: Marker persistence failure does not falsely report success...');
    seedProviders();
    simulateTxCreateFailure = true;
    const reqMarkerFail = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'fail_marker_tx', reward_amount: '5.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const resMarkerFail = createMockRes();
    let threw = false;
    try {
        await handlePostback(reqMarkerFail, resMarkerFail);
    } catch (_) {
        threw = true;
    }
    simulateTxCreateFailure = false;
    assert.ok(threw || resMarkerFail.statusCode >= 400, 'Marker persistence failure must not silently succeed');
    console.log('✓ Passed Test 15: Marker persistence failure correctly handled/failed.\n');

    // TEST 16: Truly Overlapping Concurrent Credit & Reversal (Promise.all)
    console.log('Test 16: Truly overlapping concurrent credit & reversal callbacks via Promise.all...');
    seedProviders();
    const concurrentTxId = 'truly_concurrent_tx_123';
    const initialBalance16 = db.users.get('507f1f77bcf86cd799439011').taskEarningsBalance;
    
    const creditReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentTxId, reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resCredit = createMockRes();
    
    const reversalReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentTxId, reward_amount: '10.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const resRev = createMockRes();
    
    // Launch credit and reversal truly concurrently
    await Promise.all([
        handlePostback(creditReq, resCredit),
        handlePostback(reversalReq, resRev)
    ]);
    
    assert.equal(resCredit.statusCode, 200, 'Concurrent credit must succeed');
    assert.equal(resRev.statusCode, 200, 'Concurrent reversal must succeed');
    
    const user16 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(user16.taskEarningsBalance, initialBalance16, 'Final balance after concurrent credit and reversal must strictly equal original balance ($100.00)');
    
    // Concurrently fire two duplicate credit requests for the same transaction
    const dupReq1 = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentTxId, reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const dupRes1 = createMockRes();
    const dupReq2 = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentTxId, reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const dupRes2 = createMockRes();
    
    await Promise.all([
        handlePostback(dupReq1, dupRes1),
        handlePostback(dupReq2, dupRes2)
    ]);
    assert.equal(dupRes1.body, 'DUP_ALREADY_PROCESSED', 'First concurrent duplicate credit must be rejected');
    assert.equal(dupRes2.body, 'DUP_ALREADY_PROCESSED', 'Second concurrent duplicate credit must be rejected');
    assert.equal(user16.taskEarningsBalance, initialBalance16, 'User balance must remain unmodified after concurrent duplicate credits');
    console.log('✓ Passed Test 16: Truly overlapping concurrent credit & reversal callbacks safely coordinated with atomic locks.\n');

    // TEST 17: Truly Overlapping Concurrent Reversal-First + Credit Callbacks
    console.log('Test 17: Truly overlapping concurrent reversal-first race condition...');
    seedProviders();
    const concurrentRevFirstTxId = 'concurrent_rev_first_tx_999';
    const initialBalance17 = db.users.get('507f1f77bcf86cd799439011').taskEarningsBalance;
    
    const revFirstReqConcurrent = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentRevFirstTxId, reward_amount: '15.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const resRevConcurrent = createMockRes();
    
    const creditConcurrentReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentRevFirstTxId, reward_amount: '15.00' }),
        body: {},
        headers: {}
    };
    const resCreditConcurrent = createMockRes();
    
    // Launch both simultaneously
    await Promise.all([
        handlePostback(revFirstReqConcurrent, resRevConcurrent),
        handlePostback(creditConcurrentReq, resCreditConcurrent)
    ]);
    
    assert.equal(resRevConcurrent.statusCode, 200);
    assert.equal(resCreditConcurrent.statusCode, 200);
    const user17 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(user17.taskEarningsBalance, initialBalance17, 'Balance must remain 100.0 regardless of concurrent arrival order');
    console.log('✓ Passed Test 17: Concurrent reversal-first race condition resolved safely without balance leaks.\n');

    // TEST 18: Compensating Rollback on Balance Update Failure
    console.log('Test 18: Compensating rollback cleans up transaction on user balance update failure...');
    seedProviders();
    simulateUserUpdateFailure = true;
    const reqFailBalance = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'fail_balance_tx_001', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resFailBalance = createMockRes();
    await handlePostback(reqFailBalance, resFailBalance);
    simulateUserUpdateFailure = false;
    
    assert.equal(resFailBalance.statusCode, 500, 'HTTP 500 returned on balance update failure');
    const user18 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(user18.taskEarningsBalance, 100.0, 'User balance must remain untouched');
    assert.equal(db.transactions.has('theoremreach_fail_balance_tx_001_credit'), false, 'Orphaned transaction record must be rolled back');
    console.log('✓ Passed Test 18: Compensating rollback successfully eliminated orphaned ledger record on balance update failure.\n');

    // TEST 19: [MOCKED IN-MEMORY TEST] Stale-lock takeover followed by old owner attempted release
    console.log('Test 19: Stale-lock takeover followed by old owner attempted release [MOCKED IN-MEMORY TEST]...');
    const testProviderKey = 'theoremreach';
    const testTxId = 'stale_takeover_tx_001';
    
    // Process A acquires lock with a past expiresAt to simulate an expired/stale lock
    const pastExpiresAt = new Date(Date.now() - 5000);
    const ownerTokenA = 'owner_token_process_A_123';
    await OfferwallPostbackLock.create({
        providerKey: testProviderKey,
        externalTxId: testTxId,
        ownerToken: ownerTokenA,
        expiresAt: pastExpiresAt
    });

    // Process B calls acquirePostbackLock -> atomically takes over the stale lock
    const ownerTokenB = await acquirePostbackLock(testProviderKey, testTxId);
    assert.ok(ownerTokenB, 'Process B must acquire lock via atomic takeover');
    assert.notEqual(ownerTokenA, ownerTokenB, 'Process B must have a unique ownerToken');

    const lockAfterTakeover = await OfferwallPostbackLock.findOne({ providerKey: testProviderKey, externalTxId: testTxId });
    assert.equal(lockAfterTakeover.ownerToken, ownerTokenB, 'Lock must now be owned by Process B');

    // Process A (delayed/slow) attempts to release the lock with its old ownerToken
    const relA = await releasePostbackLock(testProviderKey, testTxId, ownerTokenA);
    assert.equal(relA, false, 'Release with old owner token must return false');

    // Verify Process A's release had ZERO effect on Process B's lock
    const lockAfterOldRelease = await OfferwallPostbackLock.findOne({ providerKey: testProviderKey, externalTxId: testTxId });
    assert.ok(lockAfterOldRelease, 'Lock must still exist in database');
    assert.equal(lockAfterOldRelease.ownerToken, ownerTokenB, 'Lock must remain owned by Process B');

    // Unverified/parameterless release attempt must NOT delete Process B's lock
    const relParam = await releasePostbackLock(testProviderKey, testTxId);
    assert.equal(relParam, false, 'Parameterless release must return false');
    const lockAfterParamless = await OfferwallPostbackLock.findOne({ providerKey: testProviderKey, externalTxId: testTxId });
    assert.ok(lockAfterParamless, 'Lock must not be deleted by parameterless release');
    assert.equal(lockAfterParamless.ownerToken, ownerTokenB, 'Lock must remain owned by Process B');

    // Verify isLockStillOwned returns false for old owner A, false for missing token, and true for current owner B
    const isAValid = await isLockStillOwned(testProviderKey, testTxId, ownerTokenA);
    const isBValid = await isLockStillOwned(testProviderKey, testTxId, ownerTokenB);
    const isNullValid = await isLockStillOwned(testProviderKey, testTxId, null);
    assert.equal(isAValid, false, 'Old owner token must be recognized as invalid/lost');
    assert.equal(isBValid, true, 'Current owner token must be recognized as valid');
    assert.equal(isNullValid, false, 'Null owner token must fail closed');

    // Process B releases with its valid token
    const relB = await releasePostbackLock(testProviderKey, testTxId, ownerTokenB);
    assert.equal(relB, true, 'Release with valid owner token must return true');
    const lockAfterNewRelease = await OfferwallPostbackLock.findOne({ providerKey: testProviderKey, externalTxId: testTxId });
    assert.equal(lockAfterNewRelease, null, 'Lock must be cleanly deleted when released by rightful owner');
    console.log('✓ Passed Test 19: Stale-lock takeover followed by old owner release handled safely.\n');

    // TEST 20: [MOCKED IN-MEMORY TEST] Concurrent duplicate postbacks and lock ownership safety
    console.log('Test 20: Concurrent duplicate postbacks and lock ownership safety [MOCKED IN-MEMORY TEST]...');
    seedProviders();
    const dupConTxId = 'concurrent_dup_tx_456';
    const initialUserBal20 = db.users.get('507f1f77bcf86cd799439011').taskEarningsBalance;

    const dupReqA = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: dupConTxId, reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const dupResA = createMockRes();
    const dupReqB = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: dupConTxId, reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const dupResB = createMockRes();

    await Promise.all([
        handlePostback(dupReqA, dupResA),
        handlePostback(dupReqB, dupResB)
    ]);

    assert.equal(dupResA.statusCode, 200, 'Request A must succeed');
    assert.equal(dupResB.statusCode, 200, 'Request B must succeed');
    const user20 = db.users.get('507f1f77bcf86cd799439011');
    assert.equal(user20.taskEarningsBalance, Number((initialUserBal20 + 10.00).toFixed(2)), 'User must be credited exactly once ($10.00)');
    
    // Exactly 1 transaction record exists
    const matchingTxs20 = Array.from(db.transactions.values()).filter(t => t.externalTransactionId === dupConTxId);
    assert.equal(matchingTxs20.length, 1, 'Exactly one transaction record must exist for concurrent duplicate requests');
    
    // Lock must be fully released
    const remainingLock20 = await OfferwallPostbackLock.findOne({ providerKey: 'theoremreach', externalTxId: dupConTxId });
    assert.equal(remainingLock20, null, 'Lock must be fully released after concurrent duplicate requests finish');
    console.log('✓ Passed Test 20: Concurrent duplicate postbacks safely coordinated without double credit.\n');

    // TEST 21: [MOCKED IN-MEMORY TEST] Blocked and earning-restricted users receiving no credit and leaving no ledger record
    console.log('Test 21: Blocked and earning-restricted users protection [MOCKED IN-MEMORY TEST]...');
    seedProviders();
    const testUser = db.users.get('507f1f77bcf86cd799439011');
    
    // 21a: Blocked user
    testUser.status = 'Blocked';
    testUser.restrictions = { earning: false };
    const initialBalBlocked = testUser.taskEarningsBalance;

    const reqBlocked = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'blocked_user_tx_001', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resBlocked = createMockRes();
    await handlePostback(reqBlocked, resBlocked);
    assert.equal(resBlocked.statusCode, 403, 'Blocked user must receive HTTP 403');
    assert.equal(testUser.taskEarningsBalance, initialBalBlocked, 'Blocked user balance must remain unchanged');
    assert.equal(db.transactions.has('theoremreach_blocked_user_tx_001_credit'), false, 'No transaction ledger entry for blocked user');

    // 21b: Earning-restricted user
    testUser.status = 'Active';
    testUser.restrictions = { earning: true };
    const reqRestricted = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'restricted_user_tx_001', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resRestricted = createMockRes();
    await handlePostback(reqRestricted, resRestricted);
    assert.equal(resRestricted.statusCode, 403, 'Earning-restricted user must receive HTTP 403');
    assert.equal(testUser.taskEarningsBalance, initialBalBlocked, 'Restricted user balance must remain unchanged');
    assert.equal(db.transactions.has('theoremreach_restricted_user_tx_001_credit'), false, 'No transaction ledger entry for restricted user');

    // 21c: User becomes blocked concurrently at balance update point
    testUser.status = 'Active';
    testUser.restrictions = { earning: false };
    const origFindOneAndUpdate = User.findOneAndUpdate;
    let interceptedOnce = false;
    User.findOneAndUpdate = async (filter, update, options) => {
        if (filter['restrictions.earning']?.$ne && !interceptedOnce) {
            interceptedOnce = true;
            // Simulate status becoming Blocked right as balance update executes
            testUser.status = 'Blocked';
            return null; // conditional update fails because status is now Blocked
        }
        return origFindOneAndUpdate(filter, update, options);
    };

    const reqRaceBlock = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'race_block_tx_001', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resRaceBlock = createMockRes();
    await handlePostback(reqRaceBlock, resRaceBlock);
    User.findOneAndUpdate = origFindOneAndUpdate; // restore
    testUser.status = 'Active'; // restore

    assert.equal(resRaceBlock.statusCode, 403, 'Concurrent block at balance update point must return HTTP 403');
    assert.equal(testUser.taskEarningsBalance, initialBalBlocked, 'Balance must remain unchanged after concurrent block');
    assert.equal(db.transactions.has('theoremreach_race_block_tx_001_credit'), false, 'Pre-created transaction must be cleanly deleted on rejection');

    // 21d: Duplicate credit for a previously credited transaction when user is now blocked
    // Credit a transaction first
    const reqCredSuccess = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'prior_credit_tx_001', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resCredSuccess = createMockRes();
    await handlePostback(reqCredSuccess, resCredSuccess);
    assert.equal(resCredSuccess.statusCode, 200);

    // Now block user and send duplicate
    testUser.status = 'Blocked';
    const reqDupBlocked = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'prior_credit_tx_001', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resDupBlocked = createMockRes();
    await handlePostback(reqDupBlocked, resDupBlocked);
    testUser.status = 'Active'; // restore

    // 21e: Restricted-user transaction deletion failure -> triggers CriticalInconsistency
    testUser.status = 'Active';
    testUser.restrictions = { earning: false };
    simulateTxDeleteFailure = true;
    let intercepted21e = false;
    const origFindOneAndUpdate21e = User.findOneAndUpdate;
    User.findOneAndUpdate = async (filter, update, options) => {
        if (filter['restrictions.earning']?.$ne && !intercepted21e) {
            intercepted21e = true;
            testUser.status = 'Blocked';
            return null; // rejected by user restriction at balance update point
        }
        return origFindOneAndUpdate21e(filter, update, options);
    };

    const reqDelFail = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'del_fail_tx_001', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resDelFail = createMockRes();
    await handlePostback(reqDelFail, resDelFail);
    User.findOneAndUpdate = origFindOneAndUpdate21e; // restore
    simulateTxDeleteFailure = false;
    testUser.status = 'Active'; // restore

    assert.equal(resDelFail.statusCode, 500, 'Deletion failure for restricted user must return HTTP 500');
    assert.ok(resDelFail.body.includes('CRITICAL_INCONSISTENCY'), 'Response body must report CRITICAL_INCONSISTENCY');
    const delFailLog = db.logs.get('del_fail_tx_001');
    assert.ok(delFailLog, 'Log record must exist');
    assert.equal(delFailLog.status, 'CriticalInconsistency', 'Log status must record CriticalInconsistency when transaction deletion fails');

    console.log('✓ Passed Test 21: Blocked and earning-restricted users safely protected without orphan records.\n');

    // TEST 22: [MOCKED IN-MEMORY TEST] Reversal transaction failure and compensation failure
    console.log('Test 22: Reversal transaction failure and compensation failure [MOCKED IN-MEMORY TEST]...');
    seedProviders();
    testUser.status = 'Active';
    testUser.restrictions = { earning: false };
    testUser.taskEarningsBalance = 100.0;
    testUser.taskWalletBalance = 100.0;
    testUser.chargebackLiabilityUSD = 0;

    // Seed original reward transaction
    const origRevTx = {
        _id: 'tx_orig_rev_001',
        userId: testUser._id,
        userName: testUser.username,
        type: 'Offerwall Reward',
        amountUSD: 20.0,
        userRewardAmount: 20.0,
        grossAmount: 20.0,
        offerwallProvider: 'theoremreach',
        externalTransactionId: 'rev_failure_tx_001',
        idempotencyKey: 'theoremreach_rev_failure_tx_001_credit'
    };
    db.transactions.set(origRevTx.idempotencyKey, origRevTx);

    // 22a: Transaction creation fails, compensation succeeds
    simulateTxCreateFailure = true;
    const reqRevFail = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'rev_failure_tx_001', reward_amount: '20.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const resRevFail = createMockRes();
    await handlePostback(reqRevFail, resRevFail);
    simulateTxCreateFailure = false;

    assert.equal(resRevFail.statusCode, 500, 'Reversal transaction failure must return HTTP 500');
    assert.equal(testUser.taskEarningsBalance, 100.0, 'Balance must be safely compensated back to 100.0');
    assert.equal(testUser.chargebackLiabilityUSD, 0, 'Liability must be compensated back to 0');
    assert.equal(db.transactions.has('theoremreach_rev_failure_tx_001_reversal'), false, 'Reversal transaction must not exist');

    // 22b: Transaction creation fails AND compensation rollback fails with error
    simulateTxCreateFailure = true;
    simulateCompensationFailure = true; // compensation rollback findOneAndUpdate will fail!
    const reqRevCritFail = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'rev_failure_tx_001', reward_amount: '20.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const resRevCritFail = createMockRes();
    await handlePostback(reqRevCritFail, resRevCritFail);
    simulateTxCreateFailure = false;
    simulateCompensationFailure = false;

    assert.equal(resRevCritFail.statusCode, 500, 'Critical compensation failure must return HTTP 500');
    // Verify log recorded CriticalCompensationFailure, NEVER reporting successful recovery
    const criticalLog = db.logs.get('rev_failure_tx_001');
    assert.ok(criticalLog, 'Log record must exist for reversal attempt');
    assert.equal(criticalLog.status, 'CriticalCompensationFailure', 'Log status must record CriticalCompensationFailure when rollback fails');

    // 22c: Reversal compensation returning null without throwing
    simulateTxCreateFailure = true;
    simulateCompensationNull = true; // compensation rollback findOneAndUpdate will return null!
    const reqRevCompNull = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'rev_comp_null_001', reward_amount: '20.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    db.transactions.set('theoremreach_rev_comp_null_001_credit', {
        _id: 'tx_orig_rev_comp_null_001',
        userId: testUser._id,
        userName: testUser.username,
        type: 'Offerwall Reward',
        amountUSD: 20.0,
        userRewardAmount: 20.0,
        grossAmount: 20.0,
        offerwallProvider: 'theoremreach',
        externalTransactionId: 'rev_comp_null_001',
        idempotencyKey: 'theoremreach_rev_comp_null_001_credit'
    });
    const resRevCompNull = createMockRes();
    await handlePostback(reqRevCompNull, resRevCompNull);
    simulateTxCreateFailure = false;
    simulateCompensationNull = false;

    assert.equal(resRevCompNull.statusCode, 500, 'Reversal compensation returning null must return HTTP 500');
    const compNullLog = db.logs.get('rev_comp_null_001');
    assert.ok(compNullLog, 'Log record must exist');
    assert.equal(compNullLog.status, 'CriticalCompensationFailure', 'Log status must record CriticalCompensationFailure when compensation returns null');
    console.log('✓ Passed Test 22: Reversal transaction failure and compensation failure handled and reported correctly.\n');

    // TEST 23: [MOCKED IN-MEMORY TEST] Lock ownership race: slow callback detects lost ownership before mutations
    console.log('Test 23: Lock ownership race test [MOCKED IN-MEMORY TEST]...');
    seedProviders();
    testUser.status = 'Active';
    testUser.restrictions = { earning: false };
    const raceBalBefore = testUser.taskEarningsBalance;
    const raceTxId = 'lock_race_tx_001';

    // Hook Transaction.create to simulate takeover happening right as transaction creation begins:
    // Process A had acquired the lock, but now lock expires and is acquired/taken over by Process B
    const origTxCreate23 = Transaction.create;
    let lockTakeoverSimulated = false;
    Transaction.create = async (doc) => {
        if (doc.externalTransactionId === raceTxId && !lockTakeoverSimulated) {
            lockTakeoverSimulated = true;
            // Simulate lock expiry and takeover by Process B with new owner token
            const lockKey = `theoremreach_${raceTxId}`;
            db.locks.set(lockKey, {
                providerKey: 'theoremreach',
                externalTxId: raceTxId,
                ownerToken: 'process_B_new_owner_token_999',
                expiresAt: new Date(Date.now() + 15000),
                createdAt: new Date()
            });
        }
        return origTxCreate23(doc);
    };

    const reqRace = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: raceTxId, reward_amount: '15.00' }),
        body: {},
        headers: {}
    };
    const resRace = createMockRes();
    await handlePostback(reqRace, resRace);
    Transaction.create = origTxCreate23; // restore

    assert.equal(resRace.statusCode, 500, 'Process that lost lock ownership must abort with HTTP 500');
    assert.equal(testUser.taskEarningsBalance, raceBalBefore, 'User balance must NOT be credited when lock was lost');
    assert.equal(db.transactions.has(`theoremreach_${raceTxId}_credit`), false, 'Pre-created transaction must be cleaned up after lock loss');

    // Verify Process B's lock was NOT deleted by Process A's finally block
    const remainingLockB = await OfferwallPostbackLock.findOne({ providerKey: 'theoremreach', externalTxId: raceTxId });
    assert.ok(remainingLockB, 'Process B lock must remain intact');
    assert.equal(remainingLockB.ownerToken, 'process_B_new_owner_token_999', 'Process B remains rightful lock owner');
    console.log('✓ Passed Test 23: Lock ownership race detected and handled safely without orphan mutations.\n');

    // TEST 24: Unconfigured Exchange Rate Multiplier Fails Closed for TheoremReach
    console.log('Test 24: Unconfigured Exchange Rate Multiplier Fails Closed for TheoremReach...');
    seedProviders();
    const pEx = db.providers.get('theoremreach');
    pEx.exchangeRateMultiplier = 0; // Invalid / unconfigured

    const reqEx = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'no_ex_rate_tx', reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resEx = createMockRes();
    await handlePostback(reqEx, resEx);
    assert.equal(resEx.statusCode, 400, 'Unconfigured exchange rate must fail closed with HTTP 400');
    assert.equal(resEx.body, 'EXCHANGE_RATE_NOT_CONFIGURED');
    console.log('✓ Passed Test 24: TheoremReach failed closed when exchange rate multiplier was unconfigured/invalid.\n');

    // TEST 25: TheoremReach exchange rate of 70, 700 virtual units = $10.00 gross USD, single commission split, negative reversal, and non-TheoremReach regression check.
    console.log('Test 25: TheoremReach exchange rate (70), 700 virtual units ($10.00 gross), single commission split, negative reversal, and non-TheoremReach regression check...');
    seedProviders();
    const pTr25 = db.providers.get('theoremreach');
    pTr25.exchangeRateMultiplier = 70.0;
    pTr25.commissionMode = 'smartexn_managed';
    pTr25.userRevenueSharePercent = 70;

    const user25 = db.users.get('507f1f77bcf86cd799439011');
    user25.taskEarningsBalance = 100.0;

    // 25a: Send 700 virtual reward units -> grossUSD = 700 / 70 = 10.00. userRewardUSD = 10.00 * 0.70 = 7.00.
    const req25 = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'tr_700_units_tx', reward: '700' }),
        body: {},
        headers: {}
    };
    const res25 = createMockRes();
    await handlePostback(req25, res25);
    assert.equal(res25.statusCode, 200);
    const tx25 = db.transactions.get('theoremreach_tr_700_units_tx_credit');
    assert.ok(tx25, 'Credit transaction must exist');
    assert.equal(tx25.grossAmount, 10.0, '700 virtual units with exchange rate 70 must produce $10.00 gross USD');
    assert.equal(tx25.userRewardAmount, 7.0, '70% user commission on $10.00 gross must be $7.00');
    assert.equal(tx25.platformRevenueAmount, 3.0, '30% platform commission on $10.00 gross must be $3.00');
    assert.equal(user25.taskEarningsBalance, 107.0, 'User balance must be credited by $7.00');

    // 25b: Negative reversal amount test (reward: '-700' or reversal: 'true') using original credited transaction
    const req25Rev = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: 'tr_700_units_tx', reward: '-700', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const res25Rev = createMockRes();
    await handlePostback(req25Rev, res25Rev);
    assert.equal(res25Rev.statusCode, 200);
    assert.equal(user25.taskEarningsBalance, 100.0, 'User balance must return to 100.0 after reversal deduction based on original tx');
    const tx25Rev = db.transactions.get('theoremreach_tr_700_units_tx_reversal');
    assert.ok(tx25Rev, 'Reversal transaction must exist');
    assert.equal(tx25Rev.userRewardAmount, 7.0, 'Reversal deduction must match original user reward amount ($7.00)');

    // 25c: Regression check for non-TheoremReach provider (Torox)
    const toroxProv = db.providers.get('torox');
    toroxProv.exchangeRateMultiplier = 1.0;
    toroxProv.commissionMode = 'smartexn_managed';
    toroxProv.userRevenueSharePercent = 80;

    const toroxSig = crypto.createHash('md5').update(`torox_offer_1-507f1f77bcf86cd799439011-torox_secret`).digest('hex');
    const reqToroxReg = {
        params: { provider: 'torox' },
        query: { id: 'torox_tx_001', oid: 'torox_offer_1', user_id: '507f1f77bcf86cd799439011', amount: '50.00', sig: toroxSig },
        body: {},
        headers: {}
    };
    const resToroxReg = createMockRes();
    await handlePostback(reqToroxReg, resToroxReg);
    assert.equal(resToroxReg.statusCode, 200, 'Torox regression request must succeed');
    const txToroxReg = db.transactions.get('torox_torox_tx_001_credit');
    assert.ok(txToroxReg, 'Torox credit transaction must exist');
    assert.equal(txToroxReg.grossAmount, 50.0, 'Torox gross amount must be $50.00');
    assert.equal(txToroxReg.userRewardAmount, 40.0, 'Torox 80% user reward on $50.00 must be $40.00');
    assert.equal(txToroxReg.platformRevenueAmount, 10.0, 'Torox 20% platform revenue on $50.00 must be $10.00');

    console.log('✓ Passed Test 25: TheoremReach exchange rate 70, 700 units = $10.00 gross, single commission split, negative reversal, and non-TheoremReach regression check.\n');

    // Test 26: TheoremReach 9 Settings Persistence, Admin Allowlist & Reversal Invariance
    console.log('Test 26: TheoremReach 9 Settings Persistence, Admin Allowlist & Reversal Invariance...');

    // 26a: Non-admin request rejected with 403
    const reqNonAdmin = {
        params: { providerKey: 'theoremreach' },
        body: { defaultRedirectUrl: 'https://example.com' },
        user: { role: 'member' }
    };
    const resNonAdmin = createMockRes();
    await updateOfferwallProvider(reqNonAdmin, resNonAdmin);
    assert.equal(resNonAdmin.statusCode, 403, 'Non-admin request must be rejected with 403');

    // 26b: Admin request updates all 9 TheoremReach dashboard configuration & reference fields
    const reqAdmin = {
        params: { providerKey: 'theoremreach' },
        body: {
            defaultRedirectUrl: 'https://smartearning.com/member/offerwalls',
            successRedirectUrl: 'https://smartearning.com/member/offerwalls?status=success',
            partialRedirectUrl: 'https://smartearning.com/member/offerwalls?status=partial',
            disqualifiedRedirectUrl: 'https://smartearning.com/member/offerwalls?status=disqualified',
            quotaFullRedirectUrl: 'https://smartearning.com/member/offerwalls?status=quotafull',
            securityRedirectUrl: 'https://smartearning.com/member/offerwalls?status=security',
            eventWebhookUrl: 'https://reporting.smartearning.com/events/theoremreach',
            rewardCallbackUrl: 'https://smartearning.com/api/v1/postbacks/theoremreach',
            includeReversalsInRewardCallback: false,
            unauthorizedInjectedField: 'malicious_payload'
        },
        user: { role: 'admin' }
    };
    const resAdmin = createMockRes();
    await updateOfferwallProvider(reqAdmin, resAdmin);
    assert.equal(resAdmin.statusCode, 200, 'Admin update must succeed with 200');
    assert.ok(resAdmin.jsonData.success, 'Response success must be true');

    const updatedTr = db.providers.get('theoremreach');
    assert.equal(updatedTr.defaultRedirectUrl, 'https://smartearning.com/member/offerwalls');
    assert.equal(updatedTr.successRedirectUrl, 'https://smartearning.com/member/offerwalls?status=success');
    assert.equal(updatedTr.partialRedirectUrl, 'https://smartearning.com/member/offerwalls?status=partial');
    assert.equal(updatedTr.disqualifiedRedirectUrl, 'https://smartearning.com/member/offerwalls?status=disqualified');
    assert.equal(updatedTr.quotaFullRedirectUrl, 'https://smartearning.com/member/offerwalls?status=quotafull');
    assert.equal(updatedTr.securityRedirectUrl, 'https://smartearning.com/member/offerwalls?status=security');
    assert.equal(updatedTr.eventWebhookUrl, 'https://reporting.smartearning.com/events/theoremreach');
    assert.equal(updatedTr.rewardCallbackUrl, 'https://smartearning.com/api/v1/postbacks/theoremreach');
    assert.equal(updatedTr.includeReversalsInRewardCallback, false);
    assert.equal(updatedTr.unauthorizedInjectedField, undefined, 'Unauthorized field must be stripped by allowlist');

    // 26c: Invariant test: When includeReversalsInRewardCallback is false, any received reversal postback
    // is STILL processed safely and atomically without balance leaks or silent corruption
    const user26 = {
        _id: '507f1f77bcf86cd799439026',
        username: 'user_test_26',
        taskEarningsBalance: 150.0,
        taskWalletBalance: 150.0,
        role: 'user',
        status: 'active'
    };
    db.users.set(user26._id, user26);

    // Initial credit
    const req26Credit = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: user26._id, tx_id: 'tr_test26_tx', reward: '140' }), // 140 units = $2.00 gross -> $1.40 user reward (70%)
        body: {},
        headers: {}
    };
    const res26Credit = createMockRes();
    await handlePostback(req26Credit, res26Credit);
    assert.equal(res26Credit.statusCode, 200);
    assert.equal(user26.taskEarningsBalance, 151.4, 'User balance credited to $151.40');

    // Reversal arrives
    const req26Rev = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: user26._id, tx_id: 'tr_test26_tx', reward: '-140', reversal: 'true' }),
        body: {},
        headers: {}
    };
    const res26Rev = createMockRes();
    await handlePostback(req26Rev, res26Rev);
    assert.equal(res26Rev.statusCode, 200, 'Reversal must be processed successfully');
    assert.equal(user26.taskEarningsBalance, 150.0, 'User balance must return cleanly to $150.00 without balance leaks');
    const tx26Rev = db.transactions.get('theoremreach_tr_test26_tx_reversal');
    assert.ok(tx26Rev, 'Reversal transaction ledger entry must be created');
    assert.equal(tx26Rev.userRewardAmount, 1.4, 'Reversal amount must match original credit');

    console.log('✓ Passed Test 26: TheoremReach 9 Settings Persistence, Admin Allowlist & Reversal Invariance verified.\n');

    // =========================================================================
    // THEOREMREACH INBOUND EVENT WEBHOOK TEST SUITE (Tests 27 - 38)
    // =========================================================================

    const webhookSecret = 'tr_webhook_secret_key_999';
    const trAppId = 'tr_app_pub_789';

    // Helper to sign TheoremReach webhook URL
    const signWebhookUrl = (urlWithoutHash, secret = webhookSecret) => {
        const hmac = crypto.createHmac('sha1', secret).update(urlWithoutHash).digest('base64');
        return hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    // Configure TheoremReach provider for webhook tests
    const trProviderForWebhook = {
        _id: 'provider_tr_webhook_01',
        providerKey: 'theoremreach',
        name: 'TheoremReach',
        enabled: true,
        status: 'ACTIVE',
        secretKey: webhookSecret,
        postbackKey: webhookSecret,
        appId: trAppId,
        exchangeRateMultiplier: 70.0,
        eventWebhookUrl: 'https://smartexn.com/api/v1/postbacks/theoremreach/events',
        rewardCallbackUrl: 'https://smartexn.com/api/v1/postbacks/theoremreach',
        totalReversalCount: 0
    };
    db.providers.set('theoremreach', trProviderForWebhook);

    // -------------------------------------------------------------------------
    // Test 27: Valid inbound TheoremReach Event Webhook with HMAC-SHA1 signature
    // -------------------------------------------------------------------------
    console.log('Test 27: Valid inbound TheoremReach Event Webhook with HMAC-SHA1 signature...');
    const user27 = {
        _id: '507f1f77bcf86cd799439027',
        username: 'user_test_27',
        taskEarningsBalance: 50.0,
        taskWalletBalance: 50.0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user27._id, user27);

    const salt27 = 'evt_test27_salt_001';
    const url27WithoutHash = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt27}`;
    const hash27 = signWebhookUrl(url27WithoutHash);

    const req27 = {
        method: 'POST',
        rawUrl: `${url27WithoutHash}&hash=${hash27}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt27}&hash=${hash27}`,
        query: { enc_salt: salt27, hash: hash27 },
        body: {
            data: {
                api_key: trAppId,
                user_id: user27._id,
                at: new Date().toISOString(),
                event_type: 'ping'
            }
        },
        headers: { host: 'smartexn.com' }
    };
    const res27 = createMockRes();
    await handleTheoremReachEventWebhook(req27, res27);
    assert.equal(res27.statusCode, 200, 'Valid webhook must respond HTTP 200');
    assert.equal(res27.body.success, true);
    assert.equal(res27.body.event_id, salt27);
    const persistedEvt27 = db.webhookEvents.get(salt27);
    assert.ok(persistedEvt27, 'TheoremReachWebhookEvent must be persisted in database');
    assert.equal(persistedEvt27.encSalt, salt27);
    console.log('✓ Passed Test 27: Valid inbound TheoremReach Event Webhook verified with URL-safe HMAC-SHA1.\n');

    // -------------------------------------------------------------------------
    // Test 28: Missing or malformed signature / enc_salt fails closed with HTTP 400
    // -------------------------------------------------------------------------
    console.log('Test 28: Missing enc_salt or hash fails closed with HTTP 400...');
    const req28MissingSalt = {
        method: 'POST',
        query: { hash: hash27 },
        body: { data: { api_key: trAppId } }
    };
    const res28MissingSalt = createMockRes();
    await handleTheoremReachEventWebhook(req28MissingSalt, res28MissingSalt);
    assert.equal(res28MissingSalt.statusCode, 400, 'Missing enc_salt must fail closed with HTTP 400');

    const req28MissingHash = {
        method: 'POST',
        query: { enc_salt: 'evt_no_hash' },
        body: { data: { api_key: trAppId } }
    };
    const res28MissingHash = createMockRes();
    await handleTheoremReachEventWebhook(req28MissingHash, res28MissingHash);
    assert.equal(res28MissingHash.statusCode, 400, 'Missing hash must fail closed with HTTP 400');
    console.log('✓ Passed Test 28: Missing enc_salt or signature hash strictly rejected with HTTP 400.\n');

    // -------------------------------------------------------------------------
    // Test 29: Invalid / tampered HMAC-SHA1 signature fails closed with HTTP 400
    // -------------------------------------------------------------------------
    console.log('Test 29: Tampered or invalid HMAC-SHA1 signature fails closed with HTTP 400...');
    const salt29 = 'evt_test29_tampered';
    const req29Tampered = {
        method: 'POST',
        rawUrl: `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt29}&hash=invalid_tampered_hash_123`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt29}&hash=invalid_tampered_hash_123`,
        query: { enc_salt: salt29, hash: 'invalid_tampered_hash_123' },
        body: { data: { api_key: trAppId, event_type: 'reversal' } }
    };
    const res29Tampered = createMockRes();
    await handleTheoremReachEventWebhook(req29Tampered, res29Tampered);
    assert.equal(res29Tampered.statusCode, 400, 'Tampered hash must fail closed with HTTP 400');
    console.log('✓ Passed Test 29: Tampered signature hash fails closed with constant-time protection.\n');

    // -------------------------------------------------------------------------
    // Test 30: Missing or mismatched api_key in payload data fails closed with HTTP 400
    // -------------------------------------------------------------------------
    console.log('Test 30: Missing or mismatched api_key in payload data fails closed with HTTP 400...');
    const salt30 = 'evt_test30_apikey';
    const url30 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt30}`;
    const hash30 = signWebhookUrl(url30);

    const req30WrongKey = {
        method: 'POST',
        rawUrl: `${url30}&hash=${hash30}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt30}&hash=${hash30}`,
        query: { enc_salt: salt30, hash: hash30 },
        body: { data: { api_key: 'wrong_key_999' } }
    };
    const res30WrongKey = createMockRes();
    await handleTheoremReachEventWebhook(req30WrongKey, res30WrongKey);
    assert.equal(res30WrongKey.statusCode, 400, 'Mismatched api_key must fail closed with HTTP 400');

    const req30MissingKey = {
        method: 'POST',
        rawUrl: `${url30}&hash=${hash30}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt30}&hash=${hash30}`,
        query: { enc_salt: salt30, hash: hash30 },
        body: { data: {} }
    };
    const res30MissingKey = createMockRes();
    await handleTheoremReachEventWebhook(req30MissingKey, res30MissingKey);
    assert.equal(res30MissingKey.statusCode, 400, 'Missing api_key must fail closed with HTTP 400');

    // Missing appId in provider configuration
    const savedAppId = trProviderForWebhook.appId;
    trProviderForWebhook.appId = '';
    const res30NoAppId = createMockRes();
    await handleTheoremReachEventWebhook(req30WrongKey, res30NoAppId);
    assert.equal(res30NoAppId.statusCode, 400, 'Missing appId in provider config must fail closed with HTTP 400');
    trProviderForWebhook.appId = savedAppId;

    // Missing secretKey in provider configuration
    const savedSecret = trProviderForWebhook.secretKey;
    trProviderForWebhook.secretKey = '';
    trProviderForWebhook.postbackKey = '';
    const res30NoSecret = createMockRes();
    await handleTheoremReachEventWebhook(req30WrongKey, res30NoSecret);
    assert.equal(res30NoSecret.statusCode, 400, 'Missing secretKey in provider config must fail closed with HTTP 400');
    trProviderForWebhook.secretKey = savedSecret;
    trProviderForWebhook.postbackKey = savedSecret;

    console.log('✓ Passed Test 30: Missing or mismatched api_key, missing appId, and missing secretKey strictly rejected with HTTP 400.\n');

    // -------------------------------------------------------------------------
    // Test 31: Idempotent deduplication on enc_salt
    // -------------------------------------------------------------------------
    console.log('Test 31: Idempotent deduplication on enc_salt...');
    const salt31 = 'evt_test31_dedup_unique';
    const url31 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt31}`;
    const hash31 = signWebhookUrl(url31);

    const req31First = {
        method: 'POST',
        rawUrl: `${url31}&hash=${hash31}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt31}&hash=${hash31}`,
        query: { enc_salt: salt31, hash: hash31 },
        body: { data: { api_key: trAppId, event_type: 'ping' } }
    };
    const res31First = createMockRes();
    await handleTheoremReachEventWebhook(req31First, res31First);
    assert.equal(res31First.statusCode, 200);
    assert.equal(res31First.body.processed, true);

    // Second duplicate delivery with same enc_salt
    const res31Second = createMockRes();
    await handleTheoremReachEventWebhook(req31First, res31Second);
    assert.equal(res31Second.statusCode, 200, 'Duplicate delivery must succeed idempotently with HTTP 200');
    assert.equal(res31Second.body.duplicate, true, 'Duplicate flag must be confirmed');
    console.log('✓ Passed Test 31: Idempotent deduplication on enc_salt verified with safe duplicate handling.\n');

    // -------------------------------------------------------------------------
    // Test 32: Reversal event with matched original credit and sufficient user balance
    // -------------------------------------------------------------------------
    console.log('Test 32: Reversal event with matched original credit and sufficient user balance...');
    const user32 = {
        _id: '507f1f77bcf86cd799439032',
        username: 'user_test_32',
        taskEarningsBalance: 25.0,
        taskWalletBalance: 25.0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user32._id, user32);

    const tx32CredId = 'tr_tx_matched_32';
    const origCreditTx32 = {
        _id: 'tx_orig_credit_32',
        userId: user32._id,
        userName: user32.username,
        offerwallProvider: 'theoremreach',
        externalTransactionId: tx32CredId,
        type: 'Offerwall Reward',
        amount: 5.0,
        amountUSD: 5.0,
        grossAmount: 7.14,
        userRewardAmount: 5.0,
        platformRevenueAmount: 2.14,
        idempotencyKey: `theoremreach_${tx32CredId}_credit`,
        status: 'Approved'
    };
    db.transactions.set(origCreditTx32.idempotencyKey, origCreditTx32);

    const salt32 = 'evt_test32_rev_matched';
    const url32 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt32}`;
    const hash32 = signWebhookUrl(url32);

    const prevReversalCount = trProviderForWebhook.totalReversalCount || 0;

    const req32 = {
        method: 'POST',
        rawUrl: `${url32}&hash=${hash32}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt32}&hash=${hash32}`,
        query: { enc_salt: salt32, hash: hash32 },
        body: {
            data: {
                api_key: trAppId,
                user_id: user32._id,
                at: new Date().toISOString(),
                event_type: 'reversal',
                external_transaction_id: tx32CredId
            }
        }
    };
    const res32 = createMockRes();
    await handleTheoremReachEventWebhook(req32, res32);
    assert.equal(res32.statusCode, 200, 'Matched reversal must succeed with HTTP 200');
    assert.equal(user32.taskEarningsBalance, 20.0, 'User earnings balance must be deducted by $5.00 ($25 -> $20)');
    assert.equal(user32.taskWalletBalance, 20.0, 'User wallet balance must be deducted by $5.00 ($25 -> $20)');

    const revTx32 = db.transactions.get(`theoremreach_${tx32CredId}_reversal`);
    assert.ok(revTx32, 'Reversal transaction record must be created');
    assert.equal(revTx32.type, 'Offerwall Reversal');
    assert.equal(revTx32.amount, 5.0);
    assert.equal(revTx32.chargebackStatus, 'Settled');
    assert.equal(revTx32.reversalReferenceId, origCreditTx32._id);
    assert.equal(trProviderForWebhook.totalReversalCount, prevReversalCount + 1, 'Provider totalReversalCount incremented');
    console.log('✓ Passed Test 32: Reversal event with matched credit deducted balance and logged ledger reversal.\n');

    // -------------------------------------------------------------------------
    // Test 33: Reversal event with insufficient user balance (chargeback liability owed)
    // -------------------------------------------------------------------------
    console.log('Test 33: Reversal event with insufficient balance records liability...');
    const user33 = {
        _id: '507f1f77bcf86cd799439033',
        username: 'user_test_33',
        taskEarningsBalance: 2.0, // Only $2.00 remaining
        taskWalletBalance: 2.0,
        chargebackLiabilityUSD: 0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user33._id, user33);

    const tx33CredId = 'tr_tx_matched_33';
    const origCreditTx33 = {
        _id: 'tx_orig_credit_33',
        userId: user33._id,
        userName: user33.username,
        offerwallProvider: 'theoremreach',
        externalTransactionId: tx33CredId,
        type: 'Offerwall Reward',
        amount: 5.0, // $5.00 original credit
        amountUSD: 5.0,
        userRewardAmount: 5.0,
        idempotencyKey: `theoremreach_${tx33CredId}_credit`,
        status: 'Approved'
    };
    db.transactions.set(origCreditTx33.idempotencyKey, origCreditTx33);

    const salt33 = 'evt_test33_rev_insufficient';
    const url33 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt33}`;
    const hash33 = signWebhookUrl(url33);

    const req33 = {
        method: 'POST',
        rawUrl: `${url33}&hash=${hash33}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt33}&hash=${hash33}`,
        query: { enc_salt: salt33, hash: hash33 },
        body: {
            data: {
                api_key: trAppId,
                user_id: user33._id,
                event_type: 'reversal',
                external_transaction_id: tx33CredId
            }
        }
    };
    const res33 = createMockRes();
    await handleTheoremReachEventWebhook(req33, res33);
    assert.equal(res33.statusCode, 200);
    assert.equal(user33.taskEarningsBalance, 0.0, 'Available balance deducted to zero');
    assert.equal(user33.chargebackLiabilityUSD, 3.0, 'Liability recorded for remaining $3.00 owed');

    const revTx33 = db.transactions.get(`theoremreach_${tx33CredId}_reversal`);
    assert.ok(revTx33);
    assert.equal(revTx33.chargebackStatus, 'Liability_Owed');
    console.log('✓ Passed Test 33: Insufficient user balance recorded chargeback liability without negative earnings.\n');

    // -------------------------------------------------------------------------
    // Test 34: Out-of-order reversal event (reversal arrives before original credit)
    // -------------------------------------------------------------------------
    console.log('Test 34: Out-of-order reversal event persists durable unmatched marker...');
    const user34 = {
        _id: '507f1f77bcf86cd799439034',
        username: 'user_test_34',
        taskEarningsBalance: 30.0,
        taskWalletBalance: 30.0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user34._id, user34);

    const tx34OutId = 'tr_tx_out_of_order_34';
    const salt34 = 'evt_test34_out_of_order';
    const url34 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt34}`;
    const hash34 = signWebhookUrl(url34);

    const req34 = {
        method: 'POST',
        rawUrl: `${url34}&hash=${hash34}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt34}&hash=${hash34}`,
        query: { enc_salt: salt34, hash: hash34 },
        body: {
            data: {
                api_key: trAppId,
                user_id: user34._id,
                event_type: 'reversal',
                external_transaction_id: tx34OutId
            }
        }
    };
    const res34 = createMockRes();
    await handleTheoremReachEventWebhook(req34, res34);
    assert.equal(res34.statusCode, 200, 'Unmatched reversal must return HTTP 200');
    assert.equal(user34.taskEarningsBalance, 30.0, 'User balance must remain unchanged without original credit');

    const markerTx34 = db.transactions.get(`theoremreach_${tx34OutId}_reversal`);
    assert.ok(markerTx34, 'Durable unmatched reversal marker must be persisted in transactions');
    assert.equal(markerTx34.amount, 0, 'Marker must record zero amount');
    console.log('✓ Passed Test 34: Out-of-order reversal safely persisted durable marker with zero balance mutation.\n');

    // -------------------------------------------------------------------------
    // Test 35: Subsequent credit arriving after out-of-order reversal marker
    // -------------------------------------------------------------------------
    console.log('Test 35: Subsequent credit arriving after out-of-order reversal is nullified...');
    // S2S reward callback arrives for tx34OutId
    const req35Credit = {
        params: { provider: 'theoremreach' },
        query: signTheoremReach({ user_id: user34._id, tx_id: tx34OutId, reward: '70' }, webhookSecret), // 70 units = $1.00 gross
        body: {},
        headers: {}
    };
    const res35Credit = createMockRes();
    await handlePostback(req35Credit, res35Credit);
    assert.equal(res35Credit.statusCode, 200);
    assert.equal(user34.taskEarningsBalance, 30.0, 'Subsequent credit must NOT increase balance after reversal marker');

    const creditTx35 = db.transactions.get(`theoremreach_${tx34OutId}_credit`);
    assert.equal(creditTx35, undefined, 'No credit transaction should be created for pre-reversed task');
    console.log('✓ Passed Test 35: Subsequent credit arriving after reversal marker was safely blocked at net zero.\n');

    // -------------------------------------------------------------------------
    // Test 36: Multiple transactions in reversed_transactions array
    // -------------------------------------------------------------------------
    console.log('Test 36: Multiple transactions in reversed_transactions array...');
    const user36 = {
        _id: '507f1f77bcf86cd799439036',
        username: 'user_test_36',
        taskEarningsBalance: 50.0,
        taskWalletBalance: 50.0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user36._id, user36);

    const tx36A = 'tr_multi_tx_36a';
    const tx36B = 'tr_multi_tx_36b';

    db.transactions.set(`theoremreach_${tx36A}_credit`, {
        _id: 'tx_cred_36a',
        userId: user36._id,
        userName: user36.username,
        offerwallProvider: 'theoremreach',
        externalTransactionId: tx36A,
        type: 'Offerwall Reward',
        amount: 3.0,
        userRewardAmount: 3.0,
        idempotencyKey: `theoremreach_${tx36A}_credit`,
        status: 'Approved'
    });

    db.transactions.set(`theoremreach_${tx36B}_credit`, {
        _id: 'tx_cred_36b',
        userId: user36._id,
        userName: user36.username,
        offerwallProvider: 'theoremreach',
        externalTransactionId: tx36B,
        type: 'Offerwall Reward',
        amount: 4.0,
        userRewardAmount: 4.0,
        idempotencyKey: `theoremreach_${tx36B}_credit`,
        status: 'Approved'
    });

    const salt36 = 'evt_test36_multi_rev';
    const url36 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt36}`;
    const hash36 = signWebhookUrl(url36);

    const req36 = {
        method: 'POST',
        rawUrl: `${url36}&hash=${hash36}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt36}&hash=${hash36}`,
        query: { enc_salt: salt36, hash: hash36 },
        body: {
            data: {
                api_key: trAppId,
                user_id: user36._id,
                event_type: 'reversal',
                reversed_transactions: [tx36A, tx36B]
            }
        }
    };
    const res36 = createMockRes();
    await handleTheoremReachEventWebhook(req36, res36);
    assert.equal(res36.statusCode, 200);
    assert.equal(user36.taskEarningsBalance, 43.0, 'Both credits deducted ($50 - $3 - $4 = $43)');
    assert.ok(db.transactions.get(`theoremreach_${tx36A}_reversal`), 'Reversal A created');
    assert.ok(db.transactions.get(`theoremreach_${tx36B}_reversal`), 'Reversal B created');
    console.log('✓ Passed Test 36: Multiple reversed_transactions in array processed cleanly.\n');

    // -------------------------------------------------------------------------
    // Test 37: Ban event handling (event_type: 'ban')
    // -------------------------------------------------------------------------
    console.log('Test 37: Ban event handling updates user status safely...');
    const user37 = {
        _id: '507f1f77bcf86cd799439037',
        username: 'user_test_37',
        taskEarningsBalance: 10.0,
        taskWalletBalance: 10.0,
        role: 'user',
        status: 'Active',
        restrictions: { earning: false, withdrawal: false },
        customFields: {}
    };
    db.users.set(user37._id, user37);

    const salt37 = 'evt_test37_ban';
    const url37 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt37}`;
    const hash37 = signWebhookUrl(url37);

    const req37 = {
        method: 'POST',
        rawUrl: `${url37}&hash=${hash37}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt37}&hash=${hash37}`,
        query: { enc_salt: salt37, hash: hash37 },
        body: {
            data: {
                api_key: trAppId,
                user_id: user37._id,
                event_type: 'ban',
                reason: 'Fraudulent survey responses detected'
            }
        }
    };
    const res37 = createMockRes();
    await handleTheoremReachEventWebhook(req37, res37);
    assert.equal(res37.statusCode, 200, 'Ban event must return HTTP 200');
    assert.equal(user37.status, 'Active', 'User global platform status must remain Active');
    assert.equal(user37.restrictions.earning, false, 'User global earning restriction must remain false');
    assert.equal(user37.restrictions.withdrawal, false, 'User global withdrawal restriction must remain false');
    assert.equal(user37.customFields.theoremreachBanned, true, 'Custom field theoremreachBanned set');
    console.log('✓ Passed Test 37: User ban event safely restricted to provider without blocking SmartExn account.\n');

    // -------------------------------------------------------------------------
    // Test 38: Unhandled event type & retryable failure handling with rollback
    // -------------------------------------------------------------------------
    console.log('Test 38: Unhandled event type and retryable failure handling with rollback...');
    // Part A: Unhandled event type safely records and returns 200
    const salt38A = 'evt_test38a_unhandled';
    const url38A = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt38A}`;
    const hash38A = signWebhookUrl(url38A);

    const req38A = {
        method: 'POST',
        rawUrl: `${url38A}&hash=${hash38A}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt38A}&hash=${hash38A}`,
        query: { enc_salt: salt38A, hash: hash38A },
        body: {
            data: {
                api_key: trAppId,
                event_type: 'survey_inventory_update',
                inventory_count: 50
            }
        }
    };
    const res38A = createMockRes();
    await handleTheoremReachEventWebhook(req38A, res38A);
    assert.equal(res38A.statusCode, 200, 'Unhandled event type must succeed safely with HTTP 200');
    assert.ok(db.webhookEvents.get(salt38A), 'Unhandled event is recorded in webhook events');

    // Part B: Database write constraint failure during transaction creation compensates balance and returns HTTP 500 (retryable)
    const user38B = {
        _id: '507f1f77bcf86cd799439038',
        username: 'user_test_38b',
        taskEarningsBalance: 40.0,
        taskWalletBalance: 40.0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user38B._id, user38B);

    const tx38BId = 'tr_tx_matched_38b';
    db.transactions.set(`theoremreach_${tx38BId}_credit`, {
        _id: 'tx_cred_38b',
        userId: user38B._id,
        userName: user38B.username,
        offerwallProvider: 'theoremreach',
        externalTransactionId: tx38BId,
        type: 'Offerwall Reward',
        amount: 10.0,
        userRewardAmount: 10.0,
        idempotencyKey: `theoremreach_${tx38BId}_credit`,
        status: 'Approved'
    });

    const salt38B = 'evt_test38b_failure';
    const url38B = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt38B}`;
    const hash38B = signWebhookUrl(url38B);

    simulateTxCreateFailure = true; // Trigger database write error on Transaction.create
    const req38B = {
        method: 'POST',
        rawUrl: `${url38B}&hash=${hash38B}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt38B}&hash=${hash38B}`,
        query: { enc_salt: salt38B, hash: hash38B },
        body: {
            data: {
                api_key: trAppId,
                user_id: user38B._id,
                event_type: 'reversal',
                external_transaction_id: tx38BId
            }
        }
    };
    const res38B = createMockRes();
    await handleTheoremReachEventWebhook(req38B, res38B);
    simulateTxCreateFailure = false; // Reset

    assert.equal(res38B.statusCode, 500, 'Transaction failure must return HTTP 500 for retryable failure');
    assert.equal(res38B.body.retryable, true, 'Retryable flag must be true');
    assert.equal(user38B.taskEarningsBalance, 40.0, 'User balance must be compensated back to $40.00 without balance leak');
    console.log('✓ Passed Test 38: Unhandled event handled safely and transaction error compensated with retryable HTTP 500.\n');

    // -------------------------------------------------------------------------
    // Test 39: Concurrent duplicate reversal / lock contention fails closed
    // -------------------------------------------------------------------------
    console.log('Test 39: Reversal lock contention fails closed without balance deduction...');
    const user39 = {
        _id: '507f1f77bcf86cd799439039',
        username: 'user_test_39',
        taskEarningsBalance: 100.0,
        taskWalletBalance: 100.0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user39._id, user39);

    const tx39Id = 'tr_lock_contend_tx39';
    db.transactions.set(`theoremreach_${tx39Id}_credit`, {
        _id: 'tx_cred_39',
        userId: user39._id,
        userName: user39.username,
        offerwallProvider: 'theoremreach',
        externalTransactionId: tx39Id,
        type: 'Offerwall Reward',
        amount: 10.0,
        userRewardAmount: 10.0,
        idempotencyKey: `theoremreach_${tx39Id}_credit`,
        status: 'Approved'
    });

    // Acquire external lock on this transaction to simulate active concurrent operation
    const simulatedExternalLock = await acquirePostbackLock('theoremreach', tx39Id);
    assert.ok(simulatedExternalLock, 'Simulated external process holds lock');

    const salt39 = 'evt_test39_contention';
    const url39 = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt39}`;
    const hash39 = signWebhookUrl(url39);

    const req39 = {
        method: 'POST',
        rawUrl: `${url39}&hash=${hash39}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt39}&hash=${hash39}`,
        query: { enc_salt: salt39, hash: hash39 },
        body: {
            data: {
                api_key: trAppId,
                user_id: user39._id,
                event_type: 'reversal',
                external_transaction_id: tx39Id
            }
        }
    };
    const res39Contended = createMockRes();
    await handleTheoremReachEventWebhook(req39, res39Contended);
    assert.equal(res39Contended.statusCode, 500, 'Webhook must fail with retryable 500 when transaction lock is contended');
    assert.equal(user39.taskEarningsBalance, 100.0, 'User balance must NOT be deducted when lock contention occurs');
    assert.equal(db.transactions.get(`theoremreach_${tx39Id}_reversal`), undefined, 'Reversal record must NOT be created during contention');

    // Release external lock and retry
    await releasePostbackLock('theoremreach', tx39Id, simulatedExternalLock);
    const res39Retried = createMockRes();
    await handleTheoremReachEventWebhook(req39, res39Retried);
    assert.equal(res39Retried.statusCode, 200, 'Webhook must succeed once lock contention resolves');
    assert.equal(user39.taskEarningsBalance, 90.0, 'User balance must be deducted after successful lock acquisition ($100 -> $90)');
    assert.ok(db.transactions.get(`theoremreach_${tx39Id}_reversal`), 'Reversal transaction successfully recorded');
    console.log('✓ Passed Test 39: Reversal lock contention fails closed without deduction, retry succeeds.\n');

    // -------------------------------------------------------------------------
    // Test 40: Exact raw URL query parameter ordering & encoding verification
    // -------------------------------------------------------------------------
    console.log('Test 40: Exact raw URL preserving query parameter ordering and encoding...');
    const salt40 = 'evt_exact_40';
    const rawUrl40WithoutHash = `https://smartexn.com/api/v1/postbacks/theoremreach/events?enc_salt=${salt40}&custom_tag=market%20research&version=2`;
    const hash40 = signWebhookUrl(rawUrl40WithoutHash);

    const req40 = {
        method: 'POST',
        rawUrl: `${rawUrl40WithoutHash}&hash=${hash40}`,
        originalUrl: `/api/v1/postbacks/theoremreach/events?enc_salt=${salt40}&custom_tag=market%20research&version=2&hash=${hash40}`,
        query: { enc_salt: salt40, custom_tag: 'market research', version: '2', hash: hash40 },
        body: {
            data: {
                api_key: trAppId,
                event_type: 'ping'
            }
        },
        headers: { host: 'smartexn.com' }
    };
    const res40 = createMockRes();
    await handleTheoremReachEventWebhook(req40, res40);
    assert.equal(res40.statusCode, 200, 'Exact raw URL preserving ordering & encoding must verify successfully');
    console.log('✓ Passed Test 40: Exact raw URL verification verified without altering query parameter ordering or encoding.\n');

    // -------------------------------------------------------------------------
    // Test 41: Normal reward callback regression test (S2S endpoint)
    // -------------------------------------------------------------------------
    console.log('Test 41: Normal TheoremReach S2S reward callback regression check...');
    // Restore provider secret for standard S2S postback controller tests
    const standardProvider = {
        _id: 'provider_theoremreach_std',
        providerKey: 'theoremreach',
        name: 'TheoremReach',
        enabled: true,
        status: 'ACTIVE',
        secretKey: testSecret,
        postbackKey: testSecret,
        exchangeRateMultiplier: 70.0,
        commissionMode: 'smartexn_managed',
        userRevenueSharePercent: 70,
        platformRevenueSharePercent: 30
    };
    db.providers.set('theoremreach', standardProvider);

    const user41 = {
        _id: '507f1f77bcf86cd799439041',
        username: 'user_test_41',
        taskEarningsBalance: 0,
        taskWalletBalance: 0,
        role: 'user',
        status: 'Active'
    };
    db.users.set(user41._id, user41);

    // 700 coins / 70 multiplier = $10.00 gross -> $7.00 user reward (70% share)
    const req41S2S = {
        params: { provider: 'theoremreach' },
        query: signTheoremReach({ user_id: user41._id, tx_id: 'tr_tx_std_regression_41', reward: '700' }, testSecret),
        body: {},
        headers: {}
    };
    const res41S2S = createMockRes();
    await handlePostback(req41S2S, res41S2S);
    assert.equal(res41S2S.statusCode, 200, 'Standard S2S reward callback must return HTTP 200');
    assert.equal(user41.taskEarningsBalance, 7.0, 'User earnings balance credited with $7.00 (70% of $10 gross)');
    const tx41 = db.transactions.get('theoremreach_tr_tx_std_regression_41_credit');
    assert.ok(tx41, 'Credit transaction created');
    assert.equal(tx41.grossAmount, 10.0, 'Gross amount $10.00 correctly calculated');
    assert.equal(tx41.userRewardAmount, 7.0, 'User reward $7.00 correctly calculated');
    assert.equal(tx41.platformRevenueAmount, 3.0, 'Platform revenue $3.00 correctly retained');
    console.log('✓ Passed Test 41: Standard TheoremReach S2S reward callback regression confirmed 100% intact.\n');

    console.log('========================================================================');
    console.log('All Comprehensive TheoremReach & Security Tests PASSED Successfully!');
    console.log('========================================================================\n');
}

runTests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});

