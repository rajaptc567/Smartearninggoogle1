
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
    const contentSource = settings.tickerContentSource || 'hybrid';
    const realActivitySettings = settings.tickerRealActivities || { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true };

    const timeAgo = (date: Date): string => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // 1. Process Real Activities
    if (contentSource === 'hybrid' || contentSource === 'real_only') {
        const realSources = [];
        if (realActivitySettings.deposits) {
            realSources.push(...deposits.filter(d => d.status === 'Approved' && !excludedUserIds.has(d.userId)).slice(0, 3).map(d => ({ type: 'deposit', data: d, date: new Date(d.date) })));
        }
        if (realActivitySettings.withdrawals) {
            realSources.push(...withdrawals.filter(w => w.status === 'Paid' && !excludedUserIds.has(w.userId)).slice(0, 3).map(w => ({ type: 'withdrawal', data: w, date: new Date(w.date) })));
        }
        if (realActivitySettings.registrations) {
            realSources.push(...users.filter(u => !excludedUserIds.has(u._id)).slice(0, 3).map(u => ({ type: 'joined', data: u, date: new Date(u.registrationDate) })));
        }
        if (realActivitySettings.commissions) {
            realSources.push(...transactions.filter(t => t.type === 'Commission' && t.status === 'Approved' && !excludedUserIds.has(t.userId)).slice(0, 3).map(t => ({ type: 'commission', data: t, date: new Date(t.date) })));
        }
        if (realActivitySettings.transfers) {
            realSources.push(...transfers.filter(t => t.status === 'Approved' && !excludedUserIds.has(t.senderId)).slice(0, 3).map(t => ({ type: 'transfer', data: t, date: new Date(t.date) })));
        }
        if (realActivitySettings.planPurchases) {
            realSources.push(...transactions.filter(t => t.type === 'Plan Purchase' && t.status === 'Approved' && !excludedUserIds.has(t.userId)).slice(0, 3).map(t => ({ type: 'plan', data: t, date: new Date(t.date) })));
        }

        const realActivitiesSource = realSources.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

        realActivitiesSource.forEach(item => {
          let text = '';
          switch (item.type) {
            case 'deposit': const d = item.data as Deposit; text = `<strong class="font-semibold">${d.userName}</strong> from <strong>${users.find(u=>u._id===d.userId)?.country}</strong> made a deposit of <strong>${formatCurrency(d.amount, d.currency)}</strong>`; break;
            case 'withdrawal': const w = item.data as Withdrawal; text = `<strong class="font-semibold">${w.userName}</strong> from <strong>${users.find(u=>u._id===w.userId)?.country}</strong> withdrew <strong>${formatCurrency(w.amount, w.currency)}</strong>`; break;
            case 'joined': const u = item.data as User; text = `<strong class="font-semibold">${u.username}</strong> from <strong>${u.country}</strong> just joined SmartEarning`; break;
            case 'commission': const c = item.data as Transaction; text = `<strong class="font-semibold">${c.userName}</strong> earned a commission of <strong>${formatCurrency(c.amount, c.currency)}</strong>`; break;
            case 'transfer': const t = item.data as Transfer; text = `<strong class="font-semibold">${t.senderName}</strong> sent funds to another member`; break;
            case 'plan': const p = item.data as Transaction; const planName = p.description.replace('Purchased ', '').replace(' plan', ''); text = `<strong class="font-semibold">${p.userName}</strong> purchased the <strong>${planName}</strong> plan`; break;
          }
          if(text) activities.push({ id: `${item.type}-${item.data._id}`, type: item.type as Activity['type'], text, time: timeAgo(item.date) });
        });
    }
    
    // 2. Add Demo Activities from Settings
    if (contentSource === 'hybrid' || contentSource === 'demo_only') {
        const demoProfiles = settings.demoProfiles || [];
        const demoTemplates = (settings.demoActivityTemplates || []).filter(t => t.enabled);

        if (demoProfiles.length > 0 && demoTemplates.length > 0) {
            demoTemplates.forEach(template => {
                const profile = demoProfiles[Math.floor(Math.random() * demoProfiles.length)];
                if (!profile) return;

                let text = template.template;
                text = text.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`);
                text = text.replace('{country}', `<strong>${profile.country}</strong>`);
                text = text.replace('{currency}', `<strong>${profile.currency}</strong>`);

                // Find active plans matching profile currency for intelligent pricing
                const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                const randomPlan = plansForCurrency.length > 0 ? plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)] : null;

                // Logic 1: Exact Price for Deposit, Withdrawal, Plan Buy
                const useExactPlanPrice = ['deposit', 'withdrawal', 'plan'].includes(template.type);
                if (useExactPlanPrice && randomPlan) {
                    if (text.includes('{amount}')) text = text.replace('{amount}', `<strong>${formatCurrency(randomPlan.price, profile.currency)}</strong>`);
                    if (text.includes('{plan}')) text = text.replace('{plan}', `<strong>${randomPlan.name}</strong>`);
                }

                // Logic 2: Commission Calculation
                if (template.type === 'commission' && randomPlan) {
                    // Randomize between direct (Level 1) and indirect (Level 2) to show variety
                    // Weighted 70% towards Direct Commission as they are more common/higher
                    const isDirect = Math.random() > 0.3; 
                    const commConfig = isDirect 
                        ? (randomPlan.directCommissions?.[0]) 
                        : (randomPlan.indirectCommissions?.[0]);
                    
                    let commVal = 0;
                    if (commConfig) {
                        commVal = commConfig.type === 'percentage' 
                            ? (randomPlan.price * commConfig.value) / 100 
                            : commConfig.value;
                    } else {
                        // Fallback if config is missing: assume 5%
                        commVal = randomPlan.price * 0.05; 
                    }

                    if (text.includes('{amount}')) {
                        text = text.replace('{amount}', `<strong>${formatCurrency(commVal, profile.currency)}</strong>`);
                    }
                }

                // Fallback for {plan} if it wasn't replaced above (e.g. if no random plan found)
                if (text.includes('{plan}')) {
                     text = text.replace('{plan}', `<strong>${randomPlan ? randomPlan.name : 'Premium Plan'}</strong>`);
                }

                // Fallback for {amount} (Transfers, or if no plan found) -> Use Range Settings
                if (text.includes('{amount}')) {
                    const ranges = settings.tickerDemoAmountRanges || { USD: {min: 50, max: 500}, EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                    const currencyRange = ranges[profile.currency];
                    const randomAmount = currencyRange ? Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min : 100;
                    text = text.replace('{amount}', `<strong>${formatCurrency(randomAmount, profile.currency)}</strong>`);
                }
                
                if (text) {
                    const hoursAgo = Math.floor(Math.random() * 10) + 1;
                    // Make ID unique to prevent key warnings
                    activities.push({ id: `demo-${template._id}-${profile._id}-${Date.now()}-${Math.random()}`, type: template.type, text, time: `${hoursAgo}h ago` });
                }
            });
        }
    }
    
    return activities.sort(() => Math.random() - 0.5);

  }, [users, transactions, deposits, withdrawals, transfers, investmentPlans, settings]);


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
        {settings.tickerEnabled !== false && (
            <ActivityTicker 
                activities={generatedActivities} 
                speed={settings.tickerSpeed || 6} 
                pauseOnHover={settings.tickerPauseOnHover}
                style={settings.tickerStyle}
            />
        )}
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
