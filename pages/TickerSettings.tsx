
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../hooks/useData';
import { Settings, DemoProfile, DemoActivityTemplate, Currency, countries, formatCurrency } from '../types';
import { updateSettings } from '../services/api';
import Button from '../components/ui/Button';
import ActivityTicker, { Activity } from '../components/ui/ActivityTicker';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; }> = ({ checked, onChange }) => (
    <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
);

const TickerSettings: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans } = state;
    const [localSettings, setLocalSettings] = useState<Partial<Settings>>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'real' | 'profiles' | 'templates'>('general');

    // Selection State
    const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

    // Modal States
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isBulkProfileModalOpen, setIsBulkProfileModalOpen] = useState(false);
    const [bulkProfileText, setBulkProfileText] = useState('');
    const [currentProfile, setCurrentProfile] = useState<Partial<DemoProfile> | null>(null);
    
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isBulkTemplateModalOpen, setIsBulkTemplateModalOpen] = useState(false);
    const [bulkTemplateText, setBulkTemplateText] = useState('');
    const [currentTemplate, setCurrentTemplate] = useState<Partial<DemoActivityTemplate> | null>(null);
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);

    // Bulk Edit Modals
    const [isBulkEditProfilesModalOpen, setIsBulkEditProfilesModalOpen] = useState(false);
    const [bulkEditProfileData, setBulkEditProfileData] = useState<{ country?: string, currency?: Currency }>({});
    
    const [isBulkEditTemplatesModalOpen, setIsBulkEditTemplatesModalOpen] = useState(false);
    const [bulkEditTemplateData, setBulkEditTemplateData] = useState<{ type?: string, enabled?: string }>({}); // enabled as string 'true'/'false' for select
    
    // Pagination State
    const [profilesCurrentPage, setProfilesCurrentPage] = useState(1);
    const [profilesPerPage] = useState(10);
    const [templatesCurrentPage, setTemplatesCurrentPage] = useState(1);
    const [templatesPerPage] = useState(10);

    // Ref for template textarea to insert variables
    const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Ensure nested objects exist
        setLocalSettings({
            tickerEnabled: true,
            tickerSpeed: 6,
            tickerPauseOnHover: false,
            tickerStyle: { backgroundColor: '', textColor: '', accentColor: '' },
            tickerContentSource: 'hybrid',
            tickerRealActivities: { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true },
            tickerDemoAmountRanges: {
                EUR: { min: 50, max: 500 },
                PKR: { min: 5000, max: 50000 },
                USD: { min: 50, max: 500 },
            },
            demoProfiles: [],
            demoActivityTemplates: [],
            ...state.settings
        });
    }, [state.settings]);

    const handleGenericChange = (field: keyof Settings, value: any) => {
        setLocalSettings(prev => ({...prev, [field]: value}));
        setIsDirty(true);
    };

    const handleStyleChange = (field: 'backgroundColor' | 'textColor' | 'accentColor', value: string) => {
        setLocalSettings(prev => ({
            ...prev,
            tickerStyle: {
                ...prev.tickerStyle,
                [field]: value
            }
        }));
        setIsDirty(true);
    };
    
    const handleAmountRangeChange = (currency: Currency, field: 'min' | 'max', value: string) => {
        const val = parseInt(value) || 0;
        setLocalSettings(prev => ({
            ...prev,
            tickerDemoAmountRanges: {
                ...prev.tickerDemoAmountRanges!,
                [currency]: {
                    ...prev.tickerDemoAmountRanges![currency],
                    [field]: val
                }
            }
        }));
        setIsDirty(true);
    };

    const handleAutoFillRanges = () => {
        if (!window.confirm("This will overwrite current min/max values based on the cheapest and most expensive plans for each currency. Continue?")) return;

        const newRanges = { ...localSettings.tickerDemoAmountRanges };
        let updated = false;

        (['USD', 'EUR', 'PKR'] as Currency[]).forEach(currency => {
            const plans = investmentPlans.filter(p => p.currency === currency && p.status === 'Active');
            if (plans.length > 0) {
                const prices = plans.map(p => p.price);
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                
                // Add a small buffer or just use exact
                newRanges[currency] = { min, max };
                updated = true;
            }
        });

        if (updated) {
            setLocalSettings(prev => ({ ...prev, tickerDemoAmountRanges: newRanges as any }));
            setIsDirty(true);
        } else {
            alert("No active plans found to calculate ranges from.");
        }
    };

    const handleRealActivityChange = (activity: keyof NonNullable<Settings['tickerRealActivities']>) => {
        setLocalSettings(prev => ({
            ...prev,
            tickerRealActivities: {
                ...(prev.tickerRealActivities ?? { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true }),
                [activity]: !(prev.tickerRealActivities?.[activity] ?? false)
            }
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await updateSettings(localSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: updated });
            alert('Ticker settings saved successfully!');
            setIsDirty(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    // --- Profile Management ---
    const handleOpenProfileModal = (profile: DemoProfile | null) => {
        setCurrentProfile(profile ? { ...profile } : { name: '', country: countries[0], currency: 'PKR' });
        setIsProfileModalOpen(true);
    };

    const handleSaveProfile = () => {
        if (!currentProfile || !currentProfile.name || !currentProfile.country) return;
        const profileToSave: DemoProfile = {
            _id: currentProfile._id || new Date().getTime().toString(),
            name: currentProfile.name,
            country: currentProfile.country,
            currency: currentProfile.currency || 'PKR',
        };

        setLocalSettings(prev => {
            const profiles = prev.demoProfiles || [];
            const updatedProfiles = profiles.some(p => p._id === profileToSave._id)
                ? profiles.map(p => p._id === profileToSave._id ? profileToSave : p)
                : [profileToSave, ...profiles];
            return { ...prev, demoProfiles: updatedProfiles };
        });
        setIsProfileModalOpen(false);
        setIsDirty(true);
    };

    const handleDeleteProfile = (id: string) => {
        if (window.confirm('Delete this profile?')) {
            setLocalSettings(prev => ({ ...prev, demoProfiles: (prev.demoProfiles || []).filter(p => p._id !== id) }));
            setIsDirty(true);
            setSelectedProfileIds(prev => prev.filter(pid => pid !== id));
        }
    };

    const handleBulkDeleteProfiles = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedProfileIds.length} profiles?`)) {
            setLocalSettings(prev => ({
                ...prev,
                demoProfiles: (prev.demoProfiles || []).filter(p => !selectedProfileIds.includes(p._id))
            }));
            setIsDirty(true);
            setSelectedProfileIds([]);
        }
    };

    const handleBulkEditProfilesSave = () => {
        setLocalSettings(prev => ({
            ...prev,
            demoProfiles: (prev.demoProfiles || []).map(p => {
                if (selectedProfileIds.includes(p._id)) {
                    return {
                        ...p,
                        ...(bulkEditProfileData.country ? { country: bulkEditProfileData.country } : {}),
                        ...(bulkEditProfileData.currency ? { currency: bulkEditProfileData.currency } : {})
                    };
                }
                return p;
            })
        }));
        setIsDirty(true);
        setIsBulkEditProfilesModalOpen(false);
        setSelectedProfileIds([]);
        setBulkEditProfileData({});
    };

    const handleBulkSaveProfiles = () => {
        const lines = bulkProfileText.split('\n').filter(line => line.trim() !== '');
        const newProfiles: DemoProfile[] = [];
        
        lines.forEach(line => {
            const [name, country, currency] = line.split(',').map(p => p.trim());
            if (name && country) {
                newProfiles.push({
                    _id: `${Date.now()}-${Math.random()}`,
                    name,
                    country,
                    currency: (currency as Currency) || 'USD'
                });
            }
        });

        if (newProfiles.length > 0) {
            setLocalSettings(prev => ({ ...prev, demoProfiles: [...newProfiles, ...(prev.demoProfiles || [])] }));
            setIsDirty(true);
        }
        setIsBulkProfileModalOpen(false);
        setBulkProfileText('');
    };

    const handleToggleSelectProfile = (id: string) => {
        setSelectedProfileIds(prev => {
            if (prev.includes(id)) return prev.filter(pid => pid !== id);
            return [...prev, id];
        });
    };

    const handleSelectAllProfiles = (pageProfiles: DemoProfile[]) => {
        const pageIds = pageProfiles.map(p => p._id);
        const allSelected = pageIds.every(id => selectedProfileIds.includes(id));
        
        if (allSelected) {
            setSelectedProfileIds(prev => prev.filter(id => !pageIds.includes(id)));
        } else {
            setSelectedProfileIds(prev => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    // --- Template Management ---
    const handleOpenTemplateModal = (template: DemoActivityTemplate | null) => {
        if (template) {
            setCurrentTemplate({ ...template });
            setIsEditingTemplate(true);
        } else {
            setCurrentTemplate({ template: '{name} from {country} just joined!', type: 'joined', enabled: true });
            setIsEditingTemplate(false);
        }
        setIsTemplateModalOpen(true);
    };

    const handleSaveTemplate = () => {
        if (!currentTemplate || !currentTemplate.template) return;
        const templateToSave: DemoActivityTemplate = {
            _id: currentTemplate._id || Date.now().toString(),
            template: currentTemplate.template,
            type: currentTemplate.type || 'joined',
            enabled: currentTemplate.enabled !== false
        };

        setLocalSettings(prev => {
            const templates = prev.demoActivityTemplates || [];
            const updatedTemplates = isEditingTemplate
                ? templates.map(t => t._id === templateToSave._id ? templateToSave : t)
                : [templateToSave, ...templates];
            return { ...prev, demoActivityTemplates: updatedTemplates };
        });
        setIsTemplateModalOpen(false);
        setIsDirty(true);
    };

    const handleDeleteTemplate = (id: string) => {
        if (window.confirm('Delete this template?')) {
            setLocalSettings(prev => ({ ...prev, demoActivityTemplates: (prev.demoActivityTemplates || []).filter(t => t._id !== id) }));
            setIsDirty(true);
            setSelectedTemplateIds(prev => prev.filter(tid => tid !== id));
        }
    };

    const handleBulkDeleteTemplates = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedTemplateIds.length} templates?`)) {
            setLocalSettings(prev => ({
                ...prev,
                demoActivityTemplates: (prev.demoActivityTemplates || []).filter(t => !selectedTemplateIds.includes(t._id))
            }));
            setIsDirty(true);
            setSelectedTemplateIds([]);
        }
    };

    const handleBulkEditTemplatesSave = () => {
        setLocalSettings(prev => ({
            ...prev,
            demoActivityTemplates: (prev.demoActivityTemplates || []).map(t => {
                if (selectedTemplateIds.includes(t._id)) {
                    return {
                        ...t,
                        ...(bulkEditTemplateData.type ? { type: bulkEditTemplateData.type as any } : {}),
                        ...(bulkEditTemplateData.enabled ? { enabled: bulkEditTemplateData.enabled === 'true' } : {})
                    };
                }
                return t;
            })
        }));
        setIsDirty(true);
        setIsBulkEditTemplatesModalOpen(false);
        setSelectedTemplateIds([]);
        setBulkEditTemplateData({});
    };

    const handleSaveBulkTemplates = () => {
        const lines = bulkTemplateText.split('\n').filter(line => line.trim() !== '');
        const newTemplates: DemoActivityTemplate[] = [];
        
        lines.forEach(line => {
            // Format: Type: Template Text
            const separatorIndex = line.indexOf(':');
            if (separatorIndex > 0) {
                const type = line.substring(0, separatorIndex).trim();
                const template = line.substring(separatorIndex + 1).trim();
                const validTypes = ['withdrawal', 'transfer', 'joined', 'deposit', 'plan', 'commission'];
                
                if (type && template && validTypes.includes(type)) {
                    newTemplates.push({
                        _id: `${Date.now()}-${Math.random()}`,
                        template,
                        type: type as any,
                        enabled: true
                    });
                }
            }
        });

        if (newTemplates.length > 0) {
            setLocalSettings(prev => ({ ...prev, demoActivityTemplates: [...newTemplates, ...(prev.demoActivityTemplates || [])] }));
            setIsDirty(true);
        }
        setIsBulkTemplateModalOpen(false);
        setBulkTemplateText('');
    };

    const handleToggleSelectTemplate = (id: string) => {
        setSelectedTemplateIds(prev => {
            if (prev.includes(id)) return prev.filter(tid => tid !== id);
            return [...prev, id];
        });
    };

    const handleSelectAllTemplates = (pageTemplates: DemoActivityTemplate[]) => {
        const pageIds = pageTemplates.map(t => t._id);
        const allSelected = pageIds.every(id => selectedTemplateIds.includes(id));
        
        if (allSelected) {
            setSelectedTemplateIds(prev => prev.filter(id => !pageIds.includes(id)));
        } else {
            setSelectedTemplateIds(prev => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const handleInsertVariable = (variable: string) => {
        if (templateTextareaRef.current && currentTemplate) {
            const field = templateTextareaRef.current;
            const start = field.selectionStart;
            const end = field.selectionEnd;
            const text = currentTemplate.template || '';
            const newText = text.substring(0, start) + variable + text.substring(end);
            setCurrentTemplate({ ...currentTemplate, template: newText });
            // Defer focus back
            setTimeout(() => {
                field.focus();
                field.setSelectionRange(start + variable.length, start + variable.length);
            }, 0);
        }
    };

    // --- Previews ---
    const previewActivities = useMemo((): Activity[] => {
        const activities: Activity[] = [];
        const demoProfiles = localSettings.demoProfiles || [];
        const demoTemplates = (localSettings.demoActivityTemplates || []).filter(t => t.enabled);

        if (demoProfiles.length > 0 && demoTemplates.length > 0) {
            for (let i = 0; i < 15; i++) {
                const template = demoTemplates[i % demoTemplates.length];
                const profile = demoProfiles[i % demoProfiles.length];
                
                let text = template.template;
                text = text.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`);
                text = text.replace('{country}', `<strong>${profile.country}</strong>`);
                text = text.replace('{currency}', `<strong>${profile.currency}</strong>`);

                // Strict Price Matching for Preview (Logic Mirror)
                const useExactPlanPrice = ['deposit', 'withdrawal', 'plan'].includes(template.type);

                if (useExactPlanPrice) {
                    const plans = investmentPlans.filter(p => p.currency === profile.currency && p.status === 'Active');
                    if (plans.length > 0) {
                        const randomPlan = plans[Math.floor(Math.random() * plans.length)];
                        if (text.includes('{amount}')) text = text.replace('{amount}', `<strong>${formatCurrency(randomPlan.price, profile.currency)}</strong>`);
                        if (text.includes('{plan}')) text = text.replace('{plan}', `<strong>${randomPlan.name}</strong>`);
                    }
                }

                // If amount is present but wasn't replaced by plan logic (e.g. Transfer)
                if (text.includes('{amount}')) {
                    const ranges = localSettings.tickerDemoAmountRanges;
                    const range = ranges?.[profile.currency] || { min: 100, max: 1000 };
                    const amt = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                    text = text.replace('{amount}', `<strong>${formatCurrency(amt, profile.currency)}</strong>`);
                }
                
                activities.push({ id: `preview-${i}`, type: template.type, text, time: `${i * 2 + 1}m ago` });
            }
        } else {
            return [{ id: 'empty', type: 'joined', text: 'Add profiles and templates to see preview', time: 'now' }];
        }
        return activities;
    }, [localSettings, investmentPlans]);

    const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
        >
            {label}
        </button>
    );

    // --- Render Helpers ---
    const paginatedProfiles = (localSettings.demoProfiles || []).slice((profilesCurrentPage - 1) * profilesPerPage, profilesCurrentPage * profilesPerPage);
    const paginatedTemplates = (localSettings.demoActivityTemplates || []).slice((templatesCurrentPage - 1) * templatesPerPage, templatesCurrentPage * templatesPerPage);

    return (
        <div className="space-y-6">
            {/* Header & Preview */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Activity Ticker Manager</h1>
                        <p className="text-sm text-gray-500">Configure real and demo data for the user dashboard ticker.</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                            <span className={`w-2 h-2 rounded-full ${localSettings.tickerEnabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="text-sm font-medium">{localSettings.tickerEnabled ? 'Ticker ON' : 'Ticker OFF'}</span>
                        </div>
                        <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
                
                {/* Live Preview Bar */}
                <div className="border rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <div className="text-xs text-gray-400 p-1 uppercase tracking-wider bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">Live Preview</div>
                    <ActivityTicker 
                        activities={previewActivities} 
                        speed={localSettings.tickerSpeed || 6} 
                        pauseOnHover={localSettings.tickerPauseOnHover}
                        style={localSettings.tickerStyle}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <TabButton id="general" label="General & Amounts" />
                <TabButton id="real" label="Real Activity Config" />
                <TabButton id="profiles" label={`Demo Profiles (${localSettings.demoProfiles?.length || 0})`} />
                <TabButton id="templates" label={`Message Templates (${localSettings.demoActivityTemplates?.length || 0})`} />
            </div>

            {/* CONTENT: GENERAL */}
            {activeTab === 'general' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-8 animate-fade-in">
                    
                    {/* Basic Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Main Configuration</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                                    <span>Enable Ticker</span>
                                    <ToggleSwitch checked={localSettings.tickerEnabled ?? true} onChange={() => handleGenericChange('tickerEnabled', !localSettings.tickerEnabled)} />
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                                    <span>Pause on Mouse Hover</span>
                                    <ToggleSwitch checked={localSettings.tickerPauseOnHover ?? false} onChange={() => handleGenericChange('tickerPauseOnHover', !localSettings.tickerPauseOnHover)} />
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                                    <label className="block text-sm font-medium mb-2">Scroll Speed ({localSettings.tickerSpeed}s)</label>
                                    <input type="range" min="2" max="20" step="1" value={localSettings.tickerSpeed} onChange={(e) => handleGenericChange('tickerSpeed', parseInt(e.target.value))} className="w-full" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Content Source</h3>
                            <div className="grid grid-cols-1 gap-2 mb-6">
                                {[
                                    { id: 'hybrid', label: 'Hybrid (Real + Demo)', desc: 'Mixes real user events with demo data.' },
                                    { id: 'real_only', label: 'Real Activity Only', desc: 'Shows only actual platform events.' },
                                    { id: 'demo_only', label: 'Demo Data Only', desc: 'Shows only fake generated events.' },
                                ].map(opt => (
                                    <label key={opt.id} className={`flex items-start p-3 rounded border cursor-pointer transition-colors ${localSettings.tickerContentSource === opt.id ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20' : 'bg-gray-50 border-gray-200 dark:bg-gray-700/30 dark:border-gray-600'}`}>
                                        <input type="radio" name="source" value={opt.id} checked={localSettings.tickerContentSource === opt.id} onChange={() => handleGenericChange('tickerContentSource', opt.id)} className="mt-1" />
                                        <div className="ml-3">
                                            <span className="block text-sm font-bold text-gray-800 dark:text-white">{opt.label}</span>
                                            <span className="block text-xs text-gray-500">{opt.desc}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Appearance</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs font-medium block mb-1">Background</label>
                                    <div className="flex gap-2">
                                        <input type="color" value={localSettings.tickerStyle?.backgroundColor || '#ffffff'} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} className="h-8 w-8 p-0 border-0 rounded cursor-pointer" />
                                        <button type="button" onClick={() => handleStyleChange('backgroundColor', '')} className="text-xs text-blue-500 underline">Reset</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium block mb-1">Text Color</label>
                                    <div className="flex gap-2">
                                        <input type="color" value={localSettings.tickerStyle?.textColor || '#000000'} onChange={(e) => handleStyleChange('textColor', e.target.value)} className="h-8 w-8 p-0 border-0 rounded cursor-pointer" />
                                        <button type="button" onClick={() => handleStyleChange('textColor', '')} className="text-xs text-blue-500 underline">Reset</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium block mb-1">Accent (Bold)</label>
                                    <div className="flex gap-2">
                                        <input type="color" value={localSettings.tickerStyle?.accentColor || '#000000'} onChange={(e) => handleStyleChange('accentColor', e.target.value)} className="h-8 w-8 p-0 border-0 rounded cursor-pointer" />
                                        <button type="button" onClick={() => handleStyleChange('accentColor', '')} className="text-xs text-blue-500 underline">Reset</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Amount Ranges */}
                    <div>
                        <div className="flex justify-between items-end mb-4 border-b dark:border-gray-700 pb-2">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Demo Amount Ranges</h3>
                                <p className="text-sm text-gray-500">
                                    Used for Transfer/Joined amounts. 
                                    <br />
                                    <span className="text-blue-500 text-xs">Note: Deposit, Withdrawal, Plan Purchase, and Commissions will AUTOMATICALLY calculate based on your Active Plans.</span>
                                </p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={handleAutoFillRanges}>Auto-fill from Plans</Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(['USD', 'EUR', 'PKR'] as Currency[]).map(curr => (
                                <div key={curr} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                                    <h4 className="font-bold text-center mb-3 text-blue-600 dark:text-blue-400">{curr} Range</h4>
                                    <div className="flex gap-2 items-center">
                                        <input type="number" value={localSettings.tickerDemoAmountRanges?.[curr].min} onChange={(e) => handleAmountRangeChange(curr, 'min', e.target.value)} className="w-full text-sm rounded dark:bg-gray-700" placeholder="Min" />
                                        <span className="text-gray-400">-</span>
                                        <input type="number" value={localSettings.tickerDemoAmountRanges?.[curr].max} onChange={(e) => handleAmountRangeChange(curr, 'max', e.target.value)} className="w-full text-sm rounded dark:bg-gray-700" placeholder="Max" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: REAL ACTIVITY */}
            {activeTab === 'real' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-fade-in">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Real Activity Visibility</h3>
                    <p className="text-sm text-gray-500 mb-6">Choose which types of actual system events are broadcasted when "Real" or "Hybrid" source is selected.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { id: 'deposits', label: 'Deposits', desc: 'Approved user deposits' },
                            { id: 'withdrawals', label: 'Withdrawals', desc: 'Paid withdrawal requests' },
                            { id: 'registrations', label: 'New Registrations', desc: 'New user signups' },
                            { id: 'commissions', label: 'Commissions', desc: 'Referral earnings' },
                            { id: 'transfers', label: 'Transfers', desc: 'User-to-user transfers' },
                            { id: 'planPurchases', label: 'Plan Purchases', desc: 'Investment plan activations' },
                        ].map(item => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                                <div>
                                    <div className="font-semibold text-gray-800 dark:text-white">{item.label}</div>
                                    <div className="text-xs text-gray-500">{item.desc}</div>
                                </div>
                                <ToggleSwitch 
                                    checked={!!localSettings.tickerRealActivities?.[item.id as keyof Settings['tickerRealActivities']]} 
                                    onChange={() => handleRealActivityChange(item.id as any)} 
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CONTENT: DEMO PROFILES */}
            {activeTab === 'profiles' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold">Demo Profiles</h3>
                            {selectedProfileIds.length > 0 && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="danger" onClick={handleBulkDeleteProfiles}>Delete Selected ({selectedProfileIds.length})</Button>
                                    <Button size="sm" variant="secondary" onClick={() => setIsBulkEditProfilesModalOpen(true)}>Bulk Edit</Button>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setIsBulkProfileModalOpen(true)}>Bulk Add</Button>
                            <Button size="sm" onClick={() => handleOpenProfileModal(null)}>+ Add Profile</Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase font-medium">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <input 
                                            type="checkbox" 
                                            className="rounded"
                                            checked={paginatedProfiles.length > 0 && paginatedProfiles.every(p => selectedProfileIds.includes(p._id))}
                                            onChange={() => handleSelectAllProfiles(paginatedProfiles)}
                                        />
                                    </th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Country</th>
                                    <th className="px-4 py-3">Currency</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {paginatedProfiles.length > 0 ? paginatedProfiles.map(profile => (
                                    <tr key={profile._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-2">
                                            <input 
                                                type="checkbox" 
                                                className="rounded" 
                                                checked={selectedProfileIds.includes(profile._id)}
                                                onChange={() => handleToggleSelectProfile(profile._id)}
                                            />
                                        </td>
                                        <td className="px-4 py-2 font-medium">{profile.name}</td>
                                        <td className="px-4 py-2">{profile.country}</td>
                                        <td className="px-4 py-2"><Badge status={profile.currency} /></td>
                                        <td className="px-4 py-2 text-right">
                                            <button onClick={() => handleOpenProfileModal(profile)} className="text-blue-600 hover:underline mr-3">Edit</button>
                                            <button onClick={() => handleDeleteProfile(profile._id)} className="text-red-500 hover:underline">Delete</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">No profiles found. Add some to get started.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Simple Pagination */}
                    <div className="flex justify-between items-center mt-4">
                        <span className="text-xs text-gray-500">Page {profilesCurrentPage}</span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" disabled={profilesCurrentPage === 1} onClick={() => setProfilesCurrentPage(p => p - 1)}>Prev</Button>
                            <Button size="sm" variant="secondary" disabled={paginatedProfiles.length < profilesPerPage} onClick={() => setProfilesCurrentPage(p => p + 1)}>Next</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: TEMPLATES */}
            {activeTab === 'templates' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold">Message Templates</h3>
                            {selectedTemplateIds.length > 0 && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="danger" onClick={handleBulkDeleteTemplates}>Delete Selected ({selectedTemplateIds.length})</Button>
                                    <Button size="sm" variant="secondary" onClick={() => setIsBulkEditTemplatesModalOpen(true)}>Bulk Edit</Button>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setIsBulkTemplateModalOpen(true)}>Bulk Add</Button>
                            <Button size="sm" onClick={() => handleOpenTemplateModal(null)}>+ Add Template</Button>
                        </div>
                    </div>

                    {/* Bulk Select All for Page */}
                    <div className="mb-2 flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-700">
                        <input 
                            type="checkbox" 
                            className="rounded"
                            checked={paginatedTemplates.length > 0 && paginatedTemplates.every(t => selectedTemplateIds.includes(t._id))}
                            onChange={() => handleSelectAllTemplates(paginatedTemplates)}
                        />
                        <span className="text-sm font-medium">Select All on Page</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {paginatedTemplates.length > 0 ? paginatedTemplates.map(template => (
                            <div key={template._id} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-700/30 dark:border-gray-700">
                                 <input 
                                    type="checkbox" 
                                    className="rounded flex-shrink-0"
                                    checked={selectedTemplateIds.includes(template._id)}
                                    onChange={() => handleToggleSelectTemplate(template._id)}
                                />
                                <div className="flex-grow flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${template.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {/* Simple icon based on type */}
                                            <span className="uppercase text-xs font-bold">{template.type.substring(0, 2)}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{template.template}</p>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">{template.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <ToggleSwitch checked={template.enabled} onChange={() => {
                                            const newTemplates = localSettings.demoActivityTemplates!.map(t => t._id === template._id ? { ...t, enabled: !t.enabled } : t);
                                            setLocalSettings(prev => ({ ...prev, demoActivityTemplates: newTemplates }));
                                            setIsDirty(true);
                                        }} />
                                        <button onClick={() => handleOpenTemplateModal(template)} className="text-blue-600 text-sm hover:underline">Edit</button>
                                        <button onClick={() => handleDeleteTemplate(template._id)} className="text-red-500 text-sm hover:underline">Delete</button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-gray-500 py-4">No templates found.</p>
                        )}
                    </div>
                     {/* Simple Pagination */}
                     <div className="flex justify-between items-center mt-4">
                        <span className="text-xs text-gray-500">Page {templatesCurrentPage}</span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" disabled={templatesCurrentPage === 1} onClick={() => setTemplatesCurrentPage(p => p - 1)}>Prev</Button>
                            <Button size="sm" variant="secondary" disabled={paginatedTemplates.length < templatesPerPage} onClick={() => setTemplatesCurrentPage(p => p + 1)}>Next</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}

            {/* Profile Modal */}
            {isProfileModalOpen && currentProfile && (
                <Modal isOpen={true} onClose={() => setIsProfileModalOpen(false)}>
                    <div className="p-4 w-96">
                        <h3 className="text-lg font-bold mb-4">{currentProfile._id ? 'Edit Profile' : 'Add Profile'}</h3>
                        <div className="space-y-3">
                            <input className="w-full border rounded p-2 dark:bg-gray-700" placeholder="Name (e.g. John Doe)" value={currentProfile.name} onChange={e => setCurrentProfile({...currentProfile, name: e.target.value})} />
                            <select className="w-full border rounded p-2 dark:bg-gray-700" value={currentProfile.country} onChange={e => setCurrentProfile({...currentProfile, country: e.target.value})}>
                                {countries.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select className="w-full border rounded p-2 dark:bg-gray-700" value={currentProfile.currency} onChange={e => setCurrentProfile({...currentProfile, currency: e.target.value as Currency})}>
                                <option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option>
                            </select>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveProfile}>Save</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Template Modal */}
            {isTemplateModalOpen && currentTemplate && (
                <Modal isOpen={true} onClose={() => setIsTemplateModalOpen(false)}>
                    <div className="p-4 w-[500px] max-w-full">
                        <h3 className="text-lg font-bold mb-4">{currentTemplate._id ? 'Edit Template' : 'Add Template'}</h3>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Event Type</label>
                            <select 
                                className="w-full border rounded p-2 dark:bg-gray-700" 
                                value={currentTemplate.type} 
                                onChange={e => setCurrentTemplate({...currentTemplate, type: e.target.value as any})}
                            >
                                <option value="joined">New User Joined</option>
                                <option value="deposit">Deposit</option>
                                <option value="withdrawal">Withdrawal</option>
                                <option value="transfer">Transfer</option>
                                <option value="plan">Plan Purchase</option>
                                <option value="commission">Commission Earned</option>
                            </select>
                        </div>

                        <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">Template Text</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {['{name}', '{amount}', '{country}', '{plan}', '{currency}'].map(variable => (
                                    <button 
                                        key={variable} 
                                        onClick={() => handleInsertVariable(variable)}
                                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200"
                                    >
                                        + {variable}
                                    </button>
                                ))}
                            </div>
                            <textarea 
                                ref={templateTextareaRef}
                                className="w-full border rounded p-2 dark:bg-gray-700 h-24" 
                                value={currentTemplate.template} 
                                onChange={e => setCurrentTemplate({...currentTemplate, template: e.target.value})}
                            />
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveTemplate}>Save Template</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Bulk Profile Modal */}
            {isBulkProfileModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkProfileModalOpen(false)}>
                    <div className="p-4 w-[600px] max-w-full">
                        <h3 className="text-lg font-bold mb-2">Bulk Add Profiles</h3>
                        <p className="text-xs text-gray-500 mb-2">Format: Name, Country, Currency (one per line)</p>
                        <textarea 
                            className="w-full border rounded p-2 h-48 dark:bg-gray-700 font-mono text-sm" 
                            placeholder={`John Doe, USA, USD\nAli Khan, Pakistan, PKR\nMaria, Germany, EUR`}
                            value={bulkProfileText}
                            onChange={e => setBulkProfileText(e.target.value)}
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsBulkProfileModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleBulkSaveProfiles}>Add Profiles</Button>
                        </div>
                    </div>
                </Modal>
            )}

             {/* Bulk Template Modal */}
             {isBulkTemplateModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkTemplateModalOpen(false)}>
                    <div className="p-4 w-[600px] max-w-full">
                        <h3 className="text-lg font-bold mb-2">Bulk Add Templates</h3>
                        <p className="text-xs text-gray-500 mb-2">Format: Type: Template Text (one per line). Types: joined, deposit, withdrawal, plan, transfer.</p>
                        <textarea 
                            className="w-full border rounded p-2 h-48 dark:bg-gray-700 font-mono text-sm" 
                            placeholder={`joined: {name} from {country} joined!\ndeposit: {name} deposited {amount}.`}
                            value={bulkTemplateText}
                            onChange={e => setBulkTemplateText(e.target.value)}
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsBulkTemplateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveBulkTemplates}>Add Templates</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Bulk Edit Profiles Modal */}
            {isBulkEditProfilesModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkEditProfilesModalOpen(false)}>
                    <div className="p-4 w-96">
                        <h3 className="text-lg font-bold mb-4">Bulk Edit {selectedProfileIds.length} Profiles</h3>
                        <p className="text-xs text-gray-500 mb-4">Only filled fields will be updated.</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold">Set Country</label>
                                <select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditProfileData.country || ''} onChange={e => setBulkEditProfileData({...bulkEditProfileData, country: e.target.value})}>
                                    <option value="">-- No Change --</option>
                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold">Set Currency</label>
                                <select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditProfileData.currency || ''} onChange={e => setBulkEditProfileData({...bulkEditProfileData, currency: e.target.value as Currency})}>
                                    <option value="">-- No Change --</option>
                                    <option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsBulkEditProfilesModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleBulkEditProfilesSave}>Apply Changes</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Bulk Edit Templates Modal */}
            {isBulkEditTemplatesModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkEditTemplatesModalOpen(false)}>
                    <div className="p-4 w-96">
                        <h3 className="text-lg font-bold mb-4">Bulk Edit {selectedTemplateIds.length} Templates</h3>
                        <p className="text-xs text-gray-500 mb-4">Only filled fields will be updated.</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold">Set Type</label>
                                <select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditTemplateData.type || ''} onChange={e => setBulkEditTemplateData({...bulkEditTemplateData, type: e.target.value})}>
                                    <option value="">-- No Change --</option>
                                    <option value="joined">New User Joined</option>
                                    <option value="deposit">Deposit</option>
                                    <option value="withdrawal">Withdrawal</option>
                                    <option value="transfer">Transfer</option>
                                    <option value="plan">Plan Purchase</option>
                                    <option value="commission">Commission Earned</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold">Set Status</label>
                                <select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditTemplateData.enabled || ''} onChange={e => setBulkEditTemplateData({...bulkEditTemplateData, enabled: e.target.value})}>
                                    <option value="">-- No Change --</option>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsBulkEditTemplatesModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleBulkEditTemplatesSave}>Apply Changes</Button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
};

export default TickerSettings;
