import { getHeaders } from './api';

export interface PlacementOfferCountItem {
    providerKey: string;
    subTabId?: string;
    offerCountSource: 'verified_api' | 'unsupported_no_api' | 'credentials_missing' | 'api_error' | 'unavailable' | string;
    verifiedOfferCount: number | null;
    verifiedOfferIds?: string[];
}

export interface TabOfferCountSummaryDto {
    verifiedTotal: number;
    verifiedProvidersCount: number;
    unverifiedProvidersCount: number;
    totalProvidersCount: number;
    hasPartialCoverage: boolean;
    displayBadge: string | null;
}

export interface TabOfferCountsPayload {
    placements: Record<string, PlacementOfferCountItem>;
    summary: TabOfferCountSummaryDto;
}

export interface ProviderPlacement {
    _id: string;
    providerKey: string;
    placementEnabled: boolean;
    parentTabId: string;
    subTabId?: string;
    subTabName?: string;
    launchDisplayMode: 'inline' | 'modal';
    displayName: string;
    descriptionOverride?: string;
    badgeOverride?: string;
    iconOverride?: string;
    displayOrder: number;
    targetingMode: 'all' | 'selected_users' | 'test_users';
    selectedUserIds?: any[];
    testUserIds?: any[];
    allowedCountries?: string[];
    excludedCountries?: string[];
    rolloutPercentage: number;
    rolloutSalt?: string;
    offerwallVisibility: boolean;
    availableTasksVisibility: boolean;
    trustedLaunchDomains?: string[];
    providerInfo?: {
        name: string;
        category: string;
        group: string;
        status: string;
        enabled: boolean;
        approvalStatus?: string;
        icon?: string;
        badge?: string;
        description?: string;
    };
    icon?: string;
    badge?: string;
    description?: string;
    offerCountSource?: string;
    verifiedOfferCount?: number | null;
    verifiedOfferIds?: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface ProviderCatalogItem {
    providerKey: string;
    name: string;
    category: string;
    group: string;
    enabled: boolean;
    status: string;
    approvalStatus?: string;
    integrationStatus?: string;
    icon?: string;
    badge?: string;
    description?: string;
    technicalReadinessScore?: number;
    approvalLikelihoodScore?: string;
    complianceNotes?: string;
}

export interface PlacementAuditLog {
    _id: string;
    placementId: string;
    adminId: string;
    adminUsername: string;
    action: 'CREATED' | 'UPDATED' | 'DELETED' | 'TOGGLED';
    changes: any;
    createdAt: string;
}

export interface LaunchPlacementResponse {
    success: boolean;
    launchUrl: string;
    displayName: string;
    providerKey: string;
    launchDisplayMode: 'inline' | 'modal';
}

const API_BASE = '/api/v1/provider-placements';

export interface PlacementCacheEntry {
    userId: string;
    parentTabId: string;
    data: ProviderPlacement[];
    updatedAt: number;
}

interface InFlightPlacementRequest {
    promise: Promise<ProviderPlacement[]>;
    seq: number;
    epoch: number;
    controller: AbortController | null;
}

export interface OfferCountCacheEntry {
    userId: string;
    tabId: string;
    data: TabOfferCountsPayload;
    updatedAt: number;
}

const placementCache = new Map<string, PlacementCacheEntry>();
const inFlightPlacementRequests = new Map<string, InFlightPlacementRequest>();
const offerCountCache = new Map<string, OfferCountCacheEntry>();
const inFlightOfferCountRequests = new Map<string, { promise: Promise<Record<string, TabOfferCountsPayload>>; epoch: number }>();
const offerCountListeners = new Set<() => void>();
const OFFER_COUNT_CLIENT_TTL_MS = 150000; // 2.5 minutes

let activeCacheUserId: string | null = null;
let cacheEpoch = 0;
let requestCounter = 0;
let sawBrowserAuthToken = false;
let activePrefetchCancel: (() => void) | null = null;

const notifyOfferCountListeners = () => {
    offerCountListeners.forEach(listener => {
        try {
            listener();
        } catch {
            // Ignore listener errors
        }
    });
};

export const subscribeOfferCountUpdates = (listener: () => void): (() => void) => {
    offerCountListeners.add(listener);
    return () => {
        offerCountListeners.delete(listener);
    };
};

export const getPlacementCacheKey = (userId: string, parentTabId: string): string => {
    return `${String(userId)}::${String(parentTabId)}`;
};

export const clearPlacementCache = (): void => {
    cacheEpoch += 1;
    if (activePrefetchCancel) {
        const cancelFn = activePrefetchCancel;
        activePrefetchCancel = null;
        try {
            cancelFn();
        } catch {
            // Ignore cleanup errors
        }
    }
    inFlightPlacementRequests.forEach(req => {
        try {
            req.controller?.abort();
        } catch {
            // Ignore abort errors
        }
    });
    inFlightPlacementRequests.clear();
    placementCache.clear();
    inFlightOfferCountRequests.clear();
    offerCountCache.clear();
    activeCacheUserId = null;
    sawBrowserAuthToken = false;
    notifyOfferCountListeners();
};

export const syncPlacementCacheUser = (userId?: string | null): void => {
    const normalizedId = userId ? String(userId).trim() : '';
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('authToken');
        if (token) {
            sawBrowserAuthToken = true;
        } else if (sawBrowserAuthToken) {
            // Token was cleared on logout
            clearPlacementCache();
            return;
        }
    }

    if (!normalizedId) {
        if (activeCacheUserId !== null || placementCache.size > 0 || inFlightPlacementRequests.size > 0) {
            clearPlacementCache();
        }
        return;
    }

    if (activeCacheUserId !== normalizedId) {
        if (activeCacheUserId !== null || placementCache.size > 0 || inFlightPlacementRequests.size > 0) {
            clearPlacementCache();
        }
        activeCacheUserId = normalizedId;
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.getItem('authToken')) {
            sawBrowserAuthToken = true;
        }
    }
};

// Cross-tab or direct localStorage logout invalidation
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === null) {
            clearPlacementCache();
            return;
        }
        if ((event.key === 'authToken' || event.key === 'currentUser') && !event.newValue) {
            clearPlacementCache();
        }
    });
}

export const getCachedAvailablePlacements = (
    userId: string | null | undefined,
    parentTabId: string
): ProviderPlacement[] | null => {
    syncPlacementCacheUser(userId);
    const normalizedUserId = userId ? String(userId).trim() : '';
    const normalizedTabId = parentTabId ? String(parentTabId).trim() : '';
    if (!normalizedUserId || !normalizedTabId) {
        return null;
    }
    const entry = placementCache.get(getPlacementCacheKey(normalizedUserId, normalizedTabId));
    if (!entry || entry.userId !== normalizedUserId) {
        return null;
    }
    return [...entry.data];
};

export const getPlacementCacheEntryMeta = (
    userId: string | null | undefined,
    parentTabId: string
): { updatedAt: number; count: number } | null => {
    syncPlacementCacheUser(userId);
    const normalizedUserId = userId ? String(userId).trim() : '';
    const normalizedTabId = parentTabId ? String(parentTabId).trim() : '';
    if (!normalizedUserId || !normalizedTabId) {
        return null;
    }
    const entry = placementCache.get(getPlacementCacheKey(normalizedUserId, normalizedTabId));
    if (!entry || entry.userId !== normalizedUserId) {
        return null;
    }
    return { updatedAt: entry.updatedAt, count: entry.data.length };
};

export const fetchAvailablePlacements = async (
    parentTabId: string,
    options?: { signal?: AbortSignal }
): Promise<ProviderPlacement[]> => {
    const res = await fetch(`${API_BASE}/available/${encodeURIComponent(parentTabId)}`, {
        headers: getHeaders(),
        signal: options?.signal
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch available provider placements');
    }
    return Array.isArray(data.data) ? data.data : [];
};

export const fetchAndCacheAvailablePlacements = async (
    userId: string | null | undefined,
    parentTabId: string
): Promise<ProviderPlacement[]> => {
    syncPlacementCacheUser(userId);
    const normalizedUserId = userId ? String(userId).trim() : '';
    const normalizedTabId = parentTabId ? String(parentTabId).trim() : '';
    if (!normalizedUserId || !normalizedTabId) {
        return [];
    }

    const key = getPlacementCacheKey(normalizedUserId, normalizedTabId);
    const existing = inFlightPlacementRequests.get(key);
    if (existing && existing.epoch === cacheEpoch) {
        return existing.promise;
    }

    const requestEpoch = cacheEpoch;
    const requestSeq = ++requestCounter;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const promise = (async (): Promise<ProviderPlacement[]> => {
        try {
            const placements = await fetchAvailablePlacements(normalizedTabId, {
                signal: controller?.signal
            });

            if (requestEpoch === cacheEpoch && activeCacheUserId === normalizedUserId) {
                placementCache.set(key, {
                    userId: normalizedUserId,
                    parentTabId: normalizedTabId,
                    data: placements,
                    updatedAt: Date.now()
                });
            }

            return [...placements];
        } finally {
            const currentInFlight = inFlightPlacementRequests.get(key);
            if (currentInFlight && currentInFlight.seq === requestSeq) {
                inFlightPlacementRequests.delete(key);
            }
        }
    })();

    inFlightPlacementRequests.set(key, {
        promise,
        seq: requestSeq,
        epoch: requestEpoch,
        controller
    });

    return promise;
};

export const getCachedTabOfferCounts = (
    userId: string | null | undefined,
    tabId: string
): TabOfferCountsPayload | null => {
    syncPlacementCacheUser(userId);
    const normalizedUserId = userId ? String(userId).trim() : '';
    const normalizedTabId = tabId ? String(tabId).trim() : '';
    if (!normalizedUserId || !normalizedTabId) {
        return null;
    }
    const entry = offerCountCache.get(getPlacementCacheKey(normalizedUserId, normalizedTabId));
    if (!entry || entry.userId !== normalizedUserId) {
        return null;
    }
    return entry.data;
};

export const getCachedAllTabOfferCounts = (
    userId: string | null | undefined
): Record<string, TabOfferCountsPayload> => {
    syncPlacementCacheUser(userId);
    const normalizedUserId = userId ? String(userId).trim() : '';
    if (!normalizedUserId) {
        return {};
    }
    const result: Record<string, TabOfferCountsPayload> = {};
    offerCountCache.forEach((entry) => {
        if (entry.userId === normalizedUserId) {
            result[entry.tabId] = entry.data;
        }
    });
    return result;
};

export const fetchAndCacheTabOfferCounts = async (
    userId: string | null | undefined,
    tabIds: string[],
    options?: { backgroundSync?: boolean; forceRefresh?: boolean }
): Promise<Record<string, TabOfferCountsPayload>> => {
    syncPlacementCacheUser(userId);
    const normalizedUserId = userId ? String(userId).trim() : '';
    const uniqueTabs = Array.from(
        new Set((tabIds || []).map(id => (id ? String(id).trim() : '')).filter(Boolean))
    );

    if (!normalizedUserId || uniqueTabs.length === 0) {
        return {};
    }

    const now = Date.now();
    const tabsToFetch = options?.forceRefresh
        ? uniqueTabs
        : uniqueTabs.filter(tabId => {
            const existing = offerCountCache.get(getPlacementCacheKey(normalizedUserId, tabId));
            return !existing || existing.userId !== normalizedUserId || now - existing.updatedAt >= OFFER_COUNT_CLIENT_TTL_MS;
        });

    if (tabsToFetch.length === 0) {
        const snapshot: Record<string, TabOfferCountsPayload> = {};
        for (const tabId of uniqueTabs) {
            const cached = offerCountCache.get(getPlacementCacheKey(normalizedUserId, tabId));
            if (cached) snapshot[tabId] = cached.data;
        }
        return snapshot;
    }

    const batchKey = `${normalizedUserId}::${[...tabsToFetch].sort().join(',')}`;
    const existingReq = inFlightOfferCountRequests.get(batchKey);
    if (existingReq && existingReq.epoch === cacheEpoch) {
        return existingReq.promise;
    }

    const requestEpoch = cacheEpoch;
    const isBackgroundSync = options?.backgroundSync !== false;

    const promise = (async (): Promise<Record<string, TabOfferCountsPayload>> => {
        try {
            const res = await fetch(
                `${API_BASE}/offer-counts?tabIds=${encodeURIComponent(tabsToFetch.join(','))}`,
                {
                    headers: getHeaders(false, isBackgroundSync)
                }
            );
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success || !data?.tabs || typeof data.tabs !== 'object') {
                return {};
            }

            const tabsMap = data.tabs as Record<string, TabOfferCountsPayload>;
            if (requestEpoch === cacheEpoch && activeCacheUserId === normalizedUserId) {
                const updatedAt = Date.now();
                for (const [tabId, payload] of Object.entries(tabsMap)) {
                    if (payload && typeof payload === 'object') {
                        offerCountCache.set(getPlacementCacheKey(normalizedUserId, tabId), {
                            userId: normalizedUserId,
                            tabId,
                            data: payload,
                            updatedAt
                        });
                    }
                }
                notifyOfferCountListeners();
            }

            return tabsMap;
        } catch {
            // Non-blocking background count failure must never disrupt placements
            return {};
        } finally {
            const current = inFlightOfferCountRequests.get(batchKey);
            if (current && current.promise === promise) {
                inFlightOfferCountRequests.delete(batchKey);
            }
        }
    })();

    inFlightOfferCountRequests.set(batchKey, { promise, epoch: requestEpoch });
    return promise;
};

export const scheduleOtherTasksPrefetch = ({
    userId,
    tabIds,
    isCancelled,
    freshTtlMs = 30000
}: {
    userId: string | null | undefined;
    tabIds: string[];
    isCancelled?: () => boolean;
    freshTtlMs?: number;
}): (() => void) => {
    syncPlacementCacheUser(userId);
    const normalizedUserId = userId ? String(userId).trim() : '';
    const uniqueTabs = Array.from(
        new Set((tabIds || []).map(id => (id ? String(id).trim() : '')).filter(Boolean))
    );

    if (!normalizedUserId || uniqueTabs.length === 0) {
        return () => {};
    }

    if (activePrefetchCancel) {
        try {
            activePrefetchCancel();
        } catch {
            // Ignore prior cancellation error
        }
        activePrefetchCancel = null;
    }

    let cancelled = false;
    let idleHandle: number | null = null;
    let timerHandle: ReturnType<typeof setTimeout> | null = null;
    const startEpoch = cacheEpoch;

    const hasIdleCallback =
        typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function';

    const clearScheduledTimers = () => {
        if (idleHandle !== null && typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function') {
            (window as any).cancelIdleCallback(idleHandle);
            idleHandle = null;
        }
        if (timerHandle !== null) {
            clearTimeout(timerHandle);
            timerHandle = null;
        }
    };

    const shouldAbort = (): boolean => {
        return (
            cancelled ||
            Boolean(isCancelled?.()) ||
            cacheEpoch !== startEpoch ||
            activeCacheUserId !== normalizedUserId
        );
    };

    const scheduleStep = (fn: () => void) => {
        if (shouldAbort()) return;
        if (hasIdleCallback) {
            idleHandle = (window as any).requestIdleCallback(
                () => {
                    idleHandle = null;
                    fn();
                },
                { timeout: 2500 }
            );
        } else {
            timerHandle = setTimeout(() => {
                timerHandle = null;
                fn();
            }, 150);
        }
    };

    let index = 0;
    let countsPrefetched = false;
    const runNextTab = async () => {
        if (shouldAbort()) return;
        while (index < uniqueTabs.length) {
            if (shouldAbort()) return;
            const tabId = uniqueTabs[index++];
            const key = getPlacementCacheKey(normalizedUserId, tabId);

            // Skip if already in flight for this user or cached recently
            const inFlight = inFlightPlacementRequests.get(key);
            if (inFlight && inFlight.epoch === startEpoch) {
                continue;
            }
            const cachedEntry = placementCache.get(key);
            if (cachedEntry && cachedEntry.userId === normalizedUserId && Date.now() - cachedEntry.updatedAt < freshTtlMs) {
                continue;
            }

            try {
                await fetchAndCacheAvailablePlacements(normalizedUserId, tabId);
            } catch {
                // Background prefetch must stay silent and never block active views
            }

            if (!shouldAbort()) {
                scheduleStep(() => {
                    void runNextTab();
                });
            }
            return;
        }

        // After front & placement prefetches complete, fetch live offer counts in the background
        if (!countsPrefetched && !shouldAbort()) {
            countsPrefetched = true;
            try {
                await fetchAndCacheTabOfferCounts(normalizedUserId, uniqueTabs, {
                    backgroundSync: true
                });
            } catch {
                // Keep background offer count fetch completely silent
            }
        }
    };

    scheduleStep(() => {
        void runNextTab();
    });

    const cancel = () => {
        cancelled = true;
        clearScheduledTimers();
        if (activePrefetchCancel === cancel) {
            activePrefetchCancel = null;
        }
    };

    activePrefetchCancel = cancel;
    return cancel;
};

export const launchPlacement = async (placementId: string): Promise<LaunchPlacementResponse> => {
    const res = await fetch(`${API_BASE}/${placementId}/launch`, {
        method: 'POST',
        headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to launch provider placement session');
    }
    return data;
};

export const fetchAdminPlacements = async (): Promise<ProviderPlacement[]> => {
    const res = await fetch(`${API_BASE}/admin`, {
        headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
        return data.data;
    }
    return [];
};

export const fetchAdminCatalog = async (): Promise<ProviderCatalogItem[]> => {
    const res = await fetch(`${API_BASE}/admin/catalog`, {
        headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
        return data.data;
    }
    return [];
};

export const createAdminPlacement = async (payload: Partial<ProviderPlacement>): Promise<ProviderPlacement> => {
    const res = await fetch(`${API_BASE}/admin`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create provider placement');
    }
    return data.data;
};

export const updateAdminPlacement = async (placementId: string, payload: Partial<ProviderPlacement>): Promise<ProviderPlacement> => {
    const res = await fetch(`${API_BASE}/admin/${placementId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update provider placement');
    }
    return data.data;
};

export const deleteAdminPlacement = async (placementId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/admin/${placementId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete provider placement');
    }
};

export const previewPlacementEligibility = async (placementId: string, testUserId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/admin/${placementId}/preview`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ testUserId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to preview placement eligibility');
    }
    return data.preview;
};

export const fetchAdminAuditLogs = async (): Promise<PlacementAuditLog[]> => {
    const res = await fetch(`${API_BASE}/admin/audit`, {
        headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
        return data.data;
    }
    return [];
};
