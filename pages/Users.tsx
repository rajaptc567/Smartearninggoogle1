
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers, adminActivatePlan, upgradeUserFromHold } from '../services/api';

const transactionTypes = [
    'Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 
    'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 
    'Transfer Received', 'Transfer Request', 'Transfer Refund'
];

const Users: React.FC = () => {
    const { state, dispatch } = useData();
    const { users, investmentPlans } = state;
    
    const isLoading = users.length === 0;
    
    const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
    const [isBulkRestrictionsModalOpen, setIsBulkRestrictionsModalOpen] = useState(false);
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
        if (window.confirm(`Are you sure you want to permanently delete ${selectedUserIds.length} users and all their associated data? This action is irreversible and affects network structure.`)) {
            setIsProcessing(true);
            try {
                await bulkDeleteUsers(selectedUserIds);
                const updatedUsers = await getUsers();
                dispatch({ type: 'SET_USERS', payload: updatedUsers });
                setSelectedUserIds([]);
                alert('Selected users deleted successfully.');
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
        const allFilteredIds = new Set(filteredUsers.map(u => u._id));
        const currentSelectedIds = new Set(selectedUserIds);
        const areAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));

        if (areAllFilteredSelected) {
            allFilteredIds.forEach(id => currentSelectedIds.delete(id));
        } else {
            allFilteredIds.forEach(id => currentSelectedIds.add(id));
        }
        setSelectedUserIds(Array.from(currentSelectedIds));
    };

    const handleDownloadSelected = () => {
        if (selectedUserIds.length === 0) return;
        const usersToExport = users.filter(u => selectedUserIds.includes(u._id));
        
        const csvEscape = (field: any): string => {
            if (field === null || field === undefined) return '""';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return `"${str}"`;
        };

        const csvHeaders = ['Username', 'Full Name', 'Email', 'Phone', 'WhatsApp', 'Country'];
        const csvRows = [
            csvHeaders.join(','),
            ...usersToExport.map(user => [
                csvEscape(user.username),
                csvEscape(user.fullName),
                csvEscape(user.email),
                csvEscape(user.phone),
                csvEscape(user.whatsapp),
                csvEscape(user.country)
            ].join(','))
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `selected_users_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const tableHeaders = ['User', 'Contact', 'Wallet Balance', 'Active Plans', 'Status', 'Actions'];
    const areAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white shrink-0">Members ({filteredUsers.length})</h2>
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
             <div className="flex justify-end gap-2 mb-4">
                 {selectedUserIds.length > 0 && (
                    <>
                        <Button variant="secondary" onClick={handleDownloadSelected}>Download Selected ({selectedUserIds.length})</Button>
                        <Button variant="danger" onClick={handleBulkDelete} disabled={isProcessing}>{isProcessing ? 'Processing...' : `Delete Selected (${selectedUserIds.length})`}</Button>
                    </>
                 )}
                <Button variant="secondary" onClick={() => setIsBulkRestrictionsModalOpen(true)}>Bulk Restrictions</Button>
                <Button variant="secondary" onClick={() => handleOpenMessage(null)}>Send Bulk Message</Button>
                <Button onClick={() => handleOpenUserManagementModal(null)}>Add User</Button>
            </div>
             {isLoading ? <p>Loading users...</p> : (
                 <div className="w-full overflow-hidden rounded-lg shadow-md">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full whitespace-no-wrap">
                            <thead>
                                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b dark:border-gray-700 bg-gray-50 dark:text-gray-400 dark:bg-gray-800">
                                    <th className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={areAllFilteredSelected}
                                            onChange={handleSelectAll}
                                            className="rounded"
                                        />
                                    </th>
                                    {tableHeaders.map((header) => (
                                        <th key={header} className="px-4 py-3">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y dark:divide-gray-700 dark:bg-gray-800">
                                {filteredUsers.map((user: User) => (
                                    <tr key={user._id} className="text-gray-700 dark:text-gray-400">
                                        <td className="px-4 py-3">
                                             <input
                                                type="checkbox"
                                                checked={selectedUserIds.includes(user._id)}
                                                onChange={() => handleSelectUser(user._id)}
                                                className="rounded"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center text-sm">
                                                <div>
                                                    <p className="font-semibold">{user.fullName}</p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400">@{user.username} (ID: {user._id.substring(user._id.length - 6)})</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {user.email}<br/>
                                            <span className="text-xs text-gray-600 dark:text-gray-400">{user.phone}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{formatCurrency(user.walletBalance, user.currency)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {user.activePlans && user.activePlans.length > 0 
                                                ? user.activePlans.map(p => p.planName).join(', ') 
                                                : 'None'}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                           <Badge status={user.status} />
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                                                <Button size="sm" variant="secondary" onClick={() => handleOpenUserManagementModal(user)}>Manage</Button>
                                                <Button size="sm" variant="secondary" onClick={() => handleOpenMessage(user)}>Message</Button>
                                                <Button size="sm" variant="danger" onClick={() => handleOpenDeleteModal(user)}>Delete</Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}
            {isUserManagementModalOpen && (
                <UserManagementModal 
                    user={managingUser}
                    onClose={handleCloseAllModals}
                />
            )}
            {isBulkRestrictionsModalOpen && (
                <BulkRestrictionsModal
                    allUsers={users}
                    investmentPlans={investmentPlans}
                    onClose={handleCloseAllModals}
                />
            )}
            {isMessageModalOpen && (
                <MessageUserModal
                    user={managingUser}
                    allUsers={users}
                    investmentPlans={investmentPlans}
                    onClose={handleCloseAllModals}
                />
            )}
            {isDeleteModalOpen && userToDelete && (
                <DeleteUserModal
                    user={userToDelete}
                    onClose={handleCloseAllModals}
                    onConfirmDelete={handleConfirmDelete}
                />
            )}
        </div>
    );
};

// --- UserManagementModal ---

interface UserManagementModalProps {
    user: User | null;
    onClose: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, onClose }) => {
    const { state, dispatch } = useData();
    const { users, transactions, investmentPlans, settings } = state;

    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'network' | 'strategy' | 'history'>('profile');
    const [formData, setFormData] = useState<Partial<User>>(
        user || { fullName: '', username: '', email: '', phone: '', whatsapp: '', country: '', status: Status.Active, walletBalance: 0, restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false } }
    );
    const [isSaving, setIsSaving] = useState(false);

    // Filter track-equivalent held commissions
    const heldCommissions = useMemo(() => {
        if (!user) return [];
        return transactions.filter(t => 
            t.userId === user._id && 
            t.status === 'Pending' && 
            t.description.toLowerCase().includes('hold commission')
        );
    }, [user, transactions]);

    const upgradeFundSummary = useMemo(() => {
        if (!user) return [];
        const summary: { planId: string; planName: string; totalHeld: number; targetPlan?: string; targetPrice?: number; transactions: Transaction[] }[] = [];
        
        user.activePlans?.forEach(ap => {
            const plan = investmentPlans.find(p => p._id === ap.planId);
            if (!plan?.holdPosition?.enabled) return;
            
            // Collect transactions matching this track
            const relatedHeld = heldCommissions.filter(tx => String(tx.relatedPlanId) === String(ap.planId));
            const totalHeld = relatedHeld.reduce((s, tx) => s + tx.amount, 0);
            
            const targetPlan = investmentPlans.find(p => p._id === plan.autoUpgrade?.toPlanId);

            summary.push({
                planId: ap.planId,
                planName: ap.planName,
                totalHeld,
                targetPlan: targetPlan?.name,
                targetPrice: targetPlan?.price,
                transactions: relatedHeld
            });
        });
        
        return summary;
    }, [user, investmentPlans, heldCommissions]);

    // Wallet Adjustment State
    const [walletAdjAmount, setWalletAdjAmount] = useState('');
    const [walletAdjReason, setWalletAdjReason] = useState('Admin manual adjustment');

    // Security State
    const [resetLink, setResetLink] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);

    // Financial History Filter State
    const [historyTypeFilter, setHistoryTypeFilter] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');

    const handleManualUpgrade = async (fromPlanId: string) => {
        if (!user) return;
        const confirm = window.confirm("FORCE UPGRADE: This will mark all held commissions as 'Approved/Used' and activate the target plan for this user. Continue?");
        if (!confirm) return;

        setIsSaving(true);
        try {
            const result = await upgradeUserFromHold(user._id, fromPlanId, state.currentUser?.username || 'admin');
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setFormData(prev => ({ ...prev, activePlans: result.user.activePlans }));
            alert("Upgrade successful!");
        } catch (error) {
            console.error(error);
            alert("Upgrade failed: " + (error instanceof Error ? error.message : "Server error"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRestrictionsChange = (key: keyof UserRestrictions) => {
        setFormData(prev => ({
            ...prev,
            restrictions: {
                ...prev.restrictions!,
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
        } catch (error) {
            console.error(error);
            alert(`Failed: ${error instanceof Error ? error.message : 'Could not generate link'}`);
        } finally {
            setIsGeneratingLink(false);
        }
    };
    
    const handleWalletAdjustment = async (action: 'credit' | 'debit') => {
        if (!user) return;
        const numericAmount = parseFloat(walletAdjAmount);
        if (isNaN(numericAmount) || numericAmount <= 0) return alert("Enter a valid amount.");

        const adjustmentAmount = action === 'credit' ? numericAmount : -numericAmount;
        
        setIsSaving(true);
        try {
            const result = await adjustUserWallet(user._id, { amount: adjustmentAmount, description: walletAdjReason });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setFormData(prev => ({ ...prev, walletBalance: result.user.walletBalance })); 
            alert("Success.");
            setWalletAdjAmount('');
        } catch (error) {
            console.error(error);
            alert("Adjustment failed.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const { _id, ...updateData } = formData;
            if (user) {
                const updatedUser = await apiUpdateUser(user._id, updateData);
                dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            } else {
                const newUser = await apiCreateUser({ ...updateData, password: 'password123' } as any);
                dispatch({ type: 'ADD_USER', payload: newUser });
            }
            alert('User saved.');
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    const TabButton: React.FC<{ tabId: typeof activeTab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button type="button" onClick={() => setActiveTab(tabId)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>
    );

    const filteredUserTransactions = useMemo(() => {
        if (!user) return [];
        return transactions
            .filter(t => t.userId === user._id)
            .filter(t => {
                if (historyTypeFilter && t.type !== historyTypeFilter) return false;
                if (historyStatusFilter && (t.status || 'Approved') !== historyStatusFilter) return false;
                const from = historyDateFrom ? new Date(historyDateFrom) : null;
                const to = historyDateTo ? new Date(historyDateTo) : null;
                if (from) from.setHours(0, 0, 0, 0);
                if (to) to.setHours(23, 59, 59, 999);
                const itemDate = new Date(t.date);
                if (from && itemDate < from) return false;
                if (to && itemDate > to) return false;
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [user, transactions, historyTypeFilter, historyStatusFilter, historyDateFrom, historyDateTo]);

    return (
         <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[95vw] max-w-4xl h-[90vh] flex flex-col">
                <h2 className="text-xl font-bold mb-4">{user ? `User Insight: @${user.username}` : 'Add New User'}</h2>
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-4">
                        <TabButton tabId="profile">Basic Profile</TabButton>
                        {user && <TabButton tabId="security">Security</TabButton>}
                        {user && <TabButton tabId="strategy">Strategy & Hold</TabButton>}
                        {user && <TabButton tabId="history">History</TabButton>}
                    </nav>
                </div>

                <div className="flex-grow overflow-y-auto pt-6 space-y-6">
                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="space-y-4">
                               <h3 className="font-bold text-gray-400 uppercase text-xs">Profile Information</h3>
                               <input name="fullName" value={formData.fullName || ''} onChange={handleFormChange} placeholder="Full Name" className="w-full rounded-md dark:bg-gray-700" />
                               <input name="username" value={formData.username || ''} onChange={handleFormChange} placeholder="Username" className="w-full rounded-md dark:bg-gray-700" disabled={!!user} />
                               <input name="email" value={formData.email || ''} onChange={handleFormChange} placeholder="Email" className="w-full rounded-md dark:bg-gray-700" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <input name="phone" value={formData.phone || ''} onChange={handleFormChange} placeholder="Phone" className="w-full rounded-md dark:bg-gray-700" />
                                    <input name="whatsapp" value={formData.whatsapp || ''} onChange={handleFormChange} placeholder="WhatsApp" className="w-full rounded-md dark:bg-gray-700" />
                                </div>
                                <select name="country" value={formData.country || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">
                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select name="status" value={formData.status} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">
                                    {['Active', 'Blocked', 'Pending', 'Paused'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {user && (
                            <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 shadow-inner">
                                <h3 className="font-bold text-gray-400 uppercase text-xs">Wallet Balance</h3>
                                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(formData.walletBalance || 0, formData.currency || 'PKR')}</p>
                                <div>
                                    <label className="text-xs font-bold">Adjustment Amount</label>
                                    <input type="number" value={walletAdjAmount} onChange={(e) => setWalletAdjAmount(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" />
                                </div>
                                 <div>
                                    <label className="text-xs font-bold">Reason</label>
                                    <input type="text" value={walletAdjReason} onChange={(e) => setWalletAdjReason(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" />
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="success" onClick={() => handleWalletAdjustment('credit')} disabled={isSaving}>Credit</Button>
                                    <Button size="sm" variant="danger" onClick={() => handleWalletAdjustment('debit')} disabled={isSaving}>Debit</Button>
                                </div>
                            </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'security' && user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 uppercase text-xs">Credentials</h3>
                                <Button onClick={handleGenerateResetLink} disabled={isGeneratingLink}>{isGeneratingLink ? 'Wait...' : 'Generate Reset Link'}</Button>
                                {resetLink && <div className="text-[10px] p-2 bg-blue-50 dark:bg-blue-900/50 rounded break-words font-mono">{resetLink}</div>}
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-400 uppercase text-xs">Restrictions</h3>
                                {Object.keys(formData.restrictions || {}).map(key => (
                                    <label key={key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                                        <span className="capitalize">Block {key}</span>
                                        <input type="checkbox" checked={(formData.restrictions as any)[key]} onChange={() => handleRestrictionsChange(key as keyof UserRestrictions)} />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'strategy' && user && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="font-bold text-gray-400 uppercase text-xs">Auto-Upgrade Funds</h3>
                            {upgradeFundSummary.length > 0 ? upgradeFundSummary.map(item => (
                                <div key={item.planId} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold">{item.planName} Track</h4>
                                            <p className="text-[10px] text-gray-500">Target Upgrade: <strong>{item.targetPlan || '---'}</strong></p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-indigo-600">{formatCurrency(item.totalHeld, user.currency)}</div>
                                            <p className="text-[9px] text-gray-400 uppercase font-black">Total Held</p>
                                        </div>
                                    </div>
                                    <div className="p-4 border-t dark:border-gray-700">
                                        <table className="w-full text-[11px] text-left">
                                            <thead className="text-gray-400">
                                                <tr>
                                                    <th className="pb-2">Referral</th>
                                                    <th className="pb-2">Slot</th>
                                                    <th className="pb-2">Amount</th>
                                                    <th className="pb-2 text-right">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-gray-700">
                                                {item.transactions.map(tx => {
                                                    const ref = users.find(u => u._id === tx.sourceUserId);
                                                    const slot = tx.description.match(/Slot #(\d+)/)?.[1] || '?';
                                                    return (
                                                        <tr key={tx._id}>
                                                            <td className="py-2">@{ref?.username || 'Unknown'}</td>
                                                            <td className="py-2">#{slot}</td>
                                                            <td className="py-2 font-bold text-indigo-600">{formatCurrency(tx.amount, tx.currency)}</td>
                                                            <td className="py-2 text-right text-gray-400">{new Date(tx.date).toLocaleDateString()}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                        {item.totalHeld > 0 && (
                                            <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-end">
                                                <Button size="sm" onClick={() => handleManualUpgrade(item.planId)} disabled={isSaving}>Force Move to {item.targetPlan}</Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <p className="p-8 text-center text-gray-400 italic text-sm">No plans with hold strategy found for this user.</p>
                            )}
                        </div>
                    )}
                    {activeTab === 'history' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                                <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} className="w-full text-[10px] rounded-md dark:bg-gray-700"><option value="">All Types</option>{transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="w-full text-[10px] rounded-md dark:bg-gray-700"><option value="">All Status</option>{['Approved', 'Pending', 'Rejected'].map(s=><option key={s} value={s}>{s}</option>)}</select>
                                <input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="w-full text-[10px] rounded-md dark:bg-gray-700" />
                                <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="w-full text-[10px] rounded-md dark:bg-gray-700" />
                            </div>
                            <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-900 text-gray-500">
                                        <tr>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2">Amount</th>
                                            <th className="p-2">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {filteredUserTransactions.map(tx => (
                                            <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="p-2 text-gray-400 font-mono text-[10px]">{new Date(tx.date).toLocaleString()}</td>
                                                <td className="p-2 font-bold">{tx.type}</td>
                                                <td className={`p-2 font-mono ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount, tx.currency)}</td>
                                                <td className="p-2 text-[10px] max-w-xs truncate" title={tx.description}>{tx.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>Save Member Data</Button>
                </div>
            </div>
        </Modal>
    );
};

// ... (Remainder of Users.tsx: BulkRestrictions, MessageUser, DeleteUser remain unchanged) ...
// ... Keeping existing BulkRestrictionsModal, MessageUserModal, DeleteUserModal to avoid breaking features ...

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
            await bulkUpdateUserRestrictions({
                targetType,
                targetIds,
                restrictions,
                action,
                sendNotification
            });
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
                randomCount: targetType === 'inactive' && randomCount ? parseInt(randomCount) : undefined
            });
            dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            alert(`Message sent to ${result.count} users successfully.`);
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
                    {user ? (
                        <div className="p-2 bg-gray-50 rounded border text-sm">Target: <strong>{user.username}</strong></div>
                    ) : (
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
                            {targetType === 'inactive' && (
                                <input type="number" placeholder="Send to X random inactive users (leave empty for ALL)" value={randomCount} onChange={e => setRandomCount(e.target.value)} className="w-full border rounded p-2 text-sm" />
                            )}
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Subject (Optional)</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border rounded p-2" placeholder="Important Update" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Message Content</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full border rounded p-2" placeholder="Type your message here..." required />
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="popup-chk" checked={isPopup} onChange={e => setIsPopup(e.target.checked)} className="rounded" />
                    <label htmlFor="popup-chk" className="text-sm font-medium cursor-pointer">Display as urgent POPUP for user</label>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button type="submit" disabled={isSending}>{isSending ? 'Sending...' : 'Send Message'}</Button>
                </div>
            </form>
        </Modal>
    );
};

interface DeleteUserModalProps {
    user: User;
    onClose: () => void;
    onConfirmDelete: (userId: string) => Promise<void>;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onClose, onConfirmDelete }) => {
    const { state } = useData();
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleConfirm = async () => {
        setIsDeleting(true);
        await onConfirmDelete(user._id);
        setIsDeleting(false);
    };

    const handleDownloadDossier = () => {
        const userTx = state.transactions.filter(t => t.userId === user._id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const userDeposits = state.deposits.filter(d => d.userId === user._id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const userWithdrawals = state.withdrawals.filter(w => w.userId === user._id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const userTransfers = state.transfers.filter(t => t.senderId === user._id || t.recipientId === user._id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const referrals = state.users.filter(u => u.sponsor === user.username);
        const approvedDeposits = userDeposits.filter(d => d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0);
        const paidWithdrawals = userWithdrawals.filter(w => w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0);
        const totalCommission = userTx.filter(t => t.type === 'Commission' && t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);

        const csvRows: string[][] = [
            [`=== COMPREHENSIVE USER DOSSIER: ${user.username} (${user.email}) ===`],
            [`Generated on: ${new Date().toLocaleString()}`],
            [],
            ['--- PROFILE INFORMATION ---'],
            ['User ID', user._id], ['Username', user.username], ['Full Name', user.fullName], ['Email', user.email], ['Phone', user.phone], ['WhatsApp', user.whatsapp || 'N/A'], ['Country', user.country], ['Currency', user.currency], ['Sponsor', user.sponsor || 'N/A'], ['Status', user.status], ['Current Wallet Balance', formatCurrency(user.walletBalance, user.currency)], ['Joined Date', new Date(user.registrationDate).toLocaleString()],
            [],
            ['--- FINANCIAL SUMMARY ---'],
            ['Metric', 'Total Value'], ['Total Approved Deposits', formatCurrency(approvedDeposits, user.currency)], ['Total Paid Withdrawals', formatCurrency(paidWithdrawals, user.currency)], ['Total Commission Earned', formatCurrency(totalCommission, user.currency)], ['Total Direct Referrals', `${referrals.length}`],
            [],
            ['--- CURRENT ACTIVE PLANS ---']
        ];
        if (user.activePlans?.length) {
            csvRows.push(['Plan Name', 'Price', 'Purchase Date']);
            user.activePlans.forEach(p => csvRows.push([p.planName, formatCurrency(p.price, user.currency), new Date(p.purchaseDate).toLocaleString()]));
        } else csvRows.push(['None']);
        csvRows.push([], ['--- DIRECT REFERRALS (DOWNLINE) ---']);
        if (referrals.length) {
            csvRows.push(['Username', 'Full Name', 'Email', 'Joined Date', 'Status']);
            referrals.forEach(ref => csvRows.push([ref.username, ref.fullName, ref.email, new Date(ref.registrationDate).toLocaleDateString(), ref.status]));
        } else csvRows.push(['No referrals found']);
        csvRows.push([], ['--- DEPOSIT HISTORY ---']);
        if (userDeposits.length) {
            csvRows.push(['ID', 'Method', 'Amount', 'Transaction ID', 'Status', 'Date']);
            userDeposits.forEach(d => csvRows.push([d._id, d.method, formatCurrency(d.amount, d.currency), d.transactionId, d.status, new Date(d.date).toLocaleString()]));
        } else csvRows.push(['No deposits found']);
        csvRows.push([], ['--- WITHDRAWAL HISTORY ---']);
        if (userWithdrawals.length) {
            csvRows.push(['ID', 'Method', 'Amount', 'Fee', 'Final Amount', 'Status', 'Date']);
            userWithdrawals.forEach(w => csvRows.push([w._id, w.method, formatCurrency(w.amount, w.currency), formatCurrency(w.fee, w.currency), formatCurrency(w.finalAmount, w.currency), w.status, new Date(w.date).toLocaleString()]));
        } else csvRows.push(['No withdrawals found']);
        csvRows.push([], ['--- TRANSFER HISTORY (SENT/RECEIVED) ---']);
        if (userTransfers.length) {
            csvRows.push(['ID', 'Sender', 'Recipient', 'Amount', 'Fee', 'Total Deducted', 'Status', 'Date']);
            userTransfers.forEach(t => csvRows.push([t._id, t.senderName, t.recipientName, formatCurrency(t.amount, t.currency), formatCurrency(t.fee || 0, t.currency), formatCurrency(t.totalDeducted || 0, t.currency), t.status, new Date(t.date).toLocaleString()]));
        } else csvRows.push(['No transfers found']);
        csvRows.push([], ['--- TRANSACTION LOG (FULL ACTIVITY) ---'], ['Date', 'Type', 'Amount', 'Status', 'Description']);
        userTx.forEach(tx => csvRows.push([new Date(tx.date).toLocaleString(), tx.type, formatCurrency(tx.amount, tx.currency), tx.status || 'N/A', tx.description]));

        const csvContent = csvRows.map(e => e.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Full_User_Dossier_${user.username}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-96 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 className="text-xl font-bold">Confirm Deletion</h3>
                <p className="text-sm text-gray-500">Are you sure you want to permanently delete user <strong className="text-gray-900">@{user.username}</strong>?</p>
                <div className="pt-2"><button onClick={handleDownloadDossier} className="text-xs text-blue-600 hover:text-blue-800 font-bold underline flex items-center justify-center gap-1 mx-auto"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download Full User Dossier</button></div>
                <div className="flex gap-2 pt-4"><Button className="flex-1" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button><Button className="flex-1" variant="danger" onClick={handleConfirm} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Yes, Delete All'}</Button></div>
            </div>
        </Modal>
    );
};

export default Users;
