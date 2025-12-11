
import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import UserSidebar from './UserSidebar';
import UserHeader from './UserHeader';
import { useData } from '../hooks/useData';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { markNotificationPopupAsShown } from '../services/api';
import ActivityTicker, { Activity } from './ui/ActivityTicker';
import { Deposit, formatCurrency, Transaction, Transfer, User, Withdrawal, Notice } from '../types';

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
    // Combine exclusions: Users blocked via restrictions + specific events hidden by admin
    const excludedUserIds = new Set(users.filter(u => u.restrictions?.excludeFromTicker).map(u => u._id));
    const hiddenEventIds = new Set(settings.tickerHiddenEventIds || []);

    const contentSource = settings.tickerContentSource || 'hybrid';
    const realActivitySettings = settings.tickerRealActivities || { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true };
    const realTemplates = settings.tickerRealActivityTemplates || {
        deposits: ['<strong class="font-semibold">{name}</strong> deposited <strong>{amount}</strong>'],
        withdrawals: ['<strong class="font-semibold">{name}</strong> withdrew <strong>{amount}</strong>'],
        registrations: ['<strong class="font-semibold">{name}</strong> from {country} just joined!'],
        commissions: ['<strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong> commission ({source})'],
        transfers: ['<strong class="font-semibold">{name}</strong> transferred <strong>{amount}</strong> to {recipient}'],
        planPurchases: ['<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong> ({amount})']
    };
    const realActivityConfig = settings.tickerRealActivityConfig || { minAmount: 0, privacyMode: false, excludedCurrencies: [] };

    const timeAgo = (date: Date): string => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const processTemplate = (template: string, replacements: Record<string, string>) => {
        let res = template;
        Object.keys(replacements).forEach(key => {
            res = res.replace(new RegExp(`{${key}}`, 'g'), replacements[key]);
        });
        return res;
    };

    // Helper to get random template
    const getRandomTemplate = (type: keyof typeof realTemplates) => {
        const list = realTemplates[type];
        if (!list || !Array.isArray(list) || list.length === 0) return '';
        return list[Math.floor(Math.random() * list.length)];
    }

    // Helper to mask names
    const processName = (name: string) => {
        if (!realActivityConfig.privacyMode) return name;
        const parts = name.split(' ');
        if (parts.length > 1) {
            return `${parts[0]} ${parts[1].charAt(0)}.`;
        }
        return name.substring(0, Math.min(3, name.length)) + '...';
    };

    // Helper to check min amount and currency
    const isValidAmount = (amount: number, currency: string) => {
        if (amount < realActivityConfig.minAmount) return false;
        if (realActivityConfig.excludedCurrencies.includes(currency as any)) return false;
        return true;
    }

    // Helper to get user country
    const getUserCountry = (userId: string) => {
        const u = users.find(user => user._id === userId);
        return u ? u.country : '';
    };

    // 1. Process Real Activities
    if (contentSource === 'hybrid' || contentSource === 'real_only') {
        const realSources = [];
        
        if (realActivitySettings.deposits) {
            realSources.push(...deposits
                .filter(d => d.status === 'Approved' && !excludedUserIds.has(d.userId) && !hiddenEventIds.has(d._id) && isValidAmount(d.amount, d.currency))
                .slice(0, 3).map(d => ({ type: 'deposit', data: d, date: new Date(d.date) })));
        }
        if (realActivitySettings.withdrawals) {
            realSources.push(...withdrawals
                .filter(w => w.status === 'Paid' && !excludedUserIds.has(w.userId) && !hiddenEventIds.has(w._id) && isValidAmount(w.amount, w.currency))
                .slice(0, 3).map(w => ({ type: 'withdrawal', data: w, date: new Date(w.date) })));
        }
        if (realActivitySettings.registrations) {
            // Registrations usually don't have an amount to filter, unless we check subscription plan price? 
            // For now, allow all registrations unless excluded by user logic
            realSources.push(...users.filter(u => !excludedUserIds.has(u._id) && !hiddenEventIds.has(u._id)).slice(0, 3).map(u => ({ type: 'joined', data: u, date: new Date(u.registrationDate) })));
        }
        if (realActivitySettings.commissions) {
            realSources.push(...transactions
                .filter(t => t.type === 'Commission' && t.status === 'Approved' && !excludedUserIds.has(t.userId) && !hiddenEventIds.has(t._id) && isValidAmount(t.amount, t.currency))
                .slice(0, 3).map(t => ({ type: 'commission', data: t, date: new Date(t.date) })));
        }
        if (realActivitySettings.transfers) {
            realSources.push(...transfers
                .filter(t => t.status === 'Approved' && !excludedUserIds.has(t.senderId) && !hiddenEventIds.has(t._id) && isValidAmount(t.amount, t.currency))
                .slice(0, 3).map(t => ({ type: 'transfer', data: t, date: new Date(t.date) })));
        }
        if (realActivitySettings.planPurchases) {
            realSources.push(...transactions
                .filter(t => t.type === 'Plan Purchase' && t.status === 'Approved' && !excludedUserIds.has(t.userId) && !hiddenEventIds.has(t._id) && isValidAmount(Math.abs(t.amount), t.currency))
                .slice(0, 3).map(t => ({ type: 'plan', data: t, date: new Date(t.date) })));
        }

        const realActivitiesSource = realSources.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

        realActivitiesSource.forEach(item => {
          let text = '';
          const templateStr = getRandomTemplate(item.type === 'joined' ? 'registrations' : item.type === 'plan' ? 'planPurchases' : item.type === 'commission' ? 'commissions' : item.type + 's' as any);
          
          if (!templateStr) return;

          switch (item.type) {
            case 'deposit': 
                const d = item.data as Deposit; 
                text = processTemplate(templateStr, { name: processName(d.userName), amount: formatCurrency(d.amount, d.currency), currency: d.currency, country: getUserCountry(d.userId) });
                break;
            case 'withdrawal': 
                const w = item.data as Withdrawal; 
                text = processTemplate(templateStr, { name: processName(w.userName), amount: formatCurrency(w.amount, w.currency), currency: w.currency, country: getUserCountry(w.userId) });
                break;
            case 'joined': 
                const u = item.data as User; 
                text = processTemplate(templateStr, { name: processName(u.username), country: u.country, currency: u.currency });
                break;
            case 'commission': 
                const c = item.data as Transaction; 
                const level = c.level || 1;
                const source = level === 1 ? 'from direct referral' : `from level ${level} referral`;
                text = processTemplate(templateStr, { name: processName(c.userName), amount: formatCurrency(c.amount, c.currency), currency: c.currency, country: getUserCountry(c.userId), source });
                break;
            case 'transfer': 
                const t = item.data as Transfer; 
                text = processTemplate(templateStr, { name: processName(t.senderName), amount: formatCurrency(t.amount, t.currency), currency: t.currency, country: getUserCountry(t.senderId), recipient: processName(t.recipientName) });
                break;
            case 'plan': 
                const p = item.data as Transaction; 
                const planName = p.description.replace('Purchased ', '').replace(' plan', ''); 
                const planPrice = formatCurrency(Math.abs(p.amount), p.currency);
                text = processTemplate(templateStr, { name: processName(p.userName), plan: planName, amount: planPrice, currency: p.currency, country: getUserCountry(p.userId) });
                break;
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
                text = text.replace('{name}', `<strong class="font-semibold">${processName(profile.name)}</strong>`);
                text = text.replace('{country}', `<strong>${profile.country}</strong>`);
                text = text.replace('{currency}', `<strong>${profile.currency}</strong>`);

                // --- SMART PRICING LOGIC ---
                
                // Get valid plans for this fake user's currency
                const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                const randomPlan = plansForCurrency.length > 0 ? plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)] : null;

                // Case A: Deposit, Withdrawal, Plan Purchase -> MUST match a real plan price
                if (['deposit', 'withdrawal', 'plan'].includes(template.type)) {
                    if (randomPlan) {
                        // Use exact plan price
                        text = text.replace('{amount}', `<strong>${formatCurrency(randomPlan.price, profile.currency)}</strong>`);
                        text = text.replace('{plan}', `<strong>${randomPlan.name}</strong>`);
                    } else {
                        // Fallback if no plan exists for this currency (prevent broken text)
                        text = text.replace('{amount}', `<strong>${formatCurrency(100, profile.currency)}</strong>`);
                        text = text.replace('{plan}', `<strong>Basic</strong>`);
                    }
                }

                // Case B: Commission -> MUST match a real plan's commission calculation
                else if (template.type === 'commission') {
                    if (randomPlan) {
                        // Randomly simulate Direct (Level 1) or Indirect (Level 2)
                        const isDirect = Math.random() > 0.4; // 60% chance direct
                        
                        let commVal = 0;
                        if (isDirect && randomPlan.directCommissions?.length > 0) {
                            const config = randomPlan.directCommissions[0];
                            commVal = config.type === 'percentage' ? (randomPlan.price * config.value) / 100 : config.value;
                        } else if (!isDirect && randomPlan.indirectCommissions?.length > 0) {
                            const config = randomPlan.indirectCommissions[0];
                            commVal = config.type === 'percentage' ? (randomPlan.price * config.value) / 100 : config.value;
                        } else {
                            // Fallback logic if plan doesn't have configs
                            commVal = randomPlan.price * 0.05; 
                        }
                        
                        text = text.replace('{amount}', `<strong>${formatCurrency(commVal, profile.currency)}</strong>`);
                    } else {
                        text = text.replace('{amount}', `<strong>${formatCurrency(5, profile.currency)}</strong>`);
                    }
                }

                // Case C: Transfers -> Random value within range settings
                else if (template.type === 'transfer') {
                    const ranges = settings.tickerDemoAmountRanges || { USD: {min: 50, max: 500}, EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                    const currencyRange = ranges[profile.currency] || { min: 10, max: 100 };
                    
                    // Round to nearest 10 for cleaner transfer amounts
                    let randomAmount = Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min;
                    randomAmount = Math.round(randomAmount / 10) * 10; 

                    text = text.replace('{amount}', `<strong>${formatCurrency(randomAmount, profile.currency)}</strong>`);
                }
                
                // Cleanup: If any {amount} or {plan} tags remain (e.g. template type mismatch), clean them up generic
                if (text.includes('{amount}')) text = text.replace('{amount}', `<strong>${formatCurrency(50, profile.currency)}</strong>`);
                if (text.includes('{plan}')) text = text.replace('{plan}', `<strong>Standard</strong>`);

                // ---------------------------

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
  
  // Filter Notices for the current user
  const visibleNotices = useMemo(() => {
      if (!settings.notices || !currentUser) return [];
      
      const now = new Date().getTime();

      return settings.notices.filter(notice => {
          if (!notice.enabled) return false;
          
          // Time Limitation Check
          if (notice.startTime) {
              if (now < new Date(notice.startTime).getTime()) return false;
          }
          if (notice.endTime) {
              if (now > new Date(notice.endTime).getTime()) return false;
          }

          // Targeting Logic
          if (notice.targetType === 'all') return true;
          
          if (notice.targetType === 'inactive') {
              return (!currentUser.activePlans || currentUser.activePlans.length === 0);
          }
          
          if (notice.targetType === 'plan') {
              if (!notice.targetIds || notice.targetIds.length === 0) return false;
              // Check if user has ANY of the targeted plans active
              return currentUser.activePlans?.some(p => notice.targetIds?.includes(p.planId));
          }
          
          if (notice.targetType === 'manual') {
              if (!notice.targetIds || notice.targetIds.length === 0) return false;
              return notice.targetIds.includes(currentUser._id);
          }
          
          return false;
      });
  }, [settings.notices, currentUser]);

  
  if (!state.currentUser) {
    return null; 
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <UserSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <UserHeader setSidebarOpen={setSidebarOpen} />
        
        {/* System Notices Bar */}
        {visibleNotices.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                {visibleNotices.map(notice => (
                    <NoticeItem key={notice._id} notice={notice} />
                ))}
            </div>
        )}

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

// Sub-component for individual notices to handle animations cleanly
const NoticeItem: React.FC<{ notice: Notice }> = ({ notice }) => {
    const colorClasses = {
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
        danger: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
    };

    const containerClass = `w-full py-2 px-4 text-sm font-medium flex items-center justify-center overflow-hidden ${colorClasses[notice.color || 'info']}`;

    if (notice.style === 'sliding') {
        return (
            <div className={containerClass}>
                <div className="animate-marquee whitespace-nowrap w-full">
                    <span className="inline-block px-4">{notice.message}</span>
                    <span className="inline-block px-4">{notice.message}</span>
                    <span className="inline-block px-4">{notice.message}</span>
                </div>
            </div>
        );
    }

    if (notice.style === 'blinking') {
        return (
            <div className={`${containerClass} animate-pulse`}>
                {notice.message}
            </div>
        );
    }

    // Static
    return (
        <div className={containerClass}>
            {notice.message}
        </div>
    );
};

export default UserLayout;
