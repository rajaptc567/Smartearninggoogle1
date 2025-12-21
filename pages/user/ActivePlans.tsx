import React from 'react';
// Import useNavigate from react-router-dom
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { Status, formatCurrency } from '../../types';

const ActivePlans: React.FC = () => {
    const { state } = useData();
    const { currentUser, transactions, investmentPlans, settings } = state;
    // Initialize navigate function using useNavigate hook
    const navigate = useNavigate();

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    const activePlans = currentUser.activePlans || [];

    const getSlotUsage = (planId: string) => {
        const plan = investmentPlans.find(p => p._id === planId);
        const limit = plan?.directReferralLimit || 0;
        
        // 1. Identify all equivalent plan IDs for this row
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

        // 2. Count ACTUAL occupancy based on commissions received
        // CRITICAL: We must count Approved AND Pending (Held) commissions as valid slot occupants.
        // Rejected (Overflow) commissions do NOT count.
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
                <p className="text-gray-600 dark:text-gray-400 mb-6">Below is a list of all investment plans currently active on your account.</p>

                {activePlans.length > 0 ? (
                    <Table headers={['Plan Name', 'Price', 'Direct Slots Progress', 'Purchase Date', 'Status']}>
                        {activePlans.map((plan, index) => {
                            const { used, limit } = getSlotUsage(plan.planId);
                            const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
                            
                            return (
                                <tr key={`${plan.planId}-${index}`} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{plan.planName}</td>
                                    <td className="px-4 py-3 font-medium">{formatCurrency(plan.price, currentUser.currency)}</td>
                                    <td className="px-4 py-3 min-w-[200px]">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                <span>{used} / {limit === 0 ? '∞' : limit} used</span>
                                                {limit > 0 && used >= limit && <span className="text-red-500 animate-pulse">Full</span>}
                                                {limit === 0 && <span className="text-blue-500">Unlimited</span>}
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden shadow-inner">
                                                <div 
                                                    className={`h-full transition-all duration-700 ease-out ${limit > 0 && used >= limit ? 'bg-red-500' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
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
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">You do not have any active plans yet.</p>
                        <button 
                            onClick={() => navigate('/member/plans')} 
                            className="mt-4 text-blue-600 hover:underline font-semibold"
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