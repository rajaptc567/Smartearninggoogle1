
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import { User, Status, formatCurrency, Transaction, Currency, InvestmentPlan } from '../../types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import ShareButtons from '../../components/ui/ShareButtons';

interface GenealogyNode {
    user: User;
    children: GenealogyNode[];
    level: number;
}

// Icons
const SearchIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const WhatsAppIcon = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;
const NetworkStatsIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const CommissionIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /></svg>;
const UsersIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.975 5.975 0 0112 13a5.975 5.975 0 013 1.803M15 21a9 9 0 00-9-8.627M15 21a9 9 0 003.75-1.465M12 12a4 4 0 100-8 4 4 0 000 8z" /></svg>;
const LockIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;

const Referrals: React.FC = () => {
    const { state } = useData();
    const { currentUser, users, transactions, settings, investmentPlans } = state;
    const navigate = useNavigate();

    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [viewMode, setViewMode] = useState<'commissions' | 'inactive' | 'overflow' | 'all'>('commissions');
    const [searchQuery, setSearchTerm] = useState('');

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

    useEffect(() => {
        if (uniqueActivePlans.length > 0 && !selectedPlanId) {
            setSelectedPlanId(uniqueActivePlans[0].planId);
        }
    }, [uniqueActivePlans, selectedPlanId]);

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

    /**
     * PRECISION CALCULATION: 
     * Determines the exact slot and financial relationship for a referral on a track.
     */
    const getReferralActivityInfo = useCallback((referral: User, contextPlanIds: Set<string>) => {
        if (!currentUser) return { earned: 0, held: 0, hasActivity: false, isHoldPosition: false, holdSlotNum: null, isOverflow: false, pendingReason: null };
        
        const referralComms = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.sourceUserId === referral._id &&
            (t.relatedPlanId ? contextPlanIds.has(String(t.relatedPlanId)) : false) 
        );

        // Standard Earnings (Approved)
        const earned = referralComms.filter(t => t.status === 'Approved').reduce((sum, t) => sum + t.amount, 0);
        
        // Held Earnings (Pending) - specifically excluding eligibility holds for better UI clarity
        const held = referralComms.filter(t => t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0);
        
        // Slot/Reason Identification
        const latestPending = referralComms.find(t => t.status === 'Pending');
        let pendingReason = null;
        let isHoldPosition = false;
        let holdSlotNum = null;

        if (latestPending) {
            if (latestPending.description.toLowerCase().includes('hold')) {
                isHoldPosition = true;
                pendingReason = 'Upgrade Fund';
                const slotMatch = latestPending.description.match(/Slot #(\d+)/);
                if (slotMatch) holdSlotNum = slotMatch[1];
            } else {
                pendingReason = 'Eligibility Lock';
            }
        }

        const isOverflow = referralComms.some(t => t.status === 'Rejected' && t.description.toLowerCase().includes('limit'));
        const hasActivity = referralComms.some(t => t.status === 'Approved' || t.status === 'Pending');

        return { earned, held, hasActivity, isHoldPosition, holdSlotNum, isOverflow, pendingReason };
    }, [currentUser, transactions]);

    const networkData = useMemo(() => {
        interface NetworkDataState {
            directEarners: GenealogyNode[];
            indirectEarners: GenealogyNode[];
            inactiveReferrals: GenealogyNode[];
            overflowReferrals: GenealogyNode[];
            allNodes: GenealogyNode[];
        }

        if (!currentUser) return { directEarners: [], indirectEarners: [], inactiveReferrals: [], overflowReferrals: [], allNodes: [] } as NetworkDataState;

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
            const info = getReferralActivityInfo(node.user, equivalentPlanIdsForSelected);
            
            if (info.hasActivity) {
                if (node.level === 1) directList.push(node);
                else indirectList.push(node);
            } else if (info.isOverflow && node.level === 1) {
                overflowList.push(node);
            } else if (node.level === 1) {
                const hasZeroPlansTotal = !node.user.activePlans || node.user.activePlans.length === 0;
                if (hasZeroPlansTotal) {
                    inactiveList.push(node);
                }
            }
        });

        return {
            directEarners: directList,
            indirectEarners: indirectList,
            inactiveReferrals: inactiveList,
            overflowReferrals: overflowList,
            allNodes: nodesList
        };
    }, [currentUser, users, equivalentPlanIdsForSelected, getReferralActivityInfo]);

    const globalStats = useMemo(() => {
        const totalNetwork = networkData.allNodes.length;
        const activeNetwork = networkData.allNodes.filter(n => n.user.activePlans && n.user.activePlans.length > 0).length;
        const totalEarned = transactions.filter(t => t.userId === currentUser?._id && t.type === 'Commission' && t.status === 'Approved').reduce((s, t) => s + t.amount, 0);
        return { totalNetwork, activeNetwork, totalEarned };
    }, [networkData.allNodes, transactions, currentUser]);

    const filterListBySearch = <T extends { user: User }>(list: T[]): T[] => {
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(item => 
            item.user.username.toLowerCase().includes(q) || 
            item.user.fullName.toLowerCase().includes(q) ||
            item.user.email.toLowerCase().includes(q)
        );
    };

    const slotStats = useMemo(() => {
        if (!currentUser || !selectedPlanDetails) return { used: 0, limit: 0 };
        const limit = selectedPlanDetails.directReferralLimit || 0;
        
        // Count only Approved or Pending direct commissions that occupy a slot
        const usedCount = transactions.filter(t => 
            t.userId === currentUser._id &&
            t.type === 'Commission' &&
            t.level === 1 &&
            t.relatedPlanId && equivalentPlanIdsForSelected.has(String(t.relatedPlanId)) &&
            (t.status === 'Approved' || t.status === 'Pending') &&
            !t.description.includes('Used for Upgrade')
        ).length;

        return { used: usedCount, limit };
    }, [currentUser, selectedPlanDetails, transactions, equivalentPlanIdsForSelected]);

    const ReferralCardContent: React.FC<{
        node: { user: User, level?: number };
    }> = ({ node }) => {
        const { user } = node;
        const level = 'level' in node ? node.level : undefined;
        
        const info = getReferralActivityInfo(user, equivalentPlanIdsForSelected);
        const isHoldPosition = info.isHoldPosition;
        const isOverflow = info.isOverflow;
        const isDirect = level === 1;
        const isInactive = !isOverflow && !info.hasActivity;

        return (
            <div className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isInactive ? 'opacity-70' : ''}`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-2xl ${isInactive ? 'bg-gray-300' : isOverflow ? 'bg-amber-400' : info.pendingReason ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
                
                <div className="flex flex-col h-full gap-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${info.pendingReason ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'}`}>
                                {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-gray-900 dark:text-white truncate">@{user.username}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.fullName}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <Badge status={user.status} />
                            {!isDirect && level && <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter">L{level} Partner</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center py-2 border-y dark:border-gray-700">
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Earned</p>
                            <p className={`text-sm font-bold ${info.earned > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {formatCurrency(info.earned, currentUser?.currency)}
                            </p>
                        </div>
                        <div className="border-l dark:border-gray-700">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Held/Pending</p>
                            <p className={`text-sm font-bold ${info.held > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {info.held > 0 ? '🔒 ' : ''}{formatCurrency(info.held, currentUser?.currency)}
                            </p>
                        </div>
                    </div>
                    
                    {info.pendingReason && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl animate-fade-in shadow-inner">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                                    <LockIcon />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Wallet Lock</p>
                                </div>
                                <span className="text-[9px] bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 text-indigo-500 font-black uppercase shadow-sm">{info.pendingReason}</span>
                            </div>
                            <div className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 leading-snug">
                                {info.pendingReason === 'Upgrade Fund' && (
                                    <p><strong>Status:</strong> Slot #{info.holdSlotNum} Reserved. <br/><strong>Action:</strong> Admin will use these funds to buy your next level plan automatically.</p>
                                )}
                                {info.pendingReason === 'Eligibility Lock' && (
                                    <p><strong>Status:</strong> Not Eligible. <br/><strong>Action:</strong> You must purchase the <strong>{selectedPlanDetails?.name}</strong> plan yourself to claim this bonus.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {isOverflow && (
                         <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl animate-fade-in">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">Limit Reached</p>
                                <span className="text-[9px] font-bold text-amber-600">OVERFLOW</span>
                            </div>
                            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 leading-tight">
                                You missed this commission because your current plan capacity is full.
                            </p>
                         </div>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-2">
                         <div className="text-[10px] text-gray-400">
                            <span className="block">{new Date(user.registrationDate).toLocaleDateString()}</span>
                            <span className="block mt-0.5 font-medium text-gray-500 uppercase tracking-tighter">{user.country}</span>
                        </div>
                        <div className="flex gap-2">
                            {user.whatsapp && (
                                <a 
                                    href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="p-2 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 rounded-xl hover:bg-green-100 transition-colors shadow-sm"
                                    title="Contact on WhatsApp"
                                >
                                    <WhatsAppIcon />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const capacityPercent = slotStats.limit > 0 ? Math.min(100, (slotStats.used / slotStats.limit) * 100) : 100;
    const referralLink = `${window.location.origin}${window.location.pathname}#/register?sponsor=${currentUser?.username}`;

    return (
        <div className="space-y-8 pb-12">
            {/* 1. EXECUTIVE SUMMARY DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
                    <div className="p-4 bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 rounded-2xl">
                        <UsersIcon />
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Network</p>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{globalStats.totalNetwork} Members</h3>
                        <p className="text-[10px] text-gray-500 font-bold mt-1">{globalStats.activeNetwork} Active Accounts</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
                    <div className="p-4 bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400 rounded-2xl">
                        <CommissionIcon />
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Earnings</p>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(globalStats.totalEarned, currentUser?.currency)}</h3>
                        <p className="text-[10px] text-green-600 font-bold mt-1">Confirmed & Withdrawable</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
                    <div className="p-4 bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400 rounded-2xl">
                        <NetworkStatsIcon />
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Selected Track</p>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white truncate max-w-[150px]">{selectedPlanDetails?.name || '---'}</h3>
                        <p className="text-[10px] text-gray-500 font-bold mt-1">Direct L1 Context</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white">Network Matrix</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Visualizing slot ownership on the {selectedPlanDetails?.name || '---'} track.</p>
                    </div>
                    <div className="w-full md:w-auto">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search by name or @username..." 
                                value={searchQuery}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 w-full md:w-80 rounded-2xl border-gray-200 dark:border-gray-700 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                            />
                            <div className="absolute left-3.5 top-3.5 text-gray-400">
                                <SearchIcon />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. PLAN TRACK SELECTOR */}
                <div className="mb-10">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Switch Strategy Track</label>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {uniqueActivePlans.map(p => (
                            <button 
                                key={p.planId} 
                                onClick={() => { setSelectedPlanId(p.planId); setSearchTerm(''); }}
                                className={`px-6 py-3 rounded-2xl text-xs font-black whitespace-nowrap transition-all border-2 ${selectedPlanId === p.planId ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-500/20' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:border-blue-300'}`}
                            >
                                {p.planName}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. SLOT CAPACITY DASHBOARD */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 mb-10">
                    <div className="flex flex-col lg:flex-row gap-8 justify-between">
                        <div className="lg:w-1/3">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{selectedPlanDetails?.name} Progress</h3>
                            <div className="flex items-center gap-2 mb-4">
                                <span className={`text-4xl font-black ${capacityPercent >= 100 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                                    {slotStats.used}
                                </span>
                                <span className="text-xl text-gray-400 font-bold">/ {slotStats.limit || '∞'}</span>
                                <span className="ml-2 text-xs font-bold text-gray-500 uppercase tracking-widest">Slots Occupied</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed italic">
                                Paid slots credit your wallet instantly. Held slots fund your next upgrade.
                            </p>
                        </div>
                        
                        <div className="lg:w-2/3 flex flex-col justify-center">
                            <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                                <span>Track-Specific Direct Slots</span>
                                <span>{capacityPercent.toFixed(0)}% Utilization</span>
                            </div>
                            <div className="flex h-5 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-inner border border-gray-100 dark:border-gray-700 p-0.5">
                                 {selectedPlanDetails?.directReferralLimit ? (
                                    Array.from({ length: selectedPlanDetails.directReferralLimit }).map((_, i) => {
                                        const slotNum = i + 1;
                                        const isHoldSlot = selectedPlanDetails.holdPosition?.enabled && selectedPlanDetails.holdPosition.slots.includes(slotNum);
                                        const isUsed = slotNum <= slotStats.used;
                                        return (
                                            <div 
                                                key={i} 
                                                className={`h-full flex-1 border-r last:border-0 dark:border-gray-900 transition-all duration-700 first:rounded-l-xl last:rounded-r-xl ${
                                                    !isUsed ? 'bg-transparent' : 
                                                    isHoldSlot ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' : 'bg-gradient-to-t from-blue-600 to-blue-400'
                                                }`}
                                            />
                                        );
                                    })
                                ) : (
                                    <div className="h-full bg-blue-500 w-full rounded-xl" />
                                )}
                            </div>
                            <div className="flex flex-wrap gap-6 text-[10px] font-black text-gray-500 uppercase pt-4 tracking-tighter">
                                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></span> Paid (Wallet)</span>
                                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm"></span> Held (Upgrade)</span>
                                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"></span> Available</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. CONTENT LIST WITH VIEW SWITCHER */}
                <div className="flex bg-gray-100 dark:bg-gray-900/80 p-1.5 rounded-2xl border dark:border-gray-700 w-full sm:w-max mb-10 overflow-x-auto no-scrollbar shadow-sm">
                     {(['commissions', 'inactive', 'overflow', 'all'] as const).map(mode => (
                         <button 
                            key={mode} 
                            onClick={() => setViewMode(mode)}
                            className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all whitespace-nowrap ${viewMode === mode ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md translate-y-0 scale-105' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            {mode === 'commissions' ? 'Active Slots' : mode === 'inactive' ? 'Uninvested Refs' : mode === 'overflow' ? 'Overflow (Missed)' : 'Full Matrix'}
                        </button>
                     ))}
                </div>

                {viewMode === 'commissions' && (
                    <div className="space-y-10 animate-fade-in">
                        <section>
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                <span className="w-3 h-6 bg-blue-600 rounded-lg shadow-sm shadow-blue-500/50"></span> 
                                Occupied Referral Slots ({filterListBySearch(networkData.directEarners).length + filterListBySearch(networkData.indirectEarners).length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filterListBySearch(networkData.directEarners).map(node => (
                                    <ReferralCardContent key={node.user._id} node={node} />
                                ))}
                                {filterListBySearch(networkData.indirectEarners).map(node => (
                                    <ReferralCardContent key={node.user._id} node={node} />
                                ))}
                                {filterListBySearch(networkData.directEarners).length === 0 && filterListBySearch(networkData.indirectEarners).length === 0 && (
                                    <div className="col-span-full py-16 text-center bg-gray-50 dark:bg-gray-900/30 rounded-[2rem] border-2 border-dashed dark:border-gray-800">
                                        <div className="text-4xl mb-4 opacity-50">👥</div>
                                        <p className="text-gray-500 italic font-medium">No referral activity found on this specific plan track.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {viewMode === 'inactive' && (
                    <div className="space-y-6 animate-fade-in">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-3 h-6 bg-gray-400 rounded-lg"></span> 
                            Members without any Plan ({filterListBySearch(networkData.inactiveReferrals).length})
                        </h3>
                        <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30 flex items-start gap-4">
                            <span className="text-2xl">💡</span>
                            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                                These members have registered but not yet purchased a plan. Once they start, they will occupy a slot in your active matrix.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filterListBySearch(networkData.inactiveReferrals).map(node => (
                                <ReferralCardContent key={node.user._id} node={node} />
                            ))}
                            {filterListBySearch(networkData.inactiveReferrals).length === 0 && (
                                <div className="col-span-full py-16 text-center bg-gray-50 dark:bg-gray-900/30 rounded-[2rem] border-2 border-dashed dark:border-gray-800">
                                    <p className="text-gray-500 italic font-medium">Excellent! All your direct referrals are active members.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {viewMode === 'overflow' && (
                    <div className="space-y-6 animate-fade-in">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-3 h-6 bg-amber-500 rounded-lg shadow-sm shadow-amber-500/50"></span> 
                            Capacity Overflow Audit ({filterListBySearch(networkData.overflowReferrals).length})
                        </h3>
                        <div className="p-5 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-800/30 flex items-start gap-4 shadow-sm">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed font-bold uppercase tracking-wider mb-1">Commission Leakage Detected</p>
                                <p className="text-xs text-red-700/80 dark:text-red-400 font-medium">
                                    You missed earnings from these partners because your current plan track reached its maximum direct referral limit.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filterListBySearch(networkData.overflowReferrals).map(node => (
                                <ReferralCardContent key={node.user._id} node={node} />
                            ))}
                            {filterListBySearch(networkData.overflowReferrals).length === 0 && (
                                <div className="col-span-full py-16 text-center bg-gray-50 dark:bg-gray-900/30 rounded-[2rem] border-2 border-dashed dark:border-gray-800">
                                    <p className="text-gray-500 italic font-medium">No missed commissions on this track. Keep it up!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {viewMode === 'all' && (
                    <div className="space-y-8 animate-fade-in">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-3 h-6 bg-blue-600 rounded-lg shadow-sm shadow-blue-500/50"></span> 
                            Downline Matrix: {selectedPlanDetails?.name}
                        </h3>
                        <div className="overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm bg-gray-50/30 dark:bg-transparent">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 dark:bg-gray-900 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700">
                                    <tr>
                                        <th className="px-8 py-5">Partner</th>
                                        <th className="px-8 py-5">Gen.</th>
                                        <th className="px-8 py-5 text-center">Track Status</th>
                                        <th className="px-8 py-5">Earned</th>
                                        <th className="px-8 py-5 text-right">Join Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
                                    {filterListBySearch(networkData.allNodes).map((node: GenealogyNode) => {
                                        const info = getReferralActivityInfo(node.user, equivalentPlanIdsForSelected);
                                        const trStatus = info.earned > 0 ? 'Active' : info.held > 0 ? 'Held' : info.isOverflow ? 'Overflow' : 'No Activity';
                                        const trColor = info.earned > 0 ? 'text-green-600' : info.held > 0 ? 'text-indigo-600' : info.isOverflow ? 'text-red-500' : 'text-gray-400';

                                        return (
                                            <tr key={node.user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 shadow-inner">
                                                            {node.user.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-gray-900 dark:text-white">@{node.user.username}</span>
                                                            <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-tighter">{node.user.fullName}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter ${node.level === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                                                        L{node.level}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`text-[10px] font-black uppercase ${trColor}`}>{trStatus}</span>
                                                </td>
                                                <td className="px-8 py-5 font-mono text-xs">
                                                    {info.held > 0 ? '🔒 ' : ''}{formatCurrency(info.earned + info.held, currentUser?.currency)}
                                                </td>
                                                <td className="px-8 py-5 text-right text-xs text-gray-500 font-mono">{new Date(node.user.registrationDate).toLocaleDateString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filterListBySearch(networkData.allNodes).length === 0 && <p className="p-12 text-center text-gray-500 italic bg-white dark:bg-gray-800">Your network is empty.</p>}
                        </div>
                    </div>
                )}
            </div>

            <div className="max-w-3xl mx-auto">
                <ShareButtons url={referralLink} title="Join my successful team on SmartEarning! 🚀" />
            </div>
        </div>
    );
};

export default Referrals;
