
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

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
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
        return (t.status === 'Pending' || t.status === 'Approved') && 
               (desc.includes('hold') || desc.includes('reserved') || desc.includes('upgrade') || desc.includes('slot #'));
    };

    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>): { earned: number; held: number; status?: string; isHoldPosition?: boolean, isOverflow?: boolean } => {
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
        const isOverflow = referralComms.some(t => t.status === 'Rejected' && t.amount === 0 && t.description.toLowerCase().includes('limit'));
        
        return { earned, held, status: referralComms[0]?.status, isHoldPosition, isOverflow };
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
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } else if (!node.user.activePlans?.length) {
                inactiveList.push(node);
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

        return {
            genealogyTree: fullGenealogyTree,
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
        const used = directEarners.length;
        return { used, limit };
    }, [currentUser, selectedPlanDetails, directEarners]);

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
        isHeldView?: boolean;
        isAllView?: boolean;
    }> = ({ node, isHeldView, isAllView }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        
        const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        const isHoldPosition = info.isHoldPosition;
        const isOverflow = info.isOverflow;

        const isDirect = level === 1;
        const cardBorderClass = isDirect ? 'border-l-blue-500' : 'border-l-purple-500';

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${isHoldPosition ? 'border-l-amber-500 bg-amber-50/5' : isOverflow ? 'border-l-orange-500' : cardBorderClass} transition-all duration-200 hover:shadow-md p-4`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-sm">{user.fullName.charAt(0)}</div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">@{user.username}</h4>
                                {level && <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${isDirect ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{isDirect ? 'Direct' : `Level ${level}`}</span>}
                                {isHoldPosition && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-black uppercase">🔒 Held for Upgrade</span>}
                                {isOverflow && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-black uppercase">⚠️ Limit Overflow</span>}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.fullName}Joined {new Date(user.registrationDate).toLocaleDateString()}
                                {user.sponsor && <p className="mt-1">Via: <button onClick={() => handleSponsorClick(user.sponsor!, user)} className="text-blue-500 hover:underline">@{user.sponsor}</button></p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        {info.earned > 0 && <p className="text-lg font-black text-green-600">{formatCurrency(info.earned, currentUser?.currency)}</p>}
                        {info.held > 0 && <p className="text-sm font-bold text-blue-600">⏳ {formatCurrency(info.held, currentUser?.currency)} Pending</p>}
                        {isOverflow && <p className="text-xs font-bold text-orange-600">Missed (Capacity Full)</p>}
                    </div>
                </div>
            </div>
        );
    };

    if (!currentUser) return <div className="p-10 text-center">Loading network...</div>;

    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Commission Network</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track earnings and auto-upgrade progress from your team.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/member/transactions')}>Earnings Log</Button>
                    <Button variant="primary" size="sm" onClick={() => navigate('/member/plans')}>Upgrade Plan</Button>
                </div>
            </div>

            {/* Plan Selector */}
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 flex overflow-x-auto gap-2">
                {uniqueActivePlans.map(plan => (
                    <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg text-sm font-bold transition-all border ${selectedPlanId === plan.planId ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{plan.planName}</button>
                ))}
            </div>

            {/* Plan Info Card with Hold Position Data */}
            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden animate-fade-in">
                    <div className="flex flex-col lg:flex-row">
                        <div className="p-8 bg-gray-50 dark:bg-gray-900/50 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-700 lg:w-64 flex flex-col justify-center items-center text-center">
                            <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em] mb-2">Active Package</span>
                            <h3 className="font-black text-2xl text-gray-900 dark:text-white leading-tight mb-2">{selectedPlanDetails.name}</h3>
                            <span className="text-xl font-bold text-blue-600">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span>
                        </div>
                        <div className="flex-1 p-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                <div><span className="block text-[10px] uppercase text-gray-400 font-black mb-1">Commission</span><span className="text-sm font-bold text-green-600">{selectedPlanDetails.directCommissions[0]?.value}% Direct</span></div>
                                <div><span className="block text-[10px] uppercase text-gray-400 font-black mb-1">Network</span><span className="text-sm font-bold text-purple-600">{selectedPlanDetails.indirectCommissions.length} Levels</span></div>
                                <div><span className="block text-[10px] uppercase text-gray-400 font-black mb-1">Direct Slots</span><span className="text-sm font-bold text-blue-600">{slotStats.used} / {slotStats.limit || '∞'}</span></div>
                                <div><span className="block text-[10px] uppercase text-gray-400 font-black mb-1">Auto-Upgrade</span><span className={`text-sm font-bold ${selectedPlanDetails.autoUpgrade?.enabled ? 'text-amber-600' : 'text-gray-400'}`}>{selectedPlanDetails.autoUpgrade?.enabled ? 'Active' : 'Disabled'}</span></div>
                            </div>
                            
                            {/* HOLD SLOT VISUALIZATION */}
                            {selectedPlanDetails.holdPosition?.enabled && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/50">
                                    <h4 className="text-xs font-black text-amber-800 dark:text-amber-200 uppercase tracking-widest flex items-center gap-2 mb-3">
                                        <span className="text-lg">🛡️</span> Hold Position Strategy
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from({ length: Math.max(slotStats.limit, 5) }).map((_, i) => {
                                            const slotNum = i + 1;
                                            const isHold = selectedPlanDetails.holdPosition?.slots.includes(slotNum);
                                            const isUsed = slotNum <= slotStats.used;
                                            return (
                                                <div key={slotNum} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${
                                                    isHold 
                                                    ? (isUsed ? 'bg-amber-500 border-amber-600 text-white shadow-sm' : 'bg-amber-100 border-amber-200 text-amber-600')
                                                    : (isUsed ? 'bg-blue-600 border-blue-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-400')
                                                }`} title={isHold ? 'Commission from this referral is held for upgrade' : 'Standard commission'}>
                                                    {slotNum}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-3 font-bold italic uppercase">
                                        * Amber slots are reserved for your auto-upgrade fund.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Mode Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl w-fit border dark:border-gray-700">
                {(['commissions', 'overflow', 'inactive'] as const).map(mode => (
                    <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 text-xs font-black uppercase rounded-lg transition-all ${viewMode === mode ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{mode}</button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {viewMode === 'commissions' && (
                    <div className="space-y-4">
                        {directEarners.length > 0 || indirectEarners.length > 0 ? (
                            <>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Active Commission Earners</h3>
                                {[...directEarners, ...indirectEarners].map(node => <ReferralCardContent key={node.user._id} node={node} />)}
                            </>
                        ) : (
                            <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                <p className="text-gray-400 font-bold">No active commissions for this plan yet.</p>
                                <Button onClick={() => navigate('/member/deposit')} className="mt-4" size="sm">Invite Members</Button>
                            </div>
                        )}
                    </div>
                )}
                {viewMode === 'overflow' && (
                    <div className="space-y-4">
                        {overflowReferrals.length > 0 ? (
                            overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />)
                        ) : (
                            <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                <p className="text-gray-400 font-bold">Great! You have no missed commissions (Overflow).</p>
                            </div>
                        )}
                    </div>
                )}
                {viewMode === 'inactive' && (
                    <div className="space-y-4">
                        {inactiveReferrals.length > 0 ? (
                            inactiveReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />)
                        ) : (
                            <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                <p className="text-gray-400 font-bold">All your referrals have active plans!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <ShareButtons url={referralLink} title="Join SmartEarning and grow your network!" />
        </div>
    );
};

export default Referrals;
