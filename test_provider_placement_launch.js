import { launchProviderPlacement } from './backend/controllers/providerPlacementController.js';

console.log('Running Provider Placement Launch Security Tests...');

// Test 1: Unauthenticated request rejected
const mockReq1 = { user: null, params: { placementId: '60d5ecb8b5c9c82b8c8b4567' } };
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

launchProviderPlacement(mockReq1, mockRes1).then(() => {
    if (mockRes1.statusCode !== 401) {
        console.error('FAILED Test 1: Unauthenticated request must return HTTP 401!');
        process.exit(1);
    }
    console.log('✓ Test 1 Passed: Unauthenticated placement launch request rejected with 401.');
});

// Test 2: Invalid placement ObjectId rejected
const mockReq2 = { user: { id: '60d5ecb8b5c9c82b8c8b1234' }, params: { placementId: 'invalid_id' } };
const mockRes2 = {
    status: function(code) {
        this.statusCode = code;
        return this;
    },
    json: function(data) {
        this.body = data;
        return this;
    }
};

launchProviderPlacement(mockReq2, mockRes2).then(() => {
    if (mockRes2.statusCode !== 400 || !mockRes2.body.error.includes('Invalid placement identifier')) {
        console.error('FAILED Test 2: Invalid ObjectId must return HTTP 400!');
        process.exit(1);
    }
    console.log('✓ Test 2 Passed: Invalid placement ObjectId rejected with 400.');
});

setTimeout(() => {
    console.log('======================================================');
    console.log('All Placement Launch Security Tests Passed!');
    console.log('======================================================');
}, 500);
