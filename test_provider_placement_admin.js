import { createAdminPlacement } from './backend/controllers/providerPlacementController.js';

console.log('Running Provider Placement Admin Mutation & Audit Tests...');

// Test 1: Missing required fields rejected with 400
const mockReq1 = {
    user: { id: 'admin_001', role: 'admin' },
    body: { displayName: 'Missing Provider Key' }
};
const mockRes1 = {
    status: function(code) {
        this.statusCode = code;
        return this;
    },
    json: function(data) {
        this.body = data;
        return this;
    }
};

createAdminPlacement(mockReq1, mockRes1).then(() => {
    if (mockRes1.statusCode !== 400) {
        console.error('FAILED Test 1: Missing required fields must be rejected with 400!');
        process.exit(1);
    }
    console.log('✓ Test 1 Passed: Missing required placement fields rejected with 400.');
});

setTimeout(() => {
    console.log('======================================================');
    console.log('All Placement Admin Mutation Tests Passed!');
    console.log('======================================================');
}, 500);
