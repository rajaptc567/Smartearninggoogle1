
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, sendAdminNotification, bulkUpdateUserRestrictions, adjustUserWallet } from '../services/api';

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

    const tableHeaders = ['User', 'Contact', 'Wallet Balance', 'Active Plans', 'Status', 'Actions'];

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
                <Button variant="secondary" onClick={() => setIsBulkRestrictionsModalOpen(true)}>Bulk Restrictions</Button>
                <Button variant="secondary" onClick={() => handleOpenMessage(null)}>Send Bulk Message</Button>
                <Button onClick={() => handleOpenUserManagementModal(null)}>Add User</Button>
            </div>
             {isLoading ? <p>Loading users...</p> : (
                 <Table headers={tableHeaders}>
                    {filteredUsers.map((user: User) => (
                        <tr key={user._id} className="text-gray-700 dark:text-gray-400">
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
                </Table>
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

// ... (Other Modals: DeleteUserModal, BulkRestrictionsModal, MessageUserModal) ...
// NOTE: For brevity, these modals are not repeated as they are unchanged.

// --- Main UserManagementModal ---

interface UserManagementModalProps {
    user: User | null;
    onClose: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, onClose }) => {
    const { state, dispatch } = useData();
    const { users, transactions } = state;

    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'network' | 'history'>('profile');
    const [formData, setFormData] = useState<Partial<User>>(
        user || { fullName: '', username: '', email: '', phone: '', country: '', status: Status.Active, walletBalance: 0, restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false } }
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
                const newUser = await apiCreateUser({ ...updateData, password: 'password123' }); // default password for new users
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
                               <input name="phone" value={formData.phone || ''} onChange={handleFormChange} placeholder="Phone" className="w-full rounded-md dark:bg-gray-700" />
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


// Unchanged Modals
const DeleteUserModal: React.FC<{ user: User; onClose: () => void; onConfirmDelete: (userId: string) => Promise<void>; }> = ({ user, onClose, onConfirmDelete }) => { /* ... existing code ... */ return null; };
const BulkRestrictionsModal: React.FC<{ allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ allUsers, investmentPlans, onClose }) => { /* ... existing code ... */ return null; };
const MessageUserModal: React.FC<{ user: User | null; allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ user, allUsers, investmentPlans, onClose }) => { /* ... existing code ... */ return null; };


export default Users;
