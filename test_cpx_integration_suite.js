import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
    verifySignature,
    constructCpxEntryUrl,
    handlePostback,
    getOfferwallProviders
} from './backend/controllers/postbackController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import Notification from './backend/models/Notification.js';
import OfferwallPostbackLock from './backend/models/OfferwallPostbackLock.js';

console.log('Running Production-Path CPX Research Integration & Safety Suite...\n');

// ============================================================================
// IN-MEMORY DATABASE HARNESS (Zero real wallet/DB mutations)
// ============================================================================
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

// Save original model methods
const origUserFindById = User.findById;
const origUserFindOne = User.findOne;
const origUserFindOneAndUpdate = User.findOneAndUpdate;
const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

const origTxFindOne = Transaction.findOne;
const origTxCreate = Transaction.create;
const origTxDeleteOne = Transaction.deleteOne;

const origProviderFind = OfferwallProvider.find;
const origProviderFindOne = OfferwallProvider.findOne;
const origProviderFindOneAndUpdate = OfferwallProvider.findOneAndUpdate;
const origProviderFindByIdAndUpdate = OfferwallProvider.findByIdAndUpdate;

const origNotificationCreate = Notification.create;
const origLogSave = OfferwallPostbackLog.prototype.save;
const origLogCountDocuments = OfferwallPostbackLog.countDocuments;

const origLockCreate = OfferwallPostbackLock.create;
const origLockFindOne = OfferwallPostbackLock.findOne;
const origLockDeleteOne = OfferwallPostbackLock.deleteOne;
const origLockFindOneAndUpdate = OfferwallPostbackLock.findOneAndUpdate;

// Attach in-memory stubs
User.findById = async (id) => {
    return db.users.get(String(id)) || null;
};

User.findOne = async (query) => {
    if (query._id) return db.users.get(String(query._id)) || null;
    if (query.username) {
        for (const u of db.users.values()) {
            if (u.username === query.username) return u;
        }
    }
    return null;
};

User.findOneAndUpdate = async (filter, update, options) => {
    const user = await User.findById(filter._id);
    if (!user) return null;
    if (filter.status?.$ne && user.status === filter.status.$ne) return null;
    if (filter['restrictions.earning']?.$ne && user.restrictions?.earning === true) return null;

    if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
            user[k] = Number(((user[k] || 0) + v).toFixed(4));
        }
    }
    db.users.set(String(user._id), user);
    return user;
};

User.findByIdAndUpdate = async (id, update, options) => {
    const user = await User.findById(id);
    if (!user) return null;
    if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
            user[k] = Number(((user[k] || 0) + v).toFixed(4));
        }
    }
    db.users.set(String(user._id), user);
    return user;
};

Transaction.findOne = async (query) => {
    if (query.idempotencyKey) {
        for (const tx of db.transactions.values()) {
            if (tx.idempotencyKey === query.idempotencyKey) return tx;
        }
    }
    if (query.offerwallProvider && query.externalTransactionId && query.type) {
        for (const tx of db.transactions.values()) {
            if (tx.offerwallProvider === query.offerwallProvider &&
                tx.externalTransactionId === query.externalTransactionId &&
                tx.type === query.type) {
                return tx;
            }
        }
    }
    return null;
};

Transaction.create = async (txData) => {
    if (txData.idempotencyKey) {
        for (const tx of db.transactions.values()) {
            if (tx.idempotencyKey === txData.idempotencyKey) {
                const err = new Error('Duplicate key violation');
                err.code = 11000;
                throw err;
            }
        }
    }
    const id = txData._id || `tx_${Date.now()}_${Math.random()}`;
    const record = { ...txData, _id: id };
    db.transactions.set(String(id), record);
    return record;
};

Transaction.deleteOne = async (query) => {
    if (query._id) {
        const deleted = db.transactions.delete(String(query._id));
        return { deletedCount: deleted ? 1 : 0 };
    }
    return { deletedCount: 0 };
};

OfferwallProvider.findOne = async (query) => {
    const key = query.providerKey?.toLowerCase();
    if (!key) return null;
    return db.providers.get(key) || null;
};

OfferwallProvider.findByIdAndUpdate = async (id, update) => {
    return { _id: id };
};

OfferwallProvider.findOneAndUpdate = async (filter, update) => {
    return { _id: 'cpx_prov_id' };
};

OfferwallProvider.find = (filter = {}) => {
    let list = Array.from(db.providers.values());
    if (filter.enabled !== undefined) {
        list = list.filter(p => p.enabled === filter.enabled);
    }
    if (filter.status?.$nin) {
        list = list.filter(p => !filter.status.$nin.includes(p.status));
    }
    return {
        sort: () => Promise.resolve(list.map(p => ({
            ...p,
            toObject: () => ({ ...p })
        })))
    };
};

Notification.create = async (notifData) => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    const record = { ...notifData, _id: id };
    db.notifications.set(id, record);
    return record;
};

OfferwallPostbackLog.prototype.save = async function () {
    const id = this._id || `log_${Date.now()}_${Math.random()}`;
    db.logs.set(String(id), this);
    return this;
};

OfferwallPostbackLog.countDocuments = async () => 0;

OfferwallPostbackLock.create = async (lockData) => {
    const key = `${lockData.providerKey}:${lockData.externalTxId}`;
    if (db.locks.has(key)) {
        const err = new Error('Lock already held');
        err.code = 11000;
        throw err;
    }
    db.locks.set(key, lockData);
    return lockData;
};

OfferwallPostbackLock.findOne = async (query) => {
    const key = `${query.providerKey}:${query.externalTxId}`;
    return db.locks.get(key) || null;
};

OfferwallPostbackLock.deleteOne = async (query) => {
    const key = `${query.providerKey}:${query.externalTxId}`;
    const deleted = db.locks.delete(key);
    return { deletedCount: deleted ? 1 : 0 };
};

OfferwallPostbackLock.findOneAndUpdate = async (query, update) => {
    const key = `${query.providerKey}:${query.externalTxId}`;
    const existing = db.locks.get(key);
    if (!existing) return null;
    Object.assign(existing, update.$set || update);
    return existing;
};

function createMockReq(providerKey, queryParams = {}, ip = '127.0.0.1') {
    return {
        params: { provider: providerKey },
        query: queryParams,
        body: {},
        headers: {
            'user-agent': 'CPX Research Postback Engine',
            'x-forwarded-for': ip
        },
        ip: ip,
        socket: { remoteAddress: ip }
    };
}

function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(b) {
            this.body = b;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        }
    };
}

// ============================================================================
// BASE PROVIDER AND USER SETUP
// ============================================================================
const cpxSecret = 'cpx_secret_key_prod_path_999';
const testUserId = '65e2b0f49c2a8f0012ab34cd';

const baseCpxProvider = {
    _id: 'cpx_prov_123',
    providerKey: 'cpx_research',
    name: 'CPX Research',
    requireSignature: true,
    signatureType: 'md5',
    secretKey: cpxSecret,
    postbackKey: '',
    appId: '37470',
    enabled: true,
    status: 'ACTIVE',
    commissionMode: 'smartexn_managed',
    userRevenueSharePercent: 70,
    platformRevenueSharePercent: 30,
    exchangeRateMultiplier: 1.0,
    customConfig: { currency: 'USD' },
    iframeUrlTemplate: 'https://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}'
};

const baseUser = {
    _id: testUserId,
    username: 'worker_cpx_test',
    email: 'worker@smartexn.com',
    status: 'Active',
    taskEarningsBalance: 10.00,
    taskWalletBalance: 10.00,
    restrictions: { earning: false }
};

// ============================================================================
// SECTION 1: SIGNATURE VERIFICATION PRODUCTION PATH
// ============================================================================
console.log('--- Section 1: Signature Verification Production Path ---');
{
    const txId = 'tx_sig_test_1';
    const validHash = crypto.createHash('md5').update(`${txId}-${cpxSecret}`).digest('hex');

    // 1a: Hash under 'hash'
    const res1 = verifySignature(baseCpxProvider, { trans_id: txId, hash: validHash }, '127.0.0.1');
    assert.strictEqual(res1.valid, true, '1a: signature under hash must be valid');

    // 1b: Hash under 'secure_hash'
    const res2 = verifySignature(baseCpxProvider, { trans_id: txId, secure_hash: validHash }, '127.0.0.1');
    assert.strictEqual(res2.valid, true, '1b: signature under secure_hash must be valid');

    // 1c: Hash under 'signature'
    const res3 = verifySignature(baseCpxProvider, { trans_id: txId, signature: validHash }, '127.0.0.1');
    assert.strictEqual(res3.valid, true, '1c: signature under signature must be valid');

    // 1d: Missing signature fails closed
    const resMissing = verifySignature(baseCpxProvider, { trans_id: txId }, '127.0.0.1');
    assert.strictEqual(resMissing.valid, false, '1d: missing signature must fail');
    assert.strictEqual(resMissing.error, 'CPX signature missing');

    // 1e: Tampered signature fails closed
    const resTampered = verifySignature(baseCpxProvider, { trans_id: txId, secure_hash: 'tampered_hash_value' }, '127.0.0.1');
    assert.strictEqual(resTampered.valid, false, '1e: tampered signature must fail');
    assert.strictEqual(resTampered.error, 'CPX signature mismatch');

    console.log('✓ Section 1 Passed: Signature Aliases, Missing & Tampered Fail Closed.');
}

// ============================================================================
// SECTION 2: ENTRY HASH SECURITY & MANDATORY GENERATION
// ============================================================================
console.log('--- Section 2: Entry Hash Security & Mandatory Generation ---');
{
    // 2a: Valid URL generation
    const resUrl = constructCpxEntryUrl(baseCpxProvider, testUserId);
    assert.strictEqual(resUrl.error, null, '2a: valid entry url construction succeeds');
    const expectedHash = crypto.createHash('md5').update(`${testUserId}-${cpxSecret}`).digest('hex');
    assert.strictEqual(resUrl.url.includes(`app_id=37470`), true, '2a: contains app_id');
    assert.strictEqual(resUrl.url.includes(`ext_user_id=${testUserId}`), true, '2a: contains ext_user_id');
    assert.strictEqual(resUrl.url.includes(`secure_hash=${expectedHash}`), true, '2a: contains secure_hash');

    // 2b: Secret key NEVER exposed in cleartext in generated URL
    assert.strictEqual(resUrl.url.includes(cpxSecret), false, '2b: private secretKey must never be exposed');

    // 2c: Secure hash remains MANDATORY even when requireSignature is explicitly false
    const noSigProvider = { ...baseCpxProvider, requireSignature: false };
    const resNoSig = constructCpxEntryUrl(noSigProvider, testUserId);
    assert.strictEqual(resNoSig.error, null, '2c: generates URL without error');
    assert.strictEqual(resNoSig.url.includes(`secure_hash=${expectedHash}`), true,
        '2c: secure_hash must still be generated when requireSignature is false');

    // 2d: Missing secretKey fails closed even when requireSignature is false
    const missingSecretProvider = { ...baseCpxProvider, secretKey: '', requireSignature: false };
    const resFailSecret = constructCpxEntryUrl(missingSecretProvider, testUserId);
    assert.strictEqual(resFailSecret.url, '', '2d: missing secretKey must return empty URL');
    assert.strictEqual(resFailSecret.error.includes('Secure Hash Key is missing'), true,
        '2d: must return descriptive error for missing secretKey');

    // 2e: Missing appId fails closed
    const missingAppIdProvider = { ...baseCpxProvider, appId: '' };
    const resFailAppId = constructCpxEntryUrl(missingAppIdProvider, testUserId);
    assert.strictEqual(resFailAppId.url, '', '2e: missing appId must return empty URL');
    assert.strictEqual(resFailAppId.error.includes('App ID is not configured'), true);

    console.log('✓ Section 2 Passed: Entry Hash Security & Unconditionally Mandatory Secure Hash.');
}

// ============================================================================
// SECTION 3: REWARD ACCOUNTING FAIL-CLOSED IN PRODUCTION handlePostback
// ============================================================================
console.log('--- Section 3: Reward Accounting Fail-Closed in handlePostback ---');
async function runSection3() {
    // Test 3a: provider_managed mode MUST require amount_local (missing amount_local fails closed)
    db.clear();
    const provManaged = {
        ...baseCpxProvider,
        commissionMode: 'provider_managed',
        customConfig: { currency: 'USD' }
    };
    db.providers.set('cpx_research', provManaged);
    db.users.set(testUserId, { ...baseUser });

    const txId3a = 'cpx_tx_3a';
    const hash3a = crypto.createHash('md5').update(`${txId3a}-${cpxSecret}`).digest('hex');
    // Callback sends amount_usd but NO amount_local in provider_managed mode
    const req3a = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId3a,
        amount_usd: '1.50',
        // amount_local omitted!
        secure_hash: hash3a
    });
    const res3a = createMockRes();
    await handlePostback(req3a, res3a);

    assert.strictEqual(res3a.statusCode, 400, '3a: missing amount_local must return HTTP 400');
    assert.strictEqual(res3a.body, 'MISSING_AMOUNT_LOCAL', '3a: error code MISSING_AMOUNT_LOCAL');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.00, '3a: user balance must NOT be mutated');
    assert.strictEqual(db.transactions.size, 0, '3a: no financial transaction created');

    // Test 3b: smartexn_managed mode MUST require amount_usd (missing amount_usd fails closed)
    db.clear();
    const smartexnManaged = {
        ...baseCpxProvider,
        commissionMode: 'smartexn_managed',
        customConfig: { currency: 'USD' }
    };
    db.providers.set('cpx_research', smartexnManaged);
    db.users.set(testUserId, { ...baseUser });

    const txId3b = 'cpx_tx_3b';
    const hash3b = crypto.createHash('md5').update(`${txId3b}-${cpxSecret}`).digest('hex');
    // Callback sends amount_local but NO amount_usd in smartexn_managed mode
    const req3b = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId3b,
        amount_local: '0.70',
        // amount_usd omitted!
        secure_hash: hash3b
    });
    const res3b = createMockRes();
    await handlePostback(req3b, res3b);

    assert.strictEqual(res3b.statusCode, 400, '3b: missing amount_usd must return HTTP 400');
    assert.strictEqual(res3b.body, 'MISSING_AMOUNT_USD', '3b: error code MISSING_AMOUNT_USD');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.00, '3b: user balance must NOT be mutated');
    assert.strictEqual(db.transactions.size, 0, '3b: no financial transaction created');

    // Test 3c: Invalid numeric values fail closed (non-numeric, NaN, negative, non-finite, empty string)
    const invalidValues = ['abc', 'NaN', '-5.0', 'Infinity', '   '];
    for (const val of invalidValues) {
        const txIdInv = `cpx_tx_inv_${val.trim()}`;
        const hashInv = crypto.createHash('md5').update(`${txIdInv}-${cpxSecret}`).digest('hex');
        const reqInv = createMockReq('cpx_research', {
            user_id: testUserId,
            trans_id: txIdInv,
            amount_usd: val,
            secure_hash: hashInv
        });
        const resInv = createMockRes();
        await handlePostback(reqInv, resInv);

        assert.strictEqual(resInv.statusCode, 400, `3c: invalid amount_usd '${val}' must return HTTP 400`);
        assert.strictEqual(resInv.body.includes('INVALID_AMOUNT_USD') || resInv.body.includes('MISSING_AMOUNT_USD'), true,
            `3c: error code for invalid amount '${val}'`);
        assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.00, `3c: zero wallet mutations for '${val}'`);
    }

    console.log('✓ Section 3 Passed: Amount Fail-Closed & Malformed Payout Rejections.');
}

// ============================================================================
// SECTION 4: CURRENCY VALIDATION & CONVERSION CONFIGURATION
// ============================================================================
console.log('--- Section 4: Currency Validation & Conversion Configuration ---');
async function runSection4() {
    // 4a: Missing / invalid exchangeRateMultiplier fails closed
    db.clear();
    const badRateProvider = {
        ...baseCpxProvider,
        exchangeRateMultiplier: 0 // invalid
    };
    db.providers.set('cpx_research', badRateProvider);
    db.users.set(testUserId, { ...baseUser });

    const txId4a = 'cpx_tx_4a';
    const hash4a = crypto.createHash('md5').update(`${txId4a}-${cpxSecret}`).digest('hex');
    const req4a = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId4a,
        amount_usd: '1.00',
        secure_hash: hash4a
    });
    const res4a = createMockRes();
    await handlePostback(req4a, res4a);

    assert.strictEqual(res4a.statusCode, 400, '4a: invalid exchangeRateMultiplier must return HTTP 400');
    assert.strictEqual(res4a.body, 'CPX_EXCHANGE_RATE_NOT_CONFIGURED', '4a: error code CPX_EXCHANGE_RATE_NOT_CONFIGURED');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.00, '4a: balance untouched');

    // 4b: provider_managed mode with UNCONFIGURED currency fails closed (cannot assume USD)
    db.clear();
    const noCurrencyProvider = {
        ...baseCpxProvider,
        commissionMode: 'provider_managed',
        customConfig: {} // no currency!
    };
    db.providers.set('cpx_research', noCurrencyProvider);
    db.users.set(testUserId, { ...baseUser });

    const txId4b = 'cpx_tx_4b';
    const hash4b = crypto.createHash('md5').update(`${txId4b}-${cpxSecret}`).digest('hex');
    const req4b = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId4b,
        amount_local: '0.70',
        secure_hash: hash4b
        // currency omitted
    });
    const res4b = createMockRes();
    await handlePostback(req4b, res4b);

    assert.strictEqual(res4b.statusCode, 400, '4b: unconfigured currency must return HTTP 400');
    assert.strictEqual(res4b.body, 'CPX_CURRENCY_NOT_CONFIGURED', '4b: error code CPX_CURRENCY_NOT_CONFIGURED');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.00, '4b: balance untouched');

    // 4c: Currency mismatch between configured and callback fails closed
    db.clear();
    const usdConfigProvider = {
        ...baseCpxProvider,
        commissionMode: 'provider_managed',
        customConfig: { currency: 'USD' }
    };
    db.providers.set('cpx_research', usdConfigProvider);
    db.users.set(testUserId, { ...baseUser });

    const txId4c = 'cpx_tx_4c';
    const hash4c = crypto.createHash('md5').update(`${txId4c}-${cpxSecret}`).digest('hex');
    const req4c = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId4c,
        amount_local: '0.70',
        currency: 'EUR', // Mismatch!
        secure_hash: hash4c
    });
    const res4c = createMockRes();
    await handlePostback(req4c, res4c);

    assert.strictEqual(res4c.statusCode, 400, '4c: currency mismatch must return HTTP 400');
    assert.strictEqual(res4c.body, 'CPX_CURRENCY_MISMATCH', '4c: error code CPX_CURRENCY_MISMATCH');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.00, '4c: balance untouched');

    console.log('✓ Section 4 Passed: Currency Validation & Conversion Multiplier Guards.');
}

// ============================================================================
// SECTION 5: DUPLICATE CALLBACK IDEMPOTENCY & VALID CREDITING
// ============================================================================
console.log('--- Section 5: Duplicate Callback Idempotency & Valid Crediting ---');
async function runSection5() {
    db.clear();
    db.providers.set('cpx_research', { ...baseCpxProvider });
    db.users.set(testUserId, { ...baseUser });

    const txId5 = 'cpx_tx_valid_idempotency_5';
    const hash5 = crypto.createHash('md5').update(`${txId5}-${cpxSecret}`).digest('hex');

    // First genuine postback: gross $1.00 USD, 70% share = $0.70 to user
    const reqFirst = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId5,
        amount_usd: '1.00',
        amount_local: '0.70',
        secure_hash: hash5
    });
    const resFirst = createMockRes();
    await handlePostback(reqFirst, resFirst);

    assert.strictEqual(resFirst.statusCode, 200, '5a: genuine postback accepted with HTTP 200');
    assert.strictEqual(resFirst.body, '1', '5a: CPX expected response is 1');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.70, '5a: user balance credited exactly $0.70');
    assert.strictEqual(db.transactions.size, 1, '5a: exactly 1 financial transaction created');

    // Second identical postback (duplicate replay)
    const reqDup = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId5,
        amount_usd: '1.00',
        amount_local: '0.70',
        secure_hash: hash5
    });
    const resDup = createMockRes();
    await handlePostback(reqDup, resDup);

    assert.strictEqual(resDup.statusCode, 200, '5b: duplicate postback acknowledged with HTTP 200');
    assert.strictEqual(resDup.body, '1', '5b: duplicate returns 1');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.70, '5b: balance must NOT be double-credited');
    assert.strictEqual(db.transactions.size, 1, '5b: transaction count remains exactly 1');

    console.log('✓ Section 5 Passed: Genuine Crediting & Duplicate Postback Idempotency.');
}

// ============================================================================
// SECTION 6: EVENT TYPES, REVERSALS & ZERO-VALUE SCREEN-OUTS
// ============================================================================
console.log('--- Section 6: Event Types, Reversals & Zero-Value Screen-Outs ---');
async function runSection6() {
    db.clear();
    db.providers.set('cpx_research', { ...baseCpxProvider });
    db.users.set(testUserId, { ...baseUser });

    // 6a: Zero-value screen-out bypass (type=out, reward=0) acknowledged safely with ZERO balance mutation
    const txId6a = 'cpx_tx_screenout_zero';
    const hash6a = crypto.createHash('md5').update(`${txId6a}-${cpxSecret}`).digest('hex');
    const req6a = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId6a,
        amount_usd: '0',
        amount: '0',
        type: 'out',
        secure_hash: hash6a
    });
    const res6a = createMockRes();
    await handlePostback(req6a, res6a);

    assert.strictEqual(res6a.statusCode, 200, '6a: zero screen-out acknowledged');
    assert.strictEqual(res6a.body, '1', '6a: returns 1');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.00, '6a: zero balance mutation');
    assert.strictEqual(db.transactions.size, 0, '6a: zero transactions');

    // 6b: Positive screen-out consolation (type=out, amount_usd=0.05) credited with distinguished copy
    const txId6b = 'cpx_tx_screenout_consolation';
    const hash6b = crypto.createHash('md5').update(`${txId6b}-${cpxSecret}`).digest('hex');
    const req6b = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId6b,
        amount_usd: '0.05',
        type: 'out',
        secure_hash: hash6b
    });
    const res6b = createMockRes();
    await handlePostback(req6b, res6b);

    assert.strictEqual(res6b.statusCode, 200, '6b: screenout consolation accepted');
    // 70% of $0.05 is $0.035
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.035, '6b: consolation credited');

    // 6c: Rating bonus (type=bonus, amount_usd=0.10) credited with bonus copy
    const txId6c = 'cpx_tx_bonus';
    const hash6c = crypto.createHash('md5').update(`${txId6c}-${cpxSecret}`).digest('hex');
    const req6c = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId6c,
        amount_usd: '0.10',
        type: 'bonus',
        secure_hash: hash6c
    });
    const res6c = createMockRes();
    await handlePostback(req6c, res6c);

    assert.strictEqual(res6c.statusCode, 200, '6c: rating bonus accepted');

    // 6d: Unsupported event type acknowledged safely without crediting
    const txId6d = 'cpx_tx_unsupported';
    const hash6d = crypto.createHash('md5').update(`${txId6d}-${cpxSecret}`).digest('hex');
    const req6d = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId6d,
        amount_usd: '1.00',
        type: 'fraud_disqualify',
        secure_hash: hash6d
    });
    const res6d = createMockRes();
    const balanceBefore6d = db.users.get(testUserId).taskEarningsBalance;
    await handlePostback(req6d, res6d);

    assert.strictEqual(res6d.statusCode, 200, '6d: unsupported event acknowledged');
    assert.strictEqual(res6d.body, '1', '6d: returns 1');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, balanceBefore6d, '6d: zero balance mutation');

    // 6e: Reversal (status=2) correctly debits and creates reversal record
    const origBalance = db.users.get(testUserId).taskEarningsBalance;
    const txId6e = 'cpx_tx_reversal_test';
    const hash6e = crypto.createHash('md5').update(`${txId6e}-${cpxSecret}`).digest('hex');

    // First credit
    const reqCredit = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId6e,
        amount_usd: '1.00',
        status: '1',
        secure_hash: hash6e
    });
    await handlePostback(reqCredit, createMockRes());
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, origBalance + 0.70);

    // Reversal of txId6e
    const reqRev = createMockReq('cpx_research', {
        user_id: testUserId,
        trans_id: txId6e,
        amount_usd: '1.00',
        status: '2',
        secure_hash: hash6e
    });
    const resRev = createMockRes();
    await handlePostback(reqRev, resRev);

    assert.strictEqual(resRev.statusCode, 200, '6e: reversal accepted');
    assert.strictEqual(resRev.body, '1', '6e: returns 1');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, origBalance, '6e: balance safely reversed');

    console.log('✓ Section 6 Passed: Event Types (complete, out, bonus, unsupported) & Reversals.');
}

// ============================================================================
// SECTION 7: CPX PUBLIC VISIBILITY GATE IN PRODUCTION getOfferwallProviders
// ============================================================================
console.log('--- Section 7: CPX Public Visibility Gate in getOfferwallProviders ---');
async function runSection7() {
    db.clear();

    const sampleProviders = [
        { providerKey: 'cpx_research', name: 'CPX Research', enabled: true, status: 'NOT_STARTED', appId: '37470', secretKey: cpxSecret },
        { providerKey: 'cpx_research', name: 'CPX Research', enabled: true, status: 'TESTING', appId: '37470', secretKey: cpxSecret },
        { providerKey: 'cpx_research', name: 'CPX Research', enabled: true, status: 'SANDBOX', appId: '37470', secretKey: cpxSecret },
        { providerKey: 'cpx_research', name: 'CPX Research', enabled: true, status: 'CREDENTIALS_PENDING', appId: '37470', secretKey: cpxSecret },
        { providerKey: 'cpx_research', name: 'CPX Research', enabled: true, status: 'PRODUCTION_READY', appId: '37470', secretKey: cpxSecret },
        { providerKey: 'cpx_research', name: 'CPX Research', enabled: false, status: 'ACTIVE', appId: '37470', secretKey: cpxSecret },
        { providerKey: 'cpx_research', name: 'CPX Research', enabled: true, status: 'ACTIVE', appId: '37470', secretKey: cpxSecret, iframeUrlTemplate: 'https://offers.cpx-research.com/?app_id={appId}&uid={userId}' },
        { providerKey: 'theoremreach', name: 'TheoremReach', enabled: true, status: 'ACTIVE', apiKey: 'tr_key', appId: 'tr_app', secretKey: 'tr_sec', requireSignature: false },
        { providerKey: 'torox', name: 'Torox', enabled: true, status: 'TESTING', appId: 'torox_app' }
    ];

    // Store in db.providers
    sampleProviders.forEach((p, idx) => {
        db.providers.set(`${p.providerKey}_${idx}`, p);
    });

    // Worker / Public request (non-admin)
    const workerReq = { user: { id: testUserId, role: 'user' } };
    const workerRes = createMockRes();
    await getOfferwallProviders(workerReq, workerRes);

    assert.strictEqual(workerRes.statusCode, 200, '7a: public getOfferwallProviders succeeds');
    const publicList = workerRes.jsonData.data;

    const visibleCpx = publicList.filter(p => p.providerKey === 'cpx_research');
    assert.strictEqual(visibleCpx.length, 1, '7b: exactly 1 CPX provider visible (only enabled=true and status=ACTIVE)');
    assert.strictEqual(visibleCpx[0].status, 'ACTIVE', '7c: visible CPX has status ACTIVE');
    assert.strictEqual(visibleCpx[0].enabled, true, '7d: visible CPX has enabled true');
    assert.strictEqual(Boolean(visibleCpx[0].iframeUrl), true, '7e: visible CPX has generated iframeUrl');

    // Other providers (e.g. Torox in TESTING) remain visible according to their existing rules
    const visibleTorox = publicList.find(p => p.providerKey === 'torox');
    assert.strictEqual(Boolean(visibleTorox), true, '7f: Torox in TESTING remains visible under its rules');

    // Admin sees ALL providers
    const adminReq = { user: { id: 'admin_id', role: 'admin' } };
    const adminRes = createMockRes();
    await getOfferwallProviders(adminReq, adminRes);
    assert.strictEqual(adminRes.statusCode, 200, '7g: admin request succeeds');
    assert.strictEqual(adminRes.jsonData.data.length, sampleProviders.length, '7h: admin sees all providers');

    console.log('✓ Section 7 Passed: Production CPX Public Visibility Gate & Admin Isolation.');
}

// ============================================================================
// SECTION 8: THEOREMREACH & OTHER PROVIDER ISOLATION
// ============================================================================
console.log('--- Section 8: TheoremReach & Provider Isolation ---');
async function runSection8() {
    db.clear();
    const trSecret = 'tr_secret_iso_123';
    const trProvider = {
        providerKey: 'theoremreach',
        name: 'TheoremReach',
        apiKey: 'tr_api_123',
        appId: 'tr_app_123',
        secretKey: trSecret,
        requireSignature: true,
        signatureType: 'hmac_sha1',
        exchangeRateMultiplier: 70.0, // 70 points = $1 USD
        commissionMode: 'smartexn_managed',
        userRevenueSharePercent: 70,
        enabled: true,
        status: 'ACTIVE'
    };
    db.providers.set('theoremreach', trProvider);
    db.users.set(testUserId, { ...baseUser });

    // TheoremReach postback: 70 points reward -> $1.00 gross -> 70% user share = $0.70
    const trTxId = 'tr_iso_tx_888';
    const rawUrl = `https://smartexn.com/api/v1/postbacks/theoremreach?user_id=${testUserId}&transaction_id=${trTxId}&reward=70`;
    const hmac = crypto.createHmac('sha1', trSecret).update(rawUrl).digest('base64');
    const trSig = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const trReq = createMockReq('theoremreach', {
        user_id: testUserId,
        transaction_id: trTxId,
        reward: '70',
        sig: trSig
    });
    const trRes = createMockRes();
    await handlePostback(trReq, trRes);

    assert.strictEqual(trRes.statusCode, 200, '8a: TheoremReach postback accepted');
    assert.strictEqual(trRes.body, 'OK', '8b: TheoremReach returns OK');
    assert.strictEqual(db.users.get(testUserId).taskEarningsBalance, 10.70, '8c: TheoremReach correctly credited $0.70');
    assert.strictEqual(db.transactions.size, 1, '8d: TheoremReach created 1 transaction');

    console.log('✓ Section 8 Passed: TheoremReach & Other Providers Fully Isolated.');
}

// ============================================================================
// RUN ALL ASYNC TEST SECTIONS
// ============================================================================
async function runAll() {
    await runSection3();
    await runSection4();
    await runSection5();
    await runSection6();
    await runSection7();
    await runSection8();

    // Restore original model methods
    User.findById = origUserFindById;
    User.findOne = origUserFindOne;
    User.findOneAndUpdate = origUserFindOneAndUpdate;
    User.findByIdAndUpdate = origUserFindByIdAndUpdate;

    Transaction.findOne = origTxFindOne;
    Transaction.create = origTxCreate;
    Transaction.deleteOne = origTxDeleteOne;

    OfferwallProvider.find = origProviderFind;
    OfferwallProvider.findOne = origProviderFindOne;
    OfferwallProvider.findOneAndUpdate = origProviderFindOneAndUpdate;
    OfferwallProvider.findByIdAndUpdate = origProviderFindByIdAndUpdate;

    Notification.create = origNotificationCreate;
    OfferwallPostbackLog.prototype.save = origLogSave;
    OfferwallPostbackLog.countDocuments = origLogCountDocuments;

    OfferwallPostbackLock.create = origLockCreate;
    OfferwallPostbackLock.findOne = origLockFindOne;
    OfferwallPostbackLock.deleteOne = origLockDeleteOne;
    OfferwallPostbackLock.findOneAndUpdate = origLockFindOneAndUpdate;

    console.log('======================================================================');
    console.log('All Production-Path CPX Research Integration Tests Passed Cleanly!');
    console.log('======================================================================\n');
}

runAll().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
