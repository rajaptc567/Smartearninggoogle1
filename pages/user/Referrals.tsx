
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
    
    // View Tab State
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'inactive' | 'held' | 'all'>('commissions');

    // Sponsor Modal State
    const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
    const [selectedSponsor, setSelectedSponsor] = useState<User | null>(null);
    const [selectedReferralForSponsorModal, setSelectedReferralForSponsorModal] = useState<User | null>(null);

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

    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0 };
        const limit = selectedPlanDetails.directReferralLimit || 0;
        
        // Use unique user count where commission is either approved or pending (held) for accurate slot usage
        const used = users.filter(u => {
            const isSponsored = u.sponsor && u.sponsor.toLowerCase() === currentUser.username.toLowerCase();
            if (!isSponsored) return false;

            return transactions.some(t => 
                t.userId === currentUser._id &&
                t.sourceUserId === u._id &&
                t.type === 'Commission' &&
                (t.status === 'Approved' || (t.status === 'Pending' && t.description.toLowerCase().includes('hold'))) &&
                (t.relatedPlanId ? equivalentPlanIdsForSelected.has(String(t.relatedPlanId)) : false)
            );
        }).length;

        return { used, limit };
    }, [currentUser, selectedPlanDetails, users, transactions, equivalentPlanIdsForSelected]);

    const globalHeldData = useMemo(() => {
        if (!currentUser) return { referrals: [], count: 0, stats: new Map() };
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, planId?: string, planName?: string, amount: number, isHoldPosition?: boolean, slotDetail?: string }[] }>();
        transactions
            .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Pending')
            .forEach(t => {
                if (!t.sourceUserId) return;
                const current = pendingMap.get(t.sourceUserId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                let reason = "Pending Review";
                let isHoldPosition = false;
                let slotDetail = "";

                if (t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold')) {
                    reason = "Auto-Upgrade Reservation";
                    isHoldPosition = true;
                    const slotMatch = t.description.match(/Slot #(\d+)/i);
                    if (slotMatch) slotDetail = `Slot #${slotMatch[1]}`;
                } else if (currentUser.restrictions?.earning) {
                    reason = "Account Restricted";
                } else if (settings.requireActivePlanForCommission && (!currentUser.activePlans || currentUser.activePlans.length === 0)) {
                    reason = "No Active Plan";
                } else if (settings.requirePlanMatchForCommission && t.relatedPlanId) {
                     const reqIds = getEquivalentIds(String(t.relatedPlanId));
                     const hasMatch = currentUser.activePlans?.some(p => reqIds.has(String(p.planId)));
                     if (!hasMatch) {
                         reason = `Requires Upgrade`;
                     }
                }
                current.breakdown.push({ reason, amount: t.amount, isHoldPosition, slotDetail });
                pendingMap.set(t.sourceUserId, current);
            });
        const heldIds = Array.from(pendingMap.keys());
        return { referrals: users.filter(u => heldIds.includes(u._id)), count: heldIds.length, stats: pendingMap };
    }, [transactions, currentUser, settings, getEquivalentIds, users]);

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>): { earned: number; held: number; status?: string; earningSourcePlanId?: string, isHoldPosition?: boolean, isOverflow?: boolean, slotDetail?: string } => {
        if (!currentUser) return { earned: 0, held: 0 };
        const referralCommissions = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : false) 
        );
        const earned = referralCommissions.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = referralCommissions.filter(t => t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0);
        
        const holdTx = referralCommissions.find(t => t.status === 'Pending' && (t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold')));
        const isHoldPosition = !!holdTx;
        let slotDetail = "";
        if (holdTx) {
            const match = holdTx.description.match(/Slot #(\d+)/i);
            if (match) slotDetail = `Slot #${match[1]}`;
        }

        const isOverflow = referralCommissions.some(t => t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('full') || t.description.toLowerCase().includes('overflow')));
        
        let earningSourcePlanId: string | undefined;
        if (referralCommissions.length > 0) {
            earningSourcePlanId = referralCommissions[0].relatedPlanId?.toString();
        }
        return { earned, held, status: referralCommissions[0]?.status, earningSourcePlanId, isHoldPosition, isOverflow, slotDetail };
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
            // Updated condition: Include those with Approved earnings OR those with Held Hold Positions
            if (info.earned > 0 || info.held > 0) {
                if (node.level === 1) directEarnersList.push(node);
                else indirectEarnersList.push(node);
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } else if (!node.user.activePlans || node.user.activePlans.length === 0) {
                inactiveList.push(node);
            }
        });

        const relevantCommissions = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.status === 'Approved' && 
            (t.relatedPlanId ? equivalentPlanIdsForSelected.has(String(t.relatedPlanId)) : false) 
        );

        const totalEarnings = relevantCommissions.reduce((sum, t) => sum + t.amount, 0);
        const directEarnings = relevantCommissions.filter(t => t.level === 1).reduce((sum, t) => sum + t.amount, 0);
        
        const filterRecursive = (nodes: GenealogyNode[]): GenealogyNode[] => {
            return nodes.map(node => {
                const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
                // Include both earners and hold-positions in the tree view
                const isRelevant = info.earned > 0 || info.held > 0;
                const filteredChildren = filterRecursive(node.children);
                if (isRelevant) return { ...node, children: filteredChildren };
                else if (filteredChildren.length > 0) return { ...node, children: filteredChildren, isSkipped: true } as any; 
                return null;
            }).filter((n): n is GenealogyNode => n !== null);
        };

        return {
            genealogyTree: filterRecursive(fullGenealogyTree),
            directEarners: directEarnersList,
            indirectEarners: indirectEarnersList,
            overflowReferrals: overflowList,
            inactiveReferrals: inactiveList,
            allNodes: nodesList,
            networkStats: { 
                totalReferrals: nodesList.length,
                activeMembers: directEarnersList.length + indirectEarnersList.length,
                earnings: totalEarnings,
                directEarnings,
                indirectEarnings: totalEarnings - directEarnings
            }
        };
    }, [currentUser, users, transactions, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
        isHeldView?: boolean;
        isAllView?: boolean;
    }> = ({ node, isHeldView, isAllView }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        
        let earned = 0;
        let held = 0;
        let isHoldPosition = false;
        let isOverflow = false;
        let slotDetail = "";
        let earningSourcePlanId: string | undefined;

        if (isHeldView) {
            const stats = globalHeldData.stats.get(user._id);
            held = stats?.total || 0;
            isHoldPosition = stats?.breakdown.some(b => b.isHoldPosition) || false;
            slotDetail = stats?.breakdown.find(b => b.isHoldPosition)?.slotDetail || "";
        } else if (isAllView) {
            const allApproved = transactions.filter(t => t.userId === currentUser?._id && t.sourceUserId === user._id && t.status === 'Approved');
            earned = allApproved.reduce((sum, t) => sum + t.amount, 0);
            
            const holdTx = transactions.find(t => t.userId === currentUser?._id && t.sourceUserId === user._id && t.status === 'Pending' && (t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold')));
            if (holdTx) {
                isHoldPosition = true;
                held = holdTx.amount;
                const match = holdTx.description.match(/Slot #(\d+)/i);
                if (match) slotDetail = `Slot #${match[1]}`;
            }
            
            const overflowTx = transactions.find(t => t.userId === currentUser?._id && t.sourceUserId === user._id && t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('full') || t.description.toLowerCase().includes('overflow')));
            if (overflowTx) isOverflow = true;
        } else {
            const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
            earned = info.earned;
            held = info.held;
            isHoldPosition = info.isHoldPosition || false;
            isOverflow = info.isOverflow || false;
            slotDetail = info.slotDetail || "";
            earningSourcePlanId = info.earningSourcePlanId;
        }

        const isDirect = level === 1;
        const sourcePlan = earningSourcePlanId ? investmentPlans.find(p => p._id === String(earningSourcePlanId)) : null;

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${isHoldPosition ? 'border-l-amber-500' : isOverflow ? 'border-l-orange-500' : 'border-l-blue-500'} p-4 transition-all hover:shadow-md`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.username}</h4>
                                {level && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-blue-100 text-blue-800">{isDirect ? 'Direct' : `Level ${level}`}</span>}
                                {isHoldPosition && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-200 flex items-center gap-1"><span className="text-xs">🔒</span> Hold {slotDetail}</span>}
                                {isOverflow && <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold uppercase border border-orange-200 flex items-center gap-1"><span className="text-xs">⚠️</span> Overflow</span>}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {isAllView || viewMode === 'commissions' || viewMode === 'tree' ? (
                                    isHoldPosition ? (
                                        <p className="text-amber-600 font-medium">Reserved for Auto-Upgrade {slotDetail ? `(${slotDetail})` : ''}</p>
                                    ) : isOverflow ? (
                                        <p className="text-orange-600 font-medium">Missed (Slot Limit Reached)</p>
                                    ) : earned > 0 ? (
                                        <p className="text-green-600">Active Commission Source</p>
                                    ) : (
                                        <p className="text-gray-400">No qualifying commission yet</p>
                                    )
                                ) : (
                                    sourcePlan ? <p className="text-green-600">Plan: {sourcePlan.name}</p> : <p className="text-gray-400">{isOverflow ? 'Slots full for this plan' : 'No qualifying purchase'}</p>
                                )}
                                <p className="mt-1">Joined: {new Date(user.registrationDate).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto text-right">
                        {earned > 0 && (
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Earned</p>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(earned, currentUser?.currency)}</p>
                            </div>
                        )}
                        {held > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded border border-amber-100 dark:border-amber-800">
                                <p className="text-[10px] uppercase text-amber-800 dark:text-amber-200 font-bold tracking-wider">{isHoldPosition ? 'Upgrade Hold' : 'Pending'}</p>
                                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(held, currentUser?.currency)}</p>
                            </div>
                        )}
                        {isOverflow && earned === 0 && !isHoldPosition && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded border border-orange-100 dark:border-orange-800">
                                <p className="text-[10px] uppercase text-orange-800 dark:text-orange-200 font-bold tracking-wider">Missed</p>
                                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(0, currentUser?.currency)}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (!currentUser) return <div className="p-10 text-center text-gray-500">Loading network...</div>;

    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Network</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track your team and commissions across all tiers.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/member/transactions')}>Full History</Button>
            </div>

            {uniqueActivePlans.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-x-auto gap-2">
                    {uniqueActivePlans.map(plan => (
                        <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[140px] py-2 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap border ${selectedPlanId === plan.planId ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}>{plan.planName}</button>
                    ))}
                </div>
            ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3"><span>⚠️</span><div><h3 className="font-bold text-yellow-800 dark:text-yellow-200">No Active Plans</h3><p className="text-xs">Buy a plan to start earning commissions.</p></div></div>
                    <Button size="sm" onClick={() => navigate('/member/plans')}>Buy Plan</Button>
                </div>
            )}

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-4 bg-blue-50/30 dark:bg-blue-900/10 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">Active Direct Slots: {selectedPlanDetails.name}</h4>
                            <span className={`text-sm font-bold ${slotStats.limit > 0 && slotStats.used >= slotStats.limit ? 'text-red-600' : 'text-blue-600'}`}>{slotStats.used} / {slotStats.limit === 0 ? '∞' : slotStats.limit} used</span>
                        </div>
                        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${slotStats.limit > 0 && slotStats.used >= slotStats.limit ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${slotStats.limit === 0 ? 100 : Math.min(100, (slotStats.used / slotStats.limit) * 100)}%` }}></div>
                        </div>
                        {slotStats.limit > 0 && slotStats.used >= slotStats.limit && <p className="text-[10px] text-red-500 font-bold mt-2 animate-pulse uppercase">Slots full - Further direct referrals will be Overflow (Missed Commissions).</p>}
                    </div>
                </div>
            )}

            <ShareButtons url={referralLink} title="Join my network on SmartEarning!" />

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2">
                    <button onClick={() => setViewMode('commissions')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'commissions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700'}`}>Commission List ({directEarners.length + indirectEarners.length})</button>
                    <button onClick={() => setViewMode('tree')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700'}`}>Tree View ({genealogyTree.length})</button>
                    <button onClick={() => setViewMode('overflow')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'overflow' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700'}`}>Overflow ({overflowReferrals.length})</button>
                    <button onClick={() => setViewMode('all')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700'}`}>All Referrals ({allNodes.length})</button>
                    <button onClick={() => setViewMode('held')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'held' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700'}`}>Global Held ({globalHeldData.count})</button>
                </div>
                <div className="p-4 md:p-6 overflow-x-auto">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-blue-500 rounded-full mr-2"></span>Direct Team (Earned & Held)</h3>{directEarners.length > 0 ? <div className="space-y-3">{directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />)}</div> : <p className="text-gray-400 text-sm">No qualifying direct commissions.</p>}</div>
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-purple-500 rounded-full mr-2"></span>Indirect Team</h3>{indirectEarners.length > 0 ? <div className="space-y-3">{indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />)}</div> : <p className="text-gray-400 text-sm">No qualifying indirect commissions.</p>}</div>
                        </div>
                    )}
                    {viewMode === 'tree' && (
                        <div className="space-y-4">
                           {genealogyTree.length > 0 ? (
                               <ul className="space-y-4">
                                   {genealogyTree.map(node => (
                                       <li key={node.user._id}>
                                           <ReferralCardContent node={node} />
                                           {node.children.length > 0 && (
                                               <ul className="ml-8 mt-4 space-y-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                                                   {node.children.map(child => (
                                                       <li key={child.user._id}><ReferralCardContent node={child} /></li>
                                                   ))}
                                               </ul>
                                           )}
                                       </li>
                                   ))}
                               </ul>
                           ) : <p className="text-center py-12 text-gray-400">No earning network for this plan.</p>}
                        </div>
                    )}
                    {viewMode === 'overflow' && (
                        <div className="space-y-3">
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg mb-4 flex gap-3 items-start"><span className="text-xl">⚠️</span><div><h4 className="font-bold text-orange-800 text-sm">Overflow Explanation</h4><p className="text-xs text-orange-700 mt-1">These direct referrals joined when your direct slots for the selected plan level were full. You can earn from them if they upgrade to a higher plan level where you have open slots.</p></div></div>
                            {overflowReferrals.length > 0 ? overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-center text-gray-400 py-12">No overflow referrals found.</p>}
                        </div>
                    )}
                    {viewMode === 'all' && <div className="space-y-3">{allNodes.length > 0 ? allNodes.map(node => <ReferralCardContent key={node.user._id} node={node} isAllView={true} />) : <p className="text-center text-gray-400 py-12">Network is empty.</p>}</div>}
                    {viewMode === 'held' && <div className="space-y-3">{globalHeldData.referrals.length > 0 ? globalHeldData.referrals.map(user => <ReferralCardContent key={user._id} node={{user}} isHeldView={true} />) : <p className="text-center text-gray-400 py-12">No held commissions.</p>}</div>}
                </div>
            </div>
        </div>
    );
};

export default Referrals;
