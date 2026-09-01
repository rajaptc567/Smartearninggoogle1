import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';

interface OfferwallProvider {
    _id: string;
    providerKey: string;
    name: string;
    category: 'offerwall' | 'survey' | 'video' | 'microtask' | 'gaming';
    group: string;
    enabled: boolean;
    appId: string;
    iframeUrlTemplate: string;
    exchangeRateMultiplier: number;
    badge?: string;
    icon?: string;
    description?: string;
    technicalReadinessScore?: number;
    approvalLikelihoodScore?: string;
    complianceNotes?: string;
}

export const OfferwallHub: React.FC = () => {
    const { state } = useData();
    const { currentUser, settings } = state;

    const [providers, setProviders] = useState<OfferwallProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<OfferwallProvider | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'offerwall' | 'survey' | 'gaming' | 'microtask'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [iframeLoading, setIframeLoading] = useState(false);

    const exchangeRate = settings?.exchangeRates?.[currentUser?.currency || 'USD'] || 1;
    const taskEarningsUSD = currentUser?.taskEarningsBalance ?? 0;
    const userLocalEarnings = taskEarningsUSD * exchangeRate;

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const res = await fetch('/api/v1/postbacks/providers');
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    setProviders(data.data);
                    // Select first enabled provider by default
                    const firstLive = data.data.find((p: OfferwallProvider) => p.enabled);
                    if (firstLive) {
                        setSelectedProvider(firstLive);
                    }
                }
            } catch (err) {
                console.error('Failed to load offerwall providers:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProviders();
    }, []);

    const filteredProviders = providers.filter(p => {
        if (activeTab === 'all') return true;
        if (activeTab === 'offerwall') return p.category === 'offerwall';
        if (activeTab === 'survey') return p.category === 'survey';
        if (activeTab === 'gaming') return p.category === 'gaming' || p.category === 'video';
        if (activeTab === 'microtask') return p.category === 'microtask';
        return true;
    });

    const getComputedIframeUrl = (provider: OfferwallProvider) => {
        if (!provider.iframeUrlTemplate) return '';
        const uid = currentUser?._id || currentUser?.username || 'test_user';
        const aid = provider.appId || 'demo_app_id';
        return provider.iframeUrlTemplate
            .replace(/{appId}/g, aid)
            .replace(/{pubId}/g, aid)
            .replace(/{userId}/g, uid)
            .replace(/{user_id}/g, uid)
            .replace(/{subId}/g, uid)
            .replace(/{uid}/g, uid);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header & Wallet Balance Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-black uppercase tracking-wider mb-3">
                            <span>⚡ Official Multi-Network Offerwall & Survey Hub</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                            Work & Earn: External Tasks & Surveys
                        </h1>
                        <p className="text-slate-400 text-sm max-w-2xl mt-1">
                            Complete rewarded quests, mobile games, opinion surveys, and micro-tasks from world-class verified partner networks. Rewards are automatically credited directly to your Task Earnings Wallet via secure Server-to-Server (S2S) postbacks!
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-center min-w-[180px]">
                            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Your Task Wallet</span>
                            <div className="text-xl md:text-2xl font-black text-emerald-400 mt-0.5">
                                ${(taskEarningsUSD).toFixed(2)} USD
                            </div>
                            {currentUser?.currency && currentUser.currency !== 'USD' && (
                                <span className="text-xs text-slate-400 font-semibold">
                                    ≈ {userLocalEarnings.toFixed(2)} {currentUser.currency}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'all'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    🌐 All Networks ({providers.length})
                </button>
                <button
                    onClick={() => setActiveTab('offerwall')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'offerwall'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    🔥 Group A: Multi-Task & Offerwalls ({providers.filter(p => p.category === 'offerwall').length})
                </button>
                <button
                    onClick={() => setActiveTab('survey')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'survey'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    📊 Group B: Survey Routers ({providers.filter(p => p.category === 'survey').length})
                </button>
                <button
                    onClick={() => setActiveTab('gaming')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'gaming'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    🎮 Group C: Rewarded Video & Playables ({providers.filter(p => p.category === 'gaming' || p.category === 'video').length})
                </button>
                <button
                    onClick={() => setActiveTab('microtask')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'microtask'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    🏗️ Group D: Crowdsourcing ({providers.filter(p => p.category === 'microtask').length})
                </button>
            </div>

            {/* Network Selection Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center text-slate-400 font-semibold">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        Loading partner networks...
                    </div>
                ) : filteredProviders.map((prov) => {
                    const isSelected = selectedProvider?.providerKey === prov.providerKey;
                    return (
                        <button
                            key={prov.providerKey}
                            onClick={() => {
                                setSelectedProvider(prov);
                                setIframeLoading(true);
                            }}
                            className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between relative group ${
                                isSelected
                                    ? 'bg-indigo-950/80 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/40'
                                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl">{prov.icon || '⚡'}</span>
                                    {prov.enabled ? (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                                            LIVE
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                                            SANDBOX
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-xs font-black text-white line-clamp-1 group-hover:text-indigo-400 transition-colors">
                                    {prov.name}
                                </h3>
                                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                    {prov.badge || prov.category.toUpperCase()}
                                </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-bold">1 USD =</span>
                                <span className="text-emerald-400 font-black">${prov.exchangeRateMultiplier || 1.0}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Live Offerwall Embedder / Active Screen */}
            {selectedProvider && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header Bar */}
                    <div className="p-4 md:p-6 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl shrink-0">
                                {selectedProvider.icon || '⚡'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base md:text-lg font-black text-white">
                                        {selectedProvider.name}
                                    </h2>
                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                                        {selectedProvider.group}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {selectedProvider.description || 'Complete offers and tasks from this partner network.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300">
                                <span className="text-slate-400">SubID: </span>
                                <span className="font-mono text-indigo-400">{currentUser?._id ? String(currentUser._id).slice(-8) : 'GUEST'}</span>
                            </div>
                            <button
                                onClick={() => {
                                    setIframeLoading(true);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>

                    {/* Iframe Viewport */}
                    <div className="relative min-h-[650px] bg-slate-950 flex flex-col">
                        {selectedProvider.iframeUrlTemplate && selectedProvider.appId ? (
                            <>
                                {iframeLoading && (
                                    <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
                                        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-xs font-bold uppercase tracking-wider">Connecting to {selectedProvider.name}...</span>
                                    </div>
                                )}
                                <iframe
                                    src={getComputedIframeUrl(selectedProvider)}
                                    title={selectedProvider.name}
                                    onLoad={() => setIframeLoading(false)}
                                    className="w-full h-[700px] border-0 rounded-b-3xl"
                                    allow="camera; microphone; geolocation; autoplay; clipboard-write"
                                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                                />
                            </>
                        ) : (
                            <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
                                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-3xl mb-4 text-indigo-400">
                                    {selectedProvider.icon || '⚡'}
                                </div>
                                <h3 className="text-lg font-black text-white mb-2">
                                    {selectedProvider.name} Configuration Status
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                    {selectedProvider.complianceNotes ||
                                        `This network is technically verified and integrated with SmartEXN's S2S Postback Engine. Once the administrator configures the production App ID and API Keys in the Admin Panel, the live iframe will render here automatically.`}
                                </p>

                                <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
                                    <div className="flex items-center justify-between text-slate-400">
                                        <span>Technical Integration Readiness:</span>
                                        <span className="font-bold text-emerald-400">{selectedProvider.technicalReadinessScore || 100}% Ready</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-400">
                                        <span>Publisher Approval Likelihood:</span>
                                        <span className="font-bold text-sky-400">{selectedProvider.approvalLikelihoodScore || 'High'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-400">
                                        <span>S2S Postback Endpoint:</span>
                                        <span className="font-mono text-indigo-400">/api/v1/postbacks/{selectedProvider.providerKey}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* How It Works & Anti-Fraud Notice */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                    <div className="text-2xl mb-2">🛡️</div>
                    <h4 className="text-sm font-black text-white mb-1">Strict Anti-Fraud & VPN Policy</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Do not use proxies, VPNs, emulators, or multiple accounts. Offers completed via unauthorized traffic will be rejected by provider fraud engines and may result in account review.
                    </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                    <div className="text-2xl mb-2">⚡</div>
                    <h4 className="text-sm font-black text-white mb-1">Instant Postback Crediting</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Upon valid completion of surveys and tasks, partner networks notify SmartEXN via cryptographic Server-to-Server callbacks and your reward is credited instantly.
                    </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                    <div className="text-2xl mb-2">💰</div>
                    <h4 className="text-sm font-black text-white mb-1">Direct Task Earnings Wallet</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        All external rewards go directly to your Work & Earn Task Balance, which is strictly separated from investment balances and available for withdrawal according to standard thresholds.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OfferwallHub;
