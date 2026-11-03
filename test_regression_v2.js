import assert from 'assert';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { updateUserTaskStatus } from './backend/controllers/userTasksController.js';
import { launchProviderPlacement, validateAndNormalizeHostname, isDomainTrusted } from './backend/controllers/providerPlacementController.js';
import { createDispute } from './backend/controllers/disputesController.js';

import User from './backend/models/User.js';
import UserTask from './backend/models/UserTask.js';
import Transaction from './backend/models/Transaction.js';
import Setting from './backend/models/Setting.js';
import Notification from './backend/models/Notification.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import Deposit from './backend/models/Deposit.js';
import Dispute from './backend/models/Dispute.js';

dotenv.config();

// Safety: Never allow tests to run destructively against production URI
if (process.env.MONGO_URI && (process.env.MONGO_URI.includes('smartexn') || process.env.MONGO_URI.includes('render.com') || process.env.MONGO_URI.includes('cluster0'))) {
    console.error('CRITICAL SAFETY CHECK: Refusing to run tests against production database URI!');
    process.exit(1);
}

console.log('========================================================================');
console.log('SmartExn Comprehensive Regression & Safety Verification Test Suite (v2)');
console.log('Environment: In-Memory Controller Simulation & Mock Environment');
console.log('NOTICE: Live MongoDB replica set transactions and hardware-level concurrency');
console.log('require a dedicated MongoDB replica set cluster. In this test runner,');
console.log('transaction sessions, atomic operators, and fail-closed branches are');
console.log('validated via isolated controller mocks to guarantee zero production impact.');
console.log('========================================================================\n');

let totalTestsPassed = 0;
let totalTestsFailed = 0;

function pass(name) {
    totalTestsPassed++;
    console.log(`  ✓ Passed: ${name}`);
}

function fail(name, err) {
    totalTestsFailed++;
    console.error(`  ✗ FAILED: ${name}`);
    console.error(`    Error: ${err.message || err}`);
}

// =========================================================================
// SUITE 0: UserTask Schema Validation
// =========================================================================
function runSchemaTests() {
    console.log('--- SUITE 0: UserTask Schema Validation ---');
    try {
        const path = UserTask.schema.path('reviewClaimedAt');
        assert.ok(path, 'reviewClaimedAt must exist on UserTask schema');
        assert.equal(path.instance, 'Date', 'reviewClaimedAt must be Date type');
        assert.equal(path.defaultValue, null, 'reviewClaimedAt default must be null');
        pass('Test 0A: Schema Integrity — reviewClaimedAt Date field (default null) is defined in UserTask schema');
    } catch (err) {
        fail('Suite 0: UserTask Schema Validation', err);
    }
    console.log();
}

// =========================================================================
// SUITE 1: Campaign One-Time Review Concurrency & Financial Consistency
// =========================================================================
async function runCampaignConcurrencyTests() {
    console.log('--- SUITE 1: Campaign Review Concurrency & Financial Consistency ---');

    // Mock storage
    const mockUsers = new Map();
    const mockTasks = new Map();
    const mockTransactions = [];
    const mockNotifications = [];

    // Save original model & mongoose methods
    const origMongooseStartSession = mongoose.startSession;
    const origUserFindById = User.findById;
    const origUserFindOneAndUpdate = User.findOneAndUpdate;
    const origUserUpdateOne = User.updateOne;
    const origUserFind = User.find;
    const origTaskFindById = UserTask.findById;
    const origTaskFindOneAndUpdate = UserTask.findOneAndUpdate;
    const origTaskUpdateOne = UserTask.updateOne;
    const origTxCreate = Transaction.create;
    const origTxFindOne = Transaction.findOne;
    const origTxDeleteOne = Transaction.deleteOne;
    const origSettingGetSettings = Setting.getSettings;
    const origNotifCreate = Notification.create;

    Setting.getSettings = async () => ({
        userTaskConfig: {
            minQuantity: 5,
            minRewardAmount: 0.10,
            commissionPercent: 10,
            campaignFeeEnabled: false,
            campaignFeeAmount: 1.00
        },
        exchangeRates: { USD: 1, EUR: 0.92, PKR: 278 }
    });

    User.find = () => ({
        select: async () => [{ _id: 'admin_1', username: 'admin', role: 'admin' }]
    });

    Notification.create = async (notifs) => {
        const arr = Array.isArray(notifs) ? notifs : [notifs];
        mockNotifications.push(...arr);
        return arr;
    };

    // Staged transactional state simulation
    let stagedSnapshot = null;
    let shouldFailStartSession = false;

    mongoose.startSession = async () => {
        if (shouldFailStartSession) {
            throw new Error('MongoServerError: This MongoDB deployment does not support transactions (not a replica set)');
        }

        // Take snapshot of state for potential rollback
        stagedSnapshot = {
            users: new Map(JSON.parse(JSON.stringify(Array.from(mockUsers.entries())))),
            tasks: new Map(JSON.parse(JSON.stringify(Array.from(mockTasks.entries())))),
            txCount: mockTransactions.length
        };

        return {
            startTransaction: () => {},
            commitTransaction: async () => {
                stagedSnapshot = null; // committed!
            },
            abortTransaction: async () => {
                if (stagedSnapshot) {
                    mockUsers.clear();
                    for (const [k, v] of stagedSnapshot.users.entries()) mockUsers.set(k, v);
                    mockTasks.clear();
                    for (const [k, v] of stagedSnapshot.tasks.entries()) mockTasks.set(k, v);
                    mockTransactions.length = stagedSnapshot.txCount;
                    stagedSnapshot = null;
                }
            },
            endSession: async () => {}
        };
    };

    try {
        // Setup mock User & Task
        const userId = 'user_creator_01';
        const taskId = 'task_rejected_01';

        const resetData = () => {
            mockUsers.set(userId, {
                _id: userId,
                username: 'alice_creator',
                currency: 'USD',
                taskWalletBalance: 15.00,
                walletBalance: 25.00,
                campaignWalletSources: { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 15.00 }
            });

            mockTasks.set(taskId, {
                _id: taskId,
                userId: userId,
                title: 'Video Watch Campaign',
                status: 'Rejected',
                targetQuantity: 10,
                rewardPerTask: 1.00, // Subtotal: 10.00, Commission 10%: 1.00, Total: 11.00
                resubmittedForReview: false,
                reviewRequested: false,
                reviewClaimedAt: null,
                history: []
            });

            mockTransactions.length = 0;
            mockNotifications.length = 0;
            shouldFailStartSession = false;

            Transaction.create = async (docs) => {
                const arr = Array.isArray(docs) ? docs : [docs];
                const created = arr.map(d => ({ _id: `tx_${Date.now()}_${Math.random()}`, ...d }));
                mockTransactions.push(...created);
                return created;
            };
        };

        // Mongoose Query Thenable helper
        const makeMongooseQuery = (getter) => ({
            session: function() { return this; },
            then: function(resolve, reject) {
                return Promise.resolve(getter()).then(resolve, reject);
            }
        });

        // Wire mocks to in-memory store
        User.findById = (id) => makeMongooseQuery(() => {
            const u = mockUsers.get(String(id));
            return u ? { ...u } : null;
        });

        User.findOneAndUpdate = async (query, update) => {
            const u = mockUsers.get(String(query._id));
            if (!u) return null;
            if (query.taskWalletBalance?.$gte !== undefined) {
                if (u.taskWalletBalance < query.taskWalletBalance.$gte) return null;
            }
            if (query.walletBalance?.$gte !== undefined) {
                if (u.walletBalance < query.walletBalance.$gte) return null;
            }
            if (update.$inc?.taskWalletBalance) {
                u.taskWalletBalance = Number((u.taskWalletBalance + update.$inc.taskWalletBalance).toFixed(2));
            }
            if (update.$inc?.walletBalance) {
                u.walletBalance = Number((u.walletBalance + update.$inc.walletBalance).toFixed(2));
            }
            if (update.$set?.campaignWalletSources) {
                u.campaignWalletSources = { ...update.$set.campaignWalletSources };
            }
            return { ...u };
        };

        User.updateOne = async (query, update) => {
            const u = mockUsers.get(String(query._id));
            if (!u) return { modifiedCount: 0 };
            if (update.$inc?.taskWalletBalance) {
                u.taskWalletBalance = Number((u.taskWalletBalance + update.$inc.taskWalletBalance).toFixed(2));
            }
            if (update.$inc?.walletBalance) {
                u.walletBalance = Number((u.walletBalance + update.$inc.walletBalance).toFixed(2));
            }
            if (update.$set?.campaignWalletSources) {
                u.campaignWalletSources = { ...update.$set.campaignWalletSources };
            }
            return { modifiedCount: 1 };
        };

        UserTask.findById = (id) => makeMongooseQuery(() => {
            const t = mockTasks.get(String(id));
            return t ? { ...t } : null;
        });

        UserTask.findOneAndUpdate = async (query, update) => {
            const t = mockTasks.get(String(query._id));
            if (!t) return null;
            if (query.status && t.status !== query.status) return null;

            // Check locking conditions
            if (query.resubmittedForReview?.$ne !== undefined) {
                if (t.resubmittedForReview === query.resubmittedForReview.$ne) return null;
            }
            if (query.$or) {
                // Evaluate $or condition for atomic claim / lease
                const matchesAny = query.$or.some(cond => {
                    if (cond.resubmittedForReview?.$ne !== undefined) {
                        return t.resubmittedForReview !== cond.resubmittedForReview.$ne;
                    }
                    if (cond.resubmittedForReview === true) {
                        if (!t.resubmittedForReview) return false;
                        if (cond.$or) {
                            return cond.$or.some(sub => {
                                if (sub.reviewClaimedAt?.$lt) {
                                    return t.reviewClaimedAt && t.reviewClaimedAt < sub.reviewClaimedAt.$lt;
                                }
                                if (sub.reviewClaimedAt?.$exists === false || sub.reviewClaimedAt === null) {
                                    return !t.reviewClaimedAt;
                                }
                                return false;
                            });
                        }
                    }
                    return false;
                });
                if (!matchesAny) return null;
            }

            if (update.$set) {
                Object.assign(t, update.$set);
            }
            if (update.$push?.history) {
                t.history = t.history || [];
                t.history.push(update.$push.history);
            }
            return { ...t };
        };

        UserTask.updateOne = async (query, update) => {
            const t = mockTasks.get(String(query._id));
            if (!t) return { modifiedCount: 0 };
            if (update.$set) Object.assign(t, update.$set);
            return { modifiedCount: 1 };
        };

        Transaction.create = async (docs) => {
            const arr = Array.isArray(docs) ? docs : [docs];
            const created = arr.map(d => ({ _id: `tx_${Date.now()}_${Math.random()}`, ...d }));
            mockTransactions.push(...created);
            return created;
        };

        Transaction.findOne = (query) => makeMongooseQuery(() => {
            return mockTransactions.find(tx => {
                if (query.campaignId && String(tx.campaignId) !== String(query.campaignId)) return false;
                if (query.type && tx.type !== query.type) return false;
                if (query.description?.$regex && !query.description.$regex.test(tx.description)) return false;
                return true;
            }) || null;
        });

        Transaction.deleteOne = async (query) => {
            const idx = mockTransactions.findIndex(tx => tx._id === query._id);
            if (idx !== -1) mockTransactions.splice(idx, 1);
            return { deletedCount: 1 };
        };

        // -----------------------------------------------------------------
        // Test 1A: Concurrent Review Requests -> Exactly ONE succeeds
        // -----------------------------------------------------------------
        resetData();
        const makeReq = () => ({
            params: { id: taskId },
            body: { reviewRequested: true, userReviewMessage: 'Fixed the campaign link!' },
            user: { id: userId, username: 'alice_creator', role: 'user' }
        });

        const makeRes = () => {
            const r = {
                statusCode: 200,
                status: function(code) { this.statusCode = code; return this; },
                json: function(payload) { this.data = payload; return this; }
            };
            return r;
        };

        const res1 = makeRes();
        const res2 = makeRes();
        const res3 = makeRes();

        // Fire 3 simultaneous requests
        await Promise.all([
            updateUserTaskStatus(makeReq(), res1),
            updateUserTaskStatus(makeReq(), res2),
            updateUserTaskStatus(makeReq(), res3)
        ]);

        const responses = [res1, res2, res3];
        const successCount = responses.filter(r => r.statusCode === 200 && r.data?.success).length;
        const rejectedCount = responses.filter(r => (r.statusCode === 400 || r.statusCode === 500) && !r.data?.success).length;

        assert.equal(successCount, 1, 'Exactly one concurrent review request must succeed');
        assert.equal(rejectedCount, 2, 'The other 2 concurrent review requests must be blocked');
        pass('Test 1A: Concurrency Lock — Exactly 1 of 3 concurrent requests succeeded');

        // -----------------------------------------------------------------
        // Test 1B: Exact Final Wallet Balance
        // -----------------------------------------------------------------
        // Cost: 10 * 1.00 + 10% commission = $11.00 USD.
        // Task wallet balance was $15.00, deducted $11.00 -> exactly $4.00 remaining.
        const userAfter = mockUsers.get(userId);
        assert.equal(userAfter.taskWalletBalance, 4.00, 'Task Wallet must be deducted exactly once ($15.00 - $11.00 = $4.00)');
        assert.equal(userAfter.walletBalance, 25.00, 'Main Wallet balance must remain untouched');
        pass('Test 1B: Exact Wallet Balance — Deducted exactly $11.00 once ($15.00 -> $4.00)');

        // -----------------------------------------------------------------
        // Test 1C: Exactly One Financial Transaction Created
        // -----------------------------------------------------------------
        assert.equal(mockTransactions.length, 1, 'Exactly one Transaction record must exist');
        assert.equal(mockTransactions[0].amount, -11.00, 'Transaction amount must be -$11.00');
        assert.equal(mockTransactions[0].type, 'Task Budget Deduction');
        pass('Test 1C: Transaction Integrity — Exactly 1 ledger transaction created for -$11.00');

        // -----------------------------------------------------------------
        // Test 1D: Final Task Status is Pending & resubmittedForReview is true
        // -----------------------------------------------------------------
        const taskAfter = mockTasks.get(taskId);
        assert.equal(taskAfter.status, 'Pending', 'Task status must transition to Pending');
        assert.equal(taskAfter.resubmittedForReview, true, 'resubmittedForReview must be set to true');
        assert.equal(taskAfter.reviewRequested, true, 'reviewRequested must be set to true');
        pass('Test 1D: Task Final State — Successfully transitioned to Pending with resubmittedForReview: true');

        // -----------------------------------------------------------------
        // Test 1E: Error inside transaction -> Complete ACID Abort (No partial writes)
        // -----------------------------------------------------------------
        resetData();
        // Force Transaction.create to throw
        Transaction.create = async () => {
            throw new Error('Database write failure: unique transaction index error');
        };

        const resFailTx = makeRes();
        await updateUserTaskStatus(makeReq(), resFailTx);

        assert.equal(resFailTx.statusCode, 400, 'Request must return 400 error on transaction abort');
        const userAborted = mockUsers.get(userId);
        const taskAborted = mockTasks.get(taskId);

        assert.equal(userAborted.taskWalletBalance, 15.00, 'Wallet balance must be completely unmutated/rolled back upon abort');
        assert.equal(userAborted.campaignWalletSources.fromRefundsUSD, 15.00, 'Campaign wallet sources must remain intact');
        assert.equal(taskAborted.status, 'Rejected', 'Task status must remain in Rejected');
        assert.equal(taskAborted.resubmittedForReview, false, 'resubmittedForReview must be false (rolled back)');
        assert.equal(mockTransactions.length, 0, 'Zero orphan transactions must exist');
        pass('Test 1E: ACID Abort — Transaction abort completely rolled back all writes without partial mutations');

        // -----------------------------------------------------------------
        // Test 1F: Fail Closed when Transactions Unavailable
        // -----------------------------------------------------------------
        resetData();
        shouldFailStartSession = true;

        const resFailClosed = makeRes();
        await updateUserTaskStatus(makeReq(), resFailClosed);

        assert.equal(resFailClosed.statusCode, 503, 'Must return 503 when transaction service is unavailable');
        assert.equal(resFailClosed.data.success, false);
        assert.ok(resFailClosed.data.error.includes('failing closed'), 'Must explicitly indicate failing closed');
        const userFailClosed = mockUsers.get(userId);
        const taskFailClosed = mockTasks.get(taskId);
        assert.equal(userFailClosed.taskWalletBalance, 15.00, 'No wallet balance deducted when transactions unavailable');
        assert.equal(taskFailClosed.status, 'Rejected', 'Task must remain Rejected');
        assert.equal(taskFailClosed.resubmittedForReview, false, 'Task resubmittedForReview must not be mutated');
        assert.equal(mockTransactions.length, 0, 'No ledger transactions created');
        pass('Test 1F: Fail Closed — Controller refuses financial mutations when transactions cannot start');

        // -----------------------------------------------------------------
        // Test 1G: Permanent One-Time Protection (Prevent Historical Double Deduction)
        // -----------------------------------------------------------------
        resetData();
        // Simulate a campaign with resubmittedForReview: true that was rejected again
        const previouslyResubmittedTask = mockTasks.get(taskId);
        previouslyResubmittedTask.status = 'Rejected';
        previouslyResubmittedTask.resubmittedForReview = true;
        previouslyResubmittedTask.reviewClaimedAt = new Date(Date.now() - 3600000); // 1 hour ago

        // Older ledger transaction has NO campaignId:
        mockTransactions.push({
            _id: 'tx_old_without_campaign_id',
            userId: userId,
            type: 'Task Budget Deduction',
            description: 'Resubmitted User Task For Review: Video Watch Campaign',
            amount: -11.00
            // Notice: campaignId is omitted, simulating older historical transaction
        });

        const resDoubleSubmit = makeRes();
        await updateUserTaskStatus(makeReq(), resDoubleSubmit);

        assert.equal(resDoubleSubmit.statusCode, 400, 'Must reject resubmission when resubmittedForReview is already true');
        assert.equal(resDoubleSubmit.data.success, false);
        assert.ok(
            resDoubleSubmit.data.error.includes('already used its one-time review') ||
            resDoubleSubmit.data.error.includes('administrative reconciliation'),
            'Must return error indicating one-time review used or administrative reconciliation required'
        );

        const userAfterDouble = mockUsers.get(userId);
        assert.equal(userAfterDouble.taskWalletBalance, 15.00, 'No wallet balance must be deducted for already-used review');
        assert.equal(userAfterDouble.walletBalance, 25.00, 'Main wallet must remain untouched');
        assert.equal(mockTransactions.length, 1, 'No new transaction ledger record must be created');
        assert.equal(mockTasks.get(taskId).status, 'Rejected', 'Task must remain in Rejected status');
        assert.equal(mockTasks.get(taskId).resubmittedForReview, true, 'resubmittedForReview flag must remain true permanently');
        pass('Test 1G: Permanent Protection — Campaign with resubmittedForReview: true cannot be charged again, even without campaignId in older transaction');

        // -----------------------------------------------------------------
        // Test 1H: Valid First Review on resubmittedForReview: false succeeds
        // -----------------------------------------------------------------
        resetData();
        // Verify resubmittedForReview: false completes its first valid review
        const freshTask = mockTasks.get(taskId);
        assert.equal(freshTask.resubmittedForReview, false);

        const resFirstReview = makeRes();
        await updateUserTaskStatus(makeReq(), resFirstReview);

        assert.equal(resFirstReview.statusCode, 200, 'First valid review request must succeed');
        assert.equal(resFirstReview.data.success, true);
        assert.equal(mockUsers.get(userId).taskWalletBalance, 4.00, 'Wallet deducted exactly once for first review');
        assert.equal(mockTasks.get(taskId).status, 'Pending', 'Task transitions to Pending');
        assert.equal(mockTasks.get(taskId).resubmittedForReview, true, 'resubmittedForReview set to true');
        assert.ok(mockTasks.get(taskId).reviewClaimedAt, 'reviewClaimedAt timestamp is recorded');
        assert.equal(mockTransactions.length, 1, 'Exactly one ledger transaction created');
        pass('Test 1H: First Valid Review — Campaign with resubmittedForReview: false completes review successfully');

    } catch (err) {
        fail('Suite 1: Campaign Review Concurrency', err);
    } finally {
        // Restore mocks
        mongoose.startSession = origMongooseStartSession;
        User.findById = origUserFindById;
        User.findOneAndUpdate = origUserFindOneAndUpdate;
        User.updateOne = origUserUpdateOne;
        User.find = origUserFind;
        UserTask.findById = origTaskFindById;
        UserTask.findOneAndUpdate = origTaskFindOneAndUpdate;
        UserTask.updateOne = origTaskUpdateOne;
        Transaction.create = origTxCreate;
        Transaction.findOne = origTxFindOne;
        Transaction.deleteOne = origTxDeleteOne;
        Setting.getSettings = origSettingGetSettings;
        Notification.create = origNotifCreate;
    }
    console.log();
}

// =========================================================================
// SUITE 2: Provider Trusted Domains & Strict Hostname Validation
// =========================================================================
async function runTrustedDomainTests() {
    console.log('--- SUITE 2: Provider Trusted Domains & Strict Hostname Validation ---');

    // Unit test validateAndNormalizeHostname
    try {
        // Valid hostnames
        assert.equal(validateAndNormalizeHostname('trusted.com'), 'trusted.com');
        assert.equal(validateAndNormalizeHostname('sub.trusted.com'), 'sub.trusted.com');
        assert.equal(validateAndNormalizeHostname('offers.cpx-research.com'), 'offers.cpx-research.com');
        assert.equal(validateAndNormalizeHostname('  MyProvider.COM  '), 'myprovider.com');
        pass('Test 2A: Valid Hostnames — Correctly normalized to lowercase without whitespace');

        // Invalid hostnames (schemes, paths, credentials, ports, wildcards, malformed)
        assert.equal(validateAndNormalizeHostname('https://trusted.com'), null, 'Reject scheme');
        assert.equal(validateAndNormalizeHostname('http://trusted.com'), null, 'Reject scheme');
        assert.equal(validateAndNormalizeHostname('trusted.com/path'), null, 'Reject path');
        assert.equal(validateAndNormalizeHostname('trusted.com:8080'), null, 'Reject port');
        assert.equal(validateAndNormalizeHostname('user:pass@trusted.com'), null, 'Reject credentials');
        assert.equal(validateAndNormalizeHostname('*.trusted.com'), null, 'Reject wildcards');
        assert.equal(validateAndNormalizeHostname('trusted..com'), null, 'Reject empty label');
        assert.equal(validateAndNormalizeHostname('-trusted.com'), null, 'Reject leading hyphen');
        assert.equal(validateAndNormalizeHostname('trusted-.com'), null, 'Reject trailing hyphen');
        assert.equal(validateAndNormalizeHostname('trusted .com'), null, 'Reject internal whitespace');
        assert.equal(validateAndNormalizeHostname('com'), null, 'Reject single label TLD');
        assert.equal(validateAndNormalizeHostname(''), null, 'Reject empty string');
        pass('Test 2B: Invalid Hostnames — Rejected schemes, paths, credentials, ports, wildcards, and malformed labels');

        // Subdomain & Suffix Spoofing Matching Tests (isDomainTrusted)
        assert.equal(isDomainTrusted('trusted.com', 'trusted.com'), true, 'Exact match must succeed');
        assert.equal(isDomainTrusted('sub.trusted.com', 'trusted.com'), true, 'Legitimate subdomain must succeed');
        assert.equal(isDomainTrusted('a.b.trusted.com', 'trusted.com'), true, 'Nested subdomain must succeed');

        // Suffix spoofing attacks
        assert.equal(isDomainTrusted('trusted.com.evil.com', 'trusted.com'), false, 'Suffix spoofing (trusted.com.evil.com) must be REJECTED');
        assert.equal(isDomainTrusted('eviltrusted.com', 'trusted.com'), false, 'Prefix spoofing (eviltrusted.com) must be REJECTED');
        assert.equal(isDomainTrusted('nottrusted.com', 'trusted.com'), false, 'Unrelated domain must be REJECTED');
        pass('Test 2C: Boundary Matching — Allowed legitimate subdomains; blocked suffix spoofing (trusted.com.evil.com)');

    } catch (err) {
        fail('Suite 2 Unit Tests', err);
    }

    // Controller integration tests for launchProviderPlacement
    const origUserFindById = User.findById;
    const origPlacementFindById = ProviderPlacement.findById;
    const origProviderFindOne = OfferwallProvider.findOne;
    const origSettingGetSettings = Setting.getSettings;

    try {
        const testUser = {
            _id: '507f1f77bcf86cd799439012',
            status: 'Active',
            emailVerified: true,
            whatsappVerified: true,
            restrictions: {}
        };

        User.findById = async () => ({ ...testUser });

        Setting.getSettings = async () => ({
            customEarnTabs: [{
                id: 'available_jobs',
                enabled: true,
                subTabs: []
            }]
        });

        const testLaunch = async ({ providerKey, launchUrlTemplate, trustedDomains }) => {
            const placement = {
                _id: '507f1f77bcf86cd799439011',
                providerKey: providerKey || 'generic_network',
                parentTabId: 'available_jobs',
                displayName: 'Generic Network',
                placementEnabled: true,
                availableTasksVisibility: true,
                trustedLaunchDomains: trustedDomains || []
            };

            const provider = {
                providerKey: placement.providerKey,
                name: 'Generic Network',
                enabled: true,
                status: 'ACTIVE',
                iframeUrlTemplate: launchUrlTemplate,
                appId: 'app_123',
                apiKey: 'mock_tr_api_key',
                secretKey: 'mock_cpx_secret_key'
            };

            ProviderPlacement.findById = async () => ({ ...placement });
            OfferwallProvider.findOne = async () => ({ ...provider });

            const req = {
                params: { placementId: placement._id },
                user: { id: testUser._id }
            };

            const res = {
                statusCode: 200,
                status: function(code) { this.statusCode = code; return this; },
                json: function(payload) { this.data = payload; return this; }
            };

            await launchProviderPlacement(req, res);
            return res;
        };

        // 1. Valid approved HTTPS domain with path
        const resValid = await testLaunch({
            launchUrlTemplate: 'https://trusted.com/surveys/offerwall?userId={userId}&appId={appId}',
            trustedDomains: ['trusted.com']
        });
        assert.equal(resValid.statusCode, 200, 'Valid HTTPS domain with path must be accepted');
        assert.equal(resValid.data.success, true);
        pass('Test 2D: Controller Launch — Approved valid HTTPS domain with path');

        // 2. Legitimate subdomain with path
        const resSub = await testLaunch({
            launchUrlTemplate: 'https://api.v2.trusted.com/wall?u={userId}',
            trustedDomains: ['trusted.com']
        });
        assert.equal(resSub.statusCode, 200, 'Legitimate subdomain must be accepted');
        assert.equal(resSub.data.success, true);
        pass('Test 2E: Controller Launch — Approved legitimate subdomain');

        // 3. Suffix spoofing URL
        const resSpoof = await testLaunch({
            launchUrlTemplate: 'https://trusted.com.evil.com/phish?u={userId}',
            trustedDomains: ['trusted.com']
        });
        assert.equal(resSpoof.statusCode, 403, 'Suffix spoofing launch must be rejected with 403');
        pass('Test 2F: Controller Launch — Rejected suffix spoofing (trusted.com.evil.com)');

        // 4. Untrusted domain
        const resUntrusted = await testLaunch({
            launchUrlTemplate: 'https://untrusted.com/wall',
            trustedDomains: ['trusted.com']
        });
        assert.equal(resUntrusted.statusCode, 403, 'Untrusted domain must be rejected with 403');
        pass('Test 2G: Controller Launch — Rejected untrusted domain');

        // 5. Empty allowlist for generic provider -> fails closed
        const resEmpty = await testLaunch({
            launchUrlTemplate: 'https://trusted.com/wall',
            trustedDomains: []
        });
        assert.equal(resEmpty.statusCode, 403, 'Empty allowlist must fail closed with 403');
        pass('Test 2H: Controller Launch — Empty allowlist fails closed');

        // 6. Insecure HTTP scheme
        const resHttp = await testLaunch({
            launchUrlTemplate: 'http://trusted.com/wall',
            trustedDomains: ['trusted.com']
        });
        assert.equal(resHttp.statusCode, 403, 'HTTP must be rejected with 403');
        pass('Test 2I: Controller Launch — Rejected insecure HTTP scheme');

        // 7. Embedded credentials in URL
        const resCreds = await testLaunch({
            launchUrlTemplate: 'https://admin:secret@trusted.com/wall',
            trustedDomains: ['trusted.com']
        });
        assert.equal(resCreds.statusCode, 403, 'Credentials in URL must be rejected with 403');
        pass('Test 2J: Controller Launch — Rejected embedded credentials in URL');

        // 8. Preservation of CPX Research built-in trust
        const resCpx = await testLaunch({
            providerKey: 'cpx_research',
            launchUrlTemplate: 'https://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}',
            trustedDomains: [] // Empty placement allowlist: CPX has built-in trust
        });
        assert.equal(resCpx.statusCode, 200, 'CPX Research built-in domain trust must be preserved');
        pass('Test 2K: Built-in Preservation — CPX Research domain trust preserved');

        // 9. Preservation of TheoremReach built-in trust
        const resTheoremReach = await testLaunch({
            providerKey: 'theoremreach',
            launchUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={apiKey}&user_id={userId}',
            trustedDomains: [] // Empty placement allowlist: TheoremReach has built-in trust
        });
        assert.equal(resTheoremReach.statusCode, 200, 'TheoremReach built-in domain trust must be preserved');
        assert.equal(resTheoremReach.data.success, true);
        pass('Test 2L: Built-in Preservation — TheoremReach domain trust preserved');

    } catch (err) {
        fail('Suite 2 Controller Tests', err);
    } finally {
        User.findById = origUserFindById;
        ProviderPlacement.findById = origPlacementFindById;
        OfferwallProvider.findOne = origProviderFindOne;
        Setting.getSettings = origSettingGetSettings;
    }
    console.log();
}

// =========================================================================
// SUITE 3: Admin Dispute Username Integrity
// =========================================================================
async function runDisputeIntegrityTests() {
    console.log('--- SUITE 3: Admin Dispute Username Integrity ---');

    const origUserFindById = User.findById;
    const origUserFind = User.find;
    const origDisputeCreate = Dispute.create;
    const origNotifCreate = Notification.create;
    const origDepositFindById = Deposit.findById;
    const origDisputeFindOne = Dispute.findOne;

    try {
        const mockDbUsers = new Map([
            ['user_worker_01', { _id: 'user_worker_01', username: 'real_worker_name', status: 'Active' }],
            ['admin_user_01', { _id: 'admin_user_01', username: 'chief_admin', role: 'admin' }]
        ]);

        User.findById = async (id) => mockDbUsers.get(String(id)) || null;
        User.find = () => ({
            select: async () => [{ _id: 'admin_user_01', role: 'admin' }]
        });
        Notification.create = async () => ({});
        Dispute.findOne = async () => null;

        let createdDisputeData = null;
        Dispute.create = async (data) => {
            createdDisputeData = { _id: 'disp_new_01', ...data };
            return createdDisputeData;
        };

        // 1. Admin creates dispute on behalf of a target user, supplying a spoofed userName in req.body
        const adminReq = {
            body: {
                userId: 'user_worker_01',
                userName: 'SPOOFED_FAKE_NAME', // Admin body tries to set fake name
                type: 'UserTask',
                referenceId: 'task_ref_01',
                reason: 'Dispute filed by admin on behalf of worker'
            },
            user: { id: 'admin_user_01', role: 'admin' }
        };

        const resAdmin = {
            statusCode: 200,
            status: function(c) { this.statusCode = c; return this; },
            json: function(p) { this.data = p; return this; }
        };

        await createDispute(adminReq, resAdmin);
        assert.equal(resAdmin.statusCode, 201);
        assert.equal(createdDisputeData.userId, 'user_worker_01', 'Admin can specify target userId');
        assert.equal(createdDisputeData.userName, 'real_worker_name', 'userName MUST be derived from target user DB record, ignoring spoofed name');
        pass('Test 3A: Admin Dispute Integrity — Target userName derived strictly from DB, ignoring body userName');

        // 2. Normal worker tries to spoof another userId and userName
        const workerReq = {
            body: {
                userId: 'victim_user_99',
                userName: 'fake_identity',
                type: 'UserTask',
                referenceId: 'task_ref_02',
                reason: 'Worker trying to submit under another id'
            },
            user: { id: 'user_worker_01', role: 'user' }
        };

        const resWorker = {
            statusCode: 200,
            status: function(c) { this.statusCode = c; return this; },
            json: function(p) { this.data = p; return this; }
        };

        await createDispute(workerReq, resWorker);
        assert.equal(resWorker.statusCode, 201);
        assert.equal(createdDisputeData.userId, 'user_worker_01', 'Normal user MUST have userId derived from req.user.id');
        assert.equal(createdDisputeData.userName, 'real_worker_name', 'Normal user MUST have userName derived from their DB record');
        pass('Test 3B: Worker Dispute Integrity — Normal user cannot spoof userId or userName');

    } catch (err) {
        fail('Suite 3: Dispute Username Integrity', err);
    } finally {
        User.findById = origUserFindById;
        User.find = origUserFind;
        Dispute.create = origDisputeCreate;
        Notification.create = origNotifCreate;
        Deposit.findById = origDepositFindById;
        Dispute.findOne = origDisputeFindOne;
    }
    console.log();
}

// =========================================================================
// RUN ALL SUITES
// =========================================================================
async function main() {
    runSchemaTests();
    await runCampaignConcurrencyTests();
    await runTrustedDomainTests();
    await runDisputeIntegrityTests();

    console.log('========================================================================');
    console.log(`Test Execution Summary: ${totalTestsPassed} PASSED, ${totalTestsFailed} FAILED`);
    console.log('========================================================================');

    if (totalTestsFailed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

main();
