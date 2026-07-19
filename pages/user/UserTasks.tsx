
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, Task } from '../../types';
import Button from '../../components/ui/Button';
import { completeTask } from '../../services/api';

const UserTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { tasks, currentUser } = state;

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
        <div className="space-y-10 max-w-7xl mx-auto pb-20">
            <div className="bg-[#0f172a] p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Engagement HQ</h1>
                    <p className="mt-2 text-blue-100/70 font-medium uppercase text-xs tracking-widest ml-1">Unlock rewards and eligibility through social missions</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                        <div key={task._id} className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border-2 transition-all group overflow-hidden 
                            ${isFullyDone ? 'border-green-500 opacity-60' : isPending ? 'border-orange-500 ring-4 ring-orange-500/10' : isRejected ? 'border-red-500 animate-pulse' : 'border-gray-100 dark:border-gray-700 hover:border-blue-500'}`}>
                            
                            {task.isRequiredForWithdrawal && !isApproved && !isPending && (
                                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-bl-3xl uppercase tracking-widest z-10 shadow-xl">Guard Required</div>
                            )}

                            <div className="p-8 flex-grow">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em]">{task.platform}</span>
                                            <span className="text-gray-300">/</span>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{task.category}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight mt-1">{task.title}</h3>
                                    </div>
                                    <div className="shrink-0">
                                        {isApproved ? <div className="w-10 h-10 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center font-bold">✓</div> : 
                                         isPending ? <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center animate-spin">⟳</div> :
                                         isRejected ? <div className="w-10 h-10 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center font-bold">!</div> :
                                         <div className="text-xs font-black text-gray-400 uppercase tracking-tighter">{task.action}</div>}
                                    </div>
                                </div>

                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-8 line-clamp-3 italic">"{task.description}"</p>

                                <div className="grid grid-cols-2 gap-4 mt-auto">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700 text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Potential</p>
                                        <p className="text-lg font-black text-green-600">{formatCurrency(task.rewardAmount, currentUser.currency)}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700 text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Cycle</p>
                                        <p className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase">{task.frequency}</p>
                                    </div>
                                </div>

                                {isRejected && lastSub?.adminNotes && (
                                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-2xl">
                                        <p className="text-[10px] font-black text-red-600 uppercase mb-1">Rejection Reason</p>
                                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">"{lastSub.adminNotes}"</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-gray-50 dark:bg-gray-900/40 border-t dark:border-gray-700">
                                {isFullyDone ? (
                                    <div className="text-center font-black text-xs text-green-600 uppercase tracking-[0.2em]">MISSION COMPLETE</div>
                                ) : isPending ? (
                                    <div className="text-center font-black text-xs text-orange-500 uppercase tracking-[0.2em] animate-pulse">UNDER VERIFICATION</div>
                                ) : isLockedByCooldown ? (
                                    <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-2xl border dark:border-gray-700">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Run In:</span>
                                        <span className="text-xs font-black text-blue-600 font-mono">{cooldownString}</span>
                                    </div>
                                ) : isProcessing === task._id ? (
                                    <div className="space-y-4">
                                        {task.requireProof && (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">{task.proofInstructions}</p>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="w-full text-[10px] text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white" 
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
                                        <Button onClick={() => handleVerify(task)} className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 shadow-xl shadow-green-500/20" disabled={task.requireProof && !proofFiles[task._id]}>Finalize Submission</Button>
                                    </div>
                                ) : (
                                    <button onClick={() => handleTaskAction(task)} className="w-full py-4 bg-[#0f172a] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-600 transition-all transform active:scale-95 shadow-xl shadow-blue-500/10">{getActionVerb(task)} &rarr;</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

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
