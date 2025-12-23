import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan, Transaction } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import ShareButtons from '../../components/ui/ShareButtons';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';

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
    const [viewMode, setViewMode] = useState<'commissions' | 'tree' | 'overflow' | 'all'>('commissions');

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

    const { genealogyTree, directEarners, indirectEarners, overflowReferrals, allNodes } = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], directEarners: [], indirectEarners: [], overflowReferrals: [], allNodes: [] };

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
            if (info.earned > 0 || info.held > 0 || info.isHoldPosition) {
                if (node.level === 1) directEarnersList.push(node);
                else indirectEarnersList.push(node);
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            }
        });

        return {
            genealogyTree: fullGenealogyTree,
            directEarners: directEarnersList,
            indirectEarners: indirectEarnersList,
            overflowReferrals: overflowList,
            allNodes: nodesList
        };
    }, [currentUser, users, transactions, equivalentPlanIdsForSelected, getCommissionInfoForReferral]);

    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0 };
        const limit = selectedPlanDetails.directReferralLimit || 0;
        const usedCount = transactions.filter(t => 
            t.userId === currentUser._id && 
            t.type === 'Commission' && 
            t.level === 1 &&
            t.status !== 'Rejected' &&
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

    const chatEndRef = useRef<HTMLDivElement>(null);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">My Referral Network</h2>
                <div className="flex flex-wrap gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Plan Track</label>
                        <select 
                            value={selectedPlanId} 
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                            className="rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm"
                        >
                            {uniqueActivePlans.map(p => (
                                <option key={p.planId} value={p.planId}>{p.planName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">View Mode</label>
                        <div className="flex gap-2">
                             {(['commissions', 'tree', 'overflow', 'all'] as const).map(mode => (
                                 <Button 
                                    key={mode} 
                                    variant={viewMode === mode ? 'primary' : 'secondary'} 
                                    size="sm" 
                                    onClick={() => setViewMode(mode)}
                                    className="capitalize"
                                >
                                    {mode}
                                </Button>
                             ))}
                        </div>
                    </div>
                </div>

                {viewMode === 'commissions' && (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="text-blue-500">🔵</span> Direct Referrals (Level 1)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {directEarners.map(node => (
                                    <ReferralCardContent key={node.user._id} node={node} />
                                ))}
                                {directEarners.length === 0 && <p className="text-sm text-gray-500 italic">No direct referrals for this plan track.</p>}
                            </div>
                        </section>
                        <section>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="text-purple-500">🟣</span> Indirect Network (Level 2+)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {indirectEarners.map(node => (
                                    <ReferralCardContent key={node.user._id} node={node} />
                                ))}
                                {indirectEarners.length === 0 && <p className="text-sm text-gray-500 italic">No indirect referrals for this plan track.</p>}
                            </div>
                        </section>
                    </div>
                )}

                {viewMode === 'tree' && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-x-auto min-h-[400px]">
                        <div className="space-y-4">
                            <h3 className="text-center font-bold text-gray-500 uppercase tracking-widest text-xs">Hierarchy View</h3>
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-blue-600 text-white rounded-lg font-bold mb-8">YOU ({currentUser.username})</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                                    {genealogyTree.map(node => (
                                        <div key={node.user._id} className="flex flex-col items-center">
                                            <div className="w-px h-8 bg-gray-300 dark:bg-gray-700"></div>
                                            <div className="p-3 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg text-sm text-center shadow-md">
                                                <div className="font-bold">@{node.user.username}</div>
                                                <div className="text-[10px] text-gray-400">Direct</div>
                                            </div>
                                            {node.children.length > 0 && (
                                                <div className="mt-4 flex flex-col items-center">
                                                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700"></div>
                                                    <div className="text-[10px] text-gray-500 mb-1">+{node.children.length} Indirect</div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {genealogyTree.length === 0 && <p className="text-gray-400 italic">No direct referrals found.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'overflow' && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <span className="text-amber-500">⚠️</span> Overflow Referrals (Limit Exceeded)
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">These users joined via your link but you reached the direct referral limit for this plan ({slotStats.limit}). No commission was generated from these signups.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {overflowReferrals.map(node => (
                                <ReferralCardContent key={node.user._id} node={node} />
                            ))}
                            {overflowReferrals.length === 0 && <p className="text-sm text-gray-500 italic">No overflow records for this plan.</p>}
                        </div>
                    </div>
                )}
                
                {viewMode === 'all' && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-bold">Full Network List</h3>
                        <Table headers={['Username', 'Full Name', 'Level', 'Status', 'Joined Date']}>
                            {allNodes.map(node => (
                                <tr key={node.user._id} className="text-gray-700 dark:text-gray-400">
                                    <td className="px-4 py-3 font-semibold">@{node.user.username}</td>
                                    <td className="px-4 py-3 text-sm">{node.user.fullName}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${node.level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>Level {node.level}</span>
                                    </td>
                                    <td className="px-4 py-3"><Badge status={node.user.activePlans?.length ? Status.Active : Status.Pending} /></td>
                                    <td className="px-4 py-3 text-xs">{new Date(node.user.registrationDate).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                )}
            </div>

            <ShareButtons url={`${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`} title="Join me on SmartEarning and start earning today!" />
            <div ref={chatEndRef} />
        </div>
    );
};

export default Referrals;
