import assert from 'assert';
import fs from 'fs';
import { getVisibleEarnTabs } from './utils/earnTabsHelper.js';

console.log('Running Series 07: Dynamic Work & Earn Main Tabs & SubTabs Verification Tests...');

async function runTests() {
    try {
        // Test 1: getVisibleEarnTabs filtering behavior
        const mockCustomTabs = [
            {
                id: 'other_tasks',
                title: 'Other Tasks',
                enabled: true,
                subTabs: [
                    { id: 'sub1', name: 'CPLead', enabled: true },
                    { id: 'sub2', name: '2row', enabled: false }
                ]
            },
            {
                id: 'surveys',
                title: 'Surveys & Polls',
                enabled: true,
                subTabs: [
                    { id: 'pollfish', name: 'Pollfish', enabled: true }
                ]
            },
            {
                id: 'disabled_tab',
                title: 'Disabled Tab',
                enabled: false,
                subTabs: [
                    { id: 'sub_d', name: 'Disabled Sub', enabled: true }
                ]
            },
            {
                id: 'empty_subtabs_tab',
                title: 'Empty Subtabs Tab',
                enabled: true,
                subTabs: []
            },
            {
                id: 'all_subtabs_disabled',
                title: 'All Subtabs Disabled Tab',
                enabled: true,
                subTabs: [
                    { id: 'sub_x', name: 'Sub X', enabled: false }
                ]
            }
        ];

        // Normal case: other_tasks enabled in modulePagesConfig
        const normalVisible = getVisibleEarnTabs(mockCustomTabs, {
            workAndEarn: {
                otherTasks: { isEnabled: true, isHiddenInNav: false }
            }
        });

        assert.strictEqual(normalVisible.length, 2, 'Should only show 2 active tabs (other_tasks and surveys)');
        assert.strictEqual(normalVisible[0].id, 'other_tasks');
        assert.strictEqual(normalVisible[1].id, 'surveys');
        console.log('Test 1 (Basic filtering of enabled tabs and non-empty active subtabs) passed.');

        // Test 2: other_tasks disabled via modulePagesConfig
        const otherDisabledVisible = getVisibleEarnTabs(mockCustomTabs, {
            workAndEarn: {
                otherTasks: { isEnabled: false, isHiddenInNav: false }
            }
        });
        assert.strictEqual(otherDisabledVisible.length, 1, 'Should only show surveys tab when otherTasks is disabled in modulePagesConfig');
        assert.strictEqual(otherDisabledVisible[0].id, 'surveys');
        console.log('Test 2 (otherTasks module page control integration) passed.');

        // Test 3: Verify UserWorkAndEarnDashboard.tsx and UserTasksSubmit.tsx consumption
        const dashboardCode = fs.readFileSync('./pages/user/UserWorkAndEarnDashboard.tsx', 'utf8');
        const tasksSubmitCode = fs.readFileSync('./pages/user/UserTasksSubmit.tsx', 'utf8');

        assert.ok(dashboardCode.includes('getVisibleEarnTabs'), 'UserWorkAndEarnDashboard must use getVisibleEarnTabs');
        assert.ok(tasksSubmitCode.includes('getVisibleEarnTabs'), 'UserTasksSubmit must use getVisibleEarnTabs');
        assert.ok(dashboardCode.includes('<OtherTasksCard hideHeader={false} tabId={dashboardTab} />'), 'UserWorkAndEarnDashboard must pass tabId to OtherTasksCard');
        assert.ok(tasksSubmitCode.includes('<OtherTasksCard hideHeader={false} tabId={availableTasksSubTab} />'), 'UserTasksSubmit must pass tabId to OtherTasksCard');

        console.log('Test 3 (Shared configuration & component verification) passed.');

        // Test 4: Verify Admin Settings UI handlers in Settings.tsx
        const settingsCode = fs.readFileSync('./pages/Settings.tsx', 'utf8');
        assert.ok(settingsCode.includes('handleAddEarnMainTab'), 'Settings.tsx must implement handleAddEarnMainTab');
        assert.ok(settingsCode.includes('handleToggleEarnMainTab'), 'Settings.tsx must implement handleToggleEarnMainTab');
        assert.ok(settingsCode.includes('handleStartEditEarnMainTab'), 'Settings.tsx must implement handleStartEditEarnMainTab');
        assert.ok(settingsCode.includes('handleDeleteEarnMainTab'), 'Settings.tsx must implement handleDeleteEarnMainTab');
        assert.ok(settingsCode.includes('handleToggleEarnSubTab'), 'Settings.tsx must implement handleToggleEarnSubTab');
        assert.ok(settingsCode.includes('selectedEarnTabId'), 'Settings.tsx must support selectedEarnTabId');

        console.log('Test 4 (Admin Settings main tabs and subtabs management) passed.');

        console.log('\nAll Series 07 regression tests passed successfully!');
    } catch (err) {
        console.error('Test execution failed:', err);
        process.exit(1);
    }
}

runTests();
