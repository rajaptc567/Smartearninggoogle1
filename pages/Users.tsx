
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers, adminActivatePlan } from '../services/api';

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

// --- MODAL COMPONENTS ---

// FIX: Implemented UserManagementModal to handle single user editing and creation
interface UserManagementModalProps {
    user: User | null;
    onClose: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, onClose }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState<Partial<User>>(user || {
        fullName: '',
        username: '',
        email: '',
        phone: '',
        whatsapp: '',
        country: countries[0],
        status: Status.Active,
        restrictions: {
            deposit: false,
            withdrawal: false,
            transfer: false,
            earning: false,
            dispute: false,
            excludeFromTicker: false
        }
    });
    const [password, setPassword] = useState(''); // Only for new users
    const [isSaving, setIsSaving] = useState(false);
    const [walletAmount, setWalletAmount] = useState('');
    const [walletAction, setWalletAction] = useState<'credit' | 'debit'>('credit');
    const [walletReason, setWalletReason] = useState('Admin adjustment');
    const [selectedPlanId, setSelectedPlanId] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name.startsWith('restrictions.')) {
            const field = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                restrictions: { ...prev.restrictions!, [field]: (e.target as HTMLInputElement).checked }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (user) {
                const updated = await apiUpdateUser(user._id, formData);
                dispatch({ type: 'UPDATE_USER', payload: updated });
                alert('User updated successfully');
            } else {
                const created = await apiCreateUser({ ...formData, password });
                dispatch({ type: 'ADD_USER', payload: created });
                alert('User created successfully');
            }
            onClose();
        } catch (error) {
            alert(`Error: ${error instanceof Error ? error.message : 'Failed to save'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdjustWallet = async () => {
        if (!user || !walletAmount) return;
        const amt = parseFloat(walletAmount);
        if (isNaN(amt)) return;
        try {
            const result = await adjustUserWallet(user._id, {
                amount: walletAction === 'credit' ? amt : -amt,
                description: walletReason
            });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            alert('Wallet adjusted');
            setWalletAmount('');
        } catch (error) {
            alert('Failed to adjust wallet');
        }
    };

    const handleActivatePlan = async () => {
        if (!user || !selectedPlanId) return;
        try {
            const result = await adminActivatePlan(user._id, selectedPlanId);
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            alert('Plan activated');
            setSelectedPlanId('');
        } catch (error) {
            alert(`Error: ${error instanceof Error ? error.message : 'Failed to activate plan'}`);
        }
    };

    const handleResetPassword = async () => {
        if (!user) return;
        try {
            const { resetToken } = await adminInitiatePasswordReset(user._id);
            const link = `${window.location.origin}${window.location.pathname}#/reset-password?token=${resetToken}`;
            navigator.clipboard.writeText(link);
            alert('Password reset link copied to clipboard');
        } catch (error) {
            alert('Failed to generate reset link');
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-2xl space-y-6">
                <h3 className="text-xl font-bold">{user ? `Manage User: ${user.username}` : 'Add New User'}</h3>
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Full Name" className="rounded border p-2 dark:bg-gray-700" required />
                    <input name="username" value={formData.username} onChange={handleChange} placeholder="Username" className="rounded border p-2 dark:bg-gray-700" required />
                    <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" type="email" className="rounded border p-2 dark:bg-gray-700" required />
                    <input name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" className="rounded border p-2 dark:bg-gray-700" required />
                    {!user && <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" className="rounded border p-2 dark:bg-gray-700" required />}
                    <select name="country" value={formData.country} onChange={handleChange} className="rounded border p-2 dark:bg-gray-700">
                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select name="status" value={formData.status} onChange={handleChange} className="rounded border p-2 dark:bg-gray-700">
                        <option value={Status.Active}>Active</option>
                        <option value={Status.Blocked}>Blocked</option>
                        <option value={Status.Paused}>Paused</option>
                        <option value={Status.Pending}>Pending</option>
                    </select>
                    <input name="sponsor" value={formData.sponsor} onChange={handleChange} placeholder="Sponsor Username" className="rounded border p-2 dark:bg-gray-700" />
                    
                    <div className="md:col-span-2 space-y-2">
                        <h4 className="font-bold text-sm">Restrictions</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.keys(formData.restrictions || {}).map(key => (
                                <label key={key} className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" name={`restrictions.${key}`} checked={(formData.restrictions as any)[key]} onChange={handleChange} className="rounded" />
                                    <span className="capitalize">{key}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <Button type="submit" disabled={isSaving} className="md:col-span-2">{isSaving ? 'Saving...' : 'Save User Info'}</Button>
                </form>

                {user && (
                    <div className="border-t pt-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={handleResetPassword}>Copy Password Reset Link</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600">
                                <h4 className="font-bold mb-2">Adjust Wallet</h4>
                                <div className="flex gap-2 mb-2">
                                    <select value={walletAction} onChange={e => setWalletAction(e.target.value as any)} className="rounded border p-1 text-sm dark:bg-gray-800">
                                        <option value="credit">Credit</option>
                                        <option value="debit">Debit</option>
                                    </select>
                                    <input type="number" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="Amount" className="w-full rounded border p-1 text-sm dark:bg-gray-800" />
                                </div>
                                <input value={walletReason} onChange={e => setWalletReason(e.target.value)} placeholder="Reason" className="w-full rounded border p-1 text-sm dark:bg-gray-800 mb-2" />
                                <Button size="sm" onClick={handleAdjustWallet} className="w-full">Apply Adjustment</Button>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600">
                                <h4 className="font-bold mb-2">Activate Plan (Grant)</h4>
                                <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className="w-full rounded border p-1 text-sm dark:bg-gray-800 mb-2">
                                    <option value="">-- Select Plan --</option>
                                    {state.investmentPlans.filter(p => p.currency === user.currency && p.status === Status.Active).map(p => (
                                        <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, p.currency)})</option>
                                    ))}
                                </select>
                                <Button size="sm" onClick={handleActivatePlan} className="w-full">Activate Plan</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// FIX: Implemented BulkRestrictionsModal for batch updates
interface BulkRestrictionsModalProps {
    allUsers: User[];
    investmentPlans: InvestmentPlan[];
    onClose: () => void;
}

const BulkRestrictionsModal: React.FC<BulkRestrictionsModalProps> = ({ allUsers, investmentPlans, onClose }) => {
    const [targetType, setTargetType] = useState<'all' | 'plan' | 'single'>('all');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [restrictions, setRestrictions] = useState<Partial<UserRestrictions>>({
        deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false
    });
    const [action, setAction] = useState<'enable' | 'disable' | 'toggle'>('enable');
    const [sendNotification, setSendNotification] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleToggleId = (id: string) => {
        setTargetIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleRestrictionToggle = (field: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleApply = async () => {
        if (targetType !== 'all' && targetIds.length === 0) return alert('Please select targets');
        const selectedCount = Object.values(restrictions).filter(Boolean).length;
        if (selectedCount === 0) return alert('Please select at least one restriction to update');

        setIsProcessing(true);
        try {
            await bulkUpdateUserRestrictions({
                targetType,
                targetIds,
                restrictions,
                action,
                sendNotification
            });
            alert('Bulk update completed successfully.');
            window.location.reload(); // Simple sync
        } catch (error) {
            alert('Bulk update failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-lg space-y-4">
                <h3 className="text-xl font-bold">Bulk Update Restrictions</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-bold mb-1">1. Select Target Group</label>
                        <select value={targetType} onChange={e => { setTargetType(e.target.value as any); setTargetIds([]); }} className="w-full border rounded p-2 dark:bg-gray-700">
                            <option value="all">All Users</option>
                            <option value="plan">By Active Plan</option>
                        </select>
                    </div>

                    {targetType === 'plan' && (
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded dark:bg-gray-800">
                            {investmentPlans.map(p => (
                                <label key={p._id} className="flex items-center space-x-2 text-xs">
                                    <input type="checkbox" checked={targetIds.includes(p._id)} onChange={() => handleToggleId(p._id)} />
                                    <span>{p.name}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold mb-1">2. Select Restrictions to Update</label>
                        <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            {Object.keys(restrictions).map(key => (
                                <label key={key} className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" checked={(restrictions as any)[key]} onChange={() => handleRestrictionToggle(key as any)} />
                                    <span className="capitalize">{key}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-1">3. Action</label>
                        <select value={action} onChange={e => setAction(e.target.value as any)} className="w-full border rounded p-2 dark:bg-gray-700">
                            <option value="enable">Enable (Block Activity)</option>
                            <option value="disable">Disable (Allow Activity)</option>
                            <option value="toggle">Toggle Current State</option>
                        </select>
                    </div>

                    <label className="flex items-center space-x-2 text-sm">
                        <input type="checkbox" checked={sendNotification} onChange={e => setSendNotification(e.target.checked)} />
                        <span>Send notification to users</span>
                    </label>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleApply} disabled={isProcessing}>{isProcessing ? 'Processing...' : 'Apply Changes'}</Button>
                </div>
            </div>
        </Modal>
    );
};

// FIX: Implemented MessageUserModal for single or bulk admin messages
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
        if (!message) return alert('Please enter a message');
        setIsSending(true);
        try {
            const payload: any = { message, subject, isPopup, targetType };
            if (targetType === 'single' && user) payload.userId = user._id;
            else if (targetType === 'plan' || targetType === 'single') payload.targetIds = targetIds;
            if (targetType === 'inactive' && randomCount) payload.randomCount = randomCount;

            const result = await sendAdminNotification(payload);
            dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            alert(`Message sent to ${result.count} users`);
            onClose();
        } catch (error) {
            alert('Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-lg space-y-4">
                <h3 className="text-xl font-bold">{user ? `Message User: ${user.username}` : 'Bulk Messaging'}</h3>
                {!user && (
                    <select value={targetType} onChange={e => { setTargetType(e.target.value as any); setTargetIds([]); }} className="w-full border rounded p-2 dark:bg-gray-700">
                        <option value="all">All Users</option>
                        <option value="plan">By Active Plan</option>
                        <option value="inactive">Inactive Users</option>
                    </select>
                )}
                {targetType === 'plan' && (
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded dark:bg-gray-800">
                        {investmentPlans.map(p => (
                            <label key={p._id} className="flex items-center space-x-2 text-xs">
                                <input type="checkbox" checked={targetIds.includes(p._id)} onChange={() => setTargetIds(prev => prev.includes(p._id) ? prev.filter(id => id !== p._id) : [...prev, p._id])} />
                                <span>{p.name}</span>
                            </label>
                        ))}
                    </div>
                )}
                {targetType === 'inactive' && (
                    <input type="number" placeholder="Randomly pick X users (Leave empty for all)" value={randomCount} onChange={e => setRandomCount(e.target.value)} className="w-full border rounded p-2 dark:bg-gray-700" />
                )}
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject (Optional)" className="w-full border rounded p-2 dark:bg-gray-700" />
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Enter your message..." rows={5} className="w-full border rounded p-2 dark:bg-gray-700" />
                <label className="flex items-center space-x-2 text-sm">
                    <input type="checkbox" checked={isPopup} onChange={e => setIsPopup(e.target.checked)} />
                    <span>Show as Popup Alert</span>
                </label>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSend} disabled={isSending}>{isSending ? 'Sending...' : 'Send Message'}</Button>
                </div>
            </div>
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
        const userTx = state.transactions
            .filter(t => t.userId === user._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const userDeposits = state.deposits
            .filter(d => d.userId === user._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const userWithdrawals = state.withdrawals
            .filter(w => w.userId === user._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const userTransfers = state.transfers
            .filter(t => t.senderId === user._id || t.recipientId === user._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const referrals = state.users.filter(u => u.sponsor === user.username);
        
        // Detailed Analytics for Dossier
        const approvedDeposits = userDeposits.filter(d => d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0);
        const paidWithdrawals = userWithdrawals.filter(w => w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0);
        
        const commissions = userTx.filter(t => t.type === 'Commission');
        const approvedComms = commissions.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        
        // Identify Hold Positions (Pending commissions with specific keywords)
        const heldComms = commissions.filter(t => t.status === 'Pending' && (t.description.toLowerCase().includes('hold') || t.description.toLowerCase().includes('reserved') || t.description.toLowerCase().includes('position')));
        const totalHeldAmount = heldComms.reduce((sum, t) => sum + t.amount, 0);

        // Identify Overflow (Rejected commissions with amount 0)
        const overflowCommsCount = commissions.filter(t => t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('overflow'))).length;

        const csvRows: string[][] = [];
        csvRows.push([`=== CRITICAL PRE-DELETION USER DOSSIER: ${user.username} ===`]);
        csvRows.push([`Exported on: ${new Date().toLocaleString()}`]);
        csvRows.push([]);
        
        // --- 1. PROFILE & SECURITY ---
        csvRows.push(['--- 1. CORE PROFILE INFORMATION ---']);
        csvRows.push(['User ID', user._id]);
        csvRows.push(['Full Name', user.fullName]);
        csvRows.push(['Username', user.username]);
        csvRows.push(['Email', user.email]);
        csvRows.push(['Phone', user.phone]);
        csvRows.push(['Country', user.country]);
        csvRows.push(['Currency', user.currency]);
        csvRows.push(['Sponsor', user.sponsor || 'N/A']);
        csvRows.push(['Joined Date', new Date(user.registrationDate).toLocaleString()]);
        csvRows.push(['Account Status', user.status]);
        csvRows.push(['Final Wallet Balance', formatCurrency(user.walletBalance, user.currency)]);
        csvRows.push([]);

        // --- 2. FINANCIAL PERFORMANCE ---
        csvRows.push(['--- 2. FINANCIAL PERFORMANCE SUMMARY ---']);
        csvRows.push(['Metric', 'Count/Value', 'Status']);
        csvRows.push(['Total Approved Deposits', formatCurrency(approvedDeposits, user.currency), 'Completed']);
        csvRows.push(['Total Paid Withdrawals', formatCurrency(paidWithdrawals, user.currency), 'Completed']);
        csvRows.push(['Total Realized Earnings', formatCurrency(approvedComms, user.currency), 'In Wallet']);
        csvRows.push(['Held Commissions (For Upgrade)', formatCurrency(totalHeldAmount, user.currency), `${heldComms.length} Slots Reserved`]);
        csvRows.push(['Missed Commissions (Overflow)', `${overflowCommsCount} Events`, 'Slots Full / Limit Reached']);
        csvRows.push([]);

        // --- 3. ACTIVE PLANS ---
        csvRows.push(['--- 3. MEMBERSHIPS & PLANS ---']);
        if (user.activePlans && user.activePlans.length > 0) {
            csvRows.push(['Plan Name', 'Purchase Price', 'Purchase Date', 'Plan ID']);
            user.activePlans.forEach(p => {
                csvRows.push([p.planName, formatCurrency(p.price, user.currency), new Date(p.purchaseDate).toLocaleString(), p.planId]);
            });
        } else {
            csvRows.push(['No active plans owned at time of deletion.']);
        }
        csvRows.push([]);

        // --- 4. REFERRALS ---
        csvRows.push(['--- 4. DIRECT REFERRAL NETWORK ---']);
        if (referrals.length > 0) {
            csvRows.push(['Username', 'Full Name', 'Email', 'Joined Date', 'Status', 'Has Active Plan?']);
            referrals.forEach(ref => {
                const hasPlan = ref.activePlans && ref.activePlans.length > 0 ? 'YES' : 'NO';
                csvRows.push([ref.username, ref.fullName, ref.email, new Date(ref.registrationDate).toLocaleDateString(), ref.status, hasPlan]);
            });
        } else {
            csvRows.push(['User had no direct referrals.']);
        }
        csvRows.push([]);

        // --- 5. DEPOSIT HISTORY ---
        csvRows.push(['--- 5. DEPOSIT RECORD ---']);
        if (userDeposits.length > 0) {
            csvRows.push(['Date', 'Amount', 'Method', 'Tx ID', 'Status', 'Admin Notes']);
            userDeposits.forEach(d => {
                csvRows.push([new Date(d.date).toLocaleString(), formatCurrency(d.amount, d.currency), d.method, d.transactionId, d.status, d.adminNotes || '']);
            });
        } else {
            csvRows.push(['No deposits found.']);
        }
        csvRows.push([]);

        // --- 6. WITHDRAWAL HISTORY ---
        csvRows.push(['--- 6. WITHDRAWAL RECORD ---']);
        if (userWithdrawals.length > 0) {
            csvRows.push(['Date', 'Requested Amount', 'Final Payout', 'Fee', 'Method', 'Status', 'Admin Notes']);
            userWithdrawals.forEach(w => {
                csvRows.push([new Date(w.date).toLocaleString(), formatCurrency(w.amount, w.currency), formatCurrency(w.finalAmount, w.currency), formatCurrency(w.fee, w.currency), w.method, w.status, w.adminNotes || '']);
            });
        } else {
            csvRows.push(['No withdrawals found.']);
        }
        csvRows.push([]);

        // --- 7. TRANSACTION LEDGER ---
        csvRows.push(['--- 7. COMPLETE TRANSACTION LEDGER ---']);
        csvRows.push(['Date', 'Type', 'Amount', 'Status', 'Description', 'Categorization']);
        userTx.forEach(tx => {
            let cat = 'General';
            const desc = tx.description.toLowerCase();
            if (tx.status === 'Pending' && (desc.includes('hold') || desc.includes('reserved') || desc.includes('position'))) cat = 'HOLD POSITION';
            else if (tx.status === 'Rejected' && tx.amount === 0 && (desc.includes('limit') || desc.includes('overflow'))) cat = 'OVERFLOW (MISSED)';
            else if (tx.type === 'Commission') cat = 'EARNING';

            csvRows.push([
                new Date(tx.date).toLocaleString(),
                tx.type,
                formatCurrency(tx.amount, tx.currency),
                tx.status || 'N/A',
                tx.description,
                cat
            ]);
        });

        const csvContent = csvRows.map(e => e.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `PERMANENT_RECORD_Dossier_${user.username}_${new Date().toISOString().split('T')[0]}.csv`;
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
                <h3 className="text-xl font-bold">Confirm Permanent Deletion</h3>
                <p className="text-sm text-gray-500">
                    You are about to delete user <strong className="text-gray-900">@{user.username}</strong>. 
                    <br/><br/>
                    This will permanently wipe their wallet, network position, plans, and history. <strong>This action cannot be undone.</strong>
                </p>
                <div className="pt-2">
                    <button 
                        onClick={handleDownloadDossier}
                        className="p-3 w-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        DOWNLOAD COMPREHENSIVE DOSSIER
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1 italic">Dossier includes Referrals, Deposits, Withdrawals, and Hold/Overflow history.</p>
                </div>
                <div className="flex gap-2 pt-4">
                    <Button className="flex-1" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <Button className="flex-1" variant="danger" onClick={handleConfirm} disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default Users;
