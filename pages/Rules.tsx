
import React, { useState } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Table from '../components/ui/Table';
import { createRule, deleteRule } from '../services/api';
import { Currency, formatCurrency, InvestmentPlan } from '../types';

const Rules: React.FC = () => {
    const { state, dispatch } = useData();
    const { rules, investmentPlans } = state;
    
    // Form state
    const [targetPlanId, setTargetPlanId] = useState('');
    const [selectedRequiredPlans, setSelectedRequiredPlans] = useState<string[]>([]);
    
    const [minEarnings, setMinEarnings] = useState('');
    const [maxEarnings, setMaxEarnings] = useState('');
    const [minReferrals, setMinReferrals] = useState('');
    
    const [formCurrency, setFormCurrency] = useState<Currency>('PKR');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter state for the table
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    // Plans available based on the form's currency selector
    const activePlansForForm = investmentPlans.filter(p => p.status === 'Active' && p.currency === formCurrency);

    // Filtered rules for the table display
    const filteredRules = rules.filter(rule => {
        if (!currencyFilter) return true;
        return rule.currency?.toUpperCase() === currencyFilter;
    });

    const handleRequiredPlanToggle = (planId: string) => {
        setSelectedRequiredPlans(prev => {
            if (prev.includes(planId)) return prev.filter(id => id !== planId);
            return [...prev, planId];
        });
    };

    const handleAddRule = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!targetPlanId) {
            alert('Please select a Target Plan.');
            return;
        }

        const targetPlan = investmentPlans.find(p => p._id === targetPlanId);
        if (!targetPlan) return;

        // Validation: Ensure at least one condition is set
        const hasActivePlans = selectedRequiredPlans.length > 0;
        const hasEarnings = minEarnings !== '' || maxEarnings !== '';
        const hasReferrals = minReferrals !== '';

        if (!hasActivePlans && !hasEarnings && !hasReferrals) {
            alert("Please set at least one condition (Required Plans, Earnings, or Referrals).");
            return;
        }

        const requiredPlanNames = selectedRequiredPlans
            .map(id => investmentPlans.find(p => p._id === id)?.name)
            .filter(Boolean) as string[];

        setIsSubmitting(true);
        try {
            const newRulePayload = {
                targetPlanId,
                targetPlanName: targetPlan.name,
                requiredPlanIds: selectedRequiredPlans,
                requiredPlanNames,
                minTotalEarnings: minEarnings ? parseFloat(minEarnings) : 0,
                maxTotalEarnings: maxEarnings ? parseFloat(maxEarnings) : undefined,
                minDirectReferrals: minReferrals ? parseInt(minReferrals) : 0,
                currency: formCurrency,
            };

            const newRule = await createRule(newRulePayload);
            dispatch({ type: 'ADD_RULE', payload: newRule });
            
            // Reset form
            setTargetPlanId('');
            setSelectedRequiredPlans([]);
            setMinEarnings('');
            setMaxEarnings('');
            setMinReferrals('');
        } catch (error) {
            console.error("Failed to add rule:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not add rule.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteRule = async (ruleId: string) => {
        if(window.confirm('Are you sure you want to delete this rule?')) {
            try {
                await deleteRule(ruleId);
                dispatch({ type: 'DELETE_RULE', payload: ruleId });
            } catch (error) {
                console.error("Failed to delete rule:", error);
                alert(`Error: ${error instanceof Error ? error.message : 'Could not delete rule.'}`);
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Joining & Upgrade Rules</h2>
                        <p className="text-sm text-gray-500">Define conditions users must meet before purchasing specific plans.</p>
                    </div>
                    <div className="mt-4 md:mt-0">
                        <label className="text-xs font-bold uppercase text-gray-500 mr-2">Config Currency:</label>
                        <select 
                            value={formCurrency} 
                            onChange={e => {
                                setFormCurrency(e.target.value as Currency);
                                setTargetPlanId('');
                                setSelectedRequiredPlans([]);
                            }} 
                            className="rounded-md dark:bg-gray-700 dark:border-gray-600 border-gray-300 shadow-sm text-sm"
                        >
                            <option value="PKR">PKR</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
                        <span className="bg-blue-600 text-white text-xs rounded px-2 py-1 mr-2">NEW</span>
                        Rule Builder
                    </h3>
                    
                    <form onSubmit={handleAddRule}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Left Side: Target */}
                            <div>
                                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">1. Target Plan (Restricted)</label>
                                <select 
                                    value={targetPlanId} 
                                    onChange={e => setTargetPlanId(e.target.value)} 
                                    className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">-- Select Plan to Lock --</option>
                                    {activePlansForForm.map(p => <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, formCurrency)})</option>)}
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    Users cannot purchase this plan unless they meet the criteria below.
                                </p>
                            </div>

                            {/* Right Side: Conditions */}
                            <div className="space-y-4">
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">2. Required Active Plans (Optional)</label>
                                    {activePlansForForm.length > 0 ? (
                                        <div className="max-h-32 overflow-y-auto space-y-2 border dark:border-gray-600 rounded p-2 bg-gray-50 dark:bg-gray-900">
                                            {activePlansForForm
                                                .filter(p => p._id !== targetPlanId) // Exclude target itself
                                                .map(p => (
                                                <label key={p._id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedRequiredPlans.includes(p._id)} 
                                                        onChange={() => handleRequiredPlanToggle(p._id)}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm">{p.name}</span>
                                                </label>
                                            ))}
                                            {activePlansForForm.filter(p => p._id !== targetPlanId).length === 0 && <p className="text-xs text-gray-400">No other plans available.</p>}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400">No active plans found for this currency.</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">User must have <strong>ALL</strong> selected plans active.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                                        <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Min Total Earnings</label>
                                        <input 
                                            type="number" 
                                            value={minEarnings} 
                                            onChange={e => setMinEarnings(e.target.value)} 
                                            placeholder="0.00" 
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        />
                                    </div>
                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                                        <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Max Total Earnings</label>
                                        <input 
                                            type="number" 
                                            value={maxEarnings} 
                                            onChange={e => setMaxEarnings(e.target.value)} 
                                            placeholder="Optional" 
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                                    <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Min Direct Referrals</label>
                                    <input 
                                        type="number" 
                                        value={minReferrals} 
                                        onChange={e => setMinReferrals(e.target.value)} 
                                        placeholder="0" 
                                        className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end pt-4 border-t dark:border-gray-700">
                            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                                {isSubmitting ? 'Creating...' : '+ Create Rule'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Rules</h3>
                    <select
                        value={currencyFilter}
                        onChange={(e) => setCurrencyFilter(e.target.value as Currency | '')}
                        className="block rounded-md border-gray-300 shadow-sm text-sm dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value="">All Currencies</option>
                        <option value="PKR">PKR</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </select>
                </div>
                
                <div className="overflow-x-auto">
                    <Table headers={['Locked Plan', 'Prerequisites', 'Actions']}>
                        {filteredRules.length > 0 ? filteredRules.map(rule => (
                            <tr key={rule._id} className="text-gray-700 dark:text-gray-400">
                                <td className="px-4 py-3 align-top font-medium">
                                    <div className="flex items-center">
                                        <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                                        {rule.targetPlanName || 'Unknown Plan'} 
                                        <span className="text-xs text-gray-500 ml-1">({rule.currency})</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 ml-4">ID: {rule._id.substring(0, 6)}...</div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                    <div className="space-y-1">
                                        {rule.requiredPlanNames && rule.requiredPlanNames.length > 0 && (
                                            <div className="flex items-start text-sm">
                                                <span className="text-gray-500 w-24 flex-shrink-0">Must Have:</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {rule.requiredPlanNames.map((name, i) => (
                                                        <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-200">
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Backward compatibility for old rules */}
                                        {!rule.requiredPlanNames && (rule as any).fromPlan && (
                                             <div className="flex items-start text-sm">
                                                <span className="text-gray-500 w-24 flex-shrink-0">Must Have:</span>
                                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-200">{(rule as any).fromPlan}</span>
                                             </div>
                                        )}

                                        {(rule.minTotalEarnings || (rule as any).requiredEarnings) && (
                                            <div className="text-sm">
                                                <span className="text-gray-500 w-24 inline-block">Min Earned:</span>
                                                <span className="font-mono font-bold text-green-600">
                                                    {formatCurrency(rule.minTotalEarnings || (rule as any).requiredEarnings, rule.currency)}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {rule.maxTotalEarnings && (
                                            <div className="text-sm">
                                                <span className="text-gray-500 w-24 inline-block">Max Earned:</span>
                                                <span className="font-mono font-bold text-red-500">
                                                    {formatCurrency(rule.maxTotalEarnings, rule.currency)}
                                                </span>
                                            </div>
                                        )}

                                        {rule.minDirectReferrals ? (
                                            <div className="text-sm">
                                                <span className="text-gray-500 w-24 inline-block">Direct Refs:</span>
                                                <span className="font-bold">{rule.minDirectReferrals}+</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                    <Button size="sm" variant="danger" onClick={() => handleDeleteRule(rule._id)}>Delete</Button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-gray-500">
                                    No rules defined for {currencyFilter || 'any currency'}.
                                </td>
                            </tr>
                        )}
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default Rules;
