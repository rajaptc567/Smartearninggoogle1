import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from 'react';
import {
    ProviderPlacement,
    getPlacementCacheKey,
    getCachedAvailablePlacements,
    fetchAndCacheAvailablePlacements,
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

const IFRAME_WAIT_THRESHOLD_SECONDS = 20;

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
    className = ''
}) => {
    const dataContext = useContext(DataContext);
    const activeUserId = userIdProp !== undefined ? userIdProp : (dataContext?.state?.currentUser?._id ?? null);

    const [placements, setPlacements] = useState<ProviderPlacement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [launchingPlacementId, setLaunchingPlacementId] = useState<string | null>(null);

    // Active Provider Launch Session
    const [activeLaunchSession, setActiveLaunchSession] = useState<{
        sessionId: number;
        displayName: string;
        launchUrl: string;
        providerKey: string;
        launchDisplayMode: 'inline' | 'modal';
    } | null>(null);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Iframe embed loading & 20s countdown timeout state
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

    useEffect(() => {
        onCountChangeRef.current = onCountChange;
    }, [onCountChange]);

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

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            activeSessionIdRef.current = null;
            loadedSessionIdRef.current = null;
            clearIframeWaitTimers();
        };
    }, [clearIframeWaitTimers]);

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
        closeLaunchSession();
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
    }, [activeTabId, activeUserId, loadPlacements, closeLaunchSession]);

    // Filter placements based on activeSubTabId and searchQuery
    const filteredPlacements = useMemo(() => {
        return placements.filter(p => {
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
        });
    }, [placements, activeSubTabId, searchQuery]);

    // Notify parent component of the placement count for current selection
    useEffect(() => {
        if (!isLoading && !fetchError) {
            onCountChange?.(filteredPlacements.length);
        } else {
            onCountChange?.(0);
        }
    }, [filteredPlacements.length, isLoading, fetchError]);

    const handleLaunchPlacement = async (placement: ProviderPlacement) => {
        if (launchingPlacementId) return;
        const launchTargetKey = activeTargetKeyRef.current;
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
                displayName: res.displayName || placement.displayName,
                launchUrl: res.launchUrl,
                providerKey: res.providerKey || placement.providerKey,
                launchDisplayMode: res.launchDisplayMode || 'modal'
            });
        } catch (err: any) {
            if (!isMountedRef.current) return;
            setErrorMessage(err.message || 'Failed to initialize offerwall session. Please try again later.');
            setTimeout(() => {
                if (isMountedRef.current) {
                    setErrorMessage(null);
                }
            }, 6000);
        } finally {
            if (isMountedRef.current) {
                setLaunchingPlacementId(null);
            }
        }
    };

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

    // INLINE DISPLAY MODE RENDER
    if (activeLaunchSession && activeLaunchSession.launchDisplayMode === 'inline') {
        return (
            <div className={`space-y-4 animate-fade-in ${className}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={closeLaunchSession}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all"
                            title="Go Back"
                        >
                            <CloseIcon className="w-5 h-5" />
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

                <div className="relative w-full h-[700px] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
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
                    💡 Completed tasks from {activeLaunchSession.displayName} credit automatically to your Task Earnings balance.
                </div>
            </div>
        );
    }

    const totalCount = nativeGigs.length + filteredPlacements.length;

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Error Notification */}
            {errorMessage && (
                <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-lg animate-fade-in">
                    <div className="flex items-center gap-2">
                        <AlertIcon className="w-5 h-5 text-rose-400 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                    <button onClick={() => setErrorMessage(null)} className="p-1 hover:opacity-80">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {totalCount > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
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

                    {/* Render Provider Placements */}
                    {filteredPlacements.map(p => (
                        <PlacementCard
                            key={p._id}
                            placement={p}
                            onLaunch={() => handleLaunchPlacement(p)}
                            isLaunching={launchingPlacementId === p._id}
                        />
                    ))}
                </div>
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
                    onClose={closeLaunchSession}
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
                    <span className="text-2xl">{p.icon || '⚡'}</span>
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
