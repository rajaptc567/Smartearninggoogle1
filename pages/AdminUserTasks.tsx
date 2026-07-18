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

    const [activeTab, setActiveTab] = useState<'campaigns' | 'submissions' | 'rates' | 'proof-limits'>('campaigns');

    // Category Preset State & Actions
    const [localPresets, setLocalPresets] = useState<any>(() => {
        return settings.taskCategoryPresets || {
            youtube: {
                subscriber: { minPayout: 0.02, minSlots: 50 },
                comments: { minPayout: 0.04, minSlots: 10 },
                likes: { minPayout: 0.01, minSlots: 10 },
                watchTimeTiers: [
                    { duration: '5 Seconds', minPayout: 0.005, minSlots: 100 },
                    { duration: '10 Seconds', minPayout: 0.010, minSlots: 100 },
                    { duration: '15 Seconds', minPayout: 0.015, minSlots: 50 },
                    { duration: '30 Seconds', minPayout: 0.025, minSlots: 50 },
                    { duration: '1 Minute', minPayout: 0.050, minSlots: 20 },
                    { duration: '5 Minutes', minPayout: 0.150, minSlots: 10 }
                ]
            },
            facebook: {
                likeFollow: { minPayout: 0.02, minSlots: 50 },
                videoLike: { minPayout: 0.01, minSlots: 50 },
                comments: { minPayout: 0.03, minSlots: 10 },
                watchTimeTiers: [
                    { duration: '30 Seconds', minPayout: 0.015, minSlots: 50 },
                    { duration: '1 Minute', minPayout: 0.030, minSlots: 30 },
                    { duration: '3 Minutes', minPayout: 0.080, minSlots: 20 }
                ]
            },
            instagram: {
                profileFollow: { minPayout: 0.015, minSlots: 50 },
                postLike: { minPayout: 0.008, minSlots: 100 },
                reelView: { minPayout: 0.005, minSlots: 100 },
                comments: { minPayout: 0.03, minSlots: 10 }
            },
            google: {
                reviews: { minPayout: 0.20, minSlots: 5 }
            },
            paidSignUp: {
                simpleSignUp: { minPayout: 0.10, minSlots: 10 },
                activePlanPurchase: { minPayout: 0.50, minSlots: 5 }
            }
        };
    });

    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [newCatKey, setNewCatKey] = useState('');
    const [newCatDisplayName, setNewCatDisplayName] = useState('');

    const [newSubKey, setNewSubKey] = useState('');
    const [newSubDisplayName, setNewSubDisplayName] = useState('');
    const [newSubMinPayout, setNewSubMinPayout] = useState(0.05);
    const [newSubMinSlots, setNewSubMinSlots] = useState(10);

    const [newTierDuration, setNewTierDuration] = useState('');
    const [newTierMinPayout, setNewTierMinPayout] = useState(0.01);
    const [newTierMinSlots, setNewTierMinSlots] = useState(50);

    const [isSavingPresets, setIsSavingPresets] = useState(false);

    const handleUpdateCategoryName = (catKey: string, newName: string) => {
        setLocalPresets((prev: any) => ({
            ...prev,
            [catKey]: {
                ...prev[catKey],
                displayName: newName
            }
        }));
    };

    const handleAddCategory = () => {
        if (!newCatKey.trim() || !newCatDisplayName.trim()) return alert("Please fill key and name.");
        const key = newCatKey.trim().toLowerCase().replace(/\s+/g, '');
        if (localPresets[key]) return alert("Category with this key already exists!");
        
        setLocalPresets((prev: any) => ({
            ...prev,
            [key]: {
                displayName: newCatDisplayName,
                enabled: true
            }
        }));
        setNewCatKey('');
        setNewCatDisplayName('');
        setExpandedCategory(key);
        alert("New category added successfully!");
    };

    const handleDeleteCategory = (catKey: string) => {
        if (!window.confirm(`Are you sure you want to delete the category "${localPresets[catKey]?.displayName || catKey}" and all of its subcategories?`)) return;
        setLocalPresets((prev: any) => {
            const next = { ...prev };
            delete next[catKey];
            return next;
        });
        if (expandedCategory === catKey) setExpandedCategory(null);
    };

    const handleUpdateSubcategory = (catKey: string, subKey: string, field: string, value: any) => {
        setLocalPresets((prev: any) => {
            const cat = prev[catKey];
            const sub = cat[subKey] || {};
            return {
                ...prev,
                [catKey]: {
                    ...cat,
                    [subKey]: {
                        ...sub,
                        [field]: value
                    }
                }
            };
        });
    };

    const handleUpdateWatchTimeTier = (catKey: string, index: number, field: string, value: any) => {
        setLocalPresets((prev: any) => {
            const cat = prev[catKey];
            const tiers = [...(cat.watchTimeTiers || [])];
            tiers[index] = {
                ...tiers[index],
                [field]: value
            };
            return {
                ...prev,
                [catKey]: {
                    ...cat,
                    watchTimeTiers: tiers
                }
            };
        });
    };

    const handleAddSubcategory = (catKey: string) => {
        if (!newSubKey.trim() || !newSubDisplayName.trim()) return alert("Please fill subcategory key and display name.");
        const key = newSubKey.trim().toLowerCase().replace(/\s+/g, '');
        const cat = localPresets[catKey] || {};
        if (cat[key] || key === 'watchtimetiers') return alert("Subcategory key already exists or is reserved.");

        setLocalPresets((prev: any) => ({
            ...prev,
            [catKey]: {
                ...prev[catKey],
                [key]: {
                    displayName: newSubDisplayName,
                    minPayout: Number(newSubMinPayout),
                    minSlots: Number(newSubMinSlots)
                }
            }
        }));
        setNewSubKey('');
        setNewSubDisplayName('');
        setNewSubMinPayout(0.05);
        setNewSubMinSlots(10);
        alert("Subcategory added successfully!");
    };

    const handleDeleteSubcategory = (catKey: string, subKey: string) => {
        if (!window.confirm("Are you sure you want to delete this subcategory?")) return;
        setLocalPresets((prev: any) => {
            const cat = { ...prev[catKey] };
            delete cat[subKey];
            return {
                ...prev,
                [catKey]: cat
            };
        });
    };

    const handleAddWatchTimeTier = (catKey: string) => {
        if (!newTierDuration.trim()) return alert("Please enter duration.");
        setLocalPresets((prev: any) => {
            const cat = prev[catKey] || {};
            const tiers = [...(cat.watchTimeTiers || [])];
            tiers.push({
                duration: newTierDuration.trim(),
                minPayout: Number(newTierMinPayout),
                minSlots: Number(newTierMinSlots)
            });
            return {
                ...prev,
                [catKey]: {
                    ...cat,
                    watchTimeTiers: tiers
                }
            };
        });
        setNewTierDuration('');
        setNewTierMinPayout(0.01);
        setNewTierMinSlots(50);
        alert("Watch time tier added successfully!");
    };

    const handleDeleteWatchTimeTier = (catKey: string, index: number) => {
        if (!window.confirm("Are you sure you want to delete this watch time tier?")) return;
        setLocalPresets((prev: any) => {
            const cat = prev[catKey] || {};
            const tiers = [...(cat.watchTimeTiers || [])];
            tiers.splice(index, 1);
            return {
                ...prev,
                [catKey]: {
                    ...cat,
                    watchTimeTiers: tiers
                }
            };
        });
    };

    const handleSavePresets = async () => {
        setIsSavingPresets(true);
        try {
            const updatedSettings = {
                ...settings,
                taskCategoryPresets: localPresets
            };
            const result = await updateSettings(updatedSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: result });
            alert("Category and Subcategory presets updated successfully platform-wide!");
        } catch (error) {
            alert(`Failed to save categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSavingPresets(false);
        }
    };

    // Settings State
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isUserTaskEnabled, setIsUserTaskEnabled] = useState(settings.isUserTaskEnabled ?? true);
    const [minQuantity, setMinQuantity] = useState(settings.userTaskConfig?.minQuantity ?? 5);
    const [minRewardAmount, setMinRewardAmount] = useState(settings.userTaskConfig?.minRewardAmount ?? 0.10);
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
    const [isSavingProofLimits, setIsSavingProofLimits] = useState(false);

    const handleSaveProofLimits = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProofLimits(true);
        try {
            const updatedSettings = {
                ...settings,
                userTaskProofLimits: localProofLimits
            };
            const result = await updateSettings(updatedSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: result });
            alert('Duplicate proof limits updated successfully!');
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
                    minQuantity: Number(minQuantity),
                    minRewardAmount: Number(minRewardAmount),
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
            const updated = await updateSubmissionStatus(subId, { status, adminNotes: reason !== undefined ? reason : adminNotes });
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
                        <Button variant={activeTab === 'proof-limits' ? 'primary' : 'secondary'} onClick={() => setActiveTab('proof-limits')}>
                            Proof Limits
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
                                                <td className="p-4 font-mono text-emerald-500 font-bold">{task.totalBudget} USD</td>
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
                                                        <Badge variant={sub.status === 'Approved' ? 'success' : sub.status === 'Pending' ? 'warning' : 'danger'}>
                                                            {sub.status === 'Approved' ? '✅ Accepted' : sub.status === 'Pending' ? '⏳ Pending' : '❌ Rejected'}
                                                        </Badge>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {sub.status === 'Approved' && (
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Approved by Campaign Creator @{creatorName}</span>
                                                            )}
                                                            {sub.status === 'Rejected' && (
                                                                <div className="text-red-500 dark:text-red-400 font-medium">
                                                                    <div>Rejected by @{creatorName}</div>
                                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 italic">Reason: "{sub.adminNotes || 'No reason specified'}"</div>
                                                                </div>
                                                            )}
                                                            {sub.status === 'Pending' && (
                                                                <span className="text-amber-600 dark:text-amber-400 font-medium">Awaiting Creator review</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 space-x-2">
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

            {activeTab === 'categories' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Category & Preset Management</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Create new categories, rename existing platforms, and manually write or adjust the subcategory min payouts and min slots configurations.
                            </p>
                        </div>
                        <Button 
                            variant="primary" 
                            isLoading={isSavingPresets} 
                            onClick={handleSavePresets}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-emerald-500/10 hover:scale-[1.02] transition-transform"
                        >
                            💾 Save All Category Presets
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Pane: Add Category & Platforms List */}
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-3xl p-6 shadow-xl border border-blue-500/20 space-y-4">
                                <h4 className="text-lg font-bold uppercase tracking-wider text-blue-300">🆕 Add Custom Category</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-blue-200 mb-1">Unique Key (e.g. telegram, twitter)</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. tiktok"
                                            value={newCatKey}
                                            onChange={(e) => setNewCatKey(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300/50 font-medium text-sm focus:outline-none focus:border-white/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-blue-200 mb-1">Platform Display Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. TikTok"
                                            value={newCatDisplayName}
                                            onChange={(e) => setNewCatDisplayName(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300/50 font-medium text-sm focus:outline-none focus:border-white/50"
                                        />
                                    </div>
                                    <Button 
                                        onClick={handleAddCategory}
                                        className="w-full py-3 bg-white text-blue-900 hover:bg-blue-50 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                                    >
                                        Create Platform Category
                                    </Button>
                                </div>
                            </div>

                            {/* Existing platforms navigation list */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border dark:border-gray-700 space-y-3">
                                <h4 className="text-sm font-black uppercase tracking-wider text-gray-400">Platform Categories</h4>
                                <div className="space-y-2">
                                    {Object.keys(localPresets).map(key => {
                                        const cat = localPresets[key];
                                        const displayName = cat.displayName || key.charAt(0).toUpperCase() + key.slice(1);
                                        const subCount = Object.keys(cat).filter(k => k !== 'displayName' && k !== 'enabled' && k !== 'watchTimeTiers').length;
                                        const hasTiers = !!cat.watchTimeTiers && cat.watchTimeTiers.length > 0;

                                        return (
                                            <div 
                                                key={key}
                                                onClick={() => setExpandedCategory(key)}
                                                className={`p-4 rounded-2xl flex justify-between items-center cursor-pointer border transition-all ${
                                                    expandedCategory === key 
                                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' 
                                                        : 'bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50 border-transparent text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                <div>
                                                    <span className="block text-sm font-bold">{displayName}</span>
                                                    <span className="text-[10px] font-mono text-gray-400">Key: {key} • {subCount} subcategories {hasTiers ? '+ video tiers' : ''}</span>
                                                </div>
                                                <span className="text-xs">➔</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right Pane: Subcategories Management inside the active category */}
                        <div className="lg:col-span-2 space-y-6">
                            {expandedCategory && localPresets[expandedCategory] ? (() => {
                                const catKey = expandedCategory;
                                const cat = localPresets[catKey];
                                const displayName = cat.displayName || catKey.charAt(0).toUpperCase() + catKey.slice(1);
                                const subKeys = Object.keys(cat).filter(k => k !== 'displayName' && k !== 'enabled' && k !== 'watchTimeTiers');

                                return (
                                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl border dark:border-gray-700 space-y-8 animate-in fade-in duration-200">
                                        {/* Category Title & Delete Section */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b dark:border-gray-700 pb-6">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase text-blue-500">Currently Editing Platform Category</span>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="text" 
                                                        value={displayName}
                                                        onChange={(e) => handleUpdateCategoryName(catKey, e.target.value)}
                                                        className="text-2xl font-black text-gray-950 dark:text-white bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 py-0.5"
                                                    />
                                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-900 px-2.5 py-1 rounded-lg">Key: {catKey}</span>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="danger" 
                                                onClick={() => handleDeleteCategory(catKey)}
                                                className="text-xs py-2.5 px-4 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white border border-red-500/20"
                                            >
                                                🗑️ Delete Category
                                            </Button>
                                        </div>

                                        {/* Subcategories Editor */}
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-base font-bold uppercase tracking-tight text-gray-900 dark:text-white">Subcategories ({subKeys.length})</h5>
                                            </div>

                                            {subKeys.length === 0 ? (
                                                <p className="text-sm italic text-gray-400 bg-gray-50/50 dark:bg-gray-900/10 p-4 rounded-xl text-center">No subcategories defined yet. Write and add one below!</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {subKeys.map(subKey => {
                                                        const sub = cat[subKey] || {};
                                                        return (
                                                            <div key={subKey} className="p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border dark:border-gray-700 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                                                <div className="space-y-1.5 flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <input 
                                                                            type="text" 
                                                                            value={sub.displayName || subKey.charAt(0).toUpperCase() + subKey.slice(1)}
                                                                            onChange={(e) => handleUpdateSubcategory(catKey, subKey, 'displayName', e.target.value)}
                                                                            className="font-bold text-gray-900 dark:text-white bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 text-sm py-0.5 max-w-[150px]"
                                                                            placeholder="Subcategory Name"
                                                                        />
                                                                        <span className="text-[10px] font-mono text-gray-400">({subKey})</span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                                                                    <div className="w-28">
                                                                        <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Min USD Payout</label>
                                                                        <input 
                                                                            type="number" 
                                                                            step="0.001"
                                                                            min="0.001"
                                                                            value={sub.minPayout ?? 0.05}
                                                                            onChange={(e) => handleUpdateSubcategory(catKey, subKey, 'minPayout', Number(e.target.value))}
                                                                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold text-emerald-500 font-mono"
                                                                        />
                                                                    </div>

                                                                    <div className="w-24">
                                                                        <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Min Slots</label>
                                                                        <input 
                                                                            type="number" 
                                                                            min="1"
                                                                            value={sub.minSlots ?? 10}
                                                                            onChange={(e) => handleUpdateSubcategory(catKey, subKey, 'minSlots', Number(e.target.value))}
                                                                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold text-gray-900 dark:text-white font-mono"
                                                                        />
                                                                    </div>

                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => handleDeleteSubcategory(catKey, subKey)}
                                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all self-end md:self-auto"
                                                                        title="Delete subcategory"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Form to manually write and add a subcategory */}
                                            <div className="p-5 bg-blue-50/20 dark:bg-blue-950/10 rounded-2xl border border-blue-500/10 space-y-4">
                                                <h6 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">➕ Add New Subcategory</h6>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-gray-500 mb-1">Unique Key (e.g. follow, comment)</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. retweets"
                                                            value={newSubKey}
                                                            onChange={(e) => setNewSubKey(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-gray-500 mb-1">Display Name</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. Retweet Post"
                                                            value={newSubDisplayName}
                                                            onChange={(e) => setNewSubDisplayName(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-gray-500 mb-1">Min Payout per task (USD)</label>
                                                        <input 
                                                            type="number" 
                                                            step="0.001"
                                                            value={newSubMinPayout}
                                                            onChange={(e) => setNewSubMinPayout(Number(e.target.value))}
                                                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium text-emerald-500 font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-gray-500 mb-1">Min Target slots (Completions)</label>
                                                        <input 
                                                            type="number" 
                                                            value={newSubMinSlots}
                                                            onChange={(e) => setNewSubMinSlots(Number(e.target.value))}
                                                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                <Button 
                                                    onClick={() => handleAddSubcategory(catKey)}
                                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                                                >
                                                    Add Subcategory Preset
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Watch Time Tiers Editor (if YouTube or custom platforms request duration-based tiers) */}
                                        <div className="space-y-6 pt-6 border-t dark:border-gray-700">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-base font-bold uppercase tracking-tight text-gray-900 dark:text-white">Watch Time Tiers</h5>
                                            </div>

                                            {(!cat.watchTimeTiers || cat.watchTimeTiers.length === 0) ? (
                                                <p className="text-sm italic text-gray-400 bg-gray-50/50 dark:bg-gray-900/10 p-4 rounded-xl text-center">No video watch time tiers configured for this category.</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {cat.watchTimeTiers.map((tier: any, index: number) => (
                                                        <div key={index} className="p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border dark:border-gray-700 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                                            <div className="space-y-1 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <input 
                                                                        type="text" 
                                                                        value={tier.duration}
                                                                        onChange={(e) => handleUpdateWatchTimeTier(catKey, index, 'duration', e.target.value)}
                                                                        className="font-bold text-gray-900 dark:text-white bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 text-sm py-0.5"
                                                                        placeholder="e.g. 1 Minute"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                                                                    <div className="w-28">
                                                                        <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Min USD Payout</label>
                                                                        <input 
                                                                            type="number" 
                                                                            step="0.001"
                                                                            min="0.001"
                                                                            value={tier.minPayout ?? 0.01}
                                                                            onChange={(e) => handleUpdateWatchTimeTier(catKey, index, 'minPayout', Number(e.target.value))}
                                                                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold text-emerald-500 font-mono"
                                                                        />
                                                                    </div>

                                                                    <div className="w-24">
                                                                        <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Min Slots</label>
                                                                        <input 
                                                                            type="number" 
                                                                            min="1"
                                                                            value={tier.minSlots ?? 50}
                                                                            onChange={(e) => handleUpdateWatchTimeTier(catKey, index, 'minSlots', Number(e.target.value))}
                                                                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold text-gray-900 dark:text-white font-mono"
                                                                        />
                                                                    </div>

                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => handleDeleteWatchTimeTier(catKey, index)}
                                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all self-end md:self-auto"
                                                                        title="Delete tier"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Form to add a watch time tier */}
                                            <div className="p-5 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl border border-indigo-500/10 space-y-4">
                                                <h6 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">➕ Add New Video Watch Time Tier</h6>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-gray-500 mb-1">Tier Duration (e.g. 10 Minutes)</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. 2 Minutes"
                                                            value={newTierDuration}
                                                            onChange={(e) => setNewTierDuration(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-gray-500 mb-1">Min Payout per Task (USD)</label>
                                                        <input 
                                                            type="number" 
                                                            step="0.001"
                                                            value={newTierMinPayout}
                                                            onChange={(e) => setNewTierMinPayout(Number(e.target.value))}
                                                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium text-emerald-500 font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase text-gray-500 mb-1">Min Target slots (slots)</label>
                                                        <input 
                                                            type="number" 
                                                            value={newTierMinSlots}
                                                            onChange={(e) => setNewTierMinSlots(Number(e.target.value))}
                                                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                <Button 
                                                    onClick={() => handleAddWatchTimeTier(catKey)}
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                                                >
                                                    Add Watch Time Tier
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-12 text-center text-gray-400 border dark:border-gray-700 shadow-xl font-medium">
                                    💡 Click on a Platform Category in the list on the left to edit and manually write categories/subcategories.
                                </div>
                            )}
                        </div>
                    </div>
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
        </div>
    );
};

export default AdminUserTasks;
