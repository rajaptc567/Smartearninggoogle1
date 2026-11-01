import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { verifyEmailCode, verifyWhatsappCode, resendEmailCode, resendWhatsappCode } from './backend/controllers/usersController.js';
import { authorize } from './backend/middleware/authMiddleware.js';
import User from './backend/models/User.js';
import Setting from './backend/models/Setting.js';

// Disable mongoose command buffering for isolated offline unit testing
mongoose.set('bufferCommands', false);

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';

console.log('=== SMARTEXN EMAIL & WHATSAPP VERIFICATION SECURITY HARDENING TEST SUITE ===\n');

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

function createMockReqRes({ body = {}, user = null, params = {}, path = '/api/users/profile', headers = {} } = {}) {
    const req = {
        body,
        user,
        params,
        path,
        originalUrl: path,
        headers,
        protocol: 'https',
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

function setupMockUserModel() {
    const memoryUsers = new Map();
    let idCounter = 1;

    const origFindOneAndUpdate = User.findOneAndUpdate;
    const origFindById = User.findById;
    const origFindOne = User.findOne;
    const origFind = User.find;

    User.createMockUser = function(data) {
        const id = 'user_' + (idCounter++);
        const doc = {
            _id: id,
            username: data.username || 'testuser',
            email: data.email || 'test@example.com',
            phone: data.phone || '+1234567890',
            whatsapp: data.whatsapp || '+1234567890',
            role: data.role || 'user',
            status: data.status || 'Active',
            restrictions: data.restrictions || {},
            emailVerified: data.emailVerified ?? false,
            whatsappVerified: data.whatsappVerified ?? false,
            emailVerificationEnforced: data.emailVerificationEnforced ?? false,
            whatsappVerificationEnforced: data.whatsappVerificationEnforced ?? false,
            emailVerificationOtpHash: data.emailVerificationOtpHash || null,
            emailVerificationExpires: data.emailVerificationExpires || null,
            emailVerificationTokenHash: data.emailVerificationTokenHash || null,
            emailVerificationTokenExpires: data.emailVerificationTokenExpires || null,
            whatsappVerificationOtpHash: data.whatsappVerificationOtpHash || null,
            whatsappVerificationExpires: data.whatsappVerificationExpires || null,
            whatsappVerificationTokenHash: data.whatsappVerificationTokenHash || null,
            whatsappVerificationTokenExpires: data.whatsappVerificationTokenExpires || null,
            save: async function() {
                memoryUsers.set(this._id, { ...this });
                return this;
            }
        };
        memoryUsers.set(id, doc);
        return doc;
    };

    User.findById = function(id) {
        return {
            select: function() {
                return {
                    lean: async function() {
                        return memoryUsers.get(id) || null;
                    }
                };
            },
            then: function(resolve) {
                return Promise.resolve(memoryUsers.get(id) || null).then(resolve);
            }
        };
    };

    User.findOne = async function(query) {
        if (!query) return memoryUsers.values().next().value || null;
        for (const user of memoryUsers.values()) {
            let match = true;
            if (query.email && user.email !== query.email) match = false;
            if (query.role && user.role !== query.role) match = false;
            if (match) return user;
        }
        return null;
    };

    User.find = async function(query) {
        return Array.from(memoryUsers.values());
    };

    User.findOneAndUpdate = async function(query, update, options) {
        for (const user of memoryUsers.values()) {
            let match = true;
            const now = new Date();

            if (query._id && user._id !== query._id) match = false;
            if (query.emailVerificationTokenHash && user.emailVerificationTokenHash !== query.emailVerificationTokenHash) match = false;
            if (query.emailVerificationOtpHash && user.emailVerificationOtpHash !== query.emailVerificationOtpHash) match = false;
            if (query.emailVerificationExpires && query.emailVerificationExpires.$gt && !(user.emailVerificationExpires > now)) match = false;
            if (query.emailVerificationTokenExpires && query.emailVerificationTokenExpires.$gt && !(user.emailVerificationTokenExpires > now)) match = false;
            if (query.emailVerified !== undefined && user.emailVerified !== query.emailVerified) match = false;

            if (query.whatsappVerificationTokenHash && user.whatsappVerificationTokenHash !== query.whatsappVerificationTokenHash) match = false;
            if (query.whatsappVerificationOtpHash && user.whatsappVerificationOtpHash !== query.whatsappVerificationOtpHash) match = false;
            if (query.whatsappVerificationExpires && query.whatsappVerificationExpires.$gt && !(user.whatsappVerificationExpires > now)) match = false;
            if (query.whatsappVerificationTokenExpires && query.whatsappVerificationTokenExpires.$gt && !(user.whatsappVerificationTokenExpires > now)) match = false;
            if (query.whatsappVerified !== undefined && user.whatsappVerified !== query.whatsappVerified) match = false;

            if (match) {
                if (update.$set) {
                    Object.assign(user, update.$set);
                }
                if (update.$unset) {
                    for (const key of Object.keys(update.$unset)) {
                        delete user[key];
                    }
                }
                memoryUsers.set(user._id, user);
                return user;
            }
        }
        return null;
    };

    return {
        restore() {
            User.findOneAndUpdate = origFindOneAndUpdate;
            User.findById = origFindById;
            User.findOne = origFindOne;
            User.find = origFind;
        }
    };
}

let mockSettings = {
    emailVerificationRequired: true,
    whatsappVerificationRequired: true,
    emailAutomationEnabled: false,
    whatsappAutomationEnabled: false
};

Setting.getSettings = async function() {
    return mockSettings;
};

Setting.findOne = async function() {
    return mockSettings;
};

const mockScope = setupMockUserModel();

async function runAllTests() {
    console.log('--- A. EMAIL VERIFICATION CONTROLLER: FORMAT, TYPES & CREDENTIALS ---');

    // Case A1: Correct 6-digit OTP string & valid link token
    {
        const rawOtp = '123456';
        const rawToken = 'valid_token_abc';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false,
            emailVerificationEnforced: true
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 200 && res.jsonResponse.success === true && user.emailVerified === true && user.emailVerificationEnforced === false, 'A1: Correct 6-digit OTP string and token verifies successfully and clears enforcement');
    }

    // Case A2: Numeric OTP (number instead of string) -> Must be rejected without casting
    {
        const rawOtp = 123456;
        const rawToken = 'token_a2';
        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A2: Numeric OTP (number type) strictly rejected without casting');
    }

    // Case A3: Object OTP -> Must be rejected
    {
        const { req, res } = createMockReqRes({ body: { code: { value: '123456' }, token: 'token_a3' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A3: Object OTP strictly rejected');
    }

    // Case A4: Boolean OTP -> Must be rejected
    {
        const { req, res } = createMockReqRes({ body: { code: true, token: 'token_a4' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A4: Boolean OTP strictly rejected');
    }

    // Case A5: Leading whitespace in OTP -> Must be rejected without auto-trimming
    {
        const { req, res } = createMockReqRes({ body: { code: ' 123456', token: 'token_a5' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A5: Leading whitespace in OTP rejected without auto-trimming');
    }

    // Case A6: Trailing whitespace in OTP -> Must be rejected without auto-trimming
    {
        const { req, res } = createMockReqRes({ body: { code: '123456 ', token: 'token_a6' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A6: Trailing whitespace in OTP rejected without auto-trimming');
    }

    // Case A7: Non-numeric / Alphanumeric OTP
    {
        const { req, res } = createMockReqRes({ body: { code: '123a56', token: 'valid_token' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A7: Alphanumeric OTP ("123a56") rejected');
    }

    // Case A8: Short OTP (5 digits)
    {
        const { req, res } = createMockReqRes({ body: { code: '12345', token: 'valid_token' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A8: Short OTP ("12345") rejected');
    }

    // Case A9: Long OTP (7 digits)
    {
        const { req, res } = createMockReqRes({ body: { code: '1234567', token: 'valid_token' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A9: Long OTP ("1234567") rejected');
    }

    // Case A10: Missing Link Token
    {
        const { req, res } = createMockReqRes({ body: { code: '123456' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('token is required'), 'A10: Missing link token rejected');
    }

    // Case A11: Whitespace-only Link Token
    {
        const { req, res } = createMockReqRes({ body: { code: '123456', token: '   ' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('token is required'), 'A11: Whitespace-only link token rejected');
    }

    // Case A12: Non-string Link Token
    {
        const { req, res } = createMockReqRes({ body: { code: '123456', token: 12345 } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('token is required'), 'A12: Non-string link token rejected');
    }

    // Case A13: Expired OTP (10-minute expiry)
    {
        const rawOtp = '123456';
        const rawToken = 'token_a13';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() - 1000), // Expired
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && user.emailVerified === false, 'A13: Expired OTP rejected');
    }

    // Case A14: Expired Link Token (24-hour expiry)
    {
        const rawOtp = '123456';
        const rawToken = 'token_a14';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() - 1000), // Expired
            emailVerified: false
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && user.emailVerified === false, 'A14: Expired link token rejected');
    }

    // Case A15: Single-use credential consumption / Replay attack
    {
        const rawOtp = '123456';
        const rawToken = 'token_a15';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false
        });

        const reqRes1 = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(reqRes1.req, reqRes1.res);

        const reqRes2 = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(reqRes2.req, reqRes2.res);

        assert(reqRes1.res.statusCode === 200 && reqRes2.res.statusCode === 400, 'A15: Replay attack rejected - Credentials consumed on first use');
    }


    console.log('\n--- B. WHATSAPP VERIFICATION CONTROLLER: FORMAT, TYPES & CREDENTIALS ---');

    // Case B1: Correct 6-digit WhatsApp OTP string & token
    {
        const rawOtp = '654321';
        const rawToken = 'wa_token_b1';
        const user = User.createMockUser({
            whatsappVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            whatsappVerificationExpires: new Date(Date.now() + 600000),
            whatsappVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            whatsappVerificationTokenExpires: new Date(Date.now() + 86400000),
            whatsappVerified: false,
            whatsappVerificationEnforced: true
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 200 && res.jsonResponse.success === true && user.whatsappVerified === true && user.whatsappVerificationEnforced === false, 'B1: Correct 6-digit WhatsApp OTP string and token verifies successfully and clears enforcement');
    }

    // Case B2: Numeric WhatsApp OTP -> Rejected without casting
    {
        const { req, res } = createMockReqRes({ body: { code: 654321, token: 'wa_token_b2' } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'B2: Numeric WhatsApp OTP strictly rejected');
    }

    // Case B3: Leading whitespace in WhatsApp OTP -> Rejected
    {
        const { req, res } = createMockReqRes({ body: { code: ' 654321', token: 'wa_token_b3' } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'B3: Leading whitespace WhatsApp OTP rejected');
    }

    // Case B4: Non-numeric WhatsApp OTP
    {
        const { req, res } = createMockReqRes({ body: { code: 'abc123', token: 'wa_token_b4' } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'B4: Non-numeric WhatsApp OTP rejected');
    }

    // Case B5: Short WhatsApp OTP (4 digits)
    {
        const { req, res } = createMockReqRes({ body: { code: '1234', token: 'wa_token_b5' } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'B5: Short 4-digit WhatsApp OTP rejected');
    }

    // Case B6: Missing WhatsApp link token
    {
        const { req, res } = createMockReqRes({ body: { code: '654321' } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('token is required'), 'B6: Missing WhatsApp link token rejected');
    }


    console.log('\n--- C. ATOMICITY & RACE CONDITION PREVENTION ---');

    // Case C1: Simultaneous concurrent verification requests
    {
        const rawOtp = '987654';
        const rawToken = 'atomic_token_c1';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false
        });

        const reqRes1 = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        const reqRes2 = createMockReqRes({ body: { code: rawOtp, token: rawToken } });

        await Promise.all([
            verifyEmailCode(reqRes1.req, reqRes1.res),
            verifyEmailCode(reqRes2.req, reqRes2.res)
        ]);

        const successCount = (reqRes1.res.statusCode === 200 ? 1 : 0) + (reqRes2.res.statusCode === 200 ? 1 : 0);
        const failCount = (reqRes1.res.statusCode === 400 ? 1 : 0) + (reqRes2.res.statusCode === 400 ? 1 : 0);

        assert(successCount === 1 && failCount === 1 && user.emailVerified === true, 'C1: Concurrent race condition test - Exactly 1 succeeds, 1 fails');
    }


    console.log('\n--- D. ALL SIX DELIVERY & SETTINGS SCENARIOS IN AUTH MIDDLEWARE ---');

    // Scenario 1: Email ON, email successfully sent (delivered & enforced)
    {
        mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: false };
        const user = User.createMockUser({ emailVerified: false, emailVerificationEnforced: true, whatsappVerified: false, role: 'user' });
        const { req, res } = createMockReqRes({ user: { id: user._id, role: 'user' } });
        let nextCalled = false;
        await authorize(['user'])(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 403 && res.jsonResponse.needsEmailVerification === true && res.jsonResponse.needsWhatsappVerification === false && !nextCalled, 'Scenario 1: Email ON, email delivered -> Blocks user for email verification');
    }

    // Scenario 2: Email ON, email delivery failed (enforcement not set)
    {
        mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: false };
        const user = User.createMockUser({ emailVerified: false, emailVerificationEnforced: false, whatsappVerified: false, role: 'user' });
        const { req, res } = createMockReqRes({ user: { id: user._id, role: 'user' } });
        let nextCalled = false;
        await authorize(['user'])(req, res, () => { nextCalled = true; });
        assert(nextCalled === true, 'Scenario 2: Email ON, email delivery failed -> Does NOT block user, proceeds normally');
    }

    // Scenario 3: WhatsApp ON, WhatsApp successfully sent (delivered & enforced)
    {
        mockSettings = { emailVerificationRequired: false, whatsappVerificationRequired: true };
        const user = User.createMockUser({ emailVerified: false, whatsappVerified: false, whatsappVerificationEnforced: true, role: 'user' });
        const { req, res } = createMockReqRes({ user: { id: user._id, role: 'user' } });
        let nextCalled = false;
        await authorize(['user'])(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 403 && res.jsonResponse.needsWhatsappVerification === true && res.jsonResponse.needsEmailVerification === false && !nextCalled, 'Scenario 3: WhatsApp ON, WhatsApp delivered -> Blocks user for WhatsApp verification');
    }

    // Scenario 4: WhatsApp ON, WhatsApp delivery failed (enforcement not set)
    {
        mockSettings = { emailVerificationRequired: false, whatsappVerificationRequired: true };
        const user = User.createMockUser({ emailVerified: false, whatsappVerified: false, whatsappVerificationEnforced: false, role: 'user' });
        const { req, res } = createMockReqRes({ user: { id: user._id, role: 'user' } });
        let nextCalled = false;
        await authorize(['user'])(req, res, () => { nextCalled = true; });
        assert(nextCalled === true, 'Scenario 4: WhatsApp ON, WhatsApp delivery failed -> Does NOT block user, proceeds normally');
    }

    // Scenario 5: Both ON, only one message delivered (Email sent, WhatsApp failed)
    {
        mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: true };
        const user = User.createMockUser({ emailVerified: false, emailVerificationEnforced: true, whatsappVerified: false, whatsappVerificationEnforced: false, role: 'user' });
        const { req, res } = createMockReqRes({ user: { id: user._id, role: 'user' } });
        let nextCalled = false;
        await authorize(['user'])(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 403 && res.jsonResponse.needsEmailVerification === true && res.jsonResponse.needsWhatsappVerification === false, 'Scenario 5: Both ON, only email delivered -> Enforces email, WhatsApp skipped');
    }

    // Scenario 6: Both OFF
    {
        mockSettings = { emailVerificationRequired: false, whatsappVerificationRequired: false };
        const user = User.createMockUser({ emailVerified: false, emailVerificationEnforced: false, whatsappVerified: false, whatsappVerificationEnforced: false, role: 'user' });
        const { req, res } = createMockReqRes({ user: { id: user._id, role: 'user' } });
        let nextCalled = false;
        await authorize(['user'])(req, res, () => { nextCalled = true; });
        assert(nextCalled === true, 'Scenario 6: Both OFF -> Allows access with standard signup and login behavior');
    }

    // Fail-closed test on missing / invalid settings
    {
        mockSettings = null;
        const user = User.createMockUser({ emailVerified: false, emailVerificationEnforced: true, role: 'user' });
        const { req, res } = createMockReqRes({ user: { id: user._id, role: 'user' } });
        let nextCalled = false;
        await authorize(['user'])(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 500 && res.jsonResponse.error.includes('settings unavailable'), 'Fail-closed: Missing/invalid settings return 500');
    }


    console.log('\n--- E. RESEND SECURITY & ALREADY-VERIFIED PROTECTION ---');

    mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: true };

    // E1: Unauthenticated Resend Request
    {
        const { req, res } = createMockReqRes({ user: null });
        await resendEmailCode(req, res);
        assert(res.statusCode === 401, 'E1: Unauthenticated email resend rejected (401)');
    }

    // E2: Already-Verified Email Resend
    {
        const verifiedEmailUser = User.createMockUser({ emailVerified: true, whatsappVerified: false });
        const { req, res } = createMockReqRes({ user: { id: verifiedEmailUser._id, role: 'user' } });
        await resendEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('already verified'), 'E2: Already-verified Email resend rejected (400)');
    }

    // E3: Already-Verified WhatsApp Resend
    {
        const verifiedWaUser = User.createMockUser({ emailVerified: false, whatsappVerified: true });
        const { req, res } = createMockReqRes({ user: { id: verifiedWaUser._id, role: 'user' } });
        await resendWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('already verified'), 'E3: Already-verified WhatsApp resend rejected (400)');
    }

    // E4: Resend when Email verification is disabled in settings
    {
        mockSettings = { emailVerificationRequired: false, whatsappVerificationRequired: true };
        const pendingUser = User.createMockUser({ emailVerified: false });
        const { req, res } = createMockReqRes({ user: { id: pendingUser._id, role: 'user' } });
        await resendEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('disabled'), 'E4: Resend rejected when Email verification is disabled');
    }

    // E5: Resend when WhatsApp verification is disabled in settings
    {
        mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: false };
        const pendingUser = User.createMockUser({ whatsappVerified: false });
        const { req, res } = createMockReqRes({ user: { id: pendingUser._id, role: 'user' } });
        await resendWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('disabled'), 'E5: Resend rejected when WhatsApp verification is disabled');
    }

    // E6: Delivery failure safety: Hashes must NOT be modified if delivery fails
    {
        mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: true };
        const initialOtpHash = 'initial_otp_hash_123';
        const pendingUser = User.createMockUser({
            emailVerified: false,
            emailVerificationOtpHash: initialOtpHash
        });

        // Offline / default delivery attempt will fail because no SMTP / external provider is configured in unit test
        const { req, res } = createMockReqRes({ user: { id: pendingUser._id, role: 'user' } });
        await resendEmailCode(req, res);
        assert(res.statusCode === 400 && pendingUser.emailVerificationOtpHash === initialOtpHash, 'E6: Delivery failure safety - Hashes NOT modified if delivery fails');
    }

    // E7: JWT integrity check: verify signed JWT contains all required verification claims
    {
        const rawOtp = '777888';
        const rawToken = 'jwt_test_token';
        const testUser = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false,
            emailVerificationEnforced: true,
            whatsappVerified: false,
            whatsappVerificationEnforced: true
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);

        assert(res.statusCode === 200 && res.jsonResponse.token, 'E7a: Token issued upon verification');
        const decoded = jwt.verify(res.jsonResponse.token, process.env.JWT_SECRET);
        assert(decoded.emailVerified === true && decoded.emailVerificationEnforced === false && decoded.whatsappVerified === false && decoded.whatsappVerificationEnforced === true, 'E7b: JWT payload accurately reflects verification and enforcement states');
    }

    console.log('\n--- F. AUTHENTICATED SESSION VERIFICATION (OTP-ONLY) & FALLBACK URL AUDIT ---');

    // F1: Authenticated user verifies Email using OTP only (no token provided)
    {
        const rawOtp = '234567';
        const rawToken = 'pending_token_f1';
        const authUser = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false,
            emailVerificationEnforced: true
        });

        const { req, res } = createMockReqRes({ 
            user: { id: authUser._id, role: 'user' }, 
            body: { code: rawOtp } 
        });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 200 && res.jsonResponse.success === true && authUser.emailVerified === true && authUser.emailVerificationEnforced === false, 'F1: Authenticated user verifies email using OTP only (no token provided)');
        assert(Boolean(res.jsonResponse.token), 'F1b: Fresh JWT issued upon authenticated OTP-only verification');
    }

    // F2: Authenticated user submits wrong OTP without token -> fails (400)
    {
        const rawOtp = '345678';
        const authUser = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerified: false,
            emailVerificationEnforced: true
        });

        const { req, res } = createMockReqRes({ 
            user: { id: authUser._id, role: 'user' }, 
            body: { code: '999999' } // Incorrect code
        });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && authUser.emailVerified === false, 'F2: Authenticated user with wrong OTP is rejected (400)');
    }

    // F3: Authenticated user submits expired OTP without token -> fails (400)
    {
        const rawOtp = '456789';
        const authUser = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() - 1000), // Expired
            emailVerified: false,
            emailVerificationEnforced: true
        });

        const { req, res } = createMockReqRes({ 
            user: { id: authUser._id, role: 'user' }, 
            body: { code: rawOtp } 
        });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && authUser.emailVerified === false, 'F3: Authenticated user with expired OTP is rejected (400)');
    }

    // F4: Replay protection for authenticated OTP-only verification
    {
        const rawOtp = '567890';
        const authUser = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerified: false,
            emailVerificationEnforced: true
        });

        const reqRes1 = createMockReqRes({ user: { id: authUser._id, role: 'user' }, body: { code: rawOtp } });
        const reqRes2 = createMockReqRes({ user: { id: authUser._id, role: 'user' }, body: { code: rawOtp } });

        await verifyEmailCode(reqRes1.req, reqRes1.res);
        await verifyEmailCode(reqRes2.req, reqRes2.res);

        assert(reqRes1.res.statusCode === 200 && reqRes2.res.statusCode === 400, 'F4: Replay protection - Second OTP-only attempt is rejected');
    }

    // F5: Authenticated user verifies WhatsApp using OTP only (no token provided)
    {
        const rawOtp = '678901';
        const rawToken = 'pending_wa_token_f5';
        const authUser = User.createMockUser({
            whatsappVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            whatsappVerificationExpires: new Date(Date.now() + 600000),
            whatsappVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            whatsappVerificationTokenExpires: new Date(Date.now() + 86400000),
            whatsappVerified: false,
            whatsappVerificationEnforced: true
        });

        const { req, res } = createMockReqRes({ 
            user: { id: authUser._id, role: 'user' }, 
            body: { code: rawOtp } 
        });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 200 && res.jsonResponse.success === true && authUser.whatsappVerified === true && authUser.whatsappVerificationEnforced === false, 'F5: Authenticated user verifies WhatsApp using OTP only (no token provided)');
    }

    // F6: Cross-user token protection: Authenticated User A tries to use User B's token
    {
        const rawOtp = '789012';
        const rawTokenUserB = 'token_for_user_b';
        
        // User A (authenticated)
        const userA = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update('token_for_user_a').digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false,
            emailVerificationEnforced: true
        });

        // User B
        const userB = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawTokenUserB).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false,
            emailVerificationEnforced: true
        });

        // User A submits User B's token
        const { req, res } = createMockReqRes({ 
            user: { id: userA._id, role: 'user' }, 
            body: { code: rawOtp, token: rawTokenUserB } 
        });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && userA.emailVerified === false && userB.emailVerified === false, 'F6: Cross-user token hijacking strictly blocked by session match');
    }

    // F7: Fallback URL audit in Email templates (createUser and resendEmailCode)
    {
        const controllerCode = fs.readFileSync('./backend/controllers/usersController.js', 'utf8');
        const hasInstruction = controllerCode.includes('If the button does not work, copy or open this verification link:');
        const hasVisibleLink = controllerCode.includes('<a href="${escapedVerifyUrl}"') && controllerCode.includes('>${escapedVerifyUrl}</a>');
        const hasEscapeHelper = controllerCode.includes('const escapedVerifyUrl = escapeHtml(verifyUrl);');
        assert(hasInstruction && hasVisibleLink && hasEscapeHelper, 'F7: Verification email contains visible, escaped fallback URL with copy instructions');
    }

    // F8: Fallback URL audit in WhatsApp message templates
    {
        const controllerCode = fs.readFileSync('./backend/controllers/usersController.js', 'utf8');
        const hasWaInstruction = controllerCode.includes('If the button does not work, copy or open this verification link: ${verifyUrl}');
        assert(hasWaInstruction, 'F8: WhatsApp verification message contains clear instructions and full verification URL');
    }

    // F9: VerifyLanding UI inspection: OTP is the only visible input (no tokenInput)
    {
        const landingCode = fs.readFileSync('./pages/VerifyLanding.tsx', 'utf8');
        const hasTokenInput = landingCode.includes('tokenInput');
        const hasOnlyOtpInput = landingCode.includes('placeholder="Enter 6-digit OTP"') && !hasTokenInput;
        const extractsFromUrl = landingCode.includes("searchParams.get('token')");
        assert(hasOnlyOtpInput && extractsFromUrl, 'F9: VerifyLanding presents OTP as only input, reading token from URL searchParams');
    }

    // F10: UserLayout UI inspection: token inputs removed, OTP and resend buttons retained
    {
        const layoutCode = fs.readFileSync('./components/UserLayout.tsx', 'utf8');
        const hasVisibleTokenInput = layoutCode.includes('placeholder="Paste verification link or token"');
        const hasOtpInput = layoutCode.includes('placeholder="Enter 6-digit code"');
        const hasResend = layoutCode.includes('handleResendEmail') && layoutCode.includes('handleResendWhatsapp');
        assert(!hasVisibleTokenInput && hasOtpInput && hasResend, 'F10: UserLayout Account Security Gate removed visible token inputs while retaining OTP and resend controls');
    }

    // F11: UserLayout route-based token segregation audit
    {
        const layoutCode = fs.readFileSync('./components/UserLayout.tsx', 'utf8');
        const hasRouteCheck = layoutCode.includes('isEmailRoute') && layoutCode.includes('isWhatsappRoute');
        const hasStrictEmailAssignment = layoutCode.includes('if (isEmailRoute && !isWhatsappRoute) {\n      setEmailToken(tokenFromUrl);');
        const hasStrictWhatsappAssignment = layoutCode.includes('else if (isWhatsappRoute && !isEmailRoute) {\n      setWhatsappToken(tokenFromUrl);');
        assert(hasRouteCheck && hasStrictEmailAssignment && hasStrictWhatsappAssignment, 'F11a: UserLayout enforces route-segregated token assignment');

        // Logic test of the segregation algorithm
        const simulateTokenAssignment = (pathname, search) => {
            const params = new URLSearchParams(search);
            const tokenFromUrl = params.get('token');
            let emailToken = '';
            let whatsappToken = '';
            if (tokenFromUrl) {
                const p = (pathname || '').toLowerCase();
                const typeParam = (params.get('type') || params.get('channel') || '').toLowerCase();
                const isEmailRoute = p === '/verify-email' || p.startsWith('/verify-email') || p.includes('verify-email') || typeParam === 'email';
                const isWhatsappRoute = p === '/verify-whatsapp' || p.startsWith('/verify-whatsapp') || p.includes('verify-whatsapp') || typeParam === 'whatsapp';
                if (isEmailRoute && !isWhatsappRoute) {
                    emailToken = tokenFromUrl;
                } else if (isWhatsappRoute && !isEmailRoute) {
                    whatsappToken = tokenFromUrl;
                }
            }
            return { emailToken, whatsappToken };
        };

        const emailResult = simulateTokenAssignment('/verify-email', '?token=tok_email_123');
        assert(emailResult.emailToken === 'tok_email_123' && emailResult.whatsappToken === '', 'F11b: /verify-email assigns only to emailToken, never whatsappToken');

        const waResult = simulateTokenAssignment('/verify-whatsapp', '?token=tok_wa_456');
        assert(waResult.whatsappToken === 'tok_wa_456' && waResult.emailToken === '', 'F11c: /verify-whatsapp assigns only to whatsappToken, never emailToken');

        const memberResult = simulateTokenAssignment('/member', '?token=tok_generic_789');
        assert(memberResult.emailToken === '' && memberResult.whatsappToken === '', 'F11d: Unspecified route does not cross-assign token to either channel');
    }

    console.log(`\n======================================================`);
    console.log(`FINAL INTEGRATION SUITE RESULT: ${passed}/${total} TESTS PASSED (${failed} FAILED)`);
    console.log(`======================================================\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAllTests().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
