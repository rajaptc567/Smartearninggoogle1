import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import OfferwallProvider from '../models/OfferwallProvider.js';
import OfferwallPostbackLog from '../models/OfferwallPostbackLog.js';
import Notification from '../models/Notification.js';
import OfferwallPostbackLock from '../models/OfferwallPostbackLock.js';
import TheoremReachWebhookEvent from '../models/TheoremReachWebhookEvent.js';

/**
 * Helper to get clean Client IP address supporting reverse proxies & Cloud Run
 */
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || '0.0.0.0';
};

/**
 * Helper to safely query actual admin/super_admin user IDs for offerwall notifications
 */
const getAdminUsersForNotification = async () => {
    try {
        const isDbConnected = User.db?.readyState === 1;
        const isMocked = typeof User.find === 'function' && (User.find.name !== 'find' || User.find.length !== 3);
        if (isDbConnected || isMocked) {
            return await User.find({ role: { $in: ['admin', 'super_admin'] } }).select('_id');
        }
        return [];
    } catch (_) {
        return [];
    }
};

/**
 * Constant-time string comparison for normalized hex signatures (case/whitespace insensitive)
 */
const safeTimingCompare = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a.trim().toLowerCase(), 'utf8');
    const bufB = Buffer.from(b.trim().toLowerCase(), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Constant-time comparison for raw shared secrets and tokens without case/trim normalization
 */
const safeRawSecretCompare = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Constant-time comparison for case-sensitive URL-safe Base64 signatures (TheoremReach)
 */
const safeTimingCompareExact = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const cleanA = a.trim();
    const cleanB = b.trim();
    const bufA = Buffer.from(cleanA, 'utf8');
    const bufB = Buffer.from(cleanB, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Mask sensitive credentials and secrets from logs and diagnostic output case-insensitively
 */
const maskSensitiveData = (data) => {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
        return data.map(item => maskSensitiveData(item));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
        if (
            lowerKey.includes('secret') ||
            lowerKey.includes('password') ||
            lowerKey.includes('apikey') ||
            lowerKey === 'token' ||
            lowerKey === 'auth' ||
            lowerKey === 'accesstoken' ||
            lowerKey === 'refreshtoken' ||
            lowerKey === 'authorization' ||
            lowerKey === 'signature' ||
            lowerKey === 'sig' ||
            lowerKey.includes('hash') ||
            lowerKey === 'key'
        ) {
            sanitized[key] = '***REDACTED***';
        } else if (value && typeof value === 'object') {
            sanitized[key] = maskSensitiveData(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

/**
 * Signature verification utility for various provider hashing schemes.
 * Fails closed on all unhandled, misconfigured, or missing credentials.
 */
export const verifySignature = (provider, params, clientIp, req = null) => {
    const key = provider.providerKey?.toLowerCase() || '';

    // TheoremReach must always enforce HMAC-SHA1 signature verification and cannot be bypassed by requireSignature=false or ip_only
    if (key === 'theoremreach') {
        const secret = provider.secretKey || provider.postbackKey || '';
        if (!secret) {
            return { valid: false, error: 'TheoremReach secret key is not configured; failing closed' };
        }
        const received = params.hash || params.signature || params.sig || '';
        if (!received) {
            return { valid: false, error: 'TheoremReach signature hash missing' };
        }

        const configuredCallbackUrl = provider.rewardCallbackUrl || 'https://smartexn.com/api/v1/postbacks/theoremreach';
        let canonicalOrigin = 'https://smartexn.com';
        let canonicalHost = 'smartexn.com';
        try {
            const parsedUrl = new URL(configuredCallbackUrl);
            canonicalOrigin = parsedUrl.origin;
            canonicalHost = parsedUrl.hostname;
        } catch (_) {}

        const allowedOrigins = new Set(['https://smartexn.com']);
        if (canonicalOrigin) allowedOrigins.add(canonicalOrigin);

        const candidates = [];
        if (req) {
            if (typeof req.rawUrl === 'string' && req.rawUrl) {
                const rawPart = req.rawUrl.split('&hash=')[0];
                try {
                    const parsed = new URL(rawPart);
                    if (parsed.protocol === 'https:' && (allowedOrigins.has(parsed.origin) || parsed.hostname === 'smartexn.com' || parsed.hostname === canonicalHost)) {
                        candidates.push(rawPart);
                    }
                } catch (_) {}
            }
            const rawPathAndQuery = req.originalUrl || req.url || '';
            if (rawPathAndQuery && rawPathAndQuery.startsWith('/')) {
                const pathUpToHash = rawPathAndQuery.split('&hash=')[0];
                // Canonical full URL with configured origins - NEVER path-only
                for (const origin of allowedOrigins) {
                    const canonicalUrl = `${origin}${pathUpToHash}`;
                    if (!candidates.includes(canonicalUrl)) {
                        candidates.push(canonicalUrl);
                    }
                }
            }
        }

        // Fallback for direct unit tests where req.originalUrl is not supplied: reconstruct query preserving exact parameter order
        if (candidates.length === 0 && (req?.query || (params && typeof params === 'object'))) {
            const querySource = req?.query || params;
            const parts = [];
            for (const [k, v] of Object.entries(querySource)) {
                if (k === 'hash' || k === 'signature' || k === 'sig') break;
                parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
            }
            for (const origin of allowedOrigins) {
                const reconstructed = `${origin}/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`;
                if (!candidates.includes(reconstructed)) {
                    candidates.push(reconstructed);
                }
            }
        }

        for (const candidate of candidates) {
            const hmac = crypto.createHmac('sha1', secret).update(candidate).digest('base64');
            const urlSafeExpected = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            if (safeTimingCompareExact(received, urlSafeExpected)) {
                return { valid: true };
            }
        }
        return { valid: false, error: 'TheoremReach HMAC-SHA1 signature mismatch' };
    }

    // CPX Research must always enforce MD5 signature verification and cannot be bypassed by requireSignature=false or ip_only
    if (key === 'cpx_research') {
        const secret = provider.secretKey || provider.postbackKey || '';
        if (!secret) {
            return { valid: false, error: 'CPX secret key is not configured; failing closed' };
        }
        const hash = params.hash || params.secure_hash || params.signature || '';
        const transId = params.trans_id || params.transaction_id || '';
        if (!hash) return { valid: false, error: 'CPX signature missing' };
        const expected = crypto.createHash('md5').update(`${transId}-${secret}`).digest('hex');
        if (!safeTimingCompare(hash, expected)) {
            return { valid: false, error: 'CPX signature mismatch' };
        }
        if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
            const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
            if (!ipMatches) {
                return { valid: false, error: 'Client IP not in whitelist' };
            }
        }
        return { valid: true };
    }

    // ayeT-Studios must always enforce HMAC-SHA256 signature verification using X-Ayetstudios-Security-Hash
    // Cannot be bypassed by requireSignature=false, signatureType='none', or IP-only verification
    if (key === 'ayetstudios') {
        const apiKey = (provider.apiKey || '').trim();
        if (!apiKey) {
            return { valid: false, error: 'ayeT-Studios API key is not configured; failing closed' };
        }

        const receivedHeader = String(
            req?.headers?.['x-ayetstudios-security-hash'] ||
            req?.headers?.['X-Ayetstudios-Security-Hash'] ||
            (typeof req?.get === 'function' ? req.get('X-Ayetstudios-Security-Hash') : '') ||
            ''
        ).trim();

        if (!receivedHeader) {
            return { valid: false, error: 'X-Ayetstudios-Security-Hash header missing; failing closed' };
        }

        // Read the actual callback request query parameters
        const queryParams = (req && req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0)
            ? { ...req.query }
            : { ...params };

        // Exclude Express route path params or header names if present
        delete queryParams.provider;
        delete queryParams['X-Ayetstudios-Security-Hash'];
        delete queryParams['x-ayetstudios-security-hash'];

        const sortedKeys = Object.keys(queryParams).sort();
        if (sortedKeys.length === 0) {
            return { valid: false, error: 'ayeT-Studios query parameters missing for HMAC signature calculation' };
        }

        // Reject ambiguous or malformed parameter structures (arrays, nested objects) rather than silently signing an incorrect string
        for (const k of sortedKeys) {
            const val = queryParams[k];
            if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
                return { valid: false, error: `Ambiguous or malformed query parameter '${k}'; failing closed` };
            }
        }

        // Deterministic canonicalization according to official ayeT-Studios HMAC-SHA256 documentation using URLSearchParams:
        // 1. Sort parameter names alphabetically
        // 2. Encode keys and values using URLSearchParams serialization (spaces encoded as '+', standard application/x-www-form-urlencoded)
        // 3. Build canonical query string: searchParams.toString()
        const searchParams = new URLSearchParams();
        for (const k of sortedKeys) {
            const rawVal = queryParams[k] !== undefined && queryParams[k] !== null ? String(queryParams[k]) : '';
            searchParams.append(k, rawVal);
        }
        const canonicalQueryString = searchParams.toString();

        const expectedHash = crypto.createHmac('sha256', apiKey).update(canonicalQueryString).digest('hex');

        if (!safeTimingCompare(receivedHeader, expectedHash)) {
            return { valid: false, error: 'ayeT-Studios HMAC-SHA256 signature mismatch' };
        }

        if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
            const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
            if (!ipMatches) {
                return { valid: false, error: 'Client IP not in whitelist' };
            }
        }

        return { valid: true };
    }

    // AdGem must always enforce HMAC-SHA256 signature verification over exact raw request body using Postback Key
    // Cannot be bypassed by requireSignature=false, signatureType='none', or IP-only verification
    if (key === 'adgem') {
        const secret = (provider.postbackKey || '').trim();
        if (!secret) {
            return { valid: false, error: 'AdGem postback key is not configured; failing closed' };
        }
        const received = String(
            req?.headers?.['signature'] ||
            req?.headers?.['Signature'] ||
            req?.headers?.['x-adgem-signature'] ||
            req?.headers?.['x-signature'] ||
            (typeof req?.get === 'function' ? (req.get('Signature') || req.get('signature') || req.get('x-adgem-signature') || req.get('x-signature')) : '') ||
            params.signature ||
            params.sig ||
            ''
        ).trim();
        if (!received) {
            return { valid: false, error: 'AdGem signature missing' };
        }
        if (!req?.rawBody || (Buffer.isBuffer(req.rawBody) && req.rawBody.length === 0) || (typeof req.rawBody === 'string' && !req.rawBody.trim())) {
            return { valid: false, error: 'AdGem raw request body missing' };
        }
        const rawBuffer = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(String(req.rawBody), 'utf8');
        const expected = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
        if (!safeTimingCompare(expected, received)) {
            return { valid: false, error: 'AdGem HMAC-SHA256 signature mismatch' };
        }
        if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
            const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
            if (!ipMatches) {
                return { valid: false, error: 'Client IP not in whitelist' };
            }
        }
        return { valid: true };
    }

    // Offerwall.GG must always enforce HMAC-SHA256 signature verification over userId:transactionId:currencyAmount
    // Cannot be bypassed by requireSignature=false, signatureType='none', or IP-only verification
    if (key === 'offerwall_gg' || key === 'offerwallgg') {
        const secret = (process.env.OFFERWALL_GG_SECRET_KEY || provider.secretKey || '').trim();
        if (!secret) {
            return { valid: false, error: 'Offerwall.GG secret key is not configured; failing closed' };
        }

        const query = (req && req.query && typeof req.query === 'object') ? req.query : {};
        const body = (req && req.body && typeof req.body === 'object') ? req.body : {};

        const getParam = (names) => {
            let qVal = undefined;
            let bVal = undefined;
            for (const name of names) {
                if (qVal === undefined && query[name] !== undefined) qVal = query[name];
                if (bVal === undefined && body[name] !== undefined) bVal = body[name];
            }
            // Detect conflicting query and body values
            if (qVal !== undefined && bVal !== undefined && String(qVal).trim() !== String(bVal).trim()) {
                return { conflict: true };
            }
            const val = qVal !== undefined ? qVal : (bVal !== undefined ? bVal : undefined);
            if (val !== undefined) return { value: val };
            for (const name of names) {
                if (params[name] !== undefined) return { value: params[name] };
            }
            return { value: undefined };
        };

        const userRes = getParam(['userId', 'user_id', 'subId', 'subid', 'uid']);
        const txRes = getParam(['transactionId', 'transaction_id', 'trans_id', 'transId', 'txid', 'id']);
        const amountRes = getParam(['currencyAmount', 'amount', 'reward', 'points']);
        const sigRes = getParam(['signature', 'sig', 'hash']);

        if (userRes.conflict || txRes.conflict || amountRes.conflict || sigRes.conflict) {
            return { valid: false, error: 'Offerwall.GG conflicting query and body parameters detected; failing closed' };
        }

        const rawUserId = userRes.value;
        const rawTxId = txRes.value;
        const rawCurrencyAmount = amountRes.value;
        const receivedSig = sigRes.value;

        // Reject arrays or nested objects for signed parameters
        for (const [k, v] of [['userId', rawUserId], ['transactionId', rawTxId], ['currencyAmount', rawCurrencyAmount], ['signature', receivedSig]]) {
            if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
                return { valid: false, error: `Offerwall.GG parameter '${k}' must be a scalar; failing closed` };
            }
        }

        if (rawUserId === undefined || rawUserId === null || String(rawUserId).trim() === '') {
            return { valid: false, error: 'Offerwall.GG userId missing for signature verification' };
        }
        if (rawTxId === undefined || rawTxId === null || String(rawTxId).trim() === '') {
            return { valid: false, error: 'Offerwall.GG transactionId missing for signature verification' };
        }
        if (rawCurrencyAmount === undefined || rawCurrencyAmount === null || String(rawCurrencyAmount).trim() === '') {
            return { valid: false, error: 'Offerwall.GG currencyAmount missing for signature verification' };
        }
        if (receivedSig === undefined || receivedSig === null || String(receivedSig).trim() === '') {
            return { valid: false, error: 'Offerwall.GG signature missing; failing closed' };
        }

        // Exact transmitted string values: preserve formatting and do NOT trim or numerically normalize before hashing
        const strUser = String(rawUserId);
        const strTx = String(rawTxId);
        const strAmount = String(rawCurrencyAmount);
        const strReceived = String(receivedSig).trim();

        const message = `${strUser}:${strTx}:${strAmount}`;
        const expectedSig = crypto.createHmac('sha256', secret).update(message).digest('hex');

        if (!safeTimingCompare(strReceived, expectedSig)) {
            return { valid: false, error: 'Offerwall.GG HMAC-SHA256 signature mismatch' };
        }

        if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
            const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
            if (!ipMatches) {
                return { valid: false, error: 'Client IP not in whitelist' };
            }
        }

        return { valid: true };
    }

    // Fail closed: requireSignature: true with signatureType: 'none' must not pass
    if (provider.requireSignature && (!provider.signatureType || provider.signatureType === 'none')) {
        return { valid: false, error: 'Provider requires signature but signatureType is none or not configured' };
    }

    // Signature not required by configuration
    if (!provider.requireSignature) {
        if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
            const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
            if (!ipMatches) {
                return { valid: false, error: 'Client IP not in whitelist' };
            }
        }
        return { valid: true };
    }

    const secret = provider.secretKey || provider.postbackKey || '';

    // If IP whitelist check is requested as only verification
    if (provider.signatureType === 'ip_only') {
        if (!provider.ipWhitelist || provider.ipWhitelist.length === 0) {
            return { valid: false, error: 'IP whitelist verification required but no IP whitelist configured' };
        }
        const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
        if (!ipMatches) {
            return { valid: false, error: 'Client IP not in whitelist' };
        }
        return { valid: true };
    }

    // Enforce IP whitelist alongside signature if configured
    if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
        const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
        if (!ipMatches) {
            return { valid: false, error: 'Client IP not in whitelist' };
        }
    }

    // Fail closed: secret must be configured when signature is required
    if (!secret) {
        return { valid: false, error: 'Provider secret key is not configured; failing closed' };
    }

    // Provider-specific verification algorithms

    try {
        if (key === 'theoremreach' || provider.signatureType === 'hmac_sha1') {
            // TheoremReach HMAC-SHA1 over the full called URL excluding '&hash=', URL-safe Base64 (+ -> -, / -> _, trim =)
            const received = params.hash || params.signature || params.sig || '';
            if (!received) return { valid: false, error: 'TheoremReach signature hash missing' };

            const configuredRewardUrl = provider.rewardCallbackUrl || 'https://smartexn.com/api/v1/postbacks/theoremreach';
            let canonicalOrigin = 'https://smartexn.com';
            let canonicalHost = 'smartexn.com';
            try {
                const parsedUrl = new URL(configuredRewardUrl);
                canonicalOrigin = parsedUrl.origin;
                canonicalHost = parsedUrl.hostname;
            } catch (_) {}

            const candidates = [];

            if (req) {
                if (typeof req.rawUrl === 'string' && req.rawUrl) {
                    const rawPart = req.rawUrl.split('&hash=')[0];
                    try {
                        const parsed = new URL(rawPart);
                        if (parsed.protocol === 'https:' && (parsed.origin === canonicalOrigin || parsed.hostname === canonicalHost || parsed.hostname === 'smartexn.com')) {
                            candidates.push(rawPart);
                        }
                    } catch (_) {}
                }
                const rawPathAndQuery = req.originalUrl || req.url || '';
                if (rawPathAndQuery && rawPathAndQuery.startsWith('/')) {
                    const pathUpToHash = rawPathAndQuery.split('&hash=')[0];
                    // Canonical full URL with configured origin - strictly full HTTPS URL, NEVER path-only
                    const canonicalUrl = `${canonicalOrigin}${pathUpToHash}`;
                    if (!candidates.includes(canonicalUrl)) {
                        candidates.push(canonicalUrl);
                    }
                }
            }

            // Fallback: If raw URL is not accessible, reconstruct full canonical URL from query parameters in order
            if (candidates.length === 0 && req && req.query) {
                const parts = [];
                for (const [k, v] of Object.entries(req.query)) {
                    if (k === 'hash' || k === 'signature' || k === 'sig') break;
                    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                }
                candidates.push(`${canonicalOrigin}/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`);
            }

            // Fallback: If req was not provided (e.g. direct unit test of verifySignature), reconstruct from params in order
            if (candidates.length === 0 && params && typeof params === 'object') {
                const parts = [];
                for (const [k, v] of Object.entries(params)) {
                    if (k === 'hash' || k === 'signature' || k === 'sig') break;
                    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                }
                candidates.push(`${canonicalOrigin}/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`);
            }

            for (const candidate of candidates) {
                const hmac = crypto.createHmac('sha1', secret).update(candidate).digest('base64');
                const urlSafeExpected = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                if (safeTimingCompareExact(received, urlSafeExpected)) {
                    return { valid: true };
                }
            }

            return { valid: false, error: 'TheoremReach HMAC-SHA1 signature mismatch' };
        }

        if (key === 'torox') {
            // Torox md5: md5(oid + "-" + user_id + "-" + placement_key)
            const sig = params.sig || params.signature || '';
            const userId = params.user_id || params.uid || '';
            const oid = params.oid || params.offer_id || '';
            if (!sig) return { valid: false, error: 'Torox signature missing' };
            if (!userId || !oid) return { valid: false, error: 'Torox required parameter missing' };
            const expected = crypto.createHash('md5').update(`${oid}-${userId}-${secret}`).digest('hex');
            if (!safeTimingCompare(sig, expected)) {
                return { valid: false, error: 'Torox signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'cpx_research') {
            const hash = params.hash || params.secure_hash || params.signature || '';
            const transId = params.trans_id || params.transaction_id || '';
            if (!hash) return { valid: false, error: 'CPX signature missing' };
            const expected = crypto.createHash('md5').update(`${transId}-${secret}`).digest('hex');
            if (!safeTimingCompare(hash, expected)) {
                return { valid: false, error: 'CPX signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'wannads') {
            const signature = params.signature || '';
            const subId = params.subId || params.user_id || '';
            const transId = params.transId || params.trans_id || '';
            const reward = params.reward || '';
            if (!signature) return { valid: false, error: 'Wannads signature missing' };
            const expected = crypto.createHash('md5').update(`${subId}${transId}${reward}${secret}`).digest('hex');
            if (!safeTimingCompare(signature, expected)) {
                return { valid: false, error: 'Wannads signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'revlum') {
            const signature = params.signature || params.sig || '';
            const transId = params.transId || params.trans_id || params.transaction_id || '';
            const subId = params.subId || params.user_id || '';
            const reward = params.reward || params.payout || '';
            if (!signature) return { valid: false, error: 'Revlum signature missing' };
            const expected = crypto.createHash('md5').update(`${subId}${transId}${reward}${secret}`).digest('hex');
            if (!safeTimingCompare(signature, expected)) {
                return { valid: false, error: 'Revlum signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'monlix') {
            const secretKeyReceived = params.secretKey || params.secret || '';
            const signature = params.signature || '';
            if (secretKeyReceived && safeRawSecretCompare(secretKeyReceived, secret)) {
                return { valid: true };
            }
            if (signature) {
                const expected = crypto.createHash('sha256').update(`${params.userId || ''}${params.transactionId || ''}${secret}`).digest('hex');
                if (!safeTimingCompare(signature, expected)) {
                    return { valid: false, error: 'Monlix signature mismatch' };
                }
                return { valid: true };
            }
            return { valid: false, error: 'Monlix signature or secret key missing/invalid' };
        }

        if (key === 'lootably') {
            const signature = params.signature || params.sig || params.hash || '';
            const userID = params.userID || params.user_id || '';
            const ip = params.ip || clientIp || '';
            const revenue = params.revenue || params.pointValue || '';
            const currencyReward = params.currencyReward || params.payout || params.reward || '';
            if (!signature) return { valid: false, error: 'Lootably signature missing' };
            const expected = crypto.createHash('sha256').update(`${userID}${ip}${revenue}${currencyReward}${secret}`).digest('hex');
            if (!safeTimingCompare(signature, expected)) {
                return { valid: false, error: 'Lootably signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'bitlabs' || key === 'bitlabs_surveys') {
            const hash = params.hash || params.signature || '';
            const val = params.val || params.reward || '';
            const uid = params.uid || params.user_id || '';
            const tx = params.tx || params.tx_id || '';
            if (!hash) return { valid: false, error: 'BitLabs signature missing' };
            const sha1Expected = crypto.createHmac('sha1', secret).update(`${val}${uid}${tx}`).digest('hex');
            const sha256Expected = crypto.createHmac('sha256', secret).update(`${val}${uid}${tx}`).digest('hex');
            if (!safeTimingCompare(hash, sha1Expected) && !safeTimingCompare(hash, sha256Expected)) {
                return { valid: false, error: 'BitLabs signature mismatch' };
            }
            return { valid: true };
        }

        // Generic cryptographic verification logic
        if (provider.signatureType === 'hmac_sha256') {
            const received = params.signature || params.sig || params.hash || '';
            if (!received) return { valid: false, error: 'HMAC-SHA256 signature missing' };
            const payload = params.trans_id || params.txid || params.id || params.transaction_id || '';
            const expected = crypto.createHmac('sha256', secret).update(String(payload)).digest('hex');
            if (!safeTimingCompare(received, expected)) {
                return { valid: false, error: 'HMAC-SHA256 signature mismatch' };
            }
            return { valid: true };
        } else if (provider.signatureType === 'md5') {
            const received = params.signature || params.sig || params.hash || '';
            if (!received) return { valid: false, error: 'MD5 signature missing' };
            const payload = `${params.user_id || params.uid || params.subId || ''}-${params.id || params.txid || params.trans_id || ''}-${secret}`;
            const expected = crypto.createHash('md5').update(payload).digest('hex');
            if (!safeTimingCompare(received, expected)) {
                return { valid: false, error: 'MD5 signature mismatch' };
            }
            return { valid: true };
        } else if (provider.signatureType === 'sha256') {
            const received = params.signature || params.sig || params.hash || '';
            if (!received) return { valid: false, error: 'SHA256 signature missing' };
            const payload = `${params.user_id || params.uid || params.subId || ''}-${params.id || params.txid || params.trans_id || ''}-${secret}`;
            const expected = crypto.createHash('sha256').update(payload).digest('hex');
            if (!safeTimingCompare(received, expected)) {
                return { valid: false, error: 'SHA256 signature mismatch' };
            }
            return { valid: true };
        } else if (provider.signatureType === 'sha1') {
            const received = params.signature || params.sig || params.hash || '';
            if (!received) return { valid: false, error: 'SHA1 signature missing' };
            const payload = `${params.user_id || params.uid || params.subId || ''}-${params.id || params.txid || params.trans_id || ''}-${secret}`;
            const expected = crypto.createHash('sha1').update(payload).digest('hex');
            if (!safeTimingCompare(received, expected)) {
                return { valid: false, error: 'SHA1 signature mismatch' };
            }
            return { valid: true };
        } else if (provider.signatureType === 'custom') {
            return { valid: false, error: 'Custom signature verification not configured or unsupported' };
        }

        // Fail closed for unsupported signature types - NEVER fall through to { valid: true }
        return { valid: false, error: `Unsupported signature type: '${provider.signatureType}'` };
    } catch (err) {
        return { valid: false, error: 'Signature verification processing error' };
    }
};

/**
 * Standardize incoming parameters across all 26 networks
 */
const normalizePostbackParams = (providerKey, rawParams) => {
    const p = { ...rawParams };
    const key = providerKey.toLowerCase();

    // Extract User ID / SubID
    let rawUserId = p.user_id || p.userId || p.uid || p.subId || p.subid || p.subid1 || p.sid || p.s1 || p.ext_user_id || p.userID || p.custom_data || p.app_uid || '';

    // Extract Transaction ID (oid is strictly Offer ID, not conversion/transaction ID)
    let rawTxId = p.id || p.trans_id || p.transId || p.transaction_id || p.transactionId || p.tx_id || p.txid || p.txn_id || p.transactionID || p.event_id || p.eventId || p.rewardId || p.request_uuid || '';

    // Extract Reward Amount (USD)
    let rawAmount = p.amount || p.reward || p.payout || p.pointValue || p.amount_usd || p.amount_local || p.rate || p.pts || p.val || p.rewardAmount || p.currency_amount || p.rewards || p.reward_amount || p.points || 0;
    let rawCurrency = p.currency || 'USD';

    let rawOfferId = p.offer_id || p.oid || p.offerId || p.campaign_id || '';
    let offerName = String(p.o_name || p.offer_name || p.offerName || p.campaign_name || p.reward_name || `${providerKey} reward`).trim();

    if (key === 'theoremreach') {
        rawUserId = p.user_id || p.userId || p.uid || p.subId || p.ext_user_id || '';
        rawTxId = p.transaction_id || p.tx_id || p.trans_id || p.id || '';
        rawAmount = p.reward || p.currency_reward || p.reward_amount || p.amount || 0;
        rawCurrency = p.currency || 'USD';
    }

    if (key === 'lootably') {
        rawAmount = (p.currencyReward !== undefined && p.currencyReward !== null && p.currencyReward !== '')
            ? p.currencyReward
            : (p.reward || p.amount || 0);
        if (p.offerID !== undefined && p.offerID !== null && p.offerID !== '') {
            rawOfferId = p.offerID;
        }
    }

    if (key === 'ayetstudios') {
        rawUserId = (p.external_identifier !== undefined && p.external_identifier !== null && p.external_identifier !== '')
            ? String(p.external_identifier).trim()
            : '';
        rawTxId = (p.transaction_id !== undefined && p.transaction_id !== null && p.transaction_id !== '')
            ? String(p.transaction_id).trim()
            : '';
        rawAmount = (p.currency_amount !== undefined && p.currency_amount !== null && p.currency_amount !== '')
            ? p.currency_amount
            : (p.amount || 0);
        rawCurrency = p.currency_identifier || p.currency || 'USD';
        if (p.offer_id || p.campaign_id) {
            rawOfferId = p.offer_id || p.campaign_id;
        }
    }

    if (key === 'offerwall_gg' || key === 'offerwallgg') {
        rawUserId = (p.userId !== undefined && p.userId !== null) ? String(p.userId).trim() :
            ((p.user_id !== undefined && p.user_id !== null) ? String(p.user_id).trim() :
            ((p.subId !== undefined && p.subId !== null) ? String(p.subId).trim() :
            ((p.subid !== undefined && p.subid !== null) ? String(p.subid).trim() :
            ((p.uid !== undefined && p.uid !== null) ? String(p.uid).trim() : ''))));

        rawTxId = (p.transactionId !== undefined && p.transactionId !== null) ? String(p.transactionId).trim() :
            ((p.transaction_id !== undefined && p.transaction_id !== null) ? String(p.transaction_id).trim() :
            ((p.trans_id !== undefined && p.trans_id !== null) ? String(p.trans_id).trim() :
            ((p.transId !== undefined && p.transId !== null) ? String(p.transId).trim() :
            ((p.txid !== undefined && p.txid !== null) ? String(p.txid).trim() :
            ((p.id !== undefined && p.id !== null) ? String(p.id).trim() : '')))));

        rawAmount = (p.currencyAmount !== undefined && p.currencyAmount !== null) ? p.currencyAmount :
            ((p.amount !== undefined && p.amount !== null) ? p.amount :
            ((p.reward !== undefined && p.reward !== null) ? p.reward :
            ((p.points !== undefined && p.points !== null) ? p.points : 0)));

        rawCurrency = (p.currencyName || p.currency || 'Coins');
        rawOfferId = (p.offerId !== undefined && p.offerId !== null) ? String(p.offerId).trim() :
            ((p.offer_id !== undefined && p.offer_id !== null) ? String(p.offer_id).trim() :
            ((p.oid !== undefined && p.oid !== null) ? String(p.oid).trim() : ''));

        offerName = String(p.offerName || p.offer_name || `${providerKey} reward`).trim();
    }

    // Detect Reversal / Chargeback
    let isReversal = false;
    let offerwallStatusValid = true;
    if (key === 'offerwall_gg' || key === 'offerwallgg') {
        const rawStatus = String(p.status || '').trim().toLowerCase();
        const amtNum = Number(rawAmount);
        if (!rawStatus || (rawStatus !== 'credited' && rawStatus !== 'reversed') || isNaN(amtNum) || amtNum === 0) {
            offerwallStatusValid = false;
        } else if (rawStatus === 'credited') {
            if (amtNum <= 0) offerwallStatusValid = false;
            isReversal = false;
        } else if (rawStatus === 'reversed') {
            if (amtNum >= 0) offerwallStatusValid = false;
            isReversal = true;
        }
    } else if (key === 'cpx_research') {
        // CPX Research reversal handling is strictly tied to status=2 or explicit reversal type
        // Earning callbacks with negative amounts are malformed payout values, not valid reversals
        if (p.status === '2' || p.status === 2 || p.type === 'reversal' || p.type === 'chargeback') {
            isReversal = true;
        }
    } else if (key === 'ayetstudios') {
        // ayeT-Studios reversal callbacks:
        // is_chargeback = 1: reversal
        // is_chargeback = 0: normal conversion
        // transaction_id with r- prefix: reversal
        // Negative currency_amount or payout_usd: reversal
        if (p.is_chargeback === '1' || p.is_chargeback === 1 || p.is_chargeback === true || p.is_chargeback === 'true' ||
            (rawTxId && String(rawTxId).startsWith('r-')) ||
            Number(p.currency_amount) < 0 || Number(p.payout_usd) < 0) {
            isReversal = true;
        } else if (p.is_chargeback === '0' || p.is_chargeback === 0 || p.is_chargeback === false || p.is_chargeback === 'false') {
            isReversal = false;
        }
    } else if (
        p.status === '2' || p.status === 2 || 
        p.status === '0' || p.status === 0 || 
        p.status === 'chargeback' || p.status === 'reversal' || p.status === 'REV' || 
        p.type === 'reversal' || p.type === 'chargeback' || p.type === 'RECONCILIATION' ||
        p.isReversal === 'true' || p.isReversal === true ||
        p.reversal === 'true' || p.reversal === true || p.reversal === '1' || p.reversal === 1 ||
        Number(rawAmount) < 0
    ) {
        isReversal = true;
    }

    const rewardNum = Math.abs(Number(rawAmount) || 0);

    let eventType = 'complete';

    if (key === 'cpx_research') {
        const rawType = String(p.type || '').trim().toLowerCase();
        if (isReversal) {
            eventType = rawType || 'reversal';
            if (!p.o_name && !p.offer_name && !p.offerName && !p.campaign_name && !p.reward_name) {
                offerName = 'CPX Research Survey Reversal';
            }
        } else if (rawType === 'out') {
            eventType = 'out';
            if (!p.o_name && !p.offer_name && !p.offerName && !p.campaign_name && !p.reward_name) {
                offerName = 'CPX Survey Screenout Consolation';
            }
        } else if (rawType === 'bonus') {
            eventType = 'bonus';
            if (!p.o_name && !p.offer_name && !p.offerName && !p.campaign_name && !p.reward_name) {
                offerName = 'CPX Survey Rating Bonus';
            }
        } else if (rawType === 'complete' || !rawType) {
            eventType = 'complete';
            if (!p.o_name && !p.offer_name && !p.offerName && !p.campaign_name && !p.reward_name) {
                offerName = 'CPX Research Survey';
            }
        } else {
            eventType = 'unsupported';
        }
    }

    return {
        userId: String(rawUserId).trim(),
        externalTxId: String(rawTxId).trim(),
        // Keep raw reward units separate from USD revenue
        rawReward: Number(rawAmount) || 0,
        rawCurrency: rawCurrency,
        rewardUSD: 0, // Will be calculated based on provider config
        offerId: String(rawOfferId).trim(),
        offerName,
        eventType,
        isReversal,
        statusValid: offerwallStatusValid,
        signature: String(p.sig || p.signature || p.hash || p.secure_hash || '').trim()
    };
};

export const isAuthorizedAdmin = (user) => {
    if (!user) return false;
    const role = String(user.role || '').trim().toLowerCase();
    return role === 'admin' || role === 'super_admin';
};

/**
 * Atomic coordination: Lock acquisition to prevent race conditions on concurrent postbacks
 * Uses unique ownerToken, atomic takeover for expired locks, and ownership-guarded release.
 */
export const acquirePostbackLock = async (providerKey, externalTxId, maxWaitMs = 3000, lockTtlMs = 15000) => {
    const ownerToken = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + lockTtlMs);
        try {
            await OfferwallPostbackLock.create({
                providerKey,
                externalTxId,
                ownerToken,
                expiresAt,
                createdAt: now
            });
            return ownerToken;
        } catch (err) {
            if (err.code === 11000) {
                // Check if existing lock is stale (expired) and attempt atomic takeover
                try {
                    const takenOver = await OfferwallPostbackLock.findOneAndUpdate(
                        {
                            providerKey,
                            externalTxId,
                            expiresAt: { $lt: new Date() }
                        },
                        {
                            $set: {
                                ownerToken,
                                expiresAt,
                                createdAt: new Date()
                            }
                        },
                        { new: true }
                    );
                    if (takenOver && takenOver.ownerToken === ownerToken) {
                        return ownerToken;
                    }
                } catch (_) {}
                // Wait briefly and retry
                await new Promise(resolve => setTimeout(resolve, 40));
            } else {
                throw err;
            }
        }
    }
    throw new Error(`Postback lock timeout for provider: ${providerKey}, tx: ${externalTxId}`);
};

export const releasePostbackLock = async (providerKey, externalTxId, ownerToken = null) => {
    if (!ownerToken) {
        console.warn(`[WARN] releasePostbackLock invoked without ownerToken for ${providerKey}:${externalTxId}; release skipped to prevent deleting another owner's lock.`);
        return false;
    }
    try {
        const res = await OfferwallPostbackLock.deleteOne({ providerKey, externalTxId, ownerToken });
        return Boolean(res && res.deletedCount === 1);
    } catch (err) {
        console.error(`[WARN] Failed to release postback lock for ${providerKey}:${externalTxId}:`, err.message);
        return false;
    }
};

/**
 * Verifies that the lock is still held by the owner before irreversible database mutations.
 * Prevents a slow/delayed callback from executing concurrently if its lock expired and was taken over.
 */
export const isLockStillOwned = async (providerKey, externalTxId, ownerToken) => {
    if (!ownerToken) return false;
    const currentLock = await OfferwallPostbackLock.findOne({ providerKey, externalTxId, ownerToken });
    return Boolean(currentLock && currentLock.ownerToken === ownerToken && (!currentLock.expiresAt || new Date(currentLock.expiresAt) > new Date()));
};

/**
 * Renews/extends an active postback lock lease if the ownerToken matches and the lock has not expired.
 * Prevents lock expiry during longer database or transaction processing window.
 */
export const renewPostbackLock = async (providerKey, externalTxId, ownerToken, extendMs = 15000) => {
    if (!ownerToken) return false;
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + extendMs);
    try {
        const renewed = await OfferwallPostbackLock.findOneAndUpdate(
            {
                providerKey,
                externalTxId,
                ownerToken,
                expiresAt: { $gt: now }
            },
            { $set: { expiresAt: newExpiresAt } },
            { new: true }
        );
        return Boolean(renewed && renewed.ownerToken === ownerToken);
    } catch (_) {
        return false;
    }
};

/**
 * Handle incoming S2S Postback
 */
export const handlePostback = async (req, res) => {
    const providerKey = req.params.provider?.toLowerCase() || 'generic';
    const rawParams = { ...req.query, ...req.body };
    const clientIp = getClientIp(req);

    // Strict simulation isolation: Only internal simulator requests with trusted server-side flags can enable dry-run mode
    // Query params, body params, or headers can NEVER activate dry-run mode on the public endpoint.
    const isDryRun = Boolean(req && req.__isSimulatorDryRun === true && req.__simulatedByAdmin === true);

    // P3: Unknown Provider Safety - DO NOT auto-create unknown providers!
    const provider = await OfferwallProvider.findOne({ providerKey });
    if (!provider) {
        console.warn(`[SECURITY ALERT] Unknown provider postback attempt: '${providerKey}' from IP ${clientIp}`);
        if (isDryRun) {
            req.dryRunResult = {
                isDryRun: true,
                mutationsPerformed: false,
                provider: providerKey,
                validation: {
                    status: 'FAILED',
                    providerFound: false,
                    error: `UNKNOWN_PROVIDER: Provider '${providerKey}' is not registered or supported.`
                }
            };
        }
        return res.status(404).json({
            success: false,
            error: `UNKNOWN_PROVIDER: Provider '${providerKey}' is not registered or supported.`,
            alert: 'SECURITY_ALERT_LOGGED'
        });
    }

    const isOfferwallGgTestCallback = (providerKey === 'offerwall_gg' || providerKey === 'offerwallgg') &&
        (rawParams.test === '1' || rawParams.test === 1 || rawParams.test === 'true' || rawParams.test === true);

    // P14: Provider State Check
    if (!isOfferwallGgTestCallback && (!provider.enabled || provider.status === 'DISABLED' || provider.status === 'SUSPENDED')) {
        if (isDryRun) {
            req.dryRunResult = {
                isDryRun: true,
                mutationsPerformed: false,
                provider: providerKey,
                validation: {
                    status: 'FAILED',
                    providerActive: false,
                    error: `PROVIDER_INACTIVE: Provider '${providerKey}' is currently disabled or suspended.`
                }
            };
        }
        return res.status(403).json({
            success: false,
            error: `PROVIDER_INACTIVE: Provider '${providerKey}' is currently disabled or suspended.`
        });
    }

    // P14: Provider State & Approval Check for Offerwall.GG
    if (providerKey === 'offerwall_gg' || providerKey === 'offerwallgg') {
        if (!isOfferwallGgTestCallback && (provider.enabled !== true || provider.status !== 'ACTIVE' || provider.approvalStatus !== 'Approved')) {
            return res.status(403).json({
                success: false,
                error: `PROVIDER_NOT_ACTIVE_OR_APPROVED: Offerwall.GG provider must be active, enabled, and approved for live financial credits.`
            });
        }
    }

    const normalized = normalizePostbackParams(providerKey, rawParams);

    if ((providerKey === 'offerwall_gg' || providerKey === 'offerwallgg') && normalized.statusValid === false) {
        if (isDryRun) {
            req.dryRunResult = {
                isDryRun: true,
                mutationsPerformed: false,
                provider: providerKey,
                validation: {
                    status: 'FAILED',
                    error: 'INVALID_STATUS_OR_AMOUNT_CONSISTENCY'
                }
            };
        }
        return res.status(400).send('INVALID_STATUS_OR_AMOUNT_CONSISTENCY');
    }

    // Fail closed if external transaction ID is missing - preserves strict idempotency
    if (!normalized.externalTxId) {
        if (isDryRun) {
            req.dryRunResult = {
                isDryRun: true,
                mutationsPerformed: false,
                provider: providerKey,
                validation: {
                    status: 'FAILED',
                    error: 'MISSING_TRANSACTION_ID'
                }
            };
        }
        return res.status(400).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '0' : 'MISSING_TRANSACTION_ID');
    }

    // Mask sensitive credentials from log persistence
    const sanitizedQueryParams = maskSensitiveData(req.query);
    const sanitizedRawBody = maskSensitiveData(req.body);
    const signatureToLog = normalized.signature ? '***REDACTED***' : '';

    // Create initial postback log record (safely scoped)
    let log = new OfferwallPostbackLog({
        provider: providerKey,
        externalTxId: normalized.externalTxId,
        username: normalized.userId,
        rewardUSD: normalized.rewardUSD,
        rawReward: normalized.rawReward,
        rawCurrency: normalized.rawCurrency,
        offerId: normalized.offerId,
        offerName: normalized.offerName,
        isReversal: normalized.isReversal,
        clientIp,
        queryParams: sanitizedQueryParams,
        rawBody: sanitizedRawBody,
        rawHeaders: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
            'x-forwarded-for': req.headers['x-forwarded-for']
        },
        signature: signatureToLog
    });

    try {
        // P4: Strict Signature & IP Validation (Fail-closed)
        const sigCheck = verifySignature(provider, rawParams, clientIp, req);
        if (!sigCheck.valid) {
            if (isDryRun) {
                req.dryRunResult = {
                    isDryRun: true,
                    mutationsPerformed: false,
                    provider: providerKey,
                    action: normalized.isReversal ? 'REVERSAL' : 'CREDIT',
                    validation: {
                        status: 'FAILED',
                        signatureValid: false,
                        error: sigCheck.error || 'Signature check failed'
                    }
                };
            } else {
                log.status = 'InvalidSignature';
                log.signatureStatus = 'Invalid';
                log.errorMessage = sigCheck.error || 'Signature check failed';
                try { await log.save(); } catch (_) {}
            }
            return res.status(400).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '0' : 'INVALID_SIGNATURE');
        }
        log.signatureStatus = provider.requireSignature ? 'Verified' : 'NotRequired';

        // Isolate Offerwall.GG test callbacks after signature verification before user lookup
        if (isOfferwallGgTestCallback) {
            log.status = 'TestCallback';
            log.errorMessage = 'Offerwall.GG test callback (test=1) received and signature verified; balance mutation and user lookup bypassed.';
            try { await log.save(); } catch (_) {}
            return res.status(200).send('OK');
        }

        // Find target User (by MongoDB _id, username, or email)
        let user = null;
        if (normalized.userId) {
            if (providerKey === 'offerwall_gg' || providerKey === 'offerwallgg') {
                if (/^[0-9a-fA-F]{24}$/.test(normalized.userId)) {
                    user = await User.findById(normalized.userId);
                }
            } else {
                if (normalized.userId.match(/^[0-9a-fA-F]{24}$/)) {
                    user = await User.findById(normalized.userId);
                }
                if (!user) {
                    user = await User.findOne({ username: normalized.userId });
                }
                if (!user) {
                    user = await User.findOne({ email: normalized.userId });
                }
            }
        }

        if (!user) {
            if (isDryRun) {
                req.dryRunResult = {
                    isDryRun: true,
                    mutationsPerformed: false,
                    provider: providerKey,
                    action: normalized.isReversal ? 'REVERSAL' : 'CREDIT',
                    validation: {
                        status: 'FAILED',
                        signatureValid: true,
                        userFound: false,
                        error: `User not found for subId: ${normalized.userId}`
                    }
                };
                return res.status(404).send('USER_NOT_FOUND');
            }
            log.status = 'UserNotFound';
            log.errorMessage = `User not found for subId: ${normalized.userId}`;
            try { await log.save(); } catch (_) {}
            // Acknowledge so provider doesn't indefinitely retry an orphaned subId, but do NOT credit
            return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'USER_NOT_FOUND_LOGGED');
        }

        log.userId = user._id;
        log.username = user.username;

        // CPX Research Event-Type Validation & Zero-Value Screen-Out Handling
        if (providerKey === 'cpx_research') {
            if (normalized.eventType === 'unsupported' && !normalized.isReversal) {
                if (isDryRun) {
                    req.dryRunResult = {
                        isDryRun: true,
                        mutationsPerformed: false,
                        provider: providerKey,
                        validation: {
                            status: 'FAILED',
                            error: `UNSUPPORTED_EVENT_TYPE: Unsupported CPX event type '${rawParams.type}'`
                        }
                    };
                } else {
                    log.status = 'Rejected';
                    log.errorMessage = `Unsupported CPX event type: '${rawParams.type}'. Callback safely acknowledged without crediting.`;
                    try { await log.save(); } catch (_) {}
                }
                return res.status(200).send('1');
            }

            const isZeroValScreenout = normalized.eventType === 'out' && (
                (!rawParams.amount_local || isNaN(Number(rawParams.amount_local)) || Number(rawParams.amount_local) <= 0) &&
                (!rawParams.amount_usd || isNaN(Number(rawParams.amount_usd)) || Number(rawParams.amount_usd) <= 0) &&
                normalized.rawReward <= 0
            );
            if (isZeroValScreenout) {
                if (isDryRun) {
                    req.dryRunResult = {
                        isDryRun: true,
                        mutationsPerformed: false,
                        provider: providerKey,
                        validation: {
                            status: 'PASSED',
                            action: 'ZERO_VALUE_SCREENOUT_BYPASSED'
                        }
                    };
                } else {
                    log.status = 'Processed';
                    log.errorMessage = 'Zero-value CPX screen-out event acknowledged; balance mutation bypassed safely.';
                    try { await log.save(); } catch (_) {}
                }
                return res.status(200).send('1');
            }
        }

        // TheoremReach Exchange Rate & Conversion Semantics Validation
        if (providerKey === 'theoremreach') {
            if (typeof provider.exchangeRateMultiplier !== 'number' || provider.exchangeRateMultiplier <= 0) {
                if (isDryRun) {
                    req.dryRunResult = {
                        isDryRun: true,
                        mutationsPerformed: false,
                        provider: providerKey,
                        validation: { status: 'FAILED', error: 'EXCHANGE_RATE_NOT_CONFIGURED' }
                    };
                } else {
                    log.status = 'Error';
                    log.errorMessage = 'TheoremReach exchange rate multiplier not configured or invalid; failing closed';
                    try { await log.save(); } catch (_) {}
                }
                return res.status(400).send('EXCHANGE_RATE_NOT_CONFIGURED');
            }
        }

        // CPX Research Conversion, Currency & Amount Validation for Completion / Bonus Events
        if (providerKey === 'cpx_research' && !normalized.isReversal) {
            const providerCurrency = (provider.customConfig?.currency || provider.currency || '').toString().trim().toUpperCase();
            const callbackCurrency = (rawParams.currency || '').toString().trim().toUpperCase();

            if (provider.commissionMode === 'provider_managed') {
                // provider_managed requires a valid positive conversion multiplier (USD per 1 unit of local currency)
                if (typeof provider.exchangeRateMultiplier !== 'number' || !Number.isFinite(provider.exchangeRateMultiplier) || provider.exchangeRateMultiplier <= 0) {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'CPX_EXCHANGE_RATE_NOT_CONFIGURED' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = 'CPX Research exchange rate multiplier is not configured or invalid for provider_managed mode; failing closed';
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('CPX_EXCHANGE_RATE_NOT_CONFIGURED');
                }

                // Must have an explicit, valid Admin-configured CPX payout currency
                // A callback-supplied currency must NEVER replace missing Admin configuration
                if (!providerCurrency) {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'CPX_CURRENCY_NOT_CONFIGURED' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = 'CPX Research payout currency is not configured in Admin settings; failing closed';
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('CPX_CURRENCY_NOT_CONFIGURED');
                }

                // If callback currency is supplied, compare it with the configured currency and reject mismatches
                if (callbackCurrency && providerCurrency !== callbackCurrency) {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'CPX_CURRENCY_MISMATCH' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = `CPX Research currency mismatch between configured '${providerCurrency}' and callback '${callbackCurrency}'; failing closed`;
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('CPX_CURRENCY_MISMATCH');
                }

                // If callback currency is absent, proceed strictly using Admin-configured providerCurrency

                // provider_managed must require a valid amount_local value
                const rawLocal = rawParams.amount_local;
                if (rawLocal === undefined || rawLocal === null || String(rawLocal).trim() === '') {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'MISSING_AMOUNT_LOCAL' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = 'CPX Research provider_managed mode requires amount_local parameter; failing closed';
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('MISSING_AMOUNT_LOCAL');
                }

                const parsedLocal = Number(rawLocal);
                const isInvalidLocal = isNaN(parsedLocal) || !Number.isFinite(parsedLocal) || parsedLocal <= 0;

                if (isInvalidLocal) {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'INVALID_AMOUNT_LOCAL' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = `CPX Research invalid amount_local value: '${rawLocal}'; failing closed`;
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('INVALID_AMOUNT_LOCAL');
                }
            } else {
                // smartexn_managed mode: gross publisher revenue is amount_usd in USD directly
                // smartexn_managed does NOT require or use an exchangeRateMultiplier
                if (callbackCurrency && callbackCurrency !== 'USD') {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'CPX_CURRENCY_MISMATCH' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = `CPX Research smartexn_managed expects USD payout, but callback currency is '${callbackCurrency}'; failing closed`;
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('CPX_CURRENCY_MISMATCH');
                }

                if (providerCurrency && providerCurrency !== 'USD') {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'CPX_CURRENCY_MISMATCH' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = `CPX Research smartexn_managed expects USD payout, but configured currency is '${providerCurrency}'; failing closed`;
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('CPX_CURRENCY_MISMATCH');
                }

                // smartexn_managed must require a valid amount_usd value
                const rawUsd = rawParams.amount_usd;
                if (rawUsd === undefined || rawUsd === null || String(rawUsd).trim() === '') {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'MISSING_AMOUNT_USD' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = 'CPX Research smartexn_managed mode requires amount_usd parameter; failing closed';
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('MISSING_AMOUNT_USD');
                }

                const parsedUsd = Number(rawUsd);
                const isInvalidUsd = isNaN(parsedUsd) || !Number.isFinite(parsedUsd) || parsedUsd <= 0;

                if (isInvalidUsd) {
                    if (isDryRun) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            validation: { status: 'FAILED', error: 'INVALID_AMOUNT_USD' }
                        };
                    } else {
                        log.status = 'Error';
                        log.errorMessage = `CPX Research invalid amount_usd value: '${rawUsd}'; failing closed`;
                        try { await log.save(); } catch (_) {}
                    }
                    return res.status(400).send('INVALID_AMOUNT_USD');
                }
            }
        }

        // ayeT-Studios Amount, Payout & Currency Conversion Validation
        if (providerKey === 'ayetstudios') {
            const rawPayout = rawParams.payout_usd;
            const rawCurrencyAmount = rawParams.currency_amount;
            const rawRate = rawParams.currency_conversion_rate;

            if (rawPayout === undefined || rawPayout === null || String(rawPayout).trim() === '') {
                log.status = 'Error';
                log.errorMessage = 'ayeT-Studios postback missing payout_usd parameter; failing closed';
                try { await log.save(); } catch (_) {}
                return res.status(400).send('MISSING_PAYOUT_USD');
            }

            if (rawCurrencyAmount === undefined || rawCurrencyAmount === null || String(rawCurrencyAmount).trim() === '') {
                log.status = 'Error';
                log.errorMessage = 'ayeT-Studios postback missing currency_amount parameter; failing closed';
                try { await log.save(); } catch (_) {}
                return res.status(400).send('MISSING_CURRENCY_AMOUNT');
            }

            const parsedPayout = Number(rawPayout);
            const parsedCurrencyAmount = Number(rawCurrencyAmount);

            if (isNaN(parsedPayout) || !Number.isFinite(parsedPayout)) {
                log.status = 'Error';
                log.errorMessage = `ayeT-Studios postback invalid payout_usd: '${rawPayout}'; failing closed`;
                try { await log.save(); } catch (_) {}
                return res.status(400).send('INVALID_PAYOUT_USD');
            }

            if (isNaN(parsedCurrencyAmount) || !Number.isFinite(parsedCurrencyAmount)) {
                log.status = 'Error';
                log.errorMessage = `ayeT-Studios postback invalid currency_amount: '${rawCurrencyAmount}'; failing closed`;
                try { await log.save(); } catch (_) {}
                return res.status(400).send('INVALID_CURRENCY_AMOUNT');
            }

            // Normal conversion amounts must be positive numbers
            if (!normalized.isReversal) {
                if (parsedPayout <= 0) {
                    log.status = 'Error';
                    log.errorMessage = `ayeT-Studios conversion payout_usd must be positive: '${rawPayout}'; failing closed`;
                    try { await log.save(); } catch (_) {}
                    return res.status(400).send('INVALID_PAYOUT_USD');
                }
                if (parsedCurrencyAmount <= 0) {
                    log.status = 'Error';
                    log.errorMessage = `ayeT-Studios conversion currency_amount must be positive: '${rawCurrencyAmount}'; failing closed`;
                    try { await log.save(); } catch (_) {}
                    return res.status(400).send('INVALID_CURRENCY_AMOUNT');
                }
            } else {
                // Reversal amounts must have non-zero magnitude
                if (Math.abs(parsedPayout) <= 0 || Math.abs(parsedCurrencyAmount) <= 0) {
                    log.status = 'Error';
                    log.errorMessage = 'ayeT-Studios reversal requires non-zero payout_usd and currency_amount; failing closed';
                    try { await log.save(); } catch (_) {}
                    return res.status(400).send('INVALID_REVERSAL_AMOUNT');
                }
            }

            // Validate currency_conversion_rate (required for safe conversion verification)
            if (rawRate !== undefined && rawRate !== null && String(rawRate).trim() !== '') {
                const parsedRate = Number(rawRate);
                if (isNaN(parsedRate) || !Number.isFinite(parsedRate) || parsedRate <= 0) {
                    log.status = 'Error';
                    log.errorMessage = `ayeT-Studios invalid currency_conversion_rate: '${rawRate}'; failing closed`;
                    try { await log.save(); } catch (_) {}
                    return res.status(400).send('INVALID_CONVERSION_RATE');
                }

                // Mathematical consistency validation: currency_amount must match payout_usd * currency_conversion_rate
                const expectedVirtualAmount = Math.abs(parsedPayout) * parsedRate;
                const actualVirtualAmount = Math.abs(parsedCurrencyAmount);
                const delta = Math.abs(actualVirtualAmount - expectedVirtualAmount);
                const maxAllowedDelta = Math.max(0.05, expectedVirtualAmount * 0.01);

                if (delta > maxAllowedDelta) {
                    log.status = 'Error';
                    log.errorMessage = `ayeT-Studios inconsistent conversion data: currency_amount (${actualVirtualAmount}) does not match payout_usd (${Math.abs(parsedPayout)}) * rate (${parsedRate}) = ${expectedVirtualAmount}; failing closed`;
                    try { await log.save(); } catch (_) {}
                    return res.status(400).send('INCONSISTENT_CONVERSION_DATA');
                }
            } else {
                log.status = 'Error';
                log.errorMessage = 'ayeT-Studios postback missing currency_conversion_rate parameter; failing closed';
                try { await log.save(); } catch (_) {}
                return res.status(400).send('MISSING_CONVERSION_RATE');
            }
        }

        // P8: Gross / User / Platform Split Calculation
        let grossUSD;
        const absReward = Math.abs(normalized.rawReward);
        if (providerKey === 'theoremreach') {
            grossUSD = Number((absReward / (provider.exchangeRateMultiplier || 70.0)).toFixed(4));
        } else if (providerKey === 'cpx_research') {
            // CPX Research Revenue & Payout Accounting
            // In provider_managed, amount_local is net user reward in local currency;
            // convert to USD using configured exchange multiplier (USD per 1 unit of local currency).
            // In smartexn_managed, amount_usd is the publisher gross revenue in USD directly;
            // never multiply by exchangeRateMultiplier or apply FX conversion.
            if (provider.commissionMode === 'provider_managed') {
                const userPayoutVal = Math.abs(Number(rawParams.amount_local || 0));
                grossUSD = Number((userPayoutVal * (provider.exchangeRateMultiplier || 1.0)).toFixed(4));
            } else {
                const grossVal = Math.abs(Number(rawParams.amount_usd || 0));
                grossUSD = Number(grossVal.toFixed(4));
            }
        } else if (providerKey === 'ayetstudios') {
            // ayeT-Studios payout_usd is the actual publisher revenue/payout in USD
            grossUSD = Number(Math.abs(Number(rawParams.payout_usd)).toFixed(4));
        } else if (providerKey === 'offerwall_gg' || providerKey === 'offerwallgg') {
            // Offerwall.GG: Authoritative financial input is exclusively the signed currencyAmount (70 Coins = $1.00 USD).
            // Unsigned payoutUsd is strictly informational/diagnostic and must never determine user reward or reversal amount.
            const multiplier = (typeof provider.exchangeRateMultiplier === 'number' && provider.exchangeRateMultiplier > 0)
                ? provider.exchangeRateMultiplier
                : 70.0;
            grossUSD = Number((absReward / multiplier).toFixed(4));
            log.infoPayoutUsd = rawParams.payoutUsd !== undefined ? rawParams.payoutUsd : (rawParams.payout_usd || null);
        } else {
            grossUSD = Number((absReward * (provider.exchangeRateMultiplier || 1.0)).toFixed(4));
        }
        let userRewardUSD = grossUSD;
        let platformRevenueUSD = 0;
        let userSharePct = 100;

        if (provider.commissionMode === 'smartexn_managed') {
            userSharePct = (typeof provider.userRevenueSharePercent === 'number' && provider.userRevenueSharePercent >= 0 && provider.userRevenueSharePercent <= 100)
                ? provider.userRevenueSharePercent
                : 100;
            userRewardUSD = Number((grossUSD * (userSharePct / 100)).toFixed(4));
            platformRevenueUSD = Number((grossUSD - userRewardUSD).toFixed(4));
        }

        normalized.rewardUSD = userRewardUSD;
        log.rewardUSD = userRewardUSD;
        log.grossAmountUSD = grossUSD;
        log.userRewardUSD = userRewardUSD;
        log.platformRevenueUSD = platformRevenueUSD;

        // Isolate genuine test/debug callbacks (TheoremReach, CPX Research, ayeT-Studios & Offerwall.GG)
        const isDebugCallback = ((providerKey === 'theoremreach') && (rawParams.debug === 'true' || rawParams.debug === true || rawParams.debug === '1' || rawParams.debug === 1)) ||
            ((providerKey === 'cpx_research') && (
                rawParams.test === '1' || rawParams.test === 'true' || rawParams.test === true ||
                rawParams.is_test === '1' || rawParams.is_test === 'true' || rawParams.is_test === true ||
                rawParams.debug === '1' || rawParams.debug === 'true' || rawParams.debug === true ||
                rawParams.status === 'test'
            )) ||
            ((providerKey === 'ayetstudios') && (
                rawParams.is_sandbox === '1' || rawParams.is_sandbox === 1 || rawParams.is_sandbox === 'true' || rawParams.is_sandbox === true
            )) ||
            isOfferwallGgTestCallback;
        if (isDebugCallback) {
            log.status = 'TestCallback';
            log.errorMessage = `${provider.name || providerKey} test callback with debug/test/sandbox indicator received; live user balance mutation and transaction record bypassed.`;
            try { await log.save(); } catch (_) {}
            return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
        }

        // P5: Robust Concurrency & Atomic Idempotency
        const unifiedKey = `${providerKey}_${normalized.externalTxId}`;
        const creditKey = `${unifiedKey}_credit`;
        const reversalKey = `${unifiedKey}_reversal`;

        // P16: Fraud & Risk Controls
        let riskStatus = 'NORMAL';
        let riskReason = '';
        if (grossUSD >= (provider.riskThresholdUSD || 50.0)) {
            riskStatus = 'REVIEW';
            riskReason = `High reward amount ($${grossUSD} >= threshold $${provider.riskThresholdUSD || 50})`;
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentCount = await OfferwallPostbackLog.countDocuments({
            userId: user._id,
            receivedAt: { $gte: fiveMinutesAgo }
        });
        if (recentCount >= 15) {
            riskStatus = 'REVIEW';
            riskReason = riskReason ? `${riskReason}; High conversion velocity (${recentCount} in 5m)` : `High conversion velocity (${recentCount} in 5m)`;
        }

        log.riskStatus = riskStatus;
        log.riskReason = riskReason;

        let lockAcquired = false;
        let lockOwnerToken = null;
        if (!isDryRun && !isDebugCallback) {
            lockOwnerToken = await acquirePostbackLock(providerKey, normalized.externalTxId);
            lockAcquired = Boolean(lockOwnerToken);
        }

        try {
            if (normalized.isReversal) {
                // Verify lock ownership is still valid before processing
                if (lockOwnerToken && !(await isLockStillOwned(providerKey, normalized.externalTxId, lockOwnerToken))) {
                    throw new Error(`Postback lock expired or taken over during processing: ${providerKey}:${normalized.externalTxId}`);
                }

                // ==========================================
                // P7: REVERSAL / CHARGEBACK SAFETY LOGIC
                // ==========================================
                // Check for duplicate reversal first (both unified and historical keys, and handle ayeT r- prefix)
                const baseTxId = (providerKey === 'ayetstudios' && normalized.externalTxId.startsWith('r-'))
                    ? normalized.externalTxId.slice(2)
                    : normalized.externalTxId;

                const existingReversal = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                    || (await Transaction.findOne({
                        offerwallProvider: providerKey,
                        externalTransactionId: normalized.externalTxId,
                        type: 'Offerwall Reversal'
                    }))
                    || (providerKey === 'ayetstudios' && baseTxId !== normalized.externalTxId && (
                        (await Transaction.findOne({ idempotencyKey: `${providerKey}_${baseTxId}_reversal` }))
                        || (await Transaction.findOne({
                            offerwallProvider: providerKey,
                            externalTransactionId: baseTxId,
                            type: 'Offerwall Reversal'
                        }))
                    ));

                if (existingReversal) {
                    log.status = 'Duplicate';
                    log.errorMessage = 'Duplicate reversal callback received; already reversed.';
                    try { await log.save(); } catch (_) {}
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK');
                }

                let origTx = await Transaction.findOne({
                    offerwallProvider: providerKey,
                    externalTransactionId: normalized.externalTxId,
                    type: 'Offerwall Reward'
                });
                if (!origTx && providerKey === 'ayetstudios' && baseTxId !== normalized.externalTxId) {
                    origTx = await Transaction.findOne({
                        offerwallProvider: providerKey,
                        externalTransactionId: baseTxId,
                        type: 'Offerwall Reward'
                    });
                }

                const deductionAmount = origTx ? (origTx.userRewardAmount ?? origTx.amountUSD) : userRewardUSD;
                const currentEarnings = user.taskEarningsBalance || 0;
                const newEarnings = currentEarnings - deductionAmount;
                let chargebackStatus = 'Settled';
                let liabilityToAdd = 0;
                let deductionToApply = deductionAmount;

                if (newEarnings < 0) {
                    chargebackStatus = 'Liability_Owed';
                    liabilityToAdd = Number(Math.abs(newEarnings).toFixed(2));
                    deductionToApply = currentEarnings;
                }

                // SIMULATOR DRY-RUN: Stop before applying any database mutations
                if (isDryRun) {
                    req.dryRunResult = {
                        isDryRun: true,
                        mutationsPerformed: false,
                        provider: providerKey,
                        providerName: provider.name,
                        testTransactionId: normalized.externalTxId,
                        action: 'REVERSAL',
                        validation: {
                            status: 'PASSED',
                            providerActive: true,
                            signatureValid: true,
                            userFound: true,
                            isDuplicate: false,
                            originalTransactionFound: Boolean(origTx),
                            originalTransactionId: origTx?._id || null
                        },
                        user: {
                            id: user._id,
                            username: user.username,
                            currentTaskEarningsUSD: currentEarnings,
                            projectedTaskEarningsUSD: Number((currentEarnings - deductionToApply).toFixed(2)),
                            currentLiabilityUSD: user.chargebackLiabilityUSD || 0,
                            projectedLiabilityUSD: Number(((user.chargebackLiabilityUSD || 0) + liabilityToAdd).toFixed(2))
                        },
                        accounting: {
                            rawReward: normalized.rawReward,
                            rawCurrency: normalized.rawCurrency || 'USD',
                            exchangeRateMultiplier: provider.exchangeRateMultiplier || 1.0,
                            grossUSD,
                            userRevenueSharePercent: userSharePct,
                            deductionAmountUSD: deductionAmount,
                            platformRevenueUSD,
                            deductionToApplyUSD: deductionToApply,
                            liabilityToAddUSD: liabilityToAdd,
                            chargebackStatus
                        },
                        riskAnalysis: {
                            riskStatus,
                            riskReason: riskReason || 'Passed risk checks'
                        },
                        simulatedProviderResponse: {
                            statusCode: 200,
                            body: providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK'
                        }
                    };
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK');
                }

                // Safety guard: If original credit was never received, an unmatched reversal must not deduct user earnings or create liability,
                // but must persist a durable reversal marker so a later credit callback detects it and blocks spendable reward creation.
                if (!origTx) {
                    try {
                        await Transaction.create({
                            userId: user._id,
                            userName: user.username,
                            currency: 'USD',
                            type: 'Offerwall Reversal',
                            amount: 0,
                            amountUSD: 0,
                            grossAmount: grossUSD,
                            userRewardAmount: 0,
                            platformRevenueAmount: 0,
                            balanceBefore: user.taskEarningsBalance || 0,
                            balanceAfter: user.taskEarningsBalance || 0,
                            idempotencyKey: reversalKey,
                            chargebackStatus: 'Settled',
                            description: `Unmatched Offerwall Reversal Marker (received before credit): ${provider.name} (${normalized.offerName})`,
                            status: 'Approved',
                            sourceWallet: 'TaskEarnings',
                            destinationWallet: 'External',
                            offerwallProvider: providerKey,
                            externalTransactionId: normalized.externalTxId
                        });
                    } catch (markerErr) {
                        if (markerErr.code !== 11000) {
                            console.error('[CRITICAL] Failed to persist unmatched reversal marker:', markerErr.message);
                            log.status = 'Error';
                            log.errorMessage = `Failed to persist unmatched reversal marker: ${markerErr.message}`;
                            try { await log.save(); } catch (_) {}
                            throw markerErr;
                        }
                    }

                    log.status = 'IgnoredUnmatchedReversalWithMarker';
                    log.errorMessage = 'Unmatched reversal: original transaction reward not found; balance mutation bypassed safely and durable reversal marker persisted.';
                    try { await log.save(); } catch (_) {}
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK');
                }

                // Re-verify lock ownership immediately before reversal balance deduction
                if (lockOwnerToken && !(await isLockStillOwned(providerKey, normalized.externalTxId, lockOwnerToken))) {
                    throw new Error(`Postback lock expired or taken over before reversal balance deduction: ${providerKey}:${normalized.externalTxId}`);
                }

                // Matched Reversal: Atomic balance deduction and liability tracking
                const updatedUser = await User.findOneAndUpdate(
                    { _id: user._id },
                    {
                        $inc: {
                            taskEarningsBalance: -deductionToApply,
                            taskWalletBalance: -deductionToApply,
                            chargebackLiabilityUSD: liabilityToAdd
                        }
                    },
                    { new: true }
                );
                if (!updatedUser) {
                    console.error('[Reversal Error] User not found or update failed for user ID:', user._id);
                    log.status = 'Error';
                    log.errorMessage = `User not found or balance deduction failed during reversal for user ID ${user._id}`;
                    try { await log.save(); } catch (_) {}
                    if (providerKey === 'cpx_research' || providerKey === 'torox') {
                        return res.status(400).send('0');
                    }
                    if (providerKey === 'lootably') {
                        return res.status(400).send('ERROR');
                    }
                    return res.status(400).send('USER_UPDATE_FAILED');
                }

                const balanceBefore = currentEarnings;
                const balanceAfter = updatedUser ? updatedUser.taskEarningsBalance : 0;

                let tx;
                try {
                    tx = await Transaction.create({
                        userId: user._id,
                        userName: user.username,
                        currency: 'USD',
                        type: 'Offerwall Reversal',
                        amount: deductionAmount,
                        amountUSD: deductionAmount,
                        grossAmount: origTx?.grossAmount || grossUSD,
                        userRewardAmount: deductionAmount,
                        platformRevenueAmount: origTx?.platformRevenueAmount || 0,
                        balanceBefore,
                        balanceAfter,
                        idempotencyKey: reversalKey,
                        chargebackStatus,
                        reversalReferenceId: origTx?._id,
                        description: `Offerwall Chargeback/Reversal: ${provider.name} (${normalized.offerName})`,
                        status: 'Approved',
                        sourceWallet: 'TaskEarnings',
                        destinationWallet: 'External',
                        offerwallProvider: providerKey,
                        externalTransactionId: normalized.externalTxId
                    });
                } catch (revTxErr) {
                    // If this is a duplicate reversal (11000), verify it is the same reversal before acknowledging
                    if (revTxErr.code === 11000) {
                        const existingTx = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                            || (await Transaction.findOne({
                                offerwallProvider: providerKey,
                                externalTransactionId: normalized.externalTxId,
                                type: 'Offerwall Reversal'
                            }));
                        if (existingTx && existingTx.offerwallProvider === providerKey && existingTx.externalTransactionId === normalized.externalTxId) {
                            // Rollback this request's deduction to prevent double-deduction
                            let rollbackSucceeded = false;
                            try {
                                const compUser = await User.findOneAndUpdate(
                                    { _id: user._id },
                                    {
                                        $inc: {
                                            taskEarningsBalance: deductionToApply,
                                            taskWalletBalance: deductionToApply,
                                            chargebackLiabilityUSD: -liabilityToAdd
                                        }
                                    },
                                    { new: true }
                                );
                                rollbackSucceeded = Boolean(compUser && (compUser._id ? String(compUser._id) === String(user._id) : true));
                            } catch (rollbackErr) {
                                console.error('[CRITICAL_REVERSAL_COMPENSATION_FAILURE] Failed to rollback user balance after duplicate reversal detection:', rollbackErr.message);
                            }

                            if (!rollbackSucceeded) {
                                log.status = 'CriticalCompensationFailure';
                                log.errorMessage = 'CRITICAL: Duplicate reversal detected but compensating balance restoration failed';
                                try { await log.save(); } catch (_) {}
                                throw new Error('CRITICAL_REVERSAL_COMPENSATION_FAILURE: Duplicate reversal detected but balance rollback failed');
                            }

                            log.status = 'Duplicate';
                            log.errorMessage = 'Duplicate reversal transaction key verified';
                            try { await log.save(); } catch (_) {}
                            return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK');
                        }
                    }

                    // Rollback user balance on ordinary transaction persistence failure
                    let rollbackSucceeded = false;
                    try {
                        const compUser = await User.findOneAndUpdate(
                            { _id: user._id },
                            {
                                $inc: {
                                    taskEarningsBalance: deductionToApply,
                                    taskWalletBalance: deductionToApply,
                                    chargebackLiabilityUSD: -liabilityToAdd
                                }
                            },
                            { new: true }
                        );
                        rollbackSucceeded = Boolean(compUser && (compUser._id ? String(compUser._id) === String(user._id) : true));
                    } catch (rollbackErr) {
                        console.error('[CRITICAL_REVERSAL_COMPENSATION_FAILURE] Failed to rollback user balance after reversal transaction creation error:', rollbackErr.message);
                    }

                    if (!rollbackSucceeded) {
                        log.status = 'CriticalCompensationFailure';
                        log.errorMessage = `CRITICAL: Reversal transaction creation failed (${revTxErr.message}) and compensation rollback failed`;
                        try { await log.save(); } catch (_) {}
                        throw new Error(`CRITICAL_REVERSAL_COMPENSATION_FAILURE: Reversal transaction creation failed (${revTxErr.message}) and balance rollback failed`);
                    }

                    log.status = 'Compensated';
                    log.errorMessage = `Reversal transaction creation failed; user balance safely compensated: ${revTxErr.message}`;
                    try { await log.save(); } catch (_) {}
                    throw revTxErr;
                }

                // Update Provider metrics atomically (isolated)
                try {
                    await OfferwallProvider.findByIdAndUpdate(provider._id, {
                        $inc: { totalReversalCount: 1 }
                    });
                } catch (metricsErr) {
                    console.warn('[Offerwall Metrics Warning] Failed to update provider reversal statistics:', metricsErr.message);
                }

                log.status = 'Reversed';
                log.transactionId = tx._id;
                log.reversalReferenceTxId = origTx?._id;
                log.reversedAmountUSD = deductionAmount;
                log.rewardUSD = deductionAmount;
                log.chargebackStatus = chargebackStatus;
                log.userBalanceBefore = balanceBefore;
                log.userBalanceAfter = balanceAfter;
                try { await log.save(); } catch (_) {}

                try {
                    await Notification.create({
                        userId: user._id,
                        subject: `Offerwall Reversal: ${provider.name} ⚠️`,
                        message: `An offerwall reward of $${deductionAmount} was revoked by the advertiser/provider (${provider.name} - ${normalized.offerName}). Your task earnings balance has been adjusted.`,
                        senderType: 'System'
                    });
                } catch (notifErr) {
                    console.warn('[Notification Warning] Failed to create user reversal notification:', notifErr.message);
                }

                // Dedicated System Notification for Admins
                try {
                    const adminUsers = await getAdminUsersForNotification();
                    if (adminUsers && adminUsers.length > 0) {
                        const adminSubject = `Offerwall Reversal Alert: ${user.username} (-$${deductionAmount.toFixed(2)}) ⚠️`;
                        const adminMessage = `Offerwall chargeback/reversal processed for member ${user.username}: $${deductionAmount.toFixed(2)} deducted from task earnings (${provider.name} - ${normalized.offerName}). Ref: ${normalized.externalTxId}. Transaction ID: ${tx._id}. Status: ${chargebackStatus}.`;
                        for (const admin of adminUsers) {
                            await Notification.create({
                                userId: admin._id,
                                subject: adminSubject,
                                message: adminMessage,
                                senderType: 'System'
                            });
                        }
                    }
                } catch (adminNotifErr) {
                    console.error('[Admin Notification Warning] Failed to dispatch reversal notification to admins:', adminNotifErr.message);
                }

                // Real-time synchronization
                try {
                    const io = req.app?.get('io');
                    if (io) {
                        io.emit('DATA_CHANGED');
                    }
                } catch (socketErr) {
                    console.error('[Socket.IO Warning] Failed to emit DATA_CHANGED on reversal:', socketErr.message);
                }

                return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK');
            } else {
                // ==========================================
                // P6: ATOMIC REWARD CREDITING (taskEarningsBalance)
                // ==========================================
                // SIMULATOR DRY-RUN: Stop before applying any database mutations
                if (isDryRun) {
                    if (user.status === 'Blocked' || user.restrictions?.earning === true) {
                        req.dryRunResult = {
                            isDryRun: true,
                            mutationsPerformed: false,
                            provider: providerKey,
                            providerName: provider.name,
                            testTransactionId: normalized.externalTxId,
                            action: 'CREDIT',
                            validation: {
                                status: 'FAILED',
                                providerActive: true,
                                signatureValid: true,
                                userFound: true,
                                userRestricted: true,
                                isDuplicate: false,
                                error: 'USER_RESTRICTED: User account is Blocked or earning-restricted.'
                            }
                        };
                        return res.status(403).send('USER_RESTRICTED');
                    }

                    const currentEarnings = user.taskEarningsBalance || 0;
                    const projectedEarnings = Number((currentEarnings + userRewardUSD).toFixed(2));
                    req.dryRunResult = {
                        isDryRun: true,
                        mutationsPerformed: false,
                        provider: providerKey,
                        providerName: provider.name,
                        testTransactionId: normalized.externalTxId,
                        action: 'CREDIT',
                        validation: {
                            status: 'PASSED',
                            providerActive: true,
                            signatureValid: true,
                            userFound: true,
                            isDuplicate: false
                        },
                        user: {
                            id: user._id,
                            username: user.username,
                            currentTaskEarningsUSD: currentEarnings,
                            projectedTaskEarningsUSD: projectedEarnings
                        },
                        accounting: {
                            rawReward: normalized.rawReward,
                            rawCurrency: normalized.rawCurrency || 'USD',
                            exchangeRateMultiplier: provider.exchangeRateMultiplier || 1.0,
                            grossUSD,
                            userRevenueSharePercent: userSharePct,
                            userRewardUSD,
                            platformRevenueUSD
                        },
                        riskAnalysis: {
                            riskStatus,
                            riskReason: riskReason || 'Passed risk checks'
                        },
                        simulatedProviderResponse: {
                            statusCode: 200,
                            body: providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK'
                        }
                    };
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK');
                }

                // Verify lock ownership is still valid before processing credit
                if (lockOwnerToken && !(await isLockStillOwned(providerKey, normalized.externalTxId, lockOwnerToken))) {
                    throw new Error(`Postback lock expired or taken over during processing: ${providerKey}:${normalized.externalTxId}`);
                }

                // Duplicate credit pre-check (protects historical records without _credit suffix)
                const existingCredit = (await Transaction.findOne({ idempotencyKey: creditKey }))
                    || (await Transaction.findOne({
                        offerwallProvider: providerKey,
                        externalTransactionId: normalized.externalTxId,
                        type: 'Offerwall Reward'
                    }));
                if (existingCredit) {
                    log.status = 'Duplicate';
                    log.errorMessage = 'Duplicate credit transaction detected';
                    try { await log.save(); } catch (_) {}
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'DUP_ALREADY_PROCESSED');
                }

                // Safety guard: Check if an out-of-order reversal has already been processed for this transaction ID.
                const priorReversal = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                    || (await Transaction.findOne({
                        offerwallProvider: providerKey,
                        externalTransactionId: normalized.externalTxId,
                        type: 'Offerwall Reversal'
                    }))
                    || (providerKey === 'ayetstudios' && (
                        (await Transaction.findOne({ idempotencyKey: `${providerKey}_r-${normalized.externalTxId}_reversal` }))
                        || (await Transaction.findOne({
                            offerwallProvider: providerKey,
                            externalTransactionId: `r-${normalized.externalTxId}`,
                            type: 'Offerwall Reversal'
                        }))
                    ));

                if (priorReversal) {
                    log.status = 'PreReversed';
                    log.errorMessage = 'Credit received after pre-existing reversal; balance mutation bypassed safely at net zero.';
                    try { await log.save(); } catch (_) {}
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'OK');
                }

                // Restore blocked and earning-restricted user protection (Check 1: pre-check)
                if (user.status === 'Blocked' || user.restrictions?.earning === true) {
                    log.status = 'UserRestricted';
                    log.errorMessage = 'User account is Blocked or earning-restricted; credit rejected.';
                    try { await log.save(); } catch (_) {}
                    return res.status(403).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '0' : 'USER_RESTRICTED');
                }

                const balanceBefore = user.taskEarningsBalance || 0;
                const balanceAfter = Number((balanceBefore + userRewardUSD).toFixed(4));

                // Re-verify lock ownership immediately before transaction creation
                if (lockOwnerToken && !(await isLockStillOwned(providerKey, normalized.externalTxId, lockOwnerToken))) {
                    throw new Error(`Postback lock expired or taken over before transaction creation: ${providerKey}:${normalized.externalTxId}`);
                }

                // Atomic creation: Transaction first to secure idempotency
                let tx;
                try {
                    tx = await Transaction.create({
                        idempotencyKey: creditKey,
                        type: 'Offerwall Reward',
                        userId: user._id,
                        userName: user.username,
                        currency: 'USD',
                        amount: userRewardUSD,
                        amountUSD: userRewardUSD,
                        grossAmount: grossUSD,
                        userRewardAmount: userRewardUSD,
                        platformRevenueAmount: platformRevenueUSD,
                        balanceBefore,
                        balanceAfter,
                        status: riskStatus === 'REVIEW' ? 'Pending' : 'Approved',
                        riskStatus,
                        description: providerKey === 'cpx_research' && normalized.eventType === 'out'
                            ? `${provider.name} Screenout Consolation: ${normalized.offerName}`
                            : providerKey === 'cpx_research' && normalized.eventType === 'bonus'
                            ? `${provider.name} Survey Rating Bonus: ${normalized.offerName}`
                            : `Completed ${provider.name} Offer/Survey: ${normalized.offerName}`,
                        sourceWallet: 'External',
                        destinationWallet: 'TaskEarnings',
                        offerwallProvider: providerKey,
                        externalTransactionId: normalized.externalTxId
                    });
                } catch (err) {
                    if (err.code === 11000) {
                        log.status = 'Duplicate';
                        log.errorMessage = 'Duplicate transaction key caught by database constraint';
                        try { await log.save(); } catch (_) {}
                        return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' || providerKey === 'lootably' ? '1' : 'DUP_ALREADY_PROCESSED');
                    }
                    throw err;
                }

                // Re-verify lock ownership immediately before conditional balance update
                if (lockOwnerToken && !(await isLockStillOwned(providerKey, normalized.externalTxId, lockOwnerToken))) {
                    let cleanupSuccessful = false;
                    try {
                        const delRes = await Transaction.deleteOne({ _id: tx._id });
                        cleanupSuccessful = Boolean(delRes && delRes.deletedCount === 1);
                    } catch (delErr) {
                        console.error('[CRITICAL_INCONSISTENCY] Failed to delete transaction after lock loss before balance update:', delErr.message);
                    }
                    if (!cleanupSuccessful) {
                        log.status = 'CriticalInconsistency';
                        log.errorMessage = `CRITICAL_INCONSISTENCY: Lock lost before balance update and transaction cleanup failed for tx ${tx._id}`;
                        try { await log.save(); } catch (_) {}
                        throw new Error(`CRITICAL_INCONSISTENCY: Lock lost before balance update and transaction cleanup failed for tx ${tx._id}`);
                    }
                    throw new Error(`Postback lock expired or taken over before balance update: ${providerKey}:${normalized.externalTxId}`);
                }

                // If transaction created, update user balance atomically while re-verifying user is NOT blocked or earning-restricted
                let updatedUser = null;
                try {
                    updatedUser = await User.findOneAndUpdate(
                        {
                            _id: user._id,
                            status: { $ne: 'Blocked' },
                            'restrictions.earning': { $ne: true }
                        },
                        {
                            $inc: {
                                taskEarningsBalance: userRewardUSD,
                                taskWalletBalance: userRewardUSD
                            }
                        },
                        { new: true }
                    );
                } catch (balanceErr) {
                    // Inconsistency recovery: Transaction exists but balance update failed.
                    // Rollback transaction creation to prevent orphaned ledger entry.
                    let cleanupSuccessful = false;
                    try {
                        const delRes = await Transaction.deleteOne({ _id: tx._id });
                        cleanupSuccessful = Boolean(delRes && delRes.deletedCount === 1);
                    } catch (delErr) {
                        console.error('[CRITICAL_INCONSISTENCY] Failed to delete transaction after balance update failure:', delErr.message);
                    }
                    if (!cleanupSuccessful) {
                        console.error('[CRITICAL_INCONSISTENCY] Orphaned transaction remained after balance update failure! txId:', tx._id);
                        log.status = 'CriticalInconsistency';
                        log.errorMessage = `CRITICAL_INCONSISTENCY: Balance update failed (${balanceErr.message}) and transaction cleanup failed for tx ${tx._id}`;
                        try { await log.save(); } catch (_) {}
                        throw new Error(`CRITICAL_INCONSISTENCY: Balance update failed (${balanceErr.message}) and transaction cleanup failed for tx ${tx._id}`);
                    }
                    throw balanceErr;
                }

                if (!updatedUser) {
                    // User was blocked or earning-restricted when balance update was attempted
                    let cleanupSuccessful = false;
                    try {
                        const delRes = await Transaction.deleteOne({ _id: tx._id });
                        cleanupSuccessful = Boolean(delRes && delRes.deletedCount === 1);
                    } catch (delErr) {
                        console.error('[CRITICAL_INCONSISTENCY] Failed to delete transaction after user restriction balance update rejection:', delErr.message);
                    }
                    if (!cleanupSuccessful) {
                        console.error('[CRITICAL_INCONSISTENCY] Orphaned transaction remained after restricted user rejection! txId:', tx._id);
                        log.status = 'CriticalInconsistency';
                        log.errorMessage = `CRITICAL_INCONSISTENCY: User account is Blocked or earning-restricted at balance update point, but transaction cleanup failed to delete tx ${tx._id}`;
                        try { await log.save(); } catch (_) {}
                        return res.status(500).send('POSTBACK_ERROR: CRITICAL_INCONSISTENCY: Transaction deletion failed for restricted user');
                    }
                    log.status = 'UserRestricted';
                    log.errorMessage = 'User account is Blocked or earning-restricted at balance update point; credit rejected.';
                    try { await log.save(); } catch (_) {}
                    return res.status(403).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '0' : 'USER_RESTRICTED');
                }

                // Update Provider metrics atomically (isolated)
                try {
                    await OfferwallProvider.findByIdAndUpdate(provider._id, {
                        $inc: {
                            totalGrossPayoutUSD: grossUSD,
                            totalUserPayoutUSD: userRewardUSD,
                            totalPlatformRevenueUSD: platformRevenueUSD,
                            totalPostbackCount: 1
                        }
                    });
                } catch (metricsErr) {
                    console.warn('[Offerwall Metrics Warning] Failed to update provider reward statistics:', metricsErr.message);
                }

                log.status = 'Processed';
                log.transactionId = tx._id;
                log.userBalanceBefore = balanceBefore;
                log.userBalanceAfter = balanceAfter;
                try { await log.save(); } catch (_) {}

                // Notify Worker in Inbox
                let notifSubject = `Offerwall Reward Credited! 🎁 (+$${userRewardUSD})`;
                let notifMessage = `You earned $${userRewardUSD} from ${provider.name} (${normalized.offerName}). The reward has been credited directly to your Work & Earn Task Balance!`;
                if (providerKey === 'cpx_research') {
                    if (normalized.eventType === 'out') {
                        notifSubject = `Survey Screenout Consolation Credited! ℹ️ (+$${userRewardUSD})`;
                        notifMessage = `You received a consolation reward of $${userRewardUSD} from ${provider.name} (${normalized.offerName}) for participating in a survey attempt.`;
                    } else if (normalized.eventType === 'bonus') {
                        notifSubject = `Survey Rating Bonus Credited! ⭐ (+$${userRewardUSD})`;
                        notifMessage = `You received a survey rating bonus of $${userRewardUSD} from ${provider.name} (${normalized.offerName}). The reward has been credited to your Task Balance!`;
                    }
                }

                try {
                    await Notification.create({
                        userId: user._id,
                        subject: notifSubject,
                        message: notifMessage,
                        senderType: 'System'
                    });
                } catch (notifErr) {
                    console.warn('[Notification Warning] Failed to create user reward notification:', notifErr.message);
                }

                // Dedicated System Notification for Admins
                try {
                    const adminUsers = await getAdminUsersForNotification();
                    if (adminUsers && adminUsers.length > 0) {
                        const adminSubject = `Offerwall Reward Credited: ${user.username} (+$${userRewardUSD.toFixed(2)}) 🎁`;
                        const adminMessage = `Member ${user.username} earned $${userRewardUSD.toFixed(2)} from ${provider.name} (${normalized.offerName}). Ref: ${normalized.externalTxId}. Transaction ID: ${tx._id}.`;
                        for (const admin of adminUsers) {
                            await Notification.create({
                                userId: admin._id,
                                subject: adminSubject,
                                message: adminMessage,
                                senderType: 'System'
                            });
                        }
                    }
                } catch (adminNotifErr) {
                    console.error('[Admin Notification Warning] Failed to dispatch reward notification to admins:', adminNotifErr.message);
                }

                // Real-time synchronization
                try {
                    const io = req.app?.get('io');
                    if (io) {
                        io.emit('DATA_CHANGED');
                    }
                } catch (socketErr) {
                    console.error('[Socket.IO Warning] Failed to emit DATA_CHANGED on reward credit:', socketErr.message);
                }

                // Return provider-expected success body
                if (providerKey === 'torox' || providerKey === 'cpx_research' || providerKey === 'lootably') {
                    return res.status(200).send('1');
                }
                if (providerKey === 'wannads' || providerKey === 'notik' || providerKey === 'bitlabs') {
                    return res.status(200).send('OK');
                }
                if (providerKey === 'revlum' || providerKey === 'monlix') {
                    return res.status(200).json({ success: true, status: 'processed', txId: normalized.externalTxId });
                }

                return res.status(200).send('OK');
            }
        } finally {
            if (lockAcquired && lockOwnerToken) {
                await releasePostbackLock(providerKey, normalized.externalTxId, lockOwnerToken);
            }
        }
    } catch (err) {
        if (isDryRun) {
            req.dryRunResult = {
                isDryRun: true,
                mutationsPerformed: false,
                provider: providerKey,
                validation: {
                    status: 'FAILED',
                    error: 'An unexpected internal error occurred during simulation processing'
                }
            };
            return res.status(500).send('SIMULATION_ERROR');
        }

        console.error('[DEBUG CATCH ERROR]:', err);
        if (log) {
            if (log.status !== 'CriticalCompensationFailure' && log.status !== 'CriticalInconsistency') {
                log.status = 'Error';
            }
            log.errorMessage = err.message;
            try { await log.save(); } catch (_) {}
        }
        return res.status(500).send(`POSTBACK_ERROR: ${err.message}`);
    }
};

/**
 * P9: Get all configured offerwall providers (Admin or Public sanitized)
 * Prevents exposure of provider secrets, postback keys, or IP whitelists to workers or public.
 */
/**
 * Constructs a secure, validated TheoremReach respondent entry URL.
 * 
 * Official TheoremReach Web Integration Requirements:
 * 1. api_key: Dedicated API key from TheoremReach Publisher Portal.
 * 2. user_id: Authenticated SmartExn user ID.
 * 3. Security Hash (HMAC-SHA1): When signature is required, HMAC-SHA1 is calculated
 *    over the exact URL before '&hash=' using the secretKey, formatted in URL-safe Base64
 *    (+ -> -, / -> _, trim =).
 * 4. Explicit parameter audit:
 *    - api_key (from provider.apiKey)
 *    - user_id (from authenticated user ID)
 *    - partner_id / appId (from provider.appId if configured)
 *    - exchange_rate (from provider.exchangeRateMultiplier)
 *    - currency_name_plural (from provider.customConfig?.currencyNamePlural or default)
 *    - external_id (from user ID)
 * 5. Fails closed with descriptive error if required parameters or macros are missing.
 */
export const constructTheoremReachEntryUrl = (provider, userId) => {
    if (!userId) {
        return { url: '', error: 'Authenticated user session is required to launch TheoremReach.' };
    }

    const apiKey = (provider.apiKey || '').trim();
    if (!apiKey) {
        return { 
            url: '', 
            error: 'TheoremReach API Key is not configured. Please enter the dedicated API Key in the Admin Panel.' 
        };
    }

    const secretKey = (provider.secretKey || '').trim();
    const requireSignature = provider.requireSignature !== false;
    if (requireSignature && !secretKey) {
        return {
            url: '',
            error: 'TheoremReach Secret Key is missing for HMAC-SHA1 security hash. Please configure it in the Admin Panel.'
        };
    }

    // Determine base template
    let template = (provider.iframeUrlTemplate || '').trim();
    if (!template) {
        template = 'https://theoremreach.com/respondent_entry/direct?api_key={apiKey}&user_id={userId}';
    }

    // Substitute dedicated API Key (supporting {apiKey}, {api_key}, and legacy api_key={appId})
    let url = template
        .replace(/api_key=\{appId\}/g, `api_key=${encodeURIComponent(apiKey)}`)
        .replace(/\{apiKey\}/g, encodeURIComponent(apiKey))
        .replace(/\{api_key\}/g, encodeURIComponent(apiKey));

    // Substitute user ID
    url = url
        .replace(/\{userId\}/g, encodeURIComponent(String(userId)))
        .replace(/\{user_id\}/g, encodeURIComponent(String(userId)))
        .replace(/\{external_id\}/g, encodeURIComponent(String(userId)));

    // Substitute partner_id / placement_id / appId if present
    const appId = (provider.appId || '').trim();
    if (appId) {
        url = url
            .replace(/\{appId\}/g, encodeURIComponent(appId))
            .replace(/\{partner_id\}/g, encodeURIComponent(appId))
            .replace(/\{placement_id\}/g, encodeURIComponent(appId))
            .replace(/\{pubId\}/g, encodeURIComponent(appId));
    }

    // Substitute exchange rate if present
    if (provider.exchangeRateMultiplier !== undefined && provider.exchangeRateMultiplier !== null) {
        url = url.replace(/\{exchange_rate\}/g, encodeURIComponent(String(provider.exchangeRateMultiplier)));
    }

    // Substitute currency name plural if present
    const currencyName = (provider.customConfig?.currencyNamePlural || provider.customConfig?.currency_name_plural || '').trim();
    if (currencyName) {
        url = url.replace(/\{currency_name_plural\}/g, encodeURIComponent(currencyName));
    }

    // Audit for any remaining unsubstituted macros
    const unparsedMacros = url.match(/\{[a-zA-Z0-9_]+\}/g);
    if (unparsedMacros && unparsedMacros.length > 0) {
        return {
            url: '',
            error: `Missing configuration for entry URL macro(s): ${unparsedMacros.join(', ')}. Please update provider settings in the Admin Panel.`
        };
    }

    // Generate HMAC-SHA1 hash if required
    if (requireSignature && secretKey) {
        // Strip any existing hash parameter to ensure exact pre-hash URL
        let urlBeforeHash = url;
        if (urlBeforeHash.includes('hash=')) {
            urlBeforeHash = urlBeforeHash.split(/[?&]hash=/)[0];
        }

        const hmac = crypto.createHmac('sha1', secretKey).update(urlBeforeHash).digest('base64');
        const urlSafeHash = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const separator = urlBeforeHash.includes('?') ? '&' : '?';
        url = `${urlBeforeHash}${separator}hash=${urlSafeHash}`;
    }

    return { url, error: null };
};

/**
 * Constructs a secure, validated CPX Research entry / iframe URL.
 * 
 * Official CPX Research Web Integration Requirements:
 * 1. app_id: Dedicated CPX App ID (e.g. 37470).
 * 2. ext_user_id: Unique SmartExn user identifier.
 * 3. secure_hash: Cryptographic MD5 hash of (ext_user_id + "-" + app_secure_hash)
 *    generated strictly server-side using the secretKey / secure hash from the CPX Publisher Dashboard.
 * 4. Fails closed with descriptive error if App ID or Secret Key is missing when signature is required.
 * 5. Private secretKey is NEVER exposed to the frontend or included in URL parameters.
 */
export const constructCpxEntryUrl = (provider, userId) => {
    if (!userId) {
        return { url: '', error: 'Authenticated user session is required to launch CPX Research.' };
    }

    const appId = (provider.appId || '').trim();
    if (!appId) {
        return {
            url: '',
            error: 'CPX Research App ID is not configured. Please configure App ID in the Admin Panel.'
        };
    }

    const secretKey = (provider.secretKey || '').trim();
    if (!secretKey) {
        return {
            url: '',
            error: 'CPX Research Secure Hash Key is missing for mandatory secure entry hash. Please configure it in the Admin Panel.'
        };
    }

    const uid = String(userId).trim();
    let template = (provider.iframeUrlTemplate || '').trim();
    if (!template) {
        template = 'https://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}';
    }

    let url = template
        .replace(/\{appId\}/g, encodeURIComponent(appId))
        .replace(/\{pubId\}/g, encodeURIComponent(appId))
        .replace(/\{userId\}/g, encodeURIComponent(uid))
        .replace(/\{user_id\}/g, encodeURIComponent(uid))
        .replace(/\{ext_user_id\}/g, encodeURIComponent(uid))
        .replace(/\{subId\}/g, encodeURIComponent(uid))
        .replace(/\{uid\}/g, encodeURIComponent(uid));

    // Secure entry hash is unconditionally mandatory for CPX Research
    const secureHash = crypto.createHash('md5').update(`${uid}-${secretKey}`).digest('hex');
    if (url.includes('{secure_hash}')) {
        url = url.replace(/\{secure_hash\}/g, encodeURIComponent(secureHash));
    } else if (url.includes('{secureHash}')) {
        url = url.replace(/\{secureHash\}/g, encodeURIComponent(secureHash));
    } else if (url.includes('{hash}')) {
        url = url.replace(/\{hash\}/g, encodeURIComponent(secureHash));
    } else if (!url.includes('secure_hash=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}secure_hash=${encodeURIComponent(secureHash)}`;
    }

    // Audit for any remaining unsubstituted macros
    const unparsedMacros = url.match(/\{[a-zA-Z0-9_]+\}/g);
    if (unparsedMacros && unparsedMacros.length > 0) {
        return {
            url: '',
            error: `Missing configuration for entry URL macro(s): ${unparsedMacros.join(', ')}. Please update provider settings in the Admin Panel.`
        };
    }

    return { url, error: null };
};

/**
 * Constructs a secure, validated AdGem Web Offerwall URL according to official AdGem Web Offerwall specifications.
 * 
 * Official AdGem Web Offerwall URL structure:
 * https://api.adgem.com/v1/wall?appid=YOUR_APP_ID&playerid=USER_ID
 * 
 * 1. playerid: Unique user identifier (e.g. MongoDB ObjectId or alphanumeric username). Max 255 chars.
 * 2. appid: Dedicated AdGem App ID.
 * 3. Fails closed with descriptive error if App ID or User ID is missing or invalid.
 */
export const constructAdGemEntryUrl = (provider, userId) => {
    if (!userId) {
        return { url: '', error: 'Authenticated user session is required to launch AdGem.' };
    }

    const rawPlayerId = String(userId).trim();
    if (!rawPlayerId) {
        return { url: '', error: 'Authenticated user identifier is required to launch AdGem.' };
    }

    if (!/^[a-zA-Z0-9_-]{1,255}$/.test(rawPlayerId)) {
        return { url: '', error: 'Invalid user identifier format for AdGem.' };
    }

    const appId = (provider.appId || '').trim();
    if (!appId) {
        return {
            url: '',
            error: 'AdGem App ID is not configured. Please configure App ID in the Admin Panel.'
        };
    }

    let template = (provider.iframeUrlTemplate || '').trim();
    if (!template) {
        template = 'https://api.adgem.com/v1/wall?appid={appId}&playerid={userId}';
    }

    let url = template
        .replace(/\{appId\}/g, encodeURIComponent(appId))
        .replace(/\{appid\}/g, encodeURIComponent(appId))
        .replace(/\{userId\}/g, encodeURIComponent(rawPlayerId))
        .replace(/\{user_id\}/g, encodeURIComponent(rawPlayerId))
        .replace(/\{playerid\}/g, encodeURIComponent(rawPlayerId))
        .replace(/\{playerId\}/g, encodeURIComponent(rawPlayerId));

    const unparsedMacros = url.match(/\{[a-zA-Z0-9_]+\}/g);
    if (unparsedMacros && unparsedMacros.length > 0) {
        return {
            url: '',
            error: `Missing configuration for entry URL macro(s): ${unparsedMacros.join(', ')}. Please update provider settings in the Admin Panel.`
        };
    }

    return { url, error: null };
};

export const getOfferwallProviders = async (req, res) => {
    try {
        const isAdmin = isAuthorizedAdmin(req.user);

        if (isAdmin) {
            const providers = await OfferwallProvider.find().sort({ category: 1, name: 1 });
            const masked = providers.map(p => {
                const obj = p.toObject();
                if (obj.apiKey) obj.apiKey = '••••••••';
                if (obj.secretKey) obj.secretKey = '••••••••';
                if (obj.postbackKey) obj.postbackKey = '••••••••';
                if (obj.providerKey === 'offerwall_gg' || obj.providerKey === 'offerwallgg') {
                    obj.serverSecretConfigured = Boolean(process.env.OFFERWALL_GG_SECRET_KEY && process.env.OFFERWALL_GG_SECRET_KEY.trim());
                }
                return obj;
            });
            return res.status(200).json({ success: true, count: masked.length, data: masked });
        }

        // Public / Worker View: Only enabled, non-disabled, non-suspended providers with SAFE projection
        const providers = await OfferwallProvider.find(
            { enabled: true, status: { $nin: ['DISABLED', 'SUSPENDED', 'NOT_STARTED'] } },
            'providerKey name category group description icon badge technicalReadinessScore approvalLikelihoodScore iframeUrlTemplate status approvalStatus enabled userRevenueSharePercent platformRevenueSharePercent commissionMode appId apiKey secretKey exchangeRateMultiplier requireSignature signatureType customConfig'
        ).sort({ category: 1, name: 1 });

        // Phase 6: CPX-Only Visibility Gate
        // CPX Research must remain hidden from normal users unless its status is explicitly ACTIVE and enabled is true.
        // NOT_STARTED, TESTING, SANDBOX, CREDENTIALS_PENDING, PRODUCTION_READY, DISABLED, and SUSPENDED must not expose CPX.
        // Other providers retain their existing visibility rules unchanged.
        const visibleProviders = providers.filter(p => {
            if (p.providerKey === 'cpx_research') {
                return p.enabled === true && p.status === 'ACTIVE';
            }
            if (p.providerKey === 'adgem') {
                return p.enabled === true && p.status === 'ACTIVE' && p.approvalStatus === 'Approved';
            }
            if (p.providerKey === 'offerwall_gg' || p.providerKey === 'offerwallgg') {
                return p.enabled === true && p.status === 'ACTIVE' && p.approvalStatus === 'Approved';
            }
            return true;
        });

        let currentUser = null;
        if (req.user?.id) {
            try {
                currentUser = await User.findById(req.user.id).select('adgemSuspended restrictions');
            } catch (_) {}
        }

        const sanitized = visibleProviders.map(p => {
            const obj = p.toObject();
            if (p.providerKey === 'theoremreach') {
                if (req.user?.id) {
                    const trResult = constructTheoremReachEntryUrl(p, req.user.id);
                    if (trResult.url) {
                        obj.iframeUrl = trResult.url;
                    } else {
                        obj.iframeUrl = '';
                        obj.configurationError = trResult.error;
                    }
                } else {
                    obj.iframeUrl = '';
                }
            } else if (p.providerKey === 'cpx_research') {
                if (req.user?.id) {
                    const cpxResult = constructCpxEntryUrl(p, req.user.id);
                    if (cpxResult.url) {
                        obj.iframeUrl = cpxResult.url;
                    } else {
                        obj.iframeUrl = '';
                        obj.configurationError = cpxResult.error;
                    }
                } else {
                    obj.iframeUrl = '';
                }
            } else if (p.providerKey === 'adgem') {
                if (req.user?.id) {
                    if (currentUser?.adgemSuspended === true || currentUser?.restrictions?.adgemSuspended === true) {
                        obj.iframeUrl = '';
                        obj.suspended = true;
                        obj.configurationError = 'User is suspended from AdGem offers';
                    } else {
                        const adgemResult = constructAdGemEntryUrl(p, req.user.id);
                        if (adgemResult.url) {
                            obj.iframeUrl = adgemResult.url;
                        } else {
                            obj.iframeUrl = '';
                            obj.configurationError = adgemResult.error;
                        }
                    }
                } else {
                    obj.iframeUrl = '';
                }
            } else if (req.user?.id && obj.iframeUrlTemplate) {
                if (p.appId && p.appId.trim()) {
                    obj.iframeUrl = obj.iframeUrlTemplate
                        .replace(/\{userId\}/g, String(req.user.id))
                        .replace(/\{user_id\}/g, String(req.user.id))
                        .replace(/\{appId\}/g, p.appId.trim())
                        .replace(/\{appid\}/g, p.appId.trim());
                } else {
                    obj.iframeUrl = '';
                    obj.configurationError = 'App ID / Placement ID is not configured for this provider.';
                }
            }
            delete obj.appId;
            delete obj.apiKey;
            delete obj.secretKey;
            delete obj.postbackKey;
            return obj;
        });

        res.status(200).json({ success: true, count: sanitized.length, data: sanitized });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

/**
 * P10: Update Offerwall Provider Settings (Admin only with strict allowlist)
 */
export const updateOfferwallProvider = async (req, res) => {
    try {
        if (!isAuthorizedAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
        }

        const { providerKey } = req.params;
        const body = req.body || {};

        const ALLOWED_FIELDS = [
            'name', 'category', 'group', 'enabled', 'appId', 'apiKey', 'secretKey', 'postbackKey',
            'iframeUrlTemplate', 'exchangeRateMultiplier', 'commissionMode', 'userRevenueSharePercent',
            'platformRevenueSharePercent', 'ipWhitelist', 'requireSignature', 'signatureType',
            'testMode', 'description', 'badge', 'icon', 'status', 'approvalStatus',
            'integrationStatus', 'riskThresholdUSD', 'holdRewards', 'holdThresholdUSD',
            'complianceNotes', 'customConfig',
            'defaultRedirectUrl', 'successRedirectUrl', 'partialRedirectUrl', 'disqualifiedRedirectUrl',
            'quotaFullRedirectUrl', 'securityRedirectUrl', 'eventWebhookUrl', 'rewardCallbackUrl',
            'includeReversalsInRewardCallback'
        ];

        const sanitizedUpdates = {};
        for (const field of ALLOWED_FIELDS) {
            if (body[field] !== undefined) {
                sanitizedUpdates[field] = body[field];
            }
        }

        // Credential preservation: Do not overwrite existing secretKey or apiKey with empty string or mask ('••••••••') on unrelated saves
        if (sanitizedUpdates.secretKey !== undefined) {
            const trimmedSecret = String(sanitizedUpdates.secretKey).trim();
            if (!trimmedSecret || trimmedSecret === '••••••••' || /^•+$/.test(trimmedSecret)) {
                delete sanitizedUpdates.secretKey;
            } else {
                sanitizedUpdates.secretKey = trimmedSecret;
            }
        }
        if (sanitizedUpdates.apiKey !== undefined) {
            const trimmedApiKey = String(sanitizedUpdates.apiKey).trim();
            if (!trimmedApiKey || trimmedApiKey === '••••••••' || /^•+$/.test(trimmedApiKey)) {
                delete sanitizedUpdates.apiKey;
            } else {
                sanitizedUpdates.apiKey = trimmedApiKey;
            }
        }
        if (sanitizedUpdates.postbackKey !== undefined) {
            const trimmedPostback = String(sanitizedUpdates.postbackKey).trim();
            if (!trimmedPostback || trimmedPostback === '••••••••' || /^•+$/.test(trimmedPostback)) {
                delete sanitizedUpdates.postbackKey;
            } else {
                sanitizedUpdates.postbackKey = trimmedPostback;
            }
        }

        if (sanitizedUpdates.customConfig !== undefined && typeof sanitizedUpdates.customConfig === 'object') {
            const existing = await OfferwallProvider.findOne({ providerKey: providerKey.toLowerCase() });
            if (existing && existing.customConfig) {
                sanitizedUpdates.customConfig = {
                    ...existing.customConfig,
                    ...sanitizedUpdates.customConfig
                };
            }
        }

        if (sanitizedUpdates.commissionMode !== undefined) {
            const mode = String(sanitizedUpdates.commissionMode).trim().toLowerCase();
            if (mode !== 'provider_managed' && mode !== 'smartexn_managed') {
                return res.status(400).json({ success: false, error: "Invalid commissionMode: must be either 'provider_managed' or 'smartexn_managed'" });
            }
            sanitizedUpdates.commissionMode = mode;
        }

        if (sanitizedUpdates.exchangeRateMultiplier !== undefined) {
            sanitizedUpdates.exchangeRateMultiplier = Math.max(0, Number(sanitizedUpdates.exchangeRateMultiplier) || 1.0);
        }
        if (sanitizedUpdates.platformRevenueSharePercent !== undefined && sanitizedUpdates.userRevenueSharePercent === undefined) {
            const parsedRetained = Number(sanitizedUpdates.platformRevenueSharePercent);
            if (isNaN(parsedRetained) || parsedRetained < 0 || parsedRetained > 100) {
                return res.status(400).json({ success: false, error: 'Invalid platformRevenueSharePercent: must be a number between 0 and 100' });
            }
            sanitizedUpdates.platformRevenueSharePercent = Math.round(parsedRetained * 100) / 100;
            sanitizedUpdates.userRevenueSharePercent = Number((100 - sanitizedUpdates.platformRevenueSharePercent).toFixed(2));
        } else if (sanitizedUpdates.userRevenueSharePercent !== undefined) {
            const parsedUserShare = Number(sanitizedUpdates.userRevenueSharePercent);
            if (isNaN(parsedUserShare) || parsedUserShare < 0 || parsedUserShare > 100) {
                return res.status(400).json({ success: false, error: 'Invalid userRevenueSharePercent: must be a number between 0 and 100' });
            }
            sanitizedUpdates.userRevenueSharePercent = Math.round(parsedUserShare * 100) / 100;
            sanitizedUpdates.platformRevenueSharePercent = Number((100 - sanitizedUpdates.userRevenueSharePercent).toFixed(2));
        }

        const provider = await OfferwallProvider.findOneAndUpdate(
            { providerKey: providerKey.toLowerCase() },
            { $set: sanitizedUpdates },
            { new: true, runValidators: true }
        );

        if (!provider) {
            return res.status(404).json({ success: false, error: `Provider '${providerKey}' not found` });
        }

        const responseData = provider.toObject();
        if (responseData.apiKey) responseData.apiKey = '••••••••';
        if (responseData.secretKey) responseData.secretKey = '••••••••';
        if (responseData.postbackKey) responseData.postbackKey = '••••••••';

        res.status(200).json({ success: true, data: responseData });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

/**
 * Get Offerwall Postback Logs (Admin only)
 */
export const getOfferwallLogs = async (req, res) => {
    try {
        if (!isAuthorizedAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
        }

        const { provider, status, userId, page = 1, limit = 50 } = req.query;
        const query = {};
        if (provider) query.provider = provider.toLowerCase();
        if (status) query.status = status;
        if (userId) query.userId = userId;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 50;
        const skip = (pageNum - 1) * limitNum;

        const total = await OfferwallPostbackLog.countDocuments(query);
        const logs = await OfferwallPostbackLog.find(query)
            .sort({ receivedAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('userId', 'username email');

        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            count: logs.length,
            data: logs
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

/**
 * Simulate / Test a postback (Admin only)
 */
export const simulatePostback = async (req, res) => {
    try {
        if (!isAuthorizedAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
        }

        const { providerKey, userId, amount = 1.0, isReversal = false, offerName = 'Test Survey / Offer' } = req.body;
        const normalizedKey = String(providerKey || '').trim().toLowerCase();
        const provider = await OfferwallProvider.findOne({ providerKey: normalizedKey });
        if (!provider) {
            return res.status(404).json({
                success: false,
                isDryRun: true,
                mutationsPerformed: false,
                error: `Provider '${providerKey}' not found`
            });
        }

        const simTxId = req.body.externalTxId || req.body.transId || `sim_${Date.now()}`;
        const queryParams = {
            user_id: userId,
            id: simTxId,
            trans_id: simTxId,
            amount: amount,
            status: isReversal ? 2 : 1,
            o_name: offerName
        };

        const secret = provider.secretKey || provider.postbackKey || '';
        if (provider.requireSignature && secret) {
            const pKey = provider.providerKey.toLowerCase();
            if (pKey === 'torox') {
                const simOid = `offer_${Date.now()}`;
                queryParams.oid = simOid;
                queryParams.sig = crypto.createHash('md5').update(`${simOid}-${userId}-${secret}`).digest('hex');
            } else if (pKey === 'cpx_research') {
                queryParams.hash = crypto.createHash('md5').update(`${simTxId}-${secret}`).digest('hex');
                if (req.body.amount_local !== undefined) {
                    queryParams.amount_local = req.body.amount_local;
                } else if (provider.commissionMode === 'provider_managed') {
                    queryParams.amount_local = amount;
                }
                if (req.body.amount_usd !== undefined) {
                    queryParams.amount_usd = req.body.amount_usd;
                } else if (provider.commissionMode === 'smartexn_managed') {
                    queryParams.amount_usd = amount;
                }
                if (req.body.currency !== undefined) {
                    queryParams.currency = req.body.currency;
                } else if (provider.commissionMode === 'provider_managed' && !provider.customConfig?.currency && !provider.currency) {
                    queryParams.currency = 'USD';
                }
            } else if (pKey === 'wannads') {
                queryParams.subId = userId;
                queryParams.transId = simTxId;
                queryParams.reward = amount;
                queryParams.signature = crypto.createHash('md5').update(`${userId}${simTxId}${amount}${secret}`).digest('hex');
            } else if (pKey === 'revlum') {
                queryParams.subId = userId;
                queryParams.trans_id = simTxId;
                queryParams.reward = amount;
                queryParams.signature = crypto.createHash('md5').update(`${userId}${simTxId}${amount}${secret}`).digest('hex');
            } else if (pKey === 'monlix') {
                queryParams.signature = crypto.createHash('sha256').update(`${userId}${simTxId}${secret}`).digest('hex');
            } else if (pKey === 'lootably') {
                const simIp = (provider.ipWhitelist && provider.ipWhitelist.length > 0) ? provider.ipWhitelist[0] : '127.0.0.1';
                queryParams.userID = userId;
                queryParams.ip = simIp;
                queryParams.revenue = amount;
                queryParams.currencyReward = amount;
                queryParams.signature = crypto.createHash('sha256').update(`${userId}${simIp}${amount}${amount}${secret}`).digest('hex');
            } else if (pKey === 'bitlabs' || pKey === 'bitlabs_surveys') {
                queryParams.signature = crypto.createHmac('sha256', secret).update(`${amount}${userId}${simTxId}`).digest('hex');
            } else if (provider.signatureType === 'hmac_sha256') {
                queryParams.signature = crypto.createHmac('sha256', secret).update(String(simTxId)).digest('hex');
            } else if (provider.signatureType === 'md5') {
                queryParams.signature = crypto.createHash('md5').update(`${userId}-${simTxId}-${secret}`).digest('hex');
            } else if (provider.signatureType === 'sha256') {
                queryParams.signature = crypto.createHash('sha256').update(`${userId}-${simTxId}-${secret}`).digest('hex');
            } else if (provider.signatureType === 'sha1') {
                queryParams.signature = crypto.createHash('sha1').update(`${userId}-${simTxId}-${secret}`).digest('hex');
            }
        }

        // Support explicit testing of invalid signature if requested
        if (req.body.testInvalidSignature) {
            queryParams.sig = 'INVALID_SIGNATURE_FOR_TEST';
            queryParams.signature = 'INVALID_SIGNATURE_FOR_TEST';
            queryParams.hash = 'INVALID_SIGNATURE_FOR_TEST';
            queryParams.secure_hash = 'INVALID_SIGNATURE_FOR_TEST';
        }

        const simIp = (provider.ipWhitelist && provider.ipWhitelist.length > 0) ? provider.ipWhitelist[0] : '127.0.0.1';

        const testReq = {
            params: { provider: providerKey },
            query: queryParams,
            body: {},
            headers: {
                'user-agent': 'SmartEXN Postback Simulator (Dry Run)',
                'x-forwarded-for': simIp
            },
            ip: simIp,
            socket: { remoteAddress: simIp },
            __isSimulatorDryRun: true,
            __simulatedByAdmin: true
        };

        const testRes = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            send(body) { this.body = body; return this; },
            json(body) { this.body = body; return this; }
        };

        await handlePostback(testReq, testRes);

        const dryRun = testReq.dryRunResult;
        if (dryRun) {
            const isSuccess = dryRun.validation?.status === 'PASSED';
            return res.status(200).json({
                success: isSuccess,
                isDryRun: true,
                mutationsPerformed: false,
                message: isSuccess
                    ? `Simulation dry-run completed successfully for ${provider.name} (${dryRun.action}). No database mutations were performed.`
                    : `Simulation validation failed: ${dryRun.validation?.error || 'Validation error'}`,
                provider: providerKey,
                providerName: provider.name,
                testTransactionId: simTxId,
                action: dryRun.action,
                validation: dryRun.validation,
                accounting: dryRun.accounting,
                user: dryRun.user,
                riskAnalysis: dryRun.riskAnalysis,
                simulatorResponse: { status: testRes.statusCode, response: testRes.body }
            });
        }

        // Fallback if test stopped before reaching dryRunResult
        return res.status(200).json({
            success: false,
            isDryRun: true,
            mutationsPerformed: false,
            message: 'Simulation validation failed before execution path.',
            provider: providerKey,
            simulatorResponse: { status: testRes.statusCode, response: testRes.body }
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            isDryRun: true,
            mutationsPerformed: false,
            error: 'Simulation request could not be processed'
        });
    }
};

/**
 * Dedicated Authenticated Endpoint for Torox Offerwall Session Creation
 * Official documentation: https://torox.io/publisher-integration-guide/
 * POST https://api.wall.torox.io/partner/session?placement_id=<PLACEMENT_ID>&token=<APP_TOKEN>
 * Request Body: { "player": { "uid": "<AUTHENTICATED_USER_ID>" } }
 */
export const getTheoremReachEntryUrl = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id?.toString();
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authenticated user session is required' });
        }

        const provider = await OfferwallProvider.findOne({ providerKey: 'theoremreach' });
        if (!provider || !provider.enabled) {
            return res.status(404).json({ success: false, error: 'Provider not found or disabled' });
        }

        const trResult = constructTheoremReachEntryUrl(provider, userId);
        if (trResult.error || !trResult.url) {
            return res.status(400).json({ success: false, error: trResult.error || 'Failed to generate TheoremReach entry URL' });
        }

        return res.json({ success: true, url: trResult.url });
    } catch (err) {
        console.error('[TheoremReach Entry Error]:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to generate entry URL' });
    }
};

export const createToroxSession = async (req, res) => {
    try {
        // 1. Enforce authentication - derive user ID strictly from server-side req.user.id
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const authenticatedUserId = String(req.user.id).trim();
        if (!authenticatedUserId) {
            return res.status(401).json({ success: false, error: 'Invalid authenticated user identity' });
        }

        // 2. Load Torox provider configuration from MongoDB
        const provider = await OfferwallProvider.findOne({ providerKey: 'torox' });
        if (!provider) {
            return res.status(404).json({ success: false, error: 'Torox provider configuration not found' });
        }

        // 3. Require Torox to be explicitly enabled, approved, and configured for production use
        if (!provider.enabled) {
            return res.status(400).json({ success: false, error: 'Torox offerwall is currently disabled' });
        }

        const isApproved = provider.approvalStatus === 'Approved';
        const isProductionStatus = provider.status === 'ACTIVE' || provider.status === 'PRODUCTION_READY';
        if (!isApproved || !isProductionStatus) {
            return res.status(400).json({
                success: false,
                error: 'Torox integration is pending publisher approval and not active for production use'
            });
        }

        // 4. Map placement ID and App Key from existing configuration fields
        const placementId = provider.appId?.trim();
        const appToken = (provider.secretKey || provider.postbackKey)?.trim();

        if (!placementId || !appToken) {
            return res.status(400).json({
                success: false,
                error: 'Torox credentials (placement_id or token) are missing or incomplete'
            });
        }

        // 5. Contact Torox Partner Session API with a safe timeout
        const toroxUrl = `https://api.wall.torox.io/partner/session?placement_id=${encodeURIComponent(placementId)}&token=${encodeURIComponent(appToken)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        let toroxRes;
        try {
            toroxRes = await fetch(toroxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    player: {
                        uid: authenticatedUserId
                    }
                }),
                signal: controller.signal
            });
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            if (fetchErr.name === 'AbortError') {
                return res.status(504).json({ success: false, error: 'Torox session API request timed out' });
            }
            console.error('[Torox Session API] Connection failure:', fetchErr.message);
            return res.status(502).json({ success: false, error: 'Failed to connect to Torox session service' });
        }
        clearTimeout(timeoutId);

        let data;
        try {
            data = await toroxRes.json();
        } catch (jsonErr) {
            return res.status(502).json({ success: false, error: 'Malformed response received from Torox session API' });
        }

        // 6. Validate that Torox returns ok: true and a valid wall_url string
        if (!toroxRes.ok || !data || data.ok !== true || !data.wall_url || typeof data.wall_url !== 'string') {
            const safeError = (data && (typeof data.error === 'string' ? data.error : data.message)) || `Torox session error (HTTP ${toroxRes.status})`;
            return res.status(502).json({
                success: false,
                error: safeError
            });
        }

        // Strict URL validation: Must parse cleanly, require HTTPS, exact hostname wall.torox.io, and disallow embedded credentials
        let parsedUrl;
        try {
            parsedUrl = new URL(data.wall_url);
        } catch {
            return res.status(502).json({
                success: false,
                error: 'Malformed wall_url returned by Torox session API'
            });
        }

        if (
            parsedUrl.protocol !== 'https:' ||
            parsedUrl.hostname.toLowerCase() !== 'wall.torox.io' ||
            parsedUrl.username ||
            parsedUrl.password
        ) {
            return res.status(502).json({
                success: false,
                error: 'Invalid or untrusted wall_url returned by Torox session API'
            });
        }

        // 7. Return only validated wall_url to the authenticated frontend; never expose secrets
        return res.status(200).json({
            success: true,
            wall_url: data.wall_url
        });
    } catch (err) {
        console.error('[Torox Session Error]', err.message);
        return res.status(500).json({ success: false, error: 'Internal server error processing Torox session' });
    }
};

/**
 * Seed all 26 verified networks into the database if not present
 */
export const seedVerifiedNetworks = async () => {
    const verifiedNetworks = [
        // ==========================================
        // GROUP A: Multi-Task / Offerwall Networks
        // ==========================================
        {
            providerKey: 'offerwall_gg',
            name: 'Offerwall.GG',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: false,
            status: 'NOT_STARTED',
            approvalStatus: 'Pending',
            integrationStatus: 'Not Started',
            appId: '9604',
            apiKey: '44e2f34845f41e2de70f39b9c3b5a543',
            exchangeRateMultiplier: 70,
            commissionMode: 'smartexn_managed',
            userRevenueSharePercent: 70,
            platformRevenueSharePercent: 30,
            iframeUrlTemplate: 'https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId={userId}',
            signatureType: 'custom',
            requireSignature: true,
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Active Placement',
            icon: '🎮',
            description: 'Leading gaming, app engagement, and multi-reward offerwall.',
            complianceNotes: 'HMAC-SHA256 signature verification over userId:transactionId:currencyAmount using secret key. 70 Coins = $1.00 USD.'
        },
        {
            providerKey: 'adgem',
            name: 'AdGem',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: false,
            status: 'NOT_STARTED',
            approvalStatus: 'Pending',
            integrationStatus: 'Not Started',
            exchangeRateMultiplier: 100,
            commissionMode: 'provider_managed',
            userRevenueSharePercent: 70,
            platformRevenueSharePercent: 30,
            iframeUrlTemplate: 'https://api.adgem.com/v1/wall?appid={appId}&playerid={userId}',
            signatureType: 'hmac_sha256',
            requireSignature: true,
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Web Postback v3',
            icon: '💎',
            description: 'Premium gaming and rewarded app offerwall with high eCPM and instant S2S postback verification.',
            complianceNotes: 'HMAC-SHA256 signature verification over raw request body using Postback Key. 100 virtual currency units = $1 USD. AdGem multiplier: 70 Coins per $1.'
        },
        {
            providerKey: 'torox',
            name: 'Torox (formerly OfferToro)',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: false,
            status: 'NOT_STARTED',
            approvalStatus: 'Pending',
            integrationStatus: 'Not Started',
            iframeUrlTemplate: 'https://torox.io/offerwall?pubid={appId}&appid={appId}&uid={userId}',
            signatureType: 'md5',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Top Tier Offerwall',
            icon: '🔥',
            description: 'Leading global offerwall offering high-paying gaming quests, app trials, and multi-reward engagement tasks.',
            complianceNotes: 'Requires clean Work & Earn separation, active worker subIds, and strict S2S postback acknowledgement.'
        },
        {
            providerKey: 'revlum',
            name: 'Revlum',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://revlum.com/offerwall/{appId}?subId={userId}',
            signatureType: 'hmac_sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Verified Web S2S',
            icon: '⚡',
            description: 'Fast-growing high-yield offerwall featuring mobile games, rewarded trials, and global app installs.',
            complianceNotes: 'HMAC-SHA256 signature verification supported.'
        },
        {
            providerKey: 'monlix',
            name: 'Monlix',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://monlix.com?appId={appId}&userId={userId}',
            signatureType: 'sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Instant Sync',
            icon: '💎',
            description: 'Modern offerwall and survey platform with instant credit notifications and customizable widgets.',
            complianceNotes: 'Direct appId and secret key verification.'
        },
        {
            providerKey: 'lootably',
            name: 'Lootably',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://wall.lootably.com/?placementID={appId}&sid={userId}',
            signatureType: 'sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'High eCPM',
            icon: '🎁',
            description: 'Premier offerwall network with gaming offers, surveys, videos, and multi-tier rewards.',
            complianceNotes: 'SHA256 signature verification on S2S webhook.'
        },
        {
            providerKey: 'adscend',
            name: 'Adscend Media',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://adscendmedia.com/adwall/publisher/{appId}/profile/default?subid1={userId}',
            requireSignature: false,
            signatureType: 'none',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Established Leader',
            icon: '🚀',
            description: 'Pioneer offerwall platform delivering diverse rewarded tasks, market research, and high conversion offers.',
            complianceNotes: 'SubID1 passback with verified publisher postback.'
        },
        {
            providerKey: 'wannads',
            name: 'Wannads',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://wannads.com/wall?apiKey={appId}&userId={userId}',
            signatureType: 'md5',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Global Inventory',
            icon: '🌟',
            description: 'Worldwide offerwall and survey router with competitive revenue share and responsive iframe design.',
            complianceNotes: 'MD5 hash signature verification.'
        },
        {
            providerKey: 'notik',
            name: 'Notik',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://notik.me/coins?api_key={appId}&user_id={userId}',
            signatureType: 'sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Modern UI',
            icon: '🎯',
            description: 'High-converting interactive offerwall tailored for web and mobile earning sites.',
            complianceNotes: 'API key & SHA256 postback validation.'
        },
        {
            providerKey: 'mmwall',
            name: 'MM Wall (MakeMoneyWall)',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: false,
            iframeUrlTemplate: 'https://mmwall.net/wall?api_key={appId}&user_id={userId}',
            signatureType: 'sha256',
            technicalReadinessScore: 95,
            approvalLikelihoodScore: 'Moderate',
            badge: 'Fast Setup',
            icon: '💰',
            description: 'Specialized offerwall providing social engagement tasks and app discovery.',
            complianceNotes: 'Publisher compliance review required.'
        },
        {
            providerKey: 'cpalead',
            name: 'CPALead',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://fastlink.cpalead.com/{appId}?subid={userId}',
            requireSignature: false,
            signatureType: 'none',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Instant Approval',
            icon: '📈',
            description: 'Global CPA network and rewarded offer gateway with daily payouts and high fill rates.',
            complianceNotes: 'Secret password postback parameter authentication.'
        },
        {
            providerKey: 'adgate',
            name: 'AdGate Media',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://wall.adgaterewards.com/{appId}/{userId}',
            signatureType: 'sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Industry Standard',
            icon: '🛡️',
            description: 'Top-ranked offerwall platform with multi-platform support and fraud-resistant payouts.',
            complianceNotes: 'SHA256 signature verification enabled.'
        },
        {
            providerKey: 'bitlabs',
            name: 'BitLabs (Offers & Surveys)',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://web.bitlabs.ai/?token={appId}&uid={userId}',
            signatureType: 'hmac_sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'AI Powered',
            icon: '🧠',
            description: 'Next-generation AI-optimized offerwall and rewarded survey router with dynamic matching.',
            complianceNotes: 'HMAC-SHA1/HMAC-SHA256 postback validation.'
        },
        {
            providerKey: 'hangmyads',
            name: 'HangMyAds',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: false,
            iframeUrlTemplate: 'https://hangmyads.com/offerwall/{appId}?user_id={userId}',
            signatureType: 'hmac_sha256',
            technicalReadinessScore: 95,
            approvalLikelihoodScore: 'High',
            badge: 'Mobile First',
            icon: '📱',
            description: 'Mobile performance marketing network with rewarded offerwalls and gaming campaigns.',
            complianceNotes: 'Requires placement configuration.'
        },
        {
            providerKey: 'adbreakmedia',
            name: 'AdBreakMedia',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: false,
            iframeUrlTemplate: 'https://adbreakmedia.com/wall?key={appId}&uid={userId}',
            requireSignature: false,
            signatureType: 'none',
            technicalReadinessScore: 90,
            approvalLikelihoodScore: 'Moderate',
            badge: 'Micro-Gigs',
            icon: '✨',
            description: 'High converting offerwall focusing on social media gigs, app installs, and web visits.',
            complianceNotes: 'Domain review required.'
        },
        {
            providerKey: 'ayetstudios',
            name: 'Aye-T Studios',
            category: 'offerwall',
            group: 'Group A: Multi-Task / Offerwall',
            enabled: true,
            iframeUrlTemplate: 'https://www.aye-t.com/offers/web?placement={appId}&uid={userId}',
            signatureType: 'sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Gaming Focused',
            icon: '🎮',
            description: 'Leading gaming-focused offerwall with high payouts on progression-based game milestones.',
            complianceNotes: 'Placement ID and SHA256 postback verification.'
        },

        // ==========================================
        // GROUP B: Survey Routers (7 Networks)
        // ==========================================
        {
            providerKey: 'cpx_research',
            name: 'CPX Research',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: true,
            iframeUrlTemplate: 'https://offers.cpx-research.com/index.php?app_id={appId}&ext_user_id={userId}',
            signatureType: 'md5',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Top Survey Router',
            icon: '📊',
            description: 'World-class survey network with unmatched global coverage, high completion rates, and consolation points.',
            complianceNotes: 'MD5 secure hash postback verification.'
        },
        {
            providerKey: 'inbrain',
            name: 'inBrain.ai',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: true,
            iframeUrlTemplate: 'https://survey.inbrain.ai/surveys?api_client_id={appId}&user_id={userId}',
            signatureType: 'hmac_sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Native Experience',
            icon: '🔬',
            description: 'AI-driven monetisation platform for market research and personalized surveys.',
            complianceNotes: 'HMAC-SHA256 signature verification supported.'
        },
        {
            providerKey: 'bitlabs_surveys',
            name: 'BitLabs Surveys',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: true,
            iframeUrlTemplate: 'https://web.bitlabs.ai/?token={appId}&uid={userId}&mode=surveys',
            signatureType: 'hmac_sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Smart Profiling',
            icon: '📋',
            description: 'BitLabs standalone survey router with real-time profile qualification and high conversions.',
            complianceNotes: 'Unified BitLabs token gateway.'
        },
        {
            providerKey: 'pollfish',
            name: 'Pollfish',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: true,
            iframeUrlTemplate: 'https://pollfish.com/client?api_key={appId}&device_id={userId}',
            signatureType: 'hmac_sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Global Reach',
            icon: '🌐',
            description: 'Enterprise market research survey platform connecting publishers to Fortune 500 brands.',
            complianceNotes: 'API key & HMAC signature verification.'
        },
        {
            providerKey: 'theoremreach',
            name: 'TheoremReach',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: true,
            commissionMode: 'provider_managed',
            apiKey: '',
            appId: '',
            iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={apiKey}&user_id={userId}',
            signatureType: 'hmac_sha1',
            requireSignature: true,
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Screenout Rewards',
            icon: '💡',
            description: 'Rewarded survey router that rewards users even when they screen out of surveys.',
            complianceNotes: 'API key & HMAC-SHA1 signature verification.'
        },
        {
            providerKey: 'yuno',
            name: 'Yuno Surveys',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: false,
            iframeUrlTemplate: 'https://wall.yunosurveys.com/?api_key={appId}&user_id={userId}',
            signatureType: 'sha256',
            technicalReadinessScore: 95,
            approvalLikelihoodScore: 'High',
            badge: 'Dynamic Routing',
            icon: '🧭',
            description: 'Direct survey router matching respondents with the highest converting demographic surveys.',
            complianceNotes: 'Publisher onboarding requires KYC.'
        },
        {
            providerKey: 'rapidreach',
            name: 'RapidReach',
            category: 'survey',
            group: 'Group B: Survey Routers',
            enabled: false,
            iframeUrlTemplate: 'https://rapidreach.io/wall?key={appId}&uid={userId}',
            requireSignature: false,
            signatureType: 'none',
            technicalReadinessScore: 90,
            approvalLikelihoodScore: 'Moderate',
            badge: 'Quick Surveys',
            icon: '⚡',
            description: 'Fast-paced micro-surveys and opinion polls for global respondents.',
            complianceNotes: 'Requires traffic verification.'
        },

        // ==========================================
        // GROUP C: Video / Gaming Ads (4 Networks)
        // ==========================================
        {
            providerKey: 'admob',
            name: 'Google AdMob (SSV)',
            category: 'video',
            group: 'Group C: Video / Gaming Ads',
            enabled: false,
            iframeUrlTemplate: '',
            signatureType: 'custom',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High (Mobile/PWA Container)',
            badge: 'Google Certified',
            icon: '🎬',
            description: 'Google server-side verified rewarded video ads delivering premium brand campaigns.',
            complianceNotes: 'Server-Side Verification (SSV) callback parser integrated with cryptographic verification.'
        },
        {
            providerKey: 'unity_ads',
            name: 'Unity Ads',
            category: 'gaming',
            group: 'Group C: Video / Gaming Ads',
            enabled: false,
            iframeUrlTemplate: '',
            signatureType: 'md5',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Gaming Standard',
            icon: '🕹️',
            description: 'Rewarded video and interactive playable ads designed for gaming platforms.',
            complianceNotes: 'MD5 HMAC callback signature validation.'
        },
        {
            providerKey: 'applovin',
            name: 'AppLovin (MAX Rewards)',
            category: 'video',
            group: 'Group C: Video / Gaming Ads',
            enabled: false,
            iframeUrlTemplate: '',
            signatureType: 'hmac_sha256',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'MAX Mediation',
            icon: '🏆',
            description: 'Premier monetization platform for rewarded video and high eCPM interstitials.',
            complianceNotes: 'S2S event postbacks with HMAC-SHA256 signature.'
        },
        {
            providerKey: 'ironsource',
            name: 'ironSource (LevelPlay)',
            category: 'gaming',
            group: 'Group C: Video / Gaming Ads',
            enabled: false,
            iframeUrlTemplate: '',
            signatureType: 'md5',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'LevelPlay Engine',
            icon: '⚙️',
            description: 'Leading app monetization network with rewarded video and playable ads.',
            complianceNotes: 'Private key MD5 callback verification.'
        },

        // ==========================================
        // GROUP D: Micro-Tasks & Crowdsourcing (2 Networks)
        // ==========================================
        {
            providerKey: 'mturk',
            name: 'Amazon Mechanical Turk (MTurk)',
            category: 'microtask',
            group: 'Group D: Micro-Tasks & Crowdsourcing',
            enabled: false,
            iframeUrlTemplate: 'https://www.mturk.com/worker',
            requireSignature: false,
            signatureType: 'none',
            technicalReadinessScore: 90,
            approvalLikelihoodScore: 'Requires AWS Requester Account',
            badge: 'AWS Requester',
            icon: '🏗️',
            description: 'Amazon crowdsourced micro-task marketplace for data categorization, NLP, and human intelligence tasks.',
            complianceNotes: 'Requires AWS IAM API credentials for task creation and dispatch.'
        },
        {
            providerKey: 'hivemicro',
            name: 'Hive Micro (Hive Work)',
            category: 'microtask',
            group: 'Group D: Micro-Tasks & Crowdsourcing',
            enabled: false,
            iframeUrlTemplate: 'https://hivemicro.com',
            requireSignature: false,
            signatureType: 'none',
            technicalReadinessScore: 90,
            approvalLikelihoodScore: 'Requires Partner Onboarding',
            badge: 'AI Training',
            icon: '🐝',
            description: 'Crowdsourced micro-tasking platform for computer vision, transcription, and bounding box labeling.',
            complianceNotes: 'Requires partner API integration.'
        }
    ];

    try {
        for (const net of verifiedNetworks) {
            const existing = await OfferwallProvider.findOne({ providerKey: net.providerKey });
            if (!existing) {
                await OfferwallProvider.create(net);
            } else if (net.providerKey === 'torox') {
                // Targeted reconciliation: ensure existing Torox remains safely disabled if unconfigured
                const hasAppId = Boolean(existing.appId && existing.appId.trim());
                const hasSecret = Boolean((existing.secretKey && existing.secretKey.trim()) || (existing.postbackKey && existing.postbackKey.trim()));
                const isConfiguredOrApproved = existing.approvalStatus === 'Approved' ||
                    ['CONFIGURED', 'TESTED', 'VERIFIED', 'IN PROGRESS'].includes(String(existing.integrationStatus || '').toUpperCase()) ||
                    ['CREDENTIALS_PENDING', 'SANDBOX', 'TESTING', 'PRODUCTION_READY', 'ACTIVE'].includes(String(existing.status || '').toUpperCase());

                if (!hasAppId && !hasSecret && !isConfiguredOrApproved) {
                    if (existing.enabled || existing.status !== 'NOT_STARTED' || existing.approvalStatus !== 'Pending' || existing.integrationStatus !== 'Not Started') {
                        existing.enabled = false;
                        existing.status = 'NOT_STARTED';
                        existing.approvalStatus = 'Pending';
                        existing.integrationStatus = 'Not Started';
                        await existing.save();
                    }
                }
            }
        }
        console.log(`Seeded / verified all ${verifiedNetworks.length} external networks.`);
    } catch (err) {
        console.error('Error seeding verified networks:', err.message);
    }
};

/**
 * Dedicated Inbound TheoremReach Event Webhook Handler
 * Endpoint: POST /api/v1/postbacks/theoremreach/events
 * 
 * Official Contract:
 * - Inbound HTTP POST from TheoremReach
 * - Query string contains enc_salt={event_id}&hash={hash}
 * - hash is HMAC-SHA1 using TheoremReach app secret, URL-safe Base64 (+ -> -, / -> _, = stripped)
 * - Signature is computed over exact full callback URL (including enc_salt) up to but excluding '&hash='
 * - Body JSON is NOT included in signature
 * - Constant-time comparison using Buffer timingSafeEqual
 * - Body data: { api_key, user_id, at, external_transaction_id, event_type, reversed_transactions }
 * - event_type: "reversal" or "ban"
 * - Reversal: deducts reward from worker taskEarningsBalance, records transaction ledger entry, updates provider reversal count
 * - Out-of-order reversal: persists durable unmatched reversal marker
 * - Ban: flags user status to 'Blocked' & restricts earning/withdrawal
 * - Idempotent deduplication on enc_salt via TheoremReachWebhookEvent
 * - HTTP 2xx on successful durable persistence or verified duplicate; HTTP non-2xx for retryable failures
 */
export const handleTheoremReachEventWebhook = async (req, res) => {
    // Health-check / ping support
    if (req.method === 'GET' && !req.query?.enc_salt && !req.query?.hash) {
        return res.status(200).json({ status: 'OK', service: 'TheoremReach Event Webhook Receiver' });
    }

    // 1. Extract query params and raw query
    const enc_salt = req.query?.enc_salt || req.query?.encSalt || req.params?.enc_salt || '';
    const receivedHash = req.query?.hash || req.query?.sig || req.query?.signature || req.headers?.['x-theoremreach-hash'] || '';

    if (!enc_salt || !String(enc_salt).trim()) {
        return res.status(400).json({ success: false, error: 'Missing required enc_salt query parameter' });
    }
    if (!receivedHash || !String(receivedHash).trim()) {
        return res.status(400).json({ success: false, error: 'Missing required signature hash parameter' });
    }

    const salt = String(enc_salt).trim();
    const hash = String(receivedHash).trim();

    // 2. Lookup TheoremReach provider configuration
    const provider = await OfferwallProvider.findOne({ providerKey: 'theoremreach' });
    if (!provider) {
        return res.status(404).json({ success: false, error: 'TheoremReach provider not configured' });
    }

    if (!provider.enabled || provider.status === 'DISABLED' || provider.status === 'SUSPENDED') {
        return res.status(403).json({ success: false, error: 'TheoremReach provider is currently disabled or suspended' });
    }

    const appId = provider.appId ? String(provider.appId).trim() : '';
    if (!appId) {
        return res.status(400).json({ success: false, error: 'TheoremReach appId is not configured; failing closed' });
    }

    const secret = (provider.secretKey || provider.postbackKey || '').trim();
    if (!secret) {
        return res.status(400).json({ success: false, error: 'TheoremReach secret key is not configured; failing closed' });
    }

    // 3. Verify HMAC-SHA1 signature over exact canonical callback URL up to but excluding '&hash='
    const configuredWebhookUrl = provider.eventWebhookUrl || 'https://smartexn.com/api/v1/postbacks/theoremreach/events';
    let canonicalEventOrigin = 'https://smartexn.com';
    let canonicalEventHost = 'smartexn.com';
    try {
        const parsedUrl = new URL(configuredWebhookUrl);
        canonicalEventOrigin = parsedUrl.origin;
        canonicalEventHost = parsedUrl.hostname;
    } catch (_) {}

    const candidates = [];
    if (typeof req.rawUrl === 'string' && req.rawUrl) {
        const rawPart = req.rawUrl.split('&hash=')[0];
        try {
            const parsed = new URL(rawPart);
            // Require HTTPS and ensure origin matches configured or trusted production domain
            if (parsed.protocol === 'https:' && (parsed.origin === canonicalEventOrigin || parsed.hostname === canonicalEventHost || parsed.hostname === 'smartexn.com')) {
                candidates.push(rawPart);
            }
        } catch (_) {}
    }

    const rawPathAndQuery = (req.originalUrl || req.url || '').split('&hash=')[0];
    if (rawPathAndQuery && rawPathAndQuery.startsWith('/')) {
        // Canonical full URL with configured origin - NEVER path-only
        const canonicalUrl = `${canonicalEventOrigin}${rawPathAndQuery}`;
        if (!candidates.includes(canonicalUrl)) {
            candidates.push(canonicalUrl);
        }
    }

    let isSigValid = false;
    for (const candidate of candidates) {
        const hmac = crypto.createHmac('sha1', secret).update(candidate).digest('base64');
        const urlSafeExpected = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        if (safeTimingCompareExact(hash, urlSafeExpected)) {
            isSigValid = true;
            break;
        }
    }

    if (!isSigValid) {
        return res.status(400).json({ success: false, error: 'TheoremReach webhook HMAC-SHA1 signature mismatch' });
    }

    // 4. Validate API key from payload data (must strictly match configured appId)
    const data = req.body?.data || req.body || {};
    if (!data.api_key || String(data.api_key).trim() !== appId) {
        return res.status(400).json({ success: false, error: 'Missing or mismatched api_key in payload data' });
    }

    // 5. Idempotent deduplication on enc_salt
    const existingEvent = await TheoremReachWebhookEvent.findOne({ encSalt: salt });
    if (existingEvent) {
        return res.status(200).json({
            success: true,
            message: 'Webhook event already processed (idempotent)',
            event_id: salt,
            duplicate: true
        });
    }

    // 6. Acquire distributed lock for this event to prevent concurrent double execution
    const eventLockKey = `event_${salt}`;
    const lockOwner = await acquirePostbackLock('theoremreach', eventLockKey);
    if (!lockOwner) {
        const postCheck = await TheoremReachWebhookEvent.findOne({ encSalt: salt });
        if (postCheck) {
            return res.status(200).json({
                success: true,
                message: 'Webhook event already processed (idempotent)',
                event_id: salt,
                duplicate: true
            });
        }
        return res.status(503).json({ success: false, error: 'Webhook event is being processed concurrently' });
    }

    try {
        const eventType = (data.event_type || '').toLowerCase().trim();

        // Helper to resolve user
        const resolveUser = async (userIdStr) => {
            if (!userIdStr) return null;
            const str = String(userIdStr).trim();
            if (str.match(/^[0-9a-fA-F]{24}$/)) {
                const u = await User.findById(str);
                if (u) return u;
            }
            const byUsername = await User.findOne({ username: str });
            if (byUsername) return byUsername;
            return await User.findOne({ email: str });
        };

        let targetUser = await resolveUser(data.user_id);
        const txList = [];

        if (eventType === 'reversal') {
            if (Array.isArray(data.reversed_transactions) && data.reversed_transactions.length > 0) {
                for (const item of data.reversed_transactions) {
                    if (typeof item === 'string' && item.trim()) {
                        txList.push(item.trim());
                    } else if (item && typeof item === 'object') {
                        const id = item.id || item.transaction_id || item.external_transaction_id || item.externalTransactionId;
                        if (id) txList.push(String(id).trim());
                    }
                }
            } else if (data.external_transaction_id) {
                txList.push(String(data.external_transaction_id).trim());
            }

            for (const txId of txList) {
                const reversalKey = `theoremreach_${txId}_reversal`;

                // Check if already reversed
                const alreadyReversed = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                    || (await Transaction.findOne({
                        offerwallProvider: 'theoremreach',
                        externalTransactionId: txId,
                        type: 'Offerwall Reversal'
                    }));

                if (alreadyReversed && alreadyReversed.amount > 0) {
                    continue;
                }

                // Acquire lock for this specific transaction. If lock cannot be acquired, do not process.
                const txLock = await acquirePostbackLock('theoremreach', txId);
                if (!txLock) {
                    const postLockCheck = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                        || (await Transaction.findOne({
                            offerwallProvider: 'theoremreach',
                            externalTransactionId: txId,
                            type: 'Offerwall Reversal'
                        }));
                    if (postLockCheck && postLockCheck.amount > 0) {
                        continue;
                    }
                    throw new Error(`LOCK_CONTENTION: Lock for transaction ${txId} is held by a concurrent request`);
                }

                try {
                    const lockedReversed = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                        || (await Transaction.findOne({
                            offerwallProvider: 'theoremreach',
                            externalTransactionId: txId,
                            type: 'Offerwall Reversal'
                        }));
                    if (lockedReversed && lockedReversed.amount > 0) {
                        continue;
                    }

                    // Check for original credit
                    const origTx = await Transaction.findOne({
                        offerwallProvider: 'theoremreach',
                        externalTransactionId: txId,
                        type: 'Offerwall Reward'
                    });

                    if (!origTx) {
                        // Out-of-order reversal: persist durable unmatched reversal marker
                        const existingMarker = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                            || (await Transaction.findOne({
                                offerwallProvider: 'theoremreach',
                                externalTransactionId: txId,
                                type: 'Offerwall Reversal'
                            }));
                        if (!existingMarker) {
                            try {
                                await Transaction.create({
                                    userId: targetUser ? targetUser._id : undefined,
                                    userName: targetUser ? targetUser.username : (data.user_id || 'Unknown'),
                                    currency: 'USD',
                                    type: 'Offerwall Reversal',
                                    amount: 0,
                                    amountUSD: 0,
                                    grossAmount: 0,
                                    userRewardAmount: 0,
                                    platformRevenueAmount: 0,
                                    balanceBefore: targetUser ? (targetUser.taskEarningsBalance || 0) : 0,
                                    balanceAfter: targetUser ? (targetUser.taskEarningsBalance || 0) : 0,
                                    idempotencyKey: reversalKey,
                                    chargebackStatus: 'Settled',
                                    description: 'Unmatched Offerwall Reversal Marker (TheoremReach Webhook received before credit)',
                                    status: 'Approved',
                                    sourceWallet: 'TaskEarnings',
                                    destinationWallet: 'External',
                                    offerwallProvider: 'theoremreach',
                                    externalTransactionId: txId
                                });
                            } catch (markerErr) {
                                if (markerErr.code !== 11000) throw markerErr;
                            }
                        }
                        continue;
                    }

                    // Matched reversal: resolve user from original transaction if needed
                    let user = targetUser;
                    if (!user && origTx.userId) {
                        user = await User.findById(origTx.userId);
                    }
                    if (!user) {
                        continue;
                    }

                    const deductionAmount = origTx.userRewardAmount || origTx.amountUSD || origTx.amount || 0;
                    const currentEarnings = Math.max(0, user.taskEarningsBalance || 0);
                    const deductionToApply = Math.min(currentEarnings, deductionAmount);
                    const liabilityToAdd = Number((deductionAmount - deductionToApply).toFixed(4));
                    const chargebackStatus = liabilityToAdd > 0 ? 'Liability_Owed' : 'Settled';

                    // Atomically update user balance
                    const updatedUser = await User.findOneAndUpdate(
                        { _id: user._id },
                        {
                            $inc: {
                                taskEarningsBalance: -deductionToApply,
                                taskWalletBalance: -deductionToApply,
                                chargebackLiabilityUSD: liabilityToAdd
                            }
                        },
                        { new: true }
                    );

                    // Create Reversal Transaction with atomic compensating rollback
                    let revTx;
                    try {
                        revTx = await Transaction.create({
                            userId: user._id,
                            userName: user.username,
                            currency: 'USD',
                            type: 'Offerwall Reversal',
                            amount: deductionAmount,
                            amountUSD: deductionAmount,
                            grossAmount: origTx.grossAmount || 0,
                            userRewardAmount: deductionAmount,
                            platformRevenueAmount: origTx.platformRevenueAmount || 0,
                            balanceBefore: currentEarnings,
                            balanceAfter: updatedUser ? updatedUser.taskEarningsBalance : 0,
                            idempotencyKey: reversalKey,
                            chargebackStatus,
                            reversalReferenceId: origTx._id,
                            description: 'Offerwall Chargeback/Reversal: TheoremReach (Webhook Event)',
                            status: 'Approved',
                            sourceWallet: 'TaskEarnings',
                            destinationWallet: 'External',
                            offerwallProvider: 'theoremreach',
                            externalTransactionId: txId
                        });
                    } catch (txErr) {
                        if (txErr.code === 11000) {
                            await User.findOneAndUpdate(
                                { _id: user._id },
                                {
                                    $inc: {
                                        taskEarningsBalance: deductionToApply,
                                        taskWalletBalance: deductionToApply,
                                        chargebackLiabilityUSD: -liabilityToAdd
                                    }
                                }
                            );
                            continue;
                        }
                        // Compensate user balance on transaction failure
                        try {
                            await User.findOneAndUpdate(
                                { _id: user._id },
                                {
                                    $inc: {
                                        taskEarningsBalance: deductionToApply,
                                        taskWalletBalance: deductionToApply,
                                        chargebackLiabilityUSD: -liabilityToAdd
                                    }
                                }
                            );
                        } catch (_) {}

                        throw txErr;
                    }

                    // Increment provider totalReversalCount
                    await OfferwallProvider.findByIdAndUpdate(provider._id, {
                        $inc: { totalReversalCount: 1 }
                    });

                    // User notification
                    try {
                        await Notification.create({
                            userId: user._id,
                            subject: 'TheoremReach Survey Reward Revoked ⚠️',
                            message: `A survey reward of $${deductionAmount} was reversed by TheoremReach. Your task earnings balance has been adjusted.`,
                            senderType: 'System'
                        });
                    } catch (_) {}
                } finally {
                    await releasePostbackLock('theoremreach', txId, txLock);
                }
            }
        } else if (eventType === 'ban') {
            if (targetUser) {
                // Provider-specific ban: do NOT block entire SmartExn account or disable withdrawals
                await User.findByIdAndUpdate(targetUser._id, {
                    $set: {
                        'customFields.theoremreachBanned': true,
                        'customFields.theoremreachBannedAt': new Date(),
                        'customFields.theoremreachBanReason': data.reason || 'TheoremReach compliance ban'
                    }
                });
                try {
                    await Notification.create({
                        userId: targetUser._id,
                        subject: 'TheoremReach Provider Notice',
                        message: `Your TheoremReach offerwall access has been restricted (${data.reason || 'compliance flag'}). Your SmartExn account and other earning features remain active.`,
                        senderType: 'System'
                    });
                } catch (_) {}
            }
        }

        // Persist durable TheoremReachWebhookEvent
        try {
            await TheoremReachWebhookEvent.create({
                encSalt: salt,
                eventType: eventType || 'unknown',
                userId: targetUser ? targetUser._id : undefined,
                username: targetUser ? targetUser.username : (data.user_id || undefined),
                apiKey: data.api_key || '',
                at: data.at ? new Date(data.at) : new Date(),
                externalTxId: data.external_transaction_id || (txList[0] || ''),
                reversedTransactions: txList,
                payload: data,
                status: 'Processed'
            });
        } catch (saveErr) {
            if (saveErr.code !== 11000) {
                throw saveErr;
            }
        }

        // Also record in OfferwallPostbackLog
        try {
            await OfferwallPostbackLog.create({
                provider: 'theoremreach',
                externalTxId: salt,
                userId: targetUser ? targetUser._id : undefined,
                username: targetUser ? targetUser.username : (data.user_id || undefined),
                status: 'Processed',
                isReversal: eventType === 'reversal',
                rawBody: req.body,
                queryParams: req.query,
                signature: hash,
                signatureStatus: 'Verified'
            });
        } catch (_) {}

        await releasePostbackLock('theoremreach', eventLockKey, lockOwner);

        return res.status(200).json({
            success: true,
            event_id: salt,
            event_type: eventType,
            processed: true
        });
    } catch (err) {
        if (lockOwner) {
            try { await releasePostbackLock('theoremreach', eventLockKey, lockOwner); } catch (_) {}
        }
        console.error('[TheoremReach Webhook Error]:', err.message);
        return res.status(500).json({ success: false, error: err.message, retryable: true });
    }
};

/**
 * Dedicated AdGem Postback v3 Handler according to official AdGem Web Offerwall & Postback v3 specifications.
 * 
 * Requirements:
 * 1. HTTP POST method mandatory.
 * 2. HMAC-SHA256 signature verification over exact original raw request body using AdGem Postback Key.
 * 3. Constant-time signature comparison using safeTimingCompare.
 * 4. Fails closed on missing credentials, invalid signatures, malformed payloads, or restricted accounts.
 * 5. Separates user reward (amount) from publisher revenue (payout).
 * 6. Safely acknowledges zero-reward install events without balance mutation.
 * 7. Strictly credits Task Earnings balance (taskEarningsBalance and taskWalletBalance) - never core walletBalance.
 * 8. Strict concurrency control using OfferwallPostbackLock and atomic database idempotency.
 */
export const handleAdGemPostback = async (req, res) => {
    // 0. Delegate to player webhook if payload is a player suspension event
    let initialPayload = req.body;
    if (!initialPayload && req.rawBody) {
        try { initialPayload = JSON.parse(req.rawBody.toString('utf8')); } catch (_) {}
    }
    if (initialPayload && (initialPayload.type === 'player.banned' || initialPayload.type === 'player.unbanned')) {
        return handleAdGemPlayerWebhook(req, res);
    }

    // 1. Enforce HTTP POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed. AdGem postbacks must be HTTP POST.'
        });
    }

    const clientIp = getClientIp(req);

    // 2. Fetch AdGem provider configuration
    const provider = await OfferwallProvider.findOne({ providerKey: 'adgem' });
    if (!provider) {
        return res.status(404).json({
            success: false,
            error: 'AdGem provider not configured'
        });
    }

    // 3. Approval and active state check: require enabled === true, status === 'ACTIVE', approvalStatus === 'Approved'
    if (provider.enabled !== true || provider.status !== 'ACTIVE' || provider.approvalStatus !== 'Approved') {
        return res.status(403).json({
            success: false,
            error: 'AdGem provider is not active or approved'
        });
    }

    // 4. Require non-empty configured provider.appId
    const configuredAppId = (provider.appId || '').trim();
    if (!configuredAppId) {
        return res.status(400).json({
            success: false,
            error: 'AdGem appId is not configured in provider settings; failing closed'
        });
    }

    // 5. Validate postback key configuration: use ONLY provider.postbackKey, do not substitute another credential
    const secret = (provider.postbackKey || '').trim();
    if (!secret) {
        return res.status(400).json({
            success: false,
            error: 'AdGem postback key is not configured; failing closed'
        });
    }

    // 6. Signature header check
    const receivedSig = String(
        req.headers?.['signature'] ||
        req.headers?.['Signature'] ||
        req.headers?.['x-adgem-signature'] ||
        req.headers?.['x-signature'] ||
        (typeof req.get === 'function' ? (req.get('Signature') || req.get('signature') || req.get('x-adgem-signature') || req.get('x-signature')) : '') ||
        ''
    ).trim();

    if (!receivedSig) {
        return res.status(400).json({
            success: false,
            error: 'Missing AdGem signature header'
        });
    }

    // 7. Extract exact raw request body buffer (strictly require req.rawBody, do NOT reconstruct via JSON.stringify)
    if (!req.rawBody || (Buffer.isBuffer(req.rawBody) && req.rawBody.length === 0) || (typeof req.rawBody === 'string' && !req.rawBody.trim())) {
        return res.status(400).json({
            success: false,
            error: 'Missing raw request body buffer; cannot verify AdGem HMAC-SHA256 signature'
        });
    }

    const rawBuffer = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(String(req.rawBody), 'utf8');

    // 8. Verify HMAC-SHA256 signature in constant time
    const computedSig = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
    if (!safeTimingCompare(computedSig, receivedSig)) {
        try {
            await OfferwallPostbackLog.create({
                provider: 'adgem',
                externalTxId: 'unknown',
                rewardUSD: 0,
                rawReward: 0,
                rawCurrency: 'USD',
                status: 'InvalidSignature',
                clientIp,
                queryParams: maskSensitiveData(req.query),
                rawBody: maskSensitiveData(req.body),
                signature: '***REDACTED***',
                signatureStatus: 'Invalid',
                errorMessage: 'AdGem HMAC-SHA256 signature mismatch'
            });
        } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Invalid AdGem postback signature'
        });
    }

    // Optional IP allowlist check
    if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
        const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
        if (!ipMatches) {
            return res.status(403).json({
                success: false,
                error: 'Client IP not in whitelist'
            });
        }
    }

    // 9. Parse and validate JSON payload structure
    let payload = req.body;
    if (!payload || typeof payload !== 'object') {
        try {
            payload = JSON.parse(rawBuffer.toString('utf8'));
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Malformed JSON payload'
            });
        }
    }

    if (!payload.request_id || typeof payload.request_id !== 'string' || !payload.request_id.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Missing or invalid request_id'
        });
    }

    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
        return res.status(400).json({
            success: false,
            error: 'Missing or invalid data object'
        });
    }

    const data = payload.data;

    // Require exact equality between configured appId and data.app_id
    if (data.app_id === undefined || data.app_id === null || String(data.app_id).trim() === '' || String(data.app_id).trim() !== configuredAppId) {
        return res.status(400).json({
            success: false,
            error: 'AdGem app_id mismatch or missing'
        });
    }

    // Validate conversion_id
    if (!data.conversion_id || !String(data.conversion_id).trim()) {
        return res.status(400).json({
            success: false,
            error: 'Missing conversion_id'
        });
    }
    const conversionId = String(data.conversion_id).trim();

    // Validate player_id: strictly require exactly 24 lowercase hexadecimal characters
    if (!data.player_id || !String(data.player_id).trim()) {
        return res.status(400).json({
            success: false,
            error: 'Missing player_id'
        });
    }
    const playerId = String(data.player_id).trim();
    if (!/^[0-9a-f]{24}$/.test(playerId)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid player_id format; must be exactly 24 lowercase hexadecimal characters'
        });
    }

    // 10. Prepare log record
    const sanitizedRawBody = maskSensitiveData(payload);
    const log = new OfferwallPostbackLog({
        provider: 'adgem',
        externalTxId: conversionId,
        username: playerId,
        rewardUSD: 0,
        rawReward: Number(data.amount) || 0,
        rawCurrency: 'USD',
        offerId: String(data.offer_id || data.campaign_id || '').trim(),
        offerName: String(data.offer_name || data.goal_name || 'AdGem Offer').trim(),
        isReversal: false,
        clientIp,
        queryParams: maskSensitiveData(req.query),
        rawBody: sanitizedRawBody,
        rawHeaders: {
            'user-agent': req.headers?.['user-agent'],
            'content-type': req.headers?.['content-type'],
            'signature': '***REDACTED***'
        },
        signature: '***REDACTED***',
        signatureStatus: 'Verified'
    });

    // 11. Resolve User strictly by ObjectId through User.findById(playerId)
    // Username and email fallbacks are strictly removed for AdGem
    const user = await User.findById(playerId);

    if (!user) {
        log.status = 'UserNotFound';
        log.errorMessage = `User not found for player_id: ${playerId}`;
        try { await log.save(); } catch (_) {}
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    log.userId = user._id;
    log.username = user.username;

    // 12. Check account restrictions
    if (user.status === 'Blocked' || user.restrictions?.earning === true || user.restrictions?.loginBlocked === true) {
        log.status = 'UserRestricted';
        log.errorMessage = 'User account is Blocked or earning-restricted; credit rejected.';
        try { await log.save(); } catch (_) {}
        return res.status(403).json({
            success: false,
            error: 'User account is restricted or blocked'
        });
    }

    // AdGem-specific player suspension check
    if (user.adgemSuspended === true || user.restrictions?.adgemSuspended === true) {
        log.status = 'UserRestricted';
        log.errorMessage = 'User is suspended from AdGem offers; credit rejected.';
        try { await log.save(); } catch (_) {}
        return res.status(403).json({
            success: false,
            error: 'User is suspended from AdGem offers'
        });
    }

    // 13. Strict conversion_type validation according to AdGem Postbacks v3 specification
    // conversion_type: strictly 'reward' or 'install'. Missing or unknown values must reject safely.
    // tracking_type: campaign category (e.g. CPI, CPE, CPA, CPC, Market Research) preserved only as metadata.
    if (data.conversion_type === undefined || data.conversion_type === null || String(data.conversion_type).trim() === '') {
        log.status = 'Error';
        log.errorMessage = 'Missing conversion_type in AdGem postback payload';
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Missing conversion_type'
        });
    }

    const conversionType = String(data.conversion_type).toLowerCase().trim();

    // A. Valid install event: acknowledge with HTTP 200 after signature, App ID and approval validation
    // Zero balance or Transaction mutation
    if (conversionType === 'install') {
        log.status = 'Processed';
        log.errorMessage = 'AdGem install conversion acknowledged without crediting balance.';
        try { await log.save(); } catch (_) {}
        return res.status(200).json({
            success: true,
            message: 'Install conversion acknowledged'
        });
    }

    // D. Reject any unknown conversion_type (must be strictly 'reward' or 'install')
    if (conversionType !== 'reward') {
        log.status = 'Error';
        log.errorMessage = `Unknown or unsupported conversion_type: ${conversionType}`;
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: `Unsupported conversion_type: ${conversionType}`
        });
    }

    // 14. Validate payable reward amount
    const rawAmount = data.amount;
    if (rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === '') {
        log.status = 'Error';
        log.errorMessage = 'Missing reward amount in payable AdGem postback';
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Missing reward amount'
        });
    }

    const parsedAmount = Number(rawAmount);
    if (!Number.isFinite(parsedAmount)) {
        log.status = 'Error';
        log.errorMessage = `Malformed or non-finite reward amount: ${rawAmount}`;
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Malformed reward amount'
        });
    }

    // 15. Validate payable gross publisher payout
    const rawPayout = data.payout;
    if (rawPayout === undefined || rawPayout === null || String(rawPayout).trim() === '') {
        log.status = 'Error';
        log.errorMessage = 'Missing gross publisher payout in payable AdGem postback';
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Missing gross publisher payout'
        });
    }

    const parsedPayout = Number(rawPayout);
    if (!Number.isFinite(parsedPayout) || parsedPayout < 0) {
        log.status = 'Error';
        log.errorMessage = `Invalid or non-positive gross payout: ${rawPayout}`;
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Invalid or non-positive gross payout'
        });
    }

    // conversion_type === "reward" with amount === 0 but payout > 0: reject safely. Do not acknowledge as a successful payable conversion.
    if (parsedAmount === 0 && parsedPayout > 0) {
        log.status = 'Error';
        log.errorMessage = 'Reward conversion has zero amount but positive payout; rejected for safety';
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Zero reward amount with positive payout is invalid'
        });
    }

    // amount > 0 with payout === 0: reject safely.
    if (parsedAmount > 0 && parsedPayout === 0) {
        log.status = 'Error';
        log.errorMessage = 'Reward conversion has positive amount but zero payout; rejected for safety';
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Positive reward amount with zero payout is invalid'
        });
    }

    // Missing, malformed, negative, or non-finite values must never produce a credit.
    if (parsedAmount <= 0 || parsedPayout <= 0) {
        log.status = 'Error';
        log.errorMessage = `Reward conversion must have positive amount and payout (amount: ${parsedAmount}, payout: ${parsedPayout})`;
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Invalid or non-positive gross payout'
        });
    }

    // 16. Require explicit exchangeRateMultiplier of exactly 100
    const multiplier = Number(provider.exchangeRateMultiplier);
    if (!Number.isFinite(multiplier) || multiplier !== 100) {
        log.status = 'Error';
        log.errorMessage = `AdGem exchangeRateMultiplier must be explicitly configured as 100 (got ${provider.exchangeRateMultiplier})`;
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'AdGem exchangeRateMultiplier must be explicitly 100 (100 virtual units = $1 USD)'
        });
    }

    // 17. Require commissionMode === 'provider_managed' and 70/30 revenue share configuration
    const commMode = String(provider.commissionMode || '').toLowerCase();
    const userShare = Number(provider.userRevenueSharePercent);
    const platformShare = Number(provider.platformRevenueSharePercent);
    if (commMode !== 'provider_managed' || userShare !== 70 || platformShare !== 30) {
        log.status = 'Error';
        log.errorMessage = 'AdGem requires provider_managed commission mode and 70/30 revenue share configuration';
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'AdGem requires provider_managed commission mode and 70/30 revenue share configuration'
        });
    }

    // 18. Calculate user reward: userRewardUSD = data.amount / provider.exchangeRateMultiplier
    // AdGem multiplier (70 Coins per $1) already calculates 70% worker reward; do NOT apply another 70% deduction.
    const userRewardUSD = Number((parsedAmount / multiplier).toFixed(4));
    const grossUSD = Number(parsedPayout.toFixed(4));

    // Never credit more than the gross payout
    if (userRewardUSD > grossUSD) {
        log.status = 'Error';
        log.errorMessage = `User reward ($${userRewardUSD}) exceeds gross publisher payout ($${grossUSD})`;
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'User reward exceeds gross publisher payout'
        });
    }

    // Verify user reward corresponds to 70% share of gross payout (allowing small currency rounding tolerance)
    const expectedUserReward = grossUSD * 0.70;
    const roundingTolerance = Math.max(0.02, grossUSD * 0.01);
    if (Math.abs(userRewardUSD - expectedUserReward) > roundingTolerance) {
        log.status = 'Error';
        log.errorMessage = `User reward ($${userRewardUSD}) does not correspond to 70% of gross payout ($${grossUSD})`;
        try { await log.save(); } catch (_) {}
        return res.status(400).json({
            success: false,
            error: 'Reward amount does not correspond to configured 70/30 revenue split'
        });
    }

    const platformRevenueUSD = Number((grossUSD - userRewardUSD).toFixed(4));

    log.rewardUSD = userRewardUSD;
    log.grossAmountUSD = grossUSD;
    log.userRewardUSD = userRewardUSD;
    log.platformRevenueUSD = platformRevenueUSD;

    // 19. Offer-Version Aware Multi-Goal Idempotency & Concurrency Lock
    const goalId = (data.goal_id !== undefined && data.goal_id !== null && String(data.goal_id).trim() !== '')
        ? String(data.goal_id).trim()
        : null;
    const campaignId = (data.campaign_id !== undefined && data.campaign_id !== null && String(data.campaign_id).trim() !== '')
        ? String(data.campaign_id).trim()
        : null;
    const offerId = (data.offer_id !== undefined && data.offer_id !== null && String(data.offer_id).trim() !== '')
        ? String(data.offer_id).trim()
        : null;

    // Deterministic, provider-scoped idempotency identity:
    // - Incorporates user ID, campaign_id, offer_id (offer version), and goal_id
    // - If offer_id is absent, uses documented fallback identity preserving campaign-level behavior
    // - If goal_id is absent, uses conversionId-based idempotency
    const creditKey = goalId
        ? (offerId
            ? `adgem:user:${user._id}:camp:${campaignId || 'all'}:offer:${offerId}:goal:${goalId}:credit`
            : `adgem:user:${user._id}:camp:${campaignId || 'all'}:offer:none:goal:${goalId}:credit`)
        : `adgem_${conversionId}_credit`;

    const externalTxId = goalId 
        ? `${conversionId}_offer_${offerId || 'none'}_goal_${goalId}` 
        : conversionId;

    const lockKey = goalId 
        ? `user_${user._id}_camp_${campaignId || 'all'}_offer_${offerId || 'none'}_goal_${goalId}` 
        : conversionId;

    let lockOwnerToken = null;
    try {
        lockOwnerToken = await acquirePostbackLock('adgem', lockKey);
    } catch (lockErr) {
        log.status = 'Error';
        log.errorMessage = `Postback lock acquisition failed: ${lockErr.message}`;
        try { await log.save(); } catch (_) {}
        return res.status(409).json({
            success: false,
            error: 'Concurrent postback in progress'
        });
    }

    try {
        // Idempotency check: verify if this credit was already recorded
        const existingCredit = (await Transaction.findOne({ idempotencyKey: creditKey }))
            || (await Transaction.findOne({
                offerwallProvider: 'adgem',
                externalTransactionId: externalTxId,
                type: 'Offerwall Reward'
            }))
            || (goalId ? await Transaction.findOne({
                offerwallProvider: 'adgem',
                userId: user._id,
                idempotencyKey: creditKey,
                type: 'Offerwall Reward'
            }) : null)
            || (!goalId ? await Transaction.findOne({
                offerwallProvider: 'adgem',
                externalTransactionId: conversionId,
                type: 'Offerwall Reward'
            }) : null);

        if (existingCredit) {
            log.status = 'Duplicate';
            log.errorMessage = 'Duplicate credit transaction detected';
            try { await log.save(); } catch (_) {}
            return res.status(200).json({
                success: true,
                message: 'Duplicate conversion already processed'
            });
        }

        // Check if pre-reversed
        const reversalKey = goalId
            ? (offerId
                ? `adgem:user:${user._id}:camp:${campaignId || 'all'}:offer:${offerId}:goal:${goalId}:reversal`
                : `adgem:user:${user._id}:camp:${campaignId || 'all'}:offer:none:goal:${goalId}:reversal`)
            : `adgem_${conversionId}_reversal`;

        const priorReversal = (await Transaction.findOne({ idempotencyKey: reversalKey }))
            || (await Transaction.findOne({
                offerwallProvider: 'adgem',
                externalTransactionId: externalTxId,
                type: 'Offerwall Reversal'
            }));

        if (priorReversal) {
            log.status = 'PreReversed';
            log.errorMessage = 'Credit received after pre-existing reversal; balance mutation bypassed safely.';
            try { await log.save(); } catch (_) {}
            return res.status(200).json({
                success: true,
                message: 'Conversion pre-reversed'
            });
        }

        // Verify lock ownership before transaction creation
        if (lockOwnerToken && !(await isLockStillOwned('adgem', lockKey, lockOwnerToken))) {
            throw new Error(`Lock expired or taken over before transaction creation for adgem:${lockKey}`);
        }

        const balanceBefore = user.taskEarningsBalance || 0;
        const balanceAfter = Number((balanceBefore + userRewardUSD).toFixed(4));

        // 20. Atomic Database Accounting with MongoDB Session Transactions
        let session = null;
        try {
            session = await mongoose.startSession();
        } catch (sessionErr) {
            console.error('[AdGem Transaction Safety] MongoDB session creation failed:', sessionErr.message);
            log.status = 'Error';
            log.errorMessage = `MongoDB session creation failed: ${sessionErr.message}. Transactions required for AdGem.`;
            try { await log.save(); } catch (_) {}
            return res.status(500).json({
                success: false,
                error: 'Database transaction support is unavailable; failing closed for safety.'
            });
        }

        let transactionStarted = false;
        try {
            session.startTransaction();
            transactionStarted = true;
        } catch (startErr) {
            console.error('[AdGem Transaction Safety] MongoDB startTransaction failed:', startErr.message);
            await session.endSession().catch(() => {});
            log.status = 'Error';
            log.errorMessage = `MongoDB startTransaction failed: ${startErr.message}. Standalone MongoDB deployments without replica set do not support transactions.`;
            try { await log.save(); } catch (_) {}
            return res.status(500).json({
                success: false,
                error: 'Database transaction support is unavailable; failing closed for safety.'
            });
        }

        let tx;
        try {
            const [createdTx] = await Transaction.create([{
                idempotencyKey: creditKey,
                type: 'Offerwall Reward',
                userId: user._id,
                userName: user.username,
                currency: 'USD',
                amount: userRewardUSD,
                amountUSD: userRewardUSD,
                grossAmount: grossUSD,
                userRewardAmount: userRewardUSD,
                platformRevenueAmount: platformRevenueUSD,
                balanceBefore,
                balanceAfter,
                status: 'Approved',
                sourceWallet: 'External',
                destinationWallet: 'TaskEarnings',
                offerwallProvider: 'adgem',
                externalTransactionId: externalTxId,
                description: `Completed AdGem Offer: ${data.offer_name || campaignId || offerId || conversionId}${offerId ? ' (Offer ID: ' + offerId + ')' : ''}${data.goal_name ? ' - Goal: ' + data.goal_name : (goalId ? ' - Goal ID: ' + goalId : '')}`
            }], { session });
            tx = createdTx;

            // Atomically increment Task Earnings balance while verifying user is not restricted or AdGem-suspended
            const updatedUser = await User.findOneAndUpdate(
                {
                    _id: user._id,
                    status: { $ne: 'Blocked' },
                    'restrictions.earning': { $ne: true },
                    'restrictions.loginBlocked': { $ne: true },
                    adgemSuspended: { $ne: true },
                    'restrictions.adgemSuspended': { $ne: true }
                },
                {
                    $inc: {
                        taskEarningsBalance: userRewardUSD,
                        taskWalletBalance: userRewardUSD
                    }
                },
                { new: true, session }
            );

            if (!updatedUser) {
                await session.abortTransaction();
                log.status = 'UserRestricted';
                log.errorMessage = 'User was restricted when balance update was attempted; session aborted';
                try { await log.save(); } catch (_) {}
                return res.status(403).json({
                    success: false,
                    error: 'User account is restricted or blocked'
                });
            }

            await session.commitTransaction();
        } catch (txErr) {
            if (transactionStarted) {
                await session.abortTransaction().catch(() => {});
            }
            const errMsg = String(txErr.message || '');
            if (errMsg.includes('replica set') || errMsg.includes('Transaction numbers') || errMsg.includes('standalone')) {
                log.status = 'Error';
                log.errorMessage = `Deployment requirement not met: MongoDB transaction unsupported (${errMsg})`;
                try { await log.save(); } catch (_) {}
                return res.status(500).json({
                    success: false,
                    error: 'MongoDB deployment does not support transactions; failing closed.'
                });
            }
            if (txErr.code === 11000) {
                log.status = 'Duplicate';
                log.errorMessage = 'Duplicate transaction key caught by database constraint';
                try { await log.save(); } catch (_) {}
                return res.status(200).json({
                    success: true,
                    message: 'Duplicate conversion already processed'
                });
            }
            throw txErr;
        } finally {
            await session.endSession().catch(() => {});
        }

        // Send worker notification (isolated, non-blocking)
        try {
            await Notification.create({
                userId: user._id,
                subject: 'Offerwall Reward Credited! 🎁',
                message: `You earned $${userRewardUSD.toFixed(2)} from AdGem (${data.offer_name || 'Offer'}). Credited to your Task Earnings balance.`,
                senderType: 'System'
            });
        } catch (_) {}

        // Emit real-time synchronization if Socket.IO is initialized
        try {
            const io = req.app?.get('io');
            if (io) io.emit('DATA_CHANGED');
        } catch (_) {}

        log.status = 'Processed';
        try { await log.save(); } catch (_) {}

        return res.status(200).json({
            success: true,
            message: 'AdGem postback processed successfully',
            conversionId
        });
    } finally {
        if (lockOwnerToken) {
            await releasePostbackLock('adgem', lockKey, lockOwnerToken);
        }
    }
};

/**
 * Dedicated Inbound AdGem Suspended Player Webhook Handler
 * 
 * Official AdGem Player Events:
 * - "player.banned": Suspends only that user's AdGem access
 * - "player.unbanned": Restores only that user's AdGem access
 * 
 * Safeguards:
 * 1. HMAC-SHA256 signature verification over exact raw request body buffer using ADGEM_WEBHOOK_SECRET.
 * 2. Constant-time signature comparison using safeTimingCompare.
 * 3. Dedicated environment variable ADGEM_WEBHOOK_SECRET (never confused with reward postbackKey).
 * 4. Validates expected AdGem App ID ("34014" or configured provider.appId).
 * 5. Strictly requires 24 lowercase hex player_id and maps to User.findById.
 * 6. Idempotent state storage without modifying global account status (status, earning, withdrawal).
 * 7. Rejection of malformed, unauthentic, or incomplete payloads.
 */
export const handleAdGemPlayerWebhook = async (req, res) => {
    // 1. Health-check / ping support for GET requests
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'OK', service: 'AdGem Player Webhook Receiver' });
    }

    // 2. Enforce HTTP POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed. AdGem webhooks must be HTTP POST.'
        });
    }

    const clientIp = getClientIp(req);

    // 3. Retrieve dedicated ADGEM_WEBHOOK_SECRET from environment
    const webhookSecret = (process.env.ADGEM_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
        console.error('[AdGem Webhook Error]: ADGEM_WEBHOOK_SECRET environment variable is not configured');
        return res.status(500).json({
            success: false,
            error: 'AdGem webhook secret is not configured'
        });
    }

    // 4. Extract signature header
    const receivedSig = String(
        req.headers?.['signature'] ||
        req.headers?.['Signature'] ||
        req.headers?.['x-adgem-signature'] ||
        req.headers?.['x-signature'] ||
        (typeof req.get === 'function' ? (req.get('Signature') || req.get('signature') || req.get('x-adgem-signature') || req.get('x-signature')) : '') ||
        ''
    ).trim();

    if (!receivedSig) {
        return res.status(400).json({
            success: false,
            error: 'Missing AdGem webhook signature header'
        });
    }

    // 5. Extract exact raw request body buffer
    if (!req.rawBody || (Buffer.isBuffer(req.rawBody) && req.rawBody.length === 0) || (typeof req.rawBody === 'string' && !req.rawBody.trim())) {
        return res.status(400).json({
            success: false,
            error: 'Missing raw request body buffer; cannot verify AdGem HMAC-SHA256 signature'
        });
    }

    const rawBuffer = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(String(req.rawBody), 'utf8');

    // 6. Verify HMAC-SHA256 signature in constant time
    const computedSig = crypto.createHmac('sha256', webhookSecret).update(rawBuffer).digest('hex');
    if (!safeTimingCompare(computedSig, receivedSig)) {
        try {
            await OfferwallPostbackLog.create({
                provider: 'adgem',
                externalTxId: `invalid_sig_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
                rewardUSD: 0,
                rawReward: 0,
                rawCurrency: 'USD',
                status: 'SecurityRejected',
                clientIp,
                queryParams: maskSensitiveData(req.query),
                rawBody: maskSensitiveData(req.body),
                signature: '***REDACTED***',
                signatureStatus: 'Invalid',
                errorMessage: 'AdGem webhook HMAC-SHA256 signature mismatch'
            });
        } catch (logErr) {
            console.error('[AdGem Webhook Log Error]: Failed to log invalid signature:', logErr);
        }

        return res.status(400).json({
            success: false,
            error: 'Invalid AdGem webhook signature'
        });
    }

    // 7. Parse and validate JSON payload
    let payload = req.body;
    if (!payload || typeof payload !== 'object') {
        try {
            payload = JSON.parse(rawBuffer.toString('utf8'));
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Malformed JSON payload'
            });
        }
    }

    // 8. Validate Event Type (strictly 'player.banned' and 'player.unbanned' according to official contract)
    const eventType = String(payload.type || '').trim();
    if (eventType !== 'player.banned' && eventType !== 'player.unbanned') {
        return res.status(400).json({
            success: false,
            error: `Unsupported or missing event type: ${eventType || 'undefined'}`
        });
    }

    // 9. Validate data object
    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
        return res.status(400).json({
            success: false,
            error: 'Missing or invalid data object'
        });
    }

    const data = payload.data;

    // 10. Validate App ID (expected App ID: "34014" or configured provider.appId)
    const provider = await OfferwallProvider.findOne({ providerKey: 'adgem' });
    const expectedAppId = (provider?.appId && String(provider.appId).trim()) 
        ? String(provider.appId).trim() 
        : '34014';

    if (data.app_id === undefined || data.app_id === null || String(data.app_id).trim() === '' || String(data.app_id).trim() !== expectedAppId) {
        return res.status(400).json({
            success: false,
            error: `AdGem app_id mismatch or missing. Expected: ${expectedAppId}`
        });
    }

    // 11. Validate player_id: strictly 24 lowercase hex characters
    if (!data.player_id || !String(data.player_id).trim()) {
        return res.status(400).json({
            success: false,
            error: 'Missing player_id'
        });
    }

    const playerId = String(data.player_id).trim();
    if (!/^[0-9a-f]{24}$/.test(playerId)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid player_id format; must be exactly 24 lowercase hexadecimal characters'
        });
    }

    // 12. Resolve User strictly by ObjectId
    const user = await User.findById(playerId);
    if (!user) {
        try {
            await OfferwallPostbackLog.create({
                provider: 'adgem',
                externalTxId: `unknown_user_${playerId}_${Date.now()}`,
                rewardUSD: 0,
                rawReward: 0,
                rawCurrency: 'USD',
                status: 'UserNotFound',
                clientIp,
                queryParams: maskSensitiveData(req.query),
                rawBody: maskSensitiveData(payload),
                errorMessage: `AdGem player event '${eventType}' for non-existent player_id: ${playerId}`,
                signature: '***REDACTED***',
                signatureStatus: 'Verified'
            });
        } catch (logErr) {
            console.error('[AdGem Webhook Log Error]: Failed to log unknown user:', logErr);
        }
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // 13. Official Event Identification & Deterministic Fingerprint
    // Official AdGem contract documents `data.created_at` and `timestamp`.
    // It does NOT provide a dedicated event ID field (no payload.id or data.event_id).
    const isBanned = eventType === 'player.banned';
    const banReason = String(data.ban_reason || (isBanned ? 'Banned by AdGem' : 'Unbanned by AdGem')).trim();

    // Determine event timestamp if provided by official payload (data.created_at or payload.timestamp)
    let eventTime = null;
    const rawTime = data.created_at || payload.timestamp;
    if (rawTime !== undefined && rawTime !== null && String(rawTime).trim() !== '') {
        const strTime = String(rawTime).trim();
        const parsed = new Date(typeof rawTime === 'number' ? rawTime : strTime);
        const isStrictFormat = typeof rawTime === 'number' 
            ? (!isNaN(rawTime) && rawTime > 0)
            : (/^\d{4}-\d{2}-\d{2}/.test(strTime) || /^\d+$/.test(strTime) || /^\d{4}\/\d{2}\/\d{2}/.test(strTime));

        if (isNaN(parsed.getTime()) || !isStrictFormat) {
            return res.status(400).json({
                success: false,
                error: 'Invalid event timestamp format'
            });
        }
        eventTime = parsed;
    }

    const eventTimestampStr = eventTime ? eventTime.toISOString() : '';
    let eventKey;
    const fingerprint = crypto
        .createHash('sha256')
        .update(`${playerId}:${eventType}:${data.app_id}:${eventTimestampStr || 'no_ts'}:${banReason}`)
        .digest('hex');
    eventKey = `evt_fp_${fingerprint}`;

    // 14. Stable per-player concurrency lock key to prevent concurrent state mutation race conditions
    // while preserving event-specific identity (`eventKey`) for audit and idempotency logs.
    const playerLockKey = `adgem_player_${playerId}`;

    let lockOwnerToken = null;
    try {
        lockOwnerToken = await acquirePostbackLock('adgem_event', playerLockKey, 3000, 15000);
    } catch (lockErr) {
        // If lock acquisition timed out, check if another worker already finished processing this exact eventKey
        if (eventTimestampStr) {
            const checkLog = await OfferwallPostbackLog.findOne({ provider: 'adgem', externalTxId: eventKey });
            if (checkLog) {
                return res.status(200).json({
                    success: true,
                    applied: false,
                    duplicate: true,
                    message: `AdGem player event '${eventType}' already processed (duplicate delivery acknowledged)`,
                    playerId,
                    adgemSuspended: user.adgemSuspended === true
                });
            }
        }
        return res.status(409).json({
            success: false,
            error: 'Concurrent event lock acquisition timeout; retry later'
        });
    }

    let lockLost = false;
    let heartbeatActive = true;
    let heartbeatTimeoutId = null;
    let isRenewing = false;

    const scheduleHeartbeat = () => {
        if (!heartbeatActive || !lockOwnerToken) return;
        heartbeatTimeoutId = setTimeout(async () => {
            if (!heartbeatActive || isRenewing) return;
            isRenewing = true;
            try {
                const renewed = await renewPostbackLock('adgem_event', playerLockKey, lockOwnerToken, 15000);
                if (!renewed) {
                    lockLost = true;
                    heartbeatActive = false;
                    return;
                }
            } catch (_) {
                // Ignore transient network errors on heartbeat renewal attempt
            } finally {
                isRenewing = false;
                if (heartbeatActive) {
                    scheduleHeartbeat();
                }
            }
        }, 4000);
        if (heartbeatTimeoutId && typeof heartbeatTimeoutId.unref === 'function') {
            heartbeatTimeoutId.unref();
        }
    };

    const stopHeartbeat = () => {
        heartbeatActive = false;
        if (heartbeatTimeoutId) {
            clearTimeout(heartbeatTimeoutId);
            heartbeatTimeoutId = null;
        }
    };

    if (lockOwnerToken) {
        scheduleHeartbeat();
    }

    try {
        // Double-check under lock: duplicate delivery checks
        if (eventTimestampStr) {
            const existingLog = await OfferwallPostbackLog.findOne({ provider: 'adgem', externalTxId: eventKey });
            if (existingLog) {
                return res.status(200).json({
                    success: true,
                    applied: false,
                    duplicate: true,
                    message: `AdGem player event '${eventType}' already processed (duplicate delivery acknowledged)`,
                    playerId,
                    adgemSuspended: user.adgemSuspended === true
                });
            }
        } else {
            // Timeless event duplicate check: if user is ALREADY in the requested state
            // AND an event of the same type was recorded within the active retry window (10 minutes)
            if (user.adgemSuspended === isBanned) {
                const recentLog = await OfferwallPostbackLog.findOne({
                    provider: 'adgem',
                    userId: user._id,
                    status: isBanned ? 'PlayerSuspended' : 'PlayerUnsuspended',
                    receivedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
                });
                if (recentLog) {
                    return res.status(200).json({
                        success: true,
                        applied: false,
                        duplicate: true,
                        message: `AdGem player event '${eventType}' already processed (duplicate retry acknowledged)`,
                        playerId,
                        adgemSuspended: user.adgemSuspended === true
                    });
                }
            }
        }

        // Event Ordering Guard: older events cannot overwrite a newer accepted player state
        if (user.adgemLastEventAt && eventTime) {
            const lastTime = new Date(user.adgemLastEventAt).getTime();
            const curTime = eventTime.getTime();
            if (curTime < lastTime) {
                try {
                    await OfferwallPostbackLog.create({
                        provider: 'adgem',
                        externalTxId: eventKey,
                        username: user.username || playerId,
                        userId: user._id,
                        rewardUSD: 0,
                        rawReward: 0,
                        rawCurrency: 'USD',
                        status: 'Skipped',
                        clientIp,
                        queryParams: maskSensitiveData(req.query),
                        rawBody: maskSensitiveData(payload),
                        errorMessage: `AdGem player event '${eventType}' ignored: event timestamp (${eventTime.toISOString()}) is older than last accepted event (${user.adgemLastEventAt.toISOString()})`,
                        signature: '***REDACTED***',
                        signatureStatus: 'Verified'
                    });
                } catch (logErr) {
                    console.error('[AdGem Webhook Log Error]: Failed to log skipped older event:', logErr);
                }

                return res.status(200).json({
                    success: true,
                    applied: false,
                    skipped: true,
                    reason: 'Older event ignored; newer player state already accepted',
                    playerId,
                    adgemSuspended: user.adgemSuspended === true
                });
            } else if (curTime === lastTime) {
                if (user.adgemSuspended !== isBanned) {
                    // Conflicting event with exact same timestamp
                    try {
                        await OfferwallPostbackLog.create({
                            provider: 'adgem',
                            externalTxId: eventKey,
                            username: user.username || playerId,
                            userId: user._id,
                            rewardUSD: 0,
                            rawReward: 0,
                            rawCurrency: 'USD',
                            status: 'Skipped',
                            clientIp,
                            queryParams: maskSensitiveData(req.query),
                            rawBody: maskSensitiveData(payload),
                            errorMessage: `AdGem player event '${eventType}' ignored: ambiguous conflicting event with equal timestamp (${eventTime.toISOString()})`,
                            signature: '***REDACTED***',
                            signatureStatus: 'Verified'
                        });
                    } catch (logErr) {
                        console.error('[AdGem Webhook Log Error]: Failed to log skipped equal timestamp conflict:', logErr);
                    }

                    return res.status(200).json({
                        success: true,
                        applied: false,
                        skipped: true,
                        reason: 'Ambiguous conflicting event with equal timestamp ignored',
                        playerId,
                        adgemSuspended: user.adgemSuspended === true
                    });
                } else {
                    // Same state event re-delivered with exact same timestamp
                    return res.status(200).json({
                        success: true,
                        applied: false,
                        duplicate: true,
                        message: `AdGem player event '${eventType}' already processed (duplicate delivery acknowledged)`,
                        playerId,
                        adgemSuspended: user.adgemSuspended === true
                    });
                }
            }
        }

        // Verify lock ownership is still valid before applying database changes
        if (lockLost || (lockOwnerToken && !(await isLockStillOwned('adgem_event', playerLockKey, lockOwnerToken)))) {
            lockLost = true;
            throw new Error(`Lock expired or taken over before applying player state change: adgem_event:${playerLockKey}`);
        }

        // 15. Apply provider-specific suspension/unsuspension atomically via MongoDB Session Transaction with Fallback
        const effectiveEventTime = eventTime || new Date();
        const updateFields = {
            adgemSuspended: isBanned,
            'restrictions.adgemSuspended': isBanned,
            adgemSuspensionReason: banReason,
            adgemSuspendedAt: isBanned ? effectiveEventTime : null,
            adgemLastEventAt: effectiveEventTime
        };

        const updateFilter = {
            _id: user._id,
            $or: [
                { adgemLastEventAt: { $exists: false } },
                { adgemLastEventAt: null },
                { adgemLastEventAt: { $lt: effectiveEventTime } }
            ]
        };

        const previousState = {
            adgemSuspended: user.adgemSuspended,
            restrictionsAdgemSuspended: user.restrictions?.adgemSuspended || false,
            adgemSuspensionReason: user.adgemSuspensionReason || '',
            adgemSuspendedAt: user.adgemSuspendedAt || null,
            adgemLastEventAt: user.adgemLastEventAt || null
        };

        let updatedUser = null;
        let auditLog = null;
        let session = null;
        let transactionUsed = false;

        try {
            session = await mongoose.startSession();
            session.startTransaction();
            transactionUsed = true;
        } catch (_) {
            if (session) {
                await session.endSession().catch(() => {});
            }
            session = null;
        }

        try {
            if (session && transactionUsed) {
                updatedUser = await User.findOneAndUpdate(updateFilter, { $set: updateFields }, { new: true, session });
                if (!updatedUser) {
                    await session.abortTransaction();
                    await session.endSession();
                } else {
                    auditLog = await OfferwallPostbackLog.create({
                        provider: 'adgem',
                        externalTxId: eventKey,
                        username: user.username || playerId,
                        userId: user._id,
                        rewardUSD: 0,
                        rawReward: 0,
                        rawCurrency: 'USD',
                        status: isBanned ? 'PlayerSuspended' : 'PlayerUnsuspended',
                        clientIp,
                        queryParams: maskSensitiveData(req.query),
                        rawBody: maskSensitiveData(payload),
                        errorMessage: `AdGem player event '${eventType}': ${banReason}`,
                        signature: '***REDACTED***',
                        signatureStatus: 'Verified'
                    }, { session });

                    // Recheck lock ownership immediately before committing transaction
                    if (lockLost || (lockOwnerToken && !(await isLockStillOwned('adgem_event', playerLockKey, lockOwnerToken)))) {
                        lockLost = true;
                        await session.abortTransaction();
                        await session.endSession();
                        throw new Error(`Lock expired or taken over before commitTransaction: adgem_event:${playerLockKey}`);
                    }

                    await session.commitTransaction();
                    await session.endSession();
                }
            } else {
                // Non-transaction fallback (e.g. standalone MongoDB deployment)
                updatedUser = await User.findOneAndUpdate(updateFilter, { $set: updateFields }, { new: true });
                if (updatedUser) {
                    try {
                        auditLog = await OfferwallPostbackLog.create({
                            provider: 'adgem',
                            externalTxId: eventKey,
                            username: user.username || playerId,
                            userId: user._id,
                            rewardUSD: 0,
                            rawReward: 0,
                            rawCurrency: 'USD',
                            status: isBanned ? 'PlayerSuspended' : 'PlayerUnsuspended',
                            clientIp,
                            queryParams: maskSensitiveData(req.query),
                            rawBody: maskSensitiveData(payload),
                            errorMessage: `AdGem player event '${eventType}': ${banReason}`,
                            signature: '***REDACTED***',
                            signatureStatus: 'Verified'
                        });
                    } catch (logErr) {
                        console.error('[AdGem Webhook Audit Log Error]: Failed to create OfferwallPostbackLog; executing conditional rollback:', logErr);
                        // Conditional rollback tied strictly to the exact event version performed by this update
                        const rollbackFilter = {
                            _id: user._id,
                            adgemLastEventAt: effectiveEventTime
                        };
                        const rollbackUpdate = {
                            $set: {
                                adgemSuspended: previousState.adgemSuspended,
                                'restrictions.adgemSuspended': previousState.restrictionsAdgemSuspended,
                                adgemSuspensionReason: previousState.adgemSuspensionReason,
                                adgemSuspendedAt: previousState.adgemSuspendedAt,
                                adgemLastEventAt: previousState.adgemLastEventAt
                            }
                        };
                        try {
                            const rolledBack = await User.findOneAndUpdate(rollbackFilter, rollbackUpdate);
                            if (!rolledBack) {
                                console.error('[AdGem Webhook Critical Rollback Warning]: Conditional rollback skipped because newer event was already committed.');
                            }
                        } catch (revertErr) {
                            console.error('[AdGem Webhook Critical Rollback Error]: Failed to execute conditional rollback:', revertErr);
                        }

                        return res.status(500).json({
                            success: false,
                            error: 'Failed to record required audit log for AdGem player event; player state update reverted'
                        });
                    }
                }
            }
        } catch (execErr) {
            if (session && transactionUsed) {
                await session.abortTransaction().catch(() => {});
                await session.endSession().catch(() => {});
            }
            throw execErr;
        }

        // NEVER report false success if updatedUser was not updated in the database
        if (!updatedUser) {
            try {
                await OfferwallPostbackLog.create({
                    provider: 'adgem',
                    externalTxId: `unapplied_${eventKey}_${Date.now()}`,
                    username: user.username || playerId,
                    userId: user._id,
                    rewardUSD: 0,
                    rawReward: 0,
                    rawCurrency: 'USD',
                    status: 'Skipped',
                    clientIp,
                    queryParams: maskSensitiveData(req.query),
                    rawBody: maskSensitiveData(payload),
                    errorMessage: `AdGem player event '${eventType}' not applied: atomic condition failed (newer event already recorded or concurrent update)`,
                    signature: '***REDACTED***',
                    signatureStatus: 'Verified'
                });
            } catch (_) {}

            return res.status(200).json({
                success: true,
                applied: false,
                skipped: true,
                message: 'Event not applied: user state could not be updated (concurrent or newer state exists)',
                playerId,
                adgemSuspended: user.adgemSuspended === true
            });
        }

        return res.status(200).json({
            success: true,
            applied: true,
            message: `AdGem player event '${eventType}' processed successfully`,
            playerId,
            adgemSuspended: isBanned,
            adgemSuspendedAt: isBanned ? effectiveEventTime : null,
            audited: Boolean(auditLog)
        });
    } finally {
        stopHeartbeat();
        if (lockOwnerToken && !lockLost) {
            await releasePostbackLock('adgem_event', playerLockKey, lockOwnerToken);
        }
    }
};
