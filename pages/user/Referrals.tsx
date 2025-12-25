
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan, Transaction } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import ShareButtons from '../../components/ui/ShareButtons';
import Modal from '../../components/ui/Modal';

interface GenealogyNode {
    user: User;
    children: GenealogyNode[];
    level: number;
}

const Referrals: React.FC = () => {
    const { state } = useData();
    const { currentUser, users, transactions, settings, investmentPlans } = state;
    const navigate = useNavigate();
    
    const uniqueActivePlans = useMemo(() => {
        if (!currentUser || !currentUser.activePlans) return [];
        const seen = new Set();
        return currentUser.activePlans.filter(p => {
            const duplicate = seen.has(p.planId);
            seen.add(p.planId);
            return !duplicate;
        });
    }, [currentUser]);

    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [viewMode, setViewMode] = useState<'commissions' | 'overflow' | 'held'>('commissions');

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
    const getEquivalentIds = useCallback((planId: string) => {
        const ids = new Set<string>();
        if (planId) {
            ids.add(planId);
            const group = settings.planEquivalencyGroups?.find(g =>
                String(g.usdPlanId) === planId ||
                String(g.pkrPlanId) === planId ||
                String(g.eurPlanId) === planId
            );
            if (group) {
                if (group.usdPlanId) ids.add(String(group.usdPlanId));
                if (group.pkrPlanId) ids.add(String(group.pkrPlanId));
                if (group.eurPlanId) ids.add(String(group.eurPlanId));
            }
        }
        return ids;
    }, [settings.planEquivalencyGroups]);

    const equivalentPlanIdsForSelected = useMemo(() => {
        return getEquivalentIds(selectedPlanId);
    }, [selectedPlanId, getEquivalentIds]);
    
    const selectedPlanDetails = useMemo(() => {
        if (!selectedPlanId) return null;
        return investmentPlans.find(p => p._id === selectedPlanId);
    }, [selectedPlanId, investmentPlans]);

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>) => {
        if (!currentUser) return { earned: 0, held: 0, status: '', slot: null };
        
        const referralComms = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : false) 
        );

        const earned = referralComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = referralComms.filter(t => t.status === 'hold_slot' || t.status === 'hold_upgrade').reduce((sum, t) => sum + t.amount, 0);
        const bestTx = referralComms[0];
        
        return { 
            earned, 
            held, 
            status: bestTx?.status || '', 
            slot: (bestTx as any)?.slot_index || null,
            description: bestTx?.description || ''
        };
    }, [currentUser, transactions]);

    const { directEarners, indirectEarners, overflowReferrals, heldReferrals, slotStats } = useMemo(() => {
        if (!currentUser) return { directEarners: [], indirectEarners: [], overflowReferrals: [], heldReferrals: [], slotStats: { used: 0, limit: 0 } };

        const allRefs = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === currentUser.username.toLowerCase());
        
        const directs: any[] = [];
        const indirects: any[] = [];
        const overflows: any[] = [];
        const held: any[] = [];

        users.forEach(u => {
            const info = getCommissionInfoForReferral(u, equivalentPlanIdsForSelected);
            if (!info.status) return;

            const isDirect = u.sponsor?.toLowerCase() === currentUser.username.toLowerCase();

            if (info.status === 'Approved') {
                if (isDirect) directs.push({ user: u, info });
                else indirects.push({ user: u, info });
            } else if (info.status === 'hold_slot' || info.status === 'hold_upgrade') {
                held.push({ user: u, info });
            } else if (info.status === 'overflow') {
                overflows.push({ user: u, info });
            }
        });

        const limit = selectedPlanDetails?.directReferralLimit || 0;
        // Slots are consumed by Approved and Held transactions
        const used = directs.length + held.filter(h => h.user.sponsor?.toLowerCase() === currentUser.username.toLowerCase()).length;

        return { directEarners: directs, indirectEarners: indirects, overflowReferrals: overflows, heldReferrals: held, slotStats: { used, limit } };
    }, [currentUser, users, equivalentPlanIdsForSelected, getCommissionInfoForReferral, selectedPlanDetails]);

    const ReferralCard: React.FC<{ data: any }> = ({ data }) => {
        const { user, info } = data;
        const isHold = info.status.startsWith('hold_');
        const isOverflow = info.status === 'overflow';

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm transition-all hover:shadow-md ${isHold ? 'border-amber-400 bg-amber-50/5' : isOverflow ? 'border-gray-300 opacity-75' : 'border-gray-200'}`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${isHold ? 'bg-amber-500' : isOverflow ? 'bg-gray-400' : 'bg-blue-600'}`}>
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">@{user.username}</h4>
                            <div className="flex gap-2 items-center mt-1">
                                <Badge status={info.status} />
                                {info.slot && <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-1.5 rounded">Slot #{info.slot}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Commission</p>
                        <p className={`text-lg font-black ${isHold ? 'text-amber-600' : isOverflow ? 'text-gray-400' : 'text-green-600'}`}>
                            {formatCurrency(isHold ? info.held : isOverflow ? 0 : info.earned, currentUser?.currency)}
                        </p>
                        {isHold && <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center justify-end gap-1">🔒 Upgrade Req.</span>}
                    </div>
                </div>
                {info.description && <p className="mt-3 text-[11px] text-gray-500 italic border-t dark:border-gray-700 pt-2">{info.description}</p>}
            </div>
        );
    };

    if (!currentUser) return <div className="p-10 text-center">Loading network...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MLM Earning Network</h1>
                    <p className="text-sm text-gray-500">View your genealogy slots, held escrow, and contribution limits.</p>
                </div>
                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border dark:border-gray-700">
                    {uniqueActivePlans.map(plan => (
                        <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${selectedPlanId === plan.planId ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>{plan.planName}</button>
                    ))}
                </div>
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col md:flex-row">
                    <div className="p-6 bg-gray-50 dark:bg-gray-900/50 md:w-64 flex flex-col justify-center items-center text-center border-b md:border-b-0 md:border-r dark:border-gray-700">
                        <div className="text-3xl font-black text-blue-600 mb-1">{slotStats.used} / {slotStats.limit || '∞'}</div>
                        <div className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Occupied Slots</div>
                    </div>
                    <div className="flex-1 p-6">
                        <div className="flex justify-between items-end mb-2">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200">Track Progress: {selectedPlanDetails.name}</h3>
                            <span className="text-xs font-bold text-blue-500">{slotStats.limit > 0 ? `${Math.round((slotStats.used/slotStats.limit)*100)}% Capacity` : 'Unlimited'}</span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000" style={{ width: `${slotStats.limit === 0 ? 100 : Math.min(100, (slotStats.used / slotStats.limit) * 100)}%` }}></div>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">Slots are reserved by active earnings and held commissions. Once slots are full, next direct referrals will trigger <strong className="text-red-500">Overflow</strong> logic.</p>
                    </div>
                </div>
            )}

            <div className="flex gap-2 border-b dark:border-gray-700 pb-px overflow-x-auto no-scrollbar">
                {(['commissions', 'held', 'overflow'] as const).map(mode => (
                    <button key={mode} onClick={() => setViewMode(mode)} className={`px-6 py-3 text-sm font-bold capitalize transition-all border-b-2 ${viewMode === mode ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {mode === 'held' ? `🔒 Escrow (${heldReferrals.length})` : mode === 'overflow' ? `⚠️ Lost Earning (${overflowReferrals.length})` : `Team contributors`}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                {viewMode === 'commissions' && (
                    <>
                        {directEarners.map((d, i) => <ReferralCard key={i} data={d} />)}
                        {indirectEarners.map((d, i) => <ReferralCard key={i} data={d} />)}
                        {directEarners.length + indirectEarners.length === 0 && <div className="col-span-full py-20 text-center text-gray-500 italic">No contributors found in this track.</div>}
                    </>
                )}
                {viewMode === 'held' && (
                    <>
                        {heldReferrals.map((d, i) => <ReferralCard key={i} data={d} />)}
                        {heldReferrals.length === 0 && <div className="col-span-full py-20 text-center text-gray-500 italic">No held commissions. Upgrade to claim potential earnings!</div>}
                    </>
                )}
                {viewMode === 'overflow' && (
                    <>
                        {overflowReferrals.map((d, i) => <ReferralCard key={i} data={d} />)}
                        {overflowReferrals.length === 0 && <div className="col-span-full py-20 text-center text-gray-500 italic">No overflow recorded. All your slots were valid at join time.</div>}
                    </>
                )}
            </div>

            <ShareButtons url={`${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`} title="Join SmartEarning and grow your network today!" />
        </div>
    );
};

export default Referrals;
