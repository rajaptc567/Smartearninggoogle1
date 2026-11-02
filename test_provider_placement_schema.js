import ProviderPlacement from './backend/models/ProviderPlacement.js';
import ProviderPlacementAuditLog from './backend/models/ProviderPlacementAuditLog.js';

console.log('Running Provider Placement Schema Validation Tests...');

// Test 1: Verify default placementEnabled is strictly false
const defaultPlacement = new ProviderPlacement({
    providerKey: 'cpx_research',
    parentTabId: 'other_tasks',
    subTabId: 'cpx_research',
    displayName: 'CPX Research Surveys'
});

if (defaultPlacement.placementEnabled !== false) {
    console.error('FAILED Test 1: placementEnabled must default to false!');
    process.exit(1);
}
console.log('✓ Test 1 Passed: placementEnabled defaults to false (default state: OFF).');

// Test 2: Verify provider secret/credential fields do NOT exist in ProviderPlacement schema
const placementSchemaKeys = Object.keys(ProviderPlacement.schema.paths);
const BANNED_CREDENTIAL_KEYS = ['appId', 'apiKey', 'secretKey', 'postbackKey', 'callbackSecret', 'walletBalance'];

for (const banned of BANNED_CREDENTIAL_KEYS) {
    if (placementSchemaKeys.includes(banned)) {
        console.error(`FAILED Test 2: ProviderPlacement schema must NOT include sensitive field '${banned}'!`);
        process.exit(1);
    }
}
console.log('✓ Test 2 Passed: ProviderPlacement schema contains zero credential or secret fields.');

// Test 3: Verify compound unique index
const indexes = ProviderPlacement.schema.indexes();
const compoundIndex = indexes.find(idx => {
    const keys = Object.keys(idx[0]);
    return keys.includes('providerKey') && keys.includes('parentTabId') && keys.includes('subTabId') && idx[1]?.unique === true;
});

if (!compoundIndex) {
    console.error('FAILED Test 3: Compound unique index { providerKey: 1, parentTabId: 1, subTabId: 1 } missing!');
    process.exit(1);
}
console.log('✓ Test 3 Passed: Compound unique index { providerKey: 1, parentTabId: 1, subTabId: 1 } verified.');

// Test 4: Verify ProviderPlacementAuditLog schema
const auditLogKeys = Object.keys(ProviderPlacementAuditLog.schema.paths);
if (!auditLogKeys.includes('placementId') || !auditLogKeys.includes('adminId') || !auditLogKeys.includes('action')) {
    console.error('FAILED Test 4: ProviderPlacementAuditLog schema missing required fields!');
    process.exit(1);
}
console.log('✓ Test 4 Passed: ProviderPlacementAuditLog schema verified.');

console.log('======================================================');
console.log('All Provider Placement Schema Tests Passed Successfully!');
console.log('======================================================');
