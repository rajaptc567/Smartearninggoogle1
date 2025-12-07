
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
  const [simFrom, setSimFrom] = useState<Currency>('PKR');
  const [simTo, setSimTo] = useState<Currency>('EUR');

  // Fake fetching state for UX
  const [isFetchingRates, setIsFetchingRates] = useState(false);


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

    const handleFetchLiveRates = () => {
        setIsFetchingRates(true);
        // Simulate API call to Forex service
        setTimeout(() => {
            setLocalSettings(prev => ({
                ...prev,
                exchangeRates: {
                    USD: 1,
                    EUR: 0.915, // Mock live rate
                    PKR: 278.45 // Mock live rate
                }
            }));
            setIsFetchingRates(false);
            setIsDirty(true);
            alert("Live rates fetched successfully (Simulated)");
        }, 1000);
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
      
      const safeRates = { ...rates };
      if (!safeRates.PKR || safeRates.PKR === 1) safeRates.PKR = 278.00;
      if (!safeRates.EUR || safeRates.EUR === 0) safeRates.EUR = 0.92;
      if (!safeRates.USD || safeRates.USD === 0) safeRates.USD = 1;
      
      const rateFrom = safeRates[from] || 1;
      const rateTo = safeRates[to] || 1;
      
      // Logic: Amount / FromRate (to Base USD) * ToRate (to Target)
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
                {/* ... General Content ... */}
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
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If enabled, users can send funds to members with a different account currency (e.g., PKR to EUR). Exchange rates will apply.</p>
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
               <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Featured Investment Plans</h4>
                    <p className="text-xs text-gray-500">Select plans to display on the homepage. The current design shows a maximum of 3.</p>
                    
                    <div className="space-y-4">
                        {(['PKR', 'EUR'] as const).map(currency => {
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
                {/* ... Rest of Homepage Content ... */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                     <h4 className="font-semibold text-gray-800 dark:text-white">Text Content</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium">Hero Title</label>
                            <textarea name="homepageContent.heroTitle" value={localSettings.homepageContent?.heroTitle || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700"/>
                        </div>
                         {/* ... other homepage inputs ... */}
                    </div>
                 </div>
            </div>
        )}
        
        {/* EXCHANGE RATES TAB */}
        {activeTab === 'exchange_rates' && (
            <div className="space-y-8 animate-fade-in">
                
                <div className="flex flex-col sm:flex-row justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                     <div className="mb-3 sm:mb-0">
                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">System Base Currency</h4>
                        <div className="text-2xl font-extrabold text-blue-900 dark:text-white mt-1">1.00 USD <span className="text-base font-normal opacity-70">($)</span></div>
                    </div>
                     <div className="text-sm text-blue-700 dark:text-blue-200 max-w-md text-right">
                        All calculations in the system are anchored to the US Dollar. <br/>
                        Modify the rates below to change how EUR and PKR are valued against 1 USD.
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: RATE INPUTS */}
                    <div className="lg:col-span-2 space-y-6">
                         <div className="flex justify-between items-end">
                            <h4 className="font-semibold text-gray-800 dark:text-white text-lg">Active Rates</h4>
                             <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={handleFetchLiveRates}
                                disabled={isFetchingRates}
                             >
                                {isFetchingRates ? 'Fetching...' : 'Simulate Fetch Live Rates'}
                            </Button>
                        </div>
                        
                        {/* EUR CARD */}
                        <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xl">🇪🇺</div>
                                    <div>
                                        <h5 className="font-bold text-gray-900 dark:text-white">Euro (EUR)</h5>
                                        <p className="text-xs text-gray-500">European Union</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase">Current</div>
                                    <div className="font-mono font-bold">{localSettings.exchangeRates?.EUR}</div>
                                </div>
                            </div>
                            <div className="p-5">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exchange Rate</label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                        <span className="text-gray-500 sm:text-sm font-bold">1 USD = </span>
                                    </div>
                                    <input
                                        name="exchangeRates.EUR"
                                        type="number"
                                        step="0.0001"
                                        value={localSettings.exchangeRates?.EUR || ''}
                                        onChange={handleExchangeRateChange}
                                        className="block w-full rounded-md border-gray-300 pl-20 focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 py-3 font-mono text-lg"
                                        placeholder="0.92"
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <span className="text-gray-500 sm:text-sm">EUR</span>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-gray-500">Lower value means EUR is stronger than USD.</p>
                            </div>
                        </div>

                        {/* PKR CARD */}
                        <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
                             <div className="p-4 border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xl">🇵🇰</div>
                                    <div>
                                        <h5 className="font-bold text-gray-900 dark:text-white">Pakistani Rupee (PKR)</h5>
                                        <p className="text-xs text-gray-500">Pakistan</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase">Current</div>
                                    <div className="font-mono font-bold">{localSettings.exchangeRates?.PKR}</div>
                                </div>
                            </div>
                            <div className="p-5">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exchange Rate</label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                        <span className="text-gray-500 sm:text-sm font-bold">1 USD = </span>
                                    </div>
                                    <input
                                        name="exchangeRates.PKR"
                                        type="number"
                                        step="0.01"
                                        value={localSettings.exchangeRates?.PKR || ''}
                                        onChange={handleExchangeRateChange}
                                        className="block w-full rounded-md border-gray-300 pl-20 focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 py-3 font-mono text-lg"
                                        placeholder="278.00"
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <span className="text-gray-500 sm:text-sm">PKR</span>
                                    </div>
                                </div>
                                 <p className="mt-2 text-xs text-gray-500">Higher value means PKR is weaker than USD.</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* RIGHT COLUMN: SIMULATOR & REFERENCE */}
                    <div className="space-y-6">
                        
                         {/* Calculator */}
                        <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg border border-gray-700 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500 rounded-full opacity-20 blur-xl"></div>
                            <h4 className="font-bold text-lg mb-4 flex items-center relative z-10">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                Conversion Check
                            </h4>
                            
                            <div className="space-y-4 relative z-10">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Amount</label>
                                    <input type="number" value={simAmount} onChange={e => setSimAmount(parseFloat(e.target.value) || 0)} className="w-full mt-1 bg-gray-800 border-gray-600 rounded-md text-white px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">From</label>
                                        <select value={simFrom} onChange={e => setSimFrom(e.target.value as Currency)} className="w-full mt-1 bg-gray-800 border-gray-600 rounded-md text-white px-2 py-2">
                                            <option value="EUR">EUR</option><option value="PKR">PKR</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">To</label>
                                        <select value={simTo} onChange={e => setSimTo(e.target.value as Currency)} className="w-full mt-1 bg-gray-800 border-gray-600 rounded-md text-white px-2 py-2">
                                            <option value="PKR">PKR</option><option value="EUR">EUR</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-4 mt-2 border-t border-gray-700">
                                    <div className="text-xs text-gray-400 mb-1">Result (based on inputs above)</div>
                                    <div className="text-2xl font-mono font-bold text-green-400">
                                        {formatCurrency(calculateConversion(simAmount, simFrom, simTo, localSettings.exchangeRates), simTo)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reference Table */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h4 className="font-bold text-gray-800 dark:text-white mb-3 text-sm uppercase tracking-wide">Cross-Rate Reference</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                    <span className="text-gray-600 dark:text-gray-400">1 EUR =</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                                        {((localSettings.exchangeRates?.PKR || 278) / (localSettings.exchangeRates?.EUR || 0.92)).toFixed(2)} PKR
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                    <span className="text-gray-600 dark:text-gray-400">1000 PKR =</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                                        {(1000 / ((localSettings.exchangeRates?.PKR || 278) / (localSettings.exchangeRates?.EUR || 0.92))).toFixed(2)} EUR
                                    </span>
                                </div>
                            </div>
                             <p className="mt-3 text-xs text-gray-500 italic">
                                * These values are calculated automatically from the USD base rates you entered on the left.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TRANSFERS TAB */}
        {activeTab === 'transfers' && (
            <div className="space-y-6 animate-fade-in">
                {/* ... Transfer content ... */}
                 <div>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transfer Fee Structure</h3>
                        <select
                            value={tierCurrencyFilter}
                            onChange={(e) => setTierCurrencyFilter(e.target.value as Currency | '')}
                            className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">Show All</option>
                            <option value="EUR">EUR</option>
                            <option value="PKR">PKR</option>
                        </select>
                    </div>
                    {/* ... Rest of Transfer Tab ... */}
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
                {/* ... Withdrawal Content ... */}
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Withdrawal Restrictions</h3>
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
                {/* ... Commissions Content ... */}
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Referral Commission Rules</h3>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-bold mb-1">Important:</p>
                    These settings strictly control when a sponsor receives a commission. If conditions are not met, commissions will be <strong>HELD (Pending)</strong> until the user qualifies.
                </div>
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
