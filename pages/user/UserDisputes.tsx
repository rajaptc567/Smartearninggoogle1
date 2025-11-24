
import React, { useState, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import { Dispute, Status } from '../../types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { createDispute } from '../../services/api';

const UserDisputes: React.FC = () => {
    const { state, dispatch } = useData();
    const { disputes, currentUser, deposits, withdrawals, transfers } = state;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [type, setType] = useState<'Deposit' | 'Withdrawal' | 'Transfer'>('Deposit');
    const [referenceId, setReferenceId] = useState('');
    const [description, setDescription] = useState('');
    const [proof, setProof] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [useManualId, setUseManualId] = useState(false);

    if (!currentUser) return <div>Loading...</div>;

    const userDisputes = disputes.filter(d => d.userId === currentUser._id);

    // Filter relevant transactions for the dropdown
    const availableTransactions = useMemo(() => {
        if (type === 'Deposit') {
            return deposits
                .filter(d => d.userId === currentUser._id && (d.status === 'Rejected' || d.status === 'Pending'))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(d => ({
                    id: d._id,
                    label: `${new Date(d.date).toLocaleDateString()} - Deposit $${d.amount} (${d.status})`
                }));
        }
        if (type === 'Withdrawal') {
            return withdrawals
                .filter(w => w.userId === currentUser._id && (w.status === 'Rejected' || w.status === 'Paid' || w.status === 'Approved'))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(w => ({
                    id: w._id,
                    label: `${new Date(w.date).toLocaleDateString()} - Withdraw $${w.amount} (${w.status})`
                }));
        }
        if (type === 'Transfer') {
            return transfers
                .filter(t => t.senderId === currentUser._id && t.status === 'Rejected')
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(t => ({
                    id: t._id,
                    label: `${new Date(t.date).toLocaleDateString()} - Transfer $${t.amount} to ${t.recipientName} (${t.status})`
                }));
        }
        return [];
    }, [type, deposits, withdrawals, transfers, currentUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!referenceId || !description) return alert("Please fill all fields");
        
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('userId', currentUser._id);
        formData.append('userName', currentUser.username);
        formData.append('type', type);
        formData.append('referenceId', referenceId);
        formData.append('description', description);
        if (proof) formData.append('proof', proof);

        try {
            const newDispute = await createDispute(formData);
            dispatch({ type: 'ADD_DISPUTE', payload: newDispute });
            setIsModalOpen(false);
            // Reset form
            setReferenceId('');
            setDescription('');
            setProof(null);
            setUseManualId(false);
            alert("Dispute submitted successfully.");
        } catch (error) {
            console.error("Failed to submit dispute", error);
            alert("Failed to submit dispute");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">My Disputes</h2>
                <Button onClick={() => setIsModalOpen(true)}>Raise Dispute</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                {userDisputes.length > 0 ? (
                    <Table headers={['Date', 'Type', 'Ref ID', 'Status', 'Admin Response']}>
                        {userDisputes.map(dispute => (
                            <tr key={dispute._id} className="text-gray-700 dark:text-gray-400">
                                <td className="px-4 py-3 text-sm">{new Date(dispute.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm">{dispute.type}</td>
                                <td className="px-4 py-3 text-xs font-mono">{dispute.referenceId}</td>
                                <td className="px-4 py-3"><Badge status={dispute.status as Status} /></td>
                                <td className="px-4 py-3 text-sm max-w-xs truncate" title={dispute.adminResponse}>{dispute.adminResponse || '-'}</td>
                            </tr>
                        ))}
                    </Table>
                ) : (
                    <p className="text-gray-500 text-center py-8">No disputes found.</p>
                )}
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                    <div className="p-4 w-[90vw] max-w-lg">
                        <h3 className="text-xl font-bold mb-4">Raise a Dispute</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Transaction Type</label>
                                <select 
                                    value={type} 
                                    onChange={(e) => { setType(e.target.value as any); setReferenceId(''); }}
                                    className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="Deposit">Deposit</option>
                                    <option value="Withdrawal">Withdrawal</option>
                                    <option value="Transfer">Transfer</option>
                                </select>
                            </div>
                            
                            <div>
                                <div className="flex justify-between">
                                    <label className="block text-sm font-medium">Transaction Reference</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setUseManualId(!useManualId)} 
                                        className="text-xs text-blue-500 hover:underline"
                                    >
                                        {useManualId ? 'Select from list' : 'Enter ID Manually'}
                                    </button>
                                </div>
                                
                                {useManualId ? (
                                    <input 
                                        type="text" 
                                        value={referenceId} 
                                        onChange={(e) => setReferenceId(e.target.value)}
                                        placeholder="Enter ID of the transaction"
                                        className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 mt-1"
                                        required
                                    />
                                ) : (
                                    <select 
                                        value={referenceId} 
                                        onChange={(e) => setReferenceId(e.target.value)}
                                        className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 mt-1"
                                        required
                                    >
                                        <option value="">-- Select a failed transaction --</option>
                                        {availableTransactions.length > 0 ? (
                                            availableTransactions.map(tx => (
                                                <option key={tx.id} value={tx.id}>{tx.label}</option>
                                            ))
                                        ) : (
                                            <option disabled>No recent failed transactions found</option>
                                        )}
                                    </select>
                                )}
                                {!useManualId && availableTransactions.length === 0 && (
                                    <p className="text-xs text-yellow-600 mt-1">Can't find your transaction? Switch to "Enter ID Manually".</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium">Upload Proof (Screenshot)</label>
                                <input 
                                    type="file" 
                                    onChange={(e) => setProof(e.target.files ? e.target.files[0] : null)}
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Description</label>
                                <textarea 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Explain the issue in detail..."
                                    className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                                    required
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Dispute'}</Button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default UserDisputes;
