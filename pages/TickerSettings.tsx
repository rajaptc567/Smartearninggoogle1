
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Settings, DemoProfile, DemoActivityTemplate, Currency, countries, formatCurrency } from '../types';
import { updateSettings } from '../services/api';
import Button from '../components/ui/Button';
import ActivityTicker, { Activity } from '../components/ui/ActivityTicker';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const TickerSettings: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans } = state;
    const [localSettings, setLocalSettings] = useState<Partial<Settings>>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Modal States
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [currentProfile, setCurrentProfile] = useState<Partial<DemoProfile> | null>(null);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<Partial<DemoActivityTemplate> | null>(null);

    // Pagination State
    const [profilesCurrentPage, setProfilesCurrentPage] = useState(1);
    const profilesPerPage = 10;
    const [templatesCurrentPage, setTemplatesCurrentPage] = useState(1);
    const templatesPerPage = 10;

    useEffect(() => {
        setLocalSettings({
            tickerSpeed: 6,
            tickerContentSource: 'hybrid',
            tickerRealActivities: { deposits: true, withdrawals: true, registrations: true },
            tickerDemoAmountRanges: {
                USD: { min: 50, max: 500 },
                EUR: { min: 50, max: 500 },
                PKR: { min: 5000, max: 50000 },
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
        setCurrentProfile(profile ? { ...profile } : { name: '', country: countries[0], currency: 'USD' });
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
            currency: currentProfile.currency || 'USD',
        };

        setLocalSettings(prev => {
            const profiles = prev.demoProfiles || [];
            const isEditing = profiles.some(p => p._id === profileToSave._id);
            let updatedProfiles;

            if (isEditing) {
                updatedProfiles = profiles.map(p => p._id === profileToSave._id ? profileToSave : p);
            } else {
                updatedProfiles = [...profiles, profileToSave];
            }
            return { ...prev, demoProfiles: updatedProfiles };
        });
        
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

    // --- Template Modal Handlers ---
    const handleOpenTemplateModal = (template: DemoActivityTemplate | null) => {
        setCurrentTemplate(template ? { ...template } : { template: '', type: 'joined', enabled: true });
        setIsTemplateModalOpen(true);
    };

    const handleCloseTemplateModal = () => {
        setIsTemplateModalOpen(false);
        setCurrentTemplate(null);
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
            const isEditing = templates.some(t => t._id === templateToSave._id);
            let updatedTemplates;

            if (isEditing) {
                updatedTemplates = templates.map(t => t._id === templateToSave._id ? templateToSave : t);
            } else {
                updatedTemplates = [...templates, templateToSave];
            }
            return { ...prev, demoActivityTemplates: updatedTemplates };
        });
        
        setIsDirty(true);
        handleCloseTemplateModal();
    };


    const handleDeleteTemplate = (id: string) => {
         if (window.confirm('Are you sure you want to delete this template?')) {
            const updatedTemplates = (localSettings.demoActivityTemplates || []).filter(t => t._id !== id);
            setLocalSettings(prev => ({ ...prev, demoActivityTemplates: updatedTemplates }));
            setIsDirty(true);
        }
    };

    // --- PAGINATION LOGIC ---
    const paginatedProfiles = useMemo(() => {
        const profiles = localSettings.demoProfiles || [];
        const startIndex = (profilesCurrentPage - 1) * profilesPerPage;
        const endIndex = startIndex + profilesPerPage;
        return profiles.slice(startIndex, endIndex);
    }, [localSettings.demoProfiles, profilesCurrentPage]);

    const totalProfilePages = Math.ceil((localSettings.demoProfiles?.length || 0) / profilesPerPage);
    
    const paginatedTemplates = useMemo(() => {
        const templates = localSettings.demoActivityTemplates || [];
        const startIndex = (templatesCurrentPage - 1) * templatesPerPage;
        const endIndex = startIndex + templatesPerPage;
        return templates.slice(startIndex, endIndex);
    }, [localSettings.demoActivityTemplates, templatesCurrentPage]);

    const totalTemplatePages = Math.ceil((localSettings.demoActivityTemplates?.length || 0) / templatesPerPage);

    // --- PREVIEW LOGIC ---
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
                    const ranges = localSettings.tickerDemoAmountRanges || { USD: {min: 50, max: 500}, EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                    const currencyRange = ranges[profile.currency];
                    const randomAmount = currencyRange ? Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min : 100;
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

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
                <h2 className="text-lg font-semibold border-b dark:border-gray-700 pb-2">General Settings</h2>
                <div>
                    <label htmlFor="tickerSpeed" className="block text-sm font-medium">Ticker Speed (Seconds per Item)</label>
                    <div className="flex items-center gap-4 mt-2">
                        <input id="tickerSpeed" type="range" min="2" max="20" step="1" value={localSettings.tickerSpeed || 6} onChange={e => handleGenericChange('tickerSpeed', parseInt(e.target.value, 10))} className="w-full" />
                        <span className="font-bold text-blue-600 dark:text-blue-400 w-12 text-center">{localSettings.tickerSpeed}s</span>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
                    <h2 className="text-lg font-semibold">Demo Profiles ({localSettings.demoProfiles?.length || 0})</h2>
                    <Button size="sm" onClick={() => handleOpenProfileModal(null)}>Add Profile</Button>
                </div>
                <div className="space-y-2">
                    {paginatedProfiles.map((profile) => (
                        <div key={profile._id} className="grid grid-cols-12 gap-4 items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="col-span-3 text-sm font-medium">{profile.name}</div>
                            <div className="col-span-4 text-sm text-gray-600 dark:text-gray-400">{profile.country}</div>
                            <div className="col-span-2"><span className="px-2 py-1 text-xs font-semibold rounded bg-gray-200 dark:bg-gray-700">{profile.currency}</span></div>
                            <div className="col-span-3 flex gap-2 justify-end">
                                <Button size="sm" variant="secondary" onClick={() => handleOpenProfileModal(profile)}>Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDeleteProfile(profile._id)}>Delete</Button>
                            </div>
                        </div>
                    ))}
                </div>
                {totalProfilePages > 1 && (
                    <div className="flex justify-between items-center mt-4 border-t dark:border-gray-700 pt-4">
                        <Button size="sm" variant="secondary" onClick={() => setProfilesCurrentPage(p => Math.max(1, p - 1))} disabled={profilesCurrentPage === 1}>Previous</Button>
                        <span className="text-sm text-gray-500">Page {profilesCurrentPage} of {totalProfilePages}</span>
                        <Button size="sm" variant="secondary" onClick={() => setProfilesCurrentPage(p => Math.min(totalProfilePages, p + 1))} disabled={profilesCurrentPage === totalProfilePages}>Next</Button>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                 <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3 mb-4">
                    <h2 className="text-lg font-semibold">Activity Templates ({localSettings.demoActivityTemplates?.length || 0})</h2>
                    <Button size="sm" onClick={() => handleOpenTemplateModal(null)}>Add Template</Button>
                </div>
                <p className="text-xs text-gray-500 mb-4">Placeholders: <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm">{'{name}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm">{'{country}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm">{'{amount}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm">{'{plan}'}</code>.</p>
                <div className="space-y-2">
                    {paginatedTemplates.map((template) => (
                        <div key={template._id} className="grid grid-cols-12 gap-4 items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                           <div className="col-span-6 text-sm truncate">{template.template}</div>
                           <div className="col-span-2"><span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700">{template.type}</span></div>
                           <div className="col-span-1 flex justify-center"><Badge status={template.enabled ? 'Enabled' : 'Disabled'} /></div>
                           <div className="col-span-3 flex gap-2 justify-end">
                               <Button size="sm" variant="secondary" onClick={() => handleOpenTemplateModal(template)}>Edit</Button>
                               <Button size="sm" variant="danger" onClick={() => handleDeleteTemplate(template._id)}>Delete</Button>
                           </div>
                        </div>
                    ))}
                </div>
                 {totalTemplatePages > 1 && (
                    <div className="flex justify-between items-center mt-4 border-t dark:border-gray-700 pt-4">
                        <Button size="sm" variant="secondary" onClick={() => setTemplatesCurrentPage(p => Math.max(1, p - 1))} disabled={templatesCurrentPage === 1}>Previous</Button>
                        <span className="text-sm text-gray-500">Page {templatesCurrentPage} of {totalTemplatePages}</span>
                        <Button size="sm" variant="secondary" onClick={() => setTemplatesCurrentPage(p => Math.min(totalTemplatePages, p + 1))} disabled={templatesCurrentPage === totalTemplatePages}>Next</Button>
                    </div>
                )}
            </div>

            {/* Profile Modal */}
            {isProfileModalOpen && currentProfile && (
                <Modal isOpen={isProfileModalOpen} onClose={handleCloseProfileModal}>
                    <div className="p-4 w-[90vw] max-w-md">
                        <h3 className="text-lg font-bold mb-4">{currentProfile._id ? 'Edit Demo Profile' : 'Add New Demo Profile'}</h3>
                        <div className="space-y-4">
                            <div><label className="text-sm font-medium">Name</label><input value={currentProfile.name || ''} onChange={e => setCurrentProfile(p => p ? {...p, name: e.target.value} : null)} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                            <div><label className="text-sm font-medium">Country</label><select value={currentProfile.country} onChange={e => setCurrentProfile(p => p ? {...p, country: e.target.value} : null)} className="w-full rounded-md dark:bg-gray-700 mt-1">{countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="text-sm font-medium">Currency</label><select value={currentProfile.currency} onChange={e => setCurrentProfile(p => p ? {...p, currency: e.target.value as Currency} : null)} className="w-full rounded-md dark:bg-gray-700 mt-1"><option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option></select></div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={handleCloseProfileModal}>Cancel</Button><Button onClick={handleSaveProfile}>Save Profile</Button></div>
                    </div>
                </Modal>
            )}

            {/* Template Modal */}
            {isTemplateModalOpen && currentTemplate && (
                 <Modal isOpen={isTemplateModalOpen} onClose={handleCloseTemplateModal}>
                    <div className="p-4 w-[90vw] max-w-lg">
                        <h3 className="text-lg font-bold mb-4">{currentTemplate._id ? 'Edit Template' : 'Add New Template'}</h3>
                        <div className="space-y-4">
                            <div><label className="text-sm font-medium">Template String</label><textarea value={currentTemplate.template || ''} onChange={e => setCurrentTemplate(p => p ? {...p, template: e.target.value} : null)} rows={3} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                            <div><label className="text-sm font-medium">Type</label><select value={currentTemplate.type} onChange={e => setCurrentTemplate(p => p ? {...p, type: e.target.value as any} : null)} className="w-full rounded-md dark:bg-gray-700 mt-1"><option value="joined">Joined</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="transfer">Transfer</option><option value="plan">Plan Purchase</option></select></div>
                             <div><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={currentTemplate.enabled !== false} onChange={e => setCurrentTemplate(p => p ? {...p, enabled: e.target.checked} : null)} /> Enabled</label></div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={handleCloseTemplateModal}>Cancel</Button><Button onClick={handleSaveTemplate}>Save Template</Button></div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TickerSettings;
