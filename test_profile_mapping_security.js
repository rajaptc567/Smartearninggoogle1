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

// Test 1: Duplicate question IDs with conflicting answers -> profile mapping uses authoritative accepted response
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
            { questionId: 'q1', value: '99' } // duplicate/conflicting answer
        ]
    };

    const user = db.users.get(userId);
    const task = db.tasks.get(taskId);

    // applySurveyProfileMappings uses authoritative submission.surveyResponses
    await applySurveyProfileMappings(user, task, submission.surveyResponses, false, submission);

    const updatedUser = db.users.get(userId);
    assert.strictEqual(updatedUser.customFields.age.value, '25', 'Profile mapping must use authoritative response');
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

// Test 5: Rejected or disqualified submission must not update profile fields
async function testRejectedOrDisqualifiedNoMapping() {
    db.clear();
    const userId = 'user_5';
    const taskId = 'task_5';
    db.users.set(userId, { _id: userId, customFields: {} });
    db.tasks.set(taskId, {
        _id: taskId,
        isSurvey: true,
        surveyConfig: {
            questions: [
                { id: 'q1', title: 'Q1', type: 'text', profileMapping: { enabled: true, fieldKey: 'occupation' } }
            ]
        }
    });

    const submission = {
        _id: 'sub_5',
        taskId,
        workerId: userId,
        status: 'Rejected',
        surveyQualificationStatus: 'Disqualified',
        surveyResponses: [
            { questionId: 'q1', value: 'Engineer' }
        ]
    };

    const user = db.users.get(userId);
    const task = db.tasks.get(taskId);

    await applySurveyProfileMappings(user, task, submission.surveyResponses, false, submission);

    const updatedUser = db.users.get(userId);
    assert.strictEqual(updatedUser.customFields.occupation, undefined, 'Rejected or disqualified submission must not update profile fields');
    console.log('Test 5 (Rejected/Disqualified submission profile mapping blocking) passed.');
}

async function runAll() {
    await testDuplicateQuestionAnswersMapping();
    await testSkippedQuestionIsolation();
    await testPendingSubmissionNoMapping();
    await testApprovedSubmissionUpdatesProfile();
    await testRejectedOrDisqualifiedNoMapping();
    console.log('\nAll profile mapping security regression tests passed successfully!');
}

runAll().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
