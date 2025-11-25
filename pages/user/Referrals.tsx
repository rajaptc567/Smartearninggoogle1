
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

interface GenealogyNode {
    user: User;
    children: GenealogyNode[];
    level: number;
    collapsed?: boolean;
}

const Referrals: React.FC = () => {
    const { state } = useData();
    const { currentUser, users, transactions } = state;
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
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['inactive'])); // Keep inactive collapsed by default

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);

    const toggleNode = (userId: string) => {
        setCollapsedNodes(prev => { const newSet = new Set(prev); if (newSet.has(userId)) newSet.delete(userId); else newSet.add(userId); return newSet; });
    };

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => { const newSet = new Set(prev); if (newSet.has(section)) newSet.delete(section); else newSet.add(section); return newSet; });
    };

    const getCommissionFromReferralForPlan = (referralId: string, planId: string): number => {
        if (!currentUser) return 0;
        return transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.relatedPlanId === planId && t.description.includes(users.find(u => u._id === referralId)?.username || 'Unknown')).reduce((sum, t) => sum + t.amount, 0);
    };

    const getReferralInvestment = (user: User, planId: string) => user.activePlans?.find(p => p.planId === planId)?.price || 0;

    const { activeTree, inactiveReferrals, levelViewData, networkStats } = useMemo(() => {
        if (!currentUser) return { activeTree: [], inactiveReferrals: [], levelViewData: {}, networkStats: { totalReferrals: 0, activeMembers: 0, earnings: 0, volume: 0 } };

        const fullDownline: User[] = [];
        const buildFullDownline = (sponsorUsername: string) => {
            const referrals = users.filter(u => u.sponsor === sponsorUsername);
            referrals.forEach(r => {
                fullDownline.push(r);
                buildFullDownline(r.username);
            });
        };
        buildFullDownline(currentUser.username);

        const inactiveReferrals = fullDownline.filter(u => !u.activePlans || u.activePlans.length === 0);

        const buildActiveTree = (sponsorUsername: string, level: number): GenealogyNode[] => {
            const directReferrals = users.filter(u => u.sponsor === sponsorUsername);
            if (!directReferrals.length) return [];
            
            const activeChildren = directReferrals.filter(child => child.activePlans?.some(p => p.planId === selectedPlanId));
            
            return activeChildren.map(child => ({
                user: child,
                children: buildActiveTree(child.username, level + 1),
                level
            }));
        };
        const activeTree = buildActiveTree(currentUser.username, 1);
        
        const levels: { [key: number]: User[] } = {};
        let volume = 0;
        let activeMemberCount = 0;

        const traverseActiveTree = (nodes: GenealogyNode[]) => {
            nodes.forEach(node => {
                activeMemberCount++;
                volume += getReferralInvestment(node.user, selectedPlanId);
                if (!levels[node.level]) levels[node.level] = [];
                levels[node.level].push(node.user);
                traverseActiveTree(node.children);
            });
        };
        traverseActiveTree(activeTree);

        const totalEarnings = transactions
            .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.relatedPlanId === selectedPlanId)
            .reduce((sum, t) => sum + t.amount, 0);

        const stats = {
            totalReferrals: fullDownline.length,
            activeMembers: activeMemberCount,
            earnings: totalEarnings,
            volume
        };

        return { activeTree, inactiveReferrals, levelViewData: levels, networkStats: stats };

    }, [currentUser, users, selectedPlanId, transactions]);


    const renderTreeNode = (node: GenealogyNode) => {
        const isCollapsed = collapsedNodes.has(node.user._id);
        const hasChildren = node.children.length > 0;
        const commission = getCommissionFromReferralForPlan(node.user._id, selectedPlanId);
        const investment = getReferralInvestment(node.user, selectedPlanId);
        const joinDate = node.user.activePlans?.find(p => p.planId === selectedPlanId)?.purchaseDate;

        return (
            <li key={node.user._id} className="relative pl-6 py-2">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-700 -ml-3"></div>
                <div className="absolute left-0 top-8 w-4 h-px bg-gray-300 dark:bg-gray-700 -ml-3"></div>
                <div className="relative flex flex-col md:flex-row md:items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 group">
                    <div className="flex items-center flex-grow space-x-4">
                        <div className="relative">
                            <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold border-4 ${node.level === 1 ? 'bg-blue-100 text-blue-700 border-white shadow-sm' : 'bg-purple-100 text-purple-700 border-white shadow-sm'}`}>L{node.level}</div>
                            {hasChildren && <button onClick={() => toggleNode(node.user._id)} className="absolute -bottom-1 -right-1 h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white transition-colors shadow-sm z-10"><span className="text-xs font-bold leading-none">{isCollapsed ? '+' : '-'}</span></button>}
                        </div>
                        <div>
                            <div className="flex items-center space-x-2"><h4 className="text-base font-bold text-gray-900 dark:text-white">{node.user.fullName}</h4><Badge status={node.user.status} /></div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">@{node.user.username} • Joined {new Date(joinDate || Date.now()).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="mt-4 md:mt-0 flex items-center justify-between md:justify-end space-x-6 pl-16 md:pl-0 border-t md:border-t-0 border-gray-100 dark:border-gray-700 pt-3 md:pt-0">
                        <div className="text-right"><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Value</p><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">${investment.toFixed(0)}</p></div>
                        <div className="text-right"><p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Your Earnings</p><p className={`text-sm font-bold ${commission > 0 ? 'text-green-600' : 'text-gray-400'}`}>+${commission.toFixed(2)}</p></div>
                    </div>
                </div>
                {hasChildren && !isCollapsed && <ul className="mt-2 ml-2 border-l-2 border-gray-200/50 dark:border-gray-700/50 pl-2 space-y-2 animate-fade-in-down">{node.children.map(child => renderTreeNode(child))}</ul>}
            </li>
        );
    };
    
    const renderLevelView = () => {
        const levels = Object.keys(levelViewData).map(Number).sort((a,b) => a-b);
        if (levels.length === 0) return <div className="text-center text-gray-500 py-8">No active members in this plan.</div>;

        return (
            <div className="space-y-4">
                {levels.map(level => {
                    const members = levelViewData[level] || [];
                    const isSectionCollapsed = !collapsedSections.has(level.toString());
                    const earnings = members.reduce((sum, u) => sum + getCommissionFromReferralForPlan(u._id, selectedPlanId), 0);
                    const volume = members.reduce((sum, u) => sum + getReferralInvestment(u, selectedPlanId), 0);

                    return (
                        <div key={level} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <button onClick={() => toggleSection(level.toString())} className="w-full p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg">
                                <div className="flex items-center space-x-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>Level {level}</span>
                                    <div className="text-left text-sm text-gray-600 dark:text-gray-400 hidden sm:flex gap-4">
                                        <span><span className="font-bold">{members.length}</span> Active Members</span>
                                        <span className="text-green-600"><span className="font-bold">${earnings.toFixed(2)}</span> Earnings</span>
                                        <span><span className="font-bold">${volume.toLocaleString()}</span> Volume</span>
                                    </div>
                                </div>
                                <svg className={`w-5 h-5 text-gray-500 transform transition-transform ${isSectionCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            {!isSectionCollapsed && (
                                <div className="p-4 border-t dark:border-gray-700 animate-fade-in-down">
                                    <div className="space-y-2">
                                        {members.map(member => {
                                            const commission = getCommissionFromReferralForPlan(member._id, selectedPlanId);
                                            const investment = getReferralInvestment(member, selectedPlanId);
                                            const joinDate = member.activePlans?.find(p => p.planId === selectedPlanId)?.purchaseDate;

                                            return (
                                                <div key={member._id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs">
                                                    <div className="col-span-4 font-semibold">{member.fullName} <span className="text-gray-400 font-normal">@{member.username}</span></div>
                                                    <div className="col-span-2"><Badge status={member.status}/></div>
                                                    <div className="col-span-2 text-gray-500">{new Date(joinDate || Date.now()).toLocaleDateString()}</div>
                                                    <div className="col-span-2 text-right">${investment.toFixed(0)}</div>
                                                    <div className="col-span-2 text-right font-bold text-green-600">+${commission.toFixed(2)}</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        );
    }

    const renderEmptyState = (planName?: string) => (
        <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6 ring-8 ring-gray-50 dark:ring-gray-900"><svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg></div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{planName ? 'Team is Empty' : 'Your Team is Empty'}</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 text-center">{planName ? `You haven't referred anyone to the ${planName} plan yet.` : "You haven't referred anyone yet."} Share your link to start building your network!</p>
            <Button onClick={() => { const link = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`; navigator.clipboard.writeText(link); alert('Referral link copied!'); }} className="mt-8 shadow-lg shadow-blue-500/30" size="lg">Copy Referral Link</Button>
        </div>
    );

    if (!currentUser) return <div className="p-10 text-center text-gray-500">Loading network...</div>;

    if (uniqueActivePlans.length === 0 && networkStats.totalReferrals === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl text-center border border-gray-100 dark:border-gray-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6 animate-bounce-slow"><svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z"></path></svg></div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Unlock Your Network</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 text-lg">Referral networks are specific to each investment plan. Purchase a plan to start building your team and earning commissions.</p>
                <Button onClick={() => navigate('/member/plans')} size="lg" className="shadow-lg shadow-blue-500/30">Browse Investment Plans</Button>
            </div>
        );
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
                        <div><p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Earnings</p><h3 className="text-4xl font-extrabold">${networkStats.earnings.toFixed(2)}</h3><p className="text-sm text-emerald-200 mt-2 font-medium">Commission from {currentPlanName}</p></div>
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div><p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Team Volume</p><h3 className="text-3xl font-bold text-gray-800 dark:text-white">${networkStats.volume.toLocaleString()}</h3><p className="text-sm text-gray-500 mt-2">Active investment in {currentPlanName}</p></div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700"><button onClick={() => { const link = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser.username}`; navigator.clipboard.writeText(link); alert('Referral link copied!'); }} className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>Copy Referral Link</button></div>
                </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-gray-800 dark:text-white text-lg">Network Structure</h2>
                        <p className="text-xs text-gray-500">View your team for the <strong>{currentPlanName}</strong> plan</p>
                    </div>
                     <div className="flex p-1 bg-gray-200 dark:bg-gray-700 rounded-md">
                        <button onClick={() => setViewMode('tree')} className={`px-3 py-1 text-xs rounded ${viewMode === 'tree' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Tree View</button>
                        <button onClick={() => setViewMode('level')} className={`px-3 py-1 text-xs rounded ${viewMode === 'level' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Level View</button>
                    </div>
                </div>
                
                <div className="p-4 md:p-6">
                    <div className="w-full p-3 mb-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                        <h3 className="font-semibold text-blue-700 dark:text-blue-300">Active Network ({networkStats.activeMembers})</h3>
                    </div>
                    <div className="pl-4">
                        {viewMode === 'tree' 
                            ? (activeTree.length > 0 ? <ul className="space-y-4 min-w-[600px]">{activeTree.map(node => renderTreeNode(node))}</ul> : <p className="text-center text-gray-500 text-sm py-4">No active members in this plan.</p>)
                            : (Object.keys(levelViewData).length > 0 ? renderLevelView() : <p className="text-center text-gray-500 text-sm py-4">No active members to display in level view.</p>)
                        }
                    </div>
                </div>

                {inactiveReferrals.length > 0 && (
                     <div className="p-4 md:p-6 border-t dark:border-gray-700">
                        <button onClick={() => toggleSection('inactive')} className="w-full flex justify-between items-center p-3 mb-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Inactive Referrals (No Plan) ({inactiveReferrals.length})</h3>
                            <svg className={`w-5 h-5 text-gray-600 transition-transform ${collapsedSections.has('inactive') ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                         {!collapsedSections.has('inactive') && (
                            <div className="space-y-2 animate-fade-in-down">
                                {inactiveReferrals.map(user => (
                                    <div key={user._id} className="text-sm p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 flex justify-between items-center">
                                        <div>
                                            <span className="font-medium">{user.fullName}</span> 
                                            <span className="text-gray-400 text-xs ml-2">@{user.username}</span>
                                        </div>
                                        <div className="text-right">
                                            <Badge status={user.status} />
                                            <span className="text-gray-400 text-xs ml-2">Registered: {new Date(user.registrationDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {networkStats.totalReferrals === 0 && renderEmptyState()}
            </div>
        </div>
    );
};

export default Referrals;
