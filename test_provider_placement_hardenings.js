import mongoose from 'mongoose';
import { launchProviderPlacement, createAdminPlacement, updateAdminPlacement } from './backend/controllers/providerPlacementController.js';
import User from './backend/models/User.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import Setting from './backend/models/Setting.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';

async function runTests() {
    console.log('Running Provider Placement Hardening Tests (Phase 2)...');

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
        emailVerified: false,
        whatsappVerified: false,
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
    ProviderPlacement.findByIdAndUpdate = async (id, update) => ({ ...mockPlacement, ...update.$set });
    
    // Mock Setting
    const mockSettings = {
        customEarnTabs: [{ id: 'main_tab', enabled: true, subTabs: [{ id: 'sub_tab', enabled: true }] }],
        emailVerificationRequired: false,
        whatsappVerificationRequired: false
    };
    Setting.getSettings = async () => mockSettings;

    // Mock Provider
    const mockProvider = {
        providerKey: 'cpx_research',
        enabled: true,
        status: 'ACTIVE',
        appId: '12345',
        secretKey: 'mock_hash_key',
        iframeUrlTemplate: 'https://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}'
    };
    OfferwallProvider.findOne = async () => mockProvider;
    OfferwallProvider.exists = async () => true;

    const commonReq = { user: { id: mockUserId.toString() }, params: { placementId: mockPlacementId.toString() } };

    // --- SECTION 1: Verification Matrix (7 Scenarios) ---
    console.log('\n--- SECTION 1: Verification Matrix ---');

    // 1. Both OFF -> Should Pass
    console.log('Scenario 1: Both Verification Settings OFF');
    mockSettings.emailVerificationRequired = false;
    mockSettings.whatsappVerificationRequired = false;
    mockUser.emailVerified = false;
    mockUser.whatsappVerified = false;
    const resS1 = getRes();
    await launchProviderPlacement(commonReq, resS1);
    if (resS1.statusCode !== 200) {
        console.error(`FAILED: Should pass when both are OFF. Got ${resS1.statusCode}, error: ${resS1.body?.error}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // 2. Email ON + Verified -> Should Pass
    console.log('Scenario 2: Email ON + User Verified');
    mockSettings.emailVerificationRequired = true;
    mockUser.emailVerified = true;
    const resS2 = getRes();
    await launchProviderPlacement(commonReq, resS2);
    if (resS2.statusCode !== 200) {
        console.error(`FAILED: Should pass when email is ON and verified. Got ${resS2.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // 3. Email ON + Unverified -> Should Fail (403)
    console.log('Scenario 3: Email ON + User Unverified');
    mockUser.emailVerified = false;
    const resS3 = getRes();
    await launchProviderPlacement(commonReq, resS3);
    if (resS3.statusCode !== 403 || !resS3.body.error.includes('Email verification is required')) {
        console.error(`FAILED: Should fail (403) when email is ON and unverified. Got ${resS3.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // 4. WhatsApp ON + Verified -> Should Pass
    console.log('Scenario 4: WhatsApp ON + User Verified');
    mockSettings.emailVerificationRequired = false;
    mockSettings.whatsappVerificationRequired = true;
    mockUser.whatsappVerified = true;
    const resS4 = getRes();
    await launchProviderPlacement(commonReq, resS4);
    if (resS4.statusCode !== 200) {
        console.error(`FAILED: Should pass when whatsapp is ON and verified. Got ${resS4.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // 5. WhatsApp ON + Unverified -> Should Fail (403)
    console.log('Scenario 5: WhatsApp ON + User Unverified');
    mockUser.whatsappVerified = false;
    const resS5 = getRes();
    await launchProviderPlacement(commonReq, resS5);
    if (resS5.statusCode !== 403 || !resS5.body.error.includes('WhatsApp verification is required')) {
        console.error(`FAILED: Should fail (403) when whatsapp is ON and unverified. Got ${resS5.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // 6. Both ON + Verified -> Should Pass
    console.log('Scenario 6: Both ON + Both Verified');
    mockSettings.emailVerificationRequired = true;
    mockSettings.whatsappVerificationRequired = true;
    mockUser.emailVerified = true;
    mockUser.whatsappVerified = true;
    const resS6 = getRes();
    await launchProviderPlacement(commonReq, resS6);
    if (resS6.statusCode !== 200) {
        console.error(`FAILED: Should pass when both are ON and verified. Got ${resS6.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // 7. Both ON + Either Unverified -> Should Fail (403)
    console.log('Scenario 7: Both ON + One Unverified (WhatsApp)');
    mockUser.whatsappVerified = false;
    const resS7 = getRes();
    await launchProviderPlacement(commonReq, resS7);
    if (resS7.statusCode !== 403 || !resS7.body.error.includes('WhatsApp verification is required')) {
        console.error(`FAILED: Should fail (403) when one is unverified. Got ${resS7.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // --- SECTION 2: URL Hardening ---
    console.log('\n--- SECTION 2: URL Hardening ---');

    // Untrusted Domain Check
    console.log('Test: Untrusted Domain Check');
    mockSettings.emailVerificationRequired = false;
    mockSettings.whatsappVerificationRequired = false;
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
    const resU = getRes();
    await launchProviderPlacement(commonReq, resU);
    if (resU.statusCode !== 403 || !resU.body.error.includes('Untrusted provider domain')) {
        console.error(`FAILED: Should reject untrusted domain. Got ${resU.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // Insecure URL Check (HTTP)
    console.log('Test: Insecure URL Check (HTTP)');
    mockProvider.iframeUrlTemplate = 'http://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}';
    mockPlacement.providerKey = 'cpx_research';
    OfferwallProvider.findOne = async () => mockProvider;
    const resI = getRes();
    await launchProviderPlacement(commonReq, resI);
    if (resI.statusCode !== 403 || !resI.body.error.includes('HTTPS is mandatory')) {
        console.error(`FAILED: Should reject HTTP URL. Got ${resI.statusCode}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // Embedded Credentials Check
    console.log('Test: Embedded Credentials Check');
    mockProvider.iframeUrlTemplate = 'https://user:pass@offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}';
    const resC = getRes();
    await launchProviderPlacement(commonReq, resC);
    if (resC.statusCode !== 403 || !resC.body.error.includes('embedded credentials rejected')) {
        console.error(`FAILED: Should reject URL with credentials. Got ${resC.statusCode}, error: ${resC.body?.error}`);
        process.exit(1);
    }
    console.log('✓ Passed');

    // --- SECTION 3: Admin Input Validation ---
    console.log('\n--- SECTION 3: Admin Input Validation ---');

    // Rollout Percentage Validation (Create)
    console.log('Test: Rollout Percentage Validation (Create)');
    const adminReqC = {
        user: { id: 'admin_id' },
        body: {
            providerKey: 'cpx_research',
            parentTabId: 'main_tab',
            subTabId: 'sub_tab',
            displayName: 'Test',
            rolloutPercentage: 150
        }
    };
    const adminResC = getRes();
    await createAdminPlacement(adminReqC, adminResC);
    if (adminResC.statusCode !== 400 || !adminResC.body.error.includes('Rollout percentage must be')) {
        console.error('FAILED: Should reject invalid rollout percentage on create');
        process.exit(1);
    }
    console.log('✓ Passed');

    // Rollout Percentage Validation (Update)
    console.log('Test: Rollout Percentage Validation (Update)');
    const adminReqU = {
        user: { id: 'admin_id' },
        params: { placementId: mockPlacementId.toString() },
        body: {
            rolloutPercentage: -5
        }
    };
    const adminResU = getRes();
    await updateAdminPlacement(adminReqU, adminResU);
    if (adminResU.statusCode !== 400 || !adminResU.body.error.includes('Rollout percentage must be')) {
        console.error('FAILED: Should reject invalid rollout percentage on update');
        process.exit(1);
    }
    console.log('✓ Passed');

    console.log('\n======================================================');
    console.log('All Hardening Verification Tests Passed!');
    console.log('======================================================');
}

runTests().catch(err => {
    console.error('Test Execution Error:', err);
    process.exit(1);
});
