
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
    const [viewMode, setViewMode] = useState<'commissions' | 'overflow' | 'all'>('commissions');
    const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) setSelectedPlanId(uniqueActivePlans[0].planId);
    }, [uniqueActivePlans, selectedPlanId]);
    
    const getEquivalentIds = useCallback((planId: string) => {
        const ids = new Set<string>();
        if (planId) {
            ids.add(planId);
            const group = settings.planEquivalencyGroups?.find(g => String(g.usdPlanId) === planId || String(g.pkrPlanId) === planId || String(g.eurPlanId) === planId);
            if (group) { [group.usdPlanId, group.pkrPlanId, group.eurPlanId].forEach(id => id && ids.add(String(id))); }
        }
        return ids;
    }, [settings.planEquivalencyGroups]);

    const equivPlanIds = useMemo(() => getEquivalentIds(selectedPlanId), [selectedPlanId, getEquivalentIds]);
    const selectedPlanDetails = useMemo(() => investmentPlans.find(p => p._id === selectedPlanId), [selectedPlanId, investmentPlans]);

    const getCommissionInfo = useCallback((referral: User, contextIds: Set<string>) => {
        if (!currentUser) return { earned: 0, held: 0, isHold: false, isOverflow: false };
        const comms = transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.sourceUserId === referral._id && (t.relatedPlanId ? contextIds.has(String(t.relatedPlanId)) : false));
        
        const earned = comms.filter(t => t.status === 'Approved').reduce((s, t) => s + t.amount, 0);
        const held = comms.filter(t => t.status === 'Pending').reduce((s, t) => s + t.amount, 0);
        
        const isHold = comms.some(t => t.description?.toLowerCase().includes('held for upgrade'));
        const isOverflow = comms.some(t => t.description === 'Slot Limit Reached');
        
        return { earned, held, isHold, isOverflow, sourcePlanId: comms[0]?.relatedPlanId };
    }, [currentUser, transactions]);

    const { directEarners, indirectEarners, overflowReferrals, allNodes, networkStats } = useMemo(() => {
        if (!currentUser) return { directEarners: [], indirectEarners: [], overflowReferrals: [], allNodes: [], networkStats: { total: 0, active: 0, earnings: 0 } };
        
        const build = (s: string, l: number): GenealogyNode[] => users.filter(u => u.sponsor?.toLowerCase() === s.toLowerCase()).map(c => ({ user: c, children: build(c.username, l + 1), level: l }));
        const fullTree = build(currentUser.username, 1);
        const flat: GenealogyNode[] = [];
        const f = (ns: GenealogyNode[]) => ns.forEach(n => { flat.push(n); f(n.children); });
        f(fullTree);

        const dE: GenealogyNode[] = [], iE: GenealogyNode[] = [], oR: GenealogyNode[] = [];
        flat.forEach(node => {
            const info = getCommissionInfo(node.user, equivPlanIds);
            if (info.earned > 0 || info.held > 0 || info.isHold) {
                if (node.level === 1) dE.push(node); else iE.push(node);
            } else if (info.isOverflow && node.level === 1) {
                oR.push(node);
            }
        });

        const totalEarned = transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Approved' && (t.relatedPlanId ? equivPlanIds.has(String(t.relatedPlanId)) : false)).reduce((s, t) => s + t.amount, 0);

        return { directEarners: dE, indirectEarners: iE, overflowReferrals: oR, allNodes: flat, networkStats: { total: flat.length, active: dE.length + iE.length, earnings: totalEarned } };
    }, [currentUser, users, transactions, equivPlanIds, getCommissionInfo]);

    const ReferralCard: React.FC<{ node: GenealogyNode | { user: User, level?: number } }> = ({ node }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        const info = getCommissionInfo(user, equivPlanIds);
        const sourcePlan = info.sourcePlanId ? investmentPlans.find(p => p._id === String(info.sourcePlanId)) : null;

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${info.isHold ? 'border-l-amber-500 bg-amber-50/10' : info.isOverflow ? 'border-l-orange-500 bg-orange-50/10' : 'border-l-blue-500'} p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
                <div className="flex items-start gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-bold text-gray-900 dark:text-white">@{user.username}</h4>
                            {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${level === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{level === 1 ? 'Direct' : `Lvl ${level}`}</span>}
                            {info.isHold && <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase animate-pulse">Held for Upgrade</span>}
                            {info.isOverflow && <span className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded-full font-bold uppercase">Overflow</span>}
                        </div>
                        <p className="text-xs text-gray-500">{sourcePlan ? `Plan: ${sourcePlan.name}` : (info.isOverflow ? 'Slot Limit Reached' : 'No Active Plan')}</p>
                    </div>
                </div>
                <div className="text-right">
                    {info.isOverflow ? <p className="text-lg font-bold text-orange-600">{formatCurrency(0, currentUser?.currency)}</p> : (
                        info.isHold ? <p className="text-lg font-bold text-amber-600">{formatCurrency(info.held || info.earned, currentUser?.currency)}</p> :
                        info.earned > 0 ? <p className="text-lg font-bold text-green-600">{formatCurrency(info.earned, currentUser?.currency)}</p> : <span className="text-xs text-gray-400">N/A</span>
                    )}
                </div>
            </div>
        );
    };

    if (!currentUser) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Network</h1><p className="text-sm text-gray-500">Manage your referrals and track commissions.</p></div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/member/transactions')}>Earnings History</Button>
                    <Button size="sm" onClick={() => navigate('/member/plans')}>Upgrade Plan</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-x-auto gap-2">
                {uniqueActivePlans.map(p => (
                    <button key={p.planId} onClick={() => setSelectedPlanId(p.planId)} className={`flex-1 min-w-[140px] py-2 px-4 rounded-md text-sm font-medium transition-all border ${selectedPlanId === p.planId ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800' : 'bg-transparent border-transparent text-gray-500'}`}>{p.planName}</button>
                ))}
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Direct Referral Slots</h4>
                        <span className="text-sm font-bold text-blue-600">{directEarners.length} / {selectedPlanDetails.directReferralLimit || '∞'}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${selectedPlanDetails.directReferralLimit > 0 && directEarners.length >= selectedPlanDetails.directReferralLimit ? 'bg-orange-500' : 'bg-blue-600'}`} style={{ width: `${selectedPlanDetails.directReferralLimit === 0 ? 100 : Math.min(100, (directEarners.length / selectedPlanDetails.directReferralLimit) * 100)}%` }}></div>
                    </div>
                    {selectedPlanDetails.directReferralLimit > 0 && directEarners.length >= selectedPlanDetails.directReferralLimit && <p className="text-[10px] text-orange-600 font-bold mt-2 uppercase">Limit reached for this plan level.</p>}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Network</p><h3 className="text-2xl font-bold text-blue-600">{allNodes.length}</h3></div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Earners</p><h3 className="text-2xl font-bold text-green-600">{networkStats.active}</h3></div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Earnings</p><h3 className="text-2xl font-bold text-purple-600">{formatCurrency(networkStats.earnings, currentUser.currency)}</h3></div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
                <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2">
                    <button onClick={() => setViewMode('commissions')} className={`px-4 py-2 text-xs font-bold rounded-full ${viewMode === 'commissions' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Commission List ({directEarners.length + indirectEarners.length})</button>
                    <button onClick={() => setViewMode('overflow')} className={`px-4 py-2 text-xs font-bold rounded-full ${viewMode === 'overflow' ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Overflow & Waiting ({overflowReferrals.length})</button>
                    <button onClick={() => setViewMode('all')} className={`px-4 py-2 text-xs font-bold rounded-full ${viewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>All Referrals ({allNodes.length})</button>
                </div>
                <div className="p-6 space-y-4">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-blue-500 rounded-full mr-2"></span>Direct Referrals</h3><div className="space-y-3">{directEarners.map(n => <ReferralCard key={n.user._id} node={n} />)}</div></div>
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-purple-500 rounded-full mr-2"></span>Indirect Team</h3><div className="space-y-3">{indirectEarners.map(n => <ReferralCard key={n.user._id} node={n} />)}</div></div>
                        </div>
                    )}
                    {viewMode === 'overflow' && (
                        <div className="space-y-3">
                             <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg mb-4 text-sm text-orange-800 dark:text-orange-200">
                                <strong>Note:</strong> These referrals joined when your direct slots were full. You will earn from them only if you upgrade to a higher plan level.
                             </div>
                            {overflowReferrals.map(n => <ReferralCard key={n.user._id} node={n} />)}
                            {overflowReferrals.length === 0 && <p className="text-center py-10 text-gray-500">No overflow referrals.</p>}
                        </div>
                    )}
                    {viewMode === 'all' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{allNodes.map(n => <ReferralCard key={n.user._id} node={n} />)}</div>}
                </div>
            </div>
            <ShareButtons url={`${window.location.origin}/#/register?sponsor=${currentUser.username}`} title="Join my network on SmartEarning!" />
        </div>
    );
};

export default Referrals;
