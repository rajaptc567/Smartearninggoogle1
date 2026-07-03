
import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import NotificationBell from './ui/NotificationBell';
import { useData } from '../hooks/useData';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useData();

  const getTitle = () => {
    const path = location.pathname.split('/')[2] || 'dashboard';
    if (path === 'payment-methods') return 'Payment Methods';
    if (path === 'investment-plans') return 'Investment Plans';
    if (path === 'ticker-settings') return 'Ticker Settings';
    if (path === 'sponsor-commission-rules') return 'Sponsor Rules';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <header className="relative flex justify-between items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white ml-2 lg:ml-0">{getTitle()}</h1>
      </div>

      {/* Top Center Logo */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
        <Link to="/" className="flex items-center gap-1.5 hover:opacity-90 transition-all active:scale-95" title="Go to Home">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg shrink-0"></div>
          <span className="hidden sm:inline-block text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 tracking-tight">
            SmartEarning
          </span>
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        <NotificationBell notifications={state.notifications} isAdmin={true} />
        <div className="relative">
          <button 
            className="flex items-center focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full py-1 px-2 transition-colors"
            onClick={() => navigate('/admin/profile')}
            title="Admin Profile & Settings"
          >
            <span className="mr-2 hidden md:inline font-medium text-gray-700 dark:text-gray-200">Admin</span>
            <img className="h-8 w-8 rounded-full object-cover" src="https://picsum.photos/100" alt="Admin avatar" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
