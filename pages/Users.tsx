
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Status, UserRestrictions, InvestmentPlan, formatCurrency, countries, Currency, Deposit, Withdrawal, Transfer, Transaction } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateUser as apiUpdateUser, createUser as apiCreateUser, adminInitiatePasswordReset, deleteUser, sendAdminNotification, bulkUpdateUserRestrictions } from '../services/api';

const Users: React.FC = () => {
    const { state, dispatch } = useData();
    const { users, investmentPlans } = state;
    
    const isLoading = users.length === 0;
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestrictionsModalOpen, setIsRestrictionsModalOpen] = useState(false);
    const [isBulkRestrictionsModalOpen, setIsBulkRestrictionsModalOpen] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [modalMode, setModalMode] = useState<'edit' | 'details'>('edit');
    
    // Filtering State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('');

    const handleOpenModal = (user: User | null = null, mode: 'edit' | 'details' = 'edit') => {
        setEditingUser(user);
        setModalMode(mode);
        setIsModalOpen(true);
    };

    const handleOpenRestrictions = (user: User) => {
        setEditingUser(user);
        setIsRestrictionsModalOpen(true);
    }

    const handleOpenMessage = (user: User | null = null) => {
        setEditingUser(user);
        setIsMessageModalOpen(true);
    }
    
    const handleOpenDeleteModal = (user: User) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingUser(null);
        setUserToDelete(null);
        setIsModalOpen(false);
        setIsRestrictionsModalOpen(false);
        setIsBulkRestrictionsModalOpen(false);
        setIsMessageModalOpen(false);
        setIsDeleteModalOpen(false);
    };

    const handleSaveUser = async (user: User) => {
        try {
            if (editingUser) {
                const updatedUser = await apiUpdateUser(user._id, user);
                dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            } else {
                const newUserPayload = { ...user, password: 'password123', walletBalance: 0, activePlan: 'None', activePlans: [], status: Status.Active };
                const newUser = await apiCreateUser(newUserPayload);
                dispatch({ type: 'ADD_USER', payload: newUser });
            }
        } catch (error) {
            console.error("Failed to save user:", error);
            alert("Error: Could not save user.");
        } finally {
            handleCloseModal();
        }
    };

    const handleSaveRestrictions = async (restrictions: UserRestrictions) => {
        if (!editingUser) return;
        try {
            const updatedUser = await apiUpdateUser(editingUser._id, { restrictions });
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            alert('User restrictions updated successfully.');
        } catch (error) {
            console.error("Failed to save restrictions:", error);
            alert("Error: Could not update restrictions.");
        } finally {
            handleCloseModal();
        }
    }

    const handleToggleStatus = async (user: User) => {
        const newStatus = user.status === Status.Blocked ? Status.Active : Status.Blocked;
        try {
            const updatedUser = await apiUpdateUser(user._id, { status: newStatus });
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
        } catch (error) {
            console.error("Failed to toggle user status:", error);
            alert("Error: Could not update user status.");
        }
    }
    
    const handleConfirmDelete = async (userId: string) => {
        try {
            await deleteUser(userId);
            dispatch({ type: 'DELETE_USER', payload: userId });
            alert('User and all associated data deleted successfully.');
            handleCloseModal();
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
                    {/* Filters */}
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
                <Button onClick={() => handleOpenModal(null, 'edit')}>Add User</Button>
            </div>
             {isLoading ? <p>Loading users...</p> : (
                 <Table headers={tableHeaders}>
                    {filteredUsers.map((user: User) => (
                        <tr key={user._id} className="text-gray-700 dark:text-gray-400">
                            <td className="px-4 py-3">
                                <div className="flex items-center text-sm">
                                    <div>
                                        <p className="font-semibold">{user.fullName}</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">@{user.username} (ID: {user._id})</p>
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
                                    <Button size="sm" variant="secondary" onClick={() => handleOpenModal(user, 'details')}>Details</Button>
                                    <Button size="sm" variant="secondary" onClick={() => handleOpenMessage(user)}>Message</Button>
                                    <Button size="sm" variant="secondary" onClick={() => handleOpenRestrictions(user)}>
                                        Restrictions
                                    </Button>

                                    <Button size="sm" variant={user.status === Status.Blocked ? 'success' : 'danger'} onClick={() => handleToggleStatus(user)}>
                                        {user.status === Status.Blocked ? 'Unblock' : 'Block'}
                                    </Button>
                                    <Button size="sm" variant="danger" onClick={() => handleOpenDeleteModal(user)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
             )}
            {isModalOpen && (
                <UserFormModal 
                    user={editingUser}
                    mode={modalMode}
                    onClose={handleCloseModal}
                    onSave={handleSaveUser}
                    onSwitchToEdit={() => setModalMode('edit')}
                />
            )}
            {isRestrictionsModalOpen && editingUser && (
                <UserRestrictionsModal
                    user={editingUser}
                    onClose={handleCloseModal}
                    onSave={handleSaveRestrictions}
                />
            )}
            {isBulkRestrictionsModalOpen && (
                <BulkRestrictionsModal
                    allUsers={users}
                    investmentPlans={investmentPlans}
                    onClose={handleCloseModal}
                />
            )}
            {isMessageModalOpen && (
                <MessageUserModal
                    user={editingUser}
                    allUsers={users}
                    investmentPlans={investmentPlans}
                    onClose={handleCloseModal}
                />
            )}
            {isDeleteModalOpen && userToDelete && (
                <DeleteUserModal
                    user={userToDelete}
                    onClose={handleCloseModal}
                    onConfirmDelete={handleConfirmDelete}
                />
            )}
        </div>
    );
};

// ... (Other Modals: UserFormModal, UserDetailsModal, BulkRestrictionsModal, MessageUserModal, UserRestrictionsModal) ...
// NOTE: For brevity, the other modals are assumed to be here but are not repeated. The new DeleteUserModal is added below.

interface DeleteUserModalProps {
    user: User;
    onClose: () => void;
    onConfirmDelete: (userId: string) => Promise<void>;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onClose, onConfirmDelete }) => {
    const { state } = useData();
    const { users, deposits, withdrawals, transfers, transactions } = state;

    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const generateAndDownloadDossier = () => {
        let csvContent = "";

        const addSection = (title: string, headers: string[], data: (string | number | undefined)[][]) => {
            csvContent += `\n"${title}"\n`;
            if (headers.length > 0) csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
            if (data.length > 0) {
                data.forEach(row => {
                    csvContent += row.map(cell => `"${String(cell ?? 'N/A').replace(/"/g, '""')}"`).join(',') + '\n';
                });
            } else {
                csvContent += '"No data available for this section."\n';
            }
        };
        
        // --- 1. Profile Summary ---
        csvContent += `"USER DOSSIER FOR:","${user.username}","GENERATED ON:","${new Date().toLocaleString()}"\n\n`;
        addSection("PROFILE SUMMARY", [], [
            ['User ID', user._id],
            ['Full Name', user.fullName],
            ['Username', user.username],
            ['Email', user.email],
            ['Phone', user.phone],
            ['Country', user.country],
            ['Currency', user.currency],
            ['Sponsor', user.sponsor || 'N/A'],
            ['Status', user.status],
            ['Registration Date', new Date(user.registrationDate).toLocaleString()],
        ]);

        // --- 2. Wallet & Plans ---
        const planData = (user.activePlans || []).map(p => [p.planName, formatCurrency(p.price, user.currency), new Date(p.purchaseDate).toLocaleString()]);
        addSection("WALLET & PLANS", ['Current Wallet Balance', formatCurrency(user.walletBalance, user.currency)], []);
        addSection("Active Plans", ['Plan Name', 'Price', 'Purchase Date'], planData);

        // --- 3. Histories ---
        const userDeposits = deposits.filter(d => d.userId === user._id);
        addSection("DEPOSIT HISTORY", ['ID', 'Amount', 'Method', 'Status', 'Date', 'Transaction ID'], userDeposits.map(d => [d._id, formatCurrency(d.amount, d.currency), d.method, d.status, new Date(d.date).toLocaleString(), d.transactionId]));

        const userWithdrawals = withdrawals.filter(w => w.userId === user._id);
        addSection("WITHDRAWAL HISTORY", ['ID', 'Amount', 'Fee', 'Final Amount', 'Method', 'Status', 'Date'], userWithdrawals.map(w => [w._id, formatCurrency(w.amount, w.currency), formatCurrency(w.fee, w.currency), formatCurrency(w.finalAmount, w.currency), w.method, w.status, new Date(w.date).toLocaleString()]));

        const userTransfers = transfers.filter(t => t.senderId === user._id || t.recipientId === user._id);
        addSection("TRANSFER HISTORY", ['ID', 'Type', 'From/To', 'Amount', 'Status', 'Date'], userTransfers.map(t => {
            const type = t.senderId === user._id ? 'Sent' : 'Received';
            const otherParty = type === 'Sent' ? t.recipientName : t.senderName;
            return [t._id, type, otherParty, formatCurrency(t.amount, t.currency), t.status, new Date(t.date).toLocaleString()];
        }));
        
        // --- 4. Full Ledger ---
        const userTransactions = transactions.filter(t => t.userId === user._id);
        addSection("FULL TRANSACTION LEDGER", ['ID', 'Type', 'Amount', 'Status', 'Date', 'Description'], userTransactions.map(tx => [tx._id, tx.type, formatCurrency(tx.amount, tx.currency), tx.status || 'Approved', new Date(tx.date).toLocaleString(), tx.description]));

        // --- 5. Referrals ---
        const getFullDownlineWithLevels = (sponsorUsername: string, allUsers: User[], currentLevel = 1): { user: User, level: number }[] => {
            const directReferrals = allUsers.filter(u => u.sponsor === sponsorUsername);
            let downline: { user: User, level: number }[] = [];

            for (const referral of directReferrals) {
                downline.push({ user: referral, level: currentLevel });
                downline = downline.concat(getFullDownlineWithLevels(referral.username, allUsers, currentLevel + 1));
            }
            return downline;
        };

        const fullDownline = getFullDownlineWithLevels(user.username, users);
        const directRefs = fullDownline.filter(item => item.level === 1).map(item => item.user);
        const indirectRefs = fullDownline.filter(item => item.level > 1);

        addSection("DIRECT REFERRALS (Level 1)", ['Username', 'Full Name', 'Status', 'Registration Date'], directRefs.map(ref => [ref.username, ref.fullName, ref.status, new Date(ref.registrationDate).toLocaleString()]));
        addSection("INDIRECT REFERRALS (Level 2+)", ['Level', 'Username', 'Full Name', 'Status', 'Registration Date', 'Direct Sponsor'], indirectRefs.map(item => [item.level, item.user.username, item.user.fullName, item.user.status, new Date(item.user.registrationDate).toLocaleString(), item.user.sponsor]));

        // --- Download Trigger ---
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Dossier_${user.username}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert('Dossier download started.');
    };

    const handleConfirm = async () => {
        setIsDeleting(true);
        await onConfirmDelete(user._id);
        setIsDeleting(false); // Should unmount on success, but good practice
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-6 w-[90vw] max-w-lg">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50">
                        <svg className="h-6 w-6 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-3">Delete User Account</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        You are about to permanently delete the user <strong>{user.username}</strong>. This will erase all their associated data, including wallet, transactions, and history. This action is irreversible.
                    </p>
                </div>
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <h4 className="font-semibold">Step 1: Download User Dossier</h4>
                    <p className="text-xs text-gray-500 mt-1 mb-3">For archival purposes, download a complete CSV file of all user data before deleting.</p>
                    <Button variant="secondary" onClick={generateAndDownloadDossier}>Download User Dossier (.csv)</Button>
                </div>

                <div className="mt-6">
                    <label className="flex items-start space-x-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isConfirmed}
                            onChange={(e) => setIsConfirmed(e.target.checked)}
                            className="h-5 w-5 rounded mt-0.5 border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm">
                            I have downloaded the user dossier and understand that deleting this account is permanent and cannot be undone.
                        </span>
                    </label>
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <Button variant="danger" onClick={handleConfirm} disabled={!isConfirmed || isDeleting}>
                        {isDeleting ? 'Deleting User...' : 'Confirm & Permanently Delete'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// UserFormModal, UserDetailsModal, etc. remain here...
// ... (rest of the modal components as before) ...
interface UserFormModalProps {
    user: User | null;
    mode: 'edit' | 'details';
    onClose: () => void;
    onSave: (user: User) => void;
    onSwitchToEdit: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, mode, onClose, onSave, onSwitchToEdit }) => {
    const { state } = useData();
    const [formData, setFormData] = useState<Partial<User>>(
        user || { fullName: '', username: '', email: '', phone: '', country: '' }
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as User);
    };

    if (mode === 'details' && user) {
        return <UserDetailsModal user={user} onClose={onClose} onSwitchToEdit={onSwitchToEdit} />;
    }

    return (
        <Modal isOpen={true} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-4">
                <h2 className="text-xl font-bold mb-4">{user ? 'Edit User' : 'Add New User'}</h2>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="fullName" className="block text-sm font-medium">Full Name</label>
                        <input type="text" name="fullName" value={formData.fullName || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium">Username</label>
                        <input type="text" name="username" value={formData.username || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                     <div>
                        <label htmlFor="email" className="block text-sm font-medium">Email</label>
                        <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium">Phone</label>
                        <input type="text" name="phone" value={formData.phone || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="country" className="block text-sm font-medium">Country</label>
                        <select id="country" name="country" value={formData.country || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600" required>
                            <option value="">-- Select country --</option>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Changing country will automatically update user's currency.</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </Modal>
    )
}

// UserDetailsModal Component
const UserDetailsModal: React.FC<{ user: User; onClose: () => void; onSwitchToEdit: () => void;}> = ({ user, onClose, onSwitchToEdit }) => {
    const { state } = useData();
    const { users, deposits, withdrawals, transactions } = state;

    const [resetLink, setResetLink] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    
    const userDeposits = useMemo(() => deposits.filter(d => d.userId === user._id), [deposits, user._id]);
    const userWithdrawals = useMemo(() => withdrawals.filter(w => w.userId === user._id), [withdrawals, user._id]);
    const userTransactions = useMemo(() => transactions.filter(t => t.userId === user._id), [transactions, user._id]);

    const buildGenealogy = (userId: string, allUsers: User[]): { user: User, children: any[] }[] => {
        const directReferrals = allUsers.filter(u => u.sponsor === users.find(mainUser => mainUser._id === userId)?.username);
        if (!directReferrals.length) return [];
        return directReferrals.map(child => ({
            user: child,
            children: buildGenealogy(child._id, allUsers),
        }));
    };
    const genealogyTree = useMemo(() => buildGenealogy(user._id, users), [user._id, users]);

    const handleGenerateResetLink = async () => {
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

    const renderTree = (nodes: { user: User, children: any[] }[]) => (
        <ul className="pl-4 border-l border-gray-200 dark:border-gray-700">
            {nodes.map(node => (
                <li key={node.user._id} className="mt-2">
                    <p className="text-sm">
                        <span className="font-semibold">{node.user.fullName}</span> (@{node.user.username}) - <Badge status={node.user.status} />
                    </p>
                    {node.children.length > 0 && renderTree(node.children)}
                </li>
            ))}
        </ul>
    );

    const HistoryTable = ({data, type}: {data: any[], type: 'deposits' | 'withdrawals' | 'transactions'}) => (
        <div className="overflow-x-auto max-h-60">
            <table className="w-full text-sm">
                {type === 'deposits' && <thead><tr className="text-left text-xs uppercase"><th className="p-2">ID</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Date</th></tr></thead>}
                {type === 'withdrawals' && <thead><tr className="text-left text-xs uppercase"><th className="p-2">ID</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Date</th></tr></thead>}
                {type === 'transactions' && <thead><tr className="text-left text-xs uppercase"><th className="p-2">Type</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Desc</th><th className="p-2">Date</th></tr></thead>}
                <tbody>
                    {data.map((item: any) => (
                         <tr key={item._id} className="border-b dark:border-gray-700">
                            {type !== 'transactions' && <td className="p-2">{item._id}</td>}
                            {type === 'transactions' && <td className="p-2">{item.type}</td>}
                            <td className={`p-2 font-semibold ${item.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(item.amount, item.currency)}</td>
                            
                            {type !== 'transactions' ? 
                                <td className="p-2"><Badge status={item.status} /></td>
                                : 
                                <td className="p-2"><Badge status={item.status as Status || Status.Approved} /></td>
                            }
                            
                            {type === 'transactions' && <td className="p-2">{item.description}</td>}
                            <td className="p-2">{item.date}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length === 0 && <p className="p-2 text-center text-xs text-gray-500">No records found.</p>}
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-4 w-[90vw] max-w-4xl">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">User Details: {user.fullName}</h2>
                    <div className="flex items-center space-x-2">
                        <Button onClick={onSwitchToEdit}>Edit User</Button>
                        <Button variant="danger" onClick={handleGenerateResetLink} disabled={isGeneratingLink}>
                           {isGeneratingLink ? 'Generating...' : 'Reset Password'}
                        </Button>
                    </div>
                </div>

                {resetLink && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm">
                        <p className="font-semibold">Password Reset Link Generated</p>
                        <p className="text-xs mb-2">Share this secure, single-use link with the user. This link is valid for 48 hours. Once opened, the user will have 10 minutes to complete the password reset.</p>
                        <div className="flex items-center space-x-2">
                           <input type="text" readOnly value={resetLink} className="w-full text-xs rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-0"/>
                           <Button size="sm" onClick={() => navigator.clipboard.writeText(resetLink)}>Copy</Button>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                            <h3 className="font-semibold mb-2">Personal Information</h3>
                            <p className="text-sm"><strong>Username:</strong> @{user.username}</p>
                            <p className="text-sm"><strong>Email:</strong> {user.email}</p>
                            <p className="text-sm"><strong>Phone:</strong> {user.phone}</p>
                            <p className="text-sm"><strong>Country:</strong> {user.country || 'N/A'}</p>
                            <p className="text-sm"><strong>Sponsor:</strong> @{user.sponsor || 'N/A'}</p>
                            <p className="text-sm"><strong>Registered:</strong> {user.registrationDate}</p>
                        </div>
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                            <h3 className="font-semibold mb-2">Wallet & Plan</h3>
                            <p className="text-sm"><strong>Balance:</strong> <span className="font-bold text-green-600">{formatCurrency(user.walletBalance, user.currency)}</span></p>
                            <p className="text-sm"><strong>Active Plans:</strong> {user.activePlans && user.activePlans.length > 0 ? user.activePlans.map(p => p.planName).join(', ') : 'None'}</p>
                            <p className="text-sm"><strong>Status:</strong> <Badge status={user.status} /></p>
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"><h3 className="font-semibold mb-2">Deposit History</h3><HistoryTable data={userDeposits} type="deposits"/></div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"><h3 className="font-semibold mb-2">Withdrawal History</h3><HistoryTable data={userWithdrawals} type="withdrawals"/></div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"><h3 className="font-semibold mb-2">All Transactions</h3><HistoryTable data={userTransactions} type="transactions"/></div>
                    </div>
                </div>
                 <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Genealogy Tree</h3>
                    {genealogyTree.length > 0 ? renderTree(genealogyTree) : <p className="text-sm text-gray-500">This user has no referrals.</p>}
                </div>
            </div>
        </Modal>
    );
};

const BulkRestrictionsModal: React.FC<{ allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ allUsers, investmentPlans, onClose }) => {
    const [targetType, setTargetType] = useState<'single' | 'plan' | 'all'>('single');
    
    // Single User Selection
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Plan Selection
    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

    // Action Settings
    const [restrictions, setRestrictions] = useState<UserRestrictions>({
        deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false
    });
    const [action, setAction] = useState<'enable' | 'disable' | 'toggle'>('enable'); // enable = Set True (Block), disable = Set False (Unblock)
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredUsers = allUsers.filter(u => 
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.fullName.toLowerCase().includes(userSearch.toLowerCase())
    );

    const handleSelectUser = (u: User) => {
        if (!selectedUserIds.includes(u._id)) {
            setSelectedUserIds([...selectedUserIds, u._id]);
        }
        setIsDropdownOpen(false);
        setUserSearch('');
    }

    const handleTogglePlan = (planId: string) => {
        if (selectedPlanIds.includes(planId)) {
            setSelectedPlanIds(selectedPlanIds.filter(id => id !== planId));
        } else {
            setSelectedPlanIds([...selectedPlanIds, planId]);
        }
    }

    const handleToggleRestriction = (key: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    }

    const handleSubmit = async () => {
        if (targetType === 'single' && selectedUserIds.length === 0) return alert("Please select at least one user.");
        if (targetType === 'plan' && selectedPlanIds.length === 0) return alert("Please select at least one plan.");
        
        const hasSelection = Object.values(restrictions).some(v => v);
        if (!hasSelection) return alert("Please select at least one restriction to modify.");

        setIsSubmitting(true);
        try {
            await bulkUpdateUserRestrictions({
                targetType,
                targetIds: targetType === 'single' ? selectedUserIds : (targetType === 'plan' ? selectedPlanIds : []),
                restrictions,
                action
            });
            
            alert("Bulk restrictions updated successfully! Notifications have been sent.");
            // We should ideally refresh user list here, but for simplicity assuming immediate UI update isn't strictly required or page refresh will do
            window.location.reload(); // Simple refresh to get new user states
        } catch (error) {
            console.error(error);
            alert("Failed to update restrictions.");
        } finally {
            setIsSubmitting(false);
        }
    }

    const affectedUsersCount = useMemo(() => {
        if (targetType === 'single') return selectedUserIds.length;
        if (targetType === 'all') return allUsers.length;
        if (targetType === 'plan') {
            const uniqueUsers = new Set();
            allUsers.forEach(u => {
                if (u.activePlans && u.activePlans.some(p => selectedPlanIds.includes(p.planId))) {
                    uniqueUsers.add(u._id);
                }
            });
            return uniqueUsers.size;
        }
        return 0;
    }, [targetType, selectedUserIds, selectedPlanIds, allUsers]);

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-6 w-[90vw] max-w-lg">
                <h3 className="text-xl font-bold mb-4">Bulk User Restrictions</h3>
                
                <div className="space-y-6">
                    {/* 1. Select Targets */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">1. Select Target Audience</label>
                        <div className="flex space-x-2 mb-3">
                            <button onClick={() => setTargetType('single')} className={`px-3 py-1.5 rounded text-sm ${targetType === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Specific Users</button>
                            <button onClick={() => setTargetType('plan')} className={`px-3 py-1.5 rounded text-sm ${targetType === 'plan' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>By Active Plan</button>
                            <button onClick={() => setTargetType('all')} className={`px-3 py-1.5 rounded text-sm ${targetType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>All Users</button>
                        </div>

                        {targetType === 'single' && (
                            <div className="relative" ref={dropdownRef}>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {selectedUserIds.map(id => {
                                        const u = allUsers.find(au => au._id === id);
                                        return u ? <span key={id} className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">{u.username} <button onClick={() => setSelectedUserIds(selectedUserIds.filter(uid => uid !== id))} className="ml-1 text-red-500">x</button></span> : null
                                    })}
                                </div>
                                <input type="text" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setIsDropdownOpen(true); }} placeholder="Search user..." className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" />
                                {isDropdownOpen && (
                                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-40 overflow-auto rounded-md">
                                        {filteredUsers.map(u => (
                                            <div key={u._id} onClick={() => handleSelectUser(u)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm">{u.fullName} (@{u.username})</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {targetType === 'plan' && (
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-md border dark:border-gray-600 max-h-40 overflow-y-auto">
                                <div className="space-y-2">
                                    {investmentPlans.filter(p => p.status === 'Active').map(plan => (
                                        <label key={plan._id} className="flex items-center space-x-2">
                                            <input type="checkbox" checked={selectedPlanIds.includes(plan._id)} onChange={() => handleTogglePlan(plan._id)} className="rounded text-blue-600" />
                                            <span className="text-sm">{plan.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <p className="text-xs text-right text-gray-500 mt-1">Targeting <strong>{affectedUsersCount}</strong> users.</p>
                    </div>

                    {/* 2. Select Restrictions */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">2. Select Restrictions to Modify</label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className={`flex items-center space-x-2 p-2 rounded border ${restrictions.deposit ? 'bg-blue-50 border-blue-500' : 'border-gray-300 dark:border-gray-700'}`}>
                                <input type="checkbox" checked={restrictions.deposit} onChange={() => handleToggleRestriction('deposit')} />
                                <span className="text-sm">Deposits</span>
                            </label>
                            <label className={`flex items-center space-x-2 p-2 rounded border ${restrictions.withdrawal ? 'bg-blue-50 border-blue-500' : 'border-gray-300 dark:border-gray-700'}`}>
                                <input type="checkbox" checked={restrictions.withdrawal} onChange={() => handleToggleRestriction('withdrawal')} />
                                <span className="text-sm">Withdrawals</span>
                            </label>
                            <label className={`flex items-center space-x-2 p-2 rounded border ${restrictions.transfer ? 'bg-blue-50 border-blue-500' : 'border-gray-300 dark:border-gray-700'}`}>
                                <input type="checkbox" checked={restrictions.transfer} onChange={() => handleToggleRestriction('transfer')} />
                                <span className="text-sm">Transfers</span>
                            </label>
                            <label className={`flex items-center space-x-2 p-2 rounded border ${restrictions.earning ? 'bg-blue-50 border-blue-500' : 'border-gray-300 dark:border-gray-700'}`}>
                                <input type="checkbox" checked={restrictions.earning} onChange={() => handleToggleRestriction('earning')} />
                                <span className="text-sm">Earning (Commission)</span>
                            </label>
                            <label className={`flex items-center space-x-2 p-2 rounded border ${restrictions.dispute ? 'bg-blue-50 border-blue-500' : 'border-gray-300 dark:border-gray-700'}`}>
                                <input type="checkbox" checked={restrictions.dispute} onChange={() => handleToggleRestriction('dispute')} />
                                <span className="text-sm">Disputes</span>
                            </label>
                        </div>
                    </div>

                    {/* 3. Select Action */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">3. Apply Action</label>
                        <div className="flex space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="action" checked={action === 'enable'} onChange={() => setAction('enable')} className="text-red-600" />
                                <span className="text-sm">Block (Enable Restriction)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="action" checked={action === 'disable'} onChange={() => setAction('disable')} className="text-green-600" />
                                <span className="text-sm">Unblock (Disable Restriction)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="action" checked={action === 'toggle'} onChange={() => setAction('toggle')} className="text-gray-600" />
                                <span className="text-sm">Toggle Current State</span>
                            </label>
                        </div>
                        {action === 'disable' && restrictions.earning && (
                            <p className="text-xs text-green-600 mt-2">Note: Unblocking "Earning" will automatically release any commissions that were held due to this restriction.</p>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || affectedUsersCount === 0}>
                            {isSubmitting ? 'Processing...' : 'Apply Bulk Update'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

const MessageUserModal: React.FC<{ user: User | null; allUsers: User[]; investmentPlans: InvestmentPlan[]; onClose: () => void }> = ({ user, allUsers, investmentPlans, onClose }) => {
    const { dispatch } = useData();
    
    const [sendMode, setSendMode] = useState<'single' | 'plan' | 'all' | 'inactive'>(user ? 'single' : 'single');
    
    // Single User State & Inactive User State
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>(user ? [user._id] : []);
    const [userSearch, setUserSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Plan State
    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

    // Inactive State
    const [inactiveMode, setInactiveMode] = useState<'all' | 'specific'>('all');

    // Message State
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isPopup, setIsPopup] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Reset selections when mode changes
    useEffect(() => {
        setSelectedUserIds(user && sendMode === 'single' ? [user._id] : []);
        setSelectedPlanIds([]);
    }, [sendMode, user]);
    
    useEffect(() => {
        setSelectedUserIds([]);
    }, [inactiveMode]);

    const inactiveUsers = useMemo(() => allUsers.filter(u => !u.activePlans || u.activePlans.length === 0), [allUsers]);

    const filteredUsers = useMemo(() => {
        const source = (sendMode === 'inactive' && inactiveMode === 'specific') ? inactiveUsers : allUsers;
        if (!userSearch) return source;
        const term = userSearch.toLowerCase();
        return source.filter(u => 
            u.username.toLowerCase().includes(term) ||
            u.fullName.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
    }, [userSearch, allUsers, inactiveUsers, sendMode, inactiveMode]);

    const handleSelectUser = (u: User) => {
        if (!selectedUserIds.includes(u._id)) {
            setSelectedUserIds([...selectedUserIds, u._id]);
        }
        setIsDropdownOpen(false);
        setUserSearch('');
    }

    const handleRemoveUser = (id: string) => {
        setSelectedUserIds(selectedUserIds.filter(uid => uid !== id));
    }

    const handleTogglePlan = (planId: string) => {
        if (selectedPlanIds.includes(planId)) {
            setSelectedPlanIds(selectedPlanIds.filter(id => id !== planId));
        } else {
            setSelectedPlanIds([...selectedPlanIds, planId]);
        }
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation checks
        if ((sendMode === 'single' || (sendMode === 'inactive' && inactiveMode === 'specific')) && selectedUserIds.length === 0) return alert("Please select at least one user.");
        if (sendMode === 'plan' && selectedPlanIds.length === 0) return alert("Please select at least one plan.");
        if (!message) return alert("Please enter a message.");

        setIsSending(true);
        try {
            let finalTargetType = sendMode;
            let finalTargetIds = sendMode === 'single' ? selectedUserIds : (sendMode === 'plan' ? selectedPlanIds : []);
            
            // If selecting specific inactive users, re-use the 'single' user logic on the backend
            if (sendMode === 'inactive' && inactiveMode === 'specific') {
                finalTargetType = 'single';
                finalTargetIds = selectedUserIds;
            }

            const payload: any = {
                subject,
                message,
                isPopup,
                targetType: finalTargetType,
                targetIds: finalTargetIds
            };
            
            // For 'inactive' 'all' mode, we don't need to send targetIds
            if (sendMode === 'inactive' && inactiveMode === 'all') {
                payload.targetIds = [];
            }

            const result = await sendAdminNotification(payload);
            
            if (result.data) {
                dispatch({ type: 'UPDATE_NOTIFICATIONS', payload: result.data });
            }

            alert(`Messages sent to ${result.count || 0} user(s) successfully!`);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to send message.");
        } finally {
            setIsSending(false);
        }
    }

    const affectedUsersCount = useMemo(() => {
        if (sendMode === 'all') return allUsers.length;
        if (sendMode === 'plan') {
            const uniqueUsers = new Set();
            allUsers.forEach(u => {
                if (u.activePlans && u.activePlans.some(p => selectedPlanIds.includes(p.planId))) {
                    uniqueUsers.add(u._id);
                }
            });
            return uniqueUsers.size;
        }
        if (sendMode === 'inactive') {
            if (inactiveMode === 'all') return inactiveUsers.length;
            if (inactiveMode === 'specific') return selectedUserIds.length;
        }
        if (sendMode === 'single') return selectedUserIds.length;
        return 0;
    }, [sendMode, selectedUserIds, selectedPlanIds, allUsers, inactiveMode, inactiveUsers]);

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-6 w-[90vw] max-w-lg">
                <h3 className="text-xl font-bold mb-4">Send Admin Message</h3>
                <form onSubmit={handleSend} className="space-y-4">
                    
                    {/* Mode Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recipient Type</label>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setSendMode('single')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${sendMode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Specific Users</button>
                            <button type="button" onClick={() => setSendMode('plan')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${sendMode === 'plan' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>By Active Plan</button>
                            <button type="button" onClick={() => setSendMode('inactive')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${sendMode === 'inactive' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>By Inactive Status</button>
                            <button type="button" onClick={() => setSendMode('all')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${sendMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>All Users</button>
                        </div>
                    </div>

                    {/* Target Selection UI */}
                    {(sendMode === 'single' || (sendMode === 'inactive' && inactiveMode === 'specific')) && (
                        <div className="relative" ref={dropdownRef}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Users</label>
                            <div className="flex flex-wrap gap-2 mb-2 mt-1">
                                {selectedUserIds.map(id => {
                                    const u = allUsers.find(au => au._id === id);
                                    if (!u) return null;
                                    return (
                                        <span key={id} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                            {u.username}
                                            <button type="button" onClick={() => handleRemoveUser(id)} className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800">&times;</button>
                                        </span>
                                    )
                                })}
                            </div>

                            <input type="text" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} placeholder="Search user..." className="mt-1 w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"/>
                            {isDropdownOpen && (
                                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-40 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm">
                                    {filteredUsers.length > 0 ? filteredUsers.map(u => (
                                        <div key={u._id} onClick={() => handleSelectUser(u)} className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 dark:hover:bg-gray-600">
                                            <span className="font-medium block">{u.fullName}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">@{u.username}</span>
                                        </div>
                                    )) : <div className="py-2 px-4 text-gray-500">No users found</div>}
                                </div>
                            )}
                        </div>
                    )}
                    {sendMode === 'plan' && (
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-md border dark:border-gray-600 max-h-40 overflow-y-auto">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Plans</label>
                            <div className="space-y-2">{investmentPlans.filter(p => p.status === 'Active').map(plan => (<label key={plan._id} className="flex items-center space-x-2"><input type="checkbox" checked={selectedPlanIds.includes(plan._id)} onChange={() => handleTogglePlan(plan._id)} className="rounded text-blue-600" /><span className="text-sm">{plan.name}</span></label>))}</div>
                        </div>
                    )}
                    {sendMode === 'inactive' && (
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-md border dark:border-gray-600">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Inactive Members (No Plan)</label>
                            <div className="flex items-center space-x-4">
                                <label className="flex items-center space-x-2"><input type="radio" name="inactiveMode" checked={inactiveMode === 'all'} onChange={() => setInactiveMode('all')} /> <span className="text-sm">All Inactive Members</span></label>
                                <label className="flex items-center space-x-2"><input type="radio" name="inactiveMode" checked={inactiveMode === 'specific'} onChange={() => setInactiveMode('specific')} /> <span className="text-sm">Select Specific Members</span></label>
                            </div>
                        </div>
                    )}
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-right">This message will be sent to <strong>{affectedUsersCount}</strong> user(s).</div>

                    <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject (Optional)</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="e.g. Important Update" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="Type your message here..." required /></div>
                    <div className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800"><input type="checkbox" id="isPopup" checked={isPopup} onChange={(e) => setIsPopup(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" /><label htmlFor="isPopup" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 font-medium">Show as Popup on Login<p className="text-xs text-gray-500 font-normal">If checked, this message will appear as a modal when the user visits their dashboard.</p></label></div>
                    <div className="flex justify-end space-x-3 pt-2"><Button type="button" variant="secondary" onClick={onClose} disabled={isSending}>Cancel</Button><Button type="submit" disabled={isSending || affectedUsersCount === 0}>{isSending ? 'Sending...' : `Send to ${affectedUsersCount} Users`}</Button></div>
                </form>
            </div>
        </Modal>
    )
}

const UserRestrictionsModal: React.FC<{ user: User; onClose: () => void; onSave: (restrictions: UserRestrictions) => void; }> = ({ user, onClose, onSave }) => {
    const [restrictions, setRestrictions] = useState<UserRestrictions>({
        deposit: false,
        withdrawal: false,
        transfer: false,
        earning: false,
        dispute: false,
        excludeFromTicker: false,
        ...user.restrictions
    });

    const handleToggle = (key: keyof UserRestrictions) => {
        setRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
    }

    const Toggle = ({ label, checked, onClick }: { label: string, checked: boolean, onClick: () => void }) => (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
            <span className="font-medium text-gray-800 dark:text-gray-200">{label}</span>
            <button 
                type="button"
                onClick={onClick}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-red-600' : 'bg-gray-200'}`}
            >
                <span className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
            </button>
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-6 w-[90vw] max-w-md">
                <h3 className="text-xl font-bold mb-2">Manage Restrictions</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Control specific activities for <strong>{user.username}</strong>. Enabling a restriction will block the user from performing that action.
                </p>
                <div className="space-y-3">
                    <Toggle label="Block Deposits" checked={restrictions.deposit} onClick={() => handleToggle('deposit')} />
                    <Toggle label="Block Withdrawals" checked={restrictions.withdrawal} onClick={() => handleToggle('withdrawal')} />
                    <Toggle label="Block Transfers" checked={restrictions.transfer} onClick={() => handleToggle('transfer')} />
                    <Toggle label="Pause Earnings (Commissions)" checked={restrictions.earning} onClick={() => handleToggle('earning')} />
                    <Toggle label="Block Disputes" checked={restrictions.dispute} onClick={() => handleToggle('dispute')} />
                    <Toggle label="Exclude from Activity Ticker" checked={restrictions.excludeFromTicker || false} onClick={() => handleToggle('excludeFromTicker' as keyof UserRestrictions)} />
                </div>
                <div className="mt-8 flex justify-end space-x-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={() => onSave(restrictions)}>Save Restrictions</Button>
                </div>
            </div>
        </Modal>
    );
}


export default Users;
