import assert from 'assert';
import { updateUserTaskStatus } from './backend/controllers/userTasksController.js';
import UserTask from './backend/models/UserTask.js';
import User from './backend/models/User.js';
import Setting from './backend/models/Setting.js';
import Transaction from './backend/models/Transaction.js';
import Notification from './backend/models/Notification.js';

console.log('========================================================================');
console.log('Running Campaign One-Time Review Wallet Funding Test Suite');
console.log('========================================================================\n');

async function runCampaignReviewTests() {
    const mockUsers = new Map();
    const mockTasks = new Map();
    const mockTransactions = [];
    const mockNotifications = [];

    // Save original model methods
    const origTaskFindById = UserTask.findById;
    const origUserFindById = User.findById;
    const origUserFind = User.find;
    const origSettingGetSettings = Setting.getSettings;
    const origTxCreate = Transaction.create;
    const origNotifCreate = Notification.create;

    UserTask.findById = async (id) => mockTasks.get(String(id)) || null;
    User.findById = async (id) => mockUsers.get(String(id)) || null;
    User.find = async (query) => [{ _id: 'admin_1', role: 'admin' }];
    User.find.select = () => async () => [{ _id: 'admin_1', role: 'admin' }];

    Setting.getSettings = async () => ({
        userTaskConfig: {
            minQuantity: 5,
            minRewardAmount: 0.10,
            commissionPercent: 10,
            campaignFeeEnabled: true,
            campaignFeeAmount: 1.00
        },
        exchangeRates: { USD: 1, EUR: 0.92, PKR: 278 }
    });

    Transaction.create = async (tx) => {
        mockTransactions.push(tx);
        return tx;
    };

    Notification.create = async (notif) => {
        mockNotifications.push(notif);
        return notif;
    };

    const createRes = () => {
        const res = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(data) { this.body = data; return this; }
        };
        return res;
    };

    // -------------------------------------------------------------------------
    // Test Case 1: Task Wallet has sufficient funds ($100 Task Wallet, $5 Main Wallet, $28.50 required)
    // -------------------------------------------------------------------------
    console.log('Test 1: Task Wallet sufficient ($100 Task Wallet, $5 Main Wallet)...');
    const user1 = {
        _id: 'user_campaign_1',
        username: 'creator_one',
        currency: 'USD',
        taskWalletBalance: 100.00,
        walletBalance: 5.00,
        campaignWalletSources: { fromInvestmentUSD: 100.00, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 },
        async save() { mockUsers.set(this._id, { ...this }); return this; }
    };
    mockUsers.set('user_campaign_1', user1);

    // subtotal = 25 * 1.00 = $25.00, commission (10%) = $2.50, totalBudget = $27.50, baseFee = $1.00 -> totalAmountUSD = $28.50
    const task1 = {
        _id: 'task_rejected_1',
        userId: 'user_campaign_1',
        title: 'Promote Mobile App',
        status: 'Rejected',
        resubmittedForReview: false,
        targetQuantity: 25,
        rewardPerTask: 1.00,
        async save() { mockTasks.set(this._id, { ...this }); return this; }
    };
    mockTasks.set('task_rejected_1', task1);

    const req1 = {
        params: { id: 'task_rejected_1' },
        user: { id: 'user_campaign_1', role: 'user' },
        body: { reviewRequested: true, userReviewMessage: 'I updated instructions' }
    };
    const res1 = createRes();
    await updateUserTaskStatus(req1, res1);

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.success, true);

    const updatedUser1 = mockUsers.get('user_campaign_1');
    assert.equal(updatedUser1.taskWalletBalance, 71.50, 'Exactly $28.50 must be deducted from Task Wallet (100 - 28.50 = 71.50)');
    assert.equal(updatedUser1.walletBalance, 5.00, 'Main Wallet balance must remain untouched at $5.00');

    const tx1 = mockTransactions.find(t => t.userId === 'user_campaign_1');
    assert.ok(tx1, 'Transaction must be created');
    assert.equal(tx1.currency, 'USD');
    assert.equal(tx1.amount, -28.50);
    console.log('✓ Passed Test 1: Task Wallet deducted correctly, Main Wallet untouched.\n');

    // -------------------------------------------------------------------------
    // Test Case 2: Task Wallet insufficient, Main Wallet sufficient
    // -------------------------------------------------------------------------
    console.log('Test 2: Task Wallet insufficient ($10), Main Wallet sufficient ($50)...');
    const user2 = {
        _id: 'user_campaign_2',
        username: 'creator_two',
        currency: 'USD',
        taskWalletBalance: 10.00,
        walletBalance: 50.00,
        campaignWalletSources: { fromInvestmentUSD: 10.00, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 },
        async save() { mockUsers.set(this._id, { ...this }); return this; }
    };
    mockUsers.set('user_campaign_2', user2);

    const task2 = {
        _id: 'task_rejected_2',
        userId: 'user_campaign_2',
        title: 'Survey Campaign',
        status: 'Rejected',
        resubmittedForReview: false,
        targetQuantity: 25,
        rewardPerTask: 1.00,
        async save() { mockTasks.set(this._id, { ...this }); return this; }
    };
    mockTasks.set('task_rejected_2', task2);

    const req2 = {
        params: { id: 'task_rejected_2' },
        user: { id: 'user_campaign_2', role: 'user' },
        body: { reviewRequested: true, userReviewMessage: 'Added clearer proof steps' }
    };
    const res2 = createRes();
    await updateUserTaskStatus(req2, res2);

    assert.equal(res2.statusCode, 200);
    const updatedUser2 = mockUsers.get('user_campaign_2');
    assert.equal(updatedUser2.taskWalletBalance, 10.00, 'Task Wallet remains untouched at $10.00');
    assert.equal(updatedUser2.walletBalance, 21.50, 'Main Wallet deducted $28.50 (50 - 28.50 = 21.50)');
    console.log('✓ Passed Test 2: Fallback to Main Wallet succeeded when Task Wallet was insufficient.\n');

    // -------------------------------------------------------------------------
    // Test Case 3: Both wallets insufficient ($10 Task Wallet, $5 Main Wallet, $28.50 required)
    // -------------------------------------------------------------------------
    console.log('Test 3: Both wallets insufficient ($10 Task Wallet, $5 Main Wallet)...');
    const user3 = {
        _id: 'user_campaign_3',
        username: 'creator_three',
        currency: 'USD',
        taskWalletBalance: 10.00,
        walletBalance: 5.00,
        async save() { mockUsers.set(this._id, { ...this }); return this; }
    };
    mockUsers.set('user_campaign_3', user3);

    const task3 = {
        _id: 'task_rejected_3',
        userId: 'user_campaign_3',
        title: 'Video Watch Campaign',
        status: 'Rejected',
        resubmittedForReview: false,
        targetQuantity: 25,
        rewardPerTask: 1.00,
        async save() { mockTasks.set(this._id, { ...this }); return this; }
    };
    mockTasks.set('task_rejected_3', task3);

    const req3 = {
        params: { id: 'task_rejected_3' },
        user: { id: 'user_campaign_3', role: 'user' },
        body: { reviewRequested: true, userReviewMessage: 'Please re-check' }
    };
    const res3 = createRes();
    await updateUserTaskStatus(req3, res3);

    assert.equal(res3.statusCode, 400);
    assert.equal(res3.body.success, false);
    assert.ok(res3.body.error.includes('Insufficient wallet balance'));
    const user3After = mockUsers.get('user_campaign_3');
    assert.equal(user3After.taskWalletBalance, 10.00, 'No deduction from Task Wallet on rejection');
    assert.equal(user3After.walletBalance, 5.00, 'No deduction from Main Wallet on rejection');
    console.log('✓ Passed Test 3: Insufficient balance rejected with 400 and zero deductions.\n');

    // -------------------------------------------------------------------------
    // Test Case 4: Exact balance match ($28.50 Task Wallet, $28.50 required)
    // -------------------------------------------------------------------------
    console.log('Test 4: Exact balance match ($28.50 Task Wallet)...');
    const user4 = {
        _id: 'user_campaign_4',
        username: 'creator_four',
        currency: 'USD',
        taskWalletBalance: 28.50,
        walletBalance: 0.00,
        campaignWalletSources: { fromInvestmentUSD: 28.50, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 },
        async save() { mockUsers.set(this._id, { ...this }); return this; }
    };
    mockUsers.set('user_campaign_4', user4);

    const task4 = {
        _id: 'task_rejected_4',
        userId: 'user_campaign_4',
        title: 'Exact Balance Campaign',
        status: 'Rejected',
        resubmittedForReview: false,
        targetQuantity: 25,
        rewardPerTask: 1.00,
        async save() { mockTasks.set(this._id, { ...this }); return this; }
    };
    mockTasks.set('task_rejected_4', task4);

    const req4 = {
        params: { id: 'task_rejected_4' },
        user: { id: 'user_campaign_4', role: 'user' },
        body: { reviewRequested: true, userReviewMessage: 'Exact match test' }
    };
    const res4 = createRes();
    await updateUserTaskStatus(req4, res4);

    assert.equal(res4.statusCode, 200);
    const updatedUser4 = mockUsers.get('user_campaign_4');
    assert.equal(updatedUser4.taskWalletBalance, 0.00, 'Task Wallet balance is exactly 0.00 without rounding errors');
    console.log('✓ Passed Test 4: Exact balance match succeeded without floating point error.\n');

    // -------------------------------------------------------------------------
    // Test Case 5: Repeated Review Request (Enforce one-time review restriction)
    // -------------------------------------------------------------------------
    console.log('Test 5: Repeated review request on already resubmitted campaign...');
    const task5 = {
        _id: 'task_already_resubmitted_5',
        userId: 'user_campaign_1',
        title: 'Already Resubmitted Task',
        status: 'Rejected',
        resubmittedForReview: true,
        targetQuantity: 25,
        rewardPerTask: 1.00,
        async save() { mockTasks.set(this._id, { ...this }); return this; }
    };
    mockTasks.set('task_already_resubmitted_5', task5);

    const req5 = {
        params: { id: 'task_already_resubmitted_5' },
        user: { id: 'user_campaign_1', role: 'user' },
        body: { reviewRequested: true, userReviewMessage: 'Second attempt' }
    };
    const res5 = createRes();
    await updateUserTaskStatus(req5, res5);

    assert.equal(res5.statusCode, 400);
    assert.ok(res5.body.error.includes('already been submitted for a one-time review'));
    console.log('✓ Passed Test 5: Repeated review submission blocked with 400.\n');

    // Restore original functions
    UserTask.findById = origTaskFindById;
    User.findById = origUserFindById;
    User.find = origUserFind;
    Setting.getSettings = origSettingGetSettings;
    Transaction.create = origTxCreate;
    Notification.create = origNotifCreate;

    console.log('========================================================================');
    console.log('All Campaign One-Time Review Wallet Funding Tests PASSED!');
    console.log('========================================================================\n');
}

runCampaignReviewTests().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
