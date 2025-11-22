
import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { Settings as SettingsType } from '../types';
import { updateSettings } from '../services/api';

const Settings: React.FC = () => {
  const { state, dispatch } = useData();
  const { settings } = state;

  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name.startsWith('withdrawalFrequency.')) {
        const field = name.split('.')[1];
        setLocalSettings(prev => ({
            ...prev,
            withdrawalFrequency: { ...prev.withdrawalFrequency, [field]: checked }
        }));
    } else {
        setLocalSettings(prev => ({ ...prev, [name]: checked }));
    }
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      const field = name.split('.')[1];
      setLocalSettings(prev => ({
          ...prev,
          withdrawalFrequency: { 
              ...prev.withdrawalFrequency, 
              [field]: field === 'value' ? parseFloat(value) : value 
          }
      }));
  }
  
  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          const updatedSettings = await updateSettings(localSettings);
          dispatch({ type: 'UPDATE_SETTINGS', payload: updatedSettings });
          alert('Settings saved successfully!');
      } catch (error) {
          console.error("Failed to save settings:", error);
          alert(`Error: ${error instanceof Error ? error.message : 'Could not save settings.'}`);
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">General Settings</h2>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-4 border-b dark:border-gray-700 pb-6">
            <h3 className="text-lg font-medium">Company Details</h3>
             <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
              <input type="text" id="companyName" defaultValue="SmartEarning" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            <div>
              <label htmlFor="defaultCurrency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Default Currency</label>
              <input type="text" id="defaultCurrency" defaultValue="USD" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
        </div>

        <div className="space-y-4 border-b dark:border-gray-700 pb-6">
             <h3 className="text-lg font-medium">Feature Toggles</h3>
            <div className="flex items-center">
              <input 
                id="isUserTransferEnabled"
                name="isUserTransferEnabled"
                type="checkbox" 
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={localSettings.isUserTransferEnabled}
                onChange={handleCheckboxChange}
              />
              <label htmlFor="isUserTransferEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Enable user-to-user balance transfers (requires admin approval)</label>
            </div>
            <div className="flex items-center">
              <input 
                id="restrictWithdrawalAmount"
                name="restrictWithdrawalAmount"
                type="checkbox" 
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={localSettings.restrictWithdrawalAmount}
                onChange={handleCheckboxChange}
              />
              <label htmlFor="restrictWithdrawalAmount" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Restrict withdrawal amounts to <strong>User's Active Plan</strong> prices</label>
            </div>
        </div>

        <div className="space-y-4 border-b dark:border-gray-700 pb-6">
            <h3 className="text-lg font-medium">Withdrawal Frequency Limit</h3>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                Set how often users can request withdrawals. Users will see a countdown if they try to withdraw too soon.
            </div>
            <div className="flex items-center mb-2">
                <input 
                    id="withdrawalFrequency.enabled"
                    name="withdrawalFrequency.enabled"
                    type="checkbox" 
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={localSettings.withdrawalFrequency?.enabled}
                    onChange={handleCheckboxChange}
                />
                <label htmlFor="withdrawalFrequency.enabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 font-medium">Enable Frequency Restriction</label>
            </div>
            
            {localSettings.withdrawalFrequency?.enabled && (
                <div className="flex items-end gap-4 ml-6">
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Allow 1 withdrawal every:</label>
                        <input 
                            type="number" 
                            min="1"
                            name="withdrawalFrequency.value"
                            value={localSettings.withdrawalFrequency.value}
                            onChange={handleFrequencyChange}
                            className="w-24 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                    <div>
                        <select 
                            name="withdrawalFrequency.unit"
                            value={localSettings.withdrawalFrequency.unit}
                            onChange={handleFrequencyChange}
                            className="rounded-md dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                            <option value="weeks">Weeks</option>
                            <option value="months">Months</option>
                        </select>
                    </div>
                </div>
            )}
        </div>

        <div className="space-y-4">
             <h3 className="text-lg font-medium">Commission Rules</h3>
             <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-800 dark:text-blue-200 mb-2">
                These settings control when a sponsor receives their referral commission. If a condition is not met, the commission will be held as <strong>Pending</strong> until the sponsor qualifies.
             </div>
            <div className="flex items-start">
              <input 
                id="requireActivePlanForCommission"
                name="requireActivePlanForCommission"
                type="checkbox" 
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={localSettings.requireActivePlanForCommission}
                onChange={handleCheckboxChange}
              />
              <label htmlFor="requireActivePlanForCommission" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  <strong>Require Any Active Plan:</strong> Sponsors must have at least one active plan to earn commission.
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If disabled, even free users can earn commissions.</p>
              </label>
            </div>
            <div className="flex items-start">
              <input 
                id="requirePlanMatchForCommission"
                name="requirePlanMatchForCommission"
                type="checkbox" 
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={localSettings.requirePlanMatchForCommission}
                onChange={handleCheckboxChange}
              />
              <label htmlFor="requirePlanMatchForCommission" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  <strong>Strict Plan Matching:</strong> Sponsor must own the <u>exact same plan</u> the referral is purchasing.
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Overrides "Any Active Plan". Commissions are isolated per plan. Purchasing Plan X only releases commissions for Plan X.</p>
              </label>
            </div>
        </div>
       
        <div className="pt-4 border-t dark:border-gray-700">
           <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Settings'}</Button>
        </div>
      </form>
    </div>
  );
};

export default Settings;