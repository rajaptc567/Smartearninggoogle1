
import React, { useState, useMemo } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Table from '../components/ui/Table';
import { Status, User } from '../types';
import Badge from '../components/ui/Badge';

type ReportType = 'deposits' | 'withdrawals' | 'users' | 'commissions' | 'transfers' | 'all_transactions';

const reportConfigs: { [key in ReportType]: { label: string; key: keyof any }[] } = {
    deposits: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Amount', key: 'amount' }, { label: 'Method', key: 'method' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, { label: 'Transaction ID', key: 'transactionId' }, ],
    withdrawals: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Amount', key: 'amount' }, { label: 'Final Amount', key: 'finalAmount' }, { label: 'Method', key: 'method' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, ],
    transfers: [ { label: 'ID', key: '_id' }, { label: 'Sender', key: 'senderName' }, { label: 'Recipient', key: 'recipientName' }, { label: 'Amount', key: 'amount' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, ],
    users: [ { label: 'ID', key: '_id' }, { label: 'Username', key: 'username' }, { label: 'Full Name', key: 'fullName' }, { label: 'Email', key: 'email' }, { label: 'Active Plan', key: 'activePlan' }, { label: 'Status', key: 'status' }, { label: 'Registration Date', key: 'registrationDate' }, ],
    commissions: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Amount', key: 'amount' }, { label: 'Level', key: 'level' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, { label: 'Description', key: 'description' }, ],
    all_transactions: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Type', key: 'type' }, { label: 'Amount', key: 'amount' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, { label: 'Description', key: 'description' }, ],
};

const Reports: React.FC = () => {
    const { state } = useData();
    const { users, transactions, deposits, withdrawals, transfers } = state;
    
    const [activeTab, setActiveTab] = useState<'general' | 'dossier'>('general');

    // General Report State
    const [reportType, setReportType] = useState<ReportType>('all_transactions');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [keyword, setKeyword] = useState('');
    const [generatedData, setGeneratedData] = useState<any[]>([]);
    const [showReport, setShowReport] = useState(false);

    // Dossier State
    const [dossierUserId, setDossierUserId] = useState('');
    
    const handleGenerateReport = (e: React.FormEvent) => {
        e.preventDefault();
        setShowReport(true);
        let data: any[] = [];
        
        switch (reportType) {
            case 'deposits': data = deposits; break;
            case 'withdrawals': data = withdrawals; break;
            case 'transfers': data = transfers; break;
            case 'users': data = users; break;
            case 'commissions': data = transactions.filter(t => t.type === 'Commission'); break;
            case 'all_transactions': data = transactions; break;
        }

        const filteredData = data.filter(item => {
            // Date Filter
            const from = dateFrom ? new Date(dateFrom) : null;
            const to = dateTo ? new Date(dateTo) : null;
            if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);
            const itemDate = new Date('registrationDate' in item ? item.registrationDate : item.date);
            if (from && itemDate < from) return false;
            if (to && itemDate > to) return false;

            // Status Filter
            if (statusFilter && item.status && item.status !== statusFilter) return false;

            // Amount Filter
            if (item.amount) {
                const numericMin = parseFloat(minAmount);
                const numericMax = parseFloat(maxAmount);
                if (!isNaN(numericMin) && item.amount < numericMin) return false;
                if (!isNaN(numericMax) && item.amount > numericMax) return false;
            }

            // Keyword Filter
            if (keyword) {
                const term = keyword.toLowerCase();
                const searchableFields = ['_id', 'userName', 'fullName', 'email', 'method', 'transactionId', 'description', 'senderName', 'recipientName', 'username'];
                const found = searchableFields.some(field => 
                    item[field] && item[field].toString().toLowerCase().includes(term)
                );
                if (!found) return false;
            }

            return true;
        });
        
        setGeneratedData(filteredData);
    };

    const downloadCSV = () => {
        if (generatedData.length === 0) return;
        const config = reportConfigs[reportType];
        const headers = config.map(c => c.label);
        const csvContent = [ headers.join(','), ...generatedData.map(row => config.map(c => {
            let val = row[c.key as keyof typeof row];
            // Format array/object fields nicely
            if (c.key === 'activePlan' && Array.isArray(row.activePlans)) {
                 val = row.activePlans.map((p: any) => p.planName).join(' | ');
            }
            return JSON.stringify(val ?? 'N/A');
        }).join(',')) ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadDossier = () => {
        if (!dossierUserId) return;
        const user = users.find(u => u.username === dossierUserId || u._id === dossierUserId);
        if (!user) return alert('User not found');

        // 1. Prepare Data
        const userTx = transactions.filter(t => t.userId === user._id);
        
        // 2. Construct CSV
        const rows = [];
        
        // SECTION 1: PROFILE
        rows.push(['--- USER PROFILE ---']);
        rows.push(['User ID', user._id]);
        rows.push(['Full Name', user.fullName]);
        rows.push(['Username', user.username]);
        rows.push(['Email', user.email]);
        rows.push(['Phone', user.phone]);
        rows.push(['Sponsor', user.sponsor || 'N/A']);
        rows.push(['Status', user.status]);
        rows.push(['Wallet Balance', `$${user.walletBalance.toFixed(2)}`]);
        rows.push(['Registration Date', new Date(user.registrationDate).toLocaleString()]);
        rows.push([]); // Spacer

        // SECTION 2: PLANS
        rows.push(['--- ACTIVE PLANS ---']);
        if (user.activePlans && user.activePlans.length > 0) {
            rows.push(['Plan Name', 'Price', 'Purchase Date']);
            user.activePlans.forEach(p => {
                rows.push([p.planName, `$${p.price}`, new Date(p.purchaseDate).toLocaleDateString()]);
            });
        } else {
            rows.push(['No active plans']);
        }
        rows.push([]); // Spacer

        // SECTION 3: ACTIVITY LOG
        rows.push(['--- ACTIVITY LOG ---']);
        rows.push(['Date', 'Type', 'Amount', 'Status', 'Description/Details']);
        userTx.forEach(tx => {
            rows.push([
                new Date(tx.date).toLocaleString(),
                tx.type,
                `$${tx.amount.toFixed(2)}`,
                tx.status || 'N/A',
                tx.description
            ]);
        });

        const csvContent = rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Dossier_${user.username}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const reportHeaders = useMemo(() => reportConfigs[reportType].map(c => c.label), [reportType]);
    const hasStatusField = ['deposits', 'withdrawals', 'users', 'transfers', 'commissions', 'all_transactions'].includes(reportType);
    const hasAmountField = ['deposits', 'withdrawals', 'transfers', 'commissions', 'all_transactions'].includes(reportType);
    
    return (
        <div className="space-y-6">
            <div className="flex space-x-4 border-b dark:border-gray-700">
                <button
                    className={`py-2 px-4 font-medium focus:outline-none ${activeTab === 'general' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('general')}
                >
                    General System Reports
                </button>
                <button
                    className={`py-2 px-4 font-medium focus:outline-none ${activeTab === 'dossier' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('dossier')}
                >
                    Single User Dossier
                </button>
            </div>

            {activeTab === 'general' && (
                <>
                    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Generate Reports</h2>
                        <form onSubmit={handleGenerateReport} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Report Type</label>
                                    <select value={reportType} onChange={(e) => { setReportType(e.target.value as ReportType); setShowReport(false); }} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                        <option value="all_transactions">All Transactions</option>
                                        <option value="deposits">Deposits</option>
                                        <option value="withdrawals">Withdrawals</option>
                                        <option value="transfers">User Transfers</option>
                                        <option value="users">New Users</option>
                                        <option value="commissions">Commissions</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Date From</label>
                                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Date To</label>
                                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                                {hasStatusField && (
                                <div>
                                    <label className="block text-sm font-medium">Status</label>
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                        <option value="">All</option>
                                        {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                )}
                                {hasAmountField && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium">Min Amount</label>
                                        <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0.00" className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Max Amount</label>
                                        <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="1000.00" className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                </>
                                )}
                                <div className="md:col-span-2">
                                   <label className="block text-sm font-medium">Keyword Search</label>
                                   <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search by ID, name, email, description..." className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                            </div>
                            <div className="pt-2 text-right">
                              <Button type="submit">Generate Report</Button>
                            </div>
                        </form>
                    </div>

                    {showReport && (
                         <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Report Results ({generatedData.length} records)</h2>
                                <Button onClick={downloadCSV} disabled={generatedData.length === 0}>Export CSV</Button>
                            </div>
                            {generatedData.length > 0 ? (
                                <Table headers={reportHeaders}>
                                    {generatedData.map((row, index) => (
                                        <tr key={row._id || index} className="text-gray-700 dark:text-gray-400">
                                            {reportConfigs[reportType].map(col => (
                                                <td key={String(col.key)} className="px-4 py-3 text-sm">
                                                    {col.key === 'status' && row[col.key as keyof typeof row] ? 
                                                        <Badge status={row[col.key as keyof typeof row] as Status} /> : 
                                                        String(row[col.key as keyof typeof row] ?? 'N/A')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </Table>
                            ) : <p>No data found for the selected criteria.</p>}
                         </div>
                    )}
                </>
            )}

            {activeTab === 'dossier' && (
                <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Single User Dossier</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Generate a comprehensive file containing a specific user's entire history: Profile, Plans, Deposits, Withdrawals, Transfers, and all Transactions.
                    </p>
                    
                    <div className="max-w-xl space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Select User (Search by Username, Name, Email)</label>
                            <input 
                                list="users-dossier-list" 
                                type="text" 
                                value={dossierUserId}
                                onChange={(e) => setDossierUserId(e.target.value)}
                                placeholder="Start typing to search..."
                                className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600"
                            />
                            <datalist id="users-dossier-list">
                                {users.map(u => (
                                    <option key={u._id} value={u.username}>{u.fullName} ({u.email})</option>
                                ))}
                            </datalist>
                        </div>
                        
                        {dossierUserId && (
                            <div className="pt-2">
                                <Button onClick={downloadDossier}>Download Master Dossier</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
