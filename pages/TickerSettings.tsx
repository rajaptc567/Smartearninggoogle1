
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Settings, DemoProfile, DemoActivityTemplate, Currency, countries, formatCurrency } from '../types';
import { updateSettings } from '../services/api';
import Button from '../components/ui/Button';
import ActivityTicker, { Activity } from '../components/ui/ActivityTicker';

const TickerSettings: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans } = state;
    const [localSettings, setLocalSettings] = useState<Partial<Settings>>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // State for new items
    const [newProfile, setNewProfile] = useState<Omit<DemoProfile, '_id'>>({ name: '', country: '', currency: 'USD' });
    const [newTemplate, setNewTemplate] = useState<Omit<DemoActivityTemplate, '_id'>>({ template: '', type: 'joined', enabled: true });

    // State for inline editing
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [editedData, setEditedData] = useState<any>({});

    useEffect(() => {
        // Ensure local state is initialized correctly, including potentially missing fields
        setLocalSettings({
            tickerSpeed: 6, // default speed
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

    // --- Profile Handlers ---
    const handleAddProfile = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProfile.name || !newProfile.country) return;
        const profileToAdd: DemoProfile = { ...newProfile, _id: new Date().getTime().toString() };
        setLocalSettings(prev => ({
            ...prev,
            demoProfiles: [...(prev.demoProfiles || []), profileToAdd]
        }));
        setNewProfile({ name: '', country: '', currency: 'USD' });
        setIsDirty(true);
    };

    const handleDeleteProfile = (id: string) => {
        if (window.confirm('Are you sure you want to delete this profile?')) {
            const updatedProfiles = (localSettings.demoProfiles || []).filter(p => p._id !== id);
            setLocalSettings(prev => ({ ...prev, demoProfiles: updatedProfiles }));
            setIsDirty(true);
        }
    };

    const handleEditProfile = (profile: DemoProfile) => {
        setEditingProfileId(profile._id);
        setEditedData(profile);
    };
    
    const handleCancelEditProfile = () => {
        setEditingProfileId(null);
        setEditedData({});
    };

    const handleUpdateProfile = () => {
        setLocalSettings(prev => ({
            ...prev,
            demoProfiles: (prev.demoProfiles || []).map(p => p._id === editingProfileId ? editedData : p)
        }));
        setIsDirty(true);
        handleCancelEditProfile();
    };


    // --- Template Handlers ---
    const handleAddTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTemplate.template) return;
        const templateToAdd: DemoActivityTemplate = { ...newTemplate, _id: new Date().getTime().toString() };
        setLocalSettings(prev => ({
            ...prev,
            demoActivityTemplates: [...(prev.demoActivityTemplates || []), templateToAdd]
        }));
        setNewTemplate({ template: '', type: 'joined', enabled: true });
        setIsDirty(true);
    };
    
    const handleDeleteTemplate = (id: string) => {
         if (window.confirm('Are you sure you want to delete this template?')) {
            const updatedTemplates = (localSettings.demoActivityTemplates || []).filter(t => t._id !== id);
            setLocalSettings(prev => ({ ...prev, demoActivityTemplates: updatedTemplates }));
            setIsDirty(true);
        }
    };

    const handleEditTemplate = (template: DemoActivityTemplate) => {
        setEditingTemplateId(template._id);
        setEditedData(template);
    };
    
    const handleCancelEditTemplate = () => {
        setEditingTemplateId(null);
        setEditedData({});
    };

    const handleUpdateTemplate = () => {
        setLocalSettings(prev => ({
            ...prev,
            demoActivityTemplates: (prev.demoActivityTemplates || []).map(t => t._id === editingTemplateId ? editedData : t)
        }));
        setIsDirty(true);
        handleCancelEditTemplate();
    };

    // Generic handler for inline edit inputs
    const handleEditedDataChange = (field: string, value: any) => {
        setEditedData((prev: any) => ({ ...prev, [field]: value }));
    };

    // Generate preview activities from local state
    const previewActivities = useMemo((): Activity[] => {
        const activities: Activity[] = [];
        const demoProfiles = localSettings.demoProfiles || [];
        const demoTemplates = (localSettings.demoActivityTemplates || []).filter(t => t.enabled);

        if (demoProfiles.length > 0 && demoTemplates.length > 0) {
            demoTemplates.forEach(template => {
                const profile = demoProfiles[Math.floor(Math.random() * demoProfiles.length)];
                if (!profile) return;
                
                let text = template.template;
                text = text.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`);
                text = text.replace('{country}', `<strong>${profile.country}</strong>`);

                if (text.includes('{amount}')) {
                    const randomAmount = Math.floor(Math.random() * 500) + 50;
                    text = text.replace('{amount}', `<strong>${formatCurrency(randomAmount, profile.currency)}</strong>`);
                }
                if (text.includes('{currency}')) {
                    text = text.replace('{currency}', `<strong>${profile.currency}</strong>`);
                }
                if (text.includes('{plan}')) {
                    const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                    if (plansForCurrency.length > 0) {
                        const randomPlan = plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)];
                        text = text.replace('{plan}', `<strong>${randomPlan.name}</strong>`);
                    } else {
                        text = text.replace('{plan}', '<strong>a plan</strong>');
                    }
                }
                
                if (text) {
                    const minutesAgo = Math.floor(Math.random() * 59) + 1;
                    activities.push({ id: `demo-preview-${template._id}-${profile._id}-${Date.now()}`, type: template.type, text, time: `${minutesAgo}m ago` });
                }
            });
        }

        if (activities.length === 0) {
            return [{ id: 'placeholder', type: 'joined', text: 'Add profiles and templates to see a live preview!', time: 'now' }];
        }
        
        return activities.sort(() => Math.random() - 0.5);

    }, [localSettings.demoProfiles, localSettings.demoActivityTemplates, investmentPlans]);


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

            {/* Live Preview */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-3">Live Preview</h2>
                <ActivityTicker activities={previewActivities} speed={localSettings.tickerSpeed || 6} />
            </div>

            {/* General Settings */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                 <h2 className="text-lg font-semibold mb-4">General Settings</h2>
                 <div>
                    <label htmlFor="tickerSpeed" className="block text-sm font-medium">Ticker Speed (Seconds per Item)</label>
                    <div className="flex items-center gap-4 mt-2">
                        <input
                            id="tickerSpeed"
                            type="range"
                            min="2"
                            max="20"
                            step="1"
                            value={localSettings.tickerSpeed || 6}
                            onChange={e => handleGenericChange('tickerSpeed', parseInt(e.target.value, 10))}
                            className="w-full"
                        />
                        <span className="font-bold text-blue-600 dark:text-blue-400 w-12 text-center">
                           {localSettings.tickerSpeed}s
                        </span>
                    </div>
                     <p className="text-xs text-gray-500 mt-1">Lower is faster. This sets how long each activity is visible.</p>
                 </div>
            </div>

            {/* Profiles Management */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4 border-b dark:border-gray-700 pb-3">Demo Profiles ({localSettings.demoProfiles?.length || 0})</h2>
                
                <form onSubmit={handleAddProfile} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                    <div className="md:col-span-1">
                        <label className="text-sm font-medium">Name</label>
                        <input value={newProfile.name} onChange={e => setNewProfile(p => ({ ...p, name: e.target.value }))} placeholder="e.g. John D." className="w-full rounded-md dark:bg-gray-700 text-sm py-2" required />
                    </div>
                     <div className="md:col-span-1">
                        <label className="text-sm font-medium">Country</label>
                        <select value={newProfile.country} onChange={e => setNewProfile(p => ({ ...p, country: e.target.value }))} className="w-full rounded-md dark:bg-gray-700 text-sm py-2" required>
                            <option value="">-- Select --</option>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                     <div className="md:col-span-1">
                        <label className="text-sm font-medium">Currency</label>
                        <select value={newProfile.currency} onChange={e => setNewProfile(p => ({ ...p, currency: e.target.value as Currency }))} className="w-full rounded-md dark:bg-gray-700 text-sm py-2" required>
                            <option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <Button type="submit" className="w-full py-2">Add Profile</Button>
                    </div>
                </form>

                <div className="space-y-2">
                    {(localSettings.demoProfiles || []).map((profile) => (
                        <div key={profile._id} className="grid grid-cols-12 gap-4 items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                           {editingProfileId === profile._id ? (<><div className="col-span-3"><input value={editedData.name} onChange={e => handleEditedDataChange('name', e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-1" /></div><div className="col-span-3"><select value={editedData.country} onChange={e => handleEditedDataChange('country', e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-1">{countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="col-span-3"><select value={editedData.currency} onChange={e => handleEditedDataChange('currency', e.target.value as Currency)} className="w-full rounded-md dark:bg-gray-700 text-sm py-1"><option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option></select></div><div className="col-span-3 flex gap-2 justify-end"><Button size="sm" variant="success" onClick={handleUpdateProfile}>Save</Button><Button size="sm" variant="secondary" onClick={handleCancelEditProfile}>Cancel</Button></div></>) : (<><div className="col-span-3 text-sm font-medium">{profile.name}</div><div className="col-span-3 text-sm text-gray-600 dark:text-gray-400">{profile.country}</div><div className="col-span-3"><span className="px-2 py-1 text-xs font-semibold rounded bg-gray-200 dark:bg-gray-700">{profile.currency}</span></div><div className="col-span-3 flex gap-2 justify-end"><Button size="sm" variant="secondary" onClick={() => handleEditProfile(profile)}>Edit</Button><Button size="sm" variant="danger" onClick={() => handleDeleteProfile(profile._id)}>Delete</Button></div></>)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Templates Management */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4 border-b dark:border-gray-700 pb-3">Activity Templates ({localSettings.demoActivityTemplates?.length || 0})</h2>
                <p className="text-xs text-gray-500 mb-4">Use placeholders: <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm text-blue-500">{'{name}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm text-blue-500">{'{country}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm text-blue-500">{'{amount}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm text-blue-500">{'{currency}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded-sm text-blue-500">{'{plan}'}</code>.</p>
                
                 <form onSubmit={handleAddTemplate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                    <div className="md:col-span-6"><label className="text-sm font-medium">Template String</label><input value={newTemplate.template} onChange={e => setNewTemplate(p => ({ ...p, template: e.target.value }))} placeholder="{name} from {country}..." className="w-full rounded-md dark:bg-gray-700 text-sm py-2" required /></div>
                     <div className="md:col-span-3"><label className="text-sm font-medium">Type</label><select value={newTemplate.type} onChange={e => setNewTemplate(p => ({ ...p, type: e.target.value as any }))} className="w-full rounded-md dark:bg-gray-700 text-sm py-2" required><option value="joined">Joined</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="transfer">Transfer</option><option value="plan">Plan Purchase</option></select></div>
                    <div className="md:col-span-3"><Button type="submit" className="w-full py-2">Add Template</Button></div>
                </form>

                <div className="space-y-2">
                    {(localSettings.demoActivityTemplates || []).map((template) => (
                        <div key={template._id} className="grid grid-cols-12 gap-4 items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                           {editingTemplateId === template._id ? (<><div className="col-span-5"><input value={editedData.template} onChange={e => handleEditedDataChange('template', e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-1" /></div><div className="col-span-2"><select value={editedData.type} onChange={e => handleEditedDataChange('type', e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-1"><option value="joined">Joined</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="transfer">Transfer</option><option value="plan">Plan Purchase</option></select></div><div className="col-span-2 flex justify-center"><input type="checkbox" checked={editedData.enabled} onChange={e => handleEditedDataChange('enabled', e.target.checked)} /></div><div className="col-span-3 flex gap-2 justify-end"><Button size="sm" variant="success" onClick={handleUpdateTemplate}>Save</Button><Button size="sm" variant="secondary" onClick={handleCancelEditTemplate}>Cancel</Button></div></>) : (<><div className="col-span-5 text-sm truncate">{template.template}</div><div className="col-span-2"><span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700">{template.type}</span></div><div className="col-span-2 flex justify-center"><label className="inline-flex items-center cursor-pointer"><input type="checkbox" checked={template.enabled} onChange={e => {const updatedTemplates = (localSettings.demoActivityTemplates || []).map(t => t._id === template._id ? {...t, enabled: e.target.checked} : t); setLocalSettings(prev => ({ ...prev, demoActivityTemplates: updatedTemplates })); setIsDirty(true);}} className="sr-only peer" /><div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div></label></div><div className="col-span-3 flex gap-2 justify-end"><Button size="sm" variant="secondary" onClick={() => handleEditTemplate(template)}>Edit</Button><Button size="sm" variant="danger" onClick={() => handleDeleteTemplate(template._id)}>Delete</Button></div></>)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TickerSettings;
