import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { UserTask, UserTaskSubmission, formatCurrency } from '../types';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { updateUserTaskStatus, deleteUserTask, updateSettings, updateSubmissionStatus, deleteSubmission } from '../services/api';

const AdminUserTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { userTasks, userTaskSubmissions, settings, users, investmentPlans } = state;

    const [activeTab, setActiveTab] = useState<'campaigns' | 'submissions' | 'rates'>('campaigns');

    // Settings State
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isUserTaskEnabled, setIsUserTaskEnabled] = useState(settings.isUserTaskEnabled ?? true);
    const [minQuantity, setMinQuantity] = useState(settings.userTaskConfig?.minQuantity ?? 5);
    const [minRewardAmount, setMinRewardAmount] = useState(settings.userTaskConfig?.minRewardAmount ?? 0.10);
    const [commissionPercent, setCommissionPercent] = useState(settings.userTaskConfig?.commissionPercent ?? 10);

    const [userTaskAccessMode, setUserTaskAccessMode] = useState<'all' | 'manual' | 'plan'>(settings.userTaskAccessMode || 'all');
    const [userTaskAllowedUserIds, setUserTaskAllowedUserIds] = useState<string[]>(settings.userTaskAllowedUserIds || []);
    const [userTaskAllowedPlanIds, setUserTaskAllowedPlanIds] = useState<string[]>(settings.userTaskAllowedPlanIds || []);
    const [userTaskNotificationEnabled, setUserTaskNotificationEnabled] = useState<boolean>(settings.userTaskNotificationEnabled ?? true);
    const [userTaskNotificationMessage, setUserTaskNotificationMessage] = useState<string>(settings.userTaskNotificationMessage || 'Want to earn extra rewards? Activate the required investment plan to unlock the User Task Hub and start earning today!');
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Exchange Rates State
    const [rates, setRates] = useState(settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 });
    const [isSavingRates, setIsSavingRates] = useState(false);

    // Selected Task/Submission action
    const [adminNotes, setAdminNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<UserTask | null>(null);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingSettings(true);
        try {
            const updatedSettings = {
                ...settings,
                isUserTaskEnabled,
                userTaskAccessMode,
                userTaskAllowedUserIds,
                userTaskAllowedPlanIds,
                userTaskNotificationEnabled,
                userTaskNotificationMessage,
                userTaskConfig: {
                    minQuantity: Number(minQuantity),
                    minRewardAmount: Number(minRewardAmount),
                    commissionPercent: Number(commissionPercent)
                }
            };
            const result = await updateSettings(updatedSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: result });
            alert('User Task configuration and access controls updated successfully!');
        } catch (error) {
            alert('Failed to update settings');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleSaveRates = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingRates(true);
        try {
            const updatedSettings = {
                ...settings,
                exchangeRates: {
                    USD: Number(rates.USD || 1),
                    EUR: Number(rates.EUR || 0.92),
                    PKR: Number(rates.PKR || 278)
                }
            };
            const result = await updateSettings(updatedSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: result });
            alert('Exchange rates updated successfully!');
        } catch (error) {
            alert('Failed to update exchange rates');
        } finally {
            setIsSavingRates(false);
        }
    };

    const handleTaskAction = async (taskId: string, status: string) => {
        setIsProcessing(true);
        try {
            const updated = await updateUserTaskStatus(taskId, { status, adminNotes });
            dispatch({ type: 'UPDATE_USER_TASK', payload: updated });
            setAdminNotes('');
            alert(`Task campaign status updated to ${status}`);
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm('Delete this user task campaign? If pending, the user will be refunded.')) return;
        try {
            await deleteUserTask(taskId);
            dispatch({ type: 'DELETE_USER_TASK', payload: taskId });
            alert('User task deleted.');
        } catch (error) {
            alert('Failed to delete task.');
        }
    };

    const handleSubmissionAction = async (subId: string, status: string) => {
        setIsProcessing(true);
        try {
            const updated = await updateSubmissionStatus(subId, { status, adminNotes });
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updated });
            setAdminNotes('');
            alert(`Submission status updated to ${status}!`);
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteSubmission = async (subId: string) => {
        if (!window.confirm('Delete this worker submission?')) return;
        try {
            await deleteSubmission(subId);
            dispatch({ type: 'DELETE_USER_TASK_SUBMISSION', payload: subId });
            alert('Submission deleted.');
        } catch (error) {
            alert('Failed to delete submission.');
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="bg-[#0f172a] p-8 md:p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Admin Task Management</h1>
                        <p className="mt-1 text-blue-100/70 text-xs font-medium uppercase tracking-widest">Configure exchange rates, task rules, review member campaigns and worker proof submissions</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant={activeTab === 'campaigns' ? 'primary' : 'secondary'} onClick={() => setActiveTab('campaigns')}>
                            Campaigns ({userTasks.length})
                        </Button>
                        <Button variant={activeTab === 'submissions' ? 'primary' : 'secondary'} onClick={() => setActiveTab('submissions')}>
                            Worker Proofs ({userTaskSubmissions.length})
                        </Button>
                        <Button variant={activeTab === 'rates' ? 'primary' : 'secondary'} onClick={() => setActiveTab('rates')}>
                            Rates & Rules
                        </Button>
                    </div>
                </div>
            </div>

            {/* TAB 1: CAMPAIGNS & SETTINGS */}
            {activeTab === 'campaigns' && (
                <div className="space-y-8">
                    {/* Settings Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">User Task Configuration & Rules</h3>
                        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700 col-span-full md:col-span-2">
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">Enable User Task Submissions</p>
                                    <p className="text-xs text-gray-500">Allow members to submit campaigns in USD</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={isUserTaskEnabled} 
                                        onChange={(e) => setIsUserTaskEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Min Task Quantity</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={minQuantity} 
                                    onChange={(e) => setMinQuantity(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Min Reward / Task (USD)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0.01"
                                    value={minRewardAmount} 
                                    onChange={(e) => setMinRewardAmount(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Admin Commission (%)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    max="100"
                                    value={commissionPercent} 
                                    onChange={(e) => setCommissionPercent(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div className="flex items-end">
                                <Button type="submit" variant="primary" isLoading={isSavingSettings} className="w-full py-3">
                                    Save Task Rules
                                </Button>
                            </div>

                            {/* Task Menu Access & Notification Controls */}
                            <div className="col-span-full border-t border-gray-200 dark:border-gray-700 pt-6 mt-4 space-y-6">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">User Task Menu Access Control & Notifications</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-gray-500 mb-2">Access Mode</label>
                                        <select
                                            value={userTaskAccessMode}
                                            onChange={(e) => setUserTaskAccessMode(e.target.value as any)}
                                            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                        >
                                            <option value="all">Show to All (Default)</option>
                                            <option value="manual">Manual User Selection</option>
                                            <option value="plan">Based on Activated Plan</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700 col-span-1 md:col-span-2">
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">Enable Access Notification / Prompt</p>
                                            <p className="text-xs text-gray-500">Show notification to users who have not activated the required plan/access</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={userTaskNotificationEnabled} 
                                                onChange={(e) => setUserTaskNotificationEnabled(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>

                                {userTaskNotificationEnabled && (
                                    <div>
                                        <label className="block text-xs font-black uppercase text-gray-500 mb-2">Custom Notification / Activation Prompt Message</label>
                                        <input
                                            type="text"
                                            value={userTaskNotificationMessage}
                                            onChange={(e) => setUserTaskNotificationMessage(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                        />
                                    </div>
                                )}

                                {userTaskAccessMode === 'manual' && (
                                    <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border dark:border-gray-700">
                                        <div className="flex justify-between items-center">
                                            <h5 className="font-bold text-gray-900 dark:text-white text-sm uppercase">Select Specific Users Allowed to Access Task Menu</h5>
                                            <input
                                                type="text"
                                                placeholder="Search user..."
                                                value={userSearchQuery}
                                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-sm"
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                                            {users
                                                .filter(u => u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                                .map(user => {
                                                    const isSelected = userTaskAllowedUserIds.includes(user._id) || userTaskAllowedUserIds.includes(user.email);
                                                    return (
                                                        <label key={user._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 cursor-pointer">
                                                            <div className="flex items-center gap-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={(e) => {
                                                                        const idOrEmail = user._id;
                                                                        if (e.target.checked) {
                                                                            setUserTaskAllowedUserIds([...userTaskAllowedUserIds, idOrEmail]);
                                                                        } else {
                                                                            setUserTaskAllowedUserIds(userTaskAllowedUserIds.filter(id => id !== idOrEmail && id !== user.email));
                                                                        }
                                                                    }}
                                                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                                />
                                                                <span className="font-bold text-sm text-gray-900 dark:text-white">{user.name || user.email}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-400 font-mono">{user.email}</span>
                                                        </label>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {userTaskAccessMode === 'plan' && (
                                    <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border dark:border-gray-700">
                                        <h5 className="font-bold text-gray-900 dark:text-white text-sm uppercase">Select Required Investment Plans to Unlock Task Menu</h5>
                                        <p className="text-xs text-gray-500">Users who have activated any of the selected plans will see and access the task menu. Others will receive the activation notification prompt.</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {investmentPlans.map(plan => {
                                                const isSelected = userTaskAllowedPlanIds.includes(plan._id);
                                                return (
                                                    <label key={plan._id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setUserTaskAllowedPlanIds([...userTaskAllowedPlanIds, plan._id]);
                                                                    } else {
                                                                        setUserTaskAllowedPlanIds(userTaskAllowedPlanIds.filter(id => id !== plan._id));
                                                                    }
                                                                }}
                                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                            />
                                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{plan.name}</span>
                                                        </div>
                                                        <span className="text-xs font-mono font-bold text-emerald-500">{plan.price} {plan.currency}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Submitted Tasks Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">Submitted Member Task Campaigns ({userTasks.length})</h3>
                        
                        {userTasks.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 font-medium">No user task campaigns found.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                            <th className="p-4">Member</th>
                                            <th className="p-4">Title & Link</th>
                                            <th className="p-4">Category</th>
                                            <th className="p-4">Budget</th>
                                            <th className="p-4">Completions</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium text-sm">
                                        {userTasks.map((task) => (
                                            <tr key={task._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                <td className="p-4 font-bold text-gray-900 dark:text-white">{task.userName}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">{task.title}</div>
                                                    <a href={task.link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate block max-w-xs">{task.link}</a>
                                                </td>
                                                <td className="p-4 text-gray-500">{task.category} ({task.subType})</td>
                                                <td className="p-4 font-mono text-emerald-500 font-bold">{task.totalBudget} USD</td>
                                                <td className="p-4 text-gray-500">{task.currentCompletions} / {task.targetQuantity}</td>
                                                <td className="p-4">
                                                    <Badge variant={task.status === 'Approved' ? 'success' : task.status === 'Pending' ? 'warning' : 'danger'}>
                                                        {task.status}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 space-x-2">
                                                    <Button variant="secondary" onClick={() => setSelectedCampaign(task)} className="text-xs py-1 px-3">
                                                     Details
                                                 </Button>
                                                 {task.status === 'Pending' && (
                                                        <Button variant="primary" onClick={() => handleTaskAction(task._id, 'Approved')} className="text-xs py-1 px-3">
                                                            Approve
                                                        </Button>
                                                    )}
                                                    {task.status !== 'Rejected' && (
                                                        <Button variant="danger" onClick={() => handleTaskAction(task._id, 'Rejected')} className="text-xs py-1 px-3">
                                                            Reject (Refund)
                                                        </Button>
                                                    )}
                                                    <Button variant="secondary" onClick={() => handleDeleteTask(task._id)} className="text-xs py-1 px-3">
                                                        Delete
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: WORKER PROOF SUBMISSIONS */}
            {activeTab === 'submissions' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border dark:border-gray-700 space-y-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Worker Task Proof Submissions ({userTaskSubmissions.length})</h3>
                    
                    {userTaskSubmissions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 font-medium">No worker proof submissions received yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                        <th className="p-4">Worker</th>
                                        <th className="p-4">Task</th>
                                        <th className="p-4">Proof Text / Screenshot</th>
                                        <th className="p-4">Reward</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium text-sm">
                                    {userTaskSubmissions.map((sub: UserTaskSubmission) => (
                                        <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                            <td className="p-4 font-bold text-gray-900 dark:text-white">{sub.workerName}</td>
                                            <td className="p-4 text-gray-900 dark:text-white font-medium">{sub.taskTitle || 'Engagement Task'}</td>
                                            <td className="p-4">
                                                <div className="text-gray-900 dark:text-white font-medium">{sub.proofText || 'No text proof'}</div>
                                                {sub.proofImage && (
                                                    <a href={sub.proofImage} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline block mt-1">View Screenshot</a>
                                                )}
                                            </td>
                                            <td className="p-4 font-mono text-emerald-500 font-bold">+{sub.rewardAmount} USD</td>
                                            <td className="p-4">
                                                <Badge variant={sub.status === 'Approved' ? 'success' : sub.status === 'Pending' ? 'warning' : 'danger'}>
                                                    {sub.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4 space-x-2">
                                                {sub.status === 'Pending' && (
                                                    <Button variant="primary" onClick={() => handleSubmissionAction(sub._id, 'Approved')} className="text-xs py-1 px-3">
                                                        Approve & Pay
                                                    </Button>
                                                )}
                                                {sub.status !== 'Rejected' && (
                                                    <Button variant="danger" onClick={() => handleSubmissionAction(sub._id, 'Rejected')} className="text-xs py-1 px-3">
                                                        Reject
                                                    </Button>
                                                )}
                                                <Button variant="secondary" onClick={() => handleDeleteSubmission(sub._id)} className="text-xs py-1 px-3">
                                                    Delete
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: EXCHANGE RATES ADJUSTMENT */}
            {activeTab === 'rates' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border dark:border-gray-700 max-w-2xl mx-auto space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Exchange Rates & Currency Adjustment</h3>
                        <p className="text-xs text-gray-500 mt-1">Allow admin to adjust currency conversion rates (USD, EUR, PKR) for member task earnings and withdrawals.</p>
                    </div>

                    <form onSubmit={handleSaveRates} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">USD Rate (Base)</label>
                                <input 
                                    type="number" 
                                    step="0.0001"
                                    value={rates.USD ?? 1} 
                                    onChange={(e) => setRates({ ...rates, USD: Number(e.target.value) })}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">EUR Rate</label>
                                <input 
                                    type="number" 
                                    step="0.0001"
                                    value={rates.EUR ?? 0.92} 
                                    onChange={(e) => setRates({ ...rates, EUR: Number(e.target.value) })}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div className="col-span-full">
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">PKR Rate (PKR per 1 USD)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={rates.PKR ?? 278} 
                                    onChange={(e) => setRates({ ...rates, PKR: Number(e.target.value) })}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>
                        </div>

                        <Button type="submit" variant="primary" isLoading={isSavingRates} className="w-full py-4 text-lg">
                            Save Exchange Rates
                        </Button>
                    </form>
                </div>
            )}

            {/* Campaign Detail Modal */}
            {selectedCampaign && (
                <Modal isOpen={true} onClose={() => setSelectedCampaign(null)}>
                    <div className="p-8 w-[600px] max-w-full space-y-6">
                        <div className="flex justify-between items-start border-b dark:border-gray-700 pb-4">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Campaign Details</h3>
                                <p className="text-xs text-blue-600 font-bold uppercase mt-1">Submitted by: @{selectedCampaign.userName}</p>
                            </div>
                            <Badge variant={selectedCampaign.status === 'Approved' ? 'success' : selectedCampaign.status === 'Pending' ? 'warning' : 'danger'}>
                                {selectedCampaign.status}
                            </Badge>
                        </div>

                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Campaign Title</span>
                                    <span className="font-bold text-gray-900 dark:text-white text-base">{selectedCampaign.title}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Category & SubType</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-200">{selectedCampaign.category} ({selectedCampaign.subType})</span>
                                </div>
                                <div className="col-span-full">
                                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Target Link</span>
                                    <a href={selectedCampaign.link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-mono text-xs break-all block bg-white dark:bg-gray-800 p-2.5 rounded-xl border dark:border-gray-700">{selectedCampaign.link}</a>
                                </div>
                                <div className="col-span-full">
                                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Instructions / Description</span>
                                    <p className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700">{selectedCampaign.description || 'No description provided.'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 text-center">
                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Reward / Task</span>
                                    <span className="font-mono font-bold text-emerald-500">{selectedCampaign.rewardPerTask} USD</span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 text-center">
                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Total Budget</span>
                                    <span className="font-mono font-bold text-blue-500">{selectedCampaign.totalBudget} USD</span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 text-center">
                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Completions</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedCampaign.currentCompletions} / {selectedCampaign.targetQuantity}</span>
                                </div>
                            </div>

                            {selectedCampaign.adminNotes && (
                                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-2xl border border-red-200 dark:border-red-900/50">
                                    <span className="text-[10px] font-black uppercase text-red-500 block mb-1">Admin Notes / Feedback</span>
                                    <p className="text-xs text-red-700 dark:text-red-300">{selectedCampaign.adminNotes}</p>
                                </div>
                            )}

                            <div className="text-xs text-gray-400 font-mono">
                                Submitted on: {selectedCampaign.createdAt ? new Date(selectedCampaign.createdAt).toLocaleString() : 'N/A'} (ID: {selectedCampaign._id})
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                            {selectedCampaign.status === 'Pending' && (
                                <Button variant="primary" onClick={() => { handleTaskAction(selectedCampaign._id, 'Approved'); setSelectedCampaign(null); }}>
                                    Approve Campaign
                                </Button>
                            )}
                            {selectedCampaign.status !== 'Rejected' && (
                                <Button variant="danger" onClick={() => { handleTaskAction(selectedCampaign._id, 'Rejected'); setSelectedCampaign(null); }}>
                                    Reject & Refund
                                </Button>
                            )}
                            <Button variant="secondary" onClick={() => setSelectedCampaign(null)}>Close</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminUserTasks;
