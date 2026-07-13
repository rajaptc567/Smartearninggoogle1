import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, UserTask } from '../../types';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { createUserTask, submitUserTaskProof, convertUserCurrency, createDispute } from '../../services/api';
import { canUserAccessTasks } from '../../src/utils/taskAccess';
import { Link } from 'react-router-dom';

const UserTasksSubmit: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, userTasks, userTaskSubmissions, settings } = state;

    const [activeTab, setActiveTab] = useState<'submit' | 'browse' | 'my-tasks' | 'pending-payment' | 'completed-tasks' | 'converter'>('browse');

    // Dispute State
    const [selectedSubmissionForDispute, setSelectedSubmissionForDispute] = useState<any | null>(null);
    const [disputeDescription, setDisputeDescription] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Create Campaign Form State
    const [category, setCategory] = useState<'Facebook' | 'YouTube' | 'WhatsApp' | 'Website' | 'Other'>('YouTube');
    const [subType, setSubType] = useState<'Comment' | 'Like' | 'Follow' | 'Subscribe' | 'Watch Time' | 'Sign-up' | 'Share' | 'Other'>('Subscribe');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');
    const [targetQuantity, setTargetQuantity] = useState<number>(10);
    const [rewardPerTask, setRewardPerTask] = useState<number>(0.10); // in USD
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Proof Submission State
    const [selectedTaskForProof, setSelectedTaskForProof] = useState<UserTask | null>(null);
    const [proofText, setProofText] = useState('');
    const [proofImage, setProofImage] = useState('');
    const [isSubmittingProof, setIsSubmittingProof] = useState(false);

    const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];
    const allowedCurrency = currentUser.currency || (currentUser.country === 'Pakistan' ? 'PKR' : europeanCountries.includes(currentUser.country) ? 'EUR' : 'USD');

    // Currency Converter State
    const [convertAmount, setConvertAmount] = useState<number>(10);
    const [fromCurrency] = useState<string>('USD');
    const [toCurrency, setToCurrency] = useState<string>(allowedCurrency);
    const [conversionResult, setConversionResult] = useState<any>(null);
    const [isConverting, setIsConverting] = useState(false);

    if (!currentUser) return null;

    const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10 };
    const isEnabled = settings.isUserTaskEnabled ?? true;
    const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };

    // Entire setup in USD for tasks
    const subtotal = targetQuantity * rewardPerTask; // in USD
    const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
    const totalBudgetUSD = Number((subtotal + adminCommission).toFixed(2));

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEnabled) return alert('User task submissions are currently disabled.');
        if (!title || !link) return alert('Please fill in title and target link.');
        if (targetQuantity < config.minQuantity) return alert(`Minimum target quantity is ${config.minQuantity}.`);
        if (rewardPerTask < config.minRewardAmount) return alert(`Minimum reward per task is ${config.minRewardAmount} USD.`);

        // Convert totalBudgetUSD to user currency for balance verification
        const userCurr = currentUser.currency || 'USD';
        let budgetInUserCurr = totalBudgetUSD * (rates[userCurr] || 1);
        budgetInUserCurr = Number(budgetInUserCurr.toFixed(2));

        if (currentUser.walletBalance < budgetInUserCurr) {
            return alert(`Insufficient wallet balance. Total cost is ${budgetInUserCurr} ${userCurr} (${totalBudgetUSD} USD), you have ${currentUser.walletBalance} ${userCurr}. Please convert funds or deposit.`);
        }

        setIsSubmitting(true);
        try {
            const result = await createUserTask({
                userId: currentUser._id,
                category,
                subType,
                title,
                description,
                link,
                targetQuantity: Number(targetQuantity),
                rewardPerTask: Number(rewardPerTask) // in USD
            });
            dispatch({ type: 'ADD_USER_TASK', payload: result.task });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            alert('Task campaign submitted successfully in USD and funds deducted from your wallet!');
            setTitle('');
            setDescription('');
            setLink('');
            setActiveTab('my-tasks');
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProofSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTaskForProof) return;
        if (!proofText && !proofImage) return alert('Please provide either screenshot proof, link, or ID/username.');

        setIsSubmittingProof(true);
        try {
            const submission = await submitUserTaskProof(selectedTaskForProof._id, {
                userId: currentUser._id,
                proofText,
                proofImage
            });
            dispatch({ type: 'ADD_USER_TASK_SUBMISSION', payload: submission });
            alert('Proof submitted successfully! Awaiting admin review for USD reward.');
            setSelectedTaskForProof(null);
            setProofText('');
            setProofImage('');
            setActiveTab('my-submissions');
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingProof(false);
        }
    };

    const handleRunConversion = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsConverting(true);
        try {
            const res = await convertUserCurrency({
                userId: currentUser._id,
                amount: Number(convertAmount),
                fromCurrency,
                toCurrency
            });
            setConversionResult(res);
        } catch (error) {
            alert(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsConverting(false);
        }
    };

    const handleDisputeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubmissionForDispute) return;
        setIsSubmittingDispute(true);
        try {
            const formData = new FormData();
            formData.append('userId', currentUser._id);
            formData.append('userName', currentUser.name || currentUser.email);
            formData.append('type', 'UserTask');
            formData.append('referenceId', selectedSubmissionForDispute._id);
            formData.append('description', disputeDescription || `Dispute for task submission: ${selectedSubmissionForDispute.taskTitle}`);
            
            await createDispute(formData);
            alert('Dispute submitted successfully to Admin! Admin will review the proof and resolve it.');
            setSelectedSubmissionForDispute(null);
            setDisputeDescription('');
        } catch (error) {
            alert(`Failed to submit dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const mySubmittedTasks = userTasks.filter(t => t.userId?.toString() === currentUser._id?.toString());
    const browseableTasks = userTasks.filter(t => t.status === 'Approved' && t.userId?.toString() !== currentUser._id?.toString() && t.currentCompletions < t.targetQuantity);
    const mySubmissions = userTaskSubmissions.filter(s => s.workerId?.toString() === currentUser._id?.toString());
    const pendingSubmissions = mySubmissions.filter(s => s.status === 'Pending');
    const completedSubmissions = mySubmissions.filter(s => s.status === 'Approved');

    const hasAccess = canUserAccessTasks(currentUser, settings);

    if (!hasAccess) {
        return (
            <div className="max-w-4xl mx-auto py-16 px-4">
                <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-12 shadow-2xl border dark:border-gray-700 text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl mx-auto flex items-center justify-center text-3xl font-black">
                        🔒
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">User Task Hub Locked</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto font-medium leading-relaxed">
                        {settings.userTaskNotificationEnabled !== false 
                            ? (settings.userTaskNotificationMessage || 'Want to earn extra rewards? Activate the required investment plan to unlock the User Task Hub and start earning today!')
                            : 'Access to the User Task Hub is restricted by the administrator.'}
                    </p>
                    <div className="pt-4 flex flex-wrap justify-center gap-4">
                        <Link to="/member/plans">
                            <Button variant="primary" className="px-8 py-3.5 rounded-2xl shadow-lg">
                                View Investment Plans & Activate
                            </Button>
                        </Link>
                        <Link to="/member">
                            <Button variant="secondary" className="px-8 py-3.5 rounded-2xl">
                                Back to Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="bg-[#0f172a] p-8 md:p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">User Task Hub (USD)</h1>
                        <p className="mt-2 text-blue-100/70 font-medium uppercase text-xs tracking-widest ml-1">Create USD campaigns, complete tasks with proof, and convert currency</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            variant={activeTab === 'browse' ? 'primary' : 'secondary'} 
                            onClick={() => setActiveTab('browse')}
                        >
                            Available Tasks ({browseableTasks.length})
                        </Button>
                        <Button 
                            variant={activeTab === 'pending-payment' ? 'primary' : 'secondary'} 
                            onClick={() => setActiveTab('pending-payment')}
                        >
                            Pending Payment ({pendingSubmissions.length})
                        </Button>
                        <Button 
                            variant={activeTab === 'completed-tasks' ? 'primary' : 'secondary'} 
                            onClick={() => setActiveTab('completed-tasks')}
                        >
                            Completed Tasks ({completedSubmissions.length})
                        </Button>
                        <Button 
                            variant={activeTab === 'submit' ? 'primary' : 'secondary'} 
                            onClick={() => setActiveTab('submit')}
                        >
                            Create Campaign
                        </Button>
                        <Button 
                            variant={activeTab === 'my-tasks' ? 'primary' : 'secondary'} 
                            onClick={() => setActiveTab('my-tasks')}
                        >
                            My Campaigns ({mySubmittedTasks.length})
                        </Button>
                        <Button 
                            variant={activeTab === 'converter' ? 'primary' : 'secondary'} 
                            onClick={() => setActiveTab('converter')}
                        >
                            Currency Converter
                        </Button>
                    </div>
                </div>
            </div>

            {!isEnabled && (
                <div className="bg-red-500/10 border-2 border-red-500/30 text-red-600 dark:text-red-400 p-6 rounded-3xl font-bold text-center">
                    User task submissions are currently disabled by the administrator.
                </div>
            )}

            {/* TAB 1: CREATE CAMPAIGN */}
            {activeTab === 'submit' && isEnabled && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl border dark:border-gray-700">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">Create USD Task Campaign</h3>
                        
                        <form onSubmit={handleCreateCampaign} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Category / Platform</label>
                                    <select 
                                        value={category} 
                                        onChange={(e) => setCategory(e.target.value as any)}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    >
                                        <option value="YouTube">YouTube</option>
                                        <option value="Facebook">Facebook</option>
                                        <option value="WhatsApp">WhatsApp</option>
                                        <option value="Website">Website / Sign-up</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Action / SubType</label>
                                    <select 
                                        value={subType} 
                                        onChange={(e) => setSubType(e.target.value as any)}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    >
                                        <option value="Subscribe">Subscribe</option>
                                        <option value="Like">Like</option>
                                        <option value="Comment">Comment</option>
                                        <option value="Follow">Follow</option>
                                        <option value="Watch Time">Watch Time</option>
                                        <option value="Sign-up">Website Sign-up</option>
                                        <option value="Share">Share</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Campaign Title</label>
                                <input 
                                    type="text" 
                                    required
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Website Sign-up & Verify Email"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Target Link / URL</label>
                                <input 
                                    type="url" 
                                    required
                                    value={link} 
                                    onChange={(e) => setLink(e.target.value)}
                                    placeholder="https://example.com/signup"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Description & Proof Instructions</label>
                                <textarea 
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Provide clear instructions for workers (e.g. Sign up with email, submit your username and screenshot)"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                ></textarea>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Target Quantity (Min {config.minQuantity})</label>
                                    <input 
                                        type="number" 
                                        min={config.minQuantity}
                                        value={targetQuantity} 
                                        onChange={(e) => setTargetQuantity(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Reward Per Task (USD)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min={config.minRewardAmount}
                                        value={rewardPerTask} 
                                        onChange={(e) => setRewardPerTask(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    />
                                </div>
                            </div>

                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full py-4 text-lg">
                                Launch Campaign ({totalBudgetUSD} USD)
                            </Button>
                        </form>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-[#0f172a] text-white rounded-[2.5rem] p-8 md:p-10 shadow-xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl font-bold uppercase tracking-tight text-blue-400 mb-6">Campaign Summary (USD)</h3>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Target Completions</span>
                                    <span className="font-bold">{targetQuantity} users</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Reward / Task</span>
                                    <span className="font-bold">{rewardPerTask.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Subtotal Rewards</span>
                                    <span className="font-bold">{subtotal.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Admin Commission ({config.commissionPercent}%)</span>
                                    <span className="font-bold">{adminCommission.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-3 text-lg font-black text-emerald-400">
                                    <span>Total Budget</span>
                                    <span>{totalBudgetUSD} USD</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 p-6 bg-gray-900/60 rounded-3xl border border-gray-800">
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Funds will be deducted from your wallet balance in USD equivalent. When workers submit valid proof (screenshot, ID, or link), admin approves and workers receive their USD rewards instantly!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: BROWSE & EARN TASKS */}
            {activeTab === 'browse' && (
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Available Tasks to Complete & Earn USD</h3>
                    {browseableTasks.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700">
                            No active user task campaigns available at the moment. Check back soon!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {browseableTasks.map(task => {
                                const alreadySubmitted = mySubmissions.some(s => s.taskId.toString() === task._id.toString());
                                return (
                                    <div key={task._id} className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl border dark:border-gray-700 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <Badge variant="info">{task.category} / {task.subType}</Badge>
                                                <span className="text-emerald-500 font-black text-lg">+{task.rewardPerTask} USD</span>
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{task.title}</h4>
                                            <p className="text-sm text-gray-500 mb-6 line-clamp-3">{task.description}</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="text-xs text-gray-400 flex justify-between">
                                                <span>Progress: {task.currentCompletions} / {task.targetQuantity}</span>
                                                <span>By: {task.userName}</span>
                                            </div>

                                            <div className="flex gap-2">
                                                <a 
                                                    href={task.link} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="flex-1 text-center py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl font-bold text-sm text-gray-900 dark:text-white transition-all"
                                                >
                                                    Open Link
                                                </a>
                                                {alreadySubmitted ? (
                                                    <span className="flex-1 text-center py-3 px-4 bg-yellow-500/10 text-yellow-600 rounded-2xl font-bold text-sm">
                                                        Submitted
                                                    </span>
                                                ) : (
                                                    <Button 
                                                        variant="primary" 
                                                        className="flex-1 py-3 text-sm"
                                                        onClick={() => setSelectedTaskForProof(task)}
                                                    >
                                                        Submit Proof
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: MY CAMPAIGNS */}
            {activeTab === 'my-tasks' && (
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">My Created Task Campaigns</h3>
                    {mySubmittedTasks.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700">
                            You have not created any task campaigns yet.
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                            <th className="p-6">Title</th>
                                            <th className="p-6">Category</th>
                                            <th className="p-6">Budget (USD)</th>
                                            <th className="p-6">Progress</th>
                                            <th className="p-6">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                        {mySubmittedTasks.map(task => (
                                            <tr key={task._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                <td className="p-6 text-gray-900 dark:text-white font-bold">{task.title}</td>
                                                <td className="p-6 text-gray-500">{task.category} ({task.subType})</td>
                                                <td className="p-6 font-mono text-emerald-500 font-bold">{task.totalBudget} USD</td>
                                                <td className="p-6 text-gray-500">{task.currentCompletions} / {task.targetQuantity}</td>
                                                <td className="p-6">
                                                    <Badge variant={task.status === 'Approved' ? 'success' : task.status === 'Pending' ? 'warning' : 'danger'}>
                                                        {task.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

             {/* TAB: PENDING PAYMENT TASKS */}
            {activeTab === 'pending-payment' && (
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Pending Payment Tasks & Proofs</h3>
                    {pendingSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700">
                            No pending payment tasks at the moment. Complete available tasks to await admin review and payout.
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                            <th className="p-6">Task</th>
                                            <th className="p-6">Proof Details</th>
                                            <th className="p-6">Pending Reward (USD)</th>
                                            <th className="p-6">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                        {pendingSubmissions.map(sub => (
                                            <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                <td className="p-6 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                <td className="p-6 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                <td className="p-6 font-mono text-orange-500 font-bold">+{sub.rewardAmount} USD</td>
                                                <td className="p-6">
                                                    <Badge variant="warning">Pending Admin Review & Payout</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: COMPLETED TASKS */}
            {activeTab === 'completed-tasks' && (
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Completed & Rewarded Tasks</h3>
                    {completedSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700">
                            No completed tasks yet. Once admin approves your task proof, your reward is paid instantly!
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                            <th className="p-6">Task</th>
                                            <th className="p-6">Proof Details</th>
                                            <th className="p-6">Paid Reward (USD)</th>
                                            <th className="p-6">Status</th>
                                            <th className="p-6">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                        {completedSubmissions.map(sub => (
                                            <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                <td className="p-6 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                <td className="p-6 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                <td className="p-6 font-mono text-emerald-500 font-bold">+{sub.rewardAmount} USD</td>
                                                <td className="p-6">
                                                    <Badge variant="success">Completed & Rewarded</Badge>
                                                </td>
                                                <td className="p-6">
                                                    <Button 
                                                        variant="secondary" 
                                                        className="text-xs py-1 px-3"
                                                        onClick={() => setSelectedSubmissionForDispute(sub)}
                                                    >
                                                        Raise Dispute
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: CURRENCY CONVERTER & WITHDRAW */}
            {activeTab === 'converter' && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl border dark:border-gray-700 max-w-2xl mx-auto space-y-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Currency Converter & Withdrawal</h3>
                        <p className="text-sm text-gray-500">
                            Task earnings are in USD. Based on your registered country ({currentUser.country || 'Global'}), you can convert your USD balance directly into your country currency ({allowedCurrency}).
                        </p>
                    </div>

                    <form onSubmit={handleRunConversion} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Amount (USD)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    required
                                    value={convertAmount} 
                                    onChange={(e) => setConvertAmount(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">From Currency</label>
                                <input 
                                    type="text"
                                    disabled
                                    value="USD"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-500 mb-2">To Currency (Country Specific)</label>
                            <input 
                                type="text"
                                disabled
                                value={allowedCurrency}
                                className="w-full px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                {currentUser.country === 'Pakistan' ? 'Registered from Pakistan -> Converted to PKR.' : europeanCountries.includes(currentUser.country || '') ? 'Registered from Europe -> Converted to EUR.' : 'Converted to USD.'}
                            </p>
                        </div>

                        <Button type="submit" variant="primary" isLoading={isConverting} className="w-full py-4 text-lg">
                            Convert & Withdraw ({allowedCurrency})
                        </Button>
                    </form>

                    {conversionResult && (
                        <div className="mt-8 p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-3xl text-center space-y-2">
                            <p className="text-xs uppercase font-black text-blue-500 tracking-wider">Conversion Successful</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {conversionResult.data.fromAmount} {conversionResult.data.fromCurrency} = <span className="text-emerald-500">{conversionResult.data.toAmount} {conversionResult.data.toCurrency}</span>
                            </p>
                            <p className="text-xs text-gray-500">Converted using active platform exchange rates and credited to wallet.</p>
                        </div>
                    )}
                </div>
            )}

            {/* PROOF SUBMISSION MODAL */}
            {selectedTaskForProof && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Submit Proof: {selectedTaskForProof.title}</h3>
                            <button onClick={() => setSelectedTaskForProof(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-sm text-gray-600 dark:text-gray-300 space-y-2">
                            <p><strong className="text-gray-900 dark:text-white">Instructions:</strong> Complete the task at the target link and submit proof below.</p>
                            <p><strong className="text-gray-900 dark:text-white">Reward:</strong> <span className="text-emerald-500 font-bold">+{selectedTaskForProof.rewardPerTask} USD</span></p>
                        </div>

                        <form onSubmit={handleProofSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Proof Details (Username / ID / Link)</label>
                                <input 
                                    type="text" 
                                    required
                                    value={proofText}
                                    onChange={(e) => setProofText(e.target.value)}
                                    placeholder="e.g. My Telegram/YouTube username @john_doe"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Screenshot URL or Image Link (Optional)</label>
                                <input 
                                    type="url" 
                                    value={proofImage}
                                    onChange={(e) => setProofImage(e.target.value)}
                                    placeholder="https://imgur.com/screenshot.png"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div className="flex gap-4 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedTaskForProof(null)} className="flex-1 py-3">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSubmittingProof} className="flex-1 py-3">
                                    Submit Proof
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DISPUTE MODAL */}
            {selectedSubmissionForDispute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Raise Dispute: {selectedSubmissionForDispute.taskTitle}</h3>
                            <button onClick={() => setSelectedSubmissionForDispute(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-sm text-gray-600 dark:text-gray-300 space-y-2">
                            <p><strong className="text-gray-900 dark:text-white">Notice:</strong> You can file a dispute within 48 hours of task rejection. The Admin will review your proof and decide on payment release.</p>
                            <p><strong className="text-gray-900 dark:text-white">Reward at Stake:</strong> <span className="text-emerald-500 font-bold">+{selectedSubmissionForDispute.rewardAmount} USD</span></p>
                        </div>

                        <form onSubmit={handleDisputeSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Dispute Description & Reason</label>
                                <textarea 
                                    rows={4}
                                    required
                                    value={disputeDescription}
                                    onChange={(e) => setDisputeDescription(e.target.value)}
                                    placeholder="Explain why this task submission was correct and should be approved (e.g. I completed all steps as requested...)"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                ></textarea>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedSubmissionForDispute(null)} className="flex-1 py-3">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSubmittingDispute} className="flex-1 py-3">
                                    Submit Dispute
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTasksSubmit;
