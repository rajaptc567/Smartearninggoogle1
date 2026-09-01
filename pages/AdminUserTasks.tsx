import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { UserTask, UserTaskSubmission, formatCurrency } from '../types';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { updateUserTaskStatus, deleteUserTask, updateSettings, updateSubmissionStatus, deleteSubmission, resolveDispute, adminResetWorkAndEarnData } from '../services/api';
import { DisputeTimeline } from '../components/DisputeTimeline';

const AdminUserTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { userTasks, userTaskSubmissions, settings, users, investmentPlans } = state;

    const [activeTab, setActiveTab] = useState<'campaigns' | 'submissions' | 'rates' | 'proof-limits' | 'reset-data'>('campaigns');

    // Settings State
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isUserTaskEnabled, setIsUserTaskEnabled] = useState(settings.isUserTaskEnabled ?? true);
    const [commissionPercent, setCommissionPercent] = useState(settings.userTaskConfig?.commissionPercent ?? 10);
    const [campaignFeeEnabled, setCampaignFeeEnabled] = useState(settings.userTaskConfig?.campaignFeeEnabled ?? false);
    const [campaignFeeAmount, setCampaignFeeAmount] = useState(settings.userTaskConfig?.campaignFeeAmount ?? 1.00);

    const [userTaskAccessMode, setUserTaskAccessMode] = useState<'all' | 'manual' | 'plan'>(settings.userTaskAccessMode || 'all');
    const [userTaskAllowedUserIds, setUserTaskAllowedUserIds] = useState<string[]>(settings.userTaskAllowedUserIds || []);
    const [userTaskAllowedPlanIds, setUserTaskAllowedPlanIds] = useState<string[]>(settings.userTaskAllowedPlanIds || []);
    const [userTaskNotificationEnabled, setUserTaskNotificationEnabled] = useState<boolean>(settings.userTaskNotificationEnabled ?? true);
    const [userTaskNotificationMessage, setUserTaskNotificationMessage] = useState<string>(settings.userTaskNotificationMessage || 'Want to earn extra rewards? Activate the required investment plan to unlock the Earn Cash & Gigs Hub and start earning today!');
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Exchange Rates State
    const [rates, setRates] = useState(settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 });
    const [isSavingRates, setIsSavingRates] = useState(false);

    // Proof Limits State
    const [localProofLimits, setLocalProofLimits] = useState<any>(() => {
        return settings.userTaskProofLimits || {
            screenshot: { enabled: true, max: 2 },
            text: { enabled: true, max: 3 },
            username: { enabled: true, max: 3 },
            userId: { enabled: true, max: 3 },
            email: { enabled: true, max: 3 },
            manual: { enabled: true, max: 3 }
        };
    });
    const [maxScreenshotSizeMB, setMaxScreenshotSizeMB] = useState<number>(settings.proofControls?.maxScreenshotSizeMB ?? 5);
    const [approvalTimeoutDays, setApprovalTimeoutDays] = useState<number>(settings.systemLimits?.approvalTimeoutDays ?? 3);
    const [disputeTimeLimitHours, setDisputeTimeLimitHours] = useState<number>(settings.systemLimits?.disputeTimeLimitHours ?? 48);
    const [disputeReviewTimeoutDays, setDisputeReviewTimeoutDays] = useState<number>(settings.systemLimits?.disputeReviewTimeoutDays ?? 3);
    const [secondDisputeTimeLimitHours, setSecondDisputeTimeLimitHours] = useState<number>(settings.systemLimits?.secondDisputeTimeLimitHours ?? 48);
    const [adminReviewTimeoutDays, setAdminReviewTimeoutDays] = useState<number>(settings.systemLimits?.adminReviewTimeoutDays ?? 3);
    const [isSavingProofLimits, setIsSavingProofLimits] = useState(false);

    const handleSaveProofLimits = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProofLimits(true);
        try {
            const updatedSettings = {
                ...settings,
                userTaskProofLimits: localProofLimits,
                proofControls: {
                    ...settings.proofControls,
                    maxScreenshotSizeMB: Number(maxScreenshotSizeMB)
                },
                systemLimits: {
                    ...settings.systemLimits,
                    approvalTimeoutDays: Number(approvalTimeoutDays),
                    disputeTimeLimitHours: Number(disputeTimeLimitHours),
                    disputeReviewTimeoutDays: Number(disputeReviewTimeoutDays),
                    secondDisputeTimeLimitHours: Number(secondDisputeTimeLimitHours),
                    adminReviewTimeoutDays: Number(adminReviewTimeoutDays)
                }
            };
            const result = await updateSettings(updatedSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: result });
            alert('Duplicate proof limits, file size limits, auto-approval limits, dispute windows, and escalation timers updated successfully!');
        } catch (error) {
            alert('Failed to update duplicate proof limits');
        } finally {
            setIsSavingProofLimits(false);
        }
    };

    // Selected Task/Submission action
    const [adminNotes, setAdminNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<UserTask | null>(null);
    const [selectedSubmissionForDetails, setSelectedSubmissionForDetails] = useState<UserTaskSubmission | null>(null);
    const [campaignFilter, setCampaignFilter] = useState<'pending' | 'approved' | 'completed' | 'all'>('pending');
    const [submissionFilter, setSubmissionFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    const filteredUserTasks = userTasks.filter(task => {
        if (campaignFilter === 'pending') return task.status === 'Pending';
        if (campaignFilter === 'approved') return task.status === 'Approved';
        if (campaignFilter === 'completed') return task.status === 'Completed' || task.currentCompletions >= task.targetQuantity;
        return true;
    });

    const filteredSubmissions = userTaskSubmissions.filter(sub => {
        if (submissionFilter === 'pending') return sub.status === 'Pending';
        if (submissionFilter === 'approved') return sub.status === 'Approved';
        if (submissionFilter === 'rejected') return sub.status === 'Rejected';
        return true;
    });

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
                    ...settings.userTaskConfig,
                    commissionPercent: Number(commissionPercent),
                    campaignFeeEnabled: Boolean(campaignFeeEnabled),
                    campaignFeeAmount: Number(campaignFeeAmount)
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

    const handleTaskAction = async (taskId: string, status: string, customNotes?: string) => {
        setIsProcessing(true);
        try {
            const updated = await updateUserTaskStatus(taskId, { status, adminNotes: customNotes !== undefined ? customNotes : adminNotes });
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

    const handleSubmissionAction = async (subId: string, status: string, reason?: string) => {
        setIsProcessing(true);
        try {
            const res = await updateSubmissionStatus(subId, { status, adminNotes: reason !== undefined ? reason : adminNotes });
            const updatedSub = res?.data || res;
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updatedSub });
            if (res?.task) {
                dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
            }
            setAdminNotes('');
            alert(`Submission status updated to ${status}!`);
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResolveDisputeVerdict = async (disputeId: string, verdict: 'ReleaseToWorker' | 'RefundToCreator' | 'SplitPayout', notes?: string) => {
        setIsProcessing(true);
        try {
            const updatedDispute = await resolveDispute(disputeId, {
                verdict,
                adminNotes: notes || `Verdict: ${verdict}`,
                splitPercentageWorker: verdict === 'SplitPayout' ? 50 : undefined
            });
            dispatch({ type: 'UPDATE_DISPUTE', payload: updatedDispute });
            alert(`Dispute resolved successfully with verdict: ${verdict}`);
        } catch (error) {
            alert(`Failed to resolve dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                    <div className="flex gap-2 flex-wrap items-center">
                        {(() => {
                            const pendingCampaigns = userTasks.filter(t => t.status === 'Pending').length;
                            const pendingProofs = userTaskSubmissions.filter(s => s.status === 'Pending' || s.status === 'Submitted' || s.status === 'In Review').length;
                            return (
                                <>
                                    <Button variant={activeTab === 'campaigns' ? 'primary' : 'secondary'} onClick={() => setActiveTab('campaigns')} className="relative">
                                        <span>Campaigns ({userTasks.length})</span>
                                        {pendingCampaigns > 0 && (
                                            <span className="ml-2 px-2 py-0.5 text-[10px] font-black bg-amber-500 text-slate-900 rounded-full shadow-sm">
                                                {pendingCampaigns} Pending
                                            </span>
                                        )}
                                    </Button>
                                    <Button variant={activeTab === 'submissions' ? 'primary' : 'secondary'} onClick={() => setActiveTab('submissions')} className="relative">
                                        <span>Worker Proofs ({userTaskSubmissions.length})</span>
                                        {pendingProofs > 0 && (
                                            <span className="ml-2 px-2 py-0.5 text-[10px] font-black bg-amber-500 text-slate-900 rounded-full shadow-sm">
                                                {pendingProofs} Pending
                                            </span>
                                        )}
                                    </Button>
                                    <Button variant={activeTab === 'rates' ? 'primary' : 'secondary'} onClick={() => setActiveTab('rates')}>
                                        Rates & Rules
                                    </Button>
                                    <Button variant={activeTab === 'proof-limits' ? 'primary' : 'secondary'} onClick={() => setActiveTab('proof-limits')}>
                                        Proof Limits
                                    </Button>
                                    <Button variant={activeTab === 'reset-data' ? 'danger' : 'secondary'} onClick={() => setActiveTab('reset-data')}>
                                        Reset & Erase Data 🔄
                                    </Button>
                                </>
                            );
                        })()}
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
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Admin Commission (%)</label>
                                <input 
                                    id="admin_commission_input"
                                    type="number" 
                                    min="0"
                                    max="100"
                                    value={commissionPercent} 
                                    onChange={(e) => setCommissionPercent(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700">
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-xs">Enable Creation Fee</p>
                                    <p className="text-[10px] text-gray-500">Charge base fee upfront</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        id="campaign_fee_toggle"
                                        type="checkbox" 
                                        checked={campaignFeeEnabled} 
                                        onChange={(e) => setCampaignFeeEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Base Creation Fee (USD)</label>
                                <input 
                                    id="campaign_fee_amount_input"
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    value={campaignFeeAmount} 
                                    onChange={(e) => setCampaignFeeAmount(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div className="flex items-end">
                                <Button id="save_task_rules_btn" type="submit" variant="primary" isLoading={isSavingSettings} className="w-full py-3">
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Submitted Member Task Campaigns ({filteredUserTasks.length})</h3>
                        </div>

                        {/* Admin Review Queue Sub-Tabs */}
                        <div className="flex flex-wrap gap-2 mb-6 border-b dark:border-gray-700 pb-4">
                            <button
                                onClick={() => setCampaignFilter('pending')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                    campaignFilter === 'pending'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                🕒 Pending Review Queue ({userTasks.filter(t => t.status === 'Pending').length})
                            </button>
                            <button
                                onClick={() => setCampaignFilter('approved')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                    campaignFilter === 'approved'
                                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/20'
                                        : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                ✅ Active Campaigns ({userTasks.filter(t => t.status === 'Approved').length})
                            </button>
                            <button
                                onClick={() => setCampaignFilter('completed')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                    campaignFilter === 'completed'
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                🏆 Completed Tasks ({userTasks.filter(t => t.status === 'Completed' || t.currentCompletions >= t.targetQuantity).length})
                            </button>
                            <button
                                onClick={() => setCampaignFilter('all')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                    campaignFilter === 'all'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                🌍 All Campaigns ({userTasks.length})
                            </button>
                        </div>
                        
                        {filteredUserTasks.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 font-medium">No task campaigns found under this status.</div>
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
                                        {filteredUserTasks.map((task) => (
                                            <tr key={task._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                <td className="p-4 font-bold text-gray-900 dark:text-white">{task.userName}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">{task.title}</div>
                                                    <a href={task.link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate block max-w-xs">{task.link}</a>
                                                </td>
                                                <td className="p-4 text-gray-500">{task.category} ({task.subType})</td>
                                                <td className="p-4 font-mono">
                                                    {(() => {
                                                        const fee = task.baseFeeCharged ?? task.campaignFeeUSD ?? task.baseCampaignFee ?? 0;
                                                        const total = (task.totalBudget || 0) + fee;
                                                        return (
                                                            <div>
                                                                <span className="text-emerald-500 font-bold block">${total.toFixed(2)} USD</span>
                                                                <span className="text-[10px] text-gray-400 block font-normal">
                                                                    (Budget: ${task.totalBudget} + Fee: ${fee.toFixed(2)})
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="p-4 text-gray-500">{task.currentCompletions} / {task.targetQuantity}</td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <Badge variant={task.status === 'Approved' ? 'success' : task.status === 'Pending' ? 'warning' : 'danger'}>
                                                            {task.status}
                                                        </Badge>
                                                        {task.reviewRequested && (
                                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/30 px-1.5 py-0.5 rounded">🔄 Resubmitted</span>
                                                        )}
                                                    </div>
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
                                                        <Button variant="danger" onClick={() => {
                                                            const reason = window.prompt("Enter rejection reason (User will be refunded):");
                                                            if (reason === null) return;
                                                            handleTaskAction(task._id, 'Rejected', reason);
                                                        }} className="text-xs py-1 px-3">
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
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b dark:border-gray-700 pb-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Worker Task Proof Submissions ({filteredSubmissions.length})</h3>
                            <p className="text-xs text-gray-500 mt-1">Review proofs submitted by workers for campaigns. You can see who created the campaign, who rated it, and details of approval or rejection.</p>
                        </div>
                    </div>

                    {/* Proof Filter Sub-Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6 border-b dark:border-gray-700 pb-4">
                        <button
                            onClick={() => setSubmissionFilter('all')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                submissionFilter === 'all'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            🌍 All Proofs ({userTaskSubmissions.length})
                        </button>
                        <button
                            onClick={() => setSubmissionFilter('pending')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                submissionFilter === 'pending'
                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                    : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            🕒 Pending Review ({userTaskSubmissions.filter(s => s.status === 'Pending').length})
                        </button>
                        <button
                            onClick={() => setSubmissionFilter('approved')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                submissionFilter === 'approved'
                                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/20'
                                    : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            ✅ Approved / Accepted ({userTaskSubmissions.filter(s => s.status === 'Approved').length})
                        </button>
                        <button
                            onClick={() => setSubmissionFilter('rejected')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                submissionFilter === 'rejected'
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                                    : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            ❌ Rejected ({userTaskSubmissions.filter(s => s.status === 'Rejected').length})
                        </button>
                    </div>

                    {filteredSubmissions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 font-medium">No worker proof submissions found matching this filter.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                        <th className="p-4">Worker Details</th>
                                        <th className="p-4">Campaign & Creator</th>
                                        <th className="p-4">Submitted Proof</th>
                                        <th className="p-4">Reward</th>
                                        <th className="p-4">Rating & Status</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium text-sm">
                                    {filteredSubmissions.map((sub: UserTaskSubmission) => {
                                        const campaign = userTasks.find(t => t._id === sub.taskId);
                                        const creatorName = campaign ? campaign.userName : 'Unknown Creator';
                                        
                                        return (
                                            <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">{sub.workerName}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">ID: {sub.workerId}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</div>
                                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                                        Campaign Creator: @{creatorName}
                                                    </div>
                                                    {sub.taskCategory && (
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{sub.taskCategory}</div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {sub.submittedProofs && Array.isArray(sub.submittedProofs) && sub.submittedProofs.length > 0 ? (
                                                        <div className="space-y-1.5 max-w-xs">
                                                            {sub.submittedProofs.map((item: any, idx: number) => {
                                                                const isImage = item.type === 'screenshot' || (item.value && (item.value.startsWith('data:') || item.value.startsWith('http')));
                                                                return (
                                                                    <div key={item.id || idx} className="bg-gray-50 dark:bg-gray-900/40 p-2 rounded-xl border dark:border-gray-800 text-xs">
                                                                        <span className="text-[10px] uppercase font-bold text-blue-500 block">{item.label}</span>
                                                                        {isImage ? (
                                                                            <a href={item.value} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-1 font-bold mt-1">
                                                                                🖼️ View {item.label || 'Screenshot'}
                                                                            </a>
                                                                        ) : (
                                                                            <p className="font-mono text-gray-700 dark:text-gray-300 break-all">{item.value}</p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="text-gray-900 dark:text-white font-medium max-w-xs break-words">{sub.proofText || 'No text proof'}</div>
                                                            {sub.proofImage && (
                                                                <a href={sub.proofImage} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1 mt-1 font-bold">
                                                                    🖼️ View Screenshot Proof
                                                                </a>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="p-4 font-mono text-emerald-500 font-bold">+{sub.rewardAmount} USD</td>
                                                <td className="p-4">
                                                    <div className="space-y-1.5">
                                                        {(sub.isAutoApproved || sub.autoApproved || sub.approvalType === 'auto' || (sub.adminNotes && sub.adminNotes.toLowerCase().includes('auto-approved'))) ? (
                                                            <span className="px-2.5 py-1 text-xs font-black uppercase rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-sm flex items-center gap-1 inline-flex">
                                                                ⚡ Auto Approved
                                                            </span>
                                                        ) : (
                                                            <Badge variant={sub.status === 'Approved' ? 'success' : sub.status === 'Pending' ? 'warning' : 'danger'}>
                                                                {sub.status === 'Approved' ? '✅ Accepted' : sub.status === 'Pending' ? '⏳ Pending' : '❌ Rejected'}
                                                            </Badge>
                                                        )}
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {(sub.isAutoApproved || sub.autoApproved || sub.approvalType === 'auto' || (sub.adminNotes && sub.adminNotes.toLowerCase().includes('auto-approved'))) ? (
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">System Auto-Approved (Time Limit Expired)</span>
                                                            ) : sub.status === 'Approved' ? (
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Approved by Campaign Creator @{creatorName}</span>
                                                            ) : sub.status === 'Rejected' ? (
                                                                <div className="text-red-500 dark:text-red-400 font-medium">
                                                                    <div>Rejected by @{creatorName}</div>
                                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 italic">Reason: "{sub.adminNotes || 'No reason specified'}"</div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-amber-600 dark:text-amber-400 font-medium">Awaiting Creator review</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 space-x-2">
                                                    <Button variant="secondary" onClick={() => setSelectedSubmissionForDetails(sub)} className="text-xs py-1 px-3 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400">
                                                        👁️ Complete Detail
                                                    </Button>
                                                    {sub.status === 'Pending' && (
                                                        <Button variant="primary" onClick={() => handleSubmissionAction(sub._id, 'Approved')} className="text-xs py-1 px-3">
                                                            Approve & Pay
                                                        </Button>
                                                    )}
                                                    {sub.status !== 'Rejected' && (
                                                        <Button variant="danger" onClick={() => {
                                                            const reason = window.prompt("Enter rejection reason:");
                                                            if (reason === null) return;
                                                            // Pass rejection details to helper
                                                            handleSubmissionAction(sub._id, 'Rejected', reason);
                                                        }} className="text-xs py-1 px-3">
                                                            Reject
                                                        </Button>
                                                    )}
                                                    <Button variant="secondary" onClick={() => handleDeleteSubmission(sub._id)} className="text-xs py-1 px-3">
                                                        Delete
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
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

            {activeTab === 'proof-limits' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border dark:border-gray-700 max-w-4xl mx-auto space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Campaign Proof Duplicate Limits</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Configure which proof types are allowed for creators when setting up a campaign, and set the maximum number of duplicate proofs they can add.
                        </p>
                    </div>

                    <form onSubmit={handleSaveProofLimits} className="space-y-6">
                        {/* File Size, Auto-Approval & Dispute Time Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-sm text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                        📸 Proof Size Limit
                                    </h4>
                                    <p className="text-xs text-blue-700/70 dark:text-blue-400/70 mt-1">
                                        Define the maximum file size (in MB) allowed for screenshot and image proof uploads.
                                    </p>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="1"
                                        max="100"
                                        value={maxScreenshotSizeMB} 
                                        onChange={(e) => setMaxScreenshotSizeMB(Number(e.target.value))}
                                        className="w-full pr-12 pl-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900 text-gray-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs font-black text-blue-500 uppercase">MB</span>
                                </div>
                            </div>

                            <div className="p-6 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-sm text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                        ⏱️ Creator Review Limit
                                    </h4>
                                    <p className="text-xs text-purple-700/70 dark:text-purple-400/70 mt-1">
                                        Define how many days before a worker's proof submission is auto-approved if the creator does not review it.
                                    </p>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="1"
                                        max="30"
                                        value={approvalTimeoutDays} 
                                        onChange={(e) => setApprovalTimeoutDays(Number(e.target.value))}
                                        className="w-full pr-14 pl-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-900 text-gray-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs font-black text-purple-500 uppercase">Days</span>
                                </div>
                            </div>

                            {/* 1. Worker Initial Dispute Window (Hours) */}
                            <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-sm text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                        ⚖️ Worker Dispute Limit (With Creator)
                                    </h4>
                                    <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">
                                        Maximum time allowed for a worker to open a dispute with the campaign creator after an initial task rejection.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                                        <button type="button" onClick={() => setDisputeTimeLimitHours(12)} className="px-2 py-1 rounded-md bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-300 text-amber-900 dark:text-amber-200">12 Hours</button>
                                        <button type="button" onClick={() => setDisputeTimeLimitHours(24)} className="px-2 py-1 rounded-md bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-300 text-amber-900 dark:text-amber-200">1 Day (24h)</button>
                                        <button type="button" onClick={() => setDisputeTimeLimitHours(48)} className="px-2 py-1 rounded-md bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-300 text-amber-900 dark:text-amber-200">2 Days (48h)</button>
                                        <button type="button" onClick={() => setDisputeTimeLimitHours(72)} className="px-2 py-1 rounded-md bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-300 text-amber-900 dark:text-amber-200">3 Days (72h)</button>
                                        <button type="button" onClick={() => setDisputeTimeLimitHours(168)} className="px-2 py-1 rounded-md bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-300 text-amber-900 dark:text-amber-200">1 Week (168h)</button>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="1"
                                            max="720"
                                            value={disputeTimeLimitHours} 
                                            onChange={(e) => setDisputeTimeLimitHours(Number(e.target.value))}
                                            className="w-full pr-14 pl-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900 text-gray-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs font-black text-amber-500 uppercase">Hours</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Creator Dispute Review Timeout (Days) */}
                            <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-sm text-rose-900 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                                        ⏱️ Creator Dispute Review Limit
                                    </h4>
                                    <p className="text-xs text-rose-700/70 dark:text-rose-400/70 mt-1">
                                        Maximum days creator has to review a dispute before it auto-approves and pays the worker.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                                        <button type="button" onClick={() => setDisputeReviewTimeoutDays(1)} className="px-2 py-1 rounded-md bg-rose-200/60 dark:bg-rose-900/40 hover:bg-rose-300 text-rose-900 dark:text-rose-200">1 Day</button>
                                        <button type="button" onClick={() => setDisputeReviewTimeoutDays(2)} className="px-2 py-1 rounded-md bg-rose-200/60 dark:bg-rose-900/40 hover:bg-rose-300 text-rose-900 dark:text-rose-200">2 Days</button>
                                        <button type="button" onClick={() => setDisputeReviewTimeoutDays(3)} className="px-2 py-1 rounded-md bg-rose-200/60 dark:bg-rose-900/40 hover:bg-rose-300 text-rose-900 dark:text-rose-200">3 Days</button>
                                        <button type="button" onClick={() => setDisputeReviewTimeoutDays(7)} className="px-2 py-1 rounded-md bg-rose-200/60 dark:bg-rose-900/40 hover:bg-rose-300 text-rose-900 dark:text-rose-200">1 Week</button>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="1"
                                            max="30"
                                            value={disputeReviewTimeoutDays} 
                                            onChange={(e) => setDisputeReviewTimeoutDays(Number(e.target.value))}
                                            className="w-full pr-14 pl-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-900 text-gray-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs font-black text-rose-500 uppercase">Days</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Worker Escalation Window to Admin (Hours) */}
                            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-sm text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                                        ⚖️ Escalation Limit (Worker &rarr; Admin)
                                    </h4>
                                    <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-1">
                                        Maximum time worker has to escalate a creator-rejected dispute directly to the Admin.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                                        <button type="button" onClick={() => setSecondDisputeTimeLimitHours(12)} className="px-2 py-1 rounded-md bg-emerald-200/60 dark:bg-emerald-900/40 hover:bg-emerald-300 text-emerald-900 dark:text-emerald-200">12 Hours</button>
                                        <button type="button" onClick={() => setSecondDisputeTimeLimitHours(24)} className="px-2 py-1 rounded-md bg-emerald-200/60 dark:bg-emerald-900/40 hover:bg-emerald-300 text-emerald-900 dark:text-emerald-200">1 Day (24h)</button>
                                        <button type="button" onClick={() => setSecondDisputeTimeLimitHours(48)} className="px-2 py-1 rounded-md bg-emerald-200/60 dark:bg-emerald-900/40 hover:bg-emerald-300 text-emerald-900 dark:text-emerald-200">2 Days (48h)</button>
                                        <button type="button" onClick={() => setSecondDisputeTimeLimitHours(72)} className="px-2 py-1 rounded-md bg-emerald-200/60 dark:bg-emerald-900/40 hover:bg-emerald-300 text-emerald-900 dark:text-emerald-200">3 Days (72h)</button>
                                        <button type="button" onClick={() => setSecondDisputeTimeLimitHours(168)} className="px-2 py-1 rounded-md bg-emerald-200/60 dark:bg-emerald-900/40 hover:bg-emerald-300 text-emerald-900 dark:text-emerald-200">1 Week (168h)</button>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="1"
                                            max="720"
                                            value={secondDisputeTimeLimitHours} 
                                            onChange={(e) => setSecondDisputeTimeLimitHours(Number(e.target.value))}
                                            className="w-full pr-14 pl-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-900 text-gray-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs font-black text-emerald-500 uppercase">Hours</span>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Admin Dispute Review Timeout (Days) */}
                            <div className="p-6 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-sm text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                        🏛️ Admin Dispute Review Target
                                    </h4>
                                    <p className="text-xs text-purple-700/70 dark:text-purple-400/70 mt-1">
                                        Target deadline for Admin resolution team to review and render final verdict on escalated cases.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                                        <button type="button" onClick={() => setAdminReviewTimeoutDays(1)} className="px-2 py-1 rounded-md bg-purple-200/60 dark:bg-purple-900/40 hover:bg-purple-300 text-purple-900 dark:text-purple-200">1 Day</button>
                                        <button type="button" onClick={() => setAdminReviewTimeoutDays(2)} className="px-2 py-1 rounded-md bg-purple-200/60 dark:bg-purple-900/40 hover:bg-purple-300 text-purple-900 dark:text-purple-200">2 Days</button>
                                        <button type="button" onClick={() => setAdminReviewTimeoutDays(3)} className="px-2 py-1 rounded-md bg-purple-200/60 dark:bg-purple-900/40 hover:bg-purple-300 text-purple-900 dark:text-purple-200">3 Days</button>
                                        <button type="button" onClick={() => setAdminReviewTimeoutDays(7)} className="px-2 py-1 rounded-md bg-purple-200/60 dark:bg-purple-900/40 hover:bg-purple-300 text-purple-900 dark:text-purple-200">1 Week</button>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="1"
                                            max="30"
                                            value={adminReviewTimeoutDays} 
                                            onChange={(e) => setAdminReviewTimeoutDays(Number(e.target.value))}
                                            className="w-full pr-14 pl-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-900 text-gray-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs font-black text-purple-500 uppercase">Days</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { key: 'screenshot', name: '📸 Screenshot / Image Proof' },
                                { key: 'text', name: '📝 Text Proof' },
                                { key: 'username', name: '👤 Username Proof' },
                                { key: 'userId', name: '🆔 User ID Proof' },
                                { key: 'email', name: '📧 Email Proof' },
                                { key: 'manual', name: '✍️ Manual Entry / Custom URL' },
                            ].map(({ key, name }) => {
                                const config = localProofLimits[key] || { enabled: true, max: 3 };
                                return (
                                    <div key={key} className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{name}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={config.enabled} 
                                                    onChange={(e) => {
                                                        setLocalProofLimits({
                                                            ...localProofLimits,
                                                            [key]: { ...config, enabled: e.target.checked }
                                                        });
                                                    }}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        {config.enabled && (
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Max Duplicate Proofs Creator Can Require</label>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="50"
                                                    value={config.max} 
                                                    onChange={(e) => {
                                                        setLocalProofLimits({
                                                            ...localProofLimits,
                                                            [key]: { ...config, max: Number(e.target.value) }
                                                        });
                                                    }}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-mono font-bold text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <Button type="submit" variant="primary" isLoading={isSavingProofLimits} className="w-full py-4 text-lg">
                            Save Duplicate Proof Limits
                        </Button>
                    </form>
                </div>
            )}

            {/* TAB 5: ERASE / RESET WORK & EARN DATA */}
            {activeTab === 'reset-data' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-red-200 dark:border-red-900/40 space-y-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🔄</span>
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-red-600 dark:text-red-400">Erase & Reset Work and Earn Data</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                    International-level admin reset control. Erase all campaigns, worker proof submissions, disputes, task transactions, and reset balances so users can restart their journey fresh.
                                </p>
                            </div>
                        </div>
                    </div>

                    <ResetWorkAndEarnSection 
                        users={users} 
                        investmentPlans={investmentPlans} 
                        settings={settings}
                        dispatch={dispatch} 
                    />
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
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant={selectedCampaign.status === 'Approved' ? 'success' : selectedCampaign.status === 'Pending' ? 'warning' : 'danger'}>
                                    {selectedCampaign.status}
                                </Badge>
                                {selectedCampaign.reviewRequested && (
                                    <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">🔄 Resubmitted for Review</span>
                                )}
                            </div>
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

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 text-center">
                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Reward / Task</span>
                                    <span className="font-mono font-bold text-emerald-500">{selectedCampaign.rewardPerTask} USD</span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 text-center">
                                    <span className="text-[10px] font-black uppercase text-gray-400 block">Slots + Comm Budget</span>
                                    <span className="font-mono font-bold text-blue-500">${selectedCampaign.totalBudget} USD</span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 text-center">
                                    <span className="text-[10px] font-black uppercase text-indigo-400 block">Creation Fee</span>
                                    <span className="font-mono font-bold text-indigo-500">
                                        ${(selectedCampaign.baseFeeCharged ?? selectedCampaign.campaignFeeUSD ?? selectedCampaign.baseCampaignFee ?? 0).toFixed(2)} USD
                                    </span>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-2xl border border-purple-200 dark:border-purple-900/40 text-center">
                                    <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-300 block">Total Launch Cost</span>
                                    <span className="font-mono font-extrabold text-purple-700 dark:text-purple-200">
                                        ${((selectedCampaign.totalBudget || 0) + (selectedCampaign.baseFeeCharged ?? selectedCampaign.campaignFeeUSD ?? selectedCampaign.baseCampaignFee ?? 0)).toFixed(2)} USD
                                    </span>
                                </div>
                            </div>

                            {/* Required Worker Proof Requirements (Module A) */}
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                                <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block tracking-wider">Required Worker Proofs (Configured by Campaign Creator)</span>
                                <div className="space-y-2 text-xs">
                                    {selectedCampaign.requiredProofs && Array.isArray(selectedCampaign.requiredProofs) && selectedCampaign.requiredProofs.length > 0 ? (
                                        selectedCampaign.requiredProofs.map((item: any, idx: number) => {
                                            const emoji = item.type === 'screenshot' ? '📸' : 
                                                          item.type === 'text' ? '📝' : 
                                                          item.type === 'username' ? '👤' : 
                                                          item.type === 'userId' ? '🆔' : 
                                                          item.type === 'email' ? '📧' : '✍️';
                                            return (
                                                <div key={item.id || idx} className="flex flex-col gap-1 bg-white dark:bg-gray-800 p-2.5 rounded-xl border dark:border-gray-700">
                                                    <span className="text-emerald-500 font-bold text-[10px] uppercase tracking-wider">{emoji} {item.label}:</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium pl-1">{item.instruction || "Required"}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <>
                                            {selectedCampaign.requireTextProof && (
                                                <div className="flex items-start gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-xl border dark:border-gray-700">
                                                    <span className="text-emerald-500 font-bold shrink-0">📝 Text Proof:</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{selectedCampaign.textProofInstruction || "Required"}</span>
                                                </div>
                                            )}
                                            {selectedCampaign.requireUsername && (
                                                <div className="flex items-start gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-xl border dark:border-gray-700">
                                                    <span className="text-emerald-500 font-bold shrink-0">👤 Username:</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{selectedCampaign.usernameInstruction || "Required"}</span>
                                                </div>
                                            )}
                                            {selectedCampaign.requireUserId && (
                                                <div className="flex items-start gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-xl border dark:border-gray-700">
                                                    <span className="text-emerald-500 font-bold shrink-0">🆔 User ID:</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{selectedCampaign.userIdInstruction || "Required"}</span>
                                                </div>
                                            )}
                                            {selectedCampaign.requireEmail && (
                                                <div className="flex items-start gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-xl border dark:border-gray-700">
                                                    <span className="text-emerald-500 font-bold shrink-0">📧 Email:</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{selectedCampaign.emailInstruction || "Required"}</span>
                                                </div>
                                            )}
                                            {selectedCampaign.requireScreenshot && (
                                                <div className="flex items-start gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-xl border dark:border-gray-700">
                                                    <span className="text-emerald-500 font-bold shrink-0">📸 Screenshot:</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{selectedCampaign.screenshotInstruction || "Required"}</span>
                                                </div>
                                            )}
                                            {!selectedCampaign.requireTextProof && 
                                             !selectedCampaign.requireUsername && 
                                             !selectedCampaign.requireUserId && 
                                             !selectedCampaign.requireEmail && 
                                             !selectedCampaign.requireScreenshot && (
                                                <p className="text-gray-500 italic text-center py-2">No specific structured proofs requested. Workers can supply standard comments/proofs.</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {selectedCampaign.reviewRequested && selectedCampaign.userReviewMessage && (
                                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-1.5">
                                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 block tracking-wider">🔄 Resubmission Note (From Creator)</span>
                                    <p className="text-xs text-indigo-900 dark:text-indigo-300 font-medium bg-white dark:bg-gray-800/60 p-3 rounded-xl border dark:border-gray-700 leading-relaxed italic">
                                        "{selectedCampaign.userReviewMessage}"
                                    </p>
                                </div>
                            )}

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
                                <Button variant="danger" onClick={() => {
                                    const reason = window.prompt("Enter rejection reason (User will be refunded):");
                                    if (reason === null) return;
                                    handleTaskAction(selectedCampaign._id, 'Rejected', reason);
                                    setSelectedCampaign(null);
                                }}>
                                    Reject & Refund
                                </Button>
                            )}
                            <Button variant="secondary" onClick={() => setSelectedCampaign(null)}>Close</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* WORKER SUBMISSION COMPLETE DETAILS MODAL */}
            {selectedSubmissionForDetails && (
                <Modal
                    isOpen={Boolean(selectedSubmissionForDetails)}
                    onClose={() => setSelectedSubmissionForDetails(null)}
                    title="Worker Proof Complete Details"
                >
                    <div className="space-y-6 max-h-[80vh] overflow-y-auto p-1">
                        {/* Header info */}
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-800 space-y-3">
                            <div className="flex justify-between items-start gap-3">
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white text-base">
                                        {selectedSubmissionForDetails.taskTitle || 'Task Campaign'}
                                    </h4>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                        Category: {selectedSubmissionForDetails.taskCategory || 'General'}
                                    </p>
                                </div>
                                {(selectedSubmissionForDetails.isAutoApproved || selectedSubmissionForDetails.autoApproved || selectedSubmissionForDetails.approvalType === 'auto' || (selectedSubmissionForDetails.adminNotes && selectedSubmissionForDetails.adminNotes.toLowerCase().includes('auto-approved'))) ? (
                                    <span className="px-3 py-1 text-xs font-black uppercase rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-sm flex items-center gap-1">
                                        ⚡ Auto Approved
                                    </span>
                                ) : (
                                    <Badge variant={selectedSubmissionForDetails.status === 'Approved' ? 'success' : selectedSubmissionForDetails.status === 'Pending' ? 'warning' : 'danger'}>
                                        {selectedSubmissionForDetails.status}
                                    </Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs border-t dark:border-gray-800 pt-3">
                                <div>
                                    <span className="text-gray-400 block font-bold uppercase text-[10px]">Worker Name & ID</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{selectedSubmissionForDetails.workerName}</span>
                                    <span className="text-[10px] text-gray-400 block font-mono">ID: {selectedSubmissionForDetails.workerId}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-bold uppercase text-[10px]">Reward Amount</span>
                                    <span className="font-bold font-mono text-emerald-500 text-sm">+{selectedSubmissionForDetails.rewardAmount} USD</span>
                                </div>
                            </div>
                        </div>

                        {/* Submitted Proofs Breakdown */}
                        <div className="space-y-3">
                            <h5 className="text-xs uppercase font-black tracking-wider text-gray-400">Worker Submitted Proofs</h5>
                            {selectedSubmissionForDetails.submittedProofs && Array.isArray(selectedSubmissionForDetails.submittedProofs) && selectedSubmissionForDetails.submittedProofs.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedSubmissionForDetails.submittedProofs.map((item: any, idx: number) => {
                                        const isImage = item.type === 'screenshot' || (item.value && (item.value.startsWith('data:') || item.value.startsWith('http')));
                                        return (
                                            <div key={item.id || idx} className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border dark:border-gray-800 text-xs space-y-1.5">
                                                <span className="text-[10px] uppercase font-bold text-blue-500 block">{item.label || item.type}</span>
                                                {isImage ? (
                                                    <div className="space-y-2">
                                                        <a href={item.value} target="_blank" rel="noreferrer" className="inline-block">
                                                            <img src={item.value} alt={item.label || 'Proof Screenshot'} className="max-h-60 rounded-xl border border-gray-200 dark:border-gray-700 object-contain shadow-sm hover:scale-[1.01] transition-transform" />
                                                        </a>
                                                        <a href={item.value} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline font-bold block">
                                                            🔗 Open Image in Full Window
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <p className="font-mono text-gray-800 dark:text-gray-200 break-all p-2 bg-white dark:bg-gray-950 rounded-lg border dark:border-gray-800">
                                                        {item.value}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border dark:border-gray-800 text-xs space-y-2">
                                    <p className="font-mono text-gray-800 dark:text-gray-200">{selectedSubmissionForDetails.proofText || 'No text proof provided'}</p>
                                    {selectedSubmissionForDetails.proofImage && (
                                        <a href={selectedSubmissionForDetails.proofImage} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline font-bold block">
                                            🔗 View Proof Screenshot
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Campaign Dispute Verdict Actions */}
                        {(selectedSubmissionForDetails.status === 'Disputed' || selectedSubmissionForDetails.disputeStage === 'Escalated' || selectedSubmissionForDetails.disputeStage === 'CreatorReview') && selectedSubmissionForDetails.status !== 'Approved' && selectedSubmissionForDetails.status !== 'Paid' && (
                            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-2">
                                <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 block">
                                    ⚖️ Campaign Dispute Verdict Actions (Admin Review):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="success" 
                                        onClick={async () => {
                                            const linkedDisp = state.disputes?.find((d: any) => 
                                                String(d.submissionId) === String(selectedSubmissionForDetails._id) || 
                                                String(d._id) === String(selectedSubmissionForDetails.disputeId) || 
                                                String(d.referenceId) === String(selectedSubmissionForDetails._id)
                                            );
                                            const notes = window.prompt("Enter approval notes for releasing reward to worker:") || "Approved & Released to Worker by Admin";
                                            if (linkedDisp) {
                                                await handleResolveDisputeVerdict(linkedDisp._id, 'ReleaseToWorker', notes);
                                            } else {
                                                await handleSubmissionAction(selectedSubmissionForDetails._id, 'Approved', notes);
                                            }
                                            setSelectedSubmissionForDetails(null);
                                        }}
                                        className="font-bold text-xs uppercase bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        Approve & Release to Worker
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="danger" 
                                        onClick={async () => {
                                            const linkedDisp = state.disputes?.find((d: any) => 
                                                String(d.submissionId) === String(selectedSubmissionForDetails._id) || 
                                                String(d._id) === String(selectedSubmissionForDetails.disputeId) || 
                                                String(d.referenceId) === String(selectedSubmissionForDetails._id)
                                            );
                                            const notes = window.prompt("Enter rejection reason for refunding creator:") || "Rejected by Admin after dispute review";
                                            if (linkedDisp) {
                                                await handleResolveDisputeVerdict(linkedDisp._id, 'RefundToCreator', notes);
                                            } else {
                                                await handleSubmissionAction(selectedSubmissionForDetails._id, 'Rejected', notes);
                                            }
                                            setSelectedSubmissionForDetails(null);
                                        }}
                                        className="font-bold text-xs uppercase bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        Reject & Refund to Creator
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        onClick={async () => {
                                            const linkedDisp = state.disputes?.find((d: any) => 
                                                String(d.submissionId) === String(selectedSubmissionForDetails._id) || 
                                                String(d._id) === String(selectedSubmissionForDetails.disputeId) || 
                                                String(d.referenceId) === String(selectedSubmissionForDetails._id)
                                            );
                                            const notes = window.prompt("Enter notes for 50/50 split payout:") || "50/50 Split Payout by Admin";
                                            if (linkedDisp) {
                                                await handleResolveDisputeVerdict(linkedDisp._id, 'SplitPayout', notes);
                                            } else {
                                                alert("Dispute record not found for split payout.");
                                            }
                                            setSelectedSubmissionForDetails(null);
                                        }}
                                        className="font-bold text-xs uppercase bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        50/50 Split Payout
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Complete Review & Action Timeline */}
                        <div className="space-y-2 pt-2 border-t dark:border-gray-800">
                            <DisputeTimeline 
                                submission={selectedSubmissionForDetails} 
                                dispute={state.disputes?.find((d: any) => 
                                    String(d.submissionId) === String(selectedSubmissionForDetails._id) || 
                                    String(d._id) === String(selectedSubmissionForDetails.disputeId) || 
                                    String(d.referenceId) === String(selectedSubmissionForDetails._id)
                                )} 
                                settings={settings} 
                                isAdmin={true} 
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                            {selectedSubmissionForDetails.status === 'Pending' && (
                                <Button variant="primary" onClick={() => { handleSubmissionAction(selectedSubmissionForDetails._id, 'Approved'); setSelectedSubmissionForDetails(null); }}>
                                    Approve & Pay
                                </Button>
                            )}
                            {selectedSubmissionForDetails.status !== 'Rejected' && (
                                <Button variant="danger" onClick={() => {
                                    const reason = window.prompt("Enter rejection reason:");
                                    if (reason === null) return;
                                    handleSubmissionAction(selectedSubmissionForDetails._id, 'Rejected', reason);
                                    setSelectedSubmissionForDetails(null);
                                }}>
                                    Reject Proof
                                </Button>
                            )}
                            <Button variant="secondary" onClick={() => setSelectedSubmissionForDetails(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

interface ResetWorkAndEarnSectionProps {
    users: any[];
    investmentPlans: any[];
    settings: any;
    dispatch: any;
}

const ResetWorkAndEarnSection: React.FC<ResetWorkAndEarnSectionProps> = ({ users, investmentPlans, settings, dispatch }) => {
    const [resetMode, setResetMode] = useState<'manual' | 'plan' | 'allowed_access' | 'all'>('manual');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [activePlanFilter, setActivePlanFilter] = useState<string>('all');
    const [allowedAccessFilter, setAllowedAccessFilter] = useState<'all' | 'allowed' | 'not_allowed'>('all');
    const [searchUserText, setSearchUserText] = useState('');
    const [isExecutingReset, setIsExecutingReset] = useState(false);
    const [adminConfirmationText, setSearchAdminConfirmationText] = useState('');

    // Checkbox options for granular items deletion
    const [resetOptions, setResetOptions] = useState({
        resetBalances: true,
        submissions: true,
        campaigns: true,
        transactions: true,
        logs: true,
        disputes: true,
        hubWithdrawals: true,
        hubDeposits: true,
        notifications: true,
    });

    const regularUsers = (users || []).filter(u => u.role === 'user');

    const allowedUserIdsSet = new Set(settings?.userTaskAllowedUserIds || []);

    const filteredUsers = regularUsers.filter(user => {
        // Search text
        if (searchUserText.trim()) {
            const q = searchUserText.toLowerCase();
            const name = (user.fullName || user.username || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            if (!name.includes(q) && !email.includes(q)) return false;
        }

        // Active plan filter
        if (activePlanFilter !== 'all') {
            if (activePlanFilter === 'none') {
                if (user.activePlan && user.activePlan !== 'None' && user.activePlan !== '') return false;
            } else {
                if (user.activePlan !== activePlanFilter) return false;
            }
        }

        // Allowed access filter
        if (allowedAccessFilter === 'allowed') {
            if (!allowedUserIdsSet.has(user._id)) return false;
        } else if (allowedAccessFilter === 'not_allowed') {
            if (allowedUserIdsSet.has(user._id)) return false;
        }

        return true;
    });

    const handleToggleSelectUser = (id: string) => {
        if (selectedUserIds.includes(id)) {
            setSelectedUserIds(selectedUserIds.filter(i => i !== id));
        } else {
            setSelectedUserIds([...selectedUserIds, id]);
        }
    };

    const handleSelectAllFiltered = () => {
        const allFilteredIds = filteredUsers.map(u => u._id);
        const allSelected = allFilteredIds.every(id => selectedUserIds.includes(id));
        if (allSelected) {
            setSelectedUserIds(selectedUserIds.filter(id => !allFilteredIds.includes(id)));
        } else {
            const union = Array.from(new Set([...selectedUserIds, ...allFilteredIds]));
            setSelectedUserIds(union);
        }
    };

    const handleToggleOption = (key: keyof typeof resetOptions) => {
        setResetOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSelectAllOptions = (value: boolean) => {
        setResetOptions({
            resetBalances: value,
            submissions: value,
            campaigns: value,
            transactions: value,
            logs: value,
            disputes: value,
            hubWithdrawals: value,
            hubDeposits: value,
            notifications: value,
        });
    };

    const areAllOptionsSelected = Object.values(resetOptions).every(Boolean);

    const handleExecuteReset = async () => {
        if (adminConfirmationText.trim().toUpperCase() !== 'RESET ERASE WORK AND EARN') {
            alert('Please type "RESET ERASE WORK AND EARN" in the confirmation box to proceed.');
            return;
        }

        if (!Object.values(resetOptions).some(Boolean)) {
            alert('Please select at least one item category to delete/reset.');
            return;
        }

        let userIdsToReset: string[] = [];
        let payload: any = { resetOptions };

        if (resetMode === 'manual') {
            if (selectedUserIds.length === 0) {
                alert('Please select at least one user to reset manually.');
                return;
            }
            userIdsToReset = selectedUserIds;
            payload.userIds = userIdsToReset;
        } else if (resetMode === 'plan') {
            if (activePlanFilter === 'all') {
                alert('Please select a specific active plan filter or switch mode.');
                return;
            }
            payload.resetAllMatching = true;
            payload.activePlanFilter = activePlanFilter;
        } else if (resetMode === 'allowed_access') {
            if (allowedAccessFilter === 'all') {
                alert('Please select whether to target Allowed or Not Allowed users.');
                return;
            }
            payload.resetAllMatching = true;
            payload.allowedAccessFilter = allowedAccessFilter;
        } else if (resetMode === 'all') {
            if (!window.confirm('CRITICAL WARNING: You are about to erase selected Work & Earn data for ALL members internationally. Continue?')) {
                return;
            }
            payload.resetAllMatching = true;
        }

        setIsExecutingReset(true);
        try {
            const res = await adminResetWorkAndEarnData(payload);
            alert(res.message || 'Work and Earn data reset completed successfully!');
            setSelectedUserIds([]);
            setSearchAdminConfirmationText('');
            window.location.reload();
        } catch (error) {
            alert(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsExecutingReset(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Mode Selector */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <button
                    type="button"
                    onClick={() => setResetMode('manual')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        resetMode === 'manual'
                            ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-md'
                            : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                    <span className="block text-xs font-black uppercase mb-1">🎯 Select Manually</span>
                    <span className="text-[11px] font-normal block opacity-80">Pick specific users via checklist</span>
                </button>

                <button
                    type="button"
                    onClick={() => setResetMode('plan')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        resetMode === 'plan'
                            ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-md'
                            : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                    <span className="block text-xs font-black uppercase mb-1">💎 Filter By Active Plan</span>
                    <span className="text-[11px] font-normal block opacity-80">Target users holding a specific plan</span>
                </button>

                <button
                    type="button"
                    onClick={() => setResetMode('allowed_access')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        resetMode === 'allowed_access'
                            ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-md'
                            : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                    <span className="block text-xs font-black uppercase mb-1">🔒 Filter By Allowed Show</span>
                    <span className="text-[11px] font-normal block opacity-80">Target users selected/shown by admin</span>
                </button>

                <button
                    type="button"
                    onClick={() => setResetMode('all')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        resetMode === 'all'
                            ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-md'
                            : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                    <span className="block text-xs font-black uppercase mb-1">🌐 International Reset (All)</span>
                    <span className="text-[11px] font-normal block opacity-80">Erase module data for ALL users</span>
                </button>
            </div>

            {/* Filters Section */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700 space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Filter Controls</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search query */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Search User (Name/Email)</label>
                        <input
                            type="text"
                            value={searchUserText}
                            onChange={(e) => setSearchUserText(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium"
                        />
                    </div>

                    {/* Active Plan Filter */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Filter by Active Plan</label>
                        <select
                            value={activePlanFilter}
                            onChange={(e) => setActivePlanFilter(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium"
                        >
                            <option value="all">All Plans (No Filter)</option>
                            <option value="none">No Active Plan (None)</option>
                            {(investmentPlans || []).map((p: any) => (
                                <option key={p._id || p.name} value={p.name}>{p.name} (${p.minInvestment || p.price || 0})</option>
                            ))}
                        </select>
                    </div>

                    {/* Allowed Access Filter */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Filter by Show / Allowed Access</label>
                        <select
                            value={allowedAccessFilter}
                            onChange={(e) => setAllowedAccessFilter(e.target.value as any)}
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium"
                        >
                            <option value="all">All Users (Allowed & Not Allowed)</option>
                            <option value="allowed">Selected / Allowed Users Only</option>
                            <option value="not_allowed">Not Selected / Not Allowed Users</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2 text-xs font-bold text-gray-500 border-t dark:border-gray-800">
                    <span>Matching Users Found: <strong className="text-blue-600 dark:text-blue-400">{filteredUsers.length}</strong></span>
                    {resetMode === 'manual' && (
                        <button
                            type="button"
                            onClick={handleSelectAllFiltered}
                            className="text-blue-600 hover:underline font-bold uppercase"
                        >
                            Select / Deselect All Filtered ({filteredUsers.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Manual Checklist Selection */}
            {resetMode === 'manual' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Select Users to Reset ({selectedUserIds.length} Selected)
                        </span>
                    </div>

                    <div className="max-h-72 overflow-y-auto border dark:border-gray-700 rounded-2xl p-3 bg-white dark:bg-gray-900/40 space-y-2">
                        {filteredUsers.length === 0 ? (
                            <p className="text-xs text-gray-400 p-4 text-center italic">No matching users found.</p>
                        ) : (
                            filteredUsers.map(user => {
                                const isSelected = selectedUserIds.includes(user._id);
                                const isAllowed = allowedUserIdsSet.has(user._id);
                                return (
                                    <div
                                        key={user._id}
                                        onClick={() => handleToggleSelectUser(user._id)}
                                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                            isSelected
                                                ? 'bg-red-500/10 border-red-500'
                                                : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="w-4 h-4 rounded text-red-600 border-gray-300 focus:ring-red-500"
                                            />
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">
                                                    {user.fullName || user.username} <span className="text-[10px] text-gray-400 font-mono">(@{user.username})</span>
                                                </p>
                                                <p className="text-[10px] text-gray-500">
                                                    Email: {user.email} • Plan: <strong className="text-indigo-500">{user.activePlan || 'None'}</strong>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isAllowed ? (
                                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                    ✓ Admin Allowed
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-gray-500/10 text-gray-500">
                                                    Not Selected
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Granular Items Selection Checkboxes */}
            <div className="p-6 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b dark:border-gray-800 pb-3 flex-wrap gap-2">
                    <div>
                        <h4 className="text-sm font-black uppercase text-gray-900 dark:text-white flex items-center gap-2">
                            <span>🛠️</span> Select Data & Status Categories to Delete / Reset
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                            Choose specific Work & Earn module records, logs, or account statuses to erase for selected user(s).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSelectAllOptions(!areAllOptionsSelected)}
                        className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                    >
                        {areAllOptionsSelected ? 'Deselect All Items' : 'Select All Items'}
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.resetBalances ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.resetBalances} onChange={() => handleToggleOption('resetBalances')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">💳 Reset Balances to $0.00</span>
                            <span className="text-[10px] opacity-75 font-normal">Set Task Wallet & Task Earnings to $0.00</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.submissions ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.submissions} onChange={() => handleToggleOption('submissions')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">📝 Task Submissions & Proofs</span>
                            <span className="text-[10px] opacity-75 font-normal">Delete completed task proofs & submissions</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.campaigns ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.campaigns} onChange={() => handleToggleOption('campaigns')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">📢 Campaign Listings Created</span>
                            <span className="text-[10px] opacity-75 font-normal">Erase member-created task campaigns</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.transactions ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.transactions} onChange={() => handleToggleOption('transactions')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">📊 Task Financial Transactions</span>
                            <span className="text-[10px] opacity-75 font-normal">Delete reward history & task budget transactions</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.logs ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.logs} onChange={() => handleToggleOption('logs')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">📜 Work & Earn Activity Logs</span>
                            <span className="text-[10px] opacity-75 font-normal">Purge audit logs & task activity history</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.disputes ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.disputes} onChange={() => handleToggleOption('disputes')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">⚖️ Task Disputes & Appeals</span>
                            <span className="text-[10px] opacity-75 font-normal">Remove dispute logs & review threads</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.hubWithdrawals ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.hubWithdrawals} onChange={() => handleToggleOption('hubWithdrawals')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">🏦 Task Hub Withdrawals</span>
                            <span className="text-[10px] opacity-75 font-normal">Delete pending/completed hub withdrawal records</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.hubDeposits ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.hubDeposits} onChange={() => handleToggleOption('hubDeposits')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">📥 Task Hub Deposits</span>
                            <span className="text-[10px] opacity-75 font-normal">Delete campaign deposit funding records</span>
                        </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${resetOptions.notifications ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-bold' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <input type="checkbox" checked={resetOptions.notifications} onChange={() => handleToggleOption('notifications')} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
                        <div className="text-xs">
                            <span className="block font-black">🔔 Task System Notifications</span>
                            <span className="text-[10px] opacity-75 font-normal">Purge prior task alerts & notifications</span>
                        </div>
                    </label>
                </div>
            </div>

            {/* Confirmation Box */}
            <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-2xl border border-red-200 dark:border-red-900/50 space-y-4">
                <span className="text-xs font-black uppercase text-red-600 dark:text-red-400 block tracking-wide">
                    ⚠️ Admin Safety Confirmation & Execution
                </span>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                    Executing this action will permanently delete all created campaigns, task submission proofs, disputes, and task transaction history for the target users, and reset their Work & Earn Task Wallet balances to $0.00 USD.
                </p>

                <div>
                    <label className="block text-xs font-bold uppercase text-red-800 dark:text-red-300 mb-1">
                        Type <strong className="underline">RESET ERASE WORK AND EARN</strong> to authorize:
                    </label>
                    <input
                        type="text"
                        value={adminConfirmationText}
                        onChange={(e) => setSearchAdminConfirmationText(e.target.value)}
                        placeholder="RESET ERASE WORK AND EARN"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-mono font-bold text-sm tracking-wider"
                    />
                </div>

                <Button
                    type="button"
                    variant="danger"
                    isLoading={isExecutingReset}
                    disabled={adminConfirmationText.trim().toUpperCase() !== 'RESET ERASE WORK AND EARN'}
                    onClick={handleExecuteReset}
                    className="w-full py-4 text-base font-black uppercase tracking-wider"
                >
                    🔄 Confirm & Erase Work and Earn Journey
                </Button>
            </div>
        </div>
    );
};

export default AdminUserTasks;
