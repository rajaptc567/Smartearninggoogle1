
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
    
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'all'>('commissions');

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

    const isTransactionHoldPosition = (t: Transaction) => {
        const desc = (t.description || '').toLowerCase();
        return (t.status === 'Pending' || t.status === 'Approved') && 
               (desc.includes('hold position') || desc.includes('held for upgrade') || desc.includes('reserved'));
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
        
        // Strictly identify Hold vs Overflow
        const isHoldPosition = referralComms.some(t => isTransactionHoldPosition(t));
        const hasOverflowTx = referralComms.some(t => t.status === 'Rejected' && t.amount === 0 && (t.description || '').toLowerCase().includes('limit'));
        
        // isOverflow ONLY if it's not a hold and has no valid earnings/holds
        const isOverflow = hasOverflowTx && !isHoldPosition && earned === 0 && held === 0;
        
        let earningSourcePlanId: string | undefined;
        if (referralComms.length > 0) {
            const bestTx = referralComms.find(t => t.status === 'Approved' || t.status === 'Pending') || referralComms[0];
            earningSourcePlanId = bestTx.relatedPlanId?.toString();
        }
        return { earned, held, status: referralComms[0]?.status, earningSourcePlanId, isHoldPosition, isOverflow };
    }, [currentUser, transactions]);

    const { genealogyTree, directEarners, indirectEarners, overflowReferrals, networkStats, allNodes } = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], directEarners: [], indirectEarners: [], overflowReferrals: [], allNodes: [], networkStats: { totalReferrals: 0, activeMembers: 0, earnings: 0, directEarnings: 0, indirectEarnings: 0 } };

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

        nodesList.forEach(node => {
            const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            
            // PRIORITY: Hold Positions are part of the EARNER list (filled slots)
            if (info.earned > 0 || info.held > 0 || info.isHoldPosition) {
                if (node.level === 1) directEarnersList.push(node);
                else indirectEarnersList.push(node);
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
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
        // Used slots should count Earners AND Held Positions
        const used = directEarners.length; 
        return { used, limit };
    }, [currentUser, selectedPlanDetails, directEarners]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
        toggleNode?: (userId: string) => void;
        isCollapsed?: boolean;
        hasChildren?: boolean;
        isTree?: boolean;
    }> = ({ node, toggleNode, isCollapsed, hasChildren, isTree }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        const sourcePlan = info.earningSourcePlanId ? investmentPlans.find(p => p._id === String(info.earningSourcePlanId)) : null;

        return (
            <div id={`node-${user._id}`} className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${info.isHoldPosition ? 'border-l-amber-500 bg-amber-50/10 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]' : info.isOverflow ? 'border-l-orange-500' : 'border-l-blue-500'} p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-200`}>
                <div className="flex items-start gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-bold text-gray-900 dark:text-white">@{user.username}</h4>
                            {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${level === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{level === 1 ? 'Direct' : `Lvl ${level}`}</span>}
                            
                            {info.isHoldPosition ? (
                                <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase shadow-sm border border-amber-600 animate-pulse flex items-center gap-1">
                                    <span className="text-xs">🔒</span> Held for Upgrade
                                </span>
                            ) : info.isOverflow ? (
                                <span className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded-full font-bold uppercase">Overflow</span>
                            ) : null}
                        </div>
                        <p className="text-xs text-gray-500">
                            {sourcePlan ? `Plan: ${sourcePlan.name}` : (info.isOverflow ? 'Slot Limit Reached' : 'No Active Plan')}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    {info.isOverflow ? (
                        <p className="text-lg font-bold text-orange-600">{formatCurrency(0, currentUser?.currency)}</p>
                    ) : (
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${info.isHoldPosition ? 'text-amber-600' : 'text-gray-400'}`}>
                                {info.isHoldPosition ? 'Reserved' : 'Commission'}
                            </p>
                            <p className={`text-lg font-bold ${info.isHoldPosition ? 'text-amber-600' : 'text-green-600'}`}>
                                {formatCurrency(info.held || info.earned, currentUser?.currency)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const toggleNode = (userId: string) => {
        setCollapsedNodes(prev => { const newSet = new Set(prev); if (newSet.has(userId)) newSet.delete(userId); else newSet.add(userId); return newSet; });
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

    if (!currentUser) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Network</h1><p className="text-sm text-gray-500">Manage your referrals and track commissions.</p></div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/member/transactions')}>History</Button>
                    <Button size="sm" onClick={() => navigate('/member/plans')}>Upgrade</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-x-auto gap-2">
                {uniqueActivePlans.map(p => (
                    <button key={p.planId} onClick={() => setSelectedPlanId(p.planId)} className={`flex-1 min-w-[140px] py-2 px-4 rounded-md text-sm font-medium transition-all border ${selectedPlanId === p.planId ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800' : 'bg-transparent border-transparent text-gray-500'}`}>{p.planName}</button>
                ))}
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Direct Referral Slots</h4>
                        <span className="text-sm font-bold text-blue-600">{slotStats.used} / {slotStats.limit || '∞'}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${slotStats.limit > 0 && slotStats.used >= slotStats.limit ? 'bg-orange-500' : 'bg-blue-600'}`} style={{ width: `${slotStats.limit === 0 ? 100 : Math.min(100, (slotStats.used / slotStats.limit) * 100)}%` }}></div>
                    </div>
                    {slotStats.limit > 0 && slotStats.used >= slotStats.limit && <p className="text-[10px] text-orange-600 font-bold mt-2 uppercase">Limit reached for this plan level.</p>}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Network</p><h3 className="text-2xl font-bold text-blue-600">{allNodes.length}</h3></div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Members</p><h3 className="text-2xl font-bold text-green-600">{networkStats.activeMembers}</h3></div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Earnings</p><h3 className="text-2xl font-bold text-purple-600">{formatCurrency(networkStats.earnings, currentUser.currency)}</h3></div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
                <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2">
                    <button onClick={() => setViewMode('commissions')} className={`px-4 py-2 text-xs font-bold rounded-full ${viewMode === 'commissions' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Commission List ({directEarners.length + indirectEarners.length})</button>
                    <button onClick={() => setViewMode('tree')} className={`px-4 py-2 text-xs font-bold rounded-full ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Tree View ({genealogyTree.length})</button>
                    <button onClick={() => setViewMode('overflow')} className={`px-4 py-2 text-xs font-bold rounded-full ${viewMode === 'overflow' ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Overflow & Waiting ({overflowReferrals.length})</button>
                    <button onClick={() => setViewMode('all')} className={`px-4 py-2 text-xs font-bold rounded-full ${viewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>All Referrals ({allNodes.length})</button>
                </div>
                <div className="p-6 space-y-4">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-blue-500 rounded-full mr-2"></span>Direct Referrals</h3><div className="space-y-3">{directEarners.map(n => <ReferralCardContent key={n.user._id} node={n} />)}</div></div>
                            <div><h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><span className="w-2 h-8 bg-purple-500 rounded-full mr-2"></span>Indirect Team</h3><div className="space-y-3">{indirectEarners.map(n => <ReferralCardContent key={n.user._id} node={n} />)}</div></div>
                        </div>
                    )}
                    {viewMode === 'tree' && <ul className="space-y-4">{genealogyTree.map(node => renderTreeNode(node))}</ul>}
                    {viewMode === 'overflow' && (
                        <div className="space-y-3">
                             <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg mb-4 text-sm text-orange-800 dark:text-orange-200">
                                <strong>Note:</strong> These referrals joined when your direct slots for this plan level were already full.
                             </div>
                            {overflowReferrals.map(n => <ReferralCardContent key={n.user._id} node={n} />)}
                        </div>
                    )}
                    {viewMode === 'all' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{allNodes.map(n => <ReferralCardContent key={n.user._id} node={n} />)}</div>}
                </div>
            </div>
            <ShareButtons url={`${window.location.origin}/#/register?sponsor=${currentUser.username}`} title="Join my network on SmartEarning!" />
        </div>
    );
};

export default Referrals;
