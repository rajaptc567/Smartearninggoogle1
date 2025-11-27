

import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import UserSidebar from './UserSidebar';
import UserHeader from './UserHeader';
import { useData } from '../hooks/useData';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { markNotificationPopupAsShown } from '../services/api';
import ActivityTicker, { Activity } from './ui/ActivityTicker';
// FIX: Add specific types to allow for proper casting and type narrowing.
import { Deposit, formatCurrency, Transaction, Transfer, User, Withdrawal } from '../types';

const UserLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, dispatch } = useData();
  const { currentUser, notifications, users, deposits, withdrawals, transfers, transactions, investmentPlans } = state;
  const navigate = useNavigate();

  // Popup State
  const [popupNotification, setPopupNotification] = useState<any | null>(null);

  useEffect(() => {
    // This acts as a route guard. If no user is logged in, redirect to the login page.
    if (!state.currentUser) {
      navigate('/login', { replace: true });
    }
  }, [state.currentUser, navigate]);

  // Check for unread POPUP notifications
  useEffect(() => {
      if (currentUser && notifications.length > 0) {
          // Find the first notification that is marked as a popup and hasn't been shown yet
          const popup = notifications.find(n => 
              n.userId === currentUser._id && 
              n.isPopup === true && 
              n.popupShown === false
          );
          
          if (popup) {
              setPopupNotification(popup);
          } else {
              setPopupNotification(null);
          }
      }
  }, [currentUser, notifications]);
  
  const generatedActivities = useMemo((): Activity[] => {
    if (!users.length) return [];
  
    const activities: Activity[] = [];
    
    // Create sets for efficient lookup of excluded users
    const excludedUserIds = new Set(users.filter(u => u.restrictions?.excludeFromTicker).map(u => u._id));
    const excludedUsernames = new Set(users.filter(u => u.restrictions?.excludeFromTicker).map(u => u.username));

    const timeAgo = (date: Date): string => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // 1. Process Real Activities, filtering out excluded users
    const realActivitiesSource = [
      ...deposits.filter(d => d.status === 'Approved' && !excludedUserIds.has(d.userId)).slice(0, 5).map(d => ({ type: 'deposit', data: d, date: new Date(d.date) })),
      ...withdrawals.filter(w => w.status === 'Paid' && !excludedUserIds.has(w.userId)).slice(0, 5).map(w => ({ type: 'withdrawal', data: w, date: new Date(w.date) })),
      ...transfers.filter(t => t.status === 'Approved' && !excludedUserIds.has(t.senderId)).slice(0, 5).map(t => ({ type: 'transfer', data: t, date: new Date(t.date) })),
      ...transactions.filter(t => t.type === 'Plan Purchase' && !excludedUserIds.has(t.userId)).slice(0, 5).map(t => ({ type: 'plan', data: t, date: new Date(t.date) })),
      ...users.filter(u => !excludedUserIds.has(u._id)).slice(0, 5).map(u => ({ type: 'joined', data: u, date: new Date(u.registrationDate) }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 15);

    realActivitiesSource.forEach(item => {
      switch (item.type) {
        case 'deposit': {
          // FIX: Cast item.data to the correct type to resolve property access errors.
          const data = item.data as Deposit;
          activities.push({ id: `dep-${data._id}`, type: 'deposit', text: `<strong class="font-semibold">${data.userName}</strong> made a deposit of <strong>${formatCurrency(data.amount, data.currency)}</strong>`, time: timeAgo(item.date) });
          break;
        }
        case 'withdrawal': {
          // FIX: Cast item.data to the correct type to resolve property access errors.
          const data = item.data as Withdrawal;
          activities.push({ id: `wd-${data._id}`, type: 'withdrawal', text: `<strong class="font-semibold">${data.userName}</strong> withdrew <strong>${formatCurrency(data.amount, data.currency)}</strong>`, time: timeAgo(item.date) });
          break;
        }
        case 'transfer': {
          // FIX: Cast item.data to the correct type to resolve property access errors.
          const data = item.data as Transfer;
          activities.push({ id: `tr-${data._id}`, type: 'transfer', text: `<strong class="font-semibold">${data.senderName}</strong> sent funds to <strong>${data.recipientName}</strong>`, time: timeAgo(item.date) });
          break;
        }
        case 'plan': {
          // FIX: Cast item.data to the correct type to resolve property access errors.
          const data = item.data as Transaction;
          const planName = data.description.split(' ')[1] || 'a new';
          activities.push({ id: `pl-${data._id}`, type: 'plan', text: `<strong class="font-semibold">${data.userName}</strong> purchased the <strong>${planName}</strong> plan`, time: timeAgo(item.date) });
          break;
        }
        case 'joined': {
           // FIX: Cast item.data to the correct type to resolve property access errors.
           const data = item.data as User;
           activities.push({ id: `jn-${data._id}`, type: 'joined', text: `<strong class="font-semibold">${data.username}</strong> just joined SmartEarning`, time: timeAgo(item.date) });
           break;
        }
      }
    });

    // 2. Add Demo Activities, filtering out excluded usernames
    const demoUsers = ["abid789", "malik123", "mahnoor", "shahid", "ayesha_k", "usman_g", "fatima_ali", "bilal_khan", "zainab_s", "hassan_raza"];
    const demoPlans = investmentPlans.filter(p => p.status === 'Active').map(p => p.name);
    
    for (let i = 0; i < 15; i++) {
        const user1 = demoUsers[Math.floor(Math.random() * demoUsers.length)];
        
        // Skip if this demo user's name is on the exclusion list
        if (excludedUsernames.has(user1)) continue;

        const user2 = demoUsers[Math.floor(Math.random() * demoUsers.length)];
        const amount = [50, 100, 250, 500, 1000][Math.floor(Math.random() * 5)];
        const plan = demoPlans.length > 0 ? demoPlans[Math.floor(Math.random() * demoPlans.length)] : 'Gold';
        const hoursAgo = Math.floor(Math.random() * 10) + 1;

        const actionType = Math.floor(Math.random() * 4);
        let activity: Activity;
        switch(actionType) {
            case 0:
                activity = { id: `demo-wd-${i}`, type: 'withdrawal', text: `<strong class="font-semibold">${user1}</strong> just withdrew <strong>${formatCurrency(amount, 'USD')}</strong>`, time: `${hoursAgo}h ago` };
                break;
            case 1:
                activity = { id: `demo-tr-${i}`, type: 'transfer', text: `<strong class="font-semibold">${user1}</strong> sent funds to <strong>${user2}</strong>`, time: `${hoursAgo}h ago` };
                break;
            case 2:
                activity = { id: `demo-pl-${i}`, type: 'plan', text: `<strong class="font-semibold">${user1}</strong> upgraded to the <strong>${plan}</strong> plan`, time: `${hoursAgo}h ago` };
                break;
            case 3:
            default:
                activity = { id: `demo-jn-${i}`, type: 'joined', text: `<strong class="font-semibold">${user1}</strong> just joined the platform`, time: `${hoursAgo}h ago` };
                break;
        }
        activities.push(activity);
    }
    
    // Shuffle the final array
    return activities.sort(() => Math.random() - 0.5);

  }, [users, transactions, deposits, withdrawals, transfers, investmentPlans]);


  const handleClosePopup = async () => {
      if (popupNotification) {
          try {
              // Mark as shown in backend
              const updatedNotifications = await markNotificationPopupAsShown(popupNotification._id);
              dispatch({ type: 'SET_NOTIFICATIONS', payload: updatedNotifications });
              setPopupNotification(null);
          } catch (error) {
              console.error("Failed to mark popup as shown", error);
              setPopupNotification(null); // Close locally anyway to not block user
          }
      }
  };
  
  if (!state.currentUser) {
    return null; 
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <UserSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <UserHeader setSidebarOpen={setSidebarOpen} />
        <ActivityTicker activities={generatedActivities} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {popupNotification && (
          <Modal isOpen={true} onClose={handleClosePopup}>
              <div className="p-6 max-w-md text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
                      <svg className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {popupNotification.subject || 'Important Message'}
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap">
                      {popupNotification.message}
                  </div>
                  <Button onClick={handleClosePopup} className="w-full">
                      Acknowledge & Close
                  </Button>
              </div>
          </Modal>
      )}
    </div>
  );
};

export default UserLayout;