
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Status, Withdrawal, formatCurrency, currencySymbols, Task } from '../../types';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createWithdrawal } from '../../services/api';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const WithdrawalHeaderIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
);

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LockIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);

const ShieldExclamationIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Amount', 'Method', 'Details', 'Confirm'];
    return (
        <div className="flex items-center justify-between mb-10 w-full max-w-2xl mx-auto px-4 relative">
             <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-0 hidden sm:block"></div>
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                    <div key={label} className="flex flex-col items-center relative z-10">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all duration-500 transform ${isActive ? 'bg-teal-600 text-white shadow-xl shadow-teal-500/40 scale-110' : isCompleted ? 'bg-green-50 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'}`}>
                            {isCompleted ? '✓' : stepNum}
                        </div>
                        <span className={`text-[10px] mt-3 font-black uppercase tracking-[0.1em] transition-colors duration-300 ${isActive ? 'text-teal-600 dark:text-teal-400' : isCompleted ? 'text-green-500' : 'text-gray-400'}`}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
};

const WithdrawFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, paymentMethods, withdrawals, tasks, settings } = state;
    const { restrictWithdrawalAmount, withdrawalFrequency, isTasksEnabled } = settings;
    const navigate = useNavigate();

    // Wizard State
    const [step, setStep] = useState(1);

    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [accountTitle, setAccountTitle] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [userNotes, setUserNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

    // History Filter State
    const [historyStatus, setHistoryStatus] = useState<string>('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');

    // --- ELIGIBILITY CHECK: UNCOMPLETED REQUIRED TASKS ---
    const pendingRequiredTasks = useMemo(() => {
        // If the Task feature is disabled globally, we don't enforce these requirements
        if (!currentUser || !isTasksEnabled) return [];
        const completedTaskIds = (currentUser.completedTasks || []).map(ct => ct.taskId);
        return tasks.filter(t => t.status === 'Active' && t.isRequiredForWithdrawal && !completedTaskIds.includes(t._id));
    }, [tasks, currentUser, isTasksEnabled]);

    // Derived Data
    const withdrawalMethods = useMemo(() => {
        if (!currentUser) return [];
        return paymentMethods.filter(method => 
            method.type === 'Withdrawal' && 
            method.status === 'Enabled' &&
            method.currency === currentUser.currency
        );
    }, [paymentMethods, currentUser]);
    
    const userActivePlanPrices = useMemo(() => {
        if (!currentUser?.activePlans) return [];
        return [...new Set(currentUser.activePlans.map(p => p.price))]
            .sort((a: number, b: number) => a - b);
    }, [currentUser]);

    const selectedMethod: PaymentMethod | undefined = useMemo(() =>
        withdrawalMethods.find(method => method._id.toString() === selectedMethodId),
        [selectedMethodId, withdrawalMethods]
    );

    // Fee Calculation
    const [fee, setFee] = useState(0);
    const [finalAmount, setFinalAmount] = useState(0);

    useEffect(() => {
        const numericAmount = parseFloat(amount);
        if (selectedMethod && !isNaN(numericAmount) && numericAmount > 0) {
            const calculatedFee = (numericAmount * selectedMethod.feePercent) / 100;
            setFee(calculatedFee);
            setFinalAmount(numericAmount - calculatedFee);
        } else {
            setFee(0);
            setFinalAmount(0);
        }
    }, [amount, selectedMethod]);

    // Check Frequency Cooldown
    useEffect(() => {
        if (currentUser && withdrawalFrequency?.enabled) {
            const myLastWithdrawal = withdrawals
                .filter(w => w.userId === currentUser._id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            if (myLastWithdrawal) {
                const lastDate = new Date(myLastWithdrawal.date).getTime();
                const now = Date.now();
                let durationMs = 0;
                const { value, unit } = withdrawalFrequency;

                switch (unit) {
                    case 'hours': durationMs = value * 60 * 60 * 1000; break;
                    case 'days': durationMs = value * 24 * 60 * 60 * 1000; break;
                    case 'weeks': durationMs = value * 7 * 24 * 60 * 60 * 1000; break;
                    case 'months': durationMs = value * 30 * 24 * 60 * 60 * 1000; break;
                }

                const nextAllowedTime = lastDate + durationMs;
                
                if (now < nextAllowedTime) {
                    const remainingMs = nextAllowedTime - now;
                    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    setCooldownMessage(`Limit reached: One withdrawal every ${value} ${unit}. Available in ${days}d ${hours}h ${minutes}m.`);
                } else {
                    setCooldownMessage(null);
                }
            }
        } else {
            setCooldownMessage(null);
        }
    }, [currentUser, withdrawals, withdrawalFrequency]);

    // Reset method if amount changes and method becomes invalid
    useEffect(() => {
        if (selectedMethodId && !withdrawalMethods.find(m => m._id === selectedMethodId)) {
            setSelectedMethodId('');
            if (step > 2) setStep(2);
        }
    }, [withdrawalMethods, selectedMethodId, step]);

    // Filtered History
    const filteredWithdrawals = useMemo(() => {
        if (!currentUser) return [];
        return withdrawals
            .filter(w => {
                if (w.userId !== currentUser._id) return false;
                if (historyStatus && w.status !== historyStatus) return false;
                if (historyDateFrom || historyDateTo) {
                    const itemDate = new Date(w.date).setHours(0,0,0,0);
                    const from = historyDateFrom ? new Date(historyDateFrom).setHours(0,0,0,0) : null;
                    const to = historyDateTo ? new Date(historyDateTo).setHours(23,59,59,999) : null;
                    if (from && itemDate < from) return false;
                    if (to && itemDate > to) return false;
                }
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [withdrawals, currentUser, historyStatus, historyDateFrom, historyDateTo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);

        if (!currentUser) return alert('User not found.');
        if (!selectedMethod || isNaN(numericAmount) || !accountTitle || !accountNumber) {
            return alert('Please fill all required fields.');
        }
        if (numericAmount > currentUser.walletBalance) {
            return alert("Withdrawal amount cannot exceed your wallet balance.");
        }
        
        setIsSubmitting(true);
        try {
            const withdrawalData = {
                userId: currentUser._id,
                userName: currentUser.username,
                method: selectedMethod.name,
                amount: numericAmount,
                fee: fee,
                finalAmount: finalAmount,
                accountTitle: accountTitle,
                accountNumber: accountNumber,
                userNotes: userNotes,
            };

            const result = await createWithdrawal(withdrawalData);
            dispatch({ type: 'ADD_WITHDRAWAL', payload: result.withdrawal });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setIsSubmitted(true);

        } catch (error) {
             console.error("Failed to submit withdrawal request:", error);
             alert(`Error: ${error instanceof Error ? error.message : 'Could not submit request.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentUser) return null;

    // --- INSTANT RESTRICTION CHECK ---
    if (currentUser.restrictions?.withdrawal) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-8 border border-red-200 dark:border-red-800">
                        <ShieldExclamationIcon />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 leading-none">Withdrawal Access Blocked</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto leading-relaxed font-medium">
                        Your account's ability to liquidate earnings has been temporarily restricted by the security department for your protection.
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

    // --- RENDER LOCKED SCREEN IF TASKS PENDING ---
    if (pendingRequiredTasks.length > 0) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-8 border border-red-200 dark:border-red-800">
                        <LockIcon />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 leading-none">Access Restricted</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto leading-relaxed">
                        Platform security policy requires members to complete specific engagement missions before unlocking digital asset withdrawals.
                    </p>
                    
                    <div className="w-full space-y-4 mb-10 text-left">
                        {pendingRequiredTasks.map(task => (
                            <div key={task._id} className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 group hover:border-blue-600 transition-all">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">{task.title}</span>
                                    <span className="text-[9px] text-red-600 font-black uppercase tracking-[0.2em] mt-1 opacity-70">Mandatory Verification</span>
                                </div>
                                <button 
                                    onClick={() => navigate('/member/tasks')}
                                    className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                                >
                                    Complete &rarr;
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 w-full text-left">
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold leading-relaxed">
                            <span className="text-lg mr-2">💡</span> Automated Unlock: Completing these tasks will instantly restore payout functionality for your wallet.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl text-center border border-gray-100 dark:border-gray-800 animate-fade-in">
                 <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-24 w-24 flex items-center justify-center mb-8 shadow-2xl shadow-green-500/30">
                    <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Settlement Requested!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-10 leading-relaxed font-medium">Your request has entered our automated queue. Verifications typically conclude within 3-12 hours.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button onClick={() => window.location.reload()} className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">New Request</Button>
                    <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Dashboard Hub</Button>
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
                    <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.77.46 3.45 1.28 4.94L2 22l5.25-1.38c1.44.75 3.06 1.18 4.79 1.18h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2z"/></svg>
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter uppercase leading-none">Withdraw Funds</h1>
                        <p className="text-blue-50 text-sm md:text-base max-w-2xl leading-relaxed font-medium">
                            Redeem your earnings and move them to your personal account. Choose your preferred withdrawal method and provide the necessary details to process your payout.
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 text-center min-w-[220px] shadow-inner">
                        <p className="text-[10px] text-blue-200 uppercase tracking-[0.3em] font-black mb-1">Withdrawable</p>
                        <p className="text-3xl font-black tracking-tighter">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
                    </div>
                </div>
            </div>

            {cooldownMessage && (
                <div className="mb-10 p-6 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-3xl text-yellow-800 dark:text-yellow-200 flex items-center shadow-xl animate-fade-in">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl mr-5 shrink-0"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                    <div>
                        <p className="font-black text-xs uppercase tracking-widest mb-1">Temporal Frequency Limit</p>
                        <p className="text-sm font-bold opacity-80">{cooldownMessage}</p>
                    </div>
                </div>
            )}

            <StepIndicator currentStep={step} />

            <div className={`bg-white dark:bg-gray-950 p-8 sm:p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 ${cooldownMessage ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                
                {/* STEP 1: AMOUNT */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-8 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Settlement Value</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 1: Payout allocation</p>
                        </div>

                        {restrictWithdrawalAmount ? (
                            <div className="space-y-6">
                                {userActivePlanPrices.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {userActivePlanPrices.map(price => (
                                            <button
                                                key={price}
                                                type="button"
                                                onClick={() => setAmount(price.toString())}
                                                className={`py-5 px-6 rounded-3xl font-black uppercase text-xs tracking-widest transition-all duration-300 border-2 ${
                                                    amount === price.toString()
                                                    ? 'bg-teal-600 text-white border-teal-400 shadow-2xl shadow-teal-500/40 scale-105'
                                                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800 hover:border-teal-500/30'
                                                }`}
                                            >
                                                {formatCurrency(price, currentUser.currency)}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-10 bg-yellow-50 dark:bg-yellow-950/20 rounded-[2rem] border border-yellow-100 dark:border-yellow-900/30">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-bold mb-6">
                                            Active Plan Requirement: You must own a valid investment tier to unlock plan-matching payouts.
                                        </p>
                                        <Button onClick={() => navigate('/member/plans')} className="rounded-xl px-10 py-4 font-black uppercase text-[10px] tracking-widest">Buy Plan Now</Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-2">Redemption Amount</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-gray-400 font-bold">
                                        {currencySymbols[currentUser.currency]}
                                    </span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-8 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500/10 focus:border-teal-600 outline-none transition-all dark:text-white text-2xl font-black tracking-tighter"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="pt-6">
                            <Button 
                                onClick={() => setStep(2)} 
                                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > currentUser.walletBalance}
                                className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-teal-600/30 bg-teal-600 hover:bg-teal-700 border-0"
                            >
                                Select Payout Method &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: METHOD - REDESIGNED 2 PER ROW, NO LIMIT TEXT */}
                {step === 2 && (
                    <div className="animate-fade-in space-y-10">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Destination Network</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 2: Choose Payout Provider</p>
                        </div>

                        {withdrawalMethods.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4 md:gap-6">
                                {withdrawalMethods.map(method => {
                                    const numAmount = parseFloat(amount);
                                    const isInvalid = numAmount < method.minAmount || numAmount > method.maxAmount;
                                    
                                    return (
                                        <div 
                                            key={method._id}
                                            onClick={() => {
                                                if (isInvalid) {
                                                    alert(`Limit Violation: This provider only processes requests between ${formatCurrency(method.minAmount, method.currency)} and ${formatCurrency(method.maxAmount, method.currency)}`);
                                                    return;
                                                }
                                                setSelectedMethodId(method._id);
                                                setStep(3);
                                            }}
                                            className={`relative cursor-pointer p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center text-center bg-white dark:bg-gray-900 group transform hover:-translate-y-1 active:scale-95 shadow-sm ${
                                                isInvalid 
                                                ? 'opacity-40 border-gray-100 dark:border-gray-800 grayscale cursor-not-allowed'
                                                : 'border-gray-50 dark:border-gray-800 hover:border-teal-500 dark:hover:border-teal-600 hover:shadow-2xl'
                                            }`}
                                        >
                                            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 dark:bg-black rounded-2xl md:rounded-3xl flex items-center justify-center p-2.5 md:p-3 shadow-inner border border-gray-100 dark:border-gray-800 transition-transform group-hover:scale-105">
                                                {method.logoUrl ? (
                                                    <img src={method.logoUrl} alt={method.name} className="max-w-full max-h-full object-contain" />
                                                ) : (
                                                    <div className="text-teal-600 dark:text-teal-400 font-black text-2xl md:text-3xl uppercase">{method.name.substring(0,1)}</div>
                                                )}
                                            </div>
                                            
                                            <div className="mt-4 md:mt-6 space-y-1">
                                                <h4 className="text-sm md:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-tight">{method.name}</h4>
                                                <span className="inline-block px-2 md:px-3 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-full border border-teal-200 dark:border-teal-800/30">Instant</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800 max-w-lg mx-auto">
                                <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">No payout providers currently active in your region.</p>
                            </div>
                        )}

                        <div className="pt-6 flex justify-start">
                            <button onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-teal-500 transition-colors">
                                &larr; Return to Step 1
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: DETAILS */}
                {step === 3 && selectedMethod && (
                    <div className="animate-fade-in space-y-10 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Settlement Address</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 3: Financial Routing</p>
                        </div>

                        <div className="bg-[#0f172a] p-10 rounded-[2.5rem] border border-gray-800 shadow-2xl relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-40 h-40 bg-teal-600/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 text-center sm:text-left">
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                                    <span className="block text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Gross Allocation</span>
                                    <span className="text-xl font-black text-white">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                                </div>
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                                    <span className="block text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Service Fee ({selectedMethod.feePercent}%)</span>
                                    <span className="text-xl font-black text-red-400">-{formatCurrency(fee, currentUser.currency)}</span>
                                </div>
                            </div>

                            <div className="text-center p-8 bg-teal-600 rounded-[2rem] shadow-xl">
                                <p className="text-[10px] text-teal-100 uppercase tracking-[0.3em] font-black mb-1">Net Credited Amount</p>
                                <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(finalAmount, currentUser.currency)}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Receiving Account Holder Name</label>
                                <input 
                                    type="text" 
                                    value={accountTitle}
                                    onChange={e => setAccountTitle(e.target.value)}
                                    className="w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 outline-none font-bold"
                                    placeholder="TITLE AS PER BANK"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Receiving Account / Wallet ID</label>
                                <input 
                                    type="text" 
                                    value={accountNumber}
                                    onChange={e => setAccountNumber(e.target.value)}
                                    className="w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 outline-none font-mono font-bold tracking-widest"
                                    placeholder="IBAN OR WALLET ID"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Technical Remarks (Optional)</label>
                                <textarea 
                                    value={userNotes}
                                    onChange={e => setUserNotes(e.target.value)}
                                    rows={2}
                                    className="w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 outline-none text-sm"
                                    placeholder="Any routing instructions..."
                                />
                            </div>
                        </div>

                        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <button onClick={() => setStep(2)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-teal-500 transition-colors">
                                &larr; Return to Step 2
                            </button>
                            <Button onClick={() => setStep(4)} disabled={!accountTitle || !accountNumber} className="w-full sm:w-auto px-12 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-teal-600/30 bg-teal-600 hover:bg-teal-700 border-0">
                                Review Payout Path &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION */}
                {step === 4 && selectedMethod && (
                    <div className="animate-fade-in space-y-10 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Transmission Authorization</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 4: Final verification</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 border-2 border-teal-500/20 dark:border-teal-900/50 rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-2 h-full bg-teal-600"></div>
                            
                            <div className="flex flex-col gap-10">
                                <div className="flex justify-between items-end border-b dark:border-gray-800 pb-8">
                                    <div>
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Settlement Network</span>
                                        <span className="font-black text-gray-900 dark:text-white text-xl uppercase">{selectedMethod.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Net Credit Value</span>
                                        <span className="font-black text-teal-600 dark:text-teal-400 text-3xl tracking-tighter">{formatCurrency(finalAmount, currentUser.currency)}</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="p-6 bg-white dark:bg-black/20 rounded-3xl border border-gray-100 dark:border-gray-800">
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-3">Destination Credentials</span>
                                        <span className="block font-black text-gray-900 dark:text-white text-lg uppercase leading-none mb-2">{accountTitle}</span>
                                        <span className="block font-mono text-base font-bold text-gray-500 dark:text-gray-400 tracking-widest">{accountNumber}</span>
                                    </div>
                                    {userNotes && (
                                        <div className="px-6 italic text-xs text-gray-400 leading-relaxed">
                                            "{userNotes}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <button type="button" onClick={() => setStep(3)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-teal-500 transition-colors">
                                &larr; Return to Step 3
                            </button>
                            <Button type="submit" onClick={handleSubmit} className="w-full sm:w-auto px-20 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-teal-600/30 bg-teal-600 hover:bg-teal-700 border-0" disabled={isSubmitting}>
                                {isSubmitting ? 'Transmitting...' : `Authorize Settlement`}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* WITHDRAWAL HISTORY SECTION */}
            <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 mt-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Settlement Log</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <select 
                            value={historyStatus} 
                            onChange={(e) => setHistoryStatus(e.target.value)} 
                            className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-teal-500/20"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Paid}>Paid</option>
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

                {filteredWithdrawals.length > 0 ? (
                    <div className="overflow-hidden rounded-3xl border border-gray-50 dark:border-gray-800 shadow-inner">
                        <Table headers={['Date', 'Network', 'Gross', 'Processing', 'Net Credit', 'State']}>
                            {filteredWithdrawals.map(withdrawal => (
                                <tr key={withdrawal._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-teal-900/5 transition-colors group">
                                    <td className="px-6 py-5 text-[11px] font-black uppercase text-gray-400 font-mono tracking-tighter">{new Date(withdrawal.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-5 text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{withdrawal.method}</td>
                                    <td className="px-6 py-5 font-bold text-gray-500">{formatCurrency(withdrawal.amount, withdrawal.currency)}</td>
                                    <td className="px-6 py-5 text-xs font-black text-red-500/60 uppercase">-{formatCurrency(withdrawal.fee, withdrawal.currency)}</td>
                                    <td className="px-6 py-5 font-black text-teal-600 dark:text-teal-400 text-base">{formatCurrency(withdrawal.finalAmount, withdrawal.currency)}</td>
                                    <td className="px-6 py-5">
                                        <Badge status={withdrawal.status === Status.Matching ? Status.Pending : withdrawal.status} />
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">No settlement history found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WithdrawFunds;
