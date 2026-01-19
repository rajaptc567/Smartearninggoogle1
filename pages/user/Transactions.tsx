
import React, { useState, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import { Status, Transaction, formatCurrency } from '../../types';
import Badge from '../../components/ui/Badge';

const transactionTypes = [
    'Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 
    'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 
    'Transfer Received', 'Transfer Request', 'Transfer Refund'
];

const Transactions: React.FC = () => {
    const { state } = useData();
    const { currentUser, transactions } = state;

    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
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

    const tableHeaders = ['ID', 'Type', 'Amount', 'Status', 'Date', 'Description'];

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

            {filteredUserTransactions.length > 0 ? (
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
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">You have no transactions matching the selected filters.</p>
            )}
        </div>
    );
};

export default Transactions;
