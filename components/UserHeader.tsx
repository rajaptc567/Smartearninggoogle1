
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import NotificationBell from './ui/NotificationBell';
import { currencySymbols, Currency } from '../types';

interface UserHeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const UserHeader: React.FC<UserHeaderProps> = ({ setSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useData();
  const { currentUser, notifications } = state;

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

  const userNotifications = notifications.filter(n => n.userId === currentUser?._id);

  return (
    <header className="flex justify-between items-center p-3 sm:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
      <div className="flex items-center min-w-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden p-1 mr-1"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white truncate">{getTitle()}</h1>
            {currentUser && (
                <div className="hidden xs:flex items-center space-x-1 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shrink-0">
                    <MapPinIcon />
                    <span className="truncate max-w-[60px] sm:max-w-none">{currentUser.country}</span>
                </div>
            )}
        </div>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
        <NotificationBell notifications={userNotifications} userId={currentUser?._id} />
        <div className="relative">
          <button className="flex items-center focus:outline-none" onClick={() => navigate('/member/profile')}>
            <span className="mr-2 hidden md:inline font-bold text-sm">{currentUser?.fullName || 'Member'}</span>
            <img className="h-8 w-8 rounded-full object-cover border-2 border-blue-500/20" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.fullName || 'User')}&background=random`} alt="User avatar" />
          </button>
        </div>
      </div>
    </header>
  );
};

const MapPinIcon = () => <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

export default UserHeader;
