import assert from 'node:assert/strict';
import crypto from 'crypto';
import { handlePostback, updateOfferwallProvider, acquirePostbackLock, releasePostbackLock, isLockStillOwned } from './backend/controllers/postbackController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import Notification from './backend/models/Notification.js';
import OfferwallPostbackLock from './backend/models/OfferwallPostbackLock.js';

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
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.notifications.clear();
        this.locks.clear();
    }
}

const db = new MockDb();

// Override Mongoose model methods
User.findById = async (id) => db.users.get(String(id)) || null;
User.findOne = async (query) => {
    if (query.username) {
        for (const u of db.users.values()) {
            if (u.username === query.username) return u;
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
    return user;
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
            const updated = { ...p };
            if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) {
                    updated[k] = (updated[k] || 0) + v;
                }
            }
            db.providers.set(key, updated);
            return updated;
        }
    }
    return null;
};

OfferwallPostbackLog.countDocuments = async () => 0;

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

    console.log('========================================================================');
    console.log('All Comprehensive TheoremReach & Security Tests PASSED Successfully!');
    console.log('========================================================================\n');
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
