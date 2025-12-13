
import React, { useState, useEffect } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { PaymentMethod, Currency, formatCurrency } from '../types';
import Modal from '../components/ui/Modal';
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '../services/api';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean; }> = ({ checked, onChange, disabled }) => (
    <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
        <div className={`relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}></div>
    </label>
);


const PaymentMethods: React.FC = () => {
    const { state, dispatch } = useData();
    const { paymentMethods } = state;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');
    const [typeFilter, setTypeFilter] = useState<'Deposit' | 'Withdrawal' | ''>('');
    const [statusFilter, setStatusFilter] = useState<'Enabled' | 'Disabled' | ''>('');
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const handleOpenModal = (method: PaymentMethod | null = null) => {
        setEditingMethod(method);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingMethod(null);
        setIsModalOpen(false);
    };

    const handleSave = async (formData: FormData, id?: string) => {
        try {
            if (id) {
                const updatedMethod = await updatePaymentMethod(id, formData);
                dispatch({ type: 'UPDATE_PAYMENT_METHOD', payload: updatedMethod });
            } else {
                const newMethod = await createPaymentMethod(formData);
                dispatch({ type: 'ADD_PAYMENT_METHOD', payload: newMethod });
            }
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save payment method:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not save payment method.'}`);
        }
    };
    
    const handleDelete = async (methodId: string) => {
        if (window.confirm('Are you sure you want to delete this method? This action cannot be undone.')) {
            try {
                await deletePaymentMethod(methodId);
                dispatch({ type: 'DELETE_PAYMENT_METHOD', payload: methodId });
                alert('Payment method deleted successfully.');
            } catch (error) {
                console.error("Failed to delete payment method:", error);
                alert(`Error: ${error instanceof Error ? error.message : 'Could not delete payment method.'}`);
            }
        }
    };
    
    const handleToggleStatus = async (method: PaymentMethod) => {
        setTogglingId(method._id);
        const newStatus = method.status === 'Enabled' ? 'Disabled' : 'Enabled';
        const formData = new FormData();
        formData.append('status', newStatus);
        
        try {
            const updatedMethod = await updatePaymentMethod(method._id, formData);
            dispatch({ type: 'UPDATE_PAYMENT_METHOD', payload: updatedMethod });
        } catch (error) {
            console.error("Failed to update status:", error);
            alert('Failed to update status.');
        } finally {
            setTogglingId(null);
        }
    };
    
    const filteredMethods = paymentMethods.filter(method => {
        const matchesCurrency = !currencyFilter || method.currency?.toUpperCase() === currencyFilter;
        const matchesType = !typeFilter || method.type === typeFilter;
        const matchesStatus = !statusFilter || method.status === statusFilter;
        return matchesCurrency && matchesType && matchesStatus;
    });

    return (
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white shrink-0">Payment Methods</h2>
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
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
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as 'Deposit' | 'Withdrawal' | '')}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Types</option>
                        <option value="Deposit">Deposit</option>
                        <option value="Withdrawal">Withdrawal</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'Enabled' | 'Disabled' | '')}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Status</option>
                        <option value="Enabled">Enabled</option>
                        <option value="Disabled">Disabled</option>
                    </select>
                    <Button onClick={() => handleOpenModal()}>Add New Method</Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMethods.map(method => (
                    <div key={method._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 relative">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                {method.logoUrl && (
                                    <img src={method.logoUrl} alt={method.name} className="w-10 h-10 object-contain rounded-md bg-gray-50" />
                                )}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{method.name}</h3>
                                    <p className="text-xs text-gray-400">{method.currency}</p>
                                </div>
                            </div>
                             <ToggleSwitch 
                                checked={method.status === 'Enabled'}
                                onChange={() => handleToggleStatus(method)}
                                disabled={togglingId === method._id}
                            />
                        </div>
                        <span className={`absolute top-6 right-16 text-xs font-bold px-2 py-0.5 rounded ${method.type === 'Deposit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {method.type}
                        </span>
                        
                        <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <p><span className="font-semibold">Account:</span> {method.accountTitle} ({method.accountNumber})</p>
                            <p><span className="font-semibold">Limits:</span> {formatCurrency(method.minAmount, method.currency)} - {formatCurrency(method.maxAmount, method.currency)}</p>
                            <p><span className="font-semibold">Fee:</span> {method.feePercent}%</p>
                            {method.customFields && method.customFields.length > 0 && (
                                <p className="text-xs text-blue-500 italic">+{method.customFields.length} custom fields</p>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end space-x-2">
                           <Button size="sm" variant="secondary" onClick={() => handleOpenModal(method)}>Edit</Button>
                           <Button size="sm" variant="danger" onClick={() => handleDelete(method._id)}>Delete</Button>
                        </div>
                    </div>
                ))}
            </div>
            {isModalOpen && (
                <PaymentMethodFormModal
                    method={editingMethod}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

// Form Modal Component
interface PaymentMethodFormModalProps {
    method: PaymentMethod | null;
    onClose: () => void;
    onSave: (formData: FormData, id?: string) => void;
}

interface CustomField {
    title: string;
    value: string;
}

const PaymentMethodFormModal: React.FC<PaymentMethodFormModalProps> = ({ method, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<PaymentMethod>>(
        method || { name: '', currency: 'PKR', type: 'Deposit', status: 'Enabled', minAmount: 0, maxAmount: 1000, feePercent: 0 }
    );
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (method && method.customFields) {
            setCustomFields(method.customFields);
        } else {
            setCustomFields([]);
        }
    }, [method]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numValue = ['minAmount', 'maxAmount', 'feePercent'].includes(name) ? parseFloat(value) : value;
        setFormData(prev => ({ ...prev, [name]: numValue }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogoFile(e.target.files[0]);
        }
    };

    const handleAddCustomField = () => {
        setCustomFields([...customFields, { title: '', value: '' }]);
    };

    const handleCustomFieldChange = (index: number, field: 'title' | 'value', value: string) => {
        const updatedFields = [...customFields];
        updatedFields[index][field] = value;
        setCustomFields(updatedFields);
    };

    const handleRemoveCustomField = (index: number) => {
        const updatedFields = customFields.filter((_, i) => i !== index);
        setCustomFields(updatedFields);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (value !== undefined && value !== null && key !== 'logoUrl' && key !== '_id' && key !== 'customFields') {
                data.append(key, String(value));
            }
        });
        
        if (logoFile) {
            data.append('logo', logoFile);
        }

        // Clean empty fields and add to form data
        const cleanedCustomFields = customFields.filter(f => f.title.trim() !== '');
        data.append('customFields', JSON.stringify(cleanedCustomFields));

        await onSave(data, method?._id);
        setIsSaving(false);
    };
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[85vh] overflow-y-auto">
                 <h2 className="text-xl font-bold">{method ? 'Edit Payment Method' : 'Add New Method'}</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Method Name (e.g. Easypaisa)" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
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
                    <select name="type" value={formData.type} onChange={handleChange} className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                        <option value="Deposit">Deposit</option>
                        <option value="Withdrawal">Withdrawal</option>
                    </select>
                    <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Logo (Optional)</label>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                    <input name="accountTitle" value={formData.accountTitle || ''} onChange={handleChange} placeholder="Account Title" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                    <input name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} placeholder="Account Number" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                    <input type="number" name="minAmount" value={formData.minAmount || ''} onChange={handleChange} placeholder="Min Amount" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                    <input type="number" name="maxAmount" value={formData.maxAmount || ''} onChange={handleChange} placeholder="Max Amount" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                     <input type="number" step="0.01" name="feePercent" value={formData.feePercent || ''} onChange={handleChange} placeholder="Fee % (Optional)" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                     <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                        <option value="Enabled">Enabled</option>
                        <option value="Disabled">Disabled</option>
                    </select>
                    <textarea name="instructions" value={formData.instructions || ''} onChange={handleChange} placeholder="Instructions (Optional)" className="md:col-span-2 w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                 </div>

                 {/* CUSTOM FIELDS SECTION */}
                 <div className="border-t dark:border-gray-700 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Custom Fields</h3>
                        <Button type="button" size="sm" variant="secondary" onClick={handleAddCustomField}>+ Add Field</Button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Add extra details like Branch Code, IBAN, Wallet ID, etc.</p>
                    
                    {customFields.length > 0 ? (
                        <div className="space-y-2 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border dark:border-gray-600">
                            {customFields.map((field, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <input 
                                        placeholder="Field Title (e.g. Branch Code)" 
                                        value={field.title} 
                                        onChange={(e) => handleCustomFieldChange(index, 'title', e.target.value)}
                                        className="w-1/3 text-sm rounded-md dark:bg-gray-700 dark:border-gray-500"
                                    />
                                    <input 
                                        placeholder="Field Detail (e.g. 0911)" 
                                        value={field.value} 
                                        onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                        className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-500"
                                    />
                                    <button type="button" onClick={() => handleRemoveCustomField(index)} className="text-red-500 hover:text-red-700">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-4 border border-dashed dark:border-gray-600 rounded text-xs text-gray-400">
                            No custom fields added.
                        </div>
                    )}
                 </div>

                 <div className="mt-6 flex justify-end space-x-3 pt-2 border-t dark:border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Method'}</Button>
                </div>
            </form>
        </Modal>
    )
};

export default PaymentMethods;
