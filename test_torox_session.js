import assert from 'assert';
import crypto from 'crypto';
import { createToroxSession, verifySignature } from './backend/controllers/postbackController.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';

console.log('Running Focused Torox Server-Authenticated Session & Postback Tests...');

// Mock helper to capture response
const createMockRes = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(data) {
        this.body = data;
        return this;
    },
    send(data) {
        this.body = data;
        return this;
    }
});

// Test 1: Unauthenticated request must be rejected with 401
{
    const req = { user: null };
    const res = createMockRes();
    await createToroxSession(req, res);
    assert.strictEqual(res.statusCode, 401, 'Test 1 failed: Expected status 401 for unauthenticated request');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Authentication required');
    console.log('✓ Test 1 Passed: Unauthenticated request rejected with HTTP 401.');
}

// Test 2: Disabled Torox provider must be rejected with 400
{
    const originalFindOne = OfferwallProvider.findOne;
    OfferwallProvider.findOne = async () => ({
        providerKey: 'torox',
        enabled: false,
        status: 'NOT_STARTED',
        approvalStatus: 'Pending',
        appId: '',
        secretKey: ''
    });

    try {
        const req = { user: { id: 'auth_user_123', role: 'user' } };
        const res = createMockRes();
        await createToroxSession(req, res);
        assert.strictEqual(res.statusCode, 400, 'Test 2 failed: Expected status 400 for disabled Torox');
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, 'Torox offerwall is currently disabled');
        console.log('✓ Test 2 Passed: Disabled Torox provider rejected with HTTP 400.');
    } finally {
        OfferwallProvider.findOne = originalFindOne;
    }
}

// Test 3: Unapproved Torox provider (Pending) must be rejected with 400
{
    const originalFindOne = OfferwallProvider.findOne;
    OfferwallProvider.findOne = async () => ({
        providerKey: 'torox',
        enabled: true,
        status: 'ACTIVE',
        approvalStatus: 'Pending',
        appId: '12345',
        secretKey: 'my_secret'
    });

    try {
        const req = { user: { id: 'auth_user_123', role: 'user' } };
        const res = createMockRes();
        await createToroxSession(req, res);
        assert.strictEqual(res.statusCode, 400, 'Test 3 failed: Expected status 400 for unapproved Torox');
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, 'Torox integration is pending publisher approval and not active for production use');
        console.log('✓ Test 3 Passed: Unapproved Torox provider rejected with HTTP 400.');
    } finally {
        OfferwallProvider.findOne = originalFindOne;
    }
}

// Test 4: Approved & enabled Torox with missing credentials must be rejected with 400
{
    const originalFindOne = OfferwallProvider.findOne;
    OfferwallProvider.findOne = async () => ({
        providerKey: 'torox',
        enabled: true,
        status: 'ACTIVE',
        approvalStatus: 'Approved',
        appId: '', // Missing placement ID
        secretKey: '' // Missing token
    });

    try {
        const req = { user: { id: 'auth_user_123', role: 'user' } };
        const res = createMockRes();
        await createToroxSession(req, res);
        assert.strictEqual(res.statusCode, 400, 'Test 4 failed: Expected status 400 for missing credentials');
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, 'Torox credentials (placement_id or token) are missing or incomplete');
        console.log('✓ Test 4 Passed: Missing Torox credentials rejected safely with HTTP 400.');
    } finally {
        OfferwallProvider.findOne = originalFindOne;
    }
}

// Test 5: Client-supplied user ID is ignored; server-authenticated req.user.id is strictly used
{
    const originalFindOne = OfferwallProvider.findOne;
    const originalFetch = global.fetch;

    OfferwallProvider.findOne = async () => ({
        providerKey: 'torox',
        enabled: true,
        status: 'ACTIVE',
        approvalStatus: 'Approved',
        appId: 'placement_999',
        secretKey: 'secret_token_abc'
    });

    let capturedUrl = '';
    let capturedBody = null;

    global.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                wall_url: 'https://api.wall.torox.io/offerwall?session=valid_session_123'
            })
        };
    };

    try {
        // Attacker attempts to pass a different UID in body/query
        const req = {
            user: { id: 'trusted_server_user_888', role: 'user' },
            body: { player: { uid: 'spoofed_user_999' }, userId: 'spoofed_user_999' },
            query: { uid: 'spoofed_user_999' }
        };
        const res = createMockRes();
        await createToroxSession(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(capturedBody.player.uid, 'trusted_server_user_888', 'UID must come from authenticated req.user.id');
        assert.notStrictEqual(capturedBody.player.uid, 'spoofed_user_999', 'Client-supplied UID must never be trusted');
        assert.ok(capturedUrl.includes('placement_id=placement_999'));
        assert.ok(capturedUrl.includes('token=secret_token_abc'));
        console.log('✓ Test 5 Passed: Client-supplied user IDs not trusted; server-side identity enforced.');
    } finally {
        OfferwallProvider.findOne = originalFindOne;
        global.fetch = originalFetch;
    }
}

// Test 6: Successful session creation returns only wall_url and no secrets
{
    const originalFindOne = OfferwallProvider.findOne;
    const originalFetch = global.fetch;

    OfferwallProvider.findOne = async () => ({
        providerKey: 'torox',
        enabled: true,
        status: 'PRODUCTION_READY',
        approvalStatus: 'Approved',
        appId: 'prod_placement_777',
        secretKey: 'super_secret_token_xyz'
    });

    global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            ok: true,
            wall_url: 'https://api.wall.torox.io/offerwall?session=secure_session_token_777'
        })
    });

    try {
        const req = { user: { id: 'worker_555', role: 'user' } };
        const res = createMockRes();
        await createToroxSession(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.wall_url, 'https://api.wall.torox.io/offerwall?session=secure_session_token_777');
        assert.strictEqual(res.body.token, undefined, 'Secret token must never be exposed');
        assert.strictEqual(res.body.secretKey, undefined, 'Secret key must never be exposed');
        assert.strictEqual(res.body.placement_id, undefined, 'Internal credentials must not be returned');
        console.log('✓ Test 6 Passed: Successful session returns strictly wall_url with zero secrets exposed.');
    } finally {
        OfferwallProvider.findOne = originalFindOne;
        global.fetch = originalFetch;
    }
}

// Test 7: Torox API errors and malformed responses handled safely (HTTP 502)
{
    const originalFindOne = OfferwallProvider.findOne;
    const originalFetch = global.fetch;

    OfferwallProvider.findOne = async () => ({
        providerKey: 'torox',
        enabled: true,
        status: 'ACTIVE',
        approvalStatus: 'Approved',
        appId: 'placement_err',
        secretKey: 'secret_err'
    });

    // Subcase 7a: Torox returns ok: false
    global.fetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({
            ok: false,
            error: 'Invalid placement_id or token'
        })
    });

    try {
        const req = { user: { id: 'worker_err', role: 'user' } };
        const res = createMockRes();
        await createToroxSession(req, res);

        assert.strictEqual(res.statusCode, 502);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, 'Invalid placement_id or token');

        // Subcase 7b: Torox returns non-JSON or HTML error page
        global.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => { throw new Error('Unexpected token < in JSON at position 0'); }
        });

        const res2 = createMockRes();
        await createToroxSession(req, res2);
        assert.strictEqual(res2.statusCode, 502);
        assert.strictEqual(res2.body.success, false);
        assert.strictEqual(res2.body.error, 'Malformed response received from Torox session API');
        console.log('✓ Test 7 Passed: Torox API errors and malformed responses handled safely.');
    } finally {
        OfferwallProvider.findOne = originalFindOne;
        global.fetch = originalFetch;
    }
}

// Test 8: Existing Torox postback signature verification and reversal formula unchanged
{
    const placementKey = 'torox_postback_placement_secret';
    const toroxProvider = {
        providerKey: 'torox',
        requireSignature: true,
        signatureType: 'md5',
        secretKey: placementKey
    };

    const oid = 'offer_888';
    const userId = 'user_777';
    const validSig = crypto.createHash('md5').update(`${oid}-${userId}-${placementKey}`).digest('hex');

    // Valid signature
    const validResult = verifySignature(toroxProvider, { oid, user_id: userId, sig: validSig }, '127.0.0.1');
    assert.strictEqual(validResult.valid, true, 'Valid Torox signature must pass');

    // Invalid signature
    const invalidResult = verifySignature(toroxProvider, { oid, user_id: userId, sig: 'tampered_hash' }, '127.0.0.1');
    assert.strictEqual(invalidResult.valid, false, 'Tampered Torox signature must fail');
    assert.strictEqual(invalidResult.error, 'Torox signature mismatch');

    // Missing signature
    const missingResult = verifySignature(toroxProvider, { oid, user_id: userId }, '127.0.0.1');
    assert.strictEqual(missingResult.valid, false, 'Missing Torox signature must fail');
    assert.strictEqual(missingResult.error, 'Torox signature missing');

    console.log('✓ Test 8 Passed: Existing Torox postback signature formula md5(oid-user_id-secret) unchanged.');
}

console.log('======================================================');
console.log('All 8 Focused Torox Session & Postback Tests Passed!');
console.log('======================================================');
