import assert from 'node:assert/strict';
import crypto from 'crypto';
import { handlePostback, verifySignature } from './backend/controllers/postbackController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import OfferwallPostbackLock from './backend/models/OfferwallPostbackLock.js';
import Notification from './backend/models/Notification.js';

console.log('=== Running ayeT-Studios Postback Compatibility & Safety Suite ===\n');

// In-memory mock database
class MockDb {
    constructor() {
        this.users = new Map();
        this.transactions = new Map();
        this.providers = new Map();
        this.logs = new Map();
        this.locks = new Map();
        this.notifications = new Map();
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.locks.clear();
        this.notifications.clear();
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

OfferwallProvider.findOneAndUpdate = async (filter, update) => {
    const key = filter.providerKey?.toLowerCase();
    const existing = db.providers.get(key);
    if (!existing) return null;
    const updated = { ...existing, ...update.$set };
    db.providers.set(key, updated);
    return updated;
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
                if (query.type && tx.type !== query.type) continue;
                return tx;
            }
        }
    }
    return null;
};

Transaction.create = async (doc) => {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tx = { ...doc, _id: id };
    if (doc.idempotencyKey) {
        if (db.transactions.has(doc.idempotencyKey)) {
            const err = new Error('Duplicate key violation');
            err.code = 11000;
            throw err;
        }
        db.transactions.set(doc.idempotencyKey, tx);
    }
    return tx;
};

Transaction.deleteOne = async (query) => {
    if (query._id) {
        for (const [key, tx] of db.transactions.entries()) {
            if (tx._id === query._id) {
                db.transactions.delete(key);
                return { deletedCount: 1 };
            }
        }
    }
    return { deletedCount: 0 };
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

OfferwallPostbackLock.deleteOne = async (query) => {
    const key = `${query.providerKey}_${query.externalTxId}`;
    if (db.locks.has(key)) {
        db.locks.delete(key);
        return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
};

OfferwallPostbackLog.countDocuments = async (query) => {
    return 0;
};

OfferwallPostbackLog.prototype.save = async function () {
    const id = this._id || `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    db.logs.set(String(id), this);
    return this;
};

Notification.create = async (doc) => ({ ...doc, _id: `notif_${Date.now()}` });

// Helper to create mock Express response
const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(b) {
            this.body = b;
            return this;
        },
        json(j) {
            this.body = j;
            return this;
        }
    };
    return res;
};

// Helper to calculate valid ayeT HMAC-SHA256 signature
const signAyetParams = (params, apiKey) => {
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys.map(k => {
        const val = params[k] !== undefined && params[k] !== null ? String(params[k]) : '';
        const encodedKey = encodeURIComponent(k);
        const encodedVal = encodeURIComponent(val).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        return `${encodedKey}=${encodedVal}`;
    }).join('&');
    return crypto.createHmac('sha256', apiKey).update(queryString).digest('hex');
};

const TEST_API_KEY = 'ayet_publisher_api_key_xyz987';
const TEST_USER_ID = '507f1f77bcf86cd799439011';

const seedAyetProvider = (overrides = {}) => {
    const provider = {
        _id: 'ayet_prov_id_1',
        providerKey: 'ayetstudios',
        name: 'Aye-T Studios',
        enabled: true,
        status: 'PRODUCTION_READY',
        apiKey: TEST_API_KEY,
        requireSignature: true,
        signatureType: 'sha256',
        commissionMode: 'provider_managed',
        exchangeRateMultiplier: 1.0,
        userRevenueSharePercent: 70,
        platformRevenueSharePercent: 30,
        ...overrides
    };
    db.providers.set('ayetstudios', provider);
    return provider;
};

const seedTestUser = (overrides = {}) => {
    const user = {
        _id: TEST_USER_ID,
        username: 'testworker56',
        taskEarningsBalance: 10.0,
        taskWalletBalance: 10.0,
        chargebackLiabilityUSD: 0,
        status: 'Active',
        restrictions: { earning: false },
        ...overrides
    };
    db.users.set(String(user._id), user);
    return user;
};

async function runAyetSuite() {
    let passed = 0;
    let failed = 0;

    const assertTest = (cond, msg) => {
        if (cond) {
            passed++;
            console.log(`✓ Passed: ${msg}`);
        } else {
            failed++;
            console.error(`✗ FAILED: ${msg}`);
            throw new Error(`Test assertion failed: ${msg}`);
        }
    };

    console.log('--- TEST GROUP 1: HMAC-SHA256 HEADER VERIFICATION & FAIL-CLOSED GUARDS ---');
    {
        db.clear();
        seedAyetProvider();
        seedTestUser();

        const validQuery = {
            currency_amount: '360',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.36',
            transaction_id: 'ayet_tx_101'
        };
        const validSig = signAyetParams(validQuery, TEST_API_KEY);

        // 1. Correct ayeT HMAC-SHA256 header is accepted
        const reqValid = {
            params: { provider: 'ayetstudios' },
            query: validQuery,
            body: {},
            headers: { 'x-ayetstudios-security-hash': validSig }
        };
        const resValid = createMockRes();
        await handlePostback(reqValid, resValid);
        assertTest(resValid.statusCode === 200, 'Test 1: Correct ayeT HMAC-SHA256 header is accepted with HTTP 200');
        assertTest(resValid.body === 'OK', 'Test 1b: Response body is OK');

        // Check user wallet credited by exact payout_usd (0.36 USD)
        const user = db.users.get(TEST_USER_ID);
        assertTest(user.taskEarningsBalance === 10.36, 'Test 1c: User taskEarningsBalance credited by exact payout_usd ($0.36)');

        // 2. Invalid or missing header is rejected
        const reqMissingSig = {
            params: { provider: 'ayetstudios' },
            query: validQuery,
            body: {},
            headers: {}
        };
        const resMissingSig = createMockRes();
        await handlePostback(reqMissingSig, resMissingSig);
        assertTest(resMissingSig.statusCode === 400, 'Test 2a: Missing header is rejected with HTTP 400');
        assertTest(resMissingSig.body === 'INVALID_SIGNATURE', 'Test 2b: Missing header body is INVALID_SIGNATURE');

        const reqTamperedSig = {
            params: { provider: 'ayetstudios' },
            query: validQuery,
            body: {},
            headers: { 'x-ayetstudios-security-hash': 'deadbeef00000000000000000000000000000000000000000000000000000000' }
        };
        const resTamperedSig = createMockRes();
        await handlePostback(reqTamperedSig, resTamperedSig);
        assertTest(resTamperedSig.statusCode === 400, 'Test 2c: Tampered signature header rejected with HTTP 400');

        // 3. Missing API key fails closed
        db.providers.get('ayetstudios').apiKey = '';
        const resNoApiKey = createMockRes();
        await handlePostback(reqValid, resNoApiKey);
        assertTest(resNoApiKey.statusCode === 400, 'Test 3a: Missing API key fails closed with HTTP 400');
        assertTest(resNoApiKey.body === 'INVALID_SIGNATURE', 'Test 3b: Missing API key fails closed');
        db.providers.get('ayetstudios').apiKey = TEST_API_KEY; // restore
    }

    console.log('\n--- TEST GROUP 2: USER IDENTIFICATION (external_identifier) ---');
    {
        db.clear();
        seedAyetProvider();
        seedTestUser();

        // 4. external_identifier correctly identifies existing user by Mongo ID and by username
        const queryWithUsername = {
            currency_amount: '500',
            currency_conversion_rate: '1000',
            external_identifier: 'testworker56', // username mapping
            is_chargeback: '0',
            payout_usd: '0.50',
            transaction_id: 'ayet_tx_102'
        };
        const sigUsername = signAyetParams(queryWithUsername, TEST_API_KEY);
        const reqUsername = {
            params: { provider: 'ayetstudios' },
            query: queryWithUsername,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigUsername }
        };
        const resUsername = createMockRes();
        await handlePostback(reqUsername, resUsername);
        assertTest(resUsername.statusCode === 200, 'Test 4a: external_identifier matched by username');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.50, 'Test 4b: Worker credited correctly via username lookup');

        // 5. Missing user identifier cannot credit anyone
        const queryNoUser = {
            currency_amount: '500',
            currency_conversion_rate: '1000',
            is_chargeback: '0',
            payout_usd: '0.50',
            transaction_id: 'ayet_tx_103'
        };
        const sigNoUser = signAyetParams(queryNoUser, TEST_API_KEY);
        const reqNoUser = {
            params: { provider: 'ayetstudios' },
            query: queryNoUser,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigNoUser }
        };
        const resNoUser = createMockRes();
        await handlePostback(reqNoUser, resNoUser);
        assertTest(resNoUser.statusCode === 200, 'Test 5a: Missing user acknowledged without credit (USER_NOT_FOUND_LOGGED)');
        assertTest(resNoUser.body === 'USER_NOT_FOUND_LOGGED', 'Test 5b: Acknowledged as USER_NOT_FOUND_LOGGED');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.50, 'Test 5c: Balance remained unchanged');
    }

    console.log('\n--- TEST GROUP 3: TRANSACTION IDENTIFICATION & IDEMPOTENCY ---');
    {
        db.clear();
        seedAyetProvider();
        seedTestUser();

        // 6. Missing transaction_id cannot credit anyone
        const queryNoTx = {
            currency_amount: '100',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.10'
        };
        const sigNoTx = signAyetParams(queryNoTx, TEST_API_KEY);
        const reqNoTx = {
            params: { provider: 'ayetstudios' },
            query: queryNoTx,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigNoTx }
        };
        const resNoTx = createMockRes();
        await handlePostback(reqNoTx, resNoTx);
        assertTest(resNoTx.statusCode === 400, 'Test 6a: Missing transaction_id rejected with HTTP 400');
        assertTest(resNoTx.body === 'MISSING_TRANSACTION_ID', 'Test 6b: Body is MISSING_TRANSACTION_ID');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.0, 'Test 6c: Balance untouched');

        // 7. Duplicate conversions cannot credit twice
        const queryCredit = {
            currency_amount: '200',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.20',
            transaction_id: 'ayet_idempotency_tx_777'
        };
        const sigCredit = signAyetParams(queryCredit, TEST_API_KEY);
        const reqCredit = {
            params: { provider: 'ayetstudios' },
            query: queryCredit,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigCredit }
        };

        const resFirst = createMockRes();
        await handlePostback(reqCredit, resFirst);
        assertTest(resFirst.statusCode === 200, 'Test 7a: First credit succeeds');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.20, 'Test 7b: Balance is 10.20');

        const resDuplicate = createMockRes();
        await handlePostback(reqCredit, resDuplicate);
        assertTest(resDuplicate.statusCode === 200, 'Test 7c: Duplicate returns HTTP 200');
        assertTest(resDuplicate.body === 'DUP_ALREADY_PROCESSED', 'Test 7d: Body indicates duplicate acknowledged');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.20, 'Test 7e: Balance did NOT credit twice');
    }

    console.log('\n--- TEST GROUP 4: AMOUNT, CURRENCY & CONVERSION RATE VALIDATION ---');
    {
        db.clear();
        seedAyetProvider();
        seedTestUser();

        // 8. currency_amount and currency_conversion_rate are validated correctly
        const validConversion = {
            currency_amount: '1000',
            currency_conversion_rate: '2000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.50',
            transaction_id: 'ayet_conv_check_1'
        };
        const sigConv = signAyetParams(validConversion, TEST_API_KEY);
        const reqConv = {
            params: { provider: 'ayetstudios' },
            query: validConversion,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigConv }
        };
        const resConv = createMockRes();
        await handlePostback(reqConv, resConv);
        assertTest(resConv.statusCode === 200, 'Test 8a: Consistent 1000 = 0.50 * 2000 validated correctly');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.50, 'Test 8b: Balance credited by exact USD payout ($0.50)');

        // 9. payout_usd is not confused with currency_amount (e.g. 1000 currency_amount != $1000 USD payout)
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance !== 1010.0, 'Test 9: payout_usd was NOT confused with currency_amount');

        // 10. Invalid or inconsistent conversion data cannot mutate balances
        // Inconsistent: payout 0.50 * rate 2000 = 1000, but currency_amount passed is 500
        const queryInconsistent = {
            currency_amount: '500', // Mismatch!
            currency_conversion_rate: '2000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.50',
            transaction_id: 'ayet_inconsistent_tx'
        };
        const sigInconsistent = signAyetParams(queryInconsistent, TEST_API_KEY);
        const reqInconsistent = {
            params: { provider: 'ayetstudios' },
            query: queryInconsistent,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigInconsistent }
        };
        const resInconsistent = createMockRes();
        await handlePostback(reqInconsistent, resInconsistent);
        assertTest(resInconsistent.statusCode === 400, 'Test 10a: Inconsistent conversion data rejected with HTTP 400');
        assertTest(resInconsistent.body === 'INCONSISTENT_CONVERSION_DATA', 'Test 10b: Error body is INCONSISTENT_CONVERSION_DATA');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.50, 'Test 10c: Balance untouched');

        // Missing conversion rate
        const queryNoRate = {
            currency_amount: '500',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.50',
            transaction_id: 'ayet_no_rate_tx'
        };
        const sigNoRate = signAyetParams(queryNoRate, TEST_API_KEY);
        const reqNoRate = {
            params: { provider: 'ayetstudios' },
            query: queryNoRate,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigNoRate }
        };
        const resNoRate = createMockRes();
        await handlePostback(reqNoRate, resNoRate);
        assertTest(resNoRate.statusCode === 400, 'Test 10d: Missing conversion rate fails closed');

        // Zero or negative payout for conversion
        const queryZeroPayout = {
            currency_amount: '0',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0',
            transaction_id: 'ayet_zero_payout_tx'
        };
        const sigZeroPayout = signAyetParams(queryZeroPayout, TEST_API_KEY);
        const reqZeroPayout = {
            params: { provider: 'ayetstudios' },
            query: queryZeroPayout,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigZeroPayout }
        };
        const resZeroPayout = createMockRes();
        await handlePostback(reqZeroPayout, resZeroPayout);
        assertTest(resZeroPayout.statusCode === 400, 'Test 10e: Zero payout rejected with HTTP 400');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.50, 'Test 10f: Balance untouched');
    }

    console.log('\n--- TEST GROUP 5: REVERSAL CALLBACKS & r- TRANSACTION IDENTIFICATION ---');
    {
        db.clear();
        seedAyetProvider();
        seedTestUser({ taskEarningsBalance: 20.0 });

        // First create original conversion with tx_id "12345678"
        const queryOriginal = {
            currency_amount: '1000',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '1.00',
            transaction_id: '12345678'
        };
        const sigOriginal = signAyetParams(queryOriginal, TEST_API_KEY);
        const reqOriginal = {
            params: { provider: 'ayetstudios' },
            query: queryOriginal,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigOriginal }
        };
        const resOriginal = createMockRes();
        await handlePostback(reqOriginal, resOriginal);
        assertTest(resOriginal.statusCode === 200, 'Test 11a: Original conversion 12345678 credited');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 21.0, 'Test 11b: Balance is 21.00');

        // 11 & 12. is_chargeback=1 and transaction_id "r-12345678" correctly matches original transaction 12345678
        const queryReversal = {
            currency_amount: '-1000',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '1',
            payout_usd: '-1.00',
            transaction_id: 'r-12345678'
        };
        const sigReversal = signAyetParams(queryReversal, TEST_API_KEY);
        const reqReversal = {
            params: { provider: 'ayetstudios' },
            query: queryReversal,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigReversal }
        };
        const resReversal = createMockRes();
        await handlePostback(reqReversal, resReversal);
        assertTest(resReversal.statusCode === 200, 'Test 11c: Reversal r-12345678 accepted with HTTP 200');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 20.0, 'Test 12: Reversal deducted original $1.00, returning balance to 20.00');

        // 13. Duplicate reversal cannot deduct twice
        const resDupReversal = createMockRes();
        await handlePostback(reqReversal, resDupReversal);
        assertTest(resDupReversal.statusCode === 200, 'Test 13a: Duplicate reversal acknowledged with HTTP 200');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 20.0, 'Test 13b: Duplicate reversal did NOT deduct again');

        // 14. Unmatched reversal cannot affect an unrelated transaction
        const queryUnmatchedRev = {
            currency_amount: '-500',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '1',
            payout_usd: '-0.50',
            transaction_id: 'r-99999999_nonexistent'
        };
        const sigUnmatched = signAyetParams(queryUnmatchedRev, TEST_API_KEY);
        const reqUnmatched = {
            params: { provider: 'ayetstudios' },
            query: queryUnmatchedRev,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigUnmatched }
        };
        const resUnmatched = createMockRes();
        await handlePostback(reqUnmatched, resUnmatched);
        assertTest(resUnmatched.statusCode === 200, 'Test 14a: Unmatched reversal acknowledged safely');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 20.0, 'Test 14b: Unmatched reversal did NOT mutate balance');
    }

    console.log('\n--- TEST GROUP 6: SANDBOX SAFETY (is_sandbox=1) ---');
    {
        db.clear();
        seedAyetProvider();
        seedTestUser({ taskEarningsBalance: 50.0 });

        // 15. is_sandbox=1 never mutates a real wallet
        const querySandbox = {
            currency_amount: '10000',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            is_sandbox: '1',
            payout_usd: '10.00',
            transaction_id: 'ayet_test_sandbox_123'
        };
        const sigSandbox = signAyetParams(querySandbox, TEST_API_KEY);
        const reqSandbox = {
            params: { provider: 'ayetstudios' },
            query: querySandbox,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigSandbox }
        };
        const resSandbox = createMockRes();
        await handlePostback(reqSandbox, resSandbox);
        assertTest(resSandbox.statusCode === 200, 'Test 15a: Sandbox callback returns HTTP 200');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 50.0, 'Test 15b: Real wallet balance remained 100% untouched at 50.00');

        // Check log recorded as TestCallback
        let sandboxLog = null;
        for (const l of db.logs.values()) {
            if (l.externalTxId === 'ayet_test_sandbox_123') {
                sandboxLog = l;
                break;
            }
        }
        assertTest(sandboxLog !== null && sandboxLog.status === 'TestCallback', 'Test 15c: Recorded in OfferwallPostbackLog as TestCallback');
    }

    console.log('\n======================================================');
    console.log(`ayeT-Studios Integration Suite: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');
}

runAyetSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
