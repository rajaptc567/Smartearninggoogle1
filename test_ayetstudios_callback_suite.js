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

// Helper to calculate valid ayeT HMAC-SHA256 signature using official canonicalization (URLSearchParams with spaces as '+')
const signAyetParams = (params, apiKey) => {
    const sortedKeys = Object.keys(params).sort();
    const searchParams = new URLSearchParams();
    for (const k of sortedKeys) {
        const val = params[k] !== undefined && params[k] !== null ? String(params[k]) : '';
        searchParams.append(k, val);
    }
    return crypto.createHmac('sha256', apiKey).update(searchParams.toString()).digest('hex');
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

    console.log('--- TEST GROUP 1: HMAC-SHA256 HEADER VERIFICATION & DETERMINISTIC CANONICALIZATION ---');
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

        // 3c. Spaces encoded as '+' in query parameter values
        const queryWithSpaces = {
            currency_amount: '200',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            offer_name: 'Merge Dragons Kingdom',
            payout_usd: '0.20',
            transaction_id: 'ayet_tx_spaces_1'
        };
        const sigSpacesOfficial = signAyetParams(queryWithSpaces, TEST_API_KEY);
        const reqSpacesOfficial = {
            params: { provider: 'ayetstudios' },
            query: queryWithSpaces,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigSpacesOfficial }
        };
        const resSpacesOfficial = createMockRes();
        await handlePostback(reqSpacesOfficial, resSpacesOfficial);
        assertTest(resSpacesOfficial.statusCode === 200, 'Test 3c: Official canonicalization with spaces as + accepted');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.56, 'Test 3c-2: Wallet credited after spaces as + callback');

        // 3d. Rejection of alternative candidate signatures (RFC 3986 where spaces are '%20')
        // In RFC 3986, 'Merge Dragons Kingdom' is encoded as 'Merge%20Dragons%20Kingdom'
        const sortedKeysSpaces = Object.keys(queryWithSpaces).sort();
        const rfc3986QueryString = sortedKeysSpaces.map(k => {
            const val = String(queryWithSpaces[k]);
            return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
        }).join('&');
        const rfc3986Sig = crypto.createHmac('sha256', TEST_API_KEY).update(rfc3986QueryString).digest('hex');

        // Verify RFC 3986 hash differs from official hash
        assertTest(rfc3986Sig !== sigSpacesOfficial, 'Test 3d-1: RFC 3986 hash differs from official spaces as + hash');

        // Send callback with RFC 3986 candidate signature -> MUST BE REJECTED!
        const queryWithSpaces2 = {
            currency_amount: '200',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            offer_name: 'Merge Dragons Kingdom',
            payout_usd: '0.20',
            transaction_id: 'ayet_tx_spaces_rfc3986'
        };
        const reqRfc3986 = {
            params: { provider: 'ayetstudios' },
            query: queryWithSpaces2,
            body: {},
            headers: { 'x-ayetstudios-security-hash': rfc3986Sig }
        };
        const resRfc3986 = createMockRes();
        await handlePostback(reqRfc3986, resRfc3986);
        assertTest(resRfc3986.statusCode === 400, 'Test 3d-2: Alternative candidate RFC 3986 signature strictly rejected');
        assertTest(resRfc3986.body === 'INVALID_SIGNATURE', 'Test 3d-3: Rejection body is INVALID_SIGNATURE');

        // 3e. Percent-encoded characters in values (e.g. '@', '=', '&', '?')
        const querySpecialChars = {
            currency_amount: '150',
            currency_conversion_rate: '1000',
            custom_ref: 'abc@domain.com?ref=45&sub=xyz',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.15',
            transaction_id: 'ayet_tx_special_chars'
        };
        const sigSpecialChars = signAyetParams(querySpecialChars, TEST_API_KEY);
        const reqSpecialChars = {
            params: { provider: 'ayetstudios' },
            query: querySpecialChars,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigSpecialChars }
        };
        const resSpecialChars = createMockRes();
        await handlePostback(reqSpecialChars, resSpecialChars);
        assertTest(resSpecialChars.statusCode === 200, 'Test 3e: Special characters with percent-encoding accepted');
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.71, 'Test 3e-2: Wallet credited after special chars callback');

        // 3f. Reject ambiguous or array query parameters (e.g. repeated keys or array values)
        const queryWithArray = {
            currency_amount: '100',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.10',
            tags: ['tag1', 'tag2'], // Ambiguous array!
            transaction_id: 'ayet_tx_array_param'
        };
        const sigArray = 'any_sig_value';
        const reqArray = {
            params: { provider: 'ayetstudios' },
            query: queryWithArray,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigArray }
        };
        const resArray = createMockRes();
        await handlePostback(reqArray, resArray);
        assertTest(resArray.statusCode === 400, 'Test 3f-1: Ambiguous array query parameter rejected with HTTP 400');
        assertTest(resArray.body === 'INVALID_SIGNATURE', 'Test 3f-2: Ambiguous array rejection body is INVALID_SIGNATURE');

        // 3g. Reject nested object query parameters
        const queryWithObject = {
            currency_amount: '100',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            nested_data: { foo: 'bar' }, // Ambiguous nested object!
            payout_usd: '0.10',
            transaction_id: 'ayet_tx_object_param'
        };
        const reqObject = {
            params: { provider: 'ayetstudios' },
            query: queryWithObject,
            body: {},
            headers: { 'x-ayetstudios-security-hash': 'any_sig' }
        };
        const resObject = createMockRes();
        await handlePostback(reqObject, resObject);
        assertTest(resObject.statusCode === 400, 'Test 3g-1: Ambiguous nested object parameter rejected with HTTP 400');
        assertTest(resObject.body === 'INVALID_SIGNATURE', 'Test 3g-2: Ambiguous nested object body is INVALID_SIGNATURE');

        // 3h. Security header and route parameter "provider" must not pollute canonical query string
        const reqWithRouteParam = {
            headers: { 'x-ayetstudios-security-hash': sigSpacesOfficial },
            query: {
                ...queryWithSpaces,
                provider: 'ayetstudios', // route parameter injected in query
                'X-Ayetstudios-Security-Hash': sigSpacesOfficial // header sometimes copied in query
            }
        };
        const directVerifyResult = verifySignature(
            db.providers.get('ayetstudios'),
            reqWithRouteParam.query,
            '127.0.0.1',
            reqWithRouteParam
        );
        assertTest(directVerifyResult.valid === true, 'Test 3h: route param provider and security header are excluded from canonical query string');

        // 3i. Characters "! ' ( ) *" using URLSearchParams encoding
        // Note: URLSearchParams encodes ! as %21, ' as %27, ( as %28, ) as %29, * as *, and spaces as +
        const queryWithPunctuation = {
            currency_amount: '120',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            offer_title: "Level 10! (Free 'Bonus' *Special*)",
            payout_usd: '0.12',
            transaction_id: 'ayet_tx_punct_1'
        };
        const sigPunctuation = signAyetParams(queryWithPunctuation, TEST_API_KEY);
        const reqPunctuation = {
            params: { provider: 'ayetstudios' },
            query: queryWithPunctuation,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigPunctuation }
        };
        const resPunctuation = createMockRes();
        await handlePostback(reqPunctuation, resPunctuation);
        assertTest(resPunctuation.statusCode === 200, "Test 3i-1: Characters ! ' ( ) * encoded via URLSearchParams accepted with HTTP 200");
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.83, "Test 3i-2: Wallet credited after punctuation callback");

        // Verify alternative encoding where ! ' ( ) are unencoded (as standard encodeURIComponent leaves them) is rejected
        const sortedKeysPunct = Object.keys(queryWithPunctuation).sort();
        const unencodedPunctQueryString = sortedKeysPunct.map(k => {
            const rawVal = queryWithPunctuation[k] !== undefined && queryWithPunctuation[k] !== null ? String(queryWithPunctuation[k]) : '';
            return `${encodeURIComponent(k).replace(/%20/g, '+')}=${encodeURIComponent(rawVal).replace(/%20/g, '+')}`;
        }).join('&');
        const unencodedPunctSig = crypto.createHmac('sha256', TEST_API_KEY).update(unencodedPunctQueryString).digest('hex');
        assertTest(unencodedPunctSig !== sigPunctuation, "Test 3i-3: URLSearchParams encoding differs from encodeURIComponent for ! ' ( )");

        const reqUnencodedPunct = {
            params: { provider: 'ayetstudios' },
            query: { ...queryWithPunctuation, transaction_id: 'ayet_tx_punct_2' },
            body: {},
            headers: { 'x-ayetstudios-security-hash': unencodedPunctSig }
        };
        const resUnencodedPunct = createMockRes();
        await handlePostback(reqUnencodedPunct, resUnencodedPunct);
        assertTest(resUnencodedPunct.statusCode === 400, "Test 3i-4: Candidate signature with unencoded ! ' ( ) strictly rejected");
        assertTest(resUnencodedPunct.body === 'INVALID_SIGNATURE', "Test 3i-5: Rejection body is INVALID_SIGNATURE");

        // 3j. Alphabetical parameter ordering
        const unorderedQuery = {
            z_param: 'last',
            a_param: 'first',
            m_param: 'middle',
            currency_amount: '100',
            currency_conversion_rate: '1000',
            external_identifier: TEST_USER_ID,
            is_chargeback: '0',
            payout_usd: '0.10',
            transaction_id: 'ayet_tx_ordering_1'
        };
        const sigOrdered = signAyetParams(unorderedQuery, TEST_API_KEY);
        const reqOrdered = {
            params: { provider: 'ayetstudios' },
            query: unorderedQuery,
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigOrdered }
        };
        const resOrdered = createMockRes();
        await handlePostback(reqOrdered, resOrdered);
        assertTest(resOrdered.statusCode === 200, "Test 3j-1: Query with parameters out-of-order verified alphabetically");
        assertTest(db.users.get(TEST_USER_ID).taskEarningsBalance === 10.93, "Test 3j-2: Wallet credited after ordering callback");

        // Verify that signature computed with non-alphabetical parameter order is strictly rejected
        const spUnordered = new URLSearchParams();
        for (const k of Object.keys(unorderedQuery)) { // insertion order (z_param first)
            spUnordered.append(k, String(unorderedQuery[k]));
        }
        const sigUnordered = crypto.createHmac('sha256', TEST_API_KEY).update(spUnordered.toString()).digest('hex');
        assertTest(sigUnordered !== sigOrdered, "Test 3j-3: Non-alphabetical query string hash differs from sorted hash");

        const reqUnordered = {
            params: { provider: 'ayetstudios' },
            query: { ...unorderedQuery, transaction_id: 'ayet_tx_ordering_2' },
            body: {},
            headers: { 'x-ayetstudios-security-hash': sigUnordered }
        };
        const resUnordered = createMockRes();
        await handlePostback(reqUnordered, resUnordered);
        assertTest(resUnordered.statusCode === 400, "Test 3j-4: Out-of-order signature rejected with HTTP 400");
        assertTest(resUnordered.body === 'INVALID_SIGNATURE', "Test 3j-5: Rejection body is INVALID_SIGNATURE");
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
