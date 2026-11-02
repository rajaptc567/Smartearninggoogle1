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

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartexn');

        // Setup Test Data Cleanup
        await User.deleteMany({ username: 'jobworker_series07' });
        await OfferwallProvider.deleteMany({ providerKey: { $in: ['test_series07_prov', 'torox'] } });
        await ProviderPlacement.deleteMany({ providerKey: { $in: ['test_series07_prov', 'torox'] } });

        const adminUser = { _id: new mongoose.Types.ObjectId(), role: 'admin', username: 'series07_admin' };
        const regularUser = await User.create({
            username: 'jobworker_series07',
            email: 'worker_series07@test.com',
            password: 'password123',
            role: 'user',
            status: 'Active',
            emailVerified: true,
            whatsappVerified: true
        });

        // Create standard test provider
        await OfferwallProvider.create({
            providerKey: 'test_series07_prov',
            name: 'Series07 Test Network',
            enabled: true,
            status: 'ACTIVE',
            appId: 'series07_app_123',
            iframeUrlTemplate: 'https://theoremreach.com/api/v1/offers?user_id={userId}&api_key=test'
        });

        // Create Torox provider for restricted placement check
        await OfferwallProvider.create({
            providerKey: 'torox',
            name: 'Torox Network',
            enabled: true,
            status: 'ACTIVE',
            appId: 'torox_123'
        });

        // Mock Settings
        const originalGetSettings = Setting.getSettings;
        Setting.getSettings = async () => ({
            customEarnTabs: [
                {
                    id: 'custom_parent_series07',
                    title: 'Custom Parent Tab',
                    enabled: true,
                    subTabs: [
                        { id: 'sub_enabled_1', name: 'Enabled SubTab 1', enabled: true },
                        { id: 'sub_disabled_2', name: 'Disabled SubTab 2', enabled: false },
                        { id: 'sub_enabled_3', name: 'Enabled SubTab 3', enabled: true }
                    ]
                },
                {
                    id: 'empty_parent_series07',
                    title: 'Parent With Zero SubTabs',
                    enabled: true,
                    subTabs: []
                },
                {
                    id: 'disabled_parent_series07',
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
                providerKey: 'test_series07_prov',
                parentTabId: 'custom_parent_series07',
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
                providerKey: 'test_series07_prov',
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
        console.log('✓ Test 3 Passed: available_jobs placement successfully created.');

        // =========================================================================
        // Test 4: Enabled and disabled sub-tabs filtering in getAvailablePlacements
        // =========================================================================
        console.log('Test 4: Verifying enabled vs disabled sub-tabs in available placements...');
        // Create placement under enabled sub-tab
        await ProviderPlacement.create({
            providerKey: 'test_series07_prov',
            parentTabId: 'custom_parent_series07',
            subTabId: 'sub_enabled_1',
            displayName: 'Enabled SubTab Offer',
            placementEnabled: true,
            launchDisplayMode: 'inline'
        });

        // Create placement under disabled sub-tab
        await ProviderPlacement.create({
            providerKey: 'test_series07_prov',
            parentTabId: 'custom_parent_series07',
            subTabId: 'sub_disabled_2',
            displayName: 'Disabled SubTab Offer',
            placementEnabled: true,
            launchDisplayMode: 'modal'
        });

        // Enable the parent-level placement
        await ProviderPlacement.findByIdAndUpdate(defaultOffPlacementId, { placementEnabled: true });

        const req4 = { user: { id: regularUser._id }, params: { parentTabId: 'custom_parent_series07' } };
        const res4 = mockRes();
        await getAvailablePlacements(req4, res4);

        if (res4.statusCode !== 200) {
            throw new Error(`Failed Test 4: Expected 200, got ${res4.statusCode}`);
        }
        // Should contain parent-level and sub_enabled_1, but NOT sub_disabled_2
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
        await ProviderPlacement.create({
            providerKey: 'test_series07_prov',
            parentTabId: 'empty_parent_series07',
            subTabId: '',
            displayName: 'Zero SubTab Placement',
            placementEnabled: true,
            launchDisplayMode: 'inline'
        });

        const req5 = { user: { id: regularUser._id }, params: { parentTabId: 'empty_parent_series07' } };
        const res5 = mockRes();
        await getAvailablePlacements(req5, res5);
        if (res5.statusCode !== 200 || res5.body.data.length !== 1) {
            throw new Error(`Failed Test 5: Expected 1 placement for zero-subtab parent, got ${res5.body.data?.length}`);
        }
        console.log('✓ Test 5 Passed: Parent tab with zero sub-tabs successfully returns placement.');

        // =========================================================================
        // Test 6: Disabled parent tab returns empty placements
        // =========================================================================
        console.log('Test 6: Verifying disabled parent tab returns zero placements...');
        await ProviderPlacement.create({
            providerKey: 'test_series07_prov',
            parentTabId: 'disabled_parent_series07',
            subTabId: 'sub_under_disabled',
            displayName: 'Placement Under Disabled Parent',
            placementEnabled: true,
            launchDisplayMode: 'modal'
        });

        const req6 = { user: { id: regularUser._id }, params: { parentTabId: 'disabled_parent_series07' } };
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
        console.log('Test 9: Verifying Torox restriction fails closed in Provider Placement...');
        const toroxPlacement = await ProviderPlacement.create({
            providerKey: 'torox',
            parentTabId: 'available_jobs',
            subTabId: '',
            displayName: 'Torox Placement',
            placementEnabled: true,
            launchDisplayMode: 'modal'
        });

        const req9 = { user: { id: regularUser._id }, params: { placementId: toroxPlacement._id } };
        const res9 = mockRes();
        await launchProviderPlacement(req9, res9);
        if (res9.statusCode !== 403 || !res9.body.error.toLowerCase().includes('torox')) {
            throw new Error(`Failed Test 9: Torox launch must return 403 restricted, got ${res9.statusCode}`);
        }
        console.log('✓ Test 9 Passed: Torox restriction preserved; fails closed in placement system.');

        // Cleanup
        Setting.getSettings = originalGetSettings;
        await User.deleteMany({ username: 'jobworker_series07' });
        await OfferwallProvider.deleteMany({ providerKey: { $in: ['test_series07_prov', 'torox'] } });
        await ProviderPlacement.deleteMany({ providerKey: { $in: ['test_series07_prov', 'torox'] } });
        await mongoose.disconnect();

        console.log('\n======================================================');
        console.log('All Series 07 Dynamic Tab Tests (9/9) Passed Successfully!');
        console.log('======================================================');
    } catch (err) {
        console.error('\nTest Suite Failed:');
        console.error(err);
        try { await mongoose.disconnect(); } catch (_) {}
        process.exit(1);
    }
}

runTests();
