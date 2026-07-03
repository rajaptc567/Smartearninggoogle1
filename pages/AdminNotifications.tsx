import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { Notification } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { deleteNotification, bulkDeleteNotifications, updateNotification } from '../services/api';

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
  );
};

export default AdminNotifications;
