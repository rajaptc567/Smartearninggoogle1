import { evaluatePlacementEligibility } from './backend/utils/providerPlacementEligibility.js';

console.log('Running Provider Placement Eligibility & Targeting Tests...');

const dummyPlacement = {
    _id: 'placement_123',
    placementEnabled: true,
    targetingMode: 'all',
    allowedCountries: ['PAKISTAN', 'UNITED STATES'],
    excludedCountries: ['INDIA'],
    rolloutPercentage: 100,
    rolloutSalt: 'salt_abc'
};

const eligibleUser = {
    _id: 'user_001',
    username: 'ali',
    country: 'Pakistan'
};

// Test 1: Disabled placement rejects all users
const disabledPlacement = { ...dummyPlacement, placementEnabled: false };
const res1 = evaluatePlacementEligibility(eligibleUser, disabledPlacement);
if (res1.eligible !== false || res1.reason !== 'PLACEMENT_DISABLED') {
    console.error('FAILED Test 1: Disabled placement must reject user!');
    process.exit(1);
}
console.log('✓ Test 1 Passed: Disabled placement rejects user with PLACEMENT_DISABLED.');

// Test 2: Country allowlist match
const res2 = evaluatePlacementEligibility(eligibleUser, dummyPlacement);
if (res2.eligible !== true) {
    console.error('FAILED Test 2: User in Pakistan should match allowlist [PAKISTAN, UNITED STATES]!');
    process.exit(1);
}
console.log('✓ Test 2 Passed: User in allowed country succeeds.');

// Test 3: Country exclusion precedence
const excludedUser = { _id: 'user_002', username: 'rahul', country: 'India' };
const res3 = evaluatePlacementEligibility(excludedUser, dummyPlacement);
if (res3.eligible !== false || res3.reason !== 'EXCLUDED_COUNTRY') {
    console.error('FAILED Test 3: Excluded country must reject user!');
    process.exit(1);
}
console.log('✓ Test 3 Passed: Excluded country takes precedence and rejects user.');

// Test 4: Missing country fails closed
const missingCountryUser = { _id: 'user_003', username: 'anon' };
const res4 = evaluatePlacementEligibility(missingCountryUser, dummyPlacement);
if (res4.eligible !== false || res4.reason !== 'MISSING_USER_COUNTRY') {
    console.error('FAILED Test 4: Missing country must fail closed when country targeting is active!');
    process.exit(1);
}
console.log('✓ Test 4 Passed: Missing country fails closed with MISSING_USER_COUNTRY.');

// Test 5: Selected users targeting mode
const selectedUserPlacement = {
    ...dummyPlacement,
    targetingMode: 'selected_users',
    selectedUserIds: ['user_001']
};
const res5a = evaluatePlacementEligibility(eligibleUser, selectedUserPlacement);
const res5b = evaluatePlacementEligibility({ _id: 'user_999', country: 'Pakistan' }, selectedUserPlacement);

if (res5a.eligible !== true || res5b.eligible !== false) {
    console.error('FAILED Test 5: selected_users mode must only match explicitly listed user IDs!');
    process.exit(1);
}
console.log('✓ Test 5 Passed: Selected users targeting mode strictly filters user IDs.');

console.log('======================================================');
console.log('All Provider Placement Eligibility Tests Passed!');
console.log('======================================================');
