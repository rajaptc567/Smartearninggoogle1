
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Notification } from '../../types';
import { updateNotification } from '../../services/api';

const Messages: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, notifications } = state;

    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

    const userMessages = useMemo(() => {
        if (!currentUser) return [];
        return notifications
            .filter(n => n.userId === currentUser._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [currentUser, notifications]);

    useEffect(() => {
        // Automatically select the first message if none is selected
        if (userMessages.length > 0 && !selectedMessageId) {
            handleSelectMessage(userMessages[0]);
        }
    }, [userMessages, selectedMessageId]);

    const selectedMessage = useMemo(() => {
        return userMessages.find(msg => msg._id === selectedMessageId);
    }, [selectedMessageId, userMessages]);

    const handleSelectMessage = async (message: Notification) => {
        setSelectedMessageId(message._id);
        
        // If the message is unread, mark it as read
        if (!message.read) {
            try {
                const updated = await updateNotification(message._id, { read: true });
                dispatch({ type: 'UPDATE_NOTIFICATION', payload: updated });
            } catch (error) {
                console.error("Failed to mark message as read:", error);
            }
        }
    };

    if (!currentUser) {
        return <p>Loading messages...</p>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md h-[80vh] flex flex-col">
            <div className="p-4 border-b dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Admin Messages</h2>
            </div>
            
            <div className="flex flex-grow overflow-hidden">
                {/* Message List */}
                <div className="w-1/3 border-r dark:border-gray-700 overflow-y-auto">
                    {userMessages.length > 0 ? (
                        userMessages.map(msg => (
                            <div
                                key={msg._id}
                                onClick={() => handleSelectMessage(msg)}
                                className={`p-4 cursor-pointer border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedMessageId === msg._id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <h3 className={`text-sm font-semibold ${!msg.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                        {msg.subject || 'No Subject'}
                                    </h3>
                                    {!msg.read && (
                                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2 mt-1"></span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                                    {msg.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-2 text-right">
                                    {new Date(msg.date).toLocaleDateString()}
                                </p>
                            </div>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-500">
                            You have no messages.
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
                                    Received on {new Date(selectedMessage.date).toLocaleString()}
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
                                  <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Select a message</h3>
                                <p className="mt-1 text-sm text-gray-500">Select a message from the list to read its content.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
