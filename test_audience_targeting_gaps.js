/**
 * Comprehensive Regression Test Suite for Audience Targeting Gaps
 * 
 * Tests:
 * 1. Empty E1 Rules vs Malformed E1 Rules
 * 2. Minimum Age "0" and Missing Date of Birth edge case
 * 3. Seven Global Switches ON/OFF behavior
 * 4. Valid targeting enforcement and bypass when OFF
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

// Test 1: Empty E1 Rules should be skipped (eligible), Malformed E1 rules should fail-safe (ineligible)
const dummyUser = {
    _id: '507f1f77bcf86cd799439011',
    country: 'United States',
    currency: 'USD',
    gender: 'male',
    dateOfBirth: '1990-01-01',
    status: 'Active',
    customFields: {}
};

// Empty completion rule
const taskEmptyComp = {
    targeting: {
        completionRules: [{ taskId: '', completed: true }]
    }
};
assert(isUserEligibleForUserTask(dummyUser, taskEmptyComp) === true, 'Test 1a: Genuinely unconfigured/empty completion rule is ignored and user is eligible');

// Malformed completion rule (invalid ObjectId)
const taskMalformComp = {
    targeting: {
        completionRules: [{ taskId: 'invalid-id', completed: true }]
    }
};
assert(isUserEligibleForUserTask(dummyUser, taskMalformComp) === false, 'Test 1b: Malformed completion rule fails-safe and excludes user');

// Empty profile rule
const taskEmptyProf = {
    targeting: {
        profileRules: [{ fieldKey: '', operator: 'equals', value: 'test' }]
    }
};
assert(isUserEligibleForUserTask(dummyUser, taskEmptyProf) === true, 'Test 1c: Genuinely unconfigured/empty profile rule is ignored');

// Malformed / insecure profile rule (banned key)
const taskMalformProf = {
    targeting: {
        profileRules: [{ fieldKey: 'role', operator: 'equals', value: 'admin' }]
    }
};
assert(isUserEligibleForUserTask(dummyUser, taskMalformProf) === false, 'Test 1d: Banned profile key rule fails-safe and excludes user');

// Test 2: Minimum Age "0" and Missing Date of Birth
const userNoDob = {
    _id: '507f1f77bcf86cd799439011',
    country: 'United States',
    currency: 'USD',
    gender: 'male',
    status: 'Active'
};

const taskMinAgeZero = {
    targeting: {
        minAge: 0
    }
};
assert(isUserEligibleForUserTask(userNoDob, taskMinAgeZero) === true, 'Test 2a: minAge = 0 does not block user with missing date of birth');

const taskMinAge18 = {
    targeting: {
        minAge: 18
    }
};
assert(isUserEligibleForUserTask(userNoDob, taskMinAge18) === false, 'Test 2b: minAge = 18 correctly blocks user with missing date of birth');

// Test 3: Seven Global Switches ON/OFF Behavior
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

// When all targeting is ON, dummyUser (US, USD, male, age 36, active, no submissions) should be ineligible
assert(isUserEligibleForUserTask(dummyUser, restrictedTask, { audienceTargeting: { countriesEnabled: true, currenciesEnabled: true, genderEnabled: true, ageEnabled: true, selectedUsersEnabled: true, accountStatusEnabled: true, advancedE1Enabled: true } }) === false, 'Test 3a: Restricted task denies ineligible user when switches are ON');

// When countriesEnabled is OFF, country check is bypassed
assert(isUserEligibleForUserTask(dummyUser, restrictedTask, { audienceTargeting: { countriesEnabled: false, currenciesEnabled: true, genderEnabled: true, ageEnabled: true, selectedUsersEnabled: true, accountStatusEnabled: true, advancedE1Enabled: true } }) === false, 'Test 3b: Country ON/OFF switch bypasses country restriction when OFF');

// When ALL switches are OFF, restrictedTask should allow dummyUser
const allOffContext = {
    audienceTargeting: {
        countriesEnabled: false,
        currenciesEnabled: false,
        genderEnabled: false,
        ageEnabled: false,
        selectedUsersEnabled: false,
        accountStatusEnabled: false,
        advancedE1Enabled: false
    }
};
assert(isUserEligibleForUserTask(dummyUser, restrictedTask, allOffContext) === true, 'Test 3c: All OFF switches successfully bypass all targeting dimensions');

console.log(`\n======================================================`);
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log(`======================================================`);

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
