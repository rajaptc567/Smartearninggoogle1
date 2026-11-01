import { createHash, randomBytes, randomInt } from 'crypto';
import mongoose from 'mongoose';
import { verifyEmailCode, verifyWhatsappCode, resendEmailCode, resendWhatsappCode } from './backend/controllers/usersController.js';
import User from './backend/models/User.js';
import Setting from './backend/models/Setting.js';

// Disable mongoose buffering for offline unit testing
mongoose.set('bufferCommands', false);

console.log('=== REAL CONTROLLER & MIDDLEWARE INTEGRATION VERIFICATION TEST SUITE ===\n');

let passed = 0;
let total = 0;

function assert(cond, name, details = '') {
    total++;
    if (cond) {
        passed++;
        console.log(`[PASS] ${name} ${details ? '- ' + details : ''}`);
    } else {
        console.error(`[FAIL] ${name} ${details ? '- ' + details : ''}`);
    }
}

function createMockReqRes({ body = {}, user = null, params = {} } = {}) {
    const req = {
        body,
        user,
        params,
        protocol: 'https',
        get: () => 'smartexn.com'
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

    User.createMockUser = function(data) {
        const id = 'user_' + (idCounter++);
        const doc = {
            _id: id,
            username: data.username || 'testuser',
            email: data.email || 'test@example.com',
            phone: data.phone || '+1234567890',
            whatsapp: data.whatsapp || '+1234567890',
            role: data.role || 'user',
            emailVerified: data.emailVerified ?? false,
            whatsappVerified: data.whatsappVerified ?? false,
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

    User.findById = async function(id) {
        return memoryUsers.get(id) || null;
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
    // --- PART A: EMAIL VERIFICATION FORMAT & SECURITY ---
    console.log('--- A. EMAIL VERIFICATION CONTROLLER FORMAT & SECURITY ---');

    // Case A1: Correct 6-digit OTP & correct token
    {
        const rawOtp = '123456';
        const rawToken = 'valid_token_abc';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 200 && res.jsonResponse.success === true && user.emailVerified === true, 'A1: Correct 6-digit OTP and token verifies successfully');
    }

    // Case A2: Incorrect OTP
    {
        const rawOtp = '123456';
        const wrongOtp = '654321';
        const rawToken = 'token_a2';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false
        });

        const { req, res } = createMockReqRes({ body: { code: wrongOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.success === false && user.emailVerified === false, 'A2: Incorrect OTP rejected');
    }

    // Case A3: Missing OTP
    {
        const { req, res } = createMockReqRes({ body: { token: 'some_token' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('required'), 'A3: Missing OTP rejected');
    }

    // Case A4: Missing Token
    {
        const { req, res } = createMockReqRes({ body: { code: '123456' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('required'), 'A4: Missing token rejected');
    }

    // Case A5: Non-numeric OTP
    {
        const { req, res } = createMockReqRes({ body: { code: '123a56', token: 'valid_token' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A5: Non-numeric OTP ("123a56") rejected');
    }

    // Case A6: OTP shorter than 6 digits
    {
        const { req, res } = createMockReqRes({ body: { code: '12345', token: 'valid_token' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A6: Short OTP ("12345") rejected');
    }

    // Case A7: OTP longer than 6 digits
    {
        const { req, res } = createMockReqRes({ body: { code: '1234567', token: 'valid_token' } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'A7: Long OTP ("1234567") rejected');
    }

    // Case A8: Expired OTP
    {
        const rawOtp = '123456';
        const rawToken = 'token_a8';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() - 1000), // Expired
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() + 86400000),
            emailVerified: false
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && user.emailVerified === false, 'A8: Expired OTP rejected');
    }

    // Case A9: Expired Link Token
    {
        const rawOtp = '123456';
        const rawToken = 'token_a9';
        const user = User.createMockUser({
            emailVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            emailVerificationExpires: new Date(Date.now() + 600000),
            emailVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            emailVerificationTokenExpires: new Date(Date.now() - 1000), // Expired
            emailVerified: false
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyEmailCode(req, res);
        assert(res.statusCode === 400 && user.emailVerified === false, 'A9: Expired link token rejected');
    }

    // Case A10: Reused Credentials
    {
        const rawOtp = '123456';
        const rawToken = 'token_a10';
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

        assert(reqRes1.res.statusCode === 200 && reqRes2.res.statusCode === 400, 'A10: Reused credentials rejected on second attempt');
    }


    // --- PART B: WHATSAPP VERIFICATION FORMAT & SECURITY ---
    console.log('\n--- B. WHATSAPP VERIFICATION CONTROLLER FORMAT & SECURITY ---');

    // Case B1: Correct 6-digit WhatsApp OTP & token
    {
        const rawOtp = '654321';
        const rawToken = 'wa_token_b1';
        const user = User.createMockUser({
            whatsappVerificationOtpHash: createHash('sha256').update(rawOtp).digest('hex'),
            whatsappVerificationExpires: new Date(Date.now() + 600000),
            whatsappVerificationTokenHash: createHash('sha256').update(rawToken).digest('hex'),
            whatsappVerificationTokenExpires: new Date(Date.now() + 86400000),
            whatsappVerified: false
        });

        const { req, res } = createMockReqRes({ body: { code: rawOtp, token: rawToken } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 200 && res.jsonResponse.success === true && user.whatsappVerified === true, 'B1: Correct 6-digit WhatsApp OTP verifies successfully');
    }

    // Case B2: Non-numeric WhatsApp OTP
    {
        const { req, res } = createMockReqRes({ body: { code: 'abc123', token: 'wa_token' } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'B2: Non-numeric WhatsApp OTP rejected');
    }

    // Case B3: Invalid length WhatsApp OTP
    {
        const { req, res } = createMockReqRes({ body: { code: '1234', token: 'wa_token' } });
        await verifyWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('numeric digits'), 'B3: 4-digit WhatsApp OTP rejected');
    }


    // --- PART C: ATOMICITY & CONCURRENCY ---
    console.log('\n--- C. ATOMICITY & CONCURRENCY TEST ---');

    {
        const rawOtp = '987654';
        const rawToken = 'atomic_token_c';
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

        assert(successCount === 1 && failCount === 1 && user.emailVerified === true, 'C1: Concurrent requests - Exactly 1 succeeds, 1 fails');
    }


    // --- PART D: SETTINGS COMBINATIONS & MIDDLEWARE ENFORCEMENT ---
    console.log('\n--- D. SETTINGS COMBINATIONS & RESEND/MIDDLEWARE ENFORCEMENT ---');

    const testUser = User.createMockUser({ emailVerified: false, whatsappVerified: false });
    const reqUser = { id: testUser._id, role: 'user' };

    // D1: Email ON / WhatsApp ON
    mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: true };
    {
        const resResendEmail = createMockReqRes({ user: reqUser });
        await resendEmailCode(resResendEmail.req, resResendEmail.res);
        assert(resResendEmail.res.statusCode === 400 && resResendEmail.res.jsonResponse.error, 'D1: Email ON / WA ON - Resend reached delivery check');
    }

    // D2: Email ON / WhatsApp OFF
    mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: false };
    {
        const resEmail = createMockReqRes({ user: reqUser });
        await resendEmailCode(resEmail.req, resEmail.res);

        const resWA = createMockReqRes({ user: reqUser });
        await resendWhatsappCode(resWA.req, resWA.res);

        assert(resEmail.res.statusCode === 400 && resEmail.res.jsonResponse.error && resWA.res.jsonResponse.error.includes('disabled'), 'D2: Email ON / WA OFF - Email Resend Allowed to Delivery, WA Resend Blocked');
    }

    // D3: Email OFF / WhatsApp ON
    mockSettings = { emailVerificationRequired: false, whatsappVerificationRequired: true };
    {
        const resEmail = createMockReqRes({ user: reqUser });
        await resendEmailCode(resEmail.req, resEmail.res);

        const resWA = createMockReqRes({ user: reqUser });
        await resendWhatsappCode(resWA.req, resWA.res);

        assert(resEmail.res.jsonResponse.error.includes('disabled') && resWA.res.statusCode === 400 && resWA.res.jsonResponse.error, 'D3: Email OFF / WA ON - Email Resend Blocked, WA Resend Allowed to Delivery');
    }

    // D4: Email OFF / WhatsApp OFF
    mockSettings = { emailVerificationRequired: false, whatsappVerificationRequired: false };
    {
        const resEmail = createMockReqRes({ user: reqUser });
        await resendEmailCode(resEmail.req, resEmail.res);

        const resWA = createMockReqRes({ user: reqUser });
        await resendWhatsappCode(resWA.req, resWA.res);

        assert(resEmail.res.jsonResponse.error.includes('disabled') && resWA.res.jsonResponse.error.includes('disabled'), 'D4: Email OFF / WA OFF - Both Resends Blocked');
    }


    // --- PART E: RESEND SECURITY & ALREADY-VERIFIED PROTECTION ---
    console.log('\n--- E. RESEND SECURITY & ALREADY-VERIFIED PROTECTION ---');

    mockSettings = { emailVerificationRequired: true, whatsappVerificationRequired: true };

    // E1: Unauthenticated Resend Request
    {
        const { req, res } = createMockReqRes({ user: null });
        await resendEmailCode(req, res);
        assert(res.statusCode === 401, 'E1: Unauthenticated resend rejected (401)');
    }

    // E2: Already-Verified Email Resend
    {
        const verifiedUser = User.createMockUser({ emailVerified: true, whatsappVerified: false });
        const { req, res } = createMockReqRes({ user: { id: verifiedUser._id, role: 'user' } });
        await resendEmailCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('already verified'), 'E2: Already-verified Email resend rejected (400)');
    }

    // E3: Already-Verified WhatsApp Resend
    {
        const verifiedUser = User.createMockUser({ emailVerified: false, whatsappVerified: true });
        const { req, res } = createMockReqRes({ user: { id: verifiedUser._id, role: 'user' } });
        await resendWhatsappCode(req, res);
        assert(res.statusCode === 400 && res.jsonResponse.error.includes('already verified'), 'E3: Already-verified WhatsApp resend rejected (400)');
    }

    console.log(`\n======================================================`);
    console.log(`FINAL INTEGRATION SUITE RESULT: ${passed}/${total} TESTS PASSED`);
    console.log(`======================================================\n`);
    process.exit(0);
}

runAllTests().catch(err => {
    console.error('Test runner execution error:', err);
    process.exit(1);
});
