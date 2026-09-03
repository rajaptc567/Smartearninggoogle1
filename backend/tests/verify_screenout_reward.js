import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User.js';
import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import Setting from '../models/Setting.js';
import Transaction from '../models/Transaction.js';
import { submitUserTaskProof } from '../controllers/userTasksController.js';

function mockResponse() {
    return {
        statusCode: 200,
        responseData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.responseData = data;
            return this;
        }
    };
}

async function runTests() {
    console.log('=== STARTING SCREENOUT MICRO-REWARD VERIFICATION TESTS ===\n');

    await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB successfully.');

    // Cleanup any prior test artifacts
    await User.deleteMany({ email: { $regex: /^test_survey_/ } });
    await UserTask.deleteMany({ title: { $regex: /^TEST_SURVEY_/ } });
    await Transaction.deleteMany({ description: { $regex: /TEST_SURVEY_/ } });

    // Setup Employer and Base Worker
    const employer = await User.create({
        username: 'test_survey_employer',
        email: 'test_survey_employer@example.com',
        password: 'password123',
        walletBalance: 50.00,
        taskWalletBalance: 50.00,
        taskEarningsBalance: 0.00
    });

    const createWorker = async (name) => {
        return await User.create({
            username: `test_survey_${name}`,
            email: `test_survey_${name}@example.com`,
            password: 'password123',
            walletBalance: 0.00,
            taskWalletBalance: 0.00,
            taskEarningsBalance: 0.00
        });
    };

    const baseSurveyTask = async (title, rewardPerTask = 0.50) => {
        return await UserTask.create({
            userId: employer._id,
            userName: employer.username,
            title,
            description: 'Test Survey Campaign Description',
            category: 'Surveys & Feedback',
            subType: 'Survey',
            link: 'https://example.com/survey',
            rewardPerTask,
            targetQuantity: 10,
            currentCompletions: 0,
            isSurvey: true,
            totalBudget: 10.00,
            totalBudgetUSD: 10.00,
            currency: 'USD',
            status: 'Approved',
            surveyConfig: {
                approvalMode: 'auto',
                questions: [
                    { id: 'q1', title: 'Are you over 18?', type: 'single_choice', options: ['Yes', 'No'] },
                    { id: 'q2', title: 'Rate satisfaction', type: 'rating' }
                ]
            }
        });
    };

    let passedTests = 0;
    let totalTests = 12;

    try {
        // =========================================================================
        // TEST 1: Normal Survey Completion
        // =========================================================================
        console.log('Test 1: Normal Survey Completion...');
        const worker1 = await createWorker('w1');
        const task1 = await baseSurveyTask('TEST_SURVEY_1', 0.50);

        let res = mockResponse();
        await submitUserTaskProof({
            params: { id: task1._id.toString() },
            body: {
                userId: worker1._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'Yes' }, { questionId: 'q2', value: 5 }],
                surveyCompletionTimeSeconds: 120,
                surveyQualificationStatus: 'Completed',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const updatedWorker1 = await User.findById(worker1._id);
        const updatedTask1 = await UserTask.findById(task1._id);
        const tx1 = await Transaction.findOne({ userId: worker1._id, campaignId: task1._id });

        if (
            res.statusCode === 201 &&
            updatedWorker1.taskEarningsBalance === 0.50 &&
            updatedWorker1.walletBalance === 0.00 &&
            updatedTask1.currentCompletions === 1 &&
            tx1 && tx1.type === 'Survey Reward' && tx1.amount === 0.50
        ) {
            console.log('✓ PASS: Normal completion received full reward, completions incremented, transaction type Survey Reward.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 1 failed.', { status: res.statusCode, balance: updatedWorker1.taskEarningsBalance, completions: updatedTask1.currentCompletions, txType: tx1?.type });
        }

        // =========================================================================
        // TEST 2: Screenout with allowScreeningReward === true
        // =========================================================================
        console.log('\nTest 2: Screenout with allowScreeningReward === true...');
        let setting = await Setting.findOne();
        if (!setting) setting = await Setting.create({});
        setting.surveyConfig = {
            rateRules: {
                allowScreeningReward: true,
                screeningRewardAmount: 0.02
            }
        };
        await setting.save();

        const worker2 = await createWorker('w2');
        const task2 = await baseSurveyTask('TEST_SURVEY_2', 0.50);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task2._id.toString() },
            body: {
                userId: worker2._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 20,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const updatedWorker2 = await User.findById(worker2._id);
        const updatedTask2 = await UserTask.findById(task2._id);
        const sub2 = await UserTaskSubmission.findOne({ taskId: task2._id, workerId: worker2._id });
        const tx2 = await Transaction.findOne({ userId: worker2._id, campaignId: task2._id });

        if (
            res.statusCode === 201 &&
            updatedWorker2.taskEarningsBalance === 0.02 &&
            updatedWorker2.walletBalance === 0.00 &&
            updatedWorker2.taskWalletBalance === 0.00 &&
            updatedTask2.currentCompletions === 0 && // Screenouts DO NOT count as completed campaign slots!
            sub2.paid === true &&
            sub2.rewardAmount === 0.02 &&
            sub2.surveyQualificationStatus === 'Disqualified' &&
            tx2 && tx2.type === 'Survey Screenout Reward' && tx2.amount === 0.02 &&
            tx2.sourceWallet === 'CampaignEscrow' && tx2.destinationWallet === 'TaskEarnings'
        ) {
            console.log('✓ PASS: Screenout micro-reward ($0.02) credited to TaskEarnings, Survey Screenout Reward tx recorded, slots preserved.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 2 failed.', { status: res.statusCode, balance: updatedWorker2.taskEarningsBalance, completions: updatedTask2.currentCompletions, tx: tx2 });
        }

        // =========================================================================
        // TEST 3: Screenout with allowScreeningReward === false
        // =========================================================================
        console.log('\nTest 3: Screenout with allowScreeningReward === false...');
        setting.surveyConfig = {
            rateRules: {
                allowScreeningReward: false,
                screeningRewardAmount: 0.02
            }
        };
        await setting.save();

        const worker3 = await createWorker('w3');
        const task3 = await baseSurveyTask('TEST_SURVEY_3', 0.50);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task3._id.toString() },
            body: {
                userId: worker3._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 15,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const updatedWorker3 = await User.findById(worker3._id);
        const sub3 = await UserTaskSubmission.findOne({ taskId: task3._id, workerId: worker3._id });
        const tx3 = await Transaction.findOne({ userId: worker3._id, campaignId: task3._id });

        if (
            res.statusCode === 201 &&
            updatedWorker3.taskEarningsBalance === 0.00 &&
            sub3.paid === false &&
            !tx3
        ) {
            console.log('✓ PASS: When screening rewards disabled, disqualified worker received no credit and no transaction was created.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 3 failed.', { balance: updatedWorker3.taskEarningsBalance, subPaid: sub3.paid, tx3 });
        }

        // =========================================================================
        // TEST 4: Configurable Screening Reward Amount
        // =========================================================================
        console.log('\nTest 4: Configurable Screening Reward Amount ($0.05)...');
        setting.surveyConfig = {
            rateRules: {
                allowScreeningReward: true,
                screeningRewardAmount: 0.05
            }
        };
        await setting.save();

        const worker4 = await createWorker('w4');
        const task4 = await baseSurveyTask('TEST_SURVEY_4', 0.50);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task4._id.toString() },
            body: {
                userId: worker4._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 18,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const updatedWorker4 = await User.findById(worker4._id);
        const tx4 = await Transaction.findOne({ userId: worker4._id, campaignId: task4._id });

        if (
            updatedWorker4.taskEarningsBalance === 0.05 &&
            tx4 && tx4.amount === 0.05 && tx4.type === 'Survey Screenout Reward'
        ) {
            console.log('✓ PASS: Configured custom screening reward ($0.05) credited accurately.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 4 failed.', { balance: updatedWorker4.taskEarningsBalance, tx: tx4 });
        }

        // =========================================================================
        // TEST 5: Server-side Reward Clamping
        // =========================================================================
        console.log('\nTest 5: Server-side Reward Clamping (Config > Task Reward)...');
        setting.surveyConfig = {
            rateRules: {
                allowScreeningReward: true,
                screeningRewardAmount: 1.50 // Configured higher than task reward (0.25)
            }
        };
        await setting.save();

        const worker5 = await createWorker('w5');
        const task5 = await baseSurveyTask('TEST_SURVEY_5', 0.25);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task5._id.toString() },
            body: {
                userId: worker5._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 15,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const updatedWorker5 = await User.findById(worker5._id);
        const tx5 = await Transaction.findOne({ userId: worker5._id, campaignId: task5._id });

        if (
            updatedWorker5.taskEarningsBalance === 0.25 &&
            tx5 && tx5.amount === 0.25
        ) {
            console.log('✓ PASS: Screenout reward properly clamped to task.rewardPerTask ($0.25) when configured amount exceeded it.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 5 failed.', { balance: updatedWorker5.taskEarningsBalance, tx: tx5 });
        }

        // =========================================================================
        // TEST 6: Duplicate Payout Protection / Idempotency
        // =========================================================================
        console.log('\nTest 6: Duplicate Payout Protection / Idempotency...');
        setting.surveyConfig = {
            rateRules: {
                allowScreeningReward: true,
                screeningRewardAmount: 0.03
            }
        };
        await setting.save();

        const worker6 = await createWorker('w6');
        const task6 = await baseSurveyTask('TEST_SURVEY_6', 0.50);

        // First attempt: should succeed and pay $0.03
        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task6._id.toString() },
            body: {
                userId: worker6._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 15,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const balanceAfterFirst = (await User.findById(worker6._id)).taskEarningsBalance;

        // Second attempt (replay / refresh / double submit): should be rejected with 400
        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task6._id.toString() },
            body: {
                userId: worker6._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 15,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const balanceAfterSecond = (await User.findById(worker6._id)).taskEarningsBalance;
        const txCount6 = await Transaction.countDocuments({ userId: worker6._id, campaignId: task6._id });

        if (
            balanceAfterFirst === 0.03 &&
            balanceAfterSecond === 0.03 &&
            res.statusCode === 400 &&
            txCount6 === 1
        ) {
            console.log('✓ PASS: Duplicate submission blocked, balance remained exactly $0.03, exactly one transaction recorded.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 6 failed.', { balanceAfterFirst, balanceAfterSecond, code: res.statusCode, txCount: txCount6 });
        }

        // =========================================================================
        // TEST 7: Strict Wallet Separation
        // =========================================================================
        console.log('\nTest 7: Strict Wallet Separation...');
        const worker7 = await createWorker('w7');
        worker7.walletBalance = 100.00;
        worker7.taskWalletBalance = 50.00;
        worker7.taskEarningsBalance = 10.00;
        await worker7.save();

        const task7 = await baseSurveyTask('TEST_SURVEY_7', 0.50);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task7._id.toString() },
            body: {
                userId: worker7._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 20,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const updatedWorker7 = await User.findById(worker7._id);
        if (
            updatedWorker7.walletBalance === 100.00 &&
            updatedWorker7.taskWalletBalance === 50.00 &&
            updatedWorker7.taskEarningsBalance === 10.03
        ) {
            console.log('✓ PASS: Main walletBalance ($100.00) and taskWalletBalance ($50.00) completely untouched; only taskEarningsBalance received the $0.03 micro-reward.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 7 failed.', { w: updatedWorker7.walletBalance, tw: updatedWorker7.taskWalletBalance, te: updatedWorker7.taskEarningsBalance });
        }

        // =========================================================================
        // TEST 8: Anti-Bot / Attention Trap Failure
        // =========================================================================
        console.log('\nTest 8: Anti-Bot Attention Check Failure...');
        const worker8 = await createWorker('w8');
        const task8 = await baseSurveyTask('TEST_SURVEY_8', 0.50);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task8._id.toString() },
            body: {
                userId: worker8._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 15,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: false, // FAILED BOT / ATTENTION TRAP
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const updatedWorker8 = await User.findById(worker8._id);
        const sub8 = await UserTaskSubmission.findOne({ taskId: task8._id, workerId: worker8._id });
        const tx8 = await Transaction.findOne({ userId: worker8._id, campaignId: task8._id });

        if (
            updatedWorker8.taskEarningsBalance === 0.00 &&
            sub8.paid === false &&
            !tx8
        ) {
            console.log('✓ PASS: User who failed attention check trap received $0 reward, protecting advertiser against bot payouts.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 8 failed.', { balance: updatedWorker8.taskEarningsBalance, subPaid: sub8.paid, tx: tx8 });
        }

        // =========================================================================
        // TEST 9: Multiple Independent Disqualified Workers
        // =========================================================================
        console.log('\nTest 9: Multiple Independent Disqualified Workers...');
        const worker9A = await createWorker('w9a');
        const worker9B = await createWorker('w9b');
        const task9 = await baseSurveyTask('TEST_SURVEY_9', 0.50);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task9._id.toString() },
            body: {
                userId: worker9A._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 15,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task9._id.toString() },
            body: {
                userId: worker9B._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 16,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const bal9A = (await User.findById(worker9A._id)).taskEarningsBalance;
        const bal9B = (await User.findById(worker9B._id)).taskEarningsBalance;

        if (bal9A === 0.03 && bal9B === 0.03) {
            console.log('✓ PASS: Both Worker A and Worker B independently received their screening micro-rewards without collisions.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 9 failed.', { bal9A, bal9B });
        }

        // =========================================================================
        // TEST 10: Ledger / Transaction Attribution
        // =========================================================================
        console.log('\nTest 10: Ledger / Transaction Attribution...');
        const worker10 = await createWorker('w10');
        const task10 = await baseSurveyTask('TEST_SURVEY_10', 0.50);

        res = mockResponse();
        await submitUserTaskProof({
            params: { id: task10._id.toString() },
            body: {
                userId: worker10._id.toString(),
                surveyResponses: [{ questionId: 'q1', value: 'No' }],
                surveyCompletionTimeSeconds: 15,
                surveyQualificationStatus: 'Disqualified',
                attentionCheckPassed: true,
                checkQuestionResults: [{ result: 'PASS' }]
            }
        }, res);

        const sub10 = await UserTaskSubmission.findOne({ taskId: task10._id, workerId: worker10._id });
        const tx10 = await Transaction.findOne({ userId: worker10._id, campaignId: task10._id });

        if (
            tx10 &&
            tx10.type === 'Survey Screenout Reward' &&
            tx10.sourceWallet === 'CampaignEscrow' &&
            tx10.destinationWallet === 'TaskEarnings' &&
            tx10.submissionId.toString() === sub10._id.toString() &&
            tx10.campaignId.toString() === task10._id.toString() &&
            sub10.rewardTransactionId.toString() === tx10._id.toString()
        ) {
            console.log('✓ PASS: Transaction ledger accurately cross-linked with submissionId, campaignId, CampaignEscrow, and TaskEarnings.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 10 failed.', { tx: tx10, subId: sub10?._id });
        }

        // =========================================================================
        // TEST 11: Submission Record Tracking & Notes
        // =========================================================================
        console.log('\nTest 11: Submission Record Tracking & Notes...');
        if (
            sub10.status === 'Approved' &&
            sub10.paid === true &&
            sub10.rewardClaimed === true &&
            sub10.rewardAmount === 0.03 &&
            sub10.surveyQualificationStatus === 'Disqualified' &&
            sub10.adminNotes.includes('Screenout micro-reward')
        ) {
            console.log('✓ PASS: Submission status, rewardClaimed, rewardAmount, and adminNotes logged correctly.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 11 failed.', { sub10 });
        }

        // =========================================================================
        // TEST 12: Campaign Slot Integrity (No Slot Advance on Screenout)
        // =========================================================================
        console.log('\nTest 12: Campaign Slot Integrity...');
        const updatedTask10 = await UserTask.findById(task10._id);
        if (updatedTask10.currentCompletions === 0) {
            console.log('✓ PASS: Campaign currentCompletions remained 0 after screenout, keeping survey slots open for qualifying respondents.');
            passedTests++;
        } else {
            console.error('✗ FAIL: Test 12 failed.', { completions: updatedTask10.currentCompletions });
        }

    } finally {
        // Clean up test data
        await User.deleteMany({ email: { $regex: /^test_survey_/ } });
        await UserTask.deleteMany({ title: { $regex: /^TEST_SURVEY_/ } });
        await Transaction.deleteMany({ description: { $regex: /TEST_SURVEY_/ } });
        await mongoose.disconnect();
    }

    console.log(`\n=== FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED ===\n`);
    if (passedTests === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Unexpected error in test runner:', err);
    process.exit(1);
});
