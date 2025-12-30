
import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, Task } from '../../types';
import Button from '../../components/ui/Button';
import { completeTask } from '../../services/api';

const UserTasks: React.FC = () => {
    const { state, dispatch } = useData();
    const { tasks, currentUser } = state;

    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    if (!currentUser) return null;

    const completedIds = currentUser.completedTasks || [];
    const activeTasks = tasks.filter(t => t.status === 'Active');

    const handleTaskAction = (task: Task) => {
        window.open(task.link, '_blank');
        // Simple logic: Set to processing so user can "Verify" after opening the link
        setIsProcessing(task._id);
    };

    const handleVerify = async (taskId: string) => {
        setIsProcessing(taskId);
        try {
            const updatedUser = await completeTask(taskId, currentUser._id);
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            alert('Congratulations! Task verified and completed.');
        } catch (error) {
            alert('Verification failed. Please ensure you performed the action.');
        } finally {
            setIsProcessing(null);
        }
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
                                
                                {task.rewardAmount > 0 && (
                                    <div className="text-sm font-black text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <span className="text-lg">💰</span> Reward: {formatCurrency(task.rewardAmount, currentUser.currency)}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
                                {isDone ? (
                                    <button disabled className="w-full py-2 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg font-bold text-sm cursor-not-allowed">Already Claimed</button>
                                ) : isProcessing === task._id ? (
                                    <Button onClick={() => handleVerify(task._id)} className="w-full bg-green-600 hover:bg-green-700" size="sm">Verify My Action</Button>
                                ) : (
                                    <Button onClick={() => handleTaskAction(task)} className="w-full" size="sm">Perform Action &rarr;</Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {activeTasks.length === 0 && (
                <div className="py-20 text-center text-gray-500 border-2 border-dashed rounded-2xl dark:border-gray-700">
                    <p className="text-lg font-medium italic">No tasks available currently.</p>
                </div>
            )}
        </div>
    );
};

export default UserTasks;
