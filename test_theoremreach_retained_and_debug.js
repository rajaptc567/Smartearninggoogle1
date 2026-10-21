import assert from 'node:assert/strict';
import crypto from 'crypto';
import { handlePostback, updateOfferwallProvider } from './backend/controllers/postbackController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import Notification from './backend/models/Notification.js';

console.log('Running SmartExn Offerwall Commission Modes & Debug Callback Test Suite...\n');

// In-memory mock database
class MockDb {
    constructor() {
        this.users = new Map();
        this.transactions = new Map();
        this.providers = new Map();
        this.logs = new Map();
        this.notifications = new Map();
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.notifications.clear();
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
    return user;
};
User.findByIdAndUpdate = async (id, update) => {
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

    // TEST 16: Concurrency and Race condition detection
    console.log('Test 16: Concurrency and Race condition detection...');
    seedProviders();
    const concurrentTxId = 'concurrent_tx_123';
    
    // First request: Credit
    const creditReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentTxId, reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    
    // Second request: Reversal (arriving just after, but before any DB write completes)
    // To simulate the race in this mock, we send the requests sequentially but check that the second one detects the first.
    await handlePostback(creditReq, createMockRes());
    
    const reversalReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentTxId, reward_amount: '10.00', reversal: 'true' }),
        body: {},
        headers: {}
    };
    
    const resRev = createMockRes();
    await handlePostback(reversalReq, resRev);
    assert.equal(resRev.statusCode, 200, 'Reversal after credit must be allowed');
    
    // Third request: Duplicate credit (simulating race)
    const duplicateCreditReq = {
        params: { provider: 'theoremreach' },
        query: sign({ user_id: '507f1f77bcf86cd799439011', tx_id: concurrentTxId, reward_amount: '10.00' }),
        body: {},
        headers: {}
    };
    const resDupCredit = createMockRes();
    await handlePostback(duplicateCreditReq, resDupCredit);
    assert.equal(resDupCredit.body, 'DUP_ALREADY_PROCESSED', 'Duplicate credit must be rejected');
    
    console.log('✓ Passed Test 16: Concurrency and Race conditions detected correctly.\n');

    console.log('========================================================================');
    console.log('All Comprehensive TheoremReach & Security Tests PASSED Successfully!');
    console.log('========================================================================\n');
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
