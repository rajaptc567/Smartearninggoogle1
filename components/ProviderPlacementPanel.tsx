import React, { useState, useEffect, useMemo } from 'react';
import {
    ProviderPlacement,
    fetchAvailablePlacements,
    launchPlacement
} from '../services/providerPlacementService';
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

export interface ProviderPlacementPanelProps {
    activeTabId: string;
    activeSubTabId?: string;
    searchQuery?: string;
    nativeGigs?: JobGig[];
    onSelectGig?: (gig: JobGig) => void;
    exchangeRate?: number;
    userCurrency?: string;
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
    onCountChange,
    className = ''
}) => {
    const [placements, setPlacements] = useState<ProviderPlacement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [launchingPlacementId, setLaunchingPlacementId] = useState<string | null>(null);

    // Active Provider Launch Session
    const [activeLaunchSession, setActiveLaunchSession] = useState<{
        displayName: string;
        launchUrl: string;
        providerKey: string;
        launchDisplayMode: 'inline' | 'modal';
    } | null>(null);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Iframe embed loading & timeout state
    const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
    const [iframeTimedOut, setIframeTimedOut] = useState<boolean>(false);

    useEffect(() => {
        if (!activeLaunchSession) {
            setIframeLoaded(false);
            setIframeTimedOut(false);
            return;
        }
        setIframeLoaded(false);
        setIframeTimedOut(false);
        const timer = setTimeout(() => {
            setIframeTimedOut(true);
        }, 10000);
        return () => clearTimeout(timer);
    }, [activeLaunchSession?.launchUrl]);

    const loadPlacements = async () => {
        if (!activeTabId) return;
        setIsLoading(true);
        setErrorMessage(null);
        setFetchError(null);
        try {
            const data = await fetchAvailablePlacements(activeTabId);
            setPlacements(data || []);
        } catch (err: any) {
            console.error('Failed to load provider placements:', err);
            setFetchError(err.message || 'Unable to load offer placements. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPlacements();
    }, [activeTabId]);

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
        }
    }, [filteredPlacements.length, isLoading, fetchError, onCountChange]);

    const handleLaunchPlacement = async (placement: ProviderPlacement) => {
        if (launchingPlacementId) return;
        setLaunchingPlacementId(placement._id);
        setErrorMessage(null);

        try {
            const res = await launchPlacement(placement._id);
            setActiveLaunchSession({
                displayName: res.displayName || placement.displayName,
                launchUrl: res.launchUrl,
                providerKey: res.providerKey || placement.providerKey,
                launchDisplayMode: res.launchDisplayMode || 'modal'
            });
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to initialize offerwall session. Please try again later.');
            setTimeout(() => setErrorMessage(null), 6000);
        } finally {
            setLaunchingPlacementId(null);
        }
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
                <button onClick={loadPlacements} className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all shrink-0">
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
                            onClick={() => setActiveLaunchSession(null)}
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
                    {!iframeLoaded && !iframeTimedOut && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 pointer-events-none z-0">
                            <RefreshIcon className="w-6 h-6 animate-spin text-amber-400" />
                            <span className="text-xs text-slate-400 mt-2 font-medium">Connecting to provider...</span>
                        </div>
                    )}

                    {iframeTimedOut && !iframeLoaded && (
                        <div className="absolute inset-0 z-10 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in">
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl">
                                <AlertIcon className="w-8 h-8" />
                            </div>
                            <div className="max-w-md space-y-2">
                                <h4 className="text-sm font-black text-white">Embed Loading Notice</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    The offerwall session did not finish loading within the expected time. Some external providers may restrict embedded display in frames.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={() => setActiveLaunchSession(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
                                >
                                    Return to Placements
                                </button>
                                <a
                                    href={activeLaunchSession.launchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl transition-all flex items-center gap-1.5"
                                >
                                    <span>Open in New Tab</span>
                                    <LaunchIcon className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        </div>
                    )}

                    <iframe
                        src={activeLaunchSession.launchUrl}
                        title={activeLaunchSession.displayName}
                        className="w-full h-full border-0"
                        allow="fullscreen; camera; microphone"
                        onLoad={() => setIframeLoaded(true)}
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
                    onClose={() => setActiveLaunchSession(null)}
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
                            {!iframeLoaded && !iframeTimedOut && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 pointer-events-none z-0">
                                    <RefreshIcon className="w-6 h-6 animate-spin text-amber-400" />
                                    <span className="text-xs text-slate-400 mt-2 font-medium">Connecting to provider...</span>
                                </div>
                            )}

                            {iframeTimedOut && !iframeLoaded && (
                                <div className="absolute inset-0 z-10 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in">
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl">
                                        <AlertIcon className="w-8 h-8" />
                                    </div>
                                    <div className="max-w-md space-y-2">
                                        <h4 className="text-sm font-black text-white">Embed Loading Notice</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            The offerwall session did not finish loading within the expected time. Some external providers may restrict embedded display in frames.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                        <button
                                            onClick={() => setActiveLaunchSession(null)}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
                                        >
                                            Return to Placements
                                        </button>
                                        <a
                                            href={activeLaunchSession.launchUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl transition-all flex items-center gap-1.5"
                                        >
                                            <span>Open in New Tab</span>
                                            <LaunchIcon className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </div>
                            )}

                            <iframe
                                src={activeLaunchSession.launchUrl}
                                title={activeLaunchSession.displayName}
                                className="w-full h-full border-0"
                                allow="fullscreen; camera; microphone"
                                onLoad={() => setIframeLoaded(true)}
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
