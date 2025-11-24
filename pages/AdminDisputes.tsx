
import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { Dispute, Status } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { updateDispute } from '../services/api';

const AdminDisputes: React.FC = () => {
    const { state, dispatch } = useData();
    const { disputes } = state;

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
                    <div className="p-4 w-[90vw] max-w-2xl">
                        <h3 className="text-xl font-bold mb-4">Dispute Details</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                            <div><strong>User:</strong> {selectedDispute.userName}</div>
                            <div><strong>Type:</strong> {selectedDispute.type}</div>
                            <div><strong>Reference ID:</strong> {selectedDispute.referenceId}</div>
                            <div><strong>Status:</strong> <Badge status={selectedDispute.status as Status} /></div>
                        </div>

                        <div className="mb-4">
                            <h4 className="font-semibold">User Description:</h4>
                            <p className="p-2 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600 mt-1 text-sm">
                                {selectedDispute.description}
                            </p>
                        </div>

                        {selectedDispute.proofUrl && (
                            <div className="mb-4">
                                <h4 className="font-semibold mb-2">Proof Provided:</h4>
                                <img src={selectedDispute.proofUrl} alt="Proof" className="max-w-full max-h-64 object-contain rounded border" />
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block font-semibold mb-1">Admin Response:</label>
                            <textarea 
                                className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600" 
                                rows={3}
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                disabled={selectedDispute.status !== 'Open'}
                            />
                        </div>

                        {selectedDispute.status === 'Open' && (
                            <div className="flex justify-end space-x-3 border-t pt-4">
                                <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                                <Button variant="danger" onClick={() => handleResolve('Closed')} disabled={isSubmitting}>Reject/Close</Button>
                                <Button variant="success" onClick={() => handleResolve('Resolved')} disabled={isSubmitting}>Resolve & Accept</Button>
                            </div>
                        )}
                        {selectedDispute.status !== 'Open' && (
                             <div className="flex justify-end border-t pt-4">
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
