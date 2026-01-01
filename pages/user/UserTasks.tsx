
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, Task } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { completeTask } from '../../services/api';

const UserTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { tasks, currentUser } = state;

    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [activeVideoTask, setActiveVideoTask] = useState<Task | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isTabVisible, setIsTabVisible] = useState(true);
    const [isVideoComplete, setIsVideoComplete] = useState(false);
    
    // Proof Selection State
    const [proofFiles, setProofFiles] = useState<Record<string, File>>({});
    
    // Timer reference for cleanup
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    if (!currentUser) return null;

    const completedIds = useMemo(() => {
        return (currentUser.completedTasks || []).map(ct => ct.taskId);
    }, [currentUser.completedTasks]);

    const activeTasks = tasks.filter(t => t.status === 'Active');

    // Page Visibility Logic
    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsTabVisible(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Timer Logic
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

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [activeVideoTask, isTabVisible, timeLeft, isVideoComplete]);

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

    const handleFileChange = (taskId: string, file: File | null) => {
        if (file) {
            setProofFiles(prev => ({ ...prev, [taskId]: file }));
        }
    };

    const handleVerify = async (task: Task) => {
        if (task.requireProof && !proofFiles[task._id]) {
            return alert('Please upload the required screenshot proof.');
        }

        setIsProcessing(task._id);
        try {
            const updatedUser = await completeTask(task._id, currentUser._id, proofFiles[task._id]);
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            alert('Congratulations! Task verified and completed.');
            if (activeVideoTask && activeVideoTask._id === task._id) {
                setActiveVideoTask(null);
            }
        } catch (error) {
            alert(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(null);
        }
    };

    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-2xl text-white shadow-xl">
                <h1 className="text-3xl font-bold">Eligibility & Earning Tasks</h1>
                <p className="mt-2 text-blue-100 opacity-90">
                    Complete tasks to earn extra rewards and qualify for fund withdrawals. Your progress is updated instantly.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTasks.map((task) => {
                    const isDone = completedIds.includes(task._id);
                    const isAwaitingVerification = isProcessing === task._id;
                    const hasSelectedFile = !!proofFiles[task._id];

                    return (
                        <div key={task._id} className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-md border ${isDone ? 'border-green-200 dark:border-green-900/50' : 'border-gray-100 dark:border-gray-700'} overflow-hidden transition-all hover:shadow-lg`}>
                            {task.isRequiredForWithdrawal && !isDone && (
                                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-bl-lg uppercase tracking-tighter z-10 shadow-sm">
                                    Required
                                </div>
                            )}
                            
                            <div className="p-6 flex-grow">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider">{task.type}</span>
                                    {isDone && (
                                        <span className="text-green-500 font-bold text-xs flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Done
                                        </span>
                                    )}
                                </div>
                                
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-tight">{task.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 h-10">{task.description}</p>
                                
                                <div className="flex justify-between items-center mt-2">
                                    {task.rewardAmount > 0 && (
                                        <div className="text-sm font-black text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <span className="text-lg">💰</span> {formatCurrency(task.rewardAmount, currentUser.currency)}
                                        </div>
                                    )}
                                    {task.type === 'Video' && (
                                        <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {task.videoDurationValue}s req.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
                                {isDone ? (
                                    <button disabled className="w-full py-2 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg font-bold text-sm cursor-not-allowed uppercase tracking-widest">Claimed</button>
                                ) : isAwaitingVerification || (isProcessing === task._id && task.requireProof) ? (
                                    <div className="space-y-3">
                                        {task.requireProof && (
                                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Screenshot Needed</p>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="w-full text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                    onChange={(e) => handleFileChange(task._id, e.target.files ? e.target.files[0] : null)}
                                                />
                                            </div>
                                        )}
                                        <Button 
                                            onClick={() => handleVerify(task)} 
                                            className="w-full bg-green-600 hover:bg-green-700" 
                                            size="sm"
                                            disabled={isProcessing === task._id}
                                        >
                                            {isProcessing === task._id ? 'Verifying...' : 'VERIFY ACTION'}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button onClick={() => handleTaskAction(task)} className="w-full" size="sm">
                                        {task.type === 'Video' ? 'WATCH VIDEO' : 'PERFORM ACTION'} &rarr;
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Timed Video Player Modal */}
            {activeVideoTask && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 overflow-hidden">
                    <div className="w-full max-w-4xl bg-[#0f172a] rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 flex flex-col h-[85vh] relative animate-fade-in">
                        
                        {/* Header Overlay */}
                        <div className="p-8 border-b border-white/5 bg-[#1e293b]/50 flex justify-between items-center relative z-20">
                            <div className="flex flex-col">
                                <h3 className="text-3xl font-black text-white tracking-tighter leading-none">
                                    {activeVideoTask.title}
                                </h3>
                                <p className="text-[11px] text-gray-400 font-black uppercase tracking-[0.2em] mt-2">
                                    Do not close or switch tabs. Timer will pause.
                                </p>
                            </div>
                            
                            <div className={`text-4xl font-black tracking-tighter transition-colors ${!isTabVisible ? 'text-red-500' : isVideoComplete ? 'text-green-500' : 'text-blue-400'}`}>
                                {timeLeft}s
                            </div>
                        </div>

                        {/* Player Area */}
                        <div className="flex-grow bg-black relative">
                            {getYouTubeId(activeVideoTask.link) ? (
                                <iframe 
                                    src={`https://www.youtube.com/embed/${getYouTubeId(activeVideoTask.link)}?autoplay=1&controls=1&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1`}
                                    className="w-full h-full border-none"
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 italic">Invalid YouTube URL</div>
                            )}

                            {/* Blocking Overlay if window hidden */}
                            {!isTabVisible && (
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-white text-center p-8">
                                    <div className="w-20 h-20 mb-4 text-red-500 animate-bounce">
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    <h4 className="text-2xl font-black uppercase tracking-tighter">Verification Paused</h4>
                                    <p className="text-sm text-gray-400 max-w-xs mt-2">You must keep this window open and focused to earn your reward.</p>
                                </div>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1 bg-white/5 w-full relative z-20">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                                style={{ width: `${((activeVideoTask.videoDurationValue! - timeLeft) / activeVideoTask.videoDurationValue!) * 100}%` }}
                            ></div>
                        </div>

                        {/* Action Footer */}
                        <div className="p-8 bg-[#0f172a] flex flex-col sm:flex-row justify-between items-center border-t border-white/5 gap-4">
                            <button 
                                onClick={() => setActiveVideoTask(null)}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${isVideoComplete ? 'text-gray-400 hover:text-white' : 'text-red-500 hover:bg-red-500/10'}`}
                            >
                                {isVideoComplete ? 'DISMISS' : 'CANCEL TASK'}
                            </button>
                            
                            <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
                                {isVideoComplete ? (
                                    <>
                                        {activeVideoTask.requireProof && (
                                            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{activeVideoTask.proofInstructions}</p>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="text-[10px] text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                                                    onChange={(e) => handleFileChange(activeVideoTask._id, e.target.files ? e.target.files[0] : null)}
                                                />
                                            </div>
                                        )}
                                        <Button 
                                            onClick={() => handleVerify(activeVideoTask)} 
                                            className="bg-green-600 hover:bg-green-700 px-12 py-3.5 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-green-500/30 rounded-2xl w-full sm:w-auto"
                                            disabled={isProcessing === activeVideoTask._id}
                                        >
                                            {isProcessing === activeVideoTask._id ? 'VERIFYING...' : 'CLAIM REWARD'}
                                        </Button>
                                    </>
                                ) : (
                                    <div className="px-10 py-3.5 bg-white/5 rounded-2xl border border-white/10 text-[11px] font-black text-gray-500 uppercase tracking-[0.25em]">
                                        WATCH {timeLeft}S MORE...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTasks.length === 0 && (
                <div className="py-20 text-center text-gray-500 border-2 border-dashed rounded-2xl dark:border-gray-700">
                    <p className="text-lg font-medium italic">No tasks available currently.</p>
                </div>
            )}
        </div>
    );
};

export default UserTasks;
