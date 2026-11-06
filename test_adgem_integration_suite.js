import assert from 'node:assert/strict';
import crypto from 'crypto';
import { 
    handleAdGemPostback, 
    constructAdGemEntryUrl, 
    verifySignature,
    seedVerifiedNetworks 
} from './backend/controllers/postbackController.js';
import { launchProviderPlacement } from './backend/controllers/providerPlacementController.js';
import User from './backend/models/User.js';
import Transaction from './backend/models/Transaction.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import OfferwallPostbackLog from './backend/models/OfferwallPostbackLog.js';
import OfferwallPostbackLock from './backend/models/OfferwallPostbackLock.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import Setting from './backend/models/Setting.js';

console.log('=== Running AdGem Integration, Security & Compliance Test Suite ===\n');

// In-memory Mock Database
class MockDb {
    constructor() {
        this.users = new Map();
        this.transactions = new Map();
        this.providers = new Map();
        this.logs = new Map();
        this.locks = new Map();
        this.placements = new Map();
        this.settings = null;
    }

    clear() {
        this.users.clear();
        this.transactions.clear();
        this.providers.clear();
        this.logs.clear();
        this.locks.clear();
        this.placements.clear();
        this.settings = null;
    }
}

const db = new MockDb();

// Mock User Model
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
    if (filter['restrictions.loginBlocked']?.$ne && user.restrictions?.loginBlocked === true) return null;

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

// Mock Transaction Model
Transaction.create = async (doc) => {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tx = { _id: id, ...doc };
    if (tx.idempotencyKey) {
        for (const existing of db.transactions.values()) {
            if (existing.idempotencyKey === tx.idempotencyKey) {
                const err = new Error('Duplicate key error');
                err.code = 11000;
                throw err;
            }
        }
    }
    db.transactions.set(id, tx);
    return tx;
};
Transaction.findOne = async (query) => {
    for (const tx of db.transactions.values()) {
        let match = true;
        for (const [k, v] of Object.entries(query)) {
            if (tx[k] !== v) match = false;
        }
        if (match) return tx;
    }
    return null;
};
Transaction.deleteOne = async (query) => {
    if (query._id && db.transactions.has(String(query._id))) {
        db.transactions.delete(String(query._id));
        return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
};

// Mock OfferwallProvider Model
OfferwallProvider.findOne = async (query) => {
    if (query.providerKey) {
        return db.providers.get(query.providerKey.toLowerCase()) || null;
    }
    return null;
};
OfferwallProvider.find = async () => Array.from(db.providers.values());
OfferwallProvider.create = async (doc) => {
    db.providers.set(doc.providerKey.toLowerCase(), { ...doc, save: async function() { return this; } });
    return doc;
};

// Mock OfferwallPostbackLog Model
OfferwallPostbackLog.create = async (doc) => {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const entry = { _id: id, ...doc, save: async function() { return this; } };
    db.logs.set(id, entry);
    return entry;
};
OfferwallPostbackLog.prototype.save = async function() {
    const id = this._id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this._id = id;
    db.logs.set(id, this);
    return this;
};

// Mock OfferwallPostbackLock Model
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
    if (lock && filter.expiresAt?.$lt && new Date(lock.expiresAt) < filter.expiresAt.$lt) {
        Object.assign(lock, update.$set);
        return lock;
    }
    return null;
};

// Mock Setting Model
Setting.getSettings = async () => db.settings || {
    customEarnTabs: [{ id: 'available_jobs', enabled: true }],
    modulePagesConfig: { workAndEarn: { otherTasks: { isEnabled: true } } }
};

// Helper: Create Mock Response
const createMockRes = () => {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        send(data) {
            this.body = data;
            return this;
        }
    };
};

// Helper: Build Valid Signed AdGem Request
const buildAdGemRequest = (payloadObj, secretKey, options = {}) => {
    const rawBodyBuffer = Buffer.from(JSON.stringify(payloadObj), 'utf8');
    const signature = crypto.createHmac('sha256', secretKey).update(rawBodyBuffer).digest('hex');

    const headers = {
        'content-type': 'application/json',
        'signature': options.signature !== undefined ? options.signature : signature,
        ...options.headers
    };

    return {
        method: options.method || 'POST',
        headers,
        rawBody: options.rawBody !== undefined ? options.rawBody : rawBodyBuffer,
        body: options.body !== undefined ? options.body : payloadObj,
        query: options.query || {},
        get(headerName) {
            return this.headers[headerName.toLowerCase()];
        }
    };
};

// Setup Default Active AdGem Provider
const setupAdGemProvider = (overrides = {}) => {
    const provider = {
        providerKey: 'adgem',
        name: 'AdGem',
        category: 'offerwall',
        group: 'Group A: Multi-Task / Offerwall',
        enabled: true,
        status: 'ACTIVE',
        approvalStatus: 'Approved',
        appId: '12345',
        postbackKey: 'test_adgem_postback_key_secret_9988',
        exchangeRateMultiplier: 1.0,
        commissionMode: 'provider_managed',
        ...overrides
    };
    db.providers.set('adgem', provider);
    return provider;
};

// Setup Default Worker User
const setupTestUser = (overrides = {}) => {
    const user = {
        _id: '507f1f77bcf86cd799439011',
        username: 'worker_alice',
        email: 'alice@smartexn.com',
        status: 'Active',
        walletBalance: 150.0, // Core main balance (MUST NEVER BE MUTATED)
        taskEarningsBalance: 25.0, // Work & Earn balance (MUST BE MUTATED)
        taskWalletBalance: 25.0, // Display mirror (MUST BE MUTATED)
        restrictions: {
            earning: false,
            loginBlocked: false
        },
        ...overrides
    };
    db.users.set(String(user._id), user);
    return user;
};

let passedTests = 0;
let totalTests = 0;

const runTest = async (name, fn) => {
    totalTests++;
    try {
        db.clear();
        await fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
        console.error(err.stack);
        process.exitCode = 1;
    }
};

(async () => {
    console.log('--- SECTION 1: AdGem Web Offerwall URL Construction ---');

    await runTest('constructAdGemEntryUrl: builds standard https URL with appId and playerId', async () => {
        const provider = { appId: '9876' };
        const result = constructAdGemEntryUrl(provider, '507f1f77bcf86cd799439011');
        assert.equal(result.error, null);
        assert.equal(result.url, 'https://api.adgem.com/v1/wall?appid=9876&playerid=507f1f77bcf86cd799439011');
    });

    await runTest('constructAdGemEntryUrl: fails closed if user ID is missing or empty', async () => {
        const provider = { appId: '9876' };
        const res1 = constructAdGemEntryUrl(provider, '');
        assert.ok(res1.error);
        assert.equal(res1.url, '');

        const res2 = constructAdGemEntryUrl(provider, null);
        assert.ok(res2.error);
    });

    await runTest('constructAdGemEntryUrl: fails closed if user ID contains unsafe characters', async () => {
        const provider = { appId: '9876' };
        const res = constructAdGemEntryUrl(provider, 'user<script>alert(1)</script>');
        assert.ok(res.error);
        assert.equal(res.url, '');
    });

    await runTest('constructAdGemEntryUrl: fails closed if provider appId is missing', async () => {
        const provider = { appId: '' };
        const res = constructAdGemEntryUrl(provider, '507f1f77bcf86cd799439011');
        assert.ok(res.error);
        assert.equal(res.url, '');
    });

    await runTest('constructAdGemEntryUrl: handles custom template if configured', async () => {
        const provider = { 
            appId: '9876',
            iframeUrlTemplate: 'https://api.adgem.com/v1/wall?appid={appId}&playerid={userId}&custom=1'
        };
        const res = constructAdGemEntryUrl(provider, '507f1f77bcf86cd799439011');
        assert.equal(res.error, null);
        assert.equal(res.url, 'https://api.adgem.com/v1/wall?appid=9876&playerid=507f1f77bcf86cd799439011&custom=1');
    });

    console.log('\n--- SECTION 2: AdGem Postback v3 Protocol & Signature Verification ---');

    await runTest('handleAdGemPostback: rejects non-POST HTTP methods with 405 Method Not Allowed', async () => {
        setupAdGemProvider();
        setupTestUser();
        const req = { method: 'GET', headers: {} };
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 405);
        assert.equal(res.body.success, false);
    });

    await runTest('handleAdGemPostback: rejects request when AdGem provider is not in DB (404)', async () => {
        // No provider configured
        setupTestUser();
        const req = buildAdGemRequest({ request_id: 'r1', data: {} }, 'secret');
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
    });

    await runTest('handleAdGemPostback: rejects request when AdGem provider is disabled or NOT_STARTED (403)', async () => {
        setupAdGemProvider({ enabled: false, status: 'NOT_STARTED' });
        setupTestUser();
        const req = buildAdGemRequest({ request_id: 'r1', data: {} }, 'secret');
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
    });

    await runTest('handleAdGemPostback: fails closed with 400 when postbackKey is missing', async () => {
        setupAdGemProvider({ postbackKey: '', secretKey: '' });
        setupTestUser();
        const req = buildAdGemRequest({ request_id: 'r1', data: {} }, 'some_key');
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('postback key is not configured'));
    });

    await runTest('handleAdGemPostback: rejects request when signature header is missing (400)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const req = buildAdGemRequest({ request_id: 'r1', data: {} }, provider.postbackKey, { signature: '' });
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Missing AdGem signature header'));
    });

    await runTest('handleAdGemPostback: rejects request with invalid HMAC-SHA256 signature (400)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const req = buildAdGemRequest({ request_id: 'r1', data: {} }, provider.postbackKey, { signature: 'invalid_hex_hash_0000000000000000000000000000000000000000000000000000000000000000' });
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Invalid AdGem postback signature'));
    });

    await runTest('handleAdGemPostback: fails closed when raw body does not match signed body (tamper detection)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const originalPayload = { request_id: 'r1', data: { amount: 10 } };
        const tamperedPayload = { request_id: 'r1', data: { amount: 1000 } };
        // Signature computed on original payload, but req.rawBody has tampered payload
        const req = buildAdGemRequest(originalPayload, provider.postbackKey, {
            rawBody: Buffer.from(JSON.stringify(tamperedPayload), 'utf8')
        });
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Invalid AdGem postback signature'));
    });

    console.log('\n--- SECTION 3: AdGem Payload Structure & Parameter Validation ---');

    await runTest('handleAdGemPostback: rejects payload missing request_id (400)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = { data: { conversion_id: 'c1', player_id: '507f1f77bcf86cd799439011' } };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('request_id'));
    });

    await runTest('handleAdGemPostback: rejects payload missing data object (400)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = { request_id: 'req_123' };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('data'));
    });

    await runTest('handleAdGemPostback: rejects payload when data.app_id does not match configured appId (400)', async () => {
        const provider = setupAdGemProvider({ appId: '12345' });
        setupTestUser();
        const payload = {
            request_id: 'req_123',
            data: {
                app_id: 'wrong_app_999',
                conversion_id: 'conv_1',
                player_id: '507f1f77bcf86cd799439011',
                amount: 10
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('app_id mismatch'));
    });

    await runTest('handleAdGemPostback: rejects payload missing conversion_id (400)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_123',
            data: {
                app_id: '12345',
                player_id: '507f1f77bcf86cd799439011',
                amount: 10
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('conversion_id'));
    });

    await runTest('handleAdGemPostback: rejects payload missing player_id (400)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_123',
            data: {
                app_id: '12345',
                conversion_id: 'conv_1',
                amount: 10
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('player_id'));
    });

    console.log('\n--- SECTION 4: User Identification, Account Restrictions & Zero-Reward Events ---');

    await runTest('handleAdGemPostback: acknowledges unknown player_id with HTTP 200 without mutating any balance', async () => {
        const provider = setupAdGemProvider();
        // User not in DB
        const payload = {
            request_id: 'req_unknown_player',
            data: {
                app_id: '12345',
                conversion_id: 'conv_unknown',
                player_id: 'unknown_worker_9999',
                amount: 50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 200);
        assert.ok(res.body.message.includes('User not found'));
        // Verify no transactions created
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: rejects earning-restricted user with HTTP 403', async () => {
        const provider = setupAdGemProvider();
        const restrictedUser = setupTestUser({ restrictions: { earning: true, loginBlocked: false } });
        const payload = {
            request_id: 'req_restricted',
            data: {
                app_id: '12345',
                conversion_id: 'conv_restr',
                player_id: String(restrictedUser._id),
                amount: 25
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 403);
        assert.equal(db.transactions.size, 0);
        assert.equal(restrictedUser.taskEarningsBalance, 25.0);
    });

    await runTest('handleAdGemPostback: rejects blocked user with HTTP 403', async () => {
        const provider = setupAdGemProvider();
        const blockedUser = setupTestUser({ status: 'Blocked' });
        const payload = {
            request_id: 'req_blocked',
            data: {
                app_id: '12345',
                conversion_id: 'conv_blocked',
                player_id: String(blockedUser._id),
                amount: 25
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 403);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: acknowledges zero-reward conversion with HTTP 200 without balance change', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_zero',
            data: {
                app_id: '12345',
                conversion_id: 'conv_zero_reward',
                player_id: String(user._id),
                amount: 0,
                conversion_type: 'event'
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(db.transactions.size, 0);
        assert.equal(user.taskEarningsBalance, 25.0); // Unchanged
    });

    await runTest('handleAdGemPostback: acknowledges install event (conversion_type=install) without balance mutation', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_install',
            data: {
                app_id: '12345',
                conversion_id: 'conv_install_step',
                player_id: String(user._id),
                amount: 0,
                payout: 0.10,
                conversion_type: 'install'
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 200);
        assert.ok(res.body.message.includes('Install'));
        assert.equal(db.transactions.size, 0);
        assert.equal(user.taskEarningsBalance, 25.0); // Unchanged
    });

    console.log('\n--- SECTION 5: Valid Reward Crediting, Isolation & Idempotency ---');

    await runTest('handleAdGemPostback: successfully processes valid reward conversion', async () => {
        const provider = setupAdGemProvider({ exchangeRateMultiplier: 1.0 });
        const user = setupTestUser();
        const payload = {
            request_id: 'req_valid_reward',
            timestamp: 1690000000,
            data: {
                app_id: '12345',
                campaign_id: 8888,
                player_id: String(user._id),
                amount: 15.50, // User reward
                payout: 20.00, // Publisher gross revenue
                conversion_id: 'conv_adgem_success_001',
                conversion_type: 'offer',
                offer_id: 777,
                offer_name: 'Epic Hero Quest Level 5',
                goal_id: 1,
                goal_name: 'Reach Level 5',
                country: 'US'
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.conversionId, 'conv_adgem_success_001');

        // Verify user balances:
        // Core main balance (walletBalance) MUST NEVER BE TOUCHED
        assert.equal(user.walletBalance, 150.0);
        // Task earnings balances MUST BE INCREMENTED by 15.50
        assert.equal(user.taskEarningsBalance, 40.50);
        assert.equal(user.taskWalletBalance, 40.50);

        // Verify transaction entry
        assert.equal(db.transactions.size, 1);
        const tx = Array.from(db.transactions.values())[0];
        assert.equal(tx.offerwallProvider, 'adgem');
        assert.equal(tx.externalTransactionId, 'conv_adgem_success_001');
        assert.equal(tx.amount, 15.50);
        assert.equal(tx.grossAmount, 20.00); // Publisher payout
        assert.equal(tx.destinationWallet, 'TaskEarnings');
        assert.equal(tx.status, 'Approved');
    });

    await runTest('handleAdGemPostback: enforces strict idempotency on duplicate conversion_id', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_dup',
            data: {
                app_id: '12345',
                player_id: String(user._id),
                amount: 10.0,
                payout: 12.0,
                conversion_id: 'conv_adgem_duplicate_test'
            }
        };

        // First call
        const req1 = buildAdGemRequest(payload, provider.postbackKey);
        const res1 = createMockRes();
        await handleAdGemPostback(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 35.0);
        assert.equal(db.transactions.size, 1);

        // Second call with same conversion_id
        const req2 = buildAdGemRequest(payload, provider.postbackKey);
        const res2 = createMockRes();
        await handleAdGemPostback(req2, res2);
        assert.equal(res2.statusCode, 200);
        assert.ok(res2.body.message.includes('Duplicate'));

        // Balance and transactions MUST NOT duplicate
        assert.equal(user.taskEarningsBalance, 35.0);
        assert.equal(db.transactions.size, 1);
    });

    await runTest('handleAdGemPostback: resolves user by username fallback if player_id is not ObjectId', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser({ username: 'alicesmith' });
        const payload = {
            request_id: 'req_username_test',
            data: {
                app_id: '12345',
                player_id: 'alicesmith',
                amount: 5.0,
                conversion_id: 'conv_username_match'
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 30.0);
    });

    console.log('\n--- SECTION 6: Integration Architecture, Seeding & Placements ---');

    await runTest('seedVerifiedNetworks: includes adgem network disabled by default (status: NOT_STARTED)', async () => {
        await seedVerifiedNetworks();
        const adgemSeed = db.providers.get('adgem');
        assert.ok(adgemSeed, 'adgem should be present in seeded verified networks');
        assert.equal(adgemSeed.enabled, false);
        assert.equal(adgemSeed.status, 'NOT_STARTED');
        assert.equal(adgemSeed.approvalStatus, 'Pending');
        assert.equal(adgemSeed.signatureType, 'hmac_sha256');
    });

    await runTest('verifySignature: handles adgem provider key with HMAC-SHA256 over rawBody', async () => {
        const provider = {
            providerKey: 'adgem',
            postbackKey: 'secret_123',
            requireSignature: true
        };
        const payload = { test: 'data' };
        const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
        const signature = crypto.createHmac('sha256', 'secret_123').update(rawBody).digest('hex');

        const req = {
            headers: { signature },
            rawBody,
            body: payload
        };
        const check = verifySignature(provider, payload, '127.0.0.1', req);
        assert.equal(check.valid, true);

        // Bad signature fails
        const badReq = {
            headers: { signature: 'wrong_signature' },
            rawBody,
            body: payload
        };
        const badCheck = verifySignature(provider, payload, '127.0.0.1', badReq);
        assert.equal(badCheck.valid, false);
    });

    await runTest('launchProviderPlacement: successfully generates launch URL and trusts api.adgem.com', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const placement = {
            _id: '607f1f77bcf86cd799439099',
            providerKey: 'adgem',
            placementEnabled: true,
            availableTasksVisibility: true,
            parentTabId: 'available_jobs',
            userLevels: ['All Levels'],
            targetCountries: ['All Countries']
        };
        ProviderPlacement.findById = async () => placement;

        const req = {
            user: { id: String(user._id) },
            params: { placementId: String(placement._id) }
        };
        const res = createMockRes();
        await launchProviderPlacement(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.launchUrl.startsWith('https://api.adgem.com/v1/wall?appid=12345&playerid='));
    });

    console.log(`\n========================================================`);
    console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
    console.log(`========================================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();
