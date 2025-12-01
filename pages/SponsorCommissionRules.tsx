import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { Settings as SettingsType } from '../types';
import { updateSettings } from '../services/api';

const SponsorCommissionRules: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings } = state;

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
                    <Toggle
                        name="oneTimeCommissionPerGroup"
                        label="One-Time Commission Per Equivalency Group"
                        description="If enabled, a sponsor will only earn a commission ONCE from a specific referral for any plan within the same equivalency group. This prevents sponsors from earning multiple times if a referral buys equivalent plans in different currencies (e.g., USD Starter and PKR Starter)."
                        checked={localSettings.oneTimeCommissionPerGroup ?? false}
                        onChange={handleCheckboxChange}
                    />
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
