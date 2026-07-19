
import React, { useState, useMemo, useCallback } from 'react';
import { Status, Transaction, User, Deposit, formatCurrency } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import ShareButtons from '../components/ui/ShareButtons';
import { LoadingCircle } from '../components/ui/LoadingCircle';

// Icons
const WalletIcon = ({ className = "w-8 h-8" }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const DepositIcon = ({ className = "w-8 h-8" }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const WithdrawalIcon = ({ className = "w-8 h-8" }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const UsersIcon = ({ className = "w-8 h-8" }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z"></path></svg>;
const EarningsIcon = ({ className = "w-8 h-8" }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg>;
const ClockIcon = ({ className = "w-8 h-8" }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const PlanIcon = ({ className = "w-8 h-8" }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
const MapPinIcon = ({ className = "w-5 h-5 text-gray-500 dark:text-gray-400" }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

const PieChart = ({ data, currency }: { data: { label: string, value: number, color: string }[], currency: string }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-full min-h-[120px]"><p className="text-sm text-gray-500">No earnings or commission data yet.</p></div>;
    
    let cumulative = 0;
    const segments = data.map(item => {
        const percent = item.value / total;
        const dashArray = 2 * Math.PI * 40;
        const dashOffset = dashArray * (1 - percent);
        const rotation = (cumulative / total) * 360;
        cumulative += item.value;
        return { ...item, percent, dashArray, dashOffset, rotation };
    });

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <svg viewBox="0 0 100 100" className="w-32 h-32 transform -rotate-90">
                {segments.map((segment, index) => (
                    <circle
                        key={index}
                        cx="50" cy="50" r="40"
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth="20"
                        strokeDasharray={segment.dashArray}
                        strokeDashoffset={segment.dashOffset}
                        transform={`rotate(${segment.rotation} 50 50)`}
                    />
                ))}
            </svg>
            <div className="text-sm space-y-1">
                {data.map(item => (
                    <div key={item.label} className="flex items-center">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                        <span>{item.label}:</span>
                        <span className="font-semibold ml-1">{formatCurrency(item.value, currency as any)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const UserDashboard: React.FC = () => {
    const { state } = useData();
    const { currentUser, deposits, withdrawals, transactions, users, investmentPlans, settings } = state;
    const navigate = useNavigate();
    
    const [visibleWidgets, setVisibleWidgets] = useState({
      balance: true, deposits: true, commission: true, withdrawals: true,
      pending: true, referrals: true, plan: true, monthly: true, breakdown: true,
      taskEarnings: true
    });
    const [showCustomize, setShowCustomize] = useState(false);

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl min-h-[400px]">
                <LoadingCircle text="Syncing user profile and platform parameters..." />
            </div>
        );
    }

    const userTransactions = useMemo(() => transactions.filter(t => t.userId === currentUser._id), [transactions, currentUser._id]);

    const stats = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const approvedCommissions = userTransactions.filter(t => t.type === 'Commission' && t.status === 'Approved');
        
        const totalCommission = approvedCommissions.reduce((sum, t) => sum + t.amount, 0);
        const directCommission = approvedCommissions.filter(t => t.level === 1).reduce((sum, t) => sum + t.amount, 0);
        const indirectCommission = totalCommission - directCommission;

        const activePlanCount = (currentUser.activePlans || []).length;
        const activePlanValue = (currentUser.activePlans || []).reduce((sum, p) => sum + p.price, 0);

        const approvedTaskRewards = userTransactions.filter(t => t.type === 'Task Reward' && t.status === 'Approved');
        const rates = settings?.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = currentUser.currency || 'USD';
        const totalTaskEarnings = approvedTaskRewards.reduce((sum, t) => {
            const txCurr = t.currency || 'USD';
            if (txCurr === userCurr) {
                return sum + t.amount;
            }
            const amtInUSD = t.amount / (rates[txCurr] || 1);
            const amtInUserCurr = amtInUSD * (rates[userCurr] || 1);
            return sum + amtInUserCurr;
        }, 0);

        return {
            totalDeposits: deposits.filter(d => d.userId === currentUser._id && d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0),
            totalWithdrawals: withdrawals.filter(w => w.userId === currentUser._id && w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0),
            totalCommission,
            directCommission,
            indirectCommission,
            pendingCommission: userTransactions.filter(t => t.type === 'Commission' && t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0),
            monthlyEarnings: approvedCommissions.filter(t => t.date >= firstDayOfMonth).reduce((sum, t) => sum + t.amount, 0),
            activePlanCount,
            activePlanValue,
            totalTaskEarnings,
        };
    }, [userTransactions, deposits, withdrawals, investmentPlans, currentUser._id, currentUser.activePlans, settings]);
    
    const networkBreakdown = useMemo(() => {
        const breakdown: { active: { [key: number]: number }, inactive: { [key: number]: number }, total: number } = {
            active: {},
            inactive: {},
            total: 0
        };

        const traverse = (sponsorUsername: string, level: number) => {
            // FIX: Case-insensitive match for sponsor
            const referrals = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === sponsorUsername.toLowerCase());
            if (referrals.length === 0) return;

            referrals.forEach(ref => {
                breakdown.total++;
                const isActive = ref.activePlans && ref.activePlans.length > 0;
                if (isActive) {
                    breakdown.active[level] = (breakdown.active[level] || 0) + 1;
                } else {
                    breakdown.inactive[level] = (breakdown.inactive[level] || 0) + 1;
                }
                traverse(ref.username, level + 1);
            });
        };

        traverse(currentUser.username, 1);
        return breakdown;
    }, [currentUser.username, users]);

    const recentTransactions = userTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;
    
    const isCompact = (settings?.userDashboardVersion || 'compact') === 'compact';

    const toggleWidget = (widget: keyof typeof visibleWidgets) => {
      setVisibleWidgets(prev => ({ ...prev, [widget]: !prev[widget] }));
    };

    const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => {
        if (isCompact) {
            return (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-2.5 sm:p-3.5 flex items-center justify-between gap-2 transition-all">
                    <div className="min-w-0">
                        <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">{title}</p>
                        <p className="text-base md:text-lg font-bold text-gray-800 dark:text-white mt-0.5 truncate">{value}</p>
                    </div>
                    <div className={`text-white p-1.5 md:p-2 rounded-lg shrink-0 ${color}`}>
                        <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                            {React.cloneElement(icon as React.ReactElement, { className: 'w-full h-full' })}
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-6 flex items-center justify-between gap-2 transition-all hover:shadow-md">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">{title}</p>
                        <p className="text-2xl font-extrabold text-gray-800 dark:text-white mt-1 truncate">{value}</p>
                    </div>
                    <div className={`text-white p-3.5 rounded-xl shrink-0 ${color}`}>
                        <div className="w-6 h-6 flex items-center justify-center">
                            {React.cloneElement(icon as React.ReactElement, { className: 'w-full h-full' })}
                        </div>
                    </div>
                </div>
            );
        }
    };
    
     const NetworkSummaryCard = () => {
        const totalActive = Object.values(networkBreakdown.active).reduce((s: number, c: number) => s + c, 0);
        const totalInactive = Object.values(networkBreakdown.inactive).reduce((s: number, c: number) => s + c, 0);

        if (isCompact) {
            return (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-2.5 sm:p-3.5 col-span-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0">
                            <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">Network Overview</p>
                            <p className="text-base md:text-lg font-bold text-gray-800 dark:text-white mt-0.5 truncate">{networkBreakdown.total} Referrals</p>
                        </div>
                        <div className="text-white p-1.5 md:p-2 rounded-lg bg-purple-500 shrink-0">
                            <UsersIcon className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t dark:border-gray-700/50 pt-2 mt-2">
                        <div>
                            <h4 className="font-bold text-green-600 dark:text-green-400 mb-0.5">Active ({totalActive})</h4>
                            <ul className="space-y-0.5 text-gray-600 dark:text-gray-400 text-[10px]">
                                {Object.keys(networkBreakdown.active).sort((a,b) => Number(a) - Number(b)).map(level => (
                                    <li key={`active-${level}`} className="flex justify-between">
                                        <span>Lvl {level}:</span>
                                        <span className="font-bold">{networkBreakdown.active[parseInt(level)]}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-red-500 dark:text-red-400 mb-0.5">Inactive ({totalInactive})</h4>
                            <ul className="space-y-0.5 text-gray-600 dark:text-gray-400 text-[10px]">
                                {Object.keys(networkBreakdown.inactive).sort((a,b) => Number(a) - Number(b)).map(level => (
                                    <li key={`inactive-${level}`} className="flex justify-between">
                                        <span>Lvl {level}:</span>
                                        <span className="font-bold">{networkBreakdown.inactive[parseInt(level)]}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-6 col-span-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Network Overview</p>
                            <p className="text-2xl font-extrabold text-gray-800 dark:text-white mt-1">{networkBreakdown.total} Referrals</p>
                        </div>
                        <div className="text-white p-3.5 rounded-xl bg-purple-500 shrink-0">
                            <UsersIcon className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t dark:border-gray-700/50 pt-4 mt-2">
                        <div>
                            <h4 className="font-bold text-green-600 dark:text-green-400 text-sm mb-1">Active ({totalActive})</h4>
                            <ul className="space-y-1 text-gray-600 dark:text-gray-400 text-xs">
                                {Object.keys(networkBreakdown.active).sort((a,b) => Number(a) - Number(b)).map(level => (
                                    <li key={`active-${level}`} className="flex justify-between">
                                        <span>Lvl {level}:</span>
                                        <span className="font-bold">{networkBreakdown.active[parseInt(level)]}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-red-500 dark:text-red-400 text-sm mb-1">Inactive ({totalInactive})</h4>
                            <ul className="space-y-1 text-gray-600 dark:text-gray-400 text-xs">
                                {Object.keys(networkBreakdown.inactive).sort((a,b) => Number(a) - Number(b)).map(level => (
                                    <li key={`inactive-${level}`} className="flex justify-between">
                                        <span>Lvl {level}:</span>
                                        <span className="font-bold">{networkBreakdown.inactive[parseInt(level)]}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }
    };


    return (
        <div className={isCompact ? "space-y-4 md:space-y-5" : "space-y-6 md:space-y-8"}>
            {/* Top Welcome Section */}
            {isCompact ? (
                <div className="flex flex-col items-center text-center space-y-3 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-emerald-500/5 dark:from-blue-500/10 dark:via-indigo-500/5 dark:to-emerald-500/10 p-4 md:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
                    <div className="space-y-0.5">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Welcome, {currentUser.fullName}!</h1>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Here's a compact summary of your account activity.</p>
                        {currentUser.country && (
                            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1 mt-1">
                                <MapPinIcon className="w-3.5 h-3.5" />
                                <span>{currentUser.country}</span>
                            </p>
                        )}
                    </div>

                    {/* Highly visible, attractive button for Earning Area */}
                    <div className="w-full max-w-sm bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/30 shadow-sm flex flex-col items-center space-y-2">
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                            Complete simple social micro-tasks & gigs to earn instant USD!
                        </p>
                        <Button 
                            onClick={() => navigate('/member/user-tasks')}
                            variant="primary" 
                            className="w-full py-1.5 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-none shadow-sm animate-pulse flex items-center justify-center gap-1.5"
                        >
                            🚀 Mega Earning & Gigs Hub ➜
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Welcome, {currentUser.fullName}!</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your investments, commissions, and track referral networks.</p>
                        {currentUser.country && (
                            <p className="text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
                                <MapPinIcon className="w-4 h-4" />
                                <span>{currentUser.country}</span>
                            </p>
                        )}
                    </div>
                    <div>
                        <Button 
                            onClick={() => navigate('/member/user-tasks')} 
                            variant="primary" 
                            className="px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-none shadow-md shrink-0"
                        >
                            🚀 Earning Area
                        </Button>
                    </div>
                </div>
            )}

            <div className="relative">
                <Button onClick={() => setShowCustomize(!showCustomize)} size="xs" variant="secondary" className="absolute top-0 right-0 -mt-3 text-[10px] px-2 py-0.5 z-10">Customize</Button>
                {showCustomize && (
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs border dark:border-gray-700">
                        {Object.keys(visibleWidgets).map(key => (
                          <label key={key} className="flex items-center space-x-2 cursor-pointer select-none">
                            <input type="checkbox" checked={visibleWidgets[key as keyof typeof visibleWidgets]} onChange={() => toggleWidget(key as keyof typeof visibleWidgets)} className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"/>
                            <span className="capitalize text-gray-700 dark:text-gray-300">{key.replace(/([A-Z])/g, ' $1')}</span>
                          </label>
                        ))}
                    </div>
                )}
                <div className={isCompact ? "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"}>
                    {visibleWidgets.balance && <StatCard title="Available Balance" value={formatCurrency(currentUser.walletBalance, currentUser.currency)} icon={<WalletIcon />} color="bg-blue-500" />}
                    {visibleWidgets.deposits && <StatCard title="Total Deposits" value={formatCurrency(stats.totalDeposits, currentUser.currency)} icon={<DepositIcon />} color="bg-sky-500" />}
                    {visibleWidgets.commission && <StatCard title="Total Commission" value={formatCurrency(stats.totalCommission, currentUser.currency)} icon={<EarningsIcon />} color="bg-green-500" />}
                    {visibleWidgets.withdrawals && <StatCard title="Total Withdrawals" value={formatCurrency(stats.totalWithdrawals, currentUser.currency)} icon={<WithdrawalIcon />} color="bg-red-500" />}
                    {visibleWidgets.pending && <StatCard title="Pending Commission" value={formatCurrency(stats.pendingCommission, currentUser.currency)} icon={<ClockIcon />} color="bg-yellow-500" />}
                    {visibleWidgets.taskEarnings && (
                        isCompact ? (
                            <div 
                                onClick={() => navigate('/member/user-tasks')}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-emerald-100 dark:border-emerald-950/30 p-2.5 sm:p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all group col-span-1"
                            >
                                <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">Earn Cash & Gigs</p>
                                    <p className="text-base md:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">{formatCurrency(stats.totalTaskEarnings, currentUser.currency)}</p>
                                    <span className="text-[9px] md:text-[10px] font-bold text-indigo-500 group-hover:text-indigo-600 transition-colors mt-0.5 inline-flex items-center gap-0.5">
                                        Earning Hub ➜
                                    </span>
                                </div>
                                <div className="text-white p-1.5 md:p-2 rounded-lg bg-emerald-500 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                    <EarningsIcon className="w-4 h-4 md:w-5 md:h-5" />
                                </div>
                            </div>
                        ) : (
                            <div 
                                onClick={() => navigate('/member/user-tasks')}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-950/30 p-6 flex items-center justify-between gap-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all group col-span-1"
                            >
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">Earn Cash & Gigs</p>
                                    <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 truncate">{formatCurrency(stats.totalTaskEarnings, currentUser.currency)}</p>
                                    <span className="text-xs font-bold text-indigo-500 group-hover:text-indigo-600 transition-colors mt-2 inline-flex items-center gap-1">
                                        Go to Earning Hub ➜
                                    </span>
                                </div>
                                <div className="text-white p-3.5 rounded-xl bg-emerald-500 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                    <EarningsIcon className="w-6 h-6" />
                                </div>
                            </div>
                        )
                    )}
                    {visibleWidgets.referrals && <NetworkSummaryCard />}
                    {visibleWidgets.plan && <StatCard title="Active Plan(s)" value={stats.activePlanCount} icon={<PlanIcon />} color="bg-indigo-500" />}
                    {visibleWidgets.monthly && <StatCard title="Earnings This Month" value={formatCurrency(stats.monthlyEarnings, currentUser.currency)} icon={<EarningsIcon />} color="bg-teal-500" />}
                    {visibleWidgets.plan && <StatCard title="Active Plans Value" value={formatCurrency(stats.activePlanValue, currentUser.currency)} icon={<PlanIcon />} color="bg-pink-500" />}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ShareButtons url={referralLink} title="Join me on SmartEarning and start earning today!" />
                 {visibleWidgets.breakdown && <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700/50 hover:shadow-md hover:scale-[1.01] transition-all duration-300">
                    <h3 className="font-semibold mb-2 text-gray-800 dark:text-white text-center text-xs uppercase tracking-wider text-gray-400">Earnings & Commissions Breakdown</h3>
                    <PieChart currency={currentUser.currency} data={[
                        { label: 'Direct Commission', value: stats.directCommission, color: '#3b82f6' },
                        { label: 'Indirect Commission', value: stats.indirectCommission, color: '#8b5cf6' },
                        { label: 'Gigs / Tasks', value: stats.totalTaskEarnings, color: '#10b981' },
                    ]} />
                </div>}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700/50">
                <h2 className="text-base font-semibold mb-3 text-gray-800 dark:text-white">Recent Transactions</h2>
                <Table headers={['ID', 'Type', 'Amount', 'Status', 'Date', 'Description']}>
                    {recentTransactions.map((tx: Transaction) => (
                         <tr key={tx._id} className="text-gray-700 dark:text-gray-400">
                            <td className="px-3 py-2 text-xs">{tx._id.substring(0, 8)}...</td>
                            <td className="px-3 py-2 text-xs">{tx.type}</td>
                            <td className={`px-3 py-2 text-xs font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount, tx.currency)}</td>
                            <td className="px-3 py-2 text-xs">
                                {/* MASKING: Show 'Matching' as 'Pending' to user */}
                                <Badge status={(tx.status as Status === Status.Matching) ? Status.Pending : (tx.status as Status || Status.Approved)} />
                            </td>
                            <td className="px-3 py-2 text-xs">{tx.date}</td>
                            <td className="px-3 py-2 text-xs">{tx.description}</td>
                         </tr>
                    ))}
                </Table>
            </div>
        </div>
    );
};

export default UserDashboard;
