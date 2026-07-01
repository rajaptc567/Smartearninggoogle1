import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { PasswordResetRequest } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { 
    adminInitiatePasswordReset, 
    deletePasswordResetRequest, 
    sendCustomAdminMessage,
    updatePasswordResetRequest 
} from '../services/api';

const PasswordResets: React.FC = () => {
    const { state, dispatch } = useData();
    const { passwordResetRequests, users } = state;
    
    const [activeTab, setActiveTab] = useState<'pending' | 'handled'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [resetLink, setResetLink] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['email', 'whatsapp']);
    const [customMessage, setCustomMessage] = useState('');
    const [isSendingServer, setIsSendingServer] = useState(false);
    const [serverSendStatus, setServerSendStatus] = useState<string>('');

    // State for viewing full request details
    const [viewingDetailsRequest, setViewingDetailsRequest] = useState<PasswordResetRequest | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Filter requests based on search query and status tab
    const filteredRequests = passwordResetRequests.filter(req => {
        const matchesTab = activeTab === 'pending' ? req.status === 'Pending' : req.status === 'Handled';
        const matchesSearch = 
            req.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            req.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (req.process && req.process.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesTab && matchesSearch;
    });

    const handleSendViaServer = async () => {
        if (!selectedRequest) return;
        const targetUser = users?.find(u => u._id === selectedRequest.userId);
        const userEmail = targetUser?.email || selectedRequest.userEmail;
        const userPhone = targetUser?.whatsapp || targetUser?.phone || '';

        setIsSendingServer(true);
        setServerSendStatus('');
        try {
            await sendCustomAdminMessage({
                toEmail: selectedChannels.includes('email') ? userEmail : undefined,
                toPhone: (selectedChannels.includes('whatsapp') || selectedChannels.includes('whatsapp_business')) ? userPhone : undefined,
                subject: 'Password Reset Request - SmartEarning',
                messageText: customMessage
            });
            
            // Log this action to the backend
            const updated = await updatePasswordResetRequest(selectedRequest._id, {
                status: 'Handled',
                sendType: 'Manual',
                channel: selectedChannels.join(', '),
                sentAt: new Date().toISOString(),
                process: `Admin sent reset link via Server using [${selectedChannels.join(', ')}]`
            });

            dispatch({ type: 'UPDATE_PASSWORD_RESET_REQUEST', payload: updated });
            setSelectedRequest(updated);
            setServerSendStatus('dispatched');
            alert('Password reset message dispatched automatically via server SMTP/WhatsApp.');
        } catch (err: any) {
            setServerSendStatus('failed');
            alert(err.message || 'Failed to dispatch via server.');
        } finally {
            setIsSendingServer(false);
        }
    };

    const handleMarkAsSent = async (channel: string) => {
        if (!selectedRequest) return;
        try {
            const updated = await updatePasswordResetRequest(selectedRequest._id, {
                status: 'Handled',
                sendType: 'Manual',
                channel: channel,
                sentAt: new Date().toISOString(),
                process: `Admin triggered external dispatch link via ${channel}`
            });
            dispatch({ type: 'UPDATE_PASSWORD_RESET_REQUEST', payload: updated });
            setSelectedRequest(updated);
            alert(`Successfully logged manual reset and marked request as Handled via ${channel}!`);
        } catch (error) {
            console.error(error);
            alert(`Failed to update manual send logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

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
            
            // Persist generated link info to database
            const updated = await updatePasswordResetRequest(request._id, {
                resetLink: link,
                resetToken,
                process: 'Admin generated secure reset link; waiting for send/dispatch'
            });
            dispatch({ type: 'UPDATE_PASSWORD_RESET_REQUEST', payload: updated });
            setSelectedRequest(updated);
        } catch (error) {
            console.error(error);
            alert(`Failed to generate reset link: ${error instanceof Error ? error.message : 'Unknown error'}`);
            handleCloseModal();
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpdateStatusManual = async (request: PasswordResetRequest, status: 'Pending' | 'Handled') => {
        const confirmMsg = status === 'Handled' 
            ? 'Mark this request as Handled? This signifies that the user has received their password reset link.'
            : 'Revert this request back to Pending status?';
            
        if (window.confirm(confirmMsg)) {
            try {
                const updated = await updatePasswordResetRequest(request._id, {
                    status,
                    process: status === 'Handled' ? 'Admin manually set status to Handled' : 'Admin reverted status back to Pending'
                });
                dispatch({ type: 'UPDATE_PASSWORD_RESET_REQUEST', payload: updated });
                if (selectedRequest?._id === request._id) {
                    setSelectedRequest(updated);
                }
                if (viewingDetailsRequest?._id === request._id) {
                    setViewingDetailsRequest(updated);
                }
                alert(`Status successfully updated to ${status}.`);
            } catch (error) {
                console.error(error);
                alert(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    const handleDismiss = async (requestId: string) => {
        if (window.confirm('Are you sure you want to permanently delete/dismiss this reset request from the log history? This action is irreversible.')) {
            try {
                await deletePasswordResetRequest(requestId);
                dispatch({ type: 'DELETE_PASSWORD_RESET_REQUEST', payload: requestId });
                if (selectedRequest?._id === requestId) {
                    handleCloseModal();
                }
                if (viewingDetailsRequest?._id === requestId) {
                    setIsDetailsModalOpen(false);
                    setViewingDetailsRequest(null);
                }
            } catch (error) {
                console.error(error);
                alert(`Failed to delete request: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRequest(null);
        setResetLink('');
        setServerSendStatus('');
    };

    const openDetailsModal = (request: PasswordResetRequest) => {
        setViewingDetailsRequest(request);
        setIsDetailsModalOpen(true);
    };

    const handleCloseDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setViewingDetailsRequest(null);
    };

    const tableHeaders = ['User', 'Email', 'Request Date', 'Send Channel', 'Send Type', 'Actions'];

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        🔑 Password Reset Management
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        View, generate, send, and log detailed password reset requests.
                    </p>
                </div>
                
                {/* Search query box */}
                <div className="w-full md:w-72">
                    <input
                        type="text"
                        placeholder="Search by user or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
            </div>

            {/* Redesigned Tab buttons */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`py-2 px-4 font-semibold text-sm border-b-2 transition-all ${
                        activeTab === 'pending'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                    📥 Pending Requests ({passwordResetRequests.filter(r => r.status === 'Pending').length})
                </button>
                <button
                    onClick={() => setActiveTab('handled')}
                    className={`py-2 px-4 font-semibold text-sm border-b-2 transition-all ${
                        activeTab === 'handled'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                    📜 Handled History ({passwordResetRequests.filter(r => r.status === 'Handled').length})
                </button>
            </div>

            {filteredRequests.length > 0 ? (
                <Table headers={tableHeaders}>
                    {filteredRequests.map((request) => (
                        <tr key={request._id} className="text-gray-700 dark:text-gray-400 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{request.userName}</td>
                            <td className="px-4 py-3 text-sm">{request.userEmail}</td>
                            <td className="px-4 py-3 text-sm font-mono">
                                {new Date(request.requestDate).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                                {request.channel && request.channel !== 'None' ? (
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                                        {request.channel}
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-400 font-mono italic">Not sent yet</span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                {request.sendType === 'Automatic' ? (
                                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        🤖 Automatic
                                    </span>
                                ) : request.sendType === 'Manual' ? (
                                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                        👨‍💻 Manual
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-400 font-mono">--</span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button 
                                        onClick={() => openDetailsModal(request)}
                                        className="px-2 py-1 text-xs font-bold rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 border dark:border-gray-600 transition-colors"
                                    >
                                        🔍 Details
                                    </button>
                                    
                                    {request.status === 'Pending' ? (
                                        <>
                                            <Button size="sm" onClick={() => handleGenerateLink(request)}>
                                                ⚙️ Reset & Send
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleUpdateStatusManual(request, 'Handled')}>
                                                ✓ Mark Handled
                                            </Button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={() => handleUpdateStatusManual(request, 'Pending')}
                                            className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors"
                                        >
                                            ↩ Revert Pending
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={() => handleDismiss(request._id)}
                                        className="px-2 py-1 text-xs font-bold rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors"
                                    >
                                        🗑 Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/40 border border-dashed rounded-xl border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">No requests found matching current filters.</p>
                </div>
            )}

            {/* COMPREHENSIVE VIEW DETAILS MODAL */}
            {isDetailsModalOpen && viewingDetailsRequest && (() => {
                const req = viewingDetailsRequest;
                const targetUser = users?.find(u => u._id === req.userId);
                return (
                    <Modal isOpen={isDetailsModalOpen} onClose={handleCloseDetailsModal}>
                        <div className="p-5 w-[90vw] max-w-xl text-gray-800 dark:text-gray-200">
                            <div className="border-b dark:border-gray-700 pb-3 mb-4 flex justify-between items-center">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    📋 Password Reset Process Details
                                </h3>
                                <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
                                    req.status === 'Pending' 
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                }`}>
                                    {req.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Section 1: User Request Details */}
                                <div className="space-y-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-800">
                                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">User Profile</h4>
                                    <div className="text-sm space-y-1.5">
                                        <p><span className="text-gray-500 dark:text-gray-400">Username:</span> <strong>{req.userName}</strong></p>
                                        <p><span className="text-gray-500 dark:text-gray-400">Email Address:</span> <span className="font-mono text-xs">{req.userEmail}</span></p>
                                        {targetUser && (
                                            <>
                                                <p><span className="text-gray-500 dark:text-gray-400">Phone/WhatsApp:</span> <span className="font-mono text-xs">{targetUser.whatsapp || targetUser.phone || 'N/A'}</span></p>
                                                <p><span className="text-gray-500 dark:text-gray-400">Country:</span> <span>{targetUser.country || 'N/A'}</span></p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Section 2: Process Information */}
                                <div className="space-y-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-800">
                                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Process Details</h4>
                                    <div className="text-sm space-y-1.5">
                                        <p><span className="text-gray-500 dark:text-gray-400">Send Type:</span> <strong className="capitalize">{req.sendType || 'None'}</strong></p>
                                        <p><span className="text-gray-500 dark:text-gray-400">Channel:</span> <strong>{req.channel || 'None'}</strong></p>
                                        <p><span className="text-gray-500 dark:text-gray-400">Status:</span> <strong className="capitalize">{req.status}</strong></p>
                                    </div>
                                </div>
                            </div>

                            {/* Process logs */}
                            <div className="mt-4 space-y-2 bg-blue-50/50 dark:bg-blue-900/10 p-3.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <h4 className="text-xs font-bold uppercase text-blue-700 dark:text-blue-400 tracking-wider">Active Process Log Description</h4>
                                <p className="text-sm italic font-medium">"{req.process || 'No logs recorded.'}"</p>
                            </div>

                            {/* Chronology & Times */}
                            <div className="mt-4 space-y-3">
                                <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Full Chronological Timeline</h4>
                                <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-4 space-y-3 text-xs">
                                    <div>
                                        <p className="font-semibold text-gray-700 dark:text-gray-300">📅 User Reset Requested Time</p>
                                        <p className="text-gray-500 font-mono">{new Date(req.requestDate).toLocaleString()}</p>
                                    </div>
                                    {req.sentAt && (
                                        <div>
                                            <p className="font-semibold text-gray-700 dark:text-gray-300">🚀 Dispatch / Sent Out Time</p>
                                            <p className="text-gray-500 font-mono">{new Date(req.sentAt).toLocaleString()}</p>
                                        </div>
                                    )}
                                    {req.handledAt && (
                                        <div>
                                            <p className="font-semibold text-gray-700 dark:text-gray-300">✓ Completed & Handled Time</p>
                                            <p className="text-gray-500 font-mono">{new Date(req.handledAt).toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Secure Reset link details */}
                            {req.resetLink && (
                                <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border dark:border-gray-800 space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Generated Security Password Link</p>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={req.resetLink} 
                                            className="w-full text-xs font-mono p-1.5 rounded dark:bg-gray-800 border dark:border-gray-700"
                                        />
                                        <Button size="sm" onClick={() => { navigator.clipboard.writeText(req.resetLink || ''); alert('Copied reset link!'); }}>Copy</Button>
                                    </div>
                                </div>
                            )}

                            {/* Modal actions */}
                            <div className="mt-6 pt-4 border-t dark:border-gray-700 flex justify-end gap-2.5">
                                <Button variant="secondary" onClick={handleCloseDetailsModal}>Close Details</Button>
                                {req.status === 'Pending' && (
                                    <Button variant="primary" onClick={() => { handleCloseDetailsModal(); handleGenerateLink(req); }}>
                                        ⚙️ Reset & Send Now
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Modal>
                );
            })()}

            {/* SEND RESET LINK MODAL */}
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
                            
                            {isGenerating && <p className="text-sm text-gray-500 animate-pulse">Generating secure link...</p>}
                            
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
                                                            className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5 pointer-events-none"
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
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Action Center (Opens send channels and updates status logs)</label>
                                        <div className="flex flex-col gap-2">
                                            <Button
                                                type="button"
                                                variant="primary"
                                                onClick={handleSendViaServer}
                                                disabled={isSendingServer}
                                                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center justify-center gap-2"
                                            >
                                                {isSendingServer ? '⏳ Dispatches in Progress...' : '🚀 Dispatch Automatically via Server'}
                                            </Button>
                                            
                                            {serverSendStatus === 'dispatched' && (
                                                <p className="text-[10px] text-green-600 font-bold text-center uppercase tracking-wider">
                                                    ✓ Dispatched successfully via SMTP/Ultramsg and logged status!
                                                </p>
                                            )}

                                            {selectedChannels.includes('email') && (
                                                <a 
                                                    href={`mailto:${userEmail || ''}?subject=${encodeURIComponent('Password Reset Request - SmartEarning')}&body=${encodeURIComponent(customMessage)}`}
                                                    onClick={() => handleMarkAsSent('Email')}
                                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md transition-colors text-center"
                                                >
                                                    📬 Send & Mark via Email Client
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
                                                    onClick={() => handleMarkAsSent('WhatsApp')}
                                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors text-center"
                                                >
                                                    💬 Send & Mark via WhatsApp Web
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
                                                    onClick={() => handleMarkAsSent('WhatsApp Business')}
                                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors text-center"
                                                >
                                                    💼 Send & Mark via WhatsApp Business
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
                               <Button variant="danger" onClick={() => handleDismiss(selectedRequest._id)}>Delete Request</Button>
                            </div>
                        </div>
                    </Modal>
                );
            })()}
        </div>
    );
};

export default PasswordResets;
