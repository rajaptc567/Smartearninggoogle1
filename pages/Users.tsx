
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers } from '../services/api';

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
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('');

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
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="PKR">PKR</option>
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
                    <Button variant="secondary" onClick={handleDownloadSelected}>Download Selected ({selectedUserIds.length})</Button>
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
    const { users, transactions } = state;

    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'network' | 'history'>('profile');
    const [formData, setFormData] = useState<Partial<User>>(
        user || { fullName: '', username: '', email: '', phone: '', whatsapp: '', country: '', status: Status.Active, walletBalance: 0, restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false } }
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
                // FIX: Cast to 'any' to allow passing the 'password' property, which is not in the frontend User type, to the creation API.
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
    
    const TabButton: React.FC<{ tabId: typeof activeTab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button type="button" onClick={() => setActiveTab(tabId)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>
    );

    const genealogyTree = useMemo(() => {
        if (!user) return [];
        const buildGenealogy = (sponsorUsername: string, allUsers: User[]): { user: User, children: any[] }[] => {
            const directReferrals = allUsers.filter(u => u.sponsor === sponsorUsername);
            if (!directReferrals.length) return [];
            return directReferrals.map(child => ({ user: child, children: buildGenealogy(child.username, allUsers) }));
        };
        return buildGenealogy(user.username, users);
    }, [user, users]);

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

    const renderTree = (nodes: { user: User, children: any[] }[]) => (
        <ul className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-3">
            {nodes.map(node => (
                <li key={node.user._id} className="text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                    <div className="flex justify-between items-center">
                        <p className="font-bold">{node.user.username}</p>
                        <Badge status={node.user.status} />
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
                    {/* PROFILE & WALLET TAB */}
                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                               <h3 className="font-semibold">Profile Information</h3>
                               <input name="fullName" value={formData.fullName || ''} onChange={handleFormChange} placeholder="Full Name" className="w-full rounded-md dark:bg-gray-700" />
                               <input name="username" value={formData.username || ''} onChange={handleFormChange} placeholder="Username" className="w-full rounded-md dark:bg-gray-700" />
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
                                    {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {user && (
                            <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
                                <h3 className="font-semibold">Wallet Management</h3>
                                <p className="text-2xl font-bold">{formatCurrency(formData.walletBalance || 0, formData.currency || 'USD')}</p>
                                <div>
                                    <label className="text-xs">Adjustment Amount</label>
                                    <input type="number" value={walletAdjAmount} onChange={e => setWalletAdjAmount(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" />
                                </div>
                                 <div>
                                    <label className="text-xs">Reason / Description</label>
                                    <input type="text" value={walletAdjReason} onChange={e => setWalletAdjReason(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" />
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="success" onClick={() => handleWalletAdjustment('credit')} disabled={isSaving}>Credit (+)</Button>
                                    <Button size="sm" variant="danger" onClick={() => handleWalletAdjustment('debit')} disabled={isSaving}>Debit (-)</Button>
                                </div>
                            </div>
                            )}
                        </div>
                    )}
                    {/* SECURITY TAB */}
                    {activeTab === 'security' && user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold">Password Reset</h3>
                                <Button onClick={handleGenerateResetLink} disabled={isGeneratingLink}>{isGeneratingLink ? 'Generating...' : 'Generate Password Reset Link'}</Button>
                                {resetLink && <div className="text-xs p-2 bg-blue-50 dark:bg-blue-900/50 rounded break-words">{resetLink}</div>}
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
                    {/* NETWORK TAB */}
                    {activeTab === 'network' && user && (
                         <div>
                             <h3 className="font-semibold mb-2">Network Information</h3>
                             <p><strong>Sponsor:</strong> {user.sponsor || 'N/A'}</p>
                            <div className="mt-4">
                                <h4 className="font-semibold">Active Plans:</h4>
                                {user.activePlans && user.activePlans.length > 0 ? (
                                    <ul className="space-y-2 mt-2">
                                        {user.activePlans.map((p, i) => (
                                            <li key={p.planId + i} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm flex justify-between">
                                                <span>
                                                    <span className="font-bold">{p.planName}</span>
                                                    <span className="text-xs text-gray-500 block">Purchased: {new Date(p.purchaseDate).toLocaleDateString()}</span>
                                                </span>
                                                <span className="font-semibold">{formatCurrency(p.price, user.currency)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500 mt-1">None</p>
                                )}
                            </div>
                             <div className="mt-4">
                                <h4 className="font-semibold">Downline:</h4>
                                {renderTree(genealogyTree)}
                            </div>
                         </div>
                    )}
                    {/* HISTORY TAB */}
                    {activeTab === 'history' && user && (
                        <div className="space-y-4">
                            <h3 className="font-semibold">Financial History</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                                <div><select value={historyTypeFilter} onChange={e => setHistoryTypeFilter(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700"><option value="">All Types</option>{transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                <div><select value={historyStatusFilter} onChange={e => setHistoryStatusFilter(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700"><option value="">All Statuses</option>{Object.values(Status).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                                <div><input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700" /></div>
                                <div><input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="w-full text-xs rounded-md dark:bg-gray-700" /></div>
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
                                            <tr><td colSpan={5} className="p-4 text-center text-gray-500">No transactions found for the selected filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="button" onClick={handleSaveChanges} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Other Modals ---

const DeleteUserModal: React.FC<{ user: User; onClose: () => void; onConfirmDelete: (userId: string) => Promise<void>; }> = ({ user, onClose, onConfirmDelete }) => {
    const { state } = useData();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        await onConfirmDelete(user._id);
    };

    const handleDownloadDossier = () => {
        setIsDownloading(true);

        const { users, transactions, deposits, withdrawals, transfers } = state;
        
        // --- Helper Functions ---
        const csvEscape = (field: any): string => {
            if (field === null || field === undefined) return '""';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        const toCsvRow = (arr: any[]): string => arr.map(csvEscape).join(',');
        
        let csvRows: string[] = [];

        // --- 1. Profile ---
        csvRows.push(toCsvRow(['USER DOSSIER', `Generated on: ${new Date().toLocaleString()}`]));
        csvRows.push(toCsvRow(['User ID', user._id]));
        csvRows.push(toCsvRow(['Username', user.username]));
        csvRows.push(toCsvRow(['Full Name', user.fullName]));
        csvRows.push(toCsvRow(['Email', user.email]));
        csvRows.push(toCsvRow(['Phone', user.phone]));
        csvRows.push(toCsvRow(['WhatsApp', user.whatsapp || 'N/A']));
        csvRows.push(toCsvRow(['Country', user.country]));
        csvRows.push(toCsvRow(['Currency', user.currency]));
        csvRows.push(toCsvRow(['Status', user.status]));
        csvRows.push(toCsvRow(['Sponsor', user.sponsor || 'N/A']));
        csvRows.push(toCsvRow(['Registration Date', new Date(user.registrationDate).toLocaleString()]));
        
        // --- 2. Financial Summary ---
        const userDeposits = deposits.filter(d => d.userId === user._id && d.status === 'Approved');
        const userWithdrawals = withdrawals.filter(w => w.userId === user._id && w.status === 'Paid');
        const userCommissions = transactions.filter(t => t.userId === user._id && t.type === 'Commission' && t.status === 'Approved');
        const userTransfersSent = transfers.filter(t => t.senderId === user._id && t.status === 'Approved');
        const userTransfersReceived = transfers.filter(t => t.recipientId === user._id && t.status === 'Approved');
        
        csvRows.push('');
        csvRows.push('FINANCIAL SUMMARY');
        csvRows.push(toCsvRow(['Metric', 'Value']));
        csvRows.push(toCsvRow(['Current Wallet Balance', formatCurrency(user.walletBalance, user.currency)]));
        csvRows.push(toCsvRow(['Total Approved Deposits', formatCurrency(userDeposits.reduce((s, i) => s + i.amount, 0), user.currency)]));
        csvRows.push(toCsvRow(['Total Paid Withdrawals', formatCurrency(userWithdrawals.reduce((s, i) => s + i.finalAmount, 0), user.currency)]));
        csvRows.push(toCsvRow(['Total Commissions Earned', formatCurrency(userCommissions.reduce((s, i) => s + i.amount, 0), user.currency)]));
        csvRows.push(toCsvRow(['Total Transfers Sent', formatCurrency(userTransfersSent.reduce((s, i) => s + i.amount, 0), user.currency)]));
        csvRows.push(toCsvRow(['Total Transfers Received', formatCurrency(userTransfersReceived.reduce((s, i) => s + i.amount, 0), user.currency)]));

        // --- 3. Active Plans ---
        csvRows.push('');
        csvRows.push('ACTIVE PLANS');
        csvRows.push(toCsvRow(['Plan Name', 'Price', 'Purchase Date']));
        (user.activePlans || []).forEach(plan => {
            csvRows.push(toCsvRow([plan.planName, formatCurrency(plan.price, user.currency), new Date(plan.purchaseDate).toLocaleString()]));
        });

        // --- 4. Full Transaction History ---
        const userTransactions = transactions.filter(t => t.userId === user._id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        csvRows.push('');
        csvRows.push('FULL TRANSACTION HISTORY');
        csvRows.push(toCsvRow(['Date', 'Type', 'Amount', 'Status', 'Description']));
        userTransactions.forEach(tx => {
            csvRows.push(toCsvRow([ new Date(tx.date).toLocaleString(), tx.type, formatCurrency(tx.amount, tx.currency), tx.status || 'N/A', tx.description ]));
        });

        // --- 5. Deposit History ---
        csvRows.push('');
        csvRows.push('DEPOSIT HISTORY');
        csvRows.push(toCsvRow(['Date', 'Method', 'Amount', 'Tx ID', 'Status']));
        deposits.filter(d => d.userId === user._id).sort((a,b)=>new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(d => {
            csvRows.push(toCsvRow([new Date(d.date).toLocaleString(), d.method, formatCurrency(d.amount, d.currency), d.transactionId, d.status]));
        });

        // --- 6. Withdrawal History ---
        csvRows.push('');
        csvRows.push('WITHDRAWAL HISTORY');
        csvRows.push(toCsvRow(['Date', 'Method', 'Amount', 'Fee', 'Final Amount', 'Status']));
        withdrawals.filter(w => w.userId === user._id).sort((a,b)=>new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(w => {
            csvRows.push(toCsvRow([new Date(w.date).toLocaleString(), w.method, formatCurrency(w.amount, w.currency), formatCurrency(w.fee, w.currency), formatCurrency(w.finalAmount, w.currency), w.status]));
        });
        
        // --- 7. Transfer History ---
        csvRows.push('');
        csvRows.push('TRANSFER HISTORY');
        csvRows.push(toCsvRow(['Date', 'Direction', 'Counterparty', 'Amount', 'Status']));
        transfers.filter(t => t.senderId === user._id || t.recipientId === user._id).sort((a,b)=>new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(t => {
            const direction = t.senderId === user._id ? 'Sent' : 'Received';
            const counterparty = direction === 'Sent' ? t.recipientName : t.senderName;
            csvRows.push(toCsvRow([new Date(t.date).toLocaleString(), direction, counterparty, formatCurrency(t.amount, t.currency), t.status]));
        });

        // --- 8. Network (Downline) ---
        const downline: (User & { level: number })[] = [];
        const buildDownline = (sponsorUsername: string, level: number) => {
            const directRefs = users.filter(u => u.sponsor === sponsorUsername);
            directRefs.forEach(ref => {
                downline.push({ ...ref, level });
                buildDownline(ref.username, level + 1);
            });
        };
        buildDownline(user.username, 1);

        csvRows.push('');
        csvRows.push('NETWORK (DOWNLINE)');
        csvRows.push(toCsvRow(['Level', 'Username', 'Full Name', 'Status', 'Active Plans']));
        downline.forEach(ref => {
            csvRows.push(toCsvRow([ref.level, ref.username, ref.fullName, ref.status, ref.activePlans?.length || 0]));
        });

        // --- Finalize and Download ---
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Dossier_${user.username}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setIsDownloading(false);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-lg">
                <h3 className="text-lg font-bold text-red-600 mb-4">Confirm Deletion</h3>
                <p>Are you sure you want to permanently delete user <strong>{user.fullName} (@{user.username})</strong>?</p>
                <p className="mt-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/50 p-2 rounded-md">
                    <strong>Recommendation:</strong> Download a complete dossier of the user's data before proceeding.
                </p>
                <p className="mt-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/50 p-2 rounded-md">
                    This action is irreversible and will delete all associated data including financial history and network structure.
                </p>
                <div className="mt-6 flex justify-between items-center">
                    <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={handleDownloadDossier} disabled={isDownloading}>
                            {isDownloading ? 'Generating...' : 'Download Dossier'}
                        </Button>
                        <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
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
    const [sendNotification, setSendNotification] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [manualUserSearch, setManualUserSearch] = useState('');
    
    const filteredManualUsers = useMemo(() => {
        if (!manualUserSearch) return allUsers;
        const term = manualUserSearch.toLowerCase();
        return allUsers.filter(u =>
            u.username.toLowerCase().includes(term) ||
            u.fullName.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
    }, [allUsers, manualUserSearch]);

    const handleManualUserSelect = (userId: string) => {
        setTargetIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) { newSet.delete(userId); } else { newSet.add(userId); }
            return Array.from(newSet);
        });
    };
    
    const handleSelectAllFilteredManual = () => {
        const allFilteredIds = filteredManualUsers.map(u => u._id);
        setTargetIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    };

    const handleDeselectAllManual = () => setTargetIds([]);

    const restrictionOptions: { key: keyof UserRestrictions; label: string }[] = [
        { key: 'deposit', label: 'Deposits' }, { key: 'withdrawal', label: 'Withdrawals' },
        { key: 'transfer', label: 'Transfers' }, { key: 'earning', label: 'Earning Commissions' },
        { key: 'dispute', label: 'Raising Disputes' }, { key: 'excludeFromTicker', label: 'Ticker Visibility' },
    ];

    const handleRestrictionToggle = (key: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = async () => {
        if (Object.keys(restrictions).length === 0) return alert('Please select at least one restriction to apply.');
        if (targetType === 'plan' && targetIds.length === 0) return alert('Please select at least one plan to target.');
        if (targetType === 'manual' && targetIds.length === 0) return alert('Please select at least one user.');

        setIsSubmitting(true);
        try {
            const apiTargetType = targetType === 'manual' ? 'single' : targetType;
            await bulkUpdateUserRestrictions({ targetType: apiTargetType, targetIds, restrictions, action, sendNotification });
            const updatedUsers = await getUsers();
            dispatch({ type: 'SET_USERS', payload: updatedUsers });
            alert('Restrictions updated successfully for the targeted users.');
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to update restrictions.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-lg">
                <h3 className="text-lg font-bold mb-4">Bulk User Restrictions</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Target Users</label>
                        {/*// FIX: Explicitly type the event object to resolve 'unknown' type error.*/}
                        <select value={targetType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setTargetType(e.target.value as 'all' | 'plan' | 'manual'); setTargetIds([]); }} className="w-full rounded-md dark:bg-gray-700 mt-1">
                            <option value="all">All Users ({allUsers.length})</option>
                            <option value="plan">Users with Specific Plan(s)</option>
                            <option value="manual">Manually Select Users</option>
                        </select>
                    </div>
                    {targetType === 'plan' && (
                        <div>
                            <label className="text-sm font-medium">Select Plans</label>
                            <select multiple value={targetIds} onChange={e => setTargetIds(Array.from(e.target.selectedOptions, option => option.value))} className="w-full rounded-md dark:bg-gray-700 mt-1 h-32">
                                {investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({p.currency})</option>)}
                            </select>
                        </div>
                    )}
                    {targetType === 'manual' && (
                        <div className="space-y-2">
                             <div className="flex justify-between items-end">
                                <div><label className="text-sm font-medium">Select Users ({targetIds.length})</label></div>
                                <div className="flex gap-2">
                                    <Button type="button" size="sm" variant="secondary" onClick={handleSelectAllFilteredManual}>Select Filtered</Button>
                                    <Button type="button" size="sm" variant="secondary" onClick={handleDeselectAllManual}>Deselect All</Button>
                                </div>
                            </div>
                            <input type="text" value={manualUserSearch} onChange={e => setManualUserSearch(e.target.value)} placeholder="Filter users..." className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            <div className="border dark:border-gray-600 rounded-md max-h-48 overflow-y-auto">
                                {filteredManualUsers.map(u => (
                                    <label key={u._id} className="flex items-center space-x-3 p-2 border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                        <input type="checkbox" checked={targetIds.includes(u._id)} onChange={() => handleManualUserSelect(u._id)} className="rounded dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:ring-blue-500" />
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">{u.fullName}</div>
                                            <div className="text-xs text-gray-500">@{u.username}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium">Restrictions to Modify</label>
                        <div className="mt-2 grid grid-cols-2 gap-2 border p-2 rounded-md dark:border-gray-600">
                            {restrictionOptions.map(({key, label}) => (
                                <label key={key} className="flex items-center space-x-2"><input type="checkbox" checked={!!restrictions[key]} onChange={() => handleRestrictionToggle(key)} /> <span>{label}</span></label>
                            ))}
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium">Action</label>
                        <div className="flex gap-4 mt-1">
                            {/*// FIX: Add type to event object to resolve 'unknown' type error.*/}
                            <label><input type="radio" value="enable" checked={action === 'enable'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAction(e.target.value as 'enable' | 'disable')} /> Enable Restriction (Block)</label>
                            {/*// FIX: Add type to event object to resolve 'unknown' type error.*/}
                            <label><input type="radio" value="disable" checked={action === 'disable'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAction(e.target.value as 'enable' | 'disable')} /> Disable Restriction (Allow)</label>
                        </div>
                    </div>
                     <div>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" checked={sendNotification} onChange={e => setSendNotification(e.target.checked)} className="rounded dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:ring-blue-500" /> 
                            <span className="text-sm font-medium">Send notification to affected users</span>
                        </label>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Applying...' : 'Apply Restrictions'}</Button>
                </div>
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
    
    // Bulk targeting state
    const [targetType, setTargetType] = useState<'all' | 'plan' | 'inactive' | 'single' | 'manual'>(user ? 'single' : 'all');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [randomCount, setRandomCount] = useState('');

    // Manual selection state
    const [manualUserSearch, setManualUserSearch] = useState('');

    const filteredManualUsers = useMemo(() => {
        if (!manualUserSearch) return allUsers;
        const term = manualUserSearch.toLowerCase();
        return allUsers.filter(u =>
            u.username.toLowerCase().includes(term) ||
            u.fullName.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
    }, [allUsers, manualUserSearch]);

    const handleManualUserSelect = (userId: string) => {
        setTargetIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return Array.from(newSet);
        });
    };

    const handleSelectAllFilteredManual = () => {
        const allFilteredIds = filteredManualUsers.map(u => u._id);
        setTargetIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    };

    const handleDeselectAllManual = () => {
        setTargetIds([]);
    };

    const handleSubmit = async () => {
        if (!message) return alert("Message cannot be empty.");
        if (targetType === 'plan' && targetIds.length === 0) return alert('Please select at least one plan to target.');
        if (targetType === 'manual' && targetIds.length === 0) return alert('Please select at least one user to send a message to.');

        setIsSubmitting(true);
        try {
            const payload: any = { subject, message, isPopup, targetType };
            if (user) {
                payload.userId = user._id;
                payload.targetType = 'single';
                payload.targetIds = [user._id];
            } else {
                 if (targetType === 'manual') {
                    payload.targetType = 'single'; // API uses 'single' for array of IDs
                }
                payload.targetIds = targetIds;
                if (targetType === 'inactive' && randomCount) {
                    payload.randomCount = parseInt(randomCount);
                }
            }
            
            const result = await sendAdminNotification(payload);
            dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            alert(`Message sent successfully to ${result.count} user(s).`);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to send message.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
         <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-2xl">
                <h3 className="text-lg font-bold mb-4">{user ? `Send Message to ${user.username}` : 'Send Bulk Message'}</h3>
                <div className="space-y-4">
                    {!user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Target Audience</label>
                                {/* FIX: Explicitly type the event object to resolve 'unknown' type error. */}
                                <select 
                                    value={targetType} 
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                        setTargetType(e.target.value as 'all' | 'plan' | 'inactive' | 'single' | 'manual');
                                        setTargetIds([]); // Reset selections on type change
                                    }} 
                                    className="w-full rounded-md dark:bg-gray-700 mt-1"
                                >
                                    <option value="all">All Users ({allUsers.length})</option>
                                    <option value="plan">Users with Specific Plan(s)</option>
                                    <option value="inactive">Inactive Users (No Plan)</option>
                                    <option value="manual">Manually Select Users</option>
                                </select>
                            </div>
                            {targetType === 'plan' && <div><label className="text-sm font-medium">Select Plans</label><select multiple value={targetIds} onChange={e => setTargetIds(Array.from(e.target.selectedOptions, option => option.value))} className="w-full rounded-md dark:bg-gray-700 mt-1 h-24"><option value="">All Plans</option>{investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({p.currency})</option>)}</select></div>}
                            {targetType === 'inactive' && <div><label className="text-sm font-medium">Random Sample (Optional)</label><input type="number" value={randomCount} onChange={e => setRandomCount(e.target.value)} placeholder="e.g., 50" className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>}
                             {targetType === 'manual' && (
                                <div className="md:col-span-2 space-y-2">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <label className="text-sm font-medium">Select Users</label>
                                            <p className="text-xs text-gray-500">{targetIds.length} user(s) selected.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button type="button" size="sm" variant="secondary" onClick={handleSelectAllFilteredManual}>Select All Filtered</Button>
                                            <Button type="button" size="sm" variant="secondary" onClick={handleDeselectAllManual}>Deselect All</Button>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={manualUserSearch}
                                        onChange={e => setManualUserSearch(e.target.value)}
                                        placeholder="Filter users..."
                                        className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <div className="border dark:border-gray-600 rounded-md max-h-48 overflow-y-auto">
                                        {filteredManualUsers.map(u => (
                                            <label key={u._id} className="flex items-center space-x-3 p-2 border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={targetIds.includes(u._id)}
                                                    onChange={() => handleManualUserSelect(u._id)}
                                                    className="rounded dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:ring-blue-500"
                                                />
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white">{u.fullName}</div>
                                                    <div className="text-xs text-gray-500">@{u.username}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div><label className="text-sm font-medium">Subject</label><input value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded-md dark:bg-gray-700 mt-1" /></div>
                    <div><label className="text-sm font-medium">Message</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full rounded-md dark:bg-gray-700 mt-1" required /></div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                        <div>
                            <label htmlFor="isPopupToggle" className="text-sm font-medium text-gray-900 dark:text-gray-200">Popup Notification</label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Show this as a high-priority popup when the user logs in.</p>
                        </div>
                        <label htmlFor="isPopupToggle" className="inline-flex items-center cursor-pointer">
                            <input 
                                id="isPopupToggle"
                                type="checkbox" 
                                checked={isPopup}
                                onChange={e => setIsPopup(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
                 <div className="mt-6 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send Message'}</Button>
                </div>
            </div>
        </Modal>
    );
};

export default Users;
