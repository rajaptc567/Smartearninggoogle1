
import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { Settings as SettingsType, TransferFeeTier, Currency, currencySymbols, InvestmentPlan, formatCurrency } from '../types';
import { updateSettings } from '../services/api';

const Settings: React.FC = () => {
  const { state, dispatch } = useData();
  const { settings, investmentPlans } = state;

  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'transfers' | 'withdrawals' | 'commissions' | 'exchange_rates' | 'homepage'>('general');
  const [tierCurrencyFilter, setTierCurrencyFilter] = useState<Currency | ''>('');
  const [isDirty, setIsDirty] = useState(false);

  // Rate Simulator State
  const [simAmount, setSimAmount] = useState<number>(100);
  const [simFrom, setSimFrom] = useState<Currency>('USD');
  const [simTo, setSimTo] = useState<Currency>('PKR');


  useEffect(() => {
    // Merge provided settings with defaults, ensuring nested objects like exchangeRates are fully populated.
    // UPDATED DEFAULTS: PKR 278, EUR 0.92
    const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.00 };
    const incomingRates = settings.exchangeRates || {};

    // Fix for PKR defaulting to 1: If DB has 1, override with 278 for UI until saved.
    // This solves the "1 USD = 1 PKR" issue if the database wasn't seeded correctly.
    const mergedRates = {
        USD: incomingRates.USD || defaultRates.USD,
        EUR: incomingRates.EUR || defaultRates.EUR,
        PKR: (incomingRates.PKR && incomingRates.PKR !== 1) ? incomingRates.PKR : defaultRates.PKR
    };

    setLocalSettings(prev => ({
        ...settings,
        transferConfig: settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [] },
        exchangeRates: mergedRates,
        homepageVideoUrl: settings.homepageVideoUrl || '',
        homepageContent: settings.homepageContent || { heroTitle: '', heroSubtitle: '', feature1Title: '', feature1Desc: '', feature2Title: '', feature2Desc: '', feature3Title: '', feature3Desc: '', videoTitle: '', videoDesc: '', multiCurrencyTitle: '', multiCurrencyDesc: '', mlmTitle: '', mlmDesc: '', ctaTitle: '', ctaDesc: '' },
        featuredPlanIds: settings.featuredPlanIds || []
    }));
    setIsDirty(false);
  }, [settings]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('homepageContent.')) {
        const field = name.split('.')[1];
        setLocalSettings(prev => ({ ...prev, homepageContent: { ...prev.homepageContent, [field]: value }}));
    } else {
        setLocalSettings(prev => ({...prev, [name]: value }));
    }
    setIsDirty(true);
  }

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
    setIsDirty(true);
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
      setIsDirty(true);
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
        setIsDirty(true);
    };

    const handleFeaturedPlanChange = (planId: string) => {
        const currentIds = localSettings.featuredPlanIds || [];
        let newIds;
        if (currentIds.includes(planId)) {
            newIds = currentIds.filter(id => id !== planId);
        } else {
            newIds = [...currentIds, planId];
        }
        setLocalSettings(prev => ({ ...prev, featuredPlanIds: newIds }));
        setIsDirty(true);
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
      setIsDirty(true);
  };

  const handleRemoveTier = (index: number) => {
      setLocalSettings(prev => ({
          ...prev,
          transferConfig: {
              ...prev.transferConfig,
              tiers: prev.transferConfig.tiers.filter((_, i) => i !== index)
          }
      }));
      setIsDirty(true);
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
      setIsDirty(true);
  };
  
  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          const updatedSettings = await updateSettings(localSettings);
          dispatch({ type: 'UPDATE_SETTINGS', payload: updatedSettings });
          alert('Settings saved successfully!');
          setIsDirty(false);
      } catch (error) {
          console.error("Failed to save settings:", error);
          alert(`Error: ${error instanceof Error ? error.message : 'Could not save settings.'}`);
      } finally {
          setIsSaving(false);
      }
  };

  const calculateConversion = (amount: number, from: Currency, to: Currency, rates: any) => {
      if (from === to) return amount;
      
      // Safety check: ensure rates object exists, defaults to standard if missing
      // Default PKR to 278 if it's missing or 0/1 in the passed object to prevent 1:1 error
      const safeRates = { ...rates };
      if (!safeRates.PKR || safeRates.PKR === 1) safeRates.PKR = 278.00;
      if (!safeRates.EUR || safeRates.EUR === 0) safeRates.EUR = 0.92;
      if (!safeRates.USD || safeRates.USD === 0) safeRates.USD = 1;
      
      const rateFrom = safeRates[from] || 1;
      const rateTo = safeRates[to] || 1;
      
      // Logic: Amount / FromRate (to Base USD) * ToRate (to Target)
      // Example: 100 USD -> PKR. 100 / 1 * 278 = 27800.
      const inUsd = amount / rateFrom;
      return inUsd * rateTo;
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
          <TabButton id="homepage" label="Homepage" />
          <TabButton id="transfers" label="Transfers & Fees" />
          <TabButton id="withdrawals" label="Withdrawals" />
          <TabButton id="commissions" label="Commissions" />
          <TabButton id="exchange_rates" label="Exchange Rates" />
      </div>

      <form onSubmit={handleSave} className="space-y-6 min-h-[400px]">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
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
                     {localSettings.transferConfig?.enabled && (
                        <div className="pl-8 mt-2 animate-fade-in">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                <div>
                                    <label htmlFor="transferConfig.allowCrossCurrency" className="block text-sm font-medium text-gray-900 dark:text-gray-200">Allow Cross-Currency Transfers</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If enabled, users can send funds to members with a different account currency (e.g., USD to PKR). Exchange rates will apply.</p>
                                </div>
                                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                    <input
                                        id="transferConfig.allowCrossCurrency"
                                        name="transferConfig.allowCrossCurrency"
                                        type="checkbox"
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                        checked={localSettings.transferConfig?.allowCrossCurrency ?? false}
                                        onChange={() => {
                                            setLocalSettings(prev => ({
                                                ...prev,
                                                transferConfig: { ...prev.transferConfig, allowCrossCurrency: !prev.transferConfig?.allowCrossCurrency }
                                            }));
                                            setIsDirty(true);
                                        }}
                                    />
                                    <label htmlFor="transferConfig.allowCrossCurrency" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.transferConfig?.allowCrossCurrency ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* HOMEPAGE TAB */}
        {activeTab === 'homepage' && (
            <div className="space-y-6 animate-fade-in">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Homepage Content</h3>
                <p className="text-sm text-gray-500">Edit the content of the main landing page. You can also edit this directly on the page by adding `?edit=true` to the URL.</p>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Featured Investment Plans</h4>
                    <p className="text-xs text-gray-500">Select plans to display on the homepage. The current design shows a maximum of 3.</p>
                    
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
                                                        checked={(localSettings.featuredPlanIds || []).includes(plan._id)}
                                                        onChange={() => handleFeaturedPlanChange(plan._id)}
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

                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Videos</h4>
                    <div>
                        <label htmlFor="homepageVideoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Homepage Video URL</label>
                        <input id="homepageVideoUrl" name="homepageVideoUrl" type="text" value={localSettings.homepageVideoUrl || ''} onChange={handleTextChange} className="mt-1 block w-full rounded-md dark:bg-gray-700" placeholder="https://www.youtube.com/embed/..."/>
                        <p className="mt-1 text-xs text-gray-500">Paste the 'embed' URL. For a seamless look, add: <code className="text-xs bg-gray-200 dark:bg-gray-600 p-1 rounded">?autoplay=1&mute=1&loop=1&playlist=VIDEO_ID&controls=0</code></p>
                    </div>
                </div>

                 <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                     <h4 className="font-semibold text-gray-800 dark:text-white">Text Content</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium">Hero Title</label>
                            <textarea name="homepageContent.heroTitle" value={localSettings.homepageContent?.heroTitle || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Hero Subtitle</label>
                            <textarea name="homepageContent.heroSubtitle" value={localSettings.homepageContent?.heroSubtitle || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Feature 1 Title</label>
                            <input name="homepageContent.feature1Title" value={localSettings.homepageContent?.feature1Title || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Feature 1 Description</label>
                            <textarea name="homepageContent.feature1Desc" value={localSettings.homepageContent?.feature1Desc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Feature 2 Title</label>
                            <input name="homepageContent.feature2Title" value={localSettings.homepageContent?.feature2Title || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Feature 2 Description</label>
                            <textarea name="homepageContent.feature2Desc" value={localSettings.homepageContent?.feature2Desc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Feature 3 Title</label>
                            <input name="homepageContent.feature3Title" value={localSettings.homepageContent?.feature3Title || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Feature 3 Description</label>
                            <textarea name="homepageContent.feature3Desc" value={localSettings.homepageContent?.feature3Desc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Video Section Title</label>
                            <textarea name="homepageContent.videoTitle" value={localSettings.homepageContent?.videoTitle || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Video Section Description</label>
                            <textarea name="homepageContent.videoDesc" value={localSettings.homepageContent?.videoDesc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">CTA Section Title</label>
                            <textarea name="homepageContent.ctaTitle" value={localSettings.homepageContent?.ctaTitle || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">CTA Section Description</label>
                            <textarea name="homepageContent.ctaDesc" value={localSettings.homepageContent?.ctaDesc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                    </div>
                 </div>
            </div>
        )}
        
        {/* EXCHANGE RATES TAB */}
        {activeTab === 'exchange_rates' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Currency Exchange Rates</h3>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-sm text-green-800 dark:text-green-200 mb-4 border border-green-200 dark:border-green-800">
                    <span className="font-bold">Info:</span> Define how other currencies convert to the base currency (USD). These rates are used for cross-currency transfers, commission calculations, and plan equivalencies.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Rates relative to USD (Base)</h4>
                        <div>
                            <label htmlFor="rate-usd" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Base Currency (USD)</label>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="font-bold text-lg text-gray-500">1 USD =</span>
                                <input id="rate-usd" type="number" value="1" disabled className="w-full rounded-md bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 cursor-not-allowed font-mono" />
                                <span className="font-bold text-gray-700 dark:text-gray-300 w-12">USD</span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="rate-eur" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Euro Rate</label>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="font-bold text-lg text-gray-500">1 USD =</span>
                                <input 
                                    id="rate-eur"
                                    name="exchangeRates.EUR"
                                    type="number" 
                                    step="0.0001"
                                    value={localSettings.exchangeRates?.EUR || ''} 
                                    onChange={handleExchangeRateChange} 
                                    className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                                />
                                <span className="font-bold text-gray-700 dark:text-gray-300 w-12">EUR</span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="rate-pkr" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pakistani Rupee Rate</label>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="font-bold text-lg text-gray-500">1 USD =</span>
                                <input 
                                    id="rate-pkr"
                                    name="exchangeRates.PKR"
                                    type="number" 
                                    step="0.01"
                                    value={localSettings.exchangeRates?.PKR || ''} 
                                    onChange={handleExchangeRateChange} 
                                    className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                                />
                                <span className="font-bold text-gray-700 dark:text-gray-300 w-12">PKR</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-700">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300">Calculated Reference Rates</h4>
                            <div className="text-sm space-y-2 font-mono text-gray-600 dark:text-gray-400">
                                <p>1 USD = <strong>{(localSettings.exchangeRates?.PKR || 278).toFixed(2)}</strong> PKR</p>
                                <p>1 EUR = <strong>{((localSettings.exchangeRates?.PKR || 278) / (localSettings.exchangeRates?.EUR || 0.92)).toFixed(2)}</strong> PKR</p>
                                <p>1 EUR = <strong>{(1 / (localSettings.exchangeRates?.EUR || 0.92)).toFixed(4)}</strong> USD</p>
                            </div>
                        </div>

                        {/* Rate Simulator */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                Rate Simulator
                            </h4>
                            <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
                                Test your current (unsaved) rates to ensure conversions work as intended.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                <div>
                                    <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Amount</label>
                                    <input type="number" value={simAmount} onChange={e => setSimAmount(parseFloat(e.target.value) || 0)} className="w-full rounded-md text-sm py-1.5 dark:bg-gray-700 dark:border-gray-600 border-gray-300"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium uppercase text-gray-500 mb-1">From</label>
                                    <select value={simFrom} onChange={e => setSimFrom(e.target.value as Currency)} className="w-full rounded-md text-sm py-1.5 dark:bg-gray-700 dark:border-gray-600 border-gray-300">
                                        <option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium uppercase text-gray-500 mb-1">To</label>
                                    <select value={simTo} onChange={e => setSimTo(e.target.value as Currency)} className="w-full rounded-md text-sm py-1.5 dark:bg-gray-700 dark:border-gray-600 border-gray-300">
                                        <option value="PKR">PKR</option><option value="USD">USD</option><option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                                <span className="text-gray-500 text-xs uppercase tracking-wide">Result:</span>
                                <span className="text-xl font-bold ml-2 text-green-600 dark:text-green-400">
                                    {formatCurrency(calculateConversion(simAmount, simFrom, simTo, localSettings.exchangeRates), simTo)}
                                </span>
                            </div>
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
           <Button type="submit" disabled={isSaving || !isDirty} size="lg" className="px-8">
               {isSaving ? 'Saving Settings...' : 'Save All Changes'}
           </Button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
