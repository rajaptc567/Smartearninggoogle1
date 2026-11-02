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
    className?: string;
}

export const ProviderPlacementPanel: React.FC<ProviderPlacementPanelProps> = ({
    activeTabId,
    className = ''
}) => {
    const [placements, setPlacements] = useState<ProviderPlacement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeSubTab, setActiveSubTab] = useState<string>('');
    const [launchingPlacementId, setLaunchingPlacementId] = useState<string | null>(null);

    // Active Provider Launch Modal
    const [activeLaunchSession, setActiveLaunchSession] = useState<{
        displayName: string;
        launchUrl: string;
        providerKey: string;
    } | null>(null);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadPlacements = async () => {
        if (!activeTabId) return;
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const data = await fetchAvailablePlacements(activeTabId);
            setPlacements(data);
        } catch (err: any) {
            console.error('Failed to load provider placements:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPlacements();
    }, [activeTabId]);

    // Unique sub-tabs present among returned placements
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
        if (subTabs.length > 0) {
            if (!activeSubTab || !subTabs.some(s => s.id === activeSubTab)) {
                setActiveSubTab(subTabs[0].id);
            }
        } else {
            setActiveSubTab('');
        }
    }, [subTabs, activeSubTab]);

    const filteredPlacements = useMemo(() => {
        if (!activeSubTab) return placements;
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
                providerKey: res.providerKey || placement.providerKey
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

    if (placements.length === 0) {
        return null; // Silent when no active placements configured for this tab
    }

    return (
        <div className={`space-y-4 ${className}`}>
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

            {/* Sub-Tab Filter Pills when multiple placement sub-tabs exist */}
            {subTabs.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Sub-Tabs:</span>
                    {subTabs.map(st => (
                        <button
                            key={st.id}
                            onClick={() => setActiveSubTab(st.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                activeSubTab === st.id
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            {st.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Placements Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlacements.map(p => (
                    <div
                        key={p._id}
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
                                        <span className="text-[10px] text-slate-400 font-semibold uppercase">{p.subTabName || p.subTabId}</span>
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
                                onClick={() => handleLaunchPlacement(p)}
                                disabled={launchingPlacementId === p._id}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 min-h-[40px]"
                            >
                                {launchingPlacementId === p._id ? (
                                    <>
                                        <RefreshIcon className="w-4 h-4 animate-spin" />
                                        <span>Initializing Session...</span>
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
                ))}
            </div>

            {/* PROVIDER LAUNCH MODAL */}
            {activeLaunchSession && (
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
                            <iframe
                                src={activeLaunchSession.launchUrl}
                                title={activeLaunchSession.displayName}
                                className="w-full h-full border-0"
                                allow="fullscreen; camera; microphone"
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

export default ProviderPlacementPanel;
