
import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import { Status, Transaction } from '../types';
import Badge from '../components/ui/Badge';
import { adjustUserWallet } from '../services/api';

const Wallet: React.FC = () => {
    const { state, dispatch } = useData();
    const { users, transactions } = state;
    
    const [identifier, setIdentifier] = useState('');
    const [amount, setAmount] = useState('');
    const [actionType, setActionType] = useState<'credit' | 'debit'>('credit');
    const [reason, setReason] = useState('Admin manual adjustment');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const tableHeaders = ['Transaction ID', 'User', 'Type', 'Amount', 'Status', 'Date', 'Description'];

    const handleAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const targetUser = users.find(u => 
            u._id.toString() === identifier ||
            u.username.toLowerCase() === identifier.toLowerCase() ||
            u.email.toLowerCase() === identifier.toLowerCase() ||
            u.phone === identifier
        );

        if (!targetUser) {
            alert('User not found. Please check the identifier or select from the list.');
            setIsSubmitting(false);
            return;
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert('Please enter a valid, positive amount.');
            setIsSubmitting(false);
            return;
        }
        
        const adjustmentAmount = actionType === 'credit' ? numericAmount : -numericAmount;
        
        try {
            const result = await adjustUserWallet(targetUser._id, {
                amount: adjustmentAmount,
                description: reason
            });

            // Update user and add new transaction to the state
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });

            alert(`Successfully adjusted ${targetUser.username}'s balance by $${adjustmentAmount.toFixed(2)}.`);
            setIdentifier('');
            setAmount('');
            setReason('Admin manual adjustment');
        } catch (error) {
            console.error('Failed to adjust wallet:', error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not adjust wallet.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Manual Wallet Adjustment</h2>
                <form onSubmit={handleAdjustment} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label htmlFor="user-identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select User</label>
                        <div className="mt-1">
                            <input 
                              type="text" 
                              id="user-identifier" 
                              list="users-datalist"
                              value={identifier} 
                              onChange={e => setIdentifier(e.target.value)} 
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                              placeholder="Search by username, email..."
                              required 
                            />
                            <datalist id="users-datalist">
                              {users.map(user => (
                                <option key={user._id} value={user.username}>
                                    {user.fullName} ({user.email}) - Balance: ${user.walletBalance.toFixed(2)}
                                </option>
                              ))}
                            </datalist>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Search by username, email, phone, or ID.</p>
                    </div>
                    <div>
                        <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Action</label>
                        <select 
                            id="actionType" 
                            value={actionType} 
                            onChange={e => setActionType(e.target.value as 'credit' | 'debit')} 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="credit">Credit (Add)</option>
                            <option value="debit">Debit (Subtract)</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                        <input type="number" step="0.01" min="0" id="amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 50.00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                     <div>
                       <Button type="submit" className="w-full" disabled={isSubmitting}>
                           {isSubmitting ? 'Adjusting...' : 'Adjust Balance'}
                        </Button>
                    </div>
                </form>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Transaction Log</h2>
                <Table headers={tableHeaders}>
                    {sortedTransactions.map((tx: Transaction) => (
                        <tr key={tx._id} className="text-gray-700 dark:text-gray-400">
                            <td className="px-4 py-3 text-sm">{tx._id}</td>
                            <td className="px-4 py-3 text-sm">{tx.userName}</td>
                            <td className="px-4 py-3 text-sm">{tx.type}</td>
                            <td className={`px-4 py-3 text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${tx.amount.toFixed(2)}
                            </td>
                             <td className="px-4 py-3 text-xs">
                                <Badge status={tx.status as Status || Status.Approved} />
                            </td>
                            <td className="px-4 py-3 text-sm">{new Date(tx.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm">{tx.description}</td>
                        </tr>
                    ))}
                </Table>
            </div>
        </div>
    );
};

export default Wallet;
