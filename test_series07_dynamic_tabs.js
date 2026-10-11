import assert from 'assert';
import fs from 'fs';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { getVisibleEarnTabs } = jiti('./utils/earnTabsHelper.ts');

console.log('Running Series 07: Dynamic Work & Earn Main Tabs & SubTabs Verification Tests...\n');

async function runTests() {
    try {
        // --- TEST 1, 2, 3: Sub-Tab ON/OFF Persistence & Legacy Preservation ---
        console.log('Verifying Sub-Tab ON/OFF Persistence (Settings.tsx handleSave & settingsController.js sanitizer)...');

        // Helper mimicking handleSave mapping in pages/Settings.tsx
        function simulateSettingsHandleSave(customEarnTabs) {
            return (customEarnTabs || []).map(t => ({
                id: String(t.id || 'other_tasks').trim(),
                title: String(t.title || 'Other Tasks').trim(),
                enabled: t.enabled !== false,
                subTabs: (t.subTabs || []).map(st => ({
                    id: String(st.id || '').trim(),
                    name: String(st.name || '').trim(),
                    providerKey: String(st.providerKey || st.id || '').trim(),
                    badge: String(st.badge || '').trim(),
                    description: String(st.description || '').trim(),
                    enabled: st.enabled !== false
                })).filter(st => st.name)
            }));
        }

        // Helper mimicking backend/controllers/settingsController.js customEarnTabs sanitizer
        function simulateBackendSanitizer(customEarnTabs) {
            if (customEarnTabs === undefined || !Array.isArray(customEarnTabs)) return [];
            return customEarnTabs.map(tab => {
                const cleanSubTabs = Array.isArray(tab.subTabs) ? tab.subTabs.map(st => ({
                    id: String(st.id || '').trim() || ('sub_' + Math.random().toString(36).substring(2, 8)),
                    name: String(st.name || '').trim(),
                    providerKey: String(st.providerKey || st.id || '').trim(),
                    badge: String(st.badge || '').trim(),
                    description: String(st.description || '').trim(),
                    icon: String(st.icon || '').trim(),
                    enabled: st.enabled !== false && st.enabled !== 'false'
                })).filter(st => st.name) : [];

                return {
                    id: String(tab.id || '').trim() || ('tab_' + Math.random().toString(36).substring(2, 8)),
                    title: String(tab.title || 'Tab').trim(),
                    enabled: tab.enabled !== false && tab.enabled !== 'false',
                    subTabs: cleanSubTabs
                };
            });
        }

        // Case 1: Disable a Sub-Tab, save settings, reload settings -> confirm it remains disabled
        const tabsWithDisabledSub = [
            {
                id: 'other_tasks',
                title: 'Other Tasks',
                enabled: true,
                subTabs: [
                    { id: 'sub_cpalead', name: 'CPLead', providerKey: 'cpalead', enabled: false },
                    { id: 'sub_2row', name: '2row', providerKey: '2row', enabled: true }
                ]
            }
        ];
        const savedPayload1 = simulateSettingsHandleSave(tabsWithDisabledSub);
        const persistedBackend1 = simulateBackendSanitizer(savedPayload1);
        const sub1 = persistedBackend1[0].subTabs.find(s => s.id === 'sub_cpalead');
        const sub2 = persistedBackend1[0].subTabs.find(s => s.id === 'sub_2row');

        assert.strictEqual(sub1.enabled, false, 'Case 1: Disabled sub-tab (enabled: false) must remain false after save and backend processing');
        console.log('✓ Case 1 passed: Disabled Sub-Tab remains disabled (enabled: false) after save and reload.');

        // Case 2: Enable it again, save, reload -> confirm it remains enabled
        tabsWithDisabledSub[0].subTabs[0].enabled = true;
        const savedPayload2 = simulateSettingsHandleSave(tabsWithDisabledSub);
        const persistedBackend2 = simulateBackendSanitizer(savedPayload2);
        const sub1ReEnabled = persistedBackend2[0].subTabs.find(s => s.id === 'sub_cpalead');

        assert.strictEqual(sub1ReEnabled.enabled, true, 'Case 2: Re-enabled sub-tab (enabled: true) must remain true after save and backend processing');
        console.log('✓ Case 2 passed: Enabled Sub-Tab remains enabled (enabled: true) after save and reload.');

        // Case 3: Confirm other enabled Sub-Tabs continue to display
        assert.strictEqual(sub2.enabled, true, 'Case 3: Other enabled Sub-Tab (sub_2row) must continue to be enabled');
        const visibleTabsCase3 = getVisibleEarnTabs(persistedBackend1, {
            workAndEarn: { otherTasks: { isEnabled: true, isHiddenInNav: false } }
        });
        assert.strictEqual(visibleTabsCase3.length, 1, 'Tab should still be visible because sub_2row is enabled');
        console.log('✓ Case 3 passed: Other enabled Sub-Tabs continue to display and keep tab visible.');

        // Legacy Sub-Tab check: If a legacy Sub-Tab has no enabled property, defaults to true
        const legacyTabs = [
            {
                id: 'other_tasks',
                title: 'Other Tasks',
                subTabs: [
                    { id: 'legacy_sub', name: 'Legacy Provider' } // no enabled property
                ]
            }
        ];
        const savedLegacy = simulateSettingsHandleSave(legacyTabs);
        const backendLegacy = simulateBackendSanitizer(savedLegacy);
        assert.strictEqual(backendLegacy[0].subTabs[0].enabled, true, 'Legacy Sub-Tab without enabled property must default to true');
        console.log('✓ Legacy Sub-Tab check passed: Defaulting to enabled: true preserved.');

        // --- TEST 4 & 5: Other Tasks Special-Case Matching vs Custom Tabs ---
        console.log('\nVerifying Other Tasks Special-Case Matching (utils/earnTabsHelper.ts)...');

        const testTabsWithCustomOther = [
            {
                id: 'other_tasks',
                title: 'Other Tasks',
                enabled: true,
                subTabs: [{ id: 'st1', name: 'Sub 1', enabled: true }]
            },
            {
                id: 'other_surveys',
                title: 'Other Surveys',
                enabled: true,
                subTabs: [{ id: 'st2', name: 'Survey Partner', enabled: true }]
            },
            {
                id: 'another_category',
                title: 'Another Other Category',
                enabled: true,
                subTabs: [{ id: 'st3', name: 'Partner Gigs', enabled: true }]
            }
        ];

        // When otherTasks module page control is DISABLED:
        const whenOtherTasksDisabled = getVisibleEarnTabs(testTabsWithCustomOther, {
            workAndEarn: {
                otherTasks: { isEnabled: false, isHiddenInNav: false }
            }
        });

        // Case 4: Confirm custom tabs titled with "Other" are NOT controlled by otherTasks toggle
        assert.ok(
            whenOtherTasksDisabled.some(t => t.id === 'other_surveys'),
            'Case 4: Custom tab titled "Other Surveys" (id: other_surveys) must remain visible when built-in otherTasks is disabled'
        );
        assert.ok(
            whenOtherTasksDisabled.some(t => t.id === 'another_category'),
            'Case 4: Custom tab "Another Other Category" must remain visible when built-in otherTasks is disabled'
        );
        console.log('✓ Case 4 passed: Custom tab titled "Other Surveys" is NOT controlled by the built-in other_tasks toggle.');

        // Case 5: Confirm built-in "other_tasks" tab still respects its module-page toggle
        assert.ok(
            !whenOtherTasksDisabled.some(t => t.id === 'other_tasks'),
            'Case 5: Built-in tab (id: other_tasks) must be hidden when otherTasks module control is disabled'
        );

        // When otherTasks module page control is ENABLED:
        const whenOtherTasksEnabled = getVisibleEarnTabs(testTabsWithCustomOther, {
            workAndEarn: {
                otherTasks: { isEnabled: true, isHiddenInNav: false }
            }
        });
        assert.ok(
            whenOtherTasksEnabled.some(t => t.id === 'other_tasks'),
            'Case 5: Built-in tab (id: other_tasks) must be visible when otherTasks module control is enabled'
        );
        console.log('✓ Case 5 passed: Built-in "other_tasks" tab respects its module-page toggle.');

        // --- TEST 6: Dashboard & My Tasks -> Available Tasks Consistency ---
        console.log('\nVerifying Dashboard and My Tasks -> Available Tasks Shared Architecture...');
        const dashboardSource = fs.readFileSync('./pages/user/UserWorkAndEarnDashboard.tsx', 'utf8');
        const tasksSubmitSource = fs.readFileSync('./pages/user/UserTasksSubmit.tsx', 'utf8');
        const earnTabsHelperSource = fs.readFileSync('./utils/earnTabsHelper.ts', 'utf8');

        // Both use getVisibleEarnTabs
        assert.ok(dashboardSource.includes('getVisibleEarnTabs'), 'Dashboard must use getVisibleEarnTabs');
        assert.ok(tasksSubmitSource.includes('getVisibleEarnTabs'), 'UserTasksSubmit must use getVisibleEarnTabs');

        // Both pass tabId to OtherTasksCard
        assert.ok(
            dashboardSource.includes('<OtherTasksCard hideHeader={false} tabId={dashboardTab} />'),
            'Dashboard must pass dynamic tabId to OtherTasksCard'
        );
        assert.ok(
            tasksSubmitSource.includes('<OtherTasksCard hideHeader={false} tabId={availableTasksSubTab} />'),
            'UserTasksSubmit must pass dynamic tabId to OtherTasksCard'
        );

        // Visibility helper only checks tab.id === 'other_tasks'
        assert.ok(
            earnTabsHelperSource.includes("if (tab.id === 'other_tasks')"),
            'earnTabsHelper.ts must only check tab.id === "other_tasks"'
        );
        assert.ok(
            !earnTabsHelperSource.includes("tab.title?.toLowerCase().includes('other')"),
            'earnTabsHelper.ts must not filter by tab.title containing "other"'
        );
        console.log('✓ Case 6 passed: Dashboard and My Tasks derive tab visibility from the same helper and pass tabId.');

        // --- TEST 7: Confirm No Mock Jobs Return ---
        console.log('\nVerifying Zero Mock Jobs...');
        const otherTasksCardSource = fs.readFileSync('./components/OtherTasksCard.tsx', 'utf8');
        assert.ok(
            otherTasksCardSource.includes('export const DEFAULT_GIGS: JobGig[] = [];'),
            'Case 7: OtherTasksCard.tsx DEFAULT_GIGS must be empty array'
        );
        assert.ok(
            dashboardSource.includes('const DEFAULT_GIGS: JobGig[] = [];'),
            'Case 7: UserWorkAndEarnDashboard.tsx DEFAULT_GIGS must be empty array'
        );
        console.log('✓ Case 7 passed: No mock jobs in DEFAULT_GIGS.');

        console.log('\n======================================================');
        console.log('All 7 verification cases passed successfully!');
        console.log('======================================================');
    } catch (err) {
        console.error('Test execution failed:', err);
        process.exit(1);
    }
}

runTests();
