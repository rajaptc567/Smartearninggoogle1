
import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { Settings as SettingsType, TransferFeeTier, Currency, currencySymbols } from '../types';
import { updateSettings } from '../services/api';

const Settings: React.FC = () => {
  const { state, dispatch } = useData();
  const { settings } = state;

  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'transfers' | 'withdrawals' | 'commissions' | 'exchange_rates'>('general');
  const [tierCurrencyFilter, setTierCurrencyFilter] = useState<Currency | ''>('');

  useEffect(() => {
    setLocalSettings(prev => ({
        ...settings,
        transferConfig: settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [] },
        exchangeRates: settings.exchangeRates || { USD: 278.50, EUR: 256.22, PKR: 1 }
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

    const handleExchangeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const currency = name.split('.')[1] as keyof SettingsType['exchangeRates'];
        setLocalSettings(prev => ({
            ...prev,
            exchangeRates: {
                ...prev.exchangeRates,
                [currency]: parseFloat(value) || 0
            }
        }));
    };

  // --- Transfer Tier Handlers ---
  const handleAddTier = () => {
      if (!tierCurrencyFilter) return; // Should not happen if button is disabled
      setLocalSettings(prev => ({
          ...prev,
          transferConfig: {
              ...prev.transferConfig,
              tiers: [...prev.transferConfig.tiers, { minAmount: 0, maxAmount: 0, feeType: 'fixed', feeValue: 0, currency: tierCurrencyFilter, enabled: true }]
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
          const updatedTier = { ...newTiers[index] };

          if (field === 'enabled') {
              updatedTier.enabled = value as boolean;
          } else if (field === 'feeType') {
              updatedTier.feeType = value as 'percentage' | 'fixed';
          } else if (field === 'minAmount' || field === 'maxAmount' || field === 'feeValue') {
              (updatedTier as any)[field] = parseFloat(value as string) || 0;
          }

          newTiers[index] = updatedTier;
          
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

  const TabButton = ({ id, label, icon }: { id: typeof activeTab, label: string, icon?: React.ReactNode }) => (
      <button
          type="button"
          onClick={() => setActiveTab(id)}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
              activeTab === id 
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
      >
          {icon && <span className="mr-2">{icon}</span>}
          {label}
      </button>
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">System Settings</h2>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
          <TabButton id="general" label="General" />
          <TabButton id="transfers" label="Transfers & Fees" />
          <TabButton id="withdrawals" label="Withdrawals" />
          <TabButton id="commissions" label="Commissions" />
          <TabButton id="exchange_rates" label="Exchange Rates (PKR Base)" />
      </div>

      <form onSubmit={handleSave} className="space-y-6 min-h-[400px]">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Platform Configuration</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                        General platform settings will appear here in future updates (e.g., Site Name, Maintenance Mode).
                    </p>
                </div>
                
                <div>
                    <h4 className="text-md font-bold text-gray-800 dark:text-white mb-4">Feature Toggles</h4>
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                        <div>
                            <label htmlFor="transferConfig.enabled" className="block text-sm font-medium text-gray-900 dark:text-gray-200">User-to-User Transfers</label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Allow members to transfer wallet funds to other members.</p>
                        </div>
                        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                            <input 
                                id="transferConfig.enabled"
                                name="transferConfig.enabled"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                checked={localSettings.transferConfig?.enabled ?? true}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="transferConfig.enabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.transferConfig?.enabled ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* EXCHANGE RATES TAB */}
        {activeTab === 'exchange_rates' && (
            <div className="space-y-6 animate-fade-in">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Currency Exchange Rates</h3>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-sm text-green-800 dark:text-green-200 mb-4">
                    Define how other currencies convert to the base currency (PKR). This is crucial for calculating cross-currency commissions.
                </div>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label htmlFor="rate-pkr" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Base Currency (PKR)</label>
                        <div className="mt-1 flex items-center gap-2">
                             <span className="font-bold text-lg">1 PKR =</span>
                            <input id="rate-pkr" type="number" value="1" disabled className="w-full rounded-md bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 cursor-not-allowed" />
                             <span className="font-bold">PKR</span>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="rate-usd" className="block text-sm font-medium text-gray-700 dark:text-gray-300">US Dollar Rate</label>
                        <div className="mt-1 flex items-center gap-2">
                             <span className="font-bold text-lg">1 USD =</span>
                            <input 
                                id="rate-usd"
                                name="exchangeRates.USD"
                                type="number" 
                                step="0.01"
                                value={localSettings.exchangeRates?.USD || ''} 
                                onChange={handleExchangeRateChange} 
                                className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600"
                            />
                             <span className="font-bold">PKR</span>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="rate-eur" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Euro Rate</label>
                        <div className="mt-1 flex items-center gap-2">
                            <span className="font-bold text-lg">1 EUR =</span>
                            <input 
                                id="rate-eur"
                                name="exchangeRates.EUR"
                                type="number" 
                                step="0.01"
                                value={localSettings.exchangeRates?.EUR || ''} 
                                onChange={handleExchangeRateChange} 
                                className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600"
                            />
                             <span className="font-bold">PKR</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TRANSFERS TAB */}
        {activeTab === 'transfers' && (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transfer Fee Structure</h3>
                        <select
                            value={tierCurrencyFilter}
                            onChange={(e) => setTierCurrencyFilter(e.target.value as Currency | '')}
                            className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">Show All</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="PKR">PKR</option>
                        </select>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md text-sm text-purple-800 dark:text-purple-200 mb-4">
                        Define fees for user transfers based on amount ranges. If an amount doesn't match any enabled tier, the transfer will be blocked.
                    </div>

                    {!localSettings.transferConfig?.enabled && (
                        <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-600 dark:text-red-400">
                            Warning: Transfers are currently disabled globally in the General tab.
                        </div>
                    )}

                    <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase items-center mb-2 px-1">
                                <div className="col-span-1">Currency</div>
                                <div className="col-span-2">Min Amount</div>
                                <div className="col-span-2">Max Amount</div>
                                <div className="col-span-2">Type</div>
                                <div className="col-span-2">Value</div>
                                <div className="col-span-1 text-center">Active</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {localSettings.transferConfig.tiers.map((tier, index) => {
                                if (tierCurrencyFilter && tier.currency !== tierCurrencyFilter) return null;
                                return (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-gray-800 p-2 rounded shadow-sm">
                                    <div className="col-span-1">
                                        <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-200 dark:bg-gray-900">{tier.currency}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={tier.minAmount} 
                                            onChange={(e) => handleTierChange(index, 'minAmount', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={tier.maxAmount} 
                                            onChange={(e) => handleTierChange(index, 'maxAmount', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                            placeholder="100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <select 
                                            value={tier.feeType} 
                                            onChange={(e) => handleTierChange(index, 'feeType', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                        >
                                            <option value="fixed">Fixed ({currencySymbols[tier.currency]})</option>
                                            <option value="percentage">Percent (%)</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={tier.feeValue} 
                                            onChange={(e) => handleTierChange(index, 'feeValue', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                            placeholder="Fee"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center items-center">
                                        <label className="inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={tier.enabled !== false}
                                                onChange={(e) => handleTierChange(index, 'enabled', e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <Button type="button" size="sm" variant="danger" onClick={() => handleRemoveTier(index)} className="py-1 px-2">X</Button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                        <div className="mt-4">
                            <Button type="button" size="sm" variant="secondary" onClick={handleAddTier} disabled={!tierCurrencyFilter}>
                               {tierCurrencyFilter ? `+ Add Fee Tier for ${tierCurrencyFilter}` : 'Select a Currency to Add Tier'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* WITHDRAWALS TAB */}
        {activeTab === 'withdrawals' && (
            <div className="space-y-6 animate-fade-in">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Withdrawal Restrictions</h3>
                
                {/* 1. Active Plan Restriction */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white">Plan-Based Amount Limits</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                If enabled, users can <strong>only</strong> withdraw amounts that match the price of their currently active investment plans.
                            </p>
                        </div>
                        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                            <input 
                                id="restrictWithdrawalAmount"
                                name="restrictWithdrawalAmount"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-400"
                                checked={localSettings.restrictWithdrawalAmount}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="restrictWithdrawalAmount" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.restrictWithdrawalAmount ? 'bg-blue-400' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>
                </div>

                {/* 2. Frequency Restriction */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white">Withdrawal Frequency Limit</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Limit how often a user can submit a withdrawal request.
                            </p>
                        </div>
                        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                            <input 
                                id="withdrawalFrequency.enabled"
                                name="withdrawalFrequency.enabled"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-400"
                                checked={localSettings.withdrawalFrequency?.enabled}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="withdrawalFrequency.enabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.withdrawalFrequency?.enabled ? 'bg-blue-400' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>

                    {localSettings.withdrawalFrequency?.enabled && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md border dark:border-gray-600 animate-fade-in">
                            <span className="text-sm font-medium">Allow 1 withdrawal every:</span>
                            <input 
                                type="number" 
                                min="1"
                                name="withdrawalFrequency.value"
                                value={localSettings.withdrawalFrequency.value}
                                onChange={handleFrequencyChange}
                                className="w-20 rounded-md dark:bg-gray-700 dark:border-gray-600 text-center"
                            />
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
                    )}
                </div>
            </div>
        )}

        {/* COMMISSIONS TAB */}
        {activeTab === 'commissions' && (
            <div className="space-y-6 animate-fade-in">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Referral Commission Rules</h3>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-bold mb-1">Important:</p>
                    These settings strictly control when a sponsor receives a commission. If conditions are not met, commissions will be <strong>HELD (Pending)</strong> until the user qualifies.
                </div>

                {/* Rule 1: Any Active Plan */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-start space-x-3">
                        <input 
                            id="requireActivePlanForCommission"
                            name="requireActivePlanForCommission"
                            type="checkbox" 
                            className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={localSettings.requireActivePlanForCommission}
                            onChange={handleCheckboxChange}
                        />
                        <div>
                            <label htmlFor="requireActivePlanForCommission" className="block font-semibold text-gray-900 dark:text-white">Require Any Active Plan</label>
                            <p className="text-sm text-gray-500 mt-1">
                                If checked, a sponsor must have <strong>at least one</strong> active investment plan to receive commissions. Free users will have commissions held.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Rule 2: Strict Plan Match */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-start space-x-3">
                        <input 
                            id="requirePlanMatchForCommission"
                            name="requirePlanMatchForCommission"
                            type="checkbox" 
                            className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={localSettings.requirePlanMatchForCommission}
                            onChange={handleCheckboxChange}
                        />
                        <div>
                            <label htmlFor="requirePlanMatchForCommission" className="block font-semibold text-gray-900 dark:text-white">Strict Plan Matching (High Security)</label>
                            <p className="text-sm text-gray-500 mt-1">
                                If checked, the sponsor must own the <strong>EXACT SAME PLAN</strong> that the referral purchased.
                                <br/>
                                <em>Example: If Referral buys Plan A, Sponsor gets paid only if they also have Plan A active.</em>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}
       
        <div className="pt-6 border-t dark:border-gray-700 flex justify-end">
           <Button type="submit" disabled={isSaving} size="lg" className="px-8">
               {isSaving ? 'Saving Settings...' : 'Save All Changes'}
           </Button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
