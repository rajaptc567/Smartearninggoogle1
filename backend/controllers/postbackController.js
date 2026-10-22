import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import OfferwallProvider from '../models/OfferwallProvider.js';
import OfferwallPostbackLog from '../models/OfferwallPostbackLog.js';
import Notification from '../models/Notification.js';
import OfferwallPostbackLock from '../models/OfferwallPostbackLock.js';

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

        const candidates = [];
        if (req) {
            if (typeof req.rawUrl === 'string' && req.rawUrl) {
                candidates.push(req.rawUrl.split('&hash=')[0]);
            }
            const rawPathAndQuery = req.originalUrl || req.url || '';
            if (rawPathAndQuery) {
                const pathUpToHash = rawPathAndQuery.split('&hash=')[0];
                const host = (typeof req.get === 'function' ? req.get('host') : req.headers?.host) || '';
                const proto = req.protocol || (req.secure ? 'https' : 'http') || 'https';
                if (host) {
                    candidates.push(`${proto}://${host}${pathUpToHash}`);
                    candidates.push(`https://${host}${pathUpToHash}`);
                    candidates.push(`http://${host}${pathUpToHash}`);
                }
                candidates.push(pathUpToHash);
            }
        }
        if (candidates.length === 0 && req && req.query) {
            const parts = [];
            for (const [k, v] of Object.entries(req.query)) {
                if (k === 'hash' || k === 'signature' || k === 'sig') break;
                parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
            }
            candidates.push(`/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`);
        }
        if (candidates.length === 0 && params && typeof params === 'object') {
            const parts = [];
            for (const [k, v] of Object.entries(params)) {
                if (k === 'hash' || k === 'signature' || k === 'sig') break;
                parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
            }
            candidates.push(`/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`);
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

            const candidates = [];

            if (req) {
                if (typeof req.rawUrl === 'string' && req.rawUrl) {
                    candidates.push(req.rawUrl.split('&hash=')[0]);
                }
                const rawPathAndQuery = req.originalUrl || req.url || '';
                if (rawPathAndQuery) {
                    const pathUpToHash = rawPathAndQuery.split('&hash=')[0];
                    const host = (typeof req.get === 'function' ? req.get('host') : req.headers?.host) || '';
                    const proto = req.protocol || (req.secure ? 'https' : 'http') || 'https';
                    if (host) {
                        candidates.push(`${proto}://${host}${pathUpToHash}`);
                        candidates.push(`https://${host}${pathUpToHash}`);
                        candidates.push(`http://${host}${pathUpToHash}`);
                    }
                    candidates.push(pathUpToHash);
                }
            }

            // Fallback: If raw URL is not accessible, reconstruct from query parameters in order
            if (candidates.length === 0 && req && req.query) {
                const parts = [];
                for (const [k, v] of Object.entries(req.query)) {
                    if (k === 'hash' || k === 'signature' || k === 'sig') break;
                    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                }
                candidates.push(`/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`);
            }

            // Fallback: If req was not provided (e.g. direct unit test of verifySignature), reconstruct from params in order
            if (candidates.length === 0 && params && typeof params === 'object') {
                const parts = [];
                for (const [k, v] of Object.entries(params)) {
                    if (k === 'hash' || k === 'signature' || k === 'sig') break;
                    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                }
                candidates.push(`/api/v1/postbacks/theoremreach${parts.length > 0 ? '?' + parts.join('&') : ''}`);
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
            const hash = params.hash || params.signature || '';
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

    if (key === 'theoremreach') {
        rawUserId = p.user_id || p.userId || p.uid || p.subId || p.ext_user_id || '';
        rawTxId = p.transaction_id || p.tx_id || p.trans_id || p.id || '';
        rawAmount = p.reward || p.currency_reward || p.reward_amount || p.amount || 0;
        rawCurrency = p.currency || 'USD';
    }

    // Detect Reversal / Chargeback
    let isReversal = false;
    if (
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

    return {
        userId: String(rawUserId).trim(),
        externalTxId: String(rawTxId).trim(),
        // Keep raw reward units separate from USD revenue
        rawReward: Number(rawAmount) || 0,
        rawCurrency: rawCurrency,
        rewardUSD: 0, // Will be calculated based on provider config
        offerId: String(p.offer_id || p.oid || p.offerId || p.campaign_id || '').trim(),
        offerName: String(p.o_name || p.offer_name || p.offerName || p.campaign_name || p.reward_name || `${providerKey} reward`).trim(),
        isReversal,
        signature: String(p.sig || p.signature || p.hash || '').trim()
    };
};

const isAuthorizedAdmin = (user) => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'super_admin';
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
    return Boolean(currentLock && (!currentLock.expiresAt || new Date(currentLock.expiresAt) > new Date()));
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

    // P14: Provider State Check
    if (!provider.enabled || provider.status === 'DISABLED' || provider.status === 'SUSPENDED') {
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

    const normalized = normalizePostbackParams(providerKey, rawParams);

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

        // Find target User (by MongoDB _id, username, or email)
        let user = null;
        if (normalized.userId) {
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

        // Isolate genuine test/debug callbacks (TheoremReach only)
        const isDebugCallback = (providerKey === 'theoremreach') && (rawParams.debug === 'true' || rawParams.debug === true || rawParams.debug === '1' || rawParams.debug === 1);
        if (isDebugCallback) {
            log.status = 'TestCallback';
            log.errorMessage = 'TheoremReach test callback with debug indicator received; live user balance mutation and transaction record bypassed.';
            try { await log.save(); } catch (_) {}
            return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
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

        // P8: Gross / User / Platform Split Calculation
        let grossUSD;
        const absReward = Math.abs(normalized.rawReward);
        if (providerKey === 'theoremreach') {
            grossUSD = Number((absReward / (provider.exchangeRateMultiplier || 70.0)).toFixed(4));
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

        // P5: Robust Concurrency & Atomic Idempotency
        const unifiedKey = `${providerKey}_${normalized.externalTxId}`;
        const creditKey = `${unifiedKey}_credit`;
        const reversalKey = `${unifiedKey}_reversal`;

        log.grossAmountUSD = grossUSD;
        log.userRewardUSD = userRewardUSD;
        log.platformRevenueUSD = platformRevenueUSD;

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
                // Check for duplicate reversal first (both unified and historical keys)
                const existingReversal = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                    || (await Transaction.findOne({
                        offerwallProvider: providerKey,
                        externalTransactionId: normalized.externalTxId,
                        type: 'Offerwall Reversal'
                    }));

                if (existingReversal) {
                    log.status = 'Duplicate';
                    log.errorMessage = 'Duplicate reversal callback received; already reversed.';
                    try { await log.save(); } catch (_) {}
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
                }

                const origTx = await Transaction.findOne({
                    offerwallProvider: providerKey,
                    externalTransactionId: normalized.externalTxId,
                    type: 'Offerwall Reward'
                });

                const deductionAmount = origTx ? (origTx.userRewardAmount || origTx.amountUSD) : userRewardUSD;
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
                            body: providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK'
                        }
                    };
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
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
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
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
                            return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
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

                // Update Provider metrics atomically
                await OfferwallProvider.findByIdAndUpdate(provider._id, {
                    $inc: { totalReversalCount: 1 }
                });

                log.status = 'Reversed';
                log.transactionId = tx._id;
                log.reversalReferenceTxId = origTx?._id;
                log.reversedAmountUSD = deductionAmount;
                log.chargebackStatus = chargebackStatus;
                log.userBalanceBefore = balanceBefore;
                log.userBalanceAfter = balanceAfter;
                try { await log.save(); } catch (_) {}

                await Notification.create({
                    userId: user._id,
                    subject: `Offerwall Reversal: ${provider.name} ⚠️`,
                    message: `An offerwall reward of $${deductionAmount} was revoked by the advertiser/provider (${provider.name} - ${normalized.offerName}). Your task earnings balance has been adjusted.`,
                    senderType: 'System'
                });

                return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
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
                            body: providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK'
                        }
                    };
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
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
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'DUP_ALREADY_PROCESSED');
                }

                // Safety guard: Check if an out-of-order reversal has already been processed for this transaction ID.
                const priorReversal = (await Transaction.findOne({ idempotencyKey: reversalKey }))
                    || (await Transaction.findOne({
                        offerwallProvider: providerKey,
                        externalTransactionId: normalized.externalTxId,
                        type: 'Offerwall Reversal'
                    }));

                if (priorReversal) {
                    log.status = 'PreReversed';
                    log.errorMessage = 'Credit received after pre-existing reversal; balance mutation bypassed safely at net zero.';
                    try { await log.save(); } catch (_) {}
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'OK');
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
                        amount: normalized.rewardUSD,
                        amountUSD: userRewardUSD,
                        grossAmount: grossUSD,
                        userRewardAmount: userRewardUSD,
                        platformRevenueAmount: platformRevenueUSD,
                        balanceBefore,
                        balanceAfter,
                        status: riskStatus === 'REVIEW' ? 'Pending' : 'Approved',
                        riskStatus,
                        description: `Completed ${provider.name} Offer/Survey: ${normalized.offerName}`,
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
                        return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'DUP_ALREADY_PROCESSED');
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

                // Update Provider metrics atomically
                await OfferwallProvider.findByIdAndUpdate(provider._id, {
                    $inc: {
                        totalGrossPayoutUSD: grossUSD,
                        totalUserPayoutUSD: userRewardUSD,
                        totalPlatformRevenueUSD: platformRevenueUSD,
                        totalPostbackCount: 1
                    }
                });

                log.status = 'Processed';
                log.transactionId = tx._id;
                log.userBalanceBefore = balanceBefore;
                log.userBalanceAfter = balanceAfter;
                try { await log.save(); } catch (_) {}

                // Notify Worker in Inbox
                await Notification.create({
                    userId: user._id,
                    subject: `Offerwall Reward Credited! 🎁 (+$${userRewardUSD})`,
                    message: `You earned $${userRewardUSD} from ${provider.name} (${normalized.offerName}). The reward has been credited directly to your Work & Earn Task Balance!`,
                    senderType: 'System'
                });

                // Return provider-expected success body
                if (providerKey === 'torox' || providerKey === 'cpx_research') {
                    return res.status(200).send('1');
                }
                if (providerKey === 'wannads' || providerKey === 'notik' || providerKey === 'bitlabs') {
                    return res.status(200).send('OK');
                }
                if (providerKey === 'revlum' || providerKey === 'monlix' || providerKey === 'lootably') {
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
export const getOfferwallProviders = async (req, res) => {
    try {
        const isAdmin = isAuthorizedAdmin(req.user);

        if (isAdmin) {
            const providers = await OfferwallProvider.find().sort({ category: 1, name: 1 });
            return res.status(200).json({ success: true, count: providers.length, data: providers });
        }

        // Public / Worker View: Only enabled, non-disabled, non-suspended providers with SAFE projection
        const providers = await OfferwallProvider.find(
            { enabled: true, status: { $nin: ['DISABLED', 'SUSPENDED', 'NOT_STARTED'] } },
            'providerKey name category group description icon badge technicalReadinessScore approvalLikelihoodScore iframeUrlTemplate status enabled userRevenueSharePercent platformRevenueSharePercent commissionMode'
        ).sort({ category: 1, name: 1 });

        const sanitized = providers.map(p => {
            const obj = p.toObject();
            if (req.user?.id && obj.iframeUrlTemplate) {
                obj.iframeUrl = obj.iframeUrlTemplate
                    .replace(/\{userId\}/g, String(req.user.id))
                    .replace(/\{appId\}/g, p.appId || '');
            }
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
            'name', 'category', 'group', 'enabled', 'appId', 'secretKey', 'postbackKey',
            'iframeUrlTemplate', 'exchangeRateMultiplier', 'commissionMode', 'userRevenueSharePercent',
            'platformRevenueSharePercent', 'ipWhitelist', 'requireSignature', 'signatureType',
            'testMode', 'description', 'badge', 'icon', 'status', 'approvalStatus',
            'integrationStatus', 'riskThresholdUSD', 'holdRewards', 'holdThresholdUSD',
            'complianceNotes', 'customConfig'
        ];

        const sanitizedUpdates = {};
        for (const field of ALLOWED_FIELDS) {
            if (body[field] !== undefined) {
                sanitizedUpdates[field] = body[field];
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

        res.status(200).json({ success: true, data: provider });
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
            iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={appId}&user_id={userId}',
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
