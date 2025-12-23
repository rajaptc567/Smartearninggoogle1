import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, Transaction } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import ShareButtons from '../../components/ui/ShareButtons';

interface GenealogyNode {
    user: User;
    children: GenealogyNode[];
    level: number;
}

const Referrals: React.FC = () => {
    const { state } = useData();
    const { currentUser, users, transactions, settings, investmentPlans } = state;
    const navigate = useNavigate();
    
    // Get unique plan tracks user owns
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
    const [viewMode, setViewMode] = useState<'commissions' | 'inactive' | 'overflow' | 'all'>('commissions');

    // Auto-select first plan on load
    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);
    
    // Find all equivalent IDs (USD/PKR/EUR) for the selected plan track
    const equivalentPlanIdsForSelected = useMemo(() => {
        const ids = new Set<string>();
        if (selectedPlanId) {
            ids.add(selectedPlanId);
            const group = settings.planEquivalencyGroups?.find(g =>
                String(g.usdPlanId) === selectedPlanId ||
                String(g.pkrPlanId) === selectedPlanId ||
                String(g.eurPlanId) === selectedPlanId
            );
            if (group) {
                if (group.usdPlanId) ids.add(String(group.usdPlanId));
                if (group.pkrPlanId) ids.add(String(group.pkrPlanId));
                if (group.eurPlanId) ids.add(String(group.eurPlanId));
            }
        }
        return ids;
    }, [selectedPlanId, settings.planEquivalencyGroups]);
    
    const selectedPlanDetails = useMemo(() => {
        if (!selectedPlanId) return null;
        return investmentPlans.find(p => p._id === selectedPlanId);
    }, [selectedPlanId, investmentPlans]);

    // Helper to get detailed activity status for any user in the network
    const getCommissionInfoForReferral = useCallback((referral: User, contextPlanIds: Set<string>) => {
        if (!currentUser) return { earned: 0, held: 0, hasActivity: false, isHoldPosition: false, isOverflow: false };
        
        // Find ALL commission transactions from this specific referral for the current plan track
        const referralComms = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : false) 
        );

        const earned = referralComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        const held = referralComms.filter(t => t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0);
        
        // Activity = Anyone who generated money (Approved) OR is currently in a Hold position (Pending)
        const hasActivity = referralComms.some(t => t.status === 'Approved' || t.status === 'Pending');
        
        const isHoldPosition = referralComms.some(t => t.status === 'Pending' && t.description.toLowerCase().includes('hold'));
        const isOverflow = referralComms.some(t => t.status === 'Rejected' && t.description.toLowerCase().includes('limit'));
        
        return { earned, held, hasActivity, isHoldPosition, isOverflow };
    }, [currentUser, transactions]);

    // Calculate slot usage correctly
    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0, transactions: [] };
        const limit = selectedPlanDetails.directReferralLimit || 0;
        
        // We count Level 1 commissions that are either Approved (Paid) or Pending (Held)
        const validSlotTransactions = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.level === 1 &&
            (t.status === 'Approved' || t.status === 'Pending') &&
            t.relatedPlanId && equivalentPlanIdsForSelected.has(String(t.relatedPlanId))
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return { used: validSlotTransactions.length, limit, transactions: validSlotTransactions };
    }, [currentUser, selectedPlanDetails, transactions, equivalentPlanIdsForSelected]);

    // Categorize every direct referral into one of the three tabs
    const networkData = useMemo(() => {
        if (!currentUser) return { directEarners: [], indirectEarners: [], inactiveReferrals: [], overflowReferrals: [], allNodes: [] };

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

        const directList: GenealogyNode[] = [];
        const indirectList: GenealogyNode[] = [];
        const inactiveList: GenealogyNode[] = [];
        const overflowList: GenealogyNode[] = [];

        nodesList.forEach(node => {
            const info = getCommissionInfoForReferral(node.user, equivalentPlanIdsForSelected);
            
            if (info.hasActivity) {
                if (node.level === 1) directList.push(node);
                else indirectList.push(node);
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } else if (node.level === 1) {
                // Anyone else at Level 1 with no commission and no overflow is inactive
                inactiveList.push(node);
            }
        });

        return {
            directEarners: directList,
            indirectEarners: indirectList,
            inactiveReferrals: inactiveList,
            overflowReferrals: overflowList,
            allNodes: nodesList
        };
    }, [currentUser, users, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
    }> = ({ node }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        
        const info = getCommissionInfoForReferral(user, equivalentPlanIdsForSelected);
        const isHoldPosition = info.isHoldPosition;
        const isOverflow = info.isOverflow;
        const isDirect = level === 1;
        const isInactive = !isOverflow && !info.hasActivity;

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-md border-l-4 p-4 transition-all duration-200 hover:shadow-lg ${isInactive ? 'border-gray-300' : isOverflow ? 'border-amber-400 opacity-70' : isHoldPosition ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-blue-500'}`}>
                <div className="flex items-start gap-4">
                    <div className={`mt-1 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isHoldPosition ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                        {user.fullName.charAt(0)}
                    </div>
                    <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start mb-1">
                            <div className="truncate">
                                <h4 className="font-bold text-gray-900 dark:text-white truncate">@{user.username}</h4>
                                <p className="text-xs text-gray-500 truncate">{user.fullName}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {isInactive ? <Badge status={Status.Pending} /> : !isOverflow && <Badge status={Status.Active} />}
                                {!isDirect && level && <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded font-bold uppercase">Lvl {level}</span>}
                                {isHoldPosition && (
                                    <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 shadow-sm">
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        Hold
                                    </span>
                                )}
                                {isOverflow && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase">Full Limit</span>}
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-500 flex justify-between items-center border-t dark:border-gray-700 pt-2">
                            <span>Joined {new Date(user.registrationDate).toLocaleDateString()}</span>
                            <div className="text-right">
                                {info.earned > 0 && <p className="font-bold text-green-600 dark:text-green-400">+{formatCurrency(info.earned, currentUser?.currency)}</p>}
                                {info.held > 0 && (
                                    <div className="flex flex-col items-end">
                                        <p className="font-bold text-indigo-600 dark:text-indigo-400">🔒 {formatCurrency(info.held, currentUser?.currency)}</p>
                                        <span className="text-[9px] text-gray-400 uppercase font-black">Reserved</span>
                                    </div>
                                )}
                                {isInactive && <span className="text-[10px] text-gray-400 font-bold uppercase">No Activity</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const capacityPercent = slotStats.limit > 0 ? Math.min(100, (slotStats.used / slotStats.limit) * 100) : 100;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Commission Network</h2>
                        <p className="text-sm text-gray-500">Track earnings and auto-upgrade progress from your team.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="secondary" size="sm" onClick={() => navigate('/member/transactions')}>Log</Button>
                        <Button size="sm" onClick={() => navigate('/member/plans')}>Upgrade</Button>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 border dark:border-gray-700 mb-8">
                    <div className="flex flex-wrap gap-4 justify-between items-end mb-6">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Package</label>
                            <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400">{selectedPlanDetails?.name || 'Loading...'}</h3>
                            <p className="text-2xl font-black text-gray-800 dark:text-white">{formatCurrency(selectedPlanDetails?.price, currentUser?.currency)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase">Rate</p>
                                <p className="text-sm font-bold text-green-600">{selectedPlanDetails?.directCommissions?.[0]?.value || 0}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase">Network</p>
                                <p className="text-sm font-bold text-purple-600">{selectedPlanDetails?.indirectCommissions?.length || 0} Lvl</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase">Direct Slots</p>
                                <p className="text-sm font-bold text-blue-600">{slotStats.used} / {slotStats.limit || '∞'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase">Upgrade</p>
                                <p className="text-sm font-bold text-indigo-600">{selectedPlanDetails?.autoUpgrade?.enabled ? 'Auto' : 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-wider">
                            <span>Referral Capacity</span>
                            <span className={capacityPercent >= 100 ? 'text-red-500' : 'text-blue-500'}>{capacityPercent.toFixed(0)}% Used</span>
                        </div>
                        <div className="flex h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                             {selectedPlanDetails?.directReferralLimit ? (
                                Array.from({ length: selectedPlanDetails.directReferralLimit }).map((_, i) => {
                                    const slotNum = i + 1;
                                    const isHoldSlot = selectedPlanDetails.holdPosition?.enabled && selectedPlanDetails.holdPosition.slots.includes(slotNum);
                                    const isUsed = slotNum <= slotStats.used;
                                    return (
                                        <div 
                                            key={i} 
                                            className={`h-full flex-1 border-r last:border-0 dark:border-gray-900 transition-colors duration-500 ${
                                                !isUsed ? 'bg-transparent' : 
                                                isHoldSlot ? 'bg-indigo-500' : 'bg-blue-500'
                                            }`}
                                        />
                                    );
                                })
                            ) : (
                                <div className="h-full bg-blue-500 w-full" />
                            )}
                        </div>
                        <div className="flex gap-4 text-[9px] font-bold text-gray-500 uppercase pt-1">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Earnings Slot</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Hold/Upgrade Slot</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-6">
                    <div className="w-full sm:w-auto">
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Selected Plan Track</label>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {uniqueActivePlans.map(p => (
                                <button 
                                    key={p.planId} 
                                    onClick={() => setSelectedPlanId(p.planId)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${selectedPlanId === p.planId ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400'}`}
                                >
                                    {p.planName}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl border dark:border-gray-600 w-full sm:w-max mb-8 overflow-x-auto no-scrollbar">
                     {(['commissions', 'inactive', 'overflow', 'all'] as const).map(mode => (
                         <button 
                            key={mode} 
                            onClick={() => setViewMode(mode)}
                            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${viewMode === mode ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {mode === 'commissions' ? 'Commissions' : mode === 'inactive' ? 'Inactive' : mode === 'overflow' ? 'Missed (Overflow)' : 'Full List'}
                        </button>
                     ))}
                </div>

                {viewMode === 'commissions' && (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-4 bg-blue-500 rounded-sm"></span> Referrals with Activity
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {networkData.directEarners.map(node => (
                                    <ReferralCardContent key={node.user._id} node={node} />
                                ))}
                                {networkData.indirectEarners.map(node => (
                                    <ReferralCardContent key={node.user._id} node={node} />
                                ))}
                                {networkData.directEarners.length === 0 && networkData.indirectEarners.length === 0 && (
                                    <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                        <p className="text-gray-500 italic">No commission activity found for this plan track.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {viewMode === 'inactive' && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-4 bg-gray-400 rounded-sm"></span> Registered (No Trigger Yet)
                        </h3>
                        <p className="text-xs text-gray-500 mb-6 bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border dark:border-gray-700 italic">
                            These direct referrals have joined via your link, but have not yet triggered a commission for you.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {networkData.inactiveReferrals.map(node => (
                                <ReferralCardContent key={node.user._id} node={node} />
                            ))}
                            {networkData.inactiveReferrals.length === 0 && (
                                <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                    <p className="text-gray-500 italic">No inactive referrals found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {viewMode === 'overflow' && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-4 bg-amber-500 rounded-sm"></span> Overflow Records
                        </h3>
                        <p className="text-xs text-gray-500 mb-6 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                            These users joined via your link, but your direct referral limit was already reached ({slotStats.limit}). No commission was generated. <strong>Upgrade to a higher plan to increase capacity!</strong>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {networkData.overflowReferrals.map(node => (
                                <ReferralCardContent key={node.user._id} node={node} />
                            ))}
                            {networkData.overflowReferrals.length === 0 && (
                                <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed dark:border-gray-700">
                                    <p className="text-gray-500 italic">No missed commissions found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {viewMode === 'all' && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Full Downline (All Generations)</h3>
                        <div className="overflow-hidden rounded-2xl border dark:border-gray-700 shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4">Username</th>
                                        <th className="px-6 py-4">Generation</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Joined</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
                                    {networkData.allNodes.map(node => (
                                        <tr key={node.user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">@{node.user.username}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${node.level === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                                                    Level {node.level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4"><Badge status={node.user.activePlans?.length ? Status.Active : Status.Pending} /></td>
                                            <td className="px-6 py-4 text-right text-xs text-gray-400">{new Date(node.user.registrationDate).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {networkData.allNodes.length === 0 && <p className="p-8 text-center text-gray-500 italic bg-white dark:bg-gray-800">No members found in your network.</p>}
                        </div>
                    </div>
                )}
            </div>

            <ShareButtons url={`${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`} title="Join my team on SmartEarning and start growing your assets today!" />
        </div>
    );
};

export default Referrals;