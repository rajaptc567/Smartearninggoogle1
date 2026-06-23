import React, { useState, useEffect, useMemo } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { PaymentMethod, Currency, formatCurrency, HomepagePaymentLogo } from '../types';
import Modal from '../components/ui/Modal';
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod, updateSettings } from '../services/api';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean; }> = ({ checked, onChange, disabled }) => (
    <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
        <div className={`relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}></div>
    </label>
);


const PaymentMethods: React.FC = () => {
    const { state, dispatch } = useData();
    const { paymentMethods, settings } = state;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');
    const [typeFilter, setTypeFilter] = useState<'Deposit' | 'Withdrawal' | 'P2P' | ''>('');
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
        
        const matchesType = (() => {
            if (!typeFilter) return true;
            if (typeFilter === 'P2P') return !!method.p2pWithdrawalId;
            return method.type === typeFilter;
        })();

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
                        onChange={(e) => setTypeFilter(e.target.value as 'Deposit' | 'Withdrawal' | 'P2P' | '')}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Types</option>
                        <option value="Deposit">Deposit</option>
                        <option value="Withdrawal">Withdrawal</option>
                        <option value="P2P">P2P Matching</option>
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
                {filteredMethods.map(method => {
                    const isP2P = !!method.p2pWithdrawalId;
                    return (
                        <div key={method._id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 relative border-t-4 ${isP2P ? 'border-orange-500' : 'border-transparent'}`}>
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
                            
                            <div className="absolute top-6 right-16 flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm ${method.type === 'Deposit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {method.type}
                                </span>
                                {isP2P && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest bg-orange-600 text-white shadow-lg shadow-orange-500/20 animate-pulse">
                                        P2P Gateway
                                    </span>
                                )}
                            </div>
                            
                            <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <p><span className="font-semibold">Account:</span> {method.accountTitle} ({method.accountNumber})</p>
                                <p><span className="font-semibold">Limits:</span> {formatCurrency(method.minAmount, method.currency)} - {formatCurrency(method.maxAmount, method.currency)}</p>
                                <p><span className="font-semibold">Fee:</span> {method.feePercent}%</p>
                                {method.customFields && method.customFields.length > 0 && (
                                    <p className="text-xs text-blue-500 italic">+{method.customFields.length} custom fields</p>
                                )}
                                {method.qrCodeUrl && (
                                    <p className="text-xs text-indigo-500 italic flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                        QR Code Set
                                    </p>
                                )}
                                {isP2P && (
                                    <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded text-[10px] text-orange-700 dark:text-orange-300 font-bold uppercase italic">
                                        Linked to Matching Withdrawal: #{method.p2pWithdrawalId?.toString().substring(0, 8)}...
                                    </div>
                                )}
                                {method.howToDeposit?.enabled && (
                                    <p className="text-xs text-green-600 italic flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Guide Active
                                    </p>
                                )}
                            </div>
                            <div className="mt-6 flex justify-end space-x-2">
                            <Button size="sm" variant="secondary" onClick={() => handleOpenModal(method)}>Edit</Button>
                            <Button size="sm" variant="danger" onClick={() => handleDelete(method._id)}>Delete</Button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {isModalOpen && (
                <PaymentMethodFormModal
                    method={editingMethod}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    savedLogos={settings.homepagePaymentLogos || []}
                    currentSettings={settings}
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
    savedLogos: HomepagePaymentLogo[];
    currentSettings: any;
}

interface CustomField {
    title: string;
    value: string;
}

interface Step {
    title: string;
    description: string;
    imageUrl?: string;
    imageFile?: File; // Temporary file object for upload
}

const PaymentMethodFormModal: React.FC<PaymentMethodFormModalProps> = ({ method, onClose, onSave, savedLogos, currentSettings }) => {
    const { dispatch } = useData();
    const [formData, setFormData] = useState<Partial<PaymentMethod>>({
        name: '',
        currency: 'PKR',
        type: 'Deposit',
        status: 'Enabled',
        minAmount: 0,
        maxAmount: 1000,
        feePercent: 0,
        gatewayMode: 'manual',
        gatewayTitle: 'Checkout Payment Gateway',
        gatewayDescription: 'Click below to pay safely using your PayPal, Stripe checkout system, or Credit Card.',
        payNowUrl: '',
        payNowButtonText: 'Pay Now',
        isPopupViewEnabled: false,
        popupViewTitle: 'Verify & Proceed',
        popupViewInstructions: 'Please complete your payment on the primary checkout window, then input your email below, capture a verification screenshot, and select the next step to confirm.',
        ...method
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
    const [qrCodeRemoved, setQrCodeRemoved] = useState(false);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [logoUrlOverride, setLogoUrlOverride] = useState<string | null>(null);
    const [saveToLibrary, setSaveToLibrary] = useState(false);
    
    // Label Customization
    const [customLabels, setCustomLabels] = useState(method?.customLabels || { providerLabel: '', accountTitleLabel: '', accountNumberLabel: '' });

    // How To Deposit State
    const [howToEnabled, setHowToEnabled] = useState(false);
    const [howToShowBeforePayment, setHowToShowBeforePayment] = useState(false);
    const [howToDropdownMode, setHowToDropdownMode] = useState(false);
    const [howToSteps, setHowToSteps] = useState<Step[]>([]);

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (method) {
            if (method.customFields) setCustomFields(method.customFields);
            if (method.customLabels) setCustomLabels(method.customLabels);
            if (method.howToDeposit) {
                setHowToEnabled(method.howToDeposit.enabled);
                setHowToShowBeforePayment(!!method.howToDeposit.showBeforePayment);
                setHowToDropdownMode(!!method.howToDeposit.dropdownMode);
                setHowToSteps(method.howToDeposit.steps.map(s => ({ ...s })));
            }
        } else {
            setCustomFields([]);
            setCustomLabels({ providerLabel: '', accountTitleLabel: '', accountNumberLabel: '' });
            setHowToEnabled(false);
            setHowToShowBeforePayment(false);
            setHowToDropdownMode(false);
            setHowToSteps([]);
        }
    }, [method]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numValue = ['minAmount', 'maxAmount', 'feePercent'].includes(name) ? parseFloat(value) : value;
        setFormData(prev => ({ ...prev, [name]: numValue }));
    };

    const handleLabelChange = (field: keyof typeof customLabels, value: string) => {
        setCustomLabels(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogoFile(e.target.files[0]);
            setLogoUrlOverride(null); // Clear selected library logo if user uploads new one
        }
    };

    const handleQrCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setQrCodeFile(e.target.files[0]);
            setQrCodeRemoved(false);
        }
    };

    const handleRemoveQrCode = () => {
        setQrCodeRemoved(true);
        setQrCodeFile(null);
    };

    const handleSelectSavedLogo = (logo: HomepagePaymentLogo) => {
        setFormData(prev => ({ ...prev, name: logo.name }));
        setLogoUrlOverride(logo.logoUrl);
        setLogoFile(null); // Clear manual upload
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

    // --- How To Steps Logic ---
    const handleAddStep = () => {
        setHowToSteps([...howToSteps, { title: '', description: '' }]);
    };

    const handleStepChange = (index: number, field: keyof Step, value: string) => {
        const updated = [...howToSteps];
        (updated[index] as any)[field] = value;
        setHowToSteps(updated);
    };

    const handleStepImageChange = (index: number, file: File) => {
        const updated = [...howToSteps];
        updated[index].imageFile = file;
        
        // Create local preview URL
        const reader = new FileReader();
        reader.onload = (e) => {
            if(e.target?.result) {
                updated[index].imageUrl = e.target.result as string;
                setHowToSteps([...updated]);
            }
        }
        reader.readAsDataURL(file);
    };

    const handleRemoveStep = (index: number) => {
        setHowToSteps(howToSteps.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        let finalLogoUrl = logoUrlOverride || method?.logoUrl || '';

        // If a new file is uploaded, we might want to store it in the library too
        if (logoFile) {
            finalLogoUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(logoFile);
            });
        }

        // --- Handle Saving to Branding Library ---
        if (saveToLibrary && formData.name && finalLogoUrl) {
            const existingLogos = currentSettings.homepagePaymentLogos || [];
            const exists = existingLogos.some((l: any) => l.name.toLowerCase() === formData.name?.toLowerCase());
            
            if (!exists) {
                try {
                    const newLogos = [...existingLogos, { name: formData.name, logoUrl: finalLogoUrl }];
                    const updated = await updateSettings({ homepagePaymentLogos: newLogos });
                    dispatch({ type: 'UPDATE_SETTINGS', payload: updated });
                } catch (error) {
                    console.error("Failed to update branding library:", error);
                }
            }
        }

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (value !== undefined && value !== null && key !== 'logoUrl' && key !== 'qrCodeUrl' && key !== '_id' && key !== 'customFields' && key !== 'howToDeposit' && key !== 'customLabels') {
                data.append(key, String(value));
            }
        });
        
        if (logoFile) {
            data.append('logo', logoFile);
        } else if (logoUrlOverride) {
            data.append('logoUrl', logoUrlOverride);
        } else if (method?.logoUrl) {
            data.append('logoUrl', method.logoUrl);
        }

        if (qrCodeFile) {
            data.append('qrCode', qrCodeFile);
        } else if (method?.qrCodeUrl && !qrCodeRemoved) {
            data.append('qrCodeUrl', method.qrCodeUrl);
        }

        if (qrCodeRemoved) {
            data.append('removeQrCode', 'true');
        }

        // Clean empty custom fields
        const cleanedCustomFields = customFields.filter(f => f.title.trim() !== '');
        data.append('customFields', JSON.stringify(cleanedCustomFields));
        data.append('customLabels', JSON.stringify(customLabels));

        const processedSteps = await Promise.all(howToSteps.map(async (step) => {
            if (step.imageFile && !step.imageUrl?.startsWith('data:')) {
                 const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(step.imageFile!);
                 });
                 return { title: step.title, description: step.description, imageUrl: base64 };
            }
            return { title: step.title, description: step.description, imageUrl: step.imageUrl };
        }));

        const howToDepositData = {
            enabled: howToEnabled,
            showBeforePayment: howToShowBeforePayment,
            dropdownMode: howToDropdownMode,
            steps: processedSteps
        };
        
        data.append('howToDeposit', JSON.stringify(howToDepositData));

        await onSave(data, method?._id);
        setIsSaving(false);
    };
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[85vh] overflow-y-auto w-[90vw] max-w-2xl">
                 <h2 className="text-xl font-bold">{method ? 'Edit Payment Method' : 'Add New Method'}</h2>
                 
                 {/* QUICK SELECT LOGO SECTION */}
                 {savedLogos.length > 0 && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/50">
                        <label className="block text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 mb-3 tracking-widest">Select From Branding Library</label>
                        <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar">
                            {savedLogos.map((logo, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectSavedLogo(logo)}
                                    className={`shrink-0 p-3 rounded-xl border bg-white dark:bg-gray-800 transition-all hover:scale-105 flex flex-col items-center gap-2 w-24 ${formData.name === logo.name ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' : 'border-gray-200 dark:border-gray-700'}`}
                                >
                                    <img src={logo.logoUrl} alt={logo.name} className="h-10 w-10 object-contain" />
                                    <span className="text-[10px] font-bold truncate w-full text-center">{logo.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Method Name</label>
                        <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g. Easypaisa" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Account Currency</label>
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
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Transaction Category</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                            <option value="Deposit">Deposit</option>
                            <option value="Withdrawal">Withdrawal</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Visual Branding (Logo)</label>
                        <div className="flex items-center gap-3">
                            {(logoUrlOverride || method?.logoUrl) && !logoFile && (
                                <img src={logoUrlOverride || method?.logoUrl} className="h-10 w-10 object-contain rounded bg-gray-100 p-1" alt="current" />
                            )}
                            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        </div>
                    </div>
                    
                    <div className="md:col-span-2 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600 flex items-center justify-between">
                         <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded text-blue-600" checked={saveToLibrary} onChange={e => setSaveToLibrary(e.target.checked)} />
                            <div>
                                <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">Save this brand to Library</span>
                                <p className="text-[10px] text-gray-500">Makes this logo and name available for quick-select next time.</p>
                            </div>
                         </label>
                    </div>

                    {/* GATEWAY MODE SELECTION CONTAINER */}
                    <div className="md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-3 tracking-widest">Gateway Configuration Mode</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, gatewayMode: 'manual' }))}
                                className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${formData.gatewayMode !== 'paynow' ? 'border-primary bg-white dark:bg-slate-800 ring-4 ring-primary/10' : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30'}`}
                            >
                                <span className="text-2xl">💰</span>
                                <div>
                                    <span className="font-black text-xs uppercase text-slate-900 dark:text-white tracking-tight block">Use Existing Settings</span>
                                    <span className="text-[10px] text-gray-500 block">Manual transfer info: Title, Number, QR Code</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, gatewayMode: 'paynow' }))}
                                className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${formData.gatewayMode === 'paynow' ? 'border-primary bg-white dark:bg-slate-800 ring-4 ring-primary/10' : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30'}`}
                            >
                                <span className="text-2xl">⚡</span>
                                <div>
                                    <span className="font-black text-xs uppercase text-slate-900 dark:text-white tracking-tight block">Use New "Pay Now" settings</span>
                                    <span className="text-[10px] text-gray-500 block">Digital checkout link (PayPal, Stripe, Card)</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {formData.gatewayMode !== 'paynow' ? (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Account Title</label>
                                <input name="accountTitle" value={formData.accountTitle || ''} onChange={handleChange} placeholder="e.g. Smart Support" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required={formData.gatewayMode !== 'paynow'} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Account / Wallet Number</label>
                                <input name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} placeholder="e.g. 03001234567" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required={formData.gatewayMode !== 'paynow'} />
                            </div>

                            {/* LABEL OVERRIDES SECTION */}
                            <div className="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                                <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-3 tracking-widest">UI Label Customization (Frontend)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Method Name Label</label>
                                        <input 
                                            value={customLabels.providerLabel} 
                                            onChange={e => handleLabelChange('providerLabel', e.target.value)} 
                                            placeholder="Default: Method Name" 
                                            className="w-full rounded-md text-xs dark:bg-gray-800 dark:border-gray-600" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Account Title Label</label>
                                        <input 
                                            value={customLabels.accountTitleLabel} 
                                            onChange={e => handleLabelChange('accountTitleLabel', e.target.value)} 
                                            placeholder="Default: Account Title" 
                                            className="w-full rounded-md text-xs dark:bg-gray-800 dark:border-gray-600" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Account No. Label</label>
                                        <input 
                                            value={customLabels.accountNumberLabel} 
                                            onChange={e => handleLabelChange('accountNumberLabel', e.target.value)} 
                                            placeholder="Default: Acc / Wallet No" 
                                            className="w-full rounded-md text-xs dark:bg-gray-800 dark:border-gray-600" 
                                        />
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-500 mt-2 italic">Leave blank to use system defaults (Method Name, Account Title, Account / Wallet Number).</p>
                            </div>

                            {formData.type === 'Deposit' && (
                                <div className="md:col-span-2 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                    <label className="block text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 mb-3 tracking-widest">QR Code (Scan to Pay)</label>
                                    <div className="flex items-center gap-4">
                                        {method?.qrCodeUrl && !qrCodeFile && !qrCodeRemoved ? (
                                            <div className="relative group">
                                                <img src={method.qrCodeUrl} className="h-20 w-20 object-contain rounded-lg bg-white p-1 shadow-sm" alt="QR Preview" />
                                                <button 
                                                    type="button" 
                                                    onClick={handleRemoveQrCode}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remove QR Code"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 w-full">
                                                <input type="file" accept="image/*" onChange={handleQrCodeChange} className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                                                {qrCodeRemoved && <span className="text-[10px] text-red-500 font-bold italic">QR code marked for deletion. Save to confirm.</span>}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2">Upload a QR code image to help users pay faster in the deposit form.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="md:col-span-2 p-5 bg-gradient-to-tr from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">⚡ New Integration Settings</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase mb-1">Custom Checkout Title</label>
                                        <input 
                                            name="gatewayTitle" 
                                            value={formData.gatewayTitle || ''} 
                                            onChange={handleChange} 
                                            placeholder="e.g. Checkout Payment Gateway" 
                                            className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 font-bold" 
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase mb-1">Custom Checkout Subheading / Detailed description text</label>
                                        <textarea 
                                            name="gatewayDescription" 
                                            value={formData.gatewayDescription || ''} 
                                            onChange={handleChange} 
                                            placeholder="e.g. Click below to pay safely using your PayPal, Stripe..." 
                                            rows={2}
                                            className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-xs" 
                                        />
                                        <span className="text-[10px] text-gray-400 mt-1 block">Specify the instructions and accepted payment channels. You can write anything you want within it.</span>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Pay Now Destination Link (URL)</label>
                                        <input 
                                            name="payNowUrl" 
                                            value={formData.payNowUrl || ''} 
                                            onChange={handleChange} 
                                            placeholder="https://checkout.stripe.com/... or https://paypal.me/..." 
                                            className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" 
                                            required={formData.gatewayMode === 'paynow'} 
                                        />
                                        <span className="text-[10px] text-gray-400 mt-1 block">The Paypal, Stripe checkout or credit card merchant page where users will complete payment.</span>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Pay Button Text</label>
                                        <input 
                                            name="payNowButtonText" 
                                            value={formData.payNowButtonText || ''} 
                                            onChange={handleChange} 
                                            placeholder="e.g. Pay Now" 
                                            className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" 
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Popup Verification Tab ("How to View")</label>
                                        <select 
                                            name="isPopupViewEnabled" 
                                            value={String(formData.isPopupViewEnabled)} 
                                            onChange={e => setFormData(prev => ({ ...prev, isPopupViewEnabled: e.target.value === 'true' }))}
                                            className="w-full rounded-md dark:bg-gray-700"
                                        >
                                            <option value="false">Disabled (Show instructions directly on page)</option>
                                            <option value="true">Enabled (Use detailed pop-up tab instructions)</option>
                                        </select>
                                    </div>

                                    {formData.isPopupViewEnabled && (
                                        <div className="md:col-span-2 border-t border-emerald-500/10 pt-4 space-y-3">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Popup Tab Title</label>
                                                <input 
                                                    name="popupViewTitle" 
                                                    value={formData.popupViewTitle || ''} 
                                                    onChange={handleChange} 
                                                    placeholder="e.g. Payment Verification instructions" 
                                                    className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" 
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Instructions Displayed inside Pop-up tab</label>
                                                <textarea 
                                                    name="popupViewInstructions" 
                                                    value={formData.popupViewInstructions || ''} 
                                                    onChange={handleChange} 
                                                    placeholder="Guide users through completed steps, entering email and taking/uploading screenshot" 
                                                    rows={3}
                                                    className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-xs" 
                                                />
                                                <span className="text-[10px] text-gray-400 mt-1 block">These instructions guide the user on entering their email, other actions, and moving to the next step.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Minimum Limit</label>
                        <input type="number" name="minAmount" value={formData.minAmount || ''} onChange={handleChange} placeholder="0" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Maximum Limit</label>
                        <input type="number" name="maxAmount" value={formData.maxAmount || ''} onChange={handleChange} placeholder="1000" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gateway Fee (%)</label>
                        <input type="number" step="0.01" name="feePercent" value={formData.feePercent || ''} onChange={handleChange} placeholder="0.00" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Visibility Status</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                            <option value="Enabled">Enabled & Public</option>
                            <option value="Disabled">Hidden / Maintenance</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Special Instructions for Users</label>
                        <textarea name="instructions" value={formData.instructions || ''} onChange={handleChange} placeholder="Instructions (Optional)" rows={2} className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                 </div>

                 {/* CUSTOM FIELDS SECTION */}
                 <div className="border-t dark:border-gray-700 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Extra Input Fields</h3>
                        <Button type="button" size="sm" variant="secondary" onClick={handleAddCustomField}>+ Add Field</Button>
                    </div>
                    
                    {customFields.length > 0 && (
                        <div className="space-y-2 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border dark:border-gray-600">
                            {customFields.map((field, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <input 
                                        placeholder="Title (e.g. Branch)" 
                                        value={field.title} 
                                        onChange={(e) => handleCustomFieldChange(index, 'title', e.target.value)}
                                        className="w-1/3 text-sm rounded-md dark:bg-gray-700 dark:border-gray-500"
                                    />
                                    <input 
                                        placeholder="Value (e.g. 0911)" 
                                        value={field.value} 
                                        onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                        className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-500"
                                    />
                                    <button type="button" onClick={() => handleRemoveCustomField(index)} className="text-red-500 hover:text-red-700 p-2 font-bold text-xl">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>

                 {/* HOW TO DEPOSIT SECTION */}
                 <div className="border-t dark:border-gray-700 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Visual How-To Guide</h3>
                        <ToggleSwitch checked={howToEnabled} onChange={() => setHowToEnabled(!howToEnabled)} />
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Create a step-by-step visual workflow for your users.</p>

                    {howToEnabled && (
                        <div className="space-y-4 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border dark:border-gray-600">
                            {/* POPUP BEFORE PAYMENT OPTION */}
                            <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 rounded-2xl flex items-center justify-between gap-4 mb-2 shadow-sm">
                                <div>
                                    <span className="font-bold text-xs uppercase text-slate-850 dark:text-slate-150 block">⚡ Show Guide first as a Pop-up modal</span>
                                    <span className="text-[10px] text-gray-500 block">Displays this guide sequence automatically to the customer first before Step 3 checkout</span>
                                </div>
                                <ToggleSwitch checked={howToShowBeforePayment} onChange={() => setHowToShowBeforePayment(!howToShowBeforePayment)} />
                            </div>

                            {/* DROPDOWN ACCORDION OPTION */}
                            <div className="p-4 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/10 rounded-2xl flex items-center justify-between gap-4 mb-2 shadow-sm">
                                <div>
                                    <span className="font-bold text-xs uppercase text-slate-850 dark:text-slate-150 block">⚡ Allow Collapsible Dropdown Menu</span>
                                    <span className="text-[10px] text-gray-500 block">Enables customer to minimize/maximize the step-by-step visual guide on the deposit page</span>
                                </div>
                                <ToggleSwitch checked={howToDropdownMode} onChange={() => setHowToDropdownMode(!howToDropdownMode)} />
                            </div>

                            {howToSteps.map((step, index) => (
                                <div key={index} className="border dark:border-gray-600 p-3 rounded-md bg-white dark:bg-gray-800 shadow-sm relative">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Step {index + 1}</span>
                                        <button type="button" onClick={() => handleRemoveStep(index)} className="text-red-500 text-[10px] font-black uppercase hover:underline">Remove</button>
                                    </div>
                                    <input 
                                        placeholder="Action (e.g. Open App)" 
                                        value={step.title} 
                                        onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                                        className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-500 mb-2 font-bold"
                                    />
                                    <textarea 
                                        placeholder="Explain exactly what the user needs to do..." 
                                        value={step.description} 
                                        onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                                        className="w-full text-xs rounded-md dark:bg-gray-700 dark:border-gray-500 mb-2"
                                        rows={2}
                                    />

                                    {/* WORKSPACE DIRECT SCREENSHOT IMAGE/URL EDIT */}
                                    <div className="mb-2">
                                        <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Screenshot / Guide Image URL (Editable)</label>
                                        <input 
                                            placeholder="Paste custom hosted image/screenshot URL or write base64" 
                                            value={step.imageUrl || ''} 
                                            onChange={(e) => handleStepChange(index, 'imageUrl', e.target.value)}
                                            className="w-full text-xs font-mono rounded-md dark:bg-gray-700 dark:border-gray-500"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => e.target.files && handleStepImageChange(index, e.target.files[0])}
                                            className="text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        {step.imageUrl && <img src={step.imageUrl} alt="Preview" className="h-10 w-10 object-cover rounded shadow-sm border border-white" />}
                                    </div>
                                </div>
                            ))}
                            <Button type="button" size="sm" variant="secondary" onClick={handleAddStep} className="w-full">+ Add Sequence Step</Button>
                        </div>
                    )}
                 </div>

                 <div className="mt-6 flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>{isSaving ? 'Processing...' : 'Finalize Method'}</Button>
                </div>
            </form>
        </Modal>
    )
};

export default PaymentMethods;