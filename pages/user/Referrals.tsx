
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan, Transaction, currencySymbols, Currency } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import ShareButtons from '../../components/ui/ShareButtons';
import { getDownline } from '../../services/api';

interface GenealogyNode {
    user: User;
    children: GenealogyNode[];
    level: number;
}

const Referrals: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, transactions, settings, investmentPlans } = state;
    const navigate = useNavigate();
    
    // Performance Hardening: Load network from server once
    const [rawNetwork, setRawNetwork] = useState<any[]>([]);
    const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setIsLoadingNetwork(true);
            getDownline(currentUser.username)
                .then(data => setRawNetwork(data))
                .catch(err => console.error("Network fetch failed:", err))
                .finally(() => setIsLoadingNetwork(false));
        }
    }, [currentUser?.username]);

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
    const [selectedSponsor, setSelectedSponsor] = useState<any | null>(null);

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

    const getCommissionInfoForReferral = useCallback((referral: any, contextPlanIds: Set<string>) => {
        if (!currentUser) return { earned: 0, held: 0, overflow: 0, history: [], isRecurringReferral: false, shouldRemoveCompletely: false, statusText: '', level: 0, relatedPlanId: null, isOverflow: false };
        
        const level = referral.level || 1;

        const referralComms = transactions
            .filter(t => 
                String(t.userId) === String(currentUser._id) &&
                t.type === 'Commission' &&
                t.sourceUserId && String(t.sourceUserId) === String(referral._id)
            )
            // FIX: Wrapped string dates in Date objects for sorting
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const contextComms = referralComms.filter(t => {
            if (contextPlanIds.size === 0) return true;
            if (!t.relatedPlanId) return false;
            return contextPlanIds.has(String(t.relatedPlanId));
        });

        const earned = contextComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = contextComms.filter(t => t.status === 'Pending' && !isTransactionOverflow(t)).reduce((sum, t) => sum + t.amount, 0);
        const overflow = contextComms.filter(t => isTransactionOverflow(t)).reduce((sum, t) => sum + t.amount, 0);
        
        const isOverflow = (overflow > 0) && (earned === 0 && held === 0);

        // FIX: Wrapped string dates in Date objects for sorting
        const oldestComm = [...referralComms].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).find(t => t.level === 1);
        // FIX: Referenced correct property name for recurring commission plans
        const recurringPlanIds = settings.recurringCommissionPlanIds || [];
        const isRecurringReferral = !!(oldestComm?.relatedPlanId && recurringPlanIds.includes(String(oldestComm.relatedPlanId)));

        const pendingComm = contextComms.find(t => t.status === 'Pending');
        const relatedPlanId = pendingComm ? String(pendingComm.relatedPlanId) : null;

        const hasPaidElseWhere = referralComms.some(t => 
            t.status === 'Approved' && (!t.relatedPlanId || !contextPlanIds.has(String(t.relatedPlanId)))
        );

        const isOneTimeBlocked = settings.oneTimeCommissionPerGroup && hasPaidElseWhere && !isRecurringReferral;
        const shouldRemoveCompletely = isOneTimeBlocked && (earned + held === 0);
        
        let statusText = 'Eligible Team Member';
        const isActiveGlobally = referral.activePlans && referral.activePlans.length > 0;
        const isActiveInScope = referral.activePlans?.some((p:any) => contextPlanIds.has(String(p.planId)));

        if (isActiveInScope) statusText = 'Active Scope Contributor';
        else if (isActiveGlobally) statusText = 'Active in Different Plan';
        
        if (isOneTimeBlocked) statusText = 'One-Time Payout Consumed';
        if (isOverflow) statusText = 'Upgrade plan to unlock more direct referral slots.';

        return { earned, held, overflow, history: contextComms, isOverflow, isRecurringReferral, shouldRemoveCompletely, statusText, level, relatedPlanId };
    }, [currentUser, transactions, settings]);

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
            
        const referrals = rawNetwork.filter(u => pendingMap.has(u._id));
        return { referrals, stats: pendingMap };
    }, [transactions, currentUser, settings, investmentPlans, rawNetwork, getRequiredPlanForCommission]);

    const processedScope = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], directEarners: [], indirectEarners: [], overflowReferrals: [], inactiveReferrals: [], allNodes: [], scopeStats: { earned: 0, held: 0, directCount: 0, indirectCount: 0 } };

        const directEarnersList: any[] = [];
        const indirectEarnersList: any[] = [];
        const overflowList: any[] = [];
        const inactiveList: any[] = [];
        const allNodesList: any[] = [];
        let earnedSum = 0;
        let heldSum = 0;
        let directCount = 0;
        let indirectCount = 0;

        rawNetwork.forEach(user => {
            const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
            if (info.shouldRemoveCompletely) return;

            if (info.isOverflow) {
                overflowList.push({ user, info });
            } else {
                const isActive = user.activePlans && user.activePlans.length > 0;
                
                earnedSum += info.earned;
                heldSum += info.held;
                if (info.level === 0) directCount++; // In graphLookup, level 0 is direct
                else indirectCount++;

                if (info.earned > 0) {
                    if (info.level === 0) directEarnersList.push({ user, info });
                    else indirectEarnersList.push({ user, info });
                } else if (!isActive) {
                    inactiveList.push({ user, info });
                }

                if ((info.earned > 0 || info.held > 0) && info.overflow === 0) {
                    allNodesList.push({ user, info });
                }
            }
        });

        // Simplified tree visualization from flat network array
        const buildTreeFromFlat = (sponsorUsername: string, currentLevel: number): GenealogyNode[] => {
            return rawNetwork
                .filter(u => u.sponsor === sponsorUsername)
                .map(u => ({
                    user: u,
                    children: buildTreeFromFlat(u.username, currentLevel + 1),
                    level: currentLevel
                }))
                .filter(node => {
                    const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
                    return !info.shouldRemoveCompletely && !info.isOverflow;
                });
        };

        return { 
            genealogyTree: buildTreeFromFlat(currentUser.username, 1), 
            directEarners: directEarnersList, 
            indirectEarners: indirectEarnersList, 
            overflowReferrals: overflowList, 
            inactiveReferrals: inactiveList, 
            allNodes: allNodesList,
            scopeStats: { earned: earnedSum, held: heldSum, directCount, indirectCount }
        };
    }, [currentUser, rawNetwork, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const ReferralCardContent: React.FC<{
        node: { user: any, info?: any };
        isHeldView?: boolean;
        showHeldAlert?: boolean;
    }> = ({ node, isHeldView, showHeldAlert = false }) => {
        const { user } = node;
        const info = node.info || getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        const isDirect = info.level === 0;

        const heldStats = heldCommissionsData.stats.get(user._id);
        const totalHeldGlobal = heldStats?.total || 0;
        const globalHistory = heldStats?.breakdown || [];
        
        const historyToShow = isHeldView ? globalHistory : info.history;
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
                                        {isDirect ? 'DIRECT TEAM' : `NETWORK LEVEL ${info.level + 1}`}
                                    </span>
                                    <span className="text-sm text-gray-400 font-medium">@{user.username}</span>
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
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            {isHeldView || hasHeld ? 'LOCK REASONS & ROADMAP' : 'EARNING TIMELINE BREAKDOWN'}
                        </p>
                        
                        <div className="space-y-2.5">
                            {historyToShow && historyToShow.length > 0 ? historyToShow.map((item: any) => (
                                <div key={item._id || item.txId} className={`flex justify-between items-center p-4 bg-[#1f2937] dark:bg-gray-900 rounded-2xl border ${item.status === 'Pending' ? 'border-orange-500/30' : 'border-gray-800'} text-[13px] group/item hover:border-gray-600 transition-all shadow-sm`}>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-200">
                                            {isHeldView ? item.reason : item.description.split('from')[0].trim()}
                                        </span>
                                        <span className="text-[11px] text-gray-500 mt-1 font-medium">
                                            {new Date(item.date).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className={`font-black ${item.status === 'Approved' ? 'text-[#22c55e]' : 'text-orange-500'}`}>
                                            <span className="text-[10px] mr-0.5">{symbol}</span>
                                            {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
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
                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">UNLOCK REQUIREMENT FOUND</p>
                            <p className="text-sm font-bold text-white mb-4">Requirement: <span className="text-orange-400">{requiredPlan?.name || 'Higher Tier'}</span></p>
                            <button 
                                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-xl shadow-orange-600/20"
                                onClick={() => navigate('/member/plans', { state: { highlightPlanId: requiredPlan?._id } })}
                            >
                                Upgrade to Unlock Commission &rarr;
                            </button>
                        </div>
                    )}
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
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-[2rem] flex items-center justify-center text-4xl shrink-0">🛡️</div>
                    <div className="flex-grow text-center md:text-left relative z-10">
                        <h4 className="text-2xl font-black uppercase tracking-tighter">Earnings Eligibility Warning</h4>
                        <p className="text-blue-100/80 mt-2 font-medium">All referral commissions will be Locked (Held) until you purchase a plan.</p>
                    </div>
                    <button onClick={() => navigate('/member/plans')} className="bg-white text-blue-600 px-8 py-4 rounded-[1.5rem] font-black uppercase text-sm tracking-widest hover:bg-blue-50 transition-all shadow-xl">Buy Plan Now &rarr;</button>
                </div>
            )}

            {isLoadingNetwork && (
                <div className="flex items-center justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <span className="ml-4 font-black uppercase text-xs tracking-widest text-gray-500">Mapping Network Architecture...</span>
                </div>
            )}

            {!isLoadingNetwork && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">Network Intelligence</h1>
                            <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.3em] mt-2 ml-1">Deep analysis of your multi-level affiliate performance</p>
                        </div>
                        
                        <div className="bg-[#111827] p-1.5 rounded-[1.5rem] border-2 border-gray-800 shadow-2xl flex flex-wrap gap-2 items-center">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3">Active Scope:</span>
                            {uniqueActivePlans.map(p => (
                                <button key={p.planId} onClick={() => setSelectedPlanId(p.planId)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all duration-300 border-2 ${selectedPlanId === p.planId ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white border-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.5)] scale-105' : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-gray-200'}`}>
                                    {p.planName}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-3 bg-[#111827] rounded-[2.5rem] border border-gray-800 shadow-2xl flex flex-wrap gap-2 justify-center">
                        {[
                            { id: 'earning', label: 'earning', count: processedScope.directEarners.length + processedScope.indirectEarners.length },
                            { id: 'all', label: 'all refferal', count: processedScope.allNodes.length },
                            { id: 'held', label: 'held commission', count: heldCommissionsData.referrals.length },
                            { id: 'tree', label: 'ref tree', count: processedScope.genealogyTree.length },
                            { id: 'overflow', label: 'overflow', count: processedScope.overflowReferrals.length },
                            { id: 'inactive', label: 'inactive ref', count: processedScope.inactiveReferrals.length }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setViewMode(tab.id as any)} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border-2 ${viewMode === tab.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-200'}`}>
                                {tab.label} <span className="opacity-70 ml-1">({tab.count})</span>
                            </button>
                        ))}
                    </div>

                    <div className="min-h-[600px] animate-fade-in">
                        {viewMode === 'earning' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter pl-3 border-l-4 border-blue-500">Direct Team History</h3>
                                    {processedScope.directEarners.length > 0 ? processedScope.directEarners.map((node, i) => <ReferralCardContent key={i} node={node} showHeldAlert={true} />) : <div className="p-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 text-gray-400 font-bold italic">No direct team earnings in this scope.</div>}
                                </div>
                                <div className="space-y-8">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter pl-3 border-l-4 border-purple-500">Indirect Team Payouts</h3>
                                    {processedScope.indirectEarners.length > 0 ? processedScope.indirectEarners.map((node, i) => <ReferralCardContent key={i} node={node} showHeldAlert={true} />) : <div className="p-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 text-gray-400 font-bold italic">No multi-level payouts found yet.</div>}
                                </div>
                            </div>
                        )}
                        {viewMode === 'held' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                {heldCommissionsData.referrals.map((user, i) => <ReferralCardContent key={i} node={{ user }} isHeldView={true} />)}
                                {heldCommissionsData.referrals.length === 0 && <div className="col-span-full py-40 text-center text-gray-400 font-black italic text-xl">All network earnings are fully qualified and paid!</div>}
                            </div>
                        )}
                        {viewMode === 'tree' && (
                            <div className="bg-white dark:bg-gray-800 p-16 rounded-[4rem] border border-gray-100 dark:border-gray-700 shadow-2xl">
                                {processedScope.genealogyTree.length > 0 ? <ul className="space-y-8">{processedScope.genealogyTree.map(node => renderTreeNode(node))}</ul> : <div className="py-40 text-center text-gray-400 font-black italic text-xl">The architecture map is waiting for your first contributor in this scope.</div>}
                            </div>
                        )}
                    </div>
                </>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 20px; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default Referrals;
