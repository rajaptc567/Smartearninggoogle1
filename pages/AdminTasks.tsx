
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../hooks/useData';
// Fixed: Added Status to the imports
import { Task, countries, Currency, formatCurrency, Status } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { createTask, updateTask, deleteTask, getPendingTaskVerifications, verifyTask } from '../services/api';

const AdminTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { tasks, investmentPlans } = state;

    const [activeTab, setActiveTab] = useState<'inventory' | 'queue'>('inventory');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Verification Queue State
    const [verificationQueue, setVerificationQueue] = useState<any[]>([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (activeTab === 'queue') {
            loadQueue();
        }
    }, [activeTab]);

    const loadQueue = async () => {
        setIsLoadingQueue(true);
        try {
            const data = await getPendingTaskVerifications();
            setVerificationQueue(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setVerificationQueue([]);
        } finally {
            setIsLoadingQueue(false);
        }
    };

    const handleOpenModal = (task: Task | null = null) => {
        setEditingTask(task || { 
            title: '', 
            description: '', 
            link: '', 
            type: 'Link', 
            platform: 'Other',
            action: 'Watch',
            category: 'General',
            priority: 0,
            frequency: 'Once',
            cooldownHours: 0,
            videoDurationType: 'Specific',
            videoDurationValue: 60,
            requireProof: false,
            proofInstructions: 'Please upload a screenshot as proof of completion.',
            isRequiredForWithdrawal: false, 
            status: 'Active', 
            rewardAmount: 0,
            targetPlanIds: [],
            targetCountries: [],
            targetCurrencies: [],
            minPlanValue: 0,
            maxGlobalCompletions: 0
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingTask?.title || !editingTask?.link) return alert('Title and Link are required');
        setIsSaving(true);
        try {
            if (editingTask._id) {
                const updated = await updateTask(editingTask._id, editingTask);
                dispatch({ type: 'UPDATE_TASK', payload: updated });
            } else {
                const created = await createTask(editingTask);
                dispatch({ type: 'ADD_TASK', payload: created });
            }
            setIsModalOpen(false);
        } catch (error) {
            alert('Failed to save task');
        } finally {
            setIsSaving(false);
        }
    };

    const handleVerifyAction = async (status: 'Approved' | 'Rejected') => {
        if (!selectedSubmission) return;
        setIsVerifying(true);
        try {
            const updatedUser = await verifyTask(selectedSubmission.userId, selectedSubmission.taskId, status, adminNotes);
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            setAdminNotes('');
            setSelectedSubmission(null);
            loadQueue();
            alert(`Submission ${status} successfully.`);
        } catch (error) {
            alert('Verification failed.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            try {
                await deleteTask(id);
                dispatch({ type: 'DELETE_TASK', payload: id });
            } catch (error) {
                alert('Failed to delete task');
            }
        }
    };

    const toggleArrayItem = (field: 'targetPlanIds' | 'targetCountries' | 'targetCurrencies', value: string) => {
        if (!editingTask) return;
        const current = (editingTask[field] as string[]) || [];
        const updated = current.includes(value) ? current.filter(i => i !== value) : [...current, value];
        setEditingTask({ ...editingTask, [field]: updated });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Withdrawal Eligibility Tasks</h2>
                    <p className="text-sm text-gray-500">Manage mandatory user actions and reward systems.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant={activeTab === 'inventory' ? 'primary' : 'secondary'} onClick={() => setActiveTab('inventory')}>Task Inventory</Button>
                    <div className="relative">
                        <Button variant={activeTab === 'queue' ? 'primary' : 'secondary'} onClick={() => setActiveTab('queue')}>
                            Verification Queue
                        </Button>
                        {verificationQueue.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white dark:ring-gray-800">
                                {verificationQueue.length}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {activeTab === 'inventory' && (
                <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border dark:border-gray-700 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 dark:text-white">Active Task List</h3>
                        <Button onClick={() => handleOpenModal()} size="sm">+ Create Task</Button>
                    </div>

                    <Table headers={['Title/Platform', 'Type & Action', 'Targeting', 'Frequency', 'Limits', 'Status', 'Actions']}>
                        {tasks.map((task) => (
                            <tr key={task._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 dark:text-white">{task.title}</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">{task.platform}</span>
                                            <span className="text-gray-300">•</span>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">{task.category}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase">{task.type}</span>
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase">{task.action}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                        {task.isRequiredForWithdrawal && <span className="text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase w-fit">Withdrawal Guard</span>}
                                        <span className="text-[9px] font-bold text-gray-500">{task.targetCurrencies?.length ? task.targetCurrencies.join(', ') : 'All Currencies'}</span>
                                        <span className="text-[9px] font-bold text-gray-500">{task.targetCountries?.length ? `${task.targetCountries.length} Countries` : 'Global Audience'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{task.frequency}</span>
                                        {task.cooldownHours > 0 && <span className="text-[10px] text-gray-400">{task.cooldownHours}h cooldown</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col text-[10px]">
                                        <span className="font-bold">Cap: {task.maxGlobalCompletions || '∞'}</span>
                                        <span className="text-blue-500">Done: {task.currentGlobalCompletions}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                        task.status === 'Active' ? 'bg-green-100 text-green-700' : 
                                        task.status === 'Draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                                    }`}>{task.status}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(task)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><EditIcon/></button>
                                        <button onClick={() => handleDelete(task._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </Table>
                </div>
            )}

            {activeTab === 'queue' && (
                <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border dark:border-gray-700 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white">Pending Verifications</h3>
                            <p className="text-xs text-gray-500">Review screenshots and approve rewards manually.</p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={loadQueue}>Refresh List</Button>
                    </div>

                    {isLoadingQueue ? (
                        <div className="py-20 text-center text-gray-400 italic">Scanning database...</div>
                    ) : (
                        <Table headers={['Member', 'Task Details', 'Submission Time', 'Status', 'Action']}>
                            {verificationQueue.map((item, idx) => {
                                const task = tasks.find(t => t._id === item.taskId);
                                return (
                                    <tr key={`${item.userId}-${item.taskId}-${idx}`} className="text-gray-700 dark:text-gray-400">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900 dark:text-white">@{item.username}</span>
                                                <span className="text-[10px] text-gray-500">{item.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{task?.title || 'Unknown Task'}</span>
                                                <span className="text-[10px] text-blue-500 font-bold uppercase">{task?.platform} • {task?.action}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono">{new Date(item.completedAt).toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-black uppercase">Pending</span>
                                                {item.retryCount > 0 && <span className="text-[9px] font-bold text-red-500">({item.retryCount} Retries)</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button size="sm" onClick={() => setSelectedSubmission({ ...item, taskTitle: task?.title })}>Review Proof</Button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {verificationQueue.length === 0 && (
                                <tr><td colSpan={5} className="py-20 text-center text-gray-500 italic">No pending submissions in queue.</td></tr>
                            )}
                        </Table>
                    )}
                </div>
            )}

            {/* Task Builder Modal */}
            {isModalOpen && editingTask && (
                <Modal isOpen={true} onClose={() => setIsModalOpen(false)}>
                    <div className="p-6 w-[750px] max-w-full space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <div className="border-b dark:border-gray-700 pb-4">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{editingTask._id ? 'Refine Configuration' : 'Architect New Task'}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Advanced Engagement Engine</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">1. Core Identity</h4>
                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Display Title</label><input className="w-full rounded-xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 font-bold" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} /></div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Social Platform</label>
                                        <select className="w-full rounded-xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-xs font-bold" value={editingTask.platform} onChange={e => setEditingTask({...editingTask, platform: e.target.value as any})}>
                                            <option value="YouTube">YouTube</option>
                                            <option value="Facebook">Facebook</option>
                                            <option value="Instagram">Instagram</option>
                                            <option value="Telegram">Telegram</option>
                                            <option value="TikTok">TikTok</option>
                                            <option value="X">X (Twitter)</option>
                                            <option value="Other">Other / Website</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Action Type</label>
                                        <select className="w-full rounded-xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-xs font-bold" value={editingTask.action} onChange={e => setEditingTask({...editingTask, action: e.target.value as any})}>
                                            <option value="Watch">Watch Video</option>
                                            <option value="Follow">Follow Page</option>
                                            <option value="Like">Like Content</option>
                                            <option value="Subscribe">Subscribe Channel</option>
                                            <option value="Comment">Drop Comment</option>
                                            <option value="Share">Share Link</option>
                                        </select>
                                    </div>
                                </div>

                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Instruction Context</label><textarea className="w-full rounded-xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm" rows={2} value={editingTask.description} onChange={e => setEditingTask({...editingTask, description: e.target.value})} /></div>
                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mission Target URL</label><input className="w-full rounded-xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 font-mono text-xs" value={editingTask.link} onChange={e => setEditingTask({...editingTask, link: e.target.value})} /></div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Menu Category</label><input className="w-full rounded-xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-xs font-bold" value={editingTask.category} onChange={e => setEditingTask({...editingTask, category: e.target.value})} /></div>
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sort Priority</label><input type="number" className="w-full rounded-xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-xs font-bold" value={editingTask.priority} onChange={e => setEditingTask({...editingTask, priority: parseInt(e.target.value) || 0})} /></div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">2. Verification & Guard</h4>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Task System Type</label>
                                        <select className="w-full rounded-xl dark:bg-gray-800 text-xs font-bold" value={editingTask.type} onChange={e => setEditingTask({...editingTask, type: e.target.value as any})}>
                                            <option value="Link">Simple Link Redirection</option>
                                            <option value="Video">Video Watch (Timed)</option>
                                            <option value="Social">Social Media Action</option>
                                            <option value="Subscription">Platform Subscription</option>
                                        </select>
                                    </div>
                                    {editingTask.type === 'Video' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Video Verification</label>
                                            <select className="w-full rounded-xl dark:bg-gray-800 text-xs font-bold" value={editingTask.videoDurationType} onChange={e => setEditingTask({...editingTask, videoDurationType: e.target.value as any})}>
                                                <option value="Specific">Timer (Seconds)</option>
                                                <option value="Full">Entire Duration</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {editingTask.type === 'Video' && editingTask.videoDurationType === 'Specific' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Timer (Sec)</label>
                                        <input type="number" className="w-full rounded-xl dark:bg-gray-800 text-xs font-bold" value={editingTask.videoDurationValue} onChange={e => setEditingTask({...editingTask, videoDurationValue: parseInt(e.target.value) || 0})} />
                                    </div>
                                )}

                                <div className="p-4 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={editingTask.isRequiredForWithdrawal} onChange={e => setEditingTask({...editingTask, isRequiredForWithdrawal: e.target.checked})} className="w-6 h-6 rounded text-red-600" />
                                        <div>
                                            <span className="text-sm font-black text-red-800 dark:text-red-400 uppercase">Withdrawal Security Guard</span>
                                            <p className="text-[10px] text-red-600/70 font-bold leading-tight mt-0.5">Mandatory completion before unlocking withdrawals.</p>
                                        </div>
                                    </label>
                                </div>
                                <div className="p-4 rounded-2xl border bg-gray-50 dark:bg-gray-900/50 space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={editingTask.requireProof} onChange={e => setEditingTask({...editingTask, requireProof: e.target.checked})} className="w-5 h-5 rounded text-blue-600" />
                                        <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">Require Proof (Screenshot)</span>
                                    </label>
                                    {editingTask.requireProof && <textarea className="w-full rounded-xl dark:bg-gray-800 text-[11px]" placeholder="Specific screenshot instructions for user..." rows={1} value={editingTask.proofInstructions} onChange={e => setEditingTask({...editingTask, proofInstructions: e.target.value})} />}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-4 border-t dark:border-gray-700">
                             <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">3. Targeting & Cycle</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Frequency</label><select className="w-full rounded-xl dark:bg-gray-800 text-xs font-bold" value={editingTask.frequency} onChange={e => setEditingTask({...editingTask, frequency: e.target.value as any})}><option value="Once">Once Only</option><option value="Daily">Daily Cycle</option><option value="Weekly">Weekly Cycle</option></select></div>
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cooldown (Hrs)</label><input type="number" className="w-full rounded-xl dark:bg-gray-800 text-xs font-bold" value={editingTask.cooldownHours} onChange={e => setEditingTask({...editingTask, cooldownHours: parseInt(e.target.value) || 0})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Global Limit (0=∞)</label><input type="number" className="w-full rounded-xl dark:bg-gray-800 text-xs font-bold" value={editingTask.maxGlobalCompletions} onChange={e => setEditingTask({...editingTask, maxGlobalCompletions: parseInt(e.target.value) || 0})} /></div>
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Reward (Instant)</label><input type="number" step="0.01" className="w-full rounded-xl dark:bg-gray-800 text-xs font-bold text-green-600" value={editingTask.rewardAmount} onChange={e => setEditingTask({...editingTask, rewardAmount: parseFloat(e.target.value) || 0})} /></div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">4. Audience Filters</h4>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Currency Reach</label>
                                    <div className="flex gap-2">
                                        {['USD', 'EUR', 'PKR'].map(c => (
                                            <button key={c} onClick={() => toggleArrayItem('targetCurrencies', c)} className={`px-3 py-1 rounded-full text-[10px] font-black border transition-all ${editingTask.targetCurrencies?.includes(c as any) ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200'}`}>{c}</button>
                                        ))}
                                        {(!editingTask.targetCurrencies || !editingTask.targetCurrencies.length) && <span className="text-[9px] text-gray-400 italic flex items-center">Global Reach</span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Plan-Specific Filter</label>
                                    <div className="max-h-24 overflow-y-auto border dark:border-gray-700 rounded-xl p-2 bg-gray-50 dark:bg-gray-900/50 space-y-1">
                                        {investmentPlans.map(p => (
                                            <label key={p._id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors">
                                                <input type="checkbox" checked={editingTask.targetPlanIds?.includes(p._id)} onChange={() => toggleArrayItem('targetPlanIds', p._id)} className="rounded" />
                                                <span className="text-[10px] font-bold">{p.name} ({p.currency})</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t dark:border-gray-700">
                             <div className="flex gap-4">
                                <select className="rounded-full text-[10px] font-black uppercase bg-gray-100 dark:bg-gray-900 px-4 border-none" value={editingTask.status} onChange={e => setEditingTask({...editingTask, status: e.target.value as any})}>
                                    <option value="Active">Active / Public</option>
                                    <option value="Draft">Draft / Hidden</option>
                                    <option value="Archived">Archived / Past</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Discard</Button>
                                <Button onClick={handleSave} disabled={isSaving} className="px-10 shadow-xl shadow-blue-500/20">{isSaving ? 'Processing...' : 'Sync Master Data'}</Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Verification Detail Modal */}
            {selectedSubmission && (
                <Modal isOpen={true} onClose={() => setSelectedSubmission(null)}>
                    <div className="p-8 w-[500px] max-w-full space-y-6">
                        <div className="flex justify-between items-start border-b dark:border-gray-700 pb-4">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter">Review Submission</h3>
                                <p className="text-xs text-blue-600 font-bold uppercase mt-1">Audit: @{selectedSubmission.username}</p>
                            </div>
                            <Badge status={Status.Pending} />
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 rounded-[2rem] overflow-hidden border dark:border-gray-700 relative group">
                            <p className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-black px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Task: {selectedSubmission.taskTitle}</p>
                            <img src={selectedSubmission.proofUrl} alt="User Proof" className="w-full h-auto object-contain max-h-[400px] bg-white" />
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Administrative Response / Feedback</label>
                                <textarea className="w-full rounded-2xl dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm" placeholder="Reason for rejection or approval notes..." rows={2} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="danger" className="py-4 font-black uppercase text-xs tracking-widest rounded-2xl border-0 shadow-lg shadow-red-500/20" onClick={() => handleVerifyAction('Rejected')} disabled={isVerifying}>
                                {isVerifying ? '...' : 'Reject Entry'}
                            </Button>
                            <Button variant="success" className="py-4 font-black uppercase text-xs tracking-widest rounded-2xl border-0 shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700" onClick={() => handleVerifyAction('Approved')} disabled={isVerifying}>
                                {isVerifying ? '...' : 'Approve & Release'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- Sub-Icons ---
const EditIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

export default AdminTasks;
