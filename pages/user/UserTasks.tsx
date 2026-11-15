
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, Task } from '../../types';
import Button from '../../components/ui/Button';
import { completeTask } from '../../services/api';
import { seoAnalytics } from '../../services/seoAnalytics';
import OtherTasksCard from '../../components/OtherTasksCard';
import { Zap as ZapIcon, Globe as GlobeIcon } from 'lucide-react';

const UserTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { tasks, currentUser, settings } = state;

    const [activeTab, setActiveTab] = useState<'missions' | 'other_tasks'>('missions');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [activeVideoTask, setActiveVideoTask] = useState<Task | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isTabVisible, setIsTabVisible] = useState(true);
    const [isVideoComplete, setIsVideoComplete] = useState(false);
    const [proofFiles, setProofFiles] = useState<Record<string, File>>({});
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Dynamic Cooldown Timer State
    const [currentTime, setCurrentTime] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => setIsTabVisible(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        if (activeVideoTask && isTabVisible && timeLeft > 0 && !isVideoComplete) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setIsVideoComplete(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [activeVideoTask, isTabVisible, timeLeft, isVideoComplete]);

    if (!currentUser) return null;

    const visibleTasks = useMemo(() => {
        return tasks.filter(t => {
            if (t.status !== 'Active') return false;
            
            // Temporal
            const now = new Date();
            if (t.activeFrom && now < new Date(t.activeFrom)) return false;
            if (t.activeTo && now > new Date(t.activeTo)) return false;

            // Targeting
            if (t.targetCurrencies?.length > 0 && !t.targetCurrencies.includes(currentUser.currency)) return false;
            if (t.targetCountries?.length > 0 && !t.targetCountries.includes(currentUser.country)) return false;
            
            if (t.minPlanValue > 0) {
                const maxVal = (currentUser.activePlans || []).reduce((max, p) => Math.max(max, p.price), 0);
                if (maxVal < t.minPlanValue) return false;
            }

            // Budget
            if (t.maxGlobalCompletions > 0 && t.currentGlobalCompletions >= t.maxGlobalCompletions) return false;

            // Completion & Submission Filters: Hide tasks that are already completed, pending verification, or on cooldown
            const submissions = (currentUser.completedTasks || []).filter(ct => ct.taskId.toString() === t._id.toString());
            const lastSub = submissions.length > 0 ? submissions[submissions.length - 1] : null;
            if (lastSub) {
                const isPending = lastSub.status === 'Pending';
                const isApproved = lastSub.status === 'Approved';
                
                // Cooldown Logic
                let cooldownMs = t.cooldownHours * 60 * 60 * 1000;
                if (t.frequency === 'Daily') cooldownMs = Math.max(cooldownMs, 24 * 60 * 60 * 1000);
                if (t.frequency === 'Weekly') cooldownMs = Math.max(cooldownMs, 7 * 24 * 60 * 60 * 1000);
                
                const nextAvailable = new Date(lastSub.completedAt).getTime() + cooldownMs;
                const isLockedByCooldown = isApproved && t.frequency !== 'Once' && currentTime < nextAvailable;
                const isFullyDone = isApproved && t.frequency === 'Once';

                if (isPending || isFullyDone || isLockedByCooldown) {
                    return false;
                }
            }

            return true;
        });
    }, [tasks, currentUser, currentTime]);

    const handleTaskAction = (task: Task) => {
        seoAnalytics.trackViewTask(task._id, task.type || 'system_task');
        seoAnalytics.trackStartTask(task._id, task.type || 'system_task');
        if (task.type === 'Video') {
            setActiveVideoTask(task);
            setTimeLeft(task.videoDurationValue || 60);
            setIsVideoComplete(false);
        } else {
            window.open(task.link, '_blank');
            setIsProcessing(task._id);
        }
    };

    const handleVerify = async (task: Task) => {
        if (task.requireProof && !proofFiles[task._id]) return alert('Screenshot proof is required.');
        setIsProcessing(task._id);
        try {
            const updatedUser = await completeTask(task._id, currentUser._id, proofFiles[task._id]);
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            seoAnalytics.trackSubmitTaskProof(task._id, task.type || 'system_task');
            alert(task.requireProof ? 'Submission received! Awaiting review.' : 'Task completed successfully!');
            setActiveVideoTask(null);
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(null);
        }
    };

    const getYouTubeId = (url: string) => {
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const getActionVerb = (task: Task) => {
        if (task.type === 'Video') return 'Watch Video';
        if (task.action === 'Follow') return 'Follow Page';
        if (task.action === 'Subscribe') return 'Subscribe Channel';
        if (task.action === 'Like') return 'Like Content';
        if (task.action === 'Share') return 'Share Link';
        return 'Start Mission';
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20">
            <div className="bg-slate-900/90 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-slate-800 relative overflow-hidden group">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                            <span>⚡ System Engagement Missions</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Engagement HQ</h1>
                        <p className="mt-1 text-slate-400 font-medium text-xs sm:text-sm">Unlock rewards and eligibility through quick social tasks</p>
                    </div>
                    <div className="bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800 text-right self-start sm:self-auto">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Tasks</span>
                        <span className="text-lg font-extrabold text-amber-300 font-mono">{visibleTasks.length} Missions</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-slate-900/90 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl border border-slate-800">
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('missions')}
                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                            activeTab === 'missions'
                                 ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                    >
                        <ZapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>System Missions</span>
                        <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold font-mono ${
                            activeTab === 'missions' ? 'bg-slate-950/80 text-amber-300' : 'bg-slate-950/60 text-slate-400'
                        }`}>
                            {visibleTasks.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('other_tasks')}
                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                            activeTab === 'other_tasks'
                                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                    >
                        <GlobeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Other Tasks</span>
                    </button>
                </div>
            </div>

            {activeTab === 'other_tasks' ? (
                <OtherTasksCard hideHeader={false} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {visibleTasks.map((task) => {
                        const submissions = (currentUser.completedTasks || []).filter(ct => ct.taskId.toString() === task._id.toString());
                        const lastSub = submissions.length > 0 ? submissions[submissions.length - 1] : null;
                        const isPending = lastSub?.status === 'Pending';
                        const isApproved = lastSub?.status === 'Approved';
                        const isRejected = lastSub?.status === 'Rejected';

                        // Cooldown Logic
                        let cooldownMs = task.cooldownHours * 60 * 60 * 1000;
                        if (task.frequency === 'Daily') cooldownMs = Math.max(cooldownMs, 24 * 60 * 60 * 1000);
                        if (task.frequency === 'Weekly') cooldownMs = Math.max(cooldownMs, 7 * 24 * 60 * 60 * 1000);
                        
                        const nextAvailable = lastSub ? new Date(lastSub.completedAt).getTime() + cooldownMs : 0;
                        const isLockedByCooldown = isApproved && task.frequency !== 'Once' && currentTime < nextAvailable;
                        const isFullyDone = isApproved && task.frequency === 'Once';

                        const remainingSeconds = Math.max(0, Math.floor((nextAvailable - currentTime) / 1000));
                        const cooldownString = remainingSeconds > 0 ? `${Math.floor(remainingSeconds/3600)}h ${Math.floor((remainingSeconds%3600)/60)}m` : null;

                        return (
                            <div key={task._id} className={`relative flex flex-col bg-slate-950/80 rounded-2xl p-5 shadow-lg border transition-all group overflow-hidden 
                                ${isFullyDone ? 'border-emerald-500/50 opacity-60' : isPending ? 'border-amber-500/80 ring-2 ring-amber-500/10' : isRejected ? 'border-rose-500 animate-pulse' : 'border-slate-800 hover:border-amber-500/50'}`}>
                                
                                {task.isRequiredForWithdrawal && !isApproved && !isPending && (
                                    <div className="absolute top-0 right-0 bg-rose-600 text-white text-[9px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider z-10 shadow-md">Guard Required</div>
                                )}

                                <div className="flex-grow space-y-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">{task.platform}</span>
                                                <span className="text-slate-600">/</span>
                                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{task.category}</span>
                                            </div>
                                            <h3 className="text-base font-bold text-white leading-snug mt-1 group-hover:text-amber-300 transition-colors">{task.title}</h3>
                                        </div>
                                        <div className="shrink-0">
                                            {isApproved ? <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center font-bold text-xs">✓</div> : 
                                             isPending ? <div className="w-8 h-8 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center animate-spin text-xs">⟳</div> :
                                             isRejected ? <div className="w-8 h-8 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-center justify-center font-bold text-xs">!</div> :
                                             <div className="text-[10px] font-bold text-slate-400 uppercase">{task.action}</div>}
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">"{task.description}"</p>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-center">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Potential Reward</p>
                                            <p className="text-sm font-extrabold text-emerald-400 font-mono">{formatCurrency(task.rewardAmount, currentUser.currency)}</p>
                                        </div>
                                        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-center">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Frequency Cycle</p>
                                            <p className="text-xs font-bold text-slate-200 uppercase">{task.frequency}</p>
                                        </div>
                                    </div>

                                    {isRejected && lastSub?.adminNotes && (
                                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                            <p className="text-[9px] font-bold text-rose-400 uppercase mb-0.5">Rejection Reason</p>
                                            <p className="text-xs text-rose-300 font-medium">"{lastSub.adminNotes}"</p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 mt-4 border-t border-slate-800/80">
                                    {isFullyDone ? (
                                        <div className="text-center font-bold text-xs text-emerald-400 uppercase tracking-wider py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">✓ MISSION COMPLETE</div>
                                    ) : isPending ? (
                                        <div className="text-center font-bold text-xs text-amber-400 uppercase tracking-wider py-2 bg-amber-500/10 rounded-xl border border-amber-500/20 animate-pulse">UNDER VERIFICATION</div>
                                    ) : isLockedByCooldown ? (
                                        <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Next Available In:</span>
                                            <span className="text-xs font-bold text-amber-300 font-mono">{cooldownString}</span>
                                        </div>
                                    ) : isProcessing === task._id ? (
                                        <div className="space-y-3">
                                            {task.requireProof && (
                                                <div className="flex flex-col gap-1.5">
                                                    <p className="text-[10px] font-bold text-amber-300 uppercase">{task.proofInstructions}</p>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400" 
                                                        onChange={e => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
                                                                if (file.size > maxMB * 1024 * 1024) {
                                                                    alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
                                                                    e.target.value = '';
                                                                    return;
                                                                }
                                                                setProofFiles(p => ({...p, [task._id]: file}));
                                                            }
                                                        }} 
                                                    />
                                                </div>
                                            )}
                                            <Button onClick={() => handleVerify(task)} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase" disabled={task.requireProof && !proofFiles[task._id]}>Finalize Submission</Button>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleTaskAction(task)} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-2 min-h-[40px]">{getActionVerb(task)} &rarr;</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

             {/* Timed Video Player Modal - Enhanced */}
             {activeVideoTask && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 overflow-hidden">
                    <div className="w-full max-w-5xl bg-[#0f172a] rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 flex flex-col h-[90vh] relative animate-fade-in">
                        <div className="p-10 border-b border-white/5 bg-[#1e293b]/30 flex justify-between items-center relative z-20">
                            <div>
                                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">{activeVideoTask.title}</h3>
                                <p className="text-[11px] text-blue-400 font-black uppercase tracking-[0.25em] mt-2">Verification In Progress • Keep Tab Focused</p>
                            </div>
                            <div className={`text-6xl font-black tracking-tighter ${!isTabVisible ? 'text-red-500' : isVideoComplete ? 'text-green-500' : 'text-blue-400'}`}>{timeLeft}s</div>
                        </div>

                        <div className="flex-grow bg-black relative">
                            {getYouTubeId(activeVideoTask.link) ? (
                                <iframe src={`https://www.youtube.com/embed/${getYouTubeId(activeVideoTask.link)}?autoplay=1&controls=1&modestbranding=1&rel=0&disablekb=1&enablejsapi=1`} className="w-full h-full border-none" allow="autoplay; encrypted-media" />
                            ) : <div className="h-full flex items-center justify-center text-gray-500 uppercase font-black tracking-widest italic">Gateway Broken: Invalid Link</div>}

                            {!isTabVisible && (
                                <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-30 flex flex-col items-center justify-center text-white text-center p-8">
                                    <div className="w-24 h-24 mb-6 text-red-500 animate-bounce">
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    <h4 className="text-3xl font-black uppercase tracking-tighter">Tab Inactive</h4>
                                    <p className="text-gray-400 mt-2 font-medium">Verification timer paused. Keep this window active to earn your reward.</p>
                                </div>
                            )}
                        </div>

                        <div className="h-1.5 bg-white/5 w-full relative z-20">
                            <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear shadow-[0_0_25px_rgba(59,130,246,1)]" style={{ width: `${((activeVideoTask.videoDurationValue! - timeLeft) / activeVideoTask.videoDurationValue!) * 100}%` }}></div>
                        </div>

                        <div className="p-10 bg-[#0f172a] border-t border-white/5">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                                <button onClick={() => setActiveVideoTask(null)} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors">Abort Mission</button>
                                
                                {isVideoComplete ? (
                                    <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
                                        {activeVideoTask.requireProof && (
                                            <div className="flex flex-col items-end gap-2">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{activeVideoTask.proofInstructions}</p>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="text-[10px] text-gray-500 file:mr-3 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-indigo-600 file:text-white" 
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
                                                            if (file.size > maxMB * 1024 * 1024) {
                                                                alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            setProofFiles(p => ({...p, [activeVideoTask._id]: file}));
                                                        }
                                                    }} 
                                                />
                                            </div>
                                        )}
                                        <Button onClick={() => handleVerify(activeVideoTask)} className="bg-green-600 hover:bg-green-700 px-16 py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-green-500/30" disabled={isProcessing === activeVideoTask._id}>
                                            {isProcessing === activeVideoTask._id ? 'Verifying...' : 'Complete Sequence'}
                                        </Button>
                                    </div>
                                ) : <div className="px-12 py-5 bg-white/5 rounded-full border border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Processing Sequence...</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTasks;
