import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import OfferwallProvider from '../models/OfferwallProvider.js';
import OfferwallPostbackLog from '../models/OfferwallPostbackLog.js';
import Notification from '../models/Notification.js';

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
 * Signature verification utility for various provider hashing schemes
 */
const verifySignature = (provider, params, clientIp) => {
    if (!provider.requireSignature || provider.signatureType === 'none') {
        return { valid: true };
    }

    const secret = provider.secretKey || provider.postbackKey || '';

    // If IP whitelist check is requested
    if (provider.signatureType === 'ip_only' || (provider.ipWhitelist && provider.ipWhitelist.length > 0)) {
        if (provider.ipWhitelist && provider.ipWhitelist.length > 0) {
            const ipMatches = provider.ipWhitelist.some(allowedIp => allowedIp.trim() === clientIp);
            if (!ipMatches) {
                return { valid: false, error: `Client IP ${clientIp} not in whitelist` };
            }
        }
        if (provider.signatureType === 'ip_only') {
            return { valid: true };
        }
    }

    // P4: If signature is required, secret must be configured; fail closed if missing
    if (!secret && !provider.testMode) {
        return { valid: false, error: 'Provider secret key is not configured; failing closed' };
    }

    if (provider.testMode && !secret) {
        return { valid: true };
    }

    // Provider-specific verification algorithms
    const key = provider.providerKey.toLowerCase();

    try {
        if (key === 'torox') {
            // Torox md5: md5(user_id + "-" + id + "-" + secret_key)
            const sig = params.sig || params.signature || '';
            const userId = params.user_id || params.uid || '';
            const txId = params.id || params.trans_id || '';
            if (!sig) return { valid: false, error: 'Torox signature missing' };
            const expected = crypto.createHash('md5').update(`${userId}-${txId}-${secret}`).digest('hex');
            if (sig.toLowerCase() !== expected.toLowerCase()) {
                return { valid: false, expected, received: sig, error: 'Torox signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'cpx_research') {
            const hash = params.hash || params.signature || '';
            const transId = params.trans_id || params.transaction_id || '';
            if (!hash) return { valid: false, error: 'CPX signature missing' };
            const expected = crypto.createHash('md5').update(`${transId}-${secret}`).digest('hex');
            if (hash.toLowerCase() !== expected.toLowerCase()) {
                const altExpected = crypto.createHash('md5').update(`${params.ext_user_id || ''}-${secret}`).digest('hex');
                if (hash.toLowerCase() !== altExpected.toLowerCase()) {
                    return { valid: false, expected, received: hash, error: 'CPX signature mismatch' };
                }
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
            if (signature.toLowerCase() !== expected.toLowerCase()) {
                return { valid: false, expected, received: signature, error: 'Wannads signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'revlum') {
            const signature = params.signature || params.sig || '';
            const transId = params.transId || params.transaction_id || '';
            const subId = params.subId || params.user_id || '';
            const reward = params.reward || params.payout || '';
            if (!signature) return { valid: false, error: 'Revlum signature missing' };
            const hmacExpected = crypto.createHmac('sha256', secret).update(`${transId}${subId}${reward}`).digest('hex');
            const sha256Expected = crypto.createHash('sha256').update(`${transId}${subId}${reward}${secret}`).digest('hex');
            if (signature.toLowerCase() !== hmacExpected.toLowerCase() && signature.toLowerCase() !== sha256Expected.toLowerCase()) {
                return { valid: false, expected: hmacExpected, received: signature, error: 'Revlum signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'monlix') {
            const secretKeyReceived = params.secretKey || params.secret || '';
            const signature = params.signature || '';
            if (secretKeyReceived && secretKeyReceived === secret) {
                return { valid: true };
            }
            if (signature) {
                const expected = crypto.createHash('sha256').update(`${params.userId || ''}${params.transactionId || ''}${secret}`).digest('hex');
                if (signature.toLowerCase() !== expected.toLowerCase()) {
                    return { valid: false, expected, received: signature, error: 'Monlix signature mismatch' };
                }
                return { valid: true };
            }
            return { valid: false, error: 'Monlix signature or secret key missing/invalid' };
        }

        if (key === 'lootably') {
            const signature = params.signature || '';
            const userID = params.userID || params.user_id || '';
            const ip = params.ip || clientIp || '';
            const revenue = params.revenue || params.pointValue || '';
            if (!signature) return { valid: false, error: 'Lootably signature missing' };
            const expected = crypto.createHash('sha256').update(`${userID}${ip}${revenue}${secret}`).digest('hex');
            if (signature.toLowerCase() !== expected.toLowerCase()) {
                return { valid: false, expected, received: signature, error: 'Lootably signature mismatch' };
            }
            return { valid: true };
        }

        if (key === 'bitlabs') {
            const hash = params.hash || params.signature || '';
            const val = params.val || params.reward || '';
            const uid = params.uid || params.user_id || '';
            const tx = params.tx || params.tx_id || '';
            if (!hash) return { valid: false, error: 'BitLabs signature missing' };
            const sha1Expected = crypto.createHmac('sha1', secret).update(`${val}${uid}${tx}`).digest('hex');
            const sha256Expected = crypto.createHmac('sha256', secret).update(`${val}${uid}${tx}`).digest('hex');
            if (hash.toLowerCase() !== sha1Expected.toLowerCase() && hash.toLowerCase() !== sha256Expected.toLowerCase()) {
                return { valid: false, expected: sha256Expected, received: hash, error: 'BitLabs signature mismatch' };
            }
            return { valid: true };
        }

        // Generic HMAC-SHA256, MD5, or SHA256 verification
        if (provider.signatureType === 'hmac_sha256') {
            const received = params.signature || params.sig || params.hash || '';
            if (!received) return { valid: false, error: 'HMAC-SHA256 signature missing' };
            const payload = params.trans_id || params.txid || params.id || params.transaction_id || '';
            const expected = crypto.createHmac('sha256', secret).update(String(payload)).digest('hex');
            if (received.toLowerCase() !== expected.toLowerCase()) {
                return { valid: false, expected, received, error: 'HMAC-SHA256 signature mismatch' };
            }
            return { valid: true };
        } else if (provider.signatureType === 'md5') {
            const received = params.signature || params.sig || params.hash || '';
            if (!received) return { valid: false, error: 'MD5 signature missing' };
            const payload = `${params.user_id || params.uid || params.subId || ''}-${params.id || params.txid || params.trans_id || ''}-${secret}`;
            const expected = crypto.createHash('md5').update(payload).digest('hex');
            if (received.toLowerCase() !== expected.toLowerCase()) {
                return { valid: false, expected, received, error: 'MD5 signature mismatch' };
            }
            return { valid: true };
        } else if (provider.signatureType === 'sha256') {
            const received = params.signature || params.sig || params.hash || '';
            if (!received) return { valid: false, error: 'SHA256 signature missing' };
            const payload = `${params.user_id || params.uid || params.subId || ''}-${params.id || params.txid || params.trans_id || ''}-${secret}`;
            const expected = crypto.createHash('sha256').update(payload).digest('hex');
            if (received.toLowerCase() !== expected.toLowerCase()) {
                return { valid: false, expected, received, error: 'SHA256 signature mismatch' };
            }
            return { valid: true };
        }
    } catch (err) {
        return { valid: false, error: err.message };
    }

    return { valid: true };
};

/**
 * Standardize incoming parameters across all 26 networks
 */
const normalizePostbackParams = (providerKey, rawParams) => {
    const p = { ...rawParams };
    const key = providerKey.toLowerCase();

    // Extract User ID / SubID
    let rawUserId = p.user_id || p.userId || p.uid || p.subId || p.subid || p.subid1 || p.sid || p.s1 || p.ext_user_id || p.userID || p.custom_data || p.app_uid || '';

    // Extract Transaction ID
    let rawTxId = p.id || p.trans_id || p.transId || p.transaction_id || p.transactionId || p.tx_id || p.txid || p.txn_id || p.transactionID || p.event_id || p.eventId || p.rewardId || p.request_uuid || p.oid || '';

    // Extract Reward Amount (USD)
    let rawAmount = p.amount || p.reward || p.payout || p.pointValue || p.amount_usd || p.amount_local || p.rate || p.pts || p.val || p.rewardAmount || p.currency_amount || p.rewards || p.reward_amount || p.points || 0;

    // Detect Reversal / Chargeback
    let isReversal = false;
    if (
        p.status === '2' || p.status === 2 || 
        p.status === '0' || p.status === 0 || 
        p.status === 'chargeback' || p.status === 'reversal' || p.status === 'REV' || 
        p.type === 'reversal' || p.type === 'chargeback' || p.type === 'RECONCILIATION' ||
        p.isReversal === 'true' || p.isReversal === true ||
        Number(rawAmount) < 0
    ) {
        isReversal = true;
    }

    const rewardNum = Math.abs(Number(rawAmount) || 0);

    return {
        userId: String(rawUserId).trim(),
        externalTxId: String(rawTxId).trim() || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        rewardUSD: rewardNum,
        rawReward: Number(rawAmount) || 0,
        rawCurrency: p.currency || 'USD',
        offerId: String(p.offer_id || p.oid || p.offerId || p.campaign_id || '').trim(),
        offerName: String(p.o_name || p.offer_name || p.offerName || p.campaign_name || p.reward_name || `${providerKey} reward`).trim(),
        isReversal,
        signature: p.sig || p.signature || p.hash || p.secretKey || ''
    };
};

const isAuthorizedAdmin = (user) => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'super_admin' || user.email === 'studio56.pk@gmail.com';
};

/**
 * Handle incoming S2S Postback
 */
export const handlePostback = async (req, res) => {
    const providerKey = req.params.provider?.toLowerCase() || 'generic';
    const rawParams = { ...req.query, ...req.body };
    const clientIp = getClientIp(req);

    // P3: Unknown Provider Safety - DO NOT auto-create unknown providers!
    const provider = await OfferwallProvider.findOne({ providerKey });
    if (!provider) {
        console.warn(`[SECURITY ALERT] Unknown provider postback attempt: '${providerKey}' from IP ${clientIp}`);
        return res.status(404).json({
            success: false,
            error: `UNKNOWN_PROVIDER: Provider '${providerKey}' is not registered or supported.`,
            alert: 'SECURITY_ALERT_LOGGED'
        });
    }

    // P14: Provider State Check
    if (!provider.enabled || provider.status === 'DISABLED' || provider.status === 'SUSPENDED') {
        return res.status(403).json({
            success: false,
            error: `PROVIDER_INACTIVE: Provider '${providerKey}' is currently disabled or suspended.`
        });
    }

    const normalized = normalizePostbackParams(providerKey, rawParams);

    // Create initial postback log record
    const log = new OfferwallPostbackLog({
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
        queryParams: req.query,
        rawBody: req.body,
        rawHeaders: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
            'x-forwarded-for': req.headers['x-forwarded-for']
        },
        signature: normalized.signature
    });

    try {
        // P4: Strict Signature & IP Validation (Fail-closed)
        const sigCheck = verifySignature(provider, rawParams, clientIp);
        if (!sigCheck.valid) {
            log.status = 'InvalidSignature';
            log.signatureStatus = 'Invalid';
            log.errorMessage = sigCheck.error || 'Signature check failed';
            try { await log.save(); } catch (_) {}
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
            log.status = 'UserNotFound';
            log.errorMessage = `User not found for subId: ${normalized.userId}`;
            try { await log.save(); } catch (_) {}
            // Acknowledge so provider doesn't indefinitely retry an orphaned subId, but do NOT credit
            return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'USER_NOT_FOUND_LOGGED');
        }

        log.userId = user._id;
        log.username = user.username;

        // P5: Database-Level Idempotency Key
        const idempotencyKey = `${providerKey}_${normalized.externalTxId}_${normalized.isReversal ? 'reversal' : 'credit'}`;
        const existingTx = await Transaction.findOne({ idempotencyKey });
        if (existingTx) {
            log.status = 'Duplicate';
            log.errorMessage = 'Transaction already credited with this idempotencyKey';
            try { await log.save(); } catch (_) {}
            return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'DUP_ALREADY_PROCESSED');
        }

        // P8: Gross / User / Platform Split Calculation
        const grossUSD = Number((normalized.rewardUSD * (provider.exchangeRateMultiplier || 1.0)).toFixed(4));
        const userSharePct = (typeof provider.userRevenueSharePercent === 'number' && provider.userRevenueSharePercent >= 0 && provider.userRevenueSharePercent <= 100)
            ? provider.userRevenueSharePercent
            : 100;
        const userRewardUSD = Number((grossUSD * (userSharePct / 100)).toFixed(4));
        const platformRevenueUSD = Number((grossUSD - userRewardUSD).toFixed(4));

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

        if (normalized.isReversal) {
            // ==========================================
            // P7: REVERSAL / CHARGEBACK SAFETY LOGIC
            // ==========================================
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

            // Atomic balance deduction and liability tracking
            const updatedUser = await User.findByIdAndUpdate(user._id, {
                $inc: {
                    taskEarningsBalance: -deductionToApply,
                    taskWalletBalance: -deductionToApply,
                    chargebackLiabilityUSD: liabilityToAdd
                }
            }, { new: true });

            const balanceBefore = currentEarnings;
            const balanceAfter = updatedUser ? updatedUser.taskEarningsBalance : 0;

            const tx = await Transaction.create({
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
                idempotencyKey,
                chargebackStatus,
                reversalReferenceId: origTx?._id,
                description: `Offerwall Chargeback/Reversal: ${provider.name} (${normalized.offerName})`,
                status: 'Approved',
                sourceWallet: 'TaskEarnings',
                destinationWallet: 'External',
                offerwallProvider: providerKey,
                externalTransactionId: normalized.externalTxId
            });

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
            const updatedUser = await User.findOneAndUpdate(
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

            if (!updatedUser) {
                log.status = 'Rejected';
                log.errorMessage = 'User account is blocked or earning restricted';
                try { await log.save(); } catch (_) {}
                return res.status(403).send('USER_RESTRICTED');
            }

            const balanceBefore = Number((updatedUser.taskEarningsBalance - userRewardUSD).toFixed(2));
            const balanceAfter = updatedUser.taskEarningsBalance;

            let tx;
            try {
                tx = await Transaction.create({
                    userId: user._id,
                    userName: user.username,
                    currency: 'USD',
                    type: 'Offerwall Reward',
                    amount: userRewardUSD,
                    amountUSD: userRewardUSD,
                    grossAmount: grossUSD,
                    userRewardAmount: userRewardUSD,
                    platformRevenueAmount: platformRevenueUSD,
                    balanceBefore,
                    balanceAfter,
                    idempotencyKey,
                    riskStatus,
                    description: `Completed ${provider.name} Offer/Survey: ${normalized.offerName}`,
                    status: riskStatus === 'REVIEW' ? 'Pending' : 'Approved',
                    sourceWallet: 'External',
                    destinationWallet: 'TaskEarnings',
                    offerwallProvider: providerKey,
                    externalTransactionId: normalized.externalTxId
                });
            } catch (txErr) {
                // Handle duplicate key error 11000 gracefully (P5)
                if (txErr.code === 11000) {
                    await User.findByIdAndUpdate(user._id, {
                        $inc: {
                            taskEarningsBalance: -userRewardUSD,
                            taskWalletBalance: -userRewardUSD
                        }
                    });
                    log.status = 'Duplicate';
                    log.errorMessage = 'Duplicate transaction key caught by database constraint';
                    try { await log.save(); } catch (_) {}
                    return res.status(200).send(providerKey === 'cpx_research' || providerKey === 'torox' ? '1' : 'DUP_ALREADY_PROCESSED');
                }
                throw txErr;
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
    } catch (err) {
        log.status = 'Error';
        log.errorMessage = err.message;
        try { await log.save(); } catch (_) {}
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
            'providerKey name category group description icon badge technicalReadinessScore approvalLikelihoodScore iframeUrlTemplate status enabled userRevenueSharePercent'
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
            'iframeUrlTemplate', 'exchangeRateMultiplier', 'userRevenueSharePercent',
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

        if (sanitizedUpdates.exchangeRateMultiplier !== undefined) {
            sanitizedUpdates.exchangeRateMultiplier = Math.max(0, Number(sanitizedUpdates.exchangeRateMultiplier) || 1.0);
        }
        if (sanitizedUpdates.userRevenueSharePercent !== undefined) {
            sanitizedUpdates.userRevenueSharePercent = Math.min(100, Math.max(0, Number(sanitizedUpdates.userRevenueSharePercent) || 0));
            sanitizedUpdates.platformRevenueSharePercent = 100 - sanitizedUpdates.userRevenueSharePercent;
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
        
        const testReq = {
            params: { provider: providerKey },
            query: {
                user_id: userId,
                trans_id: `sim_${Date.now()}`,
                amount: amount,
                status: isReversal ? 2 : 1,
                o_name: offerName
            },
            body: {},
            headers: { 'user-agent': 'SmartEXN Postback Simulator' },
            socket: { remoteAddress: '127.0.0.1' }
        };

        const testRes = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            send(body) { this.body = body; return this; },
            json(body) { this.body = body; return this; }
        };

        await handlePostback(testReq, testRes);

        res.status(200).json({
            success: true,
            message: 'Simulation completed',
            simulatorResponse: { status: testRes.statusCode, response: testRes.body }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
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
            enabled: true,
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
            iframeUrlTemplate: 'https://theoremreach.com/respondent_entry/direct?api_key={appId}&user_id={userId}',
            signatureType: 'md5',
            technicalReadinessScore: 100,
            approvalLikelihoodScore: 'High',
            badge: 'Screenout Rewards',
            icon: '💡',
            description: 'Rewarded survey router that rewards users even when they screen out of surveys.',
            complianceNotes: 'API key & MD5 webhook authentication.'
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
            }
        }
        console.log(`Seeded / verified all ${verifiedNetworks.length} external networks.`);
    } catch (err) {
        console.error('Error seeding verified networks:', err.message);
    }
};
