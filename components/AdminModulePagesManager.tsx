import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { updateSettings } from '../services/api';
import { ModulePageControlsConfig, ModulePageControl } from '../types';
import { getDefaultModulePagesConfig, defaultInvestmentPages, defaultWorkAndEarnPages } from '../data/modulePagesDefaults';

export const AdminModulePagesManager: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings } = state;

    const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'investment' | 'workAndEarn'>('investment');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled' | 'hidden'>('all');
    const [filterLocation, setFilterLocation] = useState<string>('all');
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingNoticePage, setEditingNoticePage] = useState<{ category: 'investment' | 'workAndEarn'; page: ModulePageControl } | null>(null);
    const [customNoticeDraft, setCustomNoticeDraft] = useState('');

    // Local configuration initialized from settings or default
    const [localConfig, setLocalConfig] = useState<ModulePageControlsConfig>(() => {
        const defaults = getDefaultModulePagesConfig();
        if (!settings?.modulePagesConfig) return defaults;
        
        // Merge with defaults to guarantee canonical names and menu locations
        const mergedInvestment: Record<string, ModulePageControl> = {};
        Object.keys(defaults.investment).forEach(key => {
            const def = defaults.investment[key];
            const saved = settings.modulePagesConfig?.investment?.[key];
            mergedInvestment[key] = {
                ...def,
                isEnabled: saved?.isEnabled !== undefined ? saved.isEnabled : def.isEnabled,
                isHiddenInNav: saved?.isHiddenInNav !== undefined ? saved.isHiddenInNav : def.isHiddenInNav,
                disabledNotice: saved?.disabledNotice || def.disabledNotice
            };
        });

        const mergedWorkAndEarn: Record<string, ModulePageControl> = {};
        Object.keys(defaults.workAndEarn).forEach(key => {
            const def = defaults.workAndEarn[key];
            const saved = settings.modulePagesConfig?.workAndEarn?.[key];
            mergedWorkAndEarn[key] = {
                ...def,
                isEnabled: saved?.isEnabled !== undefined ? saved.isEnabled : def.isEnabled,
                isHiddenInNav: saved?.isHiddenInNav !== undefined ? saved.isHiddenInNav : def.isHiddenInNav,
                disabledNotice: saved?.disabledNotice || def.disabledNotice
            };
        });

        return {
            investment: mergedInvestment,
            workAndEarn: mergedWorkAndEarn
        };
    });

    React.useEffect(() => {
        if (settings?.modulePagesConfig) {
            const defaults = getDefaultModulePagesConfig();
            const mergedInvestment: Record<string, ModulePageControl> = {};
            Object.keys(defaults.investment).forEach(key => {
                const def = defaults.investment[key];
                const saved = settings.modulePagesConfig?.investment?.[key];
                mergedInvestment[key] = {
                    ...def,
                    isEnabled: saved?.isEnabled !== undefined ? saved.isEnabled : def.isEnabled,
                    isHiddenInNav: saved?.isHiddenInNav !== undefined ? saved.isHiddenInNav : def.isHiddenInNav,
                    disabledNotice: saved?.disabledNotice || def.disabledNotice
                };
            });

            const mergedWorkAndEarn: Record<string, ModulePageControl> = {};
            Object.keys(defaults.workAndEarn).forEach(key => {
                const def = defaults.workAndEarn[key];
                const saved = settings.modulePagesConfig?.workAndEarn?.[key];
                mergedWorkAndEarn[key] = {
                    ...def,
                    isEnabled: saved?.isEnabled !== undefined ? saved.isEnabled : def.isEnabled,
                    isHiddenInNav: saved?.isHiddenInNav !== undefined ? saved.isHiddenInNav : def.isHiddenInNav,
                    disabledNotice: saved?.disabledNotice || def.disabledNotice
                };
            });

            setLocalConfig({
                investment: mergedInvestment,
                workAndEarn: mergedWorkAndEarn
            });
        }
    }, [settings?.modulePagesConfig]);

    const handleToggleEnable = (category: 'investment' | 'workAndEarn', pageId: string) => {
        setLocalConfig(prev => {
            const current = prev[category]?.[pageId] || (category === 'investment' ? defaultInvestmentPages[pageId] : defaultWorkAndEarnPages[pageId]);
            return {
                ...prev,
                [category]: {
                    ...prev[category],
                    [pageId]: {
                        ...current,
                        isEnabled: !current.isEnabled
                    }
                }
            };
        });
    };

    const handleToggleNavVisibility = (category: 'investment' | 'workAndEarn', pageId: string) => {
        setLocalConfig(prev => {
            const current = prev[category]?.[pageId] || (category === 'investment' ? defaultInvestmentPages[pageId] : defaultWorkAndEarnPages[pageId]);
            return {
                ...prev,
                [category]: {
                    ...prev[category],
                    [pageId]: {
                        ...current,
                        isHiddenInNav: !current.isHiddenInNav
                    }
                }
            };
        });
    };

    const handleOpenNoticeEditor = (category: 'investment' | 'workAndEarn', page: ModulePageControl) => {
        const current = localConfig[category]?.[page.id] || page;
        setEditingNoticePage({ category, page: current });
        setCustomNoticeDraft(current.disabledNotice || '');
    };

    const handleSaveNotice = () => {
        if (!editingNoticePage) return;
        const { category, page } = editingNoticePage;
        setLocalConfig(prev => {
            const current = prev[category]?.[page.id] || page;
            return {
                ...prev,
                [category]: {
                    ...prev[category],
                    [page.id]: {
                        ...current,
                        disabledNotice: customNoticeDraft
                    }
                }
            };
        });
        setEditingNoticePage(null);
    };

    const handleBulkEnable = (category?: 'investment' | 'workAndEarn') => {
        setLocalConfig(prev => {
            const updated = { ...prev };
            const targets: ('investment' | 'workAndEarn')[] = category ? [category] : ['investment', 'workAndEarn'];
            targets.forEach(cat => {
                const map = { ...updated[cat] };
                Object.keys(map).forEach(key => {
                    map[key] = { ...map[key], isEnabled: true };
                });
                updated[cat] = map;
            });
            return updated;
        });
        setFeedbackMsg({ type: 'success', text: `All ${category ? (category === 'investment' ? 'Investment' : 'Work & Earn') : ''} pages have been enabled.` });
        setTimeout(() => setFeedbackMsg(null), 3500);
    };

    const handleBulkDisable = (category?: 'investment' | 'workAndEarn') => {
        setLocalConfig(prev => {
            const updated = { ...prev };
            const targets: ('investment' | 'workAndEarn')[] = category ? [category] : ['investment', 'workAndEarn'];
            targets.forEach(cat => {
                const map = { ...updated[cat] };
                Object.keys(map).forEach(key => {
                    // Keep dashboard active to prevent lockout
                    if (key !== 'dashboard') {
                        map[key] = { ...map[key], isEnabled: false };
                    }
                });
                updated[cat] = map;
            });
            return updated;
        });
        setFeedbackMsg({ type: 'success', text: `All secondary ${category ? (category === 'investment' ? 'Investment' : 'Work & Earn') : ''} pages have been disabled.` });
        setTimeout(() => setFeedbackMsg(null), 3500);
    };

    const handleBulkShowNav = (category?: 'investment' | 'workAndEarn') => {
        setLocalConfig(prev => {
            const updated = { ...prev };
            const targets: ('investment' | 'workAndEarn')[] = category ? [category] : ['investment', 'workAndEarn'];
            targets.forEach(cat => {
                const map = { ...updated[cat] };
                Object.keys(map).forEach(key => {
                    map[key] = { ...map[key], isHiddenInNav: false };
                });
                updated[cat] = map;
            });
            return updated;
        });
        setFeedbackMsg({ type: 'success', text: `All pages are now unhidden and visible in navigation menus.` });
        setTimeout(() => setFeedbackMsg(null), 3500);
    };

    const handleResetDefaults = () => {
        if (window.confirm('Reset all page visibility and enablement settings back to exact user site menu defaults?')) {
            const def = getDefaultModulePagesConfig();
            setLocalConfig(def);
            setFeedbackMsg({ type: 'success', text: 'Reset page controls to site defaults.' });
            setTimeout(() => setFeedbackMsg(null), 3500);
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setFeedbackMsg(null);
        try {
            const updatedSettings = {
                ...settings,
                modulePagesConfig: localConfig
            };
            const result = await updateSettings(updatedSettings);
            dispatch({ type: 'SET_SETTINGS', payload: result });
            setFeedbackMsg({ type: 'success', text: 'Page permissions and menu visibility saved! User dashboard and navigation menus updated live.' });
            setTimeout(() => setFeedbackMsg(null), 4000);
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save page controls.' });
        } finally {
            setIsSaving(false);
        }
    };

    // Flatten all pages for filtering
    const allPagesList = useMemo(() => {
        const list: { category: 'investment' | 'workAndEarn'; page: ModulePageControl }[] = [];
        
        if (activeCategoryTab === 'all' || activeCategoryTab === 'investment') {
            (Object.values(localConfig.investment || {}) as ModulePageControl[]).forEach(page => {
                list.push({ category: 'investment', page });
            });
        }
        if (activeCategoryTab === 'all' || activeCategoryTab === 'workAndEarn') {
            (Object.values(localConfig.workAndEarn || {}) as ModulePageControl[]).forEach(page => {
                list.push({ category: 'workAndEarn', page });
            });
        }

        return list.filter(({ page }) => {
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesName = page.name?.toLowerCase().includes(q);
                const matchesRoute = page.route?.toLowerCase().includes(q);
                const matchesId = page.id?.toLowerCase().includes(q);
                const matchesLocation = page.menuLocation?.toLowerCase().includes(q);
                if (!matchesName && !matchesRoute && !matchesId && !matchesLocation) return false;
            }

            // Location filter
            if (filterLocation !== 'all') {
                if (filterLocation === 'main' && page.menuLocation !== 'Main Navigation') return false;
                if (filterLocation === 'tasksDropdown' && !page.menuLocation?.includes('My Tasks')) return false;
                if (filterLocation === 'campaignDropdown' && !page.menuLocation?.includes('My Campaigns')) return false;
            }

            // Status filter
            if (filterStatus === 'enabled' && !page.isEnabled) return false;
            if (filterStatus === 'disabled' && page.isEnabled) return false;
            if (filterStatus === 'hidden' && !page.isHiddenInNav) return false;

            return true;
        });
    }, [localConfig, activeCategoryTab, searchQuery, filterStatus, filterLocation]);

    // Summary counts
    const counts = useMemo(() => {
        let total = 0;
        let enabled = 0;
        let disabled = 0;
        let hidden = 0;

        const check = (map: Record<string, ModulePageControl>) => {
            Object.values(map || {}).forEach(p => {
                total++;
                if (p.isEnabled) enabled++;
                else disabled++;
                if (p.isHiddenInNav) hidden++;
            });
        };

        if (activeCategoryTab === 'all') {
            check(localConfig.investment);
            check(localConfig.workAndEarn);
        } else if (activeCategoryTab === 'investment') {
            check(localConfig.investment);
        } else {
            check(localConfig.workAndEarn);
        }

        return { total, enabled, disabled, hidden };
    }, [localConfig, activeCategoryTab]);

    return (
        <div className="space-y-6">
            {/* Header Title Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black uppercase tracking-wider border border-blue-500/20 mb-2">
                        🛡️ Modular Site & Menu Controls
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        User Menu & Dashboard Pages Manager
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                        Enable, disable, or hide specific pages as named in the user dashboard and site menu across the <strong>Investment Module</strong> and <strong>Work & Earn Module</strong>.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-all"
                    >
                        🔄 Reset Defaults
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : '💾 Save Page Controls'}
                    </button>
                </div>
            </div>

            {/* Notification Feedback Toast */}
            {feedbackMsg && (
                <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between border ${
                    feedbackMsg.type === 'success'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                }`}>
                    <div className="flex items-center gap-2">
                        <span>{feedbackMsg.type === 'success' ? '✅' : '❌'}</span>
                        <span>{feedbackMsg.text}</span>
                    </div>
                    <button onClick={() => setFeedbackMsg(null)} className="font-black hover:text-white">✕</button>
                </div>
            )}

            {/* Category Tabs & Quick Stats */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Module Selector Pill Tabs */}
                <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveCategoryTab('investment')}
                        className={`px-4 py-2 rounded-xl text-xs font-black tracking-tight transition-all flex items-center gap-2 ${
                            activeCategoryTab === 'investment'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <span>📈</span>
                        <span>Investment Module ({Object.keys(localConfig.investment || {}).length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCategoryTab('workAndEarn')}
                        className={`px-4 py-2 rounded-xl text-xs font-black tracking-tight transition-all flex items-center gap-2 ${
                            activeCategoryTab === 'workAndEarn'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <span>⚡</span>
                        <span>Work & Earn Module ({Object.keys(localConfig.workAndEarn || {}).length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCategoryTab('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-black tracking-tight transition-all flex items-center gap-2 ${
                            activeCategoryTab === 'all'
                                ? 'bg-slate-700 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <span>🌐</span>
                        <span>All Pages ({Object.keys(localConfig.investment || {}).length + Object.keys(localConfig.workAndEarn || {}).length})</span>
                    </button>
                </div>

                {/* Stat Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                        Total Pages: <span className="text-white font-black">{counts.total}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                        Active: <span className="text-emerald-300 font-black">{counts.enabled}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                        Disabled: <span className="text-rose-300 font-black">{counts.disabled}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                        Hidden in Menu: <span className="text-amber-300 font-black">{counts.hidden}</span>
                    </div>
                </div>
            </div>

            {/* Filter Bar & Bulk Actions */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by user page name, route path, or menu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <select
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        className="px-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Menu Locations</option>
                        <option value="main">Main Navigation Only</option>
                        <option value="tasksDropdown">Submenu: My Tasks & Gigs</option>
                        <option value="campaignDropdown">Submenu: My Campaigns</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="enabled">Active / Enabled Only</option>
                        <option value="disabled">Disabled Only</option>
                        <option value="hidden">Hidden in Nav Only</option>
                    </select>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center gap-2 overflow-x-auto shrink-0">
                    <button
                        type="button"
                        onClick={() => handleBulkEnable(activeCategoryTab === 'all' ? undefined : activeCategoryTab)}
                        className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold whitespace-nowrap"
                        title="Enable all pages in view"
                    >
                        ✓ Enable All
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBulkDisable(activeCategoryTab === 'all' ? undefined : activeCategoryTab)}
                        className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold whitespace-nowrap"
                        title="Disable non-essential pages in view"
                    >
                        ✕ Disable Secondary
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBulkShowNav(activeCategoryTab === 'all' ? undefined : activeCategoryTab)}
                        className="px-3 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-bold whitespace-nowrap"
                        title="Show all pages in sidebar menus"
                    >
                        👁️ Show All in Nav
                    </button>
                </div>
            </div>

            {/* Pages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {allPagesList.map(({ category, page }) => {
                    const isEnabled = page.isEnabled !== false;
                    const isHidden = page.isHiddenInNav === true;

                    return (
                        <div
                            key={`${category}-${page.id}`}
                            className={`rounded-3xl border transition-all duration-200 flex flex-col justify-between p-5 ${
                                !isEnabled
                                    ? 'bg-rose-950/15 border-rose-900/50 shadow-inner'
                                    : isHidden
                                    ? 'bg-slate-900/70 border-amber-900/40'
                                    : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700 shadow-md'
                            }`}
                        >
                            {/* Card Top */}
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                                            !isEnabled
                                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                : category === 'investment'
                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        }`}>
                                            {page.icon || (category === 'investment' ? '📈' : '⚡')}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                                    category === 'investment'
                                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                }`}>
                                                    {category === 'investment' ? 'Investment' : 'Work & Earn'}
                                                </span>
                                                {page.menuLocation && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                                        📍 {page.menuLocation}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-base font-black text-white tracking-tight">
                                                {page.name}
                                            </h3>
                                            <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                                                URL: #{page.route}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                                    <span className="text-slate-500 font-semibold">Disabled Notice: </span>
                                    {page.disabledNotice || 'This page is temporarily unavailable.'}
                                </p>
                            </div>

                            {/* Card Bottom Controls */}
                            <div className="space-y-3 pt-3 border-t border-slate-800/80">
                                {/* Toggle 1: Page Enabled / Disabled */}
                                <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-950/40 border border-slate-800/50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-300">Access Status</span>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            isEnabled
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        }`}>
                                            {isEnabled ? '● Active' : '✕ Disabled'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleEnable(category, page.id)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                isEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Toggle 2: Navigation Menu Visibility */}
                                <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-950/40 border border-slate-800/50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-300">Site Sidebar Link</span>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            !isHidden
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        }`}>
                                            {!isHidden ? '👁️ Visible' : '🙈 Hidden'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleNavVisibility(category, page.id)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            !isHidden ? 'bg-blue-600' : 'bg-slate-700'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                !isHidden ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Edit Custom Notice Action Button & Direct Preview */}
                                <div className="flex items-center justify-between pt-1">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenNoticeEditor(category, page)}
                                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                                    >
                                        <span>✏️ Custom Disabled Notice</span>
                                    </button>

                                    <a
                                        href={`#${page.route}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        <span>↗ View Page</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {allPagesList.length === 0 && (
                <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 p-8">
                    <p className="text-3xl mb-2">🔍</p>
                    <h3 className="text-base font-bold text-white mb-1">No user dashboard pages found</h3>
                    <p className="text-xs text-slate-400">Try adjusting your search keywords or filter dropdown.</p>
                </div>
            )}

            {/* Custom Notice Modal */}
            {editingNoticePage && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                                    <span>{editingNoticePage.page.icon || '✏️'}</span>
                                    <span>{editingNoticePage.page.name}</span>
                                </h3>
                                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                    Route: #{editingNoticePage.page.route} • {editingNoticePage.page.menuLocation}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingNoticePage(null)}
                                className="text-slate-400 hover:text-white font-black text-sm p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-400">
                            Specify the notice message displayed to members if they try to access <strong>{editingNoticePage.page.name}</strong> while it is disabled.
                        </p>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5">Disabled Page Notice Message</label>
                            <textarea
                                rows={4}
                                value={customNoticeDraft}
                                onChange={(e) => setCustomNoticeDraft(e.target.value)}
                                placeholder="Enter custom message shown when page is disabled..."
                                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditingNoticePage(null)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNotice}
                                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-500/25"
                            >
                                Apply Notice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
