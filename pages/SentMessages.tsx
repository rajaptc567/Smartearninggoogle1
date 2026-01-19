
import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Notification, User } from '../types';
import Button from '../components/ui/Button';

// Icons
const ReadIcon = () => (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="Read by user">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" transform="translate(3,0)" className="opacity-50" />
    </svg>
);

const UnreadIcon = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="Unread">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

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
    const [statusFilter, setStatusFilter] = useState<'all' | 'read' | 'unread'>('all');

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
                
                // Status filter
                const matchesStatus = statusFilter === 'all' ||
                    (statusFilter === 'read' && msg.read) ||
                    (statusFilter === 'unread' && !msg.read);
                
                return matchesSearch && matchesDate && matchesType && matchesStatus;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notifications, users, searchTerm, dateFrom, dateTo, typeFilter, statusFilter]);

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

        const csvHeaders = ['Date', 'Recipient Username', 'Recipient Email', 'Subject', 'Message', 'Type', 'Status'];
        const csvRows = messagesToDownload.map(msg => {
            const user = findUser(msg.userId);
            const row = [
                `"${new Date(msg.date).toLocaleString()}"`,
                `"${user?.username || 'N/A'}"`,
                `"${user?.email || 'N/A'}"`,
                `"${(msg.subject || '').replace(/"/g, '""')}"`,
                `"${msg.message.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                `"${msg.isPopup ? 'Popup' : 'Regular'}"`,
                `"${msg.read ? 'Read' : 'Unread'}"`
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Sent Messages History ({filteredMessages.length})</h2>
            </div>
            
             <div className="p-4 border-b dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white dark:bg-gray-800">
                <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="Search recipient, subject..."
                    className="sm:col-span-2 lg:col-span-2 rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
                />
                <div className="flex gap-2">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-1/2 rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"/>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-1/2 rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"/>
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm">
                    <option value="all">All Types</option>
                    <option value="regular">Regular</option>
                    <option value="popup">Popup</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm">
                    <option value="all">All Statuses</option>
                    <option value="read">Read</option>
                    <option value="unread">Unread</option>
                </select>
            </div>
            
            {selectedMessageIds.length > 0 && (
                <div className="p-2 border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30 flex justify-between items-center transition-all animate-fade-in">
                    <span className="text-sm font-semibold px-2 text-blue-700 dark:text-blue-300">{selectedMessageIds.length} selected</span>
                    <div className="space-x-2">
                        <Button size="sm" variant="secondary" onClick={handleDownloadSelected}>Download CSV</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(selectedMessageIds)}>Delete</Button>
                    </div>
                </div>
            )}

            <div className="flex flex-grow overflow-hidden">
                <div className="w-full md:w-1/3 border-r dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
                    <div className="p-3 border-b dark:border-gray-700 flex items-center bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                        <input 
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={filteredMessages.length > 0 && selectedMessageIds.length === filteredMessages.length}
                            onChange={handleSelectAll}
                        />
                        <label className="ml-3 text-xs font-bold uppercase text-gray-500 tracking-wider">Select All</label>
                    </div>
                    {filteredMessages.length > 0 ? (
                        filteredMessages.map(msg => {
                            const user = findUser(msg.userId);
                            return (
                                <div
                                    key={msg._id}
                                    className={`p-4 cursor-pointer border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-start gap-3 transition-colors ${selectedMessageId === msg._id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedMessageIds.includes(msg._id)}
                                        onChange={() => handleToggleSelect(msg._id)}
                                    />
                                    <div className="flex-grow min-w-0" onClick={() => handleSelectMessage(msg)}>
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate pr-2">
                                                To: {user?.username || 'Unknown'}
                                            </h3>
                                            <div className="flex items-center gap-1">
                                                {msg.isPopup && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Popup</span>}
                                                {msg.read ? <ReadIcon /> : <UnreadIcon />}
                                            </div>
                                        </div>
                                         <p className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate">
                                            {msg.subject || 'No Subject'}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                            {msg.message}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-2 text-right">
                                            {new Date(msg.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            No messages found matching filters.
                        </div>
                    )}
                </div>

                <div className="hidden md:flex w-2/3 p-0 bg-gray-50 dark:bg-gray-900 flex-col overflow-hidden">
                    {selectedMessage ? (
                        <div className="flex flex-col h-full">
                            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-6 shadow-sm flex-shrink-0">
                                <div className="flex justify-between items-start mb-4">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {selectedMessage.subject || 'No Subject'}
                                    </h2>
                                    <div className="flex gap-2">
                                         <Button size="sm" variant="danger" onClick={() => handleDelete([selectedMessage._id])}>
                                            <TrashIcon /> <span className="ml-1">Delete</span>
                                         </Button>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border dark:border-gray-700">
                                    <div>
                                        <span className="font-semibold">Recipient:</span> {findUser(selectedMessage.userId)?.username || 'Unknown'} <span className="text-xs">({findUser(selectedMessage.userId)?.email})</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="flex items-center gap-1" title={selectedMessage.read ? "Read by user" : "Not yet read"}>
                                            Status: 
                                            <span className={`font-bold ${selectedMessage.read ? 'text-green-600' : 'text-gray-500'}`}>
                                                {selectedMessage.read ? 'Read' : 'Unread'}
                                            </span>
                                            {selectedMessage.read ? <ReadIcon /> : <UnreadIcon />}
                                        </span>
                                        <span>{new Date(selectedMessage.date).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow p-8 overflow-y-auto">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 prose dark:prose-invert max-w-none whitespace-pre-wrap">
                                    {selectedMessage.message}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50 dark:bg-gray-900">
                            <div className="text-center">
                                <svg className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Select a message</h3>
                                <p className="mt-1 text-gray-500">View sent message details and status.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SentMessages;
