import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Dispute, Status, formatCurrency } from '../../types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { createDispute, updateDispute, markDisputeAsRead } from '../../services/api';
import { triggerSystemNotification } from '../../services/notificationService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingCircle } from '../../components/ui/LoadingCircle';
import { DisputeTimeline } from '../../components/DisputeTimeline';

const ShieldExclamationIcon = () => (
    <svg className="w-16 h-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

export const UserDisputes: React.FC = () => {
    const { state, dispatch } = useData();
    const { disputes, currentUser, deposits, withdrawals, transfers, taskSubmissions = [], userTasks = [], activeInvestments = [], settings } = state;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Context Detection via URL query param (e.g., ?module=Work%20%26%20Earn)
    const urlModule = searchParams.get('module');
    const isWorkAndEarnContext = urlModule === 'Work & Earn' || urlModule === 'work-and-earn' || urlModule === 'WorkAndEarn' || urlModule === 'work';

    // Module Filter State
    const [selectedModuleFilter, setSelectedModuleFilter] = useState<'All' | 'Work & Earn' | 'Investment' | 'Finance'>(
        isWorkAndEarnContext ? 'Work & Earn' : 'All'
    );
    const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Processing' | 'Resolved' | 'Rejected'>('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Creation Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [moduleType, setModuleType] = useState<'Work & Earn' | 'Investment' | 'Finance'>(
        isWorkAndEarnContext ? 'Work & Earn' : 'Work & Earn'
    );
    const [disputeCategory, setDisputeCategory] = useState<string>('Task Proof Rejected / Disapproved');
    const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
    const [referenceId, setReferenceId] = useState('');
    const [description, setDescription] = useState('');
    const [proof, setProof] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [useManualId, setUseManualId] = useState(false);

    // View Chat Modal State
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

    // Categories mapping per module - strictly includes 'Other' for every module
    const categoriesByModule = {
        'Work & Earn': [
            'Task Proof Rejected / Disapproved',
            'Campaign Creator Unresponsive (Auto-Review Delay)',
            'Unpaid Task Reward / Balance Discrepancy',
            'Campaign Creator Fraud / Violation / Broken Link',
            'Campaign Creation & Escrow Budget Dispute',
            'Other'
        ],
        'Investment': [
            'Daily Profit Return Not Credited / ROI Discrepancy',
            'Plan Contract Maturity / Capital Lock Release Delay',
            'Deposit Top-up / Investment Plan Activation Issue',
            'Withdrawal Payout Delay or Rejection',
            'Sponsor / Referral Commission Discrepancy',
            'Other'
        ],
        'Finance': [
            'P2P Balance Transfer / Fee Dispute',
            'Account Security & Verification (KYC)',
            'General Technical / Payment Issue',
            'Other'
        ]
    };

    // Auto-update categories when moduleType changes
    const handleModuleTypeChange = (newMod: 'Work & Earn' | 'Investment' | 'Finance') => {
        setModuleType(newMod);
        setDisputeCategory(categoriesByModule[newMod][0]);
        setReferenceId('');
    };

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl min-h-[400px]">
                <LoadingCircle text="Opening conflict resolution portal..." />
            </div>
        );
    }

    if (currentUser.restrictions?.dispute) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-6 border border-red-200 dark:border-red-800">
                        <ShieldExclamationIcon />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">Dispute Access Restricted</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-sm">
                        Your account's ability to open new formal disputes is currently suspended by compliance review.
                    </p>
                    <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-xl py-3 px-8 text-xs font-bold uppercase">Return to Hub</Button>
                </div>
            </div>
        );
    }

    // Filter user's disputes
    const userDisputes = disputes.filter(d => d.userId === currentUser._id);

    const filteredDisputes = userDisputes.filter(d => {
        if (isWorkAndEarnContext || selectedModuleFilter === 'Work & Earn') {
            const matchesModule = (d as any).moduleName === 'Work & Earn' || ['UserTask', 'Task', 'Campaign'].includes(d.type);
            if (!matchesModule) return false;
        } else if (selectedModuleFilter !== 'All') {
            const matchesModule = (d as any).moduleName === selectedModuleFilter || d.type.includes(selectedModuleFilter);
            if (!matchesModule && selectedModuleFilter === 'Investment' && !['Investment', 'Deposit', 'Withdrawal'].includes(d.type)) return false;
        }
        if (statusFilter !== 'All' && d.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const match = d._id.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.type.toLowerCase().includes(q);
            if (!match) return false;
        }
        return true;
    });

    // Auto-populate Reference Options based on moduleType & disputeCategory
    const availableReferenceItems = useMemo(() => {
        if (disputeCategory === 'Other') {
            return [{ id: 'Other-General-Issue', label: 'Other / General Unlisted Issue' }];
        }
        if (moduleType === 'Work & Earn') {
            if (disputeCategory.includes('Campaign Creation')) {
                // Return created campaigns
                const myCampaigns = userTasks.filter((t: any) => t.creatorId === currentUser._id || t.userId === currentUser._id);
                return myCampaigns.map((c: any) => ({
                    id: c._id,
                    label: `Campaign: "${c.title}" - Budget $${c.totalBudget || c.rewardAmount} (${c.status})`
                }));
            } else {
                // Return submitted task proofs
                const mySubmissions = taskSubmissions.filter((s: any) => s.userId === currentUser._id || s.workerId === currentUser._id);
                return mySubmissions.map((s: any) => ({
                    id: s._id,
                    label: `Task Proof: "${s.taskTitle || 'Gig Task'}" - Submitted ${new Date(s.createdAt || s.updatedAt || Date.now()).toLocaleDateString()} ($${s.rewardAmount || 0.00} USD) - [${s.status}]`
                }));
            }
        } else if (moduleType === 'Investment') {
            // Return user's active/past investments or deposits
            if (disputeCategory.includes('Deposit') || disputeCategory.includes('Withdrawal')) {
                return deposits.filter(d => d.userId === currentUser._id).map(d => ({
                    id: d._id,
                    label: `Deposit $${d.amount} ${d.currency} - ${new Date(d.date).toLocaleDateString()} (${d.status})`
                }));
            } else {
                const myInvestments = activeInvestments.filter((inv: any) => inv.userId === currentUser._id);
                if (myInvestments.length > 0) {
                    return myInvestments.map((inv: any) => ({
                        id: inv._id || inv.id,
                        label: `Investment Plan: "${inv.planName}" - Invested $${inv.amount} (Daily ROI: ${inv.dailyReturn || inv.profitRate}%) - [${inv.status || 'Active'}]`
                    }));
                }
                return deposits.filter(d => d.userId === currentUser._id).map(d => ({
                    id: d._id,
                    label: `Deposit $${d.amount} ${d.currency} - ${new Date(d.date).toLocaleDateString()} (${d.status})`
                }));
            }
        } else {
            // Finance
            if (disputeCategory.includes('P2P')) {
                return transfers.filter(t => t.senderId === currentUser._id || t.recipientId === currentUser._id).map(t => ({
                    id: t._id,
                    label: `Transfer $${t.amount} ${t.currency} - ${new Date(t.date).toLocaleDateString()} (${t.status})`
                }));
            }
            return [
                ...deposits.filter(d => d.userId === currentUser._id).map(d => ({ id: d._id, label: `Deposit $${d.amount} ${d.currency} (${d.status})` })),
                ...withdrawals.filter(w => w.userId === currentUser._id).map(w => ({ id: w._id, label: `Withdrawal $${w.amount} ${w.currency} (${w.status})` }))
            ];
        }
    }, [moduleType, disputeCategory, taskSubmissions, userTasks, activeInvestments, deposits, withdrawals, transfers, currentUser._id]);

    const handleViewDispute = async (dispute: Dispute) => {
        setSelectedDispute(dispute);
        if (dispute.userUnread) {
            try {
                const updated = await markDisputeAsRead(dispute._id, 'user');
                dispatch({ type: 'UPDATE_DISPUTE', payload: updated });
                setSelectedDispute(updated);
            } catch (err) {
                console.error('Failed to mark dispute read:', err);
            }
        }
    };

    const handleSubmitNewDispute = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return alert('Please enter a detailed description of your dispute issue.');
        if (!useManualId && availableReferenceItems.length > 0 && !referenceId && disputeCategory !== 'Other') return alert('Please select a reference item or enter ID manually.');

        setIsSubmitting(true);
        const finalRefId = referenceId || (disputeCategory === 'Other' ? 'OTHER-MISSED-ISSUE' : 'N/A');

        const formData = new FormData();
        formData.append('userId', currentUser._id);
        formData.append('userName', currentUser.username);
        formData.append('type', moduleType === 'Work & Earn' ? 'Task' : moduleType === 'Investment' ? 'Investment' : 'Deposit');
        formData.append('moduleName', moduleType);
        formData.append('category', disputeCategory);
        formData.append('urgency', urgency);
        formData.append('referenceId', finalRefId);
        formData.append('description', description);
        if (proof) formData.append('proof', proof);

        try {
            const newDispute = await createDispute(formData);
            dispatch({ type: 'ADD_DISPUTE', payload: newDispute });

            // Trigger Email & WhatsApp Notification for Dispute Creation
            await triggerSystemNotification('DISPUTE_OPENED', currentUser, {
                disputeId: newDispute._id,
                disputeCategory,
                moduleName: moduleType,
                referenceItem: finalRefId,
                disputeDescription: description,
                disputeLink: `${window.location.origin}/member/disputes`
            }, settings, dispatch);

            setIsCreateModalOpen(false);
            setReferenceId(''); setDescription(''); setProof(null); setUseManualId(false);
            alert('Your dispute ticket has been opened successfully. Our compliance and audit team will review it shortly!');
        } catch (error) {
            console.error('Failed to submit dispute:', error);
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
        if (attachment) formData.append('file', attachment);

        try {
            const updated = await updateDispute(selectedDispute._id, formData);
            dispatch({ type: 'UPDATE_DISPUTE', payload: updated });
            setSelectedDispute(updated);

            // Trigger Notification for reply
            await triggerSystemNotification('DISPUTE_REPLIED', currentUser, {
                disputeId: selectedDispute._id,
                senderRole: 'User (@' + currentUser.username + ')',
                replyMessage: replyMessage.trim(),
                disputeLink: `${window.location.origin}/member/disputes`
            }, settings, dispatch);

            setReplyMessage('');
            setAttachment(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Linked submission for DisputeTimeline component inside chat
    const linkedSubmission = useMemo(() => {
        if (!selectedDispute) return null;
        return taskSubmissions.find((s: any) => s._id === selectedDispute.referenceId || s.disputeId === selectedDispute._id);
    }, [selectedDispute, taskSubmissions]);

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-2xl border border-indigo-900/40">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-black uppercase rounded-full border border-amber-500/30">
                            {isWorkAndEarnContext ? '🛠️ Work & Earn Dispute Desk' : 'International Resolution Portal'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">24/7 Audit Desk</span>
                    </div>
                    <h2 className="text-2xl font-black mt-2 tracking-tight">
                        {isWorkAndEarnContext ? 'Work & Earn Disputes Portal' : 'Disputes & Dispute Resolution Portal'}
                    </h2>
                    <p className="text-xs text-slate-300 max-w-xl mt-1 leading-relaxed">
                        {isWorkAndEarnContext
                            ? 'Manage and resolve all issues pertaining to Work & Earn tasks, proof rejections, auto-review delays, and campaign escrow.'
                            : 'Raise formal disputes for Work & Earn tasks, Campaign Escrow, Daily Investment ROI, and Financial Transfers with transparent level-1 creator review and level-2 admin escalation.'}
                    </p>
                </div>
                <Button onClick={() => {
                    if (isWorkAndEarnContext) setModuleType('Work & Earn');
                    setIsCreateModalOpen(true);
                }} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3 px-6 rounded-2xl shadow-lg border border-blue-400/30 text-xs uppercase tracking-wider shrink-0">
                    🛡️ Open New Dispute
                </Button>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold uppercase text-gray-400 mr-1">Module:</span>
                    {isWorkAndEarnContext ? (
                        <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-blue-600 text-white shadow-md">
                            🛠️ Work & Earn Disputes Only
                        </span>
                    ) : (
                        (['All', 'Work & Earn', 'Investment', 'Finance'] as const).map(mod => (
                            <button
                                key={mod}
                                onClick={() => setSelectedModuleFilter(mod)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedModuleFilter === mod
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                {mod}
                            </button>
                        ))
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search ticket # or keyword..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="text-xs rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 px-3 py-1.5 font-bold"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="Processing">Under Review</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Disputes List Table */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                {filteredDisputes.length > 0 ? (
                    <Table headers={['Ticket Date', 'Module & Category', 'Reference ID', 'Status & Activity', 'Action']}>
                        {filteredDisputes.map(dispute => {
                            const modName = (dispute as any).moduleName || (dispute.type === 'Task' ? 'Work & Earn' : dispute.type === 'Investment' ? 'Investment' : 'Finance');
                            const catName = (dispute as any).category || dispute.type;
                            return (
                                <tr key={dispute._id} className="text-gray-700 dark:text-gray-300 border-b dark:border-gray-700/60 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-3.5 text-xs font-mono">
                                        {new Date(dispute.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                                                {modName}
                                            </span>
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                {catName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-xs font-mono max-w-[140px] truncate">
                                        #{dispute.referenceId || dispute._id.substring(0, 8)}
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <Badge status={dispute.status as Status} />
                                            {dispute.userUnread && (
                                                <span className="px-2 py-0.5 text-[10px] font-black text-white bg-blue-600 rounded-full animate-pulse">
                                                    New Reply
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <Button size="sm" variant="secondary" onClick={() => handleViewDispute(dispute)} className="rounded-xl text-xs font-bold py-1.5 px-3">
                                            View Chat & Audit 💬
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </Table>
                ) : (
                    <div className="text-center py-12 space-y-3">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/50 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                            🛡️
                        </div>
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">No active disputes found</h4>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                            {isWorkAndEarnContext
                                ? 'You currently have no open or historic dispute tickets for the Work & Earn module.'
                                : 'You currently have no open or historic dispute tickets matching this filter.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Create Dispute Modal */}
            {isCreateModalOpen && (
                <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                    <div className="p-5 max-w-2xl w-[92vw] space-y-5">
                        <div className="border-b dark:border-gray-700 pb-3">
                            <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase rounded-md">
                                {isWorkAndEarnContext ? 'Work & Earn Dispute Entry' : 'Multi-Module Dispute Entry'}
                            </span>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mt-1">Raise Formal Dispute Ticket</h3>
                            <p className="text-xs text-gray-500">Provide details so our audit engine and platform admins can investigate promptly.</p>
                        </div>

                        <form onSubmit={handleSubmitNewDispute} className="space-y-4 text-xs">
                            {/* Step 1: Module Selector */}
                            <div>
                                <label className="block font-bold uppercase text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isWorkAndEarnContext ? 'Module (Work & Earn)' : 'Select Affected Module'}
                                </label>
                                {isWorkAndEarnContext ? (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                                        <span className="font-extrabold text-blue-800 dark:text-blue-300">
                                            🛠️ Work & Earn Module
                                        </span>
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Only Work & Earn options shown</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Work & Earn', 'Investment', 'Finance'] as const).map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => handleModuleTypeChange(m)}
                                                className={`py-2.5 px-3 rounded-xl border text-center font-extrabold transition-all ${
                                                    moduleType === m
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                                }`}
                                            >
                                                {m === 'Work & Earn' ? '🛠️ Work & Earn' : m === 'Investment' ? '📈 Investment' : '💳 Financial'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Dispute Category */}
                            <div>
                                <label className="block font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                                    Specific Dispute Category
                                </label>
                                <select
                                    value={disputeCategory}
                                    onChange={(e) => setDisputeCategory(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-2.5 font-medium"
                                >
                                    {categoriesByModule[moduleType].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 'Other' Category Banner Notice */}
                            {disputeCategory === 'Other' && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs space-y-1">
                                    <p className="font-bold flex items-center gap-1.5">
                                        💡 Missed or Custom Issue Resolution
                                    </p>
                                    <p className="text-[11px] leading-relaxed">
                                        Selected <strong>"Other"</strong> category. Please explain your issue in detail in the description box below so our support team can address and resolve any missed or unlisted concern.
                                    </p>
                                </div>
                            )}

                            {/* Step 3: Reference Item / ID Auto-Populated Dropdown */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="font-bold uppercase text-gray-700 dark:text-gray-300">
                                        Select Item / Transaction Reference
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setUseManualId(!useManualId)}
                                        className="text-[11px] text-blue-600 font-bold hover:underline"
                                    >
                                        {useManualId ? 'Select from list' : 'Enter ID manually'}
                                    </button>
                                </div>

                                {useManualId ? (
                                    <input
                                        type="text"
                                        placeholder="Enter transaction, campaign or submission ID e.g. 64a8b0c..."
                                        value={referenceId}
                                        onChange={(e) => setReferenceId(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-2.5 font-mono"
                                        required={disputeCategory !== 'Other'}
                                    />
                                ) : (
                                    <select
                                        value={referenceId}
                                        onChange={(e) => setReferenceId(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-2.5 font-medium"
                                        required={disputeCategory !== 'Other'}
                                    >
                                        <option value="">-- Choose matching {moduleType} item --</option>
                                        {availableReferenceItems.map(item => (
                                            <option key={item.id} value={item.id}>{item.label}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Step 4: Priority & Urgency */}
                            <div>
                                <label className="block font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                                    Priority & Urgency Level
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['Low', 'Medium', 'High', 'Urgent'] as const).map(u => (
                                        <button
                                            key={u}
                                            type="button"
                                            onClick={() => setUrgency(u)}
                                            className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] ${
                                                urgency === u
                                                    ? 'bg-amber-500 text-white border-amber-500'
                                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            {u}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Step 5: Proof File Upload */}
                            <div>
                                <label className="block font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                                    Upload Supporting Evidence (Screenshot / Document)
                                </label>
                                <input
                                    type="file"
                                    onChange={(e) => setProof(e.target.files ? e.target.files[0] : null)}
                                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>

                            {/* Step 6: Detailed Explanation */}
                            <div>
                                <label className="block font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                                    Detailed Dispute Description & Evidence
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    placeholder="Explain exactly what went wrong, dates, expected amount vs received, or creator rejection details..."
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 p-3"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Submitting Dispute...' : 'Submit Ticket'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}

            {/* View Dispute Chat & Audit Modal */}
            {selectedDispute && (
                <Modal isOpen={true} onClose={() => setSelectedDispute(null)}>
                    <div className="p-4 w-[92vw] max-w-4xl max-h-[85vh] flex flex-col space-y-4">
                        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase rounded-md">
                                        {(selectedDispute as any).moduleName || selectedDispute.type}
                                    </span>
                                    <Badge status={selectedDispute.status as Status} />
                                </div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                                    Dispute Ticket #{selectedDispute._id}
                                </h3>
                                <p className="text-xs text-gray-500">Category: {(selectedDispute as any).category || selectedDispute.type}</p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setSelectedDispute(null)}>Close</Button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4 pr-1">
                            {/* Render DisputeTimeline if linked submission exists */}
                            {linkedSubmission && (
                                <DisputeTimeline submission={linkedSubmission} dispute={selectedDispute} settings={settings} />
                            )}

                            {/* Original Ticket Description */}
                            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-2">
                                <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Original Submission Statement</span>
                                <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedDispute.description}</p>
                                {selectedDispute.proofUrl && (
                                    <a href={selectedDispute.proofUrl} target="_blank" rel="noreferrer" className="inline-block mt-2">
                                        <img src={selectedDispute.proofUrl} alt="Initial Proof" className="rounded-xl max-h-48 border"/>
                                    </a>
                                )}
                                <span className="block text-[10px] text-gray-400 text-right">{new Date(selectedDispute.date).toLocaleString()}</span>
                            </div>

                            {/* Chat Messages Log */}
                            <div className="space-y-3 pt-2">
                                {selectedDispute.messages && selectedDispute.messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.sender === 'User' ? 'justify-start' : msg.sender === 'System' ? 'justify-center' : 'justify-end'}`}>
                                        {msg.sender === 'System' ? (
                                            <span className="text-[10px] bg-gray-200 dark:bg-gray-800 text-gray-500 px-3 py-1 rounded-full font-mono">
                                                {msg.message} • {new Date(msg.date).toLocaleTimeString()}
                                            </span>
                                        ) : (
                                            <div className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm text-xs ${
                                                msg.sender === 'Admin'
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : msg.sender === 'Creator'
                                                    ? 'bg-purple-600 text-white rounded-br-none'
                                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border dark:border-gray-700'
                                            }`}>
                                                <div className="font-extrabold text-[10px] uppercase opacity-80 mb-1">
                                                    {msg.sender === 'Admin' ? '🏛️ Platform Admin' : msg.sender === 'Creator' ? '📢 Campaign Creator' : '👤 You (Worker)'}
                                                </div>
                                                {msg.attachmentUrl && (
                                                    <img src={msg.attachmentUrl} alt="attachment" className="rounded-xl mb-2 max-h-56 border"/>
                                                )}
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                                <p className="text-[9px] opacity-70 text-right mt-1 font-mono">{new Date(msg.date).toLocaleString()}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                        </div>

                        {/* Reply Controls */}
                        {(selectedDispute.status === 'Open' || selectedDispute.status === 'Processing') && (
                            <div className="pt-2 border-t dark:border-gray-700 space-y-2">
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        className="flex-grow rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-xs p-2.5"
                                        placeholder="Type your reply or additional evidence..."
                                        value={replyMessage}
                                        onChange={(e) => setReplyMessage(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                    <input type="file" ref={fileInputRef} onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)} className="hidden"/>
                                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>📎</Button>
                                    <Button onClick={handleSendMessage} disabled={isSubmitting || (!replyMessage.trim() && !attachment)}>
                                        Send Reply
                                    </Button>
                                </div>
                                {attachment && <p className="text-[10px] text-gray-400">Attached: {attachment.name}</p>}
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default UserDisputes;
