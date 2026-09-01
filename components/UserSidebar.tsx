
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { getEffectiveModulePageControl } from '../data/modulePagesDefaults';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  dashboardMode: 'work_and_earn' | 'investment';
  setDashboardMode: (mode: 'work_and_earn' | 'investment') => void;
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
const CampaignIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>;
const ChevronDownIcon = ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>;

const FAQIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const LegalIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path></svg>;
const HistoryNavIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;

const UserSidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen, dashboardMode, setDashboardMode }) => {
    const { state, dispatch } = useData();
    const { currentUser, settings, notifications } = state;
    const location = useLocation();
    const navigate = useNavigate();

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

    const isCampaignActive = location.pathname.includes('/member/create-campaign') ||
        location.pathname.includes('/member/my-campaigns') ||
        location.pathname.includes('/member/review-proofs');

    const isTasksActive = location.pathname.includes('/member/available-tasks') ||
        location.pathname.includes('/member/pending-reviews') ||
        location.pathname.includes('/member/tasks-history');

    const [myCampaignOpen, setMyCampaignOpen] = useState(isCampaignActive);
    const [myTasksOpen, setMyTasksOpen] = useState(isTasksActive && !isCampaignActive);

    useEffect(() => {
        if (isCampaignActive) {
            setMyCampaignOpen(true);
            setMyTasksOpen(false);
        } else if (isTasksActive) {
            setMyTasksOpen(true);
            setMyCampaignOpen(false);
        }
    }, [location.pathname, isCampaignActive, isTasksActive]);

    const handleToggleTasks = () => {
        setMyTasksOpen(prev => {
            const next = !prev;
            if (next) setMyCampaignOpen(false);
            return next;
        });
    };

    const handleToggleCampaign = () => {
        setMyCampaignOpen(prev => {
            const next = !prev;
            if (next) setMyTasksOpen(false);
            return next;
        });
    };

    const mySubmittedTasks = useMemo(() => (state.userTasks || []).filter(t => String(t.userId) === String(currentUser?._id)), [state.userTasks, currentUser]);
    const campaignSubmissions = useMemo(() => (state.userTaskSubmissions || []).filter(s => mySubmittedTasks.some(t => String(t._id) === String(s.taskId))), [state.userTaskSubmissions, mySubmittedTasks]);
    const pendingReviewCount = useMemo(() => campaignSubmissions.filter(s => s.status === 'Pending').length, [campaignSubmissions]);

    const myWorkerSubmissions = useMemo(() => (state.userTaskSubmissions || []).filter(s => String(s.workerId) === String(currentUser?._id)), [state.userTaskSubmissions, currentUser]);
    const pendingWorkerReviewsCount = useMemo(() => myWorkerSubmissions.filter(s => s.status === 'Pending').length, [myWorkerSubmissions]);

    const unreadMessagesCount = notifications.filter(n => String(n.userId) === String(currentUser?._id) && !n.read).length;

    const exchangeRate = settings?.exchangeRates?.[currentUser?.currency || 'USD'] || 1;
    const taskEarningsUSD = currentUser?.taskEarningsBalance ?? 0;
    const userHubBalance = taskEarningsUSD * exchangeRate;

    const hubMinWithdrawalLimit = useMemo(() => {
        const availableMethods = (state.paymentMethods || []).filter(m => 
            m.type === 'Withdrawal' && 
            m.status === 'Enabled' && 
            m.currency === currentUser?.currency
        );
        if (availableMethods.length > 0) {
            return Math.min(...availableMethods.map(m => m.minAmount || 0));
        }
        return (settings?.hubMinWithdrawal || 1) * exchangeRate;
    }, [state.paymentMethods, currentUser?.currency, settings?.hubMinWithdrawal, exchangeRate]);

    const isHubWithdrawalInsufficient = useMemo(() => {
        if (!currentUser) return false;
        return userHubBalance < hubMinWithdrawalLimit || userHubBalance <= 0;
    }, [currentUser, userHubBalance, hubMinWithdrawalLimit]);

    const isItemVisible = (category: 'investment' | 'workAndEarn', pageId: string) => {
        const control = getEffectiveModulePageControl(settings?.modulePagesConfig, category, pageId);
        return control.isEnabled && !control.isHiddenInNav;
    };

    const userNavLinks = dashboardMode === 'work_and_earn' ? [
        { to: '/member', label: 'Dashboard Hub', icon: <HomeIcon />, pageId: 'dashboard', condition: null },
        { to: '/member/offerwalls', label: 'Offerwalls & Surveys', icon: <TaskIcon />, pageId: 'offerwalls', condition: null },
        { to: '/member/deposit', label: 'Deposit Hub Funds', icon: <DepositIcon />, pageId: 'deposit', condition: null },
        { to: '/member/withdraw', label: 'Withdraw Hub Funds', icon: <WithdrawalIcon />, pageId: 'withdraw', condition: null, isInsufficient: isHubWithdrawalInsufficient, insufficientMsg: 'Not sufficient balance for withdrawal' },
        { to: '/member/work-history', label: 'Work & Earn History', icon: <HistoryNavIcon />, pageId: 'workHistory', condition: null },
        { to: '/member/user-tasks', label: 'Earn Cash & Gigs Hub', icon: <TaskIcon />, pageId: 'userTasks', condition: 'isUserTaskEnabled' },
        { isTasksDropdown: true, condition: 'isUserTaskEnabled' },
        { isCampaignDropdown: true, condition: 'isUserTaskEnabled' },
        { to: '/member/messages', label: 'Inbox', icon: <InboxIcon />, badge: unreadMessagesCount, pageId: 'messages' },
        { to: '/member/disputes?module=Work%20%26%20Earn', label: 'Disputes & Support', icon: <DisputeIcon />, pageId: 'disputes', condition: null },
        { to: '/member/hub-faqs', label: 'Hub FAQs', icon: <FAQIcon />, pageId: 'hubFaqs', condition: null },
        { to: '/member/hub-legal', label: 'Hub Legal Info', icon: <LegalIcon />, pageId: 'hubLegal', condition: null },
        { to: '/member/profile', label: 'Profile Settings', icon: <SettingsIcon />, pageId: 'profile', condition: null },
    ] : [
        { to: '/member', label: 'Dashboard Hub', icon: <HomeIcon />, pageId: 'dashboard', condition: null },
        { to: '/member/deposit', label: 'Deposit Funds', icon: <DepositIcon />, pageId: 'deposit', condition: null },
        { to: '/member/withdraw', label: 'Withdraw Funds', icon: <WithdrawalIcon />, pageId: 'withdraw', condition: null },
        { to: '/member/transfer', label: 'Transfer Funds', icon: <TransferIcon />, pageId: 'transfer', condition: 'isUserTransferEnabled' },
        { to: '/member/plans', label: 'Investment Plans', icon: <PlanIcon />, pageId: 'plans', condition: null },
        { to: '/member/active-plans', label: 'My Active Plans', icon: <ActivePlansIcon />, pageId: 'activePlans', condition: null },
        { to: '/member/tasks', label: 'My Daily Tasks', icon: <TaskIcon />, pageId: 'tasks', condition: 'isTasksEnabled' },
        { to: '/member/user-tasks', label: 'Earn Cash & Gigs Hub', icon: <TaskIcon />, pageId: 'userTasks', condition: 'isUserTaskEnabled' },
        { to: '/member/transactions', label: 'Transactions History', icon: <WalletIcon />, pageId: 'transactions', condition: null },
        { to: '/member/referrals', label: 'My Referral Network', icon: <UsersIcon />, pageId: 'referrals', condition: null },
        { to: '/member/messages', label: 'Inbox', icon: <InboxIcon />, badge: unreadMessagesCount, pageId: 'messages' },
        { to: '/member/disputes?module=Investment', label: 'Disputes & Support', icon: <DisputeIcon />, pageId: 'disputes', condition: null },
        { to: '/member/profile', label: 'Profile Settings', icon: <SettingsIcon />, pageId: 'profile', condition: null },
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
            <div className={`fixed inset-0 z-[60] bg-black bg-opacity-60 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                 onClick={() => setSidebarOpen(false)}>
            </div>
            <div className={`fixed inset-y-0 left-0 z-[60] w-72 bg-gray-900 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col shadow-2xl`}>
                <div className="flex items-center justify-center h-20 border-b border-gray-800 flex-shrink-0">
                    <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl mr-3 shadow-md flex items-center justify-center font-black text-white text-lg">S</div>
                    <h1 className="text-xl font-black text-white uppercase tracking-tighter">Member Area</h1>
                </div>
                
                {/* Module Mode Switcher in Sidebar */}
                {hasHubAccess && (
                    <div className="mx-3 mt-3 mb-1 p-2 bg-gray-800/80 rounded-2xl border border-gray-700/60 flex flex-col gap-1.5 shrink-0">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Module Selection</span>
                            <span className="text-[10px] font-black text-sky-400 uppercase tracking-tight">
                                {dashboardMode === 'work_and_earn' ? 'Work & Earn (Primary)' : 'Investment (Secondary)'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 bg-gray-950/80 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => {
                                    setDashboardMode('work_and_earn');
                                    localStorage.setItem('dashboard_mode', 'work_and_earn');
                                    setSidebarOpen(false);
                                    navigate('/member');
                                }}
                                className={`py-1.5 rounded-lg text-xs font-black tracking-wide transition-all ${
                                    dashboardMode === 'work_and_earn' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                                }`}
                                title="Primary Work & Earn Ecosystem"
                            >
                                ⚡ Work & Earn
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setDashboardMode('investment');
                                    localStorage.setItem('dashboard_mode', 'investment');
                                    setSidebarOpen(false);
                                    navigate('/member');
                                }}
                                className={`py-1.5 rounded-lg text-xs font-black tracking-wide transition-all ${
                                    dashboardMode === 'investment' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                                }`}
                                title="Secondary Investment & MLM Module"
                            >
                                📈 Investment
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Scrollable navigation area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 flex flex-col">
                    <nav className="flex-1 px-2">
                        {userNavLinks.map((item, index) => {
                            const moduleCat = dashboardMode === 'work_and_earn' ? 'workAndEarn' : 'investment';

                            if (item.condition && (settings as any)[item.condition] === false) {
                              return null;
                            }

                            if (item.pageId && !isItemVisible(moduleCat, item.pageId)) {
                              return null;
                            }

                            if (item.isTasksDropdown) {
                                const showAvailable = isItemVisible('workAndEarn', 'availableTasks');
                                const showPending = isItemVisible('workAndEarn', 'pendingReviews');
                                const showHistory = isItemVisible('workAndEarn', 'tasksHistory');

                                if (!showAvailable && !showPending && !showHistory) {
                                    return null;
                                }

                                return (
                                    <div key="my-tasks-dropdown" className="mb-1">
                                        <button
                                            type="button"
                                            onClick={handleToggleTasks}
                                            className={`w-[calc(100%-1rem)] flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 mx-2 ${
                                                isTasksActive ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center">
                                                <div className="shrink-0"><TaskIcon /></div>
                                                <span className="ml-4 font-bold text-sm tracking-tight">My Tasks</span>
                                                {pendingWorkerReviewsCount > 0 && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-gray-900 rounded-full">
                                                        {pendingWorkerReviewsCount}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${myTasksOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {myTasksOpen && (
                                            <div className="pl-6 pr-2 space-y-1 mt-1 mb-2 border-l-2 border-blue-600/30 ml-6">
                                                {showAvailable && (
                                                    <NavLink
                                                        to="/member/available-tasks"
                                                        onClick={() => setSidebarOpen(false)}
                                                        className={({ isActive }) =>
                                                            `flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <span className="mr-2">📋</span>
                                                        <span>Available Tasks</span>
                                                    </NavLink>
                                                )}

                                                {showPending && (
                                                    <NavLink
                                                        to="/member/pending-reviews"
                                                        onClick={() => setSidebarOpen(false)}
                                                        className={({ isActive }) =>
                                                            `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <div className="flex items-center">
                                                            <span className="mr-2">⏳</span>
                                                            <span>Pending Reviews</span>
                                                        </div>
                                                        {pendingWorkerReviewsCount > 0 && (
                                                            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-gray-900 rounded-full">
                                                                {pendingWorkerReviewsCount}
                                                            </span>
                                                        )}
                                                    </NavLink>
                                                )}

                                                {showHistory && (
                                                    <NavLink
                                                        to="/member/tasks-history"
                                                        onClick={() => setSidebarOpen(false)}
                                                        className={({ isActive }) =>
                                                            `flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <span className="mr-2">📜</span>
                                                        <span>Tasks Submission History</span>
                                                    </NavLink>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            if (item.isCampaignDropdown) {
                                const showCreate = isItemVisible('workAndEarn', 'createCampaign');
                                const showMyCampaigns = isItemVisible('workAndEarn', 'myCampaigns');
                                const showReviewProofs = isItemVisible('workAndEarn', 'reviewProofs');

                                if (!showCreate && !showMyCampaigns && !showReviewProofs) {
                                    return null;
                                }

                                return (
                                    <div key="my-campaign-dropdown" className="mb-1">
                                        <button
                                            type="button"
                                            onClick={handleToggleCampaign}
                                            className={`w-[calc(100%-1rem)] flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 mx-2 ${
                                                isCampaignActive ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center">
                                                <div className="shrink-0"><CampaignIcon /></div>
                                                <span className="ml-4 font-bold text-sm tracking-tight">My Campaign</span>
                                                {pendingReviewCount > 0 && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-gray-900 rounded-full">
                                                        {pendingReviewCount}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${myCampaignOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {myCampaignOpen && (
                                            <div className="pl-6 pr-2 space-y-1 mt-1 mb-2 border-l-2 border-blue-600/30 ml-6">
                                                {showCreate && (
                                                    <NavLink
                                                        to="/member/create-campaign"
                                                        onClick={() => setSidebarOpen(false)}
                                                        className={({ isActive }) =>
                                                            `flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <span className="mr-2">🚀</span>
                                                        <span>Create Campaign / Task</span>
                                                    </NavLink>
                                                )}

                                                {showMyCampaigns && (
                                                    <NavLink
                                                        to="/member/my-campaigns"
                                                        onClick={() => setSidebarOpen(false)}
                                                        className={({ isActive }) =>
                                                            `flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <span className="mr-2">📂</span>
                                                        <span>My Campaigns</span>
                                                    </NavLink>
                                                )}

                                                {showReviewProofs && (
                                                    <NavLink
                                                        to="/member/review-proofs"
                                                        onClick={() => setSidebarOpen(false)}
                                                        className={({ isActive }) =>
                                                            `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                                isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                                            }`
                                                        }
                                                    >
                                                        <div className="flex items-center">
                                                            <span className="mr-2">👁️</span>
                                                            <span>Review Proofs</span>
                                                        </div>
                                                        {pendingReviewCount > 0 && (
                                                            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-gray-900 rounded-full">
                                                                {pendingReviewCount}
                                                            </span>
                                                        )}
                                                    </NavLink>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            const { to, label, icon, badge, isInsufficient, insufficientMsg } = item as any;
                            return (
                              <NavLink
                                  key={label}
                                  to={to!}
                                  end={to === '/member'}
                                  onClick={() => setSidebarOpen(false)}
                                  title={isInsufficient ? (insufficientMsg || 'Not sufficient balance for withdrawal') : undefined}
                                  className={({ isActive }) => `${baseLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass} group`}
                              >
                                  <div className="shrink-0">{icon}</div>
                                  <div className="ml-4 flex-1 flex flex-col min-w-0">
                                      <div className="flex items-center justify-between">
                                          <span className="font-bold text-sm tracking-tight truncate">{label}</span>
                                          {badge !== undefined && badge > 0 && (
                                            <span className="ml-auto inline-flex items-center justify-center h-5 w-5 text-[10px] font-black leading-none text-white bg-red-600 rounded-full shadow-sm">
                                                {badge}
                                            </span>
                                          )}
                                      </div>
                                      {isInsufficient && (
                                          <span className="text-[10px] font-bold text-amber-400 leading-tight truncate flex items-center gap-1 mt-0.5" title={insufficientMsg}>
                                              <span>⚠️</span> Not sufficient balance
                                          </span>
                                      )}
                                  </div>
                                  {isInsufficient && (
                                      <span className="ml-1.5 shrink-0 px-1.5 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                                          Low
                                      </span>
                                  )}
                              </NavLink>
                            )
                        })}
                    </nav>
                    
                    {/* Fixed-at-bottom-of-content area */}
                    <div className="px-2 pb-28 lg:pb-8 mt-4 pt-4 border-t border-gray-800">
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
