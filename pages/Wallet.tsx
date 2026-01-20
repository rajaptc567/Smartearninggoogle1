import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useData } from '../hooks/useData';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import { Status, Transaction, User, formatCurrency, currencySymbols, Currency } from '../types';
import Badge from '../components/ui/Badge';
import { adjustUserWallet } from '../services/api';

const transactionTypes = [
    'Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 
    'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 
    'Transfer Received', 'Transfer Request', 'Transfer Refund'
];

const Wallet: React.FC = () => {
    const { state, dispatch } = useData();
    const { users, transactions } = state;
    
    // --- Manual Adjustment Form State ---
    const [identifier, setIdentifier] = useState('');
    const [amount, setAmount] = useState('');
    const [actionType, setActionType] = useState<'credit' | 'debit'>('credit');
    const [reason, setReason] = useState('Admin manual adjustment');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Dropdown state for user search
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // --- Transaction Log Filter & Pagination State ---
    const [txSearchTerm, setTxSearchTerm] = useState('');
    const [txTypeFilter, setTxTypeFilter] = useState('');
    const [txStatusFilter, setTxStatusFilter] = useState('');
    const [txCurrencyFilter, setTxCurrencyFilter] = useState<Currency | ''>('PKR');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const tableHeaders = ['Transaction ID', 'User', 'Type', 'Amount', 'Status', 'Date', 'Description'];

    // Handle click outside to close user dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter logic for manual adjustment form (searching users)
    const filteredUsersForForm = users.filter(user => {
        if (!identifier) return true;
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
        if (value === '') {
            setSelectedUser(null);
        }
    };

    const handleAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
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

    // --- Transaction Log Logic ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const matchesSearch = 
                tx._id.toLowerCase().includes(txSearchTerm.toLowerCase()) ||
                tx.userName.toLowerCase().includes(txSearchTerm.toLowerCase()) ||
                tx.description.toLowerCase().includes(txSearchTerm.toLowerCase());
            
            const matchesType = txTypeFilter ? tx.type === txTypeFilter : true;
            const matchesStatus = txStatusFilter ? tx.status === txStatusFilter : true;
            const matchesCurrency = txCurrencyFilter ? tx.currency?.toUpperCase() === txCurrencyFilter : true;

            return matchesSearch && matchesType && matchesStatus && matchesCurrency;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, txSearchTerm, txTypeFilter, txStatusFilter, txCurrencyFilter]);

    // Reset pagination on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [txSearchTerm, txTypeFilter, txStatusFilter, txCurrencyFilter, itemsPerPage]);

    const totalItems = filteredTransactions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage, itemsPerPage]);

    return (
        <div className="space-y-6">
            {/* Manual Adjustment Form */}
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
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2" 
                              placeholder="Search name, username, email..."
                              autoComplete="off"
                              required 
                            />
                            {isDropdownOpen && (
                                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                    {filteredUsersForForm.length > 0 ? (
                                        filteredUsersForForm.map(user => (
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
                    </div>
                    <div>
                        <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Action</label>
                        <select 
                            id="actionType" 
                            value={actionType} 
                            onChange={e => setActionType(e.target.value as 'credit' | 'debit')} 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
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
                                className="block w-full rounded-md border-gray-300 pl-7 pr-12 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white py-2" 
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
            
            {/* Transaction Log Section with Filters and Pagination */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Transaction Log</h2>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                        <div className="flex items-center gap-2 mr-2">
                            <label className="text-xs font-bold uppercase text-gray-400 whitespace-nowrap">Show:</label>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm py-1 shadow-sm focus:ring-blue-500"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <select 
                            value={txTypeFilter}
                            onChange={(e) => setTxTypeFilter(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        >
                            <option value="">All Types</option>
                            {transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select 
                            value={txStatusFilter}
                            onChange={(e) => setTxStatusFilter(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        >
                            <option value="">All Status</option>
                            <option value="Approved">Approved</option>
                            <option value="Pending">Pending</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                         <select
                            value={txCurrencyFilter}
                            onChange={(e) => setTxCurrencyFilter(e.target.value as Currency | '')}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        >
                            <option value="">All Currencies</option>
                            <option value="PKR">PKR</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                        </select>
                        <input 
                            type="text" 
                            placeholder="Search user, ID, description..." 
                            value={txSearchTerm}
                            onChange={(e) => setTxSearchTerm(e.target.value)}
                            className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <Table headers={tableHeaders}>
                        {paginatedTransactions.map((tx: Transaction) => (
                            <tr key={tx._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3 text-sm font-mono text-xs">{tx._id.substring(0, 8)}...</td>
                                <td className="px-4 py-3 text-sm">{tx.userName}</td>
                                <td className="px-4 py-3 text-sm">{tx.type}</td>
                                <td className={`px-4 py-3 text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(tx.amount, tx.currency)}
                                </td>
                                 <td className="px-4 py-3 text-xs">
                                    <Badge status={tx.status as Status || Status.Approved} />
                                </td>
                                <td className="px-4 py-3 text-sm">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm max-w-xs truncate" title={tx.description}>{tx.description}</td>
                            </tr>
                        ))}
                    </Table>

                    {/* Pagination Footer */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 border-t dark:border-gray-700 pt-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Showing <span className="font-bold text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalItems}</span> transactions
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="rounded-xl px-4"
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
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                                currentPage === pageNum 
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                                className="rounded-xl px-4"
                            >
                                Next &rarr;
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Wallet;