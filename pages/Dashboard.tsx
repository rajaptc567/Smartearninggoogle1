
import React, { useMemo } from 'react';
import { Deposit, Status, User, Withdrawal, Transaction } from '../types';
import Badge from '../components/ui/Badge';
import { useData } from '../hooks/useData';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const { state } = useData();
    const { users, deposits, withdrawals, transactions } = state;
    const navigate = useNavigate();

    // --- Statistics Calculation ---
    const stats = useMemo(() => {
        const totalUserBalance = users.reduce((sum, u) => sum + u.walletBalance, 0);
        
        const pendingDeposits = deposits.filter(d => d.status === Status.Pending);
        const pendingWithdrawals = withdrawals.filter(w => w.status === Status.Pending);
        
        const totalDepositsApproved = deposits.filter(d => d.status === Status.Approved).reduce((sum, d) => sum + d.amount, 0);
        const totalWithdrawalsPaid = withdrawals.filter(w => w.status === Status.Paid).reduce((sum, w) => sum + w.finalAmount, 0);

        // Calculate daily volume for the last 7 days for the chart
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0]; // YYYY-MM-DD
        }).reverse();

        const chartData = last7Days.map(dateStr => {
            const dayDeposits = deposits
                .filter(d => d.status === Status.Approved && d.date.startsWith(dateStr))
                .reduce((sum, d) => sum + d.amount, 0);
            
            const dayWithdrawals = withdrawals
                .filter(w => w.status === Status.Paid && w.date.startsWith(dateStr))
                .reduce((sum, w) => sum + w.amount, 0);

            return { date: dateStr, deposit: dayDeposits, withdrawal: dayWithdrawals };
        });

        return {
            totalUsers: users.length,
            totalUserBalance,
            pendingDepositsCount: pendingDeposits.length,
            pendingDepositsAmount: pendingDeposits.reduce((sum, d) => sum + d.amount, 0),
            pendingWithdrawalsCount: pendingWithdrawals.length,
            pendingWithdrawalsAmount: pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0),
            totalDepositsApproved,
            totalWithdrawalsPaid,
            chartData
        };
    }, [users, deposits, withdrawals]);

    const recentActivity = useMemo(() => {
        // Combine transactions and user registrations into a single feed
        const combined = [
            ...transactions.map(t => ({ ...t, entityType: 'transaction', sortDate: t.date })),
            ...users.slice(-5).map(u => ({ ...u, entityType: 'user', sortDate: u.registrationDate }))
        ];
        return combined.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()).slice(0, 8);
    }, [transactions, users]);

    const recentMembers = users.slice().sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()).slice(0, 5);

    // --- Components ---

    const StatCard: React.FC<{ 
        title: string; 
        value: string | number; 
        subValue?: string;
        icon: React.ReactNode; 
        colorClass: string;
        onClick?: () => void;
    }> = ({ title, value, subValue, icon, colorClass, onClick }) => (
        <div 
            onClick={onClick}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex items-start justify-between transition-transform hover:-translate-y-1 hover:shadow-md cursor-pointer`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</h3>
                {subValue && <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-lg ${colorClass} text-white shadow-sm`}>
                {icon}
            </div>
        </div>
    );

    const SimpleBarChart = ({ data }: { data: { date: string, deposit: number, withdrawal: number }[] }) => {
        const maxVal = Math.max(...data.map(d => Math.max(d.deposit, d.withdrawal)), 100); // Min max 100 to avoid div by zero
        
        return (
            <div className="h-64 flex items-end justify-between gap-2 mt-4">
                {data.map((d, i) => {
                    const dateLabel = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
                    const depHeight = (d.deposit / maxVal) * 100;
                    const withHeight = (d.withdrawal / maxVal) * 100;
                    
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 z-10 whitespace-nowrap">
                                <div className="text-green-300">In: ${d.deposit.toFixed(0)}</div>
                                <div className="text-red-300">Out: ${d.withdrawal.toFixed(0)}</div>
                            </div>
                            
                            <div className="w-full flex gap-1 items-end h-full px-1">
                                <div style={{ height: `${depHeight}%` }} className="flex-1 bg-green-500 rounded-t-sm opacity-80 hover:opacity-100 transition-all"></div>
                                <div style={{ height: `${withHeight}%` }} className="flex-1 bg-red-500 rounded-t-sm opacity-80 hover:opacity-100 transition-all"></div>
                            </div>
                            <span className="text-xs text-gray-500 mt-2">{dateLabel}</span>
                        </div>
                    )
                })}
            </div>
        )
    };

    return (
        <div className="space-y-8">
            {/* Header Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Users" 
                    value={stats.totalUsers} 
                    subValue="Registered Members"
                    icon={<UsersIcon />} 
                    colorClass="bg-gradient-to-br from-blue-500 to-blue-600"
                    onClick={() => navigate('/admin/users')}
                />
                <StatCard 
                    title="Pending Deposits" 
                    value={stats.pendingDepositsCount} 
                    subValue={`Value: $${stats.pendingDepositsAmount.toFixed(2)}`}
                    icon={<DepositIcon />} 
                    colorClass="bg-gradient-to-br from-green-500 to-emerald-600"
                    onClick={() => navigate('/admin/deposits')}
                />
                <StatCard 
                    title="Pending Withdrawals" 
                    value={stats.pendingWithdrawalsCount} 
                    subValue={`Value: $${stats.pendingWithdrawalsAmount.toFixed(2)}`}
                    icon={<WithdrawalIcon />} 
                    colorClass="bg-gradient-to-br from-orange-500 to-red-600"
                    onClick={() => navigate('/admin/withdrawals')}
                />
                <StatCard 
                    title="System Liability" 
                    value={`$${stats.totalUserBalance.toFixed(2)}`} 
                    subValue="Total User Wallets"
                    icon={<WalletIcon />} 
                    colorClass="bg-gradient-to-br from-purple-500 to-indigo-600"
                    onClick={() => navigate('/admin/users')}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Charts & Activity */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Financial Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Financial Overview</h3>
                            <div className="flex space-x-4 text-sm">
                                <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>Deposits</span>
                                <span className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>Withdrawals</span>
                            </div>
                        </div>
                        <SimpleBarChart data={stats.chartData} />
                    </div>

                    {/* Recent Activity Feed */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Recent System Activity</h3>
                        </div>
                        <div className="divide-y dark:divide-gray-700">
                            {recentActivity.length > 0 ? (
                                recentActivity.map((item: any) => (
                                    <div key={item._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className={`p-2 rounded-full ${
                                                item.entityType === 'user' ? 'bg-blue-100 text-blue-600' :
                                                item.type === 'Deposit' ? 'bg-green-100 text-green-600' :
                                                item.type === 'Withdrawal' || item.type === 'Withdrawal Request' ? 'bg-red-100 text-red-600' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {item.entityType === 'user' ? <UserPlusIcon /> : <ActivityIcon />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800 dark:text-white">
                                                    {item.entityType === 'user' 
                                                        ? `New User Registered: ${item.fullName}`
                                                        : `${item.type} - $${item.amount?.toFixed(2)}`
                                                    }
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {item.entityType === 'user' ? `@${item.username}` : `${item.userName} • ${item.description}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-gray-400">{new Date(item.sortDate).toLocaleDateString()}</span>
                                            <div className="mt-1">
                                                {item.status && <Badge status={item.status} />}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500">No recent activity found.</div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 text-center">
                            <Link to="/admin/logs" className="text-sm font-medium text-blue-600 hover:text-blue-500">View Full System Logs &rarr;</Link>
                        </div>
                    </div>
                </div>

                {/* Right Column: Quick Actions & Lists */}
                <div className="space-y-8">
                    
                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => navigate('/admin/deposits')} className="p-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-green-700 dark:text-green-300 text-sm font-medium transition-colors text-center">
                                Approve Deposits
                            </button>
                            <button onClick={() => navigate('/admin/withdrawals')} className="p-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm font-medium transition-colors text-center">
                                Process Payouts
                            </button>
                            <button onClick={() => navigate('/admin/users')} className="p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-700 dark:text-blue-300 text-sm font-medium transition-colors text-center">
                                Manage Users
                            </button>
                            <button onClick={() => navigate('/admin/investment-plans')} className="p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg text-purple-700 dark:text-purple-300 text-sm font-medium transition-colors text-center">
                                Update Plans
                            </button>
                        </div>
                    </div>

                    {/* New Members */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Newest Members</h3>
                            <Link to="/admin/users" className="text-xs text-blue-500 hover:underline">View All</Link>
                        </div>
                        <div className="space-y-4">
                            {recentMembers.length > 0 ? (
                                recentMembers.map(user => (
                                    <div key={user._id} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">
                                                {user.fullName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800 dark:text-white">{user.fullName}</p>
                                                <p className="text-xs text-gray-500">{user.email}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400">{new Date(user.registrationDate).toLocaleDateString()}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No users yet.</p>
                            )}
                        </div>
                    </div>

                    {/* System Health (Static) */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">System Health</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>Database</span>
                                <span className="text-green-600 font-medium">Operational</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>API Server</span>
                                <span className="text-green-600 font-medium">Operational</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>Email Service</span>
                                <span className="text-green-600 font-medium">Operational</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// Icons
const UsersIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const DepositIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
const WithdrawalIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>;
const WalletIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const UserPlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>;
const ActivityIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>;

export default Dashboard;
