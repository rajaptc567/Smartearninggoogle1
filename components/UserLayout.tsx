


import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import UserSidebar from './UserSidebar';
import UserHeader from './UserHeader';
import { useData } from '../hooks/useData';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { markNotificationPopupAsShown } from '../services/api';
import ActivityTicker, { Activity } from './ui/ActivityTicker';
import { Deposit, formatCurrency, Transaction, Transfer, User, Withdrawal } from '../types';

const UserLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, dispatch } = useData();
  const { currentUser, notifications, users, deposits, withdrawals, transfers, transactions, investmentPlans, settings } = state;
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
    const excludedUserIds = new Set(users.filter(u => u.restrictions?.excludeFromTicker).map(u => u._id));

    const timeAgo = (date: Date): string => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // 1. Process Real Activities (less priority)
    const realActivitiesSource = [
      ...deposits.filter(d => d.status === 'Approved' && !excludedUserIds.has(d.userId)).slice(0, 3).map(d => ({ type: 'deposit', data: d, date: new Date(d.date) })),
      ...withdrawals.filter(w => w.status === 'Paid' && !excludedUserIds.has(w.userId)).slice(0, 3).map(w => ({ type: 'withdrawal', data: w, date: new Date(w.date) })),
      ...users.filter(u => !excludedUserIds.has(u._id)).slice(0, 3).map(u => ({ type: 'joined', data: u, date: new Date(u.registrationDate) }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

    realActivitiesSource.forEach(item => {
      let text = '';
      switch (item.type) {
        case 'deposit': const d = item.data as Deposit; text = `<strong class="font-semibold">${d.userName}</strong> from <strong>${users.find(u=>u._id===d.userId)?.country}</strong> made a deposit of <strong>${formatCurrency(d.amount, d.currency)}</strong>`; break;
        case 'withdrawal': const w = item.data as Withdrawal; text = `<strong class="font-semibold">${w.userName}</strong> from <strong>${users.find(u=>u._id===w.userId)?.country}</strong> withdrew <strong>${formatCurrency(w.amount, w.currency)}</strong>`; break;
        case 'joined': const u = item.data as User; text = `<strong class="font-semibold">${u.username}</strong> from <strong>${u.country}</strong> just joined SmartEarning`; break;
      }
      if(text) activities.push({ id: `${item.type}-${item.data._id}`, type: item.type as any, text, time: timeAgo(item.date) });
    });
    
    // 2. Add Demo Activities from Settings
    const demoProfiles = settings.demoProfiles || [];
    const demoTemplates = (settings.demoActivityTemplates || []).filter(t => t.enabled);

    if (demoProfiles.length > 0 && demoTemplates.length > 0) {
        demoTemplates.forEach(template => {
            const profile = demoProfiles[Math.floor(Math.random() * demoProfiles.length)];
            if (!profile) return;

            let text = template.template;
            
            text = text.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`);
            text = text.replace('{country}', `<strong>${profile.country}</strong>`);

            if (text.includes('{amount}')) {
                const randomAmount = Math.floor(Math.random() * 500) + 50; // More realistic amounts
                text = text.replace('{amount}', `<strong>${formatCurrency(randomAmount, profile.currency)}</strong>`);
            }
            if (text.includes('{currency}')) {
                text = text.replace('{currency}', `<strong>${profile.currency}</strong>`);
            }
            if (text.includes('{plan}')) {
                const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                if (plansForCurrency.length > 0) {
                    const randomPlan = plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)];
                    text = text.replace('{plan}', `<strong>${randomPlan.name}</strong>`);
                } else {
                    return; // Skip if no suitable plan exists
                }
            }
            
            if (text) {
                const hoursAgo = Math.floor(Math.random() * 10) + 1;
                // Make ID more unique
                activities.push({ id: `demo-${template._id}-${profile._id}-${Date.now()}`, type: template.type, text, time: `${hoursAgo}h ago` });
            }
        });
    }
    
    return activities.sort(() => Math.random() - 0.5);

  }, [users, transactions, deposits, withdrawals, investmentPlans, settings]);


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
        <ActivityTicker activities={generatedActivities} speed={settings.tickerSpeed || 6} />
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
