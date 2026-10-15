import assert from 'node:assert/strict';
import { applySurveyProfileMappings } from './backend/controllers/userTasksController.js';
import User from './backend/models/User.js';

console.log('Running Profile Mapping and Survey Approval Security Regression Suite...\n');

// Simple Memory Store & Mongoose Stubs for test
class MemoryDb {
    constructor() {
        this.users = new Map();
        this.tasks = new Map();
        this.submissions = new Map();
        this.transactions = new Map();
    }
    clear() {
        this.users.clear();
        this.tasks.clear();
        this.submissions.clear();
        this.transactions.clear();
    }
}

const db = new MemoryDb();

// Setup stubs
User.findById = async (id) => {
    const u = db.users.get(String(id));
    return u ? { ...u } : null;
};

User.updateOne = async (query, update) => {
    const userId = query._id;
    const u = db.users.get(String(userId));
    if (!u) return { matchedCount: 0 };
    if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
            const parts = k.split('.');
            if (parts.length === 2 && parts[0] === 'customFields') {
                if (!u.customFields) u.customFields = {};
                u.customFields[parts[1]] = v;
            } else {
                u[k] = v;
            }
        }
    }
    return { matchedCount: 1 };
};

// Test 1: Duplicate question IDs with conflicting answers -> profile mapping uses authoritative accepted response (first accepted)
async function testDuplicateQuestionAnswersMapping() {
    db.clear();
    const userId = 'user_1';
    const taskId = 'task_1';
    db.users.set(userId, { _id: userId, customFields: { existingField: { value: 'keep_me' } } });
    db.tasks.set(taskId, {
        _id: taskId,
        isSurvey: true,
        surveyConfig: {
            questions: [
                { id: 'q1', title: 'Q1', type: 'text', profileMapping: { enabled: true, fieldKey: 'age' } }
            ]
        }
    });

    const submission = {
        _id: 'sub_1',
        taskId,
        workerId: userId,
        status: 'Approved',
        attentionCheckPassed: true,
        surveyQualificationStatus: 'Qualified',
        surveyResponses: [
            { questionId: 'q1', value: '25' },
            { questionId: 'q1', value: '99' } // conflicting duplicate response that must not overwrite authoritative first response
        ]
    };

    const user = db.users.get(userId);
    const task = db.tasks.get(taskId);

    await applySurveyProfileMappings(user, task, submission.surveyResponses, false, submission);

    const updatedUser = db.users.get(userId);
    assert.strictEqual(updatedUser.customFields.age.value, '25', 'Profile mapping must use authoritative first accepted response');
    assert.strictEqual(updatedUser.customFields.existingField.value, 'keep_me', 'Unrelated customFields must remain unchanged');
    console.log('Test 1 (Duplicate question answers authoritative mapping & unrelated customFields preserved) passed.');
}

// Test 2: Fabricated response for hidden/skipped question must not update profile field
async function testSkippedQuestionIsolation() {
    db.clear();
    const userId = 'user_2';
    const taskId = 'task_2';
    db.users.set(userId, { _id: userId, customFields: {} });
    db.tasks.set(taskId, {
        _id: taskId,
        isSurvey: true,
        surveyConfig: {
            questions: [
                { id: 'q1', title: 'Q1', type: 'text', profileMapping: { enabled: true, fieldKey: 'income' } }
            ]
        }
    });

    const submission = {
        _id: 'sub_2',
        taskId,
        workerId: userId,
        status: 'Approved',
        attentionCheckPassed: true,
        surveyQualificationStatus: 'Qualified',
        skippedQuestions: ['q1'], // q1 was skipped
        answeredPath: ['q2'],
        surveyResponses: [
            { questionId: 'q1', value: '100000' } // fabricated response for skipped question
        ]
    };

    const user = db.users.get(userId);
    const task = db.tasks.get(taskId);

    await applySurveyProfileMappings(user, task, submission.surveyResponses, false, submission);

    const updatedUser = db.users.get(userId);
    assert.strictEqual(updatedUser.customFields.income, undefined, 'Skipped question response must not update profile field');
    console.log('Test 2 (Fabricated response for skipped question isolation) passed.');
}

// Test 3: Pending creator/admin-reviewed submission must not update profile fields before approval
async function testPendingSubmissionNoMapping() {
    db.clear();
    const userId = 'user_3';
    const taskId = 'task_3';
    db.users.set(userId, { _id: userId, customFields: {} });
    db.tasks.set(taskId, {
        _id: taskId,
        isSurvey: true,
        surveyConfig: {
            questions: [
                { id: 'q1', title: 'Q1', type: 'text', profileMapping: { enabled: true, fieldKey: 'location' } }
            ]
        }
    });

    const submission = {
        _id: 'sub_3',
        taskId,
        workerId: userId,
        status: 'Pending', // Pending review
        attentionCheckPassed: true,
        surveyQualificationStatus: 'Qualified',
        surveyResponses: [
            { questionId: 'q1', value: 'New York' }
        ]
    };

    const user = db.users.get(userId);
    const task = db.tasks.get(taskId);

    await applySurveyProfileMappings(user, task, submission.surveyResponses, false, submission);

    const updatedUser = db.users.get(userId);
    assert.strictEqual(updatedUser.customFields.location, undefined, 'Pending submission must not update profile fields before approval');
    console.log('Test 3 (Pending submission profile mapping blocking) passed.');
}

// Test 4: Successfully approved valid submission updates intended mapped field
async function testApprovedSubmissionUpdatesProfile() {
    db.clear();
    const userId = 'user_4';
    const taskId = 'task_4';
    db.users.set(userId, { _id: userId, customFields: {} });
    db.tasks.set(taskId, {
        _id: taskId,
        isSurvey: true,
        surveyConfig: {
            questions: [
                { id: 'q1', title: 'Q1', type: 'text', profileMapping: { enabled: true, fieldKey: 'education' } }
            ]
        }
    });

    const submission = {
        _id: 'sub_4',
        taskId,
        workerId: userId,
        status: 'Approved', // Approved
        attentionCheckPassed: true,
        surveyQualificationStatus: 'Qualified',
        surveyResponses: [
            { questionId: 'q1', value: 'Bachelor' }
        ]
    };

    const user = db.users.get(userId);
    const task = db.tasks.get(taskId);

    await applySurveyProfileMappings(user, task, submission.surveyResponses, false, submission);

    const updatedUser = db.users.get(userId);
    assert.strictEqual(updatedUser.customFields.education.value, 'Bachelor', 'Successfully approved submission updates mapped field');
    console.log('Test 4 (Approved submission profile mapping success) passed.');
}

// Test 5: Rejected, disqualified, screenout, attention-check-failed, or quality-failed submissions must not update profile fields
async function testInvalidOrFailedSubmissionsNoMapping() {
    db.clear();
    const taskId = 'task_fail';
    const task = {
        _id: taskId,
        isSurvey: true,
        surveyConfig: {
            questions: [{ id: 'q1', title: 'Q1', type: 'text', profileMapping: { enabled: true, fieldKey: 'testField' } }]
        }
    };

    const failingSubmissions = [
        { _id: 'sub_rej', status: 'Rejected', attentionCheckPassed: true, surveyQualificationStatus: 'Qualified', surveyResponses: [{ questionId: 'q1', value: 'val' }] },
        { _id: 'sub_disq', status: 'Approved', attentionCheckPassed: true, surveyQualificationStatus: 'Disqualified', surveyResponses: [{ questionId: 'q1', value: 'val' }] },
        { _id: 'sub_screen', status: 'Approved', attentionCheckPassed: true, surveyQualificationStatus: 'Screenout', surveyResponses: [{ questionId: 'q1', value: 'val' }] },
        { _id: 'sub_att', status: 'Approved', attentionCheckPassed: false, surveyQualificationStatus: 'Qualified', surveyResponses: [{ questionId: 'q1', value: 'val' }] },
        { _id: 'sub_qual', status: 'Approved', attentionCheckPassed: true, surveyQualificationStatus: 'Qualified', qualityFlags: ['Suspicious activity'], surveyResponses: [{ questionId: 'q1', value: 'val' }] }
    ];

    for (const sub of failingSubmissions) {
        const userId = `user_${sub._id}`;
        db.users.set(userId, { _id: userId, customFields: {} });
        const user = db.users.get(userId);
        await applySurveyProfileMappings(user, task, sub.surveyResponses, false, sub);
        const updatedUser = db.users.get(userId);
        assert.strictEqual(updatedUser.customFields.testField, undefined, `Submission ${sub._id} must not update profile fields`);
    }
    console.log('Test 5 (Rejected, disqualified, screenout, attention/quality failed submissions blocking) passed.');
}

// Test 6: Zero-reward successfully auto-approved survey updates its intended mapped profile field
async function testZeroRewardAutoApprovedUpdatesProfile() {
    db.clear();
    const userId = 'user_zero';
    const taskId = 'task_zero';
    db.users.set(userId, { _id: userId, customFields: {} });
    db.tasks.set(taskId, {
        _id: taskId,
        isSurvey: true,
        rewardPerTask: 0, // Zero reward survey
        surveyConfig: {
            questions: [
                { id: 'q1', title: 'Q1', type: 'text', profileMapping: { enabled: true, fieldKey: 'hobbies' } }
            ]
        }
    });

    const submission = {
        _id: 'sub_zero',
        taskId,
        workerId: userId,
        status: 'Approved', // Successfully auto-approved
        attentionCheckPassed: true,
        surveyQualificationStatus: 'Qualified',
        surveyResponses: [
            { questionId: 'q1', value: 'Reading' }
        ]
    };

    const user = db.users.get(userId);
    const task = db.tasks.get(taskId);

    await applySurveyProfileMappings(user, task, submission.surveyResponses, false, submission);

    const updatedUser = db.users.get(userId);
    assert.strictEqual(updatedUser.customFields.hobbies.value, 'Reading', 'Zero-reward auto-approved survey must successfully update mapped profile field');
    console.log('Test 6 (Zero-reward auto-approved survey profile mapping success) passed.');
}

async function runAll() {
    await testDuplicateQuestionAnswersMapping();
    await testSkippedQuestionIsolation();
    await testPendingSubmissionNoMapping();
    await testApprovedSubmissionUpdatesProfile();
    await testInvalidOrFailedSubmissionsNoMapping();
    await testZeroRewardAutoApprovedUpdatesProfile();
    console.log('\nAll profile mapping security and zero-reward regression tests passed successfully!');
}

runAll().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
