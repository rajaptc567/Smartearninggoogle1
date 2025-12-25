import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
// FIX: Added missing import for Button component
import Button from '../../components/ui/Button';
import { Status, formatCurrency } from '../../types';

const ActivePlans: React.FC = () => {
    const { state } = useData();
    const { currentUser, transactions, investmentPlans, settings } = state;
    const navigate = useNavigate();

    if (!currentUser) return <div>Loading...</div>;

    const activePlans = currentUser.activePlans || [];

    const getSlotUsage = (planId: string) => {
        const plan = investmentPlans.find(p => p._id === planId);
        const limit = plan?.directReferralLimit || 0;
        
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

        // Count only slot-occupying commissions (Approved or Pending-Hold)
        const used = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.level === 1 &&
            t.relatedPlanId && equivIds.has(String(t.relatedPlanId)) &&
            (t.status === 'Approved' || t.status === 'Pending') &&
            !t.description.includes('Used for Upgrade')
        ).length;

        const nextSlotNum = used + 1;
        const isNextSlotHold = plan?.holdPosition?.enabled && plan.holdPosition.slots.includes(nextSlotNum);
        const isNearOverflow = limit > 0 && nextSlotNum >= limit;

        return { used, limit, plan, nextSlotNum, isNextSlotHold, isNearOverflow };
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Portfolio Tracking</h2>
                {activePlans.length > 0 ? (
                    <Table headers={['Plan Track', 'Entry Value', 'Referral Slots Status', 'Purchase Date', 'Track Status']}>
                        {activePlans.map((plan, index) => {
                            const { used, limit, plan: planDetails, isNextSlotHold, isNearOverflow } = getSlotUsage(plan.planId);
                            
                            return (
                                <tr key={`${plan.planId}-${index}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-6">
                                        <div className="font-bold text-blue-600 dark:text-blue-400">{plan.planName}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Direct L1 Track</div>
                                    </td>
                                    <td className="px-4 py-6 font-bold">{formatCurrency(plan.price, currentUser.currency)}</td>
                                    <td className="px-4 py-6 min-w-[280px]">
                                        <div className="flex flex-col gap-2.5">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                <span>{used} / {limit === 0 ? '∞' : limit} Slots</span>
                                                <div className="flex gap-2">
                                                    {isNextSlotHold && <span className="text-indigo-500 animate-pulse">Next: UPGRADE</span>}
                                                    {isNearOverflow && used < limit && <span className="text-amber-500">Nearing Capacity</span>}
                                                    {limit > 0 && used >= limit && <span className="text-red-500 font-black">TRACK FULL</span>}
                                                </div>
                                            </div>
                                            <div className="flex h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner p-0.5 border border-gray-200 dark:border-gray-600">
                                                {limit > 0 ? (
                                                    Array.from({ length: limit }).map((_, i) => {
                                                        const slotNum = i + 1;
                                                        const isHold = planDetails?.holdPosition?.enabled && planDetails.holdPosition.slots.includes(slotNum);
                                                        const isUsed = slotNum <= used;
                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={`h-full flex-1 border-r last:border-0 dark:border-gray-800 transition-all duration-300 first:rounded-l-full last:rounded-r-full ${
                                                                    !isUsed ? 'bg-transparent' : 
                                                                    isHold ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' : 'bg-gradient-to-t from-blue-600 to-blue-400'
                                                                }`}
                                                            />
                                                        );
                                                    })
                                                ) : (
                                                    <div className="h-full bg-blue-500 w-full rounded-full" />
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6 text-sm text-gray-500">{new Date(plan.purchaseDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-6">
                                        <Badge status={Status.Active} />
                                    </td>
                                </tr>
                            );
                        })}
                    </Table>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/20">
                        <div className="text-4xl mb-4">💼</div>
                        <p className="text-gray-500 font-medium mb-4">You don't have any active investment plans yet.</p>
                        <Button onClick={() => navigate('/member/plans')}>Browse Investment Plans</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivePlans;