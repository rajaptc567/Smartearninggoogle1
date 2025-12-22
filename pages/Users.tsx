
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction, ActivePlan } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers, adminActivatePlan, adminRemoveUserPlan } from '../services/api';

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
                // Refresh local data to reflect deletions
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
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
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
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanFilter(e.target.value)}
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
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrencyFilter(e.target.value as Currency | '')}
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
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
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

    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'network' | 'history'>('profile');
    const [formData, setFormData] = useState<Partial<User>>(
        user || { fullName: '', username: '', email: '', phone: '', whatsapp: '', country: '', status: Status.Active, walletBalance: 0, restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false } }
    );
    const [isSaving, setIsSaving] = useState(false);

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

    // Manual Plan Activation State
    const [activationPlanId, setActivationPlanId] = useState('');
    const [isActivatingPlan, setIsActivatingPlan] = useState(false);

    // NEW: Tree Filter State
    const [treePlanFilterId, setTreePlanFilterId] = useState('');

    // NEW: Plan Removal State
    const [planToRemove, setPlanToRemove] = useState<ActivePlan | null>(null);
    const [removalReason, setRemovalReason] = useState('Incorrect assignment');
    const [isRemovingPlan, setIsRemovingPlan] = useState(false);

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
            setFormData(prev => ({ ...prev, walletBalance: result.user.walletBalance })); // Update local form state
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
                const updatedUser = await apiUpdateUser(user._id, updateData);
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
            alert(`Plan activated successfully for ${user.username}!`);
        } catch (error) {
            console.error(error);
            alert(`Failed to activate plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsActivatingPlan(false);
        }
    };

    const handleConfirmRemovePlan = async () => {
        if (!user || !planToRemove || !planToRemove._id) return;
        
        setIsRemovingPlan(true);
        try {
            const result = await adminRemoveUserPlan(user._id, planToRemove._id, removalReason);
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setFormData(prev => ({ ...prev, activePlans: result.user.activePlans, activePlan: result.user.activePlan }));
            setPlanToRemove(null);
            alert(`Plan "${planToRemove.planName}" removed from user account.`);
        } catch (error) {
            console.error(error);
            alert(`Failed to remove plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsRemovingPlan(false);
        }
    };
    
    const TabButton: React.FC<{ tabId: typeof activeTab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button type="button" onClick={() => setActiveTab(tabId)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>
    );

    const getEquivalentIds = useCallback((planId: string) => {
        const ids = new Set<string>();
        if (planId) {
            ids.add(planId);
            const group = settings.planEquivalencyGroups?.find(g =>
                String(g.usdPlanId) === planId ||
                String(g.pkrPlanId) === planId ||
                String(g.eurPlanId) === planId
            );
            if (group) {
                if (group.usdPlanId) ids.add(String(group.usdPlanId));
                if (group.pkrPlanId) ids.add(String(group.pkrPlanId));
                if (group.eurPlanId) ids.add(String(group.eurPlanId));
            }
        }
        return ids;
    }, [settings.planEquivalencyGroups]);

    const genealogyTree = useMemo(() => {
        if (!user) return [];
        
        const filterIds = treePlanFilterId ? getEquivalentIds(treePlanFilterId) : null;

        const buildGenealogy = (sponsorUsername: string, allUsers: User[]): { user: User, children: any[] }[] => {
            const directReferrals = allUsers.filter(u => u.sponsor === sponsorUsername);
            if (!directReferrals.length) return [];
            
            return directReferrals
                .map(child => {
                    const children = buildGenealogy(child.username, allUsers);
                    // If filtering, only show node if child has the plan OR has descendants with the plan
                    if (filterIds) {
                        const hasPlan = child.activePlans?.some(p => filterIds.has(String(p.planId)));
                        const hasEarningFromChild = transactions.some(t => t.userId === user._id && t.sourceUserId === child._id && t.relatedPlanId && filterIds.has(String(t.relatedPlanId)));
                        
                        if (hasPlan || hasEarningFromChild || children.length > 0) {
                            return { user: child, children };
                        }
                        return null;
                    }
                    return { user: child, children };
                })
                .filter((n): n is { user: User, children: any[] } => n !== null);
        };
        return buildGenealogy(user.username, users);
    }, [user, users, treePlanFilterId, getEquivalentIds, transactions]);

    const allUserTransactions = useMemo(() => {
        if (!user) return [];
        return transactions
            .filter(t => t.userId === user._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [user, transactions]);

    const filteredUserTransactions = useMemo(() => {
        return allUserTransactions.filter(t => {
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
        });
    }, [allUserTransactions, historyTypeFilter, historyStatusFilter, historyDateFrom, historyDateTo]);

    const currencyPlans = useMemo(() => {
        if (!user) return [];
        return investmentPlans.filter(p => p.status === 'Active' && p.currency === user.currency);
    }, [user, investmentPlans]);

    const activatablePlans = useMemo(() => {
        if (!user) return [];
        const currentOwnedPlanIds = (user.activePlans || []).map(p => p.planId.toString());
        return currencyPlans.filter(p => !currentOwnedPlanIds.includes(p._id.toString()));
    }, [user, currencyPlans]);

    const renderTree = (nodes: { user: User, children: any[] }[]) => (
        <ul className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-3">
            {nodes.map(node => (
                <li key={node.user._id} className="text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                    <div className="flex justify-between items-center">
                        <p className="font-bold">{node.user.username}</p>
                        <Badge status={node.user.status as any} />
                    </div>
                    <p className="text-xs text-gray-500">Joined: {new Date(node.user.registrationDate).toLocaleDateString()}</p>
                    <div className="mt-1 text-xs">
                        <strong>Plans:</strong> {node.user.activePlans && node.user.activePlans.length > 0 
                            ? node.user.activePlans.map(p => `${p.planName} (${formatCurrency(p.price, node.user.currency)})`).join(', ') 
                            : 'None'}
                    </div>
                    {node.children.length > 0 && <div className="mt-2">{renderTree(node.children)}</div>}
                </li>
            ))}
        </ul>
    );

    return (
         <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[95vw] max-w-4xl h-[90vh] flex flex-col">
                <h2 className="text-xl font-bold mb-4">{user ? `Manage User: ${user.username}` : 'Add New User'}</h2>
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-4">
                        <TabButton tabId="profile">Profile & Wallet</TabButton>
                        {user && <TabButton tabId="security">Security & Restrictions</TabButton>}
                        {user && <TabButton tabId="network">Network & Plans</TabButton>}
                        {user && <TabButton tabId="history">Financial History</TabButton>}
                    </nav>
                </div>

                <div className="flex-grow overflow-y-auto pt-6 space-y-6">
                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                               <h3 className="font-semibold">Profile Information</h3>
                               <input name="fullName" value={formData.fullName || ''} onChange={handleFormChange} placeholder="Full Name" className="w-full rounded-md dark:bg-gray-700" />
                               <input name="username" value={formData.username || ''} onChange={handleFormChange} placeholder="Username" className="w-full rounded-md dark:bg-gray-700" disabled={!!user} />
                               <input name="email" value={formData.email || ''} onChange={handleFormChange} placeholder="Email" className="w-full rounded-md dark:bg-gray-700" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500">Phone</label>
                                        <input name="phone" value={formData.phone || ''} onChange={handleFormChange} placeholder="Phone" className="w-full rounded-md dark:bg-gray-700" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">WhatsApp</label>
                                        <input name="whatsapp" value={formData.whatsapp || ''} onChange={handleFormChange} placeholder="WhatsApp Number" className="w-full rounded-md dark:bg-gray-700" />
                                    </div>
                                </div>
                                <select name="country" value={formData.country || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">
                                    <option value="">-- Select country --</option>
                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select name="status" value={formData.status} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">
                                    {Object.values(Status).filter(s => ['Active', 'Blocked', 'Pending', 'Paused'].includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {user && (
                            <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
                                <h3 className="font-semibold">Wallet Management</h3>
                                <p className="text-2xl font-bold">{formatCurrency(formData.walletBalance || 0, formData.currency || 'PKR')}</p>
                                <div>
                                    <label className="text-xs">Adjustment Amount</label>
                                    <input type="number" value={walletAdjAmount} onChange={(e) => setWalletAdjAmount(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" />
                                </div>
                                 <div>
                                    <label className="text-xs">Reason / Description</label>
                                    <input type="text" value={walletAdjReason} onChange={(e) => setWalletAdjReason(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" />
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="success" onClick={() => handleWalletAdjustment('credit')} disabled={isSaving}>Credit (+)</Button>
                                    <Button size="sm" variant="danger" onClick={() => handleWalletAdjustment('debit')} disabled={isSaving}>Debit (-)</Button>
                                </div>
                            </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'security' && user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold">Password Reset</h3>
                                <Button onClick={handleGenerateResetLink} disabled={isGeneratingLink}>{isGeneratingLink ? 'Generating...' : 'Generate Password Reset Link'}</Button>
                                {resetLink && <div className="text-xs p-2 bg-blue-50 dark:bg-blue-900/50 rounded break-words mt-2">{resetLink}</div>}
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-semibold">Activity Restrictions</h3>
                                {Object.keys(formData.restrictions || {}).map(key => (
                                    <label key={key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                                        <span>Block {key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                        <input type="checkbox" checked={(formData.restrictions as any)[key]} onChange={() => handleRestrictionsChange(key as keyof UserRestrictions)} />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'network' && user && (
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <h3 className="font-semibold mb-2">Network & Downline</h3>
                                <p className="text-sm"><strong>Sponsor:</strong> {user.sponsor || 'N/A'}</p>
                                
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded border dark:border-gray-600">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Filter Tree by Plan</label>
                                    <select 
                                        value={treePlanFilterId} 
                                        onChange={e => setTreePlanFilterId(e.target.value)}
                                        className="w-full text-xs rounded border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                                    >
                                        <option value="">Show All Network</option>
                                        {currencyPlans.map(p => <option key={p._id} value={p._id}>{p.name} Tree</option>)}
                                    </select>
                                </div>

                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-gray-500">Downline Tree:</h4>
                                    {genealogyTree.length > 0 ? renderTree(genealogyTree) : <p className="text-xs italic text-gray-400">No members found matching filter.</p>}
                                </div>
                             </div>
                             
                             <div className="space-y-6">
                                 <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                                    <h4 className="font-semibold mb-3">Active Plans</h4>
                                    {user.activePlans && user.activePlans.length > 0 ? (
                                        <ul className="space-y-2">
                                            {user.activePlans.map((p, i) => (
                                                <li key={p._id || p.planId + i} className="p-3 bg-white dark:bg-gray-800 rounded-md text-sm flex justify-between items-center shadow-sm">
                                                    <span>
                                                        <span className="font-bold">{p.planName}</span>
                                                        <span className="text-[10px] text-gray-500 block uppercase tracking-wider">Purchased: {new Date(p.purchaseDate).toLocaleDateString()}</span>
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-blue-600">{formatCurrency(p.price, user.currency)}</span>
                                                        <button 
                                                            onClick={() => { setRemovalReason('Administrative correction'); setPlanToRemove(p); }} 
                                                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                                            title="Remove this plan"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No plans active.</p>
                                    )}
                                 </div>

                                 <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
                                        <span className="text-lg">🛡️</span> Manual Plan Activation
                                    </h4>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-4">Assign a plan manually. Commissions will trigger correctly.</p>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Select {user.currency} Plan</label>
                                            <select 
                                                value={activationPlanId} 
                                                onChange={e => setActivationPlanId(e.target.value)}
                                                className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            >
                                                <option value="">-- Choose Plan --</option>
                                                {activatablePlans.map(p => (
                                                    <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, p.currency)})</option>
                                                ))}
                                                {activatablePlans.length === 0 && <option disabled>No other {user.currency} plans available.</option>}
                                            </select>
                                        </div>
                                        <Button 
                                            onClick={handleManualActivatePlan} 
                                            disabled={isActivatingPlan || !activationPlanId}
                                            className="w-full bg-blue-700 hover:bg-blue-800"
                                            size="sm"
                                        >
                                            {isActivatingPlan ? 'Activating...' : 'Activate Plan Now'}
                                        </Button>
                                    </div>
                                 </div>
                             </div>
                         </div>
                    )}
                    {activeTab === 'history' && user && (
                        <div className="space-y-4">
                            <h3 className="font-semibold">Financial History</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                                <div><select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700"><option value="">All Types</option>{transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                <div><select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700"><option value="">All Statuses</option>{Object.values(Status).filter(s => ['Approved', 'Pending', 'Rejected'].includes(s)).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                                <div><input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700" /></div>
                                <div><input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700" /></div>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto border dark:border-gray-700 rounded-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                                        <tr>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2">Amount</th>
                                            <th className="p-2">Status</th>
                                            <th className="p-2">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {filteredUserTransactions.length > 0 ? filteredUserTransactions.map(tx => (
                                            <tr key={tx._id}>
                                                <td className="p-2 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                                                <td className="p-2">{tx.type}</td>
                                                <td className={`p-2 font-mono ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {formatCurrency(tx.amount, tx.currency)}
                                                </td>
                                                <td className="p-2"><Badge status={tx.status as Status || Status.Approved} /></td>
                                                <td className="p-2 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={5} className="p-4 text-center text-gray-500">No transactions found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="button" onClick={handleSaveChanges} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Profile Details'}</Button>
                </div>
            </div>
            
            {/* PLAN REMOVAL CONFIRMATION MODAL */}
            {planToRemove && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-75">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-red-600 mb-2">Remove Active Plan?</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            You are removing the <strong>{planToRemove.planName}</strong> plan from <strong>{user?.username}</strong>. 
                            This action will be logged and the user will be notified.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Purpose of Removal</label>
                                <textarea 
                                    className="w-full rounded border dark:bg-gray-700 dark:border-gray-600 text-sm p-2"
                                    rows={2}
                                    placeholder="e.g., Refunded, User requested change, Administrative error..."
                                    value={removalReason}
                                    onChange={e => setRemovalReason(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" className="flex-1" onClick={() => setPlanToRemove(null)} disabled={isRemovingPlan}>Cancel</Button>
                                <Button variant="danger" className="flex-1" onClick={handleConfirmRemovePlan} disabled={isRemovingPlan}>
                                    {isRemovingPlan ? 'Removing...' : 'Confirm Removal'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

// --- BulkRestrictionsModal ---

interface BulkRestrictionsModalProps {
    allUsers: User[];
    investmentPlans: InvestmentPlan[];
    onClose: () => void;
}

const BulkRestrictionsModal: React.FC<BulkRestrictionsModalProps> = ({ allUsers, investmentPlans, onClose }) => {
    const [targetType, setTargetType] = useState<'plan' | 'all' | 'single'>('plan');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [action, setAction] = useState<'enable' | 'disable' | 'toggle'>('disable');
    const [restrictions, setRestrictions] = useState<Partial<UserRestrictions>>({ deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false });
    const [sendNotification, setSendNotification] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const handleToggleRestriction = (key: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleApply = async () => {
        if (targetType !== 'all' && targetIds.length === 0) {
            alert("Please select at least one target.");
            return;
        }

        setIsSaving(true);
        try {
            await bulkUpdateUserRestrictions({
                targetType,
                targetIds,
                restrictions,
                action,
                sendNotification
            });
            alert('Bulk restrictions applied successfully! Please refresh the page to see changes.');
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to apply bulk restrictions.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-96 space-y-4">
                <h3 className="text-lg font-bold">Bulk User Restrictions</h3>
                
                <div>
                    <label className="text-xs font-bold uppercase text-gray-500">Target Audience</label>
                    <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full rounded border p-2 dark:bg-gray-700 mt-1">
                        <option value="plan">Users of Specific Plan(s)</option>
                        <option value="all">All Users</option>
                    </select>
                </div>

                {targetType === 'plan' && (
                    <div className="max-h-32 overflow-y-auto border rounded p-2 dark:bg-gray-700">
                        {investmentPlans.map(plan => (
                            <label key={plan._id} className="flex items-center gap-2 mb-1">
                                <input 
                                    type="checkbox" 
                                    checked={targetIds.includes(plan._id)} 
                                    onChange={() => setTargetIds(prev => prev.includes(plan._id) ? prev.filter(id => id !== plan._id) : [...prev, plan._id])} 
                                />
                                <span className="text-sm">{plan.name}</span>
                            </label>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500">Action</label>
                        <select value={action} onChange={e => setAction(e.target.value as any)} className="w-full rounded border p-2 dark:bg-gray-700 mt-1">
                            <option value="disable">Restrict (Disable)</option>
                            <option value="enable">Unrestrict (Enable)</option>
                            <option value="toggle">Toggle State</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Flags to Modify</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.keys(restrictions).map(key => (
                            <label key={key} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                                <input type="checkbox" checked={(restrictions as any)[key]} onChange={() => handleToggleRestriction(key as any)} />
                                <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <label className="flex items-center gap-2 mt-4">
                    <input type="checkbox" checked={sendNotification} onChange={e => setSendNotification(e.target.checked)} />
                    <span className="text-sm">Notify users of this change</span>
                </label>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleApply} disabled={isSaving}>{isSaving ? 'Processing...' : 'Apply Changes'}</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- MessageUserModal ---

interface MessageUserModalProps {
    user: User | null;
    allUsers: User[];
    investmentPlans: InvestmentPlan[];
    onClose: () => void;
}

const MessageUserModal: React.FC<MessageUserModalProps> = ({ user, allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [targetType, setTargetType] = useState<'single' | 'all' | 'plan' | 'inactive'>(user ? 'single' : 'all');
    const [targetIds, setTargetIds] = useState<string[]>(user ? [user._id] : []);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isPopup, setIsPopup] = useState(false);
    const [randomCount, setRandomCount] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!message) return alert("Please enter a message");
        setIsSending(true);
        try {
            const payload = {
                userId: targetType === 'single' ? targetIds[0] : undefined,
                targetType: targetType !== 'single' ? targetType : undefined,
                targetIds: targetType === 'plan' ? targetIds : (targetType === 'single' ? [targetIds[0]] : undefined),
                subject,
                message,
                isPopup,
                randomCount: targetType === 'inactive' && randomCount ? parseInt(randomCount) : undefined
            };
            const result = await sendAdminNotification(payload);
            // Result.data is an array of created notifications
            if (result.data && Array.isArray(result.data)) {
                dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            }
            alert(`Message sent successfully to ${result.count || 'targeted'} user(s)!`);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to send message.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[500px] space-y-4">
                <h3 className="text-lg font-bold">{user ? `Message User: ${user.username}` : 'Send Bulk Message'}</h3>
                
                {!user && (
                <div>
                    <label className="text-xs font-bold uppercase text-gray-500">Recipients</label>
                    <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full rounded border p-2 dark:bg-gray-700 mt-1">
                        <option value="all">All Users</option>
                        <option value="plan">Users by Active Plan</option>
                        <option value="inactive">Inactive Users (No Plan)</option>
                    </select>
                </div>
                )}

                {targetType === 'plan' && (
                    <div className="max-h-32 overflow-y-auto border rounded p-2 dark:bg-gray-700">
                        {investmentPlans.map(plan => (
                            <label key={plan._id} className="flex items-center gap-2 mb-1">
                                <input 
                                    type="checkbox" 
                                    checked={targetIds.includes(plan._id)} 
                                    onChange={() => setTargetIds(prev => prev.includes(plan._id) ? prev.filter(id => id !== plan._id) : [...prev, plan._id])} 
                                />
                                <span className="text-sm">{plan.name}</span>
                            </label>
                        ))}
                    </div>
                )}

                {targetType === 'inactive' && (
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500">Random Limit (Optional)</label>
                        <input type="number" value={randomCount} onChange={e => setRandomCount(e.target.value)} placeholder="Leave blank for all inactive" className="w-full rounded border p-2 dark:bg-gray-700 mt-1" />
                        <p className="text-[10px] text-gray-400 mt-1">If set, the message will be sent to a random selection of up to X inactive users.</p>
                    </div>
                )}

                <div>
                    <label className="text-xs font-bold uppercase text-gray-500">Subject</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Message Subject" className="w-full rounded border p-2 dark:bg-gray-700 mt-1" />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-gray-500">Message Content</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full rounded border p-2 dark:bg-gray-700 mt-1" placeholder="Type your message here..." />
                </div>

                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={isPopup} onChange={e => setIsPopup(e.target.checked)} />
                    <span className="text-sm font-semibold">Force Display as Popup on User Login</span>
                </label>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isSending}>Cancel</Button>
                    <Button onClick={handleSend} disabled={isSending}>{isSending ? 'Sending...' : 'Send Message'}</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- DeleteUserModal ---

interface DeleteUserModalProps {
    user: User;
    onClose: () => void;
    onConfirmDelete: (userId: string) => void;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onClose, onConfirmDelete }) => {
    const [confirmName, setConfirmName] = useState('');
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-96 space-y-4">
                <h3 className="text-lg font-bold text-red-600">Permanently Delete User?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    You are about to delete <strong>{user.fullName} (@{user.username})</strong>. This action is <strong>irreversible</strong> and will delete:
                </p>
                <ul className="list-disc list-inside text-xs text-red-500 space-y-1">
                    <li>Account Profile & Login Access</li>
                    <li>Wallet Balance & Full Financial History</li>
                    <li>All Deposit and Withdrawal Records</li>
                    <li>Referral link associations</li>
                </ul>
                <div className="pt-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Type username "{user.username}" to confirm</label>
                    <input 
                        className="w-full border-2 border-red-200 rounded p-2 dark:bg-gray-700 mt-1 focus:border-red-500 outline-none" 
                        value={confirmName} 
                        onChange={e => setConfirmName(e.target.value)} 
                        placeholder={user.username}
                    />
                </div>
                <div className="flex gap-2 pt-4">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button 
                        variant="danger" 
                        className="flex-1" 
                        disabled={confirmName !== user.username} 
                        onClick={() => onConfirmDelete(user._id)}
                    >
                        Delete Forever
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default Users;
