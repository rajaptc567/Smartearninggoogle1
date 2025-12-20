import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction } from '../types';
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

// Sub-components for Modals

interface UserManagementModalProps {
    user: User | null;
    onClose: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, onClose }) => {
    const { dispatch } = useData();
    const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'restrictions'>('profile');
    const [isSaving, setIsSaving] = useState(false);
    
    const [formData, setFormData] = useState<Partial<User>>(user ? { ...user } : {
        fullName: '',
        username: '',
        email: '',
        phone: '',
        whatsapp: '',
        country: countries[0],
        status: Status.Active,
    });
    
    const [restrictions, setRestrictions] = useState<UserRestrictions>(user?.restrictions || {
        deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false
    });

    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('Manual adjustment');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRestrictionChange = (key: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (user) {
                const updated = await apiUpdateUser(user._id, { ...formData, restrictions });
                dispatch({ type: 'UPDATE_USER', payload: updated });
                alert('User updated successfully');
            } else {
                const created = await apiCreateUser(formData);
                dispatch({ type: 'ADD_USER', payload: created });
                alert('User created successfully');
            }
            onClose();
        } catch (err: any) {
            alert(err.message || 'Operation failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleWalletAdjust = async (type: 'credit' | 'debit') => {
        if (!user) return;
        const amt = parseFloat(adjustmentAmount);
        if (isNaN(amt) || amt <= 0) return alert('Enter valid amount');
        
        setIsSaving(true);
        try {
            const result = await adjustUserWallet(user._id, {
                amount: type === 'credit' ? amt : -amt,
                description: adjustmentReason
            });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            alert('Wallet adjusted successfully');
            setAdjustmentAmount('');
        } catch (err: any) {
            alert(err.message || 'Operation failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!user) return;
        try {
            const { resetToken } = await adminInitiatePasswordReset(user._id);
            const link = `${window.location.origin}${window.location.pathname}#/reset-password?token=${resetToken}`;
            prompt("Generated Reset Link (valid for 48h):", link);
        } catch (err: any) {
            alert(err.message || 'Failed to generate link');
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="w-[500px] max-w-full">
                <div className="flex border-b mb-4">
                    <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 ${activeTab === 'profile' ? 'border-b-2 border-blue-500 font-bold' : ''}`}>Profile</button>
                    {user && (
                        <>
                            <button onClick={() => setActiveTab('wallet')} className={`px-4 py-2 ${activeTab === 'wallet' ? 'border-b-2 border-blue-500 font-bold' : ''}`}>Wallet</button>
                            <button onClick={() => setActiveTab('restrictions')} className={`px-4 py-2 ${activeTab === 'restrictions' ? 'border-b-2 border-blue-500 font-bold' : ''}`}>Restrictions</button>
                        </>
                    )}
                </div>

                {activeTab === 'profile' && (
                    <form onSubmit={handleSave} className="space-y-4 p-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold uppercase text-gray-500">Full Name</label>
                                <input name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full border rounded p-2" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500">Username</label>
                                <input name="username" value={formData.username} onChange={handleInputChange} className="w-full border rounded p-2" required disabled={!!user} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500">Email</label>
                                <input name="email" type="email" value={formData.email} onChange={handleInputChange} className="w-full border rounded p-2" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500">Phone</label>
                                <input name="phone" value={formData.phone} onChange={handleInputChange} className="w-full border rounded p-2" required />
                            </div>
                             <div>
                                <label className="block text-xs font-bold uppercase text-gray-500">Country</label>
                                <select name="country" value={formData.country} onChange={handleInputChange} className="w-full border rounded p-2">
                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold uppercase text-gray-500">Status</label>
                                <select name="status" value={formData.status} onChange={handleInputChange} className="w-full border rounded p-2">
                                    <option value={Status.Active}>Active</option>
                                    <option value={Status.Blocked}>Blocked</option>
                                    <option value={Status.Paused}>Paused</option>
                                    <option value={Status.Pending}>Pending</option>
                                </select>
                            </div>
                            {!user && (
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold uppercase text-gray-500">Initial Password</label>
                                    <input name="password" type="password" onChange={handleInputChange} className="w-full border rounded p-2" required />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            {user && <button type="button" onClick={handleResetPassword} className="text-red-600 text-sm hover:underline">Reset Password Link</button>}
                            <div className="flex gap-2 ml-auto">
                                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                                <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save User'}</Button>
                            </div>
                        </div>
                    </form>
                )}

                {activeTab === 'wallet' && user && (
                    <div className="space-y-6 p-2">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="text-sm text-gray-500 uppercase">Current Balance</p>
                            <p className="text-3xl font-bold text-green-600">{formatCurrency(user.walletBalance, user.currency)}</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500">Adjustment Amount</label>
                                <input type="number" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} className="w-full border rounded p-2" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500">Reason</label>
                                <input value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} className="w-full border rounded p-2" />
                            </div>
                            <div className="flex gap-2">
                                <Button className="flex-1" variant="success" onClick={() => handleWalletAdjust('credit')} disabled={isSaving}>Credit (+)</Button>
                                <Button className="flex-1" variant="danger" onClick={() => handleWalletAdjust('debit')} disabled={isSaving}>Debit (-)</Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'restrictions' && user && (
                    <div className="p-2 space-y-4">
                         <h4 className="font-bold text-sm text-gray-500 uppercase">Manage User Capabilities</h4>
                         <div className="grid grid-cols-2 gap-4">
                            {Object.entries(restrictions).map(([key, value]) => (
                                <label key={key} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer">
                                    <input type="checkbox" checked={!!value} onChange={() => handleRestrictionChange(key as keyof UserRestrictions)} className="rounded" />
                                    <div className="text-sm">
                                        <div className="font-bold capitalize">{key}</div>
                                        <div className="text-xs text-gray-500">{value ? 'Restricted' : 'Allowed'}</div>
                                    </div>
                                </label>
                            ))}
                         </div>
                         <div className="flex justify-end pt-4">
                            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Applying...' : 'Apply Restrictions'}</Button>
                         </div>
                    </div>
                )}
            </div>
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
            await bulkUpdateUserRestrictions({
                targetType,
                targetIds,
                restrictions,
                action,
                sendNotification
            });
            
            // Refresh data
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
            
            // Add new notifications to local state
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
                <p className="text-sm text-gray-500">
                    Are you sure you want to permanently delete user <strong className="text-gray-900">@{user.username}</strong>?
                    <br/><br/>
                    All their deposits, withdrawals, transactions, and notification history will be wiped. <strong>This action is irreversible.</strong>
                </p>
                <div className="flex gap-2 pt-4">
                    <Button className="flex-1" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <Button className="flex-1" variant="danger" onClick={handleConfirm} disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Yes, Delete All'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default Users;