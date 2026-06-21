
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Dispute, Status, formatCurrency } from '../../types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { createDispute, updateDispute, markDisputeAsRead } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { LoadingCircle } from '../../components/ui/LoadingCircle';

const ShieldExclamationIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const UserDisputes: React.FC = () => {
    const { state, dispatch } = useData();
    const { disputes, currentUser, deposits, withdrawals, transfers } = state;
    const navigate = useNavigate();

    // Creation State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [type, setType] = useState<'Deposit' | 'Withdrawal' | 'Transfer'>('Deposit');
    const [referenceId, setReferenceId] = useState('');
    const [description, setDescription] = useState('');
    const [proof, setProof] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [useManualId, setUseManualId] = useState(false);

    // View State
    const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [selectedDispute, selectedDispute?.messages]);
    
    // When a dispute is selected to be viewed
    const handleViewDispute = async (dispute: Dispute) => {
        setSelectedDispute(dispute);
        // If it's unread for the user, mark it as read
        if (dispute.userUnread) {
            try {
                const updatedDispute = await markDisputeAsRead(dispute._id, 'user');
                dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
                setSelectedDispute(updatedDispute); // Ensure the modal shows the read state
            } catch (error) {
                console.error("Failed to mark as read:", error);
            }
        }
    };


    if (!currentUser) {
        return (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl min-h-[400px]">
                <LoadingCircle text="Opening secure conflict management portal..." />
            </div>
        );
    }

    // --- INSTANT RESTRICTION CHECK ---
    if (currentUser.restrictions?.dispute) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-8 border border-red-200 dark:border-red-800">
                        <ShieldExclamationIcon />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 leading-none">Support Access Blocked</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto leading-relaxed font-medium">
                        Your account's ability to raise new formal disputes has been temporarily suspended by the compliance department.
                    </p>
                    
                    <div className="w-full p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 mb-8">
                        <div className="flex items-center gap-4 text-left">
                            <span className="text-2xl">🚨</span>
                            <div>
                                <p className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">Compliance Review Active</p>
                                <p className="text-xs text-gray-500 font-medium">Please await resolution of existing tickets or contact your administrator directly via external channels if applicable.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 px-12 font-black uppercase tracking-widest text-xs">Return to Hub</Button>
                    </div>
                </div>
            </div>
        );
    }

    const userDisputes = disputes.filter(d => d.userId === currentUser._id);

    const availableTransactions = useMemo(() => {
        if (type === 'Deposit') return deposits.filter(d => d.userId === currentUser._id && (d.status === 'Rejected' || d.status === 'Pending')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => ({ id: d._id, label: `${new Date(d.date).toLocaleDateString()} - Deposit ${formatCurrency(d.amount, d.currency)} (${d.status})` }));
        if (type === 'Withdrawal') return withdrawals.filter(w => w.userId === currentUser._id && (w.status === 'Rejected' || w.status === 'Pending')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(w => ({ id: w._id, label: `${new Date(w.date).toLocaleDateString()} - Withdraw ${formatCurrency(w.amount, w.currency)} (${w.status})` }));
        if (type === 'Transfer') return transfers.filter(t => t.senderId === currentUser._id && t.status === 'Rejected').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => ({ id: t._id, label: `${new Date(t.date).toLocaleDateString()} - Transfer ${formatCurrency(t.amount, t.currency)} to ${t.recipientName} (${t.status})` }));
        return [];
    }, [type, deposits, withdrawals, transfers, currentUser]);

    const linkedTransaction = useMemo(() => {
        if (!selectedDispute) return null;
        const id = selectedDispute.referenceId;
        if (selectedDispute.type === 'Deposit') return deposits.find(d => d._id === id);
        if (selectedDispute.type === 'Withdrawal') return withdrawals.find(w => w._id === id);
        if (selectedDispute.type === 'Transfer') return transfers.find(t => t._id === id);
        return null;
    }, [selectedDispute, deposits, withdrawals, transfers]);

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
            setIsCreateModalOpen(false);
            setReferenceId(''); setDescription(''); setProof(null); setUseManualId(false);
            alert("Dispute submitted successfully.");
        } catch (error) {
            console.error("Failed to submit dispute", error);
            alert(`Failed to submit dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendMessage = async () => {
        if (!selectedDispute || (!replyMessage.trim() && !attachment)) return;
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('newMessage', replyMessage.trim());
        formData.append('sender', 'User');
        if (attachment) {
            formData.append('file', attachment);
        }

        try {
            const updatedDispute = await updateDispute(selectedDispute._id, formData);
            dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
            setSelectedDispute(updatedDispute);
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">My Disputes</h2>
                <Button onClick={() => setIsCreateModalOpen(true)}>Raise Dispute</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                {userDisputes.length > 0 ? (
                    <Table headers={['Date', 'Type', 'Ref ID', 'Status', 'Details']}>
                        {userDisputes.map(dispute => (
                            <tr key={dispute._id} className="text-gray-700 dark:text-gray-400">
                                <td className="px-4 py-3 text-sm">{new Date(dispute.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm">{dispute.type}</td>
                                <td className="px-4 py-3 text-xs font-mono">{dispute.referenceId}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center space-x-2">
                                        <Badge status={dispute.status as Status} />
                                        {dispute.userUnread && <span className="px-2 py-0.5 text-xs font-bold text-white bg-blue-500 rounded-full">New Reply</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <Button size="sm" variant="secondary" onClick={() => handleViewDispute(dispute)}>View Chat</Button>
                                </td>
                            </tr>
                        ))}
                    </Table>
                ) : (
                    <p className="text-gray-500 text-center py-8">No disputes found.</p>
                )}
            </div>

            {isCreateModalOpen && (
                <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                    <div className="p-4 w-[90vw] max-w-lg">
                        <h3 className="text-xl font-bold mb-4">Raise a Dispute</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Transaction Type</label>
                                <select value={type} onChange={(e) => { setType(e.target.value as any); setReferenceId(''); }} className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600">
                                    <option value="Deposit">Deposit</option>
                                    <option value="Withdrawal">Withdrawal</option>
                                    <option value="Transfer">Transfer</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between">
                                    <label className="block text-sm font-medium">Transaction Reference</label>
                                    <button type="button" onClick={() => setUseManualId(!useManualId)} className="text-xs text-blue-500 hover:underline">{useManualId ? 'Select from list' : 'Enter ID Manually'}</button>
                                </div>
                                {useManualId ? <input type="text" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="Enter ID of the transaction" className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 mt-1" required/> : <select value={referenceId} onChange={(e) => setReferenceId(e.target.value)} className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 mt-1" required><option value="">-- Select a failed transaction --</option>{availableTransactions.length > 0 ? availableTransactions.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>) : <option disabled>No recent failed transactions found</option>}</select>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Upload Proof (Screenshot)</label>
                                <input type="file" onChange={(e) => setProof(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Description</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Explain the issue in detail..." className="w-full rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600" required/>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Dispute'}</Button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}

            {selectedDispute && (
                <Modal isOpen={true} onClose={() => setSelectedDispute(null)}>
                    <div className="p-4 w-[90vw] max-w-3xl h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2">
                             <div>
                                <h3 className="text-xl font-bold">Dispute #{selectedDispute._id}</h3>
                                {linkedTransaction && <div className="text-xs text-gray-500">Regarding {selectedDispute.type} <span className="font-bold">{formatCurrency((linkedTransaction as any).amount, (linkedTransaction as any).currency)}</span></div>}
                                <Badge status={selectedDispute.status as Status} />
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setSelectedDispute(null)}>Close</Button>
                        </div>
                        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4">
                            <div className="flex justify-start">
                                <div className="max-w-[85%] p-3 rounded-lg rounded-bl-none bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-200">
                                    <p className="text-sm font-bold mb-1 text-blue-600 dark:text-blue-400">Your Original Description</p>
                                    <p className="text-sm whitespace-pre-wrap">{selectedDispute.description}</p>
                                    {selectedDispute.proofUrl && <a href={selectedDispute.proofUrl} target="_blank" rel="noreferrer"><img src={selectedDispute.proofUrl} alt="Initial Proof" className="mt-2 rounded-md max-h-40"/></a>}
                                    <p className="text-[10px] mt-2 text-gray-400 text-right">{new Date(selectedDispute.date).toLocaleString()}</p>
                                </div>
                            </div>
                            {selectedDispute.messages && selectedDispute.messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.sender === 'User' ? 'justify-start' : msg.sender === 'System' ? 'justify-center' : 'justify-end'}`}>
                                    {msg.sender === 'System' ? <span className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full">{msg.message} - {new Date(msg.date).toLocaleTimeString()}</span> : <div className={`max-w-[85%] p-3 rounded-lg shadow-sm text-sm ${msg.sender === 'Admin' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
                                        {msg.attachmentUrl && <img src={msg.attachmentUrl} alt="attachment" className="rounded-md mb-2 max-h-60"/>}
                                        <p>{msg.message}</p>
                                        <p className={`text-[10px] mt-1 text-right ${msg.sender === 'Admin' ? 'text-blue-100' : 'text-gray-400'}`}>{msg.sender} • {new Date(msg.date).toLocaleString()}</p>
                                    </div>}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        
                        {(selectedDispute.status === 'Open' || selectedDispute.status === 'Processing') && (
                            <div className="mt-4 flex gap-2 items-center">
                                <input type="text" className="flex-grow rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="Type your reply..." value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} disabled={isSubmitting}/>
                                <input type="file" ref={fileInputRef} onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)} className="hidden"/>
                                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg></Button>
                                <Button onClick={handleSendMessage} disabled={isSubmitting || (!replyMessage.trim() && !attachment)}>Send</Button>
                            </div>
                        )}
                        {attachment && <p className="text-xs text-gray-500 mt-1">Selected: {attachment.name}</p>}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default UserDisputes;
