import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { getHeaders } from '../../services/api';

interface OfferwallProvider {
    _id: string;
    providerKey: string;
    name: string;
    category: 'offerwall' | 'survey' | 'video' | 'microtask' | 'gaming';
    group: string;
    enabled: boolean;
    appId: string;
    apiKey?: string;
    secretKey: string;
    postbackKey: string;
    iframeUrlTemplate: string;
    exchangeRateMultiplier: number;
    commissionMode?: 'provider_managed' | 'smartexn_managed';
    userRevenueSharePercent?: number;
    platformRevenueSharePercent?: number;
    ipWhitelist: string[];
    requireSignature: boolean;
    signatureType: string;
    testMode: boolean;
    badge?: string;
    icon?: string;
    description?: string;
    technicalReadinessScore: number;
    approvalLikelihoodScore: string;
    complianceNotes?: string;
    status?: string;
    approvalStatus?: string;
    integrationStatus?: string;
    customConfig?: {
        currency?: string;
        [key: string]: any;
    };
    defaultRedirectUrl?: string;
    successRedirectUrl?: string;
    partialRedirectUrl?: string;
    disqualifiedRedirectUrl?: string;
    quotaFullRedirectUrl?: string;
    securityRedirectUrl?: string;
    eventWebhookUrl?: string;
    rewardCallbackUrl?: string;
    includeReversalsInRewardCallback?: boolean;
}

interface PostbackLog {
    _id: string;
    provider: string;
    externalTxId: string;
    username: string;
    rewardUSD: number;
    rawReward: number;
    rawCurrency: string;
    offerId?: string;
    offerName?: string;
    status: string;
    isReversal: boolean;
    clientIp: string;
    queryParams: any;
    errorMessage?: string;
    transactionId?: string;
    receivedAt: string;
    grossAmountUSD?: number;
    userRewardUSD?: number;
    platformRevenueUSD?: number;
    reversedAmountUSD?: number;
}

export const AdminOfferwalls: React.FC = () => {
    const { state } = useData();
    const { users } = state;

    const [providers, setProviders] = useState<OfferwallProvider[]>([]);
    const [logs, setLogs] = useState<PostbackLog[]>([]);
    const [activeTab, setActiveTab] = useState<'networks' | 'logs' | 'simulator' | 'matrix'>('networks');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [editingProvider, setEditingProvider] = useState<OfferwallProvider | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    // Simulator State
    const [simProvider, setSimProvider] = useState<string>('torox');
    const [simUserId, setSimUserId] = useState<string>('');
    const [simAmount, setSimAmount] = useState<number>(1.50);
    const [simIsReversal, setSimIsReversal] = useState<boolean>(false);
    const [simOfferName, setSimOfferName] = useState<string>('Test Premium Offer #101');
    const [simResult, setSimResult] = useState<any>(null);
    const [isSimulating, setIsSimulating] = useState<boolean>(false);

    // Logs Filter
    const [logProviderFilter, setLogProviderFilter] = useState<string>('');
    const [logStatusFilter, setLogStatusFilter] = useState<string>('');

    const fetchProviders = async () => {
        try {
            const res = await fetch('/api/v1/postbacks/providers', {
                headers: getHeaders()
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setProviders(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch offerwall providers:', err);
        }
    };

    const fetchLogs = async () => {
        try {
            let url = '/api/v1/postbacks/logs?limit=50';
            if (logProviderFilter) url += `&provider=${logProviderFilter}`;
            if (logStatusFilter) url += `&status=${logStatusFilter}`;

            const res = await fetch(url, {
                headers: getHeaders()
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setLogs(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch postback logs:', err);
        }
    };

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([fetchProviders(), fetchLogs()]);
            setIsLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') {
            fetchLogs();
        }
    }, [activeTab, logProviderFilter, logStatusFilter]);

    const handleSaveProvider = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProvider) return;

        setIsSaving(true);
        try {
            const payload: any = { ...editingProvider };
            // Credential safety: omit empty or masked credentials so existing stored secrets are preserved
            if (payload.secretKey !== undefined && (!payload.secretKey.trim() || payload.secretKey.trim() === '••••••••' || /^•+$/.test(payload.secretKey.trim()))) {
                delete payload.secretKey;
            }
            if (payload.apiKey !== undefined && (!payload.apiKey.trim() || payload.apiKey.trim() === '••••••••' || /^•+$/.test(payload.apiKey.trim()))) {
                delete payload.apiKey;
            }

            const res = await fetch(`/api/v1/postbacks/providers/${editingProvider.providerKey}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                await fetchProviders();
                setEditingProvider(null);
            } else {
                alert(`Error saving provider: ${data.error}`);
            }
        } catch (err: any) {
            alert(`Save failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunSimulation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSimulating(true);
        setSimResult(null);

        try {
            const res = await fetch('/api/v1/postbacks/simulate', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    providerKey: simProvider,
                    userId: simUserId || (users[0]?._id || 'demo_user'),
                    amount: Number(simAmount),
                    isReversal: simIsReversal,
                    offerName: simOfferName
                })
            });
            const data = await res.json();
            setSimResult(data);
            await fetchLogs();
        } catch (err: any) {
            setSimResult({ success: false, error: err.message });
        } finally {
            setIsSimulating(false);
        }
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedUrl(key);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    const getFullPostbackUrl = (providerKey: string) => {
        const origin = window.location.origin;
        return `${origin}/api/v1/postbacks/${providerKey}`;
    };

    const filteredProviders = providers.filter(p => {
        if (selectedCategory === 'all') return true;
        if (selectedCategory === 'Group A') return p.group.includes('Group A');
        if (selectedCategory === 'Group B') return p.group.includes('Group B');
        if (selectedCategory === 'Group C') return p.group.includes('Group C');
        if (selectedCategory === 'Group D') return p.group.includes('Group D');
        return true;
    });

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-black uppercase tracking-wider mb-2">
                        <span>🛡️ S2S Postback Engine & Multi-Network Manager</span>
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        Offerwall, Survey & Ads Network Gateway
                    </h1>
                    <p className="text-slate-400 text-xs max-w-2xl mt-1">
                        Configure production App IDs, API Secret Keys, S2S Webhooks, Exchange Rates, and inspect live postback logs for all 26 verified networks across Groups A, B, C, and D.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            fetchProviders();
                            fetchLogs();
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                        🔄 Refresh Data
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
                <button
                    onClick={() => setActiveTab('networks')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'networks'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    🌐 Networks & API Keys ({providers.length})
                </button>
                <button
                    onClick={() => setActiveTab('matrix')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'matrix'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    📊 26-Network Readiness Matrix
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'logs'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    📜 Postback Audit Logs ({logs.length})
                </button>
                <button
                    onClick={() => setActiveTab('simulator')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'simulator'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    🧪 Webhook Simulator & Test Bench
                </button>
            </div>

            {/* TAB 1: NETWORKS CONFIGURATION */}
            {activeTab === 'networks' && (
                <div className="space-y-4">
                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                        {['all', 'Group A', 'Group B', 'Group C', 'Group D'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedCategory === cat
                                        ? 'bg-slate-700 text-white border border-slate-600'
                                        : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                                }`}
                            >
                                {cat === 'all' ? 'All Groups' : cat}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProviders.map(p => (
                            <div
                                key={p.providerKey}
                                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{p.icon || '⚡'}</span>
                                            <div>
                                                <h3 className="text-sm font-black text-white">{p.name}</h3>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{p.group}</span>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full border ${
                                            p.enabled 
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                            {p.enabled ? 'ACTIVE' : 'DISABLED'}
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                                        {p.description || 'Verified S2S postback integration.'}
                                    </p>

                                    <div className="space-y-2 bg-slate-950/80 rounded-xl p-3 text-xs mb-4">
                                        {p.providerKey === 'theoremreach' && (
                                            <div className="flex items-center justify-between text-slate-400">
                                                <span>API Key:</span>
                                                <span className={`font-mono font-bold ${p.apiKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {p.apiKey ? '••••••••' : 'Not Configured'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>App / Placement ID:</span>
                                            <span className="font-mono text-slate-200 font-bold">{p.appId || 'Not Configured'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>Signature Scheme:</span>
                                            <span className="font-mono text-indigo-400 font-bold uppercase">{p.signatureType}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>Exchange Multiplier:</span>
                                            <span className="font-bold text-emerald-400">{p.exchangeRateMultiplier || 1.0}x</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>Commission Mode:</span>
                                            <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-md uppercase border ${
                                                p.commissionMode === 'smartexn_managed'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            }`}>
                                                {p.commissionMode === 'smartexn_managed' ? 'SmartExn-Managed' : 'Provider-Managed'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400">
                                            <span>Revenue Split:</span>
                                            <span className="font-bold text-amber-400">
                                                {p.commissionMode === 'smartexn_managed'
                                                    ? `${p.platformRevenueSharePercent !== undefined ? p.platformRevenueSharePercent : (100 - (p.userRevenueSharePercent ?? 70))}% Retained (Worker: ${p.userRevenueSharePercent ?? 70}%)`
                                                    : '100% to Worker (Net Payout)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-800">
                                    <div className="flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => copyToClipboard(getFullPostbackUrl(p.providerKey), p.providerKey)}
                                            className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <span>📋</span>
                                            <span>{copiedUrl === p.providerKey ? 'Copied URL!' : 'Copy S2S Postback URL'}</span>
                                        </button>
                                        <button
                                            onClick={() => setEditingProvider(p)}
                                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black transition-all"
                                        >
                                            Configure
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: AUDIT & READINESS MATRIX */}
            {activeTab === 'matrix' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-lg font-black text-white">
                            26-Network Technical & Compliance Readiness Matrix
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Official technical audit results and publisher approval guidelines for all supported providers.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/80 text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-4">Network</th>
                                    <th className="py-3 px-4">Group / Category</th>
                                    <th className="py-3 px-4">Technical Readiness</th>
                                    <th className="py-3 px-4">Approval Likelihood</th>
                                    <th className="py-3 px-4">Signature Scheme</th>
                                    <th className="py-3 px-4">Compliance Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {providers.map(p => (
                                    <tr key={p.providerKey} className="hover:bg-slate-800/40">
                                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                                            <span>{p.icon || '⚡'}</span>
                                            <span>{p.name}</span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-300">{p.group}</td>
                                        <td className="py-3 px-4 font-black text-emerald-400">
                                            {p.technicalReadinessScore || 100}% Ready
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                                {p.approvalLikelihoodScore || 'High'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-mono text-indigo-400 uppercase font-semibold">
                                            {p.signatureType}
                                        </td>
                                        <td className="py-3 px-4 text-slate-400 max-w-xs">
                                            {p.complianceNotes || 'Standard S2S callback with idempotent wallet crediting.'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: POSTBACK AUDIT LOGS */}
            {activeTab === 'logs' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-white">Live Postback Audit Trail</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Real-time transaction logs with signature validation status, client IPs, and ledger IDs.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={logStatusFilter}
                                onChange={(e) => setLogStatusFilter(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-bold"
                            >
                                <option value="">All Statuses</option>
                                <option value="Processed">Processed</option>
                                <option value="Duplicate">Duplicate</option>
                                <option value="Reversed">Reversed</option>
                                <option value="InvalidSignature">Invalid Signature</option>
                                <option value="UserNotFound">User Not Found</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/80 text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-3">Time</th>
                                    <th className="py-3 px-3">Provider</th>
                                    <th className="py-3 px-3">User</th>
                                    <th className="py-3 px-3">Reward</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-3">Ext Tx ID</th>
                                    <th className="py-3 px-3">Client IP</th>
                                    <th className="py-3 px-3">Offer / Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                                            No postback transactions recorded yet. Use the Simulator to test.
                                        </td>
                                    </tr>
                                ) : logs.map(l => (
                                    <tr key={l._id} className="hover:bg-slate-800/40 font-mono">
                                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                                            {new Date(l.receivedAt).toLocaleTimeString()}
                                        </td>
                                        <td className="py-3 px-3 font-bold text-indigo-400 uppercase">
                                            {l.provider}
                                        </td>
                                        <td className="py-3 px-3 text-slate-200">
                                            {l.username || 'Unknown'}
                                        </td>
                                        <td className={`py-3 px-3 font-bold ${l.isReversal ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {l.isReversal ? '-' : '+'}${((l.userRewardUSD !== undefined && l.userRewardUSD !== null && l.userRewardUSD > 0)
                                                ? l.userRewardUSD
                                                : (l.reversedAmountUSD !== undefined && l.reversedAmountUSD !== null && l.reversedAmountUSD > 0)
                                                ? l.reversedAmountUSD
                                                : (l.rewardUSD || 0)).toFixed(2)} USD
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                l.status === 'Processed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                l.status === 'Reversed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                l.status === 'Duplicate' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                            }`}>
                                                {l.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-slate-400 truncate max-w-[120px]">
                                            {l.externalTxId}
                                        </td>
                                        <td className="py-3 px-3 text-slate-400">
                                            {l.clientIp}
                                        </td>
                                        <td className="py-3 px-3 text-slate-300 font-sans truncate max-w-[180px]">
                                            {l.errorMessage || l.offerName || 'Reward'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: WEBHOOK SIMULATOR */}
            {activeTab === 'simulator' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                        <h2 className="text-lg font-black text-white mb-1">
                            S2S Postback Simulation Engine
                        </h2>
                        <p className="text-xs text-slate-400 mb-6">
                            Test real reward crediting, idempotency, signature validation, and reversal logic directly against the live backend handler.
                        </p>

                        <form onSubmit={handleRunSimulation} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Target Provider</label>
                                <select
                                    value={simProvider}
                                    onChange={(e) => setSimProvider(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                >
                                    {providers.map(p => (
                                        <option key={p.providerKey} value={p.providerKey}>
                                            {p.name} ({p.group})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Recipient User</label>
                                <select
                                    value={simUserId}
                                    onChange={(e) => setSimUserId(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                >
                                    <option value="">-- Select Member --</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>
                                            {u.username} ({u.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Reward USD ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={simAmount}
                                        onChange={(e) => setSimAmount(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Event Type</label>
                                    <select
                                        value={simIsReversal ? 'reversal' : 'credit'}
                                        onChange={(e) => setSimIsReversal(e.target.value === 'reversal')}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    >
                                        <option value="credit">✅ Credit Reward</option>
                                        <option value="reversal">⚠️ Chargeback / Reversal</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Offer / Survey Name</label>
                                <input
                                    type="text"
                                    value={simOfferName}
                                    onChange={(e) => setSimOfferName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSimulating}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30 mt-2"
                            >
                                {isSimulating ? 'Executing Simulation...' : '🚀 Dispatch Simulated Postback'}
                            </button>
                        </form>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-base font-black text-white mb-2">Simulation Engine Output</h3>
                            <p className="text-xs text-slate-400 mb-4">
                                Result returned from the S2S Postback router and wallet balance update.
                            </p>

                            <div className="bg-slate-950 rounded-2xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto min-h-[220px]">
                                {simResult ? (
                                    <pre>{JSON.stringify(simResult, null, 2)}</pre>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-600 font-sans">
                                        Run a test postback to inspect the live response.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-300">
                            💡 <strong>Dry-Run Simulation Mode:</strong> Simulated postbacks validate credentials, provider status, signatures, and revenue calculations without modifying real user balances, creating transaction records, or altering provider metrics.
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT PROVIDER MODAL */}
            {editingProvider && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{editingProvider.icon || '⚡'}</span>
                                <div>
                                    <h2 className="text-lg font-black text-white">
                                        Configure {editingProvider.name}
                                    </h2>
                                    <span className="text-xs text-indigo-400 font-mono">
                                        providerKey: {editingProvider.providerKey}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingProvider(null)}
                                className="text-slate-400 hover:text-white font-black text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveProvider} className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
                                <div>
                                    <span className="text-xs font-black uppercase text-white">Enable this Provider</span>
                                    <p className="text-[11px] text-slate-400">Make this offerwall / survey router visible to members</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={editingProvider.enabled}
                                    onChange={(e) => setEditingProvider({ ...editingProvider, enabled: e.target.checked })}
                                    className="w-5 h-5 rounded accent-indigo-600"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                                        API Key {editingProvider.providerKey === 'theoremreach' && <span className="text-amber-400 font-bold">(Entry Link)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={editingProvider.apiKey || ''}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                                        placeholder={editingProvider.providerKey === 'theoremreach' ? 'TheoremReach API Key' : 'API Key'}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                                        App ID / Pub ID / Placement ID {editingProvider.providerKey === 'cpx_research' && <span className="text-indigo-400 font-bold">(Publisher App ID)</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingProvider.appId || ''}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, appId: e.target.value })}
                                        placeholder={editingProvider.providerKey === 'cpx_research' ? 'CPX App ID (e.g. 37470)' : 'e.g. 14892 or app_live_xyz'}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                                        Secret Key / Hash Key {editingProvider.providerKey === 'cpx_research' && <span className="text-indigo-400 font-bold">(App Secure Hash)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={editingProvider.secretKey || ''}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, secretKey: e.target.value })}
                                        placeholder={editingProvider.providerKey === 'cpx_research' ? 'Leave blank to preserve existing secret' : 'Enter provider secret key'}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-mono"
                                    />
                                </div>
                            </div>

                            {/* Commission Mode Architecture */}
                            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-white mb-1">
                                        Commission & Accounting Mode
                                    </label>
                                    <p className="text-[11px] text-slate-400">
                                        Select whether this network reports net rewards directly or gross revenue requiring platform split.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                                        (editingProvider.commissionMode || 'provider_managed') === 'provider_managed'
                                            ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <input
                                                type="radio"
                                                name="commissionMode"
                                                value="provider_managed"
                                                checked={(editingProvider.commissionMode || 'provider_managed') === 'provider_managed'}
                                                onChange={() => setEditingProvider({
                                                    ...editingProvider,
                                                    commissionMode: 'provider_managed'
                                                })}
                                                className="accent-emerald-500"
                                            />
                                            <span className="text-xs font-black text-emerald-400 uppercase">Provider-Managed</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-tight">
                                            Provider calculates net user reward. SmartExn passes 100% of payout to worker with 0% platform deduction (prevents double deductions).
                                        </p>
                                    </label>

                                    <label className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                                        editingProvider.commissionMode === 'smartexn_managed'
                                            ? 'bg-amber-950/40 border-amber-500/50 text-white'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <input
                                                type="radio"
                                                name="commissionMode"
                                                value="smartexn_managed"
                                                checked={editingProvider.commissionMode === 'smartexn_managed'}
                                                onChange={() => setEditingProvider({
                                                    ...editingProvider,
                                                    commissionMode: 'smartexn_managed'
                                                })}
                                                className="accent-amber-500"
                                            />
                                            <span className="text-xs font-black text-amber-400 uppercase">SmartExn-Managed</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-tight">
                                            Provider delivers confirmed gross revenue. SmartExn deducts platform retained share and credits remaining net payout to worker.
                                        </p>
                                    </label>
                                </div>

                                {editingProvider.commissionMode === 'smartexn_managed' ? (
                                    <div className="pt-2 border-t border-slate-800/80">
                                        <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                                            SmartExn Retained Share (%)
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={editingProvider.platformRevenueSharePercent !== undefined ? editingProvider.platformRevenueSharePercent : (100 - (editingProvider.userRevenueSharePercent ?? 70))}
                                                onChange={(e) => {
                                                    const retained = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                                    setEditingProvider({
                                                        ...editingProvider,
                                                        platformRevenueSharePercent: retained,
                                                        userRevenueSharePercent: 100 - retained
                                                    });
                                                }}
                                                className="w-32 bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                            />
                                            <span className="text-xs text-slate-400">
                                                Worker receives <strong className="text-emerald-400">{100 - (editingProvider.platformRevenueSharePercent !== undefined ? editingProvider.platformRevenueSharePercent : (100 - (editingProvider.userRevenueSharePercent ?? 70)))}%</strong> of gross payout
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-2.5 bg-emerald-950/20 rounded-xl border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                                        <span>🛡️</span>
                                        <span><strong>Zero Double-Deduction Protection Active:</strong> 100% of reported reward is credited to worker. Platform retains 0%.</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Operational Status</label>
                                    <select
                                        value={editingProvider.status || 'NOT_STARTED'}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, status: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold uppercase"
                                    >
                                        <option value="NOT_STARTED">Not Started</option>
                                        <option value="CREDENTIALS_PENDING">Credentials Pending</option>
                                        <option value="SANDBOX">Sandbox</option>
                                        <option value="TESTING">Testing</option>
                                        <option value="PRODUCTION_READY">Production Ready</option>
                                        <option value="ACTIVE">Active</option>
                                        <option value="DISABLED">Disabled</option>
                                        <option value="SUSPENDED">Suspended</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Exchange Multiplier (1 USD = ? User $)</label>
                                    <input
                                        type="number"
                                        step="0.05"
                                        value={editingProvider.exchangeRateMultiplier || 1.0}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, exchangeRateMultiplier: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Signature Scheme</label>
                                    <select
                                        value={editingProvider.signatureType}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, signatureType: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold uppercase"
                                    >
                                        <option value="none">None / Open</option>
                                        <option value="md5">MD5 Hash</option>
                                        <option value="sha256">SHA256 Hash</option>
                                        <option value="hmac_sha1">HMAC-SHA1</option>
                                        <option value="hmac_sha256">HMAC-SHA256</option>
                                        <option value="ip_only">IP Whitelist Only</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Iframe URL Template</label>
                                <input
                                    type="text"
                                    value={editingProvider.iframeUrlTemplate || ''}
                                    onChange={(e) => setEditingProvider({ ...editingProvider, iframeUrlTemplate: e.target.value })}
                                    placeholder="https://example.com/wall?app_id={appId}&uid={userId}"
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-mono"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Available placeholders: <code className="text-indigo-400">&#123;appId&#125;</code>, <code className="text-indigo-400">&#123;userId&#125;</code></p>
                            </div>

                            {editingProvider.providerKey === 'theoremreach' && (
                                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                                    <div className="border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">🌐</span>
                                            <h4 className="text-xs font-black uppercase text-indigo-300 tracking-wider">
                                                TheoremReach Dashboard Configuration & Reference URLs
                                            </h4>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            These settings correspond to fields configured in your <strong>TheoremReach Publisher Portal</strong> (Apps &gt; Web Integration). Configure these URLs in your TheoremReach dashboard to direct respondents and reward callbacks to SmartExn.
                                        </p>
                                    </div>

                                    {/* Redirect URLs Grid */}
                                    <div>
                                        <span className="block text-[11px] font-black uppercase text-slate-300 mb-2">
                                            1. Respondent Exit &amp; Outcome Redirect URLs (Configured in TheoremReach Dashboard)
                                        </span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Default Redirect URL</label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.defaultRedirectUrl || ''}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, defaultRedirectUrl: e.target.value })}
                                                    placeholder={`${window.location.origin}/member/offerwalls`}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Success Redirect URL</label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.successRedirectUrl || ''}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, successRedirectUrl: e.target.value })}
                                                    placeholder={`${window.location.origin}/member/offerwalls?status=success`}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Partial Reward Redirect URL</label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.partialRedirectUrl || ''}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, partialRedirectUrl: e.target.value })}
                                                    placeholder={`${window.location.origin}/member/offerwalls?status=partial`}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Disqualified Redirect URL</label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.disqualifiedRedirectUrl || ''}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, disqualifiedRedirectUrl: e.target.value })}
                                                    placeholder={`${window.location.origin}/member/offerwalls?status=disqualified`}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Quota Full Redirect URL</label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.quotaFullRedirectUrl || ''}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, quotaFullRedirectUrl: e.target.value })}
                                                    placeholder={`${window.location.origin}/member/offerwalls?status=quotafull`}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Security Redirect URL</label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.securityRedirectUrl || ''}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, securityRedirectUrl: e.target.value })}
                                                    placeholder={`${window.location.origin}/member/offerwalls?status=security`}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Callbacks, Webhooks & Reversal Policy */}
                                    <div className="pt-3 border-t border-slate-800 space-y-3">
                                        <span className="block text-[11px] font-black uppercase text-slate-300">
                                            2. Server Callbacks, Webhooks &amp; Reversals
                                        </span>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                                    Reward Callback URL (Inbound S2S Endpoint)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.rewardCallbackUrl || getFullPostbackUrl(editingProvider.providerKey)}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, rewardCallbackUrl: e.target.value })}
                                                    placeholder={getFullPostbackUrl(editingProvider.providerKey)}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Active incoming S2S endpoint receiving survey rewards and reversals with HMAC-SHA1 signature verification.
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                                    Event Webhook URL (Inbound Event Receiver)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.eventWebhookUrl || 'https://smartexn.com/api/v1/postbacks/theoremreach/events'}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, eventWebhookUrl: e.target.value })}
                                                    placeholder="https://smartexn.com/api/v1/postbacks/theoremreach/events"
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Inbound TheoremReach Event Webhook endpoint receiving async event notifications (reversal, ban) with enc_salt deduplication and HMAC-SHA1 signature verification.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                                            <div>
                                                <span className="text-[11px] font-bold uppercase text-white block">
                                                    Include Reversals In Reward Callback
                                                </span>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    Reflects whether reversals/chargebacks are enabled in your TheoremReach dashboard. SmartExn safely and atomically processes all valid reversal postbacks without balance leaks or duplicate deductions.
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={editingProvider.includeReversalsInRewardCallback ?? true}
                                                onChange={(e) => setEditingProvider({ ...editingProvider, includeReversalsInRewardCallback: e.target.checked })}
                                                className="w-4 h-4 rounded accent-indigo-600 shrink-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editingProvider.providerKey === 'cpx_research' && (
                                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                                    <div className="border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">📊</span>
                                            <h4 className="text-xs font-black uppercase text-indigo-300 tracking-wider">
                                                CPX Research Publisher Portal &amp; S2S Integration
                                            </h4>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Settings matching your <strong>CPX Research Publisher Dashboard</strong> (Settings &gt; Postback / App Configuration). SmartExn verifies inbound postback signatures via <code className="text-indigo-400 font-mono">MD5(trans_id + &quot;-&quot; + app_secure_hash)</code> and constructs secure user iframe entry URLs using <code className="text-indigo-400 font-mono">MD5(ext_user_id + &quot;-&quot; + app_secure_hash)</code>.
                                        </p>
                                    </div>

                                    {/* CPX Payout Currency & Mode Status */}
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                                    CPX Payout Currency {editingProvider.commissionMode === 'provider_managed' && <span className="text-rose-400 font-black">*Required</span>}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editingProvider.customConfig?.currency || ''}
                                                    onChange={(e) => setEditingProvider({
                                                        ...editingProvider,
                                                        customConfig: {
                                                            ...(editingProvider.customConfig || {}),
                                                            currency: e.target.value.trim().toUpperCase()
                                                        }
                                                    })}
                                                    placeholder="USD"
                                                    maxLength={5}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-mono font-bold uppercase"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Configured payout currency in CPX dashboard (e.g. USD, EUR).
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                                    Approval Status
                                                </label>
                                                <select
                                                    value={editingProvider.approvalStatus || 'Pending'}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, approvalStatus: e.target.value })}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-bold"
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Submitted">Submitted</option>
                                                    <option value="Under Review">Under Review</option>
                                                    <option value="Approved">Approved</option>
                                                    <option value="Rejected">Rejected</option>
                                                </select>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Network review / account approval milestone.
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                                    Integration Status
                                                </label>
                                                <select
                                                    value={editingProvider.integrationStatus || 'Not Started'}
                                                    onChange={(e) => setEditingProvider({ ...editingProvider, integrationStatus: e.target.value })}
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-bold"
                                                >
                                                    <option value="Not Started">Not Started</option>
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="Configured">Configured</option>
                                                    <option value="Tested">Tested</option>
                                                    <option value="Verified">Verified</option>
                                                </select>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Technical end-to-end sandbox verification phase.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Accounting Mode Notice */}
                                        {editingProvider.commissionMode === 'provider_managed' ? (
                                            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                                                <div className="flex items-center gap-2 font-black text-emerald-400">
                                                    <span>⚙️</span>
                                                    <span>Provider-Managed Mode Active (Requires Payout Currency + Exchange Multiplier)</span>
                                                </div>
                                                <p className="text-[11px] text-slate-300">
                                                    CPX delivers net user rewards via <code className="text-emerald-300 font-mono">amount_local</code> in {editingProvider.customConfig?.currency || 'configured currency'}. Converted to USD using Exchange Multiplier ({editingProvider.exchangeRateMultiplier || 1.0}x). 100% of the converted reward credits to worker with 0% SmartExn deduction.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs space-y-1">
                                                <div className="flex items-center gap-2 font-black text-amber-400">
                                                    <span>💰</span>
                                                    <span>SmartExn-Managed Mode Active (Direct USD Accounting)</span>
                                                </div>
                                                <p className="text-[11px] text-slate-300">
                                                    CPX delivers gross publisher revenue in <code className="text-amber-300 font-mono">amount_usd</code>. No exchange multiplier is applied. Configured split ({100 - (editingProvider.platformRevenueSharePercent !== undefined ? editingProvider.platformRevenueSharePercent : (100 - (editingProvider.userRevenueSharePercent ?? 70)))}% worker / {editingProvider.platformRevenueSharePercent !== undefined ? editingProvider.platformRevenueSharePercent : (100 - (editingProvider.userRevenueSharePercent ?? 70))}% platform) is applied exactly once.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* S2S Postback URL & Query Parameters Reference */}
                                    <div className="pt-3 border-t border-slate-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="block text-[11px] font-black uppercase text-slate-300">
                                                CPX Server-to-Server (S2S) Callback Specification
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(getFullPostbackUrl('cpx_research'), 'cpx_modal_url')}
                                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-[10px] font-bold"
                                            >
                                                {copiedUrl === 'cpx_modal_url' ? '✓ Copied!' : 'Copy CPX S2S URL'}
                                            </button>
                                        </div>

                                        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-300 break-all select-all">
                                            {getFullPostbackUrl('cpx_research')}?trans_id=&#123;trans_id&#125;&amp;user_id=&#123;user_id&#125;&amp;amount_usd=&#123;amount_usd&#125;&amp;amount_local=&#123;amount_local&#125;&amp;status=&#123;status&#125;&amp;type=&#123;type&#125;&amp;secure_hash=&#123;secure_hash&#125;
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-400 font-mono">
                                            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                                <strong className="text-white block font-sans">trans_id</strong>
                                                <span>CPX Transaction ID</span>
                                            </div>
                                            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                                <strong className="text-white block font-sans">user_id / ext_user_id</strong>
                                                <span>SmartExn User ID</span>
                                            </div>
                                            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                                <strong className="text-white block font-sans">amount_usd / local</strong>
                                                <span>USD Gross or Local Payout</span>
                                            </div>
                                            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                                <strong className="text-white block font-sans">status / type</strong>
                                                <span>1=Credit, 2=Reversal; out=Screenout</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Iframe Entry Security Reference */}
                                    <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                                        <span className="block text-[11px] font-black uppercase text-slate-300">
                                            Secure Iframe Entry URL Builder
                                        </span>
                                        <p className="text-[11px] text-slate-400">
                                            SmartExn backend signs user entry URLs server-side using <code className="text-indigo-400 font-mono">secure_hash = MD5(ext_user_id + &quot;-&quot; + app_secure_hash)</code>. The App Secure Hash is strictly kept on the server and never sent to browser clients.
                                        </p>
                                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300 break-all">
                                            https://offers.cpx-research.com/index.php?app_id={editingProvider.appId || '37470'}&amp;ext_user_id=&#123;userId&#125;&amp;secure_hash=&#123;server_computed_md5&#125;
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                                <span className="text-slate-400 font-bold">Your Postback URL for this provider:</span>
                                <div className="font-mono text-indigo-400 mt-1 break-all select-all">
                                    {getFullPostbackUrl(editingProvider.providerKey)}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditingProvider(null)}
                                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30"
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminOfferwalls;
