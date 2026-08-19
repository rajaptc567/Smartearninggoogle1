
import React, { useState, useMemo, useEffect } from 'react';
import { InvestmentPlan, Status, CommissionType, Commission, Currency, formatCurrency, Rule, currencySymbols } from '../types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { createInvestmentPlan, updateInvestmentPlan, deleteInvestmentPlan, createRule, updateRule, deleteRule, updateSettings } from '../services/api';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean; size?: 'sm' | 'md' }> = ({ checked, onChange, disabled, size = 'md' }) => (
    <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
        <div className={`relative ${size === 'sm' ? 'w-9 h-5' : 'w-11 h-6'} bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute ${size === 'sm' ? 'after:top-[2px] after:start-[2px] after:h-4 after:w-4' : 'after:top-0.5 after:start-[2px] after:h-5 after:w-5'} after:bg-white after:border-gray-300 after:border after:rounded-full after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}></div>
    </label>
);

const InvestmentPlans: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans, rules, settings } = state;
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<InvestmentPlan | null>(null);
    
    // Filters
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');
    const [statusFilter, setStatusFilter] = useState<'Active' | 'Disabled' | ''>('');
    const [priceSort, setPriceSort] = useState<'low-high' | 'high-low' | ''>('');
    
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Rule Management State
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [managingRulePlan, setManagingRulePlan] = useState<InvestmentPlan | null>(null);

    // Sequence Management State
    const [isSeqSaving, setIsSeqSaving] = useState(false);
    const [localSortType, setLocalSortType] = useState<string>(settings.planSortType || 'price-asc');
    const [localManualOrder, setLocalManualOrder] = useState<string[]>(settings.manualPlanOrder || []);

    useEffect(() => {
        setLocalSortType(settings.planSortType || 'price-asc');
        setLocalManualOrder(settings.manualPlanOrder || []);
    }, [settings]);

    const handleOpenModal = (plan: InvestmentPlan | null = null) => {
        setEditingPlan(plan);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingPlan(null);
        setIsModalOpen(false);
    };

    const handleSave = async (plan: InvestmentPlan) => {
        try {
            if (editingPlan) {
                const updatedPlan = await updateInvestmentPlan(plan._id, plan);
                dispatch({ type: 'UPDATE_INVESTMENT_PLAN', payload: updatedPlan });
            } else {
                const newPlan = await createInvestmentPlan(plan);
                dispatch({ type: 'ADD_INVESTMENT_PLAN', payload: newPlan });
            }
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save plan:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not save plan.'}`);
        }
    };

    const handleDelete = async (planId: string) => {
        if (window.confirm('Are you sure you want to delete this plan?')) {
            try {
                await deleteInvestmentPlan(planId);
                dispatch({ type: 'DELETE_INVESTMENT_PLAN', payload: planId });
            } catch (error) {
                console.error("Failed to delete plan:", error);
                alert(`Error: ${error instanceof Error ? error.message : 'Could not delete plan.'}`);
            }
        }
    };

    const handleToggleStatus = async (plan: InvestmentPlan) => {
        setTogglingId(plan._id);
        const newStatus = plan.status === Status.Active ? Status.Disabled : Status.Active;
        try {
            const updatedPlan = await updateInvestmentPlan(plan._id, { status: newStatus });
            dispatch({ type: 'UPDATE_INVESTMENT_PLAN', payload: updatedPlan });
        } catch (error) {
            console.error("Failed to update plan status:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not update plan status.'}`);
        } finally {
            setTogglingId(null);
        }
    };

    const handleSaveGlobalOrder = async () => {
        setIsSeqSaving(true);
        try {
            const updated = await updateSettings({
                planSortType: localSortType as any,
                manualPlanOrder: localManualOrder
            });
            dispatch({ type: 'UPDATE_SETTINGS', payload: updated });
            alert("Display sequence saved successfully.");
        } catch (error) {
            console.error(error);
            alert("Failed to save sequence.");
        } finally {
            setIsSeqSaving(false);
        }
    };

    const moveInManualOrder = (planId: string, direction: 'up' | 'down') => {
        const activePlansInView = investmentPlans.filter(p => p.currency === currencyFilter && p.status === 'Active');
        const planIdsInView = activePlansInView.map(p => p._id);
        
        // We only care about the order of plans currently in the active set for this currency
        const currentCurrencyOrder = localManualOrder.filter(id => planIdsInView.includes(id));
        
        // Add any active plans not in the manual order yet
        const missingIds = planIdsInView.filter(id => !currentCurrencyOrder.includes(id));
        const fullCurrencyOrder = [...currentCurrencyOrder, ...missingIds];

        const index = fullCurrencyOrder.indexOf(planId);
        if (index === -1) return;

        const newOrder = [...fullCurrencyOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }

        // Merge back into global manual order: Remove these IDs from the old global list and prepend the new sorted list
        const otherCurrencyIds = localManualOrder.filter(id => !planIdsInView.includes(id));
        setLocalManualOrder([...newOrder, ...otherCurrencyIds]);
    };

    // --- Rule Management Handlers ---
    
    const handleOpenRuleModal = (plan: InvestmentPlan) => {
        setManagingRulePlan(plan);
        setIsRuleModalOpen(true);
    };

    const handleCloseRuleModal = () => {
        setManagingRulePlan(null);
        setIsRuleModalOpen(false);
    }

    const handleToggleRule = async (rule: Rule) => {
        try {
            await updateRule(rule._id, { isActive: !rule.isActive });
            window.location.reload(); 
        } catch (error) {
            console.error("Failed to toggle rule:", error);
            alert("Failed to toggle rule status.");
        }
    };


    const renderDirectCommissionSummary = (plan: InvestmentPlan) => {
        const comms = plan.directCommissions;
        if (!comms || comms.length === 0) return 'None';
        let maxVal = 0;
        let maxType = 'percentage';
        comms.forEach(c => {
            if (c.value > maxVal) {
                maxVal = c.value;
                maxType = c.type;
            }
        });
        const formattedVal = maxType === 'percentage' ? `${maxVal}%` : formatCurrency(maxVal, plan.currency);
        return comms.length > 1 ? `Up to ${formattedVal}` : formattedVal;
    };

    const formatPlanPrice = (amount: number, currency: string) => {
        const symbol = currencySymbols[currency] || currency;
        if (amount % 1 === 0) {
            return `${symbol} ${amount.toLocaleString()}`;
        }
        return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const filteredPlans = useMemo(() => {
        let list = [...investmentPlans]
            .filter(plan => {
                const matchesCurrency = !currencyFilter || plan.currency?.toUpperCase() === currencyFilter;
                const matchesStatus = !statusFilter || plan.status === statusFilter;
                return matchesCurrency && matchesStatus;
            });

        // Apply visual sort for admin view
        list.sort((a, b) => {
            if (priceSort === 'low-high') return a.price - b.price;
            if (priceSort === 'high-low') return b.price - a.price;
            return 0; 
        });

        return list;
    }, [investmentPlans, currencyFilter, priceSort, statusFilter]);


    return (
        <div>
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Investment Plans</h2>
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                    <select
                        value={currencyFilter}
                        onChange={(e) => setCurrencyFilter(e.target.value as Currency | '')}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Currencies</option>
                        <option value="PKR">PKR</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </select>
                    
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Disabled">Disabled</option>
                    </select>

                    <Button onClick={() => handleOpenModal()}>Create New Plan</Button>
                </div>
            </div>

            {/* Global Display Sequence Settings */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8 border border-blue-100 dark:border-blue-900">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-blue-500">⚙️</span> User-Side Plan Ordering
                        </h3>
                        <p className="text-sm text-gray-500">Control the sequence in which plans appear on the member dashboard.</p>
                    </div>
                    <Button onClick={handleSaveGlobalOrder} disabled={isSeqSaving} size="sm">
                        {isSeqSaving ? 'Saving...' : 'Save Display Sequence'}
                    </Button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold mb-2">1. Sequence Method</label>
                        <select 
                            className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={localSortType}
                            onChange={e => setLocalSortType(e.target.value)}
                        >
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                            <option value="manual">Manual Custom Sequence</option>
                        </select>
                    </div>

                    {localSortType === 'manual' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-semibold mb-2">2. Manual Priority {currencyFilter ? `for ${currencyFilter}` : '(Select a currency filter above)'}</label>
                            {currencyFilter ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto border dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                                    {(() => {
                                        const activeInCurrency = investmentPlans.filter(p => p.currency === currencyFilter && p.status === 'Active');
                                        const orderedIds = localManualOrder.filter(id => activeInCurrency.some(p => p._id === id));
                                        const missingIds = activeInCurrency.filter(p => !orderedIds.includes(p._id)).map(p => p._id);
                                        const fullOrderIds = [...orderedIds, ...missingIds];

                                        return fullOrderIds.map((id, idx) => {
                                            const plan = investmentPlans.find(p => p._id === id);
                                            if (!plan) return null;
                                            return (
                                                <div key={id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded shadow-sm border dark:border-gray-700">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                                                        <span className="text-sm font-medium">{plan.name}</span>
                                                        <span className="text-xs text-blue-500 font-bold">{formatCurrency(plan.price, plan.currency)}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => moveInManualOrder(id, 'up')}
                                                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                                                            disabled={idx === 0}
                                                        >
                                                            <ChevronUpIcon />
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => moveInManualOrder(id, 'down')}
                                                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                                                            disabled={idx === fullOrderIds.length - 1}
                                                        >
                                                            <ChevronDownIcon />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            ) : (
                                <p className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">Please select a specific currency filter above to manage its manual sequence.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlans.map((plan: InvestmentPlan) => {
                    const activeRule = rules.find(r => r.targetPlanId === plan._id);
                    
                    return (
                        <div key={plan._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                                <div className="flex items-center gap-2">
                                    <Badge status={plan.status} />
                                    <ToggleSwitch 
                                        checked={plan.status === Status.Active} 
                                        onChange={() => handleToggleStatus(plan)} 
                                        disabled={togglingId === plan._id}
                                    />
                                </div>
                            </div>
                            
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">{formatPlanPrice(plan.price, plan.currency)}</p>
                            
                            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-grow">
                                <li><span className="font-semibold">Duration:</span> {plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}</li>
                                <li><span className="font-semibold">Min. Withdraw:</span> {formatCurrency(plan.minWithdraw, plan.currency)}</li>
                                <li><span className="font-semibold">Direct Referrals:</span> {plan.directReferralLimit === 0 ? 'Unlimited' : `Up to ${plan.directReferralLimit}`}</li>
                                <li>
                                    <span className="font-semibold">Direct Commission: </span> 
                                    {renderDirectCommissionSummary(plan)}
                                </li>
                                <li>
                                    <span className="font-semibold">Indirect Levels: </span> 
                                    {plan.indirectCommissions.length}
                                </li>
                            </ul>
                            
                            <p className="text-xs text-gray-500 mt-4 mb-4 line-clamp-2">{plan.description}</p>

                            <div className={`mt-auto mb-4 p-3 rounded-md border text-sm ${activeRule ? (activeRule.isActive !== false ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-700/30 dark:border-gray-600') : 'border-dashed border-gray-300 dark:border-gray-600'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`font-bold ${activeRule ? 'text-amber-800 dark:text-amber-200' : 'text-gray-500'}`}>
                                        {activeRule ? '⚠️ Joining Rules Active' : 'No Joining Rules'}
                                    </span>
                                    {activeRule && (
                                        <ToggleSwitch 
                                            checked={activeRule.isActive !== false} 
                                            onChange={() => handleToggleRule(activeRule)} 
                                            size="sm"
                                        />
                                    )}
                                </div>
                                {activeRule ? (
                                    <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                                        {activeRule.requiredPlanNames?.length > 0 && <div>Must have: <span className="font-semibold">{activeRule.requiredPlanNames.join(', ')}</span></div>}
                                        {activeRule.minTotalEarnings > 0 && <div>Min Earned: <span className="font-semibold">{formatCurrency(activeRule.minTotalEarnings, plan.currency)}</span></div>}
                                        {activeRule.minDirectReferrals > 0 && <div>Min Refs: <span className="font-semibold">{activeRule.minDirectReferrals}</span></div>}
                                        <div className="pt-2">
                                            <button onClick={() => handleOpenRuleModal(plan)} className="text-blue-600 hover:underline">Edit Rules</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => handleOpenRuleModal(plan)} className="text-blue-600 hover:underline text-xs">+ Add Restriction Rule</button>
                                )}
                            </div>

                            <div className="flex justify-end space-x-2 pt-2 border-t dark:border-gray-700">
                                <Button size="sm" variant="secondary" onClick={() => handleOpenModal(plan)}>Edit Plan</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDelete(plan._id)}>Delete Plan</Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isModalOpen && (
                <PlanFormModal
                    plan={editingPlan}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                />
            )}

            {isRuleModalOpen && managingRulePlan && (
                <PlanRuleModal
                    plan={managingRulePlan}
                    existingRule={rules.find(r => r.targetPlanId === managingRulePlan._id)}
                    allPlans={investmentPlans}
                    onClose={handleCloseRuleModal}
                />
            )}
        </div>
    );
};

// --- Icons ---
const ChevronUpIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
const ChevronDownIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

// --- PlanRuleModal Component ---
interface PlanRuleModalProps {
    plan: InvestmentPlan;
    existingRule?: Rule;
    allPlans: InvestmentPlan[];
    onClose: () => void;
}

const PlanRuleModal: React.FC<PlanRuleModalProps> = ({ plan, existingRule, allPlans, onClose }) => {
    const { dispatch } = useData();
    const [selectedRequiredPlans, setSelectedRequiredPlans] = useState<string[]>(existingRule?.requiredPlanIds || []);
    const [minEarnings, setMinEarnings] = useState(existingRule?.minTotalEarnings?.toString() || '');
    const [maxEarnings, setMaxEarnings] = useState(existingRule?.maxTotalEarnings?.toString() || '');
    const [minReferrals, setMinReferrals] = useState(existingRule?.minDirectReferrals?.toString() || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const availableRequiredPlans = allPlans.filter(p => p.currency === plan.currency && p.status === 'Active' && p._id !== plan._id);

    const handleToggleRequiredPlan = (id: string) => {
        setSelectedRequiredPlans(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const requiredPlanNames = selectedRequiredPlans.map(id => allPlans.find(p => p._id === id)?.name || '').filter(Boolean);

        const payload = {
            targetPlanId: plan._id,
            targetPlanName: plan.name,
            currency: plan.currency,
            requiredPlanIds: selectedRequiredPlans,
            requiredPlanNames,
            minTotalEarnings: parseFloat(minEarnings) || 0,
            maxTotalEarnings: parseFloat(maxEarnings) || 0,
            minDirectReferrals: parseInt(minReferrals) || 0,
            isActive: true
        };

        try {
            let result;
            if (existingRule) {
                result = await updateRule(existingRule._id, payload);
                alert("Rule updated successfully!");
            } else {
                result = await createRule(payload);
                dispatch({ type: 'ADD_RULE', payload: result.data || result });
                alert("Rule created successfully!");
            }
            window.location.reload(); 
        } catch (error) {
            console.error("Failed to save rule:", error);
            alert("Error saving rule.");
        } finally {
            setIsSubmitting(false);
            onClose();
        }
    };

    const handleDelete = async () => {
        if (!existingRule) return;
        if (window.confirm("Are you sure you want to remove all restrictions for this plan?")) {
            setIsSubmitting(true);
            try {
                await deleteRule(existingRule._id);
                dispatch({ type: 'DELETE_RULE', payload: existingRule._id });
                onClose();
            } catch (error) {
                 console.error("Failed to delete rule:", error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Manage Rules for <span className="text-blue-600">{plan.name}</span>
                    </h3>
                    {existingRule && (
                        <Button size="sm" variant="danger" onClick={handleDelete} disabled={isSubmitting}>Delete Rule</Button>
                    )}
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    Set conditions that a user must meet <strong>before</strong> they can purchase this plan.
                </p>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                        <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                            1. Required Active Plans
                        </label>
                        {availableRequiredPlans.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                {availableRequiredPlans.map(p => (
                                    <label key={p._id} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedRequiredPlans.includes(p._id)}
                                            onChange={() => handleToggleRequiredPlan(p._id)}
                                            className="rounded text-blue-600"
                                        />
                                        <span className="text-sm">{p.name} <span className="text-xs text-gray-400">({formatCurrency(p.price, p.currency)})</span></span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400">No other {plan.currency} plans available to require.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-200">2. Min Total Earnings</label>
                            <input 
                                type="number" 
                                value={minEarnings} 
                                onChange={e => setMinEarnings(e.target.value)} 
                                placeholder="0.00"
                                className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-200">3. Max Total Earnings</label>
                            <input 
                                type="number" 
                                value={maxEarnings} 
                                onChange={e => setMaxEarnings(e.target.value)} 
                                placeholder="Optional"
                                className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-200">4. Min Direct Referrals</label>
                        <input 
                            type="number" 
                            value={minReferrals} 
                            onChange={e => setMinReferrals(e.target.value)} 
                             placeholder="0"
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Rules'}</Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

interface PlanFormModalProps {
    plan: InvestmentPlan | null;
    onClose: () => void;
    onSave: (plan: InvestmentPlan) => void;
}

const defaultCommission: Commission = { type: 'percentage', value: 0, disabledLevels: [] };
const defaultPlan: Partial<InvestmentPlan> = {
    name: '',
    currency: 'PKR',
    price: 0,
    durationDays: 30,
    minWithdraw: 10,
    status: Status.Active,
    description: '',
    directReferralLimit: 0,
    directCommissions: [{ ...defaultCommission }], 
    indirectCommissions: [],
    commissionDeductions: {
        afterMaxPayout: { ...defaultCommission },
        afterMaxEarning: { ...defaultCommission },
        afterMaxDirect: { ...defaultCommission },
    },
    autoUpgrade: { enabled: false, toPlanId: undefined },
    customFeatures: [],
    displayConfig: { 
        showDuration: true, 
        showMinWithdraw: true, 
        showDirectCommission: true, 
        showIndirectCommission: true, 
        showDirectReferrals: true 
    }
};

const PlanFormModal: React.FC<PlanFormModalProps> = ({ plan, onClose, onSave }) => {
    const { state } = useData();
    
    const initialPlan = plan ? {
        ...defaultPlan,
        ...plan,
        directCommissions: plan.directCommissions && plan.directCommissions.length > 0 
            ? plan.directCommissions.map(c => ({ ...c, disabledLevels: c.disabledLevels || [] })) 
            : (plan.directReferralLimit > 0 ? new Array(plan.directReferralLimit).fill(defaultCommission) : [defaultCommission]),
        customFeatures: plan.customFeatures || [],
        displayConfig: plan.displayConfig || { 
            showDuration: true, 
            showMinWithdraw: true, 
            showDirectCommission: true, 
            showIndirectCommission: true,
            showDirectReferrals: true 
        }
    } : defaultPlan;

    const [formData, setFormData] = useState<Partial<InvestmentPlan>>(initialPlan);
    const [isSaving, setIsSaving] = useState(false);
    const [newFeature, setNewFeature] = useState('');
    
    // Slot control state
    const [configSlotIndex, setConfigSlotIndex] = useState<number | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if(name.startsWith('displayConfig.')) {
            const field = name.split('.')[1];
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, displayConfig: { ...prev.displayConfig!, [field]: checked }}));
            return;
        }

        if(name === 'autoUpgrade.enabled') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, autoUpgrade: { ...prev!.autoUpgrade!, enabled: checked }}));
            return;
        }

        if (name === 'directReferralLimit') {
             const limit = parseFloat(value) || 0;
             setFormData(prev => {
                const currentComms = prev!.directCommissions || [];
                let newComms = [...currentComms];
                const targetLen = limit === 0 ? 1 : limit;
                if (newComms.length < targetLen) {
                    const fillCount = targetLen - newComms.length;
                    for(let i=0; i<fillCount; i++) {
                        newComms.push({ type: 'percentage', value: 0, disabledLevels: [] });
                    }
                } else if (newComms.length > targetLen) {
                    newComms = newComms.slice(0, targetLen);
                }
                return { ...prev, directReferralLimit: limit, directCommissions: newComms };
             });
        } else {
            const numValue = ['price', 'durationDays', 'minWithdraw'].includes(name) ? parseFloat(value) || 0 : value;
            setFormData(prev => ({ ...prev, [name]: numValue }));
        }
    };

    const handleCommissionChange = (path: string, field: 'type' | 'value', value: string) => {
        const [main, sub] = path.split('.');
        setFormData(prev => {
            const newFormData = { ...prev };
            const commissionObject = (newFormData as any)[main][sub];
            if (field === 'value') {
                commissionObject.value = parseFloat(value) || 0;
            } else {
                commissionObject.type = value as CommissionType;
            }
            return newFormData;
        });
    };

    const handleDirectCommissionChange = (index: number, field: 'type' | 'value', value: string) => {
        setFormData(prev => {
            const newComms = [...(prev!.directCommissions || [])];
            if (!newComms[index]) {
                newComms[index] = { type: 'percentage', value: 0, disabledLevels: [] };
            }
            newComms[index] = {
                ...newComms[index],
                [field]: field === 'value' ? parseFloat(value) || 0 : value as CommissionType
            };
            return { ...prev, directCommissions: newComms };
        });
    };

    const handleIndirectCommissionChange = (index: number, field: 'type' | 'value', value: string) => {
        setFormData(prev => {
            if (!prev) return prev;
            const updatedIndirectCommissions = (prev.indirectCommissions || []).map((commission, i) => {
                if (i === index) {
                    if (field === 'type') {
                        return { ...commission, type: value as CommissionType };
                    }
                    return { ...commission, value: parseFloat(value) || 0 };
                }
                return commission;
            });
            return { ...prev, indirectCommissions: updatedIndirectCommissions };
        });
    };

    const handleToggleSlotLevel = (slotIdx: number, level: number) => {
        setFormData(prev => {
            const newComms = [...(prev!.directCommissions || [])];
            const disabled = [...(newComms[slotIdx].disabledLevels || [])];
            
            const newDisabled = disabled.includes(level) 
                ? disabled.filter(l => l !== level) 
                : [...disabled, level];
                
            newComms[slotIdx] = { ...newComms[slotIdx], disabledLevels: newDisabled };
            return { ...prev, directCommissions: newComms };
        });
    };

    const handleToggleSlotHoldLevel = (slotIdx: number, level: number) => {
        setFormData(prev => {
            const newComms = [...(prev!.directCommissions || [])];
            const held = [...(newComms[slotIdx].heldLevels || [])];
            
            const newHeld = held.includes(level) 
                ? held.filter(l => l !== level) 
                : [...held, level];
                
            newComms[slotIdx] = { ...newComms[slotIdx], heldLevels: newHeld };
            return { ...prev, directCommissions: newComms };
        });
    };

    const addIndirectLevel = () => {
        setFormData(prev => {
            if (!prev) return prev;
            const newCommission: Commission = { type: 'percentage', value: 0, disabledLevels: [] };
            const newCommissions = [...(prev.indirectCommissions || []), newCommission];
            return { ...prev, indirectCommissions: newCommissions };
        });
    };

    const removeIndirectLevel = (index: number) => {
        setFormData(prev => {
            if (!prev) return prev;
            const newCommissions = (prev.indirectCommissions || []).filter((_, i) => i !== index);
            return { ...prev, indirectCommissions: newCommissions };
        });
    };

    const handleAddFeature = () => {
        if (!newFeature.trim()) return;
        setFormData(prev => ({
            ...prev,
            customFeatures: [...(prev.customFeatures || []), newFeature.trim()]
        }));
        setNewFeature('');
    };

    const handleRemoveFeature = (index: number) => {
        setFormData(prev => ({
            ...prev,
            customFeatures: (prev.customFeatures || []).filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(formData as InvestmentPlan);
        setIsSaving(false);
    }

    const CommissionInput: React.FC<{
        label: string; path: string;
        value: Commission;
        onChange: (path: string, field: 'type' | 'value', value: string) => void;
    }> = ({ label, path, value, onChange }) => (
        <div>
            <label className="block text-sm font-medium">{label}</label>
            <div className="flex gap-2 mt-1">
                <select value={value.type} onChange={(e) => onChange(path, 'type', e.target.value)} className="w-1/2 rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm">
                    <option value="percentage">%</option>
                    <option value="fixed">Fixed</option>
                </select>
                <input type="number" step="0.01" value={value.value} onChange={(e) => onChange(path, 'value', e.target.value)} placeholder="Value" className="w-1/2 rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" />
            </div>
        </div>
    );
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[95vw] max-w-5xl max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <h2 className="text-xl font-bold">{plan ? 'Edit Plan' : 'Create New Plan'}</h2>
                    
                    <fieldset className="p-4 border rounded-md dark:border-gray-600">
                        <legend className="px-2 font-semibold">Basic Information</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Plan Name" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required/>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Currency</label>
                                <select
                                    name="currency"
                                    value={formData.currency || 'PKR'}
                                    onChange={handleChange}
                                    className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    required
                                >
                                    <option value="PKR">PKR (Rs)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                            <input type="number" step="0.01" name="price" value={formData.price || ''} onChange={handleChange} placeholder="Price" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required/>
                            <input type="number" name="durationDays" value={formData.durationDays || ''} onChange={handleChange} placeholder="Duration (Days, 0=unlimited)" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            <input type="number" step="0.01" name="minWithdraw" value={formData.minWithdraw || ''} onChange={handleChange} placeholder="Min Withdraw" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required/>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Direct Referral Limit (0 = Unlimited)</label>
                                <input type="number" name="directReferralLimit" value={formData.directReferralLimit || ''} onChange={handleChange} placeholder="Limit" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                            <select name="status" value={formData.status} onChange={handleChange} className="md:col-start-2 w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                <option value={Status.Active}>Active</option>
                                <option value={Status.Disabled}>Disabled</option>
                            </select>
                            <textarea name="description" value={formData.description || ''} onChange={handleChange} placeholder="Description" className="md:col-span-2 w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                        </div>
                    </fieldset>

                    <fieldset className="p-4 border rounded-md dark:border-gray-600">
                        <legend className="px-2 font-semibold">Display Customization</legend>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                            {[
                                { key: 'showDuration', label: 'Show Duration' },
                                { key: 'showMinWithdraw', label: 'Show Min Withdraw' },
                                { key: 'showDirectReferrals', label: 'Show Direct Referrals' },
                                { key: 'showDirectCommission', label: 'Show Direct Commission' },
                                { key: 'showIndirectCommission', label: 'Show Indirect Levels' }
                            ].map(item => (
                                <label key={item.key} className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" name={`displayConfig.${item.key}`} checked={(formData.displayConfig as any)?.[item.key]} onChange={handleChange} />
                                    <span>{item.label}</span>
                                </label>
                            ))}
                        </div>
                        
                        <div className="mt-6 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-600">
                            <label className="block text-sm font-bold mb-2">Custom Features List</label>
                            <div className="flex gap-2 mb-3">
                                <input 
                                    className="flex-grow rounded-md border dark:bg-gray-700 dark:border-gray-600 p-2 text-sm" 
                                    placeholder="e.g., '24/7 Support' or 'VIP Access'" 
                                    value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                                />
                                <Button type="button" size="sm" onClick={handleAddFeature}>Add</Button>
                            </div>
                            {formData.customFeatures && formData.customFeatures.length > 0 ? (
                                <ul className="space-y-1 max-h-40 overflow-y-auto">
                                    {formData.customFeatures.map((feat, index) => (
                                        <li key={index} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded shadow-sm border border-gray-100 dark:border-gray-700 text-sm">
                                            <span className="truncate mr-2">{feat}</span>
                                            <button type="button" onClick={() => handleRemoveFeature(index)} className="text-red-500 hover:text-red-700 font-bold px-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-gray-400 italic text-center py-2">No custom features added.</p>
                            )}
                        </div>
                    </fieldset>

                    <fieldset className="p-4 border rounded-md dark:border-gray-600">
                        <legend className="px-2 font-semibold">Direct Commissions (Per Slot Configuration)</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {formData.directCommissions?.map((comm, index) => (
                                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border dark:border-gray-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {formData.directReferralLimit === 0 ? 'Recurring Commission Slot' : `Slot #${index + 1}`}
                                        </label>
                                        <button 
                                            type="button" 
                                            onClick={() => setConfigSlotIndex(index)}
                                            className="text-xs text-blue-600 hover:underline flex items-center"
                                        >
                                            <span className="mr-1">⚙️</span> Configure Downline
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <select value={comm.type} onChange={(e) => handleDirectCommissionChange(index, 'type', e.target.value)} className="w-[80px] rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm">
                                            <option value="percentage">%</option>
                                            <option value="fixed">Fixed</option>
                                        </select>
                                        <input type="number" step="0.01" value={comm.value} onChange={(e) => handleDirectCommissionChange(index, 'value', e.target.value)} placeholder="Value" className="flex-grow rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" />
                                        <span className="flex items-center justify-center px-2 text-xs font-bold text-green-600 dark:text-green-400 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700">
                                            {formatCurrency(
                                                comm.type === 'percentage'
                                                    ? ((formData.price || 0) * comm.value) / 100
                                                    : comm.value,
                                                formData.currency || 'PKR'
                                            )}
                                        </span>
                                    </div>
                                    {(comm.disabledLevels?.length > 0 || comm.heldLevels?.length > 0) && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {comm.disabledLevels?.map(lvl => (
                                                <span key={`dis-${lvl}`} className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 px-1.5 py-0.5 rounded font-bold uppercase">
                                                    L{lvl} Blocked
                                                </span>
                                            ))}
                                            {comm.heldLevels?.map(lvl => (
                                                <span key={`held-${lvl}`} className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                                    🔒 L{lvl} Held
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="p-4 border rounded-md dark:border-gray-600">
                        <legend className="px-2 font-semibold">Global Indirect Level Definitions</legend>
                        <p className="text-xs text-gray-500 mb-3">Define the default commission values for Level 2 and deeper. These levels can be disabled per-slot above.</p>
                        <div className="space-y-2">
                            {formData.indirectCommissions?.map((comm, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                    <span className="col-span-2 text-sm font-medium">Level {index + 2}:</span>
                                    <select value={comm.type} onChange={(e) => handleIndirectCommissionChange(index, 'type', e.target.value)} className="col-span-3 rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm py-1.5">
                                        <option value="percentage">%</option>
                                        <option value="fixed">Fixed</option>
                                    </select>
                                    <input type="number" step="0.01" value={comm.value} onChange={(e) => handleIndirectCommissionChange(index, 'value', e.target.value)} placeholder="Value" className="col-span-3 rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm py-1.5" />
                                    <span className="col-span-3 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-md py-1.5">
                                    = {formatCurrency(
                                        comm.type === 'percentage'
                                            ? ((formData.price || 0) * comm.value) / 100
                                            : comm.value,
                                        formData.currency || 'PKR'
                                    )}
                                    </span>
                                    <div className="col-span-1 text-right">
                                        <Button type="button" variant="danger" size="sm" onClick={() => removeIndirectLevel(index)} className="py-1 px-2">X</Button>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="secondary" size="sm" onClick={addIndirectLevel} className="mt-2">+ Add Level</Button>
                        </div>
                    </fieldset>

                    <fieldset className="p-4 border rounded-md dark:border-gray-600">
                        <legend className="px-2 font-semibold">Commission Deductions</legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <CommissionInput label="After Max Payout" path="commissionDeductions.afterMaxPayout" value={formData.commissionDeductions!.afterMaxPayout} onChange={handleCommissionChange} />
                            <CommissionInput label="After Max Earning" path="commissionDeductions.afterMaxEarning" value={formData.commissionDeductions!.afterMaxEarning} onChange={handleCommissionChange} />
                            <CommissionInput label="After Max Direct" path="commissionDeductions.afterMaxDirect" value={formData.commissionDeductions!.afterMaxDirect} onChange={handleCommissionChange} />
                        </div>
                    </fieldset>

                    <fieldset className="p-4 border rounded-md dark:border-gray-600">
                        <legend className="px-2 font-semibold">Auto-Upgrade & Upgrade Rules</legend>
                        <div className="space-y-4">
                            <div>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" name="autoUpgrade.enabled" checked={formData.autoUpgrade?.enabled} onChange={handleChange} className="rounded" />
                                    <span className="text-sm font-medium">Enable Auto Upgrade / Upgrade Rule</span>
                                </label>
                                {formData.autoUpgrade?.enabled && (
                                    <div className="mt-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                Target Plan for Upgrade:
                                            </label>
                                            <select 
                                                name="autoUpgrade.toPlanId" 
                                                value={formData.autoUpgrade.toPlanId || ''} 
                                                onChange={(e) => setFormData(prev => ({...prev, autoUpgrade: {...prev!.autoUpgrade!, toPlanId: e.target.value}}))} 
                                                className="block w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            >
                                                <option value="">- Select Target Plan -</option>
                                                {state.investmentPlans
                                                    .filter(p => p._id !== plan?._id && p.status === Status.Active && p.currency === formData.currency)
                                                    .map(p => (
                                                        <option key={p._id} value={p._id}>
                                                            {p.name} ({formatCurrency(p.price, p.currency)})
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                Upgrade Rule Mode:
                                            </label>
                                            <select 
                                                name="autoUpgrade.type" 
                                                value={formData.autoUpgrade.type || 'auto'} 
                                                onChange={(e) => setFormData(prev => ({...prev, autoUpgrade: {...prev!.autoUpgrade!, type: e.target.value as 'auto' | 'manual'}}))} 
                                                className="block w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            >
                                                <option value="auto">Automatic (System automatically purchases target plan when held funds suffice)</option>
                                                <option value="manual">Manual (Hold commissions in user's Upgrade Balance for user/admin to apply)</option>
                                            </select>
                                        </div>

                                        <p className="text-xs text-indigo-700 dark:text-indigo-300 italic">
                                            💡 You can mark direct or indirect slots to be held for upgrade by clicking <strong>⚙️ Configure Downline</strong> under Direct Commissions above.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </fieldset>

                    <div className="mt-6 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800 py-4 border-t dark:border-gray-700">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Investment Plan'}</Button>
                    </div>
                </form>
            </div>

            {/* PER-SLOT DOWNLINE CONFIG MODAL */}
            {configSlotIndex !== null && (
                <Modal isOpen={true} onClose={() => setConfigSlotIndex(null)}>
                    <div className="p-6 w-[450px] max-w-full">
                        <h3 className="text-lg font-bold mb-1">Slot #{configSlotIndex + 1} Earning & Upgrade Controls</h3>
                        <p className="text-sm text-gray-500 mb-5">Configure level commission availability and hold rules for referrals in this specific slot.</p>
                        
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                            {/* Direct Commission Toggle */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">Level 1 (Direct)</span>
                                        <span className="text-xs text-gray-500">Value: {formData.directCommissions![configSlotIndex].value}{formData.directCommissions![configSlotIndex].type === 'percentage' ? '%' : ' FIX'}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500">{formData.directCommissions![configSlotIndex].disabledLevels?.includes(1) ? 'Disabled' : 'Enabled'}</span>
                                        <ToggleSwitch 
                                            checked={!formData.directCommissions![configSlotIndex].disabledLevels?.includes(1)} 
                                            onChange={() => handleToggleSlotLevel(configSlotIndex, 1)} 
                                        />
                                    </div>
                                </div>
                                {!formData.directCommissions![configSlotIndex].disabledLevels?.includes(1) && (
                                    <label className="flex items-center justify-between pt-2 border-t dark:border-gray-600/50 cursor-pointer">
                                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                            🔒 Hold Commission for Plan Upgrade
                                        </span>
                                        <ToggleSwitch 
                                            checked={!!formData.directCommissions![configSlotIndex].heldLevels?.includes(1)} 
                                            onChange={() => handleToggleSlotHoldLevel(configSlotIndex, 1)} 
                                            size="sm"
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Indirect Levels Toggles */}
                            {(formData.indirectCommissions || []).map((lvl, idx) => {
                                const levelNum = idx + 2;
                                const isDisabled = formData.directCommissions![configSlotIndex].disabledLevels?.includes(levelNum);
                                const isHeld = formData.directCommissions![configSlotIndex].heldLevels?.includes(levelNum);
                                return (
                                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">Level {levelNum} (Indirect)</span>
                                                <span className="text-xs text-gray-500">Global Value: {lvl.value}{lvl.type === 'percentage' ? '%' : ' FIX'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-500">{isDisabled ? 'Disabled' : 'Enabled'}</span>
                                                <ToggleSwitch 
                                                    checked={!isDisabled} 
                                                    onChange={() => handleToggleSlotLevel(configSlotIndex, levelNum)} 
                                                />
                                            </div>
                                        </div>
                                        {!isDisabled && (
                                            <label className="flex items-center justify-between pt-2 border-t dark:border-gray-600/50 cursor-pointer">
                                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                    🔒 Hold Commission for Plan Upgrade
                                                </span>
                                                <ToggleSwitch 
                                                    checked={!!isHeld} 
                                                    onChange={() => handleToggleSlotHoldLevel(configSlotIndex, levelNum)} 
                                                    size="sm"
                                                />
                                            </label>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 pt-4 border-t dark:border-gray-700 flex justify-end">
                            <Button onClick={() => setConfigSlotIndex(null)}>Close Configurator</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    )
}

export default InvestmentPlans;
