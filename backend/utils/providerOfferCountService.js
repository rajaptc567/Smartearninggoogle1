import crypto from 'crypto';
import net from 'net';

export const OFFER_COUNT_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes per user/provider
export const PROVIDER_FETCH_TIMEOUT_MS = 4500;
const MAX_CACHE_ENTRIES = 5000;

const offerCountCache = new Map();
const inFlightProviderFetches = new Map();

/**
 * Normalizes provider keys cleanly across aliases (e.g. offerwallgg -> offerwall_gg).
 */
export const normalizeOfferCountProviderKey = (providerKey) => {
    const key = String(providerKey || '').trim().toLowerCase();
    if (key === 'offerwallgg') return 'offerwall_gg';
    return key;
};

/**
 * Extracts clean client IP address for geo-accurate survey/offer counts.
 */
export const extractClientIp = (req) => {
    if (!req) return '';
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return String(forwarded[0]).split(',')[0].trim();
    }
    return String(req.socket?.remoteAddress || req.ip || '').trim();
};

/**
 * Validates outbound URLs against SSRF (strict HTTPS + blocks private/loopback/link-local hosts).
 */
export const isSafePublicHttpsUrl = (rawUrl) => {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
    let parsed;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;

    const host = parsed.hostname.toLowerCase().trim();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
        return false;
    }

    const ipVersion = net.isIP(host);
    if (ipVersion === 4) {
        const parts = host.split('.').map(Number);
        const [a, b] = parts;
        if (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127)
        ) {
            return false;
        }
    } else if (ipVersion === 6) {
        const normalized = host.replace(/^\[|\]$/g, '').toLowerCase();
        if (
            normalized === '::1' ||
            normalized === '::' ||
            normalized.startsWith('fc') ||
            normalized.startsWith('fd') ||
            normalized.startsWith('fe80')
        ) {
            return false;
        }
    }

    return true;
};

const pruneOfferCountCacheIfNeeded = () => {
    const now = Date.now();
    for (const [k, entry] of offerCountCache.entries()) {
        if (!entry || entry.expiresAt <= now) {
            offerCountCache.delete(k);
        }
    }
    if (offerCountCache.size > MAX_CACHE_ENTRIES) {
        const excess = offerCountCache.size - MAX_CACHE_ENTRIES;
        let removed = 0;
        for (const k of offerCountCache.keys()) {
            offerCountCache.delete(k);
            removed += 1;
            if (removed >= excess) break;
        }
    }
};

const buildCacheKey = (userId, providerKey, ip) => {
    const normalizedKey = normalizeOfferCountProviderKey(providerKey);
    const ipHash = ip ? crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 12) : 'noip';
    return `${String(userId).trim()}::${normalizedKey}::${ipHash}`;
};

export const clearOfferCountCache = () => {
    offerCountCache.clear();
    inFlightProviderFetches.clear();
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = PROVIDER_FETCH_TIMEOUT_MS) => {
    if (!isSafePublicHttpsUrl(url)) {
        throw new Error('Blocked unsafe or non-HTTPS provider count endpoint');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(options.headers || {})
            }
        });
        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        return { ok: response.ok, status: response.status, data };
    } finally {
        clearTimeout(timer);
    }
};

const extractVerifiedIds = (items, maxIds = 250) => {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const raw =
            item.id ??
            item.offer_id ??
            item.offerId ??
            item.survey_id ??
            item.surveyId ??
            item.campaign_id ??
            item.campaignId;
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            seen.add(String(raw).trim());
            if (seen.size >= maxIds) break;
        }
    }
    return Array.from(seen);
};

const verifiedResult = (providerKey, count, verifiedOfferIds = [], meta = {}) => {
    const safeCount = Number.isFinite(Number(count)) && Number(count) >= 0 ? Math.floor(Number(count)) : 0;
    return {
        providerKey: normalizeOfferCountProviderKey(providerKey),
        offerCountSource: 'verified_api',
        verifiedOfferCount: safeCount,
        verifiedOfferIds: Array.isArray(verifiedOfferIds) && verifiedOfferIds.length > 0 ? verifiedOfferIds : undefined,
        ...meta
    };
};

const unverifiedResult = (providerKey, source = 'unsupported_no_api', reason = '') => ({
    providerKey: normalizeOfferCountProviderKey(providerKey),
    offerCountSource: source,
    verifiedOfferCount: null,
    ...(reason ? { reason } : {})
});

/**
 * Extracts Offerwall.GG 32-char lowercase hex public key safely from template or apiKey.
 */
const extractOfferwallGgPublicKey = (provider) => {
    const template = String(provider?.iframeUrlTemplate || '').trim();
    if (template) {
        try {
            const parsed = new URL(template);
            const match = parsed.pathname.match(/^\/wall\/([a-f0-9]{32})(?:\/)?$/i);
            if (match && /^[a-f0-9]{32}$/.test(match[1].toLowerCase())) {
                return match[1].toLowerCase();
            }
        } catch {
            // Fall through
        }
    }
    const apiKeyCandidate = String(provider?.apiKey || '').trim().toLowerCase();
    if (/^[a-f0-9]{32}$/.test(apiKeyCandidate)) {
        return apiKeyCandidate;
    }
    return '';
};

/**
 * Official Live Offer/Survey Count Adapters
 * Only returns 'verified_api' when a real provider JSON API returns valid data.
 */
const PROVIDER_OFFER_COUNT_ADAPTERS = {
    cpx_research: async ({ provider, userId, clientIp, userAgent }) => {
        const appId = String(provider?.appId || '').trim();
        const secretKey = String(provider?.secretKey || '').trim();
        if (!appId || !secretKey) {
            return unverifiedResult('cpx_research', 'credentials_missing', 'CPX App ID or Secure Hash Key missing');
        }

        const uid = String(userId).trim();
        const secureHash = crypto.createHash('md5').update(`${uid}-${secretKey}`).digest('hex');

        const params = new URLSearchParams({
            app_id: appId,
            ext_user_id: uid,
            output_method: 'api',
            secure_hash: secureHash
        });
        if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' && clientIp !== '0.0.0.0') {
            params.set('ip_user', clientIp);
        }
        if (userAgent) {
            params.set('user_agent', String(userAgent).slice(0, 512));
        }

        const url = `https://live-api.cpx-research.com/api/get-surveys.php?${params.toString()}`;
        const res = await fetchJsonWithTimeout(url);
        if (!res.ok || !res.data) {
            return unverifiedResult('cpx_research', 'api_error', `CPX API returned HTTP ${res.status}`);
        }

        const payload = res.data;
        if (String(payload.status || '').toLowerCase() === 'error') {
            return unverifiedResult('cpx_research', 'api_error', payload.message || 'CPX API error');
        }

        const surveys = Array.isArray(payload.surveys) ? payload.surveys : [];
        const rawCount =
            typeof payload.count_available_surveys === 'number'
                ? payload.count_available_surveys
                : surveys.length;
        const ids = extractVerifiedIds(surveys);
        return verifiedResult('cpx_research', rawCount, ids);
    },

    offerwall_gg: async ({ provider, userId }) => {
        const publicKey = extractOfferwallGgPublicKey(provider);
        const envSecret = process.env.OFFERWALL_GG_SECRET_KEY;
        const secret = envSecret && envSecret.trim()
            ? envSecret.trim()
            : String(provider?.secretKey || '').trim();

        if (!publicKey || !secret) {
            return unverifiedResult('offerwall_gg', 'credentials_missing', 'Offerwall.GG public key or secret key missing');
        }

        const params = new URLSearchParams({
            appId: publicKey,
            userId: String(userId).trim(),
            limit: '50'
        });
        const url = `https://offerwall.gg/api/v1/offers?${params.toString()}`;
        const res = await fetchJsonWithTimeout(url, {
            headers: {
                'X-Api-Key': secret
            }
        });

        if (!res.ok || !res.data || res.data.success === false) {
            return unverifiedResult('offerwall_gg', 'api_error', `Offerwall.GG API returned HTTP ${res.status}`);
        }

        const dataBlock = res.data.data || {};
        const offers = Array.isArray(dataBlock.offers) ? dataBlock.offers : [];
        const total =
            typeof dataBlock.pagination?.total === 'number'
                ? dataBlock.pagination.total
                : offers.length;
        const ids = total <= offers.length ? extractVerifiedIds(offers) : [];
        return verifiedResult('offerwall_gg', total, ids);
    },

    bitlabs: async ({ provider, userId, clientIp, userAgent }) => {
        const token = String(provider?.appId || provider?.apiKey || '').trim();
        if (!token) {
            return unverifiedResult('bitlabs', 'credentials_missing');
        }
        const headers = {
            'X-Api-Token': token,
            'X-User-Id': String(userId).trim()
        };
        if (clientIp && clientIp !== '0.0.0.0') headers['X-User-Ip'] = clientIp;
        if (userAgent) headers['User-Agent'] = String(userAgent).slice(0, 512);

        const res = await fetchJsonWithTimeout('https://api.bitlabs.ai/v2/client/offers', { headers });
        if (!res.ok || !res.data) {
            return unverifiedResult('bitlabs', 'api_error', `BitLabs API HTTP ${res.status}`);
        }
        const offers = Array.isArray(res.data?.data?.offers)
            ? res.data.data.offers
            : Array.isArray(res.data?.offers)
                ? res.data.offers
                : [];
        return verifiedResult('bitlabs', offers.length, extractVerifiedIds(offers));
    },

    bitlabs_surveys: async ({ provider, userId, clientIp, userAgent }) => {
        const token = String(provider?.appId || provider?.apiKey || '').trim();
        if (!token) {
            return unverifiedResult('bitlabs_surveys', 'credentials_missing');
        }
        const headers = {
            'X-Api-Token': token,
            'X-User-Id': String(userId).trim()
        };
        if (clientIp && clientIp !== '0.0.0.0') headers['X-User-Ip'] = clientIp;
        if (userAgent) headers['User-Agent'] = String(userAgent).slice(0, 512);

        const res = await fetchJsonWithTimeout('https://api.bitlabs.ai/v2/client/surveys', { headers });
        if (!res.ok || !res.data) {
            return unverifiedResult('bitlabs_surveys', 'api_error', `BitLabs Surveys API HTTP ${res.status}`);
        }
        const surveys = Array.isArray(res.data?.data?.surveys)
            ? res.data.data.surveys
            : Array.isArray(res.data?.surveys)
                ? res.data.surveys
                : [];
        return verifiedResult('bitlabs_surveys', surveys.length, extractVerifiedIds(surveys));
    },

    lootably: async ({ provider, userId, clientIp, userAgent }) => {
        const placementId = String(provider?.appId || '').trim();
        const apiKey = String(provider?.apiKey || provider?.secretKey || '').trim();
        if (!placementId || !apiKey) {
            return unverifiedResult('lootably', 'credentials_missing');
        }
        const params = new URLSearchParams({
            apiKey,
            placementID: placementId,
            userID: String(userId).trim()
        });
        if (clientIp && clientIp !== '0.0.0.0') params.set('ip', clientIp);
        if (userAgent) params.set('userAgent', String(userAgent).slice(0, 512));

        const res = await fetchJsonWithTimeout(`https://api.lootably.com/api/v2/offers/get?${params.toString()}`);
        if (!res.ok || !res.data || res.data.success === false) {
            return unverifiedResult('lootably', 'api_error', `Lootably API HTTP ${res.status}`);
        }
        const offers = Array.isArray(res.data?.data?.offers)
            ? res.data.data.offers
            : Array.isArray(res.data?.offers)
                ? res.data.offers
                : [];
        return verifiedResult('lootably', offers.length, extractVerifiedIds(offers));
    },

    notik: async ({ provider, userId, clientIp, userAgent }) => {
        const apiKey = String(provider?.apiKey || '').trim();
        const appId = String(provider?.appId || '').trim();
        const pubId = String(provider?.customConfig?.pubId || provider?.customConfig?.pub_id || '').trim();
        if (!apiKey || !appId || !pubId) {
            return unverifiedResult('notik', 'credentials_missing');
        }
        const params = new URLSearchParams({
            api_key: apiKey,
            pub_id: pubId,
            app_id: appId,
            user_id: String(userId).trim()
        });
        if (clientIp && clientIp !== '0.0.0.0') params.set('ip', clientIp);
        if (userAgent) params.set('user_agent', String(userAgent).slice(0, 512));

        const res = await fetchJsonWithTimeout(`https://notik.me/api/v2/get-offers?${params.toString()}`);
        if (!res.ok || !res.data) {
            return unverifiedResult('notik', 'api_error', `Notik API HTTP ${res.status}`);
        }
        const offers = Array.isArray(res.data?.offers?.data)
            ? res.data.offers.data
            : Array.isArray(res.data?.data)
                ? res.data.data
                : [];
        const total = typeof res.data?.offers?.total === 'number' ? res.data.offers.total : offers.length;
        return verifiedResult('notik', total, extractVerifiedIds(offers));
    },

    adgem: async ({ provider }) => {
        const appId = String(provider?.appId || '').trim();
        const apiKey = String(provider?.apiKey || '').trim();
        if (!appId || !apiKey) {
            return unverifiedResult('adgem', 'credentials_missing');
        }
        const params = new URLSearchParams({
            appid: appId,
            token: apiKey
        });
        const res = await fetchJsonWithTimeout(`https://api.adgem.com/v1/all/campaigns?${params.toString()}`);
        if (!res.ok || !res.data || res.data.status === 'error') {
            return unverifiedResult('adgem', 'api_error', `AdGem API HTTP ${res.status}`);
        }
        const data = res.data.data;
        const list = Array.isArray(data) ? data : (data && typeof data === 'object' ? Object.values(data) : []);
        return verifiedResult('adgem', list.length, extractVerifiedIds(list));
    },

    theoremreach: async () => {
        // TheoremReach respondent_entry/direct uses iframe launch only; standard web keys do not expose a public live survey-count endpoint.
        return unverifiedResult('theoremreach', 'unsupported_no_api');
    }
};

/**
 * Optional Admin-configured custom JSON offer-count endpoint for newly added providers.
 */
const fetchFromCustomOfferCountFeed = async ({ provider, userId, clientIp }) => {
    const rawTemplate = String(provider?.customConfig?.offerCountApiUrl || '').trim();
    if (!rawTemplate) return null;

    const replaced = rawTemplate
        .replace(/\{userId\}/g, encodeURIComponent(String(userId).trim()))
        .replace(/\{appId\}/g, encodeURIComponent(String(provider?.appId || '').trim()))
        .replace(/\{ip\}/g, encodeURIComponent(String(clientIp || '').trim()));

    if (!isSafePublicHttpsUrl(replaced)) {
        return unverifiedResult(provider.providerKey, 'api_error', 'Custom offerCountApiUrl rejected by safety rules');
    }

    const headers = {};
    if (provider?.customConfig?.offerCountApiKeyHeader && provider?.apiKey) {
        headers[String(provider.customConfig.offerCountApiKeyHeader)] = String(provider.apiKey).trim();
    }

    const res = await fetchJsonWithTimeout(replaced, { headers });
    if (!res.ok || !res.data) {
        return unverifiedResult(provider.providerKey, 'api_error', `Custom feed HTTP ${res.status}`);
    }

    const payload = res.data;
    const candidateArray =
        Array.isArray(payload.offers) ? payload.offers :
        Array.isArray(payload.surveys) ? payload.surveys :
        Array.isArray(payload.data?.offers) ? payload.data.offers :
        Array.isArray(payload.data?.surveys) ? payload.data.surveys :
        Array.isArray(payload.data) ? payload.data :
        null;

    const numericCount =
        typeof payload.verifiedOfferCount === 'number' ? payload.verifiedOfferCount :
        typeof payload.count === 'number' ? payload.count :
        typeof payload.total === 'number' ? payload.total :
        typeof payload.data?.pagination?.total === 'number' ? payload.data.pagination.total :
        (candidateArray ? candidateArray.length : null);

    if (typeof numericCount === 'number' && Number.isFinite(numericCount) && numericCount >= 0) {
        return verifiedResult(
            provider.providerKey,
            numericCount,
            candidateArray ? extractVerifiedIds(candidateArray) : []
        );
    }

    return unverifiedResult(provider.providerKey, 'api_error', 'Custom feed did not return a numeric count');
};

/**
 * Fetches live verified offer count for one provider & user (with 3-min cache and concurrency dedup).
 */
export const fetchVerifiedOfferCountForProvider = async ({
    provider,
    userId,
    clientIp = '',
    userAgent = '',
    adapterOverrides = null
}) => {
    if (!provider || !userId) {
        return unverifiedResult(provider?.providerKey || 'unknown', 'invalid_request');
    }

    const normalizedKey = normalizeOfferCountProviderKey(provider.providerKey);
    const cacheKey = buildCacheKey(userId, normalizedKey, clientIp);

    const cached = offerCountCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.result, cached: true };
    }

    if (inFlightProviderFetches.has(cacheKey)) {
        return inFlightProviderFetches.get(cacheKey);
    }

    const promise = (async () => {
        let result;
        try {
            const adapter =
                (adapterOverrides && adapterOverrides[normalizedKey]) ||
                PROVIDER_OFFER_COUNT_ADAPTERS[normalizedKey];

            if (adapter) {
                result = await adapter({ provider, userId, clientIp, userAgent });
            } else if (provider?.customConfig?.offerCountApiUrl) {
                result = await fetchFromCustomOfferCountFeed({ provider, userId, clientIp });
            } else {
                result = unverifiedResult(normalizedKey, 'unsupported_no_api');
            }
        } catch (err) {
            result = unverifiedResult(
                normalizedKey,
                'api_error',
                err?.name === 'AbortError' ? 'Provider count API timed out' : (err?.message || 'Provider count API failed')
            );
        }

        const ttlMs = result?.offerCountSource === 'verified_api'
            ? OFFER_COUNT_CACHE_TTL_MS
            : result?.offerCountSource === 'unsupported_no_api'
                ? OFFER_COUNT_CACHE_TTL_MS
                : 30 * 1000; // Short 30s negative cache on transient errors

        pruneOfferCountCacheIfNeeded();
        offerCountCache.set(cacheKey, {
            result,
            expiresAt: Date.now() + ttlMs
        });

        return { ...result, cached: false };
    })();

    inFlightProviderFetches.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        if (inFlightProviderFetches.get(cacheKey) === promise) {
            inFlightProviderFetches.delete(cacheKey);
        }
    }
};

/**
 * Summarizes verified offer counts across a list of placements for a tab.
 */
export const summarizeTabOfferCounts = (placementItems = []) => {
    const safeItems = Array.isArray(placementItems) ? placementItems : [];
    if (safeItems.length === 0) {
        return {
            verifiedTotal: 0,
            verifiedProvidersCount: 0,
            unverifiedProvidersCount: 0,
            totalProvidersCount: 0,
            hasPartialCoverage: false,
            displayBadge: null
        };
    }

    let verifiedTotal = 0;
    let verifiedProvidersCount = 0;
    let unverifiedProvidersCount = 0;
    const seenVerifiedProviderKeys = new Set();

    for (const item of safeItems) {
        const pKey = normalizeOfferCountProviderKey(item?.providerKey || item?._id || '');
        if (
            item?.offerCountSource === 'verified_api' &&
            typeof item?.verifiedOfferCount === 'number' &&
            Number.isFinite(item.verifiedOfferCount) &&
            item.verifiedOfferCount >= 0
        ) {
            verifiedProvidersCount += 1;
            if (!seenVerifiedProviderKeys.has(pKey)) {
                seenVerifiedProviderKeys.add(pKey);
                verifiedTotal += Math.floor(item.verifiedOfferCount);
            }
        } else {
            unverifiedProvidersCount += 1;
        }
    }

    const hasPartialCoverage = verifiedProvidersCount > 0 && unverifiedProvidersCount > 0;
    const displayBadge =
        verifiedProvidersCount > 0
            ? (hasPartialCoverage ? `${verifiedTotal}+` : String(verifiedTotal))
            : null;

    return {
        verifiedTotal,
        verifiedProvidersCount,
        unverifiedProvidersCount,
        totalProvidersCount: safeItems.length,
        hasPartialCoverage,
        displayBadge
    };
};
