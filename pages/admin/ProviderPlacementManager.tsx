import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import {
    ProviderPlacement,
    ProviderCatalogItem,
    PlacementAuditLog,
    fetchAdminPlacements,
    fetchAdminCatalog,
    createAdminPlacement,
    updateAdminPlacement,
    deleteAdminPlacement,
    previewPlacementEligibility,
    fetchAdminAuditLogs
} from '../../services/providerPlacementService';

export const ProviderPlacementManager: React.FC = () => {
    const { state } = useData();
    const { users } = state;

    const [placements, setPlacements] = useState<ProviderPlacement[]>([]);
    const [catalog, setCatalog] = useState<ProviderCatalogItem[]>([]);
    const [auditLogs, setAuditLogs] = useState<PlacementAuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Active sub-view
    const [viewMode, setViewMode] = useState<'placements' | 'create' | 'audit'>('placements');

    // Editing State
    const [editingPlacement, setEditingPlacement] = useState<ProviderPlacement | null>(null);

    // New Placement Form State
    const [selectedProviderKey, setSelectedProviderKey] = useState<string>('');
    const [parentTabId, setParentTabId] = useState<string>('available_jobs');
    const [subTabId, setSubTabId] = useState<string>('');
    const [launchDisplayMode, setLaunchDisplayMode] = useState<'inline' | 'modal'>('modal');
    const [displayName, setDisplayName] = useState<string>('');
    const [descriptionOverride, setDescriptionOverride] = useState<string>('');
    const [badgeOverride, setBadgeOverride] = useState<string>('');
    const [displayOrder, setDisplayOrder] = useState<number>(0);
    const [targetingMode, setTargetingMode] = useState<'all' | 'selected_users' | 'test_users'>('all');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [testUserIds, setTestUserIds] = useState<string[]>([]);
    const [allowedCountriesInput, setAllowedCountriesInput] = useState<string>('');
    const [excludedCountriesInput, setExcludedCountriesInput] = useState<string>('');
    const [rolloutPercentage, setRolloutPercentage] = useState<number>(100);
    const [offerwallVisibility, setOfferwallVisibility] = useState<boolean>(false);
    const [availableTasksVisibility, setAvailableTasksVisibility] = useState<boolean>(false);

    // Eligibility Preview State
    const [previewUserId, setPreviewUserId] = useState<string>('');
    const [previewResult, setPreviewResult] = useState<any>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Available parent tabs & sub-tabs from Settings
    const customEarnTabs = state.settings?.customEarnTabs || [];

    const availableMainTabs = useMemo(() => {
        const tabs = [];
        
        // Always include Built-in Available Jobs
        tabs.push({
            id: 'available_jobs',
            title: 'Available Jobs (Built-in)',
            enabled: true,
            subTabs: []
        });

        if (Array.isArray(customEarnTabs)) {
            tabs.push(...customEarnTabs);
        }

        return tabs;
    }, [customEarnTabs]);

    const availableSubTabs = useMemo(() => {
        const found = availableMainTabs.find(t => t.id === parentTabId);
        const subs = Array.isArray(found?.subTabs) ? [...found!.subTabs] : [];
        
        // Add "No Sub-Tab" option
        return [{ id: '', name: 'Main Tab — No Sub-Tab', enabled: true }, ...subs];
    }, [availableMainTabs, parentTabId]);

    const editAvailableSubTabs = useMemo(() => {
        if (!editingPlacement) return [];
        const found = availableMainTabs.find(t => t.id === editingPlacement.parentTabId);
        const subs = Array.isArray(found?.subTabs) ? [...found!.subTabs] : [];
        
        // Base list with Main Tab — No Sub-Tab first
        const list = [{ id: '', name: 'Main Tab — No Sub-Tab', enabled: true }, ...subs];

        // Ensure currently stored subTabId is preserved even if it was unlisted/legacy
        if (editingPlacement.subTabId && !list.some(s => s.id === editingPlacement.subTabId)) {
            list.push({
                id: editingPlacement.subTabId,
                name: `${editingPlacement.subTabId} (Current)`,
                enabled: false
            });
        }

        return list;
    }, [availableMainTabs, editingPlacement?.parentTabId, editingPlacement?.subTabId]);

    useEffect(() => {
        // Reset subTabId if it's no longer valid for the selected parent
        if (availableSubTabs.length > 0 && !availableSubTabs.some(s => s.id === subTabId)) {
            setSubTabId('');
        }
    }, [availableSubTabs, subTabId]);

    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [pData, cData, aData] = await Promise.all([
                fetchAdminPlacements(),
                fetchAdminCatalog(),
                fetchAdminAuditLogs()
            ]);
            setPlacements(pData);
            setCatalog(cData);
            setAuditLogs(aData);

            if (cData.length > 0 && !selectedProviderKey) {
                setSelectedProviderKey(cData[0].providerKey);
                setDisplayName(cData[0].name);
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to load placement manager data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSelectProvider = (provKey: string) => {
        setSelectedProviderKey(provKey);
        const item = catalog.find(c => c.providerKey === provKey);
        if (item) {
            setDisplayName(item.name);
            setDescriptionOverride(item.description || '');
            setBadgeOverride(item.badge || '');
        }
    };

    const handleCreatePlacement = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);
        setIsSaving(true);

        try {
            const allowedCountries = allowedCountriesInput
                .split(',')
                .map(s => s.trim().toUpperCase())
                .filter(Boolean);

            const excludedCountries = excludedCountriesInput
                .split(',')
                .map(s => s.trim().toUpperCase())
                .filter(Boolean);

            const created = await createAdminPlacement({
                providerKey: selectedProviderKey,
                parentTabId,
                subTabId,
                launchDisplayMode,
                displayName,
                descriptionOverride,
                badgeOverride,
                displayOrder,
                placementEnabled: false, // CRITICAL: Always default OFF
                targetingMode,
                selectedUserIds,
                testUserIds,
                allowedCountries,
                excludedCountries,
                rolloutPercentage,
                offerwallVisibility,
                availableTasksVisibility
            });

            setSuccessMessage(`✅ Placement created for '${created.displayName}' (Default State: OFF).`);
            setViewMode('placements');
            await loadData();
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to create placement');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTogglePlacement = async (placement: ProviderPlacement) => {
        setErrorMessage(null);
        try {
            const updated = await updateAdminPlacement(placement._id, {
                placementEnabled: !placement.placementEnabled
            });
            setPlacements(prev => prev.map(p => p._id === updated._id ? updated : p));
            setSuccessMessage(`Placement '${updated.displayName}' is now ${updated.placementEnabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}.`);
            setTimeout(() => setSuccessMessage(null), 4000);
            const logs = await fetchAdminAuditLogs();
            setAuditLogs(logs);
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to toggle placement status');
        }
    };

    const handleDeletePlacement = async (placement: ProviderPlacement) => {
        if (!window.confirm(`Are you sure you want to delete placement '${placement.displayName}'? This action is recorded in audit logs.`)) {
            return;
        }

        setErrorMessage(null);
        try {
            await deleteAdminPlacement(placement._id);
            setSuccessMessage(`Placement '${placement.displayName}' deleted successfully.`);
            await loadData();
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to delete placement');
        }
    };

    const handleSaveEditPlacement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlacement) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const updated = await updateAdminPlacement(editingPlacement._id, {
                displayName: editingPlacement.displayName,
                descriptionOverride: editingPlacement.descriptionOverride,
                badgeOverride: editingPlacement.badgeOverride,
                displayOrder: editingPlacement.displayOrder,
                placementEnabled: editingPlacement.placementEnabled,
                targetingMode: editingPlacement.targetingMode,
                selectedUserIds: editingPlacement.selectedUserIds,
                testUserIds: editingPlacement.testUserIds,
                allowedCountries: editingPlacement.allowedCountries,
                excludedCountries: editingPlacement.excludedCountries,
                rolloutPercentage: editingPlacement.rolloutPercentage,
                launchDisplayMode: editingPlacement.launchDisplayMode,
                subTabId: editingPlacement.subTabId,
                offerwallVisibility: editingPlacement.offerwallVisibility,
                availableTasksVisibility: editingPlacement.availableTasksVisibility
            });

            setSuccessMessage(`Placement '${updated.displayName}' updated successfully.`);
            setEditingPlacement(null);
            await loadData();
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to update placement');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunPreview = async (placementId: string) => {
        if (!previewUserId) {
            alert('Please select a test user to preview eligibility');
            return;
        }
        setIsPreviewing(true);
        setPreviewResult(null);
        try {
            const res = await previewPlacementEligibility(placementId, previewUserId);
            setPreviewResult(res);
        } catch (err: any) {
            setPreviewResult({ error: err.message });
        } finally {
            setIsPreviewing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
                        <span>📍 Decoupled Provider Placement Manager</span>
                    </div>
                    <h2 className="text-xl font-black text-white">Universal Work & Earn Provider Placement System</h2>
                    <p className="text-slate-400 text-xs mt-1 max-w-2xl">
                        Configure UI placement, sub-tab routing, user targeting, country allow/exclude lists, and deterministic rollout percentage per offer network. Default status is strictly OFF.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('placements')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'placements' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        Placements ({placements.length})
                    </button>
                    <button
                        onClick={() => setViewMode('create')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'create' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                    >
                        + New Placement
                    </button>
                    <button
                        onClick={() => setViewMode('audit')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'audit' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        Audit Trail ({auditLogs.length})
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {errorMessage && (
                <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 p-4 rounded-2xl text-xs font-bold flex items-center justify-between">
                    <span>⚠️ {errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)} className="text-rose-400 font-black">✕</button>
                </div>
            )}

            {successMessage && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-4 rounded-2xl text-xs font-bold flex items-center justify-between">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 font-black">✕</button>
                </div>
            )}

            {/* VIEW 1: PLACEMENTS LIST */}
            {viewMode === 'placements' && (
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="p-12 text-center text-slate-500 font-bold text-xs bg-slate-900 border border-slate-800 rounded-3xl">
                            Loading placements and provider operational state...
                        </div>
                    ) : placements.length === 0 ? (
                        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                            <div className="text-3xl">📍</div>
                            <h3 className="text-sm font-bold text-white">No Provider Placements Configured</h3>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                                All 26 offer networks remain available via direct S2S. Create explicit placements to showcase specific providers under dynamic Work & Earn sub-tabs.
                            </p>
                            <button
                                onClick={() => setViewMode('create')}
                                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Create First Placement
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {placements.map(p => {
                                const prov = p.providerInfo;
                                const isProvDisabled = !prov || !prov.enabled || prov.status === 'DISABLED' || prov.status === 'SUSPENDED' || prov.status === 'NOT_STARTED';

                                return (
                                    <div
                                        key={p._id}
                                        className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all ${
                                            p.placementEnabled
                                                ? 'border-emerald-500/40 shadow-emerald-900/10'
                                                : 'border-slate-800'
                                        }`}
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">{prov?.icon || '⚡'}</span>
                                                    <div>
                                                        <h3 className="text-sm font-black text-white line-clamp-1">{p.displayName}</h3>
                                                        <span className="text-[10px] text-slate-400 font-mono">key: {p.providerKey}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleTogglePlacement(p)}
                                                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border transition-all ${
                                                        p.placementEnabled
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {p.placementEnabled ? 'ON (ACTIVE)' : 'OFF (DISABLED)'}
                                                </button>
                                            </div>

                                            {/* Placement Location Badge */}
                                            <div className="bg-slate-950/80 rounded-xl p-3 text-xs space-y-1.5 border border-slate-800 font-mono">
                                                <div className="flex justify-between text-slate-400">
                                                    <span>Parent Tab:</span>
                                                    <span className="text-amber-300 font-bold">{p.parentTabId}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-400">
                                                    <span>Sub-Tab:</span>
                                                    <span className="text-indigo-300 font-bold">{p.subTabId || 'None (Parent-Level)'}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-400">
                                                    <span>Display Mode:</span>
                                                    <span className="text-sky-300 font-bold uppercase">{p.launchDisplayMode || 'modal'}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-400">
                                                    <span>Order Weight:</span>
                                                    <span className="text-white font-bold">{p.displayOrder}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-400">
                                                    <span>Rollout:</span>
                                                    <span className="text-emerald-400 font-bold">{p.rolloutPercentage}%</span>
                                                </div>
                                                <div className="flex justify-between text-slate-400">
                                                    <span>Targeting Mode:</span>
                                                    <span className="text-sky-300 font-bold uppercase">{p.targetingMode}</span>
                                                </div>
                                            </div>

                                            {/* Country Allow/Exclude pills */}
                                            {((p.allowedCountries && p.allowedCountries.length > 0) || (p.excludedCountries && p.excludedCountries.length > 0)) && (
                                                <div className="text-[10px] space-y-1 bg-slate-950/40 p-2 rounded-xl border border-slate-800/80">
                                                    {p.allowedCountries && p.allowedCountries.length > 0 && (
                                                        <div className="text-emerald-400">
                                                            <strong>Allowed:</strong> {p.allowedCountries.join(', ')}
                                                        </div>
                                                    )}
                                                    {p.excludedCountries && p.excludedCountries.length > 0 && (
                                                        <div className="text-rose-400">
                                                            <strong>Excluded:</strong> {p.excludedCountries.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Operational Status Warning */}
                                            {p.placementEnabled && isProvDisabled && (
                                                <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-[11px] text-amber-300 font-bold">
                                                    ⚠️ Placement is ON, but underlying provider status is operationally OFF ({prov?.status || 'DISABLED'}). Placement will not display to workers.
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between gap-2">
                                            <button
                                                onClick={() => setEditingPlacement(p)}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
                                            >
                                                ⚙️ Configure
                                            </button>
                                            <button
                                                onClick={() => handleDeletePlacement(p)}
                                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 2: CREATE NEW PLACEMENT */}
            {viewMode === 'create' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-3xl mx-auto space-y-6">
                    <div className="border-b border-slate-800 pb-4">
                        <h3 className="text-lg font-black text-white">Create New Provider Placement</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Decoupled UI placement controls. Placements start OFF by default.
                        </p>
                    </div>

                    <form onSubmit={handleCreatePlacement} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Target Provider</label>
                                <select
                                    value={selectedProviderKey}
                                    onChange={(e) => handleSelectProvider(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    required
                                >
                                    {catalog.map(c => (
                                        <option key={c.providerKey} value={c.providerKey}>
                                            {c.name} ({c.group}) - [{c.enabled ? 'Prov ON' : 'Prov OFF'}]
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Parent Tab</label>
                                <select
                                    value={parentTabId}
                                    onChange={(e) => setParentTabId(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    required
                                >
                                    {availableMainTabs.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.title} ({t.id}) {t.enabled ? '🟢' : '🔴'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Sub-Tab Destination</label>
                                <select
                                    value={subTabId}
                                    onChange={(e) => setSubTabId(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                >
                                    {availableSubTabs.map(st => (
                                        <option key={st.id} value={st.id}>
                                            {st.name} {st.id ? `(${st.id})` : ''} {st.enabled ? '🟢' : '🔴'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">How should this provider open?</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setLaunchDisplayMode('inline')}
                                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                            launchDisplayMode === 'inline' 
                                                ? 'bg-amber-500 border-amber-400 text-slate-950' 
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Inline (Same Page)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLaunchDisplayMode('modal')}
                                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                            launchDisplayMode === 'modal' 
                                                ? 'bg-amber-500 border-amber-400 text-slate-950' 
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Modal (Overlay)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Display Title Override</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Badge Override</label>
                                <input
                                    type="text"
                                    value={badgeOverride}
                                    onChange={(e) => setBadgeOverride(e.target.value)}
                                    placeholder="e.g. Featured, High Yield, 2x Bonus"
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Order Weight (Ascending)</label>
                            <input
                                type="number"
                                value={displayOrder}
                                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Description Override</label>
                            <textarea
                                rows={2}
                                value={descriptionOverride}
                                onChange={(e) => setDescriptionOverride(e.target.value)}
                                placeholder="Custom worker-facing description for this placement..."
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-medium"
                            />
                        </div>

                        {/* Audience & Country Targeting */}
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                            <h4 className="text-xs font-black uppercase text-amber-300">Audience & Country Targeting</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">User Targeting Mode</label>
                                    <select
                                        value={targetingMode}
                                        onChange={(e) => setTargetingMode(e.target.value as any)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    >
                                        <option value="all">All Eligible Users</option>
                                        <option value="selected_users">Selected User IDs Only</option>
                                        <option value="test_users">Test Users Cohort Only</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Rollout Percentage (0% - 100%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={rolloutPercentage}
                                        onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold font-mono text-emerald-400"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                    <input type="checkbox" checked={offerwallVisibility} onChange={(e) => setOfferwallVisibility(e.target.checked)} className="rounded accent-amber-500" />
                                    Offerwall Visibility
                                </label>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                    <input type="checkbox" checked={availableTasksVisibility} onChange={(e) => setAvailableTasksVisibility(e.target.checked)} className="rounded accent-amber-500" />
                                    Available Tasks Visibility
                                </label>
                            </div>

                            {/* User Selection Dropdown when selected_users or test_users is active */}
                            {targetingMode !== 'all' && (
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                                        Select {targetingMode === 'selected_users' ? 'Specific Users' : 'Test Users'}
                                    </label>
                                    <select
                                        multiple
                                        value={targetingMode === 'selected_users' ? selectedUserIds : testUserIds}
                                        onChange={(e) => {
                                            const values = Array.from(e.target.selectedOptions, (opt: Element) => (opt as HTMLOptionElement).value);
                                            if (targetingMode === 'selected_users') setSelectedUserIds(values);
                                            else setTestUserIds(values);
                                        }}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold h-24"
                                    >
                                        {users.map(u => (
                                            <option key={u._id} value={u._id}>
                                                {u.username} ({u.email}) - [{u.country || 'No Country'}]
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">Hold Ctrl / Cmd to select multiple users.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Allowed Countries (Comma-separated)</label>
                                    <input
                                        type="text"
                                        value={allowedCountriesInput}
                                        onChange={(e) => setAllowedCountriesInput(e.target.value)}
                                        placeholder="e.g. PAKISTAN, UNITED STATES, GERMANY"
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Excluded Countries (Comma-separated)</label>
                                    <input
                                        type="text"
                                        value={excludedCountriesInput}
                                        onChange={(e) => setExcludedCountriesInput(e.target.value)}
                                        placeholder="e.g. INDIA, BRAZIL"
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setViewMode('placements')}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
                            >
                                {isSaving ? 'Creating Placement...' : 'Create Placement (Default OFF)'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* VIEW 3: AUDIT TRAIL */}
            {viewMode === 'audit' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
                    <h3 className="text-base font-black text-white">Placement Mutation Audit Trail</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-3">Timestamp</th>
                                    <th className="py-3 px-3">Admin</th>
                                    <th className="py-3 px-3">Action</th>
                                    <th className="py-3 px-3">Placement ID</th>
                                    <th className="py-3 px-3">Changes Summary</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {auditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-500 font-sans font-bold">
                                            No audit log records recorded yet.
                                        </td>
                                    </tr>
                                ) : auditLogs.map(l => (
                                    <tr key={l._id} className="hover:bg-slate-800/40">
                                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                                            {new Date(l.createdAt).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-white font-bold">{l.adminUsername}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                l.action === 'CREATED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                l.action === 'TOGGLED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                l.action === 'DELETED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            }`}>
                                                {l.action}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-slate-400 truncate max-w-[120px]">{l.placementId}</td>
                                        <td className="py-3 px-3 text-slate-300 font-sans truncate max-w-[280px]">
                                            {JSON.stringify(l.changes)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editingPlacement && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-black text-white">
                                Configure Placement: {editingPlacement.displayName}
                            </h3>
                            <button onClick={() => setEditingPlacement(null)} className="text-slate-400 hover:text-white font-black text-lg">✕</button>
                        </div>

                        <form onSubmit={handleSaveEditPlacement} className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
                                <div>
                                    <span className="text-xs font-black uppercase text-white">Enable Placement</span>
                                    <p className="text-[11px] text-slate-400">Make visible to eligible workers under {editingPlacement.parentTabId} {editingPlacement.subTabId ? `/ ${editingPlacement.subTabId}` : ''}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={editingPlacement.placementEnabled}
                                    onChange={(e) => setEditingPlacement({ ...editingPlacement, placementEnabled: e.target.checked })}
                                    className="w-5 h-5 rounded accent-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Sub-Tab Destination</label>
                                    <select
                                        value={editingPlacement.subTabId || ''}
                                        onChange={(e) => setEditingPlacement({ ...editingPlacement, subTabId: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    >
                                        {editAvailableSubTabs.map(st => (
                                            <option key={st.id} value={st.id}>
                                                {st.name} {st.id ? `(${st.id})` : ''} {st.enabled ? '🟢' : '🔴'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Display Mode</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditingPlacement({ ...editingPlacement, launchDisplayMode: 'inline' })}
                                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                                editingPlacement.launchDisplayMode === 'inline' 
                                                    ? 'bg-amber-500 border-amber-400 text-slate-950' 
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Inline
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingPlacement({ ...editingPlacement, launchDisplayMode: 'modal' })}
                                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                                editingPlacement.launchDisplayMode === 'modal' 
                                                    ? 'bg-amber-500 border-amber-400 text-slate-950' 
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Modal
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Display Title</label>
                                    <input
                                        type="text"
                                        value={editingPlacement.displayName}
                                        onChange={(e) => setEditingPlacement({ ...editingPlacement, displayName: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Badge Override</label>
                                    <input
                                        type="text"
                                        value={editingPlacement.badgeOverride || ''}
                                        onChange={(e) => setEditingPlacement({ ...editingPlacement, badgeOverride: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Order Weight</label>
                                    <input
                                        type="number"
                                        value={editingPlacement.displayOrder || 0}
                                        onChange={(e) => setEditingPlacement({ ...editingPlacement, displayOrder: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Rollout Percentage</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={editingPlacement.rolloutPercentage ?? 100}
                                        onChange={(e) => setEditingPlacement({ ...editingPlacement, rolloutPercentage: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold font-mono text-emerald-400"
                                    />
                                </div>
                            </div>

                            {/* Preview Eligibility Test Box */}
                            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                                <h4 className="text-xs font-black uppercase text-amber-300">Eligibility Preview Test (Zero Balance Mutation)</h4>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={previewUserId}
                                        onChange={(e) => setPreviewUserId(e.target.value)}
                                        className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs font-bold"
                                    >
                                        <option value="">-- Select Test User --</option>
                                        {users.map(u => (
                                            <option key={u._id} value={u._id}>
                                                {u.username} ({u.country || 'No Country'})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => handleRunPreview(editingPlacement._id)}
                                        disabled={isPreviewing}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
                                    >
                                        {isPreviewing ? 'Testing...' : 'Test User'}
                                    </button>
                                </div>

                                {previewResult && (
                                    <div className="bg-slate-900 rounded-xl p-3 text-xs font-mono border border-slate-800">
                                        <pre className="text-emerald-400 text-[11px]">{JSON.stringify(previewResult, null, 2)}</pre>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditingPlacement(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider"
                                >
                                    Save Config
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderPlacementManager;
