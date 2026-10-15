import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
    updateSubmissionStatus,
    reconcileSubmissionDispute
} from './backend/controllers/userTasksController.js';

import User from './backend/models/User.js';
import UserTask from './backend/models/UserTask.js';
import UserTaskSubmission from './backend/models/UserTaskSubmission.js';
import Transaction from './backend/models/Transaction.js';
import Dispute from './backend/models/Dispute.js';
import Notification from './backend/models/Notification.js';
import Template from './backend/models/Template.js';

console.log('Running Reward Accounting and Recovery Invariants Production Controller Test Suite...\n');

// Mock response creator
function createMockRes() {
    return {
        statusCode: 200,
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        }
    };
}

// In-memory test store
class MemoryDb {
    constructor() {
        this.users = new Map();
        this.tasks = new Map();
        this.submissions = new Map();
        this.transactions = new Map();
        this.disputes = new Map();
    }

    clear() {
        this.users.clear();
        this.tasks.clear();
        this.submissions.clear();
        this.transactions.clear();
        this.disputes.clear();
    }
}

const db = new MemoryDb();

// Original model methods for restoration
const originalMethods = {
    userFindById: User.findById,
    userFindByIdAndUpdate: User.findByIdAndUpdate,
    taskFindById: UserTask.findById,
    taskFindByIdAndUpdate: UserTask.findByIdAndUpdate,
    subFindById: UserTaskSubmission.findById,
    subFindByIdAndUpdate: UserTaskSubmission.findByIdAndUpdate,
    subFindOneAndUpdate: UserTaskSubmission.findOneAndUpdate,
    txFindOne: Transaction.findOne,
    txCreate: Transaction.create,
    disputeFind: Dispute.find,
    disputeFindById: Dispute.findById,
    disputeFindByIdAndUpdate: Dispute.findByIdAndUpdate,
    disputeUpdateMany: Dispute.updateMany,
    notifCreate: Notification.create
};

// Wire up Mongoose model stubs to route through db
function attachMongooseStubs(overrides = {}) {
    User.findById = async (id) => {
        const u = db.users.get(String(id));
        return u ? { ...u } : null;
    };

    User.findByIdAndUpdate = async (id, update, options = {}) => {
        const isReversal = update?.$inc?.taskEarningsBalance < 0;
        if (isReversal && overrides.failUserReversal) {
            return null;
        }
        if (isReversal && overrides.throwUserReversal) {
            throw new Error('Database connection failed during worker reversal');
        }
        const u = db.users.get(String(id));
        if (!u) return null;
        if (update.$inc) {
            for (const [k, v] of Object.entries(update.$inc)) {
                u[k] = Number(((u[k] || 0) + v).toFixed(2));
            }
        }
        if (update.$set) {
            Object.assign(u, update.$set);
        }
        return { ...u };
    };

    let txCreateAttempted = false;

    UserTask.findById = (id) => {
        const t = db.tasks.get(String(id));
        const res = t ? { ...t } : null;
        return {
            ...res,
            lean: () => Promise.resolve(res ? { ...res } : null),
            then: (resolve, reject) => Promise.resolve(res ? { ...res } : null).then(resolve, reject),
            catch: (reject) => Promise.resolve(res ? { ...res } : null).catch(reject)
        };
    };

    UserTask.findByIdAndUpdate = async (id, update) => {
        const t = db.tasks.get(String(id));
        if (!t) return null;
        if (update.$inc) {
            for (const [k, v] of Object.entries(update.$inc)) {
                t[k] = (t[k] || 0) + v;
            }
        }
        if (update.$set) {
            Object.assign(t, update.$set);
        }
        if (update.$addToSet?.completedUsers) {
            if (!t.completedUsers.some(u => String(u) === String(update.$addToSet.completedUsers))) {
                t.completedUsers.push(update.$addToSet.completedUsers);
            }
        }
        if (update.$pull?.completedUsers) {
            t.completedUsers = t.completedUsers.filter(u => String(u) !== String(update.$pull.completedUsers));
        }
        return { ...t };
    };

    UserTask.findOneAndUpdate = async (query, update) => {
        const taskId = query._id;
        const t = db.tasks.get(String(taskId));
        if (!t) return null;

        // Simple filter check
        if (query.status && query.status.$ne && t.status === query.status.$ne) return null;
        if (query.status && query.status.$in && !query.status.$in.includes(t.status)) return null;
        if (query.campaignFundingStatus?.$ne && t.campaignFundingStatus === query.campaignFundingStatus.$ne) return null;
        if (query.campaignAvailableBalanceUSD?.$gte && t.campaignAvailableBalanceUSD < query.campaignAvailableBalanceUSD.$gte) return null;

        if (query.completedUsers?.$ne) {
            const hasUser = t.completedUsers.some(u => String(u) === String(query.completedUsers.$ne));
            if (hasUser) return null;
        }
        if (query.completedUsers && !query.completedUsers.$ne) {
            const hasUser = (t.completedUsers || []).some(u => String(u) === String(query.completedUsers));
            if (!hasUser) return null;
        }

        if (query.$expr && query.$expr.$lt) {
            const current = t.currentCompletions || 0;
            const target = t.targetQuantity || 0;
            if (current >= target) return null;
        }
        return UserTask.findByIdAndUpdate(taskId, update);
    };

    UserTaskSubmission.findById = async (id) => {
        const s = db.submissions.get(String(id));
        if (!s) return null;
        return {
            ...s,
            save: async function () {
                db.submissions.set(String(this._id), { ...this });
                return this;
            }
        };
    };

    UserTaskSubmission.findByIdAndUpdate = async (id, update) => {
        const s = db.submissions.get(String(id));
        if (!s) return null;
        if (update.$set) {
            Object.assign(s, update.$set);
        }
        return {
            ...s,
            save: async function () {
                db.submissions.set(String(this._id), { ...this });
                return this;
            }
        };
    };

    UserTaskSubmission.findOneAndUpdate = async (query, update) => {
        const s = db.submissions.get(String(query._id));
        if (!s) return null;
        if (query.rewardClaimed?.$ne && s.rewardClaimed === true) return null;
        if (query.status?.$ne && s.status === query.status.$ne) return null;
        if (update.$set) {
            Object.assign(s, update.$set);
        }
        return {
            ...s,
            save: async function () {
                db.submissions.set(String(this._id), { ...this });
                return this;
            }
        };
    };

    Transaction.findOne = async (query) => {
        if (overrides.simulateDuplicateKey && !txCreateAttempted && query.submissionId) {
            // Simulate that concurrent transaction has not yet committed prior to Transaction.create
            return null;
        }
        for (const tx of db.transactions.values()) {
            let match = true;
            if (query.submissionId && String(tx.submissionId) !== String(query.submissionId)) match = false;
            if (query.idempotencyKey && tx.idempotencyKey !== query.idempotencyKey) match = false;
            if (query.type) {
                if (query.type.$in && !query.type.$in.includes(tx.type)) match = false;
                else if (typeof query.type === 'string' && tx.type !== query.type) match = false;
            }
            if (match) {
                return { ...tx };
            }
        }
        return null;
    };

    Transaction.create = async (txData) => {
        txCreateAttempted = true;
        if (overrides.simulateDuplicateKey) {
            const err = new Error('E11000 duplicate key error collection: Transaction index: idempotencyKey_1');
            err.code = 11000;
            err.name = 'MongoServerError';
            throw err;
        }
        if (overrides.simulateTxFailure) {
            throw new Error('Database write failure');
        }
        const tx = { _id: new mongoose.Types.ObjectId(), ...txData, createdAt: new Date() };
        db.transactions.set(String(tx._id), tx);
        return tx;
    };

    const matchDoc = (doc, cond) => {
        if (!cond || typeof cond !== 'object') return true;
        for (const [key, val] of Object.entries(cond)) {
            if (key === '$and' && Array.isArray(val)) {
                if (!val.every(subQ => matchDoc(doc, subQ))) return false;
            } else if (key === '$or' && Array.isArray(val)) {
                if (!val.some(subQ => matchDoc(doc, subQ))) return false;
            } else {
                const docVal = doc[key];
                if (val && typeof val === 'object' && !(val instanceof mongoose.Types.ObjectId) && !Array.isArray(val)) {
                    if (val.$ne !== undefined) {
                        if (docVal !== undefined && String(docVal) === String(val.$ne)) return false;
                    }
                    if (val.$in !== undefined && Array.isArray(val.$in)) {
                        if (!val.$in.some(item => String(item) === String(docVal))) return false;
                    }
                    if (val.$nin !== undefined && Array.isArray(val.$nin)) {
                        if (val.$nin.some(item => String(item) === String(docVal))) return false;
                    }
                } else {
                    if (docVal === undefined || String(docVal) !== String(val)) return false;
                }
            }
        }
        return true;
    };

    Dispute.find = async (query) => {
        const results = [];
        for (const disp of db.disputes.values()) {
            if (matchDoc(disp, query)) {
                results.push({
                    ...disp,
                    save: async function () {
                        db.disputes.set(String(this._id), { ...this });
                        return this;
                    }
                });
            }
        }
        return results;
    };

    Dispute.findById = async (id) => {
        const d = db.disputes.get(String(id));
        if (!d) return null;
        return {
            ...d,
            save: async function () {
                db.disputes.set(String(this._id), { ...this });
                return this;
            }
        };
    };

    Dispute.findByIdAndUpdate = async (id, update) => {
        const d = db.disputes.get(String(id));
        if (!d) return null;
        Object.assign(d, update);
        return { ...d };
    };

    Dispute.updateMany = async (query, update) => {
        let count = 0;
        for (const d of db.disputes.values()) {
            if (String(d.submissionId) === String(query.submissionId) && d.status !== query.status?.$ne) {
                Object.assign(d, update);
                count++;
            }
        }
        return { modifiedCount: count };
    };

    Notification.create = async () => ({ _id: new mongoose.Types.ObjectId() });
    Template.findOne = async () => null;
}

// -------------------------------------------------------------
// Test 1: E11000 followed by successful reversal in updateSubmissionStatus
// -------------------------------------------------------------
{
    console.log('Test 1: E11000 followed by successful worker-balance reversal...');
    db.clear();

    const workerId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const subId = new mongoose.Types.ObjectId();
    const existingTxId = new mongoose.Types.ObjectId();

    db.users.set(String(workerId), { _id: workerId, username: 'worker1', taskEarningsBalance: 10.00 });
    db.users.set(String(creatorId), { _id: creatorId, username: 'creator1', role: 'admin' });
    db.tasks.set(String(taskId), {
        _id: taskId,
        userId: creatorId,
        rewardPerTask: 2.00,
        currentCompletions: 0,
        targetQuantity: 10,
        completedUsers: [],
        status: 'Active'
    });
    db.submissions.set(String(subId), {
        _id: subId,
        taskId,
        workerId,
        status: 'Pending',
        rewardAmount: 2.00,
        paid: false,
        rewardClaimed: false
    });

    // Seed existing duplicate transaction in ledger
    const existingTx = {
        _id: existingTxId,
        submissionId: subId,
        userId: workerId,
        amount: 2.00,
        type: 'Task Reward',
        status: 'Approved',
        idempotencyKey: `task_reward_${subId}`
    };
    db.transactions.set(String(existingTxId), existingTx);

    // Simulate E11000 on Transaction.create
    attachMongooseStubs({ simulateDuplicateKey: true });

    const req = {
        params: { subId: String(subId) },
        body: { status: 'Approved', adminNotes: 'Approving submission' },
        user: { id: String(creatorId), role: 'admin' }
    };
    const res = createMockRes();

    await updateSubmissionStatus(req, res);

    assert.strictEqual(res.statusCode, 200, 'Should return HTTP 200 after compensating E11000 duplicate');
    const worker = db.users.get(String(workerId));
    assert.strictEqual(worker.taskEarningsBalance, 10.00, 'Worker balance must be back to exactly 10.00 (extra credit reversed)');
    const task = db.tasks.get(String(taskId));
    assert.strictEqual(task.currentCompletions, 0, 'Duplicate completion slot must be released so campaign accounting is preserved');
    const sub = db.submissions.get(String(subId));
    assert.strictEqual(sub.status, 'Approved', 'Submission status should be Approved');
    assert.strictEqual(String(sub.rewardTransactionId), String(existingTxId), 'Submission linked to existing transaction');

    console.log('✓ Passed Test 1: E11000 caught, worker credit reversed successfully, duplicate slot released, campaign preserved.');
}

// -------------------------------------------------------------
// Test 2: E11000 followed by failed reversal in updateSubmissionStatus
// -------------------------------------------------------------
{
    console.log('Test 2: E11000 followed by failed reversal (Controlled Reconciliation)...');
    db.clear();

    const workerId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const subId = new mongoose.Types.ObjectId();
    const existingTxId = new mongoose.Types.ObjectId();

    db.users.set(String(workerId), { _id: workerId, username: 'worker2', taskEarningsBalance: 10.00 });
    db.users.set(String(creatorId), { _id: creatorId, username: 'creator2', role: 'admin' });
    db.tasks.set(String(taskId), {
        _id: taskId,
        userId: creatorId,
        rewardPerTask: 2.00,
        currentCompletions: 0,
        targetQuantity: 10,
        completedUsers: [],
        status: 'Active'
    });
    db.submissions.set(String(subId), {
        _id: subId,
        taskId,
        workerId,
        status: 'Pending',
        rewardAmount: 2.00,
        paid: false,
        rewardClaimed: false
    });

    // Seed existing duplicate transaction in ledger
    const existingTx = {
        _id: existingTxId,
        submissionId: subId,
        userId: workerId,
        amount: 2.00,
        type: 'Task Reward',
        status: 'Approved',
        idempotencyKey: `task_reward_${subId}`
    };
    db.transactions.set(String(existingTxId), existingTx);


    // Simulate E11000 AND failed user reversal
    attachMongooseStubs({ simulateDuplicateKey: true, failUserReversal: true });

    const req = {
        params: { subId: String(subId) },
        body: { status: 'Approved', adminNotes: 'Approving submission' },
        user: { id: String(creatorId), role: 'admin' }
    };
    const res = createMockRes();

    await updateSubmissionStatus(req, res);

    assert.strictEqual(res.statusCode, 409, 'Must return HTTP 409 Conflict/Reconciliation error on failed reversal');
    assert.strictEqual(res.jsonData.reconciliationRequired, true, 'Response must flag reconciliationRequired: true');
    const sub = db.submissions.get(String(subId));
    assert.strictEqual(sub.reconciliationRequired, true, 'Submission document must be flagged with reconciliationRequired = true');
    assert.ok(sub.adminNotes.includes('RECONCILIATION REQUIRED'), 'adminNotes must contain reconciliation warning');
    const task = db.tasks.get(String(taskId));
    assert.strictEqual(task.currentCompletions, 0, 'Duplicate completion slot must be released so campaign is not double-charged');

    console.log('✓ Passed Test 2: Failed reversal does not report silent success; flags reconciliation and preserves campaign accounting.');
}

// -------------------------------------------------------------
// Test 3: Transaction exists but submission reward flags are stale
// -------------------------------------------------------------
{
    console.log('Test 3: Transaction exists but submission reward flags are stale (Historical Recovery)...');
    db.clear();

    const workerId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const subId = new mongoose.Types.ObjectId();
    const existingTxId = new mongoose.Types.ObjectId();

    db.users.set(String(workerId), { _id: workerId, username: 'worker3', taskEarningsBalance: 15.00 });
    db.users.set(String(creatorId), { _id: creatorId, username: 'creator3', role: 'admin' });
    db.tasks.set(String(taskId), {
        _id: taskId,
        userId: creatorId,
        rewardPerTask: 3.00,
        currentCompletions: 1,
        targetQuantity: 10,
        completedUsers: [workerId],
        status: 'Active'
    });
    // Stale submission: still Pending with rewardClaimed = false
    db.submissions.set(String(subId), {
        _id: subId,
        taskId,
        workerId,
        status: 'Pending',
        rewardAmount: 3.00,
        paid: false,
        rewardClaimed: false,
        rewardTransactionId: null
    });
    // Existing completed transaction
    db.transactions.set(String(existingTxId), {
        _id: existingTxId,
        submissionId: subId,
        userId: workerId,
        amount: 3.00,
        type: 'Task Reward',
        status: 'Approved'
    });

    attachMongooseStubs();

    const req = {
        params: { subId: String(subId) },
        body: { status: 'Approved' },
        user: { id: String(creatorId), role: 'admin' }
    };
    const res = createMockRes();

    await updateSubmissionStatus(req, res);

    assert.strictEqual(res.statusCode, 200, 'Returns HTTP 200 on successful reconciliation');
    const worker = db.users.get(String(workerId));
    assert.strictEqual(worker.taskEarningsBalance, 15.00, 'Worker balance must NOT be credited again');
    const sub = db.submissions.get(String(subId));
    assert.strictEqual(sub.status, 'Approved', 'Submission updated to Approved');
    assert.strictEqual(sub.rewardClaimed, true, 'rewardClaimed updated to true');
    assert.strictEqual(String(sub.rewardTransactionId), String(existingTxId), 'rewardTransactionId linked');
    const task = db.tasks.get(String(taskId));
    assert.strictEqual(task.currentCompletions, 1, 'Completions count remains 1');

    console.log('✓ Passed Test 3: Stale submission flags repaired without double credit or slot inflation.');
}

// -------------------------------------------------------------
// Test 4: Transaction exists, submission is Approved, but linked dispute is unresolved
// -------------------------------------------------------------
{
    console.log('Test 4: Transaction exists, submission is Approved, linked dispute is unresolved...');
    db.clear();

    const workerId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const subId = new mongoose.Types.ObjectId();
    const txId = new mongoose.Types.ObjectId();
    const disputeId = new mongoose.Types.ObjectId();

    db.users.set(String(workerId), { _id: workerId, username: 'worker4', taskEarningsBalance: 20.00 });
    db.users.set(String(creatorId), { _id: creatorId, username: 'creator4', role: 'admin' });
    db.tasks.set(String(taskId), {
        _id: taskId,
        userId: creatorId,
        rewardPerTask: 2.50,
        currentCompletions: 1,
        targetQuantity: 10,
        completedUsers: [workerId],
        status: 'Active'
    });
    // Submission is already Approved and transaction exists
    db.submissions.set(String(subId), {
        _id: subId,
        taskId,
        workerId,
        status: 'Approved',
        paid: true,
        rewardClaimed: true,
        rewardAmount: 2.50,
        rewardTransactionId: txId,
        disputeId: disputeId,
        disputeStage: 'CreatorReview'
    });
    db.transactions.set(String(txId), {
        _id: txId,
        submissionId: subId,
        userId: workerId,
        amount: 2.50,
        type: 'Task Reward',
        status: 'Approved'
    });
    // Linked dispute is still Open/Unresolved
    db.disputes.set(String(disputeId), {
        _id: disputeId,
        submissionId: subId,
        referenceId: String(subId),
        userId: workerId,
        status: 'Open',
        verdict: 'None',
        messages: []
    });

    attachMongooseStubs();

    const req = {
        params: { subId: String(subId) },
        body: { status: 'Approved', adminNotes: 'Dispute resolved in favor of worker' },
        user: { id: String(creatorId), role: 'admin' }
    };
    const res = createMockRes();

    await updateSubmissionStatus(req, res);

    assert.strictEqual(res.statusCode, 200, 'Returns HTTP 200');
    const disp = db.disputes.get(String(disputeId));
    assert.strictEqual(disp.status, 'Resolved', 'Dispute must be reconciled to Resolved');
    assert.strictEqual(disp.verdict, 'ReleaseToWorker', 'Verdict must be ReleaseToWorker');
    assert.ok(disp.adminResponse.includes('Dispute resolved in favor of worker'), 'Admin response recorded');
    const sub = db.submissions.get(String(subId));
    assert.strictEqual(sub.disputeStage, 'Resolved', 'Submission disputeStage reconciled to Resolved');
    const worker = db.users.get(String(workerId));
    assert.strictEqual(worker.taskEarningsBalance, 20.00, 'Worker balance must NOT be credited a second time');

    console.log('✓ Passed Test 4: Unresolved dispute reconciled and resolved without creating another payout.');
}

// -------------------------------------------------------------
// Test 5: Retrying the repaired states does not create another reward transaction or balance credit
// -------------------------------------------------------------
{
    console.log('Test 5: Retrying repaired states does not create duplicate credits or transactions...');
    db.clear();

    const workerId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const subId = new mongoose.Types.ObjectId();
    const txId = new mongoose.Types.ObjectId();
    const disputeId = new mongoose.Types.ObjectId();

    db.users.set(String(workerId), { _id: workerId, username: 'worker5', taskEarningsBalance: 30.00 });
    db.users.set(String(creatorId), { _id: creatorId, username: 'creator5', role: 'admin' });
    db.tasks.set(String(taskId), {
        _id: taskId,
        userId: creatorId,
        rewardPerTask: 5.00,
        currentCompletions: 1,
        targetQuantity: 10,
        completedUsers: [workerId],
        status: 'Active'
    });
    // Fully repaired state
    db.submissions.set(String(subId), {
        _id: subId,
        taskId,
        workerId,
        status: 'Approved',
        paid: true,
        rewardClaimed: true,
        rewardAmount: 5.00,
        rewardTransactionId: txId,
        disputeId: disputeId,
        disputeStage: 'Resolved'
    });
    db.transactions.set(String(txId), {
        _id: txId,
        submissionId: subId,
        userId: workerId,
        amount: 5.00,
        type: 'Task Reward',
        status: 'Approved'
    });
    db.disputes.set(String(disputeId), {
        _id: disputeId,
        submissionId: subId,
        referenceId: String(subId),
        userId: workerId,
        status: 'Resolved',
        verdict: 'ReleaseToWorker',
        messages: []
    });

    attachMongooseStubs();

    // Call updateSubmissionStatus 3 consecutive times
    for (let i = 1; i <= 3; i++) {
        const req = {
            params: { subId: String(subId) },
            body: { status: 'Approved', adminNotes: `Retry attempt ${i}` },
            user: { id: String(creatorId), role: 'admin' }
        };
        const res = createMockRes();

        await updateSubmissionStatus(req, res);

        assert.strictEqual(res.statusCode, 200, `Retry ${i} must return HTTP 200`);
        assert.strictEqual(db.transactions.size, 1, `Retry ${i} must NOT create another transaction`);
        const worker = db.users.get(String(workerId));
        assert.strictEqual(worker.taskEarningsBalance, 30.00, `Retry ${i} must NOT increase worker balance`);
        const task = db.tasks.get(String(taskId));
        assert.strictEqual(task.currentCompletions, 1, `Retry ${i} must NOT increment completions`);
    }

    console.log('✓ Passed Test 5: Multiple consecutive retries on repaired state remain strictly idempotent.');
}

// -------------------------------------------------------------
// Test 6: Direct test of reconcileSubmissionDispute helper
// -------------------------------------------------------------
{
    console.log('Test 6: reconcileSubmissionDispute helper by referenceId and submissionId...');
    db.clear();

    const subId = new mongoose.Types.ObjectId();
    const disputeId1 = new mongoose.Types.ObjectId();
    const disputeId2 = new mongoose.Types.ObjectId();

    db.disputes.set(String(disputeId1), {
        _id: disputeId1,
        submissionId: subId,
        referenceId: String(subId),
        status: 'Open',
        verdict: 'None',
        messages: []
    });
    db.disputes.set(String(disputeId2), {
        _id: disputeId2,
        referenceId: String(subId),
        status: 'Processing',
        verdict: 'None',
        messages: []
    });

    attachMongooseStubs();

    const sub = {
        _id: subId,
        disputeId: null,
        disputeStage: 'CreatorReview'
    };

    const reconciled = await reconcileSubmissionDispute(sub, 'Reconciled by test', 'Admin');

    assert.strictEqual(reconciled, true, 'Helper must report disputes reconciled');
    assert.strictEqual(sub.disputeStage, 'Resolved', 'Submission disputeStage updated to Resolved');
    const d1 = db.disputes.get(String(disputeId1));
    const d2 = db.disputes.get(String(disputeId2));
    assert.strictEqual(d1.status, 'Resolved');
    assert.strictEqual(d1.verdict, 'ReleaseToWorker');
    assert.strictEqual(d2.status, 'Resolved');
    assert.strictEqual(d2.verdict, 'ReleaseToWorker');
    assert.ok(d1.messages.some(m => m.sender === 'Admin'));

    console.log('✓ Passed Test 6: reconcileSubmissionDispute resolves all disputes matching submissionId or referenceId.');
}

console.log('\n======================================================');
console.log('All 6 reward accounting & dispute reconciliation production tests passed successfully!');
console.log('======================================================\n');
