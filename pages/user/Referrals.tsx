
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

    const isTransactionHoldPosition = (t: Transaction) => {
        const desc = t.description?.toLowerCase() || '';
        const isHeldStatus = t.status === 'Pending';
        const hasKeywords = desc.includes('reserved') || desc.includes('auto-upgrade') || desc.includes('hold commission');
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
        
        const isHoldPosition = referralComms.some(t => isTransactionHoldPosition(t));
        const isOverflow = referralComms.some(t => t.status === 'Rejected' && t.amount === 0 && (t.description.toLowerCase().includes('overflow') || t.description.toLowerCase().includes('limit')));
        
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
            
            // PRIORITY: Hold Position is a valid referral occupying a slot
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

        const totalEarnings = transactions
            .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Approved' && (t.relatedPlanId ? equivalentPlanIdsForSelected.has(String(t.relatedPlanId)) : false))
            .reduce((sum, t) => sum + t.amount, 0);

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
                directEarnings: totalEarnings // simplify for view
            }
        };
    }, [currentUser, users, transactions, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0 };
        return { used: directEarners.length, limit: selectedPlanDetails.directReferralLimit || 0 };
    }, [currentUser, selectedPlanDetails, directEarners]);

    const heldCommissionsData = useMemo(() => {
        if (!currentUser || !selectedPlanId) return { referrals: [], count: 0, stats: new Map() };
        const filterIds = getEquivalentIds(selectedPlanId);
        const pendingMap = new Map<string, { total: number, breakdown: { reason: string, amount: number, isHoldPosition?: boolean }[] }>();
        
        transactions
            .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Pending' && (t.relatedPlanId ? filterIds.has(String(t.relatedPlanId)) : true))
            .forEach(t => {
                if (!t.sourceUserId) return;
                const current = pendingMap.get(t.sourceUserId) || { total: 0, breakdown: [] };
                current.total += t.amount;
                let reason = "Pending Review";
                let isHold = false;

                if (isTransactionHoldPosition(t)) {
                    reason = "Hold for Auto-Upgrade";
                    isHold = true;
                } else if (currentUser.restrictions?.earning) {
                    reason = "Account Restricted";
                } else if (settings.requireActivePlanForCommission && (!currentUser.activePlans || currentUser.activePlans.length === 0)) {
                    reason = "No Active Plan";
                }

                current.breakdown.push({ reason, amount: t.amount, isHoldPosition: isHold });
                pendingMap.set(t.sourceUserId, current);
            });
        const referrals = users.filter(u => pendingMap.has(u._id));
        return { referrals, count: referrals.length, stats: pendingMap };
    }, [transactions, currentUser, settings, users, selectedPlanId]);

    const referralLink = useMemo(() => {
        if (!currentUser) return '';
        return `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;
    }, [currentUser]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
        isHeldView?: boolean;
        isAllView?: boolean;
    }> = ({ node, isHeldView, isAllView }) => {
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

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${isHoldPosition ? 'border-l-amber-500 bg-amber-50/5' : isOverflow ? 'border-l-orange-500 bg-orange-50/5' : cardBorderClass} transition-all duration-200 hover:shadow-md`}>
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3 w-full sm:w-auto">
                        <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs">{user.fullName.charAt(0)}</div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">@{user.username}</h4>
                                {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${levelBadgeColor}`}>L{level}</span>}
                                {isHoldPosition ? (
                                    <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                                        <span className="text-xs">🔒</span> Held for Upgrade
                                    </span>
                                ) : isOverflow ? (
                                    <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold uppercase border border-orange-200 flex items-center gap-1">
                                        <span className="text-xs">⚠️</span> Overflow
                                    </span>
                                ) : held > 0 ? (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase border border-blue-200">Pending</span>
                                ) : null}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                Joined: {new Date(user.registrationDate).toLocaleDateString()}
                                {user.sponsor && <p className="mt-1 font-medium text-blue-500">Sponsor: @{user.sponsor}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto text-right pl-11 sm:pl-0">
                        {isOverflow ? (
                            <div className="text-orange-600 font-bold text-xs">Limit Reached</div>
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

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Commission Network</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track earnings and Hold-Strategy progress from your team.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border dark:border-gray-700 flex overflow-x-auto gap-2">
                {uniqueActivePlans.map(plan => (
                    <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[140px] py-2 px-4 rounded-md text-sm font-medium transition-all whitespace-nowrap border ${selectedPlanId === plan.planId ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent border-transparent text-gray-600 dark:text-gray-400'}`}>{plan.planName}</button>
                ))}
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden mb-6">
                    <div className="flex flex-col md:flex-row">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b md:border-r dark:border-gray-700 flex flex-row md:flex-col justify-between items-center gap-2 md:w-48 text-center shrink-0">
                            <div><h3 className="font-bold text-lg leading-tight">{selectedPlanDetails.name}</h3><span className="text-[10px] uppercase text-gray-400 font-black">Plan Context</span></div>
                            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span>
                        </div>
                        <div className="flex-1 p-6">
                            <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">Direct Slot Usage (Paid + Held)</h4><span className="text-sm font-bold text-blue-600">{slotStats.used} / {slotStats.limit || '∞'}</span></div>
                            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ease-out ${slotStats.limit > 0 && slotStats.used >= slotStats.limit ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${slotStats.limit === 0 ? 100 : Math.min(100, (slotStats.used / slotStats.limit) * 100)}%` }}></div></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 overflow-hidden min-h-[500px]">
                <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap gap-2">
                    {([['commissions', `Network Contributors (${directEarners.length + indirectEarners.length})`], ['overflow', `Waiting/Overflow (${overflowReferrals.length})`], ['held', `Action Required (${heldCommissionsData.count})`]] as const).map(([mode, label]) => (
                        <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${viewMode === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}>{label}</button>
                    ))}
                </div>
                <div className="p-6">
                    {viewMode === 'commissions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest border-b pb-2">Direct Level Contributors</h3>
                                {directEarners.length > 0 ? directEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="p-8 text-center text-gray-400 italic text-sm">No direct contributors.</div>}
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest border-b pb-2">Indirect Team Members</h3>
                                {indirectEarners.length > 0 ? indirectEarners.map(node => <ReferralCardContent key={node.user._id} node={node} />) : <div className="p-8 text-center text-gray-400 italic text-sm">No indirect contributors.</div>}
                            </div>
                        </div>
                    )}
                    {viewMode === 'overflow' && (
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">Referrals appearing here were registered after your plan's slot limit was reached. You do not earn from these users at this plan level.</div>
                            {overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />)}
                        </div>
                    )}
                    {viewMode === 'held' && (
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 font-medium">Pending or Strategic Hold commissions that require your attention or automated strategy completion.</div>
                            {heldCommissionsData.referrals.map(user => <ReferralCardContent key={user._id} node={{user}} isHeldView={true} />)}
                        </div>
                    )}
                </div>
            </div>
            <ShareButtons url={referralLink} title="Join SmartEarning and start your investment journey today!" />
        </div>
    );
};

export default Referrals;
