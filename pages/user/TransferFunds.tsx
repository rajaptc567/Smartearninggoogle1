
import React, { useState, useMemo, useEffect } from 'react';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createTransfer } from '../../services/api';
import { formatCurrency, User, currencySymbols, Currency, Transfer, Status } from '../../types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const ShieldExclamationIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Recipient', 'Value', 'Transmission'];
    return (
        <div className="flex items-center justify-between mb-10 w-full max-w-xl mx-auto px-4 relative">
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

const TransferFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, users, settings, transfers } = state;
    const navigate = useNavigate();
    
    // UI Wizard State
    const [step, setStep] = useState(1);
    const [recipientIdentifier, setRecipientIdentifier] = useState('');
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const [fee, setFee] = useState(0);
    const [totalDeduction, setTotalDeduction] = useState(0);
    const [feeError, setFeeError] = useState<string | null>(null);

    // Cross-currency calculation state
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [receivedAmount, setReceivedAmount] = useState<number | null>(null);
    
    // Manual entry validation state
    const [manualRecipientState, setManualRecipientState] = useState<{ status: 'idle' | 'loading' | 'valid' | 'invalid'; message: string | null }>({ status: 'idle', message: null });

    // History Filter States
    const [historyType, setHistoryType] = useState<'All' | 'Sent' | 'Received'>('All');
    const [historyStatus, setHistoryStatus] = useState<string>('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const availableRecipients = useMemo(() => {
        if (!currentUser) return [];

        const downline: { user: User; level: number }[] = [];
        const processedUsernames = new Set<string>();

        const buildDownline = (sponsorUsername: string, level: number) => {
            if (processedUsernames.has(sponsorUsername.toLowerCase())) return;
            processedUsernames.add(sponsorUsername.toLowerCase());

            const directRefs = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === sponsorUsername.toLowerCase());
            
            directRefs.forEach(ref => {
                downline.push({ user: ref, level });
                buildDownline(ref.username, level + 1);
            });
        };
        
        buildDownline(currentUser.username, 1);
        
        const filteredDownline = downline.filter(item => 
            settings.transferConfig?.allowCrossCurrency || item.user.currency === currentUser.currency
        );

        filteredDownline.sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            return a.user.fullName.localeCompare(b.user.fullName);
        });

        return filteredDownline;
    }, [currentUser, users, settings.transferConfig]);
    
    const recipientUser = useMemo(() => {
        if (!recipientIdentifier) return null;
        const term = recipientIdentifier.toLowerCase().trim();
        return users.find(u => u.username.toLowerCase() === term || u.email.toLowerCase() === term || u._id === recipientIdentifier);
    }, [recipientIdentifier, users]);
    
    // Debounced validation for manual recipient entry
    useEffect(() => {
        if (!isManualEntry || !recipientIdentifier.trim()) {
            setManualRecipientState({ status: 'idle', message: null });
            return;
        }

        setManualRecipientState({ status: 'loading', message: 'Scanning blockchain directory...' });

        const handler = setTimeout(() => {
            const term = recipientIdentifier.toLowerCase().trim();
            const foundUser = users.find(u => u.username.toLowerCase() === term || u.email.toLowerCase() === term);

            if (foundUser) {
                if (foundUser._id === currentUser?._id) {
                     setManualRecipientState({ status: 'invalid', message: 'Destination cannot be origin account.' });
                } else if (!settings.transferConfig?.allowCrossCurrency && foundUser.currency !== currentUser?.currency) {
                    setManualRecipientState({ status: 'invalid', message: `Cross-currency transfers are currently disabled.` });
                } else {
                    setManualRecipientState({ status: 'valid', message: `Identity Verified: ${foundUser.fullName}` });
                }
            } else {
                setManualRecipientState({ status: 'invalid', message: 'Identity not found in secure directory.' });
            }
        }, 600);

        return () => clearTimeout(handler);
    }, [recipientIdentifier, isManualEntry, users, currentUser, settings.transferConfig]);

    // Fee calculation
    useEffect(() => {
        if (!currentUser) return;
        const val = parseFloat(amount);
        const config = settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [] };

        if (!config.enabled) {
            setFeeError("Transfers are restricted by system admin.");
            setFee(0);
            setTotalDeduction(0);
            return;
        }

        if (isNaN(val) || val <= 0) {
            setFee(0);
            setTotalDeduction(0);
            setFeeError(null);
            return;
        }

        const tier = config.tiers?.find(t => 
            t.currency === currentUser.currency &&
            val >= t.minAmount && 
            val <= t.maxAmount &&
            (t.enabled === undefined || t.enabled === true)
        );

        if (!tier) {
            setFeeError("Amount is outside standard liquidity tiers.");
            setFee(0);
            setTotalDeduction(0);
        } else {
            let calculatedFee = tier.feeType === 'percentage' ? (val * tier.feeValue) / 100 : tier.feeValue;
            setFee(calculatedFee);
            setTotalDeduction(val + calculatedFee);
            setFeeError(null);
        }
    }, [amount, settings, currentUser]);
    
    // Cross-currency calculation
    useEffect(() => {
        if (recipientUser && currentUser && recipientUser.currency && currentUser.currency && recipientUser.currency !== currentUser.currency && settings.transferConfig?.allowCrossCurrency && parseFloat(amount) > 0) {
            const fromCurrency = currentUser.currency.toUpperCase();
            const toCurrency = recipientUser.currency.toUpperCase();
            const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.00 };
            const rates = settings.exchangeRates || {};
            
            const getRate = (curr: string) => {
                const r = (rates as any)[curr];
                if (curr === 'PKR' && (r === 1 || !r)) return defaultRates.PKR;
                if (curr === 'EUR' && (r === 0 || !r)) return defaultRates.EUR;
                if (r !== undefined && r !== null && r !== 0) return r;
                return (defaultRates as any)[curr] || 1;
            };

            const fromRateToBase = getRate(fromCurrency);
            const toRateToBase = getRate(toCurrency);

            if (fromRateToBase === 0) {
                setExchangeRate(0);
                setReceivedAmount(0);
                return;
            }

            const amountInUsd = parseFloat(amount) / fromRateToBase;
            const finalAmount = amountInUsd * toRateToBase;
            setReceivedAmount(finalAmount);
            const displayRate = toRateToBase / fromRateToBase;
            setExchangeRate(displayRate);
        } else {
            setExchangeRate(null);
            setReceivedAmount(null);
        }
    }, [amount, currentUser, recipientUser, settings.exchangeRates, settings.transferConfig]);
    
    const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'manual') {
            setIsManualEntry(true);
            setRecipientIdentifier('');
        } else {
            setIsManualEntry(false);
            setRecipientIdentifier(value);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        
        if (!currentUser || !recipientUser) return;
        if (totalDeduction > currentUser.walletBalance) return;
        
        setIsSubmitting(true);
        try {
            const result = await createTransfer({
                senderId: currentUser._id,
                senderName: currentUser.username,
                recipientId: recipientUser._id,
                recipientName: recipientUser.username,
                amount: numericAmount,
            });

            dispatch({ type: 'ADD_TRANSFER', payload: result.transfer });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });

            setIsSubmitted(true);
        } catch (error) {
            alert(`Transfer Failed: ${error instanceof Error ? error.message : 'System Error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredHistory = useMemo(() => {
        if (!currentUser) return [];
        return transfers.filter(t => {
            const isSender = t.senderId === currentUser._id;
            const isRecipient = t.recipientId === currentUser._id;
            if (!isSender && !isRecipient) return false;
            if (historyType === 'Sent' && !isSender) return false;
            if (historyType === 'Received' && !isRecipient) return false;
            if (historyStatus && t.status !== historyStatus) return false;
            if (historyDateFrom || historyDateTo) {
                const txDate = new Date(t.date).setHours(0,0,0,0);
                const from = historyDateFrom ? new Date(historyDateFrom).setHours(0,0,0,0) : -8640000000000000;
                const to = historyDateTo ? new Date(historyDateTo).setHours(23,59,59,999) : 8640000000000000;
                if (txDate < from || txDate > to) return false;
            }
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transfers, currentUser, historyType, historyStatus, historyDateFrom, historyDateTo]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [historyType, historyStatus, historyDateFrom, historyDateTo, itemsPerPage]);

    // Pagination Logic
    const totalItems = filteredHistory.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedTransfers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredHistory.slice(start, start + itemsPerPage);
    }, [filteredHistory, currentPage, itemsPerPage]);

    if (!currentUser) return null;

    if (currentUser.restrictions?.transfer) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-8 border border-red-200 dark:border-red-800">
                        <ShieldExclamationIcon />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 leading-none">Transfers Disabled</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto leading-relaxed font-medium">
                        Wallet-to-wallet transfers have been restricted for your account by the security department.
                    </p>
                    <div className="w-full p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 mb-8">
                        <p className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">Security Review Active</p>
                        <p className="text-xs text-gray-500 font-medium">Please contact support or open a dispute for manual account verification.</p>
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
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-24 w-24 flex items-center justify-center mb-8 shadow-2xl shadow-green-500/30">
                    <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Transfer Dispatched!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-10 leading-relaxed font-medium">Funds have been allocated to the destination. Request is now awaiting audit confirmation.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button onClick={() => window.location.reload()} className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">New Transfer</Button>
                    <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Return to Hub</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-16 px-2">
            {/* Fintech Header */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mb-12 group">
                <div className="absolute inset-0 bg-white/5 opacity-10 pointer-events-none"></div>
                <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter uppercase leading-none">Internal Transfer</h1>
                        <p className="text-blue-50 text-sm md:text-base max-w-2xl leading-relaxed font-medium">
                            Send funds instantly to other members within the SmartEarning network. Cross-currency support and real-time verification active.
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 text-center min-w-[220px] shadow-inner">
                        <p className="text-[10px] text-blue-200 uppercase tracking-[0.3em] font-black mb-1">Liquid Balance</p>
                        <p className="text-3xl font-black tracking-tighter">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
                    </div>
                </div>
            </div>

            <StepIndicator currentStep={step} />

            <div className="bg-white dark:bg-gray-950 p-8 sm:p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800">
                {/* STEP 1: RECIPIENT */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-8 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Destination Identity</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 1: Locate Target Member</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Secure Directory Search</label>
                                <select
                                    value={isManualEntry ? 'manual' : recipientIdentifier}
                                    onChange={handleDropdownChange}
                                    className="w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none font-bold text-base"
                                >
                                    <option value="">-- Browse your active network --</option>
                                    {availableRecipients.map(({ user, level }) => (
                                        <option key={user._id} value={user.username}>
                                            {user.fullName} (@{user.username}) - Level {level}
                                        </option>
                                    ))}
                                    <option value="manual">-- Manual ID Entry --</option>
                                </select>
                            </div>

                            {isManualEntry && (
                                <div className="animate-slide-up">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Target Username / Email</label>
                                    <input
                                        type="text"
                                        value={recipientIdentifier}
                                        onChange={(e) => setRecipientIdentifier(e.target.value)}
                                        className="w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none font-bold"
                                        placeholder="e.g. member_alpha"
                                        autoComplete="off"
                                    />
                                    <div className="mt-3 px-4 h-6">
                                        {manualRecipientState.status === 'loading' && <p className="text-[10px] text-gray-400 font-black uppercase animate-pulse">{manualRecipientState.message}</p>}
                                        {manualRecipientState.status === 'invalid' && <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">{manualRecipientState.message}</p>}
                                        {manualRecipientState.status === 'valid' && <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">{manualRecipientState.message}</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-6">
                            <Button 
                                onClick={() => setStep(2)} 
                                disabled={!recipientUser || (isManualEntry && manualRecipientState.status !== 'valid')}
                                className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 border-0"
                            >
                                Validate & Allocate Value &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: VALUE */}
                {step === 2 && recipientUser && (
                    <div className="animate-fade-in space-y-10 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Settlement Value</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 2: Define Transaction amount</p>
                        </div>

                        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm">
                                    {recipientUser.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">To Identity</p>
                                    <p className="font-black text-gray-900 dark:text-white">@{recipientUser.username}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network Region</p>
                                <p className="font-bold text-blue-600 dark:text-blue-400">{recipientUser.country} ({recipientUser.currency})</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Transfer Amount</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-gray-400 font-bold">
                                        {currencySymbols[currentUser.currency]}
                                    </span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-8 p-5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none font-black text-2xl tracking-tighter"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {amount && (
                                <div className="bg-[#0f172a] p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl animate-slide-up">
                                    {feeError ? (
                                        <div className="text-center p-2 text-red-500 font-black text-xs uppercase tracking-widest">{feeError}</div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center text-gray-500 uppercase font-black text-[9px] tracking-widest border-b border-white/5 pb-4">
                                                <span>Allocation</span>
                                                <span className="text-white text-xs">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-gray-500 uppercase font-black text-[9px] tracking-widest border-b border-white/5 pb-4">
                                                <span>System Processing Fee</span>
                                                <span className="text-red-400 text-xs">+{formatCurrency(fee, currentUser.currency)}</span>
                                            </div>

                                            {recipientUser.currency !== currentUser.currency && exchangeRate && (
                                                <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Rate (1 {currentUser.currency})</span>
                                                        <span className="text-xs font-mono font-bold text-white">{exchangeRate.toFixed(4)} {recipientUser.currency}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Estimated Receipt</span>
                                                        <span className="text-sm font-black text-green-400">≈ {formatCurrency(receivedAmount!, recipientUser.currency)}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-2 flex justify-between items-center">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Ledger Deduction</span>
                                                <span className="text-3xl font-black text-blue-500 tracking-tighter">{formatCurrency(totalDeduction, currentUser.currency)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <button onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors">
                                &larr; Return to Step 1
                            </button>
                            <Button 
                                onClick={() => setStep(3)} 
                                disabled={!amount || !!feeError || totalDeduction > currentUser.walletBalance} 
                                className="w-full sm:w-auto px-12 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 border-0"
                            >
                                Authorize Request &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 3: TRANSMISSION */}
                {step === 3 && recipientUser && (
                    <div className="animate-fade-in space-y-10 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Transmission Authorization</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 3: Final Security Review</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 border-2 border-blue-500/20 rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                            <div className="flex flex-col gap-10">
                                <div className="flex justify-between items-end border-b dark:border-gray-800 pb-8">
                                    <div>
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Destination Credentials</span>
                                        <span className="font-black text-gray-900 dark:text-white text-xl uppercase">@{recipientUser.username}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Gross Allocation</span>
                                        <span className="font-black text-blue-600 dark:text-blue-400 text-3xl tracking-tighter">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="p-6 bg-white dark:bg-black/20 rounded-3xl border border-gray-100 dark:border-gray-800">
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-3">Audit Trail Summary</span>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-bold"><span className="text-gray-500">Service Fee:</span> <span className="text-red-500">{formatCurrency(fee, currentUser.currency)}</span></div>
                                            <div className="flex justify-between text-xs font-bold"><span className="text-gray-500">Net Ledger Impact:</span> <span className="text-gray-900 dark:text-white">{formatCurrency(totalDeduction, currentUser.currency)}</span></div>
                                            {receivedAmount && <div className="flex justify-between text-xs font-bold pt-2 border-t dark:border-gray-700"><span className="text-blue-500">Target Credit:</span> <span className="text-green-500">≈ {formatCurrency(receivedAmount, recipientUser.currency)}</span></div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30">
                            <p className="text-[11px] text-amber-700 dark:text-amber-500 font-bold leading-relaxed">
                                <span className="text-lg mr-2">⚠️</span> Final Notice: This action cannot be reversed once authorized. Funds will be locked in the audit queue until admin approval.
                            </p>
                        </div>

                        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <button type="button" onClick={() => setStep(2)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors">
                                &larr; Return to Step 2
                            </button>
                            <Button type="submit" onClick={handleSubmit} className="w-full sm:w-auto px-20 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 border-0" disabled={isSubmitting}>
                                {isSubmitting ? 'Authenticating...' : `Confirm Transmission`}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* History Section Redesign */}
            <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 mt-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Settlement Ledger</h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Show:</label>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20 py-1 px-2"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <select 
                            value={historyType} 
                            onChange={(e) => setHistoryType(e.target.value as any)} 
                            className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20"
                        >
                            <option value="All">All Types</option>
                            <option value="Sent">Sent</option>
                            <option value="Received">Received</option>
                        </select>
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
                    </div>
                </div>

                {paginatedTransfers.length > 0 ? (
                    <>
                        <div className="hidden md:block overflow-hidden rounded-3xl border border-gray-50 dark:border-gray-800 shadow-inner">
                            <Table headers={['Date', 'Type', 'Counterparty', 'Allocation', 'impact', 'Status']}>
                                {paginatedTransfers.map(transfer => {
                                    const isSender = transfer.senderId === currentUser._id;
                                    const counterpartyName = isSender ? transfer.recipientName : transfer.senderName;
                                    const directionLabel = isSender ? 'Sent' : 'Received';
                                    const amountColor = isSender ? 'text-red-500' : 'text-green-500';
                                    const amountPrefix = isSender ? '-' : '+';

                                    return (
                                        <tr key={transfer._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-blue-900/5 transition-colors group">
                                            <td className="px-6 py-5 text-[11px] font-black uppercase text-gray-400 font-mono tracking-tighter">{new Date(transfer.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-5">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isSender ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                                    {directionLabel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">@{counterpartyName}</td>
                                            <td className="px-6 py-5 font-bold text-gray-500">{formatCurrency(transfer.amount, transfer.currency)}</td>
                                            <td className={`px-6 py-5 font-black ${amountColor} text-base`}>{amountPrefix}{formatCurrency(isSender ? (transfer.totalDeducted || transfer.amount) : transfer.amount, transfer.currency)}</td>
                                            <td className="px-6 py-5">
                                                <Badge status={transfer.status as Status} />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </Table>
                        </div>

                        {/* Mobile View Settlement Ledger */}
                        <div className="md:hidden space-y-4">
                            {paginatedTransfers.map(transfer => {
                                const isSender = transfer.senderId === currentUser._id;
                                const counterpartyName = isSender ? transfer.recipientName : transfer.senderName;
                                const directionLabel = isSender ? 'Sent' : 'Received';
                                const amountColor = isSender ? 'text-red-500' : 'text-green-500';
                                const amountPrefix = isSender ? '-' : '+';
                                
                                return (
                                    <div key={transfer._id} className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300">
                                         <div 
                                            className="p-4 flex items-center justify-between cursor-pointer"
                                            onClick={() => setExpandedTransferId(expandedTransferId === transfer._id ? null : transfer._id)}
                                         >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isSender ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                                        {directionLabel}
                                                    </span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate max-w-[100px]">
                                                        @{counterpartyName}
                                                    </span>
                                                </div>
                                                <span className={`text-sm font-black ${amountColor}`}>
                                                    {amountPrefix}{formatCurrency(isSender ? (transfer.totalDeducted || transfer.amount) : transfer.amount, transfer.currency)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge status={transfer.status as Status} />
                                                <div className={`w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-blue-500 transition-transform shadow-sm ${expandedTransferId === transfer._id ? 'rotate-180' : ''}`}>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                         </div>
                                         
                                         {expandedTransferId === transfer._id && (
                                            <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 animate-fade-in text-left">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2 flex justify-between items-center border-b dark:border-gray-800 pb-2">
                                                        <div>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</p>
                                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{new Date(transfer.date).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Type</p>
                                                            <p className={`text-xs font-black uppercase ${isSender ? 'text-orange-500' : 'text-green-500'}`}>{directionLabel}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Impact Amount</p>
                                                        <p className={`text-xs font-bold ${amountColor}`}>
                                                            {amountPrefix}{formatCurrency(isSender ? (transfer.totalDeducted || transfer.amount) : transfer.amount, transfer.currency)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Base Amount</p>
                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                            {formatCurrency(transfer.amount, transfer.currency)}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2 pt-2 border-t dark:border-gray-800">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{isSender ? 'Recipient' : 'Sender'}</p>
                                                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase truncate">
                                                            @{counterpartyName}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                         )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Pagination Controls */}
                        <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4 border-t dark:border-gray-800 pt-6">
                            <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                Page {currentPage} of {totalPages || 1} ({totalItems} records)
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest"
                                >
                                    &larr; Prev
                                </Button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = i + 1;
                                        if (totalPages > 5 && currentPage > 3) {
                                            pageNum = currentPage - 3 + i + 1;
                                            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                        }
                                        if (pageNum <= 0) return null;
                                        
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                                                    currentPage === pageNum 
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest"
                                >
                                    Next &rarr;
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">No ledger entries found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransferFunds;
