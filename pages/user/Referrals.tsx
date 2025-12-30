
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan, Transaction, currencySymbols } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';

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
    
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'held' | 'all' | 'inactive'>('commissions');

    const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
    const [selectedSponsor, setSelectedSponsor] = useState<User | null>(null);

    const prevPlanId = useRef(selectedPlanId);

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

    const isTransactionOverflow = (t: Transaction) => {
        const desc = t.description?.toLowerCase() || '';
        return t.status === 'Rejected' && desc.includes('overflow');
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>) => {
        if (!currentUser) return { earned: 0, held: 0, history: [], isRecurringReferral: false, shouldRemoveCompletely: false, statusText: '', level: 0 };
        
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
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const oldestComm = [...referralComms].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).find(t => t.level === 1);
        const recurringPlanIds = settings.recurringCommissionPlanIds || [];
        const isRecurringReferral = !!(oldestComm?.relatedPlanId && recurringPlanIds.includes(String(oldestComm.relatedPlanId)));

        const contextComms = referralComms.filter(t => {
            if (contextPlanIds.size === 0) return true;
            if (!t.relatedPlanId) return false;
            return contextPlanIds.has(String(t.relatedPlanId));
        });

        const earned = contextComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = contextComms.filter(t => t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0);
        
        const overflowTx = contextComms.find(t => isTransactionOverflow(t));
        const isOverflow = !!overflowTx && earned === 0 && held === 0;

        const hasPaidElseWhere = referralComms.some(t => 
            t.status === 'Approved' && (!t.relatedPlanId || !contextPlanIds.has(String(t.relatedPlanId)))
        );

        const isOneTimeBlocked = settings.oneTimeCommissionPerGroup && hasPaidElseWhere && !isRecurringReferral && level === 1;
        const shouldRemoveCompletely = isOneTimeBlocked && (earned + held === 0);
        
        let statusText = 'Eligible Team Member';
        if (referral.activePlans && referral.activePlans.length > 0) statusText = 'Active Earner';
        if (isOneTimeBlocked) statusText = 'One-Time Payout Consumed';
        if (isOverflow) statusText = 'Referral Slot Limit Reached';

        return { earned, held, history: contextComms, isOverflow, isRecurringReferral, shouldRemoveCompletely, statusText, level };
    }, [currentUser, transactions, settings, users]);

    const heldCommissionsData = useMemo(() => {
        if (!currentUser) return { referrals: [], stats: new Map() };
        
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, planId?: string, planName?: string, amount: number, date: string, txId: string }[] }>();
        
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
                let missingPlanId = undefined;
                let missingPlanName = undefined;

                if (t.relatedPlanId) {
                    let targetPlan = investmentPlans.find(p => p._id === String(t.relatedPlanId));
                    if (settings.planEquivalencyGroups) {
                        const group = settings.planEquivalencyGroups.find(g => 
                           String(g.usdPlanId) === String(t.relatedPlanId) || String(g.pkrPlanId) === String(t.relatedPlanId) || String(g.eurPlanId) === String(t.relatedPlanId)
                        );
                        if (group) {
                            const targetKey = `${currentUser.currency.toLowerCase()}PlanId` as keyof typeof group;
                            if (group[targetKey]) {
                                const localPlan = investmentPlans.find(p => p._id === String(group[targetKey]));
                                if (localPlan) targetPlan = localPlan;
                            }
                        }
                    }
                    missingPlanName = targetPlan?.name || 'Required Rank';
                    missingPlanId = targetPlan?._id;
                }

                if (currentUser.restrictions?.earning) {
                    reason = "Account Earning Restricted";
                } else if (settings.requireActivePlanForCommission && (!currentUser.activePlans || currentUser.activePlans.length === 0)) {
                    reason = "Purchase Required to Release";
                } else if (settings.requirePlanMatchForCommission && missingPlanName) {
                     reason = `Upgrade to ${missingPlanName} needed`;
                }
                
                current.breakdown.push({ reason, planId: missingPlanId, planName: missingPlanName, amount: t.amount, date: t.date, txId: t._id });
                pendingMap.set(srcId, current);
            });
            
        const referrals = users.filter(u => pendingMap.has(u._id));
        return { referrals, stats: pendingMap };
    }, [transactions, currentUser, settings, investmentPlans, users]);

    const { genealogyTree, directEarners, indirectEarners, overflowReferrals, inactiveReferrals, allNodes } = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], directEarners: [], indirectEarners: [], overflowReferrals: [], inactiveReferrals: [], allNodes: [] };

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

        nodesList.forEach(node => {
            const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            if (info.shouldRemoveCompletely) return;

            if (info.earned > 0 || info.held > 0) {
                if (info.level === 1) directEarnersList.push({ ...node, info });
                else indirectEarnersList.push({ ...node, info });
            } else if (info.isOverflow && info.level === 1) {
                overflowList.push({ ...node, info });
            } else {
                if (!node.user.activePlans || node.user.activePlans.length === 0) {
                    inactiveList.push({ ...node, info });
                }
            }
        });

        const filteredAllNodes = nodesList.map(node => ({
            ...node,
            info: getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected)
        })).filter(n => !n.info.shouldRemoveCompletely);

        const filterRecursive = (nodes: GenealogyNode[]): GenealogyNode[] => {
            return nodes.map(node => {
                const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
                if (info.shouldRemoveCompletely) return null;
                const filteredChildren = filterRecursive(node.children);
                if (info.earned > 0 || info.held > 0 || filteredChildren.length > 0) return { ...node, children: filteredChildren };
                return null;
            }).filter((n): n is GenealogyNode => n !== null);
        };

        return { genealogyTree: filterRecursive(fullGenealogyTree), directEarners: directEarnersList, indirectEarners: indirectEarnersList, overflowReferrals: overflowList, inactiveReferrals: inactiveList, allNodes: filteredAllNodes };
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
        const amountToShow = isHeldView ? totalHeldGlobal : info.earned;
        const hasHeld = totalHeldGlobal > 0;

        const symbol = currencySymbols[currentUser?.currency || 'USD'];

        return (
            <div className={`relative bg-[#0f172a] dark:bg-gray-800 rounded-[2.5rem] shadow-sm border ${highlightedUserId === user._id ? 'border-blue-400 ring-2 ring-blue-400' : 'border-gray-800 dark:border-gray-700'} border-l-8 ${isHeldView ? 'border-l-orange-500' : isDirect ? 'border-l-blue-500' : 'border-l-purple-500'} transition-all duration-200 overflow-hidden group`}>
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl ${isHeldView ? 'bg-orange-100 text-orange-600' : isDirect ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-white flex items-center gap-2 text-xl">
                                    {user.username}
                                    {info.isRecurringReferral && !isHeldView && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center gap-1 shadow-sm">🔄 Recurring</span>}
                                    {showHeldAlert && hasHeld && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" title="Has locked commissions!"></span></span>}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className={`px-4 py-1 rounded-full font-black uppercase text-[11px] tracking-wider ${isHeldView ? 'bg-orange-500 text-white' : isDirect ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                                        {isDirect ? 'DIRECT TEAM' : `NETWORK LEVEL ${level}`}
                                    </span>
                                    <span className="text-sm text-gray-400 font-medium">@{user.username} • {user.fullName}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] uppercase font-black text-gray-500 tracking-[0.1em] mb-1">{isHeldView ? 'TOTAL HELD' : 'TOTAL EARNED'}</p>
                            <p className={`text-2xl md:text-3xl font-black ${isHeldView ? 'text-orange-500' : 'text-[#22c55e]'}`}>
                                <span className="text-lg mr-1">{symbol}</span>
                                {amountToShow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                {isHeldView ? 'HELD ITEMIZATION' : 'EARNING TIMELINE BREAKDOWN'}
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
                                <div key={item._id || item.txId} className="flex justify-between items-center p-4 bg-[#1f2937] dark:bg-gray-900 rounded-2xl border border-gray-800 text-[13px] group/item hover:border-gray-600 transition-all shadow-sm">
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
                                        {isHeldView && item.planId && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); navigate('/member/plans', { state: { highlightPlanId: item.planId } }); }}
                                                className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-1 hover:underline flex items-center gap-1"
                                            >
                                                Unlock &rarr;
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

                    {/* Held Summary for "All Team Members" View */}
                    {showHeldAlert && hasHeld && !isHeldView && (
                        <div className="mt-5 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">LOCKED COMMISSIONS FOUND</span>
                                <span className="text-base font-black text-orange-500">{formatCurrency(totalHeldGlobal, currentUser?.currency)}</span>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest bg-white text-orange-600 rounded-xl hover:bg-orange-50 transition-colors"
                                    onClick={() => setViewMode('held')}
                                >
                                    View Details
                                </button>
                                <button 
                                    className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
                                    onClick={() => navigate('/member/plans')}
                                >
                                    Qualify Now
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-between items-center text-[11px] font-black uppercase tracking-[0.2em] pt-5 border-t border-gray-800/50">
                        <span className="text-gray-500">{info.statusText}</span>
                        <button onClick={() => { setSelectedSponsor(users.find(u => u.username === user.sponsor) || null); if(user.sponsor) setIsSponsorModalOpen(true); }} className="text-blue-500 hover:text-blue-400">Referrer: @{user.sponsor || 'Rajaptc56'}</button>
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
                <div className="mb-6 max-w-2xl shadow-xl"><ReferralCardContent node={node} /></div>
                {hasChildren && !isCollapsed && <ul className="ml-6">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };

    if (!currentUser) return null;

    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-20 px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">Network Insights</h1>
                    <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.3em] mt-2 ml-1">Deep analysis of your multi-level earnings</p>
                </div>
                <div className="bg-[#111827] p-3 rounded-[2rem] border border-gray-800 shadow-xl flex items-center gap-4 min-w-[280px]">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-4">Network Scope:</span>
                    <select 
                        value={selectedPlanId} 
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        className="bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider rounded-full border-none focus:ring-4 focus:ring-blue-500/30 cursor-pointer pr-10 py-2.5 shadow-lg shadow-blue-600/20 grow"
                    >
                        {uniqueActivePlans.map(p => <option key={p.planId} value={p.planId}>{p.planName}</option>)}
                    </select>
                </div>
            </div>

            {/* Main Stats Bar Section */}
            <div className="bg-[#0b0f19] p-10 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/10 blur-[120px] group-hover:bg-blue-600/15 transition-all duration-1000"></div>
                
                <div className="flex flex-col lg:flex-row justify-between items-stretch gap-10 relative z-10">
                    <div className="flex-grow w-full lg:w-3/5">
                        <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.5em] mb-6 ml-1">Your Professional Invitation Link</h3>
                        <div className="flex items-center bg-black/40 p-5 rounded-3xl border border-white/5 font-mono text-xs text-blue-100/70 break-all border-dashed select-all group-hover:border-blue-500/40 transition-all duration-500 min-h-[100px]">
                            <span className="flex-grow px-2 leading-relaxed">{referralLink}</span>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(referralLink);
                                    // Could trigger toast here
                                }} 
                                className="ml-5 p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 active:scale-90 transition-all shadow-xl shadow-blue-600/30 shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex gap-6 w-full lg:w-2/5">
                        <div className="flex-1 bg-white/5 p-6 rounded-[2rem] border border-white/5 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Team Size</p>
                            <p className="text-4xl font-black text-white">{allNodes.length}</p>
                        </div>
                        <div className="flex-1 bg-white/5 p-6 rounded-[2rem] border border-white/5 text-center flex flex-col justify-center transition-transform hover:scale-[1.02]">
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Commissioners</p>
                            <p className="text-4xl font-black text-[#22c55e]">{directEarners.length + indirectEarners.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - Exact style as screenshot */}
            <div className="p-2 bg-[#111827] rounded-[2.5rem] border border-gray-800 shadow-inner">
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'commissions', label: 'Earnings Detailed', count: directEarners.length + indirectEarners.length },
                        { id: 'all', label: 'All Members + Held Info', count: allNodes.length },
                        { id: 'held', label: 'Held Commissions Only', count: heldCommissionsData.referrals.length },
                        { id: 'tree', label: 'Hierarchy Architecture', count: genealogyTree.length },
                        { id: 'overflow', label: 'Overflow Logs', count: overflowReferrals.length },
                        { id: 'inactive', label: 'Dormant Team', count: inactiveReferrals.length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setViewMode(tab.id as any)}
                            className={`flex-1 min-w-[200px] px-8 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${
                                viewMode === tab.id 
                                ? 'bg-[#1f2937] text-blue-400 shadow-2xl border border-blue-500/20' 
                                : 'text-gray-500 hover:text-gray-300 hover:bg-[#1f2937]/30'
                            }`}
                        >
                            {tab.label} <span className="ml-2 text-xs opacity-50">({tab.count})</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-[600px] animate-fade-in">
                {viewMode === 'commissions' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            <div className="flex items-center gap-4 pl-3 border-l-4 border-blue-500">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Direct Earning History (L1)</h3>
                                <span className="bg-blue-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase">{directEarners.length} Contributors</span>
                            </div>
                            {directEarners.length > 0 ? directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="p-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 font-bold italic">No Level 1 commissions detected in this network.</div>}
                        </div>
                        <div className="space-y-8">
                            <div className="flex items-center gap-4 pl-3 border-l-4 border-purple-500">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Indirect Team Payouts (L2+)</h3>
                                <span className="bg-purple-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase">{indirectEarners.length} Contributors</span>
                            </div>
                            {indirectEarners.length > 0 ? indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="p-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 font-bold italic">No multi-level payouts found yet.</div>}
                        </div>
                    </div>
                )}

                {viewMode === 'all' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {allNodes.map(node => <ReferralCardContent key={node.user._id} node={node} showHeldAlert={true} />)}
                        {allNodes.length === 0 && <div className="col-span-full py-40 text-center text-gray-400 font-bold italic text-xl">Your team network is currently empty. Start sharing!</div>}
                    </div>
                )}

                {viewMode === 'held' && (
                    <div className="space-y-10">
                        <div className="bg-gradient-to-br from-orange-500 to-red-600 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row gap-10 items-center border border-white/10">
                            <div className="w-24 h-24 bg-white/20 backdrop-blur-2xl flex items-center justify-center rounded-[2rem] text-5xl shrink-0 shadow-inner">💡</div>
                            <div className="text-center md:text-left">
                                <h4 className="text-3xl font-black uppercase tracking-tighter">Qualification Action Center</h4>
                                <p className="text-orange-50/80 font-medium mt-2 leading-relaxed max-w-4xl text-lg">
                                    The team members listed below have triggered commissions that are currently <strong className="underline decoration-wavy underline-offset-4 decoration-white/40">locked</strong>. 
                                    Review each card to see the specific rank or plan requirement needed to instantly claim these funds into your wallet balance.
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
                        {genealogyTree.length > 0 ? <ul className="space-y-8">{genealogyTree.map(node => renderTreeNode(node))}</ul> : <div className="py-40 text-center text-gray-400 font-black italic text-xl">The architecture map is waiting for your first referral.</div>}
                    </div>
                )}

                {viewMode === 'overflow' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {overflowReferrals.length > 0 ? overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="col-span-full py-40 text-center text-gray-400 font-black italic text-xl">You have full capacity in all your levels. No overflow events recorded.</div>}
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
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <p className="text-[11px] text-gray-400 uppercase font-black tracking-widest mb-3">Network Status</p>
                                <p className="font-black text-green-600 dark:text-green-400 flex items-center gap-4 text-xl">
                                    <span className="text-3xl">🎖️</span> Professional Affiliate
                                </p>
                            </div>
                        </div>

                        <Button variant="secondary" onClick={() => setIsSponsorModalOpen(false)} className="w-full mt-12 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-xl border-none">Close Profile View</Button>
                    </div>
                </Modal>
            )}
            
            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                    display: inline-block;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #374151;
                    border-radius: 20px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #4b5563;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                }
            `}</style>
        </div>
    );
};

export default Referrals;
