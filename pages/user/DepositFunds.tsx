
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Status, Deposit, formatCurrency, currencySymbols } from '../../types';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createDeposit } from '../../services/api';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const DepositIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Amount', 'Method', 'Instructions', 'Confirm'];
    return (
        <div className="flex items-center justify-between mb-8 w-full max-w-2xl mx-auto px-4">
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                    <div key={label} className="flex flex-col items-center relative z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                            {isCompleted ? '✓' : stepNum}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-500' : 'text-gray-400'}`}>{label}</span>
                    </div>
                );
            })}
            {/* Progress Bar Background */}
            <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-0 hidden sm:block"></div>
            {/* Progress Bar Active */}
             {/* This simple CSS logic for the bar is tricky with flex-between, keeping it simple with just dots for now or absolute positioning if needed exact */}
        </div>
    );
};

const DepositFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { paymentMethods, currentUser, investmentPlans, deposits } = state;
    const navigate = useNavigate();

    // Wizard State
    const [step, setStep] = useState(1);

    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [senderAccountTitle, setSenderAccountTitle] = useState('');
    const [receipt, setReceipt] = useState<File | null>(null);
    const [userNotes, setUserNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    // Toggle for How-To Guide
    const [showGuide, setShowGuide] = useState(false);

    // History Filter State
    const [historyStatus, setHistoryStatus] = useState<string>('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');

    // Get unique prices from active investment plans for the dropdown, filtered by user's currency
    const planPrices = useMemo(() => {
        if (!currentUser) return [];
        return investmentPlans
            .filter(p => p.status === Status.Active && p.currency === currentUser.currency)
            .map(p => p.price)
            .sort((a, b) => a - b)
            .filter((value, index, self) => self.indexOf(value) === index);
    }, [investmentPlans, currentUser]);

    // Filter methods based on the selected amount and user's currency
    const availableMethods = useMemo(() => {
        if (!currentUser) return [];
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return [];

        return paymentMethods.filter(method => 
            method.type === 'Deposit' && 
            method.status === 'Enabled' &&
            method.currency === currentUser.currency &&
            method.minAmount <= numericAmount && 
            method.maxAmount >= numericAmount
        );
    }, [paymentMethods, amount, currentUser]);

    const selectedMethod: PaymentMethod | undefined = useMemo(() =>
        availableMethods.find(method => method._id.toString() === selectedMethodId),
        [selectedMethodId, availableMethods]
    );

    // Filtered User Deposit History
    const filteredDeposits = useMemo(() => {
        if (!currentUser) return [];
        return deposits
            .filter(d => {
                if (d.userId !== currentUser._id) return false;
                if (historyStatus && d.status !== historyStatus) return false;
                if (historyDateFrom || historyDateTo) {
                    const itemDate = new Date(d.date).setHours(0,0,0,0);
                    const from = historyDateFrom ? new Date(historyDateFrom).setHours(0,0,0,0) : null;
                    const to = historyDateTo ? new Date(historyDateTo).setHours(23,59,59,999) : null;
                    if (from && itemDate < from) return false;
                    if (to && itemDate > to) return false;
                }
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [deposits, currentUser, historyStatus, historyDateFrom, historyDateTo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMethod || !amount || !transactionId || !senderAccountTitle || !receipt || !currentUser) {
            alert('Please fill all required fields and upload a receipt.');
            return;
        }
        
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('userId', currentUser._id);
        formData.append('userName', currentUser.username);
        formData.append('method', selectedMethod.name);
        formData.append('amount', amount);
        formData.append('transactionId', transactionId);
        formData.append('senderAccountTitle', senderAccountTitle);
        formData.append('receipt', receipt);
        if(userNotes) formData.append('userNotes', userNotes);
        
        if(selectedMethod.p2pWithdrawalId) {
            formData.append('matchedWithdrawalId', selectedMethod.p2pWithdrawalId);
        }

        try {
            const { deposit, transaction } = await createDeposit(formData);
            dispatch({ type: 'ADD_DEPOSIT', payload: deposit });
            dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
            setIsSubmitted(true);
        } catch (error) {
            console.error("Failed to create deposit:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not submit deposit.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could add a toast here
    };
    
    // Reset method if amount changes significantly (invalidating the method)
    useEffect(() => {
        if (selectedMethodId && !availableMethods.find(m => m._id === selectedMethodId)) {
            setSelectedMethodId('');
            if (step > 2) setStep(2); // Go back to method selection if current invalid
        }
    }, [availableMethods, selectedMethodId, step]);

    if (!currentUser) return null;

    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl text-center border border-green-100 dark:border-green-900 animate-fade-in">
                <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-green-400 to-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
                    <CheckCircleIcon className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Deposit Submitted!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    Your request has been securely transmitted. Our team will verify your transaction shortly.
                </p>
                <div className="flex gap-4 justify-center">
                    <Button onClick={() => window.location.reload()} variant="primary">Make Another</Button>
                    <Button onClick={() => navigate('/member')} variant="secondary">Go to Dashboard</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-10">
            {/* Hero Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl overflow-hidden mb-8">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Deposit Funds</h1>
                    <p className="text-blue-100 max-w-2xl">
                        Add funds to your wallet securely. Select an amount, choose your preferred payment gateway, and follow the instructions to complete your deposit.
                    </p>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-bottom-right"></div>
                <div className="absolute right-10 bottom-[-20px] text-white/10">
                    <DepositIcon className="w-32 h-32" />
                </div>
            </div>

            <StepIndicator currentStep={step} />

            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                
                {/* STEP 1: AMOUNT */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-6 max-w-lg mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 1: Enter Amount</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">How much would you like to deposit?</p>
                        </div>
                        
                        {planPrices.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                {planPrices.map(price => (
                                    <button
                                        key={price}
                                        type="button"
                                        onClick={() => setAmount(price.toString())}
                                        className={`py-3 px-4 rounded-lg font-semibold transition-all border ${
                                            amount === price.toString()
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500'
                                        }`}
                                    >
                                        {formatCurrency(price, currentUser.currency)}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        <div className="relative">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Custom Amount</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                    {currencySymbols[currentUser.currency]}
                                </span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full pl-8 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-lg font-medium"
                                    placeholder="Enter amount"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button 
                                onClick={() => setStep(2)} 
                                disabled={!amount || parseFloat(amount) <= 0}
                                className="w-full sm:w-auto px-8"
                            >
                                Next Step &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: METHOD */}
                {step === 2 && (
                    <div className="animate-fade-in space-y-6">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 2: Choose Payment Method</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Select a gateway for {formatCurrency(parseFloat(amount), currentUser.currency)}</p>
                        </div>

                        {availableMethods.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {availableMethods.map(method => (
                                    <div 
                                        key={method._id}
                                        onClick={() => { setSelectedMethodId(method._id); setStep(3); }}
                                        className="relative cursor-pointer p-5 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all duration-200 flex flex-col gap-4 bg-white dark:bg-gray-800 group"
                                    >
                                        <div className="flex items-center gap-4">
                                            {method.logoUrl ? (
                                                <img src={method.logoUrl} alt={method.name} className="w-12 h-12 object-contain rounded bg-white p-1 shadow-sm" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-lg">
                                                    {method.name.substring(0,1)}
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{method.name}</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Limit: {formatCurrency(method.maxAmount, method.currency)}</p>
                                            </div>
                                        </div>
                                        <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-0 group-hover:w-full transition-all duration-500"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                                <p className="text-gray-500 dark:text-gray-400">No payment methods available for {formatCurrency(parseFloat(amount), currentUser.currency)}.</p>
                                <Button variant="secondary" onClick={() => setStep(1)} className="mt-4">Change Amount</Button>
                            </div>
                        )}

                        <div className="pt-6 flex justify-start">
                            <Button variant="secondary" onClick={() => setStep(1)}>
                                &larr; Back
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 3: INSTRUCTIONS */}
                {step === 3 && selectedMethod && (
                    <div className="animate-fade-in space-y-6">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 3: Payment Instructions</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Please transfer the exact amount to the account below.</p>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-100 dark:border-blue-800 max-w-2xl mx-auto">
                            <div className="text-center mb-6">
                                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Total to Pay</p>
                                <p className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 my-2">{formatCurrency(parseFloat(amount), currentUser.currency)}</p>
                                {selectedMethod.feePercent > 0 && <p className="text-xs text-gray-500">Includes {selectedMethod.feePercent}% fee</p>}
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Account Details</label>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-600 dark:text-gray-400">Bank/Platform:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{selectedMethod.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-600 dark:text-gray-400">Account Title:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{selectedMethod.accountTitle}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-100 dark:border-gray-600">
                                        <span className="font-mono text-lg font-bold text-gray-900 dark:text-white tracking-wide break-all">{selectedMethod.accountNumber}</span>
                                        <button 
                                            onClick={() => copyToClipboard(selectedMethod.accountNumber)}
                                            className="ml-2 p-2 bg-white dark:bg-gray-600 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors text-blue-600 dark:text-blue-300"
                                            title="Copy Number"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Fields */}
                                {selectedMethod.customFields && selectedMethod.customFields.map((field, idx) => (
                                    <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{field.title}:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-white">{field.value}</span>
                                            <button onClick={() => copyToClipboard(field.value)} className="text-gray-400 hover:text-blue-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                                        </div>
                                    </div>
                                ))}

                                {selectedMethod.howToDeposit?.enabled && (
                                    <div className="pt-2">
                                        <button 
                                            onClick={() => setShowGuide(!showGuide)}
                                            className="w-full py-2 px-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-bold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {showGuide ? 'Hide Guide' : 'View How-to Deposit Guide'}
                                        </button>
                                        
                                        {showGuide && selectedMethod.howToDeposit.steps.length > 0 && (
                                            <div className="mt-4 space-y-4 animate-fade-in bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                                {selectedMethod.howToDeposit.steps.map((step, idx) => (
                                                    <div key={idx} className="relative pl-6 pb-4 border-l-2 border-blue-200 dark:border-blue-800 last:pb-0 last:border-l-0">
                                                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800"></div>
                                                        <h5 className="font-bold text-sm text-gray-800 dark:text-white mb-1">Step {idx+1}: {step.title}</h5>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{step.description}</p>
                                                        {step.imageUrl && (
                                                            <img src={step.imageUrl} alt={step.title} className="rounded-md w-full object-cover max-h-48 border border-gray-200 dark:border-gray-600" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedMethod.instructions && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200 flex gap-2">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p className="opacity-90">{selectedMethod.instructions}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-6 flex justify-between">
                            <Button variant="secondary" onClick={() => setStep(2)}>
                                &larr; Back
                            </Button>
                            <Button onClick={() => setStep(4)} className="px-8 shadow-lg shadow-blue-500/30">
                                I Have Made The Payment &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION */}
                {step === 4 && selectedMethod && (
                    <div className="animate-fade-in space-y-6 max-w-lg mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 4: Confirm Payment</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Provide your transaction details to verify.</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600 mb-6 flex justify-between items-center text-sm">
                            <div>
                                <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase">Method</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{selectedMethod.name}</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase">Amount</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sender Account Name</label>
                                <input 
                                    type="text" 
                                    value={senderAccountTitle}
                                    onChange={e => setSenderAccountTitle(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transaction ID (Trx ID)</label>
                                <input 
                                    type="text" 
                                    value={transactionId}
                                    onChange={e => setTransactionId(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    placeholder="e.g. 8273827382"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Receipt</label>
                                <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${receipt ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'}`}>
                                    <input 
                                        type="file" 
                                        id="receipt-upload"
                                        className="hidden" 
                                        onChange={e => e.target.files && setReceipt(e.target.files[0])}
                                        accept="image/*"
                                        required
                                    />
                                    <label htmlFor="receipt-upload" className="cursor-pointer block">
                                        {receipt ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircleIcon className="w-8 h-8 text-green-500" />
                                                <span className="text-sm font-medium text-green-700 dark:text-green-300">{receipt.name} selected</span>
                                                <span className="text-xs text-green-600 dark:text-green-400 underline">Click to change</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Click to upload screenshot</span>
                                                <span className="text-xs text-gray-400">JPG, PNG up to 10MB</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>
                            
                            <div className="pt-6 flex justify-between items-center gap-4">
                                <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                                    &larr; Back
                                </Button>
                                <Button type="submit" className="flex-grow py-3 text-lg shadow-lg shadow-green-500/30 bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                                    {isSubmitting ? 'Verifying...' : `Submit Deposit Request`}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* DEPOSIT HISTORY SECTION */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Recent Deposits</h3>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <select 
                            value={historyStatus} 
                            onChange={(e) => setHistoryStatus(e.target.value)} 
                            className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Approved}>Approved</option>
                            <option value={Status.Pending}>Pending</option>
                            <option value={Status.Rejected}>Rejected</option>
                        </select>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={historyDateFrom} 
                                onChange={(e) => setHistoryDateFrom(e.target.value)} 
                                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500" 
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="date" 
                                value={historyDateTo} 
                                onChange={(e) => setHistoryDateTo(e.target.value)} 
                                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500" 
                            />
                        </div>
                    </div>
                </div>

                {filteredDeposits.length > 0 ? (
                    <Table headers={['Date', 'Method', 'Amount', 'Tx ID', 'Status']}>
                        {filteredDeposits.map((deposit) => (
                            <tr key={deposit._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="px-4 py-3 text-sm">{new Date(deposit.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm">{deposit.method}</td>
                                <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">{formatCurrency(deposit.amount, deposit.currency)}</td>
                                <td className="px-4 py-3 text-xs font-mono">{deposit.transactionId}</td>
                                <td className="px-4 py-3"><Badge status={deposit.status} /></td>
                            </tr>
                        ))}
                    </Table>
                ) : (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
                        <p className="text-gray-500 dark:text-gray-400">No deposit history found matching the criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepositFunds;
