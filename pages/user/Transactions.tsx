
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import { Status, Transaction, formatCurrency } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const transactionTypes = [
    'Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 
    'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 
    'Transfer Received', 'Transfer Request', 'Transfer Refund'
];

// Helper to determine API URL based on environment
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    return (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'http://localhost:5000/api/v1'
        : 'https://smartearning-api.onrender.com/api/v1';
};

const Transactions: React.FC = () => {
    const { state } = useData();
    const { currentUser } = state;

    // Pagination & Paged Data State
    const [pagedTransactions, setPagedTransactions] = useState<Transaction[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [isFetchingPaged, setIsFetchingPaged] = useState(false);

    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    // --- PAGINATED DATA FETCHING ---
    const fetchPagedTransactions = useCallback(async () => {
        if (!currentUser) return;
        setIsFetchingPaged(true);
        try {
            // Note: The backend typically filters by user globally if requested via this endpoint
            const url = `${getApiBaseUrl()}/transactions?page=${currentPage}&limit=${limit}`;
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                // Filter locally for current user safety, though server usually handles this context
                const userOnly = result.data.filter((t: Transaction) => t.userId === currentUser._id);
                setPagedTransactions(userOnly);
            }
        } catch (error) {
            console.error("Failed to fetch paginated transactions:", error);
        } finally {
            setIsFetchingPaged(false);
        }
    }, [currentUser, currentPage, limit]);

    useEffect(() => {
        fetchPagedTransactions();
    }, [fetchPagedTransactions]);

    const filteredUserTransactions = useMemo(() => {
        return pagedTransactions
            .filter(t => {
                if (typeFilter && t.type !== typeFilter) return false;
                
                // MASKING: Logic for filtering by status needs to handle 'Matching' being hidden
                let actualStatus = t.status || 'Approved';
                if (statusFilter === 'Pending' && actualStatus === 'Matching') return true;
                if (statusFilter && actualStatus !== statusFilter) return false;
                
                const from = dateFrom ? new Date(dateFrom) : null;
                const to = dateTo ? new Date(dateTo) : null;
                if (from) from.setHours(0, 0, 0, 0);
                if (to) to.setHours(23, 59, 59, 999);
                const itemDate = new Date(t.date);
                if (from && itemDate < from) return false;
                if (to && itemDate > to) return false;

                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [pagedTransactions, typeFilter, statusFilter, dateFrom, dateTo]);

    const tableHeaders = ['ID', 'Type', 'Amount', 'Status', 'Date', 'Description'];

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Transaction History</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                <div>
                    <label className="text-xs font-medium text-gray-500">Type</label>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-2 mt-1">
                        <option value="">All Types</option>
                        {transactionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-500">Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-2 mt-1">
                        <option value="">All Statuses</option>
                        {Object.values(Status).filter(s => s !== Status.Matching).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="text-xs font-medium text-gray-500">From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-2 mt-1" />
                </div>
                 <div>
                    <label className="text-xs font-medium text-gray-500">To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full rounded-md dark:bg-gray-700 text-sm py-2 mt-1" />
                </div>
            </div>

            {filteredUserTransactions.length > 0 || isFetchingPaged ? (
                <>
                    <Table headers={tableHeaders}>
                        {filteredUserTransactions.map((tx: Transaction) => (
                            <tr key={tx._id} className="text-gray-700 dark:text-gray-400">
                                <td className="px-4 py-3 text-sm font-mono">{tx._id.substring(0, 8)}...</td>
                                <td className="px-4 py-3 text-sm">{tx.type}</td>
                                <td className={`px-4 py-3 text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(tx.amount, tx.currency)}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                    {/* MASKING: Show 'Matching' as 'Pending' to user */}
                                    <Badge status={(tx.status as Status === Status.Matching) ? Status.Pending : (tx.status as Status || Status.Approved)} />
                                </td>
                                <td className="px-4 py-3 text-sm">{new Date(tx.date).toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm">
                                    {tx.description}
                                    {tx.type === 'Commission' && tx.level && ` (Level ${tx.level})`}
                                    {tx.originalAmount && tx.originalCurrency && (
                                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                                            (Original: {formatCurrency(tx.originalAmount, tx.originalCurrency)})
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </Table>

                    {/* SERVER-SIDE PAGINATION CONTROLS */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t dark:border-gray-700 gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Records per page:</span>
                            <select 
                                value={limit} 
                                onChange={(e) => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
                                className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1.5 focus:ring-blue-500"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1 || isFetchingPaged}
                            >
                                Previous
                            </Button>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                Page {currentPage}
                            </span>
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                disabled={pagedTransactions.length < limit || isFetchingPaged}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </>
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">You have no transactions matching the selected filters.</p>
            )}
        </div>
    );
};

export default Transactions;
