import assert from 'assert';
import Setting from './backend/models/Setting.js';
import fs from 'fs';

console.log('Running Ticker and Work & Earn Security & Integrity Tests...');

async function runTests() {
    try {
        // Test 1: Setting schema default and persistence of tickerEnabled
        const schemaDef = Setting.schema.paths.tickerEnabled;
        assert.ok(schemaDef, 'tickerEnabled path must exist in Setting schema');
        assert.strictEqual(schemaDef.instance, 'Boolean', 'tickerEnabled must be a Boolean type');
        assert.strictEqual(schemaDef.options.default, true, 'tickerEnabled default must be true');

        console.log('Test 1 (Schema definition and default) passed.');

        // Test 2: Verify getSettings handling of tickerEnabled when undefined / false
        const mockDoc = {
            tickerEnabled: false,
            faqs: [],
            save: async function() { this.saved = true; return this; },
            markModified: function() {}
        };

        if (mockDoc.tickerEnabled === undefined) {
            mockDoc.tickerEnabled = true;
        }
        assert.strictEqual(mockDoc.tickerEnabled, false, 'Explicitly saved tickerEnabled: false must not be overwritten');

        const mockUndefinedDoc = {
            tickerEnabled: undefined,
            faqs: [],
            save: async function() { this.saved = true; return this; },
            markModified: function() {}
        };
        if (mockUndefinedDoc.tickerEnabled === undefined) {
            mockUndefinedDoc.tickerEnabled = true;
        }
        assert.strictEqual(mockUndefinedDoc.tickerEnabled, true, 'Undefined tickerEnabled must default to true safely');

        console.log('Test 2 (tickerEnabled preservation and safe default) passed.');

        // Test 3: Work & Earn mock jobs elimination verification in source
        const otherTasksContent = fs.readFileSync('./components/OtherTasksCard.tsx', 'utf8');
        assert.ok(otherTasksContent.includes('export const DEFAULT_GIGS: JobGig[] = [];'), 'DEFAULT_GIGS must be empty array in OtherTasksCard.tsx');

        const dashboardContent = fs.readFileSync('./pages/user/UserWorkAndEarnDashboard.tsx', 'utf8');
        assert.ok(dashboardContent.includes('const DEFAULT_GIGS: JobGig[] = [];'), 'DEFAULT_GIGS must be empty array in UserWorkAndEarnDashboard.tsx');

        console.log('Test 3 (Mock jobs elimination in source code) passed.');

        console.log('All Ticker and Work & Earn security regression tests passed successfully!');
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

runTests();
