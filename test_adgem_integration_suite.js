import assert from 'node:assert/strict';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { 
    handleAdGemPostback, 
    handleAdGemPlayerWebhook,
    constructAdGemEntryUrl, 
    verifySignature,
    seedVerifiedNetworks,
    isLockStillOwned,
    renewPostbackLock
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

console.log('=== Running AdGem Integration, Security & Production-Safety Test Suite ===\n');

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

// Mock MongoDB Session & Transaction Support
class MockSession {
    constructor(supportsTransactions = true) {
        this.supportsTransactions = supportsTransactions;
        this.inTransaction = false;
        this.stagedTransactions = [];
        this.stagedUserUpdates = [];
    }

    startTransaction() {
        if (!this.supportsTransactions) {
            throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
        }
        this.inTransaction = true;
    }

    async commitTransaction() {
        this.inTransaction = false;
        for (const tx of this.stagedTransactions) {
            if (tx.idempotencyKey) {
                for (const existing of db.transactions.values()) {
                    if (existing.idempotencyKey === tx.idempotencyKey) {
                        const err = new Error('Duplicate key error');
                        err.code = 11000;
                        throw err;
                    }
                }
            }
            db.transactions.set(tx._id, tx);
        }
        for (const { user, updates } of this.stagedUserUpdates) {
            for (const [k, v] of Object.entries(updates)) {
                if (k.includes('.')) {
                    const parts = k.split('.');
                    let current = user;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!current[parts[i]]) current[parts[i]] = {};
                        current = current[parts[i]];
                    }
                    current[parts[parts.length - 1]] = v;
                } else {
                    user[k] = v;
                }
            }
        }
    }

    async abortTransaction() {
        this.inTransaction = false;
        this.stagedTransactions = [];
        this.stagedUserUpdates = [];
    }

    async endSession() {}
}

let mockSupportsTransactions = true;
mongoose.startSession = async () => new MockSession(mockSupportsTransactions);

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
User.findOneAndUpdate = async (filter, update, options = {}) => {
    const user = await User.findById(filter._id);
    if (!user) return null;
    if (filter.status?.$ne && user.status === filter.status.$ne) return null;
    if (filter['restrictions.earning']?.$ne && user.restrictions?.earning === true) return null;
    if (filter['restrictions.loginBlocked']?.$ne && user.restrictions?.loginBlocked === true) return null;
    if (filter.adgemSuspended?.$ne && user.adgemSuspended === filter.adgemSuspended.$ne) return null;
    if (filter['restrictions.adgemSuspended']?.$ne && user.restrictions?.adgemSuspended === filter['restrictions.adgemSuspended'].$ne) return null;
    if (filter.$or) {
        const matchesOr = filter.$or.some(cond => {
            if (cond.adgemLastEventAt) {
                if (cond.adgemLastEventAt.$exists === false) return user.adgemLastEventAt === undefined || user.adgemLastEventAt === null;
                if (cond.adgemLastEventAt === null) return user.adgemLastEventAt === null || user.adgemLastEventAt === undefined;
                if (cond.adgemLastEventAt.$lt) {
                    if (!user.adgemLastEventAt) return true;
                    return new Date(user.adgemLastEventAt).getTime() < new Date(cond.adgemLastEventAt.$lt).getTime();
                }
                if (cond.adgemLastEventAt.$lte) {
                    if (!user.adgemLastEventAt) return true;
                    return new Date(user.adgemLastEventAt).getTime() <= new Date(cond.adgemLastEventAt.$lte).getTime();
                }
            }
            return false;
        });
        if (!matchesOr) return null;
    }

    const stagedUpdates = {};
    if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
            stagedUpdates[k] = Number(((user[k] || 0) + v).toFixed(4));
        }
    }
    if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
            stagedUpdates[k] = v;
        }
    }

    const applyUpdates = (target, updates) => {
        for (const [k, v] of Object.entries(updates)) {
            if (k.includes('.')) {
                const parts = k.split('.');
                let current = target;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = v;
            } else {
                target[k] = v;
            }
        }
    };

    if (options.session?.inTransaction) {
        options.session.stagedUserUpdates.push({ user, updates: stagedUpdates });
        const clone = JSON.parse(JSON.stringify(user));
        applyUpdates(clone, stagedUpdates);
        return clone;
    } else {
        applyUpdates(user, stagedUpdates);
        return user;
    }
};
User.findByIdAndUpdate = async (id, update, options = {}) => {
    return User.findOneAndUpdate({ _id: id }, update, options);
};

// Mock Transaction Model
Transaction.create = async (docOrArray, options = {}) => {
    const docs = Array.isArray(docOrArray) ? docOrArray : [docOrArray];
    const created = [];
    for (const doc of docs) {
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
        if (options.session?.inTransaction) {
            options.session.stagedTransactions.push(tx);
        } else {
            db.transactions.set(id, tx);
        }
        created.push(tx);
    }
    return Array.isArray(docOrArray) ? created : created[0];
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
OfferwallProvider.find = (query = {}) => {
    const all = Array.from(db.providers.values());
    const filter = (items) => {
        if (query.providerKey?.$in) {
            return items.filter(p => query.providerKey.$in.includes(p.providerKey));
        }
        return items;
    };
    const queryObj = {
        select: () => queryObj,
        lean: async () => filter(all),
        then: (resolve, reject) => Promise.resolve(filter(all)).then(resolve, reject)
    };
    return queryObj;
};
OfferwallProvider.create = async (doc) => {
    db.providers.set(doc.providerKey.toLowerCase(), { ...doc, save: async function() { return this; } });
    return doc;
};

// Mock OfferwallPostbackLog Model
OfferwallPostbackLog.prototype.save = async function() { return this; };
OfferwallPostbackLog.create = async (doc) => {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const entry = { _id: id, receivedAt: new Date(), ...doc, save: async function() { return this; } };
    db.logs.set(id, entry);
    return entry;
};
OfferwallPostbackLog.findOne = async (query = {}) => {
    for (const log of db.logs.values()) {
        let match = true;
        if (query.provider && log.provider !== query.provider) match = false;
        if (query.externalTxId && log.externalTxId !== query.externalTxId) match = false;
        if (query.userId && String(log.userId) !== String(query.userId)) match = false;
        if (query.status && log.status !== query.status) match = false;
        if (query.receivedAt?.$gte && new Date(log.receivedAt || Date.now()) < query.receivedAt.$gte) match = false;
        if (match) return log;
    }
    return null;
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
    let lock = db.locks.get(key);
    if (filter.ownerToken || filter.expiresAt?.$gt) {
        if (!lock) return null;
        if (filter.ownerToken && lock.ownerToken !== filter.ownerToken) return null;
        if (filter.expiresAt?.$gt && new Date(lock.expiresAt).getTime() <= new Date(filter.expiresAt.$gt).getTime()) return null;
    } else if (filter.expiresAt?.$lt) {
        if (!lock) return null;
        if (new Date(lock.expiresAt).getTime() >= new Date(filter.expiresAt.$lt).getTime()) return null;
    } else {
        if (!lock) {
            lock = {
                providerKey: filter.providerKey,
                externalTxId: filter.externalTxId,
                expiresAt: new Date(Date.now() - 10000),
                ownerToken: 'old_token'
            };
            db.locks.set(key, lock);
        }
    }
    if (update.$set) {
        Object.assign(lock, update.$set);
    }
    return lock;
};

// Mock ProviderPlacement Model
ProviderPlacement.find = (query) => {
    const list = Array.from(db.placements.values()).filter(p => !query.parentTabId || p.parentTabId === query.parentTabId);
    return {
        lean: async () => list
    };
};
ProviderPlacement.findById = async (id) => db.placements.get(String(id)) || null;

// Mock Setting Model
Setting.getSettings = async () => db.settings || {
    customEarnTabs: [{ id: 'available_jobs', enabled: true, subTabs: [] }],
    modulePagesConfig: { workAndEarn: { otherTasks: { isEnabled: true } } }
};

// Mock Notification Model
Notification.create = async (doc) => ({ _id: 'notif_mock', ...doc });

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

// Setup Default Active AdGem Provider with Verified 70/30 Rules
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
        exchangeRateMultiplier: 100, // 100 virtual units = $1 USD divisor
        commissionMode: 'provider_managed',
        userRevenueSharePercent: 70,
        platformRevenueSharePercent: 30,
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
        adgemSuspended: false,
        ...overrides,
        restrictions: {
            earning: false,
            withdrawal: false,
            loginBlocked: false,
            adgemSuspended: false,
            ...(overrides.restrictions || {})
        }
    };
    db.users.set(String(user._id), user);
    return user;
};

// Helper: Build Valid Signed AdGem Webhook Request
const buildAdGemWebhookRequest = (payloadObj, secretKey, options = {}) => {
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

let passedTests = 0;
let totalTests = 0;

const runTest = async (name, fn) => {
    totalTests++;
    try {
        db.clear();
        mockSupportsTransactions = true;
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
    console.log('--- SECTION 1: AdGem Currency Accounting & Payout Validation ---');

    await runTest('handleAdGemPostback: required example ($1.50 payout, 105 coins -> $1.05 worker reward, $0.45 platform revenue)', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_spec_example',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_adgem_example_001',
                player_id: String(user._id),
                amount: 105,   // 105 coins calculated by AdGem at 70 coins per $1.00 gross revenue
                payout: 1.50   // $1.50 gross publisher payout
            }
        };

        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);

        // Core main wallet MUST NOT be touched
        assert.equal(user.walletBalance, 150.0);

        // Task Earnings balances must be credited by exactly 105 / 100 = $1.05
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(user.taskWalletBalance, 26.05);

        // Verify transaction entry
        assert.equal(db.transactions.size, 1);
        const tx = Array.from(db.transactions.values())[0];
        assert.equal(tx.amount, 1.05);
        assert.equal(tx.grossAmount, 1.50);
        assert.equal(tx.platformRevenueAmount, 0.45);
        assert.equal(tx.destinationWallet, 'TaskEarnings');
    });

    await runTest('handleAdGemPostback: fails closed if exchangeRateMultiplier is missing or not 100', async () => {
        const provider = setupAdGemProvider({ exchangeRateMultiplier: null });
        const user = setupTestUser();
        const payload = {
            request_id: 'req_no_mult',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_mult_1',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('exchangeRateMultiplier must be explicitly 100'));
    });

    await runTest('handleAdGemPostback: fails closed if exchangeRateMultiplier is 1.0 (legacy default rejected)', async () => {
        const provider = setupAdGemProvider({ exchangeRateMultiplier: 1.0 });
        const user = setupTestUser();
        const payload = {
            request_id: 'req_wrong_mult',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_mult_2',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('exchangeRateMultiplier must be explicitly 100'));
    });

    await runTest('handleAdGemPostback: fails closed if payout is missing on payable conversion', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_no_payout',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_payout_1',
                player_id: String(user._id),
                amount: 105
                // payout omitted
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Missing gross publisher payout'));
    });

    await runTest('handleAdGemPostback: fails closed if payout is negative or non-finite', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_neg_payout',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_payout_2',
                player_id: String(user._id),
                amount: 105,
                payout: -1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Invalid or non-positive gross payout'));
    });

    await runTest('handleAdGemPostback: fails closed if user reward exceeds gross payout', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_exceed',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_exceed_1',
                player_id: String(user._id),
                amount: 200,   // $2.00 reward
                payout: 1.50   // $1.50 payout
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('exceeds gross publisher payout'));
    });

    await runTest('handleAdGemPostback: fails closed if reward amount does not correspond to 70% share of payout', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_inconsistent_ratio',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_ratio_1',
                player_id: String(user._id),
                amount: 140,   // $1.40 reward (93% of payout - violates 70/30 contract)
                payout: 1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('70/30'));
    });

    await runTest('handleAdGemPostback: conversion_type === "install" acknowledges with HTTP 200 without balance or transaction mutation', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_install_test',
            data: {
                app_id: '12345',
                conversion_type: 'install',
                conversion_id: 'conv_install_001',
                player_id: String(user._id),
                amount: 0,
                payout: 0
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.message.includes('Install conversion acknowledged'));

        // Zero balance or transaction mutation
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(user.taskWalletBalance, 25.0);
        assert.equal(user.walletBalance, 150.0);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: conversion_type === "install" with tracking_type === "CPI" acknowledges without crediting', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_cpi_install',
            data: {
                app_id: '12345',
                conversion_type: 'install',
                tracking_type: 'CPI',
                conversion_id: 'conv_cpi_inst_001',
                player_id: String(user._id),
                amount: 0,
                payout: 0
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.message.includes('Install conversion acknowledged'));

        // Balance remains unchanged, zero transactions created
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(user.taskWalletBalance, 25.0);
        assert.equal(user.walletBalance, 150.0);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: conversion_type === "reward" with tracking_type === "CPI" receives normal reward processing', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_cpi_reward',
            data: {
                app_id: '12345',
                conversion_type: 'reward',
                tracking_type: 'CPI',
                conversion_id: 'conv_cpi_rew_001',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);

        // Core main wallet MUST NOT be touched
        assert.equal(user.walletBalance, 150.0);

        // Task Earnings balances must be credited by exactly 105 / 100 = $1.05
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(user.taskWalletBalance, 26.05);

        // Transaction created
        assert.equal(db.transactions.size, 1);
        const tx = Array.from(db.transactions.values())[0];
        assert.equal(tx.amount, 1.05);
        assert.equal(tx.grossAmount, 1.50);
        assert.equal(tx.platformRevenueAmount, 0.45);
    });

    await runTest('handleAdGemPostback: missing conversion_type fails closed with HTTP 400', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_missing_conv_type',
            data: {
                app_id: '12345',
                // conversion_type omitted
                conversion_id: 'conv_missing_type_001',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Missing conversion_type'));
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: tracking_type cannot bypass payable reward checks', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        // tracking_type='CPI', conversion_type='reward', but payout is missing
        const payload = {
            request_id: 'req_cpi_bypass_fail',
            data: {
                app_id: '12345',
                conversion_type: 'reward',
                tracking_type: 'CPI',
                conversion_id: 'conv_cpi_bypass_001',
                player_id: String(user._id),
                amount: 105
                // payout omitted
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Missing gross publisher payout'));
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: conversion_type === "reward" with amount === 0 but payout > 0 rejects safely', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_zero_amt_pos_payout',
            data: {
                app_id: '12345',
                conversion_type: 'reward',
                conversion_id: 'conv_zero_amt',
                player_id: String(user._id),
                amount: 0,
                payout: 1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Zero reward amount with positive payout is invalid'));
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: amount > 0 with payout === 0 rejects safely', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_pos_amt_zero_payout',
            data: {
                app_id: '12345',
                conversion_type: 'reward',
                conversion_id: 'conv_zero_payout',
                player_id: String(user._id),
                amount: 105,
                payout: 0
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Positive reward amount with zero payout is invalid'));
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: unknown conversion_type must never produce a reward credit', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_unknown_type',
            data: {
                app_id: '12345',
                conversion_type: 'unknown_event_type',
                conversion_id: 'conv_unknown_type',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Unsupported conversion_type'));
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(db.transactions.size, 0);
    });

    console.log('\n--- SECTION 2: Approval, App ID & Raw-Body Security Gates ---');

    await runTest('handleAdGemPostback: fails closed with HTTP 403 if provider approvalStatus is Pending', async () => {
        const provider = setupAdGemProvider({ approvalStatus: 'Pending' });
        setupTestUser();
        const payload = {
            request_id: 'req_pending',
            data: { app_id: '12345', conversion_id: 'c1', player_id: '507f1f77bcf86cd799439011', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 403);
        assert.ok(res.body.error.includes('not active or approved'));
    });

    await runTest('handleAdGemPostback: fails closed with HTTP 403 if provider status is NOT_STARTED or enabled is false', async () => {
        const provider = setupAdGemProvider({ enabled: false, status: 'NOT_STARTED' });
        setupTestUser();
        const payload = {
            request_id: 'req_disabled',
            data: { app_id: '12345', conversion_id: 'c2', player_id: '507f1f77bcf86cd799439011', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 403);
    });

    await runTest('handleAdGemPostback: fails closed with HTTP 400 if provider appId is missing in settings', async () => {
        const provider = setupAdGemProvider({ appId: '' });
        setupTestUser();
        const payload = {
            request_id: 'req_no_appid',
            data: { app_id: '12345', conversion_id: 'c3', player_id: '507f1f77bcf86cd799439011', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('appId is not configured'));
    });

    await runTest('handleAdGemPostback: fails closed with HTTP 400 if data.app_id does not match configured appId', async () => {
        const provider = setupAdGemProvider({ appId: '12345' });
        setupTestUser();
        const payload = {
            request_id: 'req_wrong_appid',
            data: { app_id: '99999', conversion_id: 'c4', player_id: '507f1f77bcf86cd799439011', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('app_id mismatch'));
    });

    await runTest('handleAdGemPostback: fails closed if req.rawBody is missing (no JSON.stringify fallback allowed)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_no_raw',
            data: { app_id: '12345', conversion_id: 'c5', player_id: '507f1f77bcf86cd799439011', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey, { rawBody: null });
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Missing raw request body buffer'));
    });

    await runTest('handleAdGemPostback: rejects invalid HMAC-SHA256 signature in constant-time', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_bad_sig',
            data: { app_id: '12345', conversion_id: 'c6', player_id: '507f1f77bcf86cd799439011', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey, {
            signature: '0000000000000000000000000000000000000000000000000000000000000000'
        });
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('Invalid AdGem postback signature'));
    });

    await runTest('handleAdGemPostback: strictly requires 24 lowercase hex player_id (rejects username "worker_alice")', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_username_reject',
            data: { app_id: '12345', conversion_id: 'c_user', player_id: 'worker_alice', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('24 lowercase hexadecimal characters'));
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: strictly requires 24 lowercase hex player_id (rejects email)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_email_reject',
            data: { app_id: '12345', conversion_id: 'c_email', player_id: 'alice@smartexn.com', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('24 lowercase hexadecimal characters'));
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: strictly requires lowercase hex player_id (rejects uppercase hex)', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_upper_hex_reject',
            data: { app_id: '12345', conversion_id: 'c_upper', player_id: '507F1F77BCF86CD799439011', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('24 lowercase hexadecimal characters'));
        assert.equal(db.transactions.size, 0);
    });

    await runTest('handleAdGemPostback: non-existent valid 24-hex player_id returns 404 without crediting', async () => {
        const provider = setupAdGemProvider();
        setupTestUser();
        const payload = {
            request_id: 'req_non_existent',
            data: { app_id: '12345', conversion_id: 'c_not_found', player_id: '000000000000000000000000', amount: 105, payout: 1.50 }
        };
        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.equal(db.transactions.size, 0);
    });

    console.log('\n--- SECTION 3: Multi-Goal Semantics & Concurrency Idempotency ---');

    await runTest('Multi-goal campaigns: distinct goals with separate conversion_ids both succeed', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();

        // Goal 1: Reach Level 5 (105 coins, $1.50 payout)
        const payloadGoal1 = {
            request_id: 'req_goal_1',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 8888,
                offer_id: 777,
                offer_name: 'Super RPG',
                goal_id: 1,
                goal_name: 'Reach Level 5',
                conversion_id: 'conv_goal_1_xyz',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };

        const req1 = buildAdGemRequest(payloadGoal1, provider.postbackKey);
        const res1 = createMockRes();
        await handleAdGemPostback(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 26.05);

        // Goal 2: Reach Level 10 (210 coins, $3.00 payout)
        const payloadGoal2 = {
            request_id: 'req_goal_2',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 8888,
                offer_id: 777,
                offer_name: 'Super RPG',
                goal_id: 2,
                goal_name: 'Reach Level 10',
                conversion_id: 'conv_goal_2_abc',
                player_id: String(user._id),
                amount: 210,
                payout: 3.00
            }
        };

        const req2 = buildAdGemRequest(payloadGoal2, provider.postbackKey);
        const res2 = createMockRes();
        await handleAdGemPostback(req2, res2);
        assert.equal(res2.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 28.15); // 25.0 + 1.05 + 2.10 = 28.15

        assert.equal(db.transactions.size, 2);
    });

    await runTest('TASK 2 - Requirement 2.A: Same conversion_id + same goal_id + same offer_id delivered twice -> exactly 1 credit, second duplicate', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_a_1',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 7777,
                offer_id: 101,
                goal_id: 1,
                conversion_id: 'conv_same_both',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };

        const req1 = buildAdGemRequest(payload, provider.postbackKey);
        const res1 = createMockRes();
        await handleAdGemPostback(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);

        // Second delivery of same conversion_id + same goal_id + same offer_id
        const req2 = buildAdGemRequest(payload, provider.postbackKey);
        const res2 = createMockRes();
        await handleAdGemPostback(req2, res2);
        assert.equal(res2.statusCode, 200);
        assert.ok(res2.body.message.includes('Duplicate'));
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);
    });

    await runTest('TASK 2 - Requirement 2.B: Same campaign_id + same offer_id + different goal_id -> each goal credited independently and once', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const basePayload = {
            conversion_type: 'reward',
            app_id: '12345',
            campaign_id: 7777,
            offer_id: 101,
            conversion_id: 'conv_shared_multigoal',
            player_id: String(user._id)
        };

        // Goal 1 completion ($1.05 reward)
        const reqGoal1 = buildAdGemRequest({
            request_id: 'req_b_goal1',
            data: { ...basePayload, goal_id: 1, amount: 105, payout: 1.50 }
        }, provider.postbackKey);
        const resGoal1 = createMockRes();
        await handleAdGemPostback(reqGoal1, resGoal1);
        assert.equal(resGoal1.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);

        // Goal 2 completion under SAME conversion_id ($2.10 reward)
        const reqGoal2 = buildAdGemRequest({
            request_id: 'req_b_goal2',
            data: { ...basePayload, goal_id: 2, amount: 210, payout: 3.00 }
        }, provider.postbackKey);
        const resGoal2 = createMockRes();
        await handleAdGemPostback(reqGoal2, resGoal2);
        assert.equal(resGoal2.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 28.15); // 25.0 + 1.05 + 2.10 = 28.15
        assert.equal(db.transactions.size, 2);

        // Duplicate delivery of Goal 1
        const reqGoal1Dup = buildAdGemRequest({
            request_id: 'req_b_goal1_dup',
            data: { ...basePayload, goal_id: 1, amount: 105, payout: 1.50 }
        }, provider.postbackKey);
        const resGoal1Dup = createMockRes();
        await handleAdGemPostback(reqGoal1Dup, resGoal1Dup);
        assert.equal(resGoal1Dup.statusCode, 200);
        assert.ok(resGoal1Dup.body.message.includes('Duplicate'));
        assert.equal(user.taskEarningsBalance, 28.15);
        assert.equal(db.transactions.size, 2);

        // Duplicate delivery of Goal 2
        const reqGoal2Dup = buildAdGemRequest({
            request_id: 'req_b_goal2_dup',
            data: { ...basePayload, goal_id: 2, amount: 210, payout: 3.00 }
        }, provider.postbackKey);
        const resGoal2Dup = createMockRes();
        await handleAdGemPostback(reqGoal2Dup, resGoal2Dup);
        assert.equal(resGoal2Dup.statusCode, 200);
        assert.ok(resGoal2Dup.body.message.includes('Duplicate'));
        assert.equal(user.taskEarningsBalance, 28.15);
        assert.equal(db.transactions.size, 2);
    });

    await runTest('TASK 2 - Requirement 2.C: Same campaign_id + different offer_id + same goal_id -> different offer versions credit independently', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();

        // Offer version A (offer_id: 101), Goal 1
        const reqA = buildAdGemRequest({
            request_id: 'req_c_offA',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 7777,
                offer_id: 101,
                goal_id: 1,
                conversion_id: 'conv_offA_g1',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        }, provider.postbackKey);
        const resA = createMockRes();
        await handleAdGemPostback(reqA, resA);
        assert.equal(resA.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);

        // Offer version B (offer_id: 202), SAME Goal 1
        const reqB = buildAdGemRequest({
            request_id: 'req_c_offB',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 7777,
                offer_id: 202,
                goal_id: 1,
                conversion_id: 'conv_offB_g1',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        }, provider.postbackKey);
        const resB = createMockRes();
        await handleAdGemPostback(reqB, resB);
        assert.equal(resB.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 27.10); // 26.05 + 1.05 = 27.10
        assert.equal(db.transactions.size, 2);
    });

    await runTest('TASK 2 - Requirement 2.D: Same offer + same goal + different conversion_id -> follows goal-level duplicate protection', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();

        // First callback for Goal 1 with conversion_id 'conv_alpha'
        const req1 = buildAdGemRequest({
            request_id: 'req_d_1',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 7777,
                offer_id: 101,
                goal_id: 1,
                conversion_id: 'conv_alpha',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        }, provider.postbackKey);
        const res1 = createMockRes();
        await handleAdGemPostback(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);

        // Second callback for the SAME Goal 1 but with different conversion_id 'conv_beta'
        const req2 = buildAdGemRequest({
            request_id: 'req_d_2',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 7777,
                offer_id: 101,
                goal_id: 1,
                conversion_id: 'conv_beta',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        }, provider.postbackKey);
        const res2 = createMockRes();
        await handleAdGemPostback(req2, res2);
        assert.equal(res2.statusCode, 200);
        assert.ok(res2.body.message.includes('Duplicate'));

        // Balance must remain unchanged, exactly 1 transaction exists
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);
    });

    await runTest('TASK 2 - Requirement 2.E: Real Concurrency: Promise.all simultaneous duplicate callbacks credit exactly once', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        const payload = {
            request_id: 'req_concurrent_race',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 9999,
                offer_id: 555,
                offer_name: 'Race Offer',
                goal_id: 10,
                goal_name: 'Finish Tutorial',
                conversion_id: 'conv_race_concurrent_001',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };

        const req1 = buildAdGemRequest(payload, provider.postbackKey);
        const res1 = createMockRes();
        const req2 = buildAdGemRequest(payload, provider.postbackKey);
        const res2 = createMockRes();

        // Send two simultaneous callbacks concurrently
        await Promise.all([
            handleAdGemPostback(req1, res1),
            handleAdGemPostback(req2, res2)
        ]);

        // One request must process, and duplicate must not produce second credit
        assert.ok([200, 409].includes(res1.statusCode));
        assert.ok([200, 409].includes(res2.statusCode));

        // Exactly one Transaction must be created
        assert.equal(db.transactions.size, 1);

        // User task balances must increase exactly once ($25.00 -> $26.05)
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(user.taskWalletBalance, 26.05);

        // Main wallet balance must remain 100% untouched at 150.0
        assert.equal(user.walletBalance, 150.0);
    });

    await runTest('TASK 2 - Requirement 2.F: Absent offer_id fallback preserves campaign-level behavior cleanly', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();

        // Callback with NO offer_id
        const payload = {
            request_id: 'req_no_offer_id',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                campaign_id: 8888,
                // offer_id omitted
                goal_id: 1,
                goal_name: 'Fallback Goal',
                conversion_id: 'conv_fallback_001',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };

        const req1 = buildAdGemRequest(payload, provider.postbackKey);
        const res1 = createMockRes();
        await handleAdGemPostback(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);

        // Second delivery without offer_id
        const req2 = buildAdGemRequest(payload, provider.postbackKey);
        const res2 = createMockRes();
        await handleAdGemPostback(req2, res2);
        assert.equal(res2.statusCode, 200);
        assert.ok(res2.body.message.includes('Duplicate'));
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);
    });

    console.log('\n--- SECTION 4: Atomic Database Accounting & MongoDB Transaction Safety ---');

    await runTest('MongoDB Session Transaction: aborts and rolls back if user restriction update fails', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();

        // Cause User.findOneAndUpdate to reject by setting earning restriction right after user lookup
        const originalFindOneAndUpdate = User.findOneAndUpdate;
        User.findOneAndUpdate = async () => null; // simulates user being restricted concurrently

        const payload = {
            request_id: 'req_atomic_abort',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_abort_test',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };

        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);

        assert.equal(res.statusCode, 403);
        assert.ok(res.body.error.includes('restricted or blocked'));

        // Verify zero transactions created and balance unmutated
        assert.equal(db.transactions.size, 0);
        assert.equal(user.taskEarningsBalance, 25.0);

        User.findOneAndUpdate = originalFindOneAndUpdate;
    });

    await runTest('MongoDB Session Transaction: fails closed with HTTP 500 if MongoDB deployment does not support transactions', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser();
        mockSupportsTransactions = false; // Simulates standalone MongoDB without replica set

        const payload = {
            request_id: 'req_no_replica_set',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_no_replica',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };

        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);

        assert.equal(res.statusCode, 500);
        assert.ok(res.body.error.includes('transaction support is unavailable'));
        assert.equal(db.transactions.size, 0);
        assert.equal(user.taskEarningsBalance, 25.0);

        mockSupportsTransactions = true;
    });

    console.log('\n--- SECTION 5: Provider Placement & Visibility Approval Gates ---');

    await runTest('launchProviderPlacement: fails closed with HTTP 403 if AdGem approvalStatus is not Approved', async () => {
        const provider = setupAdGemProvider({ approvalStatus: 'Pending' });
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
        db.placements.set(String(placement._id), placement);

        const req = {
            user: { id: String(user._id) },
            params: { placementId: String(placement._id) }
        };
        const res = createMockRes();
        await launchProviderPlacement(req, res);

        assert.equal(res.statusCode, 403);
        assert.ok(res.body.error.includes('pending approval or not approved'));
    });

    await runTest('launchProviderPlacement: succeeds when AdGem is Approved, ACTIVE, and enabled', async () => {
        const provider = setupAdGemProvider({ approvalStatus: 'Approved', status: 'ACTIVE', enabled: true });
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
        db.placements.set(String(placement._id), placement);

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

    await runTest('getAvailablePlacements: hides AdGem placements if approvalStatus is not Approved', async () => {
        setupAdGemProvider({ approvalStatus: 'Pending', status: 'ACTIVE', enabled: true });
        const user = setupTestUser();
        const placement = {
            _id: '607f1f77bcf86cd799439099',
            providerKey: 'adgem',
            placementEnabled: true,
            availableTasksVisibility: true,
            parentTabId: 'available_jobs'
        };
        db.placements.set(String(placement._id), placement);

        const req = {
            user: { id: String(user._id) },
            params: { parentTabId: 'available_jobs' }
        };
        const res = createMockRes();
        await getAvailablePlacements(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.data.length, 0); // Excluded because approvalStatus is Pending
    });

    console.log('\n--- SECTION 6: AdGem Suspended Player Webhooks & Isolation Tests ---');

    const TEST_WEBHOOK_SECRET = 'test_adgem_webhook_secret_key_8899';

    await runTest('handleAdGemPlayerWebhook: valid player.banned event suspends player AdGem access', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();
        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T10:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'fraudulent multiple device usage',
                created_at: '2026-11-09T10:00:00.000Z'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.adgemSuspended, true);

        // Verify AdGem suspension is set
        assert.equal(user.adgemSuspended, true);
        assert.equal(user.restrictions.adgemSuspended, true);
        assert.equal(user.adgemSuspensionReason, 'fraudulent multiple device usage');

        // CRITICAL ISOLATION: Global account status must NOT be modified
        assert.equal(user.status, 'Active');
        assert.equal(user.restrictions.earning, false);
        assert.equal(user.restrictions.withdrawal, false);
        assert.equal(user.walletBalance, 150.0);
        assert.equal(user.taskEarningsBalance, 25.0);
    });

    await runTest('handleAdGemPlayerWebhook: valid player.unbanned event restores player AdGem access', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser({
            adgemSuspended: true,
            adgemSuspendedAt: new Date('2026-11-09T10:00:00.000Z'),
            restrictions: { earning: false, loginBlocked: false, adgemSuspended: true }
        });
        const payload = {
            type: 'player.unbanned',
            timestamp: '2026-11-09T11:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'reviewed and cleared by support',
                created_at: '2026-11-09T11:00:00.000Z'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.adgemSuspended, false);

        // Verify AdGem suspension is cleared AND adgemSuspendedAt is null
        assert.equal(user.adgemSuspended, false);
        assert.equal(user.restrictions.adgemSuspended, false);
        assert.strictEqual(user.adgemSuspendedAt, null);
        assert.equal(user.adgemSuspensionReason, 'reviewed and cleared by support');

        // Global account status untouched
        assert.equal(user.status, 'Active');
        assert.equal(user.restrictions.earning, false);
        assert.equal(user.restrictions.withdrawal, false);
    });

    await runTest('handleAdGemPlayerWebhook: fails closed if signature is missing or invalid', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();
        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T10:00:00.000Z',
            data: { player_id: String(user._id), app_id: 34014, ban_reason: 'test' }
        };

        // 1. Missing signature header
        const reqNoSig = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET, { signature: '' });
        const resNoSig = createMockRes();
        await handleAdGemPlayerWebhook(reqNoSig, resNoSig);
        assert.equal(resNoSig.statusCode, 400);
        assert.ok(resNoSig.body.error.includes('Missing AdGem webhook signature header'));
        assert.equal(user.adgemSuspended, false);

        // 2. Tampered / invalid signature
        const reqBadSig = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET, {
            signature: '0000000000000000000000000000000000000000000000000000000000000000'
        });
        const resBadSig = createMockRes();
        await handleAdGemPlayerWebhook(reqBadSig, resBadSig);
        assert.equal(resBadSig.statusCode, 400);
        assert.ok(resBadSig.body.error.includes('Invalid AdGem webhook signature'));
        assert.equal(user.adgemSuspended, false);
    });

    await runTest('handleAdGemPlayerWebhook: fails closed with HTTP 500 if ADGEM_WEBHOOK_SECRET is unconfigured', async () => {
        delete process.env.ADGEM_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();
        const payload = {
            type: 'player.banned',
            data: { player_id: String(user._id), app_id: 34014, ban_reason: 'test' }
        };

        const req = buildAdGemWebhookRequest(payload, 'any_secret');
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);
        assert.equal(res.statusCode, 500);
        assert.ok(res.body.error.includes('webhook secret is not configured'));
        assert.equal(user.adgemSuspended, false);

        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    });

    await runTest('handleAdGemPlayerWebhook: fails closed if App ID does not match expected App ID ("34014")', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();
        const payload = {
            type: 'player.banned',
            data: { player_id: String(user._id), app_id: 99999, ban_reason: 'test' }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);
        assert.equal(res.statusCode, 400);
        assert.ok(res.body.error.includes('app_id mismatch or missing'));
        assert.equal(user.adgemSuspended, false);
    });

    await runTest('handleAdGemPlayerWebhook: strictly requires 24 lowercase hex player_id', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        setupTestUser();

        // 1. Missing player_id
        const payloadNoId = {
            type: 'player.banned',
            data: { app_id: 34014, ban_reason: 'test' }
        };
        const req1 = buildAdGemWebhookRequest(payloadNoId, TEST_WEBHOOK_SECRET);
        const res1 = createMockRes();
        await handleAdGemPlayerWebhook(req1, res1);
        assert.equal(res1.statusCode, 400);
        assert.ok(res1.body.error.includes('Missing player_id'));

        // 2. Non-hex username
        const payloadUser = {
            type: 'player.banned',
            data: { player_id: 'worker_alice', app_id: 34014, ban_reason: 'test' }
        };
        const req2 = buildAdGemWebhookRequest(payloadUser, TEST_WEBHOOK_SECRET);
        const res2 = createMockRes();
        await handleAdGemPlayerWebhook(req2, res2);
        assert.equal(res2.statusCode, 400);
        assert.ok(res2.body.error.includes('24 lowercase hexadecimal characters'));
    });

    await runTest('handleAdGemPlayerWebhook: returns 404 if player_id is valid hex but does not exist in SmartExn', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        setupTestUser();

        const payload = {
            type: 'player.banned',
            data: { player_id: '000000000000000000000000', app_id: 34014, ban_reason: 'test' }
        };
        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
    });

    await runTest('handleAdGemPlayerWebhook: rejects unsupported event types and malformed payloads', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();

        // 1. Unsupported event type
        const payloadBadType = {
            type: 'player.deleted',
            data: { player_id: String(user._id), app_id: 34014 }
        };
        const req1 = buildAdGemWebhookRequest(payloadBadType, TEST_WEBHOOK_SECRET);
        const res1 = createMockRes();
        await handleAdGemPlayerWebhook(req1, res1);
        assert.equal(res1.statusCode, 400);
        assert.ok(res1.body.error.includes('Unsupported or missing event type'));

        // 2. Missing data object
        const payloadNoData = {
            type: 'player.banned'
        };
        const req2 = buildAdGemWebhookRequest(payloadNoData, TEST_WEBHOOK_SECRET);
        const res2 = createMockRes();
        await handleAdGemPlayerWebhook(req2, res2);
        assert.equal(res2.statusCode, 400);
        assert.ok(res2.body.error.includes('Missing or invalid data object'));
    });

    await runTest('Test 1: Missing timestamp when adgemLastEventAt already exists succeeds and updates state', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser({
            adgemSuspended: false,
            adgemLastEventAt: new Date(Date.now() - 3600000) // 1 hour ago
        });

        // Event payload with NO created_at and NO timestamp
        const payload = {
            type: 'player.banned',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'timeless suspension'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applied, true);
        assert.equal(res.body.adgemSuspended, true);
        assert.equal(user.adgemSuspended, true);
        assert.ok(user.adgemLastEventAt);
    });

    await runTest('Test 2: Failed atomic user update must never return a false success', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();

        // Simulate User.findOneAndUpdate failing to match or update
        const originalFindOneAndUpdate = User.findOneAndUpdate;
        User.findOneAndUpdate = async () => null;

        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T18:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'failed atomic update test',
                created_at: '2026-11-09T18:00:00.000Z'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        User.findOneAndUpdate = originalFindOneAndUpdate;

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applied, false);
        assert.equal(res.body.skipped, true);
        assert.ok(res.body.message.includes('Event not applied'));
        assert.equal(user.adgemSuspended, false); // User state was NOT modified
    });

    await runTest('Test 3: Two legitimate same-type events with identical reasons succeed independently', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();

        // Event 1: First ban at 10:00:00 for 'repeated chargebacks'
        const payload1 = {
            type: 'player.banned',
            timestamp: '2026-11-09T10:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'repeated chargebacks',
                created_at: '2026-11-09T10:00:00.000Z'
            }
        };
        const req1 = buildAdGemWebhookRequest(payload1, TEST_WEBHOOK_SECRET);
        const res1 = createMockRes();
        await handleAdGemPlayerWebhook(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(res1.body.applied, true);
        assert.equal(user.adgemSuspended, true);

        // User is cleared/unbanned at 11:00:00
        const unbanPayload = {
            type: 'player.unbanned',
            timestamp: '2026-11-09T11:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'cleared by support',
                created_at: '2026-11-09T11:00:00.000Z'
            }
        };
        const reqUnban = buildAdGemWebhookRequest(unbanPayload, TEST_WEBHOOK_SECRET);
        const resUnban = createMockRes();
        await handleAdGemPlayerWebhook(reqUnban, resUnban);
        assert.equal(resUnban.statusCode, 200);
        assert.equal(resUnban.body.applied, true);
        assert.equal(user.adgemSuspended, false);

        // Event 2: Legitimate second ban at 12:00:00 with IDENTICAL ban_reason
        const payload2 = {
            type: 'player.banned',
            timestamp: '2026-11-09T12:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'repeated chargebacks', // Same reason!
                created_at: '2026-11-09T12:00:00.000Z'
            }
        };
        const req2 = buildAdGemWebhookRequest(payload2, TEST_WEBHOOK_SECRET);
        const res2 = createMockRes();
        await handleAdGemPlayerWebhook(req2, res2);

        // MUST be processed as a legitimate second ban, NOT rejected as duplicate!
        assert.equal(res2.statusCode, 200);
        assert.equal(res2.body.applied, true);
        assert.equal(res2.body.duplicate, undefined);
        assert.equal(user.adgemSuspended, true);
    });

    await runTest('Test 4: Duplicate retry of the same event is acknowledged without re-applying', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();

        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T13:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'retry test',
                created_at: '2026-11-09T13:00:00.000Z'
            }
        };

        const req1 = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res1 = createMockRes();
        await handleAdGemPlayerWebhook(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(res1.body.applied, true);

        const logsCountBefore = Array.from(db.logs.values()).length;

        // Duplicate delivery of the exact same event
        const req2 = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res2 = createMockRes();
        await handleAdGemPlayerWebhook(req2, res2);
        assert.equal(res2.statusCode, 200);
        assert.equal(res2.body.applied, false);
        assert.equal(res2.body.duplicate, true);

        // Zero additional audit logs created
        const logsCountAfter = Array.from(db.logs.values()).length;
        assert.equal(logsCountAfter, logsCountBefore);
    });

    await runTest('Test 5: Missing official event identifier processes cleanly via documented contract', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();

        // Standard official AdGem payload: contains NO id or event_id
        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T14:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'no event id present',
                created_at: '2026-11-09T14:00:00.000Z'
            }
        };
        assert.equal(payload.id, undefined);
        assert.equal(payload.event_id, undefined);
        assert.equal(payload.data.id, undefined);
        assert.equal(payload.data.event_id, undefined);

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applied, true);
        assert.equal(user.adgemSuspended, true);
    });

    await runTest('Test 6: Audit log failure reverts user state change to ensure audit consistency', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser({ adgemSuspended: false });

        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T15:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'audit failure test',
                created_at: '2026-11-09T15:00:00.000Z'
            }
        };

        const originalLogCreate = OfferwallPostbackLog.create;
        OfferwallPostbackLog.create = async () => {
            throw new Error('Database disk write error on audit log');
        };

        try {
            const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
            const res = createMockRes();
            let thrownErr = null;
            try {
                await handleAdGemPlayerWebhook(req, res);
            } catch (err) {
                thrownErr = err;
            }
            assert.ok(thrownErr || res.statusCode === 500);

            // CRITICAL: User state must be reverted or remain pre-update state!
            assert.equal(user.adgemSuspended, false);
            assert.equal(user.restrictions.adgemSuspended, false);
        } finally {
            OfferwallPostbackLog.create = originalLogCreate;
        }
    });

    await runTest('Test 7: Concurrent events and lock expiration fails closed safely', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser({ adgemSuspended: false });

        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T16:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'expired lock test',
                created_at: '2026-11-09T16:00:00.000Z'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();

        // Expire the lock artificially by modifying OfferwallPostbackLock
        const originalFindOne = OfferwallPostbackLock.findOne;
        OfferwallPostbackLock.findOne = async () => ({
            providerKey: 'adgem_event',
            expiresAt: new Date(Date.now() - 10000), // Expired!
            ownerToken: 'other_token'
        });

        let thrownError = null;
        try {
            await handleAdGemPlayerWebhook(req, res);
        } catch (err) {
            thrownError = err;
        }

        OfferwallPostbackLock.findOne = originalFindOne;

        // Fails safely: lock expiration threw or aborted before mutation
        assert.ok(thrownError && thrownError.message.includes('Lock expired or taken over'));
        assert.equal(user.adgemSuspended, false);
    });

    await runTest('Test 8: Older events cannot overwrite newer accepted player states', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        // Player was already unbanned at 17:00:00
        const user = setupTestUser({
            adgemSuspended: false,
            adgemLastEventAt: new Date('2026-11-09T17:00:00.000Z')
        });

        // A delayed ban from 15:00:00 arrives now
        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T15:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'delayed older event',
                created_at: '2026-11-09T15:00:00.000Z'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applied, false);
        assert.equal(res.body.skipped, true);
        assert.ok(res.body.reason.includes('Older event ignored'));
        assert.equal(user.adgemSuspended, false); // Remains unbanned!
    });

    await runTest('Test 9: Lock renewal renews lease successfully while owned by same ownerToken', async () => {
        db.locks.clear();
        const lockKey = 'test_lock_001';
        const ownerToken = 'token_abc123';
        db.locks.set(`adgem_event:${lockKey}`, {
            providerKey: 'adgem_event',
            externalTxId: lockKey,
            ownerToken,
            expiresAt: new Date(Date.now() + 10000)
        });

        const renewed = await renewPostbackLock('adgem_event', lockKey, ownerToken, 20000);
        assert.equal(renewed, true);

        const currentLock = db.locks.get(`adgem_event:${lockKey}`);
        assert.ok(new Date(currentLock.expiresAt).getTime() > Date.now() + 15000);
    });

    await runTest('Test 10: Lock renewal fails if lock was taken over or ownerToken differs', async () => {
        db.locks.clear();
        const lockKey = 'test_lock_002';
        db.locks.set(`adgem_event:${lockKey}`, {
            providerKey: 'adgem_event',
            externalTxId: lockKey,
            ownerToken: 'token_new_owner',
            expiresAt: new Date(Date.now() + 10000)
        });

        const renewed = await renewPostbackLock('adgem_event', lockKey, 'token_old_owner', 20000);
        assert.equal(renewed, false);
    });

    await runTest('Test 11: Equal timestamp conflicting events (player.banned and player.unbanned) safely skipped', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser({
            adgemSuspended: false,
            adgemLastEventAt: new Date('2026-11-09T10:00:00.000Z')
        });

        // Conflicting ban event with exact same timestamp as last event
        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T10:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'conflicting equal timestamp',
                created_at: '2026-11-09T10:00:00.000Z'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applied, false);
        assert.equal(res.body.skipped, true);
        assert.equal(res.body.reason, 'Ambiguous conflicting event with equal timestamp ignored');
        assert.equal(user.adgemSuspended, false);
    });

    await runTest('Test 12: Same timestamp duplicate event re-delivery acknowledged', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser({
            adgemSuspended: true,
            adgemLastEventAt: new Date('2026-11-09T10:00:00.000Z')
        });

        // Duplicate ban event with same timestamp and same banned state
        const payload = {
            type: 'player.banned',
            timestamp: '2026-11-09T10:00:00.000Z',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'duplicate ban',
                created_at: '2026-11-09T10:00:00.000Z'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applied, false);
        assert.equal(res.body.duplicate, true);
        assert.ok(res.body.message.includes('already processed'));
        assert.equal(user.adgemSuspended, true);
    });

    await runTest('Test 13: Invalid supplied timestamp returns HTTP 400', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser();

        const payload = {
            type: 'player.banned',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'invalid timestamp test',
                created_at: 'invalid-date-string-123'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Invalid event timestamp format');
        assert.equal(user.adgemSuspended, false);
    });

    await runTest('Test 14: Global account status, main wallet, and withdrawal restrictions remain untouched', async () => {
        process.env.ADGEM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        setupAdGemProvider({ appId: '34014' });
        const user = setupTestUser({
            status: 'Active',
            walletBalance: 250.75,
            taskEarningsBalance: 30.0,
            restrictions: {
                earning: false,
                withdrawal: false,
                loginBlocked: false,
                adgemSuspended: false
            }
        });

        const payload = {
            type: 'player.banned',
            data: {
                player_id: String(user._id),
                app_id: 34014,
                ban_reason: 'account boundary test'
            }
        };

        const req = buildAdGemWebhookRequest(payload, TEST_WEBHOOK_SECRET);
        const res = createMockRes();
        await handleAdGemPlayerWebhook(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(user.adgemSuspended, true);
        assert.equal(user.restrictions.adgemSuspended, true);

        // Core balances and global flags MUST NOT BE MUTATED
        assert.equal(user.status, 'Active');
        assert.equal(user.walletBalance, 250.75);
        assert.equal(user.restrictions.earning, false);
        assert.equal(user.restrictions.withdrawal, false);
        assert.equal(user.restrictions.loginBlocked, false);
    });

    await runTest('OfferwallPostbackLog schema: accepts all player webhook statuses without validation errors', async () => {
        const statuses = ['PlayerSuspended', 'PlayerUnsuspended', 'DuplicateEvent', 'SecurityRejected'];
        const allowedStatuses = OfferwallPostbackLog.schema.path('status').enumValues;

        for (const st of statuses) {
            assert.ok(allowedStatuses.includes(st), `Status '${st}' must be in OfferwallPostbackLog status enum`);
            const doc = new OfferwallPostbackLog({
                provider: 'adgem',
                externalTxId: `schema_test_${st}`,
                status: st
            });
            const err = doc.validateSync();
            assert.equal(err, undefined, `Document with status '${st}' must pass schema validation`);
        }
    });

    await runTest('Enforcement: Suspended player cannot launch AdGem offers', async () => {
        const provider = setupAdGemProvider({ approvalStatus: 'Approved', status: 'ACTIVE', enabled: true, appId: '34014' });
        const user = setupTestUser({ adgemSuspended: true });
        const placement = {
            _id: '607f1f77bcf86cd799439099',
            providerKey: 'adgem',
            placementEnabled: true,
            availableTasksVisibility: true,
            parentTabId: 'available_jobs',
            userLevels: ['All Levels'],
            targetCountries: ['All Countries']
        };
        db.placements.set(String(placement._id), placement);

        const req = {
            user: { id: String(user._id) },
            params: { placementId: String(placement._id) }
        };
        const res = createMockRes();
        await launchProviderPlacement(req, res);

        assert.equal(res.statusCode, 403);
        assert.ok(res.body.error.includes('suspended from AdGem'));
    });

    await runTest('Enforcement: Suspended player cannot see AdGem in getAvailablePlacements', async () => {
        setupAdGemProvider({ approvalStatus: 'Approved', status: 'ACTIVE', enabled: true, appId: '34014' });
        const user = setupTestUser({ adgemSuspended: true });
        const placement = {
            _id: '607f1f77bcf86cd799439099',
            providerKey: 'adgem',
            placementEnabled: true,
            availableTasksVisibility: true,
            parentTabId: 'available_jobs'
        };
        db.placements.set(String(placement._id), placement);

        const req = {
            user: { id: String(user._id) },
            params: { parentTabId: 'available_jobs' }
        };
        const res = createMockRes();
        await getAvailablePlacements(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.data.length, 0); // Excluded because adgemSuspended is true
    });

    await runTest('Enforcement: Suspended player cannot receive AdGem rewards', async () => {
        const provider = setupAdGemProvider();
        const user = setupTestUser({ adgemSuspended: true });
        const payload = {
            request_id: 'req_suspended_reward',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_suspended_001',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };

        const req = buildAdGemRequest(payload, provider.postbackKey);
        const res = createMockRes();
        await handleAdGemPostback(req, res);

        assert.equal(res.statusCode, 403);
        assert.ok(res.body.error.includes('suspended from AdGem'));

        // Zero balance mutation and zero transactions created
        assert.equal(user.taskEarningsBalance, 25.0);
        assert.equal(user.taskWalletBalance, 25.0);
        assert.equal(user.walletBalance, 150.0);
        assert.equal(db.transactions.size, 0);
    });

    await runTest('Restoration: Unsuspended player can access and earn from AdGem again', async () => {
        const provider = setupAdGemProvider({ approvalStatus: 'Approved', status: 'ACTIVE', enabled: true, appId: '12345' });
        // User was suspended, now unbanned
        const user = setupTestUser({ adgemSuspended: false });
        const placement = {
            _id: '607f1f77bcf86cd799439099',
            providerKey: 'adgem',
            placementEnabled: true,
            availableTasksVisibility: true,
            parentTabId: 'available_jobs',
            userLevels: ['All Levels'],
            targetCountries: ['All Countries']
        };
        db.placements.set(String(placement._id), placement);

        // 1. Placement visibility restored
        const reqList = { user: { id: String(user._id) }, params: { parentTabId: 'available_jobs' } };
        const resList = createMockRes();
        await getAvailablePlacements(reqList, resList);
        assert.equal(resList.statusCode, 200);
        assert.equal(resList.body.data.length, 1);

        // 2. Launch restored
        const reqLaunch = { user: { id: String(user._id) }, params: { placementId: String(placement._id) } };
        const resLaunch = createMockRes();
        await launchProviderPlacement(reqLaunch, resLaunch);
        assert.equal(resLaunch.statusCode, 200);
        assert.ok(resLaunch.body.launchUrl.includes('api.adgem.com'));

        // 3. Reward processing restored
        const payloadReward = {
            request_id: 'req_restored_reward',
            data: {
                conversion_type: 'reward',
                app_id: '12345',
                conversion_id: 'conv_restored_001',
                player_id: String(user._id),
                amount: 105,
                payout: 1.50
            }
        };
        const reqReward = buildAdGemRequest(payloadReward, provider.postbackKey);
        const resReward = createMockRes();
        await handleAdGemPostback(reqReward, resReward);
        assert.equal(resReward.statusCode, 200);
        assert.equal(user.taskEarningsBalance, 26.05);
        assert.equal(db.transactions.size, 1);
    });

    await runTest('Provider Isolation: Other providers (CPX Research) remain unaffected by AdGem suspension', async () => {
        // Provider setup
        setupAdGemProvider({ approvalStatus: 'Approved', status: 'ACTIVE', enabled: true, appId: '12345' });
        const cpxProvider = {
            providerKey: 'cpx_research',
            name: 'CPX Research',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: true,
            status: 'ACTIVE',
            appId: '9876',
            secretKey: 'test_cpx_secret_key_123',
            iframeUrlTemplate: 'https://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}'
        };
        db.providers.set('cpx_research', cpxProvider);

        // User is AdGem-suspended, but NOT globally restricted
        const user = setupTestUser({ adgemSuspended: true });

        const adgemPlacement = {
            _id: '607f1f77bcf86cd799439001',
            providerKey: 'adgem',
            placementEnabled: true,
            availableTasksVisibility: true,
            parentTabId: 'available_jobs'
        };
        const cpxPlacement = {
            _id: '607f1f77bcf86cd799439002',
            providerKey: 'cpx_research',
            placementEnabled: true,
            availableTasksVisibility: true,
            parentTabId: 'available_jobs',
            userLevels: ['All Levels'],
            targetCountries: ['All Countries']
        };
        db.placements.set(String(adgemPlacement._id), adgemPlacement);
        db.placements.set(String(cpxPlacement._id), cpxPlacement);

        // 1. In getAvailablePlacements: AdGem is filtered out, but CPX Research is included
        const reqList = { user: { id: String(user._id) }, params: { parentTabId: 'available_jobs' } };
        const resList = createMockRes();
        await getAvailablePlacements(reqList, resList);
        assert.equal(resList.statusCode, 200);
        assert.equal(resList.body.data.length, 1);
        assert.equal(resList.body.data[0].providerKey, 'cpx_research');

        // 2. In launchProviderPlacement: CPX Research launches successfully
        const reqLaunch = { user: { id: String(user._id) }, params: { placementId: String(cpxPlacement._id) } };
        const resLaunch = createMockRes();
        await launchProviderPlacement(reqLaunch, resLaunch);
        assert.equal(resLaunch.statusCode, 200);
        assert.ok(resLaunch.body.launchUrl.includes('cpx-research.com'));

        // 3. User global status and balances untouched
        assert.equal(user.status, 'Active');
        assert.equal(user.walletBalance, 150.0);
    });

    console.log(`\n========================================================`);
    console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
    console.log(`========================================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
    process.exit(0);
})();
