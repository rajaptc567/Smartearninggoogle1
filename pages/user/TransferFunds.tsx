
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createTransfer } from '../../services/api';
import { formatCurrency, User, currencySymbols, Currency, Transfer, Status } from '../../types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

// Helper to determine API URL
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    return (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'http://localhost:5000/api/v1'
        : 'https://smartearning-api.onrender.com/api/v1';
};

const ShieldExclamationIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const TransferFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, settings } = state;
    const navigate = useNavigate();

    const [recipientId, setRecipientId] = useState('');
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // --- PAGINATION STATE ---
    const [pagedHistory, setPagedHistory] = useState<Transfer[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [isFetchingPaged, setIsFetchingPaged] = useState(false);

    const fetchPagedHistory = useCallback(async () => {
        if (!currentUser) return;
        setIsFetchingPaged(true);
        try {
            const url = `${getApiBaseUrl()}/transfers?page=${currentPage}&limit=${limit}`;
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                const userOnly = result.data.filter((t: Transfer) => t.senderId === currentUser._id || t.recipientId === currentUser._id);
                setPagedHistory(userOnly);
            }
        } catch (error) {
            console.error("Failed to fetch transfers:", error);
        } finally {
            setIsFetchingPaged(false);
        }
    }, [currentUser, currentPage, limit]);

    useEffect(() => {
        fetchPagedHistory();
    }, [fetchPagedHistory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipientId || !amount || !currentUser) return;
        
        setIsSubmitting(true);
        try {
            const result = await createTransfer({
                senderId: currentUser._id,
                recipientId,
                amount: parseFloat(amount)
            });
            dispatch({ type: 'ADD_TRANSFER', payload: result.transfer });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            alert('Transfer request submitted successfully!');
            setRecipientId('');
            setAmount('');
            fetchPagedHistory(); // Refresh current page
        } catch (error) {
            alert(`Error: ${error instanceof Error ? error.message : 'Transfer failed'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentUser) return null;
    
    if (currentUser.restrictions?.transfer || !settings.isUserTransferEnabled) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <ShieldExclamationIcon />
                <h2 className="text-2xl font-bold mt-4">Transfers Restricted</h2>
                <p className="text-gray-500 mt-2">Internal fund transfers are currently disabled for your account.</p>
                <Button variant="secondary" className="mt-6" onClick={() => navigate('/member')}>Back to Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-16">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Transfer Funds</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">Recipient ID / Username</label>
                        <input value={recipientId} onChange={e => setRecipientId(e.target.value)} className="w-full p-3 rounded-xl dark:bg-gray-900 border dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="User ID or Username" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Amount</label>
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 rounded-xl dark:bg-gray-900 border dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" required />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-xl shadow-lg shadow-blue-500/20">{isSubmitting ? 'Processing...' : 'Authorize Transfer'}</Button>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transfer History</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Show</span>
                        <select value={limit} onChange={e => {setLimit(Number(e.target.value)); setCurrentPage(1);}} className="text-xs rounded border-gray-300 dark:bg-gray-700">
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                <Table headers={['Date', 'Type', 'Target', 'Amount', 'Status']}>
                    {pagedHistory.map(t => {
                        const isSender = t.senderId === currentUser._id;
                        return (
                            <tr key={t._id} className="text-gray-700 dark:text-gray-400">
                                <td className="px-4 py-4 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                                <td className="px-4 py-4 text-sm">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSender ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {isSender ? 'Sent' : 'Received'}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-sm font-medium">{isSender ? t.recipientName : t.senderName}</td>
                                <td className={`px-4 py-4 font-black ${isSender ? 'text-red-500' : 'text-green-500'}`}>
                                    {isSender ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                                </td>
                                <td className="px-4 py-4"><Badge status={t.status as Status} /></td>
                            </tr>
                        );
                    })}
                </Table>
                
                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t dark:border-gray-700">
                    <span className="text-sm text-gray-500">Page {currentPage}</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled={currentPage === 1 || isFetchingPaged} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                        <Button size="sm" variant="secondary" disabled={pagedHistory.length < limit || isFetchingPaged} onClick={() => setCurrentPage(p => p + 1)}>Next Page</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransferFunds;
