export interface OfferCountInput {
    providerKey?: string;
    verifiedOfferCount?: unknown;
    availableOffersCount?: unknown;
    liveOfferCount?: unknown;
    offerCountSource?: unknown;
    verifiedOfferIds?: unknown;
    // Explicitly ignored unverified/historical fields:
    totalPostbackCount?: unknown;
    totalReversalCount?: unknown;
    clicks?: unknown;
    conversions?: unknown;
    exchangeRateMultiplier?: unknown;
}

export interface VerifiedProviderOfferCountResult {
    count: number | null;
    label: string;
    isVerifiedNumeric: boolean;
}

export interface SelectAllCountSummary {
    providerCount: number;
    nativeItemsCount: number;
    verifiedProvidersCount: number;
    hasDeduplicatedTotal: boolean;
    combinedVerifiedOfferCount: number | null;
}

const isValidNonNegativeCount = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
};

/**
 * Resolves a provider's available offer/survey count ONLY when backed by a verified live offer feed.
 * Historical postbacks, clicks, conversions, multipliers, and placement counts are strictly ignored.
 */
export const getVerifiedProviderOfferCount = (
    item: OfferCountInput | null | undefined,
    fallbackLabel = 'Available'
): VerifiedProviderOfferCountResult => {
    if (!item || typeof item !== 'object') {
        return {
            count: null,
            label: fallbackLabel,
            isVerifiedNumeric: false
        };
    }

    if (item.offerCountSource !== 'verified_api') {
        return {
            count: null,
            label: fallbackLabel,
            isVerifiedNumeric: false
        };
    }

    const candidate =
        item.verifiedOfferCount ??
        item.availableOffersCount ??
        item.liveOfferCount;

    if (isValidNonNegativeCount(candidate)) {
        const normalized = Math.floor(candidate);
        return {
            count: normalized,
            label: String(normalized),
            isVerifiedNumeric: true
        };
    }

    return {
        count: null,
        label: fallbackLabel,
        isVerifiedNumeric: false
    };
};

/**
 * Computes a truthful summary for "SELECT ALL" without blindly summing or double-counting
 * external provider counts unless deduplicated offer identifiers are supplied for every item.
 */
export const computeSelectAllSummary = (
    providers: OfferCountInput[] = [],
    nativeItemsCount = 0
): SelectAllCountSummary => {
    const safeProviders = Array.isArray(providers) ? providers : [];
    const normalizedNativeCount =
        typeof nativeItemsCount === 'number' && Number.isFinite(nativeItemsCount) && nativeItemsCount >= 0
            ? Math.floor(nativeItemsCount)
            : 0;

    if (safeProviders.length === 0) {
        return {
            providerCount: 0,
            nativeItemsCount: normalizedNativeCount,
            verifiedProvidersCount: 0,
            hasDeduplicatedTotal: true,
            combinedVerifiedOfferCount: normalizedNativeCount
        };
    }

    let verifiedProvidersCount = 0;
    const dedupIds = new Set<string>();
    let allProvidersSupplyDedupIds = true;

    for (const prov of safeProviders) {
        const countRes = getVerifiedProviderOfferCount(prov);
        if (countRes.isVerifiedNumeric) {
            verifiedProvidersCount += 1;
        }
        if (
            prov?.offerCountSource === 'verified_api' &&
            Array.isArray(prov.verifiedOfferIds)
        ) {
            const pKey = String(prov.providerKey || 'provider').trim().toLowerCase();
            for (const rawId of prov.verifiedOfferIds) {
                if (rawId !== null && rawId !== undefined && String(rawId).trim() !== '') {
                    dedupIds.add(`${pKey}:${String(rawId).trim()}`);
                }
            }
        } else {
            allProvidersSupplyDedupIds = false;
        }
    }

    if (allProvidersSupplyDedupIds && verifiedProvidersCount === safeProviders.length) {
        return {
            providerCount: safeProviders.length,
            nativeItemsCount: normalizedNativeCount,
            verifiedProvidersCount,
            hasDeduplicatedTotal: true,
            combinedVerifiedOfferCount: normalizedNativeCount + dedupIds.size
        };
    }

    return {
        providerCount: safeProviders.length,
        nativeItemsCount: normalizedNativeCount,
        verifiedProvidersCount,
        hasDeduplicatedTotal: false,
        combinedVerifiedOfferCount: null
    };
};

export interface TabOfferCountSummary {
    verifiedTotal: number;
    verifiedProvidersCount: number;
    unverifiedProvidersCount: number;
    totalProvidersCount: number;
    hasPartialCoverage: boolean;
    displayBadge: string | null;
}

/**
 * Computes an honest combined count badge across providers in a tab or view:
 * - Never includes unverified providers or historical postback/click numbers.
 * - Deduplicates repeated providerKey entries cleanly.
 * - Appends "+" when some active providers do not expose a live count API (partial coverage).
 */
export const computeTabOfferCountSummary = (
    providers: OfferCountInput[] = []
): TabOfferCountSummary => {
    const safeProviders = Array.isArray(providers) ? providers : [];
    if (safeProviders.length === 0) {
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
    const seenVerifiedProviders = new Set<string>();

    for (let idx = 0; idx < safeProviders.length; idx++) {
        const prov = safeProviders[idx];
        const countRes = getVerifiedProviderOfferCount(prov);
        const rawKey = String(prov?.providerKey || `provider_${idx}`).trim().toLowerCase();
        const canonicalKey = rawKey === 'offerwallgg' ? 'offerwall_gg' : rawKey;

        if (countRes.isVerifiedNumeric && countRes.count !== null) {
            verifiedProvidersCount += 1;
            if (!seenVerifiedProviders.has(canonicalKey)) {
                seenVerifiedProviders.add(canonicalKey);
                if (Array.isArray(prov?.verifiedOfferIds) && prov.verifiedOfferIds.length >= countRes.count) {
                    const uniqueIds = new Set(
                        prov.verifiedOfferIds
                            .map(id => (id !== null && id !== undefined ? String(id).trim() : ''))
                            .filter(Boolean)
                    );
                    verifiedTotal += uniqueIds.size;
                } else {
                    verifiedTotal += countRes.count;
                }
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
        totalProvidersCount: safeProviders.length,
        hasPartialCoverage,
        displayBadge
    };
};

/**
 * Formats an honest header status label that distinguishes native tasks from eligible partner placements.
 */
export const formatPartnerCountLabel = (
    partnerCount: number,
    nativeOffersCount = 0,
    verifiedPartnerBadge: string | null = null
): string => {
    const safePartners = typeof partnerCount === 'number' && Number.isFinite(partnerCount) && partnerCount > 0
        ? Math.floor(partnerCount)
        : 0;
    const safeNative = typeof nativeOffersCount === 'number' && Number.isFinite(nativeOffersCount) && nativeOffersCount > 0
        ? Math.floor(nativeOffersCount)
        : 0;

    if (verifiedPartnerBadge && safePartners > 0) {
        return `${verifiedPartnerBadge} Offers · ${safePartners} ${safePartners === 1 ? 'Partner' : 'Partners'}`;
    }
    if (safeNative > 0 && safePartners > 0) {
        return `${safeNative} ${safeNative === 1 ? 'Offer' : 'Offers'} · ${safePartners} ${safePartners === 1 ? 'Partner' : 'Partners'}`;
    }
    if (safeNative > 0) {
        return `${safeNative} ${safeNative === 1 ? 'Offer' : 'Offers'} Available`;
    }
    if (safePartners === 1) {
        return '1 Partner Available';
    }
    return `${safePartners} Partners Available`;
};
