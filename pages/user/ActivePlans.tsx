
import React, { useMemo } from 'react';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { Status, formatCurrency } from '../../types';

const ActivePlans: React.FC = () => {
    const { state } = useData();
    const { currentUser, investmentPlans, transactions, settings } = state;

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    const activePlans = currentUser.activePlans || [];

    // Helper to get slot usage for a specific plan
    const getSlotUsage = (planId: string) => {
        const plan = investmentPlans.find(p => p._id === planId);
        if (!plan) return { used: 0, limit: 0 };

        // Handle equivalency
        const group = settings.planEquivalencyGroups?.find(g =>
            g.usdPlanId === planId ||
            g.pkrPlanId === planId ||
            g.eurPlanId === planId
        );
        
        const equivalentIds = new Set<string>();
        equivalentIds.add(planId);
        if (group) {
            if (group.usdPlanId) equivalentIds.add(group.usdPlanId);
            if (group.pkrPlanId) equivalentIds.add(group.pkrPlanId);
            if (group.eurPlanId) equivalentIds.add(group.eurPlanId);
        }

        const used = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.level === 1 && 
            t.status === 'Approved' &&
            (t.relatedPlanId ? equivalentIds.has(t.relatedPlanId) : false)
        ).length;

        return { used, limit: plan.directReferralLimit };
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">My Active Plans</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Below is a list of all investment plans currently active on your account and your referral slot progress.</p>

                {activePlans.length > 0 ? (
                    <Table headers={['Plan Name', 'Price', 'Purchase Date', 'Direct Slots', 'Status']}>
                        {activePlans.map((plan, index) => {
                            const { used, limit } = getSlotUsage(plan.planId);
                            const isFull = limit > 0 && used >= limit;

                            return (
                                <tr key={`${plan.planId}-${index}`} className="text-gray-700 dark:text-gray-400">
                                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{plan.planName}</td>
                                    <td className="px-4 py-3">{formatCurrency(plan.price, currentUser.currency)}</td>
                                    <td className="px-4 py-3 text-sm">{new Date(plan.purchaseDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1 min-w-[120px]">
                                            <div className="flex justify-between text-[10px] font-bold uppercase">
                                                <span className={isFull ? 'text-red-500' : 'text-gray-500'}>
                                                    {used} / {limit === 0 ? '∞' : limit} Used
                                                </span>
                                                {isFull && <span className="text-red-500">Full</span>}
                                            </div>
                                            {limit > 0 && (
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                    <div 
                                                        className={`h-1.5 rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                        style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                                                    ></div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3"><Badge status={Status.Active} /></td>
                                </tr>
                            )
                        })}
                    </Table>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">You do not have any active plans yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivePlans;
