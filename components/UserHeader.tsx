
import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import NotificationBell from './ui/NotificationBell';
import { currencySymbols, Currency, canUserAccessInvestment } from '../types';

interface UserHeaderProps {
  setSidebarOpen: (open: boolean) => void;
  dashboardMode: 'work_and_earn' | 'investment';
  setDashboardMode: (mode: 'work_and_earn' | 'investment') => void;
}

const UserHeader: React.FC<UserHeaderProps> = ({ setSidebarOpen, dashboardMode, setDashboardMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useData();
  const { currentUser, notifications, settings } = state;

  const hasHubAccess = React.useMemo(() => {
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

  const userCanAccessInvestment = canUserAccessInvestment(currentUser, settings);
  const isInvestmentEnabled = settings?.investmentModuleEnabled !== false && settings?.isInvestmentModuleEnabled !== false;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const showModeSwitcher = hasHubAccess && userCanAccessInvestment;

  const getTitle = () => {
    const path = location.pathname.split('/')[2] || 'dashboard';
    switch (path) {
        case 'deposit': return 'Deposit Funds';
        case 'withdraw': return 'Withdraw Funds';
        case 'plans': return 'Investment Plans';
        case 'referrals': return 'My Network';
        case 'profile': return 'Profile Settings';
        default: return path.charAt(0).toUpperCase() + path.slice(1);
    }
  };

  const userNotifications = notifications.filter(n => String(n.userId) === String(currentUser?._id));

  return (
    <header className="relative flex justify-between items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex items-center space-x-3 sm:space-x-4 ml-2 lg:ml-0">
            <h1 className="text-lg sm:text-2xl font-semibold text-gray-800 dark:text-white max-w-[80px] xs:max-w-none truncate">{getTitle()}</h1>
            {currentUser && (
                <div className="hidden md:flex items-center space-x-2 bg-gray-100 dark:bg-gray-700/50 px-3 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shrink-0">
                    <MapPinIcon />
                    <span>{currentUser.country} ({currencySymbols[(currentUser.currency || 'USD').toUpperCase() as Currency] || '$'})</span>
                </div>
            )}
        </div>
      </div>

      {/* Top Center Logo */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center justify-center">
        <Link to="/" className="flex items-center gap-1.5 hover:opacity-90 transition-all active:scale-95" title="Go to Home">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg shrink-0"></div>
          <span className="hidden sm:inline-block text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 tracking-tight">
            SmartEarning
          </span>
        </Link>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Responsive Dashboard Mode Switcher */}
        {showModeSwitcher && (
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/50 p-0.5 sm:p-1 rounded-xl border dark:border-gray-700/50 shrink-0">
            <button 
              onClick={() => {
                setDashboardMode('work_and_earn');
                localStorage.setItem('dashboard_mode', 'work_and_earn');
                navigate('/member');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black tracking-tight transition-all duration-200 ${dashboardMode === 'work_and_earn' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
              title="Work & Earn (Primary)"
            >
              <span>⚡ Work & Earn</span>
            </button>
            <button 
              onClick={() => {
                setDashboardMode('investment');
                localStorage.setItem('dashboard_mode', 'investment');
                navigate('/member');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black tracking-tight transition-all duration-200 ${dashboardMode === 'investment' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
              title={!isInvestmentEnabled ? 'Investment (Admin Preview Only - Disabled for Users)' : 'Investment (Secondary)'}
            >
              <span>📈 Investment {!isInvestmentEnabled && <span className="text-[9px] text-amber-400 font-bold">(Admin)</span>}</span>
            </button>
          </div>
        )}

        <NotificationBell notifications={userNotifications} userId={currentUser?._id} />
        <div className="relative">
          <button className="flex items-center focus:outline-none">
            <span className="mr-2 hidden lg:inline">{currentUser?.fullName || 'Member'}</span>
            <img className="h-8 w-8 rounded-full object-cover" src="https://picsum.photos/101" alt="User avatar" />
          </button>
        </div>
      </div>
    </header>
  );
};

const MapPinIcon = () => <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

export default UserHeader;
