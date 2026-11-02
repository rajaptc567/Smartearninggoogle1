import mongoose from 'mongoose';
import { launchProviderPlacement, createAdminPlacement } from './backend/controllers/providerPlacementController.js';
import User from './backend/models/User.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import Setting from './backend/models/Setting.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';

async function runTests() {
    console.log('Running Provider Placement Hardening Tests...');

    // Mock response helper
    const getRes = () => ({
        statusCode: 0,
        body: null,
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.body = data; return this; }
    });

    // 1. Setup Mock Data
    const mockUserId = new mongoose.Types.ObjectId();
    const mockPlacementId = new mongoose.Types.ObjectId();
    
    // Mock User
    const mockUser = {
        _id: mockUserId,
        id: mockUserId.toString(),
        status: 'Active',
        isEmailVerified: false,
        isWhatsappVerified: false,
        country: 'US'
    };
    User.findById = async () => mockUser;

    // Mock Placement
    const mockPlacement = {
        _id: mockPlacementId,
        providerKey: 'cpx_research',
        parentTabId: 'main_tab',
        subTabId: 'sub_tab',
        placementEnabled: true,
        targetingMode: 'all',
        rolloutPercentage: 100
    };
    ProviderPlacement.findById = async () => mockPlacement;
    ProviderPlacement.create = async (data) => ({ ...data, _id: new mongoose.Types.ObjectId() });
    
    // Mock Setting
    const mockSettings = {
        customEarnTabs: [{ id: 'main_tab', enabled: true, subTabs: [{ id: 'sub_tab', enabled: true }] }],
        emailVerificationRequired: true,
        whatsappVerificationRequired: false
    };
    Setting.getSettings = async () => mockSettings;

    // Mock Provider
    const mockProvider = {
        providerKey: 'cpx_research',
        enabled: true,
        status: 'ACTIVE',
        appId: '12345',
        secretKey: 'secret'
    };
    OfferwallProvider.findOne = async () => mockProvider;
    OfferwallProvider.exists = async () => true;

    // --- TEST 1: Email Verification Required ---
    console.log('Test 1: Email Verification Required');
    const req1 = { user: { id: mockUserId.toString() }, params: { placementId: mockPlacementId.toString() } };
    const res1 = getRes();
    await launchProviderPlacement(req1, res1);
    if (res1.statusCode !== 403 || !res1.body.error.includes('Email verification is required')) {
        console.error('FAILED: Should reject unverified email when required');
        process.exit(1);
    }
    console.log('✓ Passed');

    // --- TEST 2: WhatsApp Verification Required ---
    console.log('Test 2: WhatsApp Verification Required');
    mockUser.isEmailVerified = true;
    mockSettings.emailVerificationRequired = false;
    mockSettings.whatsappVerificationRequired = true;
    const res2 = getRes();
    await launchProviderPlacement(req1, res2);
    if (res2.statusCode !== 403 || !res2.body.error.includes('WhatsApp verification is required')) {
        console.error('FAILED: Should reject unverified WhatsApp when required');
        process.exit(1);
    }
    console.log('✓ Passed');

    // --- TEST 3: Trusted Domain Check ---
    console.log('Test 3: Untrusted Domain Check');
    mockUser.isWhatsappVerified = true;
    mockPlacement.providerKey = 'untrusted_provider';
    const untrustedProvider = {
        providerKey: 'untrusted_provider',
        enabled: true,
        status: 'ACTIVE',
        appId: 'bad_app_id',
        iframeUrlTemplate: 'https://malicious-site.com?user={userId}&appId={appId}'
    };
    OfferwallProvider.findOne = async (query) => {
        if (query.providerKey === 'untrusted_provider') return untrustedProvider;
        return mockProvider;
    };
    const res3 = getRes();
    await launchProviderPlacement(req1, res3);
    if (res3.statusCode !== 403 || !res3.body.error.includes('Untrusted provider domain')) {
        console.error('FAILED: Should reject untrusted domain');
        process.exit(1);
    }
    console.log('✓ Passed');

    // --- TEST 4: Insecure URL Check (HTTP) ---
    console.log('Test 4: Insecure URL Check');
    mockProvider.iframeUrlTemplate = 'http://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}';
    mockPlacement.providerKey = 'cpx_research';
    
    // Ensure findOne returns the modified mockProvider
    OfferwallProvider.findOne = async () => mockProvider;

    const res4 = getRes();
    await launchProviderPlacement(req1, res4);
    if (res4.statusCode !== 403 || !res4.body.error.includes('Insecure launch URL rejected')) {
        console.error(`FAILED: Should reject HTTP URL. Got status ${res4.statusCode}, error: ${res4.body?.error}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // --- TEST 5: Admin Rollout Percentage Validation ---
    console.log('Test 5: Admin Rollout Percentage Validation');
    const adminReq = {
        user: { id: 'admin_id' },
        body: {
            providerKey: 'cpx_research',
            parentTabId: 'main_tab',
            subTabId: 'sub_tab',
            displayName: 'Test',
            rolloutPercentage: 150
        }
    };
    const adminRes = getRes();
    await createAdminPlacement(adminReq, adminRes);
    if (adminRes.statusCode !== 400 || !adminRes.body.error.includes('Rollout percentage must be')) {
        console.error('FAILED: Should reject invalid rollout percentage');
        process.exit(1);
    }
    console.log('✓ Passed');

    console.log('======================================================');
    console.log('All Hardening Verification Tests Passed!');
    console.log('======================================================');
}

runTests().catch(err => {
    console.error('Test Execution Error:', err);
    process.exit(1);
});
