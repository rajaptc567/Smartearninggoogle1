import assert from 'assert';
import dotenv from 'dotenv';
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
console.log('Mode: Isolated Mock & Controller Simulation Engine (Zero Production Impact)');
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
// SUITE 1: Campaign One-Time Review Concurrency & Financial Consistency
// =========================================================================
async function runCampaignConcurrencyTests() {
    console.log('--- SUITE 1: Campaign Review Concurrency & Financial Consistency ---');

    // Mock storage
    const mockUsers = new Map();
    const mockTasks = new Map();
    const mockTransactions = [];
    const mockNotifications = [];

    // Save original model methods
    const origUserFindById = User.findById;
    const origUserFindOneAndUpdate = User.findOneAndUpdate;
    const origUserUpdateOne = User.updateOne;
    const origUserFind = User.find;
    const origTaskFindById = UserTask.findById;
    const origTaskFindOneAndUpdate = UserTask.findOneAndUpdate;
    const origTaskUpdateOne = UserTask.updateOne;
    const origTxCreate = Transaction.create;
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
                history: []
            });

            mockTransactions.length = 0;
            mockNotifications.length = 0;
        };

        // Wire mocks to in-memory store
        User.findById = (id) => ({
            session: () => mockUsers.get(String(id)) ? { ...mockUsers.get(String(id)) } : null
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

        UserTask.findById = async (id) => {
            const t = mockTasks.get(String(id));
            return t ? { ...t } : null;
        };

        UserTask.findOneAndUpdate = async (query, update) => {
            const t = mockTasks.get(String(query._id));
            if (!t) return null;
            if (query.status && t.status !== query.status) return null;
            if (query.resubmittedForReview?.$ne !== undefined && t.resubmittedForReview === query.resubmittedForReview.$ne) return null;

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
        const rejectedCount = responses.filter(r => r.statusCode === 400 && !r.data?.success).length;

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
        // Test 1E: Failure during Transaction creation -> Safe Compensation
        // -----------------------------------------------------------------
        resetData();
        // Force Transaction.create to throw
        Transaction.create = async () => {
            throw new Error('Database write failure: unique transaction index error');
        };

        const resFailTx = makeRes();
        await updateUserTaskStatus(makeReq(), resFailTx);

        assert.equal(resFailTx.statusCode, 400, 'Request must return 400 error on transaction failure');
        const userCompensated = mockUsers.get(userId);
        const taskCompensated = mockTasks.get(taskId);

        assert.equal(userCompensated.taskWalletBalance, 15.00, 'Wallet balance must be fully refunded upon failure');
        assert.equal(userCompensated.campaignWalletSources.fromRefundsUSD, 15.00, 'Campaign wallet sources must be restored');
        assert.equal(taskCompensated.status, 'Rejected', 'Task must NOT remain stuck in Processing; must be reverted to Rejected');
        assert.equal(taskCompensated.resubmittedForReview, false, 'resubmittedForReview must be unlocked (false) so user can retry');
        assert.equal(mockTransactions.length, 0, 'No orphan transactions must remain');
        pass('Test 1E: Recovery Compensation — Transaction failure refunded wallet and reverted task cleanly');

        // -----------------------------------------------------------------
        // Test 1F: Failure during Task state update -> Safe Compensation
        // -----------------------------------------------------------------
        resetData();
        // Restore Transaction.create but force task state update to fail
        Transaction.create = async (docs) => {
            const arr = Array.isArray(docs) ? docs : [docs];
            const created = arr.map(d => ({ _id: `tx_${Date.now()}_${Math.random()}`, ...d }));
            mockTransactions.push(...created);
            return created;
        };

        let secondUpdateCount = 0;
        UserTask.findOneAndUpdate = async (query, update) => {
            const t = mockTasks.get(String(query._id));
            if (!t) return null;
            if (query.resubmittedForReview?.$ne !== undefined) {
                // First lock succeeds
                t.resubmittedForReview = true;
                return { ...t };
            }
            // Second update (setting status to Pending) fails
            secondUpdateCount++;
            return null;
        };

        const resFailTaskSave = makeRes();
        await updateUserTaskStatus(makeReq(), resFailTaskSave);

        assert.equal(resFailTaskSave.statusCode, 400);
        const userCompensated2 = mockUsers.get(userId);
        const taskCompensated2 = mockTasks.get(taskId);

        assert.equal(userCompensated2.taskWalletBalance, 15.00, 'Wallet balance must be restored');
        assert.equal(taskCompensated2.status, 'Rejected', 'Task must be in Rejected status, not Processing');
        assert.equal(taskCompensated2.resubmittedForReview, false, 'Task must be unlocked');
        assert.equal(mockTransactions.length, 0, 'Created transaction must be deleted via compensation');
        pass('Test 1F: Recovery Compensation — Task save failure deleted transaction and refunded balance');

    } catch (err) {
        fail('Suite 1: Campaign Review Concurrency', err);
    } finally {
        // Restore mocks
        User.findById = origUserFindById;
        User.findOneAndUpdate = origUserFindOneAndUpdate;
        User.updateOne = origUserUpdateOne;
        User.find = origUserFind;
        UserTask.findById = origTaskFindById;
        UserTask.findOneAndUpdate = origTaskFindOneAndUpdate;
        UserTask.updateOne = origTaskUpdateOne;
        Transaction.create = origTxCreate;
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
