import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkAndEarnModuleConfig, WorkAndEarnPageEditableConfig } from '../../types/workAndEarnEditor';
import { getWorkAndEarnConfig, saveWorkAndEarnConfig, resetWorkAndEarnConfig } from '../../services/workAndEarnConfigService';

type SubmenuKey = keyof WorkAndEarnModuleConfig['submenus'];

export const AdminWorkAndEarnEditor: React.FC = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<WorkAndEarnModuleConfig>(getWorkAndEarnConfig());
    const [selectedTab, setSelectedTab] = useState<SubmenuKey>('myCampaigns');
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    useEffect(() => {
        setConfig(getWorkAndEarnConfig());
    }, []);

    const currentPageConfig = config.submenus[selectedTab];

    const handleModuleFieldChange = (field: keyof WorkAndEarnModuleConfig, value: string) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handlePageFieldChange = (field: keyof WorkAndEarnPageEditableConfig, value: any) => {
        setConfig(prev => ({
            ...prev,
            submenus: {
                ...prev.submenus,
                [selectedTab]: {
                    ...prev.submenus[selectedTab],
                    [field]: value
                }
            }
        }));
    };

    const handleColumnVisibilityToggle = (colKey: string) => {
        const currentVis = currentPageConfig.visibleColumns || {};
        const updated = {
            ...currentVis,
            [colKey]: !currentVis[colKey]
        };
        handlePageFieldChange('visibleColumns', updated);
    };

    const handleSave = () => {
        saveWorkAndEarnConfig(config);
        setSaveSuccess('Work & Earn module customization saved successfully! All user pages have been updated live.');
        setTimeout(() => setSaveSuccess(null), 4000);
    };

    const handleReset = () => {
        if (window.confirm('Are you sure you want to reset all Work & Earn pages and menus to default settings?')) {
            const defaultConfig = resetWorkAndEarnConfig();
            setConfig(defaultConfig);
            setSaveSuccess('Restored default Work & Earn configuration.');
            setTimeout(() => setSaveSuccess(null), 4000);
        }
    };

    const submenuList: { key: SubmenuKey; label: string; icon: string }[] = [
        { key: 'dashboard', label: 'Main Dashboard', icon: '📊' },
        { key: 'availableTasks', label: 'Available Micro-Tasks', icon: '💼' },
        { key: 'myCampaigns', label: 'My Created Campaigns', icon: '📂' },
        { key: 'createCampaign', label: 'Create New Campaign', icon: '➕' },
        { key: 'reviewProofs', label: 'Review Worker Proofs', icon: '🔍' },
        { key: 'pendingReviews', label: 'Pending Review Tasks', icon: '⏳' },
        { key: 'tasksHistory', label: 'Tasks History', icon: '📜' },
        { key: 'earnHistory', label: 'Earn Activity Ledger', icon: '💳' },
        { key: 'disputes', label: 'Disputes & Support', icon: '🛡️' },
    ];

    return (
        <div className="p-4 sm:p-8 space-y-8 bg-slate-900 min-h-screen text-slate-100 font-sans">
            {/* Top Admin Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/90 p-6 rounded-3xl border border-slate-700 shadow-xl backdrop-blur-md">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-wider border border-indigo-500/30">
                        ⚡ Admin Page & Content Customizer
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2">
                        Work & Earn Page Editor
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Fully customize menus, pages, headings, tabs, buttons, popups, comment boxes, rows, columns, and design styles for all Work & Earn pages.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => navigate('/admin/settings')}
                        className="px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs transition-all flex items-center gap-2"
                        title="Manage enable/disable & hide/unhide toggles for pages"
                    >
                        🔒 Page Visibility & Access Controls
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-all flex items-center gap-2"
                    >
                        🔄 Reset Defaults
                    </button>
                    <button
                        onClick={() => setShowPreviewModal(true)}
                        className="px-4 py-2.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold text-xs transition-all flex items-center gap-2"
                    >
                        👁️ Live Page Preview
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95"
                    >
                        💾 Save & Apply Changes
                    </button>
                </div>
            </div>

            {/* Notification Toast */}
            {saveSuccess && (
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span>{saveSuccess}</span>
                    </div>
                    <button onClick={() => setSaveSuccess(null)} className="text-emerald-400 hover:text-white font-black">✕</button>
                </div>
            )}

            {/* Module Global Settings */}
            <div className="bg-slate-800/60 p-6 rounded-3xl border border-slate-700 space-y-4">
                <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    📁 Global Module Navigation & Header Settings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Module Name</label>
                        <input
                            type="text"
                            value={config.moduleName}
                            onChange={(e) => handleModuleFieldChange('moduleName', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Sidebar Menu Title</label>
                        <input
                            type="text"
                            value={config.menuTitle}
                            onChange={(e) => handleModuleFieldChange('menuTitle', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Module Global Description</label>
                        <input
                            type="text"
                            value={config.moduleDescription}
                            onChange={(e) => handleModuleFieldChange('moduleDescription', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* Page / Submenu Selection Tabs */}
            <div className="space-y-3">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                    Select Work & Earn Page to Edit:
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {submenuList.map(item => {
                        const isActive = selectedTab === item.key;
                        return (
                            <button
                                key={item.key}
                                onClick={() => setSelectedTab(item.key)}
                                className={`px-4 py-3 rounded-2xl font-black text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/40'
                                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700'
                                }`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Editor Grid for Selected Page */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1 & 2: Main Editable Controls */}
                <div className="lg:col-span-2 space-y-6 bg-slate-800/80 p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                Editing Page Configuration
                            </span>
                            <h2 className="text-xl font-black text-white">
                                {currentPageConfig.pageTitle || 'Work & Earn Page'}
                            </h2>
                        </div>
                        <span className="text-2xl">
                            {submenuList.find(s => s.key === selectedTab)?.icon}
                        </span>
                    </div>

                    {/* Section 1: Page Titles, Navigation & Headings */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                            🏷️ Titles, Headings & Descriptions
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Page Main Title</label>
                                <input
                                    type="text"
                                    value={currentPageConfig.pageTitle}
                                    onChange={(e) => handlePageFieldChange('pageTitle', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Tab Name / Menu Label</label>
                                <input
                                    type="text"
                                    value={currentPageConfig.tabName}
                                    onChange={(e) => handlePageFieldChange('tabName', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Page Subtitle / Tagline</label>
                            <input
                                type="text"
                                value={currentPageConfig.pageSubtitle}
                                onChange={(e) => handlePageFieldChange('pageSubtitle', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Section Heading</label>
                                <input
                                    type="text"
                                    value={currentPageConfig.heading}
                                    onChange={(e) => handlePageFieldChange('heading', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Primary Action Button Text</label>
                                <input
                                    type="text"
                                    value={currentPageConfig.buttonText}
                                    onChange={(e) => handlePageFieldChange('buttonText', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Section Description</label>
                            <textarea
                                rows={2}
                                value={currentPageConfig.description}
                                onChange={(e) => handlePageFieldChange('description', e.target.value)}
                                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Section 2: Pop-ups, Modals & Detail Views */}
                    <div className="space-y-4 pt-4 border-t border-slate-700">
                        <h3 className="text-xs font-black uppercase text-teal-400 tracking-wider flex items-center gap-2">
                            💬 Pop-up, Modals & Detail Information
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Pop-up Show Title</label>
                                <input
                                    type="text"
                                    value={currentPageConfig.popupTitle}
                                    onChange={(e) => handlePageFieldChange('popupTitle', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Comment Box Placeholder</label>
                                <input
                                    type="text"
                                    value={currentPageConfig.commentBoxPlaceholder}
                                    onChange={(e) => handlePageFieldChange('commentBoxPlaceholder', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Pop-up Description / Action Prompt</label>
                            <input
                                type="text"
                                value={currentPageConfig.popupDescription}
                                onChange={(e) => handlePageFieldChange('popupDescription', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Detail View Information (Shown after clicking button)</label>
                            <textarea
                                rows={2}
                                value={currentPageConfig.detailsMessage}
                                onChange={(e) => handlePageFieldChange('detailsMessage', e.target.value)}
                                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Section 3: Design, Colors & Layout Grid */}
                    <div className="space-y-4 pt-4 border-t border-slate-700">
                        <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-2">
                            🎨 Design, Styling, Rows & Columns
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Primary Theme Color</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={currentPageConfig.primaryColor}
                                        onChange={(e) => handlePageFieldChange('primaryColor', e.target.value)}
                                        className="w-9 h-9 rounded-xl cursor-pointer bg-slate-900 border border-slate-700"
                                    />
                                    <input
                                        type="text"
                                        value={currentPageConfig.primaryColor}
                                        onChange={(e) => handlePageFieldChange('primaryColor', e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Card Border Rounding</label>
                                <select
                                    value={currentPageConfig.cardStyle}
                                    onChange={(e) => handlePageFieldChange('cardStyle', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                                >
                                    <option value="rounded-xl">Standard (rounded-xl)</option>
                                    <option value="rounded-2xl">Extra Soft (rounded-2xl)</option>
                                    <option value="rounded-3xl">Pill Soft (rounded-3xl)</option>
                                    <option value="rounded-none">Sharp Corners (rounded-none)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">Desktop Grid Columns</label>
                                <select
                                    value={currentPageConfig.layoutColumns}
                                    onChange={(e) => handlePageFieldChange('layoutColumns', Number(e.target.value))}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                                >
                                    <option value={1}>1 Column (Full Width)</option>
                                    <option value={2}>2 Columns</option>
                                    <option value={3}>3 Columns (Standard Grid)</option>
                                    <option value={4}>4 Columns (Dense Grid)</option>
                                    <option value={6}>6 Columns (Ultra Dense)</option>
                                </select>
                            </div>
                        </div>

                        {/* Notice Banner Toggle & Text */}
                        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/80 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                                    📢 Display Top Notice Banner
                                </span>
                                <input
                                    type="checkbox"
                                    checked={currentPageConfig.showNoticeBanner}
                                    onChange={(e) => handlePageFieldChange('showNoticeBanner', e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                            </div>
                            {currentPageConfig.showNoticeBanner && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Banner Notice Text</label>
                                    <input
                                        type="text"
                                        value={currentPageConfig.noticeBannerText}
                                        onChange={(e) => handlePageFieldChange('noticeBannerText', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-amber-300"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Visible Columns / Fields Toggles */}
                        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/80 space-y-2">
                            <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider block mb-1">
                                👁️ Table & Grid Column Visibility Options
                            </span>
                            <div className="flex flex-wrap gap-3">
                                {Object.keys(currentPageConfig.visibleColumns || {}).map(colKey => {
                                    const isVisible = currentPageConfig.visibleColumns[colKey];
                                    return (
                                        <button
                                            key={colKey}
                                            onClick={() => handleColumnVisibilityToggle(colKey)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                isVisible
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                    : 'bg-slate-800 text-slate-500 border-slate-700'
                                            }`}
                                        >
                                            {isVisible ? '✓' : '✕'} {colKey}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Section 4: Purpose-Based Financial History Controls (Dashboard Page) */}
                        {selectedTab === 'dashboard' && (
                            <div className="bg-slate-900/80 p-5 rounded-2xl border border-indigo-500/30 space-y-4 shadow-inner">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">💳</span>
                                            <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                                                Financial History by Purpose Feature Control
                                            </h4>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            Enable or disable the purpose-based transaction audit ledger for members on their Work & Earn Dashboard, and configure pagination options.
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border self-start sm:self-auto ${
                                        currentPageConfig.showPurposeFinancialHistory !== false
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    }`}>
                                        {currentPageConfig.showPurposeFinancialHistory !== false ? '🟢 Visible to Users' : '🔴 Disabled / Hidden'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-200">
                                                Enable Financial History by Purpose
                                            </label>
                                            <span className="text-[10px] text-slate-500">
                                                Show/hide the ledger table on user dashboard
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={currentPageConfig.showPurposeFinancialHistory !== false}
                                            onChange={(e) => handlePageFieldChange('showPurposeFinancialHistory', e.target.checked)}
                                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </div>

                                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                                        <label className="block text-xs font-bold text-slate-200 mb-1">
                                            Default Records Per Page (Pagination)
                                        </label>
                                        <select
                                            value={currentPageConfig.purposeHistoryDefaultPerPage || 10}
                                            onChange={(e) => handlePageFieldChange('purposeHistoryDefaultPerPage', Number(e.target.value))}
                                            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value={10}>10 Records per page</option>
                                            <option value={15}>15 Records per page</option>
                                            <option value={20}>20 Records per page</option>
                                            <option value={25}>25 Records per page</option>
                                            <option value={30}>30 Records per page</option>
                                            <option value={50}>50 Records per page</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                            Ledger Section Heading
                                        </label>
                                        <input
                                            type="text"
                                            value={currentPageConfig.purposeHistoryHeading || 'Financial History by Purpose'}
                                            onChange={(e) => handlePageFieldChange('purposeHistoryHeading', e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                            Ledger Subtitle / Description
                                        </label>
                                        <input
                                            type="text"
                                            value={currentPageConfig.purposeHistoryDescription || 'Comprehensive audit trail categorized by worker rewards, conversions, campaign fund transfers, and expenditures.'}
                                            onChange={(e) => handlePageFieldChange('purposeHistoryDescription', e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 3: Live Real-time Visual Preview Card */}
                <div className="space-y-4">
                    <div className="bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-xl sticky top-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                            <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                                Live Page Preview
                            </span>
                            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full">
                                Real-time Rendering
                            </span>
                        </div>

                        {/* Interactive Preview Canvas */}
                        <div className="mt-4 p-5 bg-slate-900 rounded-2xl border border-slate-700/80 space-y-4">
                            {/* Notice Banner Preview */}
                            {currentPageConfig.showNoticeBanner && currentPageConfig.noticeBannerText && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] font-medium flex items-center gap-2">
                                    <span>📢</span>
                                    <span>{currentPageConfig.noticeBannerText}</span>
                                </div>
                            )}

                            {/* Header Preview */}
                            <div className="space-y-1">
                                <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase text-white" style={{ backgroundColor: currentPageConfig.primaryColor }}>
                                    {currentPageConfig.tabName}
                                </div>
                                <h3 className="text-lg font-black text-white">
                                    {currentPageConfig.pageTitle}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {currentPageConfig.pageSubtitle}
                                </p>
                            </div>

                            {/* Section Heading & Description */}
                            <div className={`p-4 bg-slate-800/90 border border-slate-700 ${currentPageConfig.cardStyle} space-y-2`}>
                                <h4 className="text-sm font-bold text-white">
                                    {currentPageConfig.heading}
                                </h4>
                                <p className="text-xs text-slate-300">
                                    {currentPageConfig.description}
                                </p>

                                <button
                                    className="w-full py-2.5 rounded-xl font-bold text-xs text-white uppercase tracking-wider transition-all mt-2 shadow-md"
                                    style={{ backgroundColor: currentPageConfig.primaryColor }}
                                >
                                    {currentPageConfig.buttonText}
                                </button>
                            </div>

                            {/* Pop-up / Comment Box Preview */}
                            <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-2">
                                <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider block">
                                    💬 Pop-up & Comment Box
                                </span>
                                <div className="text-xs font-bold text-white">
                                    {currentPageConfig.popupTitle}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    {currentPageConfig.popupDescription}
                                </div>
                                <input
                                    type="text"
                                    disabled
                                    placeholder={currentPageConfig.commentBoxPlaceholder}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-400 opacity-80 cursor-not-allowed"
                                />
                            </div>

                            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 text-[11px] text-slate-400">
                                <span className="font-bold text-indigo-300 block mb-1">Detail View Message:</span>
                                {currentPageConfig.detailsMessage}
                            </div>

                            {/* Dashboard Purpose Financial History Preview */}
                            {selectedTab === 'dashboard' && (
                                <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-indigo-400">
                                            {currentPageConfig.purposeHistoryHeading || 'Financial History by Purpose'}
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                            currentPageConfig.showPurposeFinancialHistory !== false
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-rose-500/20 text-rose-400'
                                        }`}>
                                            {currentPageConfig.showPurposeFinancialHistory !== false ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 line-clamp-1">
                                        {currentPageConfig.purposeHistoryDescription || 'Comprehensive audit trail categorized by worker rewards...'}
                                    </p>
                                    <div className="text-[9px] text-slate-500 font-mono">
                                        Pagination: {currentPageConfig.purposeHistoryDefaultPerPage || 10} records/page [10, 15, 20, 25, 30, 50]
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Dialog for Full-screen Page Preview */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                            <h3 className="text-lg font-black text-white">
                                Full Screen Preview: {currentPageConfig.pageTitle}
                            </h3>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="text-slate-400 hover:text-white font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-3 py-1 rounded-full text-white font-bold" style={{ backgroundColor: currentPageConfig.primaryColor }}>
                                    {currentPageConfig.tabName}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                    Grid Columns: {currentPageConfig.layoutColumns}
                                </span>
                            </div>

                            <h1 className="text-2xl font-black text-white">
                                {currentPageConfig.pageTitle}
                            </h1>
                            <p className="text-xs text-slate-300">
                                {currentPageConfig.pageSubtitle}
                            </p>

                            <div className={`p-5 bg-slate-900 border border-slate-700 ${currentPageConfig.cardStyle} space-y-3`}>
                                <h2 className="text-lg font-bold text-white">{currentPageConfig.heading}</h2>
                                <p className="text-xs text-slate-300">{currentPageConfig.description}</p>
                                <button className="px-5 py-2.5 rounded-xl font-bold text-xs text-white uppercase tracking-wider" style={{ backgroundColor: currentPageConfig.primaryColor }}>
                                    {currentPageConfig.buttonText}
                                </button>
                            </div>

                            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <h4 className="text-xs font-bold text-teal-400 uppercase">{currentPageConfig.popupTitle}</h4>
                                <p className="text-xs text-slate-300">{currentPageConfig.popupDescription}</p>
                                <textarea
                                    disabled
                                    rows={2}
                                    placeholder={currentPageConfig.commentBoxPlaceholder}
                                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-400 opacity-80"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminWorkAndEarnEditor;
