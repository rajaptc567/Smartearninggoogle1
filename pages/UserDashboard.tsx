
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
const WalletIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const DepositIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const WithdrawalIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const UsersIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z"></path></svg>;
const EarningsIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg>;
const ClockIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const PlanIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
const MapPinIcon = () => <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

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


const CompactStatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; onClick?: () => void }> = ({ title, value, icon, color, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50 p-3 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all h-full ${onClick ? 'cursor-pointer hover:scale-[1.02] border-emerald-200 dark:border-emerald-800/30' : ''}`}
    >
        <div className={`text-white p-2 rounded-full ${color} mb-1.5 flex items-center justify-center scale-90`}>{icon}</div>
        <p className="text-[10px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-tight leading-none text-center">{title}</p>
        <p className="text-sm sm:text-base font-extrabold text-gray-800 dark:text-white mt-1 leading-none text-center">{value}</p>
    </div>
);


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
    
    const toggleWidget = (widget: keyof typeof visibleWidgets) => {
      setVisibleWidgets(prev => ({ ...prev, [widget]: !prev[widget] }));
    };

    const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 flex items-center justify-between">
            <div><p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p><p className="text-2xl font-semibold text-gray-800 dark:text-white">{value}</p></div>
            <div className={`text-white p-3 rounded-full ${color}`}>{icon}</div>
        </div>
    );
    
    const NetworkSummaryCard = () => {
        const totalActive = Object.values(networkBreakdown.active).reduce((s: number, c: number) => s + c, 0);
        const totalInactive = Object.values(networkBreakdown.inactive).reduce((s: number, c: number) => s + c, 0);

        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Network Overview</p>
                        <p className="text-2xl font-semibold text-gray-800 dark:text-white">{networkBreakdown.total} Total Referrals</p>
                    </div>
                    <div className="text-white p-3 rounded-full bg-purple-500"><UsersIcon /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4 border-t dark:border-gray-700 pt-4">
                    <div>
                        <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Active Referrals ({totalActive})</h4>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                            {Object.keys(networkBreakdown.active).sort((a,b) => Number(a) - Number(b)).map(level => (
                                <li key={`active-${level}`} className="flex justify-between">
                                    <span>Level {level}:</span>
                                    <span className="font-bold">{networkBreakdown.active[parseInt(level)]}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-500 dark:text-red-400 mb-2">Inactive Referrals ({totalInactive})</h4>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                            {Object.keys(networkBreakdown.inactive).sort((a,b) => Number(a) - Number(b)).map(level => (
                                <li key={`inactive-${level}`} className="flex justify-between">
                                    <span>Level {level}:</span>
                                    <span className="font-bold">{networkBreakdown.inactive[parseInt(level)]}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        );
    };

    const isCompact = settings?.userDashboardVersion !== 'old';

    if (isCompact) {
        const totalActive = Object.values(networkBreakdown.active).reduce((s: number, c: number) => s + c, 0);
        const totalInactive = Object.values(networkBreakdown.inactive).reduce((s: number, c: number) => s + c, 0);

        return (
            <div className="flex flex-col items-center justify-center max-w-4xl mx-auto space-y-4 px-1 py-2 sm:p-4 text-center">
                {/* Centered Top Section */}
                <div className="flex flex-col items-center text-center space-y-1">
                    {currentUser.country && (
                        <div className="inline-flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-[11px] font-bold text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700 shadow-sm mb-1">
                            <MapPinIcon />
                            <span>{currentUser.country}</span>
                        </div>
                    )}
                    <h1 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white leading-tight">
                        Welcome, {currentUser.fullName}!
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md">
                        Your account activities and wallet balances are compiled below. Click the Earning button to start!
                    </p>
                </div>

                {/* Highly Attractive Top Earning Area Button */}
                <div className="w-full max-w-md bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 rounded-xl p-3 text-white text-center shadow-md shadow-emerald-500/10 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 border border-emerald-400/20">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-100">🚀 INSTANT PAYOUTS</p>
                    <h2 className="text-sm sm:text-base font-extrabold mt-0.5 mb-2">💸 SmartEarning Instant Gigs Hub</h2>
                    <Button 
                        onClick={() => navigate('/member/user-tasks')}
                        size="sm"
                        className="bg-white hover:bg-emerald-50 text-emerald-700 font-extrabold text-xs px-5 py-2 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-1.5 border-none"
                    >
                        <span>Click to Earn Cash Now ➜</span>
                    </Button>
                </div>

                {/* Compact Layout Customizer Toggle */}
                <div className="w-full flex justify-center">
                    <button 
                        onClick={() => setShowCustomize(!showCustomize)} 
                        className="px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 shadow-sm transition-all"
                    >
                        {showCustomize ? 'Hide Customizer' : 'Customize Cards'}
                    </button>
                </div>
                {showCustomize && (
                    <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border dark:border-gray-700 w-full max-w-md grid grid-cols-2 gap-1.5 text-[11px] text-left shadow-xs">
                        {Object.keys(visibleWidgets).map(key => (
                          <label key={key} className="flex items-center space-x-1.5 cursor-pointer p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <input 
                                type="checkbox" 
                                checked={visibleWidgets[key as keyof typeof visibleWidgets]} 
                                onChange={() => toggleWidget(key as keyof typeof visibleWidgets)} 
                                className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3"
                            />
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          </label>
                        ))}
                    </div>
                )}

                {/* Grid of Compact Centered Stat Cards (2-columns on mobile, 3-4 on desktop) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5 w-full">
                    {visibleWidgets.balance && <CompactStatCard title="Available Balance" value={formatCurrency(currentUser.walletBalance, currentUser.currency)} icon={<WalletIcon />} color="bg-blue-500" />}
                    {visibleWidgets.deposits && <CompactStatCard title="Total Deposits" value={formatCurrency(stats.totalDeposits, currentUser.currency)} icon={<DepositIcon />} color="bg-sky-500" />}
                    {visibleWidgets.commission && <CompactStatCard title="Total Commission" value={formatCurrency(stats.totalCommission, currentUser.currency)} icon={<EarningsIcon />} color="bg-green-500" />}
                    {visibleWidgets.withdrawals && <CompactStatCard title="Total Withdrawals" value={formatCurrency(stats.totalWithdrawals, currentUser.currency)} icon={<WithdrawalIcon />} color="bg-red-500" />}
                    {visibleWidgets.pending && <CompactStatCard title="Pending Commission" value={formatCurrency(stats.pendingCommission, currentUser.currency)} icon={<ClockIcon />} color="bg-yellow-500" />}
                    {visibleWidgets.taskEarnings && (
                        <CompactStatCard 
                            title="Instant Gigs Reward" 
                            value={formatCurrency(stats.totalTaskEarnings, currentUser.currency)} 
                            icon={<EarningsIcon />} 
                            color="bg-emerald-500" 
                            onClick={() => navigate('/member/user-tasks')}
                        />
                    )}
                    {visibleWidgets.plan && <CompactStatCard title="Active Plans" value={stats.activePlanCount} icon={<PlanIcon />} color="bg-indigo-500" />}
                    {visibleWidgets.monthly && <CompactStatCard title="This Month" value={formatCurrency(stats.monthlyEarnings, currentUser.currency)} icon={<EarningsIcon />} color="bg-teal-500" />}
                    {visibleWidgets.plan && <CompactStatCard title="Plans Value" value={formatCurrency(stats.activePlanValue, currentUser.currency)} icon={<PlanIcon />} color="bg-pink-500" />}
                </div>

                {/* Compact Centered Network Card */}
                {visibleWidgets.referrals && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50 p-2.5 shadow-sm w-full max-w-sm mx-auto text-center flex flex-col items-center justify-center">
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-white p-1 rounded-full bg-purple-500 mb-1 flex items-center justify-center scale-95"><UsersIcon /></div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-none">Network Overview</p>
                            <p className="text-sm font-black text-gray-800 dark:text-white mt-1 leading-none">{networkBreakdown.total} Total Referrals</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full text-xs border-t border-gray-100 dark:border-gray-700 pt-2.5 mt-2.5">
                            <div className="flex flex-col items-center border-r border-gray-100 dark:border-gray-700/50">
                                <h4 className="font-bold text-green-600 dark:text-green-400 mb-1">Active ({totalActive})</h4>
                                <ul className="space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                    {Object.keys(networkBreakdown.active).sort((a,b) => Number(a) - Number(b)).map(level => (
                                        <li key={`active-${level}`} className="flex gap-1 justify-center">
                                            <span>L{level}:</span>
                                            <span className="font-extrabold">{networkBreakdown.active[parseInt(level)]}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex flex-col items-center">
                                <h4 className="font-bold text-red-500 dark:text-red-400 mb-1">Inactive ({totalInactive})</h4>
                                <ul className="space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                    {Object.keys(networkBreakdown.inactive).sort((a,b) => Number(a) - Number(b)).map(level => (
                                        <li key={`inactive-${level}`} className="flex gap-1 justify-center">
                                            <span>L{level}:</span>
                                            <span className="font-extrabold">{networkBreakdown.inactive[parseInt(level)]}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Referral and Breakdown Pie Chart */}
                <div className="w-full flex flex-col items-center space-y-2">
                    <div className="w-full max-w-sm mx-auto scale-95 origin-center">
                        <ShareButtons url={referralLink} title="Join me on SmartEarning and start earning today!" />
                    </div>
                    {visibleWidgets.breakdown && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50 p-3 w-full max-w-sm mx-auto text-center shadow-xs">
                            <h3 className="font-semibold mb-1 text-gray-800 dark:text-white text-[11px] sm:text-xs uppercase tracking-wider text-center">Earnings Breakdown</h3>
                            <div className="scale-85 origin-center">
                                <PieChart currency={currentUser.currency} data={[
                                    { label: 'Direct', value: stats.directCommission, color: '#3b82f6' },
                                    { label: 'Indirect', value: stats.indirectCommission, color: '#8b5cf6' },
                                    { label: 'Gigs / Tasks', value: stats.totalTaskEarnings, color: '#10b981' },
                                ]} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Centered Recent Transactions Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50 p-2.5 sm:p-3 w-full text-center">
                    <h2 className="text-xs sm:text-sm font-extrabold mb-2 text-gray-800 dark:text-white text-center uppercase tracking-wider">Recent Transactions</h2>
                    <div className="overflow-x-auto w-full rounded-lg border border-gray-100 dark:border-gray-700 text-left">
                        <Table headers={['ID', 'Type', 'Amount', 'Status', 'Date', 'Description']}>
                            {recentTransactions.map((tx: Transaction) => (
                                 <tr key={tx._id} className="text-gray-700 dark:text-gray-400 text-[11px] hover:bg-gray-50/50 dark:hover:bg-gray-700/10 border-b dark:border-gray-700/40">
                                    <td className="px-2 py-1.5">{tx._id.substring(0, 5)}...</td>
                                    <td className="px-2 py-1.5 font-semibold">{tx.type}</td>
                                    <td className={`px-2 py-1.5 font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount, tx.currency)}</td>
                                    <td className="px-2 py-1.5">
                                        <Badge status={(tx.status as Status === Status.Matching) ? Status.Pending : (tx.status as Status || Status.Approved)} />
                                    </td>
                                    <td className="px-2 py-1.5 text-[9px] opacity-75">{tx.date}</td>
                                    <td className="px-2 py-1.5 text-[10px] truncate max-w-[100px]" title={tx.description}>{tx.description}</td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Welcome, {currentUser.fullName}!</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Here's a summary of your account activity.</p>
                </div>
                {currentUser.country && (
                    <div className="hidden sm:flex items-center space-x-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full text-sm font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <MapPinIcon />
                        <span>{currentUser.country}</span>
                    </div>
                )}
            </div>

            <div className="relative">
                <Button onClick={() => setShowCustomize(!showCustomize)} size="sm" variant="secondary" className="absolute top-0 right-0 -mt-8">Customize</Button>
                {showCustomize && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-sm">
                        {Object.keys(visibleWidgets).map(key => (
                          <label key={key} className="flex items-center space-x-2">
                            <input type="checkbox" checked={visibleWidgets[key as keyof typeof visibleWidgets]} onChange={() => toggleWidget(key as keyof typeof visibleWidgets)} className="rounded"/>
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          </label>
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {visibleWidgets.balance && <StatCard title="Available Balance" value={formatCurrency(currentUser.walletBalance, currentUser.currency)} icon={<WalletIcon />} color="bg-blue-500" />}
                    {visibleWidgets.deposits && <StatCard title="Total Deposits" value={formatCurrency(stats.totalDeposits, currentUser.currency)} icon={<DepositIcon />} color="bg-sky-500" />}
                    {visibleWidgets.commission && <StatCard title="Total Commission" value={formatCurrency(stats.totalCommission, currentUser.currency)} icon={<EarningsIcon />} color="bg-green-500" />}
                    {visibleWidgets.withdrawals && <StatCard title="Total Withdrawals" value={formatCurrency(stats.totalWithdrawals, currentUser.currency)} icon={<WithdrawalIcon />} color="bg-red-500" />}
                    {visibleWidgets.pending && <StatCard title="Pending Commission" value={formatCurrency(stats.pendingCommission, currentUser.currency)} icon={<ClockIcon />} color="bg-yellow-500" />}
                    {visibleWidgets.taskEarnings && (
                        <div 
                            onClick={() => navigate('/member/user-tasks')}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 flex items-center justify-between cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all border border-emerald-100 dark:border-emerald-950/30 group"
                        >
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Earn Cash & Gigs Earnings</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.totalTaskEarnings, currentUser.currency)}</p>
                                <span className="text-[10px] font-bold text-indigo-500 group-hover:text-indigo-600 transition-colors mt-1 inline-flex items-center gap-1">
                                    Go to Earning Hub ➜
                                </span>
                            </div>
                            <div className="text-white p-3 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                                <EarningsIcon />
                            </div>
                        </div>
                    )}
                    {visibleWidgets.referrals && <NetworkSummaryCard />}
                    {visibleWidgets.plan && <StatCard title="Active Plan(s)" value={stats.activePlanCount} icon={<PlanIcon />} color="bg-indigo-500" />}
                    {visibleWidgets.monthly && <StatCard title="Earnings This Month" value={formatCurrency(stats.monthlyEarnings, currentUser.currency)} icon={<EarningsIcon />} color="bg-teal-500" />}
                    {visibleWidgets.plan && <StatCard title="Active Plans Value" value={formatCurrency(stats.activePlanValue, currentUser.currency)} icon={<PlanIcon />} color="bg-pink-500" />}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ShareButtons url={referralLink} title="Join me on SmartEarning and start earning today!" />
                 {visibleWidgets.breakdown && <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700/50 hover:shadow-lg hover:scale-[1.01] transition-all duration-300">
                    <h3 className="font-semibold mb-3 text-gray-800 dark:text-white text-center">Earnings & Commissions Breakdown</h3>
                    <PieChart currency={currentUser.currency} data={[
                        { label: 'Direct Commission', value: stats.directCommission, color: '#3b82f6' },
                        { label: 'Indirect Commission', value: stats.indirectCommission, color: '#8b5cf6' },
                        { label: 'Gigs / Tasks', value: stats.totalTaskEarnings, color: '#10b981' },
                    ]} />
                </div>}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Recent Transactions</h2>
                <Table headers={['ID', 'Type', 'Amount', 'Status', 'Date', 'Description']}>
                    {recentTransactions.map((tx: Transaction) => (
                         <tr key={tx._id} className="text-gray-700 dark:text-gray-400">
                            <td className="px-4 py-3 text-sm">{tx._id.substring(0, 8)}...</td>
                            <td className="px-4 py-3 text-sm">{tx.type}</td>
                            <td className={`px-4 py-3 text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount, tx.currency)}</td>
                            <td className="px-4 py-3 text-xs">
                                {/* MASKING: Show 'Matching' as 'Pending' to user */}
                                <Badge status={(tx.status as Status === Status.Matching) ? Status.Pending : (tx.status as Status || Status.Approved)} />
                            </td>
                            <td className="px-4 py-3 text-sm">{tx.date}</td>
                            <td className="px-4 py-3 text-sm">{tx.description}</td>
                        </tr>
                    ))}
                </Table>
            </div>
        </div>
    );
};

export default UserDashboard;
