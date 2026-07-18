import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../hooks/useData';
import { Dispute, Status, User } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { updateDispute, updateDeposit, markDisputeAsRead, resolveDispute } from '../services/api';

const AdminDisputes: React.FC = () => {
    const { state, dispatch } = useData();
    const { disputes, deposits, withdrawals, transfers, users, userTaskSubmissions, userTasks } = state;

    const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [replyMessage, setReplyMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    
    // Selection State
    const [selectedDisputeIds, setSelectedDisputeIds] = useState<string[]>([]);

    const handleView = async (dispute: Dispute) => {
        setSelectedDispute(dispute);
        setReplyMessage('');
        setIsModalOpen(true);

        // If it's unread for the admin, mark it as read
        if (dispute.adminUnread) {
            try {
                const updatedDispute = await markDisputeAsRead(dispute._id, 'admin');
                dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
                setSelectedDispute(updatedDispute); // Show the updated state in the modal
            } catch (error) {
                console.error("Failed to mark dispute as read:", error);
            }
        }
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setSelectedDispute(null);
    };

    // Scroll to bottom of chat
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [selectedDispute, selectedDispute?.messages]);

    // Filter Logic
    const filteredDisputes = useMemo(() => disputes.filter(d => {
        const matchesSearch = 
            d._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.referenceId.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter ? d.status === statusFilter : true;

        return matchesSearch && matchesStatus;
    }), [disputes, searchTerm, statusFilter]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, itemsPerPage]);

    // Pagination Calculation
    const totalItems = filteredDisputes.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedDisputes = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredDisputes.slice(start, start + itemsPerPage);
    }, [filteredDisputes, currentPage, itemsPerPage]);

    // Selection Logic
    const handleToggleSelect = (id: string) => {
        setSelectedDisputeIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return Array.from(newSet);
        });
    };

    const areAllVisibleSelected = useMemo(() => {
        return paginatedDisputes.length > 0 && paginatedDisputes.every(d => selectedDisputeIds.includes(d._id));
    }, [paginatedDisputes, selectedDisputeIds]);

    const handleSelectAllVisible = () => {
        if (areAllVisibleSelected) {
            setSelectedDisputeIds(prev => prev.filter(id => !paginatedDisputes.some(d => d._id === id)));
        } else {
            setSelectedDisputeIds(prev => Array.from(new Set([...prev, ...paginatedDisputes.map(d => d._id)])));
        }
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

    const linkedSubmission = useMemo(() => {
        if (!selectedDispute || selectedDispute.type !== 'UserTask') return null;
        const subId = selectedDispute.submissionId || selectedDispute.referenceId;
        return userTaskSubmissions?.find(s => s._id === subId);
    }, [selectedDispute, userTaskSubmissions]);

    const linkedTask = useMemo(() => {
        if (!linkedSubmission) return null;
        return userTasks?.find(t => t._id === linkedSubmission.taskId);
    }, [linkedSubmission, userTasks]);

    const handleSendMessage = async () => {
        if (!selectedDispute || (!replyMessage.trim() && !attachment)) return;
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('newMessage', replyMessage.trim());
        formData.append('sender', 'Admin');
        if (attachment) {
            formData.append('file', attachment);
        }

        try {
            const updatedDispute = await updateDispute(selectedDispute._id, formData);
            dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
            setSelectedDispute(updatedDispute); // Update local state to show new msg
            setReplyMessage('');
            setAttachment(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error("Failed to send message", error);
            alert("Failed to send message");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusChange = async (status: 'Processing' | 'Resolved' | 'Closed' | 'Open') => {
        if (!selectedDispute) return;
        setIsSubmitting(true);
        try {
            const updatedDispute = await updateDispute(selectedDispute._id, { status, sender: 'System' });
            dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
            setSelectedDispute(updatedDispute);
        } catch (error) {
            console.error("Failed to update dispute status", error);
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
            
            const updatedDispute = await updateDispute(selectedDispute._id, { 
                status: Status.Resolved, 
                newMessage: 'Deposit has been approved and funds added to your wallet based on provided proof.',
                sender: 'System'
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
    };

    const handleResolveUserTaskDispute = async (verdict: 'ReleaseToWorker' | 'RefundToCreator' | 'SplitPayout') => {
        if (!selectedDispute) return;
        const confirmMsg = `Are you sure you want to resolve this dispute with verdict: ${verdict}? This action will permanently update balances.`;
        if (!window.confirm(confirmMsg)) return;

        const note = window.prompt(`Enter resolution notes for this ${verdict} verdict (optional):`) || `Verdict: ${verdict}`;
        setIsSubmitting(true);
        try {
            const updatedDispute = await resolveDispute(selectedDispute._id, {
                verdict,
                adminNotes: note,
                splitPercentageWorker: verdict === 'SplitPayout' ? 50 : undefined
            });
            dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
            
            if (linkedSubmission) {
                const subStatus = verdict === 'RefundToCreator' ? 'Rejected' : 'Paid';
                dispatch({
                    type: 'UPDATE_USER_TASK_SUBMISSION',
                    payload: {
                        ...linkedSubmission,
                        status: subStatus
                    }
                });
            }
            
            setSelectedDispute(updatedDispute);
            alert(`Dispute resolved successfully with verdict: ${verdict}`);
        } catch (error) {
            console.error("Failed to resolve dispute:", error);
            alert("Failed to resolve dispute: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // DOWNLOAD LOGIC
    const handleDownload = (idsToDownload: string[]) => {
        const disputesToExport = disputes.filter(d => idsToDownload.includes(d._id));
        if (disputesToExport.length === 0) return;

        const csvEscape = (field: any): string => {
            const str = String(field ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return `"${str}"`;
        };
        
        const headers = ['Dispute ID', 'User Name', 'User Email', 'Type', 'Reference ID', 'Status', 'Date Opened', 'User Description', 'Initial Proof URL', 'Full Chat History'];
        
        const rows = disputesToExport.map(d => {
            const user = users.find(u => u._id === d.userId);
            const chatHistory = (d.messages || [])
                .map(msg => `[${new Date(msg.date).toLocaleString()} | ${msg.sender}]: ${msg.message || ''} ${msg.attachmentUrl ? `(Attachment: ${msg.attachmentUrl})` : ''}`)
                .join('\n'); // Newline separator for chat history

            return [
                csvEscape(d._id),
                csvEscape(d.userName),
                csvEscape(user?.email || 'N/A'),
                csvEscape(d.type),
                csvEscape(d.referenceId),
                csvEscape(d.status),
                csvEscape(new Date(d.date).toLocaleString()),
                csvEscape(d.description),
                csvEscape(d.proofUrl),
                csvEscape(chatHistory)
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Disputes_Export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Manage Disputes</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                    <div className="flex items-center gap-2 mr-2">
                        <label className="text-xs font-bold uppercase text-gray-400 whitespace-nowrap">Show:</label>
                        <select 
                            value={itemsPerPage} 
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm py-1 shadow-sm focus:ring-blue-500"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                    >
                        <option value="">All Status</option>
                        <option value={Status.Open}>Open</option>
                        <option value={Status.Processing}>Processing</option>
                        <option value={Status.Resolved}>Resolved</option>
                        <option value={Status.Closed}>Closed</option>
                    </select>
                    <input 
                        type="text" 
                        placeholder="Search ID, User, Ref..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                    />
                </div>
            </div>
            
             {selectedDisputeIds.length > 0 && (
                <div className="p-2 mb-4 border dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center rounded-md">
                    <span className="text-sm font-semibold px-2">{selectedDisputeIds.length} selected</span>
                    <div className="space-x-2">
                        <Button size="sm" variant="secondary" onClick={() => handleDownload(selectedDisputeIds)}>Download Selected</Button>
                    </div>
                </div>
            )}
            
            <div className="space-y-4">
                {paginatedDisputes.length > 0 ? (
                    <>
                        <Table headers={['', 'User', 'Type', 'Ref ID', 'Date', 'Status', 'Action']}>
                            {paginatedDisputes.map(dispute => (
                                <tr key={dispute._id} className="text-gray-700 dark:text-gray-400">
                                    <td className="px-4 py-3">
                                        <input type="checkbox" className="rounded" checked={selectedDisputeIds.includes(dispute._id)} onChange={() => handleToggleSelect(dispute._id)} />
                                    </td>
                                    <td className="px-4 py-3">{dispute.userName}</td>
                                    <td className="px-4 py-3">{dispute.type}</td>
                                    <td className="px-4 py-3 text-xs font-mono">{dispute.referenceId}</td>
                                    <td className="px-4 py-3 text-sm">{new Date(dispute.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center space-x-2">
                                            <Badge status={dispute.status as Status} />
                                            {dispute.adminUnread && <span className="px-2 py-0.5 text-xs font-bold text-white bg-blue-500 rounded-full">New Reply</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Button size="sm" onClick={() => handleView(dispute)}>View</Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>

                        {/* Pagination Footer */}
                        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 border-t dark:border-gray-700 pt-4">
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Showing <span className="font-bold text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalItems}</span> disputes
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="rounded-xl px-4"
                                >
                                    &larr; Prev
                                </Button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = i + 1;
                                        if (totalPages > 5 && currentPage > 3) {
                                            pageNum = currentPage - 3 + i + 1;
                                            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                        }
                                        if (pageNum <= 0) return null;
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                                    currentPage === pageNum 
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="rounded-xl px-4"
                                >
                                    Next &rarr;
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500 text-center py-4">No disputes found.</p>
                )}
            </div>

            {isModalOpen && selectedDispute && (
                <Modal isOpen={isModalOpen} onClose={handleClose}>
                    <div className="p-2 w-[95vw] max-w-5xl h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2">
                            <div>
                                <h3 className="text-xl font-bold">Dispute #{selectedDispute._id}</h3>
                                <span className="text-sm text-gray-500">{selectedDispute.userName} | {selectedDispute.type}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Badge status={selectedDispute.status as Status} />
                                <Button variant="secondary" size="sm" onClick={() => handleDownload([selectedDispute._id])}>Download Dossier</Button>
                                <Button variant="secondary" size="sm" onClick={handleClose}>Close</Button>
                            </div>
                        </div>
                        
                        <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden">
                            {/* LEFT COLUMN: DETAILS & CONTEXT */}
                            <div className="md:w-1/3 overflow-y-auto space-y-4 pr-2 border-r dark:border-gray-700">
                                 {/* UserTask Dispute Dossier */}
                                 {selectedDispute.type === 'UserTask' && (
                                     <div className="space-y-4">
                                         <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl">
                                             <h4 className="font-bold text-xs uppercase text-amber-700 dark:text-amber-400 mb-1">User Task Dispute</h4>
                                             <p className="text-xs text-amber-800 dark:text-amber-300">Escrow funds are frozen. User spot remains booked.</p>
                                         </div>

                                         {linkedTask && (
                                             <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-2xl">
                                                 <h4 className="font-bold text-xs uppercase text-gray-400 mb-2">Campaign Details</h4>
                                                 <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                                                     <p><strong>Title:</strong> {linkedTask.title}</p>
                                                     <p><strong>Category:</strong> {linkedTask.category}</p>
                                                     <p><strong>Reward:</strong> <span className="text-emerald-500 font-bold">+{linkedTask.rewardAmount} USD</span></p>
                                                     <p><strong>Creator ID:</strong> <span className="font-mono text-[10px]">{linkedTask.creatorId}</span></p>
                                                 </div>
                                             </div>
                                         )}

                                         {linkedSubmission && (
                                             <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-800/40">
                                                 <h4 className="font-bold text-xs uppercase text-blue-600 dark:text-blue-300 mb-2">Worker's Proof Submission</h4>
                                                 <div className="text-xs space-y-2 text-gray-700 dark:text-gray-300">
                                                     <p><strong>Worker:</strong> {linkedSubmission.userName} ({linkedSubmission.userEmail || 'N/A'})</p>
                                                     <div>
                                                         <strong>Submitted Proof Text:</strong>
                                                         <p className="mt-1 p-2 bg-white dark:bg-gray-800 rounded-lg border text-[11px] whitespace-pre-wrap">{linkedSubmission.proofText || 'None provided'}</p>
                                                     </div>
                                                     {linkedSubmission.proofImage && (
                                                         <div>
                                                             <strong>Original Screenshot:</strong>
                                                             <a href={linkedSubmission.proofImage} target="_blank" rel="noreferrer" className="block mt-1">
                                                                 <img src={linkedSubmission.proofImage} alt="Original Proof" className="w-full object-cover rounded-lg border max-h-40" />
                                                             </a>
                                                         </div>
                                                     )}
                                                     {linkedSubmission.rejectionReason && (
                                                         <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                                                             <strong>Creator Rejection Reason:</strong>
                                                             <p className="mt-0.5 text-[11px] font-medium">{linkedSubmission.rejectionReason}</p>
                                                         </div>
                                                     )}
                                                 </div>
                                             </div>
                                         )}
                                     </div>
                                 )}

                                 {/* Original Complaint */}
                                 <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                    <h4 className="font-semibold text-xs uppercase text-gray-500 mb-2">Issue Description / Dispute Reason</h4>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                        {selectedDispute.description}
                                    </p>
                                </div>

                                {/* Transaction Details (Only for finance disputes) */}
                                {selectedDispute.type !== 'UserTask' && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <h4 className="font-semibold text-xs uppercase text-blue-600 dark:text-blue-300 mb-2">Linked Transaction</h4>
                                        {linkedTransaction ? (
                                            <div className="text-sm space-y-1">
                                                <div className="flex justify-between"><span>ID:</span> <span className="font-mono text-xs">{linkedTransaction._id}</span></div>
                                                <div className="flex justify-between"><span>Amount:</span> <span className="font-bold">${(linkedTransaction as any).amount.toFixed(2)}</span></div>
                                                <div className="flex justify-between"><span>Date:</span> <span>{new Date(linkedTransaction.date).toLocaleDateString()}</span></div>
                                                <div className="flex justify-between"><span>Status:</span> <Badge status={linkedTransaction.status as Status} /></div>
                                                
                                                {selectedDispute.status !== 'Resolved' && selectedDispute.type === 'Deposit' && linkedTransaction.status !== 'Approved' && (
                                                    <div className="pt-2 mt-2 border-t border-blue-200 dark:border-blue-700 text-center">
                                                        <Button size="sm" variant="success" onClick={handleForceApproveDeposit} disabled={isSubmitting} className="w-full">
                                                            Force Approve Deposit
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-red-500 italic text-xs">Original transaction not found.</p>
                                        )}
                                    </div>
                                )}

                                {/* Proof Screenshot */}
                                {selectedDispute.proofUrl && (
                                    <div className="mb-4">
                                        <h4 className="font-semibold text-xs uppercase text-gray-500 mb-2">Dispute Attached Proof</h4>
                                        <a href={selectedDispute.proofUrl} target="_blank" rel="noreferrer">
                                            <img src={selectedDispute.proofUrl} alt="Dispute Proof" className="w-full object-contain rounded border shadow-sm bg-gray-100 hover:opacity-90 transition-opacity" />
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT COLUMN: CHAT & ACTIONS */}
                            <div className="md:w-2/3 flex flex-col">
                                {/* Messages Area */}
                                <div className="flex-grow bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-y-auto space-y-4 mb-4 border dark:border-gray-700">
                                    {selectedDispute.messages && selectedDispute.messages.length > 0 ? (
                                        selectedDispute.messages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.sender === 'Admin' ? 'justify-end' : msg.sender === 'System' ? 'justify-center' : 'justify-start'}`}>
                                                {msg.sender === 'System' ? (
                                                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                                                        {msg.message} - {new Date(msg.date).toLocaleTimeString()}
                                                    </span>
                                                ) : (
                                                    <div className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
                                                        msg.sender === 'Admin' 
                                                            ? 'bg-blue-600 text-white rounded-br-none' 
                                                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                                                    }`}>
                                                        {msg.attachmentUrl && <img src={msg.attachmentUrl} alt="attachment" className="rounded-md mb-2 max-h-60" />}
                                                        <p className="text-sm">{msg.message}</p>
                                                        <p className={`text-[10px] mt-1 text-right ${msg.sender === 'Admin' ? 'text-blue-100' : 'text-gray-400'}`}>
                                                            {msg.sender} • {new Date(msg.date).toLocaleString()}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-gray-400 text-sm italic">No conversation history yet.</p>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="flex gap-2 mb-4 items-center">
                                    <input 
                                        type="text" 
                                        className="flex-grow rounded-md dark:bg-gray-700 dark:border-gray-600" 
                                        placeholder="Type a reply..." 
                                        value={replyMessage}
                                        onChange={(e) => setReplyMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        disabled={selectedDispute.status === 'Resolved' || selectedDispute.status === 'Closed' || isSubmitting}
                                    />
                                    <input type="file" ref={fileInputRef} onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)} className="hidden"/>
                                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                    </Button>
                                    <Button onClick={handleSendMessage} disabled={isSubmitting || (!replyMessage.trim() && !attachment)}>Send</Button>
                                </div>
                                {attachment && <p className="text-xs text-gray-500 -mt-3 mb-3">Selected file: {attachment.name}</p>}

                                {/* Status Actions */}
                                <div className="flex flex-col gap-3 pt-2 border-t dark:border-gray-700">
                                    {/* UserTask specific verdict buttons */}
                                    {selectedDispute.type === 'UserTask' && selectedDispute.status !== 'Resolved' && selectedDispute.status !== 'Closed' && (
                                        <div className="bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 space-y-2">
                                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block mb-1">Campaign Dispute Verdict Actions:</span>
                                            <div className="flex flex-wrap gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="success" 
                                                    onClick={() => handleResolveUserTaskDispute('ReleaseToWorker')}
                                                    className="font-bold text-xs uppercase bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    Approve & Release to Worker
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="danger" 
                                                    onClick={() => handleResolveUserTaskDispute('RefundToCreator')}
                                                    className="font-bold text-xs uppercase bg-red-600 hover:bg-red-700 text-white"
                                                >
                                                    Reject & Refund to Creator
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary" 
                                                    onClick={() => handleResolveUserTaskDispute('SplitPayout')}
                                                    className="font-bold text-xs uppercase bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                    50/50 Split Payout
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 justify-end">
                                        {selectedDispute.status === 'Open' && (
                                            <Button size="sm" variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200" onClick={() => handleStatusChange('Processing')}>Mark Processing</Button>
                                        )}
                                        {(selectedDispute.status === 'Resolved' || selectedDispute.status === 'Closed') && (
                                            <Button size="sm" variant="secondary" onClick={() => handleStatusChange('Open')}>Reopen Ticket</Button>
                                        )}
                                        {selectedDispute.status !== 'Resolved' && selectedDispute.status !== 'Closed' && (
                                            <>
                                                <Button size="sm" variant="danger" onClick={() => handleStatusChange('Closed')}>Close Ticket</Button>
                                                <Button size="sm" variant="success" onClick={() => handleStatusChange('Resolved')}>Resolve Ticket</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminDisputes;