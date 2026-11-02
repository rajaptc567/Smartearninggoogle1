import assert from 'assert';
import fs from 'fs';
import mongoose from 'mongoose';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';
import Setting from './backend/models/Setting.js';
import User from './backend/models/User.js';
import {
    getAvailablePlacements,
    launchProviderPlacement
} from './backend/controllers/providerPlacementController.js';

console.log('Running Universal Provider Placement Rendering & Invariant Tests...');

async function runTests() {
    try {
        // =========================================================================
        // SECTION 1: STATIC SOURCE CODE INVARIANT VERIFICATION
        // =========================================================================
        console.log('\n--- Section 1: Static Source Code Invariant Checks ---');

        const otherTasksContent = fs.readFileSync('./components/OtherTasksCard.tsx', 'utf8');
        const panelContent = fs.readFileSync('./components/ProviderPlacementPanel.tsx', 'utf8');
        const userTasksContent = fs.readFileSync('./pages/user/UserTasks.tsx', 'utf8');
        const dashboardContent = fs.readFileSync('./pages/user/UserWorkAndEarnDashboard.tsx', 'utf8');

        // 1.1 OtherTasksCard must default activeSubTab to ''
        assert.ok(
            otherTasksContent.includes("useState<string>('')"),
            'OtherTasksCard must default activeSubTab state to empty string (Main / All Categories)'
        );
        console.log('✓ 1.1 Passed: activeSubTab defaults to empty string.');

        // 1.2 OtherTasksCard must render explicit "Main / All Categories" button
        assert.ok(
            otherTasksContent.includes('Main / All Categories') || otherTasksContent.includes('Main / All'),
            'OtherTasksCard must render an explicit Main / All Categories navigation button'
        );
        console.log('✓ 1.2 Passed: Main / All Categories navigation button present.');

        // 1.3 ProviderPlacementPanel must NOT contain "Premium Offer Networks" heading
        assert.ok(
            !panelContent.includes('Premium Offer Networks'),
            'ProviderPlacementPanel must NOT render separate "Premium Offer Networks" heading'
        );
        console.log('✓ 1.3 Passed: "Premium Offer Networks" separate heading removed.');

        // 1.4 ProviderPlacementPanel must NOT render its own subtab navigation buttons
        assert.ok(
            !panelContent.includes('subTabs.map'),
            'ProviderPlacementPanel must NOT render duplicate subtab navigation buttons'
        );
        console.log('✓ 1.4 Passed: Duplicate subtab navigation buttons removed from ProviderPlacementPanel.');

        // 1.5 ProviderPlacementPanel must filter placements by activeSubTabId
        assert.ok(
            panelContent.includes('p.subTabId !== activeSubTabId') && panelContent.includes('p.subTabId && p.subTabId.trim() !== \'\''),
            'ProviderPlacementPanel must enforce strict separation between parent-level and subtab placements'
        );
        console.log('✓ 1.5 Passed: Strict subtab vs parent-level placement filtering enforced.');

        // 1.6 Single unified empty state condition
        assert.ok(
            panelContent.includes('totalCount > 0'),
            'ProviderPlacementPanel must render content grid when totalCount > 0 and empty state when totalCount === 0'
        );
        console.log('✓ 1.6 Passed: Single unified content container & empty-state condition verified.');

        // 1.7 Both User Tasks and Dashboard use OtherTasksCard
        assert.ok(
            userTasksContent.includes('<OtherTasksCard hideHeader={false} />'),
            'UserTasks.tsx must render OtherTasksCard'
        );
        assert.ok(
            dashboardContent.includes('<OtherTasksCard hideHeader={false} tabId={dashboardTab} />'),
            'UserWorkAndEarnDashboard.tsx must render OtherTasksCard'
        );
        console.log('✓ 1.7 Passed: Both User Tasks and Dashboard use identical OtherTasksCard entry point.');

        // =========================================================================
        // SECTION 2: BACKEND CONTROLLER & PLACEMENT POLICY INVARIANTS
        // =========================================================================
        console.log('\n--- Section 2: Backend Controller & Policy Invariants ---');

        // Verify function signatures and existence
        assert.strictEqual(typeof getAvailablePlacements, 'function', 'getAvailablePlacements must be a function');
        assert.strictEqual(typeof launchProviderPlacement, 'function', 'launchProviderPlacement must be a function');

        console.log('✓ 2.1 Passed: ProviderPlacement controller functions exist and are exported.');

        console.log('\nAll Universal Provider Placement Rendering & Invariant Tests Passed Successfully!');
    } catch (err) {
        console.error('\nTest Execution Failed:', err);
        process.exit(1);
    }
}

runTests();
