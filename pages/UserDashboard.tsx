
import React, { useState, useMemo, useCallback } from 'react';
import { Status, Transaction, User, Deposit, formatCurrency } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import ShareButtons from '../components/ui/ShareButtons';

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
    if (total === 0) return <div className="flex items-center justify-center h-full"><p className="text-sm text-gray-500">No commission data yet.</p></div>;
    
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
    const { currentUser, deposits, withdrawals, transactions, users, investmentPlans } = state;
    
    const [visibleWidgets, setVisibleWidgets] = useState({
      balance: true, deposits: true, commission: true, withdrawals: true,
      pending: true, referrals: true, plan: true, monthly: true, breakdown: true
    });
    const [showCustomize, setShowCustomize] = useState(false);

    if (!currentUser) return <div>Loading user data...</div>;

    const userTransactions = useMemo(() => transactions.filter(t => t.userId === currentUser._id), [transactions, currentUser._id]);

    const stats = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        // "Approved" commissions for dashboard counts should exclude "Held for Upgrade" ones if status is Approved but with Hold description.
        // Actually, normally 'Approved' means added to balance.
        const approvedCommissions = userTransactions.filter(t => t.type === 'Commission' && t.status === 'Approved' && !(t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold')));
        
        const totalCommission = userTransactions.filter(t => t.type === 'Commission' && (t.status === 'Approved' || t.status === 'Pending')).reduce((sum, t) => sum + t.amount, 0);
        const directCommission = userTransactions.filter(t => t.type === 'Commission' && (t.status === 'Approved' || t.status === 'Pending') && t.level === 1).reduce((sum, t) => sum + t.amount, 0);
        const indirectCommission = totalCommission - directCommission;

        const activePlanCount = (currentUser.activePlans || []).length;
        const activePlanValue = (currentUser.activePlans || []).reduce((sum, p) => sum + p.price, 0);

        return {
            totalDeposits: deposits.filter(d => d.userId === currentUser._id && d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0),
            totalWithdrawals: withdrawals.filter(w => w.userId === currentUser._id && w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0),
            totalCommission,
            directCommission,
            indirectCommission,
            pendingCommission: userTransactions.filter(t => t.type === 'Commission' && (t.status === 'Pending' || (t.status === 'Approved' && (t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold'))))).reduce((sum, t) => sum + t.amount, 0),
            monthlyEarnings: approvedCommissions.filter(t => t.date >= firstDayOfMonth).reduce((sum, t) => sum + t.amount, 0),
            activePlanCount,
            activePlanValue,
        };
    }, [userTransactions, deposits, withdrawals, investmentPlans, currentUser._id, currentUser.activePlans]);
    
    const networkBreakdown = useMemo(() => {
        const breakdown: { active: { [key: number]: number }, inactive: { [key: number]: number }, total: number } = {
            active: {},
            inactive: {},
            total: 0
        };

        const traverse = (sponsorUsername: string, level: number) => {
            const referrals = users.filter(u => u.sponsor === sponsorUsername);
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

    const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
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
                            {Object.keys(networkBreakdown.active).map(level => (
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
                            {Object.keys(networkBreakdown.inactive).map(level => (
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
                    {visibleWidgets.referrals && <NetworkSummaryCard />}
                    {visibleWidgets.plan && <StatCard title="Active Plan(s)" value={stats.activePlanCount} icon={<PlanIcon />} color="bg-indigo-500" />}
                    {visibleWidgets.monthly && <StatCard title="Earnings This Month" value={formatCurrency(stats.monthlyEarnings, currentUser.currency)} icon={<EarningsIcon />} color="bg-teal-500" />}
                    {visibleWidgets.plan && <StatCard title="Active Plans Value" value={formatCurrency(stats.activePlanValue, currentUser.currency)} icon={<PlanIcon />} color="bg-pink-500" />}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ShareButtons url={referralLink} title="Join me on SmartEarning and start earning today!" />
                 {visibleWidgets.breakdown && <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h3 className="font-semibold mb-3 text-gray-800 dark:text-white text-center">Referral Commission Breakdown</h3>
                    <PieChart currency={currentUser.currency} data={[
                        { label: 'Direct', value: stats.directCommission, color: '#3b82f6' },
                        { label: 'Indirect', value: stats.indirectCommission, color: '#8b5cf6' },
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
                            <td className="px-4 py-3 text-xs"><Badge status={tx.status as Status || Status.Approved} /></td>
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
