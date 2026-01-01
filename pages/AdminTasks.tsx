
import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { Task } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { createTask, updateTask, deleteTask } from '../services/api';

const AdminTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { tasks } = state;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenModal = (task: Task | null = null) => {
        setEditingTask(task || { 
            title: '', 
            description: '', 
            link: '', 
            type: 'Link', 
            videoDurationType: 'Specific',
            videoDurationValue: 60,
            requireProof: false,
            proofInstructions: 'Please upload a screenshot as proof of completion.',
            isRequiredForWithdrawal: false, 
            status: 'Active', 
            rewardAmount: 0 
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

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Withdrawal Eligibility Tasks</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage mandatory actions users must perform before they can withdraw funds.</p>
                </div>
                <Button onClick={() => handleOpenModal()}>Add New Task</Button>
            </div>

            <Table headers={['Title', 'Type', 'Target Link', 'Withdraw Req?', 'Verification', 'Reward', 'Status', 'Actions']}>
                {tasks.map((task) => (
                    <tr key={task._id} className="text-gray-700 dark:text-gray-400">
                        <td className="px-4 py-3 font-medium">{task.title}</td>
                        <td className="px-4 py-3 text-sm">{task.type}</td>
                        <td className="px-4 py-3 text-xs text-blue-500 truncate max-w-[150px]"><a href={task.link} target="_blank" rel="noreferrer">{task.link}</a></td>
                        <td className="px-4 py-3 text-center">
                            {task.isRequiredForWithdrawal ? 
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold uppercase tracking-tight">Compulsory</span> : 
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Optional</span>
                            }
                        </td>
                        <td className="px-4 py-3 text-xs">
                            <div className="space-y-1">
                                {task.type === 'Video' && <div className="font-bold">{task.videoDurationType} ({task.videoDurationValue}s)</div>}
                                {task.requireProof && <div className="text-blue-600 font-bold uppercase tracking-tighter">Requires Proof</div>}
                                {!task.requireProof && task.type !== 'Video' && <div className="text-gray-400 italic">Auto-Verify</div>}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{task.rewardAmount || 0}</td>
                        <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${task.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{task.status}</span>
                        </td>
                        <td className="px-4 py-3">
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => handleOpenModal(task)}>Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDelete(task._id)}>Delete</Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>

            {isModalOpen && editingTask && (
                <Modal isOpen={true} onClose={() => setIsModalOpen(false)}>
                    <div className="p-4 w-96 space-y-4">
                        <h3 className="text-xl font-bold">{editingTask._id ? 'Edit Task' : 'Create Task'}</h3>
                        <p className="text-xs text-gray-500 -mt-2">Define requirements for user withdrawal eligibility.</p>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Task Title</label>
                            <input className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="e.g. Subscribe to Youtube" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Instruction Text</label>
                            <textarea className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="What should the user do?" rows={2} value={editingTask.description} onChange={e => setEditingTask({...editingTask, description: e.target.value})} />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Target Link (URL)</label>
                            <input className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="https://..." value={editingTask.link} onChange={e => setEditingTask({...editingTask, link: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Task Category</label>
                                <select className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingTask.type} onChange={e => setEditingTask({...editingTask, type: e.target.value as any})}>
                                    <option value="Link">Website Visit</option>
                                    <option value="Video">Video Watch (Timed)</option>
                                    <option value="Social">Join Community</option>
                                    <option value="Subscription">Channel Follow</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Bonus Reward</label>
                                <input type="number" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="0.00" value={editingTask.rewardAmount} onChange={e => setEditingTask({...editingTask, rewardAmount: parseFloat(e.target.value) || 0})} />
                            </div>
                        </div>

                        {editingTask.type === 'Video' && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 space-y-3">
                                <label className="block text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-tighter">Video Verification</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Duration Type</label>
                                        <select className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={editingTask.videoDurationType} onChange={e => setEditingTask({...editingTask, videoDurationType: e.target.value as any})}>
                                            <option value="Specific">Timer (Seconds)</option>
                                            <option value="Full">Entire Video</option>
                                        </select>
                                    </div>
                                    {editingTask.videoDurationType === 'Specific' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Timer (Sec)</label>
                                            <input type="number" className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={editingTask.videoDurationValue} onChange={e => setEditingTask({...editingTask, videoDurationValue: parseInt(e.target.value) || 0})} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={editingTask.requireProof} onChange={e => setEditingTask({...editingTask, requireProof: e.target.checked})} />
                                <span className="text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tighter">Require Screenshot Proof</span>
                            </label>
                            {editingTask.requireProof && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Proof Instructions</label>
                                    <textarea className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600 text-xs" rows={2} placeholder="Instructions for the user screenshot..." value={editingTask.proofInstructions} onChange={e => setEditingTask({...editingTask, proofInstructions: e.target.value})} />
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5 rounded text-red-600" checked={editingTask.isRequiredForWithdrawal} onChange={e => setEditingTask({...editingTask, isRequiredForWithdrawal: e.target.checked})} />
                                <div>
                                    <span className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-tighter">Mandatory for Withdraw</span>
                                    <p className="text-[10px] text-red-600 dark:text-red-500 opacity-80">User MUST complete this to unlock withdrawal form.</p>
                                </div>
                            </label>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Task Visibility</label>
                            <select className="w-full rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingTask.status} onChange={e => setEditingTask({...editingTask, status: e.target.value as any})}>
                                <option value="Active">Published & Visible</option>
                                <option value="Disabled">Hidden/Draft</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Configuration'}</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminTasks;
