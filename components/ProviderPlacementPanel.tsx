import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from 'react';
import {
    ProviderPlacement,
    TabOfferCountsPayload,
    getPlacementCacheKey,
    getCachedAvailablePlacements,
    fetchAndCacheAvailablePlacements,
    getCachedTabOfferCounts,
    fetchAndCacheTabOfferCounts,
    subscribeOfferCountUpdates,
    syncPlacementCacheUser,
    launchPlacement
} from '../services/providerPlacementService';
import { DataContext } from '../context/DataContext';
import Modal from './ui/Modal';
import {
    Globe as GlobeIcon,
    ExternalLink as LaunchIcon,
    AlertCircle as AlertIcon,
    Sparkles as SparklesIcon,
    X as CloseIcon,
    RefreshCw as RefreshIcon,
    Clock as ClockIcon,
    HelpCircle as InfoIcon
} from 'lucide-react';
import { formatCurrency } from '../types';
import { JobGig } from './OtherTasksCard';
import ProviderNavRow, { ProviderNavItem } from './ProviderNavRow';
import {
    computeSelectAllSummary,
    computeTabOfferCountSummary,
    getVerifiedProviderOfferCount
} from '../utils/providerCountHelper';
import { resolvePageExperience, isSafeImageIcon } from '../utils/pageExperienceHelper';

const PlacementIconGraphic: React.FC<{ icon?: string; label: string }> = ({ icon, label }) => {
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [icon]);

    if (icon && isSafeImageIcon(icon) && !imgFailed) {
        return (
            <img
                src={icon.trim()}
                alt={label}
                onError={() => setImgFailed(true)}
                className="w-8 h-8 rounded-xl object-cover shrink-0 border border-slate-700/80 bg-slate-950"
            />
        );
    }

    return <span className="text-2xl shrink-0">{icon && !isSafeImageIcon(icon) ? icon : '⚡'}</span>;
};

const IFRAME_WAIT_THRESHOLD_SECONDS = 20;

interface SelectAllProviderSessionState {
    sessionId: number;
    status: 'loading' | 'ready' | 'error';
    launchUrl?: string;
    providerKey?: string;
    displayName: string;
    error?: string;
    iframeLoaded: boolean;
    iframeTimedOut: boolean;
    secondsRemaining: number;
}

export interface ProviderPlacementPanelProps {
    activeTabId: string;
    activeSubTabId?: string;
    searchQuery?: string;
    nativeGigs?: JobGig[];
    onSelectGig?: (gig: JobGig) => void;
    exchangeRate?: number;
    userCurrency?: string;
    userId?: string | null;
    onCountChange?: (count: number) => void;
    onVerifiedBadgeChange?: (badge: string | null) => void;
    className?: string;
}

export const ProviderPlacementPanel: React.FC<ProviderPlacementPanelProps> = ({
    activeTabId,
    activeSubTabId = '',
    searchQuery = '',
    nativeGigs = [],
    onSelectGig,
    exchangeRate = 1,
    userCurrency = 'USD',
    userId: userIdProp,
    onCountChange,
    onVerifiedBadgeChange,
    className = ''
}) => {
    const dataContext = useContext(DataContext);
    const activeUserId = userIdProp !== undefined ? userIdProp : (dataContext?.state?.currentUser?._id ?? null);
    const otherTasksExperience = resolvePageExperience(dataContext?.state?.settings).otherTasks;
    const otherTasksNavStyle = resolvePageExperience(dataContext?.state?.settings).otherTasksNavStyle;
    const isNewExperience = otherTasksExperience === 'new';

    const [placements, setPlacements] = useState<ProviderPlacement[]>([]);
    const [tabOfferCounts, setTabOfferCounts] = useState<TabOfferCountsPayload | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [launchingPlacementId, setLaunchingPlacementId] = useState<string | null>(null);
    const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);

    // Active Single Provider Launch Session
    const [activeLaunchSession, setActiveLaunchSession] = useState<{
        sessionId: number;
        placementId: string;
        displayName: string;
        launchUrl: string;
        providerKey: string;
        launchDisplayMode: 'inline' | 'modal';
    } | null>(null);

    // SELECT ALL Vertical Multi-Provider Sessions (only used in 'new' experience when selectedPlacementId === null)
    const [selectAllSessions, setSelectAllSessions] = useState<Record<string, SelectAllProviderSessionState>>({});

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Iframe embed loading & 20s countdown timeout state for single active session
    const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
    const [iframeTimedOut, setIframeTimedOut] = useState<boolean>(false);
    const [secondsRemaining, setSecondsRemaining] = useState<number>(IFRAME_WAIT_THRESHOLD_SECONDS);

    const isMountedRef = useRef<boolean>(true);
    const requestSeqRef = useRef<number>(0);
    const activeTargetKeyRef = useRef<string>('');
    const sessionCounterRef = useRef<number>(0);
    const activeSessionIdRef = useRef<number | null>(null);
    const loadedSessionIdRef = useRef<number | null>(null);
    const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onCountChangeRef = useRef<ProviderPlacementPanelProps['onCountChange']>(onCountChange);
    const onVerifiedBadgeChangeRef = useRef<ProviderPlacementPanelProps['onVerifiedBadgeChange']>(onVerifiedBadgeChange);

    // Refs for SELECT ALL multi-provider lifecycle isolation
    const selectAllEpochRef = useRef<number>(0);
    const launchedSelectAllKeysRef = useRef<Set<string>>(new Set());
    const selectAllTimersRef = useRef<Record<string, {
        timeout: ReturnType<typeof setTimeout> | null;
        interval: ReturnType<typeof setInterval> | null;
    }>>({});

    useEffect(() => {
        onCountChangeRef.current = onCountChange;
    }, [onCountChange]);

    useEffect(() => {
        onVerifiedBadgeChangeRef.current = onVerifiedBadgeChange;
    }, [onVerifiedBadgeChange]);

    const clearIframeWaitTimers = useCallback(() => {
        if (timeoutTimerRef.current !== null) {
            clearTimeout(timeoutTimerRef.current);
            timeoutTimerRef.current = null;
        }
        if (countdownIntervalRef.current !== null) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
    }, []);

    const clearSelectAllTimersForPlacement = useCallback((placementId: string) => {
        const entry = selectAllTimersRef.current[placementId];
        if (!entry) return;
        if (entry.timeout !== null) clearTimeout(entry.timeout);
        if (entry.interval !== null) clearInterval(entry.interval);
        delete selectAllTimersRef.current[placementId];
    }, []);

    const clearAllSelectAllTimers = useCallback(() => {
        Object.keys(selectAllTimersRef.current).forEach((pid) => {
            clearSelectAllTimersForPlacement(pid);
        });
    }, [clearSelectAllTimersForPlacement]);

    const clearSelectAllSessions = useCallback(() => {
        selectAllEpochRef.current += 1;
        launchedSelectAllKeysRef.current.clear();
        clearAllSelectAllTimers();
        setSelectAllSessions({});
    }, [clearAllSelectAllTimers]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            activeSessionIdRef.current = null;
            loadedSessionIdRef.current = null;
            clearIframeWaitTimers();
            clearAllSelectAllTimers();
        };
    }, [clearIframeWaitTimers, clearAllSelectAllTimers]);

    const closeLaunchSession = useCallback(() => {
        clearIframeWaitTimers();
        activeSessionIdRef.current = null;
        loadedSessionIdRef.current = null;
        setActiveLaunchSession(null);
        setIframeLoaded(false);
        setIframeTimedOut(false);
        setSecondsRemaining(IFRAME_WAIT_THRESHOLD_SECONDS);
    }, [clearIframeWaitTimers]);

    useEffect(() => {
        clearIframeWaitTimers();
        if (!activeLaunchSession) {
            activeSessionIdRef.current = null;
            loadedSessionIdRef.current = null;
            setIframeLoaded(false);
            setIframeTimedOut(false);
            setSecondsRemaining(IFRAME_WAIT_THRESHOLD_SECONDS);
            return;
        }

        const currentSessionId = activeLaunchSession.sessionId;
        activeSessionIdRef.current = currentSessionId;

        if (loadedSessionIdRef.current === currentSessionId) {
            setIframeLoaded(true);
            setIframeTimedOut(false);
            return;
        }

        setIframeLoaded(false);
        setIframeTimedOut(false);
        setSecondsRemaining(IFRAME_WAIT_THRESHOLD_SECONDS);

        const startedAt = Date.now();

        countdownIntervalRef.current = setInterval(() => {
            if (
                !isMountedRef.current ||
                activeSessionIdRef.current !== currentSessionId ||
                loadedSessionIdRef.current === currentSessionId
            ) {
                clearIframeWaitTimers();
                return;
            }
            const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
            const nextRemaining = Math.max(1, IFRAME_WAIT_THRESHOLD_SECONDS - elapsedSec);
            setSecondsRemaining(prev => (prev === nextRemaining ? prev : nextRemaining));
        }, 250);

        timeoutTimerRef.current = setTimeout(() => {
            if (
                !isMountedRef.current ||
                activeSessionIdRef.current !== currentSessionId ||
                loadedSessionIdRef.current === currentSessionId
            ) {
                clearIframeWaitTimers();
                return;
            }
            clearIframeWaitTimers();
            setIframeTimedOut(true);
        }, IFRAME_WAIT_THRESHOLD_SECONDS * 1000);

        return () => {
            clearIframeWaitTimers();
        };
    }, [activeLaunchSession?.sessionId, activeLaunchSession?.launchUrl, clearIframeWaitTimers]);

    const handleIframeLoad = useCallback((sessionId: number) => {
        if (!isMountedRef.current || activeSessionIdRef.current !== sessionId) {
            return;
        }
        loadedSessionIdRef.current = sessionId;
        clearIframeWaitTimers();
        setIframeLoaded(true);
        setIframeTimedOut(false);
    }, [clearIframeWaitTimers]);

    const loadPlacements = useCallback(async (options?: { isBackgroundRefresh?: boolean }) => {
        syncPlacementCacheUser(activeUserId);

        if (!activeTabId || !activeUserId) {
            activeTargetKeyRef.current = '';
            setPlacements([]);
            setIsLoading(false);
            setFetchError(null);
            onCountChangeRef.current?.(0);
            return;
        }

        const targetKey = getPlacementCacheKey(activeUserId, activeTabId);
        activeTargetKeyRef.current = targetKey;
        const reqSeq = ++requestSeqRef.current;
        const isBackgroundRefresh = Boolean(options?.isBackgroundRefresh);

        if (!isBackgroundRefresh) {
            setIsLoading(true);
            onCountChangeRef.current?.(0);
            setErrorMessage(null);
            setFetchError(null);
        }

        try {
            const data = await fetchAndCacheAvailablePlacements(activeUserId, activeTabId);
            if (!isMountedRef.current || reqSeq !== requestSeqRef.current || activeTargetKeyRef.current !== targetKey) {
                return;
            }
            setPlacements(data || []);
            setFetchError(null);
        } catch (err: any) {
            if (!isMountedRef.current || reqSeq !== requestSeqRef.current || activeTargetKeyRef.current !== targetKey) {
                return;
            }
            if (isBackgroundRefresh) {
                console.warn('Background placement refresh failed; keeping cached placements:', err?.message || err);
            } else {
                console.error('Failed to load provider placements:', err);
                setFetchError(err.message || 'Unable to load offer placements. Please try again later.');
                onCountChangeRef.current?.(0);
            }
        } finally {
            if (isMountedRef.current && reqSeq === requestSeqRef.current && activeTargetKeyRef.current === targetKey) {
                setIsLoading(false);
            }
        }
    }, [activeTabId, activeUserId]);

    useEffect(() => {
        setSelectedPlacementId(null);
        closeLaunchSession();
        clearSelectAllSessions();
        syncPlacementCacheUser(activeUserId);

        if (!activeTabId || !activeUserId) {
            requestSeqRef.current += 1;
            activeTargetKeyRef.current = '';
            setPlacements([]);
            setIsLoading(false);
            setFetchError(null);
            onCountChangeRef.current?.(0);
            return;
        }

        const cached = getCachedAvailablePlacements(activeUserId, activeTabId);
        if (cached !== null) {
            setPlacements(cached);
            setIsLoading(false);
            setErrorMessage(null);
            setFetchError(null);
            void loadPlacements({ isBackgroundRefresh: true });
        } else {
            setPlacements([]);
            void loadPlacements({ isBackgroundRefresh: false });
        }

        const cachedCounts = getCachedTabOfferCounts(activeUserId, activeTabId);
        setTabOfferCounts(cachedCounts);
    }, [activeTabId, activeUserId, loadPlacements, closeLaunchSession, clearSelectAllSessions]);

    // Subscribe to background offer-count updates and ensure counts load non-blockingly for activeTabId
    useEffect(() => {
        if (!activeTabId || !activeUserId) {
            setTabOfferCounts(null);
            return;
        }

        const syncCountsFromCache = () => {
            setTabOfferCounts(getCachedTabOfferCounts(activeUserId, activeTabId));
        };
        syncCountsFromCache();
        const unsubscribe = subscribeOfferCountUpdates(syncCountsFromCache);

        if (!isLoading && placements.length > 0 && !getCachedTabOfferCounts(activeUserId, activeTabId)) {
            void fetchAndCacheTabOfferCounts(activeUserId, [activeTabId], {
                backgroundSync: true
            });
        }

        return unsubscribe;
    }, [activeTabId, activeUserId, isLoading, placements.length]);

    useEffect(() => {
        setSelectedPlacementId(null);
        setErrorMessage(null);
        closeLaunchSession();
        clearSelectAllSessions();
    }, [activeSubTabId, closeLaunchSession, clearSelectAllSessions]);

    // Ensure mode toggles reset sessions cleanly
    useEffect(() => {
        if (!isNewExperience) {
            setSelectedPlacementId(null);
            closeLaunchSession();
            clearSelectAllSessions();
        }
    }, [isNewExperience, closeLaunchSession, clearSelectAllSessions]);

    // Filter placements based on activeSubTabId and searchQuery, then merge verified live counts
    const filteredPlacements = useMemo(() => {
        const countPlacementsMap = tabOfferCounts?.placements || {};
        return placements
            .filter(p => {
                // SubTab matching:
                if (activeSubTabId && activeSubTabId.trim() !== '') {
                    if (p.subTabId !== activeSubTabId) {
                        return false;
                    }
                } else {
                    // Main / All Categories: only match parent-level placements (empty or null subTabId)
                    if (p.subTabId && p.subTabId.trim() !== '') {
                        return false;
                    }
                }

                // Search query matching:
                if (searchQuery && searchQuery.trim() !== '') {
                    const q = searchQuery.trim().toLowerCase();
                    const matchName = p.displayName?.toLowerCase().includes(q);
                    const matchDesc = p.description?.toLowerCase().includes(q);
                    const matchProv = p.providerKey?.toLowerCase().includes(q);
                    if (!matchName && !matchDesc && !matchProv) {
                        return false;
                    }
                }

                return true;
            })
            .map(p => {
                const countInfo = countPlacementsMap[String(p._id)];
                if (!countInfo) return p;
                return {
                    ...p,
                    offerCountSource: countInfo.offerCountSource,
                    verifiedOfferCount: countInfo.verifiedOfferCount,
                    verifiedOfferIds: countInfo.verifiedOfferIds
                };
            });
    }, [placements, activeSubTabId, searchQuery, tabOfferCounts]);

    const tabOfferCountSummary = useMemo(
        () => computeTabOfferCountSummary(filteredPlacements),
        [filteredPlacements]
    );

    // Notify parent component of the placement count and verified offer badge for current selection
    useEffect(() => {
        if (!isLoading && !fetchError) {
            onCountChange?.(filteredPlacements.length);
            onVerifiedBadgeChangeRef.current?.(tabOfferCountSummary.displayBadge);
        } else {
            onCountChange?.(0);
            onVerifiedBadgeChangeRef.current?.(null);
        }
    }, [filteredPlacements.length, isLoading, fetchError, tabOfferCountSummary.displayBadge]);

    // Keep selected provider aligned with filteredPlacements
    useEffect(() => {
        if (selectedPlacementId && !isLoading && !filteredPlacements.some(p => p._id === selectedPlacementId)) {
            setSelectedPlacementId(null);
            closeLaunchSession();
        }
    }, [selectedPlacementId, filteredPlacements, isLoading, closeLaunchSession]);

    // Helper to launch an individual placement inside SELECT ALL vertical view
    const launchSelectAllPlacement = useCallback(async (placement: ProviderPlacement, epoch: number) => {
        const placementId = placement._id;
        clearSelectAllTimersForPlacement(placementId);

        const nextSessionId = ++sessionCounterRef.current;
        setSelectAllSessions(prev => ({
            ...prev,
            [placementId]: {
                sessionId: nextSessionId,
                status: 'loading',
                displayName: placement.displayName,
                providerKey: placement.providerKey,
                iframeLoaded: false,
                iframeTimedOut: false,
                secondsRemaining: IFRAME_WAIT_THRESHOLD_SECONDS
            }
        }));

        try {
            const res = await launchPlacement(placementId);
            if (!isMountedRef.current || selectAllEpochRef.current !== epoch) {
                return;
            }
            const startedAt = Date.now();
            setSelectAllSessions(prev => ({
                ...prev,
                [placementId]: {
                    sessionId: nextSessionId,
                    status: 'ready',
                    launchUrl: res.launchUrl,
                    providerKey: res.providerKey || placement.providerKey,
                    displayName: res.displayName || placement.displayName,
                    iframeLoaded: false,
                    iframeTimedOut: false,
                    secondsRemaining: IFRAME_WAIT_THRESHOLD_SECONDS
                }
            }));

            const interval = setInterval(() => {
                if (!isMountedRef.current || selectAllEpochRef.current !== epoch) {
                    clearSelectAllTimersForPlacement(placementId);
                    return;
                }
                const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
                const nextRemaining = Math.max(1, IFRAME_WAIT_THRESHOLD_SECONDS - elapsedSec);
                setSelectAllSessions(prev => {
                    const current = prev[placementId];
                    if (!current || current.sessionId !== nextSessionId || current.iframeLoaded || current.iframeTimedOut) {
                        clearSelectAllTimersForPlacement(placementId);
                        return prev;
                    }
                    if (current.secondsRemaining === nextRemaining) return prev;
                    return {
                        ...prev,
                        [placementId]: {
                            ...current,
                            secondsRemaining: nextRemaining
                        }
                    };
                });
            }, 500);

            const timeout = setTimeout(() => {
                if (!isMountedRef.current || selectAllEpochRef.current !== epoch) {
                    clearSelectAllTimersForPlacement(placementId);
                    return;
                }
                clearSelectAllTimersForPlacement(placementId);
                setSelectAllSessions(prev => {
                    const current = prev[placementId];
                    if (!current || current.sessionId !== nextSessionId || current.iframeLoaded) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [placementId]: {
                            ...current,
                            iframeTimedOut: true
                        }
                    };
                });
            }, IFRAME_WAIT_THRESHOLD_SECONDS * 1000);

            selectAllTimersRef.current[placementId] = { timeout, interval };
        } catch (err: any) {
            if (!isMountedRef.current || selectAllEpochRef.current !== epoch) {
                return;
            }
            clearSelectAllTimersForPlacement(placementId);
            setSelectAllSessions(prev => ({
                ...prev,
                [placementId]: {
                    sessionId: nextSessionId,
                    status: 'error',
                    displayName: placement.displayName,
                    providerKey: placement.providerKey,
                    error: err?.message || `Unable to initialize ${placement.displayName}.`,
                    iframeLoaded: false,
                    iframeTimedOut: false,
                    secondsRemaining: 0
                }
            }));
        }
    }, [clearSelectAllTimersForPlacement]);

    const handleSelectAllIframeLoad = useCallback((placementId: string, sessionId: number) => {
        if (!isMountedRef.current) return;
        clearSelectAllTimersForPlacement(placementId);
        setSelectAllSessions(prev => {
            const current = prev[placementId];
            if (!current || current.sessionId !== sessionId) return prev;
            return {
                ...prev,
                [placementId]: {
                    ...current,
                    iframeLoaded: true,
                    iframeTimedOut: false
                }
            };
        });
    }, [clearSelectAllTimersForPlacement]);

    // Auto-launch eligible providers once when in New experience + SELECT ALL mode
    useEffect(() => {
        if (!isNewExperience || selectedPlacementId !== null || isLoading || fetchError) {
            return;
        }
        if (filteredPlacements.length === 0) {
            return;
        }
        const currentEpoch = selectAllEpochRef.current;
        const scopePrefix = `${activeUserId || ''}::${activeTabId}::${activeSubTabId || ''}`;

        filteredPlacements.forEach((p) => {
            const dedupeKey = `${scopePrefix}::${p._id}`;
            if (!launchedSelectAllKeysRef.current.has(dedupeKey)) {
                launchedSelectAllKeysRef.current.add(dedupeKey);
                void launchSelectAllPlacement(p, currentEpoch);
            }
        });
    }, [
        isNewExperience,
        selectedPlacementId,
        isLoading,
        fetchError,
        filteredPlacements,
        activeUserId,
        activeTabId,
        activeSubTabId,
        launchSelectAllPlacement
    ]);

    const handleLaunchPlacement = async (
        placement: ProviderPlacement,
        options?: { forceInline?: boolean }
    ) => {
        const launchTargetKey = activeTargetKeyRef.current;
        clearSelectAllSessions();
        closeLaunchSession();
        setSelectedPlacementId(placement._id);
        setLaunchingPlacementId(placement._id);
        setErrorMessage(null);

        try {
            const res = await launchPlacement(placement._id);
            if (!isMountedRef.current || activeTargetKeyRef.current !== launchTargetKey) {
                return;
            }
            clearIframeWaitTimers();
            const nextSessionId = ++sessionCounterRef.current;
            activeSessionIdRef.current = nextSessionId;
            loadedSessionIdRef.current = null;
            setIframeLoaded(false);
            setIframeTimedOut(false);
            setSecondsRemaining(IFRAME_WAIT_THRESHOLD_SECONDS);
            setActiveLaunchSession({
                sessionId: nextSessionId,
                placementId: placement._id,
                displayName: res.displayName || placement.displayName,
                launchUrl: res.launchUrl,
                providerKey: res.providerKey || placement.providerKey,
                launchDisplayMode: options?.forceInline ? 'inline' : (res.launchDisplayMode || 'modal')
            });
        } catch (err: any) {
            if (!isMountedRef.current) return;
            setErrorMessage(err.message || 'Failed to initialize offerwall session. Please try again later.');
        } finally {
            if (isMountedRef.current) {
                setLaunchingPlacementId(null);
            }
        }
    };

    const handleReturnToSelectAll = useCallback(() => {
        setSelectedPlacementId(null);
        setErrorMessage(null);
        closeLaunchSession();
        clearSelectAllSessions();
    }, [closeLaunchSession, clearSelectAllSessions]);

    const elapsedWaitSeconds = Math.min(
        IFRAME_WAIT_THRESHOLD_SECONDS,
        Math.max(0, IFRAME_WAIT_THRESHOLD_SECONDS - secondsRemaining)
    );
    const elapsedWaitPercent = Math.round((elapsedWaitSeconds / IFRAME_WAIT_THRESHOLD_SECONDS) * 100);

    const renderWaitingIndicator = (session: NonNullable<typeof activeLaunchSession>) => {
        if (iframeLoaded) return null;

        if (!iframeTimedOut) {
            return (
                <div className="absolute inset-x-3 top-3 z-10 pointer-events-none flex justify-center animate-fade-in">
                    <div className="pointer-events-none w-full max-w-md bg-slate-900/90 backdrop-blur-sm border border-amber-500/30 rounded-2xl px-3.5 py-2.5 shadow-xl space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <RefreshIcon className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                                <span className="text-xs text-slate-200 font-semibold truncate">
                                    Connecting to {session.displayName}...
                                </span>
                            </div>
                            <span
                                className="text-[11px] font-mono text-amber-300 font-bold shrink-0"
                                data-testid="iframe-wait-countdown"
                            >
                                {secondsRemaining}s
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-400 transition-all duration-300 ease-linear"
                                style={{ width: `${elapsedWaitPercent}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span>Wait timer</span>
                            <span>
                                Elapsed wait time ({elapsedWaitSeconds}s of {IFRAME_WAIT_THRESHOLD_SECONDS}s)
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        const slowMessage =
            session.providerKey === 'theoremreach'
                ? 'TheoremReach is taking longer than expected. Please continue waiting while we load your offers.'
                : `${session.displayName} is taking longer than expected. Please continue waiting while we load your offers.`;

        return (
            <div className="absolute inset-x-3 top-3 z-10 pointer-events-none flex justify-center animate-fade-in">
                <div className="pointer-events-auto w-full max-w-xl bg-slate-900/95 border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl shrink-0 mt-0.5">
                            <RefreshIcon className="w-4 h-4 animate-spin" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-slate-100 leading-snug">
                                {slowMessage}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={closeLaunchSession}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-xl transition-all"
                        >
                            Return to Placements
                        </button>
                        <a
                            href={session.launchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase rounded-xl transition-all flex items-center gap-1"
                        >
                            <span>Open in New Tab</span>
                            <LaunchIcon className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className={`p-8 text-center bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 ${className}`}>
                <RefreshIcon className="w-6 h-6 animate-spin mx-auto text-amber-400" />
                <p className="text-xs font-bold text-slate-400">Loading verified offer placements...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className={`p-4 bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-2xl flex items-center justify-between text-xs font-bold ${className}`}>
                <div className="flex items-center gap-2">
                    <AlertIcon className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>Unable to load offer placements: {fetchError}</span>
                </div>
                <button onClick={() => void loadPlacements()} className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all shrink-0">
                    Retry
                </button>
            </div>
        );
    }

    const totalCount = nativeGigs.length + filteredPlacements.length;
    const selectAllSummary = computeSelectAllSummary(filteredPlacements, nativeGigs.length);
    const selectedPlacement = selectedPlacementId
        ? filteredPlacements.find(p => p._id === selectedPlacementId) || null
        : null;

    const providerNavItems: ProviderNavItem[] = filteredPlacements.map(p => {
        const verifiedCount = getVerifiedProviderOfferCount(p);
        return {
            id: p._id,
            label: p.displayName,
            icon: p.icon,
            verifiedOfferCount: verifiedCount.count,
            isSelected: selectedPlacementId === p._id,
            isLaunching: launchingPlacementId === p._id,
            onSelect: () => {
                void handleLaunchPlacement(p, { forceInline: true });
            }
        };
    });

    const renderNativeGigsGrid = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {nativeGigs.map(gig => (
                <div
                    key={gig.id}
                    className="bg-slate-950/80 rounded-2xl p-5 shadow-lg border border-slate-800/80 flex flex-col justify-between hover:border-amber-500/50 transition-all group space-y-4"
                >
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2.5 py-1 rounded-xl uppercase tracking-wider">
                                {gig.provider}
                            </span>
                            <span className="text-emerald-400 font-bold text-sm sm:text-base text-right font-mono">
                                +{formatCurrency(gig.rewardUSD * exchangeRate, userCurrency)}
                                {userCurrency !== 'USD' && (
                                    <span className="text-[10px] text-slate-400 font-semibold block font-mono">(${gig.rewardUSD.toFixed(2)} USD)</span>
                                )}
                            </span>
                        </div>

                        <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-amber-300 transition-colors">
                            {gig.title}
                        </h4>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {gig.description}
                        </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span className="font-semibold flex items-center gap-1 text-slate-400">
                                <ClockIcon className="w-3.5 h-3.5 text-slate-500" /> {gig.estimatedTime}
                            </span>
                            <span className="text-amber-400 font-bold text-[11px] font-mono">{gig.difficulty}</span>
                        </div>

                        <button
                            onClick={() => onSelectGig?.(gig)}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-2 min-h-[40px]"
                        >
                            <span>Start Offer & Do Task</span>
                            <LaunchIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderSelectAllVerticalProviders = () => (
        <div className="space-y-4 sm:space-y-6 pt-0.5 sm:pt-1" data-testid="other-tasks-select-all-vertical">
            {nativeGigs.length > 0 && renderNativeGigsGrid()}

            {filteredPlacements.map((p) => {
                const session = selectAllSessions[p._id];
                const verifiedCount = getVerifiedProviderOfferCount(p);
                const isOfferwallRestrictedError =
                    session?.status === 'error' &&
                    /offerwall|restricted|403|forbidden/i.test(session.error || '');

                return (
                    <section
                        key={p._id}
                        data-testid={`select-all-provider-section-${p.providerKey || p._id}`}
                        className="bg-slate-950/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
                    >
                        <div className="p-4 sm:px-5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <PlacementIconGraphic icon={p.icon} label={p.displayName} />
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-sm sm:text-base font-black text-white truncate">
                                            {p.displayName}
                                        </h4>
                                        {p.badge && (
                                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                {p.badge}
                                            </span>
                                        )}
                                        {verifiedCount.isVerifiedNumeric && verifiedCount.count !== null && (
                                            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                {verifiedCount.count} Offers
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate">
                                        {p.description || 'Complete partner tasks and surveys for automatic Task Wallet credit.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => void handleLaunchPlacement(p, { forceInline: true })}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-xl transition-all"
                                >
                                    Single View
                                </button>
                                {session?.status === 'ready' && session.launchUrl && (
                                    <a
                                        href={session.launchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase rounded-xl transition-all flex items-center gap-1.5"
                                    >
                                        <span>Fullscreen</span>
                                        <LaunchIcon className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="relative w-full h-[560px] sm:h-[640px] bg-slate-950 flex flex-col">
                            {(!session || session.status === 'loading') && (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 text-slate-400">
                                    <RefreshIcon className="w-7 h-7 animate-spin text-amber-400" />
                                    <p className="text-xs font-bold text-slate-300">
                                        Initializing {p.displayName} session...
                                    </p>
                                </div>
                            )}

                            {session?.status === 'error' && (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                        <AlertIcon className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <h5 className="text-sm font-black text-white">
                                            {p.displayName} Unavailable in Inline Feed
                                        </h5>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {session.error}
                                        </p>
                                    </div>
                                    {isOfferwallRestrictedError ? (
                                        <a
                                            href="#/member/offerwall"
                                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl transition-all inline-flex items-center gap-1.5"
                                        >
                                            <span>Open Main Offerwall</span>
                                            <LaunchIcon className="w-3.5 h-3.5" />
                                        </a>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => void launchSelectAllPlacement(p, selectAllEpochRef.current)}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
                                        >
                                            Retry {p.displayName}
                                        </button>
                                    )}
                                </div>
                            )}

                            {session?.status === 'ready' && session.launchUrl && (
                                <>
                                    {!session.iframeLoaded && (
                                        <div className="absolute inset-x-3 top-3 z-10 pointer-events-none flex justify-center animate-fade-in">
                                            <div className="pointer-events-auto w-full max-w-md bg-slate-900/95 border border-amber-500/30 rounded-2xl px-3.5 py-2.5 shadow-xl flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <RefreshIcon className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                                                    <span className="text-xs text-slate-200 font-semibold truncate">
                                                        {session.iframeTimedOut
                                                            ? `${p.displayName} is still loading...`
                                                            : `Connecting to ${p.displayName}...`}
                                                    </span>
                                                </div>
                                                {session.iframeTimedOut ? (
                                                    <a
                                                        href={session.launchUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded-lg shrink-0"
                                                    >
                                                        Open in New Tab
                                                    </a>
                                                ) : (
                                                    <span className="text-[11px] font-mono text-amber-300 font-bold shrink-0">
                                                        {session.secondsRemaining}s
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <iframe
                                        key={session.sessionId}
                                        src={session.launchUrl}
                                        title={p.displayName}
                                        className="w-full h-full border-0"
                                        allow="fullscreen; camera; microphone"
                                        onLoad={() => handleSelectAllIframeLoad(p._id, session.sessionId)}
                                    />
                                </>
                            )}
                        </div>
                    </section>
                );
            })}
        </div>
    );

    return (
        <div className={`space-y-3 sm:space-y-5 ${className}`} data-page-experience={otherTasksExperience}>
            {isNewExperience && filteredPlacements.length > 0 && (
                <ProviderNavRow
                    variant={otherTasksNavStyle === 'icons' ? 'icons' : otherTasksNavStyle === 'cards' ? 'cards' : 'tabs'}
                    ariaLabel="Offerwall partner navigation"
                    selectAllTab={{
                        id: 'all',
                        label: 'SELECT ALL',
                        countBadge:
                            tabOfferCountSummary.displayBadge ??
                            (selectAllSummary.hasDeduplicatedTotal &&
                            selectAllSummary.combinedVerifiedOfferCount !== null
                                ? String(selectAllSummary.combinedVerifiedOfferCount)
                                : null),
                        isSelected: selectedPlacementId === null,
                        onSelect: handleReturnToSelectAll
                    }}
                    items={providerNavItems}
                />
            )}

            {/* Error Notification */}
            {errorMessage && (
                <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold shadow-lg animate-fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertIcon className="w-5 h-5 text-rose-400 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {selectedPlacement && (
                            <button
                                type="button"
                                onClick={() => void handleLaunchPlacement(selectedPlacement, isNewExperience ? { forceInline: true } : undefined)}
                                className="px-3 py-1 bg-rose-500/30 hover:bg-rose-500/40 text-white rounded-xl text-xs font-bold transition-colors"
                            >
                                Retry
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setErrorMessage(null)}
                            className="p-1 hover:opacity-80"
                            aria-label="Dismiss error"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {selectedPlacementId !== null ? (
                launchingPlacementId === selectedPlacementId ? (
                    <div className="p-10 text-center bg-slate-950/80 border border-slate-800 rounded-3xl space-y-3">
                        <RefreshIcon className="w-7 h-7 animate-spin mx-auto text-amber-400" />
                        <p className="text-xs font-bold text-slate-300">
                            Initializing {selectedPlacement?.displayName || 'provider'} session...
                        </p>
                    </div>
                ) : activeLaunchSession && activeLaunchSession.launchDisplayMode === 'inline' ? (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleReturnToSelectAll}
                                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                    title="Back to All Providers"
                                >
                                    <CloseIcon className="w-4 h-4" />
                                    <span>All Providers</span>
                                </button>
                                <div>
                                    <h3 className="text-sm font-black text-white">{activeLaunchSession.displayName}</h3>
                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                        <SparklesIcon className="w-3 h-3" />
                                        <span>Authenticated Server Session Active</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={activeLaunchSession.launchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2"
                                >
                                    <span>Fullscreen</span>
                                    <LaunchIcon className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        </div>

                        <div className="relative w-full h-[650px] sm:h-[700px] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            {renderWaitingIndicator(activeLaunchSession)}

                            <iframe
                                key={activeLaunchSession.sessionId}
                                src={activeLaunchSession.launchUrl}
                                title={activeLaunchSession.displayName}
                                className="w-full h-full border-0"
                                allow="fullscreen; camera; microphone"
                                onLoad={() => handleIframeLoad(activeLaunchSession.sessionId)}
                            />
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-3 text-[11px] text-slate-400 text-center">
                            Completed tasks from {activeLaunchSession.displayName} credit automatically to your Task Earnings balance.
                        </div>
                    </div>
                ) : selectedPlacement && !activeLaunchSession ? (
                    <div className="p-8 text-center bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                        <p className="text-xs font-bold text-slate-300">
                            {selectedPlacement.displayName} session is ready.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => void handleLaunchPlacement(selectedPlacement, isNewExperience ? { forceInline: true } : undefined)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider"
                            >
                                Launch {selectedPlacement.displayName}
                            </button>
                            <button
                                type="button"
                                onClick={handleReturnToSelectAll}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs"
                            >
                                {isNewExperience ? 'Back to SELECT ALL' : 'Back to Placements'}
                            </button>
                        </div>
                    </div>
                ) : null
            ) : totalCount > 0 ? (
                isNewExperience ? (
                    renderSelectAllVerticalProviders()
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1" data-testid="other-tasks-legacy-grid">
                        {/* Render Native Gigs */}
                        {nativeGigs.map(gig => (
                            <div
                                key={gig.id}
                                className="bg-slate-950/80 rounded-2xl p-5 shadow-lg border border-slate-800/80 flex flex-col justify-between hover:border-amber-500/50 transition-all group space-y-4"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2.5 py-1 rounded-xl uppercase tracking-wider">
                                            {gig.provider}
                                        </span>
                                        <span className="text-emerald-400 font-bold text-sm sm:text-base text-right font-mono">
                                            +{formatCurrency(gig.rewardUSD * exchangeRate, userCurrency)}
                                            {userCurrency !== 'USD' && (
                                                <span className="text-[10px] text-slate-400 font-semibold block font-mono">(${gig.rewardUSD.toFixed(2)} USD)</span>
                                            )}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-amber-300 transition-colors">
                                        {gig.title}
                                    </h4>

                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                        {gig.description}
                                    </p>
                                </div>

                                <div className="pt-3 border-t border-slate-800/80 space-y-3">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold flex items-center gap-1 text-slate-400">
                                            <ClockIcon className="w-3.5 h-3.5 text-slate-500" /> {gig.estimatedTime}
                                        </span>
                                        <span className="text-amber-400 font-bold text-[11px] font-mono">{gig.difficulty}</span>
                                    </div>

                                    <button
                                        onClick={() => onSelectGig?.(gig)}
                                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-2 min-h-[40px]"
                                    >
                                        <span>Start Offer & Do Task</span>
                                        <LaunchIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Render Legacy Provider Placements Grid */}
                        {filteredPlacements.map(p => (
                            <PlacementCard
                                key={p._id}
                                placement={p}
                                onLaunch={() => void handleLaunchPlacement(p)}
                                isLaunching={launchingPlacementId === p._id}
                            />
                        ))}
                    </div>
                )
            ) : (
                <div className="col-span-full py-12 text-center bg-slate-950/80 rounded-2xl border border-dashed border-slate-800 space-y-3">
                    <InfoIcon className="w-10 h-10 mx-auto text-slate-500" />
                    <h4 className="font-bold text-slate-300 text-sm">No active offers for this category yet</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        New partner tasks are synchronized daily. Please check back soon or try another network sub-tab above.
                    </p>
                </div>
            )}

            {/* MODAL DISPLAY MODE RENDER */}
            {activeLaunchSession && activeLaunchSession.launchDisplayMode === 'modal' && (
                <Modal
                    isOpen={true}
                    onClose={handleReturnToSelectAll}
                    title={`🚀 ${activeLaunchSession.displayName}`}
                >
                    <div className="space-y-4 p-1">
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                <SparklesIcon className="w-4 h-4" />
                                <span>Authenticated Server Session Active</span>
                            </div>
                            <a
                                href={activeLaunchSession.launchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-400 hover:underline font-bold flex items-center gap-1"
                            >
                                <span>Open Fullscreen</span>
                                <LaunchIcon className="w-3.5 h-3.5" />
                            </a>
                        </div>

                        {/* Iframe View */}
                        <div className="relative w-full h-[600px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                            {renderWaitingIndicator(activeLaunchSession)}

                            <iframe
                                key={activeLaunchSession.sessionId}
                                src={activeLaunchSession.launchUrl}
                                title={activeLaunchSession.displayName}
                                className="w-full h-full border-0"
                                allow="fullscreen; camera; microphone"
                                onLoad={() => handleIframeLoad(activeLaunchSession.sessionId)}
                            />
                        </div>

                        <div className="text-[11px] text-slate-400 text-center">
                            💡 Completed tasks and surveys from {activeLaunchSession.displayName} credit automatically to your Task Earnings balance upon server verification.
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

interface PlacementCardProps {
    placement: ProviderPlacement;
    onLaunch: () => void;
    isLaunching: boolean;
}

const PlacementCard: React.FC<PlacementCardProps> = ({ placement: p, onLaunch, isLaunching }) => (
    <div
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-amber-500/50 transition-all group space-y-4"
    >
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <PlacementIconGraphic icon={p.icon} label={p.displayName} />
                    <div>
                        <h4 className="font-extrabold text-white text-sm line-clamp-1 group-hover:text-amber-300 transition-colors">
                            {p.displayName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">{p.subTabName || p.subTabId || 'Direct Access'}</span>
                    </div>
                </div>

                {p.badge && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                        {p.badge}
                    </span>
                )}
            </div>

            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {p.description || 'Verified offerwall activity. Complete tasks and surveys for automatic wallet credit.'}
            </p>
        </div>

        <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <button
                onClick={onLaunch}
                disabled={isLaunching}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 min-h-[40px]"
            >
                {isLaunching ? (
                    <>
                        <RefreshIcon className="w-4 h-4 animate-spin" />
                        <span>Initializing...</span>
                    </>
                ) : (
                    <>
                        <span>Launch {p.displayName}</span>
                        <LaunchIcon className="w-4 h-4" />
                    </>
                )}
            </button>
        </div>
    </div>
);

export default ProviderPlacementPanel;
