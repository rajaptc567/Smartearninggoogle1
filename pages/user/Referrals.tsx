import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, InvestmentPlan } from '../../types';
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
    const [viewMode, setViewMode] = useState<'tree' | 'level'>('tree');
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['inactive']));

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);

    const getCommissionInfoForReferral = (referral: User): { earned: number; pendingReason: string | null } => {
        if (!currentUser) return { earned: 0, pendingReason: null };

        const referralCommissions = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id
        );

        const earned = referralCommissions
            .filter(t => t.status === 'Approved')
            .reduce((sum, t) => sum + t.amount, 0);

        const pendingCommission = referralCommissions.find(t => t.status === 'Pending');
        let pendingReason: string | null = null;

        if (pendingCommission) {
            const uplineUser = currentUser;
            if (uplineUser.restrictions?.earning) {
                pendingReason = `Your earnings are currently paused by the administrator.`;
            } else if (settings.requirePlanMatchForCommission) {
                const referralPlanId = pendingCommission.relatedPlanId;
                if (referralPlanId) {
                    // FIX: Avoid Object.values() to prevent including `_id` in checks and fix typing issues.
                    const group = (settings.planEquivalencyGroups || []).find(g => 
                        g.usdPlanId === referralPlanId ||
                        g.pkrPlanId === referralPlanId ||
                        g.eurPlanId === referralPlanId
                    );
                    let hasEquivalentPlan = (uplineUser.activePlans || []).some(p => {
                        if (group) {
                            return p.planId === group.usdPlanId ||
                                   p.planId === group.pkrPlanId ||
                                   p.planId === group.eurPlanId;
                        }
                        return p.planId === referralPlanId;
                    });

                    if (!hasEquivalentPlan) {
                        let requiredPlansString = '';
                        if (group) {
                            const groupPlanIds = [group.usdPlanId, group.pkrPlanId, group.eurPlanId].filter(Boolean) as string[];
                            const requiredPlans = investmentPlans.filter(p => groupPlanIds.includes(p._id));
                            requiredPlansString = requiredPlans.map(p => `the ${p.name} (${p.currency})`).join(' or ');
                        } else {
                            const referralPlan = investmentPlans.find(p => p._id === referralPlanId);
                            requiredPlansString = referralPlan ? `the ${referralPlan.name} (${referralPlan.currency})` : 'the required plan';
                        }
                        pendingReason = `Purchase ${requiredPlansString} to earn from ${referral.username}.`;
                    }
                }
            } else if (settings.requireActivePlanForCommission) {
                if (!uplineUser.activePlans || uplineUser.activePlans.length === 0) {
                    pendingReason = `Purchase any investment plan to activate your earnings from ${referral.username}.`;
                }
            }
            if (!pendingReason) {
                pendingReason = "Commission is pending for review.";
            }
        }
        return { earned, pendingReason };
    };

    const toggleNode = (userId: string) => {
        setCollapsedNodes(prev => { const newSet = new Set(prev); if (newSet.has(userId)) newSet.delete(userId); else newSet.add(userId); return newSet; });
    };

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => { const newSet = new Set(prev); if (newSet.has(section)) newSet.delete(section); else newSet.add(section); return newSet; });
    };

    const equivalentPlanIdsForSelected = useMemo(() => {
        const ids = new Set<string>();
        if (selectedPlanId) {
            ids.add(selectedPlanId);
            // FIX: Avoid Object.values() to prevent including `_id` in checks and fix typing issues.
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

    const { genealogyTree, levelViewData, networkStats } = useMemo(() => {
        if (!currentUser) return { genealogyTree: [], levelViewData: {}, networkStats: { totalReferrals: 0, activeMembers: 0, earnings: 0, volume: 0 } };

        const getReferralInvestmentAndConvertToSponsorCurrency = (referral: User): number => {
            if (!referral.activePlans || !currentUser) return 0;
            const purchasedPlanDetails = referral.activePlans.find(p => equivalentPlanIdsForSelected.has(p.planId));
            if (!purchasedPlanDetails) return 0;

            const price = purchasedPlanDetails.price;
            const fromCurrency = referral.currency;
            const toCurrency = currentUser.currency;
            const rates = state.settings.exchangeRates;
            if (!rates || !rates[fromCurrency] || !rates[toCurrency] || fromCurrency === toCurrency) return price;

            const priceInUSD = price / rates[fromCurrency];
            return priceInUSD * rates[toCurrency];
        };

        const buildFullTree = (sponsorUsername: string, level: number): GenealogyNode[] => {
            const directReferrals = users.filter(u => u.sponsor === sponsorUsername);
            return directReferrals.map(child => ({
                user: child,
                children: buildFullTree(child.username, level + 1),
                level
            }));
        };
        const genealogyTree = buildFullTree(currentUser.username, 1);

        const fullDownline: User[] = [];
        const levels: { [key: number]: User[] } = {};
        const traverseTreeForStats = (nodes: GenealogyNode[]) => {
            nodes.forEach(node => {
                fullDownline.push(node.user);
                if (!levels[node.level]) levels[node.level] = [];
                levels[node.level].push(node.user);
                traverseTreeForStats(node.children);
            });
        };
        traverseTreeForStats(genealogyTree);

        const activeMembersInPlan = fullDownline.filter(u => u.activePlans?.some(p => equivalentPlanIdsForSelected.has(p.planId)));
        const volume = activeMembersInPlan.reduce((sum, u) => sum + getReferralInvestmentAndConvertToSponsorCurrency(u), 0);
        const totalEarnings = transactions
            .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Approved' && t.relatedPlanId && equivalentPlanIdsForSelected.has(t.relatedPlanId))
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            genealogyTree,
            levelViewData: levels,
            networkStats: { totalReferrals: fullDownline.length, activeMembers: activeMembersInPlan.length, earnings: totalEarnings, volume }
        };
    }, [currentUser, users, selectedPlanId, transactions, settings, equivalentPlanIdsForSelected]);

    const renderTreeNode = (node: GenealogyNode) => {
        const isCollapsed = collapsedNodes.has(node.user._id);
        const hasChildren = node.children.length > 0;

        const isUserActiveInPlan = node.user.activePlans?.some(p => equivalentPlanIdsForSelected.has(p.planId));
        const purchasedPlanInNetwork = isUserActiveInPlan ? node.user.activePlans?.find(p => equivalentPlanIdsForSelected.has(p.planId)) : null;
        
        // We get commission info for every user, active or not, because they might generate a pending commission.
        const { earned: commission, pendingReason } = getCommissionInfoForReferral(node.user);

        return (
            <li key={node.user._id} className="relative pl-6 py-2">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-700 -ml-3"></div>
                <div className="absolute left-0 top-10 w-4 h-px bg-gray-300 dark:bg-gray-700 -ml-3"></div>
                
                <div className={`relative flex flex-col md:flex-row md:items-center border-2 rounded-xl p-4 shadow-sm transition-all duration-200 group ${
                    isUserActiveInPlan ? 'bg-white dark:bg-gray-800 border-blue-400 dark:border-blue-600' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-80'
                }`}>
                    <div className="flex items-center flex-grow space-x-4">
                        <div className="relative">
                            <div className="flex-shrink-0 h-16 w-16 rounded-full flex flex-col items-center justify-center text-sm font-bold border-4 bg-gray-100 dark:bg-gray-900 border-white dark:border-gray-800 shadow-sm">
                                <span className="text-xl">L{node.level}</span>
                                <Badge status={node.user.status} />
                            </div>
                            {hasChildren && <button onClick={() => toggleNode(node.user._id)} className="absolute -bottom-1 -right-1 h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white transition-colors shadow-sm z-10"><span className="text-sm font-bold leading-none">{isCollapsed ? '+' : '-'}</span></button>}
                        </div>
                        <div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">{node.user.fullName}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">@{node.user.username} • Joined {new Date(node.user.registrationDate).toLocaleDateString()}</p>
                            {isUserActiveInPlan && purchasedPlanInNetwork && <div className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">{purchasedPlanInNetwork.planName} Active</div>}
                        </div>
                    </div>
                    
                    <div className="mt-4 md:mt-0 flex items-center justify-between md:justify-end space-x-6 pl-20 md:pl-0">
                        {isUserActiveInPlan && purchasedPlanInNetwork ? (
                            <>
                                <div className="text-right"><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Value</p><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(purchasedPlanInNetwork.price, node.user.currency)}</p></div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Your Earnings</p>
                                    <p className={`text-sm font-bold ${commission > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                        +{formatCurrency(commission, currentUser.currency)}
                                    </p>
                                </div>
                            </>
                        ) : (
                             <div className="text-sm text-gray-400 dark:text-gray-500 text-center md:text-right w-full">Inactive in this network</div>
                        )}
                        {pendingReason && (
                            <div className="group/tooltip relative">
                                <span className="text-yellow-500 cursor-help flex items-center gap-1">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    <span className="text-xs font-bold hidden md:block">HELD</span>
                                </span>
                                <div className="absolute bottom-full mb-2 -left-1/2 translate-x-1/2 w-64 p-3 text-xs text-white bg-gray-900 rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 text-left shadow-xl">
                                    <p className="font-bold mb-1">Commission Held!</p>
                                    {pendingReason}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {hasChildren && !isCollapsed && <ul className="mt-2 ml-2 border-l-2 border-gray-200/50 dark:border-gray-700/50 pl-2 space-y-2 animate-fade-in-down">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };

    const renderLevelView = () => {
        const levels = Object.keys(levelViewData).map(Number).sort((a,b) => a-b);
        if (levels.length === 0) return renderEmptyState(currentPlanName);

        return (
            <div className="space-y-4">
                {levels.map(level => {
                    const members = levelViewData[level] || [];
                    const activeMembers = members.filter(m => m.activePlans?.some(p => equivalentPlanIdsForSelected.has(p.planId)));
                    const earnings = activeMembers.reduce((sum, u) => sum + getCommissionInfoForReferral(u).earned, 0);
                    return (
                        <div key={level} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="p-4 flex justify-between items-center rounded-t-lg">
                                <div className="flex items-center space-x-4">
                                    <span className="px-3 py-1.5 rounded-md text-sm font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Level {level}</span>
                                    <div className="text-left text-sm text-gray-600 dark:text-gray-400 flex flex-col sm:flex-row sm:gap-4">
                                        <span><span className="font-bold">{members.length}</span> Total Members</span>
                                        <span><span className="font-bold text-blue-600">{activeMembers.length}</span> Active in Plan</span>
                                        <span className="text-green-600"><span className="font-bold">{formatCurrency(earnings, currentUser.currency)}</span> Earnings</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t dark:border-gray-700">
                                <div className="space-y-2">
                                    {members.map(member => {
                                        const isUserActiveInPlan = member.activePlans?.some(p => equivalentPlanIdsForSelected.has(p.planId));
                                        const { earned: commission } = getCommissionInfoForReferral(member);
                                        return (
                                            <div key={member._id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-md text-xs ${isUserActiveInPlan ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                                <div className="col-span-4 font-semibold">{member.fullName} <span className="text-gray-400 font-normal">@{member.username}</span></div>
                                                <div className="col-span-2"><Badge status={member.status}/></div>
                                                <div className="col-span-4 text-gray-500">{isUserActiveInPlan ? 'Active in this plan' : 'Inactive in this plan'}</div>
                                                <div className="col-span-2 text-right font-bold text-green-600">+{formatCurrency(commission, currentUser.currency)}</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        );
    }
    
    if (!currentUser) return <div className="p-10 text-center text-gray-500">Loading network...</div>;

    if (uniqueActivePlans.length === 0 && networkStats.totalReferrals === 0) {
        return <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">{renderEmptyState()}</div>
    }
    
    const currentPlanName = uniqueActivePlans.find(p => p.planId === selectedPlanId)?.planName || 'Network';
    
    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">My Network</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Manage your team structure and performance.</p></div>
                {uniqueActivePlans.length > 0 && <div className="flex p-1 bg-gray-200/75 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 backdrop-blur-sm">{uniqueActivePlans.map(plan => (<button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ease-in-out ${selectedPlanId === plan.planId ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}>{plan.planName}</button>))}</div>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex justify-between items-start">
                        <div><p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Active Members</p><h3 className="text-4xl font-extrabold">{networkStats.activeMembers}</h3><p className="text-sm text-blue-200 mt-2 font-medium">in {currentPlanName}</p></div>
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
                    <div className="flex justify-between items-start">
                        <div><p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Earnings</p><h3 className="text-4xl font-extrabold">{formatCurrency(networkStats.earnings, currentUser.currency)}</h3><p className="text-sm text-emerald-200 mt-2 font-medium">from {currentPlanName}</p></div>
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div><p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Team Volume</p><h3 className="text-3xl font-bold text-gray-800 dark:text-white">{formatCurrency(networkStats.volume, currentUser.currency)}</h3><p className="text-sm text-gray-500 mt-2">in {currentPlanName}</p></div>
                </div>
            </div>
            
             <div className="mt-8">
                <ShareButtons url={`${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`} title="Join my team on SmartEarning! Let's grow together." />
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-gray-800 dark:text-white text-lg">Network Structure</h2>
                        <p className="text-xs text-gray-500">Viewing team for the <strong>{currentPlanName}</strong> plan</p>
                    </div>
                     <div className="flex p-1 bg-gray-200 dark:bg-gray-700 rounded-md">
                        <button onClick={() => setViewMode('tree')} className={`px-3 py-1 text-xs rounded ${viewMode === 'tree' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Tree View</button>
                        <button onClick={() => setViewMode('level')} className={`px-3 py-1 text-xs rounded ${viewMode === 'level' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Level View</button>
                    </div>
                </div>
                
                <div className="p-4 md:p-6">
                    {networkStats.totalReferrals > 0 ? (
                        viewMode === 'tree' 
                            ? <ul className="space-y-4 min-w-[600px]">{genealogyTree.map(node => renderTreeNode(node))}</ul> 
                            : renderLevelView()
                    ) : (
                        renderEmptyState(currentPlanName)
                    )}
                </div>
            </div>
        </div>
    );
};

const renderEmptyState = (planName?: string) => (
    <div className="flex flex-col items-center justify-center h-full py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6 ring-8 ring-gray-50 dark:ring-gray-900"><svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg></div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{planName ? 'Team is Empty' : 'Your Team is Empty'}</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 text-center">{planName ? `You haven't referred anyone to the ${planName} plan yet.` : "You haven't referred anyone yet."} Share your link to start building your network!</p>
    </div>
);


export default Referrals;
