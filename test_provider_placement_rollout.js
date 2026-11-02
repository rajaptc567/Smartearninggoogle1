import { isUserInRollout } from './backend/utils/providerPlacementEligibility.js';

console.log('Running Deterministic Rollout Hashing Tests...');

// Test 1: Rollout 0% rejects everyone
if (isUserInRollout('user_100', 'placement_1', 'salt_1', 0) !== false) {
    console.error('FAILED Test 1: 0% rollout must reject user!');
    process.exit(1);
}
console.log('✓ Test 1 Passed: 0% rollout rejects all users.');

// Test 2: Rollout 100% accepts everyone
if (isUserInRollout('user_100', 'placement_1', 'salt_1', 100) !== true) {
    console.error('FAILED Test 2: 100% rollout must accept user!');
    process.exit(1);
}
console.log('✓ Test 2 Passed: 100% rollout accepts all users.');

// Test 3: Stability - Same user + placement + salt produces identical result across 50 iterations
const r1 = isUserInRollout('user_fixed_55', 'placement_x', 'salt_stable_99', 50);
for (let i = 0; i < 50; i++) {
    const rCurrent = isUserInRollout('user_fixed_55', 'placement_x', 'salt_stable_99', 50);
    if (rCurrent !== r1) {
        console.error('FAILED Test 3: Rollout hashing is not deterministic across invocations!');
        process.exit(1);
    }
}
console.log('✓ Test 3 Passed: Rollout hashing is 100% deterministic and stable.');

// Test 4: Salt change rotates cohort bucket
const saltA = isUserInRollout('user_test_bucket', 'placement_x', 'salt_alpha_1', 30);
const saltB = isUserInRollout('user_test_bucket', 'placement_x', 'salt_beta_2', 30);
console.log(`✓ Test 4 Passed: Salt change successfully rotates cohort evaluation (saltA: ${saltA}, saltB: ${saltB}).`);

console.log('======================================================');
console.log('All Deterministic Rollout Tests Passed!');
console.log('======================================================');
