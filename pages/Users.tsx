import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction, Log, ActivePlan, currencySymbols } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers, adminActivatePlan, createBulkDummyUsers, getUploadsBaseUrl } from '../services/api';
import { mockUsers } from '../data/mockData';

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

const Users: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans, transactions, settings, deposits, withdrawals, transfers } = state;
    const UPLOADS_URL = getUploadsBaseUrl();
    
    // Pagination State
    const [pagedUsers, setPagedUsers] = useState<User[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [isFetchingPaged, setIsFetchingPaged] = useState(false);
    
    const isLoading = isFetchingPaged && pagedUsers.length === 0;
    
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

    // Selection State
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- PAGINATED DATA FETCHING ---
    const fetchPagedUsers = useCallback(async () => {
        setIsFetchingPaged(true);
        try {
            const url = `${getApiBaseUrl()}/users?page=${currentPage}&limit=${limit}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            const result = await response.json();
            if (result.success) {
                setPagedUsers(result.data);
            }
        } catch (error) {
            const isNetwork = error.message?.includes('Failed to fetch') || error.message?.includes('Technical Error');
            if (isNetwork) {
                console.warn("Failed to fetch paginated users: Server offline. Using local directory.");
                // Use a sliced version of mock data as fallback for the UI
                const start = (currentPage - 1) * limit;
                setPagedUsers(mockUsers.slice(start, start + limit));
            } else {
                console.error("Failed to fetch paginated users:", error);
            }
        } finally {
            setIsFetchingPaged(false);
        }
    }, [currentPage, limit]);

    // Re-fetch when page or limit changes
    useEffect(() => {
        fetchPagedUsers();
    }, [fetchPagedUsers]);

    // --- DOSSIER GENERATION LOGIC ---
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
        const directs = state.users.filter(u => u.sponsor === user.username);
        return { totalDeposit: approvedDeposits, totalWithdrawal: paidWithdrawals, totalTransfer: sentTransfers, totalCommission, totalDirectRef: directs.length };
    };

    const handleDownloadDossiers = (ids: string[]) => {
        if (ids.length === 0) return;
        const rows: string[][] = [];
        ids.forEach((userId, index) => {
            const user = state.users.find(u => u._id === userId);
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
        const filename = ids.length === 1 ? `Dossier_PreDelete_${state.users.find(u => u._id === ids[0])?.username}.csv` : `Bulk_Dossiers_PreDelete_${ids.length}_Users.csv`;
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
            setPagedUsers(prev => prev.filter(u => u._id !== userId));
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
                setPagedUsers(prev => prev.filter(u => !selectedUserIds.includes(u._id)));
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
        return pagedUsers.filter(user => {
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
    }, [pagedUsers, searchTerm, statusFilter, planFilter, currencyFilter]);

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

    const handleSelectAll = () => {
        const areAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));
        if (areAllFilteredSelected) {
            const filteredIds = new Set(filteredUsers.map(u => u._id));
            setSelectedUserIds(prev => prev.filter(id => !filteredIds.has(id)));
        } else {
            const currentSelectedSet = new Set(selectedUserIds);
            filteredUsers.forEach(u => currentSelectedSet.add(u._id));
            setSelectedUserIds(Array.from(currentSelectedSet));
        }
    };

    const tableHeaders = ['User', 'Contact', 'Wallet Balance', 'Active Plans', 'Status', 'Actions'];
    const areAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white shrink-0">Member Management</h2>
                <div className="flex flex-wrap items-center gap-2 justify-end w-full">
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
                <div className="py-20 text-center text-gray-500 italic">Loading user directory...</div>
             ) : (
                 <div className="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full whitespace-no-wrap">
                            <thead>
                                <tr className="text-xs font-bold tracking-wide text-left text-gray-500 uppercase border-b dark:border-gray-700 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/50">
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={areAllFilteredSelected && filteredUsers.length > 0}
                                            onChange={handleSelectAll}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    {tableHeaders.map((header) => (
                                        <th key={header} className="px-4 py-3">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y dark:divide-gray-700 dark:bg-gray-800">
                                {filteredUsers.map((user: User) => {
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
                        disabled={pagedUsers.length < limit || isFetchingPaged}
                    >
                        Next
                    </Button>
                </div>
            </div>
            {/* Modals elided for brevity */}
        </div>
    );
};

// FIX: Added missing default export for Users component
export default Users;