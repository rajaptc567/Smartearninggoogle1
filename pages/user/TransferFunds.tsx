
import React, { useState, useMemo } from 'react';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createTransfer } from '../../services/api';
import { User } from '../../types';

const TransferFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, users } = state;
    
    const [recipientIdentifier, setRecipientIdentifier] = useState('');
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Helper to recursively find all referrals (direct and indirect)
    const getAllReferrals = (username: string, allUsers: User[]): User[] => {
        const directReferrals = allUsers.filter(u => u.sponsor === username);
        let allRefs = [...directReferrals];
        directReferrals.forEach(ref => {
            allRefs = [...allRefs, ...getAllReferrals(ref.username, allUsers)];
        });
        return allRefs;
    };

    const myReferrals = useMemo(() => {
        if (!currentUser) return [];
        return getAllReferrals(currentUser.username, users);
    }, [currentUser, users]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        
        if (!currentUser) {
            alert('Error: Current user not found. Please log in again.');
            return;
        }
        if (!recipientIdentifier || isNaN(numericAmount) || numericAmount <= 0) {
            alert('Validation Error: Please enter a valid recipient and a positive amount.');
            return;
        }

        const recipient = users.find(u =>
            u._id.toString() === recipientIdentifier ||
            u.username.toLowerCase() === recipientIdentifier.toLowerCase() ||
            u.email.toLowerCase() === recipientIdentifier.toLowerCase()
        );

        if (!recipient) {
            alert('Validation Error: Recipient user not found. Please check the ID, username, or email.');
            return;
        }
        if (recipient._id === currentUser._id) {
            alert('Validation Error: You cannot transfer funds to yourself.');
            return;
        }

        if (numericAmount > currentUser.walletBalance) {
            alert(`Validation Error: Transfer amount ($${numericAmount.toFixed(2)}) cannot exceed your wallet balance ($${currentUser.walletBalance.toFixed(2)}).`);
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

            // The API returns the new transfer, the updated user, and the new transaction.
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
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">${currentUser.walletBalance.toFixed(2)}</p>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Transfer Funds to Another User</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recipient (ID, Username, or Email)</label>
                    <div className="mt-1 flex flex-col gap-2">
                        <input
                            type="text"
                            id="recipient"
                            value={recipientIdentifier}
                            onChange={(e) => setRecipientIdentifier(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Enter username manually..."
                            required
                        />
                        
                        {myReferrals.length > 0 && (
                            <select
                                onChange={(e) => {
                                    if(e.target.value) setRecipientIdentifier(e.target.value);
                                }}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value="" // Always reset to default option so input box shows the value
                            >
                                <option value="">-- Or Select from your Network --</option>
                                {myReferrals.map(ref => (
                                    <option key={ref._id} value={ref.username}>
                                        {ref.fullName} (@{ref.username})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">You can type any user's detail or select from your team below.</p>
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
                <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Transfer Request'}</Button>
                </div>
            </form>
        </div>
    );
}

export default TransferFunds;
