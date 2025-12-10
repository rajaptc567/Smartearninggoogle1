
import React, { useState } from 'react';
import { InvestmentPlan, Status, CommissionType, Commission, Currency, formatCurrency } from '../types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { createInvestmentPlan, updateInvestmentPlan, deleteInvestmentPlan } from '../services/api';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean; }> = ({ checked, onChange, disabled }) => (
    <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
        <div className={`relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}></div>
    </label>
);

const InvestmentPlans: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans } = state;
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<InvestmentPlan | null>(null);
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');
    const [togglingId, setTogglingId] = useState<string | null>(null);

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

    const renderDirectCommissionSummary = (plan: InvestmentPlan) => {
        const comms = plan.directCommissions;
        if (!comms || comms.length === 0) return 'None';
        
        // Find highest commission
        let maxVal = 0;
        let maxType = 'percentage';

        comms.forEach(c => {
            if (c.value > maxVal) {
                maxVal = c.value;
                maxType = c.type;
            }
        });

        const formattedVal = maxType === 'percentage' ? `${maxVal}%` : formatCurrency(maxVal, plan.currency);
        
        if (comms.length > 1) {
             return `Up to ${formattedVal}`;
        }
        
        return formattedVal;
    };

    const filteredPlans = investmentPlans.filter(plan => {
        if (!currencyFilter) return true;
        return plan.currency?.toUpperCase() === currencyFilter;
    });


    return (
        <div>
             <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Investment Plans</h2>
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
                <Button onClick={() => handleOpenModal()}>Create New Plan</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlans.map((plan: InvestmentPlan) => (
                    <div key={plan._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col">
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
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">{formatCurrency(plan.price, plan.currency)}</p>
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
                        <p className="text-xs text-gray-500 mt-4">{plan.description}</p>
                        <div className="mt-6 flex justify-end space-x-2">
                           <Button size="sm" variant="secondary" onClick={() => handleOpenModal(plan)}>Edit</Button>
                           <Button size="sm" variant="danger" onClick={() => handleDelete(plan._id)}>Delete</Button>
                        </div>
                    </div>
                ))}
            </div>
            {isModalOpen && (
                <PlanFormModal
                    plan={editingPlan}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

// Form Modal
interface PlanFormModalProps {
    plan: InvestmentPlan | null;
    onClose: () => void;
    onSave: (plan: InvestmentPlan) => void;
}

const defaultCommission: Commission = { type: 'percentage', value: 0 };
const defaultPlan: Partial<InvestmentPlan> = {
    name: '',
    currency: 'PKR',
    price: 0,
    durationDays: 30,
    minWithdraw: 10,
    status: Status.Active,
    description: '',
    directReferralLimit: 0,
    directCommissions: [{ ...defaultCommission }], // Default one slot
    indirectCommissions: [],
    commissionDeductions: {
        afterMaxPayout: { ...defaultCommission },
        afterMaxEarning: { ...defaultCommission },
        afterMaxDirect: { ...defaultCommission },
    },
    autoUpgrade: { enabled: false, toPlanId: undefined },
    holdPosition: { enabled: false, slots: [] },
};

const PlanFormModal: React.FC<PlanFormModalProps> = ({ plan, onClose, onSave }) => {
    const { state } = useData();
    
    // Ensure existing plans have directCommissions array if migration happened
    const initialPlan = plan ? {
        ...defaultPlan,
        ...plan,
        directCommissions: plan.directCommissions && plan.directCommissions.length > 0 
            ? plan.directCommissions 
            : (plan.directReferralLimit > 0 ? new Array(plan.directReferralLimit).fill(defaultCommission) : [defaultCommission])
    } : defaultPlan;

    const [formData, setFormData] = useState<Partial<InvestmentPlan>>(initialPlan);
    const [isSaving, setIsSaving] = useState(false);

     const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        if(name === 'autoUpgrade.enabled') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, autoUpgrade: { ...prev!.autoUpgrade!, enabled: checked }}));
            return;
        }
         if(name === 'holdPosition.enabled') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, holdPosition: { ...prev!.holdPosition!, enabled: checked }}));
            return;
        }

        if (name === 'directReferralLimit') {
             const limit = parseFloat(value) || 0;
             
             setFormData(prev => {
                const currentComms = prev!.directCommissions || [];
                let newComms = [...currentComms];
                
                // If limit is 0 (unlimited), we treat it as a single "standard" commission
                const targetLen = limit === 0 ? 1 : limit;

                if (newComms.length < targetLen) {
                    // Grow array
                    const fillCount = targetLen - newComms.length;
                    for(let i=0; i<fillCount; i++) {
                        newComms.push({ type: 'percentage', value: 0 });
                    }
                } else if (newComms.length > targetLen) {
                    // Shrink array
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
            // Ensure the index exists (sanity check)
            if (!newComms[index]) {
                newComms[index] = { type: 'percentage', value: 0 };
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

    const addIndirectLevel = () => {
        setFormData(prev => {
            if (!prev) return prev;
            const newCommission: Commission = { type: 'percentage', value: 0 };
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

    const handleHoldSlotChange = (slotNumber: number, checked: boolean) => {
        let currentSlots = formData.holdPosition?.slots || [];
        if (checked) {
            currentSlots = [...currentSlots, slotNumber];
        } else {
            currentSlots = currentSlots.filter(s => s !== slotNumber);
        }
        setFormData(prev => ({ ...prev, holdPosition: { ...prev!.holdPosition!, slots: currentSlots } }));
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
                <select value={value.type} onChange={(e) => onChange(path, 'type', e.target.value)} className="w-1/2 rounded-md dark:bg-gray-700 dark:border-gray-600">
                    <option value="percentage">%</option>
                    <option value="fixed">Fixed</option>
                </select>
                <input type="number" step="0.01" value={value.value} onChange={(e) => onChange(path, 'value', e.target.value)} placeholder="Value" className="w-1/2 rounded-md dark:bg-gray-700 dark:border-gray-600" />
            </div>
        </div>
    );
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-4 space-y-6 max-h-[85vh] overflow-y-auto">
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
                    <legend className="px-2 font-semibold">Direct Commissions</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.directCommissions?.map((comm, index) => (
                            <div key={index}>
                                <label className="block text-sm font-medium">
                                    {formData.directReferralLimit === 0 ? 'Direct Commission (Standard)' : `Direct Ref #${index + 1}`}
                                </label>
                                <div className="flex gap-2 mt-1">
                                    <select value={comm.type} onChange={(e) => handleDirectCommissionChange(index, 'type', e.target.value)} className="w-[100px] rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm">
                                        <option value="percentage">%</option>
                                        <option value="fixed">Fixed</option>
                                    </select>
                                    <input type="number" step="0.01" value={comm.value} onChange={(e) => handleDirectCommissionChange(index, 'value', e.target.value)} placeholder="Value" className="flex-grow rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" />
                                    <span className="flex items-center justify-center w-24 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-md">
                                        = {formatCurrency(
                                            comm.type === 'percentage'
                                                ? ((formData.price || 0) * comm.value) / 100
                                                : comm.value,
                                            formData.currency || 'PKR'
                                        )}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="p-4 border rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Indirect Commissions</legend>
                    <div className="mt-2 space-y-2">
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
                    <legend className="px-2 font-semibold">Advanced</legend>
                    <div className="space-y-4">
                        <div>
                            <label className="flex items-center space-x-2"><input type="checkbox" name="autoUpgrade.enabled" checked={formData.autoUpgrade?.enabled} onChange={handleChange} /> <span>Enable Auto Upgrade</span></label>
                            {formData.autoUpgrade?.enabled && (
                                <select name="autoUpgrade.toPlanId" value={formData.autoUpgrade.toPlanId} onChange={(e) => setFormData(prev => ({...prev, autoUpgrade: {...prev!.autoUpgrade!, toPlanId: e.target.value}}))} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                    <option value="">- Select Plan -</option>
                                    {state.investmentPlans.filter(p => p._id !== plan?._id && p.status === Status.Active && p.currency === formData.currency).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                </select>
                            )}
                        </div>
                         <div>
                            <label className="flex items-center space-x-2"><input type="checkbox" name="holdPosition.enabled" checked={formData.holdPosition?.enabled} onChange={handleChange} /> <span>Hold Position Commission</span></label>
                            {formData.holdPosition?.enabled && formData.directReferralLimit! > 0 && (
                                <div className="mt-2 p-2 border rounded-md dark:border-gray-700">
                                    <p className="text-xs mb-2">Select referral slots whose commission will be held for upgrade:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from({ length: formData.directReferralLimit! }, (_, i) => i + 1).map(slot => (
                                            <label key={slot} className="flex items-center space-x-1 text-sm p-1 bg-gray-100 dark:bg-gray-900 rounded">
                                                <input type="checkbox" checked={formData.holdPosition?.slots?.includes(slot)} onChange={e => handleHoldSlotChange(slot, e.target.checked)} />
                                                <span>{slot}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                             {formData.holdPosition?.enabled && formData.directReferralLimit === 0 && <p className="text-xs text-red-500 mt-1">Set a Direct Referral Limit to enable hold positions.</p>}
                        </div>
                    </div>
                </fieldset>


                 <div className="mt-6 flex justify-end space-x-3">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Plan'}</Button>
                </div>
            </form>
        </Modal>
    )
}

export default InvestmentPlans;
