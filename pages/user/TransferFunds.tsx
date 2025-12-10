
import React, { useState, useMemo, useEffect } from 'react';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createTransfer } from '../../services/api';
import { formatCurrency, User, currencySymbols, Currency, Transfer, Status } from '../../types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';

const TransferFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, users, settings, transfers } = state;
    
    const [recipientIdentifier, setRecipientIdentifier] = useState('');
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        const term = recipientIdentifier.toLowerCase();
        return users.find(u => u.username.toLowerCase() === term || u.email.toLowerCase() === term || u._id === recipientIdentifier);
    }, [recipientIdentifier, users]);
    
    // Debounced validation for manual recipient entry
    useEffect(() => {
        if (!isManualEntry || !recipientIdentifier.trim()) {
            setManualRecipientState({ status: 'idle', message: null });
            return;
        }

        setManualRecipientState({ status: 'loading', message: 'Verifying user...' });

        const handler = setTimeout(() => {
            const term = recipientIdentifier.toLowerCase().trim();
            const foundUser = users.find(u => u.username.toLowerCase() === term || u.email.toLowerCase() === term);

            if (foundUser) {
                if (foundUser._id === currentUser?._id) {
                     setManualRecipientState({ status: 'invalid', message: 'You cannot transfer funds to yourself.' });
                } else if (!settings.transferConfig?.allowCrossCurrency && foundUser.currency !== currentUser?.currency) {
                    setManualRecipientState({ status: 'invalid', message: `Cross-currency transfers are disabled. This user's currency is ${foundUser.currency}.` });
                } else {
                    setManualRecipientState({ status: 'valid', message: `User Found: ${foundUser.fullName} (@${foundUser.username})` });
                }
            } else {
                setManualRecipientState({ status: 'invalid', message: 'User not found. Please check the username or email.' });
            }
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [recipientIdentifier, isManualEntry, users, currentUser, settings.transferConfig]);

    // Fee calculation
    useEffect(() => {
        if (!currentUser) return;
        const val = parseFloat(amount);
        
        const config = settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [] };

        if (!config.enabled) {
            setFeeError("Transfers are currently disabled by the administrator.");
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
            setFeeError("Amount is outside the allowed transfer limits for your currency.");
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
        if (recipientUser && currentUser && recipientUser.currency !== currentUser.currency && settings.transferConfig?.allowCrossCurrency && parseFloat(amount) > 0) {
            const fromCurrency = currentUser.currency.toUpperCase();
            const toCurrency = recipientUser.currency.toUpperCase();
            
            // Standard Defaults
            const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.00 };
            const rates = settings.exchangeRates || {};
            
            const getRate = (curr: string) => {
                const r = (rates as any)[curr];
                // Treat 1 as invalid for PKR specifically, as it's the DB default but unrealistic
                if (curr === 'PKR' && (r === 1 || !r)) return defaultRates.PKR;
                if (curr === 'EUR' && (r === 0 || !r)) return defaultRates.EUR; // 0 check for EUR
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

            // Step 1: Convert amount from sender's currency to base currency (USD).
            const amountInUsd = parseFloat(amount) / fromRateToBase;

            // Step 2: Convert amount from USD to the recipient's currency.
            const finalAmount = amountInUsd * toRateToBase;
            setReceivedAmount(finalAmount);

            // Calculate the display rate for 1 unit of the sender's currency.
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
            setManualRecipientState({ status: 'idle', message: null });
        } else {
            setIsManualEntry(false);
            setRecipientIdentifier(value);
            setManualRecipientState({ status: 'idle', message: null });
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        
        if (!currentUser) return alert('Error: Current user not found.');
        if (feeError) return alert(feeError);
        if (!recipientIdentifier || isNaN(numericAmount) || numericAmount <= 0) return alert('Please enter a valid recipient and amount.');
        if (!recipientUser) return alert('Validation Error: Recipient user not found.');
        if (recipientUser._id === currentUser._id) return alert('Validation Error: You cannot transfer funds to yourself.');

        if (totalDeduction > currentUser.walletBalance) {
            alert(`Validation Error: Total deduction (${formatCurrency(totalDeduction, currentUser.currency)}) exceeds your wallet balance.`);
            return;
        }
        
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
            setRecipientIdentifier('');
            setIsManualEntry(false);
            setAmount('');
        } catch (error) {
            console.error("Failed to submit transfer:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not submit transfer request.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filtered History Logic
    const filteredHistory = useMemo(() => {
        if (!currentUser) return [];
        return transfers.filter(t => {
            const isSender = t.senderId === currentUser._id;
            const isRecipient = t.recipientId === currentUser._id;
            
            if (!isSender && !isRecipient) return false;

            // Type
            if (historyType === 'Sent' && !isSender) return false;
            if (historyType === 'Received' && !isRecipient) return false;

            // Status
            if (historyStatus && t.status !== historyStatus) return false;

            // Date
            if (historyDateFrom || historyDateTo) {
                const txDate = new Date(t.date).setHours(0,0,0,0);
                const from = historyDateFrom ? new Date(historyDateFrom).setHours(0,0,0,0) : -8640000000000000;
                const to = historyDateTo ? new Date(historyDateTo).setHours(23,59,59,999) : 8640000000000000;
                if (txDate < from || txDate > to) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transfers, currentUser, historyType, historyStatus, historyDateFrom, historyDateTo]);

    if (!currentUser) return <div>Loading...</div>;

    const showAmountForm = (!isManualEntry && recipientUser) || (isManualEntry && manualRecipientState.status === 'valid');

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Transfer Form Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-6 border-b dark:border-gray-700 pb-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Wallet Balance</p>
                        <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
                    </div>

                    {isSubmitted ? (
                        <div className="text-center animate-fade-in">
                            <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-16 w-16 flex items-center justify-center">
                                <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold mt-4 text-gray-800 dark:text-white">Transfer Request Submitted!</h2>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">Your request has been sent and is now pending admin approval.</p>
                            <Button onClick={() => setIsSubmitted(false)} className="mt-6">Make Another Transfer</Button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Transfer Funds</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="recipient-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recipient</label>
                                    <select
                                        id="recipient-select"
                                        value={isManualEntry ? 'manual' : recipientIdentifier}
                                        onChange={handleDropdownChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="">-- Select from your network --</option>
                                        {availableRecipients.map(({ user, level }) => (
                                            <option key={user._id} value={user.username}>
                                                {user.fullName} (@{user.username}) - {user.currency} (Level {level})
                                            </option>
                                        ))}
                                        <option value="manual">-- Other (Enter Manually) --</option>
                                    </select>
                                </div>
                                
                                {isManualEntry && (
                                    <div className="animate-fade-in">
                                        <label htmlFor="manual-recipient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter Recipient's Username or Email</label>
                                        <input
                                            type="text"
                                            id="manual-recipient"
                                            value={recipientIdentifier}
                                            onChange={(e) => setRecipientIdentifier(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="e.g., jane.doe or jane.doe@example.com"
                                            autoComplete="off"
                                        />
                                        <div className="mt-2 text-xs h-4">
                                            {manualRecipientState.status === 'loading' && <p className="text-gray-500">{manualRecipientState.message}</p>}
                                            {manualRecipientState.status === 'invalid' && <p className="text-red-500 font-semibold">{manualRecipientState.message}</p>}
                                            {manualRecipientState.status === 'valid' && <p className="text-green-600 font-semibold">{manualRecipientState.message}</p>}
                                        </div>
                                    </div>
                                )}
                                
                                {showAmountForm && (
                                    <div className="space-y-4 mt-4 pt-4 border-t dark:border-gray-700 animate-fade-in">
                                        {recipientUser && recipientUser.currency !== currentUser.currency && settings.transferConfig?.allowCrossCurrency && (
                                            <div className="p-3 text-sm text-blue-700 bg-blue-100 rounded-md dark:bg-blue-900/50 dark:text-blue-300">
                                                Recipient is registered under another currency ({recipientUser.currency}). Exchange rates will apply to this transfer.
                                            </div>
                                        )}
                                        <div>
                                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount to Transfer</label>
                                            <div className="relative mt-1">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                    <span className="text-gray-500 sm:text-sm">{currencySymbols[currentUser.currency]}</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    id="amount"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className="block w-full rounded-md border-gray-300 pl-7 pr-12 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                    required
                                                />
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                                    <span className="text-gray-500 dark:text-gray-400 sm:text-sm">{currentUser.currency}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {amount && currentUser && (
                                            <div className={`p-4 rounded-lg border ${feeError ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-700/30 dark:border-gray-600'}`}>
                                                {feeError ? ( <p className="text-sm text-red-600 dark:text-red-400">{feeError}</p> ) : (
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Transfer Amount:</span><span className="font-medium">{formatCurrency(parseFloat(amount) || 0, currentUser.currency)}</span></div>
                                                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Processing Fee:</span><span className="font-medium text-red-500">+{formatCurrency(fee, currentUser.currency)}</span></div>
                                                        <div className="flex justify-between pt-2 border-t dark:border-gray-600 font-bold"><span className="text-gray-800 dark:text-gray-200">Total Deducted:</span><span className="text-green-600 dark:text-green-400">{formatCurrency(totalDeduction, currentUser.currency)}</span></div>
                                                        {recipientUser && recipientUser.currency !== currentUser.currency && settings.transferConfig?.allowCrossCurrency && exchangeRate !== null && receivedAmount !== null && (
                                                            <>
                                                                <div className="flex justify-between pt-2 border-t dark:border-gray-600 text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-400">Exchange Rate:</span>
                                                                    <span className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">1 {currentUser.currency} = {exchangeRate.toFixed(4)} {recipientUser.currency}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-lg mt-1"><span className="text-gray-800 dark:text-gray-200">Recipient Receives:</span><span className="text-green-600 dark:text-green-400">≈ {formatCurrency(receivedAmount, recipientUser.currency)}</span></div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="pt-4 flex justify-end">
                                            <Button type="submit" disabled={isSubmitting || !!feeError || !amount}>{isSubmitting ? 'Submitting...' : 'Submit Transfer Request'}</Button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* Transfer History Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">Transfer History</h3>
                
                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                        <select 
                            value={historyType} 
                            onChange={(e) => setHistoryType(e.target.value as any)} 
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                        >
                            <option value="All">All</option>
                            <option value="Sent">Sent</option>
                            <option value="Received">Received</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <select 
                            value={historyStatus} 
                            onChange={(e) => setHistoryStatus(e.target.value)} 
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                        >
                            <option value="">All Statuses</option>
                            {Object.values(Status).filter(s => s !== Status.Matching).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                        <input 
                            type="date" 
                            value={historyDateFrom} 
                            onChange={(e) => setHistoryDateFrom(e.target.value)} 
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                        <input 
                            type="date" 
                            value={historyDateTo} 
                            onChange={(e) => setHistoryDateTo(e.target.value)} 
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" 
                        />
                    </div>
                </div>

                {/* Table */}
                {filteredHistory.length > 0 ? (
                    <Table headers={['Date', 'Type', 'Counterparty', 'Amount', 'Fee', 'Status']}>
                        {filteredHistory.map(transfer => {
                            const isSender = transfer.senderId === currentUser._id;
                            const counterpartyName = isSender ? transfer.recipientName : transfer.senderName;
                            const directionLabel = isSender ? 'Sent' : 'Received';
                            const amountColor = isSender ? 'text-red-600' : 'text-green-600';
                            const amountPrefix = isSender ? '-' : '+';

                            return (
                                <tr key={transfer._id} className="text-gray-700 dark:text-gray-400">
                                    <td className="px-4 py-3 text-sm">{new Date(transfer.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${isSender ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                            {directionLabel}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium">{counterpartyName}</td>
                                    <td className={`px-4 py-3 font-mono font-bold ${amountColor} text-sm`}>
                                        {amountPrefix}{formatCurrency(transfer.amount, transfer.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                        {isSender && transfer.fee && transfer.fee > 0 ? formatCurrency(transfer.fee, transfer.currency) : '-'}
                                    </td>
                                    <td className="px-4 py-3"><Badge status={transfer.status as Status} /></td>
                                </tr>
                            )
                        })}
                    </Table>
                ) : (
                    <p className="text-center text-gray-500 py-8 italic">No transfer history found matching filters.</p>
                )}
            </div>
        </div>
    );
};

export default TransferFunds;
