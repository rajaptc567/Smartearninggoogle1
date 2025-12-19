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
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    // Selection State
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isStatusProcessing, setIsStatusProcessing] = useState<string | null>(null);

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

    const handleToggleStatus = async (user: User, targetStatus: Status) => {
        setIsStatusProcessing(user._id);
        try {
            const updatedUser = await apiUpdateUser(user._id, { status: targetStatus });
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to update status.");
        } finally {
            setIsStatusProcessing(null);
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
        const allFilteredIds = filteredUsers.map(u => u._id);
        const areAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));

        if (areAllFilteredSelected) {
            setSelectedUserIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
        } else {
            setSelectedUserIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
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


    const tableHeaders = ['User', 'Wallet Balance', 'Active Plans', 'Status', 'Admin Actions'];

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
                                                    <p className="text-xs text-gray-500">@{user.username}</p>
                                                    <p className="text-[10px] text-gray-400">ID: {user._id.substring(user._id.length - 6)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold">{formatCurrency(user.walletBalance, user.currency)}</td>
                                        <td className="px-4 py-3 text-xs">
                                            {user.activePlans && user.activePlans.length > 0 
                                                ? user.activePlans.map(p => p.planName).join(', ') 
                                                : 'None'}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                           <Badge status={user.status as any} />
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Button size="sm" variant="secondary" onClick={() => handleOpenUserManagementModal(user)}>Manage</Button>
                                                
                                                {/* QUICK STATUS ACTIONS */}
                                                <div className="flex bg-gray-100 dark:bg-gray-900 rounded p-1 gap-1">
                                                    {user.status === Status.Blocked ? (
                                                        <Button size="sm" variant="success" className="py-1 px-2 text-[10px]" disabled={isStatusProcessing === user._id} onClick={() => handleToggleStatus(user, Status.Active)}>Unblock</Button>
                                                    ) : (
                                                        <Button size="sm" variant="danger" className="py-1 px-2 text-[10px]" disabled={isStatusProcessing === user._id} onClick={() => handleToggleStatus(user, Status.Blocked)}>Block</Button>
                                                    )}
                                                    
                                                    {user.status === Status.Paused ? (
                                                        <Button size="sm" variant="success" className="py-1 px-2 text-[10px]" disabled={isStatusProcessing === user._id} onClick={() => handleToggleStatus(user, Status.Active)}>Resume</Button>
                                                    ) : (
                                                        <Button size="sm" variant="secondary" className="py-1 px-2 text-[10px] bg-orange-500 text-white hover:bg-orange-600" disabled={isStatusProcessing === user._id} onClick={() => handleToggleStatus(user, Status.Paused)}>Pause</Button>
                                                    )}
                                                </div>

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

// FIX: Added missing UserManagementModal component definition.
const UserManagementModal: React.FC<{ user: User | null; onClose: () => void }> = ({ user, onClose }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState<Partial<User>>(user || {
        fullName: '',
        username: '',
        email: '',
        phone: '',
        whatsapp: '',
        country: countries[0],
        status: Status.Active,
        restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false }
    });
    const [password, setPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRestrictionChange = (key: keyof UserRestrictions) => {
        setFormData(prev => ({
            ...prev,
            restrictions: {
                ...(prev.restrictions || { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false }),
                [key]: !(prev.restrictions?.[key] ?? false)
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (user) {
                const updated = await apiUpdateUser(user._id, formData);
                dispatch({ type: 'UPDATE_USER', payload: updated });
                alert('User updated successfully');
            } else {
                const created = await apiCreateUser({ ...formData, password } as any);
                dispatch({ type: 'ADD_USER', payload: created });
                alert('User created successfully');
            }
            onClose();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Operation failed');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg overflow-y-auto max-h-[80vh]">
                <h3 className="text-xl font-bold">{user ? 'Edit User' : 'Create User'}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium">Full Name</label>
                        <input name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium">Username</label>
                        <input name="username" value={formData.username} onChange={handleChange} required className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium">Email</label>
                        <input name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium">Phone</label>
                        <input name="phone" value={formData.phone} onChange={handleChange} required className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium">WhatsApp</label>
                        <input name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium">Country</label>
                        <select name="country" value={formData.country} onChange={handleChange} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600">
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium">Status</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600">
                            <option value={Status.Active}>Active</option>
                            <option value={Status.Blocked}>Blocked</option>
                            <option value={Status.Paused}>Paused</option>
                            <option value={Status.Pending}>Pending</option>
                        </select>
                    </div>
                    {!user && (
                        <div className="col-span-2">
                            <label className="block text-sm font-medium">Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t dark:border-gray-700">
                    <h4 className="font-bold mb-2">Restrictions</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {formData.restrictions && Object.keys(formData.restrictions).map(key => (
                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={(formData.restrictions as any)[key]} onChange={() => handleRestrictionChange(key as any)} className="rounded" />
                                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save User'}</Button>
                </div>
            </form>
        </Modal>
    );
};

// FIX: Added missing BulkRestrictionsModal component definition.
const BulkRestrictionsModal: React.FC<{ allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [targetType, setTargetType] = useState<'all' | 'plan' | 'single'>('all');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [action, setAction] = useState<'enable' | 'disable' | 'toggle'>('enable');
    const [restrictions, setRestrictions] = useState<Partial<UserRestrictions>>({
        deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false
    });
    const [sendNotification, setSendNotification] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const handleToggleRestriction = (key: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (targetType !== 'all' && targetIds.length === 0) return alert('Please select targets.');
        const activeRestrictions = Object.entries(restrictions).some(([_, v]) => v);
        if (!activeRestrictions) return alert('Please select at least one restriction to modify.');

        setIsSaving(true);
        try {
            await bulkUpdateUserRestrictions({ targetType, targetIds, restrictions, action, sendNotification });
            alert('Bulk update completed. Refreshing data...');
            window.location.reload(); 
        } catch (error) {
            alert('Bulk update failed');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[500px] max-w-full">
                <h3 className="text-xl font-bold mb-4">Bulk Restrictions</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">1. Target Audience</label>
                        <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 mt-1">
                            <option value="all">All Users</option>
                            <option value="plan">By Active Plan</option>
                        </select>
                    </div>

                    {targetType === 'plan' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Select Plans</label>
                            <select multiple className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 h-32" value={targetIds} onChange={e => setTargetIds(Array.from(e.target.selectedOptions, o => o.value))}>
                                {investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({p.currency})</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium">2. Action</label>
                        <select value={action} onChange={e => setAction(e.target.value as any)} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 mt-1">
                            <option value="enable">Enable (Apply Restriction)</option>
                            <option value="disable">Disable (Remove Restriction)</option>
                            <option value="toggle">Toggle Current State</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">3. Restrictions to Modify</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['deposit', 'withdrawal', 'transfer', 'earning', 'dispute', 'excludeFromTicker'].map(key => (
                                <label key={key} className="flex items-center gap-2 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <input type="checkbox" checked={(restrictions as any)[key]} onChange={() => handleToggleRestriction(key as any)} />
                                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input type="checkbox" checked={sendNotification} onChange={e => setSendNotification(e.target.checked)} />
                        Send notification to affected users
                    </label>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Processing...' : 'Apply Bulk Changes'}</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// FIX: Added missing MessageUserModal component definition.
const MessageUserModal: React.FC<{ user: User | null; allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ user, allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [targetType, setTargetType] = useState<'single' | 'plan' | 'all' | 'inactive'>(user ? 'single' : 'all');
    const [targetIds, setTargetIds] = useState<string[]>(user ? [user._id] : []);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isPopup, setIsPopup] = useState(false);
    const [randomCount, setRandomCount] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) return alert('Message content is required.');
        setIsSending(true);
        try {
            const result = await sendAdminNotification({
                userId: targetType === 'single' && targetIds.length === 1 ? targetIds[0] : undefined,
                subject,
                message,
                isPopup,
                targetType,
                targetIds: targetType !== 'single' ? targetIds : undefined,
                randomCount: targetType === 'inactive' ? parseInt(randomCount) || 0 : undefined
            });
            
            if (result.data) {
                dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            }
            alert(`Successfully sent ${result.count || (targetType === 'single' ? 1 : 0)} message(s).`);
            onClose();
        } catch (error) {
            alert('Failed to send message.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[500px] max-w-full">
                <h3 className="text-xl font-bold mb-4">{user ? `Message @${user.username}` : 'Send Bulk Message'}</h3>
                <div className="space-y-4">
                    {!user && (
                        <div>
                            <label className="block text-sm font-medium">Target Audience</label>
                            <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 mt-1">
                                <option value="all">All Users</option>
                                <option value="plan">Users by Active Plan</option>
                                <option value="inactive">Inactive Users (No Plan)</option>
                            </select>
                        </div>
                    )}

                    {targetType === 'plan' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Select Plans</label>
                            <select multiple className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 h-32" value={targetIds} onChange={e => setTargetIds(Array.from(e.target.selectedOptions, o => o.value))}>
                                {investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name} ({p.currency})</option>)}
                            </select>
                        </div>
                    )}

                    {targetType === 'inactive' && (
                        <div>
                            <label className="block text-sm font-medium">Random Sample Count (Optional)</label>
                            <input type="number" placeholder="Leave empty for all inactive users" value={randomCount} onChange={e => setRandomCount(e.target.value)} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 mt-1" />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium">Subject (Optional)</label>
                        <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 mt-1" placeholder="Enter message subject..." />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Message Content</label>
                        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 mt-1" placeholder="Type your message here..." required />
                    </div>

                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input type="checkbox" checked={isPopup} onChange={e => setIsPopup(e.target.checked)} />
                        Force as Popup (User must acknowledge)
                    </label>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSend} disabled={isSending}>{isSending ? 'Sending...' : 'Send Message'}</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// FIX: Added missing DeleteUserModal component definition.
const DeleteUserModal: React.FC<{ user: User; onClose: () => void; onConfirmDelete: (id: string) => void }> = ({ user, onClose, onConfirmDelete }) => (
    <Modal isOpen={true} onClose={onClose}>
        <div className="p-6 text-center max-w-sm">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Delete User Account?</h3>
            <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete <strong>{user.fullName} (@{user.username})</strong>? 
                <br/><br/>This will permanently remove their profile and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
                <Button className="flex-1" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button className="flex-1" variant="danger" onClick={() => onConfirmDelete(user._id)}>Confirm Delete</Button>
            </div>
        </div>
    </Modal>
);

// FIX: Added default export.
export default Users;
