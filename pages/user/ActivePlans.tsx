
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
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

        const used = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.level === 1 &&
            t.relatedPlanId && equivIds.has(String(t.relatedPlanId))
        ).length;

        return { used, limit, plan };
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Active Portfolio</h2>
                {activePlans.length > 0 ? (
                    <Table headers={['Plan Name', 'Entry Value', 'Referral Slots', 'Purchase Date', 'Status']}>
                        {activePlans.map((plan, index) => {
                            const { used, limit, plan: planDetails } = getSlotUsage(plan.planId);
                            const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
                            
                            return (
                                <tr key={`${plan.planId}-${index}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="font-bold text-blue-600 dark:text-blue-400">{plan.planName}</div>
                                    </td>
                                    <td className="px-4 py-4 font-bold">{formatCurrency(plan.price, currentUser.currency)}</td>
                                    <td className="px-4 py-4 min-w-[200px]">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                <span>{used} / {limit === 0 ? '∞' : limit}</span>
                                                {limit > 0 && used >= limit ? <span className="text-red-500">MAX</span> : <span>Slots</span>}
                                            </div>
                                            <div className="flex h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                                {limit > 0 ? (
                                                    Array.from({ length: limit }).map((_, i) => {
                                                        const slotNum = i + 1;
                                                        const isHold = planDetails?.holdPosition?.enabled && planDetails.holdPosition.slots.includes(slotNum);
                                                        const isUsed = slotNum <= used;
                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={`h-full flex-1 border-r last:border-0 dark:border-gray-800 ${
                                                                    !isUsed ? 'bg-transparent' : 
                                                                    isHold ? 'bg-amber-400' : 'bg-blue-500'
                                                                }`}
                                                            />
                                                        );
                                                    })
                                                ) : (
                                                    <div className="h-full bg-blue-500 w-full" />
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-500">{new Date(plan.purchaseDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-4"><Badge status={Status.Active} /></td>
                                </tr>
                            );
                        })}
                    </Table>
                ) : (
                    <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                        <p className="text-gray-500">No active plans. <button onClick={() => navigate('/member/plans')} className="text-blue-600 font-bold hover:underline">Browse Plans</button></p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivePlans;
