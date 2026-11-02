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
    RefreshCw as RefreshIcon
} from 'lucide-react';

export interface ProviderPlacementPanelProps {
    activeTabId: string;
    activeSubTabId?: string; // Add this
    className?: string;
}

export const ProviderPlacementPanel: React.FC<ProviderPlacementPanelProps> = ({
    activeTabId,
    activeSubTabId, // Add this
    className = ''
}) => {
    const [placements, setPlacements] = useState<ProviderPlacement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeSubTab, setActiveSubTab] = useState<string>(activeSubTabId || ''); // Use prop
    const [launchingPlacementId, setLaunchingPlacementId] = useState<string | null>(null);

    // Sync activeSubTab when prop changes
    useEffect(() => {
        if (activeSubTabId !== undefined) {
            setActiveSubTab(activeSubTabId);
        }
    }, [activeSubTabId]);

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
            setPlacements(data);
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

    // Unique sub-tabs present among returned placements (excluding parent-level)
    const subTabs = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of placements) {
            if (p.subTabId && !map.has(p.subTabId)) {
                map.set(p.subTabId, p.subTabName || p.subTabId);
            }
        }
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [placements]);

    useEffect(() => {
        // If sub-tabs exist and none selected, select first one.
        // Parent-level placements are always shown if activeSubTab is empty OR if explicitly allowed.
        if (subTabs.length > 0 && activeSubTab && !subTabs.some(s => s.id === activeSubTab)) {
            setActiveSubTab('');
        }
    }, [subTabs, activeSubTab]);

    const parentLevelPlacements = useMemo(() => {
        return placements.filter(p => !p.subTabId);
    }, [placements]);

    const subTabPlacements = useMemo(() => {
        if (!activeSubTab) return placements.filter(p => p.subTabId);
        return placements.filter(p => p.subTabId === activeSubTab);
    }, [placements, activeSubTab]);

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
            <div className={`p-6 text-center bg-slate-900/80 border border-slate-800 rounded-3xl space-y-2 ${className}`}>
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

    if (placements.length === 0) {
        return null; // Silent when no active placements configured for this tab
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

            {/* Parent-Level Placements Section (Always shown) */}
            {parentLevelPlacements.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-px flex-1 bg-slate-800/50"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Premium Offer Networks</span>
                        <div className="h-px flex-1 bg-slate-800/50"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parentLevelPlacements.map(p => (
                            <PlacementCard 
                                key={p._id} 
                                placement={p} 
                                onLaunch={() => handleLaunchPlacement(p)} 
                                isLaunching={launchingPlacementId === p._id} 
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Sub-Tab Filter Pills */}
            {subTabs.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
                        <button
                            onClick={() => setActiveSubTab('')}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shrink-0 border ${
                                !activeSubTab
                                    ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            All Categories
                        </button>
                        {subTabs.map(st => (
                            <button
                                key={st.id}
                                onClick={() => setActiveSubTab(st.id)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shrink-0 border ${
                                    activeSubTab === st.id
                                        ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                            >
                                {st.name}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subTabPlacements.map(p => (
                            <PlacementCard 
                                key={p._id} 
                                placement={p} 
                                onLaunch={() => handleLaunchPlacement(p)} 
                                isLaunching={launchingPlacementId === p._id} 
                            />
                        ))}
                    </div>
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
