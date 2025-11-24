
import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Dispute, Status } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { updateDispute, updateDeposit } from '../services/api';

const AdminDisputes: React.FC = () => {
    const { state, dispatch } = useData();
    const { disputes, deposits, withdrawals, transfers } = state;

    const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [adminResponse, setAdminResponse] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleView = (dispute: Dispute) => {
        setSelectedDispute(dispute);
        setAdminResponse(dispute.adminResponse || '');
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setSelectedDispute(null);
    };

    // Find the actual transaction object related to this dispute
    const linkedTransaction = useMemo(() => {
        if (!selectedDispute) return null;
        const id = selectedDispute.referenceId;
        if (selectedDispute.type === 'Deposit') return deposits.find(d => d._id === id);
        if (selectedDispute.type === 'Withdrawal') return withdrawals.find(w => w._id === id);
        if (selectedDispute.type === 'Transfer') return transfers.find(t => t._id === id);
        return null;
    }, [selectedDispute, deposits, withdrawals, transfers]);

    const handleResolve = async (status: 'Resolved' | 'Closed') => {
        if (!selectedDispute) return;
        setIsSubmitting(true);
        try {
            const updatedDispute = await updateDispute(selectedDispute._id, { status, adminResponse });
            dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
            handleClose();
        } catch (error) {
            console.error("Failed to update dispute", error);
            alert("Failed to update dispute status");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleForceApproveDeposit = async () => {
        if (!linkedTransaction || selectedDispute?.type !== 'Deposit') return;
        if (!window.confirm("Are you sure you want to FORCE APPROVE this deposit? This will add funds to the user.")) return;
        
        setIsSubmitting(true);
        try {
            const result = await updateDeposit(linkedTransaction._id, { 
                status: Status.Approved, 
                adminNotes: `Auto-Approved via Dispute #${selectedDispute._id}` 
            });
            dispatch({ type: 'UPDATE_DEPOSIT', payload: result.deposit });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            
            // Also resolve the dispute automatically
            const updatedDispute = await updateDispute(selectedDispute._id, { 
                status: Status.Resolved, 
                adminResponse: 'Deposit has been approved based on provided proof.' 
            });
            dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
            
            handleClose();
            alert("Deposit Approved and Dispute Resolved.");
        } catch (error) {
            console.error("Failed to approve deposit:", error);
            alert("Failed to approve deposit.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Manage Disputes</h2>
            {disputes.length > 0 ? (
                <Table headers={['ID', 'User', 'Type', 'Ref ID', 'Date', 'Status', 'Action']}>
                    {disputes.map(dispute => (
                        <tr key={dispute._id} className="text-gray-700 dark:text-gray-400">
                            <td className="px-4 py-3 text-xs font-mono">{dispute._id}</td>
                            <td className="px-4 py-3">{dispute.userName}</td>
                            <td className="px-4 py-3">{dispute.type}</td>
                            <td className="px-4 py-3 text-xs font-mono">{dispute.referenceId}</td>
                            <td className="px-4 py-3 text-sm">{new Date(dispute.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3"><Badge status={dispute.status as Status} /></td>
                            <td className="px-4 py-3">
                                <Button size="sm" onClick={() => handleView(dispute)}>View</Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : (
                <p className="text-gray-500 text-center py-4">No disputes found.</p>
            )}

            {isModalOpen && selectedDispute && (
                <Modal isOpen={isModalOpen} onClose={handleClose}>
                    <div className="p-4 w-[90vw] max-w-3xl">
                        <h3 className="text-xl font-bold mb-4">Dispute Details</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-2 text-sm">
                                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-1 mb-2">Dispute Info</h4>
                                <div><strong>User:</strong> {selectedDispute.userName}</div>
                                <div><strong>Type:</strong> {selectedDispute.type}</div>
                                <div><strong>Reference ID:</strong> <span className="font-mono text-xs">{selectedDispute.referenceId}</span></div>
                                <div><strong>Status:</strong> <Badge status={selectedDispute.status as Status} /></div>
                                <div className="mt-2">
                                    <strong>User Description:</strong>
                                    <p className="p-2 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600 mt-1 text-gray-600 dark:text-gray-300">
                                        {selectedDispute.description}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm">
                                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-1 mb-2">Linked Transaction</h4>
                                {linkedTransaction ? (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><strong>Amount:</strong> ${linkedTransaction.amount.toFixed(2)}</div>
                                            <div><strong>Date:</strong> {new Date(linkedTransaction.date).toLocaleDateString()}</div>
                                            <div><strong>Current Status:</strong> <Badge status={linkedTransaction.status as Status} /></div>
                                            {selectedDispute.type === 'Deposit' && (
                                                <div><strong>Method:</strong> {(linkedTransaction as any).method}</div>
                                            )}
                                            {selectedDispute.type === 'Withdrawal' && (
                                                <div><strong>Method:</strong> {(linkedTransaction as any).method}</div>
                                            )}
                                        </div>
                                        
                                        {/* QUICK ACTIONS */}
                                        {selectedDispute.status === 'Open' && selectedDispute.type === 'Deposit' && linkedTransaction.status !== 'Approved' && (
                                            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 text-center">
                                                <Button size="sm" variant="success" onClick={handleForceApproveDeposit} disabled={isSubmitting}>
                                                    Force Approve Deposit
                                                </Button>
                                                <p className="text-xs text-gray-500 mt-1">Approves funds & resolves dispute.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-red-500 italic">Original transaction not found. It may have been deleted.</p>
                                )}
                            </div>
                        </div>

                        {selectedDispute.proofUrl && (
                            <div className="mb-6">
                                <h4 className="font-semibold mb-2">New Proof Provided:</h4>
                                <img src={selectedDispute.proofUrl} alt="Proof" className="max-w-full max-h-64 object-contain rounded border shadow-sm bg-gray-100" />
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block font-semibold mb-1">Admin Response:</label>
                            <textarea 
                                className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500" 
                                rows={3}
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                placeholder="Enter your reply to the user..."
                                disabled={selectedDispute.status !== 'Open'}
                            />
                        </div>

                        {selectedDispute.status === 'Open' && (
                            <div className="flex justify-end space-x-3 border-t pt-4 dark:border-gray-700">
                                <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                                <Button variant="danger" onClick={() => handleResolve('Closed')} disabled={isSubmitting}>Reject/Close</Button>
                                <Button variant="primary" onClick={() => handleResolve('Resolved')} disabled={isSubmitting}>Resolve & Reply</Button>
                            </div>
                        )}
                        {selectedDispute.status !== 'Open' && (
                             <div className="flex justify-end border-t pt-4 dark:border-gray-700">
                                <Button variant="secondary" onClick={handleClose}>Close</Button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminDisputes;
