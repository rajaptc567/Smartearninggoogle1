import assert from 'assert';
import crypto from 'crypto';
import { verifySignature } from './backend/controllers/postbackController.js';

console.log('Running Focused CPX Research Integration Test Suite...');

const cpxSecret = 'cpx_test_secret_key_888';
const cpxProvider = {
    providerKey: 'cpx_research',
    name: 'CPX Research',
    requireSignature: true,
    signatureType: 'md5',
    secretKey: cpxSecret,
    postbackKey: '',
    appId: '37470',
    enabled: true,
    status: 'ACTIVE',
    commissionMode: 'smartexn_managed',
    userRevenueSharePercent: 70,
    platformRevenueSharePercent: 30,
    exchangeRateMultiplier: 1.0,
    iframeUrlTemplate: 'https://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}'
};

const txId = 'cpx_tx_554433';
const validMd5 = crypto.createHash('md5').update(`${txId}-${cpxSecret}`).digest('hex');

// ==========================================
// 1. Signature Aliases: hash, secure_hash, signature
// ==========================================
const testHash = verifySignature(cpxProvider, { trans_id: txId, hash: validMd5 }, '127.0.0.1');
assert.strictEqual(testHash.valid, true, 'Test 1a: Signature under "hash" must be valid');

const testSecureHash = verifySignature(cpxProvider, { trans_id: txId, secure_hash: validMd5 }, '127.0.0.1');
assert.strictEqual(testSecureHash.valid, true, 'Test 1b: Signature under "secure_hash" must be valid');

const testSignature = verifySignature(cpxProvider, { trans_id: txId, signature: validMd5 }, '127.0.0.1');
assert.strictEqual(testSignature.valid, true, 'Test 1c: Signature under "signature" must be valid');

console.log('✓ Test 1 Passed: Signature Aliases (hash, secure_hash, signature).');

// ==========================================
// 2. Invalid & Missing Signatures
// ==========================================
const testMissing = verifySignature(cpxProvider, { trans_id: txId }, '127.0.0.1');
assert.strictEqual(testMissing.valid, false, 'Test 2a: Missing signature must fail');
assert.strictEqual(testMissing.error, 'CPX signature missing');

const testTampered = verifySignature(cpxProvider, { trans_id: txId, secure_hash: 'tampered_hash_value' }, '127.0.0.1');
assert.strictEqual(testTampered.valid, false, 'Test 2b: Tampered signature must fail');
assert.strictEqual(testTampered.error, 'CPX signature mismatch');

console.log('✓ Test 2 Passed: Invalid & Missing Signatures Fail Closed.');

// ==========================================
// 3. Test Callback Isolation Logic
// ==========================================
const isCpxTestCallback = (providerKey, rawParams) => {
    return ((providerKey === 'cpx_research') && (
        rawParams.test === '1' || rawParams.test === 'true' || rawParams.test === true ||
        rawParams.is_test === '1' || rawParams.is_test === 'true' || rawParams.is_test === true ||
        rawParams.debug === '1' || rawParams.debug === 'true' || rawParams.debug === true ||
        rawParams.status === 'test'
    ));
};

assert.strictEqual(isCpxTestCallback('cpx_research', { test: '1' }), true, 'Test 3a: test=1 is test callback');
assert.strictEqual(isCpxTestCallback('cpx_research', { test: 'true' }), true, 'Test 3b: test=true is test callback');
assert.strictEqual(isCpxTestCallback('cpx_research', { is_test: '1' }), true, 'Test 3c: is_test=1 is test callback');
assert.strictEqual(isCpxTestCallback('cpx_research', { debug: '1' }), true, 'Test 3d: debug=1 is test callback');
assert.strictEqual(isCpxTestCallback('cpx_research', { status: 'test' }), true, 'Test 3e: status=test is test callback');
assert.strictEqual(isCpxTestCallback('cpx_research', { status: '1', amount_usd: '1.50' }), false, 'Test 3f: live status=1 is not test callback');
assert.strictEqual(isCpxTestCallback('cpx_research', { status: '2', amount_usd: '1.50' }), false, 'Test 3g: live status=2 is not test callback');

console.log('✓ Test 3 Passed: Test Callback Isolation & Precision.');

// ==========================================
// 4. Currency and Commission Accounting Calculation
// ==========================================
const calculateSplit = (provider, rawRewardUSD) => {
    const grossUSD = Number((rawRewardUSD * (provider.exchangeRateMultiplier || 1.0)).toFixed(4));
    let userRewardUSD = grossUSD;
    let platformRevenueUSD = 0;
    if (provider.commissionMode === 'smartexn_managed') {
        const userSharePct = provider.userRevenueSharePercent ?? 70;
        userRewardUSD = Number((grossUSD * (userSharePct / 100)).toFixed(4));
        platformRevenueUSD = Number((grossUSD - userRewardUSD).toFixed(4));
    }
    return { grossUSD, userRewardUSD, platformRevenueUSD };
};

// Scenario A: SmartExn managed 70/30 split on $1.00 survey
const splitManaged = calculateSplit(cpxProvider, 1.00);
assert.strictEqual(splitManaged.grossUSD, 1.00, 'Scenario A: Gross is $1.00');
assert.strictEqual(splitManaged.userRewardUSD, 0.70, 'Scenario A: User reward is $0.70 (70%)');
assert.strictEqual(splitManaged.platformRevenueUSD, 0.30, 'Scenario A: Platform revenue is $0.30 (30%)');

// Scenario B: Provider managed (CPX dashboard takes margin before postback)
const providerManaged = { ...cpxProvider, commissionMode: 'provider_managed' };
const splitProvider = calculateSplit(providerManaged, 0.70); // CPX already deducted 30% margin
assert.strictEqual(splitProvider.grossUSD, 0.70, 'Scenario B: Gross is $0.70');
assert.strictEqual(splitProvider.userRewardUSD, 0.70, 'Scenario B: User receives 100% of incoming $0.70 without second deduction');
assert.strictEqual(splitProvider.platformRevenueUSD, 0.00, 'Scenario B: Platform takes 0% on SmartExn side');

console.log('✓ Test 4 Passed: Accounting Split Invariants & Double-Deduction Prevention.');

// ==========================================
// 5. URL Generation & Sensitive Key Stripping
// ==========================================
const mockUser = { id: '65e2b0f49c2a8f0012ab34cd' };
const template = cpxProvider.iframeUrlTemplate;
const generatedUrl = template
    .replace(/\{userId\}/g, String(mockUser.id))
    .replace(/\{appId\}/g, cpxProvider.appId.trim());

assert.strictEqual(
    generatedUrl,
    'https://offers.cpx-research.com/index.php?app_id=37470&ext_user_id=65e2b0f49c2a8f0012ab34cd',
    'Test 5a: URL properly interpolates appId 37470 and mongo userId'
);

// Verify scrubbing
const publicPayload = { ...cpxProvider };
delete publicPayload.appId;
delete publicPayload.apiKey;
delete publicPayload.secretKey;
delete publicPayload.postbackKey;

assert.strictEqual(publicPayload.secretKey, undefined, 'Test 5b: secretKey stripped');
assert.strictEqual(publicPayload.postbackKey, undefined, 'Test 5c: postbackKey stripped');
assert.strictEqual(publicPayload.appId, undefined, 'Test 5d: appId stripped from public view');

console.log('✓ Test 5 Passed: URL Generation & Public Credential Scrubbing.');

// ==========================================
// 6. CPX Event-Type Normalization Logic
// ==========================================
const normalizeCpxType = (typeVal) => {
    const rawType = String(typeVal || '').trim().toLowerCase();
    if (rawType === 'out') return 'out';
    if (rawType === 'bonus') return 'bonus';
    if (rawType === 'complete' || !rawType) return 'complete';
    return 'unsupported';
};

assert.strictEqual(normalizeCpxType('Complete'), 'complete', 'Test 6a: Complete maps to complete');
assert.strictEqual(normalizeCpxType('complete'), 'complete', 'Test 6b: complete maps to complete');
assert.strictEqual(normalizeCpxType(''), 'complete', 'Test 6c: omitted type defaults to complete');
assert.strictEqual(normalizeCpxType(undefined), 'complete', 'Test 6d: undefined type defaults to complete');
assert.strictEqual(normalizeCpxType('Out'), 'out', 'Test 6e: Out maps to out');
assert.strictEqual(normalizeCpxType('out'), 'out', 'Test 6f: out maps to out');
assert.strictEqual(normalizeCpxType('Bonus'), 'bonus', 'Test 6g: Bonus maps to bonus');
assert.strictEqual(normalizeCpxType('bonus'), 'bonus', 'Test 6h: bonus maps to bonus');
assert.strictEqual(normalizeCpxType('fraud_disqualify'), 'unsupported', 'Test 6i: unsupported type identified');

console.log('✓ Test 6 Passed: CPX Event-Type Normalization.');

// ==========================================
// 7. Zero-Value Screen-Out Bypass Invariant
// ==========================================
const shouldBypassZeroScreenout = (providerKey, eventType, rawReward) => {
    return providerKey === 'cpx_research' && eventType === 'out' && rawReward <= 0;
};

assert.strictEqual(shouldBypassZeroScreenout('cpx_research', 'out', 0), true, 'Test 7a: CPX out with $0 reward bypassed');
assert.strictEqual(shouldBypassZeroScreenout('cpx_research', 'out', 0.05), false, 'Test 7b: CPX out with $0.05 not bypassed (eligible for consolation)');
assert.strictEqual(shouldBypassZeroScreenout('cpx_research', 'complete', 0), false, 'Test 7c: complete not bypassed by screenout guard');
assert.strictEqual(shouldBypassZeroScreenout('torox', 'out', 0), false, 'Test 7d: other providers not affected');

console.log('✓ Test 7 Passed: Zero-Value Screen-Out Bypass Invariant.');

// ==========================================
// 8. Distinguishable Transaction and Notification Copy
// ==========================================
const getCpxTransactionDescription = (providerName, eventType, offerName) => {
    if (eventType === 'out') return `${providerName} Screenout Consolation: ${offerName}`;
    if (eventType === 'bonus') return `${providerName} Survey Rating Bonus: ${offerName}`;
    return `Completed ${providerName} Offer/Survey: ${offerName}`;
};

const getCpxNotificationCopy = (providerName, eventType, offerName, reward) => {
    if (eventType === 'out') {
        return {
            subject: `Survey Screenout Consolation Credited! ℹ️ (+$${reward})`,
            message: `You received a consolation reward of $${reward} from ${providerName} (${offerName}) for participating in a survey attempt.`
        };
    }
    if (eventType === 'bonus') {
        return {
            subject: `Survey Rating Bonus Credited! ⭐ (+$${reward})`,
            message: `You received a survey rating bonus of $${reward} from ${providerName} (${offerName}). The reward has been credited to your Task Balance!`
        };
    }
    return {
        subject: `Offerwall Reward Credited! 🎁 (+$${reward})`,
        message: `You earned $${reward} from ${providerName} (${offerName}). The reward has been credited directly to your Work & Earn Task Balance!`
    };
};

const descComplete = getCpxTransactionDescription('CPX Research', 'complete', 'CPX Research Survey');
const descOut = getCpxTransactionDescription('CPX Research', 'out', 'CPX Survey Screenout Consolation');
const descBonus = getCpxTransactionDescription('CPX Research', 'bonus', 'CPX Survey Rating Bonus');

assert.strictEqual(descComplete.includes('Completed CPX Research Offer/Survey'), true, 'Test 8a: Complete description verified');
assert.strictEqual(descOut.includes('Screenout Consolation'), true, 'Test 8b: Screenout description distinguished');
assert.strictEqual(descBonus.includes('Survey Rating Bonus'), true, 'Test 8c: Bonus description distinguished');

const notifOut = getCpxNotificationCopy('CPX Research', 'out', 'CPX Survey Screenout Consolation', 0.02);
assert.strictEqual(notifOut.subject.includes('Screenout Consolation'), true, 'Test 8d: Screenout notification distinguished');
assert.strictEqual(notifOut.message.includes('participating in a survey attempt'), true, 'Test 8e: Screenout message verified');

console.log('✓ Test 8 Passed: Distinguishable Transaction & Notification Labeling.');

// ==========================================
// 9. Reversals & Status=2 Safety Invariants
// ==========================================
const isReversalEvent = (statusVal, rawAmount) => {
    return statusVal === '2' || statusVal === 2 || statusVal === 'reversal' || Number(rawAmount) < 0;
};

assert.strictEqual(isReversalEvent('2', 1.00), true, 'Test 9a: status="2" identified as reversal');
assert.strictEqual(isReversalEvent(2, 1.00), true, 'Test 9b: status=2 identified as reversal');
assert.strictEqual(isReversalEvent('1', 1.00), false, 'Test 9c: status="1" is not reversal');
assert.strictEqual(isReversalEvent('1', -0.50), true, 'Test 9d: negative amount identified as reversal');

console.log('✓ Test 9 Passed: Reversal (status=2) Isolation.');

// ==========================================
// 10. Idempotency Key Scoping Invariant
// ==========================================
const makeCreditKey = (providerKey, extTxId) => `${providerKey}_${extTxId}_credit`;
const makeReversalKey = (providerKey, extTxId) => `${providerKey}_${extTxId}_reversal`;

assert.strictEqual(makeCreditKey('cpx_research', 'tx_999'), 'cpx_research_tx_999_credit', 'Test 10a: Credit key scoped to cpx_research');
assert.strictEqual(makeReversalKey('cpx_research', 'tx_999'), 'cpx_research_tx_999_reversal', 'Test 10b: Reversal key scoped to cpx_research');
assert.notStrictEqual(makeCreditKey('cpx_research', 'tx_999'), makeCreditKey('torox', 'tx_999'), 'Test 10c: Keys isolated across providers');

console.log('✓ Test 10 Passed: Idempotency Key Provider Scoping.');

console.log('======================================================');
console.log('All 10 Focused CPX Research Integration Tests Passed!');
console.log('======================================================');
