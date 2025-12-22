
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
        return (t.status === 'Pending' || t.status === 'Approved') && 
               (desc.includes('hold') || desc.includes('reserved') || desc.includes('upgrade') || desc.includes('slot #'));
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>): { earned: number; held: number; status?: string; earningSourcePlanId?: string, isHoldPosition?: boolean, isOverflow?: boolean } => {
        if (!currentUser) return { earned: 0, held: 0 };
        
        const referralComms = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : false) 
        );

        const earned = referralComms.filter(t => t.status === 'Approved' && !t.description.toLowerCase().includes('upgrade')).reduce((sum, t) => sum + t.amount, 0);
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
        const treeToRender = filterRecursive(fullGenealogyTree);

        return {
            genealogyTree: treeToRender,
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

    // ENHANCED: AUTO UPGRADE PROGRESS LOGIC
    const upgradeProgress = useMemo(() => {
        if (!currentUser || !selectedPlanDetails?.autoUpgrade?.enabled || !selectedPlanDetails?.autoUpgrade?.toPlanId) return null;
        
        const targetPlan = investmentPlans.find(p => p._id === selectedPlanDetails.autoUpgrade?.toPlanId);
        if (!targetPlan) return null;

        const contextIds = getEquivalentIds(selectedPlanId);

        const heldAmountForThisTrack = transactions
            .filter(t => 
                t.userId === currentUser._id && 
                t.type === 'Commission' && 
                t.status === 'Pending' && 
                t.relatedPlanId && contextIds.has(String(t.relatedPlanId)) &&
                isTransactionHoldPosition(t)
            )
            .reduce((sum, t) => sum + t.amount, 0);
        
        const percentage = Math.min(100, (heldAmountForThisTrack / targetPlan.price) * 100);
        
        return { heldAmount: heldAmountForThisTrack, targetPrice: targetPlan.price, targetName: targetPlan.name, percentage };
    }, [currentUser, selectedPlanDetails, selectedPlanId, transactions, investmentPlans, getEquivalentIds]);

    const heldCommissionsData = useMemo(() => {
        if (!currentUser || !selectedPlanId) return { referrals: [], count: 0, stats: new Map() };
        
        const filterIds = getEquivalentIds(selectedPlanId);
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, amount: number, isHoldPosition?: boolean }[] }>();
        
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
                         reason = `Requires Upgrade to ${targetPlan?.name || 'Required Plan'}`;
                     }
                }
                const existingEntry = current.breakdown.find(b => b.reason === reason);
                if (existingEntry) {
                    existingEntry.amount += t.amount;
                } else {
                    current.breakdown.push({ reason, amount: t.amount, isHoldPosition });
                }
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
        } else {
            alert(`Sponsor details for @${sponsorUsername} not found.`);
        }
    };

    const handleLocateSponsor = () => {
        if (!selectedSponsor) return;
        const currentInfo = getCommissionInfoForReferral(selectedSponsor, equivalentPlanIdsForSelected);
        if (currentInfo.earned > 0) {
            setHighlightedUserId(selectedSponsor._id);
            setViewMode('tree');
            setIsSponsorModalOpen(false);
            return;
        }
        setHighlightedUserId(selectedSponsor._id);
        setViewMode('tree');
        setIsSponsorModalOpen(false);
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
        
        let earned = 0;
        let held = 0;
        let breakdown: { reason: string, amount: number, isHoldPosition?: boolean }[] = [];
        let earningSourcePlanId: string | undefined;
        let isHoldPosition = false;
        let isOverflow = false;

        if (isHeldView) {
            const stats = heldCommissionsData.stats.get(user._id);
            held = stats?.total || 0;
            breakdown = stats?.breakdown || [];
            if (breakdown.some(b => b.isHoldPosition)) isHoldPosition = true;
        } else if (isAllView) {
            const allApproved = transactions.filter(t => t.userId === currentUser?._id && t.type === 'Commission' && t.sourceUserId === user._id && t.status === 'Approved');
            earned = allApproved.reduce((sum, t) => sum + t.amount, 0);
            const pendingHold = transactions.find(t => t.userId === currentUser?._id && t.sourceUserId === user._id && t.status === 'Pending' && isTransactionHoldPosition(t));
            if (pendingHold) isHoldPosition = true;
            const overflowTx = transactions.find(t => t.userId === currentUser?._id && t.sourceUserId === user._id && t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('full') || t.description.toLowerCase().includes('overflow')));
            if (overflowTx && earned === 0 && !isHoldPosition) isOverflow = true;
        } else {
            const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
            earned = info.earned;
            held = info.held;
            earningSourcePlanId = info.earningSourcePlanId;
            isHoldPosition = info.isHoldPosition || false;
            isOverflow = info.isOverflow || false;
        }

        const isDirect = level === 1;
        const cardBorderClass = isDirect ? 'border-l-blue-500' : 'border-l-purple-500';
        const levelBadgeColor = isDirect ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
        const isHighlighted = highlightedUserId === user._id;
        const sourcePlan = earningSourcePlanId ? investmentPlans.find(p => p._id === String(earningSourcePlanId)) : null;

        return (
            <div id={`node-${user._id}`} className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400 z-10' : 'border-gray-200 dark:border-gray-700'} border-l-4 ${isHoldPosition ? 'border-l-amber-500 bg-amber-50/10' : isOverflow ? 'border-l-orange-500' : cardBorderClass} transition-all duration-200 hover:shadow-md`}>
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                        {isTree && hasChildren && toggleNode ? (
                            <button onClick={() => toggleNode(user._id)} className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
                                {collapsedNodes.has(user._id) ? '+' : '−'}
                            </button>
                        ) : (
                            <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                        )}
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.username}</h4>
                                {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${levelBadgeColor}`}>{isDirect ? 'Direct' : `Level ${level}`}</span>}
                                {isHoldPosition && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">🔒 Held for Upgrade</span>}
                                {isOverflow && <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold uppercase">⚠️ Overflow</span>}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {sourcePlan ? <p className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"><span>Qualifying Plan: {sourcePlan.name}</span></p> : <p className="text-gray-400">No qualifying purchase</p>}
                                {user.sponsor && <p className="flex items-center gap-1"><span>Via:</span><button onClick={() => handleSponsorClick(user.sponsor!, user)} className="text-blue-500 hover:underline font-medium">@{user.sponsor}</button></p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto text-right">
                        {(earned > 0 && !isHoldPosition) && (
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Commission</p>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(earned, currentUser?.currency || 'USD')}</p>
                            </div>
                        )}
                        {(held > 0 || isHoldPosition) && !isHeldView && (
                             <div className={`${isHoldPosition ? 'bg-amber-100 border-amber-300' : 'bg-blue-50 border-blue-100'} px-3 py-1 rounded border`}>
                                <p className={`text-[10px] uppercase font-bold tracking-wider ${isHoldPosition ? 'text-amber-900' : 'text-blue-800'}`}>
                                    {isHoldPosition ? 'Held for upgrade' : 'Pending'}
                                </p>
                                <p className={`text-lg font-bold ${isHoldPosition ? 'text-amber-700' : 'text-blue-600'}`}>
                                    {formatCurrency(held || earned, currentUser?.currency || 'USD')}
                                </p>
                            </div>
                        )}
                         {isHeldView && breakdown.length > 0 ? (
                            <div className="text-sm space-y-1">
                                {breakdown.map((item, idx) => (
                                    <div key={idx} className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-500 uppercase">{item.reason}</span>
                                        <span className="font-bold text-blue-600">{formatCurrency(item.amount, currentUser?.currency)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    };

    const renderTreeNode = (node: GenealogyNode & { isSkipped?: boolean }) => {
        if (node.isSkipped) return <React.Fragment key={node.user._id}>{node.children.map(child => renderTreeNode(child))}</React.Fragment>;
        const iCollapsed = collapsedNodes.has(node.user._id);
        const hasChildren = node.children.length > 0;
        return (
            <li key={node.user._id} className="relative pl-4 sm:pl-6 pt-2">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 -ml-2"></div>
                <div className="absolute left-0 top-8 w-4 h-px bg-gray-200 dark:bg-gray-700 -ml-2"></div>
                <div className="mb-2">
                    <ReferralCardContent node={node} toggleNode={toggleNode} isCollapsed={iCollapsed} hasChildren={hasChildren} isTree={true} />
                </div>
                {hasChildren && !iCollapsed && <ul className="border-l border-gray-200 dark:border-gray-700 ml-2 pl-2">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };

    if (!currentUser) return <div className="p-10 text-center text-gray-500">Loading network...</div>;

    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Network</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">View earnings generated from your team for specific plans.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/member/transactions')}>Full History</Button>
            </div>

            {uniqueActivePlans.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-x-auto gap-2">
                    {uniqueActivePlans.map(plan => (
                        <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[140px] py-2 px-4 rounded-md text-sm font-medium transition-all border ${selectedPlanId === plan.planId ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30' : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'}`}>{plan.planName}</button>
                    ))}
                </div>
            )}

            {upgradeProgress && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-amber-200 shadow-lg shadow-amber-500/10 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-2xl">🚀</span> Auto-Upgrade Progress
                            </h3>
                            <p className="text-sm text-gray-500">Held commissions from specific slots are funding your upgrade to <strong className="text-blue-600">{upgradeProgress.targetName}</strong>.</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Funded Status</p>
                            <p className="text-xl font-black text-amber-600">{formatCurrency(upgradeProgress.heldAmount, currentUser.currency)} / {formatCurrency(upgradeProgress.targetPrice, currentUser.currency)}</p>
                        </div>
                    </div>
                    <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden border dark:border-gray-600 shadow-inner">
                        <div 
                            className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                            style={{ width: `${upgradeProgress.percentage}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-black uppercase text-gray-400 tracking-tighter">
                        <span>Current Savings</span>
                        <span className="text-amber-500">{upgradeProgress.percentage.toFixed(0)}% Complete</span>
                        <span>Target reached</span>
                    </div>
                </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2">
                    <button onClick={() => setViewMode('commissions')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'commissions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Commission List</button>
                    <button onClick={() => setViewMode('tree')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Tree View</button>
                    <button onClick={() => setViewMode('overflow')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'overflow' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Overflow</button>
                    <button onClick={() => setViewMode('held')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'held' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Held ({heldCommissionsData.count})</button>
                </div>
                <div className="p-4 md:p-6 overflow-x-auto">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-blue-500 rounded-full mr-2"></span>Direct Referrals</h3>{directEarners.length > 0 ? <div className="space-y-3">{directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} isTree={false} />)}</div> : <div className="p-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500">No direct commissions yet.</div>}</div>
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-purple-500 rounded-full mr-2"></span>Indirect Team</h3>{indirectEarners.length > 0 ? <div className="space-y-3">{indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} isTree={false} />)}</div> : <div className="p-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500">No indirect commissions yet.</div>}</div>
                        </div>
                    )}
                    {viewMode === 'tree' && (genealogyTree.length > 0 ? <ul className="space-y-4">{genealogyTree.map(node => renderTreeNode(node))}</ul> : <div className="flex flex-col items-center justify-center py-12 text-gray-400"><p>No earning network found for this plan.</p></div>)}
                    {viewMode === 'overflow' && (
                        <div className="space-y-3">
                             {overflowReferrals.length > 0 ? overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} isTree={false} />) : <div className="text-center py-12 text-gray-500">No overflow referrals.</div>}
                        </div>
                    )}
                    {viewMode === 'held' && (
                        <div className="space-y-3">
                            {heldCommissionsData.referrals.length > 0 ? heldCommissionsData.referrals.map(user => <ReferralCardContent key={user._id} node={{user}} isTree={false} isHeldView={true} />) : <div className="text-center py-12 text-gray-500">No commissions held.</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Referrals;
