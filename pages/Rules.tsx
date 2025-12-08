
import React, { useState } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Table from '../components/ui/Table';
import { createRule, deleteRule } from '../services/api';
import { Currency, formatCurrency } from '../types';

const Rules: React.FC = () => {
    const { state, dispatch } = useData();
    const { rules, investmentPlans } = state;
    
    // Form state
    const [fromPlan, setFromPlan] = useState('');
    const [toPlan, setToPlan] = useState('');
    const [requiredEarnings, setRequiredEarnings] = useState('');
    const [formCurrency, setFormCurrency] = useState<Currency>('PKR');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter state for the table
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    // Plans available in the form dropdowns, based on the form's currency selector
    const activePlansForForm = investmentPlans.filter(p => p.status === 'Active' && p.currency === formCurrency);

    // Filtered rules for the table display
    const filteredRules = rules.filter(rule => {
        if (!currencyFilter) return true;
        return rule.currency?.toUpperCase() === currencyFilter;
    });

    const handleAddRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fromPlan || !toPlan || !requiredEarnings) {
            alert('Please fill all fields');
            return;
        }
        setIsSubmitting(true);
        try {
            const newRule = await createRule({
                fromPlan,
                toPlan,
                requiredEarnings: parseFloat(requiredEarnings),
                currency: formCurrency,
            });
            dispatch({ type: 'ADD_RULE', payload: newRule });
            setFromPlan('');
            setToPlan('');
            setRequiredEarnings('');
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
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Company & Upgrade Rules</h2>
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">New Upgrade Rule</h3>
                    <form onSubmit={handleAddRule} className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        <div>
                            <label htmlFor="currency" className="block text-sm font-medium">Currency</label>
                            <select id="currency" value={formCurrency} onChange={e => setFormCurrency(e.target.value as Currency)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                <option value="PKR">PKR</option>
                                <option value="EUR">EUR</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="fromPlan" className="block text-sm font-medium">From Plan</label>
                            <select id="fromPlan" value={fromPlan} onChange={e => setFromPlan(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Select Plan</option>
                                {activePlansForForm.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="toPlan" className="block text-sm font-medium">To Plan</label>
                            <select id="toPlan" value={toPlan} onChange={e => setToPlan(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Select Plan</option>
                                {activePlansForForm.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="requiredEarnings" className="block text-sm font-medium">Required Earnings</label>
                            <input type="number" id="requiredEarnings" value={requiredEarnings} onChange={e => setRequiredEarnings(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                         <div className="">
                           <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Rule'}</Button>
                         </div>
                    </form>
                </div>
                 <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Existing Rules</h3>
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
                    </div>
                     <div className="mt-4">
                        <Table headers={['From Plan', 'To Plan', 'Required Earnings', 'Actions']}>
                            {filteredRules.map(rule => (
                                <tr key={rule._id} className="text-gray-700 dark:text-gray-400">
                                    <td className="px-4 py-3">{rule.fromPlan} ({rule.currency})</td>
                                    <td className="px-4 py-3">{rule.toPlan} ({rule.currency})</td>
                                    <td className="px-4 py-3">{formatCurrency(rule.requiredEarnings, rule.currency)}</td>
                                    <td className="px-4 py-3">
                                        <Button size="sm" variant="danger" onClick={() => handleDeleteRule(rule._id)}>Delete</Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                     </div>
                </div>
            </div>
        </div>
    );
};

export default Rules;
