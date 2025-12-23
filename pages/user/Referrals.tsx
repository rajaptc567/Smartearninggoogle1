
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
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'held' | 'all' | 'inactive'>('commissions');

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
        
        const isHoldPosition = referralComms.some(t => t.status === 'Pending' && t.description.toLowerCase().includes('hold'));
        const isOverflow = referralComms.some(t => t.status === 'Rejected' && t.amount === 0 && t.description.toLowerCase().includes('limit'));
        
        return { earned, held, status: referralComms[0]?.status, isHoldPosition, isOverflow };
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
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } else if (!node.user.activePlans?.length) {
                inactiveList.push(node);
            }
        });

        return {
            genealogyTree: fullGenealogyTree,
            directEarners: directEarnersList,
            indirectEarners: indirectEarnersList,
            overflowReferrals: overflowList,
            inactiveReferrals: inactiveList,
            allNodes: nodesList
        };
    }, [currentUser, users, transactions, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0 };
        const limit = selectedPlanDetails.directReferralLimit || 0;
        // Used slots should count anyone who has generated an approved/pending commission or an overflow record
        const usedCount = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.level === 1 &&
            t.relatedPlanId && equivalentPlanIdsForSelected.has(String(t.relatedPlanId))
        ).length;
        return { used: usedCount, limit };
    }, [currentUser, selectedPlanDetails, transactions, equivalentPlanIdsForSelected]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
    }> = ({ node }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        
        const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        const isHoldPosition = info.isHoldPosition;
        const isOverflow = info.isOverflow;
        const isDirect = level === 1;

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-md border-l-4 p-4 transition-all duration-200 hover:shadow-lg ${isOverflow ? 'border-amber-400' : isHoldPosition ? 'border-indigo-400' : 'border-blue-500'}`}>
                <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-lg">{user.fullName.charAt(0)}</div>
                    <div className="flex-grow">
                        <div className="flex justify-between items-start mb-1">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">@{user.username}</h4>
                                <p className="text-xs text-gray-500">{user.fullName}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {isDirect && <Badge status={Status.Active} />}
                                {!isDirect && level && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold uppercase">Level {level}</span>}
                                {isHoldPosition && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">Upgrade Slot</span>}
                                {isOverflow && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase">Limit Missed</span>}
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-500 flex justify-between items-center">
                            <span>Joined {new Date(user.registrationDate).toLocaleDateString()}</span>
                            {info.earned > 0 && <span className="font-bold text-green-600">+{formatCurrency(info.earned, currentUser?.currency)}</span>}
                            {info.held > 0 && <span className="font-bold text-blue-600">⏳ {formatCurrency(info.held, currentUser?.currency)}</span>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!currentUser) return <div className="p-10 text-center">Loading network...</div>;

    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`;

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
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
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border dark:border-gray-700 flex overflow-x-auto gap-2">
                {uniqueActivePlans.map(plan => (
                    <button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-lg text-sm font-bold transition-all border ${selectedPlanId === plan.planId ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-transparent border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{plan.planName}</button>
                ))}
            </div>

            {selectedPlanDetails && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 shadow-xl overflow-hidden animate-fade-in">
                    <div className="flex flex-col lg:flex-row">
                        <div className="p-8 bg-gray-50 dark:bg-gray-900 border-b lg:border-b-0 lg:border-r dark:border-gray-700 lg:w-64 flex flex-col justify-center items-center text-center">
                            <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em] mb-2">Active Package</span>
                            <h3 className="font-black text-2xl text-gray-900 dark:text-white leading-tight mb-2">{selectedPlanDetails.name}</h3>
                            <span className="text-xl font-bold text-blue-600">{formatCurrency(selectedPlanDetails.price, selectedPlanDetails.currency)}</span>
                        </div>
                        <div className="flex-1 p-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                <div><span className="block text-[10px] uppercase text-gray-500 font-black mb-1">Commission</span><span className="text-sm font-bold text-green-500">{selectedPlanDetails.directCommissions[0]?.value}% Direct</span></div>
                                <div><span className="block text-[10px] uppercase text-gray-500 font-black mb-1">Network</span><span className="text-sm font-bold text-purple-500">{selectedPlanDetails.indirectCommissions.length} Levels</span></div>
                                <div><span className="block text-[10px] uppercase text-gray-500 font-black mb-1">Direct Slots</span><span className="text-sm font-bold text-blue-500">{slotStats.used} / {slotStats.limit || '∞'}</span></div>
                                <div><span className="block text-[10px] uppercase text-gray-500 font-black mb-1">Auto-Upgrade</span><span className={`text-sm font-bold ${selectedPlanDetails.autoUpgrade?.enabled ? 'text-amber-500' : 'text-gray-500'}`}>{selectedPlanDetails.autoUpgrade?.enabled ? 'Active' : 'Disabled'}</span></div>
                            </div>
                            
                            {/* Visual Slot Capacity Indicator */}
                            {selectedPlanDetails.directReferralLimit > 0 && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Referral Capacity</span>
                                        <span className="text-xs font-mono font-bold text-blue-600">{Math.round((slotStats.used / selectedPlanDetails.directReferralLimit) * 100)}% Used</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full flex overflow-hidden shadow-inner p-0.5">
                                        {Array.from({ length: selectedPlanDetails.directReferralLimit }).map((_, i) => {
                                            const slotNum = i + 1;
                                            const isHold = selectedPlanDetails.holdPosition?.enabled && selectedPlanDetails.holdPosition.slots.includes(slotNum);
                                            const isUsed = slotNum <= slotStats.used;
                                            return (
                                                <div 
                                                    key={i} 
                                                    className={`h-full flex-1 rounded-sm mx-0.5 transition-all duration-500 ${
                                                        !isUsed ? 'bg-gray-200 dark:bg-gray-600' : 
                                                        isHold ? 'bg-amber-400' : 'bg-blue-500'
                                                    }`}
                                                    title={isHold ? `Slot ${slotNum}: Held for Upgrade` : `Slot ${slotNum}: Active Earning`}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-4 text-[10px] font-bold uppercase text-gray-400">
                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> Earnings Slot</span>
                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-400 rounded-full"></span> Upgrade Slot</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Mode Tabs */}
            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm w-fit border dark:border-gray-700">
                {(['commissions', 'overflow', 'inactive'] as const).map(mode => (
                    <button key={mode} onClick={() => setViewMode(mode)} className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${viewMode === mode ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}>{mode}</button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {viewMode === 'commissions' && (
                    <>
                        {directEarners.length > 0 || indirectEarners.length > 0 ? (
                            [...directEarners, ...indirectEarners].map(node => <ReferralCardContent key={node.user._id} node={node} />)
                        ) : (
                            <div className="col-span-full py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                <p className="text-gray-500 font-bold">No active commissions for this plan yet.</p>
                            </div>
                        )}
                    </>
                )}
                {viewMode === 'overflow' && (
                    <>
                        {overflowReferrals.length > 0 ? (
                            overflowReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />)
                        ) : (
                            <div className="col-span-full py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                <p className="text-gray-500 font-bold">You have no missed commissions (Overflow).</p>
                            </div>
                        )}
                    </>
                )}
                {viewMode === 'inactive' && (
                    <>
                        {inactiveReferrals.length > 0 ? (
                            inactiveReferrals.map(node => <ReferralCardContent key={node.user._id} node={node} />)
                        ) : (
                            <div className="col-span-full py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                <p className="text-gray-500 font-bold">All your referrals have active plans!</p>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            <ShareButtons url={referralLink} title="Join SmartEarning and grow your network!" />
        </div>
    );
};

export default Referrals;
