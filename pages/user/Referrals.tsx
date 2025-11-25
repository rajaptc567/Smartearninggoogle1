
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, Transaction, ActivePlan } from '../../types';
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
    const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(new Set([1])); // Keep level 1 open by default

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);

    const toggleNode = (userId: string) => {
        setCollapsedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) newSet.delete(userId);
            else newSet.add(userId);
            return newSet;
        });
    };
    
    const toggleLevel = (level: number) => {
        setCollapsedLevels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(level)) newSet.delete(level);
            else newSet.add(level);
            return newSet;
        });
    }

    const getCommissionFromReferralForPlan = (referralId: string, planId: string): number => {
        if (!currentUser) return 0;
        return transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.relatedPlanId === planId && t.description.includes(users.find(u => u._id === referralId)?.username || 'Unknown')).reduce((sum, t) => sum + t.amount, 0);
    };

    const getReferralInvestment = (user: User, planId: string) => {
        return user.activePlans?.find(p => p.planId === planId)?.price || 0;
    };

    const buildPlanSpecificTree = useMemo(() => {
        if (!selectedPlanId || !currentUser) return [];
        const build = (sponsorUsername: string, allUsers: User[], level: number): GenealogyNode[] => {
            const directReferrals = allUsers.filter(u => u.sponsor === sponsorUsername);
            if (!directReferrals.length) return [];
            const planSpecificReferrals = directReferrals.filter(child => child.activePlans && child.activePlans.some(p => p.planId === selectedPlanId));
            return planSpecificReferrals.map(child => ({
                user: child,
                children: build(child.username, allUsers, level + 1),
                level: level,
            }));
        };
        return build(currentUser.username, users, 1);
    }, [currentUser, users, selectedPlanId]);

    const levelViewData = useMemo(() => {
        if (!selectedPlanId || !currentUser) return {};
        const levels: { [key: number]: User[] } = {};
        const traverse = (nodes: GenealogyNode[]) => {
            if (!nodes.length) return;
            nodes.forEach(node => {
                if (!levels[node.level]) levels[node.level] = [];
                levels[node.level].push(node.user);
                traverse(node.children);
            });
        };
        traverse(buildPlanSpecificTree);
        return levels;
    }, [buildPlanSpecificTree]);

    const treeStats = useMemo(() => {
        if (!currentUser || !selectedPlanId) return { members: 0, earnings: 0, volume: 0 };
        let volume = 0;
        const countNodes = (nodes: GenealogyNode[]): number => {
            return nodes.length + nodes.reduce((sum, node) => {
                volume += getReferralInvestment(node.user, selectedPlanId);
                return sum + countNodes(node.children);
            }, 0);
        };
        const totalMembers = countNodes(buildPlanSpecificTree);
        const totalEarnings = transactions.filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.relatedPlanId === selectedPlanId).reduce((sum, t) => sum + t.amount, 0);
        return { members: totalMembers, earnings: totalEarnings, volume };
    }, [buildPlanSpecificTree, transactions, currentUser, selectedPlanId]);

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
                            {hasChildren && <button onClick={(e) => { e.stopPropagation(); toggleNode(node.user._id); }} className="absolute -bottom-1 -right-1 h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white transition-colors shadow-sm z-10"><span className="text-xs font-bold leading-none">{isCollapsed ? '+' : '-'}</span></button>}
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
        if (levels.length === 0) return renderEmptyState();

        return (
            <div className="space-y-4">
                {levels.map(level => {
                    const members = levelViewData[level];
                    const isLevelCollapsed = !collapsedLevels.has(level);
                    const earnings = members.reduce((sum, u) => sum + getCommissionFromReferralForPlan(u._id, selectedPlanId), 0);
                    const volume = members.reduce((sum, u) => sum + getReferralInvestment(u, selectedPlanId), 0);

                    return (
                        <div key={level} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <button onClick={() => toggleLevel(level)} className="w-full p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg">
                                <div className="flex items-center space-x-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${level === 1 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>Level {level}</span>
                                    <div className="text-left text-sm text-gray-600 dark:text-gray-400 hidden sm:flex gap-4">
                                        <span><span className="font-bold">{members.length}</span> Members</span>
                                        <span className="text-green-600"><span className="font-bold">${earnings.toFixed(2)}</span> Earnings</span>
                                        <span><span className="font-bold">${volume.toLocaleString()}</span> Volume</span>
                                    </div>
                                </div>
                                <svg className={`w-5 h-5 text-gray-500 transform transition-transform ${isLevelCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            {!isLevelCollapsed && (
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

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6 ring-8 ring-gray-50 dark:ring-gray-900">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Your Team is Empty</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2 text-center">
                You haven't referred anyone to the <strong>{currentPlanName}</strong> plan yet. 
                Share your link to start earning commissions!
            </p>
            <Button onClick={() => { navigator.clipboard.writeText(`https://site.com/register?sponsor=${currentUser.username}`); alert('Referral link copied!'); }} className="mt-8 shadow-lg shadow-blue-500/30" size="lg">
                Copy Referral Link
            </Button>
        </div>
    );

    if (!currentUser) return <div className="p-10 text-center text-gray-500">Loading network...</div>;

    if (uniqueActivePlans.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl text-center border border-gray-100 dark:border-gray-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6 animate-bounce-slow"><svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z"></path></svg></div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Unlock Your Network</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 text-lg">Referral networks are specific to each investment plan. Purchase a plan to start building your team and earning commissions.</p>
                <Button onClick={() => navigate('/member/plans')} size="lg" className="shadow-lg shadow-blue-500/30">Browse Investment Plans</Button>
            </div>
        );
    }

    const currentPlanName = uniqueActivePlans.find(p => p.planId === selectedPlanId)?.planName;

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">My Network</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Manage your team structure and performance.</p></div>
                <div className="flex p-1.5 bg-gray-100 dark:bg-gray-900/50 rounded-xl overflow-x-auto border border-gray-200 dark:border-gray-700">
                    {uniqueActivePlans.map(plan => (<button key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)} className={`px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${selectedPlanId === plan.planId ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>{plan.planName}</button>))}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex justify-between items-start">
                        <div><p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Total Team Size</p><h3 className="text-4xl font-extrabold">{treeStats.members}</h3><p className="text-sm text-blue-200 mt-2 font-medium">Members in {currentPlanName}</p></div>
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
                    <div className="flex justify-between items-start">
                        <div><p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Earnings</p><h3 className="text-4xl font-extrabold">${treeStats.earnings.toFixed(2)}</h3><p className="text-sm text-emerald-200 mt-2 font-medium">Commission from {currentPlanName}</p></div>
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div><p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Team Volume</p><h3 className="text-3xl font-bold text-gray-800 dark:text-white">${treeStats.volume.toLocaleString()}</h3><p className="text-sm text-gray-500 mt-2">Total active investment in downline</p></div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700"><button onClick={() => { navigator.clipboard.writeText(`https://site.com/register?sponsor=${currentUser.username}`); alert('Referral link copied!'); }} className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>Copy Referral Link</button></div>
                </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-gray-800 dark:text-white text-lg">Network Structure</h2>
                        <p className="text-xs text-gray-500">Interactive view of your {currentPlanName} team</p>
                    </div>
                    <div className="flex p-1 bg-gray-200 dark:bg-gray-700 rounded-md">
                        <button onClick={() => setViewMode('tree')} className={`px-3 py-1 text-xs rounded ${viewMode === 'tree' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Tree View</button>
                        <button onClick={() => setViewMode('level')} className={`px-3 py-1 text-xs rounded ${viewMode === 'level' ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}>Level View</button>
                    </div>
                </div>
                <div className="p-8 overflow-x-auto min-h-[400px]">
                    {viewMode === 'tree' ? (
                        buildPlanSpecificTree.length > 0 ? (
                            <ul className="space-y-4 min-w-[600px]">{buildPlanSpecificTree.map(node => renderTreeNode(node))}</ul>
                        ) : (
                             renderEmptyState()
                        )
                    ) : renderLevelView()}
                </div>
            </div>
        </div>
    );
};

export default Referrals;
