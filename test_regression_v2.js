
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './backend/models/User.js';
import UserTask from './backend/models/UserTask.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import Setting from './backend/models/Setting.js';
import { updateUserTaskStatus } from './backend/controllers/userTasksController.js';
import { launchProviderPlacement } from './backend/controllers/providerPlacementController.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartearning';

async function setup() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
    }
}

async function testCampaignConcurrency() {
    console.log('\n--- Testing Campaign Review Concurrency ---');
    
    // 1. Create a test user and a rejected task
    const testUser = await User.create({
        username: 'testuser_concurrency',
        email: 'test_concurrency@example.com',
        password: 'password123',
        taskWalletBalance: 10.00,
        walletBalance: 10.00
    });

    const testTask = await UserTask.create({
        userId: testUser._id,
        title: 'Concurrency Test Task',
        status: 'Rejected',
        targetQuantity: 10,
        rewardPerTask: 0.5,
        resubmittedForReview: false
    });

    // Mock settings
    await Setting.findOneAndUpdate({}, { 
        userTaskConfig: { commissionPercent: 10, campaignFeeEnabled: false } 
    }, { upsert: true });

    const req = {
        params: { id: testTask._id.toString() },
        body: { reviewRequested: true, userReviewMessage: 'Please review' },
        user: { id: testUser._id.toString(), role: 'user' }
    };

    const res = {
        status: function(s) { this.statusCode = s; return this; },
        json: function(j) { this.data = j; return this; }
    };

    console.log('Starting simultaneous resubmission requests...');
    
    // Simulate simultaneous requests
    const results = await Promise.all([
        updateUserTaskStatus(req, { ...res }),
        updateUserTaskStatus(req, { ...res }),
        updateUserTaskStatus(req, { ...res })
    ]);

    const successes = results.filter(r => r.data.success);
    const failures = results.filter(r => !r.data.success);

    console.log(`Successes: ${successes.length}`);
    console.log(`Failures: ${failures.length}`);

    if (successes.length === 1) {
        console.log('✓ Success: Only one concurrent request succeeded.');
    } else {
        console.error('✗ Failure: Multi-deduction detected!');
    }

    // Check balance
    const updatedUser = await User.findById(testUser._id);
    console.log(`Final Task Wallet Balance: ${updatedUser.taskWalletBalance}`);
    
    // Cleanup
    await User.deleteOne({ _id: testUser._id });
    await UserTask.deleteOne({ _id: testTask._id });
}

async function testTrustedDomains() {
    console.log('\n--- Testing Provider Trusted Domains ---');

    const testUser = await User.create({ username: 'domain_tester', email: 'domain@test.com', password: 'p' });
    
    const runTest = async (domains, launchUrl, expectedSuccess, description) => {
        const placement = await ProviderPlacement.create({
            providerKey: 'generic_test',
            parentTabId: 'available_jobs',
            displayName: 'Test Placement',
            placementEnabled: true,
            availableTasksVisibility: true,
            trustedLaunchDomains: domains
        });

        // We need a provider that matches
        const OfferwallProvider = mongoose.model('OfferwallProvider');
        await OfferwallProvider.findOneAndUpdate(
            { providerKey: 'generic_test' },
            { 
                providerKey: 'generic_test', 
                enabled: true, 
                status: 'ACTIVE',
                iframeUrlTemplate: launchUrl,
                appId: '123'
            },
            { upsert: true }
        );

        const req = {
            params: { placementId: placement._id.toString() },
            user: { id: testUser._id.toString() }
        };
        const res = {
            status: function(s) { this.statusCode = s; return this; },
            json: function(j) { this.data = j; return this; }
        };

        await launchProviderPlacement(req, res);
        
        const success = res.data.success === true;
        if (success === expectedSuccess) {
            console.log(`✓ Passed [${description}]: Expected ${expectedSuccess}, got ${success}`);
        } else {
            console.error(`✗ Failed [${description}]: Expected ${expectedSuccess}, got ${success}. Error: ${res.data.error}`);
        }

        await ProviderPlacement.deleteOne({ _id: placement._id });
    };

    await runTest(['trusted.com'], 'https://trusted.com?u={userId}', true, 'Valid HTTPS domain');
    await runTest(['trusted.com'], 'https://sub.trusted.com?u={userId}', true, 'Legitimate subdomain');
    await runTest(['trusted.com'], 'https://untrusted.com?u={userId}', false, 'Untrusted domain');
    await runTest([], 'https://trusted.com?u={userId}', false, 'Empty allowlist');
    await runTest(['trusted.com'], 'http://trusted.com?u={userId}', false, 'Non-HTTPS URL');
    await runTest(['trusted.com'], 'https://user:pass@trusted.com?u={userId}', false, 'URL with credentials');

    // Cleanup
    await User.deleteOne({ _id: testUser._id });
}

async function run() {
    try {
        await setup();
        await testCampaignConcurrency();
        await testTrustedDomains();
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
