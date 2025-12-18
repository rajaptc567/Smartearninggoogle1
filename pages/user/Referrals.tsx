
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
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
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
    
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'held' | 'all'>('commissions');

    const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
    const [selectedSponsor, setSelectedSponsor] = useState<User | null>(null);
    const [selectedReferralForSponsorModal, setSelectedReferralForSponsorModal] = useState<User | null>(null);

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
    useEffect(() => {
        if (viewMode !== 'held' && viewMode !== 'all') {
            setViewMode('commissions');
        }
        setHighlightedUserId(null);
    }, [selectedPlanId]);

    const getEquivalentIds = useCallback((planId: string) => {
        const ids = new Set<string>();
        if (planId) {
            ids.add(planId);
            const group = settings.planEquivalencyGroups?.find(g =>
                g.usdPlanId === planId || g.pkrPlanId === planId || g.eurPlanId === planId
            );
            if (group) {
                if (group.usdPlanId) ids.add(group.usdPlanId);
                if (group.pkrPlanId) ids.add(group.pkrPlanId);
                if (group.eurPlanId) ids.add(group.eurPlanId);
            }
        }
        return ids;
    }, [settings.planEquivalencyGroups]);

    const equivalentPlanIdsForSelected = useMemo(() => getEquivalentIds(selectedPlanId), [selectedPlanId, getEquivalentIds]);
    const selectedPlanDetails = useMemo(() => investmentPlans.find(p => p._id === selectedPlanId), [selectedPlanId, investmentPlans]);
    const currentPlanName = selectedPlanDetails?.name || 'Selected Plan';

    const slotUsage = useMemo(() => {
        if (!currentUser || !selectedPlanId) return { used: 0, limit: 0 };
        const limit = selectedPlanDetails?.directReferralLimit || 0;
        const used = transactions.filter(t => 
            t.userId === currentUser._id && t.type === 'Commission' && t.level === 1 && t.status === 'Approved' && t.amount > 0 &&
            (t.relatedPlanId ? equivalentPlanIdsForSelected.has(t.relatedPlanId) : false)
        ).length;
        return { used, limit };
    }, [currentUser, selectedPlanId, selectedPlanDetails, transactions, equivalentPlanIdsForSelected]);

    const overflowReferrals = useMemo(() => {
        if (!currentUser || !selectedPlanId) return [];
        const missedTx = transactions.filter(t => 
            t.userId === currentUser._id && t.type === 'Missed Commission' && t.level === 1 && 
            (t.relatedPlanId ? equivalentPlanIdsForSelected.has(t.relatedPlanId) : false)
        );
        const userIds = missedTx.map(t => t.sourceUserId);
        return users.filter(u => userIds.includes(u._id));
    }, [currentUser, selectedPlanId, transactions, equivalentPlanIdsForSelected, users]);

    const renderMaxDirectCommission = (plan: InvestmentPlan) => {
        const comms = plan.directCommissions;
        if (!comms || comms.length === 0) return 'N/A';
        let maxVal = 0, maxType = 'percentage';
        comms.forEach(c => { if (c.value > maxVal) { maxVal = c.value; maxType = c.type; } });
        return maxType === 'percentage' ? `${maxVal}%` : formatCurrency(maxVal, plan.currency);
    };

    const globalHeldData = useMemo(() => {
        if (!currentUser) return { referrals: [], count: 0, stats: new Map() };
        const pendingMap = new Map();
        transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Pending').forEach(t => {
                if (!t.sourceUserId) return;
                const current = pendingMap.get(t.sourceUserId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                let reason = "Pending Review";
                let missingPlanId = undefined;
                let missingPlanName = undefined;

                if (t.description?.includes('Held for Auto-Upgrade')) {
                    reason = "Earmarked for Upgrade";
                } else if (currentUser.restrictions?.earning) {
                    reason = "Account Restricted";
                } else if (settings.requireActivePlanForCommission && (!currentUser.activePlans || currentUser.activePlans.length === 0)) {
                    reason = "No Active Plan";
                } else if (settings.requirePlanMatchForCommission && t.relatedPlanId) {
                     const reqIds = getEquivalentIds(t.relatedPlanId);
                     if (!currentUser.activePlans?.some(p => reqIds.has(p.planId))) {
                        reason = "Missing Required Plan";
                     }
                }
                current.breakdown.push({ reason, amount: t.amount });
                pendingMap.set(t.sourceUserId, current);
            });
        const heldIds = Array.from(pendingMap.keys());
        const referrals = users.filter(u => heldIds.includes(u._id));
        return { referrals, count: referrals.length, stats: pendingMap };
    }, [transactions, currentUser, settings, investmentPlans, getEquivalentIds, users]);

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>) => {
        const referralCommissions = transactions.filter(t => 
            t.userId === currentUser?._id && t.type === 'Commission' && t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(t.relatedPlanId) : false) 
        );
        const approvedTx = referralCommissions.filter(t => t.status === 'Approved');
        const earned = approvedTx.reduce((sum, t) => sum + t.amount, 0);
        return { earned, earningSourcePlanId: approvedTx[0]?.relatedPlanId };
    }, [currentUser, transactions]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
        isTree?: boolean;
        isHeldView?: boolean;
        isAllView?: boolean;
        isOverflowView?: boolean;
    }> = ({ node, isTree, isHeldView, isAllView, isOverflowView }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        let earned = info.earned;
        let held = 0, breakdown = [];

        if (isHeldView) {
            const stats = globalHeldData.stats.get(user._id);
            held = stats?.total || 0;
            breakdown = stats?.breakdown || [];
        }

        const isDirect = level === 1 || isOverflowView;
        const sourcePlan = info.earningSourcePlanId ? investmentPlans.find(p => p._id === info.earningSourcePlanId) : null;

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${isOverflowView ? 'border-l-red-500' : isHeldView ? 'border-l-yellow-500' : isDirect ? 'border-l-blue-500' : 'border-l-purple-500'} transition-all hover:shadow-md`}>
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                        <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.username}</h4>
                                {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${level === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{level === 1 ? 'Direct' : `Level ${level}`}</span>}
                                {isOverflowView && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-red-100 text-red-800">Waiting for Upgrade</span>}
                                {user.status !== Status.Active && <Badge status={user.status} />}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {isOverflowView ? <p className="text-red-600 dark:text-red-400 font-bold">Limit reached for current plan. Upgrade to earn from this user.</p> : sourcePlan ? <p className="text-green-600 font-medium">Purchased {sourcePlan.name}</p> : <p>No qualifying purchase</p>}
                                {user.sponsor && <p className="mt-1">Via: <span className="text-blue-500">@{user.sponsor}</span></p>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        {earned > 0 && <p className="text-lg font-bold text-green-600">{formatCurrency(earned, currentUser?.currency)}</p>}
                        {isHeldView && (
                            <div className="space-y-1">
                                {breakdown.map((b, i) => <p key={i} className="text-[10px] font-bold text-yellow-600 uppercase">{b.reason}: {formatCurrency(b.amount, currentUser?.currency)}</p>)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Commission Network</h1>
                <ShareButtons url={referralLink} title="Join my team on SmartEarning!" />
            </div>

            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg flex overflow-x-auto gap-2">
                {uniqueActivePlans.map(plan => (
                    <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`px-4 py-2 rounded-md text-sm font-medium border ${selectedPlanId === plan.planId ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-600'}`}>{plan.planName}</button>
                ))}
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center sm:text-left border-r dark:border-gray-700 px-2"><span className="block text-[10px] uppercase text-gray-400 font-bold">Plan Price</span><span className="text-lg font-bold text-blue-600">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span></div>
                    <div className="text-center sm:text-left border-r dark:border-gray-700 px-2"><span className="block text-[10px] uppercase text-gray-400 font-bold">Direct Slots</span><span className="text-lg font-bold">{slotUsage.used} / {slotUsage.limit || '∞'}</span></div>
                    <div className="col-span-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                            <div className={`h-2 rounded-full ${slotUsage.used >= slotUsage.limit && slotUsage.limit > 0 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (slotUsage.used / slotUsage.limit) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <Button variant={viewMode === 'commissions' ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode('commissions')}>Commissions</Button>
                <Button variant={viewMode === 'overflow' ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode('overflow')}>Overflow ({overflowReferrals.length})</Button>
                <Button variant={viewMode === 'held' ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode('held')}>Held ({globalHeldData.count})</Button>
            </div>

            <div className="space-y-4">
                {viewMode === 'commissions' && users.filter(u => u.sponsor === currentUser.username).map(u => <ReferralCardContent key={u._id} node={{user: u, level: 1}} />)}
                {viewMode === 'overflow' && (
                    <div className="space-y-4">
                         <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-xs text-red-700">
                             These members joined when your {selectedPlanDetails?.name} slots were full. You will earn from them if they upgrade to a plan where you have space!
                         </div>
                         {overflowReferrals.map(u => <ReferralCardContent key={u._id} node={{user: u}} isOverflowView={true} />)}
                    </div>
                )}
                {viewMode === 'held' && globalHeldData.referrals.map(u => <ReferralCardContent key={u._id} node={{user: u}} isHeldView={true} />)}
            </div>
        </div>
    );
};

export default Referrals;
