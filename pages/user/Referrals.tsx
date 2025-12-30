
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan, Transaction } from '../../types';
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
    const { state } = useData();
    const { currentUser, users, transactions, settings, investmentPlans } = state;
    const navigate = useNavigate();
    
    // Filter unique active plans for the plan switcher
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

    // Auto-select first plan if none selected
    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
            prevPlanId.current = uniqueActivePlans[0].planId;
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
    useEffect(() => {
        if (selectedPlanId && selectedPlanId !== prevPlanId.current) {
            if (['commissions', 'tree', 'all', 'overflow'].includes(viewMode)) {
                setHighlightedUserId(null);
            }
            prevPlanId.current = selectedPlanId;
        }
    }, [selectedPlanId, viewMode]);

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

    const isTransactionHoldPosition = (t: Transaction) => {
        const desc = t.description?.toLowerCase() || '';
        const isHeldStatus = t.status === 'Pending' || t.status === 'Approved';
        const hasKeywords = desc.includes('position') || desc.includes('hold') || desc.includes('reserved') || desc.includes('upgrade');
        return isHeldStatus && hasKeywords;
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>): { earned: number; held: number; status?: string; earningSourcePlanId?: string, isHoldPosition?: boolean, isOverflow?: boolean } => {
        if (!currentUser) return { earned: 0, held: 0 };
        
        const referralComms = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (contextPlanIds.size > 0 && t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : true) 
        );

        const earned = referralComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = referralComms.filter(t => t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0);
        const isHoldPosition = referralComms.some(t => isTransactionHoldPosition(t));
        const hasOverflowTx = referralComms.some(t => t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('full') || t.description.toLowerCase().includes('overflow')));
        const isOverflow = hasOverflowTx && !isHoldPosition && earned === 0 && held === 0;
        
        let earningSourcePlanId: string | undefined;
        if (referralComms.length > 0) {
            const bestTx = referralComms.find(t => t.status === 'Approved' || t.status === 'Pending') || referralComms[0];
            earningSourcePlanId = bestTx.relatedPlanId?.toString();
        }
        return { earned, held, status: referralComms[0]?.status, earningSourcePlanId, isHoldPosition, isOverflow };
    }, [currentUser, transactions]);

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

        const directEarnersList: GenealogyNode[] = [];
        const indirectEarnersList: GenealogyNode[] = [];
        const overflowList: GenealogyNode[] = [];
        const inactiveList: GenealogyNode[] = [];

        nodesList.forEach(node => {
            const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            if (info.earned > 0 || info.held > 0 || info.isHoldPosition) {
                if (node.level === 1) directEarnersList.push(node);
                else indirectEarnersList.push(node);
            } 
            else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } 
            else {
                if (!node.user.activePlans || node.user.activePlans.length === 0) {
                    inactiveList.push(node);
                }
            }
        });

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
        const treeToRender = filterRecursive(fullGenealogyTree);

        // Filter all nodes based on selected plan if one is active
        const filteredAllNodes = nodesList.filter(node => {
            if (!selectedPlanId) return true;
            const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            const hasMatchingPlan = node.user.activePlans?.some(p => equivalentPlanIdsForSelected.has(p.planId));
            return hasMatchingPlan || info.earned > 0 || info.held > 0 || info.isHoldPosition;
        });

        return {
            genealogyTree: treeToRender,
            directEarners: directEarnersList,
            indirectEarners: indirectEarnersList,
            overflowReferrals: overflowList,
            inactiveReferrals: inactiveList,
            allNodes: filteredAllNodes
        };
    }, [currentUser, users, selectedPlanId, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const heldCommissionsData = useMemo(() => {
        if (!currentUser) return { referrals: [], count: 0, stats: new Map() };
        
        // Held commissions are ALWAYS global (across all levels) so users see everything they are missing,
        // even if they don't have ANY plan active yet.
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, planId?: string, planName?: string, amount: number, isHoldPosition?: boolean, date: string, txId: string }[] }>();
        
        transactions
            .filter(t => 
                t.userId === currentUser._id && 
                t.type === 'Commission' && 
                t.status === 'Pending'
            )
            .forEach(t => {
                if (!t.sourceUserId) return;
                const current = pendingMap.get(t.sourceUserId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                let reason = "Pending Review";
                let missingPlanId = undefined;
                let missingPlanName = undefined;
                let isHoldPosition = false;

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
                    missingPlanName = targetPlan?.name || 'Required Plan';
                    missingPlanId = targetPlan?._id;
                }

                if (isTransactionHoldPosition(t)) {
                    reason = "Hold for Auto-Upgrade";
                    isHoldPosition = true;
                } else if (currentUser.restrictions?.earning) {
                    reason = "Account Restricted";
                } else if (settings.requireActivePlanForCommission && (!currentUser.activePlans || currentUser.activePlans.length === 0)) {
                    reason = "No Active Plan";
                } else if (settings.requirePlanMatchForCommission && missingPlanName) {
                     reason = `Requires Upgrade to ${missingPlanName}`;
                }
                
                current.breakdown.push({ 
                    reason, 
                    planId: missingPlanId, 
                    planName: missingPlanName, 
                    amount: t.amount, 
                    isHoldPosition, 
                    date: t.date,
                    txId: t._id
                });
                
                pendingMap.set(t.sourceUserId, current);
            });
        const heldIds = Array.from(pendingMap.keys());
        const referrals = users.filter(u => heldIds.includes(u._id));
        return { referrals, count: referrals.length, stats: pendingMap };
    }, [transactions, currentUser, settings, investmentPlans, users]);

    const handleSponsorClick = (sponsorUsername: string) => {
        const sponsor = users.find(u => u.username.toLowerCase() === sponsorUsername.toLowerCase());
        if (sponsor) {
            setSelectedSponsor(sponsor);
            setIsSponsorModalOpen(true);
        }
    };

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
        isTree?: boolean;
        isHeldView?: boolean;
        isAllView?: boolean;
    }> = ({ node, isHeldView, isAllView }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        
        let earned = 0;
        let held = 0;
        let breakdown: { reason: string, planId?: string, planName?: string, amount: number, isHoldPosition?: boolean, date: string, txId: string }[] = [];
        let isHoldPosition = false;
        let isOverflow = false;

        if (isHeldView) {
            const stats = heldCommissionsData.stats.get(user._id);
            held = stats?.total || 0;
            breakdown = stats?.breakdown || [];
            if (breakdown.some(b => b.isHoldPosition)) isHoldPosition = true;
        } else if (isAllView) {
            const contextPlanIds = selectedPlanId ? getEquivalentIds(selectedPlanId) : new Set<string>();
            const filteredComms = transactions.filter(t => 
                t.userId === currentUser?._id && 
                t.type === 'Commission' && 
                t.sourceUserId === user._id &&
                (selectedPlanId ? (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : true) : true)
            );
            earned = filteredComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
            const pendingHold = filteredComms.find(t => t.status === 'Pending' && isTransactionHoldPosition(t));
            if (pendingHold) isHoldPosition = true;
            const overflowTx = filteredComms.find(t => t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('full') || t.description.toLowerCase().includes('overflow')));
            const anySuccess = filteredComms.find(t => (t.status === 'Approved' || t.status === 'Pending'));
            if (overflowTx && !anySuccess && !isHoldPosition) isOverflow = true;
        } else {
            const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
            earned = info.earned;
            held = info.held;
            isHoldPosition = info.isHoldPosition || false;
            isOverflow = info.isOverflow || false;
        }

        const isDirect = level === 1;
        const isHighlighted = highlightedUserId === user._id;

        return (
            <div id={`node-${user._id}`} className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400 z-10' : 'border-gray-200 dark:border-gray-700'} border-l-4 ${isHoldPosition ? 'border-l-amber-500' : isOverflow ? 'border-l-orange-500' : isHeldView ? 'border-l-blue-500' : isDirect ? 'border-l-blue-500' : 'border-l-purple-500'} transition-all duration-200 hover:shadow-md`}>
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                        <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-sm">{user.fullName.charAt(0)}</div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white text-base">{user.username}</h4>
                                {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${isDirect ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{isDirect ? 'Direct' : `Level ${level}`}</span>}
                                {isHoldPosition && <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase tracking-wider">🔒 Reserved for upgrade</span>}
                                {isOverflow && <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold uppercase">⚠️ Overflow</span>}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                {isHeldView ? (
                                    <p className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Pending Earnings Context
                                    </p>
                                ) : <p className="text-gray-400">Activity Participant</p>}
                                {user.sponsor && <p className="flex items-center gap-1"><span>Sponsor:</span><button onClick={() => handleSponsorClick(user.sponsor!)} className="text-blue-500 hover:underline">@{user.sponsor}</button></p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto text-right">
                        {isHeldView ? (
                            <div className="w-full sm:w-80">
                                <p className="text-[10px] uppercase text-gray-400 font-bold mb-2">Detailed Held Transactions</p>
                                <div className="space-y-2">
                                    {breakdown.map((item, idx) => (
                                        <div key={item.txId} className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 text-left relative group">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${item.isHoldPosition ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {item.isHoldPosition ? 'Hold' : 'Pending'}
                                                </span>
                                                <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(item.amount, currentUser?.currency)}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-600 dark:text-gray-300 space-y-1">
                                                <p className="flex justify-between">
                                                    <span className="font-medium text-gray-500">Purpose:</span>
                                                    <span className="font-bold">{item.reason}</span>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span className="font-medium text-gray-500">Date:</span>
                                                    <span>{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </p>
                                            </div>
                                            {item.planId && !item.isHoldPosition && (
                                                <button 
                                                    onClick={() => navigate('/member/plans', { state: { highlightPlanId: item.planId } })}
                                                    className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-md transition-colors flex items-center justify-center gap-1 shadow-sm"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    Buy {item.planName} to Release
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Total Held:</span>
                                    <span className="text-xl font-black text-blue-600">{formatCurrency(held, currentUser?.currency)}</span>
                                </div>
                            </div>
                        ) : (
                            earned > 0 && <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold">Commission</p>
                                <p className="text-lg font-bold text-green-600">{formatCurrency(earned, currentUser?.currency)}</p>
                            </div>
                        )}
                        {held > 0 && !isHeldView && (
                             <div className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100">
                                <p className="text-[10px] uppercase font-bold text-blue-800">Pending: {formatCurrency(held, currentUser?.currency)}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderTreeNode = (node: GenealogyNode & { isSkipped?: boolean }) => {
        if (node.isSkipped) return <React.Fragment key={node.user._id}>{node.children.map(child => renderTreeNode(child))}</React.Fragment>;
        const isCollapsed = collapsedNodes.has(node.user._id);
        const hasChildren = node.children.length > 0;
        return (
            <li key={node.user._id} className="relative pl-6 pt-2">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 -ml-2"></div>
                <div className="absolute left-0 top-8 w-4 h-px bg-gray-200 -ml-2"></div>
                <div className="mb-2">
                    <ReferralCardContent node={node} isTree={true} />
                </div>
                {hasChildren && !isCollapsed && <ul className="border-l border-gray-200 ml-2 pl-2">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };

    if (!currentUser) return null;

    const currentPlanName = selectedPlanDetails?.name || 'General Network';
    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Network</h1>
                <p className="text-sm text-gray-500">View earnings generated from your team.</p>
            </div>

            {uniqueActivePlans.length === 0 ? (
                <div className="bg-[#1e293b] border border-orange-500/50 p-4 rounded-xl flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center text-orange-500">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base">No Active Plans Detected</h3>
                            <p className="text-gray-400 text-sm">Purchase an investment plan to start receiving network commissions.</p>
                        </div>
                    </div>
                    <Button onClick={() => navigate('/member/plans')} className="bg-blue-600 hover:bg-blue-700">Buy Plan</Button>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Switch Network Level</h3>
                    <div className="flex flex-wrap gap-3">
                        {uniqueActivePlans.map(plan => (
                            <button
                                key={plan.planId}
                                onClick={() => setSelectedPlanId(plan.planId)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border flex items-center gap-2 ${
                                    selectedPlanId === plan.planId
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                                }`}
                            >
                                <span className="text-lg">💎</span>
                                {plan.planName}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-4 uppercase font-semibold">Viewing network for: <span className="text-blue-500 font-bold">{currentPlanName}</span></p>
                </div>
            )}

            <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-xl space-y-4">
                <h3 className="text-lg font-bold text-white">Share Your Referral Link</h3>
                <div className="bg-[#0f172a] p-3 rounded-lg border border-gray-700/50 font-mono text-xs text-gray-300 break-all border-dashed">
                    {referralLink}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <Button onClick={() => navigator.clipboard.writeText(referralLink)} className="bg-blue-600 hover:bg-blue-700 text-sm py-2 px-6 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Copy Link
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
                {[
                    { id: 'commissions', label: 'Commission List', count: directEarners.length + indirectEarners.length },
                    { id: 'tree', label: 'Tree View', count: genealogyTree.length },
                    { id: 'overflow', label: 'Overflow', count: overflowReferrals.length },
                    { id: 'held', label: 'Held Commissions', count: heldCommissionsData.count },
                    { id: 'all', label: 'All Referrals', count: allNodes.length },
                    { id: 'inactive', label: 'Inactive', count: inactiveReferrals.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setViewMode(tab.id as any)}
                        className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border ${
                            viewMode === tab.id 
                            ? 'bg-white text-gray-900 border-white shadow-lg' 
                            : 'bg-[#1f2937] text-gray-400 border-gray-700 hover:bg-[#374151]'
                        }`}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            <div className="bg-[#0f172a] rounded-3xl border border-gray-800 p-6 min-h-[400px] shadow-inner">
                {viewMode === 'held' && (
                    <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl mb-6 flex gap-4 animate-fade-in">
                        <div className="text-orange-500 text-2xl pt-1">💡</div>
                        <div>
                            <h4 className="font-bold text-orange-500 text-sm">Global Held Commissions Across All Levels</h4>
                            <p className="text-orange-500/80 text-xs mt-1 leading-relaxed">
                                Below is a complete list of commissions currently being held. Each card displays the referral user and a breakdown of <strong>every individual transaction</strong> with its specific purpose and amount. To release these funds, ensure you own the qualifying plan level shown in each card.
                            </p>
                        </div>
                    </div>
                )}

                {viewMode === 'commissions' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest pl-2">Direct Referrals for {currentPlanName}</h3>
                            {directEarners.length > 0 ? directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-gray-600 text-sm italic pl-2">No direct earnings for this level.</p>}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest pl-2">Indirect Team for {currentPlanName}</h3>
                            {indirectEarners.length > 0 ? indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-gray-600 text-sm italic pl-2">No indirect earnings for this level.</p>}
                        </div>
                    </div>
                )}

                {viewMode === 'held' && (
                    heldCommissionsData.referrals.length > 0 ? (
                        <div className="space-y-4">
                            {heldCommissionsData.referrals.map(user => (
                                <ReferralCardContent key={user._id} node={{user}} isHeldView={true} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                             <svg className="w-20 h-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /></svg>
                             <p className="text-lg font-medium text-white">No commissions currently being held.</p>
                        </div>
                    )
                )}

                {viewMode === 'all' && (
                    <div className="space-y-4">
                        {allNodes.map(node => <ReferralCardContent key={node.user._id} node={node} isAllView={true} />)}
                        {allNodes.length === 0 && (
                            <div className="text-center py-20 text-gray-500 italic">No network members found for {currentPlanName}.</div>
                        )}
                    </div>
                )}

                {viewMode === 'tree' && (
                    genealogyTree.length > 0 ? (
                        <ul className="space-y-4">{genealogyTree.map(node => renderTreeNode(node))}</ul>
                    ) : <div className="text-center py-20 text-gray-500 italic">No network tree data for {currentPlanName}.</div>
                )}

                {viewMode === 'overflow' && (
                    <div className="space-y-4">
                        {overflowReferrals.length > 0 ? overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-center py-20 text-gray-500 italic">No overflow members for this level.</p>}
                    </div>
                )}

                {viewMode === 'inactive' && (
                    <div className="space-y-4">
                        {inactiveReferrals.length > 0 ? inactiveReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <p className="text-center py-20 text-gray-500 italic">No inactive members.</p>}
                    </div>
                )}
            </div>

            {isSponsorModalOpen && selectedSponsor && (
                <Modal isOpen={isSponsorModalOpen} onClose={() => setIsSponsorModalOpen(false)}>
                    <div className="p-6 max-w-md text-center">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 text-2xl font-bold">{selectedSponsor.fullName.charAt(0)}</div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedSponsor.fullName}</h3>
                        <p className="text-sm text-gray-500 mb-6">@{selectedSponsor.username}</p>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl text-left border border-gray-100 dark:border-gray-600 space-y-4">
                            <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Country</p><p className="font-semibold text-gray-900 dark:text-white">{selectedSponsor.country}</p></div>
                        </div>
                        <div className="mt-6">
                            <Button variant="secondary" onClick={() => setIsSponsorModalOpen(false)} className="w-full">Close</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Referrals;
