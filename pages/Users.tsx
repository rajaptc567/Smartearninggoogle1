import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction, Dispute } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers } from '../services/api';

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
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    
    const [managingUser, setManagingUser] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    
    // Filtering State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    // Selection State
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

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

    const handleOpenBulkDeleteModal = () => {
        setIsBulkDeleteModalOpen(true);
    };

    const handleCloseAllModals = () => {
        setManagingUser(null);
        setUserToDelete(null);
        setIsUserManagementModalOpen(false);
        setIsBulkRestrictionsModalOpen(false);
        setIsMessageModalOpen(false);
        setIsDeleteModalOpen(false);
        setIsBulkDeleteModalOpen(false);
    };
    
    const handleConfirmDelete = async (userId: string) => {
        try {
            const userIdString = String(userId);
            await deleteUser(userIdString);
            dispatch({ type: 'DELETE_USER', payload: userIdString });
            alert('User and all associated data deleted successfully.');
            handleCloseAllModals();
        } catch (error) {
            console.error("Failed to delete user:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not delete user.'}`);
        }
    };

    const handleConfirmBulkDelete = async (ids: string[]) => {
        try {
            await bulkDeleteUsers(ids);
            ids.forEach(id => dispatch({ type: 'DELETE_USER', payload: id }));
            setSelectedUserIds([]);
            alert(`${ids.length} users and all their associated data deleted successfully.`);
            handleCloseAllModals();
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not delete users.'}`);
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
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
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
                    <Button variant="danger" onClick={handleOpenBulkDeleteModal}>Bulk Delete Selected ({selectedUserIds.length})</Button>
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
            {isBulkDeleteModalOpen && (
                <BulkDeleteUserModal
                    userIds={selectedUserIds}
                    onClose={handleCloseAllModals}
                    onConfirmBulkDelete={handleConfirmBulkDelete}
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
        user || { fullName: '', username: '', email: '', phone: '', whatsapp: '', country: '', status: Status.Active, walletBalance: 0, restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false } }
    );
    const [isSaving, setIsSaving] = useState(false);

    // Tree Root state for drilling down
    const [treeRoot, setTreeRoot] = useState<User | null>(user);

    // Wallet Adjustment State
    const [walletAdjAmount, setWalletAdjAmount] = useState('');
    const [walletAdjReason, setWalletAdjReason] = useState('Admin manual adjustment');

    // Security State
    const [resetLink, setResetLink] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);

    // --- ENHANCED NETWORK TAB STATE ---
    const [isChangingSponsor, setIsChangingSponsor] = useState(false);
    const [newSponsorUsername, setNewSponsorUsername] = useState('');
    const [isGrantingPlan, setIsGrantingPlan] = useState(false);
    const [grantPlanId, setGrantPlanId] = useState('');
    
    // Tree Filters
    const [treeFilterTerm, setTreeFilterTerm] = useState('');
    const [treeFilterStatus, setTreeFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [treeFilterHeld, setTreeFilterHeld] = useState<'all' | 'held' | 'paid'>('all');
    const [treeFilterMinRefs, setTreeFilterMinRefs] = useState<number>(0);
    const [treeFilterPlanId, setTreeFilterPlanId] = useState('');
    const [treeFilterType, setTreeFilterType] = useState<'all' | 'direct' | 'indirect'>('all');

    // Financial History Filter State
    const [historyTypeFilter, setHistoryTypeFilter] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');


    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRestrictionsChange = (key: keyof UserRestrictions) => {
        setFormData(prev => ({
            ...prev,
            restrictions: {
                ...prev.restrictions,
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

    const handleChangeSponsor = async () => {
        if (!user || !newSponsorUsername.trim()) return;
        if (newSponsorUsername.toLowerCase() === user.username.toLowerCase()) return alert("A user cannot be their own sponsor.");
        const sponsorExists = users.find(u => u.username.toLowerCase() === newSponsorUsername.toLowerCase());
        if (!sponsorExists) return alert(`User @${newSponsorUsername} not found.`);
        setIsSaving(true);
        try {
            const updatedUser = await apiUpdateUser(user._id, { sponsor: sponsorExists.username });
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            setFormData(prev => ({ ...prev, sponsor: updatedUser.sponsor }));
            alert(`Sponsor updated to @${updatedUser.sponsor}`);
            setIsChangingSponsor(false);
            setNewSponsorUsername('');
        } catch (error) {
            console.error(error);
            alert("Failed to update sponsor.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGrantPlan = async () => {
        if (!user || !grantPlanId) return;
        const planToGrant = investmentPlans.find(p => p._id === grantPlanId);
        if (!planToGrant) return;
        setIsSaving(true);
        try {
            const updatedPlans = [...(user.activePlans || []), {
                planId: planToGrant._id,
                planName: planToGrant.name,
                price: planToGrant.price,
                purchaseDate: new Date().toISOString()
            }];
            const updatedUser = await apiUpdateUser(user._id, { activePlans: updatedPlans });
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            setFormData(prev => ({ ...prev, activePlans: updatedUser.activePlans }));
            alert(`Granted '${planToGrant.name}' plan successfully.`);
            setIsGrantingPlan(false);
            setGrantPlanId('');
        } catch (error) {
            console.error(error);
            alert("Failed to grant plan.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemovePlan = async (index: number) => {
        if (!user) return;
        const reason = window.prompt("Reason for plan revocation (for logs):", "Plan correction");
        if (reason === null) return;
        if (!window.confirm("Are you sure you want to revoke this plan from the user?")) return;
        setIsSaving(true);
        try {
            const updatedPlans = [...(user.activePlans || [])];
            updatedPlans.splice(index, 1);
            const updatedUser = await apiUpdateUser(user._id, { activePlans: updatedPlans });
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            setFormData(prev => ({ ...prev, activePlans: updatedUser.activePlans }));
            alert("Plan revoked successfully. Reason: " + (reason || "N/A"));
        } catch (error) {
            console.error(error);
            alert("Failed to revoke plan.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const TabButton: React.FC<{ tabId: typeof activeTab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button type="button" onClick={() => setActiveTab(tabId)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>
    );

    const getStatsForMember = useCallback((member: User, managedUserRef: User) => {
        const relevantTx = transactions.filter(t => t.userId === managedUserRef._id && t.type === 'Commission' && t.sourceUserId === member._id);
        const earned = relevantTx.filter(t => t.status === 'Approved').reduce((s, t) => s + t.amount, 0);
        const held = relevantTx.filter(t => t.status === 'Pending').reduce((s, t) => s + t.amount, 0);
        
        const directs = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === member.username.toLowerCase());
        
        const visited = new Set<string>();
        const countDownline = (username: string, depth: number = 0): number => {
            if (!username) return 0;
            const normalized = username.toLowerCase();
            if (visited.has(normalized) || depth > 20) return 0;
            visited.add(normalized);
            const subs = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === normalized);
            return subs.length + subs.reduce((acc, curr) => acc + countDownline(curr.username, depth + 1), 0);
        };

        const totalTeamSize = countDownline(member.username);
        return { earned, held, directRefs: directs.length, totalTeam: totalTeamSize, indirectRefs: Math.max(0, totalTeamSize - directs.length) };
    }, [users, transactions]);

    const genealogyTree = useMemo(() => {
        if (!treeRoot) return [];
        const visited = new Set<string>();
        const buildGenealogy = (sponsorUsername: string, allUsers: User[], level: number, depth: number = 0): { user: User, children: any[], level: number }[] => {
            if (!sponsorUsername) return [];
            const normalized = sponsorUsername.toLowerCase();
            if (visited.has(normalized) || depth > 10) return [];
            visited.add(normalized);
            
            const directReferrals = allUsers.filter(u => u.sponsor && u.sponsor.toLowerCase() === normalized);
            return directReferrals.map(child => ({ user: child, children: buildGenealogy(child.username, allUsers, level + 1, depth + 1), level }));
        };
        return buildGenealogy(treeRoot.username, users, 1);
    }, [treeRoot, users]);

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

    const renderTree = (nodes: { user: User, children: any[], level: number }[]) => {
        const filteredNodes = nodes.filter(n => {
            const stats = getStatsForMember(n.user, user!);
            const isActive = n.user.activePlans && n.user.activePlans.length > 0;
            
            // Apply Search
            if (treeFilterTerm) {
                const term = treeFilterTerm.toLowerCase();
                const matchesSelf = n.user.username.toLowerCase().includes(term) || n.user.fullName.toLowerCase().includes(term);
                if (!matchesSelf && !n.children.some(child => child.user.username.toLowerCase().includes(term))) return false;
            }

            // Apply Status
            if (treeFilterStatus === 'active' && !isActive) return false;
            if (treeFilterStatus === 'inactive' && isActive) return false;

            // Apply Held Commission
            if (treeFilterHeld === 'held' && stats.held <= 0) return false;
            if (treeFilterHeld === 'paid' && stats.earned <= 0) return false;

            // Apply Min Referrals
            if (treeFilterMinRefs > 0 && stats.totalTeam < treeFilterMinRefs) return false;

            // Apply By Plan
            if (treeFilterPlanId && !n.user.activePlans?.some(p => p.planId === treeFilterPlanId)) return false;
            
            // Apply Hierarchy Type
            if (treeFilterType === 'direct' && n.level > 1) return false;
            if (treeFilterType === 'indirect' && n.level === 1) return false;

            return true;
        });

        return (
            <ul className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-4 pt-2">
                {filteredNodes.map(node => {
                    const stats = getStatsForMember(node.user, user!);
                    const isActive = node.user.activePlans && node.user.activePlans.length > 0;
                    
                    return (
                        <li key={node.user._id} className="relative">
                            <div className="absolute left-[-17px] top-8 w-4 h-px bg-gray-300 dark:bg-gray-600"></div>
                            
                            <div className="text-sm bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button"
                                                onClick={() => setTreeRoot(node.user)}
                                                className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                                title="View their Genealogy"
                                            >
                                                @{node.user.username}
                                            </button>
                                            {isActive ? (
                                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Active</span>
                                            ) : (
                                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Inactive</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">{node.user.fullName} | {node.user.country}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Earnings From User</p>
                                        <p className="text-sm font-bold text-green-600">{formatCurrency(stats.earned, user!.currency)}</p>
                                        {stats.held > 0 && (
                                            <div className="flex items-center justify-end gap-1 mt-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                <span className="text-[10px] font-bold text-amber-600">HELD: {formatCurrency(stats.held, user!.currency)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
                                    <div>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase">Active Plans</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {node.user.activePlans?.map((p, i) => (
                                                <span key={i} className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[9px] px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                                    {p.planName}
                                                </span>
                                            )) || <span className="text-[10px] text-gray-400 italic">None</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase">Network Stats</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="text-center bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-0.5 border dark:border-gray-600">
                                                <p className="text-[8px] text-gray-500 uppercase">Direct</p>
                                                <p className="text-[10px] font-bold">{stats.directRefs}</p>
                                            </div>
                                            <div className="text-center bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-0.5 border dark:border-gray-600">
                                                <p className="text-[8px] text-gray-500 uppercase">Indirect</p>
                                                <p className="text-[10px] font-bold">{stats.indirectRefs}</p>
                                            </div>
                                            <div className="text-center bg-blue-50 dark:bg-blue-900/30 rounded px-2 py-0.5 border dark:border-blue-800">
                                                <p className="text-[8px] text-blue-600 uppercase">Total</p>
                                                <p className="text-[10px] font-bold">{stats.totalTeam}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {node.children.length > 0 && <div className="mt-4">{renderTree(node.children)}</div>}
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
         <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[95vw] max-w-5xl h-[92vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{user ? `Manage User: ${user.username}` : 'Add New User'}</h2>
                    {activeTab === 'network' && treeRoot?._id !== user?._id && (
                        <Button size="sm" variant="secondary" onClick={() => setTreeRoot(user)}>
                            &larr; Back to {user?.username}
                        </Button>
                    )}
                </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="space-y-4">
                               <h3 className="font-semibold">Profile Information</h3>
                               <input name="fullName" value={formData.fullName || ''} onChange={handleFormChange} placeholder="Full Name" className="w-full rounded-md dark:bg-gray-700" />
                               <input name="username" value={formData.username || ''} onChange={handleFormChange} placeholder="Username" className="w-full rounded-md dark:bg-gray-700" />
                               <input name="email" value={formData.email || ''} onChange={handleFormChange} placeholder="Email" className="w-full rounded-md dark:bg-gray-700" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="text-xs text-gray-500">Phone</label><input name="phone" value={formData.phone || ''} onChange={handleFormChange} placeholder="Phone" className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                    <div><label className="text-xs text-gray-500">WhatsApp</label><input name="whatsapp" value={formData.whatsapp || ''} onChange={handleFormChange} placeholder="WhatsApp Number" className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                </div>
                                <select name="country" value={formData.country || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">{countries.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <select name="status" value={formData.status} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">{Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}</select>
                            </div>
                            {user && (
                                <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 shadow-inner">
                                    <h3 className="font-semibold">Wallet Management</h3>
                                    <p className="text-2xl font-bold">{formatCurrency(formData.walletBalance || 0, formData.currency || 'PKR')}</p>
                                    <div><label className="text-xs">Adjustment Amount</label><input type="number" value={walletAdjAmount} onChange={e => setWalletAdjAmount(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                    <div><label className="text-xs">Reason</label><input type="text" value={walletAdjReason} onChange={e => setWalletAdjReason(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                                    <div className="flex gap-2"><Button size="sm" variant="success" onClick={() => handleWalletAdjustment('credit')} disabled={isSaving}>Credit (+)</Button><Button size="sm" variant="danger" onClick={() => handleWalletAdjustment('debit')} disabled={isSaving}>Debit (-)</Button></div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'security' && user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="space-y-4">
                                <h3 className="font-semibold">Password Reset</h3>
                                <Button onClick={handleGenerateResetLink} disabled={isGeneratingLink}>{isGeneratingLink ? 'Generating...' : 'Generate Reset Link'}</Button>
                                {resetLink && <div className="text-xs p-2 bg-blue-50 dark:bg-blue-900/50 rounded break-words border dark:border-blue-800">{resetLink}</div>}
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-semibold">Activity Restrictions</h3>
                                {Object.keys(formData.restrictions || {}).map(key => (
                                    <label key={key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 transition-colors">
                                        <span>Block {key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                        <input type="checkbox" checked={(formData.restrictions as any)[key]} onChange={() => handleRestrictionsChange(key as keyof UserRestrictions)} />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'network' && user && (
                         <div className="space-y-6 animate-fade-in pb-10 px-1">
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                 <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border dark:border-gray-600 text-center"><p className="text-[10px] text-gray-500 uppercase font-bold">Direct Referrals</p><p className="text-xl font-bold">{users.filter(u => u.sponsor && u.sponsor.toLowerCase() === treeRoot?.username?.toLowerCase()).length}</p></div>
                                 <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-600 text-center ring-2 ring-blue-500 ring-inset"><p className="text-[10px] text-blue-500 uppercase font-bold">Viewing Genealogy Of</p><p className="text-xl font-bold text-blue-600 truncate px-2">@{treeRoot?.username}</p></div>
                                 <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border dark:border-gray-600 text-center"><p className="text-[10px] text-gray-500 uppercase font-bold text-amber-600">Held Amount</p><p className="text-xl font-bold text-amber-600">{formatCurrency(transactions.filter(t => t.userId === treeRoot?._id && t.status === 'Pending').reduce((s,t)=>s+t.amount,0), treeRoot?.currency || 'USD')}</p></div>
                                 <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border dark:border-gray-600 text-center"><p className="text-[10px] text-gray-500 uppercase font-bold text-green-600">Total Earnings</p><p className="text-xl font-bold text-green-600">{formatCurrency(transactions.filter(t => t.userId === treeRoot?._id && t.status === 'Approved' && t.type === 'Commission').reduce((s,t)=>s+t.amount,0), treeRoot?.currency || 'USD')}</p></div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                 <div className="md:col-span-2 space-y-6">
                                     <section className="bg-white dark:bg-gray-700/40 p-4 rounded-xl border dark:border-gray-600">
                                         <h3 className="font-bold mb-4 border-b dark:border-gray-600 pb-2 flex items-center gap-2">
                                             Genealogy Tree View
                                             <span className="text-xs font-normal text-gray-400">(Click a username to view thier team)</span>
                                         </h3>
                                         
                                         {/* POWERFUL FILTERS */}
                                         <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 border dark:border-gray-600 shadow-sm space-y-4">
                                             <div className="flex items-center justify-between mb-2">
                                                 <h4 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider flex items-center gap-1"><FilterIcon /> Advanced Tree Filters</h4>
                                                 <button onClick={() => { setTreeFilterTerm(''); setTreeFilterStatus('all'); setTreeFilterHeld('all'); setTreeFilterMinRefs(0); setTreeFilterPlanId(''); setTreeFilterType('all'); }} className="text-[10px] text-blue-500 font-bold hover:underline">Reset</button>
                                             </div>
                                             
                                             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                 <div className="col-span-2 md:col-span-3">
                                                     <input type="text" value={treeFilterTerm} onChange={e => setTreeFilterTerm(e.target.value)} placeholder="Search member name or username..." className="w-full text-xs p-2 rounded border dark:bg-gray-900 dark:border-gray-700" />
                                                 </div>
                                                 <div>
                                                     <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Status</label>
                                                     <select value={treeFilterStatus} onChange={e => setTreeFilterStatus(e.target.value as any)} className="w-full text-[11px] p-1.5 rounded border dark:bg-gray-900 dark:border-gray-700">
                                                         <option value="all">All Members</option>
                                                         <option value="active">Active Members</option>
                                                         <option value="inactive">Inactive Members</option>
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Commission</label>
                                                     <select value={treeFilterHeld} onChange={e => setTreeFilterHeld(e.target.value as any)} className="w-full text-[11px] p-1.5 rounded border dark:bg-gray-900 dark:border-gray-700">
                                                         <option value="all">Any History</option>
                                                         <option value="held">Has Held Funds</option>
                                                         <option value="paid">Has Paid Comms</option>
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Min. Team Size</label>
                                                     <input type="number" value={treeFilterMinRefs} onChange={e => setTreeFilterMinRefs(parseInt(e.target.value) || 0)} className="w-full text-[11px] p-1.5 rounded border dark:bg-gray-900 dark:border-gray-700" />
                                                 </div>
                                                 <div>
                                                     <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Specific Plan</label>
                                                     <select value={treeFilterPlanId} onChange={e => setTreeFilterPlanId(e.target.value)} className="w-full text-[11px] p-1.5 rounded border dark:bg-gray-900 dark:border-gray-700">
                                                         <option value="">Any Plan</option>
                                                         {investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, p.currency)})</option>)}
                                                     </select>
                                                 </div>
                                                  <div>
                                                     <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Hierarchy Type</label>
                                                     <select value={treeFilterType} onChange={e => setTreeFilterType(e.target.value as any)} className="w-full text-[11px] p-1.5 rounded border dark:bg-gray-900 dark:border-gray-700">
                                                         <option value="all">All Ref</option>
                                                         <option value="direct">Direct Ref Only</option>
                                                         <option value="indirect">Indirect Ref Only</option>
                                                     </select>
                                                 </div>
                                             </div>
                                         </div>

                                         <div className="max-h-[600px] overflow-y-auto border dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-900/30 custom-scrollbar relative">
                                            {genealogyTree.length > 0 ? renderTree(genealogyTree) : <p className="text-xs text-gray-400 italic text-center py-10">No downline network found for this user.</p>}
                                         </div>
                                     </section>
                                 </div>

                                 <div className="md:col-span-1 space-y-6">
                                     <section className="bg-white dark:bg-gray-700/40 p-4 rounded-xl border dark:border-gray-600">
                                         <div className="flex justify-between items-center mb-4 border-b dark:border-gray-600 pb-2">
                                             <h3 className="font-bold">Active Plans Management</h3>
                                             <button type="button" onClick={() => setIsGrantingPlan(!isGrantingPlan)} className="text-xs text-blue-500 hover:underline font-bold">+ Grant Plan</button>
                                         </div>
                                         {isGrantingPlan && (
                                              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 space-y-3 animate-fade-in">
                                                  <p className="text-[10px] text-green-700 dark:text-green-300 font-bold uppercase tracking-widest">Manual Plan Grant Tool</p>
                                                  <select value={grantPlanId} onChange={e => setGrantPlanId(e.target.value)} className="w-full text-sm rounded border-green-300 dark:bg-gray-800">
                                                      <option value="">-- Select Plan to Add --</option>
                                                      {investmentPlans.filter(p => p.currency === user.currency && p.status === 'Active').map(p => (
                                                          <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, p.currency)})</option>
                                                      ))}
                                                  </select>
                                                  <div className="flex gap-2 justify-end">
                                                      <Button size="sm" variant="secondary" onClick={() => setIsGrantingPlan(false)}>Cancel</Button>
                                                      <Button size="sm" variant="success" onClick={handleGrantPlan} disabled={isSaving || !grantPlanId}>Confirm Access</Button>
                                                  </div>
                                              </div>
                                         )}
                                         <div className="space-y-3">
                                             {formData.activePlans && formData.activePlans.length > 0 ? (
                                                 formData.activePlans.map((p, i) => (
                                                     <div key={p.planId + i} className="p-4 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-600 flex justify-between items-center shadow-sm group">
                                                         <div>
                                                             <span className="font-bold text-blue-600 dark:text-blue-400 block">{p.planName}</span>
                                                             <div className="flex items-center gap-2 mt-1">
                                                                 <span className="text-[10px] text-gray-400 font-medium">GRANTED: {new Date(p.purchaseDate).toLocaleDateString()}</span>
                                                                 <span className="text-[10px] font-bold text-green-600 uppercase">{formatCurrency(p.price, user.currency)}</span>
                                                             </div>
                                                         </div>
                                                         <button type="button" onClick={() => handleRemovePlan(i)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100" title="Revoke Plan"><TrashIcon /></button>
                                                     </div>
                                                 ))
                                             ) : <div className="p-10 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 italic text-xs">No active plans found for this user.</div>}
                                         </div>
                                     </section>
                                 </div>
                             </div>
                         </div>
                    )}

                    {activeTab === 'history' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <h3 className="font-semibold">Financial History</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                                <div><select value={historyTypeFilter} onChange={e => setHistoryTypeFilter(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700"><option value="">All Types</option>{transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                <div><select value={historyStatusFilter} onChange={e => setHistoryStatusFilter(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700"><option value="">All Statuses</option>{Object.values(Status).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                                <div><input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700" /></div>
                                <div><input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700" /></div>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto border dark:border-gray-700 rounded-lg">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10 font-bold">
                                        <tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3">Description</th></tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {filteredUserTransactions.length > 0 ? filteredUserTransactions.map(tx => (
                                            <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="p-3 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                                                <td className="p-3">{tx.type}</td>
                                                <td className={`p-3 text-right font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount, tx.currency)}</td>
                                                <td className="p-3"><Badge status={tx.status as Status || Status.Approved} /></td>
                                                <td className="p-3 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                                            </tr>
                                        )) : <tr><td colSpan={5} className="p-10 text-center text-gray-500 italic">No records found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="button" onClick={handleSaveChanges} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save User Profile'}</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Helper Components ---
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const FilterIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;

const DeleteUserModal: React.FC<{ user: User; onClose: () => void; onConfirmDelete: (userId: string) => Promise<void>; }> = ({ user, onClose, onConfirmDelete }) => {
    const { state } = useData();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDelete = async () => { setIsDeleting(true); await onConfirmDelete(user._id); };

    const handleDownloadDossier = () => {
        setIsDownloading(true);
        const { transactions, deposits, withdrawals, transfers, disputes, users } = state;
        const csvEscape = (field: any): string => { if (field === null || field === undefined) return '""'; const str = String(field); if (str.includes(',') || str.includes('"') || str.includes('\n')) { return `"${str.replace(/"/g, '""')}"`; } return str; };
        const toCsvRow = (arr: any[]): string => arr.map(csvEscape).join(',');
        
        let csvRows: string[] = [];
        csvRows.push(toCsvRow(['USER DOSSIER', `Generated: ${new Date().toLocaleString()}`]));
        csvRows.push(toCsvRow(['App Name', 'SmartEarning v1.10.11']));
        csvRows.push('');
        
        // PROFILE
        csvRows.push(toCsvRow(['--- PROFILE DETAILS ---']));
        csvRows.push(toCsvRow(['User ID', user._id]));
        csvRows.push(toCsvRow(['Username', user.username]));
        csvRows.push(toCsvRow(['Full Name', user.fullName]));
        csvRows.push(toCsvRow(['Email', user.email]));
        csvRows.push(toCsvRow(['Phone', user.phone]));
        csvRows.push(toCsvRow(['WhatsApp', user.whatsapp || 'N/A']));
        csvRows.push(toCsvRow(['Country', user.country]));
        csvRows.push(toCsvRow(['Currency', user.currency]));
        csvRows.push(toCsvRow(['Balance', formatCurrency(user.walletBalance, user.currency)]));
        csvRows.push(toCsvRow(['Sponsor', user.sponsor || 'None']));
        csvRows.push(toCsvRow(['Status', user.status]));
        csvRows.push(toCsvRow(['Registered', new Date(user.registrationDate).toLocaleString()]));
        csvRows.push('');

        // SUMMARY STATS
        const userTx = transactions.filter(t => t.userId === user._id);
        const depTotal = deposits.filter(d => d.userId === user._id && d.status === 'Approved').reduce((s, d) => s + d.amount, 0);
        const withTotal = withdrawals.filter(w => w.userId === user._id && w.status === 'Paid').reduce((s, w) => s + w.finalAmount, 0);
        const commTotal = userTx.filter(t => t.type === 'Commission' && t.status === 'Approved').reduce((s, t) => s + t.amount, 0);
        const refCount = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === user.username.toLowerCase()).length;

        csvRows.push(toCsvRow(['--- FINANCIAL SUMMARY ---']));
        csvRows.push(toCsvRow(['Total Deposits Approved', formatCurrency(depTotal, user.currency)]));
        csvRows.push(toCsvRow(['Total Withdrawals Paid', formatCurrency(withTotal, user.currency)]));
        csvRows.push(toCsvRow(['Total Commission Earned', formatCurrency(commTotal, user.currency)]));
        csvRows.push(toCsvRow(['Direct Referral Count', refCount]));
        csvRows.push('');

        // ACTIVE PLANS
        csvRows.push(toCsvRow(['--- ACTIVE PLANS ---']));
        if (user.activePlans && user.activePlans.length > 0) {
            csvRows.push(toCsvRow(['Plan Name', 'Price', 'Purchase Date']));
            user.activePlans.forEach(p => csvRows.push(toCsvRow([p.planName, formatCurrency(p.price, user.currency), new Date(p.purchaseDate).toLocaleDateString()])));
        } else {
            csvRows.push(toCsvRow(['No active plans']));
        }
        csvRows.push('');

        // TRANSACTIONS
        csvRows.push(toCsvRow(['--- FULL TRANSACTION LEDGER ---']));
        csvRows.push(toCsvRow(['Date', 'Type', 'Amount', 'Status', 'Description']));
        userTx.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(tx => csvRows.push(toCsvRow([new Date(tx.date).toLocaleString(), tx.type, formatCurrency(tx.amount, tx.currency), tx.status || 'Approved', tx.description])));
        csvRows.push('');

        // DEPOSITS
        csvRows.push(toCsvRow(['--- DEPOSIT HISTORY ---']));
        const userDeps = deposits.filter(d => d.userId === user._id);
        if (userDeps.length > 0) {
            csvRows.push(toCsvRow(['Date', 'Method', 'Amount', 'Trx ID', 'Status', 'Notes']));
            userDeps.forEach(d => csvRows.push(toCsvRow([new Date(d.date).toLocaleString(), d.method, formatCurrency(d.amount, d.currency), d.transactionId, d.status, d.adminNotes || ''])));
        } else {
            csvRows.push(toCsvRow(['No deposit records']));
        }
        csvRows.push('');

        // WITHDRAWALS
        csvRows.push(toCsvRow(['--- WITHDRAWAL HISTORY ---']));
        const userWiths = withdrawals.filter(w => w.userId === user._id);
        if (userWiths.length > 0) {
            csvRows.push(toCsvRow(['Date', 'Method', 'Amount', 'Fee', 'Net', 'Status', 'Account Details']));
            userWiths.forEach(w => csvRows.push(toCsvRow([new Date(w.date).toLocaleString(), w.method, formatCurrency(w.amount, w.currency), formatCurrency(w.fee, w.currency), formatCurrency(w.finalAmount, w.currency), w.status, `${w.accountTitle} (${w.accountNumber})`])));
        } else {
            csvRows.push(toCsvRow(['No withdrawal records']));
        }
        csvRows.push('');

        // TRANSFERS
        csvRows.push(toCsvRow(['--- TRANSFER HISTORY ---']));
        const userTrans = transfers.filter(t => t.senderId === user._id || t.recipientId === user._id);
        if (userTrans.length > 0) {
            csvRows.push(toCsvRow(['Date', 'Role', 'Counterparty', 'Amount', 'Fee', 'Status']));
            userTrans.forEach(t => {
                const isSender = t.senderId === user._id;
                csvRows.push(toCsvRow([new Date(t.date).toLocaleString(), isSender ? 'Sender' : 'Recipient', isSender ? t.recipientName : t.senderName, formatCurrency(t.amount, t.currency), isSender ? formatCurrency(t.fee||0, t.currency) : '-', t.status]));
            });
        } else {
            csvRows.push(toCsvRow(['No transfer records']));
        }
        csvRows.push('');

        // DISPUTES
        csvRows.push(toCsvRow(['--- DISPUTE HISTORY ---']));
        const userDisps = disputes.filter(d => d.userId === user._id);
        if (userDisps.length > 0) {
            csvRows.push(toCsvRow(['Date', 'Type', 'Status', 'Ref ID', 'Description', 'Chat Log']));
            userDisps.forEach(d => {
                const chatLog = (d.messages || []).map(m => `[${new Date(m.date).toLocaleString()} - ${m.sender}]: ${m.message}`).join(' | ');
                csvRows.push(toCsvRow([new Date(d.date).toLocaleString(), d.type, d.status, d.referenceId, d.description, chatLog]));
            });
        } else {
            csvRows.push(toCsvRow(['No dispute records']));
        }

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Complete_Dossier_${user.username}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setIsDownloading(false);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-lg">
                <h3 className="text-lg font-bold text-red-600 mb-4">Confirm Deletion</h3>
                <p>Delete user <strong>{user.fullName} (@{user.username})</strong>?</p>
                <p className="mt-4 text-xs text-red-500 bg-red-50 dark:bg-red-900/50 p-2 rounded-md font-bold uppercase tracking-tight">This action is irreversible and deletes all financial and network records.</p>
                <div className="mt-6 flex justify-between items-center border-t pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={handleDownloadDossier} disabled={isDownloading}>{isDownloading ? '...' : 'Download Complete Dossier'}</Button>
                        <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// NEW: Bulk Delete User Modal
const BulkDeleteUserModal: React.FC<{ userIds: string[]; onClose: () => void; onConfirmBulkDelete: (ids: string[]) => Promise<void>; }> = ({ userIds, onClose, onConfirmBulkDelete }) => {
    const { state } = useData();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [hasDownloaded, setHasDownloaded] = useState(false);

    const selectedUsers = state.users.filter(u => userIds.includes(u._id));

    const handleDelete = async () => { setIsDeleting(true); await onConfirmBulkDelete(userIds); };

    const handleDownloadBulkDossier = () => {
        setIsDownloading(true);
        const { transactions, deposits, withdrawals, transfers, disputes, users } = state;
        const csvEscape = (field: any): string => { if (field === null || field === undefined) return '""'; const str = String(field); if (str.includes(',') || str.includes('"') || str.includes('\n')) { return `"${str.replace(/"/g, '""')}"`; } return str; };
        const toCsvRow = (arr: any[]): string => arr.map(csvEscape).join(',');
        
        let csvRows: string[] = [];
        csvRows.push(toCsvRow(['BULK USER DOSSIER EXPORT', `Generated: ${new Date().toLocaleString()}`]));
        csvRows.push(toCsvRow(['App Name', 'SmartEarning v1.10.11']));
        csvRows.push(toCsvRow(['User Count', selectedUsers.length]));
        csvRows.push('');

        selectedUsers.forEach(user => {
            csvRows.push(toCsvRow(['==================================================']));
            csvRows.push(toCsvRow([`=== DOSSIER FOR: ${user.fullName.toUpperCase()} (@${user.username}) ===`]));
            csvRows.push(toCsvRow(['==================================================']));
            csvRows.push('');

            // PROFILE
            csvRows.push(toCsvRow(['--- PROFILE DETAILS ---']));
            csvRows.push(toCsvRow(['User ID', user._id]));
            csvRows.push(toCsvRow(['Username', user.username]));
            csvRows.push(toCsvRow(['Full Name', user.fullName]));
            csvRows.push(toCsvRow(['Email', user.email]));
            csvRows.push(toCsvRow(['Phone', user.phone]));
            csvRows.push(toCsvRow(['WhatsApp', user.whatsapp || 'N/A']));
            csvRows.push(toCsvRow(['Country', user.country]));
            csvRows.push(toCsvRow(['Currency', user.currency]));
            csvRows.push(toCsvRow(['Balance', formatCurrency(user.walletBalance, user.currency)]));
            csvRows.push(toCsvRow(['Sponsor', user.sponsor || 'None']));
            csvRows.push(toCsvRow(['Status', user.status]));
            csvRows.push(toCsvRow(['Registered', new Date(user.registrationDate).toLocaleString()]));
            csvRows.push('');

            // SUMMARY STATS
            const userTx = transactions.filter(t => t.userId === user._id);
            const depTotal = deposits.filter(d => d.userId === user._id && d.status === 'Approved').reduce((s, d) => s + d.amount, 0);
            const withTotal = withdrawals.filter(w => w.userId === user._id && w.status === 'Paid').reduce((s, w) => s + w.finalAmount, 0);
            const commTotal = userTx.filter(t => t.type === 'Commission' && t.status === 'Approved').reduce((s, t) => s + t.amount, 0);
            const refCount = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === user.username.toLowerCase()).length;

            csvRows.push(toCsvRow(['--- FINANCIAL SUMMARY ---']));
            csvRows.push(toCsvRow(['Total Deposits Approved', formatCurrency(depTotal, user.currency)]));
            csvRows.push(toCsvRow(['Total Withdrawals Paid', formatCurrency(withTotal, user.currency)]));
            csvRows.push(toCsvRow(['Total Commission Earned', formatCurrency(commTotal, user.currency)]));
            csvRows.push(toCsvRow(['Direct Referral Count', refCount]));
            csvRows.push('');

            // ACTIVE PLANS
            csvRows.push(toCsvRow(['--- ACTIVE PLANS ---']));
            if (user.activePlans && user.activePlans.length > 0) {
                csvRows.push(toCsvRow(['Plan Name', 'Price', 'Purchase Date']));
                user.activePlans.forEach(p => csvRows.push(toCsvRow([p.planName, formatCurrency(p.price, user.currency), new Date(p.purchaseDate).toLocaleDateString()])));
            } else {
                csvRows.push(toCsvRow(['No active plans']));
            }
            csvRows.push('');

            // TRANSACTIONS
            csvRows.push(toCsvRow(['--- TRANSACTION LEDGER ---']));
            csvRows.push(toCsvRow(['Date', 'Type', 'Amount', 'Status', 'Description']));
            userTx.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(tx => csvRows.push(toCsvRow([new Date(tx.date).toLocaleString(), tx.type, formatCurrency(tx.amount, tx.currency), tx.status || 'Approved', tx.description])));
            csvRows.push('');

            // DEPOSITS
            csvRows.push(toCsvRow(['--- DEPOSIT LOG ---']));
            const userDeps = deposits.filter(d => d.userId === user._id);
            if (userDeps.length > 0) {
                csvRows.push(toCsvRow(['Date', 'Method', 'Amount', 'Trx ID', 'Status', 'Notes']));
                userDeps.forEach(d => csvRows.push(toCsvRow([new Date(d.date).toLocaleString(), d.method, formatCurrency(d.amount, d.currency), d.transactionId, d.status, d.adminNotes || ''])));
            } else {
                csvRows.push(toCsvRow(['No deposit records']));
            }
            csvRows.push('');

            // WITHDRAWALS
            csvRows.push(toCsvRow(['--- WITHDRAWAL LOG ---']));
            const userWiths = withdrawals.filter(w => w.userId === user._id);
            if (userWiths.length > 0) {
                csvRows.push(toCsvRow(['Date', 'Method', 'Amount', 'Fee', 'Net', 'Status', 'Account Details']));
                userWiths.forEach(w => csvRows.push(toCsvRow([new Date(w.date).toLocaleString(), w.method, formatCurrency(w.amount, w.currency), formatCurrency(w.fee, w.currency), formatCurrency(w.finalAmount, w.currency), w.status, `${w.accountTitle} (${w.accountNumber})`])));
            } else {
                csvRows.push(toCsvRow(['No withdrawal records']));
            }
            // TRANSFERS
            csvRows.push(toCsvRow(['--- TRANSFER LOG ---']));
            const userTrans = transfers.filter(t => t.senderId === user._id || t.recipientId === user._id);
            if (userTrans.length > 0) {
                csvRows.push(toCsvRow(['Date', 'Role', 'Counterparty', 'Amount', 'Fee', 'Status']));
                userTrans.forEach(t => {
                    const isSender = t.senderId === user._id;
                    csvRows.push(toCsvRow([new Date(t.date).toLocaleString(), isSender ? 'Sender' : 'Recipient', isSender ? t.recipientName : t.senderName, formatCurrency(t.amount, t.currency), isSender ? formatCurrency(t.fee||0, t.currency) : '-', t.status]));
                });
            } else {
                csvRows.push(toCsvRow(['No transfer records']));
            }
            csvRows.push('');

            // DISPUTES
            csvRows.push(toCsvRow(['--- DISPUTE LOG ---']));
            const userDisps = disputes.filter(d => d.userId === user._id);
            if (userDisps.length > 0) {
                csvRows.push(toCsvRow(['Date', 'Type', 'Status', 'Ref ID', 'Description', 'Chat Log']));
                userDisps.forEach(d => {
                    const chatLog = (d.messages || []).map(m => `[${new Date(m.date).toLocaleString()} - ${m.sender}]: ${m.message}`).join(' | ');
                    csvRows.push(toCsvRow([new Date(d.date).toLocaleString(), d.type, d.status, d.referenceId, d.description, chatLog]));
                });
            } else {
                csvRows.push(toCsvRow(['No dispute records']));
            }
            
            csvRows.push('');
            csvRows.push(''); // Spacing between users
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Bulk_Complete_Dossier_Export_${selectedUsers.length}_Users.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        
        setIsDownloading(false);
        setHasDownloaded(true);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-xl">
                <h3 className="text-xl font-bold text-red-600 mb-4">Confirm Bulk Deletion</h3>
                <p className="mb-4">You are about to delete <strong>{selectedUsers.length} users</strong> and all their associated data.</p>
                
                <div className="max-h-40 overflow-y-auto mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                    <ul className="text-sm space-y-1">
                        {selectedUsers.map(u => (
                            <li key={u._id} className="flex justify-between">
                                <span className="font-semibold">@{u.username}</span>
                                <span className="text-gray-500">{u.email}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md font-bold uppercase tracking-tight mb-6">
                    RECOMMENDED: Download the detailed dossier (backup) of these users before permanent deletion. This includes full profile data, financial logs, network details, and transaction history.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 border-t pt-6">
                    <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel Action</Button>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Button 
                            variant="secondary" 
                            onClick={handleDownloadBulkDossier} 
                            disabled={isDownloading}
                            className={hasDownloaded ? 'bg-green-50 text-green-700 border-green-200' : ''}
                        >
                            {isDownloading ? 'Generating...' : hasDownloaded ? '✓ Dossier Downloaded' : 'Download Complete Dossiers'}
                        </Button>
                        <Button 
                            variant="danger" 
                            onClick={handleDelete} 
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting Batch...' : 'Delete Permanently'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const BulkRestrictionsModal: React.FC<{ allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [targetType, setTargetType] = useState<'all' | 'plan' | 'manual'>('all');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [restrictions, setRestrictions] = useState<Partial<UserRestrictions>>({});
    const [action, setAction] = useState<'enable' | 'disable'>('enable');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [manualUserSearch, setManualUserSearch] = useState('');
    
    const filteredManualUsers = useMemo(() => {
        const term = manualUserSearch.toLowerCase();
        return allUsers.filter(u => u.username.toLowerCase().includes(term) || u.fullName.toLowerCase().includes(term));
    }, [allUsers, manualUserSearch]);

    const restrictionOptions: { key: keyof UserRestrictions; label: string }[] = [{ key: 'deposit', label: 'Deposits' }, { key: 'withdrawal', label: 'Withdrawals' }, { key: 'transfer', label: 'Transfers' }, { key: 'earning', label: 'Earning Commissions' }, { key: 'dispute', label: 'Raising Disputes' }];

    const handleSubmit = async () => {
        if (Object.keys(restrictions).length === 0) return alert('Select at least one restriction.');
        setIsSubmitting(true);
        try {
            await bulkUpdateUserRestrictions({ targetType: targetType === 'manual' ? 'single' : targetType, targetIds, restrictions, action, sendNotification: true });
            const updatedUsers = await getUsers();
            dispatch({ type: 'SET_USERS', payload: updatedUsers });
            alert('Bulk update successful.');
            onClose();
        } catch (error) { console.error(error); alert('Update failed.'); } finally { setIsSubmitting(false); }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-lg">
                <h3 className="text-lg font-bold mb-4">Bulk User Restrictions</h3>
                <div className="space-y-4">
                    <div><label className="text-sm font-medium">Target Users</label><select value={targetType} onChange={e => { setTargetType(e.target.value as any); setTargetIds([]); }} className="w-full rounded-md dark:bg-gray-700 mt-1"><option value="all">All Users</option><option value="plan">By Plan</option><option value="manual">Manual Select</option></select></div>
                    {targetType === 'plan' && <div><label className="text-sm font-medium">Select Plans</label><select multiple value={targetIds} onChange={e => setTargetIds(Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value))} className="w-full rounded-md dark:bg-gray-700 mt-1 h-24">{investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>}
                    {targetType === 'manual' && <div className="space-y-2"><input type="text" value={manualUserSearch} onChange={e => setManualUserSearch(e.target.value)} placeholder="Filter users..." className="w-full rounded-md dark:bg-gray-700" /><div className="border dark:border-gray-600 rounded-md max-h-32 overflow-y-auto">{filteredManualUsers.map(u => <label key={u._id} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"><input type="checkbox" checked={targetIds.includes(u._id)} onChange={() => setTargetIds(prev => prev.includes(u._id) ? prev.filter(i=>i!==u._id) : [...prev, u._id])} /> <span className="text-xs">{u.username}</span></label>)}</div></div>}
                    <div><label className="text-sm font-medium">Action</label><div className="flex gap-4 mt-1"><label className="text-xs flex items-center gap-1"><input type="radio" value="enable" checked={action === 'enable'} onChange={() => setAction('enable')} /> Enable (Block)</label><label className="text-xs flex items-center gap-1"><input type="radio" value="disable" checked={action === 'disable'} onChange={() => setAction('disable')} /> Disable (Allow)</label></div></div>
                    <div><label className="text-sm font-medium">Modifications</label><div className="grid grid-cols-2 gap-2 mt-1 border p-2 rounded dark:border-gray-600">{restrictionOptions.map(r => <label key={r.key} className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!restrictions[r.key]} onChange={() => setRestrictions(prev => ({...prev, [r.key]: !prev[r.key]}))} /> {r.label}</label>)}</div></div>
                </div>
                <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? '...' : 'Apply Bulk'}</Button></div>
            </div>
        </Modal>
    );
};

const MessageUserModal: React.FC<{ user: User | null; allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ user, allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isPopup, setIsPopup] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [targetType, setTargetType] = useState<'all' | 'plan' | 'inactive' | 'single' | 'manual'>(user ? 'single' : 'all');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [manualSearch, setManualSearch] = useState('');
    const filtered = allUsers.filter(u => u.username.toLowerCase().includes(manualSearch.toLowerCase()));

    const handleSubmit = async () => {
        if (!message) return alert("Message cannot be empty.");
        setIsSubmitting(true);
        try {
            const payload: any = { subject, message, isPopup, targetType: targetType === 'manual' ? 'single' : targetType, targetIds: user ? [user._id] : targetIds };
            const result = await sendAdminNotification(payload);
            dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            alert('Message(s) sent.');
            onClose();
        } catch (error) { console.error(error); alert('Failed to send.'); } finally { setIsSubmitting(false); }
    };
    
    return (
         <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-2xl">
                <h3 className="text-lg font-bold mb-4">{user ? `Message @${user.username}` : 'Bulk Messaging'}</h3>
                <div className="space-y-4">
                    {!user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Target</label><select value={targetType} onChange={e => { setTargetType(e.target.value as any); setTargetIds([]); }} className="w-full rounded border dark:bg-gray-700 mt-1"><option value="all">All Users</option><option value="plan">By Plan</option><option value="inactive">Inactive</option><option value="manual">Manual</option></select></div>
                            {targetType === 'plan' && <div><label className="text-xs font-bold text-gray-500 uppercase">Select Plans</label><select multiple value={targetIds} onChange={e => setTargetIds(Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value))} className="w-full rounded border dark:bg-gray-700 mt-1 h-20">{investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>}
                            {targetType === 'manual' && <div className="md:col-span-2 space-y-2"><input value={manualSearch} onChange={e=>setManualSearch(e.target.value)} placeholder="Filter..." className="w-full text-xs rounded border dark:bg-gray-700"/><div className="max-h-24 overflow-y-auto border rounded dark:border-gray-600">{filtered.map(u=><label key={u._id} className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700"><input type="checkbox" checked={targetIds.includes(u._id)} onChange={()=>setTargetIds(prev=>prev.includes(u._id)?prev.filter(i=>i!==u._id):[...prev, u._id])}/> <span className="text-xs">{u.username}</span></label>)}</div></div>}
                        </div>
                    )}
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Subject</label><input value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded border dark:bg-gray-700 mt-1" /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Message</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full rounded border dark:bg-gray-700 mt-1" required /></div>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isPopup} onChange={e => setIsPopup(e.target.checked)} /> <span className="text-sm">High Priority (Popup)</span></label>
                </div>
                <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send Message'}</Button></div>
            </div>
        </Modal>
    );
};

export default Users;