
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction, Log, ActivePlan } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers, adminActivatePlan, createBulkDummyUsers } from '../services/api';

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
        const csvHeaders = ['Username', 'Full Name', 'Email', 'Phone', 'WhatsApp', 'Country', 'Wallet Balance', 'Currency', 'Status'];
        const csvRows = [
            csvHeaders.join(','),
            ...usersToExport.map(user => [
                csvEscape(user.username),
                csvEscape(user.fullName),
                csvEscape(user.email),
                csvEscape(user.phone),
                csvEscape(user.whatsapp),
                csvEscape(user.country),
                user.walletBalance,
                csvEscape(user.currency),
                csvEscape(user.status)
            ].join(','))
        ];
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `exported_users_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const tableHeaders = ['User', 'Contact', 'Wallet Balance', 'Active Plans', 'Status', 'Actions'];
    const areAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white shrink-0">Member Management ({filteredUsers.length})</h2>
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
                            <Button size="sm" variant="secondary" onClick={handleDownloadSelected}>Download CSV</Button>
                            <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={isProcessing}>
                                {isProcessing ? 'Processing...' : 'Delete Selected'}
                            </Button>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-500">Select users to perform bulk actions</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setIsBulkRestrictionsModalOpen(true)}>Bulk Restrictions</Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsBulkDummyModalOpen(true)}>Bulk Dummy Add</Button>
                    <Button variant="secondary" size="sm" onClick={() => handleOpenMessage(null)}>Send Announcement</Button>
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
                                {filteredUsers.map((user: User) => (
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
                                                    <p className="font-bold text-gray-900 dark:text-white">{user.fullName}</p>
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
                    onDeleteRequest={handleOpenDeleteModal}
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
                <DeleteUserModal user={userToDelete} onClose={handleCloseAllModals} onConfirmDelete={handleConfirmDelete}/>
            )}
        </div>
    );
};

// --- UserManagementModal ---

interface UserManagementModalProps {
    user: User | null;
    onClose: () => void;
    onDeleteRequest?: (user: User) => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, onClose, onDeleteRequest }) => {
    const { state, dispatch } = useData();
    const { users, transactions, investmentPlans, settings, logs } = state;

    const [activeTab, setActiveTab] = useState<'profile' | 'permissions' | 'network' | 'transactions' | 'commissions' | 'activity'>('profile');
    const [formData, setFormData] = useState<Partial<User>>(
        user || { fullName: '', username: '', email: '', phone: '', whatsapp: '', country: '', status: Status.Active, walletBalance: 0, restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false, login: false, purchase: false } }
    );
    const [isSaving, setIsSaving] = useState(false);

    // Wallet Adjustment State
    const [walletAdjAmount, setWalletAdjAmount] = useState('');
    const [walletAdjReason, setWalletAdjReason] = useState('Admin manual adjustment');

    // Security State
    const [resetLink, setResetLink] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);

    // History Filter State
    const [historyTypeFilter, setHistoryTypeFilter] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('');

    // Manual Management State
    const [activationPlanId, setActivationPlanId] = useState('');
    const [isActivatingPlan, setIsActivatingPlan] = useState(false);
    const [treePlanFilterId, setTreePlanFilterId] = useState('');
    const [newSponsorUsername, setNewSponsorUsername] = useState(user?.sponsor || '');

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

    const handleManualActivatePlan = async () => {
        if (!user || !activationPlanId) return;
        setIsActivatingPlan(true);
        try {
            const result = await adminActivatePlan(user._id, activationPlanId);
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setFormData(prev => ({ ...prev, activePlans: result.user.activePlans, walletBalance: result.user.walletBalance }));
            setActivationPlanId('');
            alert(`Plan activated successfully!`);
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
            const updatedPlans = (user.activePlans || []).filter(p => p.planId !== planId);
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

    const genealogyTree = useMemo(() => {
        if (!user) return [];
        const buildGenealogy = (sponsorUsername: string, allUsers: User[]): { user: User, children: any[] }[] => {
            const directReferrals = allUsers.filter(u => u.sponsor === sponsorUsername);
            return directReferrals.map(child => ({
                user: child,
                children: buildGenealogy(child.username, allUsers)
            }));
        };
        return buildGenealogy(user.username, users);
    }, [user, users]);

    const filteredUserTransactions = useMemo(() => {
        if (!user) return [];
        return transactions
            .filter(t => t.userId === user._id)
            .filter(t => !historyTypeFilter || t.type === historyTypeFilter)
            .filter(t => !historyStatusFilter || (t.status || 'Approved') === historyStatusFilter)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [user, transactions, historyTypeFilter, historyStatusFilter]);

    const userActivityLogs = useMemo(() => {
        if (!user) return [];
        return logs.filter(l => l.affectedUser === user.username || l.performedBy === user.username).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [user, logs]);

    const activatablePlans = useMemo(() => {
        if (!user) return [];
        const currentOwnedPlanIds = (user.activePlans || []).map(p => p.planId.toString());
        return investmentPlans.filter(p => p.status === 'Active' && p.currency === user.currency && !currentOwnedPlanIds.includes(p._id.toString()));
    }, [user, investmentPlans]);

    const renderTree = (nodes: { user: User, children: any[] }[]) => (
        <ul className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-3">
            {nodes.map(node => (
                <li key={node.user._id} className="text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                    <div className="flex justify-between items-center"><p className="font-bold">{node.user.username}</p><Badge status={node.user.status as any}/></div>
                    {node.children.length > 0 && <div className="mt-2">{renderTree(node.children)}</div>}
                </li>
            ))}
        </ul>
    );

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
                        {user && <TabButton tabId="network">Team & Hierarchy</TabButton>}
                        {user && <TabButton tabId="transactions">Financials</TabButton>}
                        {user && <TabButton tabId="commissions">Commissions</TabButton>}
                        {user && <TabButton tabId="activity">Action Logs</TabButton>}
                    </nav>
                </div>

                <div className="flex-grow overflow-y-auto pt-6 space-y-6 px-1">
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
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'permissions' && user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                            <div className="space-y-6">
                                <section>
                                    <h4 className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-4">Action Restrictions</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {Object.keys(formData.restrictions || {}).map(key => (
                                            <label key={key} className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${(formData.restrictions as any)[key] ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold capitalize">Block {key}</span>
                                                    <span className="text-[10px] text-gray-400">Prohibits this action for user</span>
                                                </div>
                                                <input type="checkbox" className="w-5 h-5 rounded text-red-600" checked={(formData.restrictions as any)[key]} onChange={() => handleRestrictionsChange(key as keyof UserRestrictions)} />
                                            </label>
                                        ))}
                                    </div>
                                </section>
                            </div>
                            
                            <div className="space-y-6">
                                <section className="p-5 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border dark:border-gray-600">
                                    <h4 className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-4">Authentication Reset</h4>
                                    <Button onClick={handleGenerateResetLink} disabled={isGeneratingLink} className="w-full">Generate Password Reset Link</Button>
                                    {resetLink && (
                                        <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-xl border shadow-inner flex gap-2">
                                            <input readOnly value={resetLink} className="w-full text-[10px] font-mono bg-transparent border-none p-0 outline-none"/>
                                            <button onClick={() => {navigator.clipboard.writeText(resetLink); alert('Link Copied');}} className="text-blue-500 font-bold text-xs uppercase shrink-0">Copy</button>
                                        </div>
                                    )}
                                </section>

                                <section className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <h4 className="font-black text-[10px] text-blue-500 uppercase tracking-widest mb-4">Identity Verification</h4>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Verified Badge Status:</span>
                                        <button onClick={() => setFormData({...formData, isVerified: !formData.isVerified})} className={`px-4 py-1.5 rounded-full text-xs font-black uppercase transition-all ${formData.isVerified ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-200 text-gray-500'}`}>
                                            {formData.isVerified ? 'Verified' : 'Unverified'}
                                        </button>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'network' && user && (
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                             <div className="space-y-6">
                                <div className="p-5 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border dark:border-gray-600">
                                    <h4 className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-4">Upline / Referral Sponsor</h4>
                                    <div className="flex gap-4 items-end">
                                        <div className="flex-grow">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Current Sponsor Username</label>
                                            <input value={newSponsorUsername} onChange={e => setNewSponsorUsername(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" />
                                        </div>
                                        <Button variant="secondary" onClick={() => setNewSponsorUsername('')} size="sm" className="mb-1">Clear</Button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-3 italic">* Changing sponsor will shift commissions for all future purchases to the new upline.</p>
                                </div>

                                <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border dark:border-gray-700 h-[300px] overflow-y-auto custom-scrollbar">
                                    <h4 className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-4">Downline Visualization</h4>
                                    {genealogyTree.length > 0 ? renderTree(genealogyTree) : <p className="text-sm italic text-gray-500 text-center py-20">No direct or indirect referrals found.</p>}
                                </div>
                             </div>
                             
                             <div className="space-y-6">
                                 <div className="p-5 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border dark:border-gray-600">
                                    <h4 className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-4">Manage Active Plans</h4>
                                    <div className="space-y-2 mb-6">
                                        {user.activePlans && user.activePlans.length > 0 ? user.activePlans.map((p, i) => (
                                            <div key={p.planId + i} className="p-3 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="font-black text-blue-600 uppercase text-xs">{p.planName}</p>
                                                    <p className="text-[9px] text-gray-400 uppercase font-bold">{new Date(p.purchaseDate).toLocaleDateString()}</p>
                                                </div>
                                                <button onClick={() => handleRemovePlan(p.planId)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Remove Plan">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        )) : <p className="text-xs text-gray-400 italic text-center py-4">No plans active.</p>}
                                    </div>
                                    
                                    <div className="pt-4 border-t dark:border-gray-600">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Grant New Plan</label>
                                        <div className="flex gap-2">
                                            <select value={activationPlanId} onChange={e => setActivationPlanId(e.target.value)} className="flex-grow rounded-xl dark:bg-gray-800 text-xs font-bold">
                                                <option value="">-- Select Plan --</option>
                                                {activatablePlans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                            </select>
                                            <Button onClick={handleManualActivatePlan} disabled={isActivatingPlan || !activationPlanId} size="sm">Grant</Button>
                                        </div>
                                    </div>
                                 </div>
                             </div>
                         </div>
                    )}

                    {activeTab === 'transactions' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex gap-2">
                                 <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} className="text-xs rounded-lg dark:bg-gray-700 border-gray-300 py-1"><option value="">All Types</option>{transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                 <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="text-xs rounded-lg dark:bg-gray-700 border-gray-300 py-1"><option value="">All Status</option><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Rejected">Rejected</option></select>
                            </div>
                            <div className="overflow-hidden rounded-2xl border dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
                                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase font-black sticky top-0">
                                            <tr><th className="p-4">Type</th><th className="p-4 text-right">Amount</th><th className="p-4 text-center">Status</th><th className="p-4">Description</th></tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-800">
                                            {filteredUserTransactions.map(tx => (
                                                <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
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
                        <div className="space-y-4 animate-fade-in text-center py-20">
                            <p className="text-gray-400 italic">Referral commission analysis panel loading...</p>
                        </div>
                    )}

                    {activeTab === 'activity' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="overflow-hidden rounded-2xl border dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
                                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-black uppercase sticky top-0">
                                            <tr><th className="p-4">Timestamp</th><th className="p-4">Action</th><th className="p-4">Performed By</th></tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-800">
                                            {userActivityLogs.map(log => (
                                                <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <td className="p-4 font-mono text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                                                    <td className="p-4 font-black uppercase tracking-tight">{log.action}</td>
                                                    <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${log.performedBy === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{log.performedBy}</span></td>
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
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
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
    const [sponsor, setSponsor] = useState('');
    const [balance, setBalance] = useState('0');
    const [country, setCountry] = useState(countries[0]);
    const [currency, setCurrency] = useState<Currency>('PKR');
    const [planId, setPlanId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCreate = async () => {
        if (!sponsor) return alert('Sponsor username is required');
        setIsProcessing(true);
        try {
            await createBulkDummyUsers({ count: parseInt(count), sponsor, balance: parseFloat(balance), country, currency, planId: planId || undefined });
            const updatedUsers = await getUsers();
            dispatch({ type: 'SET_USERS', payload: updatedUsers });
            alert('Bulk dummy users created successfully');
            onClose();
        } catch (err: any) {
            alert(err.message || 'Operation failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[500px] max-w-full space-y-4">
                <h3 className="text-xl font-bold">Bulk Dummy User Generator</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Number of Users</label><input type="number" value={count} onChange={e => setCount(e.target.value)} className="w-full border rounded p-2 text-sm dark:bg-gray-700" /></div>
                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Initial Balance</label><input type="number" value={balance} onChange={e => setBalance(e.target.value)} className="w-full border rounded p-2 text-sm dark:bg-gray-700" /></div>
                </div>
                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Sponsor Username</label><input type="text" value={sponsor} onChange={e => setSponsor(e.target.value)} placeholder="Username of the sponsor" className="w-full border rounded p-2 text-sm dark:bg-gray-700" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Country</label><select value={country} onChange={e => setCountry(e.target.value)} className="w-full border rounded p-2 text-sm dark:bg-gray-700">{countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Currency</label><select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="w-full border rounded p-2 text-sm dark:bg-gray-700"><option value="PKR">PKR</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>
                </div>
                <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Auto-Activate Plan (Optional)</label><select value={planId} onChange={e => setPlanId(e.target.value)} className="w-full border rounded p-2 text-sm dark:bg-gray-700"><option value="">-- No Plan --</option>{investmentPlans.filter(p => p.currency === currency).map(p => <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, p.currency)})</option>)}</select></div>
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

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message) return alert('Message is required');
        setIsSending(true);
        try {
            const result = await sendAdminNotification({ userId: targetType === 'single' ? targetIds[0] : undefined, targetType: targetType !== 'single' ? targetType : undefined, targetIds: targetType === 'plan' ? targetIds : undefined, subject, message, isPopup, randomCount: targetType === 'inactive' && randomCount ? parseInt(randomCount) : undefined });
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
                <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={onClose} type="button">Cancel</Button><Button type="submit" disabled={isSending}>{isSending ? 'Sending...' : 'Send Message'}</Button></div>
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

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-96 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 className="text-xl font-bold">Confirm Deletion</h3>
                <p className="text-sm text-gray-500">Are you sure you want to permanently delete user <strong className="text-gray-900">@{user.username}</strong>? This action is irreversible.</p>
                <div className="flex gap-2 pt-4">
                    <Button className="flex-1" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <Button className="flex-1" variant="danger" onClick={handleConfirm} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Yes, Delete All'}</Button>
                </div>
            </div>
        </Modal>
    );
};

export default Users;
