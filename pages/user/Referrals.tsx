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
    const location = useLocation();
    
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
    
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'held' | 'all' | 'inactive'>('commissions');

    const prevPlanId = useRef(selectedPlanId);

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
            prevPlanId.current = uniqueActivePlans[0].planId;
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
    useEffect(() => {
        if (selectedPlanId && selectedPlanId !== prevPlanId.current) {
            setViewMode('commissions');
            setHighlightedUserId(null);
            prevPlanId.current = selectedPlanId;
        }
    }, [selectedPlanId]);

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

    const isTransactionHoldPosition = (t: Transaction) => {
        if (t.isHoldPosition !== undefined) return t.isHoldPosition === true;
        const desc = t.description?.toLowerCase() || '';
        return (t.status === 'Pending' || t.status === 'Approved') && (desc.includes('hold commission for upgrade') || desc.includes('reserved for auto-upgrade'));
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>): { earned: number; held: number; status?: string; earningSourcePlanId?: string, isHoldPosition?: boolean, isOverflow?: boolean } => {
        if (!currentUser) return { earned: 0, held: 0 };
        
        const referralComms = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : false) 
        );

        const earned = referralComms.filter(t => t.status === 'Approved' && !t.isHoldPosition).reduce((sum, t) => sum + t.amount, 0);
        const held = referralComms.filter(t => t.status === 'Pending' || t.isHoldPosition).reduce((sum, t) => sum + t.amount, 0);
        const isHoldPosition = referralComms.some(t => isTransactionHoldPosition(t));
        const isOverflow = referralComms.some(t => t.status === 'Rejected' && t.description.toLowerCase().includes('overflow'));
        
        let earningSourcePlanId: string | undefined;
        if (referralComms.length > 0) {
            const bestTx = referralComms.find(t => t.status === 'Approved' || t.status === 'Pending') || referralComms[0];
            earningSourcePlanId = bestTx.relatedPlanId?.toString();
        }
        return { earned, held, status: referralComms[0]?.status, earningSourcePlanId, isHoldPosition, isOverflow };
    }, [currentUser, transactions]);

    const { genealogyTree, directEarners, indirectEarners, overflowReferrals, inactiveReferrals, networkStats, allNodes } = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], directEarners: [], indirectEarners: [], overflowReferrals: [], inactiveReferrals: [], networkStats: { totalReferrals: 0, activeMembers: 0, earnings: 0, directEarnings: 0, indirectEarnings: 0 }, allNodes: [] };

        const buildFullTree = (sponsorUsername: string, level: number): GenealogyNode[] => {
            const directReferrals = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === sponsorUsername.toLowerCase());
            return directReferrals.map(child => ({
                user: child,
                children: buildFullTree(child.username, level + 1),
                level
            }));
        };
        const fullGenealogyTree = buildFullTree(currentUser.username, 1);

        const nodesList: GenealogyNode[] = [];
        const flatten = (nodes: GenealogyNode[]) => {
            nodes.forEach(node => {
                nodesList.push(node);
                flatten(node.children);
            });
        };
        flatten(fullGenealogyTree);

        const directEarnersList: GenealogyNode[] = [];
        const indirectEarnersList: GenealogyNode[] = [];
        const overflowList: GenealogyNode[] = [];
        const inactiveList: GenealogyNode[] = [];

        nodesList.forEach(node => {
            const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            if (info.earned > 0 || info.held > 0 || info.isHoldPosition) {
                if (node.level === 1) directEarnersList.push(node);
                else indirectEarnersList.push(node);
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } else {
                inactiveList.push(node);
            }
        });

        const relevantCommissions = transactions.filter(t => 
            t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Approved' && !t.isHoldPosition &&
            (t.relatedPlanId ? equivalentPlanIdsForSelected.has(String(t.relatedPlanId)) : false) 
        );

        return {
            genealogyTree: fullGenealogyTree,
            directEarners: directEarnersList,
            indirectEarners: indirectEarnersList,
            overflowReferrals: overflowList,
            inactiveReferrals: inactiveList,
            allNodes: nodesList,
            networkStats: { 
                totalReferrals: nodesList.length,
                activeMembers: nodesList.filter(n => n.user.activePlans?.length > 0).length,
                earnings: relevantCommissions.reduce((sum, t) => sum + t.amount, 0),
                directEarnings: relevantCommissions.filter(t => t.level === 1).reduce((sum, t) => sum + t.amount, 0),
                indirectEarnings: relevantCommissions.filter(t => t.level > 1).reduce((sum, t) => sum + t.amount, 0)
            }
        };
    }, [currentUser, users, transactions, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const heldCommissionsData = useMemo(() => {
        if (!currentUser || !selectedPlanId) return { referrals: [], count: 0, stats: new Map() };
        const filterIds = getEquivalentIds(selectedPlanId);
        const pendingMap = new Map<string, { total: number, breakdown: any[] }>();
        transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Pending' && (t.relatedPlanId ? filterIds.has(String(t.relatedPlanId)) : true))
            .forEach(t => {
                if (!t.sourceUserId) return;
                const current = pendingMap.get(t.sourceUserId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                let reason = isTransactionHoldPosition(t) ? "Hold Commission for upgrade" : "Requirement Not Met";
                current.breakdown.push({ reason, amount: t.amount, isHoldPosition: isTransactionHoldPosition(t) });
                pendingMap.set(t.sourceUserId, current);
            });
        const referrals = users.filter(u => pendingMap.has(u._id));
        return { referrals, count: referrals.length, stats: pendingMap };
    }, [transactions, currentUser, selectedPlanId, getEquivalentIds, users]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
        toggleNode?: (userId: string) => void;
        isCollapsed?: boolean;
        hasChildren?: boolean;
        isTree?: boolean;
        isHeldView?: boolean;
        isAllView?: boolean;
    }> = ({ node, toggleNode, isCollapsed, hasChildren, isTree, isHeldView, isAllView }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        
        let earned = isAllView ? transactions.filter(t => t.userId === currentUser?._id && t.type === 'Commission' && t.sourceUserId === user._id && t.status === 'Approved' && !t.isHoldPosition).reduce((s,t)=>s+t.amount,0) : info.earned;
        let held = isHeldView ? (heldCommissionsData.stats.get(user._id)?.total || 0) : info.held;
        let isHoldPosition = isHeldView ? heldCommissionsData.stats.get(user._id)?.breakdown.some(b=>b.isHoldPosition) : info.isHoldPosition;
        let isOverflow = info.isOverflow;

        const isDirect = level === 1;
        const levelBadgeColor = isDirect ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${level===1?'border-l-blue-500':'border-l-purple-500'} border-l-4 ${isHoldPosition ? 'border-l-amber-500' : ''} transition-all duration-200 hover:shadow-md`}>
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                        {isTree && hasChildren && toggleNode ? (
                            <button onClick={() => toggleNode(user._id)} className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold">
                                {isCollapsed ? '+' : '−'}
                            </button>
                        ) : (
                            <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                        )}
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.username}</h4>
                                {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${levelBadgeColor}`}>{isDirect ? 'Direct' : `Level ${level}`}</span>}
                                {isHoldPosition && <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm">🔒 Hold for upgrade</span>}
                                {isOverflow && <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-red-200">⚠️ Overflow</span>}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                {user.activePlans?.length > 0 ? (
                                    <p className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                                        <span>Active: {user.activePlans[0].planName}</span>
                                    </p>
                                ) : <p className="text-gray-400">No active plan</p>}
                                {user.sponsor && <p className="flex items-center gap-1"><span>Via:</span><span className="text-blue-500 font-medium">@{user.sponsor}</span></p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto text-right">
                        {(earned > 0 && !isHoldPosition) && (
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Earned</p>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(earned, currentUser?.currency || 'USD')}</p>
                            </div>
                        )}
                        {(held > 0 || isHoldPosition) && (
                             <div className={`${isHoldPosition ? 'bg-amber-100 border-amber-300' : 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'} px-3 py-1 rounded border`}>
                                <p className={`text-[10px] uppercase font-bold tracking-wider ${isHoldPosition ? 'text-amber-900' : 'text-blue-800 dark:text-blue-200'}`}>
                                    {isHoldPosition ? 'Held for upgrade' : 'Pending'}
                                </p>
                                <p className={`text-lg font-bold ${isHoldPosition ? 'text-amber-700' : 'text-blue-600 dark:text-blue-400'}`}>
                                    {formatCurrency(held || earned, currentUser?.currency || 'USD')}
                                </p>
                            </div>
                        )}
                        {(earned === 0 && held === 0 && !isOverflow && !isHoldPosition) && <span className="text-xs text-gray-400 italic">No commission</span>}
                        {isOverflow && <span className="text-xs text-red-600 font-bold uppercase tracking-tight">Capped</span>}
                    </div>
                </div>
            </div>
        );
    };

    const renderTreeNode = (node: GenealogyNode) => {
        const isCollapsed = collapsedNodes.has(node.user._id);
        return (
            <li key={node.user._id} className="relative pl-4 sm:pl-6 pt-2">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 -ml-2"></div>
                <div className="absolute left-0 top-8 w-4 h-px bg-gray-200 dark:bg-gray-700 -ml-2"></div>
                <div className="mb-2">
                    <ReferralCardContent node={node} toggleNode={(id)=>setCollapsedNodes(p=>{const s=new Set(p); s.has(id)?s.delete(id):s.add(id); return s;})} isCollapsed={isCollapsed} hasChildren={node.children.length>0} isTree={true} />
                </div>
                {node.children.length > 0 && !isCollapsed && <ul className="border-l border-gray-200 dark:border-gray-700 ml-2 pl-2">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Network</h1>
                    <p className="text-sm text-gray-500">Track team earnings and referral progress.</p>
                </div>
                <div className="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border dark:border-gray-700 overflow-x-auto no-scrollbar">
                    {uniqueActivePlans.map(plan => (
                        <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[120px] py-2 px-4 rounded-md text-xs font-bold transition-all whitespace-nowrap border ${selectedPlanId === plan.planId ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-50'}`}>{plan.planName}</button>
                    ))}
                </div>
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 animate-fade-in">
                    <div className="p-4 bg-blue-50/30 dark:bg-blue-900/10 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white">{selectedPlanDetails.name} Details</h3>
                        <span className="text-blue-600 font-bold">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div><p className="text-[10px] text-gray-400 font-bold uppercase">Duration</p><p className="text-sm font-semibold">{selectedPlanDetails.durationDays === 0 ? 'Lifetime' : `${selectedPlanDetails.durationDays} Days`}</p></div>
                        <div><p className="text-[10px] text-gray-400 font-bold uppercase">Min Withdraw</p><p className="text-sm font-semibold">{formatCurrency(selectedPlanDetails.minWithdraw, selectedPlanDetails.currency)}</p></div>
                        <div><p className="text-[10px] text-gray-400 font-bold uppercase">Direct Comm</p><p className="text-sm font-bold text-green-600">Up to {selectedPlanDetails.directCommissions?.[0]?.value || 0}%</p></div>
                        <div><p className="text-[10px] text-gray-400 font-bold uppercase">Indirect</p><p className="text-sm font-bold text-purple-600">{selectedPlanDetails.indirectCommissions.length} Levels</p></div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Earned</p>
                    <h3 className="text-2xl font-bold text-green-600">{formatCurrency(networkStats.earnings, currentUser.currency)}</h3>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-amber-600 uppercase font-bold">Held Balance</p>
                    <h3 className="text-2xl font-bold text-amber-600">{formatCurrency(currentUser.heldBalance, currentUser.currency)}</h3>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-bold">Direct Earnings</p>
                    <h3 className="text-2xl font-bold text-blue-600">{formatCurrency(networkStats.directEarnings, currentUser.currency)}</h3>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-bold">Indirect Earnings</p>
                    <h3 className="text-2xl font-bold text-purple-600">{formatCurrency(networkStats.indirectEarnings, currentUser.currency)}</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-wrap gap-2">
                    <button onClick={() => setViewMode('commissions')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'commissions' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 border dark:border-gray-700'}`}>Commission List ({directEarners.length + indirectEarners.length})</button>
                    <button onClick={() => setViewMode('tree')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'tree' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 border dark:border-gray-700'}`}>Tree View</button>
                    <button onClick={() => setViewMode('overflow')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'overflow' ? 'bg-red-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 border dark:border-gray-700'}`}>Overflow ({overflowReferrals.length})</button>
                    <button onClick={() => setViewMode('held')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'held' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 border dark:border-gray-700'}`}>Held Commissions ({heldCommissionsData.count})</button>
                    <button onClick={() => setViewMode('all')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 border dark:border-gray-700'}`}>All Referrals ({allNodes.length})</button>
                </div>
                <div className="p-4">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center uppercase tracking-wider text-xs"><span className="w-1.5 h-4 bg-blue-500 rounded-full mr-2"></span>Direct Referrals (Level 1)</h3><div className="space-y-3">{directEarners.length > 0 ? directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-gray-400 text-sm italic">No direct members.</p>}</div></div>
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center uppercase tracking-wider text-xs"><span className="w-1.5 h-4 bg-purple-500 rounded-full mr-2"></span>Indirect Team (Level 2+)</h3><div className="space-y-3">{indirectEarners.length > 0 ? indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-gray-400 text-sm italic">No indirect members.</p>}</div></div>
                        </div>
                    )}
                    {viewMode === 'tree' && (genealogyTree.length > 0 ? <ul className="space-y-4">{genealogyTree.map(node => renderTreeNode(node))}</ul> : <p className="text-center py-12 text-gray-400">No network found.</p>)}
                    {viewMode === 'overflow' && <div className="space-y-3">{overflowReferrals.length > 0 ? overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-center py-12 text-gray-400">No overflow referrals.</p>}</div>}
                    {viewMode === 'held' && <div className="space-y-3">{heldCommissionsData.referrals.length > 0 ? heldCommissionsData.referrals.map(u => <ReferralCardContent key={u._id} node={{user:u}} isHeldView={true} />) : <p className="text-center py-12 text-gray-400">No commissions held.</p>}</div>}
                    {viewMode === 'all' && <div className="space-y-3">{allNodes.length > 0 ? allNodes.map(node => <ReferralCardContent key={node.user._id} node={node} isAllView={true} />) : <p className="text-center py-12 text-gray-400">No referrals found.</p>}</div>}
                    {viewMode === 'inactive' && <div className="space-y-3">{inactiveReferrals.length > 0 ? inactiveReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-center py-12 text-gray-400">No inactive members.</p>}</div>}
                </div>
            </div>
        </div>
    );
};

export default Referrals;