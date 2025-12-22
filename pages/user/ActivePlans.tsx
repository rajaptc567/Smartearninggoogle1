
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

    const getPlanData = (planId: string) => {
        const plan = investmentPlans.find(p => p._id === planId);
        const limit = plan?.directReferralLimit || 0;
        const holdSlots = plan?.holdPosition?.slots || [];
        
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
            t.status !== 'Rejected' && 
            t.relatedPlanId && equivIds.has(String(t.relatedPlanId))
        ).length;

        return { used, limit, holdSlots };
    };

    const SegmentedProgressBar = ({ used, limit, holdSlots }: { used: number, limit: number, holdSlots: number[] }) => {
        if (limit === 0) return <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Unlimited Slots</span>;
        
        return (
            <div className="w-full max-w-[280px]">
                <div className="flex justify-between items-end mb-1 px-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${used >= limit ? 'text-red-500' : 'text-gray-400'}`}>
                        {used >= limit ? 'Capacity Full' : 'Slot Usage'}
                    </span>
                    <span className="text-xs font-black font-mono">{used} / {limit}</span>
                </div>
                <div className="h-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg overflow-hidden border dark:border-gray-600 flex gap-0.5 p-0.5 shadow-inner">
                    {Array.from({ length: limit }).map((_, i) => {
                        const slotNum = i + 1;
                        const isHold = holdSlots.includes(slotNum);
                        const isOccupied = slotNum <= used;
                        
                        return (
                            <div 
                                key={i} 
                                className={`flex-1 h-full rounded-sm transition-all duration-700 ${
                                    isOccupied 
                                    ? (isHold ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.4)]' : 'bg-blue-600') 
                                    : (isHold ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-gray-200 dark:bg-gray-800')
                                }`}
                                title={isHold ? `Slot ${slotNum} is a Hold Position` : `Slot ${slotNum} is Standard`}
                            />
                        );
                    })}
                </div>
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600"></span><span className="text-[9px] font-bold text-gray-500 uppercase">Earned</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span className="text-[9px] font-bold text-gray-500 uppercase">Hold for Upgrade</span></div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Active Portfolio</h2>
                {activePlans.length > 0 ? (
                    <Table headers={['Plan Name', 'Entry Value', 'Direct Slot Strategy', 'Status']}>
                        {activePlans.map((plan, index) => {
                            const { used, limit, holdSlots } = getPlanData(plan.planId);
                            return (
                                <tr key={`${plan.planId}-${index}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="font-bold text-blue-600 dark:text-blue-400">{plan.planName}</div>
                                        <div className="text-[10px] text-gray-400 uppercase">Joined {new Date(plan.purchaseDate).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-4 py-4 font-bold">{formatCurrency(plan.price, currentUser.currency)}</td>
                                    <td className="px-4 py-4">
                                        <SegmentedProgressBar used={used} limit={limit} holdSlots={holdSlots} />
                                    </td>
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
