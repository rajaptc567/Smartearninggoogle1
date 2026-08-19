import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Notification } from '../../types';
import { useData } from '../../hooks/useData';
import { markNotificationsAsRead, updateNotification } from '../../services/api';

interface NotificationBellProps {
  notifications: Notification[];
  userId?: string;
  isAdmin?: boolean;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, userId, isAdmin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { dispatch } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  const handleToggle = async () => {
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);
    
    if (nextIsOpen && unreadCount > 0 && userId) {
      try {
        // Mark as read when the panel is opened (for standard users)
        const updatedNotifications = await markNotificationsAsRead(userId);
        dispatch({ type: 'MARK_NOTIFICATIONS_AS_READ', payload: updatedNotifications });
      } catch (error) {
        console.error("Failed to mark notifications as read:", error);
      }
    }
  };

  const getNotificationAction = (message: string, subject?: string) => {
    const msg = (message || '').toLowerCase();
    const sub = (subject || '').toLowerCase();

    // Disputes
    if (msg.includes('dispute') || sub.includes('dispute')) {
      return { 
        label: 'Manage Dispute', 
        path: '/admin/disputes', 
        color: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50' 
      };
    }
    // Deposits
    if (msg.includes('deposit') || sub.includes('deposit')) {
      return { 
        label: 'Review Deposit', 
        path: '/admin/deposits', 
        color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50' 
      };
    }
    // Withdrawals
    if (msg.includes('withdraw') || sub.includes('withdraw')) {
      return { 
        label: 'Review Withdrawal', 
        path: '/admin/withdrawals', 
        color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50' 
      };
    }
    // Password Reset Requests
    if (msg.includes('password') || msg.includes('reset') || sub.includes('password') || sub.includes('reset')) {
      return { 
        label: 'Manage Resets', 
        path: '/admin/password-resets', 
        color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50' 
      };
    }
    // Tasks
    if (msg.includes('task') || msg.includes('proof') || sub.includes('task') || sub.includes('proof')) {
      return { 
        label: 'Review Tasks', 
        path: '/admin/tasks', 
        color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50' 
      };
    }
    // Transfers
    if (msg.includes('transfer') || sub.includes('transfer')) {
      return { 
        label: 'Review Transfers', 
        path: '/admin/transfers', 
        color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50' 
      };
    }
    // Users
    if (msg.includes('user') || msg.includes('member') || msg.includes('joined') || msg.includes('network') || sub.includes('user') || sub.includes('member')) {
      return { 
        label: 'Manage Users', 
        path: '/admin/users', 
        color: 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-900/50' 
      };
    }
    // Logs / Commissions
    if (msg.includes('commission') || sub.includes('commission')) {
      return { 
        label: 'View Logs', 
        path: '/admin/logs', 
        color: 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700' 
      };
    }

    return null;
  };

  const handleNotificationClick = async (notif: Notification, action: { label: string; path: string } | null) => {
    if (!notif.read) {
      try {
        const updated = await updateNotification(notif._id, { read: true });
        dispatch({ type: 'UPDATE_NOTIFICATION', payload: updated });
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    if (action && action.path) {
      navigate(action.path);
    }
    
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button onClick={handleToggle} className="relative text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors focus:outline-none" aria-label="Notifications">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-3xs sm:text-2xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full shrink-0">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-4 font-bold border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
            <span className="text-gray-800 dark:text-white">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-xs px-2 py-0.5 rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.length > 0 ? (
              notifications.map(notif => {
                const action = isAdmin ? getNotificationAction(notif.message, notif.subject) : null;
                return (
                  <div 
                    key={notif._id} 
                    onClick={() => handleNotificationClick(notif, action)}
                    className={`p-4 transition-all duration-150 cursor-pointer text-left relative group hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                      !notif.read ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {!notif.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1 shrink-0" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        {notif.subject && (
                          <h4 className="text-3xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">
                            {notif.subject}
                          </h4>
                        )}
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-words font-medium leading-relaxed">
                          {notif.message}
                        </p>
                        
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="text-2xs text-gray-400 dark:text-gray-500">
                            {new Date(notif.date).toLocaleString()}
                          </span>
                          
                          {action && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(notif, action);
                              }}
                              className={`text-2xs px-2 py-1 rounded-md font-semibold transition-all duration-150 flex items-center gap-1 shrink-0 ${action.color}`}
                            >
                              <span>{action.label}</span>
                              <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm">No new notifications.</p>
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="p-3 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-center">
              <button
                onClick={() => {
                  navigate('/admin/notifications');
                  setIsOpen(false);
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-1 mx-auto transition-colors"
              >
                <span>View Control Panel</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;