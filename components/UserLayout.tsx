
import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import UserSidebar from './UserSidebar';
import UserHeader from './UserHeader';
import { useData } from '../hooks/useData';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { markNotificationPopupAsShown, verifyEmail, verifyWhatsapp, resendEmailVerification, resendWhatsappVerification } from '../services/api';
import ActivityTicker, { Activity } from './ui/ActivityTicker';
import { Deposit, formatCurrency, Transaction, Transfer, User, Withdrawal, Notice } from '../types';
import { SEOHead } from './SEOHead';

const UserLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, dispatch } = useData();
  const { currentUser, notifications, users, deposits, withdrawals, transfers, transactions, investmentPlans, settings } = state;
  const navigate = useNavigate();
  const location = useLocation();

  // Verification configurations & states
  const needsEmailVerification = settings?.emailVerificationRequired && !currentUser?.emailVerified;
  const needsWhatsappVerification = settings?.whatsappVerificationRequired && !currentUser?.whatsappVerified;
  const needsAnyVerification = currentUser && (needsEmailVerification || needsWhatsappVerification);

  const [emailCode, setEmailCode] = useState('');
  const [whatsappCode, setWhatsappCode] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingWhatsapp, setVerifyingWhatsapp] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [whatsappSuccess, setWhatsappSuccess] = useState('');
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [whatsappResendTimer, setWhatsappResendTimer] = useState(0);

  // Handle Resend Timers
  useEffect(() => {
    let interval: any;
    if (emailResendTimer > 0) {
      interval = setInterval(() => {
        setEmailResendTimer(p => p - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailResendTimer]);

  useEffect(() => {
    let interval: any;
    if (whatsappResendTimer > 0) {
      interval = setInterval(() => {
        setWhatsappResendTimer(p => p - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [whatsappResendTimer]);

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailCode || emailCode.length < 5) {
      setEmailError('Please enter a valid verification code.');
      return;
    }
    setVerifyingEmail(true);
    setEmailError('');
    setEmailSuccess('');
    try {
      const res = await verifyEmail(emailCode);
      if (res.success) {
        setEmailSuccess('Email verified successfully!');
        dispatch({ type: 'UPDATE_USER', payload: res.data });
      } else {
        setEmailError(res.message || 'Verification failed. Please try again.');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleVerifyWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappCode || whatsappCode.length < 5) {
      setWhatsappError('Please enter a valid verification code.');
      return;
    }
    setVerifyingWhatsapp(true);
    setWhatsappError('');
    setWhatsappSuccess('');
    try {
      const res = await verifyWhatsapp(whatsappCode);
      if (res.success) {
        setWhatsappSuccess('WhatsApp verified successfully!');
        dispatch({ type: 'UPDATE_USER', payload: res.data });
      } else {
        setWhatsappError(res.message || 'Verification failed. Please try again.');
      }
    } catch (err: any) {
      setWhatsappError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifyingWhatsapp(false);
    }
  };

  const handleResendEmail = async () => {
    if (emailResendTimer > 0) return;
    try {
      const res = await resendEmailVerification();
      if (res.success) {
        setEmailSuccess('A new verification code has been sent to your email.');
        setEmailResendTimer(60);
      } else {
        setEmailError(res.message || 'Failed to resend code.');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Failed to resend code.');
    }
  };

  const handleResendWhatsapp = async () => {
    if (whatsappResendTimer > 0) return;
    try {
      const res = await resendWhatsappVerification();
      if (res.success) {
        setWhatsappSuccess('A new verification code has been sent to your WhatsApp.');
        setWhatsappResendTimer(60);
      } else {
        setWhatsappError(res.message || 'Failed to resend code.');
      }
    } catch (err: any) {
      setWhatsappError(err.message || 'Failed to resend code.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    dispatch({ type: 'SET_CURRENT_USER', payload: { user: null } });
    navigate('/login');
  };

  const hasHubAccess = useMemo(() => {
    if (!currentUser) return false;
    if (settings && settings.hubEnabled === false) return false;
    if (!settings || !settings.hubAccessMode || settings.hubAccessMode === 'all') return true;
    if (settings.hubAccessMode === 'manual') {
        return (settings.hubAllowedUserIds || []).includes(currentUser._id);
    }
    if (settings.hubAccessMode === 'plan') {
        const allowedPlanIds = settings.hubAllowedPlanIds || [];
        return (currentUser.activePlans || []).some(ap => allowedPlanIds.includes(ap.planId));
    }
    return true;
  }, [currentUser, settings]);

  const [dashboardMode, setDashboardMode] = useState<'work_and_earn' | 'investment'>(() => {
      const saved = localStorage.getItem('dashboard_mode');
      const mode = (saved as 'work_and_earn' | 'investment') || 'work_and_earn';
      // Fallback only if explicitly disabled
      if (mode === 'work_and_earn' && settings && settings.hubEnabled === false) {
          return 'investment';
      }
      return mode;
  });

  // Enforce access changes in real-time safely
  useEffect(() => {
    if (settings && settings.hubEnabled === false && dashboardMode === 'work_and_earn') {
      setDashboardMode('investment');
      localStorage.setItem('dashboard_mode', 'investment');
    } else if (settings && settings.hubEnabled !== false && !hasHubAccess && dashboardMode === 'work_and_earn') {
      setDashboardMode('investment');
      localStorage.setItem('dashboard_mode', 'investment');
    }
  }, [hasHubAccess, dashboardMode, settings]);

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

    const getRandomTemplate = (type: keyof typeof realTemplates) => {
        const list = realTemplates[type];
        if (!list || !Array.isArray(list) || list.length === 0) return '';
        return list[Math.floor(Math.random() * list.length)];
    }

    const processName = (name: string) => {
        if (!realActivityConfig.privacyMode) return name;
        const parts = name.split(' ');
        if (parts.length > 1) {
            return `${parts[0]} ${parts[1].charAt(0)}.`;
        }
        return name.substring(0, Math.min(3, name.length)) + '...';
    };

    const isValidAmount = (amount: number, currency: string) => {
        if (amount < realActivityConfig.minAmount) return false;
        if (realActivityConfig.excludedCurrencies.includes(currency as any)) return false;
        return true;
    }

    const getUserCountry = (userId: string) => {
        const u = users.find(user => user._id === userId);
        return u ? u.country : '';
    };

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

                const plansForCurrency = investmentPlans.filter(p => p.status === 'Active' && p.currency === profile.currency);
                const randomPlan = plansForCurrency.length > 0 ? plansForCurrency[Math.floor(Math.random() * plansForCurrency.length)] : null;

                if (['deposit', 'withdrawal', 'plan'].includes(template.type)) {
                    if (randomPlan) {
                        text = text.replace('{amount}', `<strong>${formatCurrency(randomPlan.price, profile.currency)}</strong>`);
                        text = text.replace('{plan}', `<strong>${randomPlan.name}</strong>`);
                    } else {
                        text = text.replace('{amount}', `<strong>${formatCurrency(100, profile.currency)}</strong>`);
                        text = text.replace('{plan}', `<strong>Basic</strong>`);
                    }
                }

                else if (template.type === 'commission') {
                    if (randomPlan) {
                        const isDirect = Math.random() > 0.4;
                        let commVal = 0;
                        if (isDirect && randomPlan.directCommissions?.length > 0) {
                            const config = randomPlan.directCommissions[0];
                            commVal = config.type === 'percentage' ? (randomPlan.price * config.value) / 100 : config.value;
                        } else if (!isDirect && randomPlan.indirectCommissions?.length > 0) {
                            const config = randomPlan.indirectCommissions[0];
                            commVal = config.type === 'percentage' ? (randomPlan.price * config.value) / 100 : config.value;
                        } else {
                            commVal = randomPlan.price * 0.05; 
                        }
                        text = text.replace('{amount}', `<strong>${formatCurrency(commVal, profile.currency)}</strong>`);
                    } else {
                        text = text.replace('{amount}', `<strong>${formatCurrency(5, profile.currency)}</strong>`);
                    }
                }

                else if (template.type === 'transfer') {
                    const ranges = settings.tickerDemoAmountRanges || { USD: {min: 50, max: 500}, EUR: {min: 50, max: 500}, PKR: {min: 5000, max: 50000} };
                    const currencyRange = ranges[profile.currency] || { min: 10, max: 100 };
                    let randomAmount = Math.floor(Math.random() * (currencyRange.max - currencyRange.min + 1)) + currencyRange.min;
                    randomAmount = Math.round(randomAmount / 10) * 10; 
                    text = text.replace('{amount}', `<strong>${formatCurrency(randomAmount, profile.currency)}</strong>`);
                }
                
                if (text.includes('{amount}')) text = text.replace('{amount}', `<strong>${formatCurrency(50, profile.currency)}</strong>`);
                if (text.includes('{plan}')) text = text.replace('{plan}', `<strong>Standard</strong>`);

                if (text) {
                    const hoursAgo = Math.floor(Math.random() * 10) + 1;
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
              const updatedNotifications = await markNotificationPopupAsShown(popupNotification._id);
              dispatch({ type: 'SET_NOTIFICATIONS', payload: updatedNotifications });
              setPopupNotification(null);
          } catch (error) {
              console.error("Failed to mark popup as shown", error);
              setPopupNotification(null);
          }
      }
  };
  
  const visibleNotices = useMemo(() => {
      if (!settings.notices || !currentUser) return [];
      const now = new Date().getTime();

      return settings.notices.filter(notice => {
          if (!notice.enabled) return false;
          if (notice.startTime && now < new Date(notice.startTime).getTime()) return false;
          if (notice.endTime && now > new Date(notice.endTime).getTime()) return false;
          if (notice.targetType === 'all') return true;
          if (notice.targetType === 'inactive') return (!currentUser.activePlans || currentUser.activePlans.length === 0);
          if (notice.targetType === 'plan') return currentUser.activePlans?.some(p => notice.targetIds?.includes(p.planId));
          if (notice.targetType === 'manual') return notice.targetIds?.includes(currentUser._id);
          return false;
      });
  }, [settings.notices, currentUser]);

  const hasNoPlan = useMemo(() => {
    return !currentUser?.activePlans || currentUser.activePlans.length === 0;
  }, [currentUser]);

  if (!state.currentUser) {
    return null; 
  }

  if (needsAnyVerification) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden animate-fade-in p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Account Security Gate</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please verify your identity to activate and access your account.</p>
          </div>

          <div className="space-y-6">
            {/* Email Verification Form */}
            {needsEmailVerification && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border dark:border-gray-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email Verification
                  </h3>
                  <span className="text-[10px] uppercase font-black tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Pending</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">We auto-sent a 6-digit code to <strong className="text-gray-700 dark:text-gray-300">{currentUser?.email}</strong>.</p>
                
                <form onSubmit={handleVerifyEmail} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-center tracking-widest text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Button type="submit" size="sm" loading={verifyingEmail} className="shrink-0">
                      Verify
                    </Button>
                  </div>
                  {emailError && <p className="text-xs font-semibold text-red-500">{emailError}</p>}
                  {emailSuccess && <p className="text-xs font-semibold text-emerald-500">{emailSuccess}</p>}
                  
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={handleResendEmail}
                      disabled={emailResendTimer > 0}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer"
                    >
                      {emailResendTimer > 0 ? `Resend code in ${emailResendTimer}s` : 'Resend Email Code'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* WhatsApp Verification Form */}
            {needsWhatsappVerification && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border dark:border-gray-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    WhatsApp Verification
                  </h3>
                  <span className="text-[10px] uppercase font-black tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Pending</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">We auto-sent a 6-digit code to your registered WhatsApp number: <strong className="text-gray-700 dark:text-gray-300">{currentUser?.whatsapp || currentUser?.phone}</strong>.</p>
                
                <form onSubmit={handleVerifyWhatsapp} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      value={whatsappCode}
                      onChange={(e) => setWhatsappCode(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-center tracking-widest text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Button type="submit" size="sm" loading={verifyingWhatsapp} className="shrink-0">
                      Verify
                    </Button>
                  </div>
                  {whatsappError && <p className="text-xs font-semibold text-red-500">{whatsappError}</p>}
                  {whatsappSuccess && <p className="text-xs font-semibold text-emerald-500">{whatsappSuccess}</p>}
                  
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={handleResendWhatsapp}
                      disabled={whatsappResendTimer > 0}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer"
                    >
                      {whatsappResendTimer > 0 ? `Resend code in ${whatsappResendTimer}s` : 'Resend WhatsApp Code'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="pt-4 border-t dark:border-gray-800 flex items-center justify-between">
            <button
              onClick={handleLogout}
              className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout Account
            </button>
            <span className="text-[10px] text-gray-400 font-medium">Work & Earn Hub Security</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <SEOHead title="Member Dashboard | SmartExn" robots="noindex, nofollow" />
      <UserSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} dashboardMode={dashboardMode} setDashboardMode={setDashboardMode} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <UserHeader setSidebarOpen={setSidebarOpen} dashboardMode={dashboardMode} setDashboardMode={setDashboardMode} />
        
        {/* PERSISTENT NO-PLAN WARNING BANNER (Only in Investment Mode) */}
        {hasNoPlan && dashboardMode !== 'work_and_earn' && !location.pathname.includes('/work-and-earn') && !location.pathname.includes('/tasks') && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 px-4 shadow-lg flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in relative z-40">
            <span className="flex items-center gap-2 font-bold text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Account Not Activated: Buy a plan to start earning commissions.
            </span>
            <button 
              onClick={() => navigate('/member/plans')}
              className="bg-white text-orange-600 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest hover:bg-orange-50 transition-colors shadow-sm"
            >
              Browse Plans &rarr;
            </button>
          </div>
        )}

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
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 flex flex-col justify-between">
          <div className="flex-1 pb-10">
            <Outlet context={{ dashboardMode, setDashboardMode }} />
          </div>

          {/* Professional Footer */}
          <footer className="mt-auto border-t border-gray-200/60 dark:border-gray-800/80 pt-8 pb-6 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
              {/* Branding and status */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black">
                    W
                  </span>
                  <span className="text-sm font-black tracking-tight text-gray-900 dark:text-white uppercase">
                    Work & Earn Hub
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                  The ultimate digital nano-gigs ecosystem. Perform tasks, promote campaigns, and cash out securely.
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase tracking-wider bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-1 rounded-full w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  All Hub Systems Operational
                </div>
              </div>

              {/* Legal section */}
              <div>
                <h5 className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-3">
                  ⚖️ Legal Documents
                </h5>
                <ul className="space-y-2 text-xs font-bold">
                  <li>
                    <Link to="/member/hub-legal?tab=privacy" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-legal?tab=terms" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-legal?tab=cookie" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Cookie Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-legal?tab=dmca" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      DMCA & Copyright
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Compliance & Limits */}
              <div>
                <h5 className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-3">
                  🛡️ Risk & Compliance
                </h5>
                <ul className="space-y-2 text-xs font-bold">
                  <li>
                    <Link to="/member/hub-legal?tab=antifraud" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Anti-Fraud Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-legal?tab=withdrawal" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Withdrawal Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-legal?tab=refund" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Refund Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-legal?tab=disclaimer" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Disclaimer Clause
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Information */}
              <div>
                <h5 className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-3">
                  💡 Information & Help
                </h5>
                <ul className="space-y-2 text-xs font-bold">
                  <li>
                    <Link to="/member/hub-legal?tab=about" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-legal?tab=contact" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Contact Us
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/hub-faqs" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Hub Knowledge FAQs
                    </Link>
                  </li>
                  <li>
                    <Link to="/member/disputes" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      Disputes & Support
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-200/60 dark:border-gray-800/80 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-semibold text-gray-400">
              <div>
                © 2026 Work & Earn Gigs Hub. All Rights Reserved. Legally regulated and secure environment.
              </div>
              <div className="flex gap-4">
                <span className="hover:text-gray-600 dark:hover:text-gray-200 transition cursor-help">Secure SSL 256-bit</span>
                <span>•</span>
                <span className="hover:text-gray-600 dark:hover:text-gray-200 transition cursor-help">PCI DSS Compliant</span>
              </div>
            </div>
          </footer>
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

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-1 py-1.5 flex items-center justify-around text-slate-300 shadow-2xl">
        {dashboardMode === 'investment' ? (
          <>
            <Link 
              to="/member" 
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                location.pathname === '/member' || location.pathname === '/member/' 
                  ? 'text-sky-400 font-bold bg-sky-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base sm:text-lg">🏠</span>
              <span className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap">Home</span>
            </Link>

            <Link 
              to="/member/deposit" 
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/deposit') 
                  ? 'text-sky-400 font-bold bg-sky-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base sm:text-lg">💳</span>
              <span className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap">Deposit</span>
            </Link>

            <Link 
              to="/member/withdraw" 
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/withdraw') 
                  ? 'text-sky-400 font-bold bg-sky-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base sm:text-lg">💸</span>
              <span className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap">Withdraw</span>
            </Link>

            <Link 
              to="/member/plans" 
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/plans') || location.pathname.includes('/member/active-plans')
                  ? 'text-sky-400 font-bold bg-sky-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base sm:text-lg">📈</span>
              <span className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap">Plans</span>
            </Link>

            <Link 
              to="/member/referrals" 
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/referrals') 
                  ? 'text-sky-400 font-bold bg-sky-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base sm:text-lg">👥</span>
              <span className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap">Ref Network</span>
            </Link>

            <Link 
              to="/member/profile" 
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/profile') 
                  ? 'text-sky-400 font-bold bg-sky-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base sm:text-lg">👤</span>
              <span className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap">Profile</span>
            </Link>
          </>
        ) : (
          <>
            <Link 
              to="/member" 
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                location.pathname === '/member' || location.pathname === '/member/' 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-lg">🏠</span>
              <span className="text-[10px] font-bold whitespace-nowrap">Home</span>
            </Link>

            <Link 
              to="/member/available-tasks" 
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/available-tasks') || location.pathname.includes('/member/pending-reviews') || location.pathname.includes('/member/tasks-history')
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-lg">📋</span>
              <span className="text-[10px] font-bold whitespace-nowrap">Task</span>
            </Link>

            <Link 
              to="/member/my-campaigns" 
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/my-campaigns') || location.pathname.includes('/member/create-campaign') || location.pathname.includes('/member/review-proofs')
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-lg">📢</span>
              <span className="text-[10px] font-bold whitespace-nowrap">Campaign</span>
            </Link>

            <Link 
              to="/member/withdraw" 
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/withdraw') 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-lg">💸</span>
              <span className="text-[10px] font-bold whitespace-nowrap">Withdraw</span>
            </Link>

            <Link 
              to="/member/profile" 
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                location.pathname.includes('/member/profile') 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-lg">👤</span>
              <span className="text-[10px] font-bold whitespace-nowrap">Profile</span>
            </Link>
          </>
        )}
      </nav>
    </div>
  );
};

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
                <div className="animate-marquee whitespace-nowrap w-full text-center">
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

    return (
        <div className={containerClass}>
            {notice.message}
        </div>
    );
};

export default UserLayout;
