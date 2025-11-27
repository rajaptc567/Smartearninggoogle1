
import React, { useState, useMemo, useEffect } from 'react';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createTransfer } from '../../services/api';
import { formatCurrency } from '../../types';

const TransferFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, users, settings } = state;
    
    const [recipientIdentifier, setRecipientIdentifier] = useState('');
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const [fee, setFee] = useState(0);
    const [totalDeduction, setTotalDeduction] = useState(0);
    const [feeError, setFeeError] = useState<string | null>(null);

    // Get all users except current user for the dropdown list
    const availableRecipients = useMemo(() => {
        if (!currentUser) return [];
        return users.filter(u => u._id !== currentUser._id);
    }, [currentUser, users]);

    // Calculate Fee Logic
    useEffect(() => {
        if (!currentUser) return;
        const val = parseFloat(amount);
        
        // Handle Global Config
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

        // Find Tier, now also matching currency
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
            let calculatedFee = 0;
            if (tier.feeType === 'percentage') {
                calculatedFee = (val * tier.feeValue) / 100;
            } else {
                calculatedFee = tier.feeValue;
            }
            setFee(calculatedFee);
            setTotalDeduction(val + calculatedFee);
            setFeeError(null);
        }

    }, [amount, settings, currentUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        
        if (!currentUser) return alert('Error: Current user not found.');
        if (feeError) return alert(feeError);
        if (!recipientIdentifier || isNaN(numericAmount) || numericAmount <= 0) return alert('Please enter a valid recipient and amount.');

        const recipient = users.find(u =>
            u._id.toString() === recipientIdentifier ||
            u.username.toLowerCase() === recipientIdentifier.toLowerCase() ||
            u.email.toLowerCase() === recipientIdentifier.toLowerCase()
        );

        if (!recipient) return alert('Validation Error: Recipient user not found.');
        if (recipient._id === currentUser._id) return alert('Validation Error: You cannot transfer funds to yourself.');

        if (totalDeduction > currentUser.walletBalance) {
            alert(`Validation Error: Total deduction (${formatCurrency(totalDeduction, currentUser.currency)}) exceeds your wallet balance.`);
            return;
        }
        
        setIsSubmitting(true);
        try {
            const result = await createTransfer({
                senderId: currentUser._id,
                senderName: currentUser.username,
                recipientId: recipient._id,
                recipientName: recipient.username,
                amount: numericAmount,
            });

            dispatch({ type: 'ADD_TRANSFER', payload: result.transfer });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });

            setIsSubmitted(true);
            setRecipientIdentifier('');
            setAmount('');
        } catch (error) {
            console.error("Failed to submit transfer:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not submit transfer request.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentUser) return <div>Loading...</div>;

    if (isSubmitted) {
        return (
             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
                 <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-16 w-16 flex items-center justify-center">
                    <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold mt-4 text-gray-800 dark:text-white">Transfer Request Submitted!</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Your request has been sent and is now pending admin approval.</p>
                <Button onClick={() => setIsSubmitted(false)} className="mt-6">Make Another Transfer</Button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-w-2xl mx-auto">
            <div className="text-center mb-6 border-b dark:border-gray-700 pb-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Wallet Balance</p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Transfer Funds</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recipient (Username, Email, or ID)</label>
                    <div className="mt-1">
                        <input
                            type="text"
                            id="recipient"
                            list="recipient-list"
                            value={recipientIdentifier}
                            onChange={(e) => setRecipientIdentifier(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Type to search username..."
                            required
                        />
                        <datalist id="recipient-list">
                            {availableRecipients.map(user => (
                                <option key={user._id} value={user.username}>
                                    {user.fullName} ({user.email})
                                </option>
                            ))}
                        </datalist>
                    </div>
                </div>
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount to Transfer</label>
                    <input
                        type="number"
                        id="amount"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                    />
                </div>

                {/* Calculation Details */}
                {amount && currentUser && (
                    <div className={`p-4 rounded-lg border ${feeError ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-700/30 dark:border-gray-600'}`}>
                        {feeError ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{feeError}</p>
                        ) : (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Transfer Amount:</span>
                                    <span className="font-medium">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Processing Fee:</span>
                                    <span className="font-medium text-red-500">+{formatCurrency(fee, currentUser.currency)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t dark:border-gray-600 font-bold">
                                    <span className="text-gray-800 dark:text-gray-200">Total Deducted:</span>
                                    <span className="text-green-600 dark:text-green-400">{formatCurrency(totalDeduction, currentUser.currency)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isSubmitting || !!feeError}>{isSubmitting ? 'Submitting...' : 'Submit Transfer Request'}</Button>
                </div>
            </form>
        </div>
    );
}

export default TransferFunds;