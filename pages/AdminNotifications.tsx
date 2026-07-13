import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { Notification } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { deleteNotification, bulkDeleteNotifications, updateNotification, createNotification, getNotifications, getBulkPopups, createBulkPopup as createBulkPopupApi, updateBulkPopup, deleteBulkPopup } from '../services/api';

interface ResolvedNotificationInfo {
  notification: Notification;
  entityType: 'Deposit' | 'Withdrawal' | 'Dispute' | 'Task' | 'Transfer' | 'PasswordReset' | 'System';
  entityId: string;
  situation: 'Pending' | 'Approved' | 'Rejected' | 'Open' | 'Resolved' | 'Completed' | 'None';
  targetPath: string;
  isHandled: boolean;
  userLabel: string;
}

const AdminNotifications: React.FC = () => {
  const { state, dispatch } = useData();
  const { notifications, deposits, withdrawals, disputes, tasks, passwordResetRequests, users } = state;
  const navigate = useNavigate();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [situationFilter, setSituationFilter] = useState('All');
  const [readFilter, setReadFilter] = useState('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  // Bulk Pop-up Form State
  const [activeTab, setActiveTab] = useState<'history' | 'bulk_popup'>('history');
  const [bulkPopupSubTab, setBulkPopupSubTab] = useState<'send' | 'active' | 'history'>('send');
  const [bulkPopupsList, setBulkPopupsList] = useState<any[]>([]);
  const [popupSubject, setPopupSubject] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupImageUrl, setPopupImageUrl] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'plan' | 'single' | 'inactive'>('all');
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [displayTrigger, setDisplayTrigger] = useState<'login' | 'every_page' | 'delay_30s' | 'delay_2m' | 'delay_10m'>('login');
  const [frequency, setFrequency] = useState<'once_per_user' | 'every_visit'>('once_per_user');
  const [actionButtonText, setActionButtonText] = useState('');
  const [actionButtonLink, setActionButtonLink] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isSendingPopup, setIsSendingPopup] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  useEffect(() => {
    fetchBulkPopups();
  }, []);

  const fetchBulkPopups = async () => {
    try {
      const data = await getBulkPopups();
      setBulkPopupsList(data || []);
    } catch (err) {
      console.error('Failed to fetch bulk popups:', err);
    }
  };

  const filteredUsersForSelection = useMemo(() => {
    if (!userSearchTerm) return users.slice(0, 10);
    return users.filter(u => u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email.toLowerCase().includes(userSearchTerm.toLowerCase())).slice(0, 15);
  }, [users, userSearchTerm]);

  const handleSendBulkPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!popupMessage.trim()) {
      alert('Please enter notification description / HTML content.');
      return;
    }
    if (targetType === 'plan' && selectedPlanIds.length === 0) {
      alert('Please select at least one investment plan.');
      return;
    }
    if (targetType === 'single' && selectedUserIds.length === 0) {
      alert('Please select at least one user.');
      return;
    }

    setIsSendingPopup(true);
    try {
      const payload = {
        subject: popupSubject,
        message: popupMessage,
        imageUrl: popupImageUrl,
        targetType,
        targetIds: targetType === 'single' ? selectedUserIds : undefined,
        targetPlanIds: targetType === 'plan' ? selectedPlanIds : undefined,
        displayTrigger,
        frequency,
        actionButtonText,
        actionButtonLink,
        selectedChannels
      };
      const result = await createBulkPopupApi(payload);
      alert(`Successfully broadcasted pop-up notification to ${result.count} users!`);
      
      const [updatedNotifs, updatedPopups] = await Promise.all([
        getNotifications(),
        getBulkPopups()
      ]);
      dispatch({ type: 'SET_NOTIFICATIONS', payload: updatedNotifs });
      setBulkPopupsList(updatedPopups || []);

      setPopupSubject('');
      setPopupMessage('');
      setPopupImageUrl('');
      setSelectedPlanIds([]);
      setSelectedUserIds([]);
      setBulkPopupSubTab('history');
    } catch (err: any) {
      console.error('Failed to send bulk pop-up:', err);
      alert(err.message || 'Failed to send bulk pop-up notification.');
    } finally {
      setIsSendingPopup(false);
    }
  };

  const handleEditAndResend = (broadcast: any) => {
    setPopupSubject(broadcast.subject || '');
    setPopupMessage(broadcast.message || '');
    setPopupImageUrl(broadcast.imageUrl || '');
    setTargetType(broadcast.targetType || 'all');
    setSelectedPlanIds(broadcast.targetPlanIds || []);
    setSelectedUserIds(broadcast.targetIds || []);
    setDisplayTrigger(broadcast.displayTrigger || 'login');
    setFrequency(broadcast.frequency || 'once_per_user');
    setActionButtonText(broadcast.actionButtonText || '');
    setActionButtonLink(broadcast.actionButtonLink || '');
    setSelectedChannels(broadcast.selectedChannels || []);
    setBulkPopupSubTab('send');
  };

  const handleResendQuick = async (broadcast: any) => {
    if (!window.confirm(`Are you sure you want to resend broadcast "${broadcast.subject || 'Untitled'}" to all targeted users again?`)) return;
    try {
      const payload = {
        subject: broadcast.subject,
        message: broadcast.message,
        imageUrl: broadcast.imageUrl,
        targetType: broadcast.targetType,
        targetIds: broadcast.targetIds,
        targetPlanIds: broadcast.targetPlanIds,
        displayTrigger: broadcast.displayTrigger,
        frequency: broadcast.frequency,
        actionButtonText: broadcast.actionButtonText,
        actionButtonLink: broadcast.actionButtonLink,
        selectedChannels: broadcast.selectedChannels
      };
      const result = await createBulkPopupApi(payload);
      alert(`Successfully re-broadcasted to ${result.count} users!`);
      const [updatedNotifs, updatedPopups] = await Promise.all([
        getNotifications(),
        getBulkPopups()
      ]);
      dispatch({ type: 'SET_NOTIFICATIONS', payload: updatedNotifs });
      setBulkPopupsList(updatedPopups || []);
    } catch (err: any) {
      alert(err.message || 'Failed to resend broadcast.');
    }
  };

  const handleDeleteBroadcastItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this broadcast record from history?')) return;
    try {
      await deleteBulkPopup(id);
      setBulkPopupsList(prev => prev.filter(b => b._id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete broadcast.');
    }
  };

  const handleToggleStatusItem = async (broadcast: any) => {
    try {
      const newStatus = broadcast.status === 'active' ? 'paused' : 'active';
      const updated = await updateBulkPopup(broadcast._id, { status: newStatus });
      setBulkPopupsList(prev => prev.map(b => b._id === broadcast._id ? updated : b));
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  // Resolve linked entity and status for every notification
  const enrichedNotifications = useMemo<ResolvedNotificationInfo[]>(() => {
    return notifications.map(notif => {
      // Find the username associated with the notification
      const notificationUser = users.find(u => u._id === notif.userId);
      const userLabel = notificationUser ? `@${notificationUser.username}` : 'System / Guest';

      // Extract 24-character hex strings
      const hex24Regex = /[0-9a-fA-F]{24}/g;
      const foundIds = notif.message.match(hex24Regex) || [];

      let entityType: 'Deposit' | 'Withdrawal' | 'Dispute' | 'Task' | 'Transfer' | 'PasswordReset' | 'System' = 'System';
      let entityId = '';
      let situation: 'Pending' | 'Approved' | 'Rejected' | 'Open' | 'Resolved' | 'Completed' | 'None' = 'None';
      let targetPath = '';

      const lowerMsg = (notif.message || '').toLowerCase();
      const lowerSub = (notif.subject || '').toLowerCase();

      // Preliminary classification based on keywords
      if (lowerMsg.includes('deposit') || lowerSub.includes('deposit')) {
        entityType = 'Deposit';
        targetPath = '/admin/deposits';
      } else if (lowerMsg.includes('withdraw') || lowerSub.includes('withdraw')) {
        entityType = 'Withdrawal';
        targetPath = '/admin/withdrawals';
      } else if (lowerMsg.includes('dispute') || lowerSub.includes('dispute')) {
        entityType = 'Dispute';
        targetPath = '/admin/disputes';
      } else if (lowerMsg.includes('task') || lowerMsg.includes('proof') || lowerSub.includes('task') || lowerSub.includes('proof')) {
        entityType = 'Task';
        targetPath = '/admin/tasks';
      } else if (lowerMsg.includes('transfer') || lowerSub.includes('transfer')) {
        entityType = 'Transfer';
        targetPath = '/admin/transfers';
      } else if (lowerMsg.includes('password') || lowerMsg.includes('reset') || lowerSub.includes('password') || lowerSub.includes('reset')) {
        entityType = 'PasswordReset';
        targetPath = '/admin/password-resets';
      }

      // Exact matching via found Mongo ObjectIDs
      for (const id of foundIds) {
        const dep = deposits.find(d => d._id === id);
        if (dep) {
          entityType = 'Deposit';
          entityId = id;
          situation = dep.status; // 'Pending' | 'Approved' | 'Rejected'
          targetPath = '/admin/deposits';
          break;
        }

        const wd = withdrawals.find(w => w._id === id);
        if (wd) {
          entityType = 'Withdrawal';
          entityId = id;
          situation = wd.status; // 'Pending' | 'Approved' | 'Rejected'
          targetPath = '/admin/withdrawals';
          break;
        }

        const disp = disputes.find(d => d._id === id);
        if (disp) {
          entityType = 'Dispute';
          entityId = id;
          situation = disp.status === 'Open' ? 'Open' : 'Resolved';
          targetPath = '/admin/disputes';
          break;
        }

        const tk = tasks.find(t => t._id === id);
        if (tk) {
          entityType = 'Task';
          entityId = id;
          situation = tk.status as any; // e.g. 'Pending' | 'Approved' | 'Rejected'
          targetPath = '/admin/tasks';
          break;
        }

        const pr = passwordResetRequests.find(p => p._id === id);
        if (pr) {
          entityType = 'PasswordReset';
          entityId = id;
          situation = pr.status; // 'Pending' | 'Approved' | 'Rejected'
          targetPath = '/admin/password-resets';
          break;
        }
      }

      // If no ID matched but we classified it, try finding latest of that type for the user
      if (entityId === '' && entityType !== 'System' && notif.userId) {
        if (entityType === 'Deposit') {
          const latestDep = [...deposits].filter(d => d.userId === notif.userId).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0];
          if (latestDep) {
            entityId = latestDep._id;
            situation = latestDep.status;
          }
        } else if (entityType === 'Withdrawal') {
          const latestWd = [...withdrawals].filter(w => w.userId === notif.userId).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0];
          if (latestWd) {
            entityId = latestWd._id;
            situation = latestWd.status;
          }
        } else if (entityType === 'Dispute') {
          const latestDisp = [...disputes].filter(d => d.userId === notif.userId).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())[0];
          if (latestDisp) {
            entityId = latestDisp._id;
            situation = latestDisp.status === 'Open' ? 'Open' : 'Resolved';
          }
        }
      }

      // Determine if the item is successfully "handled"
      // Handled means Approved, Rejected, Resolved, or if the notification itself is marked read.
      const isHandled = 
        notif.read ||
        ['Approved', 'Rejected', 'Resolved', 'Completed'].includes(situation) ||
        (entityType === 'System' && notif.read);

      return {
        notification: notif,
        entityType,
        entityId,
        situation,
        targetPath,
        isHandled,
        userLabel
      };
    });
  }, [notifications, deposits, withdrawals, disputes, tasks, passwordResetRequests, users]);

  // Filter Logic
  const filteredNotifications = useMemo(() => {
    return enrichedNotifications.filter(item => {
      const notif = item.notification;
      
      // Search
      const matchesSearch = 
        notif.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (notif.subject && notif.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.userLabel.toLowerCase().includes(searchTerm.toLowerCase());

      // Category filter
      const matchesCategory = categoryFilter === 'All' ? true : item.entityType === categoryFilter;

      // Situation / Status filter
      let matchesSituation = true;
      if (situationFilter !== 'All') {
        if (situationFilter === 'Pending') {
          matchesSituation = ['Pending', 'Open'].includes(item.situation);
        } else if (situationFilter === 'Approved') {
          matchesSituation = ['Approved', 'Completed'].includes(item.situation);
        } else if (situationFilter === 'Rejected') {
          matchesSituation = item.situation === 'Rejected';
        } else if (situationFilter === 'Handled') {
          matchesSituation = item.isHandled;
        } else if (situationFilter === 'Unhandled') {
          matchesSituation = !item.isHandled;
        }
      }

      // Read status filter
      const matchesRead = readFilter === 'All' ? true :
                            readFilter === 'Read' ? notif.read : !notif.read;

      return matchesSearch && matchesCategory && matchesSituation && matchesRead;
    });
  }, [enrichedNotifications, searchTerm, categoryFilter, situationFilter, readFilter]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, situationFilter, readFilter, itemsPerPage]);

  // Pagination Calculation
  const totalItems = filteredNotifications.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredNotifications.slice(start, start + itemsPerPage);
  }, [filteredNotifications, currentPage, itemsPerPage]);

  // Selection Actions
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    const visibleIds = paginatedNotifications.map(item => item.notification._id);
    const allVisibleSelected = visibleIds.every(id => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const uniqueIds = new Set([...prev, ...visibleIds]);
        return Array.from(uniqueIds);
      });
    }
  };

  // Marking as Read
  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.length === 0) return;
    setIsMarking(true);
    try {
      // Loop through and update on backend or we can do it asynchronously
      const updatePromises = selectedIds.map(id => updateNotification(id, { read: true }));
      const results = await Promise.all(updatePromises);
      
      // Dispatch updates
      results.forEach(updated => {
        dispatch({ type: 'UPDATE_NOTIFICATION', payload: updated });
      });

      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    } finally {
      setIsMarking(false);
    }
  };

  // Bulk deletion
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} notifications?`)) return;
    
    setIsDeleting(true);
    try {
      await bulkDeleteNotifications(selectedIds);
      dispatch({ type: 'DELETE_NOTIFICATIONS', payload: selectedIds });
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to bulk delete notifications:', error);
      alert('Failed to delete notifications. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Clean handled (Deletes all successfully approved/rejected/resolved or read notifications)
  const handleDeleteHandled = async () => {
    const handledIds = enrichedNotifications
      .filter(item => item.isHandled)
      .map(item => item.notification._id);

    if (handledIds.length === 0) {
      alert('No successfully handled/resolved notifications found to clean up.');
      return;
    }

    if (!window.confirm(`Are you sure you want to bulk-delete ${handledIds.length} resolved / read notifications?`)) return;

    setIsDeleting(true);
    try {
      await bulkDeleteNotifications(handledIds);
      dispatch({ type: 'DELETE_NOTIFICATIONS', payload: handledIds });
      // Remove deleted ids from selected list if any
      setSelectedIds(prev => prev.filter(id => !handledIds.includes(id)));
    } catch (error) {
      console.error('Failed to clean handled notifications:', error);
      alert('Failed to clean up. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigation Helper
  const handleNavigateToManage = (item: ResolvedNotificationInfo) => {
    if (item.targetPath) {
      navigate(item.targetPath);
    }
  };

  const toggleSingleRead = async (notif: Notification) => {
    try {
      const updated = await updateNotification(notif._id, { read: !notif.read });
      dispatch({ type: 'UPDATE_NOTIFICATION', payload: updated });
    } catch (error) {
      console.error('Failed to toggle read state:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header and Summary Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Notifications Control Panel
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Analyze, monitor situations of requests, and perform cleanups of handled alerts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            id="btn-clean-handled"
            onClick={handleDeleteHandled}
            variant="outline"
            disabled={isDeleting}
            className="border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold flex items-center gap-2 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clean Handled & Read ({enrichedNotifications.filter(i => i.isHandled).length})
          </Button>

          {selectedIds.length > 0 && (
            <>
              <Button
                id="btn-mark-read"
                onClick={handleMarkSelectedAsRead}
                variant="outline"
                disabled={isMarking}
                className="font-bold text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Mark Read ({selectedIds.length})
              </Button>
              <Button
                id="btn-delete-selected"
                onClick={handleDeleteSelected}
                variant="danger"
                disabled={isDeleting}
                className="font-bold flex items-center gap-1"
              >
                Delete Selected ({selectedIds.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Notifications</div>
          <div className="text-2xl font-black text-gray-800 dark:text-white mt-1">{notifications.length}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-2xs font-bold text-blue-500 uppercase tracking-wider">Unread Alerts</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {notifications.filter(n => !n.read).length}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-2xs font-bold text-amber-500 uppercase tracking-wider">Pending Situations</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {enrichedNotifications.filter(i => ['Pending', 'Open'].includes(i.situation)).length}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-2xs font-bold text-emerald-500 uppercase tracking-wider">Handled / Resolved</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {enrichedNotifications.filter(i => i.isHandled).length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Send History Logs ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('bulk_popup')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'bulk_popup'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Bulk Pop-up Broadcasts 🚀
        </button>
      </div>

      {activeTab === 'bulk_popup' && (
        <div className="space-y-6">
          {/* Sub-tabs header */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl max-w-lg mx-auto mb-6">
            <button
              onClick={() => setBulkPopupSubTab('send')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                bulkPopupSubTab === 'send'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🚀 Broadcast New
            </button>
            <button
              onClick={() => setBulkPopupSubTab('active')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                bulkPopupSubTab === 'active'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              ✨ Active ({bulkPopupsList.filter(b => b.status === 'active').length})
            </button>
            <button
              onClick={() => setBulkPopupSubTab('history')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                bulkPopupSubTab === 'history'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📜 History ({bulkPopupsList.length})
            </button>
          </div>

          {bulkPopupSubTab === 'send' && (
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-xl max-w-4xl mx-auto">
              <div className="mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-xl font-black text-gray-900 dark:text-white">🚀 Broadcast Bulk Pop-up Notification</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Configure targeted pop-up announcements with images, rich HTML descriptions, display triggers, and call-to-action buttons.
                </p>
              </div>

              <form onSubmit={handleSendBulkPopup} className="space-y-6">
                {/* Target Audience */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Target Audience</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'all', label: 'All Members', desc: 'Every registered user' },
                      { id: 'plan', label: 'By Active Plans', desc: 'Users holding specific plans' },
                      { id: 'single', label: 'Manual Selection', desc: 'Search & pick specific users' },
                      { id: 'inactive', label: 'Inactive / No Plan', desc: 'Users without active plans' }
                    ].map(item => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setTargetType(item.id as any)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          targetType === item.id
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 shadow-sm'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <p className="font-bold text-sm">{item.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* If Plan target type */}
                {targetType === 'plan' && (
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Select Investment Plans:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-2">
                      {state.investmentPlans.map(plan => {
                        const isChecked = selectedPlanIds.includes(plan._id);
                        return (
                          <label 
                            key={plan._id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) setSelectedPlanIds(prev => [...prev, plan._id]);
                                else setSelectedPlanIds(prev => prev.filter(id => id !== plan._id));
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold truncate text-gray-900 dark:text-white">{plan.name}</p>
                              <p className="text-[10px] text-gray-500">{plan.currency} {plan.price}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* If Manual Selection */}
                {targetType === 'single' && (
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Select Specific Users ({selectedUserIds.length} selected):</label>
                      <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={userSearchTerm}
                        onChange={e => setUserSearchTerm(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs w-64"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-2">
                      {filteredUsersForSelection.map(user => {
                        const isChecked = selectedUserIds.includes(user._id);
                        return (
                          <label
                            key={user._id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isChecked ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) setSelectedUserIds(prev => [...prev, user._id]);
                                else setSelectedUserIds(prev => prev.filter(id => id !== user._id));
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold truncate text-gray-900 dark:text-white">@{user.username}</p>
                              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subject / Title */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Popup Title / Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. 🎉 Special Bonus & Promotion Event!"
                    value={popupSubject}
                    onChange={e => setPopupSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Banner Image URL */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Banner Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/banner-image.jpg"
                    value={popupImageUrl}
                    onChange={e => setPopupImageUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {popupImageUrl && (
                    <div className="mt-3 relative h-36 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                      <img src={popupImageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>

                {/* Description / HTML Content */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500">Description & HTML Content</label>
                    <span className="text-[10px] text-gray-400 font-mono">Supports HTML tags (&lt;b&gt;, &lt;p&gt;, &lt;a&gt;, &lt;ul&gt;, etc.)</span>
                  </div>
                  <textarea
                    rows={5}
                    placeholder="<p>Dear Member,</p><p>We are thrilled to announce our new reward system. Check out your dashboard for details!</p>"
                    value={popupMessage}
                    onChange={e => setPopupMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>

                {/* LIVE HTML PREVIEW CARD FOR ADMIN */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-gray-800/80 dark:to-gray-900/80 border border-blue-200 dark:border-blue-900/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Live HTML Popup Preview (Admin View)
                    </span>
                    <span className="text-[10px] font-mono bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      Realtime Render
                    </span>
                  </div>

                  {/* Simulated Popup Box */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md mx-auto overflow-hidden">
                    {popupImageUrl && (
                      <div className="relative h-36 bg-gray-100 dark:bg-gray-800">
                        <img src={popupImageUrl} alt="Banner Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="p-5 space-y-3">
                      {!popupImageUrl && (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                          Announcement
                        </span>
                      )}
                      {popupSubject ? (
                        <h4 className="font-black text-gray-900 dark:text-white text-base">
                          {popupSubject}
                        </h4>
                      ) : (
                        <h4 className="font-black text-gray-400 text-sm italic">
                          [Popup Title will appear here...]
                        </h4>
                      )}

                      <div 
                        className="rendered-html text-xs text-gray-700 dark:text-gray-300 leading-relaxed max-h-40 overflow-y-auto pr-1"
                        dangerouslySetInnerHTML={{ 
                          __html: popupMessage || '<p class="text-gray-400 italic">Your HTML description content will be rendered here...</p>' 
                        }}
                      />

                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                        {actionButtonText && (
                          <div className="w-full py-2 px-4 bg-blue-600 text-white font-bold text-center rounded-xl text-xs uppercase tracking-wider">
                            {actionButtonText}
                          </div>
                        )}
                        <div className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-center rounded-xl text-[10px] uppercase tracking-wider">
                          Got it / Dismiss
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display Triggers & Frequency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Display Trigger (When user visits/logs in)</label>
                    <select
                      value={displayTrigger}
                      onChange={e => setDisplayTrigger(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white"
                    >
                      <option value="login">Every Time User Logs In (Upon Login)</option>
                      <option value="homepage">On Homepage Whenever Any User Arrives</option>
                      <option value="every_page">Show on Every Page Navigation</option>
                      <option value="delay_30s">Show After 30 Seconds Delay</option>
                      <option value="delay_2m">Show After 2 Minutes Delay</option>
                      <option value="delay_10m">Show After 10 Minutes Delay</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Display Frequency</label>
                    <select
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white"
                    >
                      <option value="once_per_user">Once Per User (Until Dismissed)</option>
                      <option value="every_visit">Every Time / Always Show (Ignore Previous Dismissals)</option>
                    </select>
                  </div>
                </div>

                {/* Action Button (Optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Action Button Text (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Deposit Now or Claim Bonus"
                      value={actionButtonText}
                      onChange={e => setActionButtonText(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Action Button Link / Route (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. /member/deposit or https://t.me/channel"
                      value={actionButtonLink}
                      onChange={e => setActionButtonLink(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Additional Channels */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Also Send Via (Optional Channels)</label>
                  <div className="flex gap-4">
                    {[
                      { id: 'email', label: 'Email Notification' },
                      { id: 'whatsapp', label: 'WhatsApp / SMS' }
                    ].map(ch => {
                      const isChecked = selectedChannels.includes(ch.id);
                      return (
                        <label key={ch.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) setSelectedChannels(prev => [...prev, ch.id]);
                              else setSelectedChannels(prev => prev.filter(c => c !== ch.id));
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{ch.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBulkPopupSubTab('history')}
                    className="rounded-2xl px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSendingPopup}
                    className="rounded-2xl px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/25"
                  >
                    {isSendingPopup ? 'Broadcasting...' : '🚀 Broadcast Pop-up Now'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {bulkPopupSubTab === 'active' && (
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-xl max-w-4xl mx-auto space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">✨ Active Bulk Pop-up Broadcasts</h3>
                <span className="text-xs text-gray-500 font-medium">Currently deployed announcement popups</span>
              </div>
              {bulkPopupsList.filter(b => b.status === 'active').length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No active bulk pop-up broadcasts found.</div>
              ) : (
                <div className="space-y-4">
                  {bulkPopupsList.filter(b => b.status === 'active').map(item => (
                    <div key={item._id} className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Active</span>
                          <span className="text-xs text-gray-400 font-mono">Target: {item.targetType}</span>
                          <span className="text-xs text-gray-400 font-mono">Sent: {item.sentCount} users</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{item.subject || 'Untitled Announcement'}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{item.message?.replace(/<[^>]*>?/gm, '')}</p>
                        <p className="text-[10px] text-gray-400">Created: {new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleToggleStatusItem(item)}
                          variant="outline"
                          className="text-xs py-1.5 px-3"
                        >
                          Pause
                        </Button>
                        <Button
                          onClick={() => handleEditAndResend(item)}
                          variant="outline"
                          className="text-xs py-1.5 px-3 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          Edit & Send Again
                        </Button>
                        <Button
                          onClick={() => handleResendQuick(item)}
                          className="text-xs py-1.5 px-3 bg-blue-600 text-white"
                        >
                          Resend Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {bulkPopupSubTab === 'history' && (
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-xl max-w-5xl mx-auto space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">📜 Bulk Pop-up Broadcast History & Management</h3>
                <span className="text-xs text-gray-500 font-medium">Total historical broadcasts: {bulkPopupsList.length}</span>
              </div>
              {bulkPopupsList.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No historical bulk pop-up broadcasts recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400 uppercase font-bold text-[10px]">
                        <th className="py-3 px-4">Subject & Content</th>
                        <th className="py-3 px-4">Target</th>
                        <th className="py-3 px-4">Trigger & Freq</th>
                        <th className="py-3 px-4">Reach</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {bulkPopupsList.map(item => (
                        <tr key={item._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-bold text-gray-900 dark:text-white truncate">{item.subject || 'Untitled'}</p>
                            <p className="text-gray-500 truncate mt-0.5">{item.message?.replace(/<[^>]*>?/gm, '')}</p>
                          </td>
                          <td className="py-3 px-4 font-mono uppercase text-[11px] text-gray-600 dark:text-gray-400">
                            {item.targetType}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-700 dark:text-gray-300">{item.displayTrigger}</p>
                            <p className="text-[10px] text-gray-400">{item.frequency}</p>
                          </td>
                          <td className="py-3 px-4 font-black text-blue-600 dark:text-blue-400">
                            {item.sentCount} users
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                            }`}>
                              {item.status || 'active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-[11px]">
                            {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => handleToggleStatusItem(item)}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold text-[10px]"
                              title="Toggle Active / Paused"
                            >
                              {item.status === 'active' ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleEditAndResend(item)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 font-bold text-[10px]"
                              title="Edit parameters and broadcast again"
                            >
                              Edit & Resend
                            </button>
                            <button
                              onClick={() => handleResendQuick(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[10px]"
                              title="Resend instantly with same settings"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => handleDeleteBroadcastItem(item._id)}
                              className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-100 font-bold text-[10px]"
                              title="Delete from history"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Search and Advanced Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search bar */}
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="input-search-notifs"
              type="text"
              placeholder="Search notifications by content, subject, or @username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Quick Select Category Filters */}
          <div className="flex flex-wrap gap-2.5 items-center">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type:</span>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-900 p-1">
              {['All', 'Deposit', 'Withdrawal', 'Dispute', 'Task', 'PasswordReset'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                    categoryFilter === cat 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {cat === 'PasswordReset' ? 'Resets' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Filters row */}
        <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Situation Status:</label>
            <select
              id="select-situation"
              value={situationFilter}
              onChange={(e) => setSituationFilter(e.target.value)}
              className="text-xs py-1.5 pl-2 pr-8 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-blue-500"
            >
              <option value="All">All Situations</option>
              <option value="Pending">Pending / Open</option>
              <option value="Approved">Approved / Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Unhandled">Unhandled / Unresolved</option>
              <option value="Handled">Handled / Resolved / Read</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Read Status:</label>
            <select
              id="select-read"
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
              className="text-xs py-1.5 pl-2 pr-8 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-blue-500"
            >
              <option value="All">All Read States</option>
              <option value="Unread">Unread</option>
              <option value="Read">Read</option>
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Items per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="text-xs py-1.5 pl-2 pr-8 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-blue-500"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {paginatedNotifications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                  <th className="p-4 w-12 text-center">
                    <input
                      id="checkbox-select-all"
                      type="checkbox"
                      checked={paginatedNotifications.length > 0 && paginatedNotifications.every(item => selectedIds.includes(item.notification._id))}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-4 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">User</th>
                  <th className="p-4 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type / Entity</th>
                  <th className="p-4 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Message Content</th>
                  <th className="p-4 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Current Situation</th>
                  <th className="p-4 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Timestamp</th>
                  <th className="p-4 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedNotifications.map((item) => {
                  const notif = item.notification;
                  const isChecked = selectedIds.includes(notif._id);

                  // Setup nice colors for entity type badge
                  let typeColor: any = 'gray';
                  if (item.entityType === 'Deposit') typeColor = 'success';
                  else if (item.entityType === 'Withdrawal') typeColor = 'warning';
                  else if (item.entityType === 'Dispute') typeColor = 'danger';
                  else if (item.entityType === 'Task') typeColor = 'primary';
                  else if (item.entityType === 'Transfer') typeColor = 'indigo' as any;
                  else if (item.entityType === 'PasswordReset') typeColor = 'purple' as any;

                  // Setup situation status colors
                  let situationBadge = null;
                  if (item.situation === 'Pending' || item.situation === 'Open') {
                    situationBadge = <Badge variant="warning" className="font-extrabold uppercase text-[10px]">Pending Action</Badge>;
                  } else if (item.situation === 'Approved' || item.situation === 'Completed' || item.situation === 'Resolved') {
                    situationBadge = <Badge variant="success" className="font-extrabold uppercase text-[10px]">Resolved / OK</Badge>;
                  } else if (item.situation === 'Rejected') {
                    situationBadge = <Badge variant="danger" className="font-extrabold uppercase text-[10px]">Rejected</Badge>;
                  } else {
                    situationBadge = <Badge variant="gray" className="font-extrabold uppercase text-[10px]">System Msg</Badge>;
                  }

                  return (
                    <tr 
                      key={notif._id} 
                      className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors duration-150 ${
                        !notif.read ? 'bg-blue-50/20 dark:bg-blue-950/5 font-medium' : ''
                      }`}
                    >
                      {/* Checkbox select */}
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(notif._id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* User Label */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {item.userLabel}
                        </span>
                      </td>

                      {/* Request Type Badge */}
                      <td className="p-4 whitespace-nowrap">
                        <Badge variant={typeColor} className="font-bold text-[10px]">
                          {item.entityType}
                        </Badge>
                      </td>

                      {/* Notification message */}
                      <td className="p-4 max-w-sm lg:max-w-md">
                        <div className="flex flex-col">
                          {notif.subject && (
                            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-0.5">
                              {notif.subject}
                            </h4>
                          )}
                          <p className="text-sm text-gray-600 dark:text-gray-300 break-words leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      </td>

                      {/* Situation of Request */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {situationBadge}
                          {item.isHandled && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              Handled
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Creation Timestamp */}
                      <td className="p-4 text-center whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
                        {new Date(notif.date).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleSingleRead(notif)}
                            title={notif.read ? "Mark unread" : "Mark read"}
                            className="p-1.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                          >
                            {notif.read ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {item.targetPath && (
                            <button
                              onClick={() => handleNavigateToManage(item)}
                              className="px-2.5 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors flex items-center gap-1 border border-blue-100 dark:border-blue-900/40"
                            >
                              <span>Manage</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-gray-500 dark:text-gray-400">
            <svg className="w-14 h-14 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-base font-medium">No matching notifications found.</p>
            <p className="text-sm text-gray-400 mt-1">Try resetting your search query or criteria selection.</p>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="bg-gray-50/75 dark:bg-gray-900/20 px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Showing page <b>{currentPage}</b> of <b>{totalPages}</b> (Total {totalItems} items)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2.5 py-1.5 text-xs rounded border transition-all ${
                    currentPage === i + 1
                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
