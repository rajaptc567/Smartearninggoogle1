import assert from 'node:assert/strict';
import crypto from 'crypto';
import { handlePostback, simulatePostback, acquirePostbackLock, releasePostbackLock, isLockStillOwned } from './backend/controllers/postbackController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import Notification from './backend/models/Notification.js';
import OfferwallPostbackLock from './backend/models/OfferwallPostbackLock.js';

console.log('Running SmartExn Postback Simulator Dry-Run Test Suite...\n');

// In-memory mock store
class MockDb {
    constructor() {
        this.users = new Map();
        this.transactions = new Map();
        this.providers = new Map();
        this.logs = new Map();
        this.notifications = new Map();
        this.locks = new Map();
        this.providerMetricsUpdates = [];
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.notifications.clear();
        this.locks.clear();
        this.providerMetricsUpdates = [];
    }
}

const db = new MockDb();

// Setup in-memory Mongoose model mocks
const origUserFindById = User.findById;
const origUserFindOne = User.findOne;
const origUserFindOneAndUpdate = User.findOneAndUpdate;
const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

const origTxFindOne = Transaction.findOne;
const origTxCreate = Transaction.create;

const origProviderFindOne = OfferwallProvider.findOne;
const origProviderFindOneAndUpdate = OfferwallProvider.findOneAndUpdate;
const origProviderFindByIdAndUpdate = OfferwallProvider.findByIdAndUpdate;

const origNotificationCreate = Notification.create;
const origLogSave = OfferwallPostbackLog.prototype.save;

let forceUserLookupError = false;
User.findById = async (id) => {
    if (forceUserLookupError) {
        throw new Error('Simulated unexpected database failure');
    }
    return db.users.get(String(id)) || null;
};
User.findOne = async (query) => {
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
let simulateCompensationFailure = false;
let simulateCompensationNull = false;
let simulateTxDeleteFailure = false;

User.findOneAndUpdate = async (filter, update, options) => {
    if (simulateCompensationFailure && update.$inc && (update.$inc.taskEarningsBalance > 0 || update.$inc.taskWalletBalance > 0)) {
        throw new Error('Database connection reset during compensation rollback');
    }
    if (simulateCompensationNull && update.$inc && (update.$inc.taskEarningsBalance > 0 || update.$inc.taskWalletBalance > 0)) {
        return null;
    }
    const user = await User.findById(filter._id);
    if (!user) return null;
    if (filter.status?.$ne && user.status === filter.status.$ne) return null;
    if (filter['restrictions.earning']?.$ne && user.restrictions?.earning === true) return null;

    if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
            user[k] = Number(((user[k] || 0) + v).toFixed(2));
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
            user[k] = Number(((user[k] || 0) + v).toFixed(2));
        }
    }
    db.users.set(String(user._id), user);
    return user;
};

Transaction.findOne = async (query) => {
    if (query.idempotencyKey) {
        return db.transactions.get(query.idempotencyKey) || null;
    }
    if (query.offerwallProvider && query.externalTransactionId) {
        for (const tx of db.transactions.values()) {
            if (tx.offerwallProvider === query.offerwallProvider && tx.externalTransactionId === query.externalTransactionId && tx.type === query.type) {
                return tx;
            }
        }
    }
    return null;
};
Transaction.create = async (doc) => {
    if (db.transactions.has(doc.idempotencyKey)) {
        const err = new Error('Duplicate key');
        err.code = 11000;
        throw err;
    }
    const created = { ...doc, _id: `tx_${Date.now()}_${Math.random()}` };
    db.transactions.set(doc.idempotencyKey, created);
    return created;
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

OfferwallProvider.findOne = async (query) => {
    return db.providers.get(query.providerKey?.toLowerCase()) || null;
};
OfferwallProvider.findByIdAndUpdate = async (id, update) => {
    db.providerMetricsUpdates.push({ id, update });
    return { _id: id };
};

Notification.create = async (doc) => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    db.notifications.set(id, { ...doc, _id: id });
    return { ...doc, _id: id };
};

OfferwallPostbackLog.countDocuments = async (query) => {
    return 0;
};

OfferwallPostbackLog.prototype.save = async function() {
    const id = `log_${Date.now()}_${Math.random()}`;
    db.logs.set(id, { ...this.toObject(), _id: id });
    return this;
};

OfferwallPostbackLock.create = async (doc) => {
    const key = `${doc.providerKey}_${doc.externalTxId}`;
    if (db.locks.has(key)) {
        const err = new Error('Duplicate lock key');
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

function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        send(b) { this.body = b; return this; },
        json(b) { this.body = b; return this; }
    };
}

async function runTests() {
    // Seed initial mock user and provider
    const testUser = {
        _id: '671000000000000000000001',
        username: 'worker1',
        email: 'worker1@example.com',
        status: 'Active',
        walletBalance: 100.0,
        taskEarningsBalance: 20.0,
        taskWalletBalance: 20.0,
        chargebackLiabilityUSD: 0.0,
        currency: 'USD'
    };

    const testProvider = {
        _id: 'prov_torox_123',
        providerKey: 'torox',
        name: 'Torox',
        enabled: true,
        status: 'ACTIVE',
        approvalStatus: 'Approved',
        commissionMode: 'smartexn_managed',
        secretKey: 'secret_test_key_123',
        requireSignature: true,
        signatureType: 'md5',
        exchangeRateMultiplier: 1.0,
        userRevenueSharePercent: 80,
        platformRevenueSharePercent: 20,
        ipWhitelist: []
    };

    db.clear();
    db.users.set(testUser._id, { ...testUser });
    db.providers.set(testProvider.providerKey, { ...testProvider });

    // -------------------------------------------------------------
    // TEST 1: Valid Simulated Credit -> ZERO Database Mutations
    // -------------------------------------------------------------
    console.log('Test 1: Valid simulated credit causes zero mutations...');
    const adminUser = { id: 'admin1', role: 'admin' };
    const simReq = {
        user: adminUser,
        body: {
            providerKey: 'torox',
            userId: testUser._id,
            amount: 5.0,
            isReversal: false,
            offerName: 'Survey #101'
        }
    };
    const simRes = createMockRes();

    await simulatePostback(simReq, simRes);

    assert.strictEqual(simRes.statusCode, 200, 'Simulator must return HTTP 200');
    assert.strictEqual(simRes.body.success, true, 'Dry-run must report success');
    assert.strictEqual(simRes.body.isDryRun, true, 'isDryRun must be explicitly true');
    assert.strictEqual(simRes.body.mutationsPerformed, false, 'mutationsPerformed must be explicitly false');
    assert.strictEqual(simRes.body.action, 'CREDIT', 'Action must be CREDIT');
    assert.strictEqual(simRes.body.validation?.status, 'PASSED', 'Validation status must be PASSED');
    assert.strictEqual(simRes.body.accounting?.userRewardUSD, 4.0, 'User reward must be 80% of $5.00 = $4.00');
    assert.strictEqual(simRes.body.accounting?.platformRevenueUSD, 1.0, 'Platform revenue must be 20% of $5.00 = $1.00');

    // Verify ZERO mutations in database
    const userAfterSimCredit = db.users.get(testUser._id);
    assert.strictEqual(userAfterSimCredit.taskEarningsBalance, 20.0, 'User taskEarningsBalance must NOT change');
    assert.strictEqual(userAfterSimCredit.taskWalletBalance, 20.0, 'User taskWalletBalance must NOT change');
    assert.strictEqual(userAfterSimCredit.walletBalance, 100.0, 'User walletBalance must NOT change');
    assert.strictEqual(db.transactions.size, 0, 'Zero transactions must be recorded');
    assert.strictEqual(db.logs.size, 0, 'Zero postback logs must be saved');
    assert.strictEqual(db.notifications.size, 0, 'Zero notifications must be sent');
    assert.strictEqual(db.providerMetricsUpdates.length, 0, 'Zero provider metric counters updated');
    console.log('✓ Passed Test 1: Simulated credit leaves all balances, transactions, and metrics 100% untouched.\n');

    // -------------------------------------------------------------
    // TEST 2: Valid Simulated Reversal -> ZERO Database Mutations
    // -------------------------------------------------------------
    console.log('Test 2: Valid simulated reversal causes zero mutations...');
    const simRevReq = {
        user: adminUser,
        body: {
            providerKey: 'torox',
            userId: testUser._id,
            amount: 5.0,
            isReversal: true,
            offerName: 'Survey Revocation #101'
        }
    };
    const simRevRes = createMockRes();

    await simulatePostback(simRevReq, simRevRes);

    assert.strictEqual(simRevRes.statusCode, 200, 'Simulator must return HTTP 200');
    assert.strictEqual(simRevRes.body.success, true, 'Dry-run must report success');
    assert.strictEqual(simRevRes.body.isDryRun, true, 'isDryRun must be explicitly true');
    assert.strictEqual(simRevRes.body.mutationsPerformed, false, 'mutationsPerformed must be explicitly false');
    assert.strictEqual(simRevRes.body.action, 'REVERSAL', 'Action must be REVERSAL');
    assert.strictEqual(simRevRes.body.accounting?.deductionAmountUSD, 4.0, 'Deduction amount must be $4.00');
    assert.strictEqual(simRevRes.body.user?.projectedTaskEarningsUSD, 16.0, 'Projected earnings must reflect $20 - $4 = $16');

    // Verify ZERO mutations in database
    const userAfterSimRev = db.users.get(testUser._id);
    assert.strictEqual(userAfterSimRev.taskEarningsBalance, 20.0, 'User taskEarningsBalance must NOT decrease');
    assert.strictEqual(userAfterSimRev.chargebackLiabilityUSD, 0.0, 'Chargeback liability must NOT increase');
    assert.strictEqual(db.transactions.size, 0, 'Zero transactions must be recorded');
    assert.strictEqual(db.logs.size, 0, 'Zero postback logs must be saved');
    console.log('✓ Passed Test 2: Simulated reversal causes zero balance deductions or chargeback liability.\n');

    // -------------------------------------------------------------
    // TEST 3: Invalid Signature Rejected -> Reports Failure
    // -------------------------------------------------------------
    console.log('Test 3: Simulator with invalid signature fails validation...');
    const invalidSigReq = {
        user: adminUser,
        body: {
            providerKey: 'torox',
            userId: testUser._id,
            amount: 5.0,
            testInvalidSignature: true
        }
    };
    const invalidSigRes = createMockRes();

    await simulatePostback(invalidSigReq, invalidSigRes);

    assert.strictEqual(invalidSigRes.body.success, false, 'Must report success: false when signature invalid');
    assert.strictEqual(invalidSigRes.body.isDryRun, true, 'Must report isDryRun: true');
    assert.strictEqual(invalidSigRes.body.mutationsPerformed, false, 'Must report mutationsPerformed: false');
    assert.strictEqual(invalidSigRes.body.validation?.signatureValid, false, 'signatureValid must be false');
    assert.strictEqual(invalidSigRes.body.simulatorResponse?.status, 400, 'Simulated provider status must be 400');
    console.log('✓ Passed Test 3: Invalid signature is correctly flagged as validation failure.\n');

    // -------------------------------------------------------------
    // TEST 4: Inactive Provider Rejected -> Reports Failure
    // -------------------------------------------------------------
    console.log('Test 4: Inactive provider simulation fails validation...');
    const disabledProvider = {
        _id: 'prov_disabled_1',
        providerKey: 'wannads',
        name: 'Wannads',
        enabled: false,
        status: 'DISABLED'
    };
    db.providers.set(disabledProvider.providerKey, disabledProvider);

    const inactiveProvReq = {
        user: adminUser,
        body: {
            providerKey: 'wannads',
            userId: testUser._id,
            amount: 2.0
        }
    };
    const inactiveProvRes = createMockRes();

    await simulatePostback(inactiveProvReq, inactiveProvRes);

    assert.strictEqual(inactiveProvRes.body.success, false, 'Disabled provider must report success: false');
    assert.strictEqual(inactiveProvRes.body.validation?.providerActive, false, 'providerActive must be false');
    console.log('✓ Passed Test 4: Inactive provider rejected in simulation.\n');

    // -------------------------------------------------------------
    // TEST 5: User Not Found Rejected -> Reports Failure
    // -------------------------------------------------------------
    console.log('Test 5: Non-existent user simulation fails validation...');
    const missingUserReq = {
        user: adminUser,
        body: {
            providerKey: 'torox',
            userId: '671999999999999999999999',
            amount: 2.0
        }
    };
    const missingUserRes = createMockRes();

    await simulatePostback(missingUserReq, missingUserRes);

    assert.strictEqual(missingUserRes.body.success, false, 'Missing user must report success: false');
    assert.strictEqual(missingUserRes.body.validation?.userFound, false, 'userFound must be false');
    console.log('✓ Passed Test 5: Non-existent user simulation reports user lookup failure.\n');

    // -------------------------------------------------------------
    // TEST 6: Public Endpoint Isolation -> Untrusted Client Cannot Activate Dry-Run
    // -------------------------------------------------------------
    console.log('Test 6: Public endpoint ignores client-supplied isDryRun flags...');
    const secret = testProvider.secretKey;
    const testOid = 'oid_real_test_1';
    const testTxId = 'trans_real_test_1';
    const sig = crypto.createHash('md5').update(`${testOid}-${testUser._id}-${secret}`).digest('hex');

    // Public request attempting to pass query/body dry-run parameters
    const publicMaliciousReq = {
        params: { provider: 'torox' },
        query: {
            user_id: testUser._id,
            id: testTxId,
            oid: testOid,
            amount: 10.0,
            sig: sig,
            isDryRun: 'true',
            __isSimulatorDryRun: 'true'
        },
        body: {
            isDryRun: true,
            __isSimulatorDryRun: true
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const publicRes = createMockRes();

    await handlePostback(publicMaliciousReq, publicRes);

    // Because this was on the public endpoint, dry-run was NOT activated!
    // The real postback logic ran and credited the user: $20 + (80% of $10) = $28
    const userAfterReal = db.users.get(testUser._id);
    assert.strictEqual(userAfterReal.taskEarningsBalance, 28.0, 'Real postback correctly credited $8.00');
    assert.strictEqual(db.transactions.size, 1, 'Real transaction created');
    console.log('✓ Passed Test 6: Public endpoint cannot be forced into dry-run by client parameters.\n');

    // -------------------------------------------------------------
    // TEST 7: Simulation creates no idempotency record blocking real postback
    // -------------------------------------------------------------
    console.log('Test 7: Simulation does not poison idempotency keys for future real postbacks...');
    const uniqueTxId = 'future_real_tx_999';
    const simKeyReq = {
        user: adminUser,
        body: {
            providerKey: 'torox',
            userId: testUser._id,
            amount: 5.0,
            externalTxId: uniqueTxId
        }
    };
    const simKeyRes = createMockRes();
    await simulatePostback(simKeyReq, simKeyRes);

    // Confirm that the simulated key was NOT written to db.transactions
    const simIdempotencyKey = `torox_${uniqueTxId}_credit`;
    assert.strictEqual(db.transactions.has(simIdempotencyKey), false, 'Idempotency key must NOT exist after simulation');

    // Now send real postback with the exact same uniqueTxId
    const oid = 'future_oid_999';
    const realSig = crypto.createHash('md5').update(`${oid}-${testUser._id}-${secret}`).digest('hex');
    const realReq = {
        params: { provider: 'torox' },
        query: {
            user_id: testUser._id,
            id: uniqueTxId,
            oid: oid,
            amount: 5.0,
            sig: realSig
        },
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const realRes = createMockRes();
    await handlePostback(realReq, realRes);

    assert.strictEqual(realRes.body, '1', 'Torox real callback returns 1');
    assert.strictEqual(db.transactions.has(simIdempotencyKey), true, 'Real postback successfully recorded after prior simulation');
    console.log('✓ Passed Test 7: Simulation never blocks subsequent genuine postbacks.\n');

    // -------------------------------------------------------------
    // TEST 8: Error-Path Isolation -> Unexpected error during dry-run is strictly read-only
    // -------------------------------------------------------------
    console.log('Test 8: Unexpected error during dry-run triggers isolated read-only error handler...');
    const userBeforeError = db.users.get(testUser._id);
    const balanceBeforeError = userBeforeError.taskEarningsBalance;
    const taskWalletBeforeError = userBeforeError.taskWalletBalance;
    const liabilityBeforeError = userBeforeError.chargebackLiabilityUSD;
    const initialTxCount = db.transactions.size;
    const initialLogCount = db.logs.size;
    const initialNotifCount = db.notifications.size;
    const initialMetricsCount = db.providerMetricsUpdates.length;

    // Trigger unexpected error after log object is created and signature is verified
    forceUserLookupError = true;
    const errorSimReq = {
        user: adminUser,
        body: {
            providerKey: 'torox',
            userId: testUser._id,
            amount: 7.5,
            isReversal: false,
            offerName: 'Error Path Survey Test'
        }
    };
    const errorSimRes = createMockRes();

    await simulatePostback(errorSimReq, errorSimRes);
    forceUserLookupError = false; // Reset error trigger

    // 1. Verify simulation failure response
    assert.strictEqual(errorSimRes.body.success, false, 'Simulator must report success: false on internal error');
    assert.strictEqual(errorSimRes.body.isDryRun, true, 'isDryRun must remain true in error path');
    assert.strictEqual(errorSimRes.body.mutationsPerformed, false, 'mutationsPerformed must remain false in error path');
    assert.strictEqual(errorSimRes.body.validation?.status, 'FAILED', 'Validation status must be FAILED');
    assert.strictEqual(
        errorSimRes.body.validation?.error,
        'An unexpected internal error occurred during simulation processing',
        'Error message must be sanitized without raw exception details'
    );
    assert.strictEqual(errorSimRes.body.simulatorResponse?.status, 500, 'Underlying simulated handler status should be 500');

    // 2. Verify ZERO database mutations occurred during error handling
    const userAfterError = db.users.get(testUser._id);
    assert.strictEqual(userAfterError.taskEarningsBalance, balanceBeforeError, 'User taskEarningsBalance must NOT change on error');
    assert.strictEqual(userAfterError.taskWalletBalance, taskWalletBeforeError, 'User taskWalletBalance must NOT change on error');
    assert.strictEqual(userAfterError.chargebackLiabilityUSD, liabilityBeforeError, 'Chargeback liability must NOT change on error');
    assert.strictEqual(db.logs.size, initialLogCount, 'Zero logs must be persisted in dry-run error path');
    assert.strictEqual(db.transactions.size, initialTxCount, 'Zero transactions must be recorded on error');
    assert.strictEqual(db.notifications.size, initialNotifCount, 'Zero notifications must be sent on error');
    assert.strictEqual(db.providerMetricsUpdates.length, initialMetricsCount, 'Zero provider metrics updated on error');

    // 3. Verify subsequent genuine callback still functions along real-processing path
    const genuineTxId = 'subsequent_genuine_tx_888';
    const genuineOid = 'subsequent_genuine_oid_888';
    const genuineSig = crypto.createHash('md5').update(`${genuineOid}-${testUser._id}-${secret}`).digest('hex');
    const genuineReq = {
        params: { provider: 'torox' },
        query: {
            user_id: testUser._id,
            id: genuineTxId,
            oid: genuineOid,
            amount: 5.0,
            sig: genuineSig
        },
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const genuineRes = createMockRes();
    await handlePostback(genuineReq, genuineRes);

    assert.strictEqual(genuineRes.body, '1', 'Genuine postback completes normally with status 1');
    const userAfterGenuine = db.users.get(testUser._id);
    assert.strictEqual(
        userAfterGenuine.taskEarningsBalance,
        balanceBeforeError + 4.0,
        'Genuine postback successfully credited $4.00 after dry-run error test'
    );
    assert.strictEqual(db.transactions.size, initialTxCount + 1, 'Genuine transaction created');
    console.log('✓ Passed Test 8: Dry-run error path is strictly read-only and subsequent genuine postback succeeds.\n');

    // -------------------------------------------------------------
    // TEST 9: [MOCKED IN-MEMORY TEST] Blocked and earning-restricted users rejected in dry-run with zero mutations
    // -------------------------------------------------------------
    console.log('Test 9: Blocked and earning-restricted users rejected in dry-run [MOCKED IN-MEMORY TEST]...');
    const userToBlock = db.users.get(testUser._id);
    userToBlock.status = 'Blocked';
    userToBlock.restrictions = { earning: false };
    const balBeforeBlockedSim = userToBlock.taskEarningsBalance;

    const blockedSimReq = {
        user: adminUser,
        body: {
            providerKey: 'torox',
            userId: testUser._id,
            amount: 5.0,
            isReversal: false,
            offerName: 'Blocked User Survey Simulation'
        }
    };
    const blockedSimRes = createMockRes();
    await simulatePostback(blockedSimReq, blockedSimRes);

    assert.strictEqual(blockedSimRes.body.success, false, 'Simulation must report failure for blocked user');
    assert.strictEqual(blockedSimRes.body.validation?.userRestricted, true, 'Validation must flag userRestricted');
    assert.strictEqual(userToBlock.taskEarningsBalance, balBeforeBlockedSim, 'Zero balance mutation on blocked user simulation');

    // Earning-restricted test
    userToBlock.status = 'Active';
    userToBlock.restrictions = { earning: true };
    const restrictedSimRes = createMockRes();
    await simulatePostback(blockedSimReq, restrictedSimRes);
    assert.strictEqual(restrictedSimRes.body.success, false, 'Simulation must report failure for earning-restricted user');
    assert.strictEqual(restrictedSimRes.body.validation?.userRestricted, true, 'Validation must flag userRestricted');
    userToBlock.status = 'Active';
    userToBlock.restrictions = { earning: false };
    console.log('✓ Passed Test 9: Blocked and earning-restricted users rejected in dry-run with zero mutations.\n');

    // -------------------------------------------------------------
    // TEST 10: [MOCKED IN-MEMORY TEST] Lock ownership token preservation and stale-lock takeover safety
    // -------------------------------------------------------------
    console.log('Test 10: Lock ownership token preservation and stale-lock takeover safety [MOCKED IN-MEMORY TEST]...');
    const simTxId = 'lock_test_tx_777';
    const oldToken = 'old_expired_owner_token_001';
    await OfferwallPostbackLock.create({
        providerKey: 'torox',
        externalTxId: simTxId,
        ownerToken: oldToken,
        expiresAt: new Date(Date.now() - 10000)
    });

    // New owner acquires stale lock
    const newToken = await acquirePostbackLock('torox', simTxId);
    assert.ok(newToken, 'New owner acquired lock via takeover');
    assert.notStrictEqual(oldToken, newToken, 'New owner token must be distinct');

    // Old owner attempts release
    const relOld = await releasePostbackLock('torox', simTxId, oldToken);
    assert.strictEqual(relOld, false, 'Old owner token release must return false');
    const lockStillPresent = await OfferwallPostbackLock.findOne({ providerKey: 'torox', externalTxId: simTxId });
    assert.ok(lockStillPresent, 'Lock must not be deleted by old owner token');
    assert.strictEqual(lockStillPresent.ownerToken, newToken, 'Lock must remain owned by new owner');

    // Parameterless release attempt must NOT delete new owner's lock
    const relParam = await releasePostbackLock('torox', simTxId);
    assert.strictEqual(relParam, false, 'Parameterless release must return false');
    const lockAfterParamless = await OfferwallPostbackLock.findOne({ providerKey: 'torox', externalTxId: simTxId });
    assert.ok(lockAfterParamless, 'Lock must not be deleted by parameterless release');
    assert.strictEqual(lockAfterParamless.ownerToken, newToken, 'Lock must remain owned by new owner');

    // isLockStillOwned checks
    const isOldValid = await isLockStillOwned('torox', simTxId, oldToken);
    const isNewValid = await isLockStillOwned('torox', simTxId, newToken);
    const isNullValid = await isLockStillOwned('torox', simTxId, null);
    assert.strictEqual(isOldValid, false, 'Old owner token must return false');
    assert.strictEqual(isNewValid, true, 'New owner token must return true');
    assert.strictEqual(isNullValid, false, 'Null token must return false');

    // Proper release
    const relNew = await releasePostbackLock('torox', simTxId, newToken);
    assert.strictEqual(relNew, true, 'New owner token release must return true');
    const lockGone = await OfferwallPostbackLock.findOne({ providerKey: 'torox', externalTxId: simTxId });
    assert.strictEqual(lockGone, null, 'Lock must be deleted when released by new owner');
    console.log('✓ Passed Test 10: Lock ownership token preservation and takeover safety verified in simulator suite.\n');

    // -------------------------------------------------------------
    // TEST 11: [MOCKED IN-MEMORY TEST] Restricted-user transaction deletion failure records CriticalInconsistency
    // -------------------------------------------------------------
    console.log('Test 11: Restricted-user transaction deletion failure records CriticalInconsistency [MOCKED IN-MEMORY TEST]...');
    const delFailUser = db.users.get(testUser._id);
    delFailUser.status = 'Active';
    delFailUser.restrictions = { earning: false };
    const balBeforeDelFail = delFailUser.taskEarningsBalance;

    simulateTxDeleteFailure = true;
    let intercepted11 = false;
    const origFindOneAndUpdate11 = User.findOneAndUpdate;
    User.findOneAndUpdate = async (filter, update, options) => {
        if (filter['restrictions.earning']?.$ne && !intercepted11) {
            intercepted11 = true;
            delFailUser.status = 'Blocked';
            return null; // rejected at balance update point
        }
        return origFindOneAndUpdate11(filter, update, options);
    };

    const delFailTxId = 'torox_del_fail_tx_111';
    const delFailOid = 'torox_del_fail_oid_111';
    const delFailSig = crypto.createHash('md5').update(`${delFailOid}-${testUser._id}-${secret}`).digest('hex');
    const delFailReq = {
        params: { provider: 'torox' },
        query: {
            user_id: testUser._id,
            id: delFailTxId,
            oid: delFailOid,
            amount: 5.0,
            sig: delFailSig
        },
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const delFailRes = createMockRes();
    await handlePostback(delFailReq, delFailRes);
    User.findOneAndUpdate = origFindOneAndUpdate11;
    simulateTxDeleteFailure = false;
    delFailUser.status = 'Active';

    assert.strictEqual(delFailRes.statusCode, 500, 'Deletion failure for restricted user must return HTTP 500');
    assert.ok(delFailRes.body.includes('CRITICAL_INCONSISTENCY'), 'Body must indicate CRITICAL_INCONSISTENCY');
    assert.strictEqual(delFailUser.taskEarningsBalance, balBeforeDelFail, 'User balance must not be credited');

    let foundDelFailLog = null;
    for (const log of db.logs.values()) {
        if (log.externalTxId === delFailTxId) {
            foundDelFailLog = log;
            break;
        }
    }
    assert.ok(foundDelFailLog, 'Log record must exist for rejected postback');
    assert.strictEqual(foundDelFailLog.status, 'CriticalInconsistency', 'Log status must record CriticalInconsistency when transaction deletion fails');
    console.log('✓ Passed Test 11: Restricted-user transaction deletion failure cleanly records CriticalInconsistency.\n');

    // -------------------------------------------------------------
    // TEST 12: [MOCKED IN-MEMORY TEST] Reversal compensation failure verification (null return and thrown error)
    // -------------------------------------------------------------
    console.log('Test 12: Reversal compensation failure verification [MOCKED IN-MEMORY TEST]...');
    const revUser = db.users.get(testUser._id);
    revUser.status = 'Active';
    revUser.restrictions = { earning: false };
    revUser.taskEarningsBalance = 100.0;
    revUser.taskWalletBalance = 100.0;
    revUser.chargebackLiabilityUSD = 0;

    // 12a: Compensation throws error
    const revFailTxId = 'torox_rev_fail_12a';
    const origRevTx = {
        _id: 'tx_orig_rev_torox_12a',
        userId: revUser._id,
        userName: revUser.username,
        type: 'Offerwall Reward',
        amountUSD: 10.0,
        userRewardAmount: 10.0,
        grossAmount: 10.0,
        offerwallProvider: 'torox',
        externalTransactionId: revFailTxId,
        idempotencyKey: `torox_${revFailTxId}_credit`
    };
    db.transactions.set(origRevTx.idempotencyKey, origRevTx);

    // Simulate transaction creation failure on reversal
    const origTxCreate12 = Transaction.create;
    Transaction.create = async (doc) => {
        if (doc.type === 'Offerwall Reversal') {
            throw new Error('Database write constraint violation on reversal');
        }
        return origTxCreate12(doc);
    };

    simulateCompensationFailure = true;
    const revOid = 'torox_rev_oid_12a';
    const revSig = crypto.createHash('md5').update(`${revOid}-${testUser._id}-${secret}`).digest('hex');
    const revReq = {
        params: { provider: 'torox' },
        query: {
            user_id: testUser._id,
            id: revFailTxId,
            oid: revOid,
            amount: -10.0,
            status: '2',
            sig: revSig
        },
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const revRes = createMockRes();
    await handlePostback(revReq, revRes);
    simulateCompensationFailure = false;

    assert.strictEqual(revRes.statusCode, 500, 'Reversal compensation failure must return HTTP 500');
    let log12a = null;
    for (const log of db.logs.values()) {
        if (log.externalTxId === revFailTxId) {
            log12a = log;
            break;
        }
    }
    assert.ok(log12a, 'Log must exist');
    assert.strictEqual(log12a.status, 'CriticalCompensationFailure', 'Status must be CriticalCompensationFailure on thrown compensation error');

    // 12b: Compensation returns null without throwing
    const revNullTxId = 'torox_rev_null_12b';
    const origRevTxNull = {
        _id: 'tx_orig_rev_torox_12b',
        userId: revUser._id,
        userName: revUser.username,
        type: 'Offerwall Reward',
        amountUSD: 10.0,
        userRewardAmount: 10.0,
        grossAmount: 10.0,
        offerwallProvider: 'torox',
        externalTransactionId: revNullTxId,
        idempotencyKey: `torox_${revNullTxId}_credit`
    };
    db.transactions.set(origRevTxNull.idempotencyKey, origRevTxNull);

    simulateCompensationNull = true;
    const revNullOid = 'torox_rev_oid_12b';
    const revNullSig = crypto.createHash('md5').update(`${revNullOid}-${testUser._id}-${secret}`).digest('hex');
    const revNullReq = {
        params: { provider: 'torox' },
        query: {
            user_id: testUser._id,
            id: revNullTxId,
            oid: revNullOid,
            amount: -10.0,
            status: '2',
            sig: revNullSig
        },
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const revNullRes = createMockRes();
    await handlePostback(revNullReq, revNullRes);
    simulateCompensationNull = false;
    Transaction.create = origTxCreate12; // restore

    assert.strictEqual(revNullRes.statusCode, 500, 'Reversal compensation null must return HTTP 500');
    let log12b = null;
    for (const log of db.logs.values()) {
        if (log.externalTxId === revNullTxId) {
            log12b = log;
            break;
        }
    }
    assert.ok(log12b, 'Log must exist');
    assert.strictEqual(log12b.status, 'CriticalCompensationFailure', 'Status must be CriticalCompensationFailure when compensation returns null');
    console.log('✓ Passed Test 12: Reversal compensation failures (thrown error and null return) verified.\n');

    // -------------------------------------------------------------
    // TEST 13: [MOCKED IN-MEMORY TEST] Lock ownership race: slow callback aborts on lost lock ownership before balance mutation
    // -------------------------------------------------------------
    console.log('Test 13: Lock ownership race test [MOCKED IN-MEMORY TEST]...');
    const raceUser = db.users.get(testUser._id);
    raceUser.status = 'Active';
    raceUser.restrictions = { earning: false };
    const raceBalBefore13 = raceUser.taskEarningsBalance;
    const raceTxId13 = 'torox_race_tx_13';
    const raceOid13 = 'torox_race_oid_13';
    const raceSig13 = crypto.createHash('md5').update(`${raceOid13}-${testUser._id}-${secret}`).digest('hex');

    // Hook Transaction.create to simulate lock expiry and takeover before balance update
    const origTxCreate13 = Transaction.create;
    let takeoverSimulated13 = false;
    Transaction.create = async (doc) => {
        if (doc.externalTransactionId === raceTxId13 && !takeoverSimulated13) {
            takeoverSimulated13 = true;
            // Another process takes over the lock
            const lockKey = `torox_${raceTxId13}`;
            db.locks.set(lockKey, {
                providerKey: 'torox',
                externalTxId: raceTxId13,
                ownerToken: 'competing_torox_owner_token_888',
                expiresAt: new Date(Date.now() + 15000),
                createdAt: new Date()
            });
        }
        return origTxCreate13(doc);
    };

    const raceReq13 = {
        params: { provider: 'torox' },
        query: {
            user_id: testUser._id,
            id: raceTxId13,
            oid: raceOid13,
            amount: 10.0,
            sig: raceSig13
        },
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const raceRes13 = createMockRes();
    await handlePostback(raceReq13, raceRes13);
    Transaction.create = origTxCreate13; // restore

    assert.strictEqual(raceRes13.statusCode, 500, 'Process losing lock ownership must fail with 500');
    assert.strictEqual(raceUser.taskEarningsBalance, raceBalBefore13, 'Balance must not change when lock ownership lost');
    assert.strictEqual(db.transactions.has(`torox_${raceTxId13}_credit`), false, 'Pre-created transaction must be cleaned up');

    const lockAfterRace13 = await OfferwallPostbackLock.findOne({ providerKey: 'torox', externalTxId: raceTxId13 });
    assert.ok(lockAfterRace13, 'Competing lock must remain intact');
    assert.strictEqual(lockAfterRace13.ownerToken, 'competing_torox_owner_token_888', 'Competing owner token preserved');
    console.log('✓ Passed Test 13: Lock ownership race detected and handled safely without balance mutation.\n');

    console.log('======================================================');
    console.log('All 13 Postback Simulator Dry-Run Tests Passed Successfully!');
    console.log('======================================================');
}

runTests().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
