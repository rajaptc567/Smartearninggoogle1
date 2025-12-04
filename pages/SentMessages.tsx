
import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Notification, User } from '../types';
import Button from '../components/ui/Button';

const SentMessages: React.FC = () => {
    const { state, dispatch } = useData();
    const { notifications, users } = state;

    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'popup' | 'regular'>('all');

    const findUser = (userId: string): User | undefined => {
        return users.find(u => u._id === userId);
    };

    const filteredMessages = useMemo(() => {
        return notifications
            .filter(n => n.senderType === 'Admin')
            .filter(msg => {
                const user = findUser(msg.userId);
                // Search term filter
                const term = searchTerm.toLowerCase();
                const matchesSearch = !term ||
                    (user && user.username.toLowerCase().includes(term)) ||
                    (user && user.email.toLowerCase().includes(term)) ||
                    (msg.subject && msg.subject.toLowerCase().includes(term)) ||
                    msg.message.toLowerCase().includes(term);

                // Date range filter
                const from = dateFrom ? new Date(dateFrom) : null;
                const to = dateTo ? new Date(dateTo) : null;
                if (from) from.setHours(0, 0, 0, 0);
                if (to) to.setHours(23, 59, 59, 999);
                const itemDate = new Date(msg.date);
                const matchesDate = (!from || itemDate >= from) && (!to || itemDate <= to);

                // Type filter
                const matchesType = typeFilter === 'all' ||
                    (typeFilter === 'popup' && msg.isPopup) ||
                    (typeFilter === 'regular' && !msg.isPopup);
                
                return matchesSearch && matchesDate && matchesType;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notifications, users, searchTerm, dateFrom, dateTo, typeFilter]);

    const selectedMessage = useMemo(() => {
        return filteredMessages.find(msg => msg._id === selectedMessageId);
    }, [selectedMessageId, filteredMessages]);

    const handleSelectMessage = (message: Notification) => {
        setSelectedMessageId(message._id);
    };
    
    const handleToggleSelect = (messageId: string) => {
        setSelectedMessageIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return Array.from(newSet);
        });
    };

    const handleSelectAll = () => {
        if (selectedMessageIds.length === filteredMessages.length) {
            setSelectedMessageIds([]);
        } else {
            setSelectedMessageIds(filteredMessages.map(msg => msg._id));
        }
    };

    const handleDownloadSelected = () => {
        const messagesToDownload = filteredMessages.filter(msg => selectedMessageIds.includes(msg._id));
        if (messagesToDownload.length === 0) return;

        const csvHeaders = ['Date', 'Recipient Username', 'Recipient Email', 'Subject', 'Message', 'Type'];
        const csvRows = messagesToDownload.map(msg => {
            const user = findUser(msg.userId);
            const row = [
                `"${new Date(msg.date).toLocaleString()}"`,
                `"${user?.username || 'N/A'}"`,
                `"${user?.email || 'N/A'}"`,
                `"${(msg.subject || '').replace(/"/g, '""')}"`,
                `"${msg.message.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                `"${msg.isPopup ? 'Popup' : 'Regular'}"`
            ];
            return row.join(',');
        });

        const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sent_messages_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = (idsToDelete: string[]) => {
        if (idsToDelete.length === 0) return;
        if (window.confirm(`Are you sure you want to delete ${idsToDelete.length} message(s)? This action cannot be undone.`)) {
            dispatch({ type: 'DELETE_NOTIFICATIONS', payload: idsToDelete });
            
            // Clean up selections
            setSelectedMessageIds(prev => prev.filter(id => !idsToDelete.includes(id)));
            if (selectedMessageId && idsToDelete.includes(selectedMessageId)) {
                setSelectedMessageId(null);
            }
        }
    };


    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md h-[80vh] flex flex-col">
            <div className="p-4 border-b dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Sent Messages History ({filteredMessages.length})</h2>
            </div>
            
             <div className="p-4 border-b dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="Search recipient, subject..."
                    className="sm:col-span-2 rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <option value="all">All Types</option>
                    <option value="regular">Regular</option>
                    <option value="popup">Popup</option>
                </select>
            </div>
            
            {selectedMessageIds.length > 0 && (
                <div className="p-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                    <span className="text-sm font-semibold px-2">{selectedMessageIds.length} selected</span>
                    <div className="space-x-2">
                        <Button size="sm" variant="secondary" onClick={handleDownloadSelected}>Download Selected</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(selectedMessageIds)}>Delete Selected</Button>
                    </div>
                </div>
            )}

            <div className="flex flex-grow overflow-hidden">
                <div className="w-full md:w-1/3 border-r dark:border-gray-700 overflow-y-auto">
                    <div className="p-2 border-b dark:border-gray-700 flex items-center">
                        <input 
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={filteredMessages.length > 0 && selectedMessageIds.length === filteredMessages.length}
                            onChange={handleSelectAll}
                        />
                        <label className="ml-3 text-sm font-medium">Select All</label>
                    </div>
                    {filteredMessages.length > 0 ? (
                        filteredMessages.map(msg => {
                            const user = findUser(msg.userId);
                            return (
                                <div
                                    key={msg._id}
                                    className={`p-4 cursor-pointer border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-start gap-3 ${selectedMessageId === msg._id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        className="mt-1 h-4 w-4 rounded"
                                        checked={selectedMessageIds.includes(msg._id)}
                                        onChange={() => handleToggleSelect(msg._id)}
                                    />
                                    <div className="flex-grow" onClick={() => handleSelectMessage(msg)}>
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
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-4 text-center text-gray-500">
                            No messages found for the selected filters.
                        </div>
                    )}
                </div>

                <div className="hidden md:block w-2/3 p-6 overflow-y-auto">
                    {selectedMessage ? (
                        <div>
                            <div className="border-b dark:border-gray-700 pb-4 mb-4 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {selectedMessage.subject || 'No Subject'}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Sent to <strong>{findUser(selectedMessage.userId)?.username || 'N/A'}</strong> on {new Date(selectedMessage.date).toLocaleString()}
                                    </p>
                                </div>
                                <Button size="sm" variant="danger" onClick={() => handleDelete([selectedMessage._id])}>Delete</Button>
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
