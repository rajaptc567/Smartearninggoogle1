import React, { useState, useMemo } from 'react';
import { InvestmentPlan, Status, formatCurrency, Currency } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { createInvestmentPlan, updateInvestmentPlan, deleteInvestmentPlan } from '../services/api';

const InvestmentPlans: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans } = state;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<InvestmentPlan | null>(null);
    // Fix: Defined formData state to satisfy usage in snippet and elsewhere
    const [formData, setFormData] = useState<Partial<InvestmentPlan>>({
        name: '',
        currency: 'PKR',
        price: 0,
        durationDays: 30,
        minWithdraw: 0,
        description: '',
        status: Status.Active,
        directReferralLimit: 0,
        overflowEnabled: true,
        directCommissions: [{ type: 'percentage', value: 0 }],
        indirectCommissions: [],
        autoUpgrade: { enabled: false },
        holdPosition: { enabled: false, slots: [] }
    });
    const [isSaving, setIsSaving] = useState(false);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    const handleOpenModal = (plan: InvestmentPlan | null = null) => {
        if (plan) {
            setEditingPlan(plan);
            setFormData({ ...plan });
        } else {
            setEditingPlan(null);
            setFormData({
                name: '',
                currency: 'PKR',
                price: 0,
                durationDays: 30,
                minWithdraw: 0,
                description: '',
                status: Status.Active,
                directReferralLimit: 0,
                overflowEnabled: true,
                directCommissions: [{ type: 'percentage', value: 0 }],
                indirectCommissions: [],
                autoUpgrade: { enabled: false },
                holdPosition: { enabled: false, slots: [] },
                displayConfig: {
                    showDuration: true,
                    showMinWithdraw: true,
                    showDirectReferrals: true,
                    showDirectCommission: true,
                    showIndirectCommission: true,
                }
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPlan(null);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numFields = ['price', 'durationDays', 'minWithdraw', 'directReferralLimit'];
        setFormData(prev => ({ 
            ...prev, 
            [name]: numFields.includes(name) ? parseFloat(value) || 0 : value 
        }));
    };

    // Fix: Defined handleHoldSlotChange function for use in the slots configuration
    const handleHoldSlotChange = (slot: number, isChecked: boolean) => {
        setFormData(prev => {
            const currentSlots = prev.holdPosition?.slots || [];
            const newSlots = isChecked 
                ? [...currentSlots, slot].sort((a, b) => a - b)
                : currentSlots.filter(s => s !== slot);
            return {
                ...prev,
                holdPosition: {
                    ...prev.holdPosition!,
                    enabled: prev.holdPosition?.enabled ?? false,
                    slots: newSlots
                }
            };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (editingPlan) {
                const updated = await updateInvestmentPlan(editingPlan._id, formData);
                dispatch({ type: 'UPDATE_INVESTMENT_PLAN', payload: updated });
            } else {
                const created = await createInvestmentPlan(formData);
                dispatch({ type: 'ADD_INVESTMENT_PLAN', payload: created });
            }
            handleCloseModal();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to save plan');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this plan?')) {
            try {
                await deleteInvestmentPlan(id);
                dispatch({ type: 'DELETE_INVESTMENT_PLAN', payload: id });
            } catch (error) {
                alert('Failed to delete plan');
            }
        }
    };

    const filteredPlans = useMemo(() => {
        return investmentPlans.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCurrency = currencyFilter ? p.currency === currencyFilter : true;
            return matchesSearch && matchesCurrency;
        });
    }, [investmentPlans, searchTerm, currencyFilter]);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Investment Plans</h2>
                    <p className="text-gray-500">Manage packages and commission structures.</p>
                </div>
                <div className="flex gap-4">
                    <select 
                        value={currencyFilter} 
                        onChange={e => setCurrencyFilter(e.target.value as any)}
                        className="rounded-md border-gray-300 dark:bg-gray-700 text-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Currencies</option>
                        <option value="PKR">PKR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                    </select>
                    <Button onClick={() => handleOpenModal()}>+ Add Plan</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <Table headers={['Name', 'Price', 'Currency', 'Duration', 'Direct Limit', 'Status', 'Actions']}>
                    {filteredPlans.map(plan => (
                        <tr key={plan._id} className="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 font-semibold">{plan.name}</td>
                            <td className="px-4 py-3">{formatCurrency(plan.price, plan.currency)}</td>
                            <td className="px-4 py-3 font-mono">{plan.currency}</td>
                            <td className="px-4 py-3">{plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}</td>
                            <td className="px-4 py-3">{plan.directReferralLimit || 'Unlimited'}</td>
                            <td className="px-4 py-3"><Badge status={plan.status as Status} /></td>
                            <td className="px-4 py-3">
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => handleOpenModal(plan)}>Edit</Button>
                                    <Button size="sm" variant="danger" onClick={() => handleDelete(plan._id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
                {filteredPlans.length === 0 && (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400 italic">No investment plans found.</div>
                )}
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                    <div className="p-6 w-[700px] max-w-full max-h-[85vh] overflow-y-auto space-y-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Investment Plan'}</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1 tracking-wider">Plan Name</label>
                                <input name="name" value={formData.name} onChange={handleFormChange} className="w-full border rounded-md p-2.5 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Diamond PKR Pack" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1 tracking-wider">Price</label>
                                <input type="number" name="price" value={formData.price} onChange={handleFormChange} className="w-full border rounded-md p-2.5 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1 tracking-wider">Currency</label>
                                <select name="currency" value={formData.currency} onChange={handleFormChange} className="w-full border rounded-md p-2.5 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="PKR">PKR (Rs)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1 tracking-wider">Duration (Days)</label>
                                <input type="number" name="durationDays" value={formData.durationDays} onChange={handleFormChange} className="w-full border rounded-md p-2.5 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0 for unlimited" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1 tracking-wider">Min. Withdraw Amount</label>
                                <input type="number" name="minWithdraw" value={formData.minWithdraw} onChange={handleFormChange} className="w-full border rounded-md p-2.5 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1 tracking-wider">Direct Referral Limit</label>
                                <input type="number" name="directReferralLimit" value={formData.directReferralLimit} onChange={handleFormChange} className="w-full border rounded-md p-2.5 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0 for unlimited" />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input type="checkbox" id="overflowEnabled" checked={formData.overflowEnabled} onChange={e => setFormData({...formData, overflowEnabled: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                                <label htmlFor="overflowEnabled" className="text-xs font-bold uppercase text-gray-500 cursor-pointer">Allow Overflow Commissions</label>
                            </div>
                        </div>

                        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="holdEnabled"
                                        checked={formData.holdPosition?.enabled} 
                                        onChange={e => setFormData({...formData, holdPosition: { ...formData.holdPosition!, enabled: e.target.checked, slots: formData.holdPosition?.slots || [] }})} 
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="holdEnabled" className="text-sm font-bold uppercase text-gray-700 dark:text-gray-300 cursor-pointer">Configure Hold Position (Auto-Upgrade)</label>
                                </div>
                            </div>
                            
                            {formData.directReferralLimit! > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: formData.directReferralLimit! }, (_, i) => i + 1).map(slot => (
                                        <label key={slot} className={`flex items-center justify-center w-8 h-8 rounded border text-xs font-bold cursor-pointer transition-all duration-200 ${formData.holdPosition?.slots?.includes(slot) ? 'bg-amber-500 border-amber-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-300 text-gray-500 hover:border-amber-400'}`}>
                                            <input type="checkbox" className="sr-only" checked={formData.holdPosition?.slots?.includes(slot)} onChange={e => handleHoldSlotChange(slot, e.target.checked)} />
                                            {slot}
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest italic bg-red-50 dark:bg-red-900/20 p-2 rounded">Requires 'Direct Referral Limit' &gt; 0 to configure slots</p>
                            )}

                            {formData.holdPosition?.enabled && (
                                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Target Upgrade Plan ID</label>
                                    <input 
                                        name="autoUpgrade.toPlanId" 
                                        value={formData.autoUpgrade?.toPlanId || ''} 
                                        onChange={e => setFormData({...formData, autoUpgrade: { enabled: true, toPlanId: e.target.value }})}
                                        className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                        placeholder="Enter the MongoDB ObjectID of the target plan"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 italic">When enough commissions are held, the user will be automatically upgraded to this plan.</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1 tracking-wider">Plan Description</label>
                            <textarea name="description" value={formData.description} onChange={handleFormChange} className="w-full border rounded-md p-3 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none" rows={3} placeholder="Tell users about this plan..." />
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                            <Button variant="secondary" onClick={handleCloseModal} disabled={isSaving}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.price}>
                                {isSaving ? 'Processing...' : 'Save Plan Configuration'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default InvestmentPlans;