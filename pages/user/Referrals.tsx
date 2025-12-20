
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
    
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'inactive' | 'held' | 'all'>('commissions');

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

    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0 };
        const limit = selectedPlanDetails.directReferralLimit || 0;
        
        const used = users.filter(u => 
            u.sponsor && 
            u.sponsor.toLowerCase() === currentUser.username.toLowerCase() && 
            u.activePlans?.some(ap => equivalentPlanIdsForSelected.has(String(ap.planId)))
        ).length;

        return { used, limit };
    }, [currentUser, selectedPlanDetails, users, equivalentPlanIdsForSelected]);

    const globalHeldData = useMemo(() => {
        if (!currentUser) return { referrals: [], count: 0, stats: new Map() };
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, planId?: string, planName?: string, amount: number, isHoldPosition?: boolean }[] }>();
        transactions
            .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Pending')
            .forEach(t => {
                if (!t.sourceUserId) return;
                const current = pendingMap.get(t.sourceUserId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                let reason = "Pending Review";
                let missingPlanId = undefined;
                let missingPlanName = undefined;
                let isHoldPosition = false;

                if (t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold')) {
                    reason = "Auto-Upgrade Reservation";
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
                         reason = `Requires Upgrade to ${missingPlanName}`;
                     }
                }
                const existingEntry = current.breakdown.find(b => b.reason === reason && b.planId === missingPlanId);
                if (existingEntry) {
                    existingEntry.amount += t.amount;
                } else {
                    current.breakdown.push({ reason, planId: missingPlanId, planName: missingPlanName, amount: t.amount, isHoldPosition });
                }
                pendingMap.set(t.sourceUserId, current);
            });
        const heldIds = Array.from(pendingMap.keys());
        const referrals = users.filter(u => heldIds.includes(u._id));
        return { referrals, count: referrals.length, stats: pendingMap };
    }, [transactions, currentUser, settings, investmentPlans, getEquivalentIds, users]);

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
        
        // PRIORITY: Detect if this is a Hold Position (Auto-Upgrade slot)
        const isHoldPosition = referralComms.some(t => (t.status === 'Pending' || t.status === 'Approved') && (t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold')));

        // Detecting Overflow: A rejected $0 transaction that is NOT a hold position
        const hasOverflowTx = referralComms.some(t => t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('full') || t.description.toLowerCase().includes('overflow')));
        
        // Finalized flags
        const isOverflow = !isHoldPosition && hasOverflowTx;
        
        let earningSourcePlanId: string | undefined;
        if (referralComms.length > 0) {
            const bestTx = referralComms.find(t => t.status === 'Approved' || t.status === 'Pending') || referralComms[0];
            earningSourcePlanId = bestTx.relatedPlanId?.toString();
        }
        return { earned, held, status: referralComms[0]?.status, earningSourcePlanId, isHoldPosition, isOverflow };
    }, [currentUser, transactions]);

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
        const foundPlan = uniqueActivePlans.find(plan => {
            const ids = getEquivalentIds(plan.planId);
            const info = getCommissionInfoForReferral(selectedSponsor, ids);
            return info.earned > 0;
        });
        if (foundPlan) {
            setIsSponsorModalOpen(false);
            setSelectedPlanId(foundPlan.planId);
            setTimeout(() => { setHighlightedUserId(selectedSponsor._id); setViewMode('tree'); }, 100);
        } else {
            const isInCurrentTree = allNodes.some(n => n.user._id === selectedSponsor._id);
            if (isInCurrentTree) {
                 setHighlightedUserId(selectedSponsor._id);
                 setViewMode('tree');
                 setIsSponsorModalOpen(false);
            } else {
                 alert("This sponsor does not appear in your earning tree for any active plans.");
            }
        }
    };

    const renderMaxDirectCommission = (plan: InvestmentPlan) => {
        const comms = plan.directCommissions;
        if (!comms || comms.length === 0) return 'None';
        let maxVal = 0;
        let maxType = 'percentage';
        comms.forEach(c => {
            if (c.value > maxVal) {
                maxVal = c.value;
                maxType = c.type;
            }
        });
        const formattedVal = maxType === 'percentage' ? `${maxVal}%` : formatCurrency(maxVal, plan.currency);
        return comms.length > 1 ? `Up to ${formattedVal}` : formattedVal;
    };

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
            
            // LOGIC: If the user is a 'Hold Position' user OR has earned, they are active earners.
            if (info.earned > 0 || info.held > 0 || info.isHoldPosition) {
                if (node.level === 1) directEarnersList.push(node);
                else indirectEarnersList.push(node);
            } else {
                // Only move to overflow if they aren't earners/hold-slots AND triggered a limit transaction
                if (info.isOverflow && node.level === 1) {
                    overflowList.push(node);
                } else if (!node.user.activePlans || node.user.activePlans.length === 0) {
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

    const sponsorModalDetails = useMemo(() => {
        if (!selectedSponsor || !currentUser) return { sponsorEarnings: 0, displaySourcePlanName: 'N/A', earningSourcePlan: null, sponsorPlanInfo: null, planToView: null, isLinkedPlanEquivalent: false };
        const allCommissionsFromSponsor = transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.sourceUserId === selectedSponsor._id && t.status === 'Approved');
        const sponsorEarnings = allCommissionsFromSponsor.reduce((sum, t) => sum + t.amount, 0);
        const lastCommission = [...allCommissionsFromSponsor].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const earningSourcePlan = lastCommission?.relatedPlanId ? investmentPlans.find(p => p._id === String(lastCommission.relatedPlanId)) : null;
        let displaySourcePlanName = earningSourcePlan?.name || 'Unknown Plan';
        let planToView = earningSourcePlan;
        let isLinkedPlanEquivalent = false;
        if (earningSourcePlan && currentUser.currency !== earningSourcePlan.currency && settings.planEquivalencyGroups) {
            const group = settings.planEquivalencyGroups.find(g => String(g.usdPlanId) === String(earningSourcePlan._id) || String(g.pkrPlanId) === String(earningSourcePlan._id) || String(g.eurPlanId) === String(earningSourcePlan._id));
            if (group) {
                const targetKey = `${currentUser.currency.toLowerCase()}PlanId` as keyof typeof group;
                const targetId = group[targetKey];
                if (targetId) {
                    const equivPlan = investmentPlans.find(p => p._id === String(targetId));
                    if (equivPlan) {
                        planToView = equivPlan;
                        if (selectedPlanId === String(targetId)) isLinkedPlanEquivalent = true;
                    }
                }
            }
        }
        return { sponsorEarnings, displaySourcePlanName, earningSourcePlan, sponsorPlanInfo: earningSourcePlan, planToView, isLinkedPlanEquivalent };
    }, [selectedSponsor, currentUser, transactions, investmentPlans, settings, selectedPlanId]);

    const { sponsorEarnings, displaySourcePlanName, earningSourcePlan, sponsorPlanInfo, planToView, isLinkedPlanEquivalent } = sponsorModalDetails;

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
        let breakdown: { reason: string, planId?: string, planName?: string, amount: number, isHoldPosition?: boolean }[] = [];
        let earningSourcePlanId: string | undefined;
        let commissionSourcePlans: string[] = [];
        let isHoldPosition = false;
        let isOverflow = false;

        if (isHeldView) {
            const stats = globalHeldData.stats.get(user._id);
            held = stats?.total || 0;
            breakdown = stats?.breakdown || [];
            if (breakdown.some(b => b.isHoldPosition)) isHoldPosition = true;
        } else if (isAllView) {
            const allApproved = transactions.filter(t => t.userId === currentUser?._id && t.type === 'Commission' && t.sourceUserId === user._id && t.status === 'Approved');
            earned = allApproved.reduce((sum, t) => sum + t.amount, 0);
            
            const pendingHold = transactions.find(t => t.userId === currentUser?._id && t.sourceUserId === user._id && t.status === 'Pending' && (t.description.toLowerCase().includes('position') || t.description.toLowerCase().includes('hold')));
            if (pendingHold) isHoldPosition = true;
            
            const overflowTx = transactions.find(t => t.userId === currentUser?._id && t.sourceUserId === user._id && t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('limit') || t.description.toLowerCase().includes('full') || t.description.toLowerCase().includes('overflow')));
            const anySuccess = transactions.find(t => t.userId === currentUser?._id && t.type === 'Commission' && t.sourceUserId === user._id && (t.status === 'Approved' || t.status === 'Pending'));
            
            if (overflowTx && !anySuccess) isOverflow = true;

            const planIds = new Set(allApproved.map(t => String(t.relatedPlanId)).filter(Boolean));
            commissionSourcePlans = Array.from(planIds).map(id => {
                const plan = investmentPlans.find(p => p._id === id);
                if (!plan) return 'Unknown Plan';
                let displayName = plan.name;
                if (currentUser && plan.currency !== currentUser.currency && settings.planEquivalencyGroups) {
                     const group = settings.planEquivalencyGroups.find(g => String(g.usdPlanId) === id || String(g.pkrPlanId) === id || String(g.eurPlanId) === id);
                    if (group) {
                        const targetKey = `${currentUser.currency.toLowerCase()}PlanId` as keyof typeof group;
                        const targetId = group[targetKey];
                        if (targetId && String(targetId) !== id) {
                             const equivPlan = investmentPlans.find(p => p._id === String(targetId));
                             if (equivPlan) displayName = `${plan.name} (Equiv to ${equivPlan.name})`;
                        }
                    }
                }
                return displayName;
            });
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
        const isEquivalent = sourcePlan && selectedPlanDetails && sourcePlan._id !== selectedPlanDetails._id;

        return (
            <div id={`node-${user._id}`} className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400 z-10' : 'border-gray-200 dark:border-gray-700'} border-l-4 ${isHeldView || isHoldPosition ? 'border-l-amber-500 bg-amber-50/10' : isOverflow ? 'border-l-orange-500' : isAllView ? 'border-l-indigo-500' : cardBorderClass} transition-all duration-200 hover:shadow-md`}>
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
                                {user.status !== Status.Active && <Badge status={user.status as Status} />}
                                
                                {isHoldPosition ? (
                                    <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-amber-600 animate-pulse">
                                        <span className="text-xs">🔒</span> Held for Upgrade: {formatCurrency(held || earned, currentUser?.currency)}
                                    </span>
                                ) : isOverflow ? (
                                    <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-orange-200 flex items-center gap-1">
                                        <span className="text-xs">⚠️</span> Overflow
                                    </span>
                                ) : null}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                {isHeldView ? (
                                    <p className="text-amber-600 dark:text-amber-500 font-bold">Action/Upgrade Required</p>
                                ) : isAllView ? (
                                     commissionSourcePlans.length > 0 ? (
                                        <p className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium flex-wrap">
                                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                                            <span>Purchased: {commissionSourcePlans.join(', ')}</span>
                                        </p>
                                     ) : (
                                         <p className="text-gray-400">
                                             {isHoldPosition ? 'Commission Held for Auto-Upgrade' : isOverflow ? 'Missed (Slot Limit Reached)' : 'No commission generated'}
                                         </p>
                                     )
                                ) : (
                                    sourcePlan ? (
                                        <p className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium flex-wrap">
                                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                                            <span>Qualifying Plan: {sourcePlan.name}</span>
                                            {isEquivalent && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 whitespace-nowrap" title={`Matched via equivalency to your ${selectedPlanDetails?.name} plan`}>(Equivalent)</span>}
                                        </p>
                                    ) : <p className="text-gray-400">{isHoldPosition ? 'Commission Reserved for Auto-Upgrade' : isOverflow ? 'Slots full for this plan level' : 'No qualifying purchase'}</p>
                                )}
                                {user.sponsor && <p className="flex items-center gap-1"><span>Via:</span><button onClick={() => handleSponsorClick(user.sponsor!, user)} className="text-blue-500 hover:underline font-medium">@{user.sponsor}</button></p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto text-right pl-9 sm:pl-0">
                        {(earned > 0 && !isHoldPosition) && (
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">{isAllView ? 'Total Earned' : 'Commission'}</p>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(earned, currentUser?.currency || 'USD')}</p>
                            </div>
                        )}
                        
                        {(held > 0 || isHoldPosition) && !isHeldView && (
                             <div className={`${isHoldPosition ? 'bg-amber-100 border-amber-300' : 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800'} px-3 py-1 rounded border`}>
                                <p className={`text-[10px] uppercase font-bold tracking-wider ${isHoldPosition ? 'text-amber-900' : 'text-amber-800 dark:text-amber-200'}`}>
                                    {isHoldPosition ? 'Reserved for Upgrade' : 'Pending'}
                                </p>
                                <p className={`text-lg font-bold ${isHoldPosition ? 'text-amber-700' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {formatCurrency(held || earned, currentUser?.currency || 'USD')}
                                </p>
                            </div>
                        )}

                        {isOverflow && !isHeldView && (earned === 0 && held === 0) && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded border border-orange-100 dark:border-orange-800">
                                <p className="text-[10px] uppercase text-orange-800 dark:text-orange-200 font-bold tracking-wider">Missed</p>
                                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(0, currentUser?.currency || 'USD')}</p>
                            </div>
                        )}
                        {isHeldView && breakdown.length > 0 ? (
                            <div className="bg-amber-50 dark:bg-amber-900/10 p-2 rounded border border-amber-100 dark:border-amber-800 space-y-2 w-full sm:w-auto">
                                {breakdown.map((item, idx) => (
                                    <div key={idx} className="flex flex-col items-end gap-1">
                                        <div className="text-sm flex items-center justify-end gap-2">
                                            <span className={`text-xs font-medium ${item.isHoldPosition ? 'text-amber-600' : 'text-amber-700 dark:text-amber-400'}`}>
                                                {item.isHoldPosition ? '🔒 ' : ''}{item.reason}:
                                            </span>
                                            <span className="font-bold text-amber-800 dark:text-amber-300">{formatCurrency(item.amount, currentUser?.currency)}</span>
                                        </div>
                                        {item.planId && !item.isHoldPosition && <button onClick={(e) => { e.stopPropagation(); navigate('/member/plans', { state: { highlightPlanId: item.planId } }); }} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1"><span>Buy {item.planName}</span><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></button>}
                                        {item.reason === 'No Active Plan' && <button onClick={(e) => { e.stopPropagation(); navigate('/member/plans'); }} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1"><span>Activate Earnings</span><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></button>}
                                        {item.isHoldPosition && <p className="text-[9px] text-amber-500 italic max-w-[120px]">Automatically reserved for your next plan level upgrade.</p>}
                                    </div>
                                ))}
                                <div className="border-t border-amber-200 dark:border-amber-800 pt-1 text-[10px] text-amber-600 dark:text-amber-500 font-bold text-right mt-1">Total: {formatCurrency(held, currentUser?.currency)}</div>
                            </div>
                        ) : null}
                        {(earned === 0 && held === 0 && !isOverflow && !isHoldPosition) && <span className="text-xs text-gray-400 italic">No commission</span>}
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
            <li key={node.user._id} className="relative pl-4 sm:pl-6 pt-2">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 -ml-2"></div>
                <div className="absolute left-0 top-8 w-4 h-px bg-gray-200 dark:bg-gray-700 -ml-2"></div>
                <div className="mb-2">
                    <ReferralCardContent node={node} toggleNode={toggleNode} isCollapsed={isCollapsed} hasChildren={hasChildren} isTree={true} />
                </div>
                {hasChildren && !isCollapsed && <ul className="border-l border-gray-200 dark:border-gray-700 ml-2 pl-2">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };

    if (!currentUser) return <div className="p-10 text-center text-gray-500">Loading network...</div>;

    const currentPlanName = selectedPlanDetails?.name || uniqueActivePlans.find(p => p.planId === selectedPlanId)?.planName || 'Network';
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

            {uniqueActivePlans.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-x-auto gap-2">
                    {uniqueActivePlans.map(plan => {
                        const isActive = selectedPlanId === plan.planId;
                        return (
                            <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[140px] py-2 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap border ${isActive ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{plan.planName}</button>
                        )
                    })}
                </div>
            ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3"><span className="text-2xl">⚠️</span><div><h3 className="font-bold text-yellow-800 text-sm dark:text-yellow-200">No Active Plans</h3><p className="text-xs text-yellow-700 dark:text-yellow-300">Purchase a plan to start earning commissions.</p></div></div>
                    <Button size="sm" onClick={() => navigate('/member/plans')}>Buy Plan</Button>
                </div>
            )}

            {selectedPlanDetails && (viewMode !== 'held' && viewMode !== 'all') && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 animate-fade-in">
                    <div className="flex flex-col md:flex-row">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 flex flex-row md:flex-col justify-between md:justify-center items-center gap-2 md:w-48 text-center shrink-0">
                            <div><h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{selectedPlanDetails.name}</h3><div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Plan Details</div></div>
                            <div className="text-right md:text-center"><span className="block text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span></div>
                        </div>
                        <div className="flex-1 p-3 md:p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                            <div className="text-center md:text-left border-r border-gray-100 dark:border-gray-100 last:border-0 px-2"><span className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Duration</span><span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{selectedPlanDetails.durationDays === 0 ? 'Lifetime' : `${selectedPlanDetails.durationDays} Days`}</span></div>
                            <div className="text-center md:text-left border-r border-gray-100 dark:border-gray-100 last:border-0 px-2"><span className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Min Withdraw</span><span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(selectedPlanDetails.minWithdraw, selectedPlanDetails.currency)}</span></div>
                            <div className="text-center md:text-left border-r border-gray-100 dark:border-gray-100 last:border-0 px-2"><span className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Direct Comm</span><span className="text-sm font-bold text-green-600 dark:text-green-400">{renderMaxDirectCommission(selectedPlanDetails)}</span></div>
                            <div className="text-center md:text-left px-2"><span className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-1">Indirect</span><div className="flex items-center justify-center md:justify-start gap-1.5"><span className="text-sm font-bold text-purple-600 dark:text-purple-400">{selectedPlanDetails.indirectCommissions.length}</span><span className="text-xs text-gray-500">Levels</span></div></div>
                        </div>
                    </div>
                    <div className="px-4 py-4 bg-blue-50/30 dark:bg-blue-900/10 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-2"><h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">Active Direct Referrals</h4><span className="text-sm font-bold text-blue-600 dark:text-blue-400">Slots: {slotStats.used} / {slotStats.limit === 0 ? '∞' : slotStats.limit} used</span></div>
                        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-1000 ease-out ${slotStats.limit > 0 && slotStats.used >= slotStats.limit ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} style={{ width: `${slotStats.limit === 0 ? 100 : Math.min(100, (slotStats.used / slotStats.limit) * 100)}%` }}></div></div>
                        {slotStats.limit > 0 && slotStats.used >= slotStats.limit && <p className="text-[10px] text-red-500 font-bold mt-2 animate-pulse uppercase">Maximum direct slots reached for this plan level.</p>}
                    </div>
                </div>
            )}

            <ShareButtons url={referralLink} title="Join my network on SmartEarning!" />

            {(viewMode !== 'held' && viewMode !== 'all') && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Commission</p>
                        <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(networkStats.earnings, currentUser.currency)}</h3>
                        <p className="text-xs text-gray-400 mt-1">From {currentPlanName}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Direct Earnings</p>
                        <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(networkStats.directEarnings, currentUser.currency)}</h3>
                        <p className="text-xs text-gray-400 mt-1">{directEarners.length} Contributors</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Indirect Earnings</p>
                        <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(networkStats.indirectEarnings, currentUser.currency)}</h3>
                        <p className="text-xs text-gray-400 mt-1">{indirectEarners.length} Contributors</p>
                    </div>
                </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2">
                    <button onClick={() => setViewMode('commissions')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'commissions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Commission List ({directEarners.length + indirectEarners.length})</button>
                    <button onClick={() => setViewMode('tree')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Tree View ({genealogyTree.length})</button>
                    <button onClick={() => setViewMode('overflow')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'overflow' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Overflow & Waiting ({overflowReferrals.length})</button>
                    <button onClick={() => setViewMode('held')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'held' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Held Commissions ({globalHeldData.count})</button>
                    <button onClick={() => setViewMode('all')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>All Referrals ({allNodes.length})</button>
                    <button onClick={() => setViewMode('inactive')} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === 'inactive' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Inactive Members ({inactiveReferrals.length})</button>
                </div>
                <div className="p-4 md:p-6 overflow-x-auto">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-blue-500 rounded-full mr-2"></span>Direct Referrals (Level 1)</h3>{directEarners.length > 0 ? <div className="space-y-3">{directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} toggleNode={() => {}} isCollapsed={false} hasChildren={false} isTree={false} />)}</div> : <div className="p-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg"><p className="text-gray-500 text-sm">No direct commissions yet.</p></div>}</div>
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-purple-500 rounded-full mr-2"></span>Indirect Team (Level 2+)</h3>{indirectEarners.length > 0 ? <div className="space-y-3">{indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} toggleNode={() => {}} isCollapsed={false} hasChildren={false} isTree={false} />)}</div> : <div className="p-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg"><p className="text-gray-500 text-sm">No indirect commissions yet.</p></div>}</div>
                        </div>
                    )}
                    {viewMode === 'tree' && (genealogyTree.length > 0 ? <ul className="space-y-4">{genealogyTree.map(node => renderTreeNode(node))}</ul> : <div className="flex flex-col items-center justify-center py-12 text-gray-400"><span className="text-4xl mb-2">🌱</span><p>No earning network found for this plan.</p></div>)}
                    {viewMode === 'overflow' && (
                        <div className="space-y-3">
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-4 flex gap-3 items-start"><span className="text-xl">📊</span><div><h4 className="font-bold text-orange-800 dark:text-orange-200 text-sm">Overflow Referrals</h4><p className="text-xs text-orange-700 dark:text-orange-300 mt-1">These direct referrals joined when your direct slots for the {currentPlanName} plan were full. You can earn from them if they upgrade to a higher plan where you have open slots!</p></div></div>
                            {overflowReferrals.length > 0 ? overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} toggleNode={() => {}} isCollapsed={false} hasChildren={false} isTree={false} />) : <div className="flex flex-col items-center justify-center py-12 text-green-600 font-bold bg-green-50 dark:bg-green-900/10 rounded-lg border-2 border-dashed border-green-200 dark:border-green-800"><p>Great! You have captured all potential commissions for this plan level.</p></div>}
                        </div>
                    )}
                    {viewMode === 'held' && <div className="space-y-3"><div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4 flex gap-3 items-start"><span className="text-xl">💡</span><div><h4 className="font-bold text-yellow-800 dark:text-yellow-200 text-sm">Global Held Commissions</h4><p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">This list shows ALL pending commissions from your network, regardless of the selected plan context. Purchasing the required plan mentioned below will release these funds to your wallet.</p></div></div>{globalHeldData.referrals.length > 0 ? globalHeldData.referrals.map(user => <ReferralCardContent key={user._id} node={{user}} toggleNode={() => {}} isCollapsed={false} hasChildren={false} isTree={false} isHeldView={true} />) : <div className="flex flex-col items-center justify-center py-12 text-gray-400"><p>No held commissions.</p></div>}</div>}
                    {viewMode === 'all' && <div className="space-y-3"><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-indigo-600 rounded-full mr-2"></span>Complete Referral List ({allNodes.length})</h3>{allNodes.length > 0 ? allNodes.map(node => <ReferralCardContent key={node.user._id} node={node} toggleNode={() => {}} isCollapsed={false} hasChildren={false} isTree={false} isAllView={true} />) : <div className="flex flex-col items-center justify-center py-12 text-gray-400"><p>No referrals found.</p></div>}</div>}
                    {viewMode === 'inactive' && (inactiveReferrals.length > 0 ? <div className="space-y-3"><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-red-600 rounded-full mr-2"></span>Inactive Referrals (No Active Plan)</h3>{inactiveReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} toggleNode={() => {}} isCollapsed={false} hasChildren={false} isTree={false} />)}</div> : <div className="flex flex-col items-center justify-center py-12 text-gray-400"><p>No inactive referrals found.</p></div>)}
                </div>
            </div>

            {isSponsorModalOpen && selectedSponsor && selectedReferralForSponsorModal && (
                <Modal isOpen={isSponsorModalOpen} onClose={() => setIsSponsorModalOpen(false)}>
                    <div className="p-6 max-w-md text-center">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-2xl font-bold">{selectedSponsor.fullName.charAt(0)}</div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedSponsor.fullName}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">@{selectedSponsor.username}</p>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl text-left border border-gray-100 dark:border-gray-600 space-y-4">
                            <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Country</p><p className="font-semibold text-gray-900 dark:text-white flex items-center"><span className="text-lg mr-2">🌍</span> {selectedSponsor.country}</p></div>
                            <div className="grid grid-cols-2 gap-4 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div><p className="text-xs text-gray-500 uppercase font-bold mb-1">Earning Source Plan</p><p className="font-bold text-gray-900 dark:text-white text-sm">{displaySourcePlanName}</p><p className="text-[10px] text-gray-400">{earningSourcePlan?.currency || sponsorPlanInfo?.currency}</p>{planToView && earningSourcePlan && String(planToView._id) !== String(earningSourcePlan._id) && <p className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 mt-1 rounded border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">(Equivalent: {planToView.name})</p>}</div>
                                <div className="border-l pl-3 dark:border-gray-600"><p className="text-xs text-blue-500 uppercase font-bold mb-1">Your Linked Plan</p><p className="font-bold text-blue-700 dark:text-blue-300 text-sm">{selectedPlanDetails?.name || 'None'}</p>{selectedPlanDetails && <p className="text-[10px] text-blue-400">{selectedPlanDetails.currency}</p>}{isLinkedPlanEquivalent && <p className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 mt-1 rounded border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">(Equivalent to {displaySourcePlanName})</p>}</div>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-2"><p className="text-xs text-gray-500 uppercase font-bold mb-1">Total Earned from {selectedSponsor.username}</p><p className="text-3xl font-extrabold text-green-600 dark:text-green-400 tracking-tight">{formatCurrency(sponsorEarnings, currentUser.currency)}</p></div>
                            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mt-4"><p className="text-xs text-bold text-blue-700 dark:text-blue-300 uppercase font-bold mb-2">Sponsor For (Downline)</p><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-800 dark:text-blue-100">{selectedReferralForSponsorModal.fullName.charAt(0)}</div><div className="text-left"><p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{selectedReferralForSponsorModal.fullName}</p><p className="text-xs text-gray-500 dark:text-gray-400">@{selectedReferralForSponsorModal.username}</p></div></div></div>
                        </div>
                        <div className="mt-6 space-y-2">
                            <Button onClick={handleLocateSponsor} className="w-full bg-purple-600 hover:bg-purple-700">Locate {selectedSponsor.username} in Tree</Button>
                            {planToView && <Button onClick={() => { setIsSponsorModalOpen(false); navigate('/member/plans', { state: { highlightPlanId: String(planToView?._id) } }); }} className="w-full bg-green-600 hover:bg-green-700">View Sponsor Plan ({planToView.name})</Button>}
                            {selectedPlanDetails && <Button onClick={() => { setIsSponsorModalOpen(false); navigate('/member/plans', { state: { highlightPlanId: String(selectedPlanDetails._id) } }); }} className="w-full bg-blue-600 hover:bg-blue-700">View My {selectedPlanDetails.name} Plan</Button>}
                            <Button variant="secondary" onClick={() => setIsSponsorModalOpen(false)} className="w-full">Close</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Referrals;
