import React, { useMemo, useState } from 'react';
import { Deposit, Status, User, Withdrawal, Transaction, Transfer } from '../types';
import Badge from '../components/ui/Badge';
import { useData } from '../hooks/useData';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

const Dashboard: React.FC = () => {
    const { state } = useData();
    const { users, deposits, withdrawals, transactions, disputes, passwordResetRequests, transfers } = state;
    const navigate = useNavigate();

    const [timeframe, setTimeframe] = useState<'7d' | '30d'>('7d');

    // --- Statistics Calculation ---
    const stats = useMemo(() => {
        const totalUserBalance = users.reduce((sum, u) => sum + u.walletBalance, 0);
        
        const pendingDeposits = deposits.filter(d => d.status === Status.Pending);
        const pendingWithdrawals = withdrawals.filter(w => w.status === Status.Pending);
        const pendingDisputes = disputes.filter(d => d.status === Status.Open);
        const pendingPasswordResets = passwordResetRequests.filter(r => r.status === 'Pending');
        const pendingTransfers = transfers.filter(t => t.status === Status.Pending);
        
        const grossRevenue = deposits.filter(d => d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0);
        const totalPaidOut = withdrawals.filter(w => w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0);
        const netProfit = grossRevenue - totalPaidOut;

        const userStatusCounts = users.reduce((acc, user) => {
            acc[user.status] = (acc[user.status] || 0) + 1;
            return acc;
        }, {} as { [key in Status]?: number });

        const pieChartData = [
            { label: 'Active', value: userStatusCounts.Active || 0, color: '#22c55e' },
            { label: 'Blocked', value: userStatusCounts.Blocked || 0, color: '#ef4444' },
            { label: 'Paused', value: userStatusCounts.Paused || 0, color: '#f97316' },
            { label: 'Pending', value: userStatusCounts.Pending || 0, color: '#eab308' }
        ].filter(d => d.value > 0);

        const days = timeframe === '7d' ? 7 : 30;
        const dateArray = Array.from({ length: days }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const chartData = dateArray.map(dateStr => {
            const dayDeposits = deposits
                .filter(d => d.status === Status.Approved && d.date.startsWith(dateStr))
                .reduce((sum, d) => sum + d.amount, 0);
            
            const dayWithdrawals = withdrawals
                .filter(w => w.status === Status.Paid && w.date.startsWith(dateStr))
                .reduce((sum, w) => sum + w.amount, 0);

            return { date: dateStr, deposit: dayDeposits, withdrawal: dayWithdrawals, net: dayDeposits - dayWithdrawals };
        });

        return {
            totalUsers: users.length,
            totalUserBalance,
            pendingDeposits,
            pendingWithdrawals,
            pendingDisputes,
            pendingPasswordResets,
            pendingTransfers,
            grossRevenue,
            totalPaidOut,
            netProfit,
            chartData,
            pieChartData,
        };
    }, [users, deposits, withdrawals, disputes, passwordResetRequests, transfers, timeframe]);

    const recentActivity = useMemo(() => {
        const userActivities = users.map(user => ({
            type: 'New User',
            id: user._id,
            date: new Date(user.registrationDate),
            title: user.fullName,
            subtitle: `@${user.username}`,
            amount: null
        }));

        const transactionActivities = transactions.map(tx => ({
            type: tx.type,
            id: tx._id,
            date: new Date(tx.date),
            title: tx.userName,
            subtitle: tx.description,
            amount: tx.amount
        }));

        const allActivities = [...userActivities, ...transactionActivities];
        allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
        return allActivities.slice(0, 15);
    }, [users, transactions]);

    const formatRelativeTime = (date: Date) => {
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const StatCard: React.FC<{ 
        title: string; 
        value: string | number; 
        icon: React.ReactNode; 
        colorClass: string;
        onClick?: () => void;
    }> = ({ title, value, icon, colorClass, onClick }) => (
        <div 
            onClick={onClick}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-3xl font-extrabold text-gray-800 dark:text-white mt-2">{value}</h3>
            </div>
            <div className={`p-3 rounded-full ${colorClass} text-white shadow-md`}>
                {icon}
            </div>
        </div>
    );

    const FinancialChart = ({ data }: { data: { date: string, deposit: number, withdrawal: number, net: number }[] }) => {
        const maxBarValue = Math.max(...data.map(d => Math.max(d.deposit, d.withdrawal)), 100);
        const maxNetValue = Math.max(...data.map(d => Math.abs(d.net)), maxBarValue * 0.5);
        
        return (
            <div className="h-80 flex flex-col">
                <div className="flex-grow flex items-end justify-between gap-2 px-4 border-l border-b border-gray-200 dark:border-gray-700 relative">
                    <div className="absolute left-0 top-0 bottom-0 -ml-4 flex flex-col justify-between text-xs text-gray-400 py-2">
                        <span>${maxBarValue.toLocaleString()}</span>
                        <span>$0</span>
                    </div>
                    {data.map((d, i) => {
                        const dateLabel = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const depHeight = (d.deposit / maxBarValue) * 100;
                        const withHeight = (d.withdrawal / maxBarValue) * 100;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center group relative h-full">
                                <div className="w-full flex gap-1.5 items-end h-full">
                                    <div style={{ height: `${depHeight}%` }} className="flex-1 bg-green-500/60 dark:bg-green-500/40 rounded-t-md hover:bg-green-500 transition-all"></div>
                                    <div style={{ height: `${withHeight}%` }} className="flex-1 bg-red-500/60 dark:bg-red-500/40 rounded-t-md hover:bg-red-500 transition-all"></div>
                                </div>
                                <span className="text-xs text-gray-500 mt-2 absolute -bottom-5">{dateLabel}</span>
                                <div className="absolute bottom-full mb-3 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg py-2 px-3 z-10 whitespace-nowrap shadow-xl transition-opacity">
                                    <p className="font-bold">{dateLabel}</p>
                                    <div className="text-green-300 mt-1">Deposits: ${d.deposit.toLocaleString()}</div>
                                    <div className="text-red-300">Withdrawals: ${d.withdrawal.toLocaleString()}</div>
                                    <div className="text-blue-300 font-semibold mt-1 pt-1 border-t border-gray-700">Net: ${d.net.toLocaleString()}</div>
                                </div>
                            </div>
                        )
                    })}
                    <svg className="absolute inset-0 w-full h-full overflow-visible">
                        <path 
                            d={data.map((d, i) => {
                                const x = (i + 0.5) * (100 / data.length);
                                const y = 50 - (d.net / maxNetValue) * 50;
                                return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                            }).join(' ')}
                            fill="none"
                            stroke="rgba(59, 130, 246, 0.8)"
                            strokeWidth="2"
                        />
                        {data.map((d, i) => {
                            const x = (i + 0.5) * (100 / data.length);
                            const y = 50 - (d.net / maxNetValue) * 50;
                            return <circle key={i} cx={`${x}%`} cy={`${y}%`} r="3" fill="rgba(59, 130, 246, 1)" />;
                        })}
                    </svg>
                </div>
            </div>
        )
    };
    
    const PieChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return <div className="flex items-center justify-center h-full"><p className="text-sm text-gray-500">No user data.</p></div>;
        
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
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4">
                <svg viewBox="0 0 100 100" className="w-32 h-32 transform -rotate-90">
                    {segments.map((segment) => (
                        <circle
                            key={segment.label}
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
                <div className="text-sm space-y-2">
                    {data.map(item => (
                        <div key={item.label} className="flex items-center">
                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                            <span>{item.label}:</span>
                            <span className="font-semibold ml-1">{item.value} users ({((item.value/total)*100).toFixed(1)}%)</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const ActivityIcon = ({ type }: { type: string }) => {
        const iconClass = "w-5 h-5";
        switch (type) {
            case 'New User': return <UsersIcon className={iconClass} />;
            case 'Deposit': case 'Manual Credit': return <DepositIcon className={iconClass} />;
            case 'Withdrawal': case 'Withdrawal Request': case 'Manual Debit': return <WithdrawalIcon className={iconClass} />;
            case 'Commission': return <EarningsIcon className={iconClass} />;
            case 'Transfer Sent': case 'Transfer Received': case 'Transfer Request': return <TransferIcon className={iconClass} />;
            case 'Plan Purchase': return <PlanIcon className={iconClass} />;
            default: return <WalletIcon className={iconClass} />;
        }
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
                <StatCard title="Total Users" value={stats.totalUsers} icon={<UsersIcon />} colorClass="bg-blue-500" onClick={() => navigate('/admin/users')} />
                <StatCard title="Net Profit" value={`$${stats.netProfit.toLocaleString()}`} icon={<WalletIcon />} colorClass="bg-teal-500" />
                <StatCard title="Pending Deposits" value={stats.pendingDeposits.length} icon={<DepositIcon />} colorClass="bg-green-500" onClick={() => navigate('/admin/deposits')} />
                <StatCard title="Pending Withdrawals" value={stats.pendingWithdrawals.length} icon={<WithdrawalIcon />} colorClass="bg-orange-500" onClick={() => navigate('/admin/withdrawals')} />
                <StatCard title="Open Disputes" value={stats.pendingDisputes.length} icon={<DisputeIcon />} colorClass="bg-red-500" onClick={() => navigate('/admin/disputes')} />
                <StatCard title="Password Resets" value={stats.pendingPasswordResets.length} icon={<PasswordResetIcon />} colorClass="bg-purple-500" onClick={() => navigate('/admin/password-resets')} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Financial Flow</h3>
                                <p className="text-xs text-gray-500">Deposits vs. Withdrawals & Net Daily Profit/Loss</p>
                            </div>
                            <div className="flex mt-3 sm:mt-0 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                                <button onClick={() => setTimeframe('7d')} className={`px-3 py-1 text-xs rounded-md ${timeframe === '7d' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Last 7 Days</button>
                                <button onClick={() => setTimeframe('30d')} className={`px-3 py-1 text-xs rounded-md ${timeframe === '30d' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Last 30 Days</button>
                            </div>
                        </div>
                        <FinancialChart data={stats.chartData} />
                         <div className="flex space-x-4 text-xs justify-center mt-6 border-t dark:border-gray-700 pt-3">
                            <span className="flex items-center"><span className="w-3 h-3 bg-green-500/80 rounded-full mr-2"></span>Deposits</span>
                            <span className="flex items-center"><span className="w-3 h-3 bg-red-500/80 rounded-full mr-2"></span>Withdrawals</span>
                            <span className="flex items-center"><span className="w-2 h-0.5 bg-blue-500 mr-2"></span>Net Daily Flow</span>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-1 space-y-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Quick Shortcuts</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="secondary" onClick={() => navigate('/admin/users')}>+ Add User</Button>
                            <Button variant="secondary" onClick={() => navigate('/admin/investment-plans')}>+ New Plan</Button>
                            <Button variant="secondary" onClick={() => navigate('/admin/wallet')}>Adjust Wallet</Button>
                            <Button variant="secondary" onClick={() => navigate('/admin/users')}>Send Message</Button>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">User Status Overview</h3>
                        <PieChart data={stats.pieChartData} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Action Hub</h3>
                    <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                        {[
                            ...stats.pendingDeposits.map(d => ({ type: 'Deposit', data: d, date: d.date, link: '/admin/deposits' })),
                            ...stats.pendingWithdrawals.map(w => ({ type: 'Withdrawal', data: w, date: w.date, link: '/admin/withdrawals' })),
                            ...stats.pendingTransfers.map(t => ({ type: 'Transfer', data: t, date: t.date, link: '/admin/transfers' })),
                            ...stats.pendingDisputes.map(d => ({ type: 'Dispute', data: d, date: d.date, link: '/admin/disputes' })),
                            ...stats.pendingPasswordResets.map(p => ({ type: 'Password Reset', data: p, date: p.requestDate, link: '/admin/password-resets' }))
                        ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item, index) => (
                            <div key={`${item.type}-${item.data._id}-${index}`} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <div>
                                    <span className={`text-xs font-bold ${
                                        item.type === 'Deposit' ? 'text-green-500' : 
                                        item.type === 'Withdrawal' ? 'text-orange-500' : 
                                        item.type === 'Dispute' ? 'text-red-500' : 
                                        item.type === 'Transfer' ? 'text-cyan-500' :
                                        'text-purple-500'}`}>{item.type}</span>
                                    <p>
                                        {item.type === 'Transfer'
                                            ? `${(item.data as any).senderName} → ${(item.data as any).recipientName}`
                                            : (item.data as any).userName
                                        }
                                        {item.type !== 'Password Reset' && (
                                            <span className="font-medium"> - ${(item.data as any).amount?.toFixed(2)}</span>
                                        )}
                                    </p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => navigate(item.link)}>Review</Button>
                            </div>
                        ))}
                        {stats.pendingDeposits.length + stats.pendingWithdrawals.length + stats.pendingDisputes.length + stats.pendingPasswordResets.length + stats.pendingTransfers.length === 0 &&
                           <p className="text-sm text-gray-400 text-center py-8">No pending actions.</p>}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Recent System Activity</h3>
                    <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                        {recentActivity.map((activity) => (
                            <div key={activity.id} className="flex items-center space-x-3">
                                <div className={`p-2 rounded-full ${activity.type === 'New User' ? 'bg-blue-100 dark:bg-blue-900/50' : activity.amount > 0 ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                                    <ActivityIcon type={activity.type} />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm font-medium text-gray-800 dark:text-white">{activity.title}</p>
                                    <p className="text-xs text-gray-500 truncate" title={activity.subtitle}>{activity.subtitle}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    {activity.amount !== null && (
                                        <p className={`text-sm font-semibold ${activity.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {activity.amount > 0 ? '+' : ''}${activity.amount.toFixed(2)}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-400">{formatRelativeTime(activity.date)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Icons (modified to accept className)
const UsersIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const DepositIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
const WithdrawalIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>;
const WalletIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg>;
const DisputeIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>;
const PasswordResetIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>;
const EarningsIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg>;
const TransferIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>;
const PlanIcon = ({ className = 'w-6 h-6' }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;


export default Dashboard;