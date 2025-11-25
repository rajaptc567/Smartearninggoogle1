
import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Notification, User } from '../types';

const SentMessages: React.FC = () => {
    const { state } = useData();
    const { notifications, users } = state;

    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

    // Filter for messages sent specifically by an admin
    const sentMessages = useMemo(() => {
        return notifications
            .filter(n => n.senderType === 'Admin')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notifications]);

    // Find the user associated with a notification
    const findUser = (userId: string): User | undefined => {
        return users.find(u => u._id === userId);
    };

    const selectedMessage = useMemo(() => {
        return sentMessages.find(msg => msg._id === selectedMessageId);
    }, [selectedMessageId, sentMessages]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md h-[80vh] flex flex-col">
            <div className="p-4 border-b dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Sent Messages History</h2>
            </div>
            
            <div className="flex flex-grow overflow-hidden">
                {/* Message List */}
                <div className="w-1/3 border-r dark:border-gray-700 overflow-y-auto">
                    {sentMessages.length > 0 ? (
                        sentMessages.map(msg => {
                            const user = findUser(msg.userId);
                            return (
                                <div
                                    key={msg._id}
                                    onClick={() => setSelectedMessageId(msg._id)}
                                    className={`p-4 cursor-pointer border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedMessageId === msg._id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                            To: {user?.username || 'Unknown User'}
                                        </h3>
                                    </div>
                                     <p className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate mt-1">
                                        {msg.subject || 'No Subject'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                                        {msg.message}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2 text-right">
                                        {new Date(msg.date).toLocaleString()}
                                    </p>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-4 text-center text-gray-500">
                            No messages have been sent.
                        </div>
                    )}
                </div>

                {/* Message Content */}
                <div className="w-2/3 p-6 overflow-y-auto">
                    {selectedMessage ? (
                        <div>
                            <div className="border-b dark:border-gray-700 pb-4 mb-4">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {selectedMessage.subject || 'No Subject'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Sent to <strong>{findUser(selectedMessage.userId)?.username || 'N/A'}</strong> on {new Date(selectedMessage.date).toLocaleString()}
                                </p>
                            </div>
                            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                                {selectedMessage.message}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-gray-500">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                  <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Select a Message</h3>
                                <p className="mt-1 text-sm text-gray-500">Select a message from the list to view its content.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SentMessages;