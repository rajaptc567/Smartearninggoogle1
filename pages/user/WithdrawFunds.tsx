
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Status, Withdrawal, formatCurrency, currencySymbols } from '../../types';
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

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Amount', 'Method', 'Details', 'Confirm'];
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
            <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-0 hidden sm:block"></div>
        </div>
    );
};

const WithdrawFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, paymentMethods, withdrawals, settings: { restrictWithdrawalAmount, withdrawalFrequency } } = state;
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

    // Reset method if amount changes and method becomes invalid (though methods usually don't depend on amount for *availability* list, just validation)
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

    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl text-center border border-green-100 dark:border-green-900 animate-fade-in">
                 <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-24 w-24 flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
                    <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Request Submitted!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Your withdrawal request has been received and is now pending admin approval.</p>
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
            <div className="relative bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl overflow-hidden mb-8">
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Withdraw Funds</h1>
                            <p className="text-teal-100 max-w-lg">
                                Cash out your earnings securely. Follow the steps to request a payout to your preferred account.
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-teal-200 uppercase tracking-wider font-bold">Available Balance</p>
                            <p className="text-3xl font-extrabold">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-bottom-right"></div>
                <div className="absolute right-10 bottom-[-20px] text-white/10">
                    <WithdrawalHeaderIcon className="w-32 h-32" />
                </div>
            </div>

            {cooldownMessage && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl text-sm text-yellow-800 dark:text-yellow-200 flex items-center shadow-sm">
                    <svg className="w-6 h-6 mr-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div>
                        <p className="font-bold">Withdrawal Cooldown Active</p>
                        <p>{cooldownMessage}</p>
                    </div>
                </div>
            )}

            <StepIndicator currentStep={step} />

            <div className={`bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 ${cooldownMessage ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {/* STEP 1: AMOUNT */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-6 max-w-lg mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 1: How much to withdraw?</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Your balance: {formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
                        </div>

                        {restrictWithdrawalAmount ? (
                            <>
                                {userActivePlanPrices.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {userActivePlanPrices.map(price => (
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
                                ) : (
                                    <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-md mb-4 border border-yellow-100 dark:border-yellow-800">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                            Restriction Active: You must have an active plan to withdraw plan-equivalent amounts.
                                        </p>
                                        <Button size="sm" onClick={() => navigate('/member/plans')} className="mt-2">Buy a Plan</Button>
                                    </div>
                                )}
                            </>
                        ) : (
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
                        )}

                        <div className="pt-4 flex justify-end">
                            <Button 
                                onClick={() => setStep(2)} 
                                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > currentUser.walletBalance}
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
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 2: Choose Method</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Where should we send your {formatCurrency(parseFloat(amount), currentUser.currency)}?</p>
                        </div>

                        {withdrawalMethods.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {withdrawalMethods.map(method => (
                                    <div 
                                        key={method._id}
                                        onClick={() => {
                                            const numAmount = parseFloat(amount);
                                            if (numAmount < method.minAmount || numAmount > method.maxAmount) {
                                                alert(`Limit Error: This method only allows ${formatCurrency(method.minAmount, method.currency)} - ${formatCurrency(method.maxAmount, method.currency)}`);
                                                return;
                                            }
                                            setSelectedMethodId(method._id);
                                            setStep(3);
                                        }}
                                        className={`relative cursor-pointer p-5 rounded-xl border-2 transition-all duration-200 flex flex-col gap-4 bg-white dark:bg-gray-800 hover:shadow-lg group ${
                                            parseFloat(amount) < method.minAmount || parseFloat(amount) > method.maxAmount 
                                            ? 'opacity-50 border-gray-100 dark:border-gray-700 grayscale cursor-not-allowed'
                                            : 'border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500'
                                        }`}
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
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Fee: {method.feePercent}%</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-50 dark:border-gray-700">
                                            Limit: {formatCurrency(method.minAmount, method.currency)} - {formatCurrency(method.maxAmount, method.currency)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                                <p className="text-gray-500 dark:text-gray-400">No withdrawal methods available for {currentUser.currency}.</p>
                            </div>
                        )}

                        <div className="pt-6 flex justify-start">
                            <Button variant="secondary" onClick={() => setStep(1)}>
                                &larr; Back
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 3: DETAILS */}
                {step === 3 && selectedMethod && (
                    <div className="animate-fade-in space-y-6 max-w-lg mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 3: Account Details</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Provide your {selectedMethod.name} details.</p>
                        </div>

                        {/* Breakdown */}
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-600 mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-500 dark:text-gray-400">Withdraw Amount</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-500 dark:text-gray-400">Service Fee ({selectedMethod.feePercent}%)</span>
                                <span className="font-semibold text-red-500">-{formatCurrency(fee, currentUser.currency)}</span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-800 dark:text-gray-200">You Receive</span>
                                <span className="text-xl font-extrabold text-green-600 dark:text-green-400">{formatCurrency(finalAmount, currentUser.currency)}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Title</label>
                                <input 
                                    type="text" 
                                    value={accountTitle}
                                    onChange={e => setAccountTitle(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number / Wallet ID</label>
                                <input 
                                    type="text" 
                                    value={accountNumber}
                                    onChange={e => setAccountNumber(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. 03001234567"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
                                <textarea 
                                    value={userNotes}
                                    onChange={e => setUserNotes(e.target.value)}
                                    rows={2}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Any special instructions..."
                                />
                            </div>
                        </div>

                        <div className="pt-6 flex justify-between">
                            <Button variant="secondary" onClick={() => setStep(2)}>
                                &larr; Back
                            </Button>
                            <Button onClick={() => setStep(4)} disabled={!accountTitle || !accountNumber} className="px-8 shadow-lg shadow-blue-500/30">
                                Review & Confirm &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION */}
                {step === 4 && selectedMethod && (
                    <div className="animate-fade-in space-y-6 max-w-lg mx-auto">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Step 4: Confirm Withdrawal</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Please verify your details before submitting.</p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">Method</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{selectedMethod.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">Net Amount</span>
                                    <span className="font-bold text-green-600 dark:text-green-400 text-lg">{formatCurrency(finalAmount, currentUser.currency)}</span>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t dark:border-gray-700">
                                <div className="mb-2">
                                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">To Account</span>
                                    <span className="block font-medium text-gray-900 dark:text-white">{accountTitle}</span>
                                    <span className="block font-mono text-gray-600 dark:text-gray-300 tracking-wide">{accountNumber}</span>
                                </div>
                                {userNotes && (
                                    <div className="mt-3 bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs text-gray-600 dark:text-gray-300 italic">
                                        "{userNotes}"
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-6 flex justify-between items-center gap-4">
                            <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                                &larr; Back
                            </Button>
                            <Button type="submit" onClick={handleSubmit} className="flex-grow py-3 text-lg shadow-lg shadow-green-500/30 bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                                {isSubmitting ? 'Processing...' : `Submit Request`}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* WITHDRAWAL HISTORY SECTION */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Recent Withdrawals</h3>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <select 
                            value={historyStatus} 
                            onChange={(e) => setHistoryStatus(e.target.value)} 
                            className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Paid}>Paid</option>
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

                {filteredWithdrawals.length > 0 ? (
                    <Table headers={['Date', 'Method', 'Amount', 'Fee', 'Net', 'Status']}>
                        {filteredWithdrawals.map(withdrawal => (
                            <tr key={withdrawal._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="px-4 py-3 text-sm">{new Date(withdrawal.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm">{withdrawal.method}</td>
                                <td className="px-4 py-3 font-semibold">{formatCurrency(withdrawal.amount, withdrawal.currency)}</td>
                                <td className="px-4 py-3 text-sm text-red-500">-{formatCurrency(withdrawal.fee, withdrawal.currency)}</td>
                                <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">{formatCurrency(withdrawal.finalAmount, withdrawal.currency)}</td>
                                <td className="px-4 py-3"><Badge status={withdrawal.status} /></td>
                            </tr>
                        ))}
                    </Table>
                ) : (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
                        <p className="text-gray-500 dark:text-gray-400">No withdrawal history found matching the criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WithdrawFunds;
