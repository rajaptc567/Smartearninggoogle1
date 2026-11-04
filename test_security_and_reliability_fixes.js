import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { createUser } from './backend/controllers/usersController.js';
import { createWithdrawal } from './backend/controllers/withdrawalsController.js';
import { authorize } from './backend/middleware/authMiddleware.js';
import User from './backend/models/User.js';
import Setting from './backend/models/Setting.js';
import Withdrawal from './backend/models/Withdrawal.js';
import Transaction from './backend/models/Transaction.js';
import Notification from './backend/models/Notification.js';
import * as automation from './backend/utils/automation.js';

// Disable mongoose command buffering for unit testing
mongoose.set('bufferCommands', false);

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';

console.log('=== SMARTEXN SECURITY & RELIABILITY FIXES REGRESSION TEST SUITE ===\n');

let passed = 0;
let failed = 0;
let total = 0;

function assert(cond, name, details = '') {
    total++;
    if (cond) {
        passed++;
        console.log(`[PASS] ${name} ${details ? '- ' + details : ''}`);
    } else {
        failed++;
        console.error(`[FAIL] ${name} ${details ? '- ' + details : ''}`);
    }
}

function createMockReqRes({ body = {}, user = null, params = {}, path = '/api/v1/test', headers = {} } = {}) {
    const req = {
        body,
        user,
        params,
        path,
        originalUrl: path,
        headers,
        protocol: 'https',
        app: { get: () => null },
        get: (h) => (h === 'host' ? 'smartexn.com' : headers[h] || null)
    };

    const res = {
        statusCode: 200,
        jsonResponse: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonResponse = data;
            return this;
        }
    };

    return { req, res };
}

async function runTests() {
    console.log('--- TEST GROUP 1: PUBLIC REGISTRATION ROLE ESCALATION (FIX A) ---');
    
    // Save original methods
    const originalUserCreate = User.create;
    const originalUserFindOne = User.findOne;
    const originalSettingGetSettings = Setting.getSettings;
    const originalNotificationCreate = Notification.create;

    Setting.getSettings = async () => ({
        signUpConsentConfig: { termsRequired: false, privacyRequired: false },
        emailVerificationRequired: false,
        whatsappVerificationRequired: false
    });

    Notification.create = async () => ({ _id: new mongoose.Types.ObjectId() });
    User.findOne = async () => null;

    let createdPayload = null;
    User.create = async (payload) => {
        createdPayload = payload;
        return {
            _id: new mongoose.Types.ObjectId(),
            ...payload,
            save: async () => true
        };
    };

    // Test 1.1: Visitor attempting role escalation via public registration
    {
        const { req, res } = createMockReqRes({
            body: {
                fullName: 'Attacker John',
                username: 'attacker1',
                email: 'attacker1@example.com',
                password: 'password123',
                phone: '+1234567890',
                country: 'United States',
                role: 'admin', // Malicious input
                walletBalance: 500000 // Malicious input
            }
        });

        await createUser(req, res);
        assert(res.statusCode === 201, 'Public signup succeeds with HTTP 201', res.jsonResponse?.error || '');
        assert(createdPayload !== null, 'User.create was invoked');
        assert(createdPayload.role === 'user', 'Client-supplied role: admin was overridden to role: user');
        assert(createdPayload.walletBalance === 0, 'Client-supplied walletBalance was reset to 0');
        assert(createdPayload.username === 'attacker1', 'Legitimate username was preserved');
        assert(createdPayload.currency === 'USD', 'Currency correctly derived from country');
    }

    // Test 1.2: Visitor attempting super_admin role escalation
    {
        createdPayload = null;
        const { req, res } = createMockReqRes({
            body: {
                fullName: 'Super Hacker',
                username: 'hacker_super',
                email: 'hacker_super@example.com',
                password: 'password123',
                phone: '+1234567891',
                country: 'Pakistan',
                role: 'super_admin' // Malicious input
            }
        });

        await createUser(req, res);
        assert(res.statusCode === 201, 'Super Admin escalation attempt returns HTTP 201', res.jsonResponse?.error || '');
        assert(createdPayload.role === 'user', 'Client-supplied role: super_admin was forced to user');
        assert(createdPayload.currency === 'PKR', 'Pakistan country derived currency PKR');
    }

    console.log('\n--- TEST GROUP 2: FRONTEND AUTHORIZATION FALLBACK REMOVAL (FIX B) ---');
    {
        const layoutContent = fs.readFileSync('./components/Layout.tsx', 'utf8');
        const adminLoginContent = fs.readFileSync('./pages/AdminLogin.tsx', 'utf8');

        assert(!layoutContent.includes("username === 'admin'"), 'Layout.tsx does not contain username === "admin" fallback');
        assert(!adminLoginContent.includes("username === 'admin'"), 'AdminLogin.tsx does not contain username === "admin" fallback');
        assert(layoutContent.includes("role === 'admin'") && layoutContent.includes("role === 'super_admin'"), 'Layout.tsx strictly checks role === "admin" || role === "super_admin"');
        assert(adminLoginContent.includes("role === 'admin'") && adminLoginContent.includes("role === 'super_admin'"), 'AdminLogin.tsx strictly checks role === "admin" || role === "super_admin"');
    }

    console.log('\n--- TEST GROUP 3: CENTRALIZED STALE JWT AND BLOCKED ACCOUNT PROTECTION (FIX C) ---');
    
    const originalFindById = User.findById;

    // Test 3.1: Active Super Admin allowed through
    {
        const testAdminId = new mongoose.Types.ObjectId();
        User.findById = (id) => ({
            select: () => ({
                lean: async () => ({
                    _id: testAdminId,
                    role: 'super_admin',
                    status: 'Active',
                    restrictions: {}
                })
            })
        });

        const authMiddlewareFn = authorize(['admin', 'super_admin']);
        const { req, res } = createMockReqRes({
            user: { id: testAdminId.toString(), role: 'admin' } // Stale role in JWT was admin
        });

        let nextCalled = false;
        await authMiddlewareFn(req, res, () => { nextCalled = true; });

        assert(nextCalled === true, 'Active Super Admin passed authorization');
        assert(req.user.role === 'super_admin', 'req.user.role was updated to fresh DB role super_admin');
    }

    // Test 3.2: Demoted Admin denied access despite old JWT with role: admin
    {
        const testDemotedId = new mongoose.Types.ObjectId();
        User.findById = (id) => ({
            select: () => ({
                lean: async () => ({
                    _id: testDemotedId,
                    role: 'user', // Demoted in DB to regular user
                    status: 'Active',
                    restrictions: {}
                })
            })
        });

        const authMiddlewareFn = authorize(['admin', 'super_admin']);
        const { req, res } = createMockReqRes({
            user: { id: testDemotedId.toString(), role: 'admin' } // Stale token claims admin
        });

        let nextCalled = false;
        await authMiddlewareFn(req, res, () => { nextCalled = true; });

        assert(nextCalled === false, 'Demoted Admin was NOT allowed through');
        assert(res.statusCode === 403, 'Returned 403 Forbidden for demoted admin');
        assert(res.jsonResponse?.message === 'Unauthorized', 'Correct error message returned');
    }

    // Test 3.3: Blocked user denied access
    {
        const testBlockedId = new mongoose.Types.ObjectId();
        User.findById = (id) => ({
            select: () => ({
                lean: async () => ({
                    _id: testBlockedId,
                    role: 'admin',
                    status: 'Blocked', // Account blocked in DB
                    restrictions: { loginBlocked: true }
                })
            })
        });

        const authMiddlewareFn = authorize(['admin', 'super_admin']);
        const { req, res } = createMockReqRes({
            user: { id: testBlockedId.toString(), role: 'admin' }
        });

        let nextCalled = false;
        await authMiddlewareFn(req, res, () => { nextCalled = true; });

        assert(nextCalled === false, 'Blocked user was NOT allowed through');
        assert(res.statusCode === 403, 'Returned 403 for blocked account');
        assert(res.jsonResponse?.error === 'Account restricted or blocked.', 'Correct error message for blocked user');
    }

    // Test 3.4: DB Error fails closed
    {
        User.findById = () => ({
            select: () => ({
                lean: async () => { throw new Error('Database connection lost'); }
            })
        });

        const authMiddlewareFn = authorize(['admin', 'super_admin']);
        const { req, res } = createMockReqRes({
            user: { id: new mongoose.Types.ObjectId().toString(), role: 'super_admin' }
        });

        let nextCalled = false;
        await authMiddlewareFn(req, res, () => { nextCalled = true; });

        assert(nextCalled === false, 'DB error did NOT call next()');
        assert(res.statusCode === 500, 'DB error returned 500 internal server error (failed closed)');
    }

    console.log('\n--- TEST GROUP 4: ISOLATE WITHDRAWAL USER-NOTIFICATION FAILURES (FIX D) ---');
    
    // Setup Mocks for Withdrawal Flow
    const testUserId = new mongoose.Types.ObjectId();
    const testWithdrawalId = new mongoose.Types.ObjectId();
    const testTxId = new mongoose.Types.ObjectId();

    const mockUser = {
        _id: testUserId,
        username: 'testuser1',
        currency: 'USD',
        walletBalance: 1000,
        status: 'Active',
        restrictions: { withdrawal: false }
    };

    User.findById = async () => mockUser;
    User.findOneAndUpdate = async () => ({ ...mockUser, walletBalance: 900 });
    Withdrawal.findOne = () => ({ sort: () => null });
    Setting.bumpVersion = async () => true;

    let createdWithdrawal = null;
    Withdrawal.create = async (data) => {
        createdWithdrawal = {
            _id: testWithdrawalId,
            ...data,
            save: async () => true
        };
        return createdWithdrawal;
    };

    Transaction.create = async (data) => ({
        _id: testTxId,
        ...data
    });

    // Simulate Notification.create throwing an error for user in-app notification
    Notification.create = async (data) => {
        if (data.userId && data.userId.toString() === testUserId.toString() && !data.senderType) {
            throw new Error('Notification DB write timeout');
        }
        return { _id: new mongoose.Types.ObjectId() };
    };

    User.find = () => ({ select: async () => [{ _id: new mongoose.Types.ObjectId() }] });
    Notification.findOne = async () => null;

    {
        const { req, res } = createMockReqRes({
            body: {
                userId: testUserId.toString(),
                amount: 100
            },
            user: { id: testUserId.toString(), role: 'user' }
        });

        await createWithdrawal(req, res);

        assert(res.statusCode === 201, 'Withdrawal creation succeeds with HTTP 201 despite user notification failure', res.jsonResponse?.error || '');
        assert(res.jsonResponse?.success === true, 'Response JSON indicates success');
        assert(res.jsonResponse?.data?.withdrawal?._id === testWithdrawalId, 'Withdrawal record returned correctly');
        assert(createdWithdrawal.balanceBefore === 1000, 'Wallet balance before recorded correctly');
        assert(createdWithdrawal.balanceAfter === 900, 'Wallet balance after recorded correctly (debit succeeded)');
    }

    // Cleanup Mocks
    User.create = originalUserCreate;
    User.findById = originalFindById;
    User.findOne = originalUserFindOne;
    Setting.getSettings = originalSettingGetSettings;
    Notification.create = originalNotificationCreate;

    console.log(`\n=== TEST SUMMARY ===`);
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
});
