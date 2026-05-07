
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { InvestmentPlan, PlanEquivalencyGroup, Settings, formatCurrency } from '../types';
import Button from '../components/ui/Button';
import { updateSettings } from '../services/api';

const PlanEquivalency: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans, settings } = state;

    const [localGroups, setLocalGroups] = useState<PlanEquivalencyGroup[]>([]);
    const [newGroup, setNewGroup] = useState<Partial<PlanEquivalencyGroup>>({ usdPlanId: '', pkrPlanId: '', eurPlanId: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setLocalGroups(settings.planEquivalencyGroups || []);
        setIsDirty(false); // Reset dirty state when global settings change
    }, [settings.planEquivalencyGroups]);

    const activePlans = useMemo(() => investmentPlans.filter(p => p.status === 'Active'), [investmentPlans]);
    const usdPlans = useMemo(() => activePlans.filter(p => p.currency === 'USD'), [activePlans]);
    const pkrPlans = useMemo(() => activePlans.filter(p => p.currency === 'PKR'), [activePlans]);
    const eurPlans = useMemo(() => activePlans.filter(p => p.currency === 'EUR'), [activePlans]);

    const handleNewGroupChange = (field: keyof typeof newGroup, value: string) => {
        setNewGroup(prev => ({ ...prev, [field]: value }));
    };

    const handleAddGroup = () => {
        const { usdPlanId, pkrPlanId, eurPlanId } = newGroup;
        const selectedCount = [usdPlanId, pkrPlanId, eurPlanId].filter(Boolean).length;

        if (selectedCount < 2) {
            alert('Please select at least two plans from different currencies to form a group.');
            return;
        }

        const newGroupToAdd: PlanEquivalencyGroup = {
            _id: new Date().getTime().toString(),
            usdPlanId: usdPlanId || undefined,
            pkrPlanId: pkrPlanId || undefined,
            eurPlanId: eurPlanId || undefined,
        };

        setLocalGroups(prev => [...prev, newGroupToAdd]);
        setNewGroup({ usdPlanId: '', pkrPlanId: '', eurPlanId: '' });
        setIsDirty(true);
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (window.confirm('Are you sure you want to delete this equivalency group?')) {
            setIsSaving(true);
            const updatedGroups = (settings.planEquivalencyGroups || []).filter(g => g._id !== groupId);
            try {
                const updatedSettingsData = { ...settings, planEquivalencyGroups: updatedGroups };
                const savedSettings = await updateSettings(updatedSettingsData);
                dispatch({ type: 'UPDATE_SETTINGS', payload: savedSettings });
                // The UI will update reactively from the global state change
            } catch (error) {
                console.error('Failed to delete group:', error);
                alert('Error deleting group.');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedSettings: Partial<Settings> = { ...settings, planEquivalencyGroups: localGroups };
            const savedSettings = await updateSettings(updatedSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: savedSettings });
            alert('Plan equivalency settings saved successfully!');
            setIsDirty(false);
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Error saving settings.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const findPlan = (planId?: string): InvestmentPlan | undefined => {
        return investmentPlans.find(p => p._id === planId);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 sticky top-20 z-10">
                <div>
                    <h1 className="text-2xl font-bold">Plan Equivalency</h1>
                    <p className="text-sm text-gray-500">Link plans across different currencies to allow for cross-currency commission eligibility.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || !isDirty} size="lg">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4">Create New Equivalency Group</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                    <div>
                        <label className="block text-sm font-medium">USD Plan</label>
                        <select value={newGroup.usdPlanId} onChange={(e) => handleNewGroupChange('usdPlanId', e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-2">
                            <option value="">-- Optional --</option>
                            {usdPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, 'USD')})</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">PKR Plan</label>
                        <select value={newGroup.pkrPlanId} onChange={(e) => handleNewGroupChange('pkrPlanId', e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-2">
                            <option value="">-- Optional --</option>
                            {pkrPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, 'PKR')})</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">EUR Plan</label>
                        <select value={newGroup.eurPlanId} onChange={(e) => handleNewGroupChange('eurPlanId', e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-2">
                            <option value="">-- Optional --</option>
                            {eurPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, 'EUR')})</option>)}
                        </select>
                    </div>
                    <Button onClick={handleAddGroup}>Add Group</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4">Existing Equivalency Groups</h2>
                <div className="space-y-3">
                    {localGroups.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No equivalency groups created yet.</p>
                    ) : (
                        localGroups.map((group) => {
                            const usdPlan = findPlan(group.usdPlanId);
                            const pkrPlan = findPlan(group.pkrPlanId);
                            const eurPlan = findPlan(group.eurPlanId);
                            return (
                                <div key={group._id} className="grid grid-cols-12 gap-4 items-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-700">
                                    <div className="col-span-11 grid grid-cols-3 gap-4">
                                        <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600/50 text-center text-sm">{usdPlan ? `${usdPlan.name} (${formatCurrency(usdPlan.price, 'USD')})` : <span className="text-gray-400">Not Set</span>}</div>
                                        <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600/50 text-center text-sm">{pkrPlan ? `${pkrPlan.name} (${formatCurrency(pkrPlan.price, 'PKR')})` : <span className="text-gray-400">Not Set</span>}</div>
                                        <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600/50 text-center text-sm">{eurPlan ? `${eurPlan.name} (${formatCurrency(eurPlan.price, 'EUR')})` : <span className="text-gray-400">Not Set</span>}</div>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <Button size="sm" variant="danger" onClick={() => handleDeleteGroup(group._id)} disabled={isSaving}>Delete</Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlanEquivalency;
