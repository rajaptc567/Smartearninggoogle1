import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { updateSettings } from '../services/api';

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void; label?: string }> = ({ enabled, onChange, label }) => {
    return (
        <div className="flex items-center gap-2">
            {label && <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{label}</span>}
            <button
                type="button"
                onClick={onChange}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
};

const DEFAULT_PRESETS = {
    youtube: {
        enabled: true,
        displayName: "YouTube",
        subscriber: { minPayout: 0.02, minSlots: 50, enabled: true, displayName: "Subscriber" },
        comments: { minPayout: 0.04, minSlots: 10, enabled: true, displayName: "Comments" },
        likes: { minPayout: 0.01, minSlots: 10, enabled: true, displayName: "Likes" },
        watchTimeTiers: [
            { duration: '5 Seconds', minPayout: 0.005, minSlots: 100, enabled: true },
            { duration: '10 Seconds', minPayout: 0.010, minSlots: 100, enabled: true },
            { duration: '15 Seconds', minPayout: 0.015, minSlots: 50, enabled: true },
            { duration: '30 Seconds', minPayout: 0.025, minSlots: 50, enabled: true },
            { duration: '1 Minute', minPayout: 0.050, minSlots: 20, enabled: true },
            { duration: '5 Minutes', minPayout: 0.150, minSlots: 10, enabled: true }
        ]
    },
    facebook: {
        enabled: true,
        displayName: "Facebook",
        likeFollow: { minPayout: 0.02, minSlots: 50, enabled: true, displayName: "Page Like & Follow" },
        videoLike: { minPayout: 0.01, minSlots: 50, enabled: true, displayName: "Video Like" },
        comments: { minPayout: 0.03, minSlots: 10, enabled: true, displayName: "Post Comment" },
        watchTimeTiers: [
            { duration: '30 Seconds', minPayout: 0.015, minSlots: 50, enabled: true },
            { duration: '1 Minute', minPayout: 0.030, minSlots: 30, enabled: true },
            { duration: '3 Minutes', minPayout: 0.080, minSlots: 20, enabled: true }
        ]
    },
    instagram: {
        enabled: true,
        displayName: "Instagram",
        profileFollow: { minPayout: 0.015, minSlots: 50, enabled: true, displayName: "Profile Follow" },
        postLike: { minPayout: 0.008, minSlots: 100, enabled: true, displayName: "Post/Reel Like" },
        reelView: { minPayout: 0.005, minSlots: 100, enabled: true, displayName: "Reel View" },
        comments: { minPayout: 0.03, minSlots: 10, enabled: true, displayName: "Custom Comments" }
    },
    google: {
        enabled: true,
        displayName: "Google Reviews",
        reviews: { minPayout: 0.20, minSlots: 5, enabled: true, displayName: "Review & Maps" }
    },
    paidSignUp: {
        enabled: true,
        displayName: "Paid Sign-Ups",
        simpleSignUp: { minPayout: 0.10, minSlots: 10, enabled: true, displayName: "Simple Sign-up" },
        activePlanPurchase: { minPayout: 0.50, minSlots: 5, enabled: true, displayName: "Plan Purchase Sign-up" }
    }
};

const AdminTaskCategories: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings } = state;

    const [activeTab, setActiveTab] = useState<string>('youtube');
    const [presets, setPresets] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (settings && settings.taskCategoryPresets) {
            // Deep copy to prevent mutating state directly
            setPresets(JSON.parse(JSON.stringify(settings.taskCategoryPresets)));
        } else {
            setPresets(JSON.parse(JSON.stringify(DEFAULT_PRESETS)));
        }
    }, [settings]);

    if (!presets) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Handlers
    const handleFieldChange = (platform: string, service: string, field: string, val: number) => {
        setPresets((prev: any) => {
            const updated = { ...prev };
            if (!updated[platform]) updated[platform] = {};
            if (!updated[platform][service]) updated[platform][service] = {};
            updated[platform][service][field] = val;
            return updated;
        });
    };

    const handleTierChange = (platform: string, index: number, field: string, val: number) => {
        setPresets((prev: any) => {
            const updated = { ...prev };
            if (updated[platform] && updated[platform].watchTimeTiers && updated[platform].watchTimeTiers[index]) {
                updated[platform].watchTimeTiers[index][field] = val;
            }
            return updated;
        });
    };

    const handleToggleField = (platform: string, service: string) => {
        setPresets((prev: any) => {
            const updated = { ...prev };
            if (!updated[platform]) updated[platform] = {};
            if (!updated[platform][service]) updated[platform][service] = {};
            
            const current = updated[platform][service].enabled !== false;
            updated[platform][service].enabled = !current;
            return updated;
        });
    };

    const handleTogglePlatform = (platform: string) => {
        setPresets((prev: any) => {
            const updated = { ...prev };
            if (!updated[platform]) updated[platform] = {};
            
            const current = updated[platform].enabled !== false;
            updated[platform].enabled = !current;
            return updated;
        });
    };

    const handleToggleTier = (platform: string, index: number) => {
        setPresets((prev: any) => {
            const updated = { ...prev };
            if (updated[platform] && updated[platform].watchTimeTiers && updated[platform].watchTimeTiers[index]) {
                const current = updated[platform].watchTimeTiers[index].enabled !== false;
                updated[platform].watchTimeTiers[index].enabled = !current;
            }
            return updated;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            const updatedSettings = {
                ...settings,
                taskCategoryPresets: presets
            };
            const response = await updateSettings(updatedSettings);
            if (response) {
                dispatch({ type: 'UPDATE_USER', payload: state.currentUser }); // Trigger refresh
                dispatch({ type: 'UPDATE_SETTINGS', payload: response });
                setMessage({ type: 'success', text: 'Task Preset Categories updated successfully!' });
            } else {
                setMessage({ type: 'error', text: 'Failed to update settings.' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Server error saving settings.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (window.confirm('Are you sure you want to reset all configurations to factory defaults?')) {
            setPresets(JSON.parse(JSON.stringify(DEFAULT_PRESETS)));
            setMessage({ type: 'success', text: 'Presets restored to factory defaults. Click Save to persist changes.' });
        }
    };

    const handleAddCategoryPrompt = () => {
        const id = window.prompt("Enter new Category/Platform ID (lowercase, e.g., tiktok, twitter, telegram):");
        if (!id) return;
        const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cleanId) return alert('Invalid ID. Use only alphanumeric characters.');
        if (presets[cleanId]) return alert('This category ID already exists.');

        const displayName = window.prompt("Enter Display Name for this Category (e.g., TikTok, Twitter/X):");
        if (!displayName) return;

        setPresets((prev: any) => ({
            ...prev,
            [cleanId]: {
                enabled: true,
                displayName: displayName.trim()
            }
        }));
        setActiveTab(cleanId);
    };

    const handleAddSubcategoryPrompt = () => {
        const id = window.prompt("Enter new Subcategory ID (lowercase, e.g., follower, share, join, like):");
        if (!id) return;
        const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cleanId) return alert('Invalid ID.');
        if (presets[activeTab]?.[cleanId]) return alert('This subcategory ID already exists in this platform.');

        const displayName = window.prompt("Enter Display Name for this Subcategory (e.g., Follower, Channel Join):");
        if (!displayName) return;

        const minPayoutStr = window.prompt("Enter Minimum Payout per Task in USD (e.g., 0.05):", "0.05");
        if (minPayoutStr === null) return;
        const minPayout = parseFloat(minPayoutStr) || 0.01;

        const minSlotsStr = window.prompt("Enter Minimum Slots / Target Quantity (e.g., 10):", "10");
        if (minSlotsStr === null) return;
        const minSlots = parseInt(minSlotsStr, 10) || 5;

        setPresets((prev: any) => {
            const updated = { ...prev };
            if (!updated[activeTab]) updated[activeTab] = {};
            updated[activeTab][cleanId] = {
                enabled: true,
                displayName: displayName.trim(),
                minPayout,
                minSlots
            };
            return updated;
        });
    };

    // Subcategory keys in currently selected platform/category
    const subcategoryKeys = Object.keys(presets[activeTab] || {}).filter(key => {
        if (key === 'enabled' || key === 'displayName' || key === 'watchTimeTiers') return false;
        return typeof presets[activeTab][key] === 'object' && presets[activeTab][key] !== null;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span>🛠️</span> Task Categories & Limits Configurator
                    </h2>
                    <p className="text-sm text-gray-500">
                        Create, rename, customize, and configure payout/slots rules for MLM user campaign platforms dynamically.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition"
                    >
                        🔄 Reset Defaults
                    </button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg"
                    >
                        💾 Save Changes
                    </Button>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl border font-bold text-sm ${
                    message.type === 'success' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Category Selection Sidebar */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-3xl p-4 border dark:border-gray-700 shadow-sm space-y-2">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider px-3 block mb-2">Platform Categories</span>
                    
                    <div className="space-y-1">
                        {Object.keys(presets).map((key) => {
                            const cat = presets[key];
                            if (!cat || typeof cat !== 'object') return null;
                            const isSelected = activeTab === key;
                            const displayName = cat.displayName || (
                                key === 'youtube' ? 'YouTube' :
                                key === 'facebook' ? 'Facebook' :
                                key === 'instagram' ? 'Instagram' :
                                key === 'google' ? 'Google Reviews' :
                                key === 'paidSignUp' ? 'Paid Sign-Ups' :
                                key.charAt(0).toUpperCase() + key.slice(1)
                            );

                            // Icons
                            const icon = key === 'youtube' ? '📺' : key === 'facebook' ? '👥' : key === 'instagram' ? '📸' : key === 'google' ? '🗺️' : key === 'paidSignUp' ? '🔗' : '⚙️';

                            return (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                    }`}
                                >
                                    <span className="text-lg">{icon}</span>
                                    <span>{displayName}</span>
                                    {cat.enabled !== false ? (
                                        <span className={`ml-auto w-2 h-2 rounded-full bg-emerald-500 shadow-md ${isSelected ? 'shadow-white/50' : 'shadow-emerald-500/50'}`} />
                                    ) : (
                                        <span className="ml-auto text-[9px] uppercase font-black tracking-wider text-red-100 bg-red-950 px-1.5 py-0.5 rounded">OFF</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-2 border-t dark:border-gray-700">
                        <button
                            onClick={handleAddCategoryPrompt}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 rounded-2xl font-bold text-xs text-gray-500 dark:text-gray-400 transition"
                        >
                            <span>➕ Add Custom Category</span>
                        </button>
                    </div>
                </div>

                {/* Main Configurator Area */}
                <div className="lg:col-span-3 space-y-6">
                    {presets[activeTab] && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Platform Level Configuration Banner */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border dark:border-gray-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex-1 w-full space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Configure Category Name & Status</h4>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <label className="text-xs text-gray-400 font-bold sm:w-28 shrink-0">Category Name:</label>
                                        <input
                                            type="text"
                                            value={presets[activeTab]?.displayName || activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPresets((prev: any) => {
                                                    const updated = { ...prev };
                                                    if (!updated[activeTab]) updated[activeTab] = {};
                                                    updated[activeTab].displayName = val;
                                                    return updated;
                                                });
                                            }}
                                            placeholder="e.g. YouTube"
                                            className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-xl font-bold text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl border dark:border-gray-700">
                                    <span className={`text-xs font-black uppercase tracking-wider ${presets[activeTab]?.enabled !== false ? 'text-emerald-500' : 'text-gray-400'}`}>
                                        {presets[activeTab]?.enabled !== false ? 'Active' : 'Disabled'}
                                    </span>
                                    <ToggleSwitch
                                        enabled={presets[activeTab]?.enabled !== false}
                                        onChange={() => handleTogglePlatform(activeTab)}
                                    />
                                </div>
                            </div>

                            {/* Subcategories Presets */}
                            <div className={`bg-white dark:bg-gray-800 rounded-3xl p-6 border dark:border-gray-700 shadow-sm space-y-6 ${presets[activeTab]?.enabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3 gap-3">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <span>⚙️</span> Subcategory Actions & Pricing Limits
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddSubcategoryPrompt}
                                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg transition"
                                    >
                                        ➕ Add Subcategory
                                    </button>
                                </div>

                                {subcategoryKeys.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 font-medium">
                                        No micro-service actions configured for this platform. Click Add Subcategory to define one!
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {subcategoryKeys.map((subKey) => {
                                            const subPreset = presets[activeTab][subKey];
                                            const subDisplayName = subPreset.displayName || subKey.charAt(0).toUpperCase() + subKey.slice(1);

                                            return (
                                                <div key={subKey} className={`p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl space-y-4 border transition-all ${subPreset.enabled !== false ? 'border-transparent' : 'border-red-500/20'}`}>
                                                    <div className="flex justify-between items-center gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <input
                                                                type="text"
                                                                value={subDisplayName}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setPresets((prev: any) => {
                                                                        const updated = { ...prev };
                                                                        if (!updated[activeTab]) updated[activeTab] = {};
                                                                        if (!updated[activeTab][subKey]) updated[activeTab][subKey] = {};
                                                                        updated[activeTab][subKey].displayName = val;
                                                                        return updated;
                                                                    });
                                                                }}
                                                                className="font-bold text-sm bg-transparent border-b border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 focus:border-blue-500 dark:text-gray-200 w-full focus:outline-none py-0.5"
                                                                placeholder="Subcategory Display Name"
                                                            />
                                                            <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider mt-1">ID: {subKey}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2.5">
                                                            <ToggleSwitch
                                                                enabled={subPreset.enabled !== false}
                                                                onChange={() => handleToggleField(activeTab, subKey)}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (window.confirm(`Are you sure you want to delete the subcategory "${subKey}"?`)) {
                                                                        setPresets((prev: any) => {
                                                                            const updated = { ...prev };
                                                                            delete updated[activeTab][subKey];
                                                                            return updated;
                                                                        });
                                                                    }
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 text-sm p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition"
                                                                title="Delete Subcategory"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div>
                                                            <label className="text-[10px] text-gray-400 uppercase font-black block mb-1">Min Payout per Task ($ USD)</label>
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                value={subPreset.minPayout || 0.01}
                                                                onChange={(e) => handleFieldChange(activeTab, subKey, 'minPayout', parseFloat(e.target.value) || 0)}
                                                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl font-bold text-sm text-gray-900 dark:text-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-gray-400 uppercase font-black block mb-1">Min Slots limit per Campaign</label>
                                                            <input
                                                                type="number"
                                                                value={subPreset.minSlots || 10}
                                                                onChange={(e) => handleFieldChange(activeTab, subKey, 'minSlots', parseInt(e.target.value) || 0)}
                                                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl font-bold text-sm text-gray-900 dark:text-white"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Watch Time Tiers Editor (for youtube/facebook or custom platforms with watchTimeTiers) */}
                            {presets[activeTab]?.watchTimeTiers && Array.isArray(presets[activeTab].watchTimeTiers) && (
                                <div className={`bg-white dark:bg-gray-800 rounded-3xl p-6 border dark:border-gray-700 shadow-sm space-y-6 ${presets[activeTab]?.enabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="border-b dark:border-gray-700 pb-3 flex justify-between items-center gap-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <span>⏱️</span> Watch Time Duration Tiers
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                Map custom watch-time tiers directly to specific minimum pricing structures.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {presets[activeTab].watchTimeTiers.map((tier: any, i: number) => (
                                            <div key={i} className={`p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border transition-colors ${tier.enabled !== false ? 'border-transparent' : 'border-red-500/20'}`}>
                                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                                    <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={tier.duration}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setPresets((prev: any) => {
                                                                    const updated = { ...prev };
                                                                    if (updated[activeTab] && updated[activeTab].watchTimeTiers && updated[activeTab].watchTimeTiers[i]) {
                                                                        updated[activeTab].watchTimeTiers[i].duration = val;
                                                                    }
                                                                    return updated;
                                                                });
                                                            }}
                                                            className="font-bold text-sm bg-transparent border-b border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 focus:border-blue-500 dark:text-gray-200 focus:outline-none w-36"
                                                        />
                                                        <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block mt-0.5">Duration Title</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                                                    <ToggleSwitch
                                                        enabled={tier.enabled !== false}
                                                        onChange={() => handleToggleTier(activeTab, i)}
                                                    />
                                                    
                                                    <div className="flex gap-4">
                                                        <div className="w-24 sm:w-28">
                                                            <label className="text-[10px] text-gray-400 uppercase font-black block mb-1">Min Price ($)</label>
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                value={tier.minPayout}
                                                                onChange={(e) => handleTierChange(activeTab, i, 'minPayout', parseFloat(e.target.value) || 0)}
                                                                className="w-full px-3 py-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl font-bold text-xs"
                                                            />
                                                        </div>
                                                        <div className="w-24 sm:w-28">
                                                            <label className="text-[10px] text-gray-400 uppercase font-black block mb-1">Min Slots</label>
                                                            <input
                                                                type="number"
                                                                value={tier.minSlots}
                                                                onChange={(e) => handleTierChange(activeTab, i, 'minSlots', parseInt(e.target.value) || 0)}
                                                                className="w-full px-3 py-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl font-bold text-xs"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm("Are you sure you want to delete this watch time tier?")) {
                                                                    setPresets((prev: any) => {
                                                                        const updated = { ...prev };
                                                                        updated[activeTab].watchTimeTiers.splice(i, 1);
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
                                                            className="text-gray-400 hover:text-red-500 self-end mb-1 text-xs"
                                                            title="Delete Tier"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const duration = window.prompt("Enter new Watch Time Tier Duration (e.g. 10 Minutes, 30 Seconds):");
                                                if (!duration) return;
                                                const minPayoutStr = window.prompt("Enter Minimum Price per view in USD (e.g. 0.15):", "0.15");
                                                if (minPayoutStr === null) return;
                                                const minPayout = parseFloat(minPayoutStr) || 0.05;
                                                const minSlotsStr = window.prompt("Enter Minimum Slots per campaign (e.g. 20):", "20");
                                                if (minSlotsStr === null) return;
                                                const minSlots = parseInt(minSlotsStr, 10) || 10;

                                                setPresets((prev: any) => {
                                                    const updated = { ...prev };
                                                    if (!updated[activeTab].watchTimeTiers) {
                                                        updated[activeTab].watchTimeTiers = [];
                                                    }
                                                    updated[activeTab].watchTimeTiers.push({
                                                        duration: duration.trim(),
                                                        minPayout,
                                                        minSlots,
                                                        enabled: true
                                                    });
                                                    return updated;
                                                });
                                            }}
                                            className="w-full py-3 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl font-bold text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                                        >
                                            ➕ Add New Watch Time Duration Tier
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Delete Category action for Custom Categories */}
                            {!['youtube', 'facebook', 'instagram', 'google', 'paidSignUp'].includes(activeTab) && (
                                <div className="bg-red-500/5 rounded-3xl p-6 border border-red-500/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div>
                                        <h4 className="text-sm font-black text-red-500 uppercase tracking-wider">⚠️ Delete Custom Category</h4>
                                        <p className="text-xs text-gray-500">Completely remove this platform from the available selection system. This cannot be undone.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm(`Are you absolutely sure you want to delete the "${activeTab}" category and all of its subcategories?`)) {
                                                setPresets((prev: any) => {
                                                    const updated = { ...prev };
                                                    delete updated[activeTab];
                                                    return updated;
                                                });
                                                setActiveTab('youtube');
                                            }
                                        }}
                                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
                                    >
                                        Delete Platform
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminTaskCategories;
