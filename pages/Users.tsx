
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, bulkDeleteUsers, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet, getUsers, adminActivatePlan, adminRemoveUserPlan, upgradeUserFromHold } from '../services/api';

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
        if (window.confirm(`Are you sure you want to permanently delete ${selectedUserIds.length} users?`)) {
            setIsProcessing(true);
            try {
                await bulkDeleteUsers(selectedUserIds);
                const updatedUsers = await getUsers();
                dispatch({ type: 'SET_USERS', payload: updatedUsers });
                setSelectedUserIds([]);
                alert('Selected users deleted successfully.');
            } catch (error) {
                console.error("Failed to bulk delete users:", error);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const filteredUsers = useMemo(() => {
        return state.users.filter(user => {
            const matchesSearch = !searchTerm || user.username.toLowerCase().includes(searchTerm.toLowerCase()) || user.fullName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = !statusFilter || user.status === statusFilter;
            const matchesPlan = !planFilter || (planFilter === 'NO_PLAN' ? !user.activePlans?.length : user.activePlans?.some(p => p.planId === planFilter));
            const matchesCurrency = !currencyFilter || user.currency === currencyFilter;
            return matchesSearch && matchesStatus && matchesPlan && matchesCurrency;
        });
    }, [state.users, searchTerm, statusFilter, planFilter, currencyFilter]);

    const handleSelectUser = (userId: string) => {
        setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(i => i !== userId) : [...prev, userId]);
    };

    const handleSelectAll = () => {
        const allFilteredIds = filteredUsers.map(u => u._id);
        const allSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));
        setSelectedUserIds(prev => allSelected ? prev.filter(id => !allFilteredIds.includes(id)) : Array.from(new Set([...prev, ...allFilteredIds])));
    };

    const tableHeaders = ['User', 'Contact', 'Wallet Balance', 'Active Plans', 'Status', 'Actions'];
    const areAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u._id));

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white shrink-0">Members ({filteredUsers.length})</h2>
                <div className="flex flex-wrap items-center gap-2 justify-end w-full">
                     <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="block rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm">
                        <option value="">All Statuses</option>
                        <option value={Status.Active}>Active</option>
                        <option value={Status.Blocked}>Blocked</option>
                        <option value={Status.Paused}>Paused</option>
                        <option value={Status.Pending}>Pending</option>
                    </select>
                     <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="block rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm">
                        <option value="">All Plans</option>
                        <option value="NO_PLAN">No Active Plan</option>
                        {investmentPlans.map(plan => <option key={plan._id} value={plan._id}>{plan.name}</option>)}
                    </select>
                     <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value as Currency | '')} className="block rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm">
                        <option value="">All Currencies</option>
                        <option value="PKR">PKR</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </select>
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full sm:w-auto rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm" />
                </div>
            </div>
             <div className="flex justify-end gap-2 mb-4">
                 {selectedUserIds.length > 0 && <Button variant="danger" onClick={handleBulkDelete} disabled={isProcessing}>Delete Selected ({selectedUserIds.length})</Button>}
                <Button variant="secondary" onClick={() => setIsBulkRestrictionsModalOpen(true)}>Bulk Restrictions</Button>
                <Button variant="secondary" onClick={() => handleOpenMessage(null)}>Send Bulk Message</Button>
                <Button onClick={() => handleOpenUserManagementModal(null)}>Add User</Button>
            </div>
             {isLoading ? <p>Loading users...</p> : (
                 <div className="w-full overflow-hidden rounded-lg shadow-md">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full whitespace-no-wrap">
                            <thead>
                                <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <th className="px-4 py-3"><input type="checkbox" checked={areAllFilteredSelected} onChange={handleSelectAll} className="rounded" /></th>
                                    {tableHeaders.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y dark:divide-gray-700 dark:bg-gray-800">
                                {filteredUsers.map((user: User) => (
                                    <tr key={user._id} className="text-gray-700 dark:text-gray-400">
                                        <td className="px-4 py-3"><input type="checkbox" checked={selectedUserIds.includes(user._id)} onChange={() => handleSelectUser(user._id)} className="rounded" /></td>
                                        <td className="px-4 py-3"><p className="font-semibold">{user.fullName}</p><p className="text-xs text-gray-500">@{user.username}</p></td>
                                        <td className="px-4 py-3 text-sm">{user.email}<br/><span className="text-xs text-gray-500">{user.phone}</span></td>
                                        <td className="px-4 py-3 text-sm font-bold text-green-600">{formatCurrency(user.walletBalance, user.currency)}</td>
                                        <td className="px-4 py-3 text-sm">{user.activePlans?.map(p => p.planName).join(', ') || 'None'}</td>
                                        <td className="px-4 py-3 text-xs"><Badge status={user.status as Status} /></td>
                                        <td className="px-4 py-3 text-sm"><div className="flex items-center space-x-2"><Button size="sm" variant="secondary" onClick={() => handleOpenUserManagementModal(user)}>Manage</Button><Button size="sm" variant="danger" onClick={() => handleOpenDeleteModal(user)}>Delete</Button></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}
            {isUserManagementModalOpen && <UserManagementModal user={managingUser} onClose={handleCloseAllModals} />}
            {isBulkRestrictionsModalOpen && <BulkRestrictionsModal allUsers={users} investmentPlans={investmentPlans} onClose={handleCloseAllModals} />}
            {isMessageModalOpen && <MessageUserModal user={managingUser} allUsers={users} investmentPlans={investmentPlans} onClose={handleCloseAllModals} />}
            {isDeleteModalOpen && userToDelete && <DeleteUserModal user={userToDelete} onClose={handleCloseAllModals} onConfirmDelete={handleConfirmDelete} />}
        </div>
    );
};

// --- Icons ---
const TrashIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

// --- UserManagementModal ---

interface UserManagementModalProps {
    user: User | null;
    onClose: () => void;
}

interface TreeItem {
    user: User;
    level: number;
    commissionFromNode: number;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, onClose }) => {
    const { state, dispatch } = useData();
    const { users, transactions, investmentPlans } = state;

    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'strategy' | 'network' | 'history'>('profile');
    const [formData, setFormData] = useState<Partial<User>>(
        user || { fullName: '', username: '', email: '', phone: '', whatsapp: '', country: '', status: Status.Active, walletBalance: 0, restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false } }
    );
    const [isSaving, setIsSaving] = useState(false);

    // Network State
    const [treePlanFilter, setTreePlanFilter] = useState('');
    const [treeCurrencyFilter, setTreeCurrencyFilter] = useState<Currency | ''>('');
    const [manualAssignPlanId, setManualAssignPlanId] = useState('');

    // Strategy & Hold Summary
    const upgradeFundSummary = useMemo(() => {
        if (!user) return [];
        const summary: any[] = [];
        user.activePlans?.forEach(ap => {
            const plan = investmentPlans.find(p => p._id === ap.planId);
            if (!plan?.holdPosition?.enabled) return;
            const relatedHeld = transactions.filter(t => t.userId === user._id && t.status === 'Pending' && String(t.relatedPlanId) === String(ap.planId) && t.description.toLowerCase().includes('hold commission'));
            const totalHeld = relatedHeld.reduce((s, tx) => s + tx.amount, 0);
            const targetPlan = investmentPlans.find(p => p._id === plan.autoUpgrade?.toPlanId);
            summary.push({ planId: ap.planId, planName: ap.planName, totalHeld, targetPlan: targetPlan?.name, targetPrice: targetPlan?.price, transactions: relatedHeld });
        });
        return summary;
    }, [user, investmentPlans, transactions]);

    // Genealogy Logic
    const fullDownlineTree = useMemo(() => {
        if (!user) return [];
        const tree: TreeItem[] = [];
        const traverse = (sponsorUsername: string, level: number) => {
            if (level > 10) return;
            const directs = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === sponsorUsername.toLowerCase());
            directs.forEach(ref => {
                const commissionFromNode = transactions.filter(t => t.userId === user._id && t.sourceUserId === ref._id && t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
                tree.push({ user: ref, level, commissionFromNode });
                traverse(ref.username, level + 1);
            });
        };
        traverse(user.username, 1);
        return tree;
    }, [user, users, transactions]);

    const filteredDownline = useMemo(() => {
        return fullDownlineTree.filter(item => {
            const matchesPlan = !treePlanFilter || item.user.activePlans?.some(p => p.planId === treePlanFilter);
            const matchesCurrency = !treeCurrencyFilter || item.user.currency === treeCurrencyFilter;
            return matchesPlan && matchesCurrency;
        });
    }, [fullDownlineTree, treePlanFilter, treeCurrencyFilter]);

    const handleManualUpgrade = async (fromPlanId: string) => {
        if (!user) return;
        if (!window.confirm("FORCE UPGRADE: This will mark all held commissions as 'Used' and activate the target plan. Continue?")) return;
        setIsSaving(true);
        try {
            const updatedUser = await upgradeUserFromHold(user._id, fromPlanId, state.currentUser?.username || 'admin');
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            setFormData(prev => ({ ...prev, activePlans: updatedUser.activePlans }));
            alert("Upgrade successful!");
        } catch (error) { console.error(error); } finally { setIsSaving(false); }
    };

    const handleRemovePlanInstance = async (instanceId: string) => {
        if (!user) return;
        if (window.confirm('Remove this specific plan instance?')) {
            setIsSaving(true);
            try {
                const updatedUser = await adminRemoveUserPlan(user._id, instanceId);
                dispatch({ type: 'UPDATE_USER', payload: updatedUser });
                setFormData(prev => ({ ...prev, activePlans: updatedUser.activePlans }));
            } catch (error) { console.error(error); } finally { setIsSaving(false); }
        }
    };

    const handleManualAssign = async () => {
        if (!user || !manualAssignPlanId) return;
        setIsSaving(true);
        try {
            const result = await adminActivatePlan(user._id, manualAssignPlanId);
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setFormData(prev => ({ ...prev, activePlans: result.user.activePlans }));
            alert("Plan assigned and commissions triggered.");
            setManualAssignPlanId('');
        } catch (error) { console.error(error); } finally { setIsSaving(false); }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

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
        } catch (error) { console.error(error); } finally { setIsSaving(false); }
    };

    const TabButton: React.FC<{ tabId: typeof activeTab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button type="button" onClick={() => setActiveTab(tabId)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>
    );

    return (
         <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[95vw] max-w-5xl h-[90vh] flex flex-col">
                <h2 className="text-xl font-bold mb-4">{user ? `Member Control: @${user.username}` : 'Add New User'}</h2>
                <div className="border-b dark:border-gray-700"><nav className="-mb-px flex space-x-4"><TabButton tabId="profile">Basic Profile</TabButton>{user && <TabButton tabId="security">Security</TabButton>}{user && <TabButton tabId="strategy">Strategy & Hold</TabButton>}{user && <TabButton tabId="network">Network & Plans</TabButton>}{user && <TabButton tabId="history">History</TabButton>}</nav></div>

                <div className="flex-grow overflow-y-auto pt-6">
                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="space-y-4">
                               <h3 className="font-bold text-gray-400 uppercase text-xs">Profile Information</h3>
                               <input name="fullName" value={formData.fullName || ''} onChange={handleFormChange} placeholder="Full Name" className="w-full rounded-md dark:bg-gray-700" />
                               <input name="username" value={formData.username || ''} onChange={handleFormChange} placeholder="Username" className="w-full rounded-md dark:bg-gray-700" disabled={!!user} />
                               <input name="email" value={formData.email || ''} onChange={handleFormChange} placeholder="Email" className="w-full rounded-md dark:bg-gray-700" />
                               <div className="grid grid-cols-2 gap-4"><input name="phone" value={formData.phone || ''} onChange={handleFormChange} placeholder="Phone" className="w-full rounded-md dark:bg-gray-700" /><input name="whatsapp" value={formData.whatsapp || ''} onChange={handleFormChange} placeholder="WhatsApp" className="w-full rounded-md dark:bg-gray-700" /></div>
                               <select name="country" value={formData.country || ''} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">{countries.map(c => <option key={c} value={c}>{c}</option>)}</select>
                               <select name="status" value={formData.status} onChange={handleFormChange} className="w-full rounded-md dark:bg-gray-700">{['Active', 'Blocked', 'Pending', 'Paused'].map(s => <option key={s} value={s}>{s}</option>)}</select>
                            </div>
                            {user && <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg border dark:border-gray-600 shadow-inner"><h3 className="font-bold text-gray-400 uppercase text-xs">Wallet Health</h3><p className="text-4xl font-black text-blue-600">{formatCurrency(formData.walletBalance || 0, formData.currency || 'PKR')}</p><div className="flex gap-2 pt-4"><Button onClick={() => setActiveTab('history')}>Audit History</Button></div></div>}
                        </div>
                    )}

                    {activeTab === 'strategy' && user && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="font-bold text-gray-400 uppercase text-xs">Strategic Upgrade Tracker</h3>
                            {upgradeFundSummary.map(item => (
                                <div key={item.planId} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                                        <div><h4 className="font-bold text-lg">{item.planName} Path</h4><p className="text-xs text-gray-500">Target: <strong className="text-blue-600">{item.targetPlan || 'None'}</strong> ({formatCurrency(item.targetPrice || 0, user.currency)})</p></div>
                                        <div className="text-right"><div className="text-2xl font-black text-indigo-600">{formatCurrency(item.totalHeld, user.currency)}</div><p className="text-[10px] text-gray-400 uppercase font-black">Total Held</p></div>
                                    </div>
                                    <div className="p-4">
                                        <h5 className="text-[10px] font-black text-gray-400 uppercase mb-3">Contribution Ledger</h5>
                                        <table className="w-full text-xs text-left"><thead className="text-gray-400 uppercase text-[10px]"><tr><th className="pb-2">Source Referral</th><th className="pb-2 text-center">Slot</th><th className="pb-2 text-center">Amount</th><th className="pb-2 text-right">Date</th></tr></thead><tbody className="divide-y dark:divide-gray-700">{item.transactions.map((tx: any) => (
                                            <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30"><td className="py-2 font-bold text-blue-500">@{tx.userName}</td><td className="py-2 text-center">#{tx.description.match(/Slot #(\d+)/)?.[1] || '??'}</td><td className="py-2 text-center font-bold text-indigo-600">{formatCurrency(tx.amount, tx.currency)}</td><td className="py-2 text-right text-gray-400">{new Date(tx.date).toLocaleDateString()}</td></tr>
                                        ))}</tbody></table>
                                        {item.totalHeld > 0 && <div className="mt-4 pt-4 border-t flex justify-end"><Button size="sm" onClick={() => handleManualUpgrade(item.planId)} disabled={isSaving}>Trigger Manual Force Upgrade</Button></div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'network' && user && (
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                            <div className="space-y-6">
                                <section>
                                    <h3 className="font-bold text-gray-400 uppercase text-xs mb-3 tracking-widest">Genealogy Tree ({filteredDownline.length})</h3>
                                    <div className="flex gap-2 mb-4">
                                        <select className="flex-1 text-xs rounded dark:bg-gray-700 border-gray-300" value={treeCurrencyFilter} onChange={e => setTreeCurrencyFilter(e.target.value as Currency | '')}><option value="">All Currencies</option><option value="USD">USD</option><option value="PKR">PKR</option><option value="EUR">EUR</option></select>
                                        <select className="flex-1 text-xs rounded dark:bg-gray-700 border-gray-300" value={treePlanFilter} onChange={e => setTreePlanFilter(e.target.value)}><option value="">All Plans</option>{investmentPlans.filter(p => p.status === 'Active').map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto border dark:border-gray-700 rounded-xl p-2 bg-gray-50 dark:bg-gray-900 shadow-inner space-y-2">
                                        {filteredDownline.map((item, i) => (
                                            <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm relative overflow-hidden">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">L{item.level}</div>
                                                    <div className="flex-grow">
                                                        <div className="flex justify-between items-start">
                                                            <span className="font-black text-sm">@{item.user.username} <Badge status={item.user.status as Status} /></span>
                                                            <span className="text-[9px] text-gray-400 uppercase">Yield: <span className="text-green-600 font-bold">+{formatCurrency(item.commissionFromNode, user.currency)}</span></span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-medium">Joined: {new Date(item.user.registrationDate).toLocaleDateString()}</p>
                                                        <p className="text-[10px] mt-1 line-clamp-1"><span className="text-gray-400 font-bold uppercase">Plans:</span> {item.user.activePlans?.map(p => `${p.planName} (${formatCurrency(p.price, item.user.currency)})`).join(', ') || 'No active plans'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                            <div className="space-y-6">
                                <section className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                                    <h3 className="font-bold text-blue-800 dark:text-blue-300 uppercase text-xs mb-3 tracking-widest">Manual Plan Activation</h3>
                                    <p className="text-[10px] text-blue-600 mb-4 font-medium">Assign a plan manually. Commissions will trigger for uplines.</p>
                                    <div className="flex gap-2">
                                        <select className="flex-grow rounded-md text-sm dark:bg-gray-800 border-blue-200" value={manualAssignPlanId} onChange={e => setManualAssignPlanId(e.target.value)}><option value="">-- Choose PKR Plan --</option>{investmentPlans.filter(p => p.currency === user.currency && p.status === 'Active').map(p => <option key={p._id} value={p._id}>{p.name} ({formatCurrency(p.price, p.currency)})</option>)}</select>
                                        <Button size="sm" onClick={handleManualAssign} disabled={isSaving || !manualAssignPlanId}>Activate</Button>
                                    </div>
                                </section>
                                <section><h3 className="font-bold text-gray-400 uppercase text-xs mb-3 tracking-widest">Active Portfolio Control</h3><div className="space-y-3">{formData.activePlans?.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm"><div><p className="text-sm font-black">{p.planName}</p><p className="text-[10px] text-gray-400 uppercase font-black">Price: {formatCurrency(p.price, user.currency)}</p></div><button onClick={() => handleRemovePlanInstance(p._id)} className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><TrashIcon /></button></div>
                                ))}</div></section>
                            </div>
                         </div>
                    )}

                    {activeTab === 'history' && user && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left"><thead className="bg-gray-100 dark:bg-gray-900 text-gray-500"><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Amount</th><th className="p-3">Details</th></tr></thead><tbody className="divide-y dark:divide-gray-700">{transactions.filter(t=>t.userId===user._id).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0, 50).map(tx => (
                                    <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-800"><td className="p-3 text-gray-400 font-mono text-[10px]">{new Date(tx.date).toLocaleString()}</td><td className="p-3 font-bold">{tx.type}</td><td className={`p-3 font-mono font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount, tx.currency)}</td><td className="p-3 text-[10px] truncate" title={tx.description}>{tx.description}</td></tr>
                                ))}</tbody></table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4 shrink-0"><Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button><Button onClick={handleSaveChanges} disabled={isSaving}>Save Member Data</Button></div>
            </div>
        </Modal>
    );
};

// ... Sub-modals for Bulk and Delete (Assuming unchanged) ...
interface BulkRestrictionsModalProps { allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void; }
const BulkRestrictionsModal: React.FC<BulkRestrictionsModalProps> = ({ allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [targetType, setTargetType] = useState<'all' | 'plan'>('all');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [restrictions, setRestrictions] = useState<Partial<UserRestrictions>>({ deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false });
    const [action, setAction] = useState<'enable' | 'disable'>('enable');
    const [isProcessing, setIsProcessing] = useState(false);
    const handleApply = async () => {
        setIsProcessing(true);
        try {
            await bulkUpdateUserRestrictions({ targetType, targetIds, restrictions, action });
            const updatedUsers = await getUsers();
            dispatch({ type: 'SET_USERS', payload: updatedUsers });
            alert('Bulk update completed.');
            onClose();
        } catch (err: any) { alert(err.message || 'Failed'); } finally { setIsProcessing(false); }
    };
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[500px] max-w-full space-y-6">
                <h3 className="text-xl font-bold">Bulk Restrictions</h3>
                <div className="flex gap-2"><button onClick={() => setTargetType('all')} className={`flex-1 py-2 rounded border ${targetType === 'all' ? 'bg-blue-600 text-white' : ''}`}>All</button><button onClick={() => setTargetType('plan')} className={`flex-1 py-2 rounded border ${targetType === 'plan' ? 'bg-blue-600 text-white' : ''}`}>By Plan</button></div>
                {targetType === 'plan' && <div className="max-h-40 overflow-y-auto border p-2">{investmentPlans.map(p => <label key={p._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={targetIds.includes(p._id)} onChange={() => setTargetIds(prev => prev.includes(p._id) ? prev.filter(i => i !== p._id) : [...prev, p._id])}/> {p.name}</label>)}</div>}
                <div className="grid grid-cols-2 gap-2">{Object.keys(restrictions).map(key => <label key={key} className="flex items-center gap-2 p-2 border rounded text-sm"><input type="checkbox" checked={!!(restrictions as any)[key]} onChange={() => setRestrictions(prev => ({...prev, [key]: !(prev as any)[key]}))}/> Block {key}</label>)}</div>
                <div className="pt-4 border-t flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleApply} disabled={isProcessing}>Apply</Button></div>
            </div>
        </Modal>
    );
};

interface MessageUserModalProps { user: User | null; allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void; }
const MessageUserModal: React.FC<MessageUserModalProps> = ({ user, allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const handleSend = async () => {
        if (!message) return;
        setIsSending(true);
        try {
            const result = await sendAdminNotification({ userId: user?._id, subject, message, targetType: user ? undefined : 'all' });
            dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            alert(`Sent successfully.`);
            onClose();
        } catch (err: any) { alert(err.message || 'Failed'); } finally { setIsSending(false); }
    };
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[500px] space-y-4">
                <h3 className="text-xl font-bold">Send Announcement</h3>
                {user && <div className="p-2 bg-gray-50 rounded text-sm">To: <strong>@{user.username}</strong></div>}
                <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border p-2 rounded" placeholder="Subject" />
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full border p-2 rounded" placeholder="Message..." />
                <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSend} disabled={isSending}>Send</Button></div>
            </div>
        </Modal>
    );
};

interface DeleteUserModalProps { user: User; onClose: () => void; onConfirmDelete: (userId: string) => Promise<void>; }
const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onClose, onConfirmDelete }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const handleConfirm = async () => { setIsDeleting(true); await onConfirmDelete(user._id); setIsDeleting(false); };
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-6 w-96 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>
                <h3 className="text-xl font-bold text-gray-900">Confirm Deletion</h3>
                <p className="text-sm text-gray-500">Delete user <strong>@{user.username}</strong> and all associated data permanently?</p>
                <div className="flex gap-2 pt-4"><Button className="flex-1" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button><Button className="flex-1" variant="danger" onClick={handleConfirm} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</Button></div>
            </div>
        </Modal>
    );
};

export default Users;
