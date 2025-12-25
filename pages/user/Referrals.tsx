
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

    useEffect(() => {
        if (highlightedUserId && viewMode === 'tree') {
            setTimeout(() => {
                const element = document.getElementById(`node-${highlightedUserId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }, [highlightedUserId, viewMode]);
    
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

    // Robust matching for hold positions
    const isTransactionHoldPosition = (t: Transaction) => {
        const desc = t.description?.toLowerCase() || '';
        // Explicitly check for Hold Commission keyword set in backend
        const isHeldStatus = t.status === 'Pending' || t.status === 'Approved';
        const hasKeywords = desc.includes('hold commission') || desc.includes('reserved') || desc.includes('upgrade');
        return isHeldStatus && hasKeywords;
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>): { earned: number; held: number; status?: string; earningSourcePlanId?: string, isHoldPosition?: boolean, isOverflow?: boolean } => {
        if (!currentUser) return { earned: 0, held: 0 };
        
        const referralComms = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : false) 
        );

        const earned = referralComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = referralComms.filter(t => t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0);
        
        // Priority: Strictly distinguish isHoldPosition vs isOverflow
        const isHoldPosition = referralComms.some(t => isTransactionHoldPosition(t));
        
        const hasOverflowTx = referralComms.some(t => t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('overflow')));
        
        // isOverflow: Only if NOT a hold position and has rejected 0 amount with no valid earnings/holds
        const isOverflow = hasOverflowTx && !isHoldPosition && earned === 0 && held === 0;
        
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
            
            // PRIORITY ORDER:
            // 1. Hold Position or Active Commission -> Earner List
            if (info.earned > 0 || info.held > 0 || info.isHoldPosition) {
                if (node.level === 1) directEarnersList.push(node);
                else indirectEarnersList.push(node);
            } 
            // 2. Overflow (only if NOT hold position) -> Overflow List
            else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } 
            // 3. Inactive
            else {
                if (!node.user.activePlans || node.user.activePlans.length === 0) {
                    inactiveList.push(node);
                }
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
        const indirectEarnings = totalEarnings - directEarnings;

        const filterRecursive = (nodes: GenealogyNode[]): GenealogyNode[] => {
            return nodes.map(node => {
                const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
                const isRelevant = info.earned > 0 || info.held > 0 || info.isHoldPosition;
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
                indirectEarnings
            }
        };
    }, [currentUser, users, transactions, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0 };
        const limit = selectedPlanDetails.directReferralLimit || 0;
        
        // Slot usage includes Paid, Held (Pending), AND Overflow (Rejected 0.00)
        // because all of them consume a physical direct slot position.
        const used = directEarners.length + overflowReferrals.length;

        return { used, limit };
    }, [currentUser, selectedPlanDetails, directEarners, overflowReferrals]);

    const heldCommissionsData = useMemo(() => {
        if (!currentUser || !selectedPlanId) return { referrals: [], count: 0, stats: new Map() };
        
        const filterIds = getEquivalentIds(selectedPlanId);
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, planId?: string, planName?: string, amount: number, isHoldPosition?: boolean }[] }>();
        
        transactions
            .filter(t => 
                t.userId === currentUser._id && 
                t.type === 'Commission' && 
                t.status === 'Pending' &&
                (t.relatedPlanId ? filterIds.has(String(t.relatedPlanId)) : true) 
            )
            .forEach(t => {
                if (!t.sourceUserId) return;
                const current = pendingMap.get(t.sourceUserId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                let reason = "Pending Review";
                let missingPlanId = undefined;
                let missingPlanName = undefined;
                let isHoldPosition = false;

                if (isTransactionHoldPosition(t)) {
                    reason = "Hold Commission for upgrade";
                    isHoldPosition = true;
                } else if (currentUser.restrictions?.earning) {
                    reason = "Account Restricted";
                } else if (settings.requireActivePlanForCommission && (!currentUser.activePlans || currentUser.activePlans.length === 0)) {
                    reason = "No Active Plan";
                } else if (settings.requirePlanMatchForCommission && t.relatedPlanId) {
                     const reqIds = getEquivalentIds(String(t.relatedPlanId));
                     const hasMatch = currentUser.activePlans?.some(p => reqIds.has(String(p.planId)));
                     if (!hasMatch) {
                         let targetPlan = investmentPlans.find(p => p._id === String(t.relatedPlanId));
                         reason = `Requires Upgrade to ${targetPlan?.name || 'Higher Plan'}`;
                     }
                }
                current.breakdown.push({ reason, planId: missingPlanId, planName: missingPlanName, amount: t.amount, isHoldPosition });
                pendingMap.set(t.sourceUserId, current);
            });
        const heldIds = Array.from(pendingMap.keys());
        const referrals = users.filter(u => heldIds.includes(u._id));
        return { referrals, count: referrals.length, stats: pendingMap };
    }, [transactions, currentUser, settings, investmentPlans, getEquivalentIds, users, selectedPlanId]);

    const toggleNode = (userId: string) => {
        setCollapsedNodes(prev => { const newSet = new Set(prev); if (newSet.has(userId)) newSet.delete(userId); else newSet.add(userId); return newSet; });
    };

    const handleSponsorClick = (sponsorUsername: string, referralNode: User) => {
        const sponsor = users.find(u => u.username.toLowerCase() === sponsorUsername.toLowerCase());
        if (sponsor) {
            setSelectedSponsor(sponsor);
            setSelectedReferralForSponsorModal(referralNode);
            setIsSponsorModalOpen(true);
        }
    };

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
        let earned = info.earned;
        let held = info.held;
        let isHoldPosition = info.isHoldPosition;
        let isOverflow = info.isOverflow;
        let breakdown: any[] = [];

        if (isHeldView) {
            const stats = heldCommissionsData.stats.get(user._id);
            held = stats?.total || 0;
            breakdown = stats?.breakdown || [];
            isHoldPosition = breakdown.some(b => b.isHoldPosition);
        }

        const isDirect = level === 1;
        const cardBorderClass = isDirect ? 'border-l-blue-500' : 'border-l-purple-500';
        const levelBadgeColor = isDirect ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
        const sourcePlan = info.earningSourcePlanId ? investmentPlans.find(p => p._id === String(info.earningSourcePlanId)) : null;

        return (
            <div id={`node-${user._id}`} className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${isHoldPosition ? 'border-l-amber-500 bg-amber-50/5' : isOverflow ? 'border-l-orange-500' : cardBorderClass} transition-all duration-200 hover:shadow-md`}>
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                        {isTree && hasChildren && toggleNode ? (
                            <button onClick={() => toggleNode(user._id)} className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900">
                                {collapsedNodes.has(user._id) ? '+' : '−'}
                            </button>
                        ) : (
                            <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                        )}
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.username}</h4>
                                {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${levelBadgeColor}`}>{isDirect ? 'Direct' : `Level ${level}`}</span>}
                                {isHoldPosition ? (
                                    <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-sm border border-amber-600">
                                        <span className="text-xs">🔒</span> Hold Commission for upgrade
                                    </span>
                                ) : isOverflow ? (
                                    <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold uppercase border border-orange-200 flex items-center gap-1">
                                        <span className="text-xs">⚠️</span> Overflow
                                    </span>
                                ) : held > 0 ? (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase border border-blue-200">Pending</span>
                                ) : null}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                {sourcePlan ? (
                                    <p className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                                        <span>Qualifying Plan: {sourcePlan.name}</span>
                                    </p>
                                ) : <p className="text-gray-400">{isHoldPosition ? 'Hold Commission for upgrade' : isOverflow ? 'Slots full for this plan level' : 'No qualifying purchase'}</p>}
                                {user.sponsor && <p className="flex items-center gap-1"><span>Via:</span><button onClick={() => handleSponsorClick(user.sponsor!, user)} className="text-blue-500 hover:underline">@{user.sponsor}</button></p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto text-right pl-9 sm:pl-0">
                        {isOverflow ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded border border-orange-100">
                                <p className="text-[10px] uppercase text-orange-800 font-bold tracking-wider">Missed</p>
                                <p className="text-lg font-bold text-orange-600">{formatCurrency(0, currentUser?.currency)}</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Commission</p>
                                <p className={`text-lg font-bold ${isHoldPosition ? 'text-amber-600' : 'text-green-600'}`}>
                                    {formatCurrency(isHoldPosition ? held : earned, currentUser?.currency)}
                                </p>
                            </div>
                        )}
                        {isHeldView && breakdown.length > 0 && (
                            <div className="mt-2 text-[10px] text-gray-400 italic">
                                {breakdown.map((b, i) => <div key={i}>{b.reason}: {formatCurrency(b.amount, currentUser?.currency)}</div>)}
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track your team growth and upgrade-strategy progress.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border dark:border-gray-700 flex overflow-x-auto gap-2">
                {uniqueActivePlans.map(plan => (
                    <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[140px] py-2 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap border ${selectedPlanId === plan.planId ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent border-transparent text-gray-600 dark:text-gray-400'}`}>{plan.planName}</button>
                ))}
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 animate-fade-in">
                    <div className="flex flex-col md:flex-row">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b md:border-r dark:border-gray-700 flex flex-row md:flex-col justify-between items-center gap-2 md:w-48 text-center shrink-0">
                            <div><h3 className="font-bold text-lg leading-tight">{selectedPlanDetails.name}</h3><span className="text-[10px] uppercase text-gray-400 font-bold">Plan Track</span></div>
                            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span>
                        </div>
                        <div className="flex-1 p-6">
                            <div className="flex justify-between items-center mb-2"><h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">Active Direct Referrals</h4><span className="text-sm font-bold text-blue-600">Slots: {slotStats.used} / {slotStats.limit || '∞'} used</span></div>
                            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-1000 ease-out ${slotStats.limit > 0 && slotStats.used >= slotStats.limit ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} style={{ width: `${slotStats.limit === 0 ? 100 : Math.min(100, (slotStats.used / slotStats.limit) * 100)}%` }}></div></div>
                            {slotStats.limit > 0 && slotStats.used >= slotStats.limit && <p className="text-[10px] text-red-500 font-bold mt-2 uppercase">Limit Reached - Next referrals will be Overflow.</p>}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2">
                    {([['commissions', `Team Contributors (${directEarners.length + indirectEarners.length})`], ['overflow', `Overflow & Waiting (${overflowReferrals.length})`], ['held', `Hold for Upgrade (${heldCommissionsData.count})`]] as const).map(([mode, label]) => (
                        <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}>{label}</button>
                    ))}
                </div>
                <div className="p-6">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-blue-500 rounded-full mr-2"></span>Direct Referrals</h3>
                                {directEarners.length > 0 ? directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="p-8 text-center text-gray-400 italic text-sm">No direct contributors.</div>}
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-purple-500 rounded-full mr-2"></span>Indirect Team</h3>
                                {indirectEarners.length > 0 ? indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="p-8 text-center text-gray-400 italic text-sm">No indirect contributors.</div>}
                            </div>
                        </div>
                    )}
                    {viewMode === 'overflow' && (
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-800 dark:text-orange-200">These direct referrals joined when your direct slots for the current plan track were full. You can only earn from them if you upgrade to a higher plan level with open slots.</div>
                            {overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />)}
                        </div>
                    )}
                    {viewMode === 'held' && (
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 font-medium">Strategic Hold commissions specifically reserved for your next plan upgrade. Once enough funds are collected, you can trigger an automatic upgrade to the next tier.</div>
                            {heldCommissionsData.referrals.map(user => <ReferralCardContent key={user._id} node={{user}} isHeldView={true} />)}
                        </div>
                    )}
                </div>
            </div>
            <ShareButtons url={referralLink} title="Join SmartEarning and start building your financial future today!" />
        </div>
    );
};

export default Referrals;
