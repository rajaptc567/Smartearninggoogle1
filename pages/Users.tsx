import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction, Log, ActivePlan, currencySymbols } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { LoadingCircle } from '../components/ui/LoadingCircle';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers, adminActivatePlan, createBulkDummyUsers, getUploadsBaseUrl } from '../services/api';

const transactionTypes = [
    'Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 
    'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 
    'Transfer Received', 'Transfer Request', 'Transfer Refund'
];

const Users: React.FC = () => {
    const { state, dispatch } = useData();
    const { users, investmentPlans, transactions, settings, deposits, withdrawals, transfers } = state;
    const UPLOADS_URL = getUploadsBaseUrl();
    
    const isLoading = users.length === 0;
    
    const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
    const [isBulkRestrictionsModalOpen, setIsBulkRestrictionsModalOpen] = useState(false);
    const [isBulkDummyModalOpen, setIsBulkDummyModalOpen] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    const [managingUser, setManagingUser] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    
    // Filtering State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Selection State
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- DOSSIER GENERATION LOGIC (Unified for Delete flow) ---
    const getReceiptInfo = (tx: Transaction) => {
        if (tx.type !== 'Deposit') return 'N/A';
        const match = tx.description.match(/#(\w+)/);
        const depositId = match ? match[1] : null;
        let deposit: Deposit | undefined;
        if (depositId) deposit = deposits.find(d => d._id === depositId);
        if (!deposit) deposit = deposits.find(d => d.transactionId === tx.description || (d.userId === tx.userId && d.amount === tx.amount && new Date(d.date).getTime() === new Date(tx.date).getTime()));
        if (deposit && deposit.receiptUrl) {
            if (deposit.receiptUrl.startsWith('data:')) return '[Base64 Image Data]';
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
        const directs = users.filter(u => u.sponsor === user.username);
        return { totalDeposit: approvedDeposits, totalWithdrawal: paidWithdrawals, totalTransfer: sentTransfers, totalCommission, totalDirectRef: directs.length };
    };

    const handleDownloadDossiers = (ids: string[]) => {
        if (ids.length === 0) return;
        const rows: string[][] = [];
        ids.forEach((userId, index) => {
            const user = users.find(u => u._id === userId);
            if (!user) return;
            const userTx = transactions.filter(t => t.userId === user._id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const stats = calculateUserAnalytics(user);
            if (index > 0) rows.push([], [], []);
            rows.push([`=== PRE-DELETE USER DOSSIER: ${user.username} (${user.email}) ===`]);
            rows.push(['--- ANALYTICS SUMMARY ---']);
            rows.push(['Metric', 'Value']);
            rows.push(['Total Approved Deposits', formatCurrency(stats.totalDeposit, user.currency)]);
            rows.push(['Total Paid Withdrawals', formatCurrency(stats.totalWithdrawal, user.currency)]);
            rows.push(['Total Transfers Sent', formatCurrency(stats.totalTransfer, user.currency)]);
            rows.push(['Total Commission Earned', formatCurrency(stats.totalCommission, user.currency)]);
            rows.push(['Total Direct Referrals', `${stats.totalDirectRef}`]);
            rows.push([]);
            rows.push(['--- PROFILE ---']);
            rows.push(['User ID', user._id]);
            rows.push(['Full Name', user.fullName]);
            rows.push(['Sponsor', user.sponsor || 'N/A']);
            rows.push(['Status', user.status]);
            rows.push(['Wallet Balance', formatCurrency(user.walletBalance, user.currency)]);
            rows.push(['Registration Date', new Date(user.registrationDate).toLocaleString()]);
            rows.push([]); 
            rows.push(['--- ACTIVITY LOG ---']);
            rows.push(['Date', 'Type', 'Amount', 'Status', 'Description', 'Proof/Receipt']);
            userTx.forEach(tx => {
                const proof = getReceiptInfo(tx);
                rows.push([ new Date(tx.date).toLocaleString(), tx.type, formatCurrency(tx.amount, tx.currency), tx.status || 'Approved', tx.description, proof ]);
            });
        });
        const csvContent = rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const filename = ids.length === 1 ? `Dossier_PreDelete_${users.find(u => u._id === ids[0])?.username}.csv` : `Bulk_Dossiers_PreDelete_${ids.length}_Users.csv`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenUserManagementModal = (user: User | null = null) => {
        setManagingUser(user);
        setIsUserManagementModalOpen(true);
    };

    const handleOpenMessage = (user: User | null = null) => {
        setManagingUser(user);
        setIsMessageModalOpen(true);
    }
    
    const handleOpenDeleteModal = (user: User) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    const handleCloseAllModals = () => {
        setManagingUser(null);
        setUserToDelete(null);
        setIsUserManagementModalOpen(false);
        setIsBulkRestrictionsModalOpen(false);
        setIsBulkDummyModalOpen(false);
        setIsMessageModalOpen(false);
        setIsDeleteModalOpen(false);
    };
    
    const handleConfirmDelete = async (userId: string) => {
        try {
            await deleteUser(userId);
            dispatch({ type: 'DELETE_USER', payload: userId });
            alert('User and all associated data deleted successfully.');
            handleCloseAllModals();
        } catch (error) {
            console.error("Failed to delete user:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not delete user.'}`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedUserIds.length === 0) return;
        
        const count = selectedUserIds.length;
        const confirmMessage = `Are you sure you want to permanently delete ${count} selected user(s) and all their associated data?\n\nThis action is IRREVERSIBLE and will wipe their balance, deposits, withdrawals, and referrals.`;
        
        if (window.confirm(confirmMessage)) {
            setIsProcessing(true);
            try {
                await bulkDeleteUsers(selectedUserIds);
                const updatedUsers = await getUsers();
                dispatch({ type: 'SET_USERS', payload: updatedUsers });
                setSelectedUserIds([]);
                alert(`Successfully deleted ${count} users.`);
            } catch (error) {
                console.error("Failed to bulk delete users:", error);
                alert(`Error: ${error instanceof Error ? error.message : 'Could not delete users.'}`);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const filteredUsers = useMemo(() => {
        return state.users.filter(user => {
            const matchesSearch = (() => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return (
                    user.username.toLowerCase().includes(term) ||
                    user.fullName.toLowerCase().includes(term) ||
                    user.email.toLowerCase().includes(term) ||
                    (user.phone && user.phone.includes(term)) ||
                    user._id.toString().includes(term)
                );
            })();

            const matchesStatus = (() => {
                if (!statusFilter) return true;
                return user.status === statusFilter;
            })();

            const matchesPlan = (() => {
                if (!planFilter) return true;
                if (planFilter === 'NO_PLAN') {
                    return !user.activePlans || user.activePlans.length === 0;
                }
                return user.activePlans?.some(p => p.planId === planFilter);
            })();

            const matchesCurrency = (() => {
                if (!currencyFilter) return true;
                return user.currency?.toUpperCase() === currencyFilter;
            })();

            return matchesSearch && matchesStatus && matchesPlan && matchesCurrency;
        });
    }, [state.users, searchTerm, statusFilter, planFilter, currencyFilter]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, planFilter, currencyFilter, itemsPerPage]);

    // Pagination Calculation
    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(start, start + itemsPerPage);
    }, [filteredUsers, currentPage, itemsPerPage]);

    // Check if any plan for a user has reached its limit
    const getLimitStatus = useCallback((user: User) => {
        if (!user.activePlans || user.activePlans.length === 0) return null;
        
        for (const ap of user.activePlans) {
            const plan = investmentPlans.find(p => p._id === ap.planId);
            if (!plan || plan.directReferralLimit <= 0) continue;

            const equivIds = new Set<string>();
            equivIds.add(ap.planId);
            const group = settings.planEquivalencyGroups?.find(g =>
                String(g.usdPlanId) === ap.planId || String(g.pkrPlanId) === ap.planId || String(g.eurPlanId) === ap.planId
            );
            if (group) {
                if (group.usdPlanId) equivIds.add(String(group.usdPlanId));
                if (group.pkrPlanId) equivIds.add(String(group.pkrPlanId));
                if (group.eurPlanId) equivIds.add(String(group.eurPlanId));
            }

            const used = transactions.filter(t => 
                String(t.userId) === String(user._id) &&
                t.type === 'Commission' &&
                t.level === 1 &&
                t.relatedPlanId &&
                equivIds.has(String(t.relatedPlanId)) &&
                (t.status === 'Approved' || t.status === 'Pending')
            ).length;

            if (used >= plan.directReferralLimit) {
                return { planName: plan.name, used, limit: plan.directReferralLimit };
            }
        }
        return null;
    }, [investmentPlans, settings.planEquivalencyGroups, transactions]);

    const handleSelectUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return Array.from(newSet);
        });
    };

    const handleSelectAllOnPage = () => {
        const areAllOnPageSelected = paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.includes(u._id));
        if (areAllOnPageSelected) {
            const pageIds = new Set(paginatedUsers.map(u => u._id));
            setSelectedUserIds(prev => prev.filter(id => !pageIds.has(id)));
        } else {
            const currentSelectedSet = new Set(selectedUserIds);
            paginatedUsers.forEach(u => currentSelectedSet.add(u._id));
            setSelectedUserIds(Array.from(currentSelectedSet));
        }
    };

    const tableHeaders = ['User', 'Contact', 'Sign Up & Activation', 'Wallet Balance', 'Active Plans', 'Status', 'Actions'];
    const areAllOnPageSelected = paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.includes(u._id));

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white shrink-0">Member Management ({filteredUsers.length})</h2>
                <div className="flex flex-wrap items-center gap-2 justify-end w-full">
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
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Statuses</option>
                        <option value={Status.Active}>Active</option>
                        <option value={Status.Blocked}>Blocked</option>
                        <option value={Status.Paused}>Paused</option>
                        <option value={Status.Pending}>Pending</option>
                    </select>
                     <select
                        value={planFilter}
                        onChange={(e) => setPlanFilter(e.target.value)}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Plans</option>
                        <option value="NO_PLAN">No Active Plan</option>
                        {investmentPlans.map(plan => (
                            <option key={plan._id} value={plan._id}>{plan.name}</option>
                        ))}
                    </select>
                     <select
                        value={currencyFilter}
                        onChange={(e) => setCurrencyFilter(e.target.value as Currency | '')}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">All Currencies</option>
                        <option value="PKR">PKR</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </select>
                    <input 
                        type="text" 
                        placeholder="Search name, email, ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700 mb-6 gap-4">
                <div className="flex items-center gap-4">
                    {selectedUserIds.length > 0 ? (
                        <div className="flex items-center gap-3 animate-fade-in">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {selectedUserIds.length} users selected
                            </span>
                            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                            <Button size="sm" variant="secondary" onClick={() => handleDownloadDossiers(selectedUserIds)}>Download Dossiers</Button>
                            <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={isProcessing}>
                                {isProcessing ? 'Processing...' : 'Delete Selected'}
                            </Button>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-500">Select users for bulk actions</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setIsBulkRestrictionsModalOpen(true)}>Bulk Restrictions</Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsBulkDummyModalOpen(true)}>Bulk Dummy Add</Button>
                    <Button size="sm" onClick={() => handleOpenUserManagementModal(null)}>Add New User</Button>
                </div>
            </div>

             {isLoading ? (
                <LoadingCircle text="Loading user directory..." />
             ) : (
                 <div className="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full whitespace-no-wrap">
                            <thead>
                                <tr className="text-xs font-bold tracking-wide text-left text-gray-500 uppercase border-b dark:border-gray-700 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/50">
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={areAllOnPageSelected && paginatedUsers.length > 0}
                                            onChange={handleSelectAllOnPage}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    {tableHeaders.map((header) => (
                                        <th key={header} className="px-4 py-3">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y dark:divide-gray-700 dark:bg-gray-800">
                                {paginatedUsers.map((user: User) => {
                                    const limitStatus = getLimitStatus(user);
                                    return (
                                    <tr key={user._id} className={`text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedUserIds.includes(user._id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-4 py-3">
                                             <input
                                                type="checkbox"
                                                checked={selectedUserIds.includes(user._id)}
                                                onChange={() => handleSelectUser(user._id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center text-sm">
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                        {user.fullName}
                                                        {limitStatus && (
                                                            <span className="animate-pulse px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-black uppercase tracking-tighter" title={`Limit reached for ${limitStatus.planName}`}>LIMIT FULL</span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {user.email}<br/>
                                            <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">{user.phone}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold">
                                            <span className={user.walletBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                {formatCurrency(user.walletBalance, user.currency)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm max-w-[200px]">
                                            <div className="flex flex-wrap gap-1">
                                                {user.activePlans && user.activePlans.length > 0 
                                                    ? user.activePlans.map((p, idx) => (
                                                        <span key={idx} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                                            {p.planName}
                                                        </span>
                                                      ))
                                                    : <span className="text-gray-400 italic">No plans</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                           <Badge status={user.status} />
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => handleOpenUserManagementModal(user)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Manage User">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button onClick={() => handleOpenMessage(user)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Message User">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                                </button>
                                                <button onClick={() => handleOpenDeleteModal(user)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete User">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 border-t dark:border-gray-700 pt-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    Showing <span className="font-bold text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalItems}</span> members
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

            {isUserManagementModalOpen && (
                <UserManagementModal 
                    user={managingUser}
                    onClose={handleCloseAllModals}
                    onDeleteRequest={handleOpenDeleteModal}
                    onNavigateToUser={(u) => handleOpenUserManagementModal(u)}
                />
            )}
            {isBulkRestrictionsModalOpen && (
                <BulkRestrictionsModal allUsers={users} investmentPlans={investmentPlans} onClose={handleCloseAllModals}/>
            )}
            {isBulkDummyModalOpen && (
                <BulkDummyUserModal users={users} investmentPlans={investmentPlans} onClose={handleCloseAllModals}/>
            )}
            {isMessageModalOpen && (
                <MessageUserModal user={managingUser} allUsers={users} investmentPlans={investmentPlans} onClose={handleCloseAllModals}/>
            )}
            {isDeleteModalOpen && userToDelete && (
                <DeleteUserModal 
                    user={userToDelete} 
                    onClose={handleCloseAllModals} 
                    onConfirmDelete={handleConfirmDelete}
                    onDownloadDossier={() => handleDownloadDossiers([userToDelete._id])}
                />
            )}
        </div>
    );
};

// --- UserManagementModal ---

interface UserManagementModalProps {
    user: User | null;
    onClose: () => void;
    onDeleteRequest?: (user: User) => void;
    onNavigateToUser?: (user: User) => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, onClose, onDeleteRequest, onNavigateToUser }) => {
    const { state, dispatch } = useData();
    const { users, transactions, investmentPlans, settings, logs } = state;

    const [activeTab, setActiveTab] = useState<'profile' | 'permissions' | 'team' | 'network' | 'transactions' | 'commissions' | 'activity'>('profile');
    
    // Robust initialization of formData, ensuring restrictions is always an object
    const [formData, setFormData] = useState<Partial<User>>(() => {
        const base = user || { fullName: '', username: '', email: '', phone: '', whatsapp: '', country: '', status: Status.Active, walletBalance: 0 };
        return {
            ...base,
            restrictions: {
                deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false,
                ...(user?.restrictions || {})
            }
        };
    });
    
    const [isSaving, setIsSaving] = useState(false);

    // Wallet Adjustment State
    const [walletAdjAmount, setWalletAdjAmount] = useState('');
    const [walletAdjReason, setWalletAdjReason] = useState('Admin manual adjustment');

    // Security State
    const [resetLink, setResetLink] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['email', 'whatsapp']);
    const [customMessage, setCustomMessage] = useState('');

    // Network Tab Advanced State (The member-side view logic)
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [networkViewMode, setNetworkViewMode] = useState<'earning' | 'all' | 'held' | 'tree' | 'overflow' | 'inactive'>('earning');

    // Team & Hierarchy Tab State (The original admin side logic)
    const [teamSearch, setTeamSearch] = useState('');
    const [isTreeView, setIsTreeView] = useState(true);
    const [drilldownMemberId, setDrilldownMemberId] = useState<string | null>(null);

    // History Filter State
    const [historyTypeFilter, setHistoryTypeFilter] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('');

    // Manual Management State
    const [activationPlanId, setActivationPlanId] = useState('');
    const [isActivatingPlan, setIsActivatingPlan] = useState(false);
    const [newSponsorUsername, setNewSponsorUsername] = useState(user?.sponsor || '');

    const uniqueActivePlans = useMemo(() => {
        if (!user || !user.activePlans) return [];
        const seen = new Set();
        return user.activePlans.filter(p => {
            const duplicate = seen.has(p.planId);
            seen.add(p.planId);
            return !duplicate;
        });
    }, [user]);

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomFieldChange = (fieldId: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            customFields: {
                ...(prev.customFields || {}),
                [fieldId]: value
            }
        }));
    };

    const handleRestrictionsChange = (key: keyof UserRestrictions) => {
        setFormData(prev => ({
            ...prev,
            restrictions: {
                ...(prev.restrictions as UserRestrictions),
                [key]: !prev.restrictions![key]
            }
        }));
    };
    
    const handleGenerateResetLink = async () => {
        if (!user) return;
        setIsGeneratingLink(true);
        try {
            const { resetToken } = await adminInitiatePasswordReset(user._id);
            const link = `${window.location.origin}${window.location.pathname}#/reset-password?token=${resetToken}`;
            setResetLink(link);
            setCustomMessage(`Hello ${formData.fullName || formData.username || 'User'},\n\nHere is your secure link to reset your password on SmartEarning. This link is valid for 48 hours:\n\n${link}\n\nRegards,\nSmartEarning Support`);
        } catch (error) {
            console.error(error);
            alert(`Failed to generate reset link: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsGeneratingLink(false);
        }
    };
    
    const handleWalletAdjustment = async (action: 'credit' | 'debit') => {
        if (!user) return;
        const numericAmount = parseFloat(walletAdjAmount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert("Please enter a valid positive amount for adjustment.");
            return;
        }
        const adjustmentAmount = action === 'credit' ? numericAmount : -numericAmount;
        setIsSaving(true);
        try {
            const result = await adjustUserWallet(user._id, { amount: adjustmentAmount, description: walletAdjReason });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setFormData(prev => ({ ...prev, walletBalance: result.user.walletBalance }));
            alert("Wallet adjusted successfully.");
            setWalletAdjAmount('');
        } catch (error) {
            console.error(error);
            alert("Failed to adjust wallet.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const { _id, ...updateData } = formData;
            if (user) {
                const updatedUser = await apiUpdateUser(user._id, { ...updateData, sponsor: newSponsorUsername });
                dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            } else {
                const newUser = await apiCreateUser({ ...updateData, password: 'password123' } as any);
                dispatch({ type: 'ADD_USER', payload: newUser });
            }
            alert('User details saved successfully!');
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to save user details.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleManualActivatePlan = async (isBonus = false) => {
        if (!user || !activationPlanId) return;
        const plan = investmentPlans.find(p => p._id === activationPlanId);
        if (isBonus && !window.confirm(`Are you sure you want to grant the ${plan?.name} plan as a BONUS upgrade? This will bypass payment and credit all downline commissions.`)) return;
        
        setIsActivatingPlan(true);
        try {
            const result = await adminActivatePlan(user._id, activationPlanId);
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setFormData(prev => ({ ...prev, activePlans: result.user.activePlans, walletBalance: result.user.walletBalance }));
            setActivationPlanId('');
            alert(`${isBonus ? 'Bonus upgrade' : 'Plan'} activated successfully!`);
        } catch (error) {
            console.error(error);
            alert(`Failed to activate plan.`);
        } finally {
            setIsActivatingPlan(false);
        }
    };

    const handleRemovePlan = async (planId: string) => {
        if (!user || !window.confirm("Are you sure you want to strip this plan from the user?")) return;
        setIsSaving(true);
        try {
            const updatedPlans = (formData.activePlans || []).filter(p => p.planId !== planId);
            const updatedUser = await apiUpdateUser(user._id, { activePlans: updatedPlans as any });
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            setFormData(prev => ({ ...prev, activePlans: updatedUser.activePlans }));
            alert("Plan removed successfully.");
        } catch (error) {
            console.error(error);
            alert("Failed to remove plan.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const TabButton: React.FC<{ tabId: typeof activeTab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button type="button" onClick={() => setActiveTab(tabId)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>
    );

    // --- Team & Hierarchy Logic (The Original Admin View) ---
    const teamData = useMemo(() => {
        if (!user) return { tree: [], flat: [], stats: { total: 0, revenue: 0, active: 0 } };
        
        const myCommissions = transactions.filter(t => t.userId === user._id && t.type === 'Commission');
        
        const buildFlatDownline = (sponsorUsername: string, level: number): any[] => {
            const children = users.filter(u => u.sponsor === sponsorUsername);
            let results: any[] = [];
            
            children.forEach(child => {
                const childComms = myCommissions.filter(t => t.sourceUserId === child._id);
                // FIX: Corrected variable name from 'revenue generated' to 'revenueGenerated' to satisfy shorthand property usage
                const revenueGenerated = childComms.reduce((sum, t) => sum + t.amount, 0);
                const isActive = (child.activePlans || []).length > 0;

                results.push({
                    user: child,
                    level,
                    revenueGenerated,
                    isActive,
                    commissions: childComms
                });
                
                results = results.concat(buildFlatDownline(child.username, level + 1));
            });
            
            return results;
        };

        const flatDownline = buildFlatDownline(user.username, 1);
        
        const totalRevenue = flatDownline.reduce((sum, item) => sum + item.revenueGenerated, 0);
        const activeCount = flatDownline.filter(item => item.isActive).length;

        const buildTree = (sponsorUsername: string): any[] => {
            return flatDownline
                .filter(item => item.user.sponsor === sponsorUsername)
                .map(item => ({
                    ...item,
                    children: buildTree(item.user.username)
                }));
        };

        return {
            tree: buildTree(user.username),
            flat: flatDownline,
            stats: {
                total: flatDownline.length,
                revenue: totalRevenue,
                active: activeCount
            }
        };
    }, [user, users, transactions]);

    const filteredFlatDownline = useMemo(() => {
        return teamData.flat.filter(item => 
            item.user.username.toLowerCase().includes(teamSearch.toLowerCase()) ||
            item.user.fullName.toLowerCase().includes(teamSearch.toLowerCase())
        );
    }, [teamData.flat, teamSearch]);

    const drilldownTransactions = useMemo(() => {
        if (!drilldownMemberId || !user) return [];
        return transactions.filter(t => 
            t.userId === user._id && 
            t.sourceUserId === drilldownMemberId && 
            t.type === 'Commission'
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [drilldownMemberId, transactions, user]);

    const renderTeamTreeNode = (node: any) => (
        <li key={node.user._id} className="relative pl-6 pt-4">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 -ml-3"></div>
            <div className="absolute left-0 top-8 w-4 h-px bg-gray-200 dark:bg-gray-700 -ml-3"></div>
            
            <div className={`p-4 rounded-xl border dark:border-gray-700 shadow-sm transition-all hover:border-blue-400 ${node.isActive ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50 opacity-80'}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${node.level === 1 ? 'bg-blue-500' : 'bg-purple-500'}`}>
                            {node.user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold flex items-center gap-2">
                                {node.user.username}
                                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase tracking-wider text-gray-500">Lvl {node.level}</span>
                            </p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Impact: {formatCurrency(node.revenueGenerated, user?.currency)} Revenue Generated</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setDrilldownMemberId(node.user._id)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="View Commissions From Member"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"/></svg></button>
                        <button onClick={() => onNavigateToUser?.(node.user)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Manage Member"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <div className="p-1.5 bg-gray-50 dark:bg-gray-900 rounded">Balance: <span className="text-gray-900 dark:text-white">{formatCurrency(node.user.walletBalance, node.user.currency)}</span></div>
                    <div className="p-1.5 bg-gray-50 dark:bg-gray-900 rounded">Active: <span className="text-gray-900 dark:text-white">{node.user.activePlans?.length || 0} Plans</span></div>
                </div>
            </div>
            {node.children.length > 0 && (
                <ul className="ml-4">{node.children.map(child => renderTeamTreeNode(child))}</ul>
            )}
        </li>
    );

    // --- My Network Logic (Ported from Referrals.tsx) ---
    const getEquivalentIds = useCallback((planId: string) => {
        const ids = new Set<string>();
        if (planId) {
            ids.add(planId);
            const group = settings.planEquivalencyGroups?.find(g =>
                String(g.usdPlanId) === planId || String(g.pkrPlanId) === planId || String(g.eurPlanId) === planId
            );
            if (group) {
                if (group.usdPlanId) ids.add(String(group.usdPlanId));
                if (group.pkrPlanId) ids.add(String(group.pkrPlanId));
                if (group.eurPlanId) ids.add(String(group.eurPlanId));
            }
        }
        return ids;
    }, [settings.planEquivalencyGroups]);

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>) => {
        if (!user) return null;
        
        const findLevel = (sponsor: string, targetId: string, currentLvl: number): number => {
            const directs = users.filter(u => u.sponsor === sponsor);
            if (directs.some(u => u._id === targetId)) return currentLvl;
            for (const d of directs) {
                const lvl = findLevel(d.username, targetId, currentLvl + 1);
                if (lvl > 0) return lvl;
            }
            return 0;
        };
        const level = findLevel(user.username, referral._id, 1);

        const referralComms = transactions.filter(t => 
            String(t.userId) === String(user._id) &&
            t.type === 'Commission' &&
            t.sourceUserId && String(t.sourceUserId) === String(referral._id)
        );

        const contextComms = referralComms.filter(t => {
            if (contextPlanIds.size === 0) return true;
            if (!t.relatedPlanId) return false;
            return contextPlanIds.has(String(t.relatedPlanId));
        });

        const earned = contextComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = contextComms.filter(t => t.status === 'Pending' && !t.description.toLowerCase().includes('overflow')).reduce((sum, t) => sum + t.amount, 0);
        const overflow = contextComms.filter(t => t.description.toLowerCase().includes('overflow')).reduce((sum, t) => sum + t.amount, 0);
        
        const isOverflow = (overflow > 0) && (earned === 0 && held === 0);

        return { earned, held, overflow, history: contextComms, isOverflow, level };
    }, [user, transactions, users]);

    const networkAnalytics = useMemo(() => {
        if (!user) return null;
        const equivIds = getEquivalentIds(selectedPlanId);

        const buildTree = (sponsorUsername: string, level: number): any[] => {
            const children = users.filter(u => u.sponsor === sponsorUsername);
            return children.map(child => ({
                user: child,
                children: buildTree(child.username, level + 1),
                level,
                info: getCommissionInfoForReferral(child, equivIds)
            }));
        };

        const fullTree = buildTree(user.username, 1);
        const flattened: any[] = [];
        const flatten = (nodes: any[]) => nodes.forEach(n => { flattened.push(n); flatten(n.children); });
        flatten(fullTree);

        const earned = flattened.reduce((sum, n) => sum + (n.info?.earned || 0), 0);
        const held = flattened.reduce((sum, n) => sum + (n.info?.held || 0), 0);
        const directs = flattened.filter(n => n.level === 1).length;

        return { tree: fullTree, flat: flattened, stats: { earned, held, directs } };
    }, [user, selectedPlanId, users, getEquivalentIds, getCommissionInfoForReferral]);

    const renderReferralCard = (node: any) => {
        const { user: refUser, info, level } = node;
        const symbol = currencySymbols[user?.currency || 'USD'];
        
        return (
            <div className={`p-4 rounded-3xl border mb-4 bg-gray-50 dark:bg-gray-900 border-l-8 ${info.held > 0 ? 'border-l-orange-500' : info.isOverflow ? 'border-l-red-500' : level === 1 ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-black">{refUser.username.charAt(0).toUpperCase()}</div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">@{refUser.username} <span className="text-[10px] text-gray-500 ml-1 uppercase">Lvl {level}</span></p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{refUser.fullName}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-gray-400 uppercase">Scoped Earnings</p>
                        <p className={`font-black ${info.earned > 0 ? 'text-green-600' : 'text-gray-400'}`}>{symbol} {info.earned.toFixed(2)}</p>
                        {info.held > 0 && <p className="text-[9px] font-bold text-orange-500">Held: {symbol}{info.held.toFixed(2)}</p>}
                    </div>
                </div>
            </div>
        );
    };

    const renderTreeItem = (node: any) => (
        <li key={node.user._id} className="relative pl-6 pt-4">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 -ml-3"></div>
            <div className="absolute left-0 top-8 w-4 h-px bg-gray-200 dark:bg-gray-700 -ml-3"></div>
            {renderReferralCard(node)}
            {node.children.length > 0 && <ul className="ml-4">{node.children.map((c: any) => renderTreeItem(c))}</ul>}
        </li>
    );

    const activatablePlans = useMemo(() => {
        if (!user) return [];
        const currentOwnedPlanIds = (formData.activePlans || []).map(p => p.planId.toString());
        return investmentPlans.filter(p => p.status === 'Active' && p.currency === user.currency && !currentOwnedPlanIds.includes(p._id.toString()));
    }, [user, investmentPlans, formData.activePlans]);

    return (
         <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[95vw] max-w-5xl h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">{user ? `Manage Member: @${user.username}` : 'Create Member'}</h2>
                    {user && (
                        <div className="flex gap-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-gray-400">Scoped Balance</p>
                                <p className="text-xl font-black text-green-600">{formatCurrency(user.walletBalance, user.currency)}</p>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    <nav className="-mb-px flex space-x-2">
                        <TabButton tabId="profile">Basic Profile</TabButton>
                        {user && <TabButton tabId="permissions">Security & Controls</TabButton>}
                        {user && <TabButton tabId="team">Team & Hierarchy</TabButton>}
                        {user && <TabButton tabId="network">My Network</TabButton>}
                        {user && <TabButton tabId="transactions">Financials</TabButton>}
                        {user && <TabButton tabId="commissions">Commissions</TabButton>}
                        {user && <TabButton tabId="activity">Action Logs</TabButton>}
                    </nav>
                </div>

                <div className="flex-grow overflow-y-auto pt-6 space-y-6 px-1 custom-scrollbar">
                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                               <h3 className="font-black text-xs uppercase text-gray-500 tracking-widest">Public Information</h3>
                               <div className="space-y-3">
                                   <div><label className="text-[10px] font-bold text-gray-400 uppercase">Legal Name</label><input name="fullName" value={formData.fullName || ''} onChange={handleFormChange} placeholder="Full Name" className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                   <div><label className="text-[10px] font-bold text-gray-400 uppercase">System ID (Username)</label><input name="username" value={formData.username || ''} onChange={handleFormChange} disabled={!!user} className="w-full rounded-md dark:bg-gray-700 mt-1 bg-gray-100 dark:bg-gray-800/50 cursor-not-allowed" /></div>
                                   <div><label className="text-[10px] font-bold text-gray-400 uppercase">Primary Email</label><input name="email" value={formData.email || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Phone</label><input name="phone" value={formData.phone || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">WhatsApp</label><input name="whatsapp" value={formData.whatsapp || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                    </div>
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase">Country</label><select name="country" value={formData.country || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700 mt-1">{countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div>

                                    {/* Custom Fields */}
                                    {settings?.signUpConfig?.customFields && settings.signUpConfig.customFields.length > 0 && (
                                        <div className="border-t dark:border-gray-700 pt-3 mt-3 space-y-3">
                                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dynamic Form Custom Fields</p>
                                            {settings.signUpConfig.customFields.map((field: any) => (
                                                <div key={field.id}>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">{field.label}</label>
                                                    {field.type === 'checkbox' ? (
                                                        <label className="flex items-center gap-2 mt-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                                            <input 
                                                                type="checkbox"
                                                                checked={formData.customFields?.[field.id] === 'true'}
                                                                onChange={(e) => handleCustomFieldChange(field.id, e.target.checked ? 'true' : 'false')}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span>{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                                                        </label>
                                                    ) : field.type === 'select' ? (
                                                        <select
                                                            value={formData.customFields?.[field.id] || ''}
                                                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                            className="w-full rounded-md dark:bg-gray-700 mt-1 text-sm font-bold"
                                                        >
                                                            <option value="">Select Option</option>
                                                            {(field.options || '').split(',').map((opt: string) => {
                                                                const trimmedOpt = opt.trim();
                                                                return (
                                                                    <option key={trimmedOpt} value={trimmedOpt}>
                                                                        {trimmedOpt}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type={field.type}
                                                            value={formData.customFields?.[field.id] || ''}
                                                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                            className="w-full rounded-md dark:bg-gray-700 mt-1 text-sm"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                               </div>
                            </div>
                            {user && (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 dark:bg-gray-700/30 p-5 rounded-2xl border dark:border-gray-600">
                                        <h3 className="font-black text-xs uppercase text-gray-500 tracking-widest mb-4">Direct Wallet Adjustment</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Amount</label><input type="number" value={walletAdjAmount} onChange={(e) => setWalletAdjAmount(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1 font-mono font-bold" placeholder="0.00" /></div>
                                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Admin Ref</label><input type="text" value={walletAdjReason} onChange={(e) => setWalletAdjReason(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-4">
                                            <Button variant="success" onClick={() => handleWalletAdjustment('credit')} disabled={isSaving}>Credit (+)</Button>
                                            <Button variant="danger" onClick={() => handleWalletAdjustment('debit')} disabled={isSaving}>Debit (-)</Button>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                        <h3 className="font-black text-xs uppercase text-indigo-500 tracking-widest mb-4">Global Status Override</h3>
                                        <select name="status" value={formData.status} onChange={handleFormChange} className="w-full rounded-xl dark:bg-gray-800 dark:border-gray-700 font-bold">
                                            {Object.values(Status).filter(s => ['Active', 'Blocked', 'Pending', 'Paused'].includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                                        <h3 className="font-black text-xs uppercase text-blue-600 dark:text-blue-400 tracking-widest">Sign Up & Activation Dates</h3>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Registration Date & Time (Sign Up)</label>
                                            <input 
                                                type="text" 
                                                disabled 
                                                value={user?.registrationDate ? new Date(user.registrationDate).toLocaleString() : 'N/A'} 
                                                className="w-full rounded-md dark:bg-gray-800 dark:border-gray-700 mt-1 bg-gray-100 dark:bg-gray-800/50 cursor-not-allowed text-xs font-mono font-bold" 
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Planned Activation Date & Time</label>
                                            <input 
                                                type="datetime-local" 
                                                name="plannedActivationDate" 
                                                value={formData.plannedActivationDate ? new Date(formData.plannedActivationDate).toISOString().slice(0, 16) : ''} 
                                                onChange={handleFormChange} 
                                                className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 mt-1 text-xs font-mono font-bold" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'permissions' && user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-black text-xs uppercase text-gray-500 tracking-widest mb-4">Activity Restrictions</h3>
                                    <p className="text-xs text-gray-400 mb-4">Toggle checkboxes to block specific member capabilities. Checked means the action is BLOCKED.</p>
                                    
                                    <div className="space-y-3">
                                        {[
                                            { key: 'login', label: 'Block Account Access', desc: 'Prevent user from logging in' },
                                            { key: 'deposit', label: 'Block Deposits', desc: 'Disable deposit form for user' },
                                            { key: 'withdrawal', label: 'Block Withdrawals', desc: 'Disable withdrawal form for user' },
                                            { key: 'transfer', label: 'Block Transfers', desc: 'Disable sending funds to others' },
                                            { key: 'purchase', label: 'Block Plan Purchases', desc: 'Disable buying new plans' },
                                            { key: 'earning', label: 'Block Commissions', desc: 'Pause all referral earnings' },
                                            { key: 'dispute', label: 'Block Disputes', desc: 'Prevent opening new support tickets' },
                                        ].map((item) => (
                                            <div key={item.key} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 shadow-sm">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</p>
                                                    <p className="text-[10px] text-gray-500">{item.desc}</p>
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!formData.restrictions?.[item.key as keyof UserRestrictions]} 
                                                    onChange={() => handleRestrictionsChange(item.key as keyof UserRestrictions)}
                                                    className="w-5 h-5 rounded text-red-600 focus:ring-red-500 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border dark:border-gray-700 shadow-sm">
                                    <h3 className="font-black text-xs uppercase text-gray-500 tracking-widest mb-4">Password Security</h3>
                                    <div className="space-y-4">
                                        <p className="text-xs text-gray-500 leading-relaxed">Generate a one-time secure link to allow the user to reset their password without admin knowing the new one.</p>
                                        
                                        {!resetLink ? (
                                            <Button 
                                                variant="secondary" 
                                                className="w-full py-3 rounded-2xl font-bold text-xs uppercase tracking-widest"
                                                onClick={handleGenerateResetLink}
                                                disabled={isGeneratingLink}
                                            >
                                                {isGeneratingLink ? 'Generating...' : 'Generate Reset Link'}
                                            </Button>
                                        ) : (
                                            <div className="space-y-4 animate-slide-up">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Generated Reset Link</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            readOnly 
                                                            value={resetLink} 
                                                            className="flex-grow text-xs font-mono p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-xl"
                                                        />
                                                        <Button size="sm" onClick={() => { navigator.clipboard.writeText(resetLink); alert('Reset link copied!'); }}>Copy</Button>
                                                    </div>
                                                </div>

                                                {/* Dispatch channels selection */}
                                                <div className="space-y-2 border-t dark:border-gray-700 pt-3">
                                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Choose Send Channels (Select Multiple)</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            { id: 'email', label: 'Email', value: formData.email, placeholder: 'No Email' },
                                                            { id: 'whatsapp', label: 'WhatsApp', value: formData.whatsapp || formData.phone, placeholder: 'No WhatsApp' },
                                                            { id: 'whatsapp_business', label: 'WhatsApp Business', value: formData.whatsapp || formData.phone, placeholder: 'No WA Business' }
                                                        ].map((ch) => {
                                                            const isSelected = selectedChannels.includes(ch.id);
                                                            return (
                                                                <button
                                                                    key={ch.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (isSelected) {
                                                                            setSelectedChannels(selectedChannels.filter(c => c !== ch.id));
                                                                        } else {
                                                                            setSelectedChannels([...selectedChannels, ch.id]);
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                                                        isSelected 
                                                                            ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400' 
                                                                            : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isSelected}
                                                                        readOnly
                                                                        className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                                                                    />
                                                                    <span>{ch.label}</span>
                                                                    {ch.value ? (
                                                                        <span className="opacity-60 text-[10px] font-mono font-medium">({ch.value})</span>
                                                                    ) : (
                                                                        <span className="text-amber-500 text-[9px] font-medium font-mono">({ch.placeholder})</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Customizable message preview */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Custom Message Template</label>
                                                    <textarea
                                                        value={customMessage}
                                                        onChange={(e) => setCustomMessage(e.target.value)}
                                                        rows={4}
                                                        className="w-full text-xs p-3 rounded-xl dark:bg-gray-900 border dark:border-gray-600 font-sans leading-relaxed focus:ring-0"
                                                        placeholder="Write password reset notification message here..."
                                                    />
                                                </div>

                                                {/* Send Actions */}
                                                <div className="space-y-2 border-t dark:border-gray-700 pt-3">
                                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Action Center</label>
                                                    <div className="flex flex-col gap-2">
                                                        {selectedChannels.includes('email') && (
                                                            <a 
                                                                href={`mailto:${formData.email || ''}?subject=${encodeURIComponent('Password Reset Request - SmartEarning')}&body=${encodeURIComponent(customMessage)}`}
                                                                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md transition-colors text-center"
                                                            >
                                                                📬 Send via Email
                                                            </a>
                                                        )}
                                                        {selectedChannels.includes('whatsapp') && (
                                                            <a 
                                                                href={`https://api.whatsapp.com/send?phone=${(() => {
                                                                    const phoneStr = formData.whatsapp || formData.phone || '';
                                                                    const digits = phoneStr.replace(/\D/g, '');
                                                                    return digits.startsWith('0') && digits.length === 11 ? '92' + digits.slice(1) : digits;
                                                                })()}&text=${encodeURIComponent(customMessage)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors text-center"
                                                            >
                                                                💬 Send via WhatsApp
                                                            </a>
                                                        )}
                                                        {selectedChannels.includes('whatsapp_business') && (
                                                            <a 
                                                                href={`https://wa.me/${(() => {
                                                                    const phoneStr = formData.whatsapp || formData.phone || '';
                                                                    const digits = phoneStr.replace(/\D/g, '');
                                                                    return digits.startsWith('0') && digits.length === 11 ? '92' + digits.slice(1) : digits;
                                                                })()}/?text=${encodeURIComponent(customMessage)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors text-center"
                                                            >
                                                                💼 Send via WhatsApp Business
                                                            </a>
                                                        )}
                                                        <Button 
                                                            type="button" 
                                                            variant="secondary"
                                                            className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(customMessage);
                                                                alert('Message text copied to clipboard!');
                                                            }}
                                                        >
                                                            📋 Copy Message Text
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center pt-2">
                                                    <p className="text-[9px] text-amber-600 font-bold uppercase italic">* Valid for 48 hours.</p>
                                                    <Button variant="secondary" size="sm" onClick={() => setResetLink('')}>Generate New</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/40">
                                    <h3 className="font-black text-xs uppercase text-blue-600 dark:text-blue-300 tracking-widest mb-4">Public Visibility</h3>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Exclude from Activity Ticker</p>
                                            <p className="text-[10px] text-gray-500 max-w-[200px]">Hide this user's deposits, withdrawals, and joins from the homepage ticker.</p>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={!!formData.restrictions?.excludeFromTicker} 
                                            onChange={() => handleRestrictionsChange('excludeFromTicker')}
                                            className="w-6 h-6 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && user && (
                        <div className="flex flex-col gap-6 animate-fade-in">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border dark:border-blue-800 text-center">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Team Size</p>
                                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{teamData.stats.total}</p>
                                </div>
                                <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border dark:border-green-800 text-center">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Network Revenue</p>
                                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{formatCurrency(teamData.stats.revenue, user.currency)}</p>
                                </div>
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border dark:border-purple-800 text-center">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Active Earners</p>
                                    <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{teamData.stats.active}</p>
                                </div>
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border dark:border-indigo-800 text-center">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Team Sponsor</p>
                                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 truncate">@{user.sponsor || 'None'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border dark:border-gray-600">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setIsTreeView(true)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isTreeView ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>Hierarchy Tree</button>
                                            <button onClick={() => setIsTreeView(false)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isTreeView ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>Flat Audit List</button>
                                        </div>
                                        <div className="flex-grow max-w-md w-full relative">
                                            <input 
                                                type="text" 
                                                placeholder="Search members..." 
                                                className="w-full text-xs font-bold rounded-xl dark:bg-gray-800 dark:border-gray-700 pl-8" 
                                                value={teamSearch}
                                                onChange={e => setTeamSearch(e.target.value)}
                                            />
                                            <svg className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                        </div>
                                    </div>

                                    {drilldownMemberId ? (
                                        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-[2.5rem] p-6 animate-slide-up">
                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <h4 className="text-xl font-black text-gray-900 dark:text-white">Earnings from @{users.find(u => u._id === drilldownMemberId)?.username}</h4>
                                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Transaction audit trail for Managed User</p>
                                                </div>
                                                <button onClick={() => setDrilldownMemberId(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors">Close Drilldown</button>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="sticky top-0 bg-white dark:bg-gray-900 text-gray-400 uppercase font-black tracking-widest border-b dark:border-gray-700">
                                                        <tr>
                                                            <th className="py-3 px-4">Date</th>
                                                            <th className="py-3 px-4">Level</th>
                                                            <th className="py-3 px-4">Description</th>
                                                            <th className="py-3 px-4 text-right">Earning</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y dark:divide-gray-800">
                                                        {drilldownTransactions.length > 0 ? drilldownTransactions.map(tx => (
                                                            <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                                <td className="py-3 px-4 font-mono text-gray-400">{new Date(tx.date).toLocaleDateString()}</td>
                                                                <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full font-black ${tx.level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>L{tx.level}</span></td>
                                                                <td className="py-3 px-4 italic opacity-80">{tx.description}</td>
                                                                <td className="py-3 px-4 text-right font-black text-green-600">+{formatCurrency(tx.amount, user.currency)}</td>
                                                            </tr>
                                                        )) : (
                                                            <tr><td colSpan={4} className="py-12 text-center text-gray-500 italic">No commission earnings recorded from this member for the Managed User.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border dark:border-gray-700 h-[450px] overflow-y-auto custom-scrollbar">
                                            {isTreeView ? (
                                                <ul className="space-y-4">
                                                    {teamData.tree.length > 0 ? teamData.tree.map(node => renderTeamTreeNode(node)) : <p className="text-center py-20 text-gray-500 italic">No network downline detected.</p>}
                                                </ul>
                                            ) : (
                                                <div className="space-y-3">
                                                    {filteredFlatDownline.length > 0 ? filteredFlatDownline.map((item, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700 hover:border-blue-400 transition-all">
                                                            <div className="flex items-center gap-4">
                                                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${item.level === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>L{item.level}</span>
                                                                <div>
                                                                    <p className="font-bold text-gray-900 dark:text-white">@{item.user.username} <span className="text-[10px] text-gray-400 ml-1">({item.user.fullName})</span></p>
                                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Impact: <span className="text-green-600">+{formatCurrency(item.revenueGenerated, user.currency)}</span></p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 mt-3 sm:mt-0">
                                                                <button onClick={() => setDrilldownMemberId(item.user._id)} className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700">Audit Earnings</button>
                                                                <button onClick={() => onNavigateToUser?.(item.user)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-black uppercase tracking-widest rounded-lg">Profile</button>
                                                            </div>
                                                        </div>
                                                    )) : <p className="text-center py-20 text-gray-500 italic">No matching members found.</p>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="lg:col-span-1 space-y-6">
                                     <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/50 h-fit shadow-lg">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2">
                                            <span className="text-xl">💼</span> Live Plan Portfolio
                                        </h4>
                                        <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mb-4 font-black uppercase tracking-widest">Active Member Assets</p>
                                        
                                        <div className="space-y-3">
                                            {formData.activePlans && formData.activePlans.length > 0 ? formData.activePlans.map((p, idx) => (
                                                <div key={p.planId + idx} className="p-4 bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 flex justify-between items-center shadow-sm group hover:border-red-400 transition-all">
                                                    <div>
                                                        <p className="font-black text-indigo-700 dark:text-indigo-400 uppercase text-[11px] tracking-tight">{p.planName}</p>
                                                        <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">{formatCurrency(p.price, user?.currency)}</p>
                                                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mt-1">Acquired: {new Date(p.purchaseDate).toLocaleDateString()}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRemovePlan(p.planId)} 
                                                        className="text-gray-300 hover:text-red-600 p-2.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-all"
                                                        title="Strip Plan Access"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            )) : (
                                                <div className="text-center py-10 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-3xl text-xs text-indigo-400 italic font-bold">
                                                    No plans active in member portfolio.
                                                </div>
                                            )}
                                        </div>
                                     </div>

                                     <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/50 h-fit shadow-lg">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                            <span className="text-xl">🏆</span> Bonus Upgrade
                                        </h4>
                                        <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mb-4 font-black uppercase tracking-widest">Administrative Reward Portal</p>
                                        
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 tracking-tighter ml-1">Available {user?.currency} Bonus Plans</label>
                                                <select 
                                                    value={activationPlanId} 
                                                    onChange={e => setActivationPlanId(e.target.value)}
                                                    className="w-full rounded-2xl dark:bg-gray-800 dark:border-gray-700 text-sm font-bold p-3 border-blue-200"
                                                >
                                                    <option value="">-- Choose Reward Plan --</option>
                                                    {activatablePlans.map(p => (
                                                        <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, p.currency)})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={() => handleManualActivatePlan(true)} 
                                                    disabled={isActivatingPlan || !activationPlanId}
                                                    className="flex-1 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/20 py-4 rounded-2xl font-black uppercase text-xs tracking-widest border-0"
                                                >
                                                    {isActivatingPlan ? 'Processing...' : 'Grant Bonus'}
                                                </Button>
                                                <Button 
                                                    onClick={() => handleManualActivatePlan(false)} 
                                                    disabled={isActivatingPlan || !activationPlanId}
                                                    variant="secondary"
                                                    className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest"
                                                >
                                                    Standard
                                                </Button>
                                            </div>
                                            <p className="text-[9px] text-gray-400 italic text-center px-4 leading-relaxed">
                                                * Granting a bonus bypasses payment and sends commissions to all upline sponsors.
                                            </p>
                                        </div>
                                     </div>

                                     <div className="p-6 bg-gray-50 dark:bg-gray-700/30 rounded-[2.5rem] border dark:border-gray-600">
                                        <h4 className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-4">Upline / Referral Sponsor</h4>
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-grow">
                                                <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Current Sponsor Username</label>
                                                <input value={newSponsorUsername} onChange={e => setNewSponsorUsername(e.target.value)} className="w-full rounded-xl dark:bg-gray-800 dark:border-gray-700 mt-1 font-bold text-sm" />
                                            </div>
                                            <Button variant="secondary" onClick={() => setNewSponsorUsername('')} size="sm" className="mb-0.5 rounded-xl">Clear</Button>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'network' && user && networkAnalytics && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col md:flex-row justify-between gap-6">
                                <div className="flex-grow bg-[#0f172a] p-6 rounded-[2.5rem] border border-gray-800 shadow-xl">
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {uniqueActivePlans.map(p => (
                                            <button key={p.planId} onClick={() => setSelectedPlanId(p.planId)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border-2 ${selectedPlanId === p.planId ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}>{p.planName}</button>
                                        ))}
                                        {uniqueActivePlans.length === 0 && <span className="text-gray-500 text-sm font-bold italic">User has no active plan scope.</span>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 shrink-0">
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 text-center shadow-sm">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Earned</p>
                                        <p className="text-lg font-black text-green-600">{formatCurrency(networkAnalytics.stats.earned, user.currency)}</p>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 text-center shadow-sm">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Held</p>
                                        <p className="text-lg font-black text-orange-500">{formatCurrency(networkAnalytics.stats.held, user.currency)}</p>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 text-center shadow-sm">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Direct Team</p>
                                        <p className="text-lg font-black text-blue-600">{networkAnalytics.stats.directs}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-[2rem] border dark:border-gray-700 flex flex-wrap gap-1 justify-center">
                                {[
                                    { id: 'earning', label: 'Earning List' },
                                    { id: 'all', label: 'All Referrals' },
                                    { id: 'held', label: 'Held Funds' },
                                    { id: 'tree', label: 'Gen. Tree' },
                                    { id: 'overflow', label: 'Overflow' },
                                    { id: 'inactive', label: 'Inactive' }
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setNetworkViewMode(tab.id as any)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${networkViewMode === tab.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{tab.label}</button>
                                ))}
                            </div>

                            <div className="min-h-[400px]">
                                {networkViewMode === 'earning' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {networkAnalytics.flat.filter(n => n.info.earned > 0).map(n => renderReferralCard(n))}
                                        {networkAnalytics.flat.filter(n => n.info.earned > 0).length === 0 && <p className="col-span-full py-20 text-center text-gray-400 font-bold italic">No active earners found in this scope.</p>}
                                    </div>
                                )}
                                {networkViewMode === 'all' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {networkAnalytics.flat.filter(n => !n.info.isOverflow && (n.info.earned > 0 || n.info.held > 0)).map(n => renderReferralCard(n))}
                                    </div>
                                )}
                                {networkViewMode === 'held' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {networkAnalytics.flat.filter(n => n.info.held > 0).map(n => renderReferralCard(n))}
                                    </div>
                                )}
                                {networkViewMode === 'tree' && (
                                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border dark:border-gray-700 shadow-inner">
                                        {networkAnalytics.tree.length > 0 ? <ul className="space-y-4">{networkAnalytics.tree.map(n => renderTreeItem(n))}</ul> : <p className="py-20 text-center text-gray-400 italic">Empty genealogy.</p>}
                                    </div>
                                )}
                                {networkViewMode === 'overflow' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {networkAnalytics.flat.filter(n => n.info.isOverflow).map(n => renderReferralCard(n))}
                                    </div>
                                )}
                                {networkViewMode === 'inactive' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {networkAnalytics.flat.filter(n => !n.user.activePlans || n.user.activePlans.length === 0).map(n => renderReferralCard(n))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'transactions' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold">Transaction History Ledger</h3>
                                <div className="flex gap-2">
                                     <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} className="text-xs rounded-lg dark:bg-gray-700 border-gray-300 py-1"><option value="">All Types</option>{transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                     <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="text-xs rounded-lg dark:bg-gray-700 border-gray-300 py-1"><option value="">All Status</option><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Rejected">Rejected</option></select>
                                </div>
                            </div>
                            
                            <div className="overflow-hidden rounded-2xl border dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
                                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase font-black sticky top-0 z-10 border-b dark:border-gray-700">
                                            <tr><th className="p-4">Date</th><th className="p-4">Type</th><th className="p-4 text-right">Amount</th><th className="p-4 text-center">Status</th><th className="p-4">Description</th></tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-800">
                                            {transactions.filter(t => t.userId === user._id).map(tx => (
                                                <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <td className="p-4 font-mono text-gray-400">{new Date(tx.date).toLocaleDateString()}</td>
                                                    <td className="p-4 font-bold">{tx.type}</td>
                                                    <td className={`p-4 text-right font-black ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount, tx.currency)}</td>
                                                    <td className="p-4 text-center"><Badge status={tx.status as Status || Status.Approved} /></td>
                                                    <td className="p-4 opacity-80 italic">{tx.description}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'commissions' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <h3 className="text-xl font-bold">Referral Commission Ledger</h3>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Detailed history of all earnings generated by team activity</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Commission Earnings</p>
                                    <p className="text-2xl font-black text-green-600">{formatCurrency(transactions.filter(t => t.userId === user._id && t.type === 'Commission').reduce((sum, t) => sum + t.amount, 0), user.currency)}</p>
                                </div>
                            </div>
                            
                            <div className="overflow-hidden rounded-2xl border dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
                                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-black uppercase sticky top-0 border-b dark:border-gray-700 z-10">
                                            <tr>
                                                <th className="p-4">Date</th>
                                                <th className="p-4">Level</th>
                                                <th className="p-4">Source Referral</th>
                                                <th className="p-4 text-right">Earning</th>
                                                <th className="p-4 text-center">Status</th>
                                                <th className="p-4">Plan Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-800">
                                            {transactions.filter(t => t.userId === user._id && t.type === 'Commission').length > 0 ? transactions.filter(t => t.userId === user._id && t.type === 'Commission').map(comm => {
                                                const sourceUser = users.find(u => u._id === comm.sourceUserId);
                                                return (
                                                    <tr key={comm._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                        <td className="p-4 font-mono text-gray-400">{new Date(comm.date).toLocaleDateString()}</td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${comm.level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>L{comm.level}</span>
                                                        </td>
                                                        <td className="p-4 font-bold text-gray-800 dark:text-white">@{sourceUser?.username || 'Unknown'}</td>
                                                        <td className="p-4 text-right font-black text-green-600 text-sm">{formatCurrency(comm.amount, user.currency)}</td>
                                                        <td className="p-4 text-center"><Badge status={comm.status as Status || Status.Approved} /></td>
                                                        <td className="p-4 opacity-70 italic">{comm.description.split('from')[0].trim()}</td>
                                                    </tr>
                                                );
                                            }) : (
                                                <tr><td colSpan={6} className="p-12 text-center text-gray-500 italic text-sm">No commissions recorded.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'activity' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <h3 className="text-lg font-bold">System Log Audit Trail</h3>
                            <div className="overflow-hidden rounded-2xl border dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
                                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-black uppercase sticky top-0 z-10 border-b dark:border-gray-700">
                                            <tr><th className="p-4">Timestamp</th><th className="p-4">Action</th><th className="p-4">Performed By</th><th className="p-4">Technical Details</th></tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-800">
                                            {logs.filter(l => l.affectedUser === user.username || l.performedBy === user.username).map(log => (
                                                <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <td className="p-4 font-mono text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                                                    <td className="p-4 font-black uppercase tracking-tight">{log.action}</td>
                                                    <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${log.performedBy === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{log.performedBy}</span></td>
                                                    <td className="p-4 opacity-80 italic">{log.details}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-between items-center border-t dark:border-gray-700 pt-6">
                    <div className="flex gap-2">
                        {user && onDeleteRequest && <Button size="sm" variant="danger" onClick={() => onDeleteRequest(user)}>Force Delete User</Button>}
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Discard & Close</Button>
                        <Button type="button" onClick={handleSaveChanges} disabled={isSaving} className="px-10 shadow-xl shadow-blue-500/20">
                            {isSaving ? 'Processing...' : 'Commit All Updates'}
                        </Button>
                    </div>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 20px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; }
            `}</style>
        </Modal>
    );
};

interface BulkRestrictionsModalProps {
    allUsers: User[];
    investmentPlans: InvestmentPlan[];
    onClose: () => void;
}

const BulkRestrictionsModal: React.FC<BulkRestrictionsModalProps> = ({ allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [targetType, setTargetType] = useState<'all' | 'plan' | 'single'>('all');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [restrictions, setRestrictions] = useState<Partial<UserRestrictions>>({
        deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false
    });
    const [action, setAction] = useState<'enable' | 'disable' | 'toggle'>('enable');
    const [sendNotification, setSendNotification] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApply = async () => {
        if (targetType === 'plan' && targetIds.length === 0) return alert('Select at least one plan');
        setIsProcessing(true);
        try {
            await bulkUpdateUserRestrictions({ targetType, targetIds, restrictions, action, sendNotification });
            const updatedUsers = await getUsers();
            dispatch({ type: 'SET_USERS', payload: updatedUsers });
            alert('Bulk update completed successfully');
            onClose();
        } catch (err: any) {
            alert(err.message || 'Operation failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleRestriction = (key: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const togglePlan = (id: string) => {
        setTargetIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[500px] max-w-full space-y-6">
                <h3 className="text-xl font-bold">Bulk Restrictions Manager</h3>
                <section>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">1. Select Target Users</label>
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => setTargetType('all')} className={`flex-1 py-2 px-3 text-sm rounded border ${targetType === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700'}`}>All Users</button>
                        <button onClick={() => setTargetType('plan')} className={`flex-1 py-2 px-3 text-sm rounded border ${targetType === 'plan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700'}`}>By Plan</button>
                    </div>
                    {targetType === 'plan' && (
                        <div className="max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-1 gap-1">
                            {investmentPlans.map(plan => (
                                <label key={plan._id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer text-sm">
                                    <input type="checkbox" checked={targetIds.includes(plan._id)} onChange={() => togglePlan(plan._id)} className="rounded" />
                                    <span>{plan.name} ({plan.currency})</span>
                                </label>
                            ))}
                        </div>
                    )}
                </section>
                <section>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">2. Select Restrictions to Affect</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.keys(restrictions).map(key => (
                            <label key={key} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer text-sm">
                                <input type="checkbox" checked={!!(restrictions as any)[key]} onChange={() => toggleRestriction(key as any)} className="rounded" />
                                <span className="capitalize">{key}</span>
                            </label>
                        ))}
                    </div>
                </section>
                <section>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">3. Action</label>
                    <select value={action} onChange={e => setAction(e.target.value as any)} className="w-full border rounded p-2 text-sm">
                        <option value="enable">Enable Restrictions (BLOCK activity)</option>
                        <option value="disable">Disable Restrictions (ALLOW activity)</option>
                        <option value="toggle">Invert Current Status</option>
                    </select>
                </section>
                <div className="pt-4 border-t flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={sendNotification} onChange={e => setSendNotification(e.target.checked)} className="rounded" />
                        Send notification to affected users
                    </label>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleApply} disabled={isProcessing}>{isProcessing ? 'Processing...' : 'Apply Bulk Update'}</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

interface BulkDummyUserModalProps {
    users: User[];
    investmentPlans: InvestmentPlan[];
    onClose: () => void;
}

const BulkDummyUserModal: React.FC<BulkDummyUserModalProps> = ({ users, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [count, setCount] = useState('10');
    const [customUsernames, setCustomUsernames] = useState('');
    const [sponsor, setSponsor] = useState('');
    const [balance, setBalance] = useState('0');
    const [country, setCountry] = useState(countries[0]);
    const [currency, setCurrency] = useState<Currency>('PKR');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCreate = async () => {
        if (!sponsor) return alert('Sponsor username is required');
        
        const usernameList = customUsernames.split('\n').map(u => u.trim()).filter(u => u !== '');
        
        setIsProcessing(true);
        try {
            await createBulkDummyUsers({ 
                count: usernameList.length > 0 ? usernameList.length : parseInt(count), 
                usernames: usernameList.length > 0 ? usernameList : undefined,
                sponsor, 
                balance: parseFloat(balance), 
                country, 
                currency 
            });
            const updatedUsers = await getUsers();
            dispatch({ type: 'SET_USERS', payload: updatedUsers });
            alert('Bulk dummy user generation process completed.');
            onClose();
        } catch (err: any) {
            alert(err.message || 'Operation failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[550px] max-w-full space-y-4">
                <h3 className="text-xl font-bold">Bulk Dummy User Generator</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Number of Random Users</label>
                        <input 
                            type="number" 
                            value={count} 
                            onChange={e => setCount(e.target.value)} 
                            disabled={customUsernames.trim().length > 0}
                            className={`w-full border rounded p-2 text-sm dark:bg-gray-700 ${customUsernames.trim().length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`} 
                        />
                    </div>
                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Initial Balance</label><input type="number" value={balance} onChange={e => setBalance(e.target.value)} className="w-full border rounded p-2 text-sm dark:bg-gray-700" /></div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Custom Usernames (optional, one per line)</label>
                    <textarea 
                        value={customUsernames} 
                        onChange={e => setCustomUsernames(e.target.value)} 
                        rows={3}
                        placeholder="pro_investor&#10;crypto_king&#10;earning_master"
                        className="w-full border rounded p-2 text-sm dark:bg-gray-700 font-mono"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 italic">If provided, the "Number of Users" field will be ignored.</p>
                </div>

                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Sponsor Username</label><input type="text" value={sponsor} onChange={e => setSponsor(e.target.value)} placeholder="Username of the sponsor" className="w-full border rounded p-2 text-sm dark:bg-gray-700" /></div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Country</label><select value={country} onChange={e => setCountry(e.target.value)} className="w-full border rounded p-2 text-sm dark:bg-gray-700">{countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Currency</label><select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="w-full border rounded p-2 text-sm dark:bg-gray-700"><option value="PKR">PKR</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>
                </div>
                
                <div className="pt-4 border-t flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={isProcessing}>{isProcessing ? 'Generating...' : 'Generate Dummy Users'}</Button>
                </div>
            </div>
        </Modal>
    );
};

interface MessageUserModalProps {
    user: User | null;
    allUsers: User[];
    investmentPlans: InvestmentPlan[];
    onClose: () => void;
}

const MessageUserModal: React.FC<MessageUserModalProps> = ({ user, allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [targetType, setTargetType] = useState<'single' | 'plan' | 'all' | 'inactive'>(user ? 'single' : 'all');
    const [targetIds, setTargetIds] = useState<string[]>(user ? [user._id] : []);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isPopup, setIsPopup] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [randomCount, setRandomCount] = useState('');
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['email', 'whatsapp']);

    const getTargetUsers = () => {
        if (targetType === 'single') {
            return user ? [user] : [];
        }
        let matches = [...allUsers];
        if (targetType === 'plan') {
            matches = matches.filter(u => u.activePlans?.some(ap => targetIds.includes(ap.planId)) || (u.activePlan && targetIds.includes(u.activePlan)));
        } else if (targetType === 'inactive') {
            matches = matches.filter(u => !u.activePlan && (!u.activePlans || u.activePlans.length === 0));
        }
        return matches;
    };

    const targetUsers = getTargetUsers();

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message) return alert('Message is required');
        setIsSending(true);
        try {
            const result = await sendAdminNotification({ 
                userId: targetType === 'single' ? targetIds[0] : undefined, 
                targetType: targetType !== 'single' ? targetType : undefined, 
                targetIds: targetType === 'plan' ? targetIds : undefined, 
                subject, 
                message, 
                isPopup, 
                randomCount: targetType === 'inactive' && randomCount ? parseInt(randomCount) : undefined,
                selectedChannels
            });
            dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            alert(`Message sent successfully.`);
            onClose();
        } catch (err: any) {
            alert(err.message || 'Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    const togglePlan = (id: string) => {
        setTargetIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <form onSubmit={handleSend} className="p-4 w-[500px] max-w-full space-y-4">
                <h3 className="text-xl font-bold">Send Announcement</h3>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Recipients</label>
                    {user ? <div className="p-2 bg-gray-50 rounded border text-sm">Target: <strong>{user.username}</strong></div> : (
                        <div className="space-y-3">
                            <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full border rounded p-2 text-sm">
                                <option value="all">All Members</option>
                                <option value="plan">Members of Specific Plans</option>
                                <option value="inactive">Inactive Members (No active plan)</option>
                            </select>
                            {targetType === 'plan' && (
                                <div className="max-h-32 overflow-y-auto border rounded p-2 grid grid-cols-1 gap-1">
                                    {investmentPlans.map(plan => (
                                        <label key={plan._id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer text-sm">
                                            <input type="checkbox" checked={targetIds.includes(plan._id)} onChange={() => togglePlan(plan._id)} className="rounded" />
                                            <span>{plan.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Subject (Optional)</label><input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border rounded p-2" placeholder="Important Update" /></div>
                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Message Content</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full border rounded p-2" placeholder="Type your message here..." required /></div>
                <div className="flex items-center gap-2"><input type="checkbox" id="popup-chk" checked={isPopup} onChange={e => setIsPopup(e.target.checked)} className="rounded" /><label htmlFor="popup-chk" className="text-sm font-medium cursor-pointer">Display as urgent POPUP for user</label></div>

                {/* Dispatch channels selection */}
                <div className="space-y-2 border-t dark:border-gray-700 pt-3">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Choose Dispatch Channels (Select Multiple)</label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'email', label: 'Email' },
                            { id: 'whatsapp', label: 'WhatsApp' },
                            { id: 'whatsapp_business', label: 'WhatsApp Business' }
                        ].map((ch) => {
                            const isSelected = selectedChannels.includes(ch.id);
                            return (
                                <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedChannels(selectedChannels.filter(c => c !== ch.id));
                                        } else {
                                            setSelectedChannels([...selectedChannels, ch.id]);
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                        isSelected 
                                            ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400' 
                                            : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                                    }`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        readOnly
                                        className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                                    />
                                    <span>{ch.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Recipient Action buttons */}
                {targetUsers.length > 0 && (
                    <div className="space-y-2 border-t dark:border-gray-700 pt-3 max-h-48 overflow-y-auto">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                            Direct Message Dispatch ({targetUsers.length} matched recipient{targetUsers.length > 1 ? 's' : ''})
                        </label>
                        <div className="space-y-2">
                            {targetUsers.map(u => {
                                const userPhone = u.whatsapp || u.phone || '';
                                return (
                                    <div key={u._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border dark:border-gray-700 gap-2">
                                        <div className="text-xs">
                                            <div className="font-bold text-gray-800 dark:text-gray-200">@{u.username} ({u.fullName || 'No Name'})</div>
                                            <div className="text-[10px] text-gray-500 font-mono flex flex-wrap gap-1.5 mt-0.5">
                                                {u.email && <span>📧 {u.email}</span>}
                                                {userPhone && <span>📞 {userPhone}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                                            {selectedChannels.includes('email') && (
                                                <a 
                                                    href={`mailto:${u.email || ''}?subject=${encodeURIComponent(subject || 'Announcement - SmartEarning')}&body=${encodeURIComponent(message)}`}
                                                    className="flex-1 sm:flex-initial text-[10px] font-bold px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-center transition-colors shrink-0"
                                                >
                                                    📬 Email
                                                </a>
                                            )}
                                            {selectedChannels.includes('whatsapp') && (
                                                <a 
                                                    href={`https://api.whatsapp.com/send?phone=${(() => {
                                                        const digits = userPhone.replace(/\D/g, '');
                                                        return digits.startsWith('0') && digits.length === 11 ? '92' + digits.slice(1) : digits;
                                                    })()}&text=${encodeURIComponent(message)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 sm:flex-initial text-[10px] font-bold px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-center transition-colors shrink-0"
                                                >
                                                    💬 WhatsApp
                                                </a>
                                            )}
                                            {selectedChannels.includes('whatsapp_business') && (
                                                <a 
                                                    href={`https://wa.me/${(() => {
                                                        const digits = userPhone.replace(/\D/g, '');
                                                        return digits.startsWith('0') && digits.length === 11 ? '92' + digits.slice(1) : digits;
                                                    })()}/?text=${encodeURIComponent(message)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 sm:flex-initial text-[10px] font-bold px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-center transition-colors shrink-0"
                                                >
                                                    💼 WA Biz
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={onClose} type="button">Cancel</Button><Button type="submit" disabled={isSending}>{isSending ? 'Sending...' : 'Send Message'}</Button></div>
            </form>
        </Modal>
    );
};

interface DeleteUserModalProps {
    user: User;
    onClose: () => void;
    onConfirmDelete: (userId: string) => Promise<void>;
    onDownloadDossier: () => void;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onClose, onConfirmDelete, onDownloadDossier }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleConfirm = async () => {
        setIsDeleting(true);
        await onConfirmDelete(user._id);
        setIsDeleting(false);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-96 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 className="text-xl font-bold">Confirm Deletion</h3>
                <p className="text-sm text-gray-500">Are you sure you want to permanently delete user <strong className="text-gray-900">@{user.username}</strong>? This action is irreversible.</p>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                    <strong>Tip:</strong> You can download a complete history of this user before deleting.
                </div>

                <div className="space-y-2">
                    <Button className="w-full" variant="secondary" onClick={onDownloadDossier} disabled={isDeleting}>Download User Dossier (CSV)</Button>
                    <div className="flex gap-2">
                        <Button className="flex-1" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                        <Button className="flex-1" variant="danger" onClick={handleConfirm} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Yes, Delete All'}</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default Users;