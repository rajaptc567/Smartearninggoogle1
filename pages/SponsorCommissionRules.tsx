
import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { Settings as SettingsType, InvestmentPlan } from '../types';
import { updateSettings } from '../services/api';
import { Link } from 'react-router-dom';

const SponsorCommissionRules: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings, investmentPlans } = state;

    const [localSettings, setLocalSettings] = useState<Partial<SettingsType>>(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
        setIsDirty(false);
    }, [settings]);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setLocalSettings(prev => ({ ...prev, [name]: checked }));
        setIsDirty(true);
    };
    
    const handleRecurringPlanChange = (planId: string) => {
        const currentIds = localSettings.recurringCommissionPlanIds || [];
        let newIds;
        if (currentIds.includes(planId)) {
            newIds = currentIds.filter(id => id !== planId);
        } else {
            newIds = [...currentIds, planId];
        }
        setLocalSettings(prev => ({ ...prev, recurringCommissionPlanIds: newIds }));
        setIsDirty(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const updatedSettings = await updateSettings(localSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: updatedSettings });
            alert('Sponsor commission rules saved successfully!');
            setIsDirty(false);
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not save settings.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const Toggle = ({ name, label, description, checked, onChange }: { name: keyof SettingsType, label: string, description: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-start sm:items-center justify-between">
                <div className="flex-grow pr-4">
                    <label htmlFor={name} className="block font-semibold text-gray-900 dark:text-white">{label}</label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                </div>
                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out flex-shrink-0 mt-2 sm:mt-0">
                    <input
                        id={name}
                        name={name}
                        type="checkbox"
                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-500"
                        checked={checked}
                        onChange={onChange}
                    />
                    <label htmlFor={name} className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSave} className="space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sponsor Commission Rules</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure advanced rules for commission eligibility and distribution.</p>
                    </div>
                    <Button type="submit" disabled={isSaving || !isDirty} size="lg">
                        {isSaving ? 'Saving...' : 'Save Rules'}
                    </Button>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-bold mb-1">Warning:</p>
                    Changing these rules will affect all future commission calculations. If a rule is not met, commissions will be placed on 'Pending' status.
                </div>

                <div className="space-y-6">
                    <div>
                        <Toggle
                            name="oneTimeCommissionPerGroup"
                            label="One-Time Commission Per Referral"
                            description="If enabled, a sponsor will only earn commission ONCE from any specific referral, regardless of how many plans they purchase or upgrade to over time. This enforces a strict 'one commission per referred user' policy."
                            checked={localSettings.oneTimeCommissionPerGroup ?? false}
                            onChange={handleCheckboxChange}
                        />
                         {localSettings.oneTimeCommissionPerGroup && (
                            <div className="mt-4 p-4 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-200">Recurring Commission Plans</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 mb-2">
                                    Select plans that grant recurring commissions. If a sponsor owns any of these plans, they will bypass the 'one-time' rule and earn a commission every time one of their referrals buys or upgrades ANY plan.
                                </p>
                                <p className="text-xs text-gray-500 mb-4">
                                    Missing a plan? <Link to="/admin/investment-plans" className="text-blue-600 hover:underline">Click here to add or manage investment plans.</Link>
                                </p>
                                <div className="space-y-4">
                                    {(['USD', 'EUR', 'PKR'] as const).map(currency => {
                                        const plansForCurrency = investmentPlans.filter(p => p.currency === currency && p.status === 'Active');
                                        return (
                                            <div key={currency}>
                                                <h5 className="font-bold text-sm text-gray-600 dark:text-gray-400">{currency} Plans</h5>
                                                {plansForCurrency.length === 0 ? (
                                                     <p className="text-xs text-gray-400 italic mt-1">No active plans found for this currency.</p>
                                                ) : (
                                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {plansForCurrency.map(plan => (
                                                            <label key={plan._id} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800/50 rounded-md border dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded text-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                                                                    checked={(localSettings.recurringCommissionPlanIds || []).includes(plan._id)}
                                                                    onChange={() => handleRecurringPlanChange(plan._id)}
                                                                />
                                                                <span className="text-sm">{plan.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <Toggle
                        name="requireUplineEligibility"
                        label="Require Upline Eligibility Chain (Pass-Through)"
                        description="If enabled, an upline sponsor can only receive an INDIRECT commission if the entire chain of sponsors below them is also eligible. If any intermediate sponsor is not eligible (e.g., doesn't own an equivalent plan), the commission chain is broken at that point and no one further up will be paid."
                        checked={localSettings.requireUplineEligibility ?? false}
                        onChange={handleCheckboxChange}
                    />
                </div>
            </form>
        </div>
    );
};

export default SponsorCommissionRules;
