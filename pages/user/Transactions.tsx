
import React, { useState, useMemo, useEffect } from 'react';
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

const Transactions: React.FC = () => {
    const { state } = useData();
    const { currentUser, transactions } = state;

    // Filter State
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    
    if (!currentUser) {
        return <div>Loading...</div>;
    }

    const filteredUserTransactions = useMemo(() => {
        return transactions
            .filter(t => t.userId === currentUser._id)
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
    }, [transactions, currentUser._id, typeFilter, statusFilter, dateFrom, dateTo]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [typeFilter, statusFilter, dateFrom, dateTo, itemsPerPage]);

    // Pagination Logic
    const totalItems = filteredUserTransactions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUserTransactions.slice(start, start + itemsPerPage);
    }, [filteredUserTransactions, currentPage, itemsPerPage]);

    const tableHeaders = ['ID', 'Type', 'Amount', 'Status', 'Date', 'Description'];

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Transaction History</h2>
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase text-gray-400 whitespace-nowrap">Show:</label>
                    <select 
                        value={itemsPerPage} 
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm py-1 shadow-sm focus:ring-blue-500"
                    >
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>
                </div>
            </div>
            
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

            {paginatedTransactions.length > 0 ? (
                <>
                    <Table headers={tableHeaders}>
                        {paginatedTransactions.map((tx: Transaction) => (
                             <tr key={tx._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3 text-sm font-mono">{tx._id.substring(0, 8)}...</td>
                                <td className="px-4 py-3 text-sm font-bold">{tx.type}</td>
                                <td className={`px-4 py-3 text-sm font-black ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(tx.amount, tx.currency)}
                                </td>
                                 <td className="px-4 py-3 text-xs">
                                    {/* MASKING: Show 'Matching' as 'Pending' to user */}
                                    <Badge status={(tx.status as Status === Status.Matching) ? Status.Pending : (tx.status as Status || Status.Approved)} />
                                </td>
                                <td className="px-4 py-3 text-sm font-mono opacity-70">{new Date(tx.date).toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm">
                                    {tx.description}
                                    {tx.type === 'Commission' && tx.level && ` (Level ${tx.level})`}
                                    {tx.originalAmount && tx.originalCurrency && (
                                        <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mt-0.5">
                                            (Orig: {formatCurrency(tx.originalAmount, tx.originalCurrency)})
                                        </span>
                                    )}
                                </td>
                             </tr>
                        ))}
                    </Table>

                    {/* Pagination Controls */}
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
                                    // Basic sliding window for page numbers
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
                </>
            ) : (
                <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                    <div className="text-4xl mb-4 opacity-20">📂</div>
                    <p className="text-gray-500 dark:text-gray-400 font-bold">No transactions found matching the selected filters.</p>
                </div>
            )}
        </div>
    );
};

export default Transactions;
