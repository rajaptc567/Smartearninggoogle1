
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { Status, formatCurrency } from '../../types';

const ActivePlans: React.FC = () => {
    const { state } = useData();
    const { currentUser, users, investmentPlans, settings, transactions } = state;
    const navigate = useNavigate();

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    const activePlans = currentUser.activePlans || [];

    const getSlotUsage = (planId: string) => {
        const plan = investmentPlans.find(p => p._id === planId);
        const limit = plan?.directReferralLimit || 0;
        
        // 1. Identify all equivalent plan IDs for this row to count relevant referrals
        const equivIds = new Set<string>();
        equivIds.add(planId);
        if (settings.planEquivalencyGroups) {
            const group = settings.planEquivalencyGroups.find(g =>
                String(g.usdPlanId) === planId || String(g.pkrPlanId) === planId || String(g.eurPlanId) === planId
            );
            if (group) {
                if (group.usdPlanId) equivIds.add(String(group.usdPlanId));
                if (group.pkrPlanId) equivIds.add(String(group.pkrPlanId));
                if (group.eurPlanId) equivIds.add(String(group.eurPlanId));
            }
        }

        // 2. Count direct referrals who occupy a slot (Approved or Pending/Hold commissions)
        // This is the most accurate way to match the backend slot logic
        const used = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.level === 1 &&
            (t.status === 'Approved' || t.status === 'Pending') &&
            (t.relatedPlanId ? equivIds.has(String(t.relatedPlanId)) : false)
        ).length;

        return { used, limit };
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">My Active Plans</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Track your plan progress and direct referral slot availability.</p>

                {activePlans.length > 0 ? (
                    <Table headers={['Plan Name', 'Price', 'Direct Slots Progress', 'Purchase Date', 'Status']}>
                        {activePlans.map((plan, index) => {
                            const { used, limit } = getSlotUsage(plan.planId);
                            const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
                            
                            return (
                                <tr key={`${plan.planId}-${index}`} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-blue-600 dark:text-blue-400">{plan.planName}</div>
                                        <div className="text-[10px] text-gray-400 font-mono mt-1">ID: {plan.planId.substring(plan.planId.length - 8)}</div>
                                    </td>
                                    <td className="px-4 py-3 font-medium">{formatCurrency(plan.price, currentUser.currency)}</td>
                                    <td className="px-4 py-3 min-w-[200px]">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                <span>{used} / {limit === 0 ? '∞' : limit} slots occupied</span>
                                                {limit > 0 && used >= limit ? (
                                                    <span className="text-red-500 flex items-center gap-1">
                                                        <svg className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.366zM6.523 5.11a6 6 0 018.367 8.367L6.523 5.11z" clipRule="evenodd" /></svg>
                                                        Full
                                                    </span>
                                                ) : limit === 0 ? (
                                                    <span className="text-blue-500">Unlimited</span>
                                                ) : null}
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden shadow-inner border dark:border-gray-600">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ease-out ${limit > 0 && used >= limit ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{new Date(plan.purchaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                    <td className="px-4 py-3"><Badge status={Status.Active} /></td>
                                </tr>
                            );
                        })}
                    </Table>
                ) : (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/20">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">You do not have any active plans yet.</p>
                        <button 
                            onClick={() => navigate('/member/plans')} 
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                        >
                            Browse Investment Plans
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivePlans;
