
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
        <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
);

const TickerSettings: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans } = state;
    const [localSettings, setLocalSettings] = useState<Partial<Settings>>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

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
    const [previewProfileId, setPreviewProfileId] = useState<string>('');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
    
    // Template Filter States
    const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [templateTypeFilter, setTemplateTypeFilter] = useState<string>('all');


    // Ref for template textarea
    const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Pagination State
    const [profilesCurrentPage, setProfilesCurrentPage] = useState(1);
    const [profilesPerPage, setProfilesPerPage] = useState(10);
    const [templatesCurrentPage, setTemplatesCurrentPage] = useState(1);
    const [templatesPerPage, setTemplatesPerPage] = useState(10);


    useEffect(() => {
        setLocalSettings({
            tickerEnabled: true,
            tickerSpeed: 6,
            tickerContentSource: 'hybrid',
            tickerRealActivities: { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true },
            tickerDemoAmountRanges: {
                EUR: { min: 50, max: 500 },
                PKR: { min: 5000, max: 50000 },
            },
            demoProfiles: [],
            demoActivityTemplates: [],
            ...state.settings
        });
    }, [state.settings]);

    useEffect(() => {
        setTemplatesCurrentPage(1);
        setSelectedTemplateIds([]);
    }, [templateStatusFilter, templateTypeFilter, templatesPerPage]);
    
    useEffect(() => {
        setProfilesCurrentPage(1);
        setSelectedProfileIds([]);
    }, [profilesPerPage]);

    useEffect(() => {
        setSelectedTemplateIds([]);
    }, [templatesCurrentPage]);

     useEffect(() => {
        setSelectedProfileIds([]);
    }, [profilesCurrentPage]);

    const handleGenericChange = (field: keyof Settings, value: any) => {
        setLocalSettings(prev => ({...prev, [field]: value}));
        setIsDirty(true);
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
    
    // --- Profile Modal Handlers ---
    const handleOpenProfileModal = (profile: DemoProfile | null) => {
        setCurrentProfile(profile ? { ...profile } : { name: '', country: countries[0], currency: 'PKR' });
        setIsProfileModalOpen(true);
    };

    const handleCloseProfileModal = () => {
        setIsProfileModalOpen(false);
        setCurrentProfile(null);
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
            const isEditing = profiles.some(p => p._id === profileToSave._id);
            let updatedProfiles;

            if (isEditing) {
                updatedProfiles = profiles.map(p => p._id === profileToSave._id ? profileToSave : p);
            } else {
                updatedProfiles = [profileToSave, ...profiles];
            }
            return { ...prev, demoProfiles: updatedProfiles };
        });
        
        // If it's a new profile, go back to the first page to show it
        if (!currentProfile?._id) {
            setProfilesCurrentPage(1);
        }

        setIsDirty(true);
        handleCloseProfileModal();
    };

    const handleDeleteProfile = (id: string) => {
        if (window.confirm('Are you sure you want to delete this profile?')) {
            const updatedProfiles = (localSettings.demoProfiles || []).filter(p => p._id !== id);
            setLocalSettings(prev => ({ ...prev, demoProfiles: updatedProfiles }));
            setIsDirty(true);
        }
    };
    
    const handleOpenBulkProfileModal = () => {
        setBulkProfileText('');
        setIsBulkProfileModalOpen(true);
    };

    const handleSaveBulkProfiles = () => {
        const lines = bulkProfileText.split('\n').filter(line => line.trim() !== '');
        const newProfiles: DemoProfile[] = [];
        let skippedCount = 0;

        const validCurrencies: Currency[] = ['EUR', 'PKR'];
        const validCountries = new Set(countries.map(c => c.toLowerCase()));

        for (const line of lines) {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length !== 3) {
                skippedCount++;
                continue;
            }

            const [name, country, currency] = parts;
            const upperCurrency = currency.toUpperCase() as Currency;

            if (!name || !country || !validCurrencies.includes(upperCurrency) || !validCountries.has(country.toLowerCase())) {
                skippedCount++;
                continue;
            }

            const canonicalCountry = countries.find(c => c.toLowerCase() === country.toLowerCase()) || country;

            newProfiles.push({
                _id: `${new Date().getTime()}-${Math.random()}`,
                name,
                country: canonicalCountry,
                currency: upperCurrency,
            });
        }

        if (newProfiles.length > 0) {
            setLocalSettings(prev => ({
                ...prev,
                demoProfiles: [...newProfiles, ...(prev.demoProfiles || [])]
            }));
            setProfilesCurrentPage(1);
            setIsDirty(true);
        }

        alert(`${newProfiles.length} profiles added successfully. ${skippedCount} lines were skipped due to formatting errors.`);
        setIsBulkProfileModalOpen(false);
    };

    const handleBulkProfileAction = (action: 'delete') => {
        if (selectedProfileIds.length === 0) return;

        if (action === 'delete') {
            if (!window.confirm(`Are you sure you want to delete ${selectedProfileIds.length} selected profiles?`)) {
                return;
            }
            setLocalSettings(prev => ({
                ...prev,
                demoProfiles: (prev.demoProfiles || []).filter(p => !selectedProfileIds.includes(p._id))
            }));
        }

        setIsDirty(true);
        setSelectedProfileIds([]); // Clear selection after action
    };

    // --- Template Modal Handlers ---
     const getPrefilledTemplate = (type: DemoActivityTemplate['type']): string => {
        switch (type) {
            case 'joined': return '{name} from {country} has joined the community!';
            case 'deposit': return '{name} just funded their account with {amount}.';
            case 'withdrawal': return 'Congratulations! {name} has successfully withdrawn {amount}.';
            case 'transfer': return '{name} sent funds to another member.';
            case 'plan': return '{name} has upgraded to the {plan} plan!';
            default: return '';
        }
    };

    const handleOpenTemplateModal = (template: DemoActivityTemplate | null) => {
        if (template) { // Editing existing
            setCurrentTemplate({ ...template });
            setIsEditingTemplate(true);
        } else { // Creating new
            const defaultType = 'joined';
            setCurrentTemplate({ template: getPrefilledTemplate(defaultType), type: defaultType, enabled: true });
            setIsEditingTemplate(false);
        }
        
        if (localSettings.demoProfiles && localSettings.demoProfiles.length > 0) {
            setPreviewProfileId(localSettings.demoProfiles[0]._id);
        } else {
            setPreviewProfileId('');
        }
        setIsTemplateModalOpen(true);
    };
    
    const handleTemplateTypeChange = (newType: DemoActivityTemplate['type']) => {
        if (isEditingTemplate) {
            // Just update the type when editing
            setCurrentTemplate(p => p ? { ...p, type: newType } : null);
        } else {
            // Update the type AND the pre-filled template when creating
            setCurrentTemplate(p => p ? { ...p, type: newType, template: getPrefilledTemplate(newType) } : null);
        }
    };

    const handleCloseTemplateModal = () => {
        setIsTemplateModalOpen(false);
        setCurrentTemplate(null);
        setPreviewProfileId('');
    };
    
    const handleSaveTemplate = () => {
        if (!currentTemplate || !currentTemplate.template) return;

         const templateToSave: DemoActivityTemplate = {
            _id: currentTemplate._id || new Date().getTime().toString(),
            template: currentTemplate.template,
            type: currentTemplate.type || 'joined',
            enabled: currentTemplate.enabled !== false,
        };

        setLocalSettings(prev => {
            const templates = prev.demoActivityTemplates || [];
            let updatedTemplates;

            if (isEditingTemplate) {
                updatedTemplates = templates.map(t => t._id === templateToSave._id ? templateToSave : t);
            } else {
                updatedTemplates = [templateToSave, ...templates];
            }
            return { ...prev, demoActivityTemplates: updatedTemplates };
        });
        
        if (!isEditingTemplate) {
            setTemplatesCurrentPage(1);
        }

        setIsDirty(true);
        handleCloseTemplateModal();
    };

     const handleSaveBulkTemplates = () => {
        const lines = bulkTemplateText.split('\n').filter(line => line.trim() !== '');
        const newTemplates: DemoActivityTemplate[] = [];
        let skippedCount = 0;

        const validTypes: DemoActivityTemplate['type'][] = ['joined', 'deposit', 'withdrawal', 'transfer', 'plan'];

        for (const line of lines) {
            const firstColonIndex = line.indexOf(':');
            if (firstColonIndex === -1) {
                skippedCount++;
                continue;
            }

            const type = line.substring(0, firstColonIndex).trim().toLowerCase() as DemoActivityTemplate['type'];
            const template = line.substring(firstColonIndex + 1).trim();

            if (!validTypes.includes(type) || !template) {
                skippedCount++;
                continue;
            }

            newTemplates.push({
                _id: `${new Date().getTime()}-${Math.random()}`,
                template,
                type,
                enabled: true,
            });
        }

        if (newTemplates.length > 0) {
            setLocalSettings(prev => ({
                ...prev,
                demoActivityTemplates: [...newTemplates, ...(prev.demoActivityTemplates || [])]
            }));
            setTemplatesCurrentPage(1);
            setIsDirty(true);
        }

        alert(`${newTemplates.length} templates added successfully. ${skippedCount} lines were skipped due to formatting errors.`);
        setIsBulkTemplateModalOpen(false);
    };

    const handleToggleTemplateEnabled = (templateId: string) => {
        setLocalSettings(prev => {
            if (!prev || !prev.demoActivityTemplates) return prev;
            const updatedTemplates = prev.demoActivityTemplates.map(t =>
                t._id === templateId ? { ...t, enabled: !t.enabled } : t
            );
            return { ...prev, demoActivityTemplates: updatedTemplates };
        });
        setIsDirty(true);
    };

    const handleBulkAction = (action: 'enable' | 'disable' | 'delete') => {
        if (selectedTemplateIds.length === 0) return;
    
        if (action === 'delete') {
            if (!window.confirm(`Are you sure you want to delete ${selectedTemplateIds.length} selected templates?`)) {
                return;
            }
            setLocalSettings(prev => ({
                ...prev,
                demoActivityTemplates: (prev.demoActivityTemplates || []).filter(t => !selectedTemplateIds.includes(t._id))
            }));
        } else {
            const enable = action === 'enable';
            setLocalSettings(prev => ({
                ...prev,
                demoActivityTemplates: (prev.demoActivityTemplates || []).map(t =>
                    selectedTemplateIds.includes(t._id) ? { ...t, enabled: enable } : t
                )
            }));
        }
    
        setIsDirty(true);
        setSelectedTemplateIds([]); // Clear selection after action
    };

    const handleDeleteTemplate = (id: string) => {
         if (window.confirm('Are you sure you want to delete this template?')) {
            const updatedTemplates = (localSettings.demoActivityTemplates || []).filter(t => t._id !== id);
            setLocalSettings(prev => ({ ...prev, demoActivityTemplates: updatedTemplates }));
            setIsDirty(true);
        }
    };

    const handleInsertPlaceholder = (placeholder: string) => {
        if (templateTextareaRef.current) {
            const { selectionStart, selectionEnd, value } = templateTextareaRef.current;
            const newValue = value.substring(0, selectionStart) + placeholder + value.substring(selectionEnd);
            setCurrentTemplate(p => p ? { ...p, template: newValue } : null);

            setTimeout(() => {
                if (templateTextareaRef.current) {
                    const newCursorPosition = selectionStart + placeholder.length;
                    templateTextareaRef.current.selectionStart = newCursorPosition;
                    templateTextareaRef.current.selectionEnd = newCursorPosition;
                    templateTextareaRef.current.focus();
                }
            }, 0);
        }
    };

    // --- TEMPLATE FILTERING & PAGINATION LOGIC ---
    const filteredTemplates = useMemo(() => {
        return (localSettings.demoActivityTemplates || []).filter(template => {
            const matchesStatus = templateStatusFilter === 'all' || (templateStatusFilter === 'enabled' ? template.enabled === true : template.enabled === false);
            const matchesType = templateTypeFilter === 'all' || template.type === templateTypeFilter;
            return matchesStatus && matchesType;
        });
    }, [localSettings.demoActivityTemplates, templateStatusFilter, templateTypeFilter]);
    
    const paginatedTemplates = useMemo(() => {
        const startIndex = (templatesCurrentPage - 1) * templatesPerPage;
        const endIndex = startIndex + templatesPerPage;
        return filteredTemplates.slice(startIndex, endIndex);
    }, [filteredTemplates, templatesCurrentPage, templatesPerPage]);

    const totalTemplatePages = Math.ceil(filteredTemplates.length / templatesPerPage);

    // --- PAGINATION LOGIC (PROFILES) ---
    const paginatedProfiles = useMemo(() => {
        const profiles = localSettings.demoProfiles || [];
        const startIndex = (profilesCurrentPage - 1) * profilesPerPage;
        const endIndex = startIndex + profilesPerPage;
        return profiles.slice(startIndex, endIndex);
    }, [localSettings.demoProfiles, profilesCurrentPage, profilesPerPage]);

    const totalProfilePages = Math.ceil((localSettings.demoProfiles?.length || 0) / profilesPerPage);

     // --- SELECTION LOGIC ---
    const handleSelectTemplate = (templateId: string) => {
        setSelectedTemplateIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(templateId)) {
                newSet.delete(templateId);
            } else {
                newSet.add(templateId);
            }
            return Array.from(newSet);
        });
    };

    const handleToggleSelectAll = () => {
        const paginatedIds = paginatedTemplates.map(t => t._id);
        const allSelectedOnPage = paginatedIds.length > 0 && paginatedIds.every(id => selectedTemplateIds.includes(id));

        if (allSelectedOnPage) {
            setSelectedTemplateIds(prev => prev.filter(id => !paginatedIds.includes(id)));
        } else {
            setSelectedTemplateIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
        }
    };
    
    const areAllOnPageSelected = paginatedTemplates.length > 0 && paginatedTemplates.every(t => selectedTemplateIds.includes(t._id));

    const handleSelectProfile = (profileId: string) => {
        setSelectedProfileIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(profileId)) {
                newSet.delete(profileId);
            } else {
                newSet.add(profileId);
            }
            return Array.from(newSet);
        });
    };

    const handleToggleSelectAllProfiles = () => {
        const paginatedIds = paginatedProfiles.map(p => p._id);
        const allSelectedOnPage = paginatedIds.length > 0 && paginatedIds.every(id => selectedProfileIds.includes(id));

        if (allSelectedOnPage) {
            setSelectedProfileIds(prev => prev.filter(id => !paginatedIds.includes(id)));
        } else {
            setSelectedProfileIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
        }
    };

    const areAllProfilesOnPageSelected = paginatedProfiles.length > 0 && paginatedProfiles.every(p => selectedProfileIds.includes(p._id));

    // --- PREVIEW LOGIC (MAIN PAGE) ---
    const previewActivities = useMemo((): Activity[] => {
        const activities: Activity[] = [];
        const demoProfiles = localSettings.demoProfiles || [];
        const demoTemplates = (localSettings.demoActivityTemplates || []).filter(t => t.enabled);

        if (demoProfiles.length > 0 && demoTemplates.length > 0) {
            for (let i = 0; i < 20; i++) { // Generate 20 preview items
                const template = demoTemplates[i % demoTemplates.length];
                const profile = demoProfiles[i % demoProfiles.length];
                
                let text = template.template;
                text = text.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`);
                text = text.replace('{country}', `<strong>${profile.country}</strong>`);

                if (text.includes('{amount}')) {
                    let randomAmount = 100; // default fallback

                    if (template.type === 'deposit' || template.type === 'withdrawal') {
                        const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                        if (plansForCurrency.length > 0) {
                            const randomPlan = plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)];
                            randomAmount = randomPlan.price;
                        } else {
                            // Fallback to ranges if no plans exist for the currency
                            const ranges = localSettings.tickerDemoAmountRanges || { EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                            const currencyRange = ranges[profile.currency];
                            if(currencyRange) {
                                randomAmount = Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min;
                            }
                        }
                    } else {
                         // Original logic for other types
                        const ranges = localSettings.tickerDemoAmountRanges || { EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                        const currencyRange = ranges[profile.currency];
                        if(currencyRange) {
                           randomAmount = Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min;
                        }
                    }
                    text = text.replace('{amount}', `<strong>${formatCurrency(randomAmount, profile.currency)}</strong>`);
                }

                if (text.includes('{plan}')) {
                    const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                    text = text.replace('{plan}', `<strong>${plansForCurrency.length > 0 ? plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)].name : 'a plan'}</strong>`);
                }
                
                const minutesAgo = Math.floor(Math.random() * 59) + 1;
                activities.push({ id: `demo-preview-${i}`, type: template.type, text, time: `${minutesAgo}m ago` });
            }
        }

        if (activities.length === 0) {
            return [{ id: 'placeholder', type: 'joined', text: 'Add profiles and templates to see a live preview!', time: 'now' }];
        }
        
        return activities;
    }, [localSettings, investmentPlans]);

    // --- PREVIEW LOGIC (MODAL) ---
    const templatePreview = useMemo(() => {
        if (!previewProfileId || !currentTemplate?.template) {
            return '<span class="text-gray-500">Type a template and select a profile to see a preview.</span>';
        }

        const profile = localSettings.demoProfiles?.find(p => p._id === previewProfileId);
        if (!profile) return '<span class="text-red-500">Selected preview profile not found.</span>';

        let text = currentTemplate.template;
        text = text.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`);
        text = text.replace('{country}', `<strong>${profile.country}</strong>`);

        if (text.includes('{amount}')) {
            let randomAmount = 100; // default fallback

            if (currentTemplate.type === 'deposit' || currentTemplate.type === 'withdrawal') {
                const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                if (plansForCurrency.length > 0) {
                    const randomPlan = plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)];
                    randomAmount = randomPlan.price;
                } else {
                     // Fallback to ranges if no plans exist for the currency
                    const ranges = localSettings.tickerDemoAmountRanges || { EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                    const currencyRange = ranges[profile.currency];
                    if (currencyRange) {
                        randomAmount = Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min;
                    }
                }
            } else {
                // Original logic for other template types
                const ranges = localSettings.tickerDemoAmountRanges || { EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                const currencyRange = ranges[profile.currency];
                if (currencyRange) {
                    randomAmount = Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min;
                }
            }
            text = text.replace('{amount}', `<strong>${formatCurrency(randomAmount, profile.currency)}</strong>`);
        }

        if (text.includes('{plan}')) {
            const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
            const planName = plansForCurrency.length > 0 ? plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)].name : 'a plan';
            text = text.replace('{plan}', `<strong>${planName}</strong>`);
        }
        
        return text;
    }, [previewProfileId, currentTemplate?.template, currentTemplate?.type, localSettings.demoProfiles, localSettings.tickerDemoAmountRanges, investmentPlans]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 sticky top-20 z-10">
                <div>
                    <h1 className="text-2xl font-bold">Activity Ticker Settings</h1>
                    <p className="text-sm text-gray-500">Manage the demo content displayed in the user dashboard activity ticker.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || !isDirty} size="lg">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-3">Live Preview</h2>
                <ActivityTicker activities={previewActivities} speed={localSettings.tickerSpeed || 6} />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                <h2 className="text-lg font-semibold border-b dark:border-gray-700 pb-2">General Settings</h2>
                 <div className="flex items-center justify-between">
                    <div>
                        <label className="block text-sm font-medium">Enable Activity Ticker</label>
                        <p className="text-xs text-gray-500">Globally show or hide the activity ticker on the user dashboard.</p>
                    </div>
                    <ToggleSwitch 
                        checked={localSettings.tickerEnabled ?? true} 
                        onChange={() => handleGenericChange('tickerEnabled', !(localSettings.tickerEnabled ?? true))} 
                    />
                </div>
                <div className="border-t dark:border-gray-700 pt-4">
                    <label htmlFor="tickerSpeed" className="block text-sm font-medium">Ticker Speed (Seconds per Item)</label>
                    <div className="flex items-center gap-4 mt-2">
                        <input id="tickerSpeed" type="range" min="2" max="20" step="1" value={localSettings.tickerSpeed || 6} onChange={e => handleGenericChange('tickerSpeed', parseInt(e.target.value, 10))} className="w-full" />
                        <span className="font-bold text-blue-600 dark:text-blue-400 w-12 text-center">{localSettings.tickerSpeed}s</span>
                    </div>
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
                <h2 className="text-lg font-semibold border-b dark:border-gray-700 pb-2">Content Source & Display</h2>
                <div>
                    <label className="block text-sm font-medium">Content Source</label>
                    <div className="mt-2 flex space-x-4">
                        {(['hybrid', 'real_only', 'demo_only'] as const).map(source => (
                            <label key={source} className="flex items-center">
                                <input
                                    type="radio"
                                    name="tickerContentSource"
                                    value={source}
                                    checked={localSettings.tickerContentSource === source}
                                    onChange={() => handleGenericChange('tickerContentSource', source)}
                                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-600"
                                />
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">{source.replace('_', ' ')}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 border-t dark:border-gray-700 pt-4">
                     <h3 className="text-md font-semibold">Real Activity Display</h3>
                     <p className="text-xs text-gray-500">Choose which real user activities to show when the source includes them.</p>
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Show Real Deposits</label>
                            <ToggleSwitch checked={localSettings.tickerRealActivities?.deposits ?? true} onChange={() => handleRealActivityChange('deposits')} />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Show Real Withdrawals</label>
                            <ToggleSwitch checked={localSettings.tickerRealActivities?.withdrawals ?? true} onChange={() => handleRealActivityChange('withdrawals')} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TickerSettings;
