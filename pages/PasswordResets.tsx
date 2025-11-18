import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { PasswordResetRequest } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { adminInitiatePasswordReset, deletePasswordResetRequest } from '../services/api';

const PasswordResets: React.FC = () => {
    const { state, dispatch } = useData();
    const { passwordResetRequests } = state;
    
    const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [resetLink, setResetLink] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateLink = async (request: PasswordResetRequest) => {
        setSelectedRequest(request);
        setIsModalOpen(true);
        setIsGenerating(true);
        setResetLink('');
        try {
            const { resetToken } = await adminInitiatePasswordReset(request.userId);
            const link = `${window.location.origin}${window.location.pathname}#/reset-password?token=${resetToken}`;
            setResetLink(link);
        } catch (error) {
            console.error(error);
            alert(`Failed to generate reset link: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Close modal on error to avoid confusion
            handleCloseModal();
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDismiss = async (requestId: string) => {
        if (window.confirm('Are you sure you want to dismiss this request? This should be done after you have sent the link to the user.')) {
            try {
                await deletePasswordResetRequest(requestId);
                dispatch({ type: 'DELETE_PASSWORD_RESET_REQUEST', payload: requestId });
                if (selectedRequest?._id === requestId) {
                    handleCloseModal();
                }
            } catch (error) {
                console.error(error);
                alert(`Failed to dismiss request: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRequest(null);
        setResetLink('');
    };

    const tableHeaders = ['User', 'Email', 'Request Date', 'Actions'];

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Pending Password Reset Requests</h2>
            {passwordResetRequests.length > 0 ? (
                <Table headers={tableHeaders}>
                    {passwordResetRequests.map((request) => (
                        <tr key={request._id} className="text-gray-700 dark:text-gray-400">
                            <td className="px-4 py-3">{request.userName}</td>
                            <td className="px-4 py-3">{request.userEmail}</td>
                            <td className="px-4 py-3 text-sm">{new Date(request.requestDate).toLocaleString()}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                    <Button size="sm" onClick={() => handleGenerateLink(request)}>Generate Link</Button>
                                    <Button size="sm" variant="secondary" onClick={() => handleDismiss(request._id)}>Dismiss</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">No pending requests found.</p>
            )}

            {isModalOpen && selectedRequest && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                    <div className="p-4 w-[90vw] max-w-lg">
                        <h3 className="text-xl font-bold mb-2">Generate Reset Link</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            A secure, single-use password reset link will be generated for <strong>{selectedRequest.userName}</strong>.
                        </p>
                        
                        {isGenerating && <p>Generating link...</p>}
                        
                        {resetLink && (
                            <div className="space-y-3">
                                <p className="text-xs text-yellow-600 dark:text-yellow-400">Please copy this link and send it to the user via a secure channel. This link will expire in 10 minutes.</p>
                                <div className="flex items-center space-x-2">
                                    <input type="text" readOnly value={resetLink} className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-0"/>
                                    <Button size="sm" onClick={() => navigator.clipboard.writeText(resetLink)}>Copy</Button>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                           <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
                           <Button variant="danger" onClick={() => handleDismiss(selectedRequest._id)}>Dismiss Request</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PasswordResets;