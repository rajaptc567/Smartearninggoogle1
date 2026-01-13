
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan, Transaction, currencySymbols, Currency } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import ShareButtons from '../../components/ui/ShareButtons';

interface GenealogyNode {
    user: User;
    children: GenealogyNode[];
    level: number;
}

const Referrals: React.FC = () => {
    const { state, dispatch } = useData();
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
    
    const [viewMode, setViewMode] = useState<'earning' | 'all' | 'held' | 'tree' | 'overflow' | 'inactive'>('earning');

    const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
    const [selectedSponsor, setSelectedSponsor] = useState<User | null>(null);

    const prevPlanId = useRef(selectedPlanId);

    const isUserInactive = useMemo(() => {
      return !currentUser?.activePlans || currentUser.activePlans.length === 0;
    }, [currentUser]);

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
            prevPlanId.current = uniqueActivePlans[0].planId;
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
    useEffect(() => {
        if (selectedPlanId && selectedPlanId !== prevPlanId.current) {
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

    const getRequiredPlanForCommission = useCallback((relatedPlanId?: string) => {
        if (!relatedPlanId || !currentUser) return null;
        let targetPlan = investmentPlans.find(p => p._id === String(relatedPlanId));
        
        if (settings.planEquivalencyGroups) {
            const group = settings.planEquivalencyGroups.find(g => 
                String(g.usdPlanId) === String(relatedPlanId) || 
                String(g.pkrPlanId) === String(relatedPlanId) || 
                String(g.eurPlanId) === String(relatedPlanId)
            );
            if (group) {
                const targetKey = `${currentUser.currency.toLowerCase()}PlanId` as keyof typeof group;
                if (group[targetKey]) {
                    const localPlan = investmentPlans.find(p => p._id === String(group[targetKey]));
                    if (localPlan) targetPlan = localPlan;
                }
            }
        }
        return targetPlan;
    }, [investmentPlans, settings.planEquivalencyGroups, currentUser]);

    const isTransactionOverflow = (t: Transaction) => {
        const desc = t.description?.toLowerCase() || '';
        return desc.includes('overflow');
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>) => {
        if (!currentUser) return { earned: 0, held: 0, overflow: 0, history: [], isRecurringReferral: false, shouldRemoveCompletely: false, statusText: '', level: 0, relatedPlanId: null, isOverflow: false };
        
        const findLevel = (sponsor: string, targetId: string, currentLvl: number): number => {
            const directs = users.filter(u => u.sponsor === sponsor);
            if (directs.some(u => u._id === targetId)) return currentLvl;
            for (const d of directs) {
                const lvl = findLevel(d.username, targetId, currentLvl + 1);
                if (lvl > 0) return lvl;
            }
            return 0;
        };
        const level = findLevel(currentUser.username, referral._id, 1);

        const referralComms = transactions
            .filter(t => 
                String(t.userId) === String(currentUser._id) &&
                t.type === 'Commission' &&
                t.sourceUserId && String(t.sourceUserId) === String(referral._id)
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Context-aware grouping (THIS SCOPE ONLY)
        const contextComms = referralComms.filter(t => {
            if (contextPlanIds.size === 0) return true;
            if (!t.relatedPlanId) return false;
            return contextPlanIds.has(String(t.relatedPlanId));
        });

        const earned = contextComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = contextComms.filter(t => t.status === 'Pending' && !isTransactionOverflow(t)).reduce((sum, t) => sum + t.amount, 0);
        const overflow = contextComms.filter(t => isTransactionOverflow(t)).reduce((sum, t) => sum + t.amount, 0);
        
        // REFINED LOGIC: A referral is only an "Overflow Ref" in this scope if they have
        // triggered an overflow AND have ZERO valid earnings (earned or held) in this scope.
        const isOverflow = (overflow > 0) && (earned === 0 && held === 0);

        const oldestComm = [...referralComms].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).find(t => t.level === 1);
        const recurringPlanIds = settings.recurringCommissionPlanIds || [];
        const isRecurringReferral = !!(oldestComm?.relatedPlanId && recurringPlanIds.includes(String(oldestComm.relatedPlanId)));

        const pendingComm = contextComms.find(t => t.status === 'Pending');
        const relatedPlanId = pendingComm ? String(pendingComm.relatedPlanId) : null;

        const hasPaidElseWhere = referralComms.some(t => 
            t.status === 'Approved' && (!t.relatedPlanId || !contextPlanIds.has(String(t.relatedPlanId)))
        );

        const isOneTimeBlocked = settings.oneTimeCommissionPerGroup && hasPaidElseWhere && !isRecurringReferral;
        const shouldRemoveCompletely = isOneTimeBlocked && (earned + held === 0);
        
        // Context-Aware Status Text
        let statusText = 'Eligible Team Member';
        const isActiveGlobally = referral.activePlans && referral.activePlans.length > 0;
        const isActiveInScope = referral.activePlans?.some(p => contextPlanIds.has(String(p.planId)));

        if (isActiveInScope) statusText = 'Active Scope Contributor';
        else if (isActiveGlobally) statusText = 'Active in Different Plan';
        
        if (isOneTimeBlocked) statusText = 'One-Time Payout Consumed';
        if (isOverflow) statusText = 'You can still earn from this referral when a slot is available in any higher plan and your referral buys that plan, then you get commission.';

        return { earned, held, overflow, history: contextComms, isOverflow, isRecurringReferral, shouldRemoveCompletely, statusText, level, relatedPlanId };
    }, [currentUser, transactions, settings, users]);

    const heldCommissionsData = useMemo(() => {
        if (!currentUser) return { referrals: [], stats: new Map() };
        
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, isOverflow: boolean, planId?: string, planName?: string, amount: number, date: string, txId: string }[] }>();
        
        transactions
            .filter(t => 
                String(t.userId) === String(currentUser._id) && 
                t.type === 'Commission' && 
                t.status === 'Pending'
            )
            .forEach(t => {
                if (!t.sourceUserId) return;
                const srcId = String(t.sourceUserId);
                const current = pendingMap.get(srcId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                
                let reason = "Pending Verification";
                let isOverflow = t.description.toLowerCase().includes('overflow');
                let missingPlanId = undefined;
                let missingPlanName = undefined;

                if (t.relatedPlanId) {
                    let targetPlan = getRequiredPlanForCommission(String(t.relatedPlanId));
                    missingPlanName = targetPlan?.name || 'Required Rank';
                    missingPlanId = targetPlan?._id;
                }

                if (isOverflow) {
                    reason = `Slot Limit reached for ${missingPlanName}`;
                } else if (currentUser.restrictions?.earning) {
                    reason = "Account Earning Restricted";
                } else if (settings.requireActivePlanForCommission && (!currentUser.activePlans || currentUser.activePlans.length === 0)) {
                    reason = "Purchase Required to Release";
                } else if (settings.requirePlanMatchForCommission && missingPlanName) {
                     reason = `Upgrade to ${missingPlanName} needed`;
                }
                
                current.breakdown.push({ reason, isOverflow, planId: missingPlanId, planName: missingPlanName, amount: t.amount, date: t.date, txId: t._id });
                pendingMap.set(srcId, current);
            });
            
        const referrals = users.filter(u => pendingMap.has(u._id));
        return { referrals, stats: pendingMap };
    }, [transactions, currentUser, settings, investmentPlans, users, getRequiredPlanForCommission]);

    const { genealogyTree, directEarners, indirectEarners, overflowReferrals, inactiveReferrals, allNodes, scopeStats } = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], directEarners: [], indirectEarners: [], overflowReferrals: [], inactiveReferrals: [], allNodes: [], scopeStats: { earned: 0, held: 0, directCount: 0, indirectCount: 0 } };

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

        const directEarnersList: any[] = [];
        const indirectEarnersList: any[] = [];
        const overflowList: any[] = [];
        const inactiveList: any[] = [];
        let earnedSum = 0;
        let heldSum = 0;
        let directCount = 0;
        let indirectCount = 0;

        nodesList.forEach(node => {
            const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            if (info.shouldRemoveCompletely) return;

            // Distribution to specific tabs
            if (info.isOverflow) {
                overflowList.push({ ...node, info });
            } else {
                const isActive = node.user.activePlans && node.user.activePlans.length > 0;
                
                // Member counts for stats (only if not overflow)
                earnedSum += info.earned;
                heldSum += info.held;
                if (info.level === 1) directCount++;
                else indirectCount++;

                // If they generated REAL (Approved) commission, they go to Earning Tab
                if (info.earned > 0) {
                    if (info.level === 1) directEarnersList.push({ ...node, info });
                    else indirectEarnersList.push({ ...node, info });
                } else if (!isActive) {
                    inactiveList.push({ ...node, info });
                }
            }
        });

        // "All Referral" tab logic: Strictly show contributors to THIS specific scope.
        // User requested: don't show overflow refs from other scopes here.
        const filteredAllNodes = nodesList.map(node => ({
            ...node,
            info: getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected)
        })).filter(n => 
            !n.info.shouldRemoveCompletely && 
            (n.info.earned > 0 || n.info.held > 0) && // Must have some financial contribution in THIS scope
            n.info.overflow === 0 // Must NOT be an overflowed ref in THIS scope
        );

        // "Ref Tree" logic: synchronized with contribution logic
        const filterRecursive = (nodes: GenealogyNode[]): GenealogyNode[] => {
            return nodes.map(node => {
                const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
                if (info.shouldRemoveCompletely || info.isOverflow) return null;
                
                const filteredChildren = filterRecursive(node.children);
                const hasPaidChild = filteredChildren.length > 0;
                const hasPaidSelf = info.earned > 0 || info.held > 0;
                
                if (hasPaidSelf || hasPaidChild) {
                    return { ...node, children: filteredChildren };
                }
                return null;
            }).filter((n): n is GenealogyNode => n !== null);
        };

        return { 
            genealogyTree: filterRecursive(fullGenealogyTree), 
            directEarners: directEarnersList, 
            indirectEarners: indirectEarnersList, 
            overflowReferrals: overflowList, 
            inactiveReferrals: inactiveList, 
            allNodes: filteredAllNodes,
            scopeStats: { earned: earnedSum, held: heldSum, directCount, indirectCount }
        };
    }, [currentUser, users, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number, info?: any };
        isHeldView?: boolean;
        showHeldAlert?: boolean;
    }> = ({ node, isHeldView, showHeldAlert = false }) => {
        const { user } = node;
        const info = node.info || getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        const level = node.level || info.level;
        const isDirect = level === 1;

        const heldStats = heldCommissionsData.stats.get(user._id);
        const totalHeldGlobal = heldStats?.total || 0;
        const globalHistory = heldStats?.breakdown || [];
        
        const historyToShow = isHeldView ? globalHistory : info.history;
        
        // Amount logic
        const amountToShow = isHeldView ? totalHeldGlobal : (info.isOverflow ? info.overflow : info.earned);
        
        const hasHeld = totalHeldGlobal > 0;
        const isOverflow = info.isOverflow;

        const requiredPlan = getRequiredPlanForCommission(info.relatedPlanId);
        const symbol = currencySymbols[currentUser?.currency || 'USD'];

        return (
            <div className={`relative bg-[#0f172a] dark:bg-gray-800 rounded-[2.5rem] shadow-sm border transition-all duration-200 overflow-hidden group 
                ${(isHeldView || hasHeld) ? 'border-orange-500 ring-2 ring-orange-500/20' : isOverflow ? 'border-red-500 ring-2 ring-red-500/10' : 'border-gray-800 dark:border-gray-700'} 
                ${highlightedUserId === user._id ? 'border-blue-400 ring-2 ring-blue-400' : ''} 
                border-l-8 ${isHeldView || hasHeld ? 'border-l-orange-500' : isOverflow ? 'border-l-red-500' : isDirect ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
                
                {isOverflow && (
                    <div className="bg-red-600 text-white py-1.5 px-4 text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Direct Referral Limit Reached</span>
                    </div>
                )}

                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl ${isHeldView || hasHeld ? 'bg-orange-100 text-orange-600' : isOverflow ? 'bg-red-100 text-red-600' : isDirect ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-white flex items-center gap-2 text-xl">
                                    {user.username}
                                    {info.isRecurringReferral && !isHeldView && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center gap-1 shadow-sm">🔄 Recurring</span>}
                                    {(showHeldAlert || isHeldView) && hasHeld && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" title="Has locked commissions!"></span></span>}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className={`px-4 py-1 rounded-full font-black uppercase text-[11px] tracking-wider ${isHeldView || hasHeld ? 'bg-orange-500 text-white' : isOverflow ? 'bg-red-600 text-white' : isDirect ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                                        {isDirect ? 'DIRECT TEAM' : `NETWORK LEVEL ${level}`}
                                    </span>
                                    <span className="text-sm text-gray-400 font-medium">@{user.username} • {user.fullName}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-[11px] uppercase font-black tracking-[0.1em] mb-1 ${isHeldView || hasHeld ? 'text-orange-500' : isOverflow ? 'text-red-500' : 'text-gray-500'}`}>
                                {isHeldView || hasHeld ? 'LOCKED FUNDS' : isOverflow ? 'OVERFLOW LOST' : 'TOTAL EARNED'}
                            </p>
                            <p className={`text-2xl md:text-3xl font-black ${isHeldView || hasHeld ? 'text-orange-500' : isOverflow ? 'text-red-500' : 'text-[#22c55e]'}`}>
                                <span className="text-lg mr-1">{symbol}</span>
                                {amountToShow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                {isHeldView || hasHeld ? 'LOCK REASONS & ROADMAP' : 'EARNING TIMELINE BREAKDOWN'}
                            </p>
                            {info.held > 0 && !isHeldView && (
                                <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-tighter">Held: {formatCurrency(info.held, currentUser?.currency)}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-2.5">
                            {historyToShow && historyToShow.length > 0 ? historyToShow.map((item: any) => (
                                <div key={item._id || item.txId} className={`flex justify-between items-center p-4 bg-[#1f2937] dark:bg-gray-900 rounded-2xl border ${item.status === 'Pending' ? 'border-orange-500/30' : 'border-gray-800'} text-[13px] group/item hover:border-gray-600 transition-all shadow-sm`}>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`w-2 h-2 rounded-full ${item.status === 'Approved' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                                            <span className="font-bold text-gray-200">
                                                {isHeldView ? item.reason : item.description.split('from')[0].trim()}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-gray-500 mt-1 ml-4.5 font-medium">
                                            {new Date(item.date).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className={`font-black ${item.status === 'Approved' ? 'text-[#22c55e]' : 'text-orange-500'}`}>
                                            <span className="text-[10px] mr-0.5">{symbol}</span>
                                            {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        {item.status === 'Pending' && item.planId && !isOverflow && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); navigate('/member/plans', { state: { highlightPlanId: item.planId } }); }}
                                                className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-1 hover:underline flex items-center gap-1"
                                            >
                                                Unlock Tier &rarr;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-6 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">
                                    <p className="text-sm italic text-gray-500 font-medium">{info.statusText}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {(isHeldView || hasHeld) && !isOverflow && (
                        <div className="mt-6 p-5 bg-orange-500/10 border border-orange-500/30 rounded-[1.5rem] shadow-lg">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">UNLOCK REQUIREMENT FOUND</p>
                                    <p className="text-sm font-bold text-white">Requirement: <span className="text-orange-400">{requiredPlan?.name || 'Higher Tier'}</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-500 uppercase">VALUE AT STAKE</p>
                                    <p className="text-lg font-black text-orange-500">{formatCurrency(totalHeldGlobal, currentUser?.currency)}</p>
                                </div>
                            </div>
                            <button 
                                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-xl shadow-orange-600/20 flex items-center justify-center gap-2"
                                onClick={() => navigate('/member/plans', { state: { highlightPlanId: requiredPlan?._id } })}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Buy to Unlock Commission &rarr;
                            </button>
                        </div>
                    )}

                    <div className="mt-6 flex justify-between items-center text-[11px] font-black uppercase tracking-[0.2em] pt-5 border-t border-gray-800/50">
                        <span className="text-gray-500">{info.statusText}</span>
                        <button onClick={() => { setSelectedSponsor(users.find(u => u.username === user.sponsor) || null); if(user.sponsor) setIsSponsorModalOpen(true); }} className="text-blue-500 hover:text-blue-400">Referrer: @{user.sponsor || 'Direct'}</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderTreeNode = (node: GenealogyNode) => {
        const isCollapsed = collapsedNodes.has(node.user._id);
        const hasChildren = node.children.length > 0;
        return (
            <li key={node.user._id} className="relative pl-10 pt-6">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-800 -ml-4 rounded-full"></div>
                <div className="absolute left-0 top-16 w-8 h-1 bg-gray-800 -ml-4 rounded-full"></div>
                <div className="mb-6 max-w-2xl shadow-xl"><ReferralCardContent node={node} showHeldAlert={true} /></div>
                {hasChildren && !isCollapsed && <ul className="ml-6">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };

    if (!currentUser) return null;

    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;
    
    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-20 px-4">
            {isUserInactive && (
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[3rem] text-white shadow-2xl border border-white/10 flex flex-col md:flex-row items-center gap-8 animate-fade-in relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-[2rem] flex items-center justify-center text-4xl shrink-0 shadow-inner">
                        🛡️
                    </div>
                    
                    <div className="flex-grow text-center md:text-left relative z-10">
                        <h4 className="text-2xl font-black uppercase tracking-tighter">Earnings Eligibility Warning</h4>
                        <p className="text-blue-100/80 mt-2 font-medium leading-relaxed">
                            You currently have <strong className="text-white">no active plans</strong>. You can build your network and invite friends, but all referral commissions will be <strong className="underline decoration-wavy decoration-white/40 underline-offset-4">Locked (Held)</strong> until you purchase a plan. Unlock your earning potential today!
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => navigate('/member/plans')}
                        className="bg-white text-blue-600 px-8 py-4 rounded-[1.5rem] font-black uppercase text-sm tracking-widest hover:bg-blue-50 transition-all shadow-xl hover:scale-105 active:scale-95 shrink-0"
                    >
                        Buy Plan Now &rarr;
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">Network Intelligence</h1>
                    <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.3em] mt-2 ml-1">Deep analysis of your multi-level affiliate performance</p>
                </div>
                
                <div className="bg-[#111827] p-1.5 rounded-[1.5rem] border-2 border-gray-800 shadow-2xl flex flex-wrap gap-2 items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3 hidden sm:inline">Active Scope:</span>
                    {uniqueActivePlans.map(p => (
                        <button
                            key={p.planId}
                            onClick={() => setSelectedPlanId(p.planId)}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300 border-2 ${
                                selectedPlanId === p.planId 
                                ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white border-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.5)] scale-105 z-10' 
                                : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-gray-200 hover:border-gray-500 hover:bg-gray-800'
                            }`}
                        >
                            {p.planName}
                        </button>
                    ))}
                    {uniqueActivePlans.length === 0 && <span className="px-4 py-1.5 text-[9px] text-gray-500 italic">No active scope available</span>}
                </div>
            </div>

            {selectedPlanDetails && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    <div className="lg:col-span-2 bg-[#1e293b] rounded-[2.5rem] border border-gray-800 p-8 flex flex-col gap-8 overflow-hidden relative group">
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/5 blur-[60px] group-hover:bg-blue-500/10 transition-all duration-1000"></div>
                        <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch">
                            <div className="w-full md:w-1/3 flex flex-col justify-center items-center text-center p-6 bg-black/20 rounded-[2rem] border border-white/5 shadow-inner shrink-0">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Scope Target</h4>
                                <span className="text-2xl font-black text-blue-400">{selectedPlanDetails.name}</span>
                                <span className="text-3xl font-black text-white mt-3">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span>
                            </div>
                            
                            <div className="flex-grow flex flex-col justify-between py-2 space-y-6">
                                <div className="p-4 bg-black/10 rounded-2xl border border-white/5">
                                    <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Strategic Overview</h5>
                                    <p className="text-sm text-gray-300 italic">"{selectedPlanDetails.description}"</p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                                    <div>
                                        <h5 className="text-[10px] font-black text-gray-500 uppercase mb-2 tracking-tighter">Min. Withdrawal</h5>
                                        <p className="text-lg font-bold text-white">{formatCurrency(selectedPlanDetails.minWithdraw, selectedPlanDetails.currency)}</p>
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-black text-gray-500 uppercase mb-2 tracking-tighter">Direct Earning Rate</h5>
                                        <p className="text-lg font-bold text-[#22c55e]">
                                            {(() => {
                                                const c = selectedPlanDetails.directCommissions?.[0];
                                                if(!c) return 'None';
                                                return c.type === 'percentage' ? `${c.value}%` : formatCurrency(c.value, selectedPlanDetails.currency);
                                            })()}
                                        </p>
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-black text-gray-500 uppercase mb-2 tracking-tighter">Direct Slot Cap</h5>
                                        <p className="text-lg font-bold text-blue-400">
                                            {selectedPlanDetails.directReferralLimit === 0 ? 'Unlimited' : `${selectedPlanDetails.directReferralLimit} Slots`}
                                        </p>
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-black text-gray-500 uppercase mb-2 tracking-tighter">Network Depth</h5>
                                        <p className="text-lg font-bold text-purple-400">
                                            {1 + (selectedPlanDetails.indirectCommissions?.length || 0)} Levels Deep
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`rounded-[2.5rem] border p-8 flex flex-col justify-between shadow-2xl transition-all duration-300 
                        ${scopeStats.held > 0 ? 'bg-orange-500/10 border-orange-500/40 ring-1 ring-orange-500/20' : 'bg-[#111827] border-gray-800'}`}>
                         <div>
                            <h4 className={`text-[11px] font-black uppercase tracking-[0.4em] mb-6 ${scopeStats.held > 0 ? 'text-orange-500' : 'text-gray-500'}`}>Network Performance Audit</h4>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-400">Scoped Direct Reach</span>
                                    <span className="text-xl font-black text-white">{scopeStats.directCount} Members</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-400">Commission Qualified</span>
                                    <span className="text-xl font-black text-[#22c55e]">{formatCurrency(scopeStats.earned, currentUser.currency)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs font-bold ${scopeStats.held > 0 ? 'text-orange-500' : 'text-gray-400'}`}>Commission Held (Locked)</span>
                                    <span className={`text-xl font-black ${scopeStats.held > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-500'}`}>{formatCurrency(scopeStats.held, currentUser.currency)}</span>
                                </div>
                            </div>
                         </div>
                         <button 
                            onClick={() => setViewMode('held')}
                            className={`mt-8 w-full py-4 rounded-2xl transition-all duration-300 border text-[10px] font-black uppercase tracking-[0.2em] 
                                ${scopeStats.held > 0 ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-600/30' : 'bg-white/5 border-white/10 text-blue-400 hover:bg-white/10'}`}
                         >
                            {scopeStats.held > 0 ? 'Claim Held Eligibility Now \u2192' : 'Check Held Eligibility \u2192'}
                         </button>
                    </div>
                </div>
            )}

            <div className="bg-[#0b0f19] p-10 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/10 blur-[120px] group-hover:bg-blue-600/15 transition-all duration-1000"></div>
                
                <div className="flex flex-col lg:flex-row justify-between items-stretch gap-10 relative z-10">
                    <div className="flex-grow w-full lg:w-3/5">
                        <ShareButtons 
                            url={referralLink} 
                            title="Join my top-earning network on SmartEarning!" 
                            className="bg-black/20 backdrop-blur-sm border-white/5 shadow-none" 
                        />
                    </div>
                    
                    <div className="flex flex-col gap-6 w-full lg:w-2/5">
                        <div className="flex-1 bg-white/5 p-6 rounded-[2rem] border border-white/5 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Total Direct Refs</p>
                            <p className="text-4xl font-black text-white">{users.filter(u => u.sponsor === currentUser.username).length}</p>
                        </div>
                        <div className="flex-1 bg-white/5 p-6 rounded-[2rem] border border-white/5 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Global Commissioners</p>
                            <p className="text-4xl font-black text-[#22c55e]">{directEarners.length + indirectEarners.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 bg-[#111827] rounded-[2.5rem] border border-gray-800 shadow-2xl flex flex-wrap gap-2 justify-center">
                {[
                    { id: 'earning', label: 'earning', count: directEarners.length + indirectEarners.length, active: 'border-green-400 bg-gradient-to-r from-green-600 to-green-500 text-white shadow-[0_0_15px_rgba(74,222,128,0.4)]', inactive: 'border-gray-800 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-700' },
                    { id: 'all', label: 'all refferal', count: allNodes.length, active: 'border-blue-400 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_0_15px_rgba(96,165,250,0.4)]', inactive: 'border-gray-800 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-700' },
                    { id: 'held', label: 'held commission', count: heldCommissionsData.referrals.length, active: 'border-orange-400 bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-[0_0_15px_rgba(251,146,60,0.4)]', inactive: 'border-gray-800 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-700' },
                    { id: 'tree', label: 'ref tree', count: genealogyTree.length, active: 'border-purple-400 bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-[0_0_15px_rgba(192,132,252,0.4)]', inactive: 'border-gray-800 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-700' },
                    { id: 'overflow', label: 'overflow', count: overflowReferrals.length, active: 'border-red-400 bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_0_15px_rgba(248,113,113,0.4)]', inactive: 'border-gray-800 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-700' },
                    { id: 'inactive', label: 'inactive ref', count: inactiveReferrals.length, active: 'border-gray-400 bg-gradient-to-r from-gray-600 to-gray-500 text-white shadow-[0_0_15px_rgba(156,163,175,0.2)]', inactive: 'border-gray-800 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-700' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setViewMode(tab.id as any)}
                        className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 border-2 ${
                            viewMode === tab.id ? `${tab.active} scale-105 z-10` : `${tab.inactive}`
                        }`}
                    >
                        {tab.label} <span className="opacity-70 ml-1">({tab.count})</span>
                        {tab.id === 'held' && scopeStats.held > 0 && <span className="ml-1 w-2 h-2 bg-white rounded-full inline-block animate-ping"></span>}
                    </button>
                ))}
            </div>

            <div className="min-h-[600px] animate-fade-in">
                {viewMode === 'earning' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            <div className="flex items-center gap-4 pl-3 border-l-4 border-blue-500">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Direct Earning History (L1)</h3>
                                <span className="bg-blue-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase">{directEarners.length} Contributors</span>
                            </div>
                            {directEarners.length > 0 ? directEarners.map(node => <ReferralCardContent node={node} showHeldAlert={true} />) : <div className="p-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 font-bold italic">No Level 1 commissions detected in this network.</div>}
                        </div>
                        <div className="space-y-8">
                            <div className="flex items-center gap-4 pl-3 border-l-4 border-purple-500">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Indirect Team Payouts (L2+)</h3>
                                <span className="bg-purple-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase">{indirectEarners.length} Contributors</span>
                            </div>
                            {indirectEarners.length > 0 ? indirectEarners.map(node => <ReferralCardContent node={node} showHeldAlert={true} />) : <div className="p-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 font-bold italic">No multi-level payouts found yet.</div>}
                        </div>
                    </div>
                )}

                {viewMode === 'all' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {allNodes.map(node => <ReferralCardContent node={node} showHeldAlert={true} />)}
                        {allNodes.length === 0 && <div className="col-span-full py-40 text-center text-gray-400 font-bold italic text-xl">No active team members have contributed to this specific plan scope yet.</div>}
                    </div>
                )}

                {viewMode === 'held' && (
                    <div className="space-y-10">
                        <div className="bg-gradient-to-br from-orange-500 to-red-600 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row gap-10 items-center border border-white/10">
                            <div className="w-24 h-24 bg-white/20 backdrop-blur-2xl flex items-center justify-center rounded-[2rem] text-5xl shrink-0 shadow-inner">🗝️</div>
                            <div className="text-center md:text-left">
                                <h4 className="text-3xl font-black uppercase tracking-tighter">Qualification Action Center</h4>
                                <p className="text-orange-50/80 font-medium mt-2 leading-relaxed max-w-4xl text-lg">
                                    The team members listed below have triggered commissions that are currently <strong className="underline decoration-wavy underline-offset-4 decoration-white/40">locked</strong>. 
                                    Review each card to see the specific <strong>equivalent plan</strong> requirement needed to instantly claim these funds into your wallet balance.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {heldCommissionsData.referrals.map(user => <ReferralCardContent key={user._id} node={{ user }} isHeldView={true} />)}
                            {heldCommissionsData.referrals.length === 0 && <div className="col-span-full py-40 text-center text-gray-400 font-black italic text-xl">All network earnings are fully qualified and paid!</div>}
                        </div>
                    </div>
                )}

                {viewMode === 'tree' && (
                    <div className="bg-white dark:bg-gray-800 p-16 rounded-[4rem] border border-gray-100 dark:border-gray-700 shadow-2xl">
                        {genealogyTree.length > 0 ? <ul className="space-y-8">{genealogyTree.map(node => renderTreeNode(node))}</ul> : <div className="py-40 text-center text-gray-400 font-black italic text-xl">The architecture map is waiting for your first contributor in this scope.</div>}
                    </div>
                )}

                {viewMode === 'overflow' && (
                    <div className="space-y-10">
                         <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row gap-10 items-center border border-white/10">
                            <div className="w-24 h-24 bg-white/20 backdrop-blur-2xl flex items-center justify-center rounded-[2rem] text-5xl shrink-0 shadow-inner">📈</div>
                            <div className="text-center md:text-left">
                                <h4 className="text-3xl font-black uppercase tracking-tighter">Network Capacity Insight</h4>
                                <p className="text-blue-50/80 font-medium mt-2 leading-relaxed max-w-4xl text-lg">
                                    The team members listed below have reached your current plan's direct referral limit. <strong className="underline decoration-wavy underline-offset-4 decoration-white/40">You can still earn</strong> from these referrals when a slot is available in any higher plan and your referral buys that plan, then you get commission.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {overflowReferrals.length > 0 ? overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="col-span-full py-40 text-center text-gray-400 font-black italic text-xl">You have full capacity in all your levels. No overflow events recorded.</div>}
                        </div>
                    </div>
                )}

                {viewMode === 'inactive' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {inactiveReferrals.length > 0 ? inactiveReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="col-span-full py-40 text-center text-gray-400 font-black italic text-xl">Every member of your network is currently an active contributor. Excellent leadership!</div>}
                    </div>
                )}
            </div>

            {isSponsorModalOpen && selectedSponsor && (
                <Modal isOpen={isSponsorModalOpen} onClose={() => setIsSponsorModalOpen(false)}>
                    <div className="p-12 max-w-md text-center bg-white dark:bg-gray-900 rounded-[4rem]">
                        <div className="mb-10 inline-flex items-center justify-center w-28 h-28 rounded-[2.5rem] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-5xl font-black shadow-inner shadow-blue-500/20">{selectedSponsor.fullName.charAt(0)}</div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tighter">{selectedSponsor.fullName}</h3>
                        <p className="text-sm text-gray-400 font-black uppercase tracking-[0.3em] mb-12">@{selectedSponsor.username}</p>
                        
                        <div className="grid grid-cols-1 gap-6 text-left">
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <p className="text-[11px] text-gray-400 uppercase font-black tracking-widest mb-3">Verified Region</p>
                                <p className="font-black text-gray-900 dark:text-white flex items-center gap-4 text-xl">
                                    <span className="text-3xl">📍</span> {selectedSponsor.country}
                                </p>
                            </div>
                        </div>

                        <Button variant="secondary" onClick={() => setIsSponsorModalOpen(false)} className="w-full mt-12 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-xl border-none">Close Profile View</Button>
                    </div>
                </Modal>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 20px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default Referrals;

