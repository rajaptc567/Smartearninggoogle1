
import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { Settings as SettingsType, TransferFeeTier } from '../types';
import { updateSettings } from '../services/api';

const Settings: React.FC = () => {
  const { state, dispatch } = useData();
  const { settings } = state;

  // Initialize local state with default structure if missing from backend
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(prev => ({
        ...settings,
        transferConfig: settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [] }
    }));
  }, [settings]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name.startsWith('withdrawalFrequency.')) {
        const field = name.split('.')[1];
        setLocalSettings(prev => ({
            ...prev,
            withdrawalFrequency: { ...prev.withdrawalFrequency, [field]: checked }
        }));
    } else if (name === 'transferConfig.enabled') {
        setLocalSettings(prev => ({
            ...prev,
            transferConfig: { ...prev.transferConfig, enabled: checked },
            isUserTransferEnabled: checked // Sync legacy field
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

  // --- Transfer Tier Handlers ---
  const handleAddTier = () => {
      setLocalSettings(prev => ({
          ...prev,
          transferConfig: {
              ...prev.transferConfig,
              tiers: [...prev.transferConfig.tiers, { minAmount: 0, maxAmount: 0, feeType: 'fixed', feeValue: 0, enabled: true }]
          }
      }));
  };

  const handleRemoveTier = (index: number) => {
      setLocalSettings(prev => ({
          ...prev,
          transferConfig: {
              ...prev.transferConfig,
              tiers: prev.transferConfig.tiers.filter((_, i) => i !== index)
          }
      }));
  };

  const handleTierChange = (index: number, field: keyof TransferFeeTier, value: string | boolean) => {
      setLocalSettings(prev => {
          const newTiers = [...prev.transferConfig.tiers];
          newTiers[index] = {
              ...newTiers[index],
              [field]: (field === 'feeType' || field === 'enabled') ? value : (parseFloat(value as string) || 0)
          };
          return {
              ...prev,
              transferConfig: { ...prev.transferConfig, tiers: newTiers }
          };
      });
  };
  
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
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">General Settings</h2>
      <form onSubmit={handleSave} className="space-y-8">
        
        <div className="space-y-4 border-b dark:border-gray-700 pb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transfer Settings</h3>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md text-sm text-purple-800 dark:text-purple-200 mb-2">
                Configure fees for user-to-user transfers based on amount ranges.
            </div>
            
            <div className="flex items-center mb-4">
              <input 
                id="transferConfig.enabled"
                name="transferConfig.enabled"
                type="checkbox" 
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={localSettings.transferConfig?.enabled ?? true}
                onChange={handleCheckboxChange}
              />
              <label htmlFor="transferConfig.enabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 font-bold">Enable Funds Transfer</label>
            </div>

            {localSettings.transferConfig?.enabled && (
                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                    <h4 className="text-sm font-semibold mb-3">Fee Tiers</h4>
                    <div className="space-y-2">
                        <div className="grid grid-cols-6 gap-2 text-xs font-medium text-gray-500 uppercase items-center">
                            <div className="col-span-1">Min Amount ($)</div>
                            <div className="col-span-1">Max Amount ($)</div>
                            <div className="col-span-1">Fee Type</div>
                            <div className="col-span-1">Fee Value</div>
                            <div className="col-span-1 text-center">Status</div>
                            <div className="col-span-1">Action</div>
                        </div>
                        {localSettings.transferConfig.tiers.map((tier, index) => (
                            <div key={index} className="grid grid-cols-6 gap-2 items-center">
                                <input 
                                    type="number" 
                                    value={tier.minAmount} 
                                    onChange={(e) => handleTierChange(index, 'minAmount', e.target.value)}
                                    className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="0"
                                />
                                <input 
                                    type="number" 
                                    value={tier.maxAmount} 
                                    onChange={(e) => handleTierChange(index, 'maxAmount', e.target.value)}
                                    className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="100"
                                />
                                <select 
                                    value={tier.feeType} 
                                    onChange={(e) => handleTierChange(index, 'feeType', e.target.value)}
                                    className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="fixed">Fixed ($)</option>
                                    <option value="percentage">Percent (%)</option>
                                </select>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={tier.feeValue} 
                                    onChange={(e) => handleTierChange(index, 'feeValue', e.target.value)}
                                    className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="Fee"
                                />
                                <div className="col-span-1 flex justify-center items-center">
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={tier.enabled !== false}
                                            onChange={(e) => handleTierChange(index, 'enabled', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <Button type="button" size="sm" variant="danger" onClick={() => handleRemoveTier(index)}>Remove</Button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3">
                        <Button type="button" size="sm" variant="secondary" onClick={handleAddTier}>+ Add Fee Tier</Button>
                    </div>
                </div>
            )}
        </div>

        <div className="space-y-4 border-b dark:border-gray-700 pb-6">
             <h3 className="text-lg font-medium">Withdrawal Settings</h3>
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
            
            <div className="mt-4">
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
        </div>

        <div className="space-y-4">
             <h3 className="text-lg font-medium">Commission Rules</h3>
             <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-800 dark:text-blue-200 mb-2">
                These settings control when a sponsor receives their referral commission.
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
                  <strong>Require Any Active Plan</strong>
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
                  <strong>Strict Plan Matching</strong> (Sponsor must have exact same plan)
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