
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
    const { users, transactions, deposits, withdrawals, transfers, investmentPlans } = state;
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

    // Dossier Advanced Filters
    const [dossierMembership, setDossierMembership] = useState<'all' | 'active' | 'inactive'>('all');
    const [dossierCurrency, setDossierCurrency] = useState<Currency | ''>('');
    const [dossierPlanId, setDossierPlanId] = useState<string>('');
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
            const from = dateFrom ? new Date(dateFrom) : null;
            const to = dateTo ? new Date(dateTo) : null;
            if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);
            const itemDate = new Date('registrationDate' in item ? item.registrationDate : item.date);
            if (from && itemDate < from) return false;
            if (to && itemDate > to) return false;

            if (statusFilter && item.status && item.status !== statusFilter) return false;
            if (currencyFilter && item.currency?.toUpperCase() !== currencyFilter) return false;

            const amountField = item.amount ?? item.walletBalance;
            if (amountField !== undefined) {
                const numericMin = parseFloat(minAmount);
                const numericMax = parseFloat(maxAmount);
                if (!isNaN(numericMin) && amountField < numericMin) return false;
                if (!isNaN(numericMax) && amountField > numericMax) return false;
            }

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

    const getReceiptInfo = (tx: Transaction) => {
        if (tx.type !== 'Deposit') return 'N/A';
        const match = tx.description.match(/#(\w+)/);
        const depositId = match ? match[1] : null;
        let deposit: Deposit | undefined;
        if (depositId) deposit = deposits.find(d => d._id === depositId);
        if (!deposit) deposit = deposits.find(d => d.transactionId === tx.description || (d.userId === tx.userId && d.amount === tx.amount && new Date(d.date).getTime() === new Date(tx.date).getTime()));
        if (deposit && deposit.receiptUrl) {
            if (deposit.receiptUrl.startsWith('data:')) return '[Base64 Image Data - View in Admin Panel]';
            return `${UPLOADS_URL}${deposit.receiptUrl}`;
        }
        return 'N/A';
    };

    const calculateUserAnalytics = (user: User) => {
        const approvedDeposits = deposits.filter(d => d.userId === user._id && d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0);
        const paidWithdrawals = withdrawals.filter(w => w.userId === user._id && w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0);
        const sentTransfers = transfers.filter(t => t.senderId === user._id && t.status === Status.Approved).reduce((sum, t) => sum + t.amount, 0);
        const commissions = transactions.filter(t => t.userId === user._id && t.type === 'Commission' && t.status === 'Approved');
        const totalCommission = commissions.reduce((sum, t) => sum + t.amount, 0);
        const directCommission = commissions.filter(t => t.level === 1).reduce((sum, t) => sum + t.amount, 0);
        const indirectCommission = totalCommission - directCommission;
        const directs = users.filter(u => u.sponsor === user.username);
        const totalDirectRef = directs.length;
        const countDownline = (username: string): number => {
            const children = users.filter(u => u.sponsor === username);
            return children.length + children.reduce((acc, curr) => acc + countDownline(curr.username), 0);
        };
        const totalNetwork = countDownline(user.username);
        const totalIndirectRef = totalNetwork - totalDirectRef;
        return { totalDeposit: approvedDeposits, totalWithdrawal: paidWithdrawals, totalTransfer: sentTransfers, totalCommission, directCommission, indirectCommission, totalDirectRef, totalIndirectRef };
    };

    const handleUserSelect = (userId: string) => {
        setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
        setShowDossierPreview(false);
    };

    const handleSelectAllFiltered = () => {
        const ids = filteredUsersForDossier.map(u => u._id);
        const newSet = new Set([...selectedUserIds, ...ids]);
        setSelectedUserIds(Array.from(newSet));
    };

    const handleDeselectAll = () => {
        setSelectedUserIds([]);
        setShowDossierPreview(false);
    };

    const filteredUsersForDossier = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = !userSearchTerm || u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email.toLowerCase().includes(userSearchTerm.toLowerCase());
            const hasPlan = u.activePlans && u.activePlans.length > 0;
            const matchesMembership = dossierMembership === 'all' || (dossierMembership === 'active' && hasPlan) || (dossierMembership === 'inactive' && !hasPlan);
            const matchesCurrency = !dossierCurrency || u.currency === dossierCurrency;
            const matchesPlan = !dossierPlanId || (u.activePlans && u.activePlans.some(p => p.planId === dossierPlanId));
            return matchesSearch && matchesMembership && matchesCurrency && matchesPlan;
        });
    }, [users, userSearchTerm, dossierMembership, dossierCurrency, dossierPlanId]);

    const handleAutoSelectByFilter = () => {
        const ids = filteredUsersForDossier.map(u => u._id);
        setSelectedUserIds(ids);
        alert(`Selected ${ids.length} users matching current filters.`);
    };

    const downloadBulkDossier = () => {
        if (selectedUserIds.length === 0) return alert('Please select at least one user.');
        const rows: string[][] = [];
        selectedUserIds.forEach((userId, index) => {
            const user = users.find(u => u._id === userId);
            if (!user) return;
            const userTx = transactions.filter(t => t.userId === user._id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const stats = calculateUserAnalytics(user);
            if (index > 0) rows.push([], [], []);
            rows.push([`=== USER DOSSIER: ${user.username} (${user.email}) ===`]);
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
            rows.push(['--- PROFILE ---']);
            rows.push(['User ID', user._id]);
            rows.push(['Full Name', user.fullName]);
            rows.push(['Phone', user.phone]);
            rows.push(['Sponsor', user.sponsor || 'N/A']);
            rows.push(['Status', user.status]);
            rows.push(['Wallet Balance', formatCurrency(user.walletBalance, user.currency)]);
            rows.push(['Registration Date', new Date(user.registrationDate).toLocaleString()]);
            rows.push([]); 
            rows.push(['--- ACTIVE PLANS ---']);
            if (user.activePlans && user.activePlans.length > 0) {
                rows.push(['Plan Name', 'Price', 'Purchase Date']);
                user.activePlans.forEach(p => { rows.push([p.planName, formatCurrency(p.price, user.currency), new Date(p.purchaseDate).toLocaleDateString()]); });
            } else { rows.push(['No active plans']); }
            rows.push([]); 
            rows.push(['--- ACTIVITY LOG ---']);
            rows.push(['Date', 'Type', 'Amount', 'Status', 'Description/Details', 'Receipt / Proof']);
            userTx.forEach(tx => {
                const proof = getReceiptInfo(tx);
                rows.push([ new Date(tx.date).toLocaleString(), tx.type, formatCurrency(tx.amount, tx.currency), tx.status || 'N/A', tx.description, proof ]);
            });
        });
        const csvContent = rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const filename = selectedUserIds.length === 1 ? `Dossier_${users.find(u => u._id === selectedUserIds[0])?.username}.csv` : `Bulk_Dossiers_${selectedUserIds.length}_Users.csv`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reportHeaders = useMemo(() => reportConfigs[reportType].map(c => c.label), [reportType]);
    const hasStatusField = ['deposits', 'withdrawals', 'users', 'transfers', 'commissions', 'all_transactions'].includes(reportType);
    const hasAmountField = ['deposits', 'withdrawals', 'transfers', 'users', 'commissions', 'all_transactions'].includes(reportType);
    const hasCurrencyField = ['deposits', 'withdrawals', 'users', 'transfers', 'commissions', 'all_transactions'].includes(reportType);

    const renderReceiptPreview = (tx: Transaction) => {
        const proof = getReceiptInfo(tx);
        if (proof === 'N/A') return <span className="text-gray-400">-</span>;
        if (proof === '[Base64 Image Data - View in Admin Panel]') return <span className="text-xs text-blue-500 italic">Image Stored</span>;
        return <a href={proof} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">View Proof</a>;
    }

    return (
        <div className="space-y-6">
            <div className="flex space-x-4 border-b dark:border-gray-700">
                <button className={`py-2 px-4 font-medium focus:outline-none ${activeTab === 'general' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('general')}>General System Reports</button>
                <button className={`py-2 px-4 font-medium focus:outline-none ${activeTab === 'dossier' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('dossier')}>User Dossiers (Bulk/Single)</button>
            </div>

            {activeTab === 'general' && (
                <>
                    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Generate Reports</h2>
                        <form onSubmit={handleGenerateReport} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div><label className="block text-sm font-medium">Report Type</label><select value={reportType} onChange={(e) => { setReportType(e.target.value as ReportType); setShowReport(false); }} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600"><option value="all_transactions">All Transactions</option><option value="deposits">Deposits</option><option value="withdrawals">Withdrawals</option><option value="transfers">User Transfers</option><option value="users">Users</option><option value="commissions">Commissions</option></select></div>
                                <div><label className="block text-sm font-medium">Date From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" /></div>
                                <div><label className="block text-sm font-medium">Date To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" /></div>
                                {hasStatusField && (<div><label className="block text-sm font-medium">Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600"><option value="">All</option>{Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}</select></div>)}
                                {hasCurrencyField && (<div><label className="block text-sm font-medium">Currency</label><select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value as Currency | '')} className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600"><option value="">All</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option></select></div>)}
                                {hasAmountField && (<><div><label className="block text-sm font-medium">Min Amount</label><input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0.00" className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" /></div><div><label className="block text-sm font-medium">Max Amount</label><input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="1000.00" className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" /></div></>)}
                                <div className="md:col-span-2"><label className="block text-sm font-medium">Keyword Search</label><input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search by ID, name, email, description..." className="mt-1 block w-full rounded-md dark:bg-gray-700 dark:border-gray-600" /></div>
                            </div>
                            <div className="pt-2 text-right"><Button type="submit">Generate Report</Button></div>
                        </form>
                    </div>
                    {showReport && (
                         <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold">Report Results ({generatedData.length} records)</h2><Button onClick={downloadCSV} disabled={generatedData.length === 0}>Export CSV</Button></div>
                            {generatedData.length > 0 ? (
                                <Table headers={reportHeaders}>
                                    {generatedData.map((row, index) => (
                                        <tr key={row._id || index} className="text-gray-700 dark:text-gray-400">
                                            {reportConfigs[reportType].map(col => (<td key={String(col.key)} className="px-4 py-3 text-sm">{col.key === 'status' && row[col.key as keyof typeof row] ? <Badge status={row[col.key as keyof typeof row] as Status} /> : col.isCurrency ? formatCurrency(row[col.key as keyof typeof row], row.currency) : String(row[col.key as keyof typeof row] ?? 'N/A')}</td>))}
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
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Export Advanced User Dossiers</h2>
                    
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border dark:border-gray-700 mb-8 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">🎯</span>
                            <h3 className="font-bold text-gray-800 dark:text-white uppercase tracking-tighter">Smart Select Filters</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Membership Status</label>
                                <select value={dossierMembership} onChange={e => setDossierMembership(e.target.value as any)} className="w-full rounded-xl dark:bg-gray-800 text-sm">
                                    <option value="all">All Members</option>
                                    <option value="active">Active Members (Owns 1+ Plan)</option>
                                    <option value="inactive">Inactive Members (Zero Plans)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filter by Currency</label>
                                <select value={dossierCurrency} onChange={e => setDossierCurrency(e.target.value as Currency | '')} className="w-full rounded-xl dark:bg-gray-800 text-sm">
                                    <option value="">All Currencies</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="PKR">PKR (Rs)</option>
                                    <option value="EUR">EUR (€)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filter by Plan</label>
                                <select value={dossierPlanId} onChange={e => setDossierPlanId(e.target.value)} className="w-full rounded-xl dark:bg-gray-800 text-sm">
                                    <option value="">Any Plan / No Filter</option>
                                    {investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({p.currency})</option>)}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <Button className="w-full rounded-xl shadow-lg shadow-blue-500/20" variant="primary" onClick={handleAutoSelectByFilter}>
                                    Auto-Select All Matching
                                </Button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700">
                             <p className="text-xs text-gray-500 font-medium">Current criteria matches <span className="font-bold text-blue-600">{filteredUsersForDossier.length}</span> users.</p>
                             <div className="flex gap-2">
                                <button onClick={handleSelectAllFiltered} className="text-xs text-blue-600 hover:underline font-bold">Select Only These</button>
                                <span className="text-gray-300">|</span>
                                <button onClick={handleDeselectAll} className="text-xs text-red-500 hover:underline font-bold">Clear All Selections</button>
                             </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <div className="relative flex-grow">
                                <input type="text" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} placeholder="Live search by name, email, username..." className="w-full pl-10 rounded-xl dark:bg-gray-700 dark:border-gray-600" />
                                <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>

                        <div className="border dark:border-gray-700 rounded-2xl overflow-hidden shadow-inner bg-white dark:bg-gray-900">
                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                                        <tr className="text-xs font-black uppercase text-gray-500 tracking-widest border-b dark:border-gray-700">
                                            <th className="px-6 py-4 w-10"><input type="checkbox" checked={filteredUsersForDossier.length > 0 && filteredUsersForDossier.every(u => selectedUserIds.includes(u._id))} onChange={(e) => e.target.checked ? handleSelectAllFiltered() : handleDeselectAll()} className="rounded dark:bg-gray-700" /></th>
                                            <th className="px-6 py-4">Full Identity</th>
                                            <th className="px-6 py-4">Active Assets</th>
                                            <th className="px-6 py-4">Wallet</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-800">
                                        {filteredUsersForDossier.map(u => {
                                            const isSelected = selectedUserIds.includes(u._id);
                                            return (
                                                <tr key={u._id} className={`hover:bg-gray-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`} onClick={() => handleUserSelect(u._id)}>
                                                    <td className="px-6 py-4"><input type="checkbox" checked={isSelected} readOnly className="rounded dark:bg-gray-700 pointer-events-none" /></td>
                                                    <td className="px-6 py-4"><div className="font-bold text-gray-900 dark:text-white">{u.fullName}</div><div className="text-xs text-gray-500">@{u.username} | {u.email}</div></td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {u.activePlans?.length ? u.activePlans.map((p, i) => <span key={i} className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold uppercase">{p.planName}</span>) : <span className="text-[10px] text-gray-400 italic">Inactive</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono font-bold text-green-600">{formatCurrency(u.walletBalance, u.currency)}</td>
                                                    <td className="px-6 py-4"><Badge status={u.status} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredUsersForDossier.length === 0 && <div className="p-12 text-center text-gray-500 font-bold italic">No members found matching current filters.</div>}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-4">
                            <span className="text-sm font-black uppercase tracking-widest text-gray-400">
                                <strong className="text-blue-600 dark:text-blue-400">{selectedUserIds.length}</strong> Dossiers Selected
                            </span>
                            <div className="flex gap-3">
                                <Button variant="secondary" className="rounded-xl" onClick={() => setShowDossierPreview(true)} disabled={selectedUserIds.length === 0}>Preview Ledger</Button>
                                <Button onClick={downloadBulkDossier} className="rounded-xl px-10 py-3 shadow-xl shadow-blue-500/30" disabled={selectedUserIds.length === 0}>Export Selected ({selectedUserIds.length})</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 20px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; }
            `}</style>

            {/* PREVIEW MODAL */}
            {showDossierPreview && selectedUserIds.length > 0 && (
                <Modal isOpen={showDossierPreview} onClose={() => setShowDossierPreview(false)}>
                    <div className="p-4 w-[95vw] max-w-7xl h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Bulk Dossier Preview ({selectedUserIds.length} Users)</h2>
                            <div className="flex gap-2">
                                <Button onClick={downloadBulkDossier}>Generate Final CSV</Button>
                                <Button variant="secondary" onClick={() => setShowDossierPreview(false)}>Close</Button>
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-8 pr-2">
                            {selectedUserIds.map(userId => {
                                const user = users.find(u => u._id === userId);
                                if (!user) return null;
                                const userTx = transactions.filter(t => t.userId === user._id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                const stats = calculateUserAnalytics(user);
                                return (
                                    <div key={user._id} className="border-2 border-gray-100 dark:border-gray-700 rounded-[2rem] p-6 bg-gray-50 dark:bg-gray-800 shadow-sm relative overflow-hidden">
                                        <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
                                            <div>
                                                <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">@{user.username}</h3>
                                                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">{user.fullName} | Joined {new Date(user.registrationDate).toLocaleDateString()}</p>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-grow">
                                                <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl text-center border dark:border-gray-700"><p className="text-[9px] font-black text-gray-400 uppercase">Total Deposit</p><p className="text-sm font-black text-blue-600">{formatCurrency(stats.totalDeposit, user.currency)}</p></div>
                                                <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl text-center border dark:border-gray-700"><p className="text-[9px] font-black text-gray-400 uppercase">Total Paid</p><p className="text-sm font-black text-red-600">{formatCurrency(stats.totalWithdrawal, user.currency)}</p></div>
                                                <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl text-center border dark:border-gray-700"><p className="text-[9px] font-black text-gray-400 uppercase">Net Commission</p><p className="text-sm font-black text-green-600">{formatCurrency(stats.totalCommission, user.currency)}</p></div>
                                                <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl text-center border dark:border-gray-700"><p className="text-[9px] font-black text-gray-400 uppercase">Direct Team</p><p className="text-sm font-black text-indigo-600">{stats.totalDirectRef}</p></div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b dark:border-gray-700 pb-2">Full Transaction Ledger</h4>
                                            <div className="overflow-x-auto"><table className="w-full text-[11px] text-left"><thead className="bg-white/50 dark:bg-black/20 text-gray-400 uppercase font-black tracking-widest"><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Description</th><th className="p-3">Receipt</th></tr></thead><tbody className="divide-y dark:divide-gray-700">{userTx.length > 0 ? userTx.map(tx => (<tr key={tx._id} className="hover:bg-white/50 dark:hover:bg-black/10"><td className="p-3 opacity-60">{new Date(tx.date).toLocaleString()}</td><td className="p-3 font-bold">{tx.type}</td><td className={`p-3 font-black ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(tx.amount, tx.currency)}</td><td className="p-3"><Badge status={tx.status as Status || Status.Approved} /></td><td className="p-3 text-xs opacity-70 italic">{tx.description}</td><td className="p-3">{renderReceiptPreview(tx)}</td></tr>)) : (<tr><td colSpan={6} className="p-8 text-center text-gray-400 font-bold italic">No financial movements recorded for this user.</td></tr>)}</tbody></table></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Reports;
