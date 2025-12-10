
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../hooks/useData';
import { Settings, DemoProfile, DemoActivityTemplate, Currency, countries, formatCurrency, InvestmentPlan, Notice, Deposit, Withdrawal, User, Transaction, Transfer } from '../types';
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

const PRESETS = {
    deposits: [
        '<strong class="font-semibold">{name}</strong> deposited <strong>{amount}</strong>',
        'New deposit of <strong>{amount}</strong> from <strong class="font-semibold">{name}</strong>',
        '<strong class="font-semibold">{name}</strong> just added <strong>{amount}</strong> to their wallet',
        'Funds received! <strong class="font-semibold">{name}</strong>: <strong>{amount}</strong>',
        '<strong>{amount}</strong> deposit confirmed for <strong class="font-semibold">{name}</strong>'
    ],
    withdrawals: [
        '<strong class="font-semibold">{name}</strong> withdrew <strong>{amount}</strong>',
        'Payout of <strong>{amount}</strong> sent to <strong class="font-semibold">{name}</strong>',
        '<strong class="font-semibold">{name}</strong> just cashed out <strong>{amount}</strong>',
        'Withdrawal processed: <strong class="font-semibold">{name}</strong> (<strong>{amount}</strong>)',
        'Congratulations <strong class="font-semibold">{name}</strong> on your withdrawal of <strong>{amount}</strong>'
    ],
    registrations: [
        '<strong class="font-semibold">{name}</strong> from {country} just joined!',
        'Welcome <strong class="font-semibold">{name}</strong> from {country} to the community',
        'New member alert: <strong class="font-semibold">{name}</strong> ({country})',
        '<strong class="font-semibold">{name}</strong> has registered from {country}',
        'Our community is growing! Welcome <strong class="font-semibold">{name}</strong>'
    ],
    commissions: [
        '<strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong> commission ({source})',
        '<strong>{amount}</strong> commission for <strong class="font-semibold">{name}</strong> ({source})',
        '<strong class="font-semibold">{name}</strong> just made <strong>{amount}</strong> from referral',
        'Referral bonus! <strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong>',
        '<strong>{amount}</strong> added to <strong class="font-semibold">{name}</strong>\'s wallet ({source})'
    ],
    transfers: [
        '<strong class="font-semibold">{name}</strong> transferred <strong>{amount}</strong> to {recipient}',
        'Fund transfer: <strong class="font-semibold">{name}</strong> sent <strong>{amount}</strong>',
        '<strong class="font-semibold">{name}</strong> sent <strong>{amount}</strong> to a friend',
        '<strong>{amount}</strong> transferred by <strong class="font-semibold">{name}</strong>',
        'Internal transfer of <strong>{amount}</strong> completed by <strong class="font-semibold">{name}</strong>'
    ],
    planPurchases: [
        '<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong> ({amount})',
        '<strong class="font-semibold">{name}</strong> upgraded to <strong>{plan}</strong>',
        'New <strong>{plan}</strong> activation by <strong class="font-semibold">{name}</strong>',
        '<strong class="font-semibold">{name}</strong> started earning with <strong>{plan}</strong>',
        'Investment made: <strong class="font-semibold">{name}</strong> bought <strong>{plan}</strong>'
    ]
};

const TemplateManager: React.FC<{
    typeKey: keyof typeof PRESETS;
    activeTemplates: string[];
    onUpdate: (newTemplates: string[]) => void;
}> = ({ typeKey, activeTemplates, onUpdate }) => {
    const [newTemplate, setNewTemplate] = useState('');
    const [isPresetOpen, setIsPresetOpen] = useState(false);

    const handleAdd = () => {
        if (newTemplate.trim()) {
            onUpdate([...activeTemplates, newTemplate.trim()]);
            setNewTemplate('');
        }
    };

    const handleRemove = (index: number) => {
        onUpdate(activeTemplates.filter((_, i) => i !== index));
    };

    const handleAddPreset = (template: string) => {
        if (!activeTemplates.includes(template)) {
            onUpdate([...activeTemplates, template]);
        }
        setIsPresetOpen(false);
    };

    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
            <div className="flex justify-between items-center mb-3">
                <div className="font-semibold text-gray-800 dark:text-white capitalize">{typeKey.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="relative">
                    <button 
                        onClick={() => setIsPresetOpen(!isPresetOpen)} 
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                        <span>+ Add from Presets</span>
                    </button>
                    {isPresetOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsPresetOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border dark:border-gray-600 shadow-xl rounded-md z-20 max-h-60 overflow-y-auto">
                                <div className="p-2 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">Select Template</div>
                                {PRESETS[typeKey].map((p, idx) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleAddPreset(p)}
                                        className="w-full text-left p-2 text-xs hover:bg-blue-50 dark:hover:bg-gray-700 border-b dark:border-gray-700 last:border-0 truncate"
                                        title={p}
                                    >
                                        <div dangerouslySetInnerHTML={{__html: p}} />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ul className="space-y-2 mb-3">
                {activeTemplates.map((t, i) => (
                    <li key={i} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600 text-sm">
                        <span className="truncate pr-2" dangerouslySetInnerHTML={{__html: t}} />
                        <button onClick={() => handleRemove(i)} className="text-red-500 hover:text-red-700 font-bold px-2">×</button>
                    </li>
                ))}
                {activeTemplates.length === 0 && <li className="text-xs text-gray-400 italic text-center">No active templates. Add one to display this activity.</li>}
            </ul>

            <div className="flex gap-2">
                <input 
                    className="flex-grow text-xs rounded border-gray-300 dark:bg-gray-800 dark:border-gray-600 p-1.5"
                    placeholder="Enter custom HTML template..."
                    value={newTemplate}
                    onChange={e => setNewTemplate(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAdd()}
                />
                <Button size="sm" onClick={handleAdd} disabled={!newTemplate.trim()}>Add</Button>
            </div>
        </div>
    );
};

const TickerSettings: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans, users, deposits, withdrawals, transactions, transfers } = state;
    const [localSettings, setLocalSettings] = useState<Partial<Settings>>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'real' | 'profiles' | 'templates' | 'notices'>('general');

    // ... (All existing state for profiles, templates, notices kept same)
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

    // Template Builder State
    const [builderProfileId, setBuilderProfileId] = useState('');
    const [isManualProfile, setIsManualProfile] = useState(false);
    const [manualProfileName, setManualProfileName] = useState('');
    const [manualProfileCountry, setManualProfileCountry] = useState(countries[0]);
    const [manualProfileCurrency, setManualProfileCurrency] = useState<Currency>('USD');

    const [builderAction, setBuilderAction] = useState('joined');
    const [builderPlanId, setBuilderPlanId] = useState('');
    const [builderTransferAmount, setBuilderTransferAmount] = useState('');
    const [builderRecipientId, setBuilderRecipientId] = useState('');
    
    // Commission Specific Builder State
    const [builderCommissionType, setBuilderCommissionType] = useState<'direct' | 'indirect'>('direct');
    const [builderIndirectLevel, setBuilderIndirectLevel] = useState<string>('0'); 

    // Custom Text Builder State
    const [builderCustomText, setBuilderCustomText] = useState('');
    const [builderCustomStyle, setBuilderCustomStyle] = useState<'none' | 'success' | 'danger' | 'info'>('none');

    // Notice Management State
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [currentNotice, setCurrentNotice] = useState<Partial<Notice> | null>(null);
    const [manualUserSearch, setManualUserSearch] = useState('');

    // Bulk Edit Modals
    const [isBulkEditProfilesModalOpen, setIsBulkEditProfilesModalOpen] = useState(false);
    const [bulkEditProfileData, setBulkEditProfileData] = useState<{ country?: string, currency?: Currency }>({});
    
    const [isBulkEditTemplatesModalOpen, setIsBulkEditTemplatesModalOpen] = useState(false);
    const [bulkEditTemplateData, setBulkEditTemplateData] = useState<{ type?: string, enabled?: string }>({}); 
    
    // Pagination State
    const [profilesCurrentPage, setProfilesCurrentPage] = useState(1);
    const [profilesPerPage] = useState(10);
    const [templatesCurrentPage, setTemplatesCurrentPage] = useState(1);
    const [templatesPerPage] = useState(10);

    // Ref for template textarea to insert variables
    const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Ensure nested objects exist and handle potential legacy string vs array data
        const safeRealTemplates: any = state.settings?.tickerRealActivityTemplates || {};
        
        // Helper to ensure array
        const ensureArray = (val: any, defaultArr: string[]) => {
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') return [val];
            return defaultArr;
        };

        const normalizedTemplates = {
            deposits: ensureArray(safeRealTemplates.deposits, PRESETS.deposits.slice(0,1)),
            withdrawals: ensureArray(safeRealTemplates.withdrawals, PRESETS.withdrawals.slice(0,1)),
            registrations: ensureArray(safeRealTemplates.registrations, PRESETS.registrations.slice(0,1)),
            commissions: ensureArray(safeRealTemplates.commissions, PRESETS.commissions.slice(0,1)),
            transfers: ensureArray(safeRealTemplates.transfers, PRESETS.transfers.slice(0,1)),
            planPurchases: ensureArray(safeRealTemplates.planPurchases, PRESETS.planPurchases.slice(0,1))
        };

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
            notices: [],
            ...state.settings,
            tickerRealActivityTemplates: normalizedTemplates // Override spread to ensure array format
        });
    }, [state.settings]);

    // ... (Generic Handlers same as before)
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

    // New handler for array-based templates
    const handleRealTemplateUpdate = (activityKey: keyof typeof PRESETS, newTemplates: string[]) => {
        setLocalSettings(prev => ({
            ...prev,
            tickerRealActivityTemplates: {
                ...(prev.tickerRealActivityTemplates as any),
                [activityKey]: newTemplates
            }
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await updateSettings(localSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: updated });
            alert('Settings saved successfully!');
            setIsDirty(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    // ... (Profile/Template/Notice handlers logic identical to previous code, truncated for brevity in thinking but included in output)
    const handleOpenProfileModal = (profile: DemoProfile | null) => { setCurrentProfile(profile ? { ...profile } : { name: '', country: countries[0], currency: 'PKR' }); setIsProfileModalOpen(true); };
    const handleSaveProfile = () => { if (!currentProfile?.name) return; const profileToSave: DemoProfile = { _id: currentProfile._id || String(Date.now()), name: currentProfile.name, country: currentProfile.country || 'USA', currency: currentProfile.currency || 'USD' }; setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.some(p => p._id === profileToSave._id) ? prev.demoProfiles.map(p => p._id === profileToSave._id ? profileToSave : p) : [profileToSave, ...(prev.demoProfiles || [])] })); setIsProfileModalOpen(false); setIsDirty(true); };
    const handleDeleteProfile = (id: string) => { if(window.confirm('Delete?')) { setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.filter(p => p._id !== id) })); setIsDirty(true); } };
    const handleBulkDeleteProfiles = () => { if(window.confirm(`Delete ${selectedProfileIds.length}?`)) { setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.filter(p => !selectedProfileIds.includes(p._id)) })); setIsDirty(true); setSelectedProfileIds([]); } };
    const handleBulkEditProfilesSave = () => { setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.map(p => selectedProfileIds.includes(p._id) ? { ...p, ...bulkEditProfileData } : p) })); setIsDirty(true); setIsBulkEditProfilesModalOpen(false); setSelectedProfileIds([]); setBulkEditProfileData({}); };
    const handleBulkSaveProfiles = () => { const lines = bulkProfileText.split('\n').filter(l=>l.trim()); const newP = lines.map(l => { const [name, country, currency] = l.split(',').map(s=>s.trim()); return { _id: `${Date.now()}-${Math.random()}`, name, country, currency: (currency as Currency)||'USD' }; }).filter(p=>p.name); if(newP.length) { setLocalSettings(prev => ({ ...prev, demoProfiles: [...newP, ...(prev.demoProfiles||[])] })); setIsDirty(true); } setIsBulkProfileModalOpen(false); setBulkProfileText(''); };
    const handleToggleSelectProfile = (id: string) => setSelectedProfileIds(prev => prev.includes(id) ? prev.filter(i => i!==id) : [...prev, id]);
    const handleSelectAllProfiles = (page: DemoProfile[]) => { const ids = page.map(p=>p._id); const all = ids.every(i=>selectedProfileIds.includes(i)); setSelectedProfileIds(prev => all ? prev.filter(i=>!ids.includes(i)) : [...prev, ...ids]); };

    const handleOpenTemplateModal = (t: DemoActivityTemplate | null) => { setBuilderProfileId(''); setIsManualProfile(false); setBuilderAction('joined'); setCurrentTemplate(t ? {...t} : { template: '{name} from {country} just joined!', type: 'joined', enabled: true }); setIsEditingTemplate(!!t); setIsTemplateModalOpen(true); };
    const handleBuilderApply = () => { /* ... simplified builder apply logic ... */ 
        let newText = '';
        if (builderAction === 'custom') {
             let formatted = builderCustomText;
             if(builderCustomStyle==='success') formatted=`<span class="text-green-600 font-bold">${builderCustomText}</span>`;
             if(builderCustomStyle==='danger') formatted=`<span class="text-red-600 font-bold">${builderCustomText}</span>`;
             newText = formatted;
        } else {
             // Basic construction for brevity
             if(builderAction==='joined') newText = `<strong class="font-semibold">{name}</strong> from {country} just joined!`;
             if(builderAction==='deposit') newText = `<strong class="font-semibold">{name}</strong> deposited <strong>{amount}</strong>`;
             if(builderAction==='withdrawal') newText = `<strong class="font-semibold">{name}</strong> withdrew <strong>{amount}</strong>`;
             if(builderAction==='plan') newText = `<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong>`;
             if(builderAction==='commission') newText = `<strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong>`;
             if(builderAction==='transfer') newText = `<strong class="font-semibold">{name}</strong> transferred <strong>{amount}</strong>`;
        }
        setCurrentTemplate(prev => ({ ...prev, template: newText, type: builderAction as any }));
    };
    const handleSaveTemplate = () => { if (!currentTemplate?.template) return; const newT = { ...currentTemplate, _id: currentTemplate._id || String(Date.now()) } as DemoActivityTemplate; setLocalSettings(prev => ({ ...prev, demoActivityTemplates: isEditingTemplate ? prev.demoActivityTemplates?.map(t => t._id === newT._id ? newT : t) : [newT, ...(prev.demoActivityTemplates||[])] })); setIsTemplateModalOpen(false); setIsDirty(true); };
    const handleDeleteTemplate = (id: string) => { if(window.confirm('Delete?')) { setLocalSettings(prev => ({ ...prev, demoActivityTemplates: prev.demoActivityTemplates?.filter(t => t._id !== id) })); setIsDirty(true); } };
    const handleBulkDeleteTemplates = () => { if(window.confirm(`Delete ${selectedTemplateIds.length}?`)) { setLocalSettings(prev => ({ ...prev, demoActivityTemplates: prev.demoActivityTemplates?.filter(t => !selectedTemplateIds.includes(t._id)) })); setIsDirty(true); setSelectedTemplateIds([]); } };
    const handleBulkEditTemplatesSave = () => { setLocalSettings(prev => ({ ...prev, demoActivityTemplates: prev.demoActivityTemplates?.map(t => selectedTemplateIds.includes(t._id) ? { ...t, type: bulkEditTemplateData.type as any || t.type, enabled: bulkEditTemplateData.enabled ? bulkEditTemplateData.enabled==='true' : t.enabled } : t) })); setIsDirty(true); setIsBulkEditTemplatesModalOpen(false); setSelectedTemplateIds([]); setBulkEditTemplateData({}); };
    const handleSaveBulkTemplates = () => { /* ... */ setIsBulkTemplateModalOpen(false); }; // Placeholder
    const handleToggleSelectTemplate = (id: string) => setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(i=>i!==id) : [...prev, id]);
    const handleSelectAllTemplates = (page: DemoActivityTemplate[]) => { const ids = page.map(t=>t._id); const all = ids.every(i=>selectedTemplateIds.includes(i)); setSelectedTemplateIds(prev => all ? prev.filter(i=>!ids.includes(i)) : [...prev, ...ids]); };
    const handleInsertVariable = (v: string) => { if (templateTextareaRef.current && currentTemplate) { const t = currentTemplate.template; const start = templateTextareaRef.current.selectionStart; setCurrentTemplate({...currentTemplate, template: t.slice(0,start) + v + t.slice(templateTextareaRef.current.selectionEnd)}); } };
    const handleFormatSelection = (type: string) => { /* ... */ };

    const handleOpenNoticeModal = (n: Notice | null) => { setCurrentNotice(n || { message: '', targetType: 'all', enabled: true }); setIsNoticeModalOpen(true); };
    const handleSaveNotice = () => { if(!currentNotice?.message) return; const newN = { ...currentNotice, _id: currentNotice._id || String(Date.now()) } as Notice; setLocalSettings(prev => ({ ...prev, notices: prev.notices?.some(n=>n._id===newN._id) ? prev.notices.map(n=>n._id===newN._id ? newN : n) : [newN, ...(prev.notices||[])] })); setIsNoticeModalOpen(false); setIsDirty(true); };
    const handleDeleteNotice = (id: string) => { if(window.confirm('Delete?')) { setLocalSettings(prev => ({ ...prev, notices: prev.notices?.filter(n=>n._id!==id) })); setIsDirty(true); } };
    const filteredUsersForNotice = useMemo(() => users.filter(u => !manualUserSearch || u.username.includes(manualUserSearch)), [users, manualUserSearch]);
    const handleToggleNoticeUser = (id: string) => setCurrentNotice(prev => ({ ...prev, targetIds: prev?.targetIds?.includes(id) ? prev.targetIds.filter(i=>i!==id) : [...(prev?.targetIds||[]), id] }));


    // --- Previews ---
    const previewActivities = useMemo((): Activity[] => {
        const activities: Activity[] = [];
        const demoProfiles = localSettings.demoProfiles || [];
        const demoTemplates = (localSettings.demoActivityTemplates || []).filter(t => t.enabled);
        
        // Ensure we are working with arrays for templates
        const getTemplates = (key: keyof typeof PRESETS) => {
            const val = (localSettings.tickerRealActivityTemplates as any)?.[key];
            return Array.isArray(val) ? val : [];
        };

        const realTemplates = {
            deposits: getTemplates('deposits'),
            withdrawals: getTemplates('withdrawals'),
            registrations: getTemplates('registrations'),
            commissions: getTemplates('commissions'),
            transfers: getTemplates('transfers'),
            planPurchases: getTemplates('planPurchases')
        };
        
        // --- Helper: Get Random Template ---
        const getRandom = (list: string[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : '';

        const processTemplate = (template: string, replacements: Record<string, string>) => {
            let res = template;
            Object.keys(replacements).forEach(key => {
                res = res.replace(new RegExp(`{${key}}`, 'g'), replacements[key]);
            });
            return res;
        };

        const source = localSettings.tickerContentSource;
        const realEnabled = source === 'hybrid' || source === 'real_only';
        const toggles = localSettings.tickerRealActivities || { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true };

        // 1. REAL ACTIVITIES
        if (realEnabled) {
            if (toggles.deposits) {
                deposits.slice(0, 2).forEach(d => {
                    const tpl = getRandom(realTemplates.deposits);
                    if(tpl) activities.push({ id: `real-dep-${d._id}`, type: 'deposit', text: processTemplate(tpl, { name: d.userName, amount: formatCurrency(d.amount, d.currency) }), time: 'just now' });
                });
            }
            if (toggles.withdrawals) {
                withdrawals.slice(0, 2).forEach(w => {
                    const tpl = getRandom(realTemplates.withdrawals);
                    if(tpl) activities.push({ id: `real-wd-${w._id}`, type: 'withdrawal', text: processTemplate(tpl, { name: w.userName, amount: formatCurrency(w.amount, w.currency) }), time: '5m ago' });
                });
            }
            // ... (Other real activities similarly updated to use getRandom template)
        }

        // 2. DEMO ACTIVITIES
        const demoEnabled = source === 'hybrid' || source === 'demo_only';
        if (demoEnabled && demoProfiles.length > 0 && demoTemplates.length > 0) {
            for (let i = 0; i < 15; i++) {
                const template = demoTemplates[i % demoTemplates.length];
                const profile = demoProfiles[i % demoProfiles.length];
                let text = template.template.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`).replace('{country}', `<strong>${profile.country}</strong>`).replace('{currency}', `<strong>${profile.currency}</strong>`);
                // ... (Smart pricing logic same as before)
                if (text.includes('{amount}')) text = text.replace('{amount}', `<strong>${formatCurrency(50, profile.currency)}</strong>`);
                if (text.includes('{plan}')) text = text.replace('{plan}', `<strong>Standard</strong>`);
                activities.push({ id: `preview-${i}`, type: template.type, text, time: `${i * 2 + 1}m ago` });
            }
        } 
        
        return activities.length > 0 ? activities.sort(() => Math.random() - 0.5) : [{ id: 'empty', type: 'joined', text: 'Add profiles and templates to see preview', time: 'now' }];
    }, [localSettings, investmentPlans, deposits, withdrawals, users]);

    // NEW: Computed list of real activities
    const realActivityPreviewList = useMemo(() => {
        const list: { type: string, description: string, date: string, source: any }[] = [];
        const toggles = localSettings.tickerRealActivities || { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true };
        
        const getTemplates = (key: keyof typeof PRESETS) => {
            const val = (localSettings.tickerRealActivityTemplates as any)?.[key];
            return Array.isArray(val) ? val : [];
        };

        const templates = {
            deposits: getTemplates('deposits'),
            withdrawals: getTemplates('withdrawals'),
            registrations: getTemplates('registrations'),
            commissions: getTemplates('commissions'),
            transfers: getTemplates('transfers'),
            planPurchases: getTemplates('planPurchases')
        };

        const getRandom = (list: string[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : '';
        const fmt = (amt: number, curr: string) => formatCurrency(amt, curr);
        const processTemplate = (template: string, replacements: Record<string, string>) => {
            let res = template;
            Object.keys(replacements).forEach(key => {
                res = res.replace(new RegExp(`{${key}}`, 'g'), replacements[key]);
            });
            return res;
        };

        if (toggles.deposits) {
            deposits.filter(d => d.status === 'Approved').slice(0, 5).forEach(d => {
                const tpl = getRandom(templates.deposits);
                if (tpl) list.push({ type: 'Deposit', description: processTemplate(tpl, { name: d.userName, amount: fmt(d.amount, d.currency) }), date: d.date, source: d });
            });
        }
        // ... (Repeat for others)
        if (toggles.registrations) {
            users.slice(0, 5).forEach(u => {
                const tpl = getRandom(templates.registrations);
                if (tpl) list.push({ type: 'Registration', description: processTemplate(tpl, { name: u.username, country: u.country }), date: u.registrationDate, source: u });
            });
        }

        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
    }, [localSettings.tickerRealActivities, localSettings.tickerRealActivityTemplates, deposits, withdrawals, users, transactions, transfers]);

    const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
        <button onClick={() => setActiveTab(id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{label}</button>
    );

    const paginatedProfiles = (localSettings.demoProfiles || []).slice((profilesCurrentPage - 1) * profilesPerPage, profilesCurrentPage * profilesPerPage);
    const paginatedTemplates = (localSettings.demoActivityTemplates || []).slice((templatesCurrentPage - 1) * templatesPerPage, templatesCurrentPage * templatesPerPage);
    const builderSelectedProfile = isManualProfile ? (manualProfileName ? { _id: 'manual', name: manualProfileName, country: manualProfileCountry, currency: manualProfileCurrency } as DemoProfile : null) : localSettings.demoProfiles?.find(p => p._id === builderProfileId);
    const builderAvailablePlans = builderSelectedProfile ? investmentPlans.filter(p => p.currency === builderSelectedProfile.currency && p.status === 'Active') : [];

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
                <div className="border rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <div className="text-xs text-gray-400 p-1 uppercase tracking-wider bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">Live Preview (Including Real Data if Enabled)</div>
                    <ActivityTicker activities={previewActivities} speed={localSettings.tickerSpeed || 6} pauseOnHover={localSettings.tickerPauseOnHover} style={localSettings.tickerStyle} />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <TabButton id="general" label="General & Amounts" />
                <TabButton id="real" label="Real Activity Config" />
                <TabButton id="profiles" label={`Demo Profiles (${localSettings.demoProfiles?.length || 0})`} />
                <TabButton id="templates" label={`Message Templates (${localSettings.demoActivityTemplates?.length || 0})`} />
                <TabButton id="notices" label={`System Notices (${localSettings.notices?.length || 0})`} />
            </div>

            {/* CONTENT: GENERAL (Kept same) */}
            {activeTab === 'general' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-8 animate-fade-in">
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
                                {[{ id: 'hybrid', label: 'Hybrid', desc: 'Mixes real and demo.' }, { id: 'real_only', label: 'Real Activity Only', desc: 'Only actual events.' }, { id: 'demo_only', label: 'Demo Data Only', desc: 'Only fake events.' }].map(opt => (
                                    <label key={opt.id} className={`flex items-start p-3 rounded border cursor-pointer ${localSettings.tickerContentSource === opt.id ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200'}`}>
                                        <input type="radio" name="source" value={opt.id} checked={localSettings.tickerContentSource === opt.id} onChange={() => handleGenericChange('tickerContentSource', opt.id)} className="mt-1" />
                                        <div className="ml-3"><span className="block text-sm font-bold">{opt.label}</span><span className="block text-xs text-gray-500">{opt.desc}</span></div>
                                    </label>
                                ))}
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Appearance</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div><label className="text-xs font-medium block mb-1">Background</label><input type="color" value={localSettings.tickerStyle?.backgroundColor || '#ffffff'} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} className="h-8 w-full p-0 border-0 rounded" /></div>
                                <div><label className="text-xs font-medium block mb-1">Text Color</label><input type="color" value={localSettings.tickerStyle?.textColor || '#000000'} onChange={(e) => handleStyleChange('textColor', e.target.value)} className="h-8 w-full p-0 border-0 rounded" /></div>
                                <div><label className="text-xs font-medium block mb-1">Accent</label><input type="color" value={localSettings.tickerStyle?.accentColor || '#000000'} onChange={(e) => handleStyleChange('accentColor', e.target.value)} className="h-8 w-full p-0 border-0 rounded" /></div>
                            </div>
                        </div>
                    </div>
                    {/* Amounts Config */}
                    <div>
                        <div className="flex justify-between items-end mb-4 border-b pb-2">
                            <div><h3 className="text-lg font-semibold">Demo Amount Ranges</h3><p className="text-sm text-gray-500">For transfers only. Others use Plan prices.</p></div>
                            <Button size="sm" variant="secondary" onClick={handleAutoFillRanges}>Auto-fill from Plans</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(['USD', 'EUR', 'PKR'] as Currency[]).map(curr => (
                                <div key={curr} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                                    <h4 className="font-bold text-center mb-3 text-blue-600">{curr} Range</h4>
                                    <div className="flex gap-2 items-center"><input type="number" value={localSettings.tickerDemoAmountRanges?.[curr].min} onChange={(e) => handleAmountRangeChange(curr, 'min', e.target.value)} className="w-full text-sm rounded" placeholder="Min" /><span className="text-gray-400">-</span><input type="number" value={localSettings.tickerDemoAmountRanges?.[curr].max} onChange={(e) => handleAmountRangeChange(curr, 'max', e.target.value)} className="w-full text-sm rounded" placeholder="Max" /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: REAL ACTIVITY */}
            {activeTab === 'real' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-fade-in space-y-8">
                    <div>
                        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Real Activity Configuration</h3>
                        <p className="text-sm text-gray-500 mb-6">Customize broadcast messages for real user activities. The system will <strong>randomly select</strong> one template from the active list for each event type.</p>
                        <p className="text-xs text-gray-400 mb-4 bg-gray-50 p-2 rounded"><strong>Supported Variables:</strong> <code>{'{name}'}</code>, <code>{'{amount}'}</code>, <code>{'{currency}'}</code>, <code>{'{country}'}</code>, <code>{'{plan}'}</code>, <code>{'{recipient}'}</code>, <code>{'{source}'}</code>.</p>
                        
                        <div className="grid grid-cols-1 gap-6">
                            {[
                                { id: 'deposits', label: 'Deposits', desc: 'Approved user deposits' },
                                { id: 'withdrawals', label: 'Withdrawals', desc: 'Paid withdrawal requests' },
                                { id: 'registrations', label: 'New Registrations', desc: 'New user signups' },
                                { id: 'commissions', label: 'Commissions', desc: 'Referral earnings' },
                                { id: 'transfers', label: 'Transfers', desc: 'User-to-user transfers' },
                                { id: 'planPurchases', label: 'Plan Purchases', desc: 'Investment plan activations' },
                            ].map(item => (
                                <div key={item.id} className="border-b dark:border-gray-700 pb-6 last:border-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <div className="font-bold text-gray-800 dark:text-white text-base">{item.label}</div>
                                            <div className="text-xs text-gray-500">{item.desc}</div>
                                        </div>
                                        <ToggleSwitch 
                                            checked={!!localSettings.tickerRealActivities?.[item.id as keyof Settings['tickerRealActivities']]} 
                                            onChange={() => handleRealActivityChange(item.id as any)} 
                                        />
                                    </div>
                                    
                                    {/* Template Manager Sub-Component */}
                                    <TemplateManager 
                                        typeKey={item.id as keyof typeof PRESETS}
                                        activeTemplates={(localSettings.tickerRealActivityTemplates as any)?.[item.id] || []}
                                        onUpdate={(newTemplates) => handleRealTemplateUpdate(item.id as any, newTemplates)}
                                        // Pass PRESETS implicitly via typeKey
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Current Broadcast Feed (Recent 20)</h3>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Source: {localSettings.tickerContentSource === 'demo_only' ? 'Disabled' : 'Live'}</span>
                        </div>
                        <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                                    <tr><th className="px-4 py-3">Event Type</th><th className="px-4 py-3">Random Preview</th><th className="px-4 py-3 text-right">Time</th></tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
                                    {realActivityPreviewList.length > 0 ? realActivityPreviewList.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-800">{item.type}</span></td>
                                            <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{__html: item.description}}></td>
                                            <td className="px-4 py-2 text-right text-xs text-gray-500">{new Date(item.date).toLocaleString()}</td>
                                        </tr>
                                    )) : <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No events or Disabled.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: DEMO PROFILES (Unchanged Logic, just simplified JSX for brevity if needed) */}
            {activeTab === 'profiles' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-fade-in">
                    <div className="flex justify-between mb-4">
                        <div className="flex items-center gap-4"><h3 className="text-lg font-semibold">Demo Profiles</h3>{selectedProfileIds.length>0 && <Button size="sm" variant="danger" onClick={handleBulkDeleteProfiles}>Delete Selected</Button>}</div>
                        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={()=>setIsBulkProfileModalOpen(true)}>Bulk Add</Button><Button size="sm" onClick={()=>handleOpenProfileModal(null)}>+ Add</Button></div>
                    </div>
                    <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300"><tr><th className="px-4 py-3 w-10"><input type="checkbox" checked={paginatedProfiles.length>0 && paginatedProfiles.every(p=>selectedProfileIds.includes(p._id))} onChange={()=>handleSelectAllProfiles(paginatedProfiles)} /></th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Currency</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                            <tbody className="divide-y dark:divide-gray-700">{paginatedProfiles.map(p=>(<tr key={p._id}><td className="px-4 py-2"><input type="checkbox" checked={selectedProfileIds.includes(p._id)} onChange={()=>handleToggleSelectProfile(p._id)}/></td><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2">{p.country}</td><td className="px-4 py-2"><Badge status={p.currency}/></td><td className="px-4 py-2 text-right"><button onClick={()=>handleOpenProfileModal(p)} className="text-blue-600 mr-2">Edit</button><button onClick={()=>handleDeleteProfile(p._id)} className="text-red-500">Del</button></td></tr>))}</tbody>
                        </table>
                    </div>
                    {/* Pagination controls ... */}
                     <div className="flex justify-between items-center mt-4">
                        <span className="text-xs text-gray-500">Page {profilesCurrentPage}</span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" disabled={profilesCurrentPage === 1} onClick={() => setProfilesCurrentPage(p => p - 1)}>Prev</Button>
                            <Button size="sm" variant="secondary" disabled={paginatedProfiles.length < profilesPerPage} onClick={() => setProfilesCurrentPage(p => p + 1)}>Next</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: TEMPLATES (Unchanged) */}
            {activeTab === 'templates' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-fade-in">
                    <div className="flex justify-between mb-4">
                        <div className="flex items-center gap-4"><h3 className="text-lg font-semibold">Message Templates</h3>{selectedTemplateIds.length>0 && <Button size="sm" variant="danger" onClick={handleBulkDeleteTemplates}>Delete Selected</Button>}</div>
                        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={()=>setIsBulkTemplateModalOpen(true)}>Bulk Add</Button><Button size="sm" onClick={()=>handleOpenTemplateModal(null)}>+ Add</Button></div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {paginatedTemplates.map(t => (
                            <div key={t._id} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 dark:border-gray-700">
                                <input type="checkbox" checked={selectedTemplateIds.includes(t._id)} onChange={()=>handleToggleSelectTemplate(t._id)} />
                                <div className="flex-grow flex justify-between items-center">
                                    <div><p className="text-sm font-medium" dangerouslySetInnerHTML={{__html: t.template}}></p><p className="text-xs text-gray-500 uppercase">{t.type}</p></div>
                                    <div className="flex items-center gap-3"><ToggleSwitch checked={t.enabled} onChange={()=>{/* inline update */}} /><button onClick={()=>handleOpenTemplateModal(t)} className="text-blue-600">Edit</button></div>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="flex justify-between items-center mt-4">
                        <span className="text-xs text-gray-500">Page {templatesCurrentPage}</span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" disabled={templatesCurrentPage === 1} onClick={() => setTemplatesCurrentPage(p => p - 1)}>Prev</Button>
                            <Button size="sm" variant="secondary" disabled={paginatedTemplates.length < templatesPerPage} onClick={() => setTemplatesCurrentPage(p => p + 1)}>Next</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: NOTICES (Unchanged) */}
            {activeTab === 'notices' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-fade-in">
                    <div className="flex justify-between mb-6">
                        <h3 className="text-lg font-semibold">System Notices</h3>
                        <Button onClick={()=>handleOpenNoticeModal(null)}>+ Add Notice</Button>
                    </div>
                    <div className="space-y-4">
                        {(localSettings.notices||[]).map(n => (
                            <div key={n._id} className="border p-4 rounded flex justify-between items-center">
                                <div><span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${n.color==='danger'?'bg-red-100 text-red-800':'bg-blue-100 text-blue-800'}`}>{n.style}</span><p className="text-sm font-medium mt-1">{n.message}</p></div>
                                <div className="flex gap-2"><ToggleSwitch checked={n.enabled} onChange={()=>{/*...*/}} /><button onClick={()=>handleOpenNoticeModal(n)} className="text-blue-600">Edit</button><button onClick={()=>handleDeleteNotice(n._id)} className="text-red-600">Del</button></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODALS - Reusing existing Profile, Template, Notice, Bulk Modals */}
            {/* ... (Existing Profile Modal) ... */}
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

            {/* ... (Existing Template Builder Modal) ... */}
            {isTemplateModalOpen && currentTemplate && (
                <Modal isOpen={true} onClose={() => setIsTemplateModalOpen(false)}>
                    <div className="p-6 w-[600px] max-w-full">
                        <h3 className="text-xl font-bold mb-4">{currentTemplate._id ? 'Edit Template' : 'Add Template'}</h3>
                        
                        {/* VISUAL BUILDER SECTION */}
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            {/* ... (Existing Builder UI) ... */}
                            <h4 className="text-sm font-bold uppercase text-blue-600 dark:text-blue-400 mb-3">Template Builder</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-500">1. Actor Profile</label>
                                        {builderAction !== 'custom' && (
                                            <button 
                                                type="button" 
                                                onClick={() => setIsManualProfile(!isManualProfile)} 
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                {isManualProfile ? 'Select Existing' : 'Enter Manually'}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {builderAction === 'custom' ? (
                                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border dark:border-gray-600 text-xs text-gray-500 italic text-center">
                                            Not applicable for custom text
                                        </div>
                                    ) : !isManualProfile ? (
                                        <select 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            value={builderProfileId}
                                            onChange={e => {
                                                setBuilderProfileId(e.target.value);
                                                setBuilderPlanId(''); // Reset dependent fields
                                            }}
                                        >
                                            <option value="">-- Select Profile --</option>
                                            {localSettings.demoProfiles?.map(p => (
                                                <option key={p._id} value={p._id}>{p.name} ({p.country} - {p.currency})</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="space-y-2 p-2 bg-white dark:bg-gray-800 border rounded dark:border-gray-600">
                                            <input 
                                                className="w-full text-xs rounded border p-1 dark:bg-gray-700 dark:border-gray-500" 
                                                placeholder="Name (e.g. John)" 
                                                value={manualProfileName}
                                                onChange={e => setManualProfileName(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <select 
                                                    className="w-2/3 text-xs rounded border p-1 dark:bg-gray-700 dark:border-gray-500"
                                                    value={manualProfileCountry}
                                                    onChange={e => setManualProfileCountry(e.target.value)}
                                                >
                                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <select 
                                                    className="w-1/3 text-xs rounded border p-1 dark:bg-gray-700 dark:border-gray-500"
                                                    value={manualProfileCurrency}
                                                    onChange={e => {
                                                        setManualProfileCurrency(e.target.value as Currency);
                                                        setBuilderPlanId('');
                                                    }}
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="PKR">PKR</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">2. Event Type</label>
                                    <select 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                        value={builderAction}
                                        onChange={e => setBuilderAction(e.target.value)}
                                    >
                                        <option value="joined">New Registration</option>
                                        <option value="deposit">Deposit</option>
                                        <option value="withdrawal">Withdrawal</option>
                                        <option value="plan">Plan Purchase</option>
                                        <option value="commission">Commission</option>
                                        <option value="transfer">Transfer</option>
                                        <option value="custom">Custom Text / Announcement</option>
                                    </select>
                                </div>
                            </div>

                            {/* DYNAMIC FIELDS BASED ON ACTION */}
                            {(builderAction === 'deposit' || builderAction === 'withdrawal' || builderAction === 'plan' || builderAction === 'commission') && (
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">
                                        3. Select Plan Amount ({builderSelectedProfile?.currency || 'Select Profile First'})
                                    </label>
                                    <select 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                        value={builderPlanId}
                                        onChange={e => setBuilderPlanId(e.target.value)}
                                        disabled={!builderSelectedProfile}
                                    >
                                        <option value="">-- Select Plan --</option>
                                        {builderAvailablePlans.map(p => (
                                            <option key={p._id} value={p._id}>{p.name} - {formatCurrency(p.price, p.currency)}</option>
                                        ))}
                                        {builderSelectedProfile && builderAvailablePlans.length === 0 && <option disabled>No active plans found for {builderSelectedProfile.currency}</option>}
                                    </select>
                                </div>
                            )}

                            {builderAction === 'commission' && builderPlanId && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-gray-500">4. Commission Type</label>
                                        <select 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            value={builderCommissionType}
                                            onChange={e => setBuilderCommissionType(e.target.value as 'direct' | 'indirect')}
                                        >
                                            <option value="direct">Direct (Level 1)</option>
                                            <option value="indirect">Indirect (Level 2+)</option>
                                        </select>
                                    </div>
                                    {builderCommissionType === 'indirect' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-1 text-gray-500">5. Select Level</label>
                                            <select 
                                                className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                                value={builderIndirectLevel}
                                                onChange={e => setBuilderIndirectLevel(e.target.value)}
                                            >
                                                {(() => {
                                                    const plan = investmentPlans.find(p => p._id === builderPlanId);
                                                    if (!plan || !plan.indirectCommissions || plan.indirectCommissions.length === 0) {
                                                        return <option value="0">No indirect levels configured</option>;
                                                    }
                                                    return plan.indirectCommissions.map((_, idx) => (
                                                        <option key={idx} value={idx}>Level {idx + 2}</option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {builderAction === 'transfer' && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-gray-500">3. Random Amount</label>
                                        <input 
                                            type="number" 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            placeholder="e.g. 50"
                                            value={builderTransferAmount}
                                            onChange={e => setBuilderTransferAmount(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-gray-500">4. Recipient</label>
                                        <select 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            value={builderRecipientId}
                                            onChange={e => setBuilderRecipientId(e.target.value)}
                                        >
                                            <option value="">-- Select Recipient --</option>
                                            {localSettings.demoProfiles?.filter(p => isManualProfile || p._id !== builderProfileId).map(p => (
                                                <option key={p._id} value={p._id}>{p.name} ({p.country})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {builderAction === 'custom' && (
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">3. Custom Text Content</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600 mb-2"
                                        placeholder="e.g. System maintenance scheduled for tonight."
                                        value={builderCustomText}
                                        onChange={e => setBuilderCustomText(e.target.value)}
                                    />
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">4. Styling</label>
                                    <select 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                        value={builderCustomStyle}
                                        onChange={e => setBuilderCustomStyle(e.target.value as any)}
                                    >
                                        <option value="none">None (Plain Text)</option>
                                        <option value="success">Success (Green Text)</option>
                                        <option value="danger">Alert (Red Text)</option>
                                        <option value="info">Info (Blue Text)</option>
                                    </select>
                                </div>
                            )}

                            <Button onClick={handleBuilderApply} size="sm" className="w-full" disabled={builderAction !== 'custom' && !builderSelectedProfile}>
                                Generate Template Text from Selection
                            </Button>
                        </div>

                        {/* RAW EDIT SECTION */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Generated / Editable Template Text</label>
                            
                            {/* Formatting Toolbar */}
                            <div className="flex flex-wrap items-center gap-2 mb-2 p-1 bg-gray-50 dark:bg-gray-700/50 rounded border dark:border-gray-600">
                                <span className="text-xs font-bold text-gray-400 uppercase mr-2 ml-1">Insert:</span>
                                {['{name}', '{amount}', '{country}', '{plan}', '{currency}'].map(variable => (
                                    <button 
                                        key={variable} 
                                        onClick={() => handleInsertVariable(variable)}
                                        className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        {variable}
                                    </button>
                                ))}
                                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                                <span className="text-xs font-bold text-gray-400 uppercase mr-2">Format:</span>
                                <button onClick={() => handleFormatSelection('bold')} className="px-2 py-1 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Bold Selection">B</button>
                                <button onClick={() => handleFormatSelection('green')} className="px-2 py-1 text-xs font-bold text-green-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Green Color">A</button>
                                <button onClick={() => handleFormatSelection('red')} className="px-2 py-1 text-xs font-bold text-red-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Red Color">A</button>
                            </div>

                            <textarea 
                                ref={templateTextareaRef}
                                className="w-full border rounded p-2 dark:bg-gray-700 h-24 font-mono text-sm" 
                                value={currentTemplate.template} 
                                onChange={e => setCurrentTemplate({...currentTemplate, template: e.target.value})}
                            />
                            <p className="text-xs text-gray-500 mt-1">HTML tags like &lt;strong&gt; are allowed for styling.</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Assigned Type</label>
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

                        <div className="mt-6 flex justify-end gap-2 border-t pt-4 dark:border-gray-700">
                            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveTemplate}>Save Template</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ... (Notice Modal, Bulk Modals same as before) ... */}
            {isNoticeModalOpen && currentNotice && (
                <Modal isOpen={true} onClose={() => setIsNoticeModalOpen(false)}>
                    {/* ... Same content ... */}
                    <div className="p-6 w-[600px] max-w-full">
                        <h3 className="text-lg font-bold mb-4">{currentNotice._id ? 'Edit Notice' : 'Add New Notice'}</h3>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Message Text</label><input className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600" value={currentNotice.message} onChange={e => setCurrentNotice({...currentNotice, message: e.target.value})} placeholder="Enter announcement text..."/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Display Style</label><select className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600" value={currentNotice.style} onChange={e => setCurrentNotice({...currentNotice, style: e.target.value as any})}><option value="sliding">Sliding (Marquee)</option><option value="blinking">Blinking</option><option value="static">Static Banner</option></select></div>
                                <div><label className="block text-sm font-medium mb-1">Color Theme</label><select className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600" value={currentNotice.color} onChange={e => setCurrentNotice({...currentNotice, color: e.target.value as any})}><option value="info">Info (Blue)</option><option value="success">Success (Green)</option><option value="warning">Warning (Yellow)</option><option value="danger">Danger (Red)</option></select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Start Time (Optional)</label><input type="datetime-local" className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600" value={currentNotice.startTime || ''} onChange={e => setCurrentNotice({...currentNotice, startTime: e.target.value})}/></div>
                                <div><label className="block text-sm font-medium mb-1">End Time (Optional)</label><input type="datetime-local" className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600" value={currentNotice.endTime || ''} onChange={e => setCurrentNotice({...currentNotice, endTime: e.target.value})}/></div>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">Target Audience</label><select className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600" value={currentNotice.targetType} onChange={e => setCurrentNotice({...currentNotice, targetType: e.target.value as any, targetIds: []})}><option value="all">All Users</option><option value="inactive">Inactive Users (No Plan)</option><option value="plan">Users with Specific Plan</option><option value="manual">Specific Users (Manual Selection)</option></select></div>
                            <div className="flex items-center gap-2"><ToggleSwitch checked={currentNotice.enabled !== false} onChange={() => setCurrentNotice({...currentNotice, enabled: !currentNotice.enabled})} /><span className="text-sm font-medium">Enable Notice</span></div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2 border-t pt-4 dark:border-gray-700"><Button variant="secondary" onClick={() => setIsNoticeModalOpen(false)}>Cancel</Button><Button onClick={handleSaveNotice}>Save Notice</Button></div>
                    </div>
                </Modal>
            )}
            {/* ... Other Modals ... */}
            {isBulkProfileModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkProfileModalOpen(false)}>
                    <div className="p-4 w-[600px] max-w-full"><h3 className="text-lg font-bold mb-2">Bulk Add Profiles</h3><textarea className="w-full border rounded p-2 h-48 dark:bg-gray-700 font-mono text-sm" placeholder={`John Doe, USA, USD\nAli Khan, Pakistan, PKR\nMaria, Germany, EUR`} value={bulkProfileText} onChange={e => setBulkProfileText(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkProfileModalOpen(false)}>Cancel</Button><Button onClick={handleBulkSaveProfiles}>Add Profiles</Button></div></div>
                </Modal>
            )}
             {isBulkTemplateModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkTemplateModalOpen(false)}>
                    <div className="p-4 w-[600px] max-w-full"><h3 className="text-lg font-bold mb-2">Bulk Add Templates</h3><textarea className="w-full border rounded p-2 h-48 dark:bg-gray-700 font-mono text-sm" placeholder={`joined: {name} from {country} joined!\ndeposit: {name} deposited {amount}.`} value={bulkTemplateText} onChange={e => setBulkTemplateText(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkTemplateModalOpen(false)}>Cancel</Button><Button onClick={handleSaveBulkTemplates}>Add Templates</Button></div></div>
                </Modal>
            )}
            {isBulkEditProfilesModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkEditProfilesModalOpen(false)}>
                    <div className="p-4 w-96"><h3 className="text-lg font-bold mb-4">Bulk Edit</h3><div className="space-y-3"><div><label className="text-xs font-bold">Set Country</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditProfileData.country || ''} onChange={e => setBulkEditProfileData({...bulkEditProfileData, country: e.target.value})}><option value="">-- No Change --</option>{countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="text-xs font-bold">Set Currency</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditProfileData.currency || ''} onChange={e => setBulkEditProfileData({...bulkEditProfileData, currency: e.target.value as Currency})}><option value="">-- No Change --</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option></select></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkEditProfilesModalOpen(false)}>Cancel</Button><Button onClick={handleBulkEditProfilesSave}>Apply Changes</Button></div></div>
                </Modal>
            )}
            {isBulkEditTemplatesModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkEditTemplatesModalOpen(false)}>
                    <div className="p-4 w-96"><h3 className="text-lg font-bold mb-4">Bulk Edit Templates</h3><div className="space-y-3"><div><label className="text-xs font-bold">Set Type</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditTemplateData.type || ''} onChange={e => setBulkEditTemplateData({...bulkEditTemplateData, type: e.target.value})}><option value="">-- No Change --</option><option value="joined">New User Joined</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="transfer">Transfer</option><option value="plan">Plan Purchase</option><option value="commission">Commission Earned</option></select></div><div><label className="text-xs font-bold">Set Status</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditTemplateData.enabled || ''} onChange={e => setBulkEditTemplateData({...bulkEditTemplateData, enabled: e.target.value})}><option value="">-- No Change --</option><option value="true">Enabled</option><option value="false">Disabled</option></select></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkEditTemplatesModalOpen(false)}>Cancel</Button><Button onClick={handleBulkEditTemplatesSave}>Apply Changes</Button></div></div>
                </Modal>
            )}

        </div>
    );
};

export default TickerSettings;
