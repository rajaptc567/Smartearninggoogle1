import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { PasswordResetRequest } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { adminInitiatePasswordReset, deletePasswordResetRequest } from '../services/api';

const PasswordResets: React.FC = () => {
    const { state, dispatch } = useData();
    const { passwordResetRequests, users } = state;
    
    const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [resetLink, setResetLink] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['email', 'whatsapp']);
    const [customMessage, setCustomMessage] = useState('');

    const handleGenerateLink = async (request: PasswordResetRequest) => {
        setSelectedRequest(request);
        setIsModalOpen(true);
        setIsGenerating(true);
        setResetLink('');
        try {
            const { resetToken } = await adminInitiatePasswordReset(request.userId);
            const link = `${window.location.origin}${window.location.pathname}#/reset-password?token=${resetToken}`;
            setResetLink(link);
            setCustomMessage(`Hello ${request.userName || 'User'},\n\nHere is your secure link to reset your password on SmartEarning. This link is valid for 48 hours:\n\n${link}\n\nRegards,\nSmartEarning Support`);
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

            {isModalOpen && selectedRequest && (() => {
                const targetUser = users?.find(u => u._id === selectedRequest.userId);
                const userEmail = targetUser?.email || selectedRequest.userEmail;
                const userPhone = targetUser?.whatsapp || targetUser?.phone || '';
                return (
                    <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                        <div className="p-4 w-[90vw] max-w-lg">
                            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Generate Reset Link</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                A secure, single-use password reset link will be generated for <strong>{selectedRequest.userName}</strong>.
                            </p>
                            
                            {isGenerating && <p className="text-sm text-gray-500">Generating link...</p>}
                            
                            {resetLink && (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Generated Reset Link</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                readOnly 
                                                value={resetLink} 
                                                className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-0 p-2.5 font-mono"
                                            />
                                            <Button size="sm" onClick={() => { navigator.clipboard.writeText(resetLink); alert('Reset link copied!'); }}>Copy</Button>
                                        </div>
                                    </div>

                                    {/* Dispatch channels selection */}
                                    <div className="space-y-2 border-t dark:border-gray-700 pt-3">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Choose Send Channels (Select Multiple)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 'email', label: 'Email', value: userEmail, placeholder: 'No Email' },
                                                { id: 'whatsapp', label: 'WhatsApp', value: userPhone, placeholder: 'No WhatsApp' },
                                                { id: 'whatsapp_business', label: 'WhatsApp Business', value: userPhone, placeholder: 'No WA Business' }
                                            ].map((ch) => {
                                                const isSelected = selectedChannels.includes(ch.id);
                                                return (
                                                    <button
                                                        key={ch.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedChannels(selectedChannels.filter(c => c !== ch.id));
                                                            } else {
                                                                setSelectedChannels([...selectedChannels, ch.id]);
                                                            }
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                                            isSelected 
                                                                ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400' 
                                                                : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected}
                                                            readOnly
                                                            className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                                                        />
                                                        <span>{ch.label}</span>
                                                        {ch.value ? (
                                                            <span className="opacity-60 text-[10px] font-mono font-medium">({ch.value})</span>
                                                        ) : (
                                                            <span className="text-amber-500 text-[9px] font-medium font-mono">({ch.placeholder})</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Customizable message preview */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Custom Message Template</label>
                                        <textarea
                                            value={customMessage}
                                            onChange={(e) => setCustomMessage(e.target.value)}
                                            rows={4}
                                            className="w-full text-xs p-3 rounded-xl dark:bg-gray-900 border dark:border-gray-600 font-sans leading-relaxed focus:ring-0"
                                            placeholder="Write password reset notification message here..."
                                        />
                                    </div>

                                    {/* Send Actions */}
                                    <div className="space-y-2 border-t dark:border-gray-700 pt-3">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Action Center</label>
                                        <div className="flex flex-col gap-2">
                                            {selectedChannels.includes('email') && (
                                                <a 
                                                    href={`mailto:${userEmail || ''}?subject=${encodeURIComponent('Password Reset Request - SmartEarning')}&body=${encodeURIComponent(customMessage)}`}
                                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md transition-colors text-center"
                                                >
                                                    📬 Send via Email
                                                </a>
                                            )}
                                            {selectedChannels.includes('whatsapp') && (
                                                <a 
                                                    href={`https://api.whatsapp.com/send?phone=${(() => {
                                                        const digits = userPhone.replace(/\D/g, '');
                                                        return digits.startsWith('0') && digits.length === 11 ? '92' + digits.slice(1) : digits;
                                                    })()}&text=${encodeURIComponent(customMessage)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors text-center"
                                                >
                                                    💬 Send via WhatsApp
                                                </a>
                                            )}
                                            {selectedChannels.includes('whatsapp_business') && (
                                                <a 
                                                    href={`https://wa.me/${(() => {
                                                        const digits = userPhone.replace(/\D/g, '');
                                                        return digits.startsWith('0') && digits.length === 11 ? '92' + digits.slice(1) : digits;
                                                    })()}/?text=${encodeURIComponent(customMessage)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors text-center"
                                                >
                                                    💼 Send via WhatsApp Business
                                                </a>
                                            )}
                                            <Button 
                                                type="button" 
                                                variant="secondary"
                                                className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(customMessage);
                                                    alert('Message text copied to clipboard!');
                                                }}
                                            >
                                                📋 Copy Message Text
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-amber-600 font-bold uppercase italic">* Valid for 48 hours.</p>
                                </div>
                            )}
                            
                            <div className="mt-6 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                               <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
                               <Button variant="danger" onClick={() => handleDismiss(selectedRequest._id)}>Dismiss Request</Button>
                            </div>
                        </div>
                    </Modal>
                );
            })()}
        </div>
    );
};

export default PasswordResets;