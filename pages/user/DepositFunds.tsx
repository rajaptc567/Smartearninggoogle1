
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

const ShieldExclamationIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Amount', 'Method', 'Instructions', 'Confirm'];
    return (
        <div className="flex items-center justify-between mb-10 w-full max-w-2xl mx-auto px-4 relative">
             {/* Progress Line */}
             <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-0 hidden sm:block"></div>
             
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                    <div key={label} className="flex flex-col items-center relative z-10">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all duration-500 transform ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/40 scale-110' : isCompleted ? 'bg-green-50 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'}`}>
                            {isCompleted ? '✓' : stepNum}
                        </div>
                        <span className={`text-[10px] mt-3 font-black uppercase tracking-[0.1em] transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-500' : 'text-gray-400'}`}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
};

const DepositFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { paymentMethods, currentUser, investmentPlans, deposits, settings } = state;
    const { restrictDepositAmount } = settings;
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
    };
    
    // Reset method if amount changes significantly (invalidating the method)
    useEffect(() => {
        if (selectedMethodId && !availableMethods.find(m => m._id === selectedMethodId)) {
            setSelectedMethodId('');
            if (step > 2) setStep(2); // Go back to method selection if current invalid
        }
    }, [availableMethods, selectedMethodId, step]);

    if (!currentUser) return null;

    // --- INSTANT RESTRICTION CHECK ---
    if (currentUser.restrictions?.deposit) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-8 border border-red-200 dark:border-red-800">
                        <ShieldExclamationIcon />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 leading-none">Deposit Access Blocked</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto leading-relaxed font-medium">
                        Your account's ability to add funds has been temporarily restricted by the security department for your protection.
                    </p>
                    
                    <div className="w-full p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 mb-8">
                        <div className="flex items-center gap-4 text-left">
                            <span className="text-2xl">🚨</span>
                            <div>
                                <p className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">Security Review Active</p>
                                <p className="text-xs text-gray-500 font-medium">Please contact our support team or open a formal dispute for manual account verification.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <Button onClick={() => navigate('/member/disputes')} className="rounded-2xl py-4 px-8 font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20">Open Support Ticket</Button>
                        <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 px-8 font-black uppercase tracking-widest text-xs">Return Dashboard</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl text-center border border-gray-100 dark:border-gray-800 animate-fade-in">
                <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-green-400 to-green-600 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-green-500/30">
                    <CheckCircleIcon className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Deposit Transmitted!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-10 leading-relaxed font-medium">
                    Your request has been securely received by our verification engine. Our auditors will confirm your transaction shortly.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button onClick={() => window.location.reload()} className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">New Transaction</Button>
                    <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Back to Hub</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-16 px-2">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mb-12 group">
                <div className="absolute inset-0 bg-white/5 opacity-10 pointer-events-none"></div>
                <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                <div className="absolute top-1/2 right-10 -translate-y-1/2 opacity-10 hidden lg:block">
                    <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                </div>
                <div className="relative z-10">
                    <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter uppercase leading-none">Deposit Funds</h1>
                    <p className="text-blue-50 text-sm md:text-base max-w-2xl leading-relaxed font-medium">
                        Add funds to your wallet securely. Select an amount, choose your preferred payment gateway, and follow the instructions to complete your deposit.
                    </p>
                </div>
            </div>

            <StepIndicator currentStep={step} />

            <div className="bg-white dark:bg-gray-950 p-8 sm:p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800">
                
                {/* STEP 1: AMOUNT */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-8 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Enter Value</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 1: Funding Amount</p>
                        </div>
                        
                        {planPrices.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {planPrices.map(price => (
                                    <button
                                        key={price}
                                        type="button"
                                        onClick={() => setAmount(price.toString())}
                                        className={`py-5 px-6 rounded-3xl font-black uppercase text-xs tracking-widest transition-all duration-300 border-2 ${
                                            amount === price.toString()
                                            ? 'bg-blue-600 text-white border-blue-400 shadow-2xl shadow-blue-500/40 scale-105'
                                            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800 hover:border-blue-500/30'
                                        }`}
                                    >
                                        {formatCurrency(price, currentUser.currency)}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {!restrictDepositAmount ? (
                            <div className="relative pt-4">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-2">Manual Allocation</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-gray-400 font-bold">
                                        {currencySymbols[currentUser.currency]}
                                    </span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-12 p-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all dark:text-white text-2xl font-black tracking-tighter"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl text-center">
                                <p className="text-sm text-blue-700 dark:text-blue-300 font-bold leading-relaxed">
                                    Strategic Limit Active: To maintain network stability, only standardized plan values are permitted for direct deposits.
                                </p>
                            </div>
                        )}

                        <div className="pt-6">
                            <Button 
                                onClick={() => setStep(2)} 
                                disabled={!amount || parseFloat(amount) <= 0}
                                className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-blue-600/30"
                            >
                                Select Gateway &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: METHOD - REDESIGNED 2 PER ROW, NO LIMIT TEXT */}
                {step === 2 && (
                    <div className="animate-fade-in space-y-10">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Gateway Selection</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 2: Choose your payment provider</p>
                        </div>

                        {availableMethods.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4 md:gap-6">
                                {availableMethods.map(method => (
                                    <div 
                                        key={method._id}
                                        onClick={() => { setSelectedMethodId(method._id); setStep(3); }}
                                        className="relative cursor-pointer p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 border-gray-50 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-600 hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center bg-white dark:bg-gray-900 group transform hover:-translate-y-1 active:scale-95 shadow-sm"
                                    >
                                        <div className="absolute top-3 right-3 md:top-4 md:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-1 bg-blue-600 rounded-full text-white">
                                                <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        </div>

                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 dark:bg-black rounded-2xl md:rounded-3xl flex items-center justify-center p-2.5 md:p-3 shadow-inner border border-gray-100 dark:border-gray-800 transition-transform group-hover:scale-105">
                                            {method.logoUrl ? (
                                                <img src={method.logoUrl} alt={method.name} className="max-w-full max-h-full object-contain" />
                                            ) : (
                                                <div className="text-blue-600 dark:text-blue-400 font-black text-2xl md:text-3xl uppercase">{method.name.substring(0,1)}</div>
                                            )}
                                        </div>
                                        
                                        <div className="mt-4 md:mt-6 space-y-1">
                                            <h4 className="text-sm md:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-tight">{method.name}</h4>
                                            <span className="inline-block px-2 md:px-3 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-full border border-green-200 dark:border-green-800/30">Verified</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-gray-800 max-w-lg mx-auto">
                                <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm mb-6">Insufficient Gateways</p>
                                <p className="text-xs text-gray-400 mb-10 px-8 leading-relaxed">No payment providers currently match your selected allocation.</p>
                                <Button variant="secondary" onClick={() => setStep(1)} className="rounded-xl px-10 py-4 font-black uppercase text-[10px] tracking-widest">Modify Amount</Button>
                            </div>
                        )}

                        <div className="pt-6 flex justify-start">
                            <button onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors">
                                &larr; Return to Step 1
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: INSTRUCTIONS - MATCHED TO SCREENSHOT */}
                {step === 3 && selectedMethod && (
                    <div className="animate-fade-in space-y-8">
                        <div className="text-center">
                            <h1 className="text-5xl md:text-6xl font-black text-[#3b82f6] tracking-tighter mb-2">
                                {formatCurrency(parseFloat(amount), currentUser.currency).replace(currencySymbols[currentUser.currency] || '', '').trim()}
                            </h1>
                        </div>

                        <div className="bg-[#111827] p-8 md:p-12 rounded-[3rem] border border-gray-800 max-w-xl mx-auto shadow-2xl space-y-10">
                            <div className="space-y-8">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-2">Provider</label>
                                    <span className="text-2xl font-black text-white uppercase tracking-tight">{selectedMethod.name}</span>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-2">Account Holder</label>
                                    <span className="text-2xl font-black text-white uppercase tracking-tight block">{selectedMethod.accountTitle}</span>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-2">System Identifier / ID</label>
                                    <div className="flex items-center justify-between mt-3 p-6 bg-black/60 rounded-[2rem] border border-white/5 shadow-inner">
                                        <span className="font-mono text-2xl font-black text-[#3b82f6] tracking-[0.15em] break-all select-all mr-4">
                                            {selectedMethod.accountNumber}
                                        </span>
                                        <button 
                                            onClick={() => { copyToClipboard(selectedMethod.accountNumber); alert('Copied to clipboard!'); }}
                                            className="shrink-0 p-4 bg-[#3b82f6] hover:bg-blue-600 rounded-2xl shadow-xl transition-all text-white active:scale-90"
                                            title="Copy Identifier"
                                        >
                                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#1e293b]/40 p-6 rounded-[2rem] border border-blue-500/20 text-xs text-blue-300 flex gap-4 items-start shadow-sm">
                                <div className="shrink-0 pt-0.5">
                                    <svg className="w-6 h-6 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="font-bold leading-relaxed text-gray-400">
                                    Please send the exact amount. Kindly share a screenshot or copy of the payment confirmation as proof.
                                </p>
                            </div>
                        </div>

                        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-6 max-w-xl mx-auto">
                            <button onClick={() => setStep(2)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors">
                                &larr; Return to Gateways
                            </button>
                            <Button onClick={() => setStep(4)} className="w-full sm:w-auto px-16 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-600/30">
                                Transfer Completed &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION */}
                {step === 4 && selectedMethod && (
                    <div className="animate-fade-in space-y-10 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Final Verification</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 4: Audit trail details</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                            <div>
                                <span className="block text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Gateway</span>
                                <span className="font-black text-gray-900 dark:text-white uppercase">{selectedMethod.name}</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Audit Value</span>
                                <span className="font-black text-blue-600 dark:text-blue-400 text-3xl tracking-tighter">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Verification Account Name</label>
                                    <input 
                                        type="text" 
                                        value={senderAccountTitle}
                                        onChange={e => setSenderAccountTitle(e.target.value)}
                                        className="w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none font-bold"
                                        placeholder="EXACT NAME ON RECEIPT"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Transaction Reference (Trx ID)</label>
                                    <input 
                                        type="text" 
                                        value={transactionId}
                                        onChange={e => setTransactionId(e.target.value)}
                                        className="w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none font-mono font-bold tracking-widest"
                                        placeholder="REFERENCE NUMBER"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Digital Receipt (Audit Proof)</label>
                                    <div className={`border-2 border-dashed rounded-[2rem] p-10 text-center transition-all duration-300 ${receipt ? 'border-green-500 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800 hover:border-blue-500/50 bg-gray-50 dark:bg-gray-900/50'}`}>
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
                                                <div className="flex flex-col items-center gap-3 animate-fade-in">
                                                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg"><CheckCircleIcon className="w-6 h-6" /></div>
                                                    <span className="text-xs font-black text-green-700 dark:text-green-300 uppercase tracking-widest">{receipt.name} attached</span>
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-tighter hover:text-blue-500 underline transition-colors">Tap to swap file</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-4 group">
                                                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-300 dark:text-gray-600 group-hover:scale-110 group-hover:text-blue-500 transition-all duration-300 shadow-sm border border-gray-100 dark:border-gray-700">
                                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">Select Audit Screenshot</span>
                                                        <span className="block text-[10px] text-gray-400 uppercase tracking-tighter">MAX FILE SIZE 10MB • PNG, JPG, WEBP</span>
                                                    </div>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-6">
                                <button type="button" onClick={() => setStep(3)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors">
                                    &larr; Return to Step 3
                                </button>
                                <Button type="submit" className="w-full sm:w-auto px-16 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-green-600/30 bg-green-600 hover:bg-green-700 border-0" disabled={isSubmitting}>
                                    {isSubmitting ? 'Syncing...' : `Submit Audit Request`}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* DEPOSIT HISTORY SECTION */}
            <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 mt-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Audit Ledger</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <select 
                            value={historyStatus} 
                            onChange={(e) => setHistoryStatus(e.target.value)} 
                            className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Approved}>Approved</option>
                            <option value={Status.Pending}>Pending</option>
                            <option value={Status.Rejected}>Rejected</option>
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800">
                            <input 
                                type="date" 
                                value={historyDateFrom} 
                                onChange={(e) => setHistoryDateFrom(e.target.value)} 
                                className="bg-transparent border-none dark:text-white text-[10px] font-black uppercase focus:ring-0" 
                            />
                            <span className="text-gray-300 dark:text-gray-700">|</span>
                            <input 
                                type="date" 
                                value={historyDateTo} 
                                onChange={(e) => setHistoryDateTo(e.target.value)} 
                                className="bg-transparent border-none dark:text-white text-[10px] font-black uppercase focus:ring-0" 
                            />
                        </div>
                    </div>
                </div>

                {filteredDeposits.length > 0 ? (
                    <div className="overflow-hidden rounded-3xl border border-gray-50 dark:border-gray-800 shadow-inner">
                        <Table headers={['Date', 'Provider', 'Allocation', 'Reference', 'State']}>
                            {filteredDeposits.map((deposit) => (
                                <tr key={deposit._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-blue-900/5 transition-colors group">
                                    <td className="px-6 py-5 text-[11px] font-black uppercase text-gray-400 font-mono tracking-tighter">{new Date(deposit.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-5 text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{deposit.method}</td>
                                    <td className="px-6 py-5 font-black text-green-600 dark:text-green-400 text-base">{formatCurrency(deposit.amount, deposit.currency)}</td>
                                    <td className="px-6 py-5 text-[10px] font-mono font-bold uppercase tracking-widest opacity-60">{deposit.transactionId}</td>
                                    <td className="px-6 py-5"><Badge status={deposit.status} /></td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Empty Audit Record</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepositFunds;
