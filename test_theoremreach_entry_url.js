import assert from 'assert';
import crypto from 'crypto';
import { 
    constructTheoremReachEntryUrl, 
    getOfferwallProviders, 
    updateOfferwallProvider,
    handlePostback 
} from './backend/controllers/postbackController.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';

console.log('========================================================================');
console.log('Running Focused TheoremReach Entry Link & API Key Security Tests');
console.log('========================================================================\n');

async function runTests() {
    // -------------------------------------------------------------------------
    // Test 1: API Key and Secret Key are stored and updated separately in OfferwallProvider
    // -------------------------------------------------------------------------
    console.log('Test 1: API Key and Secret Key stored and updated separately...');
    const mockDb = new Map();
    const origFindOneAndUpdate = OfferwallProvider.findOneAndUpdate;
    const origFind = OfferwallProvider.find;

    OfferwallProvider.findOneAndUpdate = async (filter, update) => {
        const key = filter.providerKey;
        const existing = mockDb.get(key) || { providerKey: key };
        const merged = { ...existing, ...update.$set };
        mockDb.set(key, merged);
        return merged;
    };

    const updateReq = {
        params: { providerKey: 'theoremreach' },
        body: {
            apiKey: 'th_live_api_key_abc123',
            appId: 'placement_456',
            secretKey: 'th_sec_key_xyz789'
        },
        user: { role: 'admin' }
    };
    const updateRes = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.data = data; return this; }
    };

    await updateOfferwallProvider(updateReq, updateRes);
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.data.success, true);
    assert.equal(updateRes.data.data.apiKey, 'th_live_api_key_abc123');
    assert.equal(updateRes.data.data.appId, 'placement_456');
    assert.equal(updateRes.data.data.secretKey, 'th_sec_key_xyz789');
    assert.notEqual(updateRes.data.data.apiKey, updateRes.data.data.secretKey, 'API Key and Secret Key must be distinct');
    console.log('✓ Passed Test 1: API Key, App ID, and Secret Key stored separately via admin update.\n');

    // -------------------------------------------------------------------------
    // Test 2: Public provider response strictly redacts apiKey, secretKey, and appId
    // -------------------------------------------------------------------------
    console.log('Test 2: Public provider response strictly redacts apiKey, secretKey, appId...');
    OfferwallProvider.find = (filter, projection) => {
        return {
            sort() {
                const sampleProvider = {
                    providerKey: 'theoremreach',
                    name: 'TheoremReach',
                    category: 'survey',
                    group: 'Group B: Survey Routers',
                    enabled: true,
                    status: 'ACTIVE',
                    appId: 'placement_456',
                    apiKey: 'th_live_api_key_abc123',
                    secretKey: 'th_sec_key_xyz789',
                    postbackKey: 'th_sec_key_xyz789',
                    requireSignature: true,
                    signatureType: 'hmac_sha1',
                    exchangeRateMultiplier: 1.0,
                    iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={apiKey}&user_id={userId}',
                    toObject() { return { ...this }; }
                };
                return [sampleProvider];
            }
        };
    };

    const publicReq = {
        user: { id: 'user_member_777', role: 'user' }
    };
    const publicRes = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.data = data; return this; }
    };

    await getOfferwallProviders(publicReq, publicRes);
    assert.equal(publicRes.statusCode, 200);
    assert.equal(publicRes.data.success, true);
    assert.equal(publicRes.data.count, 1);

    const publicTr = publicRes.data.data[0];
    assert.equal(publicTr.apiKey, undefined, 'apiKey must NEVER be exposed in public response');
    assert.equal(publicTr.secretKey, undefined, 'secretKey must NEVER be exposed in public response');
    assert.equal(publicTr.appId, undefined, 'appId must NEVER be exposed in public response');
    assert.equal(publicTr.postbackKey, undefined, 'postbackKey must NEVER be exposed in public response');
    assert.ok(publicTr.iframeUrl, 'iframeUrl must be populated for authenticated user');
    console.log('✓ Passed Test 2: Sensitive keys strictly stripped from public API response.\n');

    // -------------------------------------------------------------------------
    // Test 3: Correct TheoremReach URL macro substitution with dedicated apiKey
    // -------------------------------------------------------------------------
    console.log('Test 3: Correct TheoremReach URL macro substitution with dedicated apiKey...');
    const testProv = {
        providerKey: 'theoremreach',
        apiKey: 'TR_API_KEY_9999',
        appId: 'PLACEMENT_ID_8888',
        secretKey: 'TR_SECRET_7777',
        requireSignature: true,
        exchangeRateMultiplier: 100,
        iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={apiKey}&user_id={userId}&partner_id={partner_id}&exchange_rate={exchange_rate}'
    };

    const res3 = constructTheoremReachEntryUrl(testProv, 'user_654321');
    assert.equal(res3.error, null);
    assert.ok(res3.url.includes('api_key=TR_API_KEY_9999'), 'api_key parameter must use dedicated apiKey');
    assert.ok(res3.url.includes('user_id=user_654321'), 'user_id parameter must use authenticated user id');
    assert.ok(res3.url.includes('partner_id=PLACEMENT_ID_8888'), 'partner_id parameter must use appId');
    assert.ok(res3.url.includes('exchange_rate=100'), 'exchange_rate parameter must use multiplier');
    assert.ok(res3.url.includes('&hash='), 'hash parameter must be present when signature is required');
    console.log('✓ Passed Test 3: Correct URL macro substitution with dedicated apiKey and user_id.\n');

    // -------------------------------------------------------------------------
    // Test 4: Legacy template api_key={appId} gracefully corrected to apiKey
    // -------------------------------------------------------------------------
    console.log('Test 4: Legacy template api_key={appId} gracefully corrected to apiKey...');
    const legacyProv = {
        providerKey: 'theoremreach',
        apiKey: 'TR_CORRECT_API_KEY',
        appId: 'LEGACY_APP_ID_DO_NOT_USE_AS_API_KEY',
        secretKey: 'TR_SECRET',
        requireSignature: true,
        iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={appId}&user_id={userId}'
    };

    const res4 = constructTheoremReachEntryUrl(legacyProv, 'user_legacy_1');
    assert.equal(res4.error, null);
    assert.ok(res4.url.includes('api_key=TR_CORRECT_API_KEY'), 'Legacy api_key={appId} must be substituted with real apiKey');
    assert.ok(!res4.url.includes('api_key=LEGACY_APP_ID_DO_NOT_USE_AS_API_KEY'), 'App ID must not be substituted into api_key');
    console.log('✓ Passed Test 4: Legacy api_key={appId} macro automatically mapped to dedicated apiKey.\n');

    // -------------------------------------------------------------------------
    // Test 5: Missing required configuration fails safely (Closed-fail)
    // -------------------------------------------------------------------------
    console.log('Test 5: Missing required configuration fails safely...');
    // 5a: Missing API Key
    const missingApiKeyProv = {
        providerKey: 'theoremreach',
        apiKey: '',
        secretKey: 'SOME_SECRET',
        requireSignature: true
    };
    const res5a = constructTheoremReachEntryUrl(missingApiKeyProv, 'u1');
    assert.equal(res5a.url, '');
    assert.ok(res5a.error.includes('API Key is not configured'));

    // 5b: Missing Secret Key when signature required
    const missingSecretProv = {
        providerKey: 'theoremreach',
        apiKey: 'MY_API_KEY',
        secretKey: '',
        requireSignature: true
    };
    const res5b = constructTheoremReachEntryUrl(missingSecretProv, 'u1');
    assert.equal(res5b.url, '');
    assert.ok(res5b.error.includes('Secret Key is missing'));

    // 5c: Unsubstituted macro in template
    const unparsedMacroProv = {
        providerKey: 'theoremreach',
        apiKey: 'MY_API_KEY',
        secretKey: 'MY_SECRET',
        requireSignature: false,
        iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={apiKey}&user_id={userId}&unknown_field={unknown_macro}'
    };
    const res5c = constructTheoremReachEntryUrl(unparsedMacroProv, 'u1');
    assert.equal(res5c.url, '');
    assert.ok(res5c.error.includes('{unknown_macro}'));
    console.log('✓ Passed Test 5: Missing credentials and unparsed macros fail closed with explicit errors.\n');

    // -------------------------------------------------------------------------
    // Test 6: HMAC-SHA1 URL-safe Base64 encoding verification
    // -------------------------------------------------------------------------
    console.log('Test 6: HMAC-SHA1 URL-safe Base64 encoding verification...');
    const signingProv = {
        providerKey: 'theoremreach',
        apiKey: 'test_api_key_123',
        secretKey: 'super_secret_salt_456',
        requireSignature: true,
        iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={apiKey}&user_id={userId}'
    };

    const res6 = constructTheoremReachEntryUrl(signingProv, 'user_abc');
    assert.ok(res6.url);
    const [urlBeforeHash, hashParam] = res6.url.split('&hash=');
    assert.ok(urlBeforeHash);
    assert.ok(hashParam);

    // Verify manual calculation matches
    const expectedHmac = crypto.createHmac('sha1', 'super_secret_salt_456').update(urlBeforeHash).digest('base64');
    const expectedUrlSafe = expectedHmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.equal(hashParam, expectedUrlSafe, 'Hash in URL must match URL-safe Base64 HMAC-SHA1 of pre-hash URL');
    assert.ok(!hashParam.includes('+'), 'Hash must not contain +');
    assert.ok(!hashParam.includes('/'), 'Hash must not contain /');
    assert.ok(!hashParam.includes('='), 'Hash must strip trailing =');
    console.log('✓ Passed Test 6: Entry URL HMAC-SHA1 signature generated over pre-hash URL with URL-safe Base64.\n');

    // Restore original methods
    OfferwallProvider.findOneAndUpdate = origFindOneAndUpdate;
    OfferwallProvider.find = origFind;

    console.log('========================================================================');
    console.log('All Focused TheoremReach Entry Link & API Key Tests PASSED Successfully!');
    console.log('========================================================================\n');
}

runTests().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
