
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Notification } from '../../types';
import { updateNotification, deleteNotification } from '../../services/api';
import Button from '../../components/ui/Button';

// Icons
const TrashIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const SearchIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const MailOpenIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" /></svg>;
const MailIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;

const Messages: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, notifications } = state;

    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'read' | 'unread'>('all');
    const [isDeleting, setIsDeleting] = useState(false);

    const userMessages = useMemo(() => {
        if (!currentUser) return [];
        return notifications
            .filter(n => n.userId === currentUser._id)
            .filter(n => {
                // Apply Search
                const matchesSearch = !searchTerm || 
                    (n.subject && n.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    n.message.toLowerCase().includes(searchTerm.toLowerCase());
                
                // Apply Status Filter
                const matchesFilter = 
                    filter === 'all' ||
                    (filter === 'read' && n.read) ||
                    (filter === 'unread' && !n.read);

                return matchesSearch && matchesFilter;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [currentUser, notifications, searchTerm, filter]);

    useEffect(() => {
        // Automatically select the first message if none is selected and list exists
        // Only if not deleting to prevent jump
        if (userMessages.length > 0 && !selectedMessageId && !isDeleting) {
            handleSelectMessage(userMessages[0]);
        } else if (userMessages.length === 0) {
            setSelectedMessageId(null);
        }
    }, [userMessages, selectedMessageId, isDeleting]);

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

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this message?")) {
            setIsDeleting(true);
            try {
                await deleteNotification(id);
                dispatch({ type: 'DELETE_NOTIFICATIONS', payload: [id] });
                if (selectedMessageId === id) {
                    setSelectedMessageId(null);
                }
            } catch (error) {
                console.error("Failed to delete message:", error);
                alert("Failed to delete message.");
            } finally {
                setIsDeleting(false);
            }
        }
    };

    if (!currentUser) {
        return <p>Loading messages...</p>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg h-[calc(100vh-140px)] min-h-[500px] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Header / Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
                    <MailIcon /> <span className="ml-2">Inbox</span>
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search inbox..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="absolute left-3 top-2.5 text-gray-400">
                            <SearchIcon />
                        </div>
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex bg-white dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
                        {(['all', 'unread', 'read'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                                    filter === f 
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white shadow-sm' 
                                    : 'text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="flex flex-grow overflow-hidden">
                {/* Message List Sidebar */}
                <div className="w-full md:w-2/5 lg:w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
                    {userMessages.length > 0 ? (
                        userMessages.map(msg => (
                            <div
                                key={msg._id}
                                onClick={() => handleSelectMessage(msg)}
                                className={`group p-4 cursor-pointer border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors relative ${
                                    selectedMessageId === msg._id 
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' 
                                    : 'border-l-4 border-l-transparent'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`text-sm font-semibold truncate pr-2 ${!msg.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                        {msg.subject || 'Admin Message'}
                                    </h3>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                        {new Date(msg.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-end">
                                    <p className={`text-xs truncate w-11/12 ${!msg.read ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {msg.message}
                                    </p>
                                    {!msg.read && (
                                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 absolute right-4 top-1/2 -translate-y-1/2"></span>
                                    )}
                                </div>

                                {/* Hover Delete Action */}
                                <button 
                                    onClick={(e) => handleDelete(e, msg._id)}
                                    className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                <MailOpenIcon />
                            </div>
                            <p className="text-sm">No messages found.</p>
                        </div>
                    )}
                </div>

                {/* Message Content Area */}
                <div className={`w-full md:w-3/5 lg:w-2/3 p-0 bg-gray-50 dark:bg-gray-900 overflow-y-auto flex flex-col ${!selectedMessageId ? 'hidden md:flex' : ''}`}>
                    {selectedMessage ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
                                <div className="flex justify-between items-start mb-4">
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                                        {selectedMessage.subject || 'No Subject'}
                                    </h1>
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="danger" 
                                            onClick={(e) => handleDelete(e, selectedMessage._id)}
                                            className="px-3"
                                        >
                                            <TrashIcon /> <span className="hidden sm:inline ml-1">Delete</span>
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
                                        A
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Admin Support</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(selectedMessage.date).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-8 flex-grow">
                                <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {selectedMessage.message}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                            <svg className="w-24 h-24 mb-4 text-gray-200 dark:text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" opacity=".3"/>
                                <path d="M20 6l-8 5-8-5v2l8 5 8-5V6zm0 12H4V8l8 5 8-5v10z"/>
                            </svg>
                            <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Select a message to read</h3>
                            <p className="text-sm mt-2">Choose an item from the left column to view details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
