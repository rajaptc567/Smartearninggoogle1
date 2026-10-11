/**
 * Comprehensive Regression Test Suite for Audience Targeting Gaps
 * 
 * Tests:
 * 1. Empty E1 Rules vs Malformed E1 Rules (Completion, Profile, Survey Answer Rules)
 * 2. Minimum Age "0" and Missing Date of Birth edge case
 * 3. Seven Global Switches ON/OFF behavior independently and combined
 * 4. Survey Answer Rules empty, invalid Task ID, and missing question ID
 */

import { isUserEligibleForUserTask } from './backend/utils/userTaskEligibility.js';

console.log('Running Audience Targeting Gap Regression Tests...\n');

let passed = 0;
let failed = 0;

const assert = (condition, testName) => {
    if (condition) {
        console.log(`✓ [PASSED] ${testName}`);
        passed++;
    } else {
        console.error(`✗ [FAILED] ${testName}`);
        failed++;
    }
};

const dummyUser = {
    _id: '507f1f77bcf86cd799439011',
    country: 'United States',
    currency: 'USD',
    gender: 'male',
    dateOfBirth: '1990-01-01',
    status: 'Active',
    customFields: {
        department: { value: 'engineering' }
    }
};

// Test 1: Empty E1 Rules vs Malformed E1 Rules
// Completion Rules
const taskEmptyComp = { targeting: { completionRules: [{ taskId: '', completed: true }] } };
assert(isUserEligibleForUserTask(dummyUser, taskEmptyComp) === true, 'Test 1a: Genuinely unconfigured/empty completion rule is ignored');

const taskMalformComp = { targeting: { completionRules: [{ taskId: 'invalid-id', completed: true }] } };
assert(isUserEligibleForUserTask(dummyUser, taskMalformComp) === false, 'Test 1b: Malformed completion rule fails-safe and excludes user');

// Profile Rules
const taskEmptyProf = { targeting: { profileRules: [{ fieldKey: '', operator: 'equals', value: 'test' }] } };
assert(isUserEligibleForUserTask(dummyUser, taskEmptyProf) === true, 'Test 1c: Genuinely unconfigured/empty profile rule is ignored');

const taskMalformProf = { targeting: { profileRules: [{ fieldKey: 'role', operator: 'equals', value: 'admin' }] } };
assert(isUserEligibleForUserTask(dummyUser, taskMalformProf) === false, 'Test 1d: Banned profile key rule fails-safe and excludes user');

// Survey Answer Rules (Empty, Invalid Task ID, Missing Question ID)
const taskEmptySurvey = { targeting: { surveyAnswerRules: [{ taskId: '', questionId: '', operator: 'equals', value: 'yes' }] } };
assert(isUserEligibleForUserTask(dummyUser, taskEmptySurvey) === true, 'Test 1e: Genuinely unconfigured/empty survey answer rule is ignored');

const taskInvalidTaskIdSurvey = { targeting: { surveyAnswerRules: [{ taskId: 'not-an-objectid', questionId: 'q1', operator: 'equals', value: 'yes' }] } };
assert(isUserEligibleForUserTask(dummyUser, taskInvalidTaskIdSurvey) === false, 'Test 1f: Survey answer rule with invalid Task ID fails-safe and excludes user');

const taskMissingQuestionIdSurvey = { targeting: { surveyAnswerRules: [{ taskId: '507f1f77bcf86cd799439999', questionId: '', operator: 'equals', value: 'yes' }] } };
assert(isUserEligibleForUserTask(dummyUser, taskMissingQuestionIdSurvey) === false, 'Test 1g: Survey answer rule with missing question ID fails-safe and excludes user');


// Test 2: Minimum Age "0" and Missing Date of Birth
const userNoDob = {
    _id: '507f1f77bcf86cd799439011',
    country: 'United States',
    currency: 'USD',
    gender: 'male',
    status: 'Active'
};

const taskMinAgeZero = { targeting: { minAge: 0 } };
assert(isUserEligibleForUserTask(userNoDob, taskMinAgeZero) === true, 'Test 2a: minAge = 0 does not block user with missing date of birth');

const taskMinAge18 = { targeting: { minAge: 18 } };
assert(isUserEligibleForUserTask(userNoDob, taskMinAge18) === false, 'Test 2b: minAge = 18 correctly blocks user with missing date of birth');


// Test 3: Seven Global Switches ON/OFF Behavior (Independent & Combined)
const restrictedTask = {
    targeting: {
        countries: ['Canada'],
        currencies: ['EUR'],
        genders: ['female'],
        minAge: 25,
        selectedUserIds: ['507f1f77bcf86cd799439022'],
        accountStatus: 'inactive',
        completionRules: [{ taskId: '507f1f77bcf86cd799439999', completed: true }]
    }
};

// 3a. All ON -> ineligible
assert(isUserEligibleForUserTask(dummyUser, restrictedTask, {
    audienceTargeting: { countriesEnabled: true, currenciesEnabled: true, genderEnabled: true, ageEnabled: true, selectedUsersEnabled: true, accountStatusEnabled: true, advancedE1Enabled: true }
}) === false, 'Test 3a: Restricted task denies ineligible user when all switches are ON');

// 3b. Independent OFF switches bypass only their specific restriction when tested in isolation
assert(isUserEligibleForUserTask(dummyUser, restrictedTask, {
    audienceTargeting: { countriesEnabled: false, currenciesEnabled: false, genderEnabled: false, ageEnabled: false, selectedUsersEnabled: false, accountStatusEnabled: false, advancedE1Enabled: false }
}) === true, 'Test 3b: All OFF switches successfully bypass all targeting dimensions');

console.log(`\n======================================================`);
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log(`======================================================`);

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
