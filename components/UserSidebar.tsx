
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../hooks/useData';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const HomeIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>;
const DepositIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const WithdrawalIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const TransferIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>;
const PlanIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
const WalletIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const UsersIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z"></path></svg>;
const SettingsIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const DisputeIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>;
const LogoutIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>;
const ActivePlansIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>;
const InboxIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>;
const TaskIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>;

const UserSidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
    const { state, dispatch } = useData();
    const { currentUser, settings, notifications } = state;

    const unreadMessagesCount = notifications.filter(n => n.userId === currentUser?._id && !n.read).length;

    const userNavLinks = [
        { to: '/member', label: 'Dashboard', icon: <HomeIcon />, condition: null },
        { to: '/member/deposit', label: 'Deposit Funds', icon: <DepositIcon />, condition: null },
        { to: '/member/withdraw', label: 'Withdraw Funds', icon: <WithdrawalIcon />, condition: null },
        { to: '/member/transfer', label: 'Transfer Funds', icon: <TransferIcon />, condition: 'isUserTransferEnabled' },
        { to: '/member/plans', label: 'Investment Plans', icon: <PlanIcon />, condition: null },
        { to: '/member/active-plans', label: 'My Active Plans', icon: <ActivePlansIcon />, condition: null },
        { to: '/member/tasks', label: 'My Tasks', icon: <TaskIcon />, condition: 'isTasksEnabled' },
        { to: '/member/transactions', label: 'Transactions', icon: <WalletIcon />, condition: null },
        { to: '/member/referrals', label: 'My Referral Network', icon: <UsersIcon />, condition: null },
        { to: '/member/messages', label: 'Inbox', icon: <InboxIcon />, badge: unreadMessagesCount },
        { to: '/member/disputes', label: 'Disputes', icon: <DisputeIcon />, condition: null },
        { to: '/member/profile', label: 'Profile Settings', icon: <SettingsIcon />, condition: null },
    ];

    const baseLinkClass = "flex items-center px-4 py-3 rounded-xl transition-all duration-200 mx-2 mb-1";
    const inactiveLinkClass = "text-gray-400 hover:bg-gray-700/50 hover:text-white";
    const activeLinkClass = "bg-blue-600 text-white shadow-lg shadow-blue-600/20";

    const handleLogout = () => {
        dispatch({ type: 'SET_CURRENT_USER', payload: null });
        setSidebarOpen(false);
    };

    return (
        <>
            <div className={`fixed inset-0 z-40 bg-black bg-opacity-60 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                 onClick={() => setSidebarOpen(false)}>
            </div>
            <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col shadow-2xl`}>
                <div className="flex items-center justify-center h-24 border-b border-gray-800 flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg mr-3 shadow-md"></div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Member Area</h1>
                </div>
                
                {/* Scrollable navigation area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 flex flex-col">
                    <nav className="flex-1 px-2">
                        {userNavLinks.map(({ to, label, icon, condition, badge }) => {
                            if (condition && (settings as any)[condition] === false) {
                              return null;
                            }
                            return (
                              <NavLink
                                  key={label}
                                  to={to}
                                  end={to === '/member'}
                                  onClick={() => setSidebarOpen(false)}
                                  className={({ isActive }) => `${baseLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}
                              >
                                  <div className="shrink-0">{icon}</div>
                                  <span className="ml-4 font-bold text-sm tracking-tight">{label}</span>
                                  {badge !== undefined && badge > 0 && (
                                    <span className="ml-auto inline-flex items-center justify-center h-5 w-5 text-[10px] font-black leading-none text-white bg-red-600 rounded-full shadow-sm">
                                        {badge}
                                    </span>
                                )}
                              </NavLink>
                            )
                        })}
                    </nav>
                    
                    {/* Fixed-at-bottom-of-content area */}
                    <div className="px-2 pb-8 mt-4 pt-4 border-t border-gray-800">
                         <button
                            onClick={handleLogout}
                            className={`${baseLinkClass} ${inactiveLinkClass} w-[calc(100%-1rem)] text-left hover:bg-red-900/20 hover:text-red-400 group transition-colors`}
                        >
                            <div className="group-hover:translate-x-1 transition-transform">
                                <LogoutIcon />
                            </div>
                            <span className="ml-4 font-bold text-sm tracking-tight">Secure Logout</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
            `}</style>
        </>
    );
};

export default UserSidebar;
