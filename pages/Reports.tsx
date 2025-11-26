
import React, { useState, useMemo } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Table from '../components/ui/Table';
import { Status, User, Transaction, Deposit, formatCurrency, Currency } from '../types';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { getUploadsBaseUrl } from '../services/api';

type ReportType = 'deposits' | 'withdrawals' | 'users' | 'commissions' | 'transfers' | 'all_transactions';

const reportConfigs: { [key in ReportType]: { label: string; key: keyof any, isCurrency?: boolean }[] } = {
    deposits: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Amount', key: 'amount', isCurrency: true }, { label: 'Method', key: 'method' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, { label: 'Transaction ID', key: 'transactionId' }, ],
    withdrawals: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Amount', key: 'amount', isCurrency: true }, { label: 'Final Amount', key: 'finalAmount', isCurrency: true }, { label: 'Method', key: 'method' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, ],
    transfers: [ { label: 'ID', key: '_id' }, { label: 'Sender', key: 'senderName' }, { label: 'Recipient', key: 'recipientName' }, { label: 'Amount', key: 'amount', isCurrency: true }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, ],
    users: [ { label: 'ID', key: '_id' }, { label: 'Username', key: 'username' }, { label: 'Full Name', key: 'fullName' }, { label: 'Email', key: 'email' }, { label: 'Wallet Balance', key: 'walletBalance', isCurrency: true }, { label: 'Active Plan', key: 'activePlan' }, { label: 'Status', key: 'status' }, { label: 'Registration Date', key: 'registrationDate' }, ],
    commissions: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Amount', key: 'amount', isCurrency: true }, { label: 'Level', key: 'level' }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, { label: 'Description', key: 'description' }, ],
    all_transactions: [ { label: 'ID', key: '_id' }, { label: 'User Name', key: 'userName' }, { label: 'Type', key: 'type' }, { label: 'Amount', key: 'amount', isCurrency: true }, { label: 'Status', key: 'status' }, { label: 'Date', key: 'date' }, { label: 'Description', key: 'description' }, ],
};

const Reports: React.FC = () => {
    const { state } = useData();
    const { users, transactions, deposits, withdrawals, transfers } = state;
    const UPLOADS_URL = getUploadsBaseUrl();
    
    const [activeTab, setActiveTab] = useState<'general' | 'dossier'>('general');

    // General Report State
    const [reportType, setReportType] = useState<ReportType>('all_transactions');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [keyword, setKeyword] = useState('');
    const [generatedData, setGeneratedData] = useState<any[]>([]);
    const [showReport, setShowReport] = useState(false);

    // Dossier State
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [showDossierPreview, setShowDossierPreview] = useState(false);
    
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

            // Currency Filter
            if (currencyFilter && item.currency && item.currency !== currencyFilter) return false;

            // Amount Filter
            const amountField = item.amount ?? item.walletBalance;
            if (amountField !== undefined) {
                const numericMin = parseFloat(minAmount);
                const numericMax = parseFloat(maxAmount);
                if (!isNaN(numericMin) && amountField < numericMin) return false;
                if (!isNaN(numericMax) && amountField > numericMax) return false;
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
            if (c.isCurrency) {
                 val = formatCurrency(val, row.currency);
            }
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

    // ... (rest of the component unchanged)

    const handleUserSelect = (userId: string) => {
        setSelectedUserIds(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
        setShowDossierPreview(false);
    };

    const handleSelectAll = () => {
        const allIds = filteredUsersForDossier.map(u => u._id);
        const newSet = new Set([...selectedUserIds, ...allIds]);
        setSelectedUserIds(Array.from(newSet));
        setShowDossierPreview(false);
    };

    const handleDeselectAll = () => {
        setSelectedUserIds([]);
        setShowDossierPreview(false);
    };
    
    // ... (rest of the component is fine)

    // Helper to link a transaction to a deposit proof
    const getReceiptInfo = (tx: Transaction) => {
        if (tx.type !== 'Deposit') return 'N/A';
        
        // Attempt to find matching deposit. 
        // Transaction description usually contains "Deposit #<id>"
        const match = tx.description.match(/#(\w+)/);
        const depositId = match ? match[1] : null;
        
        let deposit: Deposit | undefined;
        if (depositId) {
            deposit = deposits.find(d => d._id === depositId);
        } 
        
        // Fallback: Try strict matching on other fields if ID extraction fails (rare)
        if (!deposit) {
             deposit = deposits.find(d => d.transactionId === tx.description || (d.userId === tx.userId && d.amount === tx.amount && new Date(d.date).getTime() === new Date(tx.date).getTime()));
        }

        if (deposit && deposit.receiptUrl) {
            if (deposit.receiptUrl.startsWith('data:')) return '[Base64 Image Data - View in Admin Panel]';
            return `${UPLOADS_URL}${deposit.receiptUrl}`;
        }
        
        return 'N/A';
    };

    // Helper to calculate deep analytics
    const calculateUserAnalytics = (user: User) => {
        // 1. Financials from Transactions/Records
        const approvedDeposits = deposits.filter(d => d.userId === user._id && d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0);
        const paidWithdrawals = withdrawals.filter(w => w.userId === user._id && w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0);
        const sentTransfers = transfers.filter(t => t.senderId === user._id && t.status === Status.Approved).reduce((sum, t) => sum + t.amount, 0);

        const commissions = transactions.filter(t => t.userId === user._id && t.type === 'Commission' && t.status === 'Approved');
        const totalCommission = commissions.reduce((sum, t) => sum + t.amount, 0);
        const directCommission = commissions.filter(t => t.level === 1).reduce((sum, t) => sum + t.amount, 0);
        const indirectCommission = totalCommission - directCommission;

        // 2. Network Stats
        const directRefs = users.filter(u => u.sponsor === user.username);
        const totalDirectRef = directRefs.length;

        // Helper to count downline recursively
        const countDownline = (username: string): number => {
            const directs = users.filter(u => u.sponsor === username);
            return directs.length + directs.reduce((acc, curr) => acc + countDownline(curr.username), 0);
        };

        // Total network size including directs
        const totalNetwork = countDownline(user.username);
        const totalIndirectRef = totalNetwork - totalDirectRef;

        return {
            totalDeposit: approvedDeposits,
            totalWithdrawal: paidWithdrawals,
            totalTransfer: sentTransfers,
            totalCommission,
            directCommission,
            indirectCommission,
            totalDirectRef,
            totalIndirectRef
        };
    };

    const downloadBulkDossier = () => {
        if (selectedUserIds.length === 0) return alert('Please select at least one user.');

        const rows: string[][] = [];

        selectedUserIds.forEach((userId, index) => {
            const user = users.find(u => u._id === userId);
            if (!user) return;

            const userTx = transactions.filter(t => t.userId === user._id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const stats = calculateUserAnalytics(user);

            // SEPARATOR
            if (index > 0) rows.push([], [], []); // Spacers between users
            rows.push([`=== USER DOSSIER: ${user.username} (${user.email}) ===`]);
            
            // SECTION 1: ANALYTICS SUMMARY
            rows.push(['--- ANALYTICS SUMMARY ---']);
            rows.push(['Metric', 'Value']);
            rows.push(['Total Approved Deposits', formatCurrency(stats.totalDeposit, user.currency)]);
            rows.push(['Total Paid Withdrawals', formatCurrency(stats.totalWithdrawal, user.currency)]);
            rows.push(['Total Transfers Sent', formatCurrency(stats.totalTransfer, user.currency)]);
            rows.push(['Total Commission Earned', formatCurrency(stats.totalCommission, user.currency)]);
            rows.push(['  - Direct Commission', formatCurrency(stats.directCommission, user.currency)]);
            rows.push(['  - Indirect Commission', formatCurrency(stats.indirectCommission, user.currency)]);
            rows.push(['Total Direct Referrals', `${stats.totalDirectRef}`]);
            rows.push(['Total Indirect Referrals', `${stats.totalIndirectRef}`]);
            rows.push([]);

            // SECTION 2: PROFILE
            rows.push(['--- PROFILE ---']);
            rows.push(['User ID', user._id]);
            rows.push(['Full Name', user.fullName]);
            rows.push(['Phone', user.phone]);
            rows.push(['Sponsor', user.sponsor || 'N/A']);
            rows.push(['Status', user.status]);
            rows.push(['Wallet Balance', formatCurrency(user.walletBalance, user.currency)]);
            rows.push(['Registration Date', new Date(user.registrationDate).toLocaleString()]);
            rows.push([]); 

            // SECTION 3: PLANS
            rows.push(['--- ACTIVE PLANS ---']);
            if (user.activePlans && user.activePlans.length > 0) {
                rows.push(['Plan Name', 'Price', 'Purchase Date']);
                user.activePlans.forEach(p => {
                    rows.push([p.planName, formatCurrency(p.price, user.currency), new Date(p.purchaseDate).toLocaleDateString()]);
                });
            } else {
                rows.push(['No active plans']);
            }
            rows.push([]); 

            // SECTION 4: ACTIVITY LOG
            rows.push(['--- ACTIVITY LOG ---']);
            rows.push(['Date', 'Type', 'Amount', 'Status', 'Description/Details', 'Receipt / Proof']);
            userTx.forEach(tx => {
                const proof = getReceiptInfo(tx);
                rows.push([
                    new Date(tx.date).toLocaleString(),
                    tx.type,
                    formatCurrency(tx.amount, tx.currency),
                    tx.status || 'N/A',
                    tx.description,
                    proof
                ]);
            });
        });

        const csvContent = rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const filename = selectedUserIds.length === 1 
            ? `Dossier_${users.find(u => u._id === selectedUserIds[0])?.username}_${new Date().toISOString().split('T')[0]}.csv`
            : `Bulk_Dossiers_${selectedUserIds.length}_Users_${new Date().toISOString().split('T')[0]}.csv`;
            
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    // ... (rest of the component, especially dossier preview, needs currency formatting)

    const filteredUsersForDossier = useMemo(() => {
        if (!userSearchTerm) return users;
        const term = userSearchTerm.toLowerCase();
        return users.filter(u => 
            u.username.toLowerCase().includes(term) || 
            u.fullName.toLowerCase().includes(term) || 
            u.email.toLowerCase().includes(term)
        );
    }, [users, userSearchTerm]);

    const reportHeaders = useMemo(() => reportConfigs[reportType].map(c => c.label), [reportType]);
    const hasStatusField = ['deposits', 'withdrawals', 'users', 'transfers', 'commissions', 'all_transactions'].includes(reportType);
    const hasAmountField = ['deposits', 'withdrawals', 'transfers', 'users', 'commissions', 'all_transactions'].includes(reportType);
    const hasCurrencyField = ['deposits', 'withdrawals', 'users', 'transfers', 'commissions', 'all_transactions'].includes(reportType);
    
    // Helper for Preview display of receipts
    const renderReceiptPreview = (tx: Transaction) => {
        const proof = getReceiptInfo(tx);
        if (proof === 'N/A') return <span className="text-gray-400">-</span>;
        if (proof === '[Base64 Image Data - View in Admin Panel]') return <span className="text-xs text-blue-500 italic">Image Stored (View in Deposits)</span>;
        return <a href={proof} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">View Proof</a>;
    }

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
                    User Dossiers (Bulk/Single)
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
                                        <option value="users">Users</option>
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
                                {hasCurrencyField && (
                                <div>
                                    <label className="block text-sm font-medium">Currency</label>
                                    <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value as Currency | '')} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600">
                                        <option value="">All</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="PKR">PKR</option>
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
                                                    col.isCurrency ?
                                                        formatCurrency(row[col.key as keyof typeof row], row.currency) :
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
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Export User Dossiers</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Select one or more users to generate a comprehensive file containing their full history: Profile, Plans, Deposits, Withdrawals, Transfers, and all Transactions.
                    </p>
                    
                    <div className="space-y-4">
                        {/* Selection Controls */}
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <input 
                                type="text" 
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                placeholder="Filter users by name, email, username..."
                                className="flex-grow rounded-md dark:bg-gray-700 dark:border-gray-600"
                            />
                            <div className="flex space-x-2">
                                <Button size="sm" variant="secondary" onClick={handleSelectAll}>Select All Filtered</Button>
                                <Button size="sm" variant="secondary" onClick={handleDeselectAll}>Deselect All</Button>
                            </div>
                        </div>

                        {/* User List */}
                        <div className="border dark:border-gray-700 rounded-md max-h-64 overflow-y-auto">
                            {filteredUsersForDossier.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 w-10">
                                                <input 
                                                    type="checkbox" 
                                                    checked={filteredUsersForDossier.length > 0 && filteredUsersForDossier.every(u => selectedUserIds.includes(u._id))}
                                                    onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                                                    className="rounded dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </th>
                                            <th className="px-4 py-2">User Details</th>
                                            <th className="px-4 py-2">Balance</th>
                                            <th className="px-4 py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {filteredUsersForDossier.map(u => (
                                            <tr 
                                                key={u._id} 
                                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${selectedUserIds.includes(u._id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                                onClick={() => handleUserSelect(u._id)}
                                            >
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedUserIds.includes(u._id)}
                                                        onChange={() => {}} // Handled by row click
                                                        className="rounded dark:bg-gray-700 dark:border-gray-600 pointer-events-none"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="font-medium text-gray-900 dark:text-white">{u.fullName}</div>
                                                    <div className="text-xs text-gray-500">@{u.username} | {u.email}</div>
                                                </td>
                                                <td className="px-4 py-2 font-mono text-green-600">{formatCurrency(u.walletBalance, u.currency)}</td>
                                                <td className="px-4 py-2"><Badge status={u.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-gray-500">No users found matching "{userSearchTerm}"</div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                <strong>{selectedUserIds.length}</strong> users selected
                            </span>
                            <div className="space-x-3">
                                <Button variant="secondary" onClick={() => setShowDossierPreview(true)} disabled={selectedUserIds.length === 0}>
                                    Preview Selected Data
                                </Button>
                                <Button onClick={downloadBulkDossier} disabled={selectedUserIds.length === 0}>
                                    Export Selected Dossiers ({selectedUserIds.length})
                                </Button>
                            </div>
                        </div>

                        {/* Modal Preview Section */}
                        {showDossierPreview && selectedUserIds.length > 0 && (
                            <Modal isOpen={showDossierPreview} onClose={() => setShowDossierPreview(false)}>
                                <div className="p-4 w-[95vw] max-w-7xl h-[85vh] overflow-y-auto">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-2xl font-bold">Dossier Preview ({selectedUserIds.length} Users)</h2>
                                        <div className="space-x-2">
                                            <Button onClick={downloadBulkDossier}>Export CSV</Button>
                                            <Button variant="secondary" onClick={() => setShowDossierPreview(false)}>Close</Button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-8">
                                        {selectedUserIds.map(userId => {
                                            const user = users.find(u => u._id === userId);
                                            if (!user) return null;
                                            const userTx = transactions.filter(t => t.userId === user._id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                            const stats = calculateUserAnalytics(user);

                                            return (
                                                <div key={user._id} className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 shadow-sm">
                                                    <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
                                                        {user.fullName} (@{user.username})
                                                        <span className="ml-2 text-xs text-gray-500 font-normal">{user._id}</span>
                                                    </h3>
                                                    
                                                    {/* ANALYTICS PREVIEW GRID */}
                                                    <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500 uppercase">Total Commission</p>
                                                            <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalCommission, user.currency)}</p>
                                                            <p className="text-[10px] text-gray-400">Dir: {formatCurrency(stats.directCommission, user.currency)} | Ind: {formatCurrency(stats.indirectCommission, user.currency)}</p>
                                                        </div>
                                                        <div className="text-center border-l dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 uppercase">Total Deposits</p>
                                                            <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalDeposit, user.currency)}</p>
                                                        </div>
                                                        <div className="text-center border-l dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 uppercase">Total Withdrawals</p>
                                                            <p className="text-lg font-bold text-red-600">{formatCurrency(stats.totalWithdrawal, user.currency)}</p>
                                                        </div>
                                                        <div className="text-center border-l dark:border-gray-700">
                                                            <p className="text-xs text-gray-500 uppercase">Total Referrals</p>
                                                            <p className="text-lg font-bold text-purple-600">{stats.totalDirectRef + stats.totalIndirectRef}</p>
                                                            <p className="text-[10px] text-gray-400">Dir: {stats.totalDirectRef} | Ind: {stats.totalIndirectRef}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                                                        <div><strong>Email:</strong> {user.email}</div>
                                                        <div><strong>Phone:</strong> {user.phone}</div>
                                                        <div><strong>Sponsor:</strong> {user.sponsor || 'N/A'}</div>
                                                        <div><strong>Balance:</strong> <span className="text-green-600 font-bold">{formatCurrency(user.walletBalance, user.currency)}</span></div>
                                                        <div><strong>Status:</strong> <Badge status={user.status} /></div>
                                                        <div><strong>Registered:</strong> {new Date(user.registrationDate).toLocaleDateString()}</div>
                                                    </div>

                                                    <div className="mb-4">
                                                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-2">Active Plans</h4>
                                                        {user.activePlans && user.activePlans.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {user.activePlans.map((p, i) => (
                                                                    <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                                                                        {p.planName} ({formatCurrency(p.price, user.currency)}) - {new Date(p.purchaseDate).toLocaleDateString()}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : <p className="text-xs text-gray-500">No active plans</p>}
                                                    </div>

                                                    <div>
                                                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-2">Activity Log</h4>
                                                        <div className="overflow-x-auto max-h-60">
                                                            <table className="w-full text-xs text-left">
                                                                <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                                                                    <tr>
                                                                        <th className="p-2">Date</th>
                                                                        <th className="p-2">Type</th>
                                                                        <th className="p-2">Amount</th>
                                                                        <th className="p-2">Status</th>
                                                                        <th className="p-2">Description</th>
                                                                        <th className="p-2">Proof</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y dark:divide-gray-600">
                                                                    {userTx.length > 0 ? userTx.map(tx => (
                                                                        <tr key={tx._id}>
                                                                            <td className="p-2 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                                                                            <td className="p-2">{tx.type}</td>
                                                                            <td className={`p-2 font-mono ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                {formatCurrency(tx.amount, tx.currency)}
                                                                            </td>
                                                                            <td className="p-2"><Badge status={tx.status as Status} /></td>
                                                                            <td className="p-2">{tx.description}</td>
                                                                            <td className="p-2">{renderReceiptPreview(tx)}</td>
                                                                        </tr>
                                                                    )) : (
                                                                        <tr><td colSpan={6} className="p-2 text-center text-gray-500">No transactions found.</td></tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </Modal>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
