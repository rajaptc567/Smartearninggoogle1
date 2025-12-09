
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
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
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    
    // Filters - Default to showing relevant (commission-generating) referrals only
    const [showRelevantOnly, setShowRelevantOnly] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    
    // View Tab State: 'all' | 'inactive' | '1' | '2' etc.
    const [viewTab, setViewTab] = useState<string>('all');

    // Sponsor Modal State
    const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
    const [selectedSponsor, setSelectedSponsor] = useState<User | null>(null);
    const [selectedReferralForSponsorModal, setSelectedReferralForSponsorModal] = useState<User | null>(null);

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
    // Reset view tab when plan changes
    useEffect(() => {
        setViewTab('all');
    }, [selectedPlanId]);
    
    // Determine which plans are equivalent to the selected one
    const equivalentPlanIdsForSelected = useMemo(() => {
        const ids = new Set<string>();
        if (selectedPlanId) {
            ids.add(selectedPlanId);
            const group = settings.planEquivalencyGroups?.find(g =>
                g.usdPlanId === selectedPlanId ||
                g.pkrPlanId === selectedPlanId ||
                g.eurPlanId === selectedPlanId
            );
            if (group) {
                if (group.usdPlanId) ids.add(group.usdPlanId);
                if (group.pkrPlanId) ids.add(group.pkrPlanId);
                if (group.eurPlanId) ids.add(group.eurPlanId);
            }
        }
        return ids;
    }, [selectedPlanId, settings.planEquivalencyGroups]);
    
    const selectedPlanDetails = useMemo(() => {
        if (!selectedPlanId) return null;
        return investmentPlans.find(p => p._id === selectedPlanId);
    }, [selectedPlanId, investmentPlans]);

    // Calculate max levels based on the specific plan structure
    const maxLevels = useMemo(() => {
        if (!selectedPlanDetails) return 10; // Default fallback
        // 1 Direct Level + Length of Indirect Array
        return 1 + (selectedPlanDetails.indirectCommissions?.length || 0);
    }, [selectedPlanDetails]);

    const getEquivalentPlanNameForUserCurrency = useCallback((planId: string) => {
        if (!settings.planEquivalencyGroups || !currentUser) return null;
        
        const group = settings.planEquivalencyGroups.find(g => 
            g.usdPlanId === planId ||
            g.pkrPlanId === planId ||
            g.eurPlanId === planId
        );

        if (!group) return null;

        let targetPlanId;
        if (currentUser.currency === 'USD') targetPlanId = group.usdPlanId;
        else if (currentUser.currency === 'EUR') targetPlanId = group.eurPlanId;
        else if (currentUser.currency === 'PKR') targetPlanId = group.pkrPlanId;

        if (!targetPlanId || targetPlanId === planId) return null;

        const targetPlan = investmentPlans.find(p => p._id === targetPlanId);
        return targetPlan ? targetPlan.name : null;
    }, [settings.planEquivalencyGroups, currentUser, investmentPlans]);

    const renderDirectCommissionSummary = (plan: InvestmentPlan) => {
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
        
        if (comms.length > 1) {
             return `Up to ${formattedVal}`;
        }
        
        return formattedVal;
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>): { earned: number; held: number; pendingReason: string | null; relatedPlanName?: string; earningSourcePlan?: string } => {
        if (!currentUser) return { earned: 0, held: 0, pendingReason: null };

        const referralCommissions = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(t.relatedPlanId) : false) 
        );

        const approvedTx = referralCommissions.filter(t => t.status === 'Approved');
        const earned = approvedTx.reduce((sum, t) => sum + t.amount, 0);

        // Identify the plan that generated the commission
        let earningSourcePlan: string | undefined;
        if (approvedTx.length > 0) {
            // Find the most relevant transaction (e.g., the first one or latest)
            const tx = approvedTx[0];
            if (tx.relatedPlanId) {
                const p = investmentPlans.find(pl => pl._id === tx.relatedPlanId);
                if (p) earningSourcePlan = p.name;
            }
        }

        const pendingTransactions = referralCommissions.filter(t => t.status === 'Pending');
        const held = pendingTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        let pendingReason: string | null = null;
        let relatedPlanName: string | undefined = undefined;

        if (pendingTransactions.length > 0) {
            const pendingTx = pendingTransactions[0];
            const uplineUser = currentUser;
            const referralPlanId = pendingTx.relatedPlanId;

            if (uplineUser.restrictions?.earning) {
                pendingReason = `Admin Paused Earnings`;
            } else if (settings.requirePlanMatchForCommission && referralPlanId) {
                const group = (settings.planEquivalencyGroups || []).find(g => 
                    g.usdPlanId === referralPlanId ||
                    g.pkrPlanId === referralPlanId ||
                    g.eurPlanId === referralPlanId
                );
                
                let hasEquivalentPlan = (uplineUser.activePlans || []).some(p => {
                    if (group) {
                        return p.planId === group.usdPlanId || p.planId === group.pkrPlanId || p.planId === group.eurPlanId;
                    }
                    return p.planId === referralPlanId;
                });

                if (!hasEquivalentPlan) {
                    pendingReason = `Missing Required Plan`;
                    
                    if (group) {
                        const userCurrencyKey = currentUser.currency === 'USD' ? 'usdPlanId' : currentUser.currency === 'EUR' ? 'eurPlanId' : 'pkrPlanId';
                        // @ts-ignore
                        const requiredPlanId = group[userCurrencyKey];
                        const plan = investmentPlans.find(p => p._id === requiredPlanId);
                        if (plan) relatedPlanName = plan.name;
                    } 
                    
                    if (!relatedPlanName) {
                        const plan = investmentPlans.find(p => p._id === referralPlanId);
                        if (plan) relatedPlanName = `${plan.name} (or equivalent)`;
                    }
                }
            } else if (settings.requireActivePlanForCommission) {
                if (!uplineUser.activePlans || uplineUser.activePlans.length === 0) {
                    pendingReason = `No Active Plan`;
                }
            }
            
            if (!pendingReason) {
                pendingReason = "Under Review";
            }
        }
        return { earned, held, pendingReason, relatedPlanName, earningSourcePlan };
    }, [currentUser, transactions, settings, investmentPlans]);

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

    const { genealogyTree, flatList, networkStats } = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], flatList: [], networkStats: { totalReferrals: 0, activeMembers: 0, earnings: 0 } };

        // 1. Build Full Tree First
        const buildFullTree = (sponsorUsername: string, level: number): GenealogyNode[] => {
            const directReferrals = users.filter(u => u.sponsor && u.sponsor.toLowerCase() === sponsorUsername.toLowerCase());
            return directReferrals.map(child => ({
                user: child,
                children: buildFullTree(child.username, level + 1),
                level
            }));
        };
        const fullGenealogyTree = buildFullTree(currentUser.username, 1);

        // 2. Flatten for List Views & Stats
        const allNodes: GenealogyNode[] = [];
        const flatten = (nodes: GenealogyNode[]) => {
            nodes.forEach(node => {
                allNodes.push(node);
                flatten(node.children);
            });
        };
        flatten(fullGenealogyTree);

        // 3. Prepare Display Data based on View Mode
        let treeToRender: GenealogyNode[] = [];
        let listToRender: GenealogyNode[] = [];

        // Helper: Check if a single node matches Status and Relevance filters
        const matchesFilters = (node: GenealogyNode) => {
            // Relevance
            const { earned, held } = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            const isRelevant = !showRelevantOnly || (earned > 0 || held > 0);
            // Status
            const matchesStatus = filterStatus === 'all' || node.user.status === filterStatus;
            
            return isRelevant && matchesStatus;
        };

        if (viewTab === 'all') {
            // Recursive Filtering for Tree View
            const filterRecursive = (nodes: GenealogyNode[]): GenealogyNode[] => {
                return nodes.map(node => {
                    const isTarget = matchesFilters(node);
                    const filteredChildren = filterRecursive(node.children);
                    
                    // Keep if target match OR has matching children (path to target)
                    if (isTarget || filteredChildren.length > 0) {
                        return { ...node, children: filteredChildren };
                    }
                    return null;
                }).filter((n): n is GenealogyNode => n !== null);
            };
            treeToRender = filterRecursive(fullGenealogyTree);
        } else if (viewTab === 'inactive') {
            // Filter flat list for inactive users (No Active Plans)
            listToRender = allNodes.filter(node => {
                const hasPlans = node.user.activePlans && node.user.activePlans.length > 0;
                return !hasPlans && matchesFilters(node);
            });
        } else {
            // Flat Filtering for Specific Level View
            const targetLevel = parseInt(viewTab);
            listToRender = allNodes.filter(node => {
                if (node.level !== targetLevel) return false;
                return matchesFilters(node);
            });
        }

        // 4. Calculate Stats (Contextual to current plan)
        const activeMembersInSelectedPlan = allNodes.filter(n => n.user.activePlans?.some(p => equivalentPlanIdsForSelected.has(p.planId)));
        const finalDownlineUserIds = new Set(allNodes.map(n => n.user._id));
        
        const totalEarnings = transactions
            .filter(t => 
                t.userId === currentUser._id && 
                t.type === 'Commission' && 
                t.status === 'Approved' && 
                t.sourceUserId &&
                finalDownlineUserIds.has(t.sourceUserId) &&
                (t.relatedPlanId ? equivalentPlanIdsForSelected.has(t.relatedPlanId) : false) 
            )
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            genealogyTree: treeToRender,
            flatList: listToRender,
            networkStats: { 
                totalReferrals: allNodes.length,
                activeMembers: activeMembersInSelectedPlan.length,
                earnings: totalEarnings
            }
        };
    }, [currentUser, users, transactions, equivalentPlanIdsForSelected, showRelevantOnly, filterStatus, viewTab, getCommissionInfoForReferral]);

    // Renders the Card Content (Reused for both Tree and Flat views)
    const ReferralCardContent = ({ node, toggleNode, isCollapsed, hasChildren, isTree }: { node: GenealogyNode, toggleNode: Function, isCollapsed: boolean, hasChildren: boolean, isTree: boolean }) => {
        const { user, level } = node;
        
        const activePlanForView = user.activePlans?.find(p => equivalentPlanIdsForSelected.has(p.planId));
        const isUserActiveInSelectedPlan = !!activePlanForView;
        
        const otherActivePlan = !isUserActiveInSelectedPlan && user.activePlans && user.activePlans.length > 0 
            ? user.activePlans[0] 
            : null;
            
        const equivalentPlanName = otherActivePlan ? getEquivalentPlanNameForUserCurrency(otherActivePlan.planId) : null;
        const { earned, held, pendingReason, relatedPlanName, earningSourcePlan } = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);

        const noCommission = earned === 0 && held === 0;

        let commissionRateLabel = null;
        if (selectedPlanDetails) {
            let commConfig;
            if (level === 1) {
                commConfig = (selectedPlanDetails.directCommissions || [])[0];
            } else {
                commConfig = (selectedPlanDetails.indirectCommissions || [])[level - 2];
            }

            if (commConfig) {
                const val = commConfig.type === 'percentage' ? `${commConfig.value}%` : formatCurrency(commConfig.value, selectedPlanDetails.currency);
                commissionRateLabel = <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 ml-2">Rate: {val}</span>;
            }
        }

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-xl border-l-4 shadow-sm transition-all duration-200 
                ${held > 0 ? 'border-yellow-400' : isUserActiveInSelectedPlan ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}
            `}>
                <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {/* Only show expand button in Tree view if has children */}
                        {isTree && hasChildren ? (
                            <button 
                                onClick={() => toggleNode(user._id)} 
                                className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors border border-blue-200 dark:border-blue-800"
                            >
                                {isCollapsed ? '+' : '−'}
                            </button>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">
                                {user.fullName.charAt(0)}
                            </div>
                        )}
                        
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.fullName}</h4>
                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                                    Level {level}
                                </span>
                                {commissionRateLabel}
                                <Badge status={user.status} />
                            </div>
                            <p className="text-xs text-gray-500">@{user.username}</p>
                            
                            {/* Detailed Commission Source Display - Only if earned */}
                            {earned > 0 && (
                                <div className="mt-2 text-xs bg-green-50 dark:bg-green-900/10 p-2 rounded-md border border-green-100 dark:border-green-800/30 flex flex-wrap gap-x-4 gap-y-1 items-center">
                                    {user.sponsor && (
                                        <div className="flex items-center">
                                            <span className="text-gray-500 dark:text-gray-400 mr-1">Upline:</span>
                                            <button 
                                                onClick={() => handleSponsorClick(user.sponsor!, user)} 
                                                className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-0.5"
                                                title="View Upline Details"
                                            >
                                                @{user.sponsor}
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            </button>
                                        </div>
                                    )}
                                    {earningSourcePlan && (
                                        <div className="flex items-center">
                                            <span className="text-gray-500 dark:text-gray-400 mr-1">Purchased:</span>
                                            <span className="font-medium text-gray-700 dark:text-gray-200">{earningSourcePlan}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Plan info ONLY if commission exists or held */}
                            {!noCommission && (
                                <div className="mt-1">
                                    {isUserActiveInSelectedPlan ? (
                                        <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center">
                                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                            Active in {activePlanForView?.planName}
                                        </span>
                                    ) : otherActivePlan ? (
                                        <span className="text-xs font-medium text-blue-500 flex items-center flex-wrap">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                                            Active in {otherActivePlan.planName}
                                            {equivalentPlanName ? (
                                                <span className="ml-1 text-gray-500 dark:text-gray-400 font-normal">
                                                        (≈ {equivalentPlanName})
                                                </span>
                                            ) : (
                                                <span className="ml-1 text-gray-500 dark:text-gray-400 font-normal">
                                                    (Not {selectedPlanDetails?.name})
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium text-gray-400 flex items-center">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                                            Inactive (No Plan)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto mt-2 md:mt-0 pl-11 md:pl-0">
                        <div className="flex gap-4 text-right">
                            {earned > 0 && (
                                <div>
                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Earned</p>
                                    <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(earned, currentUser?.currency || 'USD')}</p>
                                </div>
                            )}
                            {held > 0 && (
                                <div>
                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Held</p>
                                    <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(held, currentUser?.currency || 'USD')}</p>
                                </div>
                            )}
                        </div>

                        {held > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-2 flex items-center gap-3">
                                <div className="text-xs">
                                    <p className="font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                        {pendingReason}
                                    </p>
                                    {pendingReason === 'Missing Required Plan' && relatedPlanName && (
                                        <p className="text-yellow-700 dark:text-yellow-300 mt-0.5">
                                            Buy <strong>{relatedPlanName}</strong> to unlock.
                                        </p>
                                    )}
                                </div>
                                {pendingReason === 'Missing Required Plan' && relatedPlanName && (
                                    <Button size="sm" className="whitespace-nowrap text-xs py-1 px-2 h-auto" onClick={() => navigate('/member/plans')}>
                                        Unlock Now
                                    </Button>
                                )}
                                {pendingReason === 'No Active Plan' && (
                                    <Button size="sm" className="whitespace-nowrap text-xs py-1 px-2 h-auto" onClick={() => navigate('/member/plans')}>
                                        Buy Any Plan
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Recursive Tree Node Renderer
    const renderTreeNode = (node: GenealogyNode) => {
        const { earned, held } = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
        const isRelevant = earned > 0 || held > 0;

        // If filtering by relevance and this node is not relevant, skip rendering the card 
        // and instead render its children directly at this level (flattening).
        if (showRelevantOnly && !isRelevant) {
            return (
                <React.Fragment key={node.user._id}>
                    {node.children.map(child => renderTreeNode(child))}
                </React.Fragment>
            );
        }

        const isCollapsed = collapsedNodes.has(node.user._id);
        const hasChildren = node.children.length > 0;

        return (
            <li key={node.user._id} className="relative pl-6 sm:pl-8">
                {/* Connecting Lines */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-700 -ml-4"></div>
                <div className="absolute left-0 top-6 w-4 sm:w-6 h-px bg-gray-300 dark:bg-gray-700 -ml-4"></div>

                <div className="mt-4">
                    <ReferralCardContent node={node} toggleNode={toggleNode} isCollapsed={isCollapsed} hasChildren={hasChildren} isTree={true} />
                </div>

                {hasChildren && !isCollapsed && (
                    <ul className="animate-fade-in-down border-l border-gray-300 dark:border-gray-700 ml-0">
                        {node.children.map(child => renderTreeNode(child))}
                    </ul>
                )}
            </li>
        );
    };

    // Flat List Node Renderer
    const renderFlatNode = (node: GenealogyNode) => {
        return (
            <div key={node.user._id} className="mb-3">
                <ReferralCardContent node={node} toggleNode={() => {}} isCollapsed={false} hasChildren={false} isTree={false} />
            </div>
        );
    };

    if (!currentUser) return <div className="p-10 text-center text-gray-500">Loading network...</div>;

    const currentPlanName = selectedPlanDetails?.name || uniqueActivePlans.find(p => p.planId === selectedPlanId)?.planName || 'Network';
    
    // --- Sponsor Modal Data Calculation ---
    const calculateSponsorEarnings = () => {
        // Calculate earnings for the Current User (viewer) from the Selected Sponsor (the user shown in modal)
        if (!currentUser || !selectedSponsor) return 0;
        return transactions
            .filter(t => t.userId === currentUser._id && t.sourceUserId === selectedSponsor._id && t.type === 'Commission' && t.status === 'Approved')
            .reduce((sum, t) => sum + t.amount, 0);
    };

    const sponsorEarnings = calculateSponsorEarnings();
    
    const getSponsorRelevantPlan = () => {
        if (!selectedSponsor || !selectedSponsor.activePlans) return null;
        
        // Find a plan in sponsor's inventory that matches current context (selectedPlanId or its equivalents)
        const matchedPlan = selectedSponsor.activePlans.find(p => equivalentPlanIdsForSelected.has(p.planId));
        
        if (matchedPlan) {
            return {
                name: matchedPlan.planName,
                isEquivalent: matchedPlan.planId !== selectedPlanId,
                currency: selectedSponsor.currency
            };
        }
        return null;
    };
    
    const sponsorPlanInfo = getSponsorRelevantPlan();

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Network Genealogy</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Track your team growth and commissions. 
                        {settings.requirePlanMatchForCommission && " Earnings require you to match your referral's plan."}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate('/member/transactions')}>View History</Button>
                </div>
            </div>

            {/* Plan Tabs */}
            {uniqueActivePlans.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-x-auto">
                    {uniqueActivePlans.map(plan => {
                        const isActive = selectedPlanId === plan.planId;
                        return (
                            <button 
                                key={plan.planId} 
                                onClick={() => setSelectedPlanId(plan.planId)}
                                className={`flex-1 min-w-[120px] py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                                    ${isActive 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                                `}
                            >
                                {plan.planName}
                            </button>
                        )
                    })}
                </div>
            ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <h3 className="font-bold text-yellow-800 dark:text-yellow-200">No Active Plans</h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">You need to purchase an investment plan to start building your earning network.</p>
                    </div>
                    <Button size="sm" onClick={() => navigate('/member/plans')} className="ml-auto">Buy Plan</Button>
                </div>
            )}

            {/* Plan Detail View */}
            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {selectedPlanDetails.name}
                            <span className="text-xs font-normal bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Selected Context</span>
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedPlanDetails.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm justify-end">
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Price</p>
                            <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</p>
                        </div>
                        <div className="text-right border-l pl-4 dark:border-gray-700">
                            <p className="text-xs text-gray-500">Direct Comm.</p>
                            <p className="font-bold text-green-600 dark:text-green-400">{renderDirectCommissionSummary(selectedPlanDetails)}</p>
                        </div>
                        <div className="text-right border-l pl-4 dark:border-gray-700">
                            <p className="text-xs text-gray-500">Indirect Levels</p>
                            <p className="font-bold text-gray-900 dark:text-white">{selectedPlanDetails.indirectCommissions.length}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Total Team</p>
                    <h3 className="text-4xl font-extrabold">{networkStats.totalReferrals}</h3>
                    <p className="text-sm text-blue-200 mt-2">Members in your structure</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Active in {currentPlanName}</p>
                    <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{networkStats.activeMembers}</h3>
                    <p className="text-sm text-gray-500 mt-2">Qualified Referrals</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Earnings ({currentPlanName})</p>
                    <h3 className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(networkStats.earnings, currentUser.currency)}</h3>
                    <p className="text-sm text-gray-500 mt-2">Total Commission</p>
                </div>
            </div>
            
            <ShareButtons url={`${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`} title="Join my team on SmartEarning! Let's grow together." />

            {/* Tree View */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden min-h-[400px]">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="font-bold text-gray-800 dark:text-white text-lg">Network Genealogy</h2>
                            <p className="text-xs text-gray-500">Viewing structure for <strong>{currentPlanName}</strong> context.</p>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                            <div className="flex flex-wrap items-center gap-3 justify-end">
                                <select 
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="text-xs rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 py-1"
                                >
                                    <option value="all">All Status</option>
                                    <option value={Status.Active}>Active</option>
                                    <option value={Status.Pending}>Pending</option>
                                    <option value={Status.Blocked}>Blocked</option>
                                    <option value={Status.Paused}>Paused</option>
                                </select>

                                <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={showRelevantOnly} 
                                        onChange={(e) => setShowRelevantOnly(e.target.checked)} 
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    />
                                    <span className="text-xs font-medium">Hide Irrelevant</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* View Tabs */}
                    <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setViewTab('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all whitespace-nowrap ${viewTab === 'all' 
                                ? 'bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'}`}
                        >
                            All Levels
                        </button>
                        {Array.from({ length: maxLevels }, (_, i) => i + 1).map(lvl => (
                            <button
                                key={lvl}
                                onClick={() => setViewTab(String(lvl))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all whitespace-nowrap ${viewTab === String(lvl) 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'}`}
                            >
                                {lvl === 1 ? 'Direct (Lvl 1)' : `Level ${lvl}`}
                            </button>
                        ))}
                        <button
                            onClick={() => setViewTab('inactive')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all whitespace-nowrap ${viewTab === 'inactive' 
                                ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'}`}
                        >
                            Inactive (No Plan)
                        </button>
                    </div>
                </div>
                
                <div className="p-4 md:p-8 overflow-x-auto">
                    {viewTab === 'all' ? (
                        genealogyTree.length > 0 ? (
                            <ul className="space-y-2">
                                {genealogyTree.map(node => renderTreeNode(node))}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6 ring-8 ring-gray-200 dark:ring-gray-700">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Your Team is Empty</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 text-center">Share your referral link to start building your network and earning commissions!</p>
                            </div>
                        )
                    ) : (
                        // Flat List View for specific level or Inactive users
                        flatList.length > 0 ? (
                            <div className="space-y-3">
                                {flatList.map(node => renderFlatNode(node))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12">
                                <p className="text-gray-500 dark:text-gray-400 text-center">
                                    {viewTab === 'inactive' 
                                        ? 'No inactive referrals found.' 
                                        : `No referrals found at Level ${viewTab}.`}
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Sponsor Info Modal */}
            {isSponsorModalOpen && selectedSponsor && selectedReferralForSponsorModal && (
                <Modal isOpen={isSponsorModalOpen} onClose={() => setIsSponsorModalOpen(false)}>
                    <div className="p-6 max-w-sm text-center">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-2xl font-bold">
                            {selectedSponsor.fullName.charAt(0)}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedSponsor.fullName}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">@{selectedSponsor.username}</p>
                        
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl text-left border border-gray-100 dark:border-gray-600">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Country</p>
                                    <p className="font-semibold text-gray-900 dark:text-white flex items-center">
                                        <span className="text-lg mr-2">🌍</span> {selectedSponsor.country}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Status</p>
                                    <Badge status={selectedSponsor.status} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Qualified Plan</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {sponsorPlanInfo?.name || 'N/A'}
                                    </p>
                                    {sponsorPlanInfo?.isEquivalent && (
                                        <p className="text-xs text-blue-500 mt-0.5 font-medium">(Equivalent to {selectedPlanDetails?.name})</p>
                                    )}
                                </div>
                                <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-2">
                                     <p className="text-xs text-gray-500 uppercase font-bold mb-1">Earned from {selectedSponsor.username}</p>
                                     <p className="text-3xl font-extrabold text-green-600 dark:text-green-400 tracking-tight">
                                        {formatCurrency(sponsorEarnings, currentUser.currency)}
                                     </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Button onClick={() => setIsSponsorModalOpen(false)} className="w-full">Close</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Referrals;
