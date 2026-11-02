import mongoose from 'mongoose';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import User from './backend/models/User.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import Setting from './backend/models/Setting.js';
import {
    getAvailablePlacements,
    launchProviderPlacement,
    createAdminPlacement,
    updateAdminPlacement
} from './backend/controllers/providerPlacementController.js';

// =========================================================================
// TEST DATABASE ISOLATION & VALIDATION
// =========================================================================
function validateTestDatabaseIsolation() {
    const rawUri = process.env.TEST_MONGO_URI;
    if (!rawUri || !rawUri.trim()) {
        console.error('\n======================================================================');
        console.error('FATAL: TEST_MONGO_URI environment variable is missing.');
        console.error('To guarantee production safety, Series 07 dynamic tab regression tests');
        console.error('strictly require an explicitly configured, dedicated test database URI.');
        console.error('Production MONGO_URI cannot and will not be used.');
        console.error('Example:');
        console.error('  TEST_MONGO_URI="mongodb+srv://.../smartearning_test?..." node test_series07_dynamic_tabs.js');
        console.error('======================================================================\n');
        process.exit(1);
    }

    const testUri = rawUri.trim();

    // Mask credentials for safe logging
    const maskedUri = testUri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@\s]+):([^@\s]+)@/i, '$1****:****@');

    // Extract database name from URI
    let dbName = '';
    try {
        const parsed = new URL(testUri);
        dbName = (parsed.pathname || '').replace(/^\//, '').split('?')[0];
    } catch (_) {
        const match = testUri.match(/\/([^/?]+)(\?|$)/);
        dbName = match ? match[1] : '';
    }

    if (!dbName) {
        console.error('\n======================================================================');
        console.error('FATAL: TEST_MONGO_URI does not specify a target database name.');
        console.error(`Provided URI: ${maskedUri}`);
        console.error('======================================================================\n');
        process.exit(1);
    }

    // Check if the target database matches known production patterns or the primary MONGO_URI
    const forbiddenProdNames = ['smartearning_db', 'smartearning', 'production', 'prod', 'smartexn_prod', 'smartexn'];

    if (process.env.MONGO_URI) {
        try {
            const prodParsed = new URL(process.env.MONGO_URI);
            const prodDbName = (prodParsed.pathname || '').replace(/^\//, '').split('?')[0];
            if (prodDbName) {
                forbiddenProdNames.push(prodDbName.toLowerCase());
            }
        } catch (_) {}
    }

    const lowerDbName = dbName.toLowerCase();
    for (const forbidden of forbiddenProdNames) {
        if (lowerDbName === forbidden) {
            console.error('\n======================================================================');
            console.error(`FATAL: TEST_MONGO_URI targets the production database ('${dbName}').`);
            console.error('Tests are strictly prohibited from executing against production.');
            console.error('======================================================================\n');
            process.exit(1);
        }
    }

    // Enforce that the database name has a clear test designation
    if (!lowerDbName.includes('test')) {
        console.error('\n======================================================================');
        console.error(`FATAL: Database name '${dbName}' lacks a test designation ('test' or '_test').`);
        console.error('Please configure an isolated test database (e.g. smartearning_test).');
        console.error('======================================================================\n');
        process.exit(1);
    }

    console.log(`[Database Isolation Confirmed]: Dedicated test DB '${dbName}' (${maskedUri})`);
    return testUri;
}

// Mock Express req/res
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    res.send = (data) => { res.body = data; return res; };
    return res;
};

async function runTests() {
    console.log('Running Universal Provider Placement Series 07 - Dynamic Tabs & Display Modes...');

    // 1. Enforce Test Database Isolation
    const isolatedTestUri = validateTestDatabaseIsolation();

    // Tracking arrays for strict test-owned record cleanup
    const createdUserIds = [];
    const createdProviderKeys = [];
    const createdPlacementIds = [];

    // Unique execution prefix to avoid any overlap with existing records
    const RUN_ID = `s07_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const TEST_PROVIDER_KEY = `test_prov_${RUN_ID}`;
    const TEST_USERNAME = `worker_${RUN_ID}`;
    const TEST_USER_EMAIL = `worker_${RUN_ID}@dynamic-tabs-test.com`;

    const originalGetSettings = Setting.getSettings;
    const originalFindOne = OfferwallProvider.findOne;

    try {
        // Connect ONLY to validated isolated test database
        await mongoose.connect(isolatedTestUri, {
            autoIndex: false,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4
        });
        console.log('✓ Successfully connected to isolated MongoDB test database.');

        // Build ProviderPlacement compound index for placement uniqueness validation
        await ProviderPlacement.createIndexes();

        const adminUser = { _id: new mongoose.Types.ObjectId(), role: 'admin', username: `admin_${RUN_ID}` };
        const regularUser = await User.create({
            username: TEST_USERNAME,
            email: TEST_USER_EMAIL,
            password: 'password123',
            role: 'user',
            status: 'Active',
            emailVerified: true,
            whatsappVerified: true
        });
        createdUserIds.push(regularUser._id);

        // Create isolated test provider (never touches real provider keys)
        await OfferwallProvider.create({
            providerKey: TEST_PROVIDER_KEY,
            name: `Series07 Test Network ${RUN_ID}`,
            enabled: true,
            status: 'ACTIVE',
            appId: `app_${RUN_ID}`,
            iframeUrlTemplate: 'https://theoremreach.com/api/v1/offers?user_id={userId}&api_key=test'
        });
        createdProviderKeys.push(TEST_PROVIDER_KEY);

        // Mock Settings for dynamic tabs
        Setting.getSettings = async () => ({
            customEarnTabs: [
                {
                    id: `custom_parent_${RUN_ID}`,
                    title: 'Custom Parent Tab',
                    enabled: true,
                    subTabs: [
                        { id: 'sub_enabled_1', name: 'Enabled SubTab 1', enabled: true },
                        { id: 'sub_disabled_2', name: 'Disabled SubTab 2', enabled: false },
                        { id: 'sub_enabled_3', name: 'Enabled SubTab 3', enabled: true }
                    ]
                },
                {
                    id: `empty_parent_${RUN_ID}`,
                    title: 'Parent With Zero SubTabs',
                    enabled: true,
                    subTabs: []
                },
                {
                    id: `disabled_parent_${RUN_ID}`,
                    title: 'Disabled Parent Tab',
                    enabled: false,
                    subTabs: [{ id: 'sub_under_disabled', name: 'Sub Tab', enabled: true }]
                }
            ],
            emailVerificationRequired: false,
            whatsappVerificationRequired: false
        });

        // =========================================================================
        // Test 1: Placement default state is OFF (placementEnabled: false)
        // =========================================================================
        console.log('Test 1: Verifying new placement default status is strictly OFF...');
        const req1 = {
            user: adminUser,
            body: {
                providerKey: TEST_PROVIDER_KEY,
                parentTabId: `custom_parent_${RUN_ID}`,
                subTabId: '',
                displayName: 'Default Off Placement',
                launchDisplayMode: 'inline'
            }
        };
        const res1 = mockRes();
        await createAdminPlacement(req1, res1);
        if (res1.statusCode !== 201 || res1.body.data.placementEnabled !== false) {
            throw new Error(`Failed Test 1: Expected 201 and placementEnabled === false, got ${res1.statusCode}`);
        }
        const defaultOffPlacementId = res1.body.data._id;
        createdPlacementIds.push(defaultOffPlacementId);
        console.log('✓ Test 1 Passed: Placement created with default status OFF.');

        // =========================================================================
        // Test 2: Parent-level placement without sub-tabs (subTabId: '')
        // =========================================================================
        console.log('Test 2: Verifying parent-level placement without sub-tabs...');
        if (res1.body.data.subTabId !== '') {
            throw new Error(`Failed Test 2: Expected empty subTabId for parent-level, got ${res1.body.data.subTabId}`);
        }
        console.log('✓ Test 2 Passed: Parent-level placement created with empty subTabId.');

        // =========================================================================
        // Test 3: Built-in available_jobs placements
        // =========================================================================
        console.log('Test 3: Creating and verifying available_jobs placement...');
        const req3 = {
            user: adminUser,
            body: {
                providerKey: TEST_PROVIDER_KEY,
                parentTabId: 'available_jobs',
                displayName: 'Available Jobs Network',
                launchDisplayMode: 'modal'
            }
        };
        const res3 = mockRes();
        await createAdminPlacement(req3, res3);
        if (res3.statusCode !== 201 || res3.body.data.parentTabId !== 'available_jobs') {
            throw new Error(`Failed Test 3: Expected 201 for available_jobs placement, got ${res3.statusCode}`);
        }
        const jobPlacementId = res3.body.data._id;
        createdPlacementIds.push(jobPlacementId);
        console.log('✓ Test 3 Passed: available_jobs placement successfully created.');

        // =========================================================================
        // Test 4: Enabled and disabled sub-tabs filtering in getAvailablePlacements
        // =========================================================================
        console.log('Test 4: Verifying enabled vs disabled sub-tabs in available placements...');
        // Create placement under enabled sub-tab
        const pSub1 = await ProviderPlacement.create({
            providerKey: TEST_PROVIDER_KEY,
            parentTabId: `custom_parent_${RUN_ID}`,
            subTabId: 'sub_enabled_1',
            displayName: 'Enabled SubTab Offer',
            placementEnabled: true,
            launchDisplayMode: 'inline'
        });
        createdPlacementIds.push(pSub1._id);

        // Create placement under disabled sub-tab
        const pSub2 = await ProviderPlacement.create({
            providerKey: TEST_PROVIDER_KEY,
            parentTabId: `custom_parent_${RUN_ID}`,
            subTabId: 'sub_disabled_2',
            displayName: 'Disabled SubTab Offer',
            placementEnabled: true,
            launchDisplayMode: 'modal'
        });
        createdPlacementIds.push(pSub2._id);

        // Enable the parent-level placement
        await ProviderPlacement.findByIdAndUpdate(defaultOffPlacementId, { placementEnabled: true });

        const req4 = { user: { id: regularUser._id }, params: { parentTabId: `custom_parent_${RUN_ID}` } };
        const res4 = mockRes();
        await getAvailablePlacements(req4, res4);

        if (res4.statusCode !== 200) {
            throw new Error(`Failed Test 4: Expected 200, got ${res4.statusCode}`);
        }
        const availableItems = res4.body.data || [];
        const hasParentLevel = availableItems.some(p => p.subTabId === '' && p.displayName === 'Default Off Placement');
        const hasEnabledSub = availableItems.some(p => p.subTabId === 'sub_enabled_1');
        const hasDisabledSub = availableItems.some(p => p.subTabId === 'sub_disabled_2');

        if (!hasParentLevel || !hasEnabledSub || hasDisabledSub) {
            throw new Error(`Failed Test 4: Unexpected sub-tab filtering. hasParent: ${hasParentLevel}, hasEnabled: ${hasEnabledSub}, hasDisabled: ${hasDisabledSub}`);
        }
        console.log('✓ Test 4 Passed: Enabled sub-tabs and parent-level included; disabled sub-tab excluded.');

        // =========================================================================
        // Test 5: Dynamic parent tab visibility with zero sub-tabs
        // =========================================================================
        console.log('Test 5: Verifying parent tab with zero sub-tabs supports placements...');
        const pEmpty = await ProviderPlacement.create({
            providerKey: TEST_PROVIDER_KEY,
            parentTabId: `empty_parent_${RUN_ID}`,
            subTabId: '',
            displayName: 'Zero SubTab Placement',
            placementEnabled: true,
            launchDisplayMode: 'inline'
        });
        createdPlacementIds.push(pEmpty._id);

        const req5 = { user: { id: regularUser._id }, params: { parentTabId: `empty_parent_${RUN_ID}` } };
        const res5 = mockRes();
        await getAvailablePlacements(req5, res5);
        if (res5.statusCode !== 200 || res5.body.data.length !== 1) {
            throw new Error(`Failed Test 5: Expected 1 placement for zero-subtab parent, got ${res5.body.data?.length}`);
        }
        console.log('✓ Test 5 Passed: Parent tab with zero sub-tabs successfully returns placement.');

        // =========================================================================
        // Test 6: Disabled parent tab returns zero placements
        // =========================================================================
        console.log('Test 6: Verifying disabled parent tab returns zero placements...');
        const pDisabled = await ProviderPlacement.create({
            providerKey: TEST_PROVIDER_KEY,
            parentTabId: `disabled_parent_${RUN_ID}`,
            subTabId: 'sub_under_disabled',
            displayName: 'Placement Under Disabled Parent',
            placementEnabled: true,
            launchDisplayMode: 'modal'
        });
        createdPlacementIds.push(pDisabled._id);

        const req6 = { user: { id: regularUser._id }, params: { parentTabId: `disabled_parent_${RUN_ID}` } };
        const res6 = mockRes();
        await getAvailablePlacements(req6, res6);
        if (res6.statusCode !== 200 || res6.body.data.length !== 0) {
            throw new Error(`Failed Test 6: Disabled parent must return 0 placements, got ${res6.body.data?.length}`);
        }
        console.log('✓ Test 6 Passed: Disabled parent tab cleanly returns 0 placements.');

        // =========================================================================
        // Test 7: Inline and Modal display modes returned authoritatively
        // =========================================================================
        console.log('Test 7: Verifying authoritative launchDisplayMode return in launchProviderPlacement...');
        const req7Inline = { user: { id: regularUser._id }, params: { placementId: defaultOffPlacementId } };
        const res7Inline = mockRes();
        await launchProviderPlacement(req7Inline, res7Inline);
        if (res7Inline.statusCode !== 200 || res7Inline.body.launchDisplayMode !== 'inline') {
            throw new Error(`Failed Test 7 (Inline): Expected 200 and launchDisplayMode: inline, got ${res7Inline.statusCode} and ${res7Inline.body?.launchDisplayMode}`);
        }

        // Enable jobPlacement and test modal mode
        await ProviderPlacement.findByIdAndUpdate(jobPlacementId, { placementEnabled: true });
        const req7Modal = { user: { id: regularUser._id }, params: { placementId: jobPlacementId } };
        const res7Modal = mockRes();
        await launchProviderPlacement(req7Modal, res7Modal);
        if (res7Modal.statusCode !== 200 || res7Modal.body.launchDisplayMode !== 'modal') {
            throw new Error(`Failed Test 7 (Modal): Expected 200 and launchDisplayMode: modal, got ${res7Modal.statusCode} and ${res7Modal.body?.launchDisplayMode}`);
        }
        console.log('✓ Test 7 Passed: Authoritative inline and modal display modes verified.');

        // =========================================================================
        // Test 8: Validate subTabId update against existing placement parentTabId
        // =========================================================================
        console.log('Test 8: Verifying backend validation on updateAdminPlacement for subTabId...');
        // 8a: Update to valid sub-tab under existing parent
        const req8a = {
            user: adminUser,
            params: { placementId: defaultOffPlacementId },
            body: { subTabId: 'sub_enabled_3' }
        };
        const res8a = mockRes();
        await updateAdminPlacement(req8a, res8a);
        if (res8a.statusCode !== 200 || res8a.body.data.subTabId !== 'sub_enabled_3') {
            throw new Error(`Failed Test 8a: Valid subTabId update should succeed with 200, got ${res8a.statusCode}`);
        }

        // 8b: Update to non-existent sub-tab under existing parent should fail with 400
        const req8b = {
            user: adminUser,
            params: { placementId: defaultOffPlacementId },
            body: { subTabId: 'invalid_non_existent_subtab' }
        };
        const res8b = mockRes();
        await updateAdminPlacement(req8b, res8b);
        if (res8b.statusCode !== 400) {
            throw new Error(`Failed Test 8b: Invalid subTabId must be rejected with 400, got ${res8b.statusCode}`);
        }

        // 8c: Update back to empty subTabId (parent-level) should succeed
        const req8c = {
            user: adminUser,
            params: { placementId: defaultOffPlacementId },
            body: { subTabId: '' }
        };
        const res8c = mockRes();
        await updateAdminPlacement(req8c, res8c);
        if (res8c.statusCode !== 200 || res8c.body.data.subTabId !== '') {
            throw new Error(`Failed Test 8c: Empty subTabId update should succeed with 200, got ${res8c.statusCode}`);
        }
        console.log('✓ Test 8 Passed: subTabId updates strictly validated against actual parentTabId.');

        // =========================================================================
        // Test 9: Existing behavior of unrelated Work & Earn tabs and Torox restriction
        // =========================================================================
        console.log('Test 9: Verifying Torox restriction fails closed in Provider Placement without DB mutation...');
        
        // Mock OfferwallProvider.findOne specifically for Torox restriction verification
        // Never creates, modifies, or deletes any actual Torox provider record in the database!
        OfferwallProvider.findOne = async (query) => {
            if (query && query.providerKey === 'torox') {
                return {
                    providerKey: 'torox',
                    name: 'Torox Network',
                    enabled: true,
                    status: 'ACTIVE'
                };
            }
            return originalFindOne.call(OfferwallProvider, query);
        };

        const toroxPlacement = await ProviderPlacement.create({
            providerKey: 'torox',
            parentTabId: 'available_jobs',
            subTabId: '',
            displayName: `${RUN_ID} Torox Restriction Check`,
            placementEnabled: true,
            launchDisplayMode: 'modal'
        });
        createdPlacementIds.push(toroxPlacement._id);

        const req9 = { user: { id: regularUser._id }, params: { placementId: toroxPlacement._id } };
        const res9 = mockRes();
        await launchProviderPlacement(req9, res9);
        if (res9.statusCode !== 403 || !res9.body.error.toLowerCase().includes('torox')) {
            throw new Error(`Failed Test 9: Torox launch must return 403 restricted, got ${res9.statusCode}`);
        }
        console.log('✓ Test 9 Passed: Torox restriction preserved; fails closed in placement system without DB mutation.');

        console.log('\n======================================================');
        console.log('All Series 07 Dynamic Tab Tests (9/9) Passed Successfully!');
        console.log('======================================================');

    } catch (err) {
        console.error('\nTest Suite Failed:');
        console.error(err);
        process.exitCode = 1;
    } finally {
        console.log('\nExecuting safe cleanup of test-owned records in finally block...');
        try {
            // Restore mocked functions first
            Setting.getSettings = originalGetSettings;
            OfferwallProvider.findOne = originalFindOne;

            // Delete ONLY records specifically created during this test run
            if (createdPlacementIds.length > 0) {
                const delPlacements = await ProviderPlacement.deleteMany({ _id: { $in: createdPlacementIds } });
                console.log(`✓ Cleaned up ${delPlacements.deletedCount} test-owned placements.`);
            }
            if (createdUserIds.length > 0) {
                const delUsers = await User.deleteMany({ _id: { $in: createdUserIds } });
                console.log(`✓ Cleaned up ${delUsers.deletedCount} test-owned users.`);
            }
            if (createdProviderKeys.length > 0) {
                const delProviders = await OfferwallProvider.deleteMany({ providerKey: { $in: createdProviderKeys } });
                console.log(`✓ Cleaned up ${delProviders.deletedCount} test-owned providers.`);
            }
        } catch (cleanupErr) {
            console.error('Error during test-owned cleanup:', cleanupErr.message);
        } finally {
            try {
                await mongoose.disconnect();
                console.log('✓ Disconnected from isolated test database cleanly.');
            } catch (_) {}
            if (process.exitCode === 1) {
                process.exit(1);
            }
        }
    }
}

runTests();
