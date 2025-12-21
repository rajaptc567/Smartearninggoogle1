import React from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../hooks/useData';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const HomeIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 v4a1 1 0 001 1m-6 0h6"></path></svg>;
const DepositIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const WithdrawalIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const TransferIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>;
const PlanIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
const WalletIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const UsersIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z"></path></svg>;
const LockIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>;
const SettingsIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const DisputeIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>;
const LogoutIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>;
const SentIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>;
const ClockIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;

/**
 * UserSidebar component for the member dashboard.
 * Added "Held Commissions" link with count badge.
 */
const UserSidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
    const { state, dispatch } = useData();
    const { currentUser, notifications, disputes, transactions } = state;
    
    const unreadNotificationsCount = notifications.filter(n => n.userId === currentUser?._id && !n.read).length;
    const openDisputesCount = disputes.filter(d => d.userId === currentUser?._id && d.status === 'Open').length;
    const heldCommissionsCount = transactions.filter(t => t.userId === currentUser?._id && t.type === 'Commission' && t.status === 'Pending').length;

    const navLinks = [
        { to: '/member', label: 'Dashboard', icon: <HomeIcon /> },
        { to: '/member/deposit', label: 'Deposit', icon: <DepositIcon /> },
        { to: '/member/withdraw', label: 'Withdraw', icon: <WithdrawalIcon /> },
        { to: '/member/transfer', label: 'Transfer', icon: <TransferIcon /> },
        { to: '/member/plans', label: 'Buy Plan', icon: <PlanIcon /> },
        { to: '/member/active-plans', label: 'My Plans', icon: <LockIcon /> },
        { to: '/member/transactions', label: 'Transactions', icon: <WalletIcon /> },
        { to: '/member/referrals', label: 'My Network', icon: <UsersIcon /> },
        { to: '/member/referrals', label: 'Held Commissions', icon: <ClockIcon />, state: { viewMode: 'held' }, badge: heldCommissionsCount },
        { to: '/member/messages', label: 'Messages', icon: <SentIcon />, badge: unreadNotificationsCount },
        { to: '/member/disputes', label: 'Disputes', icon: <DisputeIcon />, badge: openDisputesCount },
        { to: '/member/profile', label: 'Profile', icon: <SettingsIcon /> },
    ];

    const baseLinkClass = "flex items-center px-4 py-2.5 rounded-lg transition-colors duration-200";
    const inactiveLinkClass = "text-gray-400 hover:bg-gray-700 hover:text-white";
    const activeLinkClass = "bg-blue-600 text-white";

    const handleLogout = () => {
        dispatch({ type: 'SET_CURRENT_USER', payload: null });
    };

    return (
        <>
            <div 
                className={`fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setSidebarOpen(false)}
            ></div>
            <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-gray-800 dark:bg-gray-900 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col`}>
                <div className="flex items-center justify-center h-20 border-b border-gray-700 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-white">SmartEarning</h1>
                </div>
                <nav className="mt-6 px-4 flex-grow overflow-y-auto custom-scrollbar">
                    {navLinks.map(({ to, label, icon, badge, state: linkState }) => (
                        <NavLink
                            key={label}
                            to={to}
                            state={linkState}
                            end={to === '/member'}
                            onClick={() => setSidebarOpen(false)}
                            className={({isActive}) => `${baseLinkClass} ${isActive && (!linkState || isActive) ? activeLinkClass : inactiveLinkClass} mt-2`}
                        >
                            {icon}
                            <span className="mx-4 font-medium">{label}</span>
                             {badge !== undefined && badge > 0 && (
                                <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                                    {badge}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
                 <div className="px-4 pb-6">
                     <button
                        onClick={handleLogout}
                        className={`w-full ${baseLinkClass} ${inactiveLinkClass} mt-2 text-left`}
                    >
                        <LogoutIcon />
                        <span className="mx-4 font-medium">Logout</span>
                    </button>
                    {currentUser?.username === 'admin' && (
                        <NavLink
                            to="/admin"
                            onClick={() => setSidebarOpen(false)}
                            className={`${baseLinkClass} ${inactiveLinkClass} mt-2 bg-gray-700/50`}
                        >
                            <LockIcon />
                            <span className="mx-4 font-medium">Back to Admin</span>
                        </NavLink>
                    )}
                </div>
            </div>
        </>
    );
};

export default UserSidebar;
