
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
}

const Referrals: React.FC = () => {
    const { state } = useData();
    const { currentUser, users, transactions } = state;
    const navigate = useNavigate();

    // Group active plans by ID to handle unique tabs
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

    // Set default plan on load
    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);

    // Filter transactions strictly by Plan ID
    const getCommissionFromReferralForPlan = (referralId: string, planId: string): number => {
        if (!currentUser) return 0;
        
        return transactions
            .filter(t => 
                t.userId === currentUser._id && 
                t.type === 'Commission' && 
                t.relatedPlanId === planId && // Strict Plan Link
                t.description.includes(users.find(u => u._id === referralId)?.username || 'Unknown')
            )
            .reduce((sum, t) => sum + t.amount, 0);
    };

    // Build Tree Strictly for the Selected Plan
    const buildPlanSpecificTree = useMemo(() => {
        if (!selectedPlanId || !currentUser) return [];

        const build = (sponsorUsername: string, allUsers: User[], level: number): GenealogyNode[] => {
            // 1. Find all direct registration referrals
            const directReferrals = allUsers.filter(u => u.sponsor === sponsorUsername);
            
            if (!directReferrals.length) return [];

            // 2. Filter: Only include referrals who HAVE the selected plan
            // This enforces "Separate Referral Trees" - connections only exist within the context of a plan
            const planSpecificReferrals = directReferrals.filter(child => 
                child.activePlans && child.activePlans.some(p => p.planId === selectedPlanId)
            );

            return planSpecificReferrals.map(child => ({
                user: child,
                children: build(child.username, allUsers, level + 1),
                level: level,
            }));
        };

        return build(currentUser.username, users, 1);
    }, [currentUser, users, selectedPlanId]);

    const flatList = useMemo(() => {
        return buildPlanSpecificTree.map(node => node.user);
    }, [buildPlanSpecificTree]);

    // Calculate total stats for this tree
    const treeStats = useMemo(() => {
        if(!currentUser || !selectedPlanId) return { members: 0, earnings: 0 };
        
        const countNodes = (nodes: GenealogyNode[]): number => {
            return nodes.length + nodes.reduce((sum, node) => sum + countNodes(node.children), 0);
        };
        
        const totalMembers = countNodes(buildPlanSpecificTree);
        
        const totalEarnings = transactions
            .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.relatedPlanId === selectedPlanId)
            .reduce((sum, t) => sum + t.amount, 0);

        return { members: totalMembers, earnings: totalEarnings };
    }, [buildPlanSpecificTree, transactions, currentUser, selectedPlanId]);


    const renderTree = (nodes: GenealogyNode[]) => (
        <ul className="space-y-2">
            {nodes.map(node => (
                <li key={node.user._id} className="pl-4 border-l-2 border-blue-200 dark:border-blue-900">
                    <div className="flex items-center space-x-3 p-3 rounded-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex-shrink-0">
                           <span className="text-xs font-bold inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            L{node.level}
                           </span>
                        </div>
                        <div className="flex-grow">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{node.user.fullName} <span className="text-xs font-normal text-gray-500">@{node.user.username}</span></p>
                            <p className="text-xs text-gray-500">Joined Plan: {new Date(node.user.activePlans?.find(p => p.planId === selectedPlanId)?.purchaseDate || Date.now()).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-medium text-gray-500 mb-1">Commission</p>
                           <p className="text-sm font-bold text-green-600 dark:text-green-400">
                               ${getCommissionFromReferralForPlan(node.user._id, selectedPlanId).toFixed(2)}
                           </p>
                        </div>
                    </div>
                    {node.children.length > 0 && <div className="mt-2">{renderTree(node.children)}</div>}
                </li>
            ))}
        </ul>
    );

    if (!currentUser) {
        return <div>Loading...</div>;
    }

    if (uniqueActivePlans.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z"></path></svg>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Referral Network Locked</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">You must purchase an investment plan to unlock and view your referral trees. Each plan maintains its own independent network.</p>
                <Button onClick={() => navigate('/member/plans')}>View Investment Plans</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Plan Selector Tabs */}
            <div className="flex overflow-x-auto space-x-2 pb-2">
                {uniqueActivePlans.map(plan => (
                    <button
                        key={plan.planId}
                        onClick={() => setSelectedPlanId(plan.planId)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                            selectedPlanId === plan.planId
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        {plan.planName} Network
                    </button>
                ))}
            </div>

            {/* Stats for Selected Tree */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Total Members in Tree</p>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-100">{treeStats.members}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                    <p className="text-sm text-green-600 dark:text-green-300 font-medium">Total Commission (This Plan)</p>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-100">${treeStats.earnings.toFixed(2)}</p>
                </div>
            </div>

             <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                        Direct Referrals ({flatList.length})
                        <span className="ml-2 text-sm font-normal text-gray-500">for {uniqueActivePlans.find(p => p.planId === selectedPlanId)?.planName}</span>
                    </h2>
                </div>
                
                {flatList.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-700 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-2">User</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2">Plan Date</th>
                                    <th className="px-4 py-2">Earnings</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flatList.map(user => (
                                    <tr key={user._id} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-2">
                                            <p className="font-medium">{user.fullName}</p>
                                            <p className="text-xs text-gray-500">@{user.username}</p>
                                        </td>
                                        <td className="px-4 py-2"><Badge status={user.status} /></td>
                                        <td className="px-4 py-2">
                                            {new Date(user.activePlans?.find(p => p.planId === selectedPlanId)?.purchaseDate || Date.now()).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-2 font-semibold text-green-600 dark:text-green-400">
                                            ${getCommissionFromReferralForPlan(user._id, selectedPlanId).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <p>No direct referrals have joined this plan yet.</p>
                        <p className="text-xs mt-1">Invite users to purchase the <strong>{uniqueActivePlans.find(p => p.planId === selectedPlanId)?.planName}</strong> to see them here.</p>
                    </div>
                )}
             </div>

            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Network Genealogy</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Visualizing the referral tree for <strong>{uniqueActivePlans.find(p => p.planId === selectedPlanId)?.planName}</strong>. 
                    Only users who hold this specific plan appear in this tree.
                </p>
                {buildPlanSpecificTree.length > 0 ? renderTree(buildPlanSpecificTree) : <p className="text-gray-500 italic">Tree is empty for this plan.</p>}
            </div>
        </div>
    );
};

export default Referrals;
