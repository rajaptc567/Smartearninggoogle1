
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../hooks/useData';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import { Status, Transaction, User, formatCurrency, currencySymbols } from '../types';
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
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const tableHeaders = ['Transaction ID', 'User', 'Type', 'Amount', 'Status', 'Date', 'Description'];

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredUsers = users.filter(user => {
        if (!identifier) return true; // Show all if input is empty
        const term = identifier.toLowerCase();
        return (
            user.username.toLowerCase().includes(term) ||
            user.fullName.toLowerCase().includes(term) ||
            user.email.toLowerCase().includes(term) ||
            user.phone.includes(term)
        );
    });

    const handleSelectUser = (user: User) => {
        setIdentifier(user.username);
        setSelectedUser(user);
        setIsDropdownOpen(false);
    };

    const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setIdentifier(value);
        setIsDropdownOpen(true);
        // If user clears the input, clear the selected user and their currency
        if (value === '') {
            setSelectedUser(null);
        }
    };

    const handleAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        // Use the selectedUser if available, otherwise find by identifier
        const targetUser = selectedUser || users.find(u => 
            u._id.toString() === identifier ||
            u.username.toLowerCase() === identifier.toLowerCase() ||
            u.email.toLowerCase() === identifier.toLowerCase() ||
            u.phone === identifier
        );

        if (!targetUser) {
            alert('User not found. Please select a user from the list.');
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

            alert(`Successfully adjusted ${targetUser.username}'s balance by ${formatCurrency(adjustmentAmount, targetUser.currency)}.`);
            setIdentifier('');
            setAmount('');
            setReason('Admin manual adjustment');
            setSelectedUser(null);
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
                <form onSubmit={handleAdjustment} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                    <div className="md:col-span-2 relative" ref={dropdownRef}>
                        <label htmlFor="user-identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select User</label>
                        <div className="mt-1 relative">
                            <input 
                              type="text" 
                              id="user-identifier" 
                              value={identifier} 
                              onChange={handleIdentifierChange}
                              onFocus={() => setIsDropdownOpen(true)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                              placeholder="Search name, username, email..."
                              autoComplete="off"
                              required 
                            />
                            {isDropdownOpen && (
                                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <div
                                                key={user._id}
                                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-0"
                                                onClick={() => handleSelectUser(user)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {user.fullName} <span className="text-gray-500 dark:text-gray-400 font-normal">(@{user.username})</span>
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                                                        <span>{user.email}</span>
                                                        <span className={`font-bold ${user.walletBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {formatCurrency(user.walletBalance, user.currency)}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="cursor-default select-none relative py-2 pl-3 pr-9 text-gray-500">
                                            No users found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Type to search or click to see all users.</p>
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
                        <div className="relative mt-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">
                                    {selectedUser ? currencySymbols[selectedUser.currency] : '$'}
                                </span>
                            </div>
                            <input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                id="amount" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                placeholder="50.00" 
                                className="block w-full rounded-md border-gray-300 pl-7 pr-12 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                required 
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">
                                    {selectedUser?.currency || '...'}
                                </span>
                            </div>
                        </div>
                    </div>
                     <div className="pt-6">
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
                            <td className="px-4 py-3 text-sm font-mono text-xs">{tx._id}</td>
                            <td className="px-4 py-3 text-sm">{tx.userName}</td>
                            <td className="px-4 py-3 text-sm">{tx.type}</td>
                            <td className={`px-4 py-3 text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(tx.amount, tx.currency)}
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
