import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
// Added Button import to fix find name errors
import Button from '../../components/ui/Button';
import { Status, formatCurrency } from '../../types';

const ActivePlans: React.FC = () => {
    const { state } = useData();
    const { currentUser, transactions, investmentPlans, settings } = state;
    const navigate = useNavigate();

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    const activePlans = currentUser.activePlans || [];

    const getSlotUsage = (planId: string) => {
        const plan = investmentPlans.find(p => p._id === planId);
        const limit = plan?.directReferralLimit || 0;
        
        // 1. Identify all equivalent plan IDs for this track
        const equivIds = new Set<string>();
        equivIds.add(planId);
        const group = settings.planEquivalencyGroups?.find(g =>
            g.usdPlanId === planId || g.pkrPlanId === planId || g.eurPlanId === planId
        );
        if (group) {
            if (group.usdPlanId) equivIds.add(group.usdPlanId);
            if (group.pkrPlanId) equivIds.add(group.pkrPlanId);
            if (group.eurPlanId) equivIds.add(group.eurPlanId);
        }

        // 2. Count direct referrals who triggered a commission (Approved OR Pending/Held) 
        const used = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.level === 1 &&
            t.status !== 'Rejected' && // Ignore overflow records
            t.relatedPlanId && equivIds.has(String(t.relatedPlanId))
        ).length;

        return { used, limit };
    };

    const ProgressBar = ({ used, limit }: { used: number, limit: number }) => {
        if (limit === 0) return <span className="text-xs font-bold text-blue-500 uppercase tracking-tighter">Unlimited Slots</span>;
        
        const percent = Math.min(100, (used / limit) * 100);
        const isFull = used >= limit;

        return (
            <div className="w-full max-w-[240px]">
                <div className="flex justify-between items-end mb-1 px-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isFull ? 'text-red-500' : 'text-gray-400'}`}>
                        {isFull ? 'Plan Capacity Reached' : 'Direct Slots'}
                    </span>
                    <span className="text-xs font-bold font-mono">{used} / {limit}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden border dark:border-gray-600 flex gap-0.5 p-0.5">
                    {Array.from({ length: limit }).map((_, i) => (
                        <div 
                            key={i} 
                            className={`flex-1 h-full rounded-sm transition-all duration-500 ${
                                i < used 
                                ? (isFull ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.3)]') 
                                : 'bg-gray-200 dark:bg-gray-800'
                            }`}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Active Portfolio</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and track your currently active investment engines.</p>
                    </div>
                    {/* Fixed: Button component now defined via import */}
                    <Button onClick={() => navigate('/member/plans')} variant="primary" size="md">Buy New Plan</Button>
                </div>

                {activePlans.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-4">Investment Plan</th>
                                    <th className="px-4 py-4">Entry Price</th>
                                    <th className="px-4 py-4">Networking Capacity</th>
                                    <th className="px-4 py-4">Active Since</th>
                                    <th className="px-4 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {activePlans.map((plan, index) => {
                                    const { used, limit } = getSlotUsage(plan.planId);
                                    return (
                                        <tr key={`${plan.planId}-${index}`} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200">
                                            <td className="px-4 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-bold text-xl">
                                                        {plan.planName.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{plan.planName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 font-bold font-mono text-sm">{formatCurrency(plan.price, currentUser.currency)}</td>
                                            <td className="px-4 py-5">
                                                <ProgressBar used={used} limit={limit} />
                                            </td>
                                            <td className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(plan.purchaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <Badge status={Status.Active} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <div className="text-5xl mb-4">💼</div>
                        <p className="text-gray-500 dark:text-gray-400 text-lg font-bold">Your portfolio is empty.</p>
                        <p className="text-gray-400 text-sm mb-6">Select an investment plan to start earning commissions.</p>
                        {/* Fixed: Button component now defined via import */}
                        <Button onClick={() => navigate('/member/plans')}>Explore Plans</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivePlans;