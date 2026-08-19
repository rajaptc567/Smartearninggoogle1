import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Notification } from '../../types';
import { updateNotification, deleteNotification } from '../../services/api';
import Button from '../../components/ui/Button';
import { LoadingCircle } from '../../components/ui/LoadingCircle';
import { 
    Mail, 
    MailOpen, 
    Trash2, 
    Search, 
    ArrowLeft, 
    Inbox, 
    Calendar, 
    Bell, 
    Sparkles, 
    Filter, 
    Clock, 
    ShieldCheck, 
    DollarSign, 
    Wallet, 
    ArrowDownLeft, 
    LifeBuoy, 
    MessageSquare,
    RefreshCw,
    CheckCircle2,
    Lock
} from 'lucide-react';

const CategoryIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    switch (name) {
        case 'DollarSign': return <DollarSign className={className} />;
        case 'Wallet': return <Wallet className={className} />;
        case 'ArrowDownLeft': return <ArrowDownLeft className={className} />;
        case 'LifeBuoy': return <LifeBuoy className={className} />;
        case 'ShieldCheck': return <ShieldCheck className={className} />;
        default: return <Bell className={className} />;
    }
};

const getMessageCategory = (subject: string = '', message: string = '') => {
    const text = (subject + ' ' + message).toLowerCase();
    if (text.includes('earn') || text.includes('commission') || text.includes('referral') || text.includes('ref')) {
        return {
            label: 'Earning',
            color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20',
            bg: 'bg-emerald-500',
            dot: 'bg-emerald-500',
            icon: 'DollarSign'
        };
    }
    if (text.includes('deposit') || text.includes('fund') || text.includes('pay') || text.includes('payment')) {
        return {
            label: 'Deposit',
            color: 'text-blue-500 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20',
            bg: 'bg-blue-500',
            dot: 'bg-blue-500',
            icon: 'Wallet'
        };
    }
    if (text.includes('withdraw') || text.includes('payout') || text.includes('settle')) {
        return {
            label: 'Withdrawal',
            color: 'text-amber-500 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20',
            bg: 'bg-amber-500',
            dot: 'bg-amber-500',
            icon: 'ArrowDownLeft'
        };
    }
    if (text.includes('dispute') || text.includes('ticket') || text.includes('support') || text.includes('help')) {
        return {
            label: 'Support',
            color: 'text-purple-500 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/20',
            bg: 'bg-purple-500',
            dot: 'bg-purple-500',
            icon: 'LifeBuoy'
        };
    }
    if (text.includes('security') || text.includes('password') || text.includes('login') || text.includes('protect')) {
        return {
            label: 'Security',
            color: 'text-rose-500 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/20',
            bg: 'bg-rose-500',
            dot: 'bg-rose-500',
            icon: 'ShieldCheck'
        };
    }
    return {
        label: 'System',
        color: 'text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20',
        bg: 'bg-indigo-500',
        dot: 'bg-indigo-500',
        icon: 'Bell'
    };
};

const Messages: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, notifications } = state;

    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'read' | 'unread'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

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

                // Apply Category Filter
                const cat = getMessageCategory(n.subject, n.message);
                const matchesCategory = categoryFilter === 'all' || cat.label === categoryFilter;

                // Apply Date range Filter
                let matchesDate = true;
                const msgDate = new Date(n.date);
                msgDate.setHours(0,0,0,0);

                if (dateFrom) {
                    const from = new Date(dateFrom);
                    from.setHours(0,0,0,0);
                    if (msgDate < from) matchesDate = false;
                }
                if (dateTo) {
                    const to = new Date(dateTo);
                    to.setHours(0,0,0,0);
                    if (msgDate > to) matchesDate = false;
                }

                return matchesSearch && matchesFilter && matchesCategory && matchesDate;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [currentUser, notifications, searchTerm, filter, categoryFilter, dateFrom, dateTo]);

    // Calculate pagination values
    const totalPages = useMemo(() => {
        return Math.ceil(userMessages.length / itemsPerPage) || 1;
    }, [userMessages.length, itemsPerPage]);

    const paginatedMessages = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return userMessages.slice(startIndex, startIndex + itemsPerPage);
    }, [userMessages, currentPage, itemsPerPage]);

    // Active stats mapping
    const stats = useMemo(() => {
        if (!currentUser) return { total: 0, unread: 0, read: 0 };
        const totalUserNotifs = notifications.filter(n => String(n.userId) === String(currentUser._id));
        const unread = totalUserNotifs.filter(n => !n.read).length;
        const read = totalUserNotifs.filter(n => n.read).length;
        return {
            total: totalUserNotifs.length,
            unread,
            read
        };
    }, [currentUser, notifications]);

    useEffect(() => {
        // Automatically select the first message on desktop screens if none is selected
        const isDesktop = window.innerWidth >= 768;
        if (isDesktop && paginatedMessages.length > 0 && !isDeleting) {
            // Check if selected message is on current visible page
            const selectedIsOnCurrentPage = paginatedMessages.some(msg => msg._id === selectedMessageId);
            if (!selectedMessageId || !selectedIsOnCurrentPage) {
                handleSelectMessage(paginatedMessages[0]);
            }
        } else if (userMessages.length === 0) {
            setSelectedMessageId(null);
        }
    }, [paginatedMessages, selectedMessageId, isDeleting]);

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
                setSelectedMessageIds(prev => prev.filter(item => item !== id));
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

    const handleBulkDelete = async () => {
        if (selectedMessageIds.length === 0) return;
        if (window.confirm(`Are you sure you want to delete the ${selectedMessageIds.length} selected messages?`)) {
            setIsDeleting(true);
            try {
                await Promise.all(selectedMessageIds.map(id => deleteNotification(id)));
                dispatch({ type: 'DELETE_NOTIFICATIONS', payload: selectedMessageIds });
                
                if (selectedMessageId && selectedMessageIds.includes(selectedMessageId)) {
                    setSelectedMessageId(null);
                }
                setSelectedMessageIds([]);
            } catch (error) {
                console.error("Failed to delete selected messages:", error);
                alert("Failed to delete all selected messages.");
            } finally {
                setIsDeleting(false);
            }
        }
    };

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl min-h-[400px]">
                <LoadingCircle text="Retrieving secure messages inbox..." />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-950 rounded-2xl md:rounded-[2rem] shadow-xl h-[calc(100vh-140px)] min-h-[550px] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800">
            {/* Header / Toolbar */}
            <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center">
                                Messages Inbox
                            </h2>
                            <p className="text-xs text-gray-400 font-medium">Keep track of your transaction updates and system notifications</p>
                        </div>
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-1.5 self-start md:self-center">
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            Total: {stats.total}
                        </span>
                        {stats.unread > 0 && (
                            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse border border-blue-500/10">
                                Unread: {stats.unread}
                            </span>
                        )}
                        {stats.unread === 0 && stats.total > 0 && (
                            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> All Read
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Responsive Filter Bar */}
                <div className="flex flex-col xl:flex-row gap-3 w-full justify-between items-stretch xl:items-center">
                    <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-stretch md:items-center">
                        {/* Two-Column Grid for Show & Category on the same row */}
                        <div className="grid grid-cols-2 gap-3 w-full md:w-[380px] shrink-0">
                            {/* Show Limit selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider hidden sm:inline">Show:</span>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }} 
                                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20 py-2 sm:py-2.5 px-3 w-full focus:outline-none"
                                >
                                    <option value={10}>10 Messages</option>
                                    <option value={20}>20 Messages</option>
                                    <option value={25}>25 Messages</option>
                                    <option value={50}>50 Messages</option>
                                    <option value={100}>100 Messages</option>
                                </select>
                            </div>

                            {/* Category selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider hidden sm:inline">Category:</span>
                                <select 
                                    value={categoryFilter} 
                                    onChange={(e) => {
                                        setCategoryFilter(e.target.value);
                                        setCurrentPage(1);
                                    }} 
                                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20 py-2 sm:py-2.5 px-3 w-full focus:outline-none"
                                >
                                    <option value="all">All Categories</option>
                                    <option value="Earning">Earning</option>
                                    <option value="Deposit">Deposit</option>
                                    <option value="Withdrawal">Withdrawal</option>
                                    <option value="Support">Support</option>
                                    <option value="Security">Security</option>
                                    <option value="System">System</option>
                                </select>
                            </div>
                        </div>

                        {/* Date range filter from Date to Date */}
                        <div className="flex items-center justify-between gap-1.5 bg-white dark:bg-gray-900 px-3 py-2 sm:py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 w-full md:w-auto">
                            <div className="flex items-center gap-1 w-full">
                                <span className="text-[8px] font-black text-gray-400 uppercase">From:</span>
                                <input 
                                    type="date" 
                                    value={dateFrom} 
                                    onChange={(e) => {
                                        setDateFrom(e.target.value);
                                        setCurrentPage(1);
                                    }} 
                                    className="bg-transparent text-gray-800 dark:text-gray-200 text-[10px] font-black uppercase tracking-widest focus:ring-0 outline-none w-full text-center"
                                />
                            </div>
                            <span className="text-[9px] font-black text-gray-400 uppercase">-</span>
                            <div className="flex items-center gap-1 w-full">
                                <span className="text-[8px] font-black text-gray-400 uppercase">To:</span>
                                <input 
                                    type="date" 
                                    value={dateTo} 
                                    onChange={(e) => {
                                        setDateTo(e.target.value);
                                        setCurrentPage(1);
                                    }} 
                                    className="bg-transparent text-gray-800 dark:text-gray-200 text-[10px] font-black uppercase tracking-widest focus:ring-0 outline-none w-full text-center"
                                />
                            </div>
                            {(dateFrom || dateTo) && (
                                <button 
                                    onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }} 
                                    className="text-[12px] font-black text-red-500 hover:text-red-600 px-1 ml-1"
                                    title="Clear dates"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-stretch sm:items-center">
                        {/* Search Input */}
                        <div className="relative flex-grow">
                            <input 
                                type="text" 
                                placeholder="Search topics, content..." 
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-10 pr-4 py-2.5 w-full xl:w-64 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                            />
                            <div className="absolute left-3.5 top-3 text-gray-400">
                                <Search className="w-4 h-4" />
                            </div>
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-xl p-1 border border-gray-200/40 dark:border-gray-800/60 justify-around">
                            {(['all', 'unread', 'read'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => {
                                        setFilter(f);
                                        setCurrentPage(1);
                                    }}
                                    className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${
                                        filter === f 
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/50 dark:border-gray-700/50' 
                                        : 'text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-grow overflow-hidden relative">
                {/* Message List Sidebar */}
                <div className={`w-full md:w-2/5 lg:w-1/3 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col ${selectedMessageId ? 'hidden md:flex' : 'flex'}`}>
                    {userMessages.length > 0 ? (
                        <div className="flex flex-col flex-grow divide-y divide-gray-50 dark:divide-gray-900/60 overflow-hidden">
                            {/* Bulk Select Header Row */}
                            <div className="p-3 md:p-4 bg-gray-50/40 dark:bg-gray-900/10 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 backdrop-blur-sm flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox"
                                        checked={paginatedMessages.length > 0 && paginatedMessages.every(msg => selectedMessageIds.includes(msg._id))}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                // Add current page's visible message IDs to selection
                                                setSelectedMessageIds(prev => {
                                                    const updated = [...prev];
                                                    paginatedMessages.forEach(msg => {
                                                        if (!updated.includes(msg._id)) {
                                                            updated.push(msg._id);
                                                        }
                                                    });
                                                    return updated;
                                                });
                                            } else {
                                                // Remove current page's visible message IDs from selection
                                                setSelectedMessageIds(prev => prev.filter(id => !paginatedMessages.some(msg => msg._id === id)));
                                            }
                                        }}
                                        className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                                        Select All
                                    </span>
                                </div>
                                {selectedMessageIds.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={isDeleting}
                                        className="flex items-center gap-1.5 text-[10px] font-black uppercase text-red-500 hover:text-red-600 tracking-wider bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 px-2.5 py-1 rounded-lg transition-all duration-200"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete ({selectedMessageIds.length})</span>
                                    </button>
                                )}
                            </div>

                            <div className="divide-y divide-gray-50 dark:divide-gray-900/60 overflow-y-auto flex-grow">
                                {paginatedMessages.map(msg => {
                                    const cat = getMessageCategory(msg.subject, msg.message);
                                    const isSelected = selectedMessageId === msg._id;
                                    const isChecked = selectedMessageIds.includes(msg._id);
                                    return (
                                        <div
                                            key={msg._id}
                                            onClick={() => handleSelectMessage(msg)}
                                            className={`group p-4 md:p-5 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-900/30 transition-all duration-200 relative flex gap-3 items-start ${
                                                isSelected 
                                                ? 'bg-blue-50/50 dark:bg-blue-950/15 border-l-4 border-l-blue-500' 
                                                : 'border-l-4 border-l-transparent'
                                            }`}
                                        >
                                            {/* Multi-select Checkbox */}
                                            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedMessageIds(prev => [...prev, msg._id]);
                                                        } else {
                                                            setSelectedMessageIds(prev => prev.filter(id => id !== msg._id));
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                                                />
                                            </div>

                                            <div className="flex-grow flex flex-col gap-2 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {/* Category tag */}
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${cat.color} flex items-center gap-1`}>
                                                            <CategoryIcon name={cat.icon} className="w-2.5 h-2.5" />
                                                            {cat.label}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap flex items-center gap-1">
                                                        <Clock className="w-3 h-3 opacity-60" />
                                                        {new Date(msg.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>

                                                <div className="flex flex-col gap-1 pr-4">
                                                    <h3 className={`text-xs font-black uppercase tracking-tight truncate ${!msg.read ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {msg.subject || 'Admin Notification'}
                                                    </h3>
                                                    <p className={`text-xs line-clamp-2 leading-relaxed ${!msg.read ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        {msg.message}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex justify-between items-center mt-1">
                                                    {/* Status Dot */}
                                                    {!msg.read ? (
                                                        <span className="flex h-2 w-2 relative">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                        </span>
                                                    ) : (
                                                        <div className="w-2 h-2"></div>
                                                    )}

                                                    {/* Quick Actions */}
                                                    <button 
                                                        onClick={(e) => handleDelete(e, msg._id)}
                                                        className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
                                                        title="Delete message"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination Footer Controls */}
                            {totalPages > 1 && (
                                <div className="p-3 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                        Page {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-800">
                                <Inbox className="w-6 h-6 text-gray-400" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Your Inbox is Clear</h4>
                            <p className="text-xs text-gray-400 mt-1.5 max-w-[200px] mx-auto leading-relaxed">No messages match your selected filters right now.</p>
                        </div>
                    )}
                </div>

                {/* Message Content Area */}
                <div className={`w-full md:w-3/5 lg:w-2/3 p-0 bg-gray-50/50 dark:bg-gray-900/10 overflow-y-auto flex flex-col ${!selectedMessageId ? 'hidden md:flex' : 'flex'}`}>
                    {selectedMessage ? (
                        <div className="flex flex-col h-full">
                            {/* Actions / Mobile back button */}
                            <div className="p-4 md:p-6 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 shadow-sm flex-shrink-0 flex items-center justify-between gap-4">
                                <button
                                    onClick={() => setSelectedMessageId(null)}
                                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 md:hidden transition-all duration-200 border border-gray-100 dark:border-gray-800/60"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Back to List</span>
                                </button>

                                <div className="hidden md:flex items-center gap-2">
                                    <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 border border-gray-200/20 dark:border-gray-800/60">
                                        Support Team Notification
                                    </div>
                                </div>

                                <Button 
                                    size="sm" 
                                    variant="danger" 
                                    onClick={(e) => handleDelete(e, selectedMessage._id)}
                                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg transition-all duration-200 border-none"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> 
                                    <span>Delete</span>
                                </Button>
                            </div>

                            {/* Message Header */}
                            <div className="p-6 md:p-8 bg-white dark:bg-gray-950 border-b border-gray-50 dark:border-gray-900/60">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/10">
                                        SE
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">SmartEarning Support</p>
                                        <div className="flex items-center gap-1.5 text-gray-400 mt-0.5">
                                            <Calendar className="w-3.5 h-3.5 opacity-80" />
                                            <p className="text-[10px] font-semibold">
                                                {new Date(selectedMessage.date).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tight">
                                    {selectedMessage.subject || 'No Subject'}
                                </h1>
                            </div>
                            
                            {/* Message Body */}
                            <div className="p-6 md:p-8 flex-grow">
                                <div className="bg-white dark:bg-gray-950 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-900/60 shadow-inner">
                                    <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-300 text-xs md:text-sm whitespace-pre-wrap leading-relaxed">
                                        {selectedMessage.message}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Note */}
                            <div className="p-4 md:p-6 bg-gray-50/50 dark:bg-gray-950/20 border-t border-gray-100 dark:border-gray-900/40 text-center flex items-center justify-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                    Secured Official Transmission
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-white dark:bg-gray-950">
                            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/20 rounded-3xl flex items-center justify-center mb-6 border border-blue-100/40 dark:border-blue-900/20 shadow-inner">
                                <MailOpen className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className="text-base font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">Select a message to read</h3>
                            <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
                                Pick any message from the inbox on the left to read its full official details and updates.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;
