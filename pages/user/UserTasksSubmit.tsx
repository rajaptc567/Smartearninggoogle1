import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, UserTask } from '../../types';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { createUserTask, submitUserTaskProof, convertUserCurrency, createDispute, convertTaskWalletBalance, updateSubmissionStatus, openTaskDispute, updateUserTaskStatus, deleteUserTask, transferInvestmentToTaskWallet, transferTaskEarningsToCampaignWallet, transferWalletToCampaign } from '../../services/api';
import { canUserAccessTasks } from '../../utils/taskAccess';
import { Link, useSearchParams } from 'react-router-dom';
import { DisputeTimeline } from '../../components/DisputeTimeline';
import { seoAnalytics } from '../../services/seoAnalytics';
import OtherTasksCard from '../../components/OtherTasksCard';
import { Layers as TaskIcon, Globe as GlobeIcon } from 'lucide-react';

export interface UserTasksSubmitProps {
    initialTab?: 'submit' | 'browse' | 'my-tasks' | 'pending-payment' | 'completed-tasks' | 'converter' | 'review-proofs';
    hideHeaderAndTabs?: boolean;
    hideHeroBanner?: boolean;
    hideSubTabs?: boolean;
}

export const getRemainingTimeString = (targetDate?: string | Date) => {
    if (!targetDate) return null;
    const target = new Date(targetDate).getTime();
    if (isNaN(target)) return null;
    const now = Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return 'Expired';

    const hoursTotal = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hoursTotal >= 24) {
        const days = Math.floor(hoursTotal / 24);
        const remHours = hoursTotal % 24;
        return `${days}d ${remHours}h ${mins}m left`;
    }
    return `${hoursTotal}h ${mins}m left`;
};

export const renderDisputeStageBadge = (sub: any) => {
    if (sub.isAutoApproved || sub.autoApproved || sub.approvalType === 'auto' || (sub.adminNotes && sub.adminNotes.toLowerCase().includes('auto-approved'))) {
        return (
            <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-sm flex items-center gap-1 inline-flex">
                ⚡ Auto Approved
            </span>
        );
    }
    if (sub.status === 'Approved' || sub.status === 'Paid') {
        return <Badge variant="success">Completed</Badge>;
    }
    if (sub.status === 'Pending') {
        return <Badge variant="warning">Pending Review</Badge>;
    }
    if (sub.status === 'Disputed' || sub.disputeOpened) {
        if (sub.disputeStage === 'Escalated') {
            return (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-sm flex items-center gap-1 inline-flex">
                    ⚖️ Disputed (With Admin)
                </span>
            );
        }
        if (sub.disputeStage === 'RejectedByCreator') {
            return (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-sm flex items-center gap-1 inline-flex">
                    ⚠️ Creator Rejected Dispute
                </span>
            );
        }
        return (
            <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-sm flex items-center gap-1 inline-flex">
                🤝 Disputed (With Creator)
            </span>
        );
    }
    if (sub.status === 'Rejected') {
        if (sub.disputeStage === 'RejectedByCreator') {
            return (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-sm flex items-center gap-1 inline-flex">
                    ❌ Dispute Rejected by Creator
                </span>
            );
        }
        return <Badge variant="danger">Rejected</Badge>;
    }
    return <Badge variant="secondary">{sub.status}</Badge>;
};

export const renderDisputeTimerBox = (sub: any, settings: any) => {
    const isDisputed = sub.status === 'Disputed' || sub.disputeOpened;
    const isRejected = sub.status === 'Rejected';
    const isLevel2 = sub.disputeStage === 'RejectedByCreator';

    if (!isDisputed && !isRejected) return null;

    // 1. Rejected for first time (not disputed yet)
    if (isRejected && !isDisputed && sub.disputeStage !== 'RejectedByCreator') {
        const disputeLimitHours = settings?.systemLimits?.disputeTimeLimitHours ?? 48;
        const targetDate = sub.disputeDeadline || (sub.rejectedAt ? new Date(new Date(sub.rejectedAt).getTime() + disputeLimitHours * 3600000) : null);
        const remStr = getRemainingTimeString(targetDate);
        const isExpired = remStr === 'Expired' || (targetDate && new Date() > new Date(targetDate));

        return (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-xl space-y-1 my-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1">
                        ⏰ Dispute Window Limit ({disputeLimitHours}h Total)
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md ${isExpired ? 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                        {isExpired ? 'Window Expired' : remStr || `${disputeLimitHours}h remaining`}
                    </span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    {isExpired 
                        ? `The ${disputeLimitHours}-hour dispute window for this rejection has closed.` 
                        : `You have ${remStr || disputeLimitHours + ' hours'} remaining to raise a dispute with the campaign creator.`}
                </p>
            </div>
        );
    }

    // 2. Disputed with Creator (CreatorReview)
    if (isDisputed && (sub.disputeStage === 'CreatorReview' || !sub.disputeStage || sub.disputeStage === 'None')) {
        const timeoutDays = settings?.systemLimits?.disputeReviewTimeoutDays ?? 3;
        const targetDate = sub.disputeReviewDeadline || (sub.updatedAt || sub.createdAt ? new Date(new Date(sub.updatedAt || sub.createdAt).getTime() + timeoutDays * 86400000) : null);
        const remStr = getRemainingTimeString(targetDate);

        return (
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1.5 my-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <span>🤝</span> Disputed with Campaign Creator
                    </span>
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                        Auto-Approves in: {remStr || `${timeoutDays} days`}
                    </span>
                </div>
                <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
                    The campaign creator has <strong className="font-extrabold">{timeoutDays} days</strong> to review and resolve your dispute. If left unreviewed, the system will <strong className="underline">automatically approve</strong> your task and release the payment!
                </p>
            </div>
        );
    }

    // 3. Creator Rejected Dispute (Eligible for Admin Escalation)
    if (sub.disputeStage === 'RejectedByCreator' || (isRejected && isLevel2)) {
        const secondDisputeHours = settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48;
        const targetDate = sub.secondDisputeDeadline || (sub.updatedAt ? new Date(new Date(sub.updatedAt).getTime() + secondDisputeHours * 3600000) : null);
        const remStr = getRemainingTimeString(targetDate);
        const isExpired = remStr === 'Expired' || (targetDate && new Date() > new Date(targetDate));

        return (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-xl space-y-1.5 my-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <span>⚠️</span> Creator Rejected Dispute
                    </span>
                    <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${isExpired ? 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'}`}>
                        {isExpired ? 'Escalation Expired' : `Escalate Window: ${remStr}`}
                    </span>
                </div>
                <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                    {isExpired 
                        ? `The ${secondDisputeHours}-hour deadline to escalate to Admin has passed.` 
                        : `The campaign creator rejected your dispute. You can escalate directly to Platform Admin within ${remStr || secondDisputeHours + ' hours'}.`}
                </p>
            </div>
        );
    }

    // 4. Escalated to Admin
    if (sub.disputeStage === 'Escalated') {
        return (
            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-1.5 my-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <span>⚖️</span> Disputed with Platform Admin
                    </span>
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100 animate-pulse">
                        Admin Verdict Pending
                    </span>
                </div>
                <p className="text-xs text-purple-900 dark:text-purple-200 leading-relaxed font-medium">
                    Your dispute has been escalated directly to Platform Admin. The Admin team is reviewing all proof screenshots, creator notes, and task parameters to render a final binding verdict.
                </p>
            </div>
        );
    }

    return null;
};

const UserTasksSubmit: React.FC<UserTasksSubmitProps> = ({ initialTab = 'browse', hideHeaderAndTabs = false, hideHeroBanner = false, hideSubTabs = false }) => {
    const { state, dispatch } = useData();
    const { currentUser, userTasks, userTaskSubmissions, settings } = state;
    const rates = settings?.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
    const [searchParams] = useSearchParams();

    const userIdStr = currentUser?._id?.toString() || '';
    const exchangeRate = rates[currentUser?.currency || 'USD'] || 1;

    // Calculate Task Earnings Balance dynamically to match Dashboard
    const netAvailableTaskEarningsUSD = useMemo(() => {
        if (!userIdStr) return 0;
        if (currentUser?.taskEarningsBalance !== undefined && currentUser?.taskEarningsBalance !== null) {
            return Number(currentUser.taskEarningsBalance.toFixed(2));
        }
        
        // 1. Approved Submissions Earnings
        const approvedSubmissions = (userTaskSubmissions || []).filter((s: any) => 
            s.workerId?.toString() === userIdStr && 
            (s.status === 'Approved' || s.status === 'Completed')
        );
        const totalSubmissionsEarningsUSD = approvedSubmissions.reduce((sum: number, s: any) => {
            return sum + (s.rewardAmount || 0);
        }, 0);

        // 2. Standalone Task Reward Transactions
        const approvedTaskTrxs = (state.transactions || []).filter((t: any) => 
            t.userId?.toString() === userIdStr && 
            t.status === 'Approved' && 
            (t.type === 'Task Reward' || t.type === 'Micro-Task' || t.type === 'Task Completed' || t.description?.toLowerCase().includes('job completed') || t.description?.toLowerCase().includes('task reward')) &&
            !t.description?.toLowerCase().includes('converted') &&
            !t.description?.toLowerCase().includes('transferred')
        );
        const standaloneTrxEarningsUSD = approvedTaskTrxs.reduce((sum: number, t: any) => {
            const txIdStr = t._id?.toString();
            const subIdStr = t.submissionId?.toString();
            const isDuplicate = approvedSubmissions.some((s: any) => 
                String(s._id) === txIdStr || 
                (subIdStr && String(s._id) === subIdStr) ||
                (s.rewardTransactionId && String(s.rewardTransactionId) === txIdStr)
            );
            if (isDuplicate) return sum;
            let amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs(t.amount || 0);
            if (t.currency && t.currency !== 'USD') {
                amtUSD = (t.exchangeRate || exchangeRate) > 0 ? Math.abs(t.amount || 0) / (t.exchangeRate || exchangeRate) : Math.abs(t.amount || 0) / exchangeRate;
            }
            return sum + amtUSD;
        }, 0);

        const totalLifetimeTaskEarningsUSD = Math.max(totalSubmissionsEarningsUSD + standaloneTrxEarningsUSD, currentUser?.taskEarningsBalance || 0);

        // Deducted Hub Withdrawals
        const totalDeductedHubWithdrawalsUSD = (state.withdrawals || [])
            .filter((w: any) => w.userId?.toString() === userIdStr && (w.status === 'Approved' || w.status === 'Paid') && ((w as any).isHub || (w as any).isTaskWallet || w.userNotes?.toLowerCase().includes('hub') || w.userNotes?.toLowerCase().includes('task')))
            .reduce((sum: number, w: any) => sum + (w.currency && w.currency !== 'USD' ? (w.amount / exchangeRate) : w.amount), 0);

        // Converted Task Earnings (to Base Currency / Main Wallet)
        const totalConvertedTaskEarningsUSD = (state.transactions || [])
            .filter((t: any) => t.userId?.toString() === userIdStr && t.status === 'Approved')
            .reduce((sum: number, t: any) => {
                const typeLower = (t.type || '').toLowerCase();
                const descLower = (t.description || '').toLowerCase();
                const isInvestmentTransfer = typeLower.includes('investment to task') || typeLower.includes('investment to campaign') || typeLower.includes('investment wallet') || descLower.includes('from investment wallet') || descLower.includes('from investment module');
                if (isInvestmentTransfer) return sum;
                const isCampaign = descLower.includes('campaign') || typeLower.includes('campaign');
                const isConversionOrTransferOut = !isCampaign && (
                    typeLower.includes('task wallet conversion') || typeLower.includes('task wallet transfer') || typeLower.includes('task earnings conversion') || typeLower.includes('task earnings transfer') ||
                    (descLower.includes('converted') && (descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('transferred') && (descLower.includes('task earnings') || descLower.includes('task wallet')))
                );
                if (isConversionOrTransferOut) {
                    let amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs(t.amount || 0);
                    if (t.currency && t.currency !== 'USD') {
                        amtUSD = (t.exchangeRate || exchangeRate) > 0 ? Math.abs(t.amount || 0) / (t.exchangeRate || exchangeRate) : Math.abs(t.amount || 0) / exchangeRate;
                    }
                    return sum + amtUSD;
                }
                return sum;
            }, 0);

        // Funds Used for Campaign
        const fundsUsedForCampaignUSD = (state.transactions || [])
            .filter((t: any) => t.userId?.toString() === userIdStr && t.status === 'Approved')
            .reduce((sum: number, t: any) => {
                const typeLower = (t.type || '').toLowerCase();
                const descLower = (t.description || '').toLowerCase();
                const isInvestmentTransfer = typeLower.includes('investment to task') || typeLower.includes('investment to campaign') || typeLower.includes('investment wallet') || descLower.includes('from investment wallet') || descLower.includes('from investment module');
                const isCampaignTransferFromTaskEarnings = !isInvestmentTransfer && (
                    typeLower.includes('task reward transfer') ||
                    (typeLower.includes('campaign') && (typeLower.includes('task') || descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('campaign') && (descLower.includes('task earnings') || descLower.includes('task wallet') || descLower.includes('converted') || descLower.includes('transferred')))
                );
                if (isCampaignTransferFromTaskEarnings) {
                    let amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs(t.amount || 0);
                    if (t.currency && t.currency !== 'USD') {
                        amtUSD = (t.exchangeRate || exchangeRate) > 0 ? Math.abs(t.amount || 0) / (t.exchangeRate || exchangeRate) : Math.abs(t.amount || 0) / exchangeRate;
                    }
                    return sum + amtUSD;
                }
                return sum;
            }, 0);

        const net = totalLifetimeTaskEarningsUSD - totalDeductedHubWithdrawalsUSD - totalConvertedTaskEarningsUSD - fundsUsedForCampaignUSD;
        return Math.max(0, Number(net.toFixed(2)));
    }, [userTaskSubmissions, state.transactions, state.withdrawals, userIdStr, exchangeRate, currentUser?.taskEarningsBalance]);

    // Calculate Campaign Wallet Balance dynamically to match Dashboard
    const availableCampaignWalletUSD = useMemo(() => {
        if (!userIdStr) return 0;
        if (currentUser?.taskWalletBalance !== undefined && currentUser?.taskWalletBalance !== null) {
            return Number(currentUser.taskWalletBalance.toFixed(2));
        }

        // Funds used for campaign from Task Earnings
        const fundsUsedForCampaignUSD = (state.transactions || [])
            .filter((t: any) => t.userId?.toString() === userIdStr && t.status !== 'Rejected' && t.status !== 'Cancelled')
            .reduce((sum: number, t: any) => {
                const typeLower = (t.type || '').toLowerCase();
                const descLower = (t.description || '').toLowerCase();
                const isInvestmentTransfer = typeLower.includes('investment to task') || typeLower.includes('investment to campaign') || typeLower.includes('investment wallet') || descLower.includes('from investment wallet') || descLower.includes('from investment module');
                const isCampaignTransferFromTaskEarnings = !isInvestmentTransfer && (
                    typeLower.includes('task reward transfer') ||
                    (typeLower.includes('campaign') && (typeLower.includes('task') || descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('campaign') && (descLower.includes('task earnings') || descLower.includes('task wallet') || descLower.includes('converted') || descLower.includes('transferred')))
                );
                if (isCampaignTransferFromTaskEarnings) {
                    let amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs(t.amount || 0);
                    if (t.currency && t.currency !== 'USD') {
                        amtUSD = (t.exchangeRate || exchangeRate) > 0 ? Math.abs(t.amount || 0) / (t.exchangeRate || exchangeRate) : Math.abs(t.amount || 0) / exchangeRate;
                    }
                    return sum + amtUSD;
                }
                return sum;
            }, 0);

        // Hub deposits
        const totalHubDepositsBase = (state.deposits || [])
            .filter((d: any) => d.userId?.toString() === userIdStr && (d.status === 'Approved' || d.status === 'Paid') && ((d as any).isHub || (d as any).isTaskWallet || d.userNotes?.toLowerCase().includes('hub') || d.userNotes?.toLowerCase().includes('task')))
            .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
        const totalHubDepositsUSD = totalHubDepositsBase / exchangeRate;

        // Transferred In Investment
        const investmentTransferSum = (state.transactions || []).filter((t: any) => {
            if (t.userId?.toString() !== userIdStr) return false;
            if (t.status === 'Rejected' || t.status === 'Cancelled') return false;
            const typeLower = (t.type || '').toLowerCase();
            const descLower = (t.description || '').toLowerCase();
            return (
                typeLower === 'investment to task wallet transfer' ||
                typeLower.includes('investment to task') ||
                typeLower.includes('investment to campaign') ||
                (typeLower.includes('transfer') && descLower.includes('investment') && (descLower.includes('task') || descLower.includes('work') || descLower.includes('campaign')))
            );
        }).reduce((sum: number, t: any) => {
            let amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs(t.amount || 0);
            if (t.currency && t.currency !== 'USD') {
                amtUSD = (t.exchangeRate || exchangeRate) > 0 ? Math.abs(t.amount || 0) / (t.exchangeRate || exchangeRate) : Math.abs(t.amount || 0) / exchangeRate;
            }
            return sum + amtUSD;
        }, 0);

        const totalTransferredInUSD = investmentTransferSum + fundsUsedForCampaignUSD + totalHubDepositsUSD;

        // Campaign Purchases
        const myCampaignTasks = (userTasks || []).filter((t: any) => {
            const uId = t.userId?.toString();
            const cId = typeof t.creatorId === 'object' ? t.creatorId?._id?.toString() : t.creatorId?.toString();
            return uId === userIdStr || cId === userIdStr;
        });

        const campaignPurchasesUSD = myCampaignTasks.reduce((sum: number, t: any) => {
            const subtotal = Number(((t?.targetQuantity || 1) * (t?.rewardPerTask || 0)).toFixed(2));
            const commissionPercent = settings?.userTaskConfig?.commissionPercent ?? 10;
            const adminCommission = Number(t?.adminCommission ?? (subtotal * (commissionPercent / 100)).toFixed(2));
            const slotsAndCommissionBudget = Number(t?.totalBudget ?? (subtotal + adminCommission).toFixed(2));
            const defaultCreationFee = settings?.userTaskConfig?.campaignFeeEnabled ? (settings?.userTaskConfig?.campaignFeeAmount || 0) : 0;
            const campaignCreationFee = Number((t?.baseFeeCharged ?? t?.campaignFeeUSD ?? t?.baseCampaignFee ?? defaultCreationFee).toFixed(2));
            const grandTotalLaunchCost = Number((slotsAndCommissionBudget + campaignCreationFee).toFixed(2));
            return sum + grandTotalLaunchCost;
        }, 0);

        return Math.max(0, Number((totalTransferredInUSD - campaignPurchasesUSD).toFixed(2)));
    }, [currentUser?.taskWalletBalance, state.transactions, userTasks, state.deposits, userIdStr, exchangeRate, settings]);

    const renderPagination = (currentPage: number, totalPages: number, setPage: (p: number) => void) => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-gray-500 font-bold">Page {currentPage} of {totalPages}</span>
                <div className="flex flex-wrap items-center gap-1.5 justify-center sm:justify-end">
                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === 1}
                        onClick={() => setPage(1)}
                    >
                        &laquo; First
                    </Button>
                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                    >
                        &larr; Prev
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages)
                        .map((p, index, array) => {
                            const showEllipsis = index > 0 && p - array[index - 1] > 1;
                            return (
                                <React.Fragment key={p}>
                                    {showEllipsis && <span className="text-gray-400 px-1 font-bold">...</span>}
                                    <Button
                                        variant={currentPage === p ? 'primary' : 'secondary'}
                                        className={`py-1.5 px-3 font-black text-xs min-w-[2.25rem] h-9 flex items-center justify-center rounded-xl transition-all ${
                                            currentPage === p ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : ''
                                        }`}
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </Button>
                                </React.Fragment>
                            );
                        })}

                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(currentPage + 1)}
                    >
                        Next &rarr;
                    </Button>
                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(totalPages)}
                    >
                        Last &raquo;
                    </Button>
                </div>
            </div>
        );
    };

    const [activeTab, setActiveTab] = useState<'submit' | 'browse' | 'my-tasks' | 'pending-payment' | 'completed-tasks' | 'converter' | 'review-proofs'>(initialTab);
    const [availableTasksSubTab, setAvailableTasksSubTab] = useState<'available_jobs' | 'other_tasks'>('available_jobs');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'submit' || tab === 'create') {
            setActiveTab('submit');
        } else if (tab === 'browse' || tab === 'available') {
            setActiveTab('browse');
        } else if (tab === 'my-tasks' || tab === 'my-campaigns') {
            setActiveTab('my-tasks');
        } else if (tab === 'completed-tasks' || tab === 'history') {
            setActiveTab('completed-tasks');
        } else if (tab === 'review-proofs') {
            setActiveTab('review-proofs');
        } else if (tab === 'pending-payment') {
            setActiveTab('pending-payment');
        } else if (tab === 'converter') {
            setActiveTab('converter');
        } else if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [searchParams, initialTab]);
    const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);
    const [reviewFilter, setReviewFilter] = useState<'All' | 'Pending' | 'Disputed' | 'Approved' | 'Rejected'>('Pending');
    const [myCampaignFilter, setMyCampaignFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('all');

    // Dispute State
    const [selectedSubmissionForDispute, setSelectedSubmissionForDispute] = useState<any | null>(null);
    const [disputeDescription, setDisputeDescription] = useState('');
    const [disputeProofImage, setDisputeProofImage] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Campaign Review Resubmission State
    const [selectedCampaignForReview, setSelectedCampaignForReview] = useState<any | null>(null);
    const [reviewExplanation, setReviewExplanation] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [campaignNotice, setCampaignNotice] = useState<{ type: 'success' | 'info'; text: string; subtext?: string } | null>(null);

    useEffect(() => {
        if (campaignNotice) {
            const timer = setTimeout(() => {
                setCampaignNotice(null);
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [campaignNotice]);

    // Create Campaign Form State
    const [category, setCategory] = useState<string>('YouTube');
    const [subType, setSubType] = useState<string>('Subscribe');
    const [watchTimeTierIndex, setWatchTimeTierIndex] = useState<number>(0);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');
    const [targetQuantity, setTargetQuantity] = useState<number | string>(10);
    const [rewardPerTask, setRewardPerTask] = useState<number | string>(0.10); // in USD
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Creator Proof Requirements (Module A)
    const [requireTextProof, setRequireTextProof] = useState(false);
    const [textProofInstruction, setTextProofInstruction] = useState('');
    const [requireUsername, setRequireUsername] = useState(false);
    const [usernameInstruction, setUsernameInstruction] = useState('');
    const [requireUserId, setRequireUserId] = useState(false);
    const [userIdInstruction, setUserIdInstruction] = useState('');
    const [requireEmail, setRequireEmail] = useState(false);
    const [emailInstruction, setEmailInstruction] = useState('');
    const [requireScreenshot, setRequireScreenshot] = useState(true);
    const [screenshotInstruction, setScreenshotInstruction] = useState('Please upload screenshot proof of completion.');

    const [requiredProofsList, setRequiredProofsList] = useState<Array<{ id: string; type: 'text' | 'username' | 'userId' | 'email' | 'screenshot' | 'manual'; label: string; instruction: string }>>([
        { id: 'screenshot_1', type: 'screenshot', label: 'Screenshot / Image', instruction: 'Please upload screenshot proof of completion.' }
    ]);

    // Form Validation & Popup Notice State
    const [fieldErrors, setFieldErrors] = useState<{
        title?: string;
        link?: string;
        targetQuantity?: string;
        rewardPerTask?: string;
        proofs?: string;
        proofInstructions?: Record<string, string>;
    }>({});

    const [validationNoticeModal, setValidationNoticeModal] = useState<{
        isOpen: boolean;
        title: string;
        messages: string[];
        firstErrorFieldId?: string;
    }>({
        isOpen: false,
        title: '',
        messages: []
    });

    const addProofType = (type: 'text' | 'username' | 'userId' | 'email' | 'screenshot' | 'manual', label: string) => {
        const limits = settings?.userTaskProofLimits || {
            screenshot: { enabled: true, max: 2 },
            text: { enabled: true, max: 3 },
            username: { enabled: true, max: 3 },
            userId: { enabled: true, max: 3 },
            email: { enabled: true, max: 3 },
            manual: { enabled: true, max: 3 }
        };

        const config = limits[type] || { enabled: true, max: 5 };

        if (!config.enabled) {
            alert(`${label} proofs are currently disabled by the administrator.`);
            return;
        }

        const count = requiredProofsList.filter(p => p.type === type).length;
        if (count >= config.max) {
            alert(`The administrator has limited the number of duplicate ${label} proofs to ${config.max}. You cannot add any more.`);
            return;
        }

        const finalLabel = count > 0 ? `${label} #${count + 1}` : label;
        
        const newProof = {
            id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type,
            label: finalLabel,
            instruction: type === 'screenshot' ? 'Please upload screenshot proof of completion.' : `Please provide your ${label.toLowerCase()} details.`
        };
        setRequiredProofsList([...requiredProofsList, newProof]);
    };

    const removeProofItem = (id: string) => {
        setRequiredProofsList(requiredProofsList.filter(p => p.id !== id));
    };

    const updateProofInstruction = (id: string, instruction: string) => {
        setRequiredProofsList(requiredProofsList.map(p => p.id === id ? { ...p, instruction } : p));
    };

    // Proof Submission State (Module C)
    const [selectedTaskForProof, setSelectedTaskForProof] = useState<any | null>(null);
    const [proofStep, setProofStep] = useState<number>(1);
    const [proofText, setProofText] = useState('');
    const [proofUsername, setProofUsername] = useState('');
    const [proofUserIdVal, setProofUserIdVal] = useState('');
    const [proofEmail, setProofEmail] = useState('');
    const [proofImage, setProofImage] = useState('');
    const [submittedProofsValues, setSubmittedProofsValues] = useState<Record<string, string>>({});
    const [proofAgreed, setProofAgreed] = useState(false);
    const [isSubmittingProof, setIsSubmittingProof] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [selectedSubmissionForDetails, setSelectedSubmissionForDetails] = useState<any | null>(null);
    const [isTransferringTaskWallet, setIsTransferringTaskWallet] = useState(false);

    // Insufficient Funds Campaign Modal State
    const [insufficientFundsModal, setInsufficientFundsModal] = useState<{
        isOpen: boolean;
        requiredAmountUSD: number;
        requiredAmountUserCurr: number;
        availableTaskWalletUSD: number;
        availableInvestmentUserCurr: number;
        availableInvestmentUSD: number;
        availableTaskEarningsUSD?: number;
        userCurrency: string;
        shortfallUSD: number;
        shortfallUserCurr: number;
        fundingCompleted?: boolean;
        lastTransferredUserCurr?: number;
        lastTransferredUSD?: number;
    } | null>(null);
    const [manualTransferAmount, setManualTransferAmount] = useState<number>(0);
    const [fundingSource, setFundingSource] = useState<'investment' | 'task_earnings' | 'combined'>('task_earnings');
    const [isTransferringFundsModal, setIsTransferringFundsModal] = useState<boolean>(false);

    // Funding Success Pop-up State
    const [fundingSuccessModal, setFundingSuccessModal] = useState<{
        isOpen: boolean;
        transferredUserCurr: number;
        transferredUSD: number;
        userCurrency: string;
        newTaskWalletUSD: number;
    } | null>(null);

    // Browse Tasks Filter & Pagination State
    const [browseSearch, setBrowseSearch] = useState('');
    const [browseCategory, setBrowseCategory] = useState('All');
    const [browseSort, setBrowseSort] = useState('latest');
    const [browsePage, setBrowsePage] = useState(1);
    const [browseItemsPerPage, setBrowseItemsPerPage] = useState<number>(10);

    // My Campaigns Search & Pagination State
    const [myCampaignsSearch, setMyCampaignsSearch] = useState('');
    const [myCampaignsPage, setMyCampaignsPage] = useState(1);
    const [myCampaignsItemsPerPage, setMyCampaignsItemsPerPage] = useState<number>(10);

    // Campaign Funds Summary & Amount Trail States
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferSource, setTransferSource] = useState<'Main' | 'Investment' | 'CampaignToMain'>('Main');
    const [transferInputAmount, setTransferInputAmount] = useState<number | string>(10);
    const [convertInputAmount, setConvertInputAmount] = useState<number | string>(5);
    const [showAmountTrail, setShowAmountTrail] = useState(false);
    const [amountTrailSearch, setAmountTrailSearch] = useState('');
    const [amountTrailCategory, setAmountTrailCategory] = useState<string>('All');
    const [amountTrailDateRange, setAmountTrailDateRange] = useState<'All' | '30Days' | 'ThisMonth' | 'ThisYear'>('All');
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

    // Pending Payments Search & Pagination State
    const [pendingSearch, setPendingSearch] = useState('');
    const [pendingPage, setPendingPage] = useState(1);
    const pendingItemsPerPage = 10;

    // Completed Tasks Search & Pagination State
    const [completedSearch, setCompletedSearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'All' | 'Approved' | 'Rejected' | 'Pending'>('All');
    const [completedPage, setCompletedPage] = useState(1);
    const completedItemsPerPage = 10;

    // Review Proofs Search & Pagination State
    const [reviewSearch, setReviewSearch] = useState('');
    const [reviewPage, setReviewPage] = useState(1);
    const reviewItemsPerPage = 10;

    // Creator Campaign Management Detail View State
    const [selectedCampaignForDetail, setSelectedCampaignForDetail] = useState<any | null>(null);
    const [detailSubmissionTab, setDetailSubmissionTab] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
    const [selectedSubmissions, setSelectedSubmissions] = useState<Record<string, boolean>>({});
    const [rejectingSubId, setRejectingSubId] = useState<string | null>(null);
    const [rejectionFeedback, setRejectionFeedback] = useState('');
    const [selectedWorkerSubmissionForDetails, setSelectedWorkerSubmissionForDetails] = useState<any | null>(null);
    const [copiedCampaignLink, setCopiedCampaignLink] = useState(false);

    const handleCopyCampaignLink = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedCampaignLink(true);
        setTimeout(() => setCopiedCampaignLink(false), 2000);
    };

    const handleTransferTaskWallet = async () => {
        setIsTransferringTaskWallet(true);
        try {
            const res = await convertTaskWalletBalance({ userId: currentUser._id });
            dispatch({ type: 'UPDATE_USER', payload: res.user });
            alert(`Successfully transferred task wallet balance to Main MLM Balance (${res.convertedAmount} ${res.currency})!`);
            setShowConvertModal(false);
        } catch (error) {
            alert(`Failed to transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsTransferringTaskWallet(false);
        }
    };

    const handleTransferInvestmentToTaskWallet = async (amountUserCurrVal?: number) => {
        if (!currentUser || isTransferringFundsModal) return;
        setIsTransferringFundsModal(true);
        try {
            const userCurr = currentUser.currency || 'USD';
            const rate = rates[userCurr] || 1;
            let transferAmtUserCurr = amountUserCurrVal ?? manualTransferAmount;

            if (isNaN(transferAmtUserCurr) || transferAmtUserCurr <= 0) {
                alert('Please enter a valid amount to transfer.');
                setIsTransferringFundsModal(false);
                return;
            }

            const transferAmtUSD = Number((transferAmtUserCurr / rate).toFixed(2));

            if (currentUser.walletBalance < transferAmtUserCurr) {
                alert(`Insufficient balance in Investment Wallet. Available: ${currentUser.walletBalance.toFixed(2)} ${userCurr}, Requested: ${transferAmtUserCurr.toFixed(2)} ${userCurr}. Please top up your Investment Wallet first.`);
                setIsTransferringFundsModal(false);
                return;
            }

            const res = await transferInvestmentToTaskWallet({
                userId: currentUser._id,
                amountUserCurr: transferAmtUserCurr,
                amountUSD: transferAmtUSD
            });

            const updatedUser = res.user;
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });

            // Dispatch transaction record for the transfer
            dispatch({
                type: 'ADD_TRANSACTION',
                payload: {
                    _id: 'trx_xfer_' + Date.now(),
                    userId: currentUser._id,
                    userName: currentUser.username || currentUser.fullName,
                    currency: userCurr,
                    type: 'Investment To Task Wallet Transfer',
                    amount: -transferAmtUserCurr,
                    amountUSD: transferAmtUSD,
                    exchangeRate: rate,
                    description: `Transferred ${transferAmtUserCurr.toFixed(2)} ${userCurr} ($${transferAmtUSD.toFixed(2)} USD) from Investment Wallet to Task Wallet`,
                    status: 'Approved',
                    date: new Date().toISOString()
                }
            });

            const updatedTaskWalletUSD = updatedUser.taskWalletBalance || 0;
            const requiredUSD = insufficientFundsModal?.requiredAmountUSD || grandTotalUSD;

            if (updatedTaskWalletUSD >= requiredUSD) {
                // Change modal into "Campaign Funding Complete" view
                setInsufficientFundsModal({
                    isOpen: true,
                    requiredAmountUSD: requiredUSD,
                    requiredAmountUserCurr: insufficientFundsModal?.requiredAmountUserCurr || Number((requiredUSD * rate).toFixed(2)),
                    availableTaskWalletUSD: updatedTaskWalletUSD,
                    availableInvestmentUserCurr: updatedUser.walletBalance || 0,
                    availableInvestmentUSD: Number(((updatedUser.walletBalance || 0) / rate).toFixed(2)),
                    userCurrency: userCurr,
                    shortfallUSD: 0,
                    shortfallUserCurr: 0,
                    fundingCompleted: true,
                    lastTransferredUserCurr: res.transferredUserCurr,
                    lastTransferredUSD: res.transferredUSD
                });
            } else {
                // Refresh modal with updated balances and recalculated shortfall
                const newShortfallUSD = Number((requiredUSD - updatedTaskWalletUSD).toFixed(2));
                const newShortfallUserCurr = Number((newShortfallUSD * rate).toFixed(2));
                setInsufficientFundsModal({
                    isOpen: true,
                    requiredAmountUSD: requiredUSD,
                    requiredAmountUserCurr: insufficientFundsModal?.requiredAmountUserCurr || Number((requiredUSD * rate).toFixed(2)),
                    availableTaskWalletUSD: updatedTaskWalletUSD,
                    availableInvestmentUserCurr: updatedUser.walletBalance || 0,
                    availableInvestmentUSD: Number(((updatedUser.walletBalance || 0) / rate).toFixed(2)),
                    userCurrency: userCurr,
                    shortfallUSD: newShortfallUSD,
                    shortfallUserCurr: newShortfallUserCurr,
                    fundingCompleted: false
                });
                setManualTransferAmount(newShortfallUserCurr);
            }

        } catch (error) {
            alert(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsTransferringFundsModal(false);
        }
    };

    const handleTransferTaskEarningsToTaskWallet = async (amountUSDVal?: number) => {
        if (!currentUser || isTransferringFundsModal) return;
        setIsTransferringFundsModal(true);
        try {
            const userCurr = currentUser.currency || 'USD';
            const rate = rates[userCurr] || 1;
            let transferAmtUSD = amountUSDVal ?? (manualTransferAmount > 0 ? Number((manualTransferAmount / rate).toFixed(2)) : insufficientFundsModal?.shortfallUSD || 0);

            if (isNaN(transferAmtUSD) || transferAmtUSD <= 0) {
                alert('Please enter a valid amount to transfer.');
                setIsTransferringFundsModal(false);
                return;
            }

            const currentTaskEarnings = netAvailableTaskEarningsUSD;
            if (currentTaskEarnings < transferAmtUSD) {
                alert(`Insufficient Task Earnings. Available: $${currentTaskEarnings.toFixed(2)} USD, Requested: $${transferAmtUSD.toFixed(2)} USD.`);
                setIsTransferringFundsModal(false);
                return;
            }

            const res = await transferTaskEarningsToCampaignWallet({
                userId: currentUser._id,
                amountUSD: transferAmtUSD
            });

            const updatedUser = res.user;
            const transferAmtUserCurr = Number((transferAmtUSD * rate).toFixed(2));
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            if (res.transaction) {
                dispatch({ type: 'ADD_TRANSACTION', payload: res.transaction });
            }

            const updatedTaskWalletUSD = updatedUser.taskWalletBalance || 0;
            const requiredUSD = insufficientFundsModal?.requiredAmountUSD || grandTotalUSD;

            if (updatedTaskWalletUSD >= requiredUSD) {
                setInsufficientFundsModal({
                    isOpen: true,
                    requiredAmountUSD: requiredUSD,
                    requiredAmountUserCurr: insufficientFundsModal?.requiredAmountUserCurr || Number((requiredUSD * rate).toFixed(2)),
                    availableTaskWalletUSD: updatedTaskWalletUSD,
                    availableInvestmentUserCurr: updatedUser.walletBalance || 0,
                    availableInvestmentUSD: Number(((updatedUser.walletBalance || 0) / rate).toFixed(2)),
                    availableTaskEarningsUSD: updatedUser.taskEarningsBalance || 0,
                    userCurrency: userCurr,
                    shortfallUSD: 0,
                    shortfallUserCurr: 0,
                    fundingCompleted: true,
                    lastTransferredUserCurr: transferAmtUserCurr,
                    lastTransferredUSD: transferAmtUSD
                });
            } else {
                const newShortfallUSD = Number((requiredUSD - updatedTaskWalletUSD).toFixed(2));
                const newShortfallUserCurr = Number((newShortfallUSD * rate).toFixed(2));
                setInsufficientFundsModal({
                    isOpen: true,
                    requiredAmountUSD: requiredUSD,
                    requiredAmountUserCurr: insufficientFundsModal?.requiredAmountUserCurr || Number((requiredUSD * rate).toFixed(2)),
                    availableTaskWalletUSD: updatedTaskWalletUSD,
                    availableInvestmentUserCurr: updatedUser.walletBalance || 0,
                    availableInvestmentUSD: Number(((updatedUser.walletBalance || 0) / rate).toFixed(2)),
                    availableTaskEarningsUSD: updatedUser.taskEarningsBalance || 0,
                    userCurrency: userCurr,
                    shortfallUSD: newShortfallUSD,
                    shortfallUserCurr: newShortfallUserCurr,
                    fundingCompleted: false
                });
                setManualTransferAmount(newShortfallUserCurr);
            }
        } catch (error) {
            alert(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsTransferringFundsModal(false);
        }
    };

    const handleLaunchCampaignFromModal = async () => {
        if (isSubmitting) return;
        const transferredUserCurr = insufficientFundsModal?.lastTransferredUserCurr || 0;
        const transferredUSD = insufficientFundsModal?.lastTransferredUSD || 0;
        
        setInsufficientFundsModal(null);

        const legacyRequireTextProof = requiredProofsList.some(p => p.type === 'text');
        const legacyTextProofInstruction = requiredProofsList.filter(p => p.type === 'text').map(p => p.instruction).join(' | ') || '';
        const legacyRequireUsername = requiredProofsList.some(p => p.type === 'username');
        const legacyUsernameInstruction = requiredProofsList.filter(p => p.type === 'username').map(p => p.instruction).join(' | ') || '';
        const legacyRequireUserId = requiredProofsList.some(p => p.type === 'userId');
        const legacyUserIdInstruction = requiredProofsList.filter(p => p.type === 'userId').map(p => p.instruction).join(' | ') || '';
        const legacyRequireEmail = requiredProofsList.some(p => p.type === 'email');
        const legacyEmailInstruction = requiredProofsList.filter(p => p.type === 'email').map(p => p.instruction).join(' | ') || '';
        const legacyRequireScreenshot = requiredProofsList.some(p => p.type === 'screenshot');
        const legacyScreenshotInstruction = requiredProofsList.filter(p => p.type === 'screenshot').map(p => p.instruction).join(' | ') || '';

        await executeTaskCreation(
            undefined, legacyRequireTextProof, legacyTextProofInstruction,
            legacyRequireUsername, legacyUsernameInstruction,
            legacyRequireUserId, legacyUserIdInstruction,
            legacyRequireEmail, legacyEmailInstruction,
            legacyRequireScreenshot, legacyScreenshotInstruction,
            transferredUserCurr, transferredUSD
        );
    };

    const handleTransferAndLaunchCampaign = async () => {
        if (!currentUser || isSubmitting || isTransferringFundsModal || !insufficientFundsModal) return;

        setIsTransferringFundsModal(true);
        try {
            const userCurr = currentUser.currency || 'USD';
            const rate = rates[userCurr] || 1;
            const shortfallUSD = insufficientFundsModal.shortfallUSD;

            const currentTaskEarnings = netAvailableTaskEarningsUSD;
            const currentInvestmentUserCurr = (currentUser.investmentBalance !== undefined && currentUser.investmentBalance !== null && currentUser.investmentBalance > 0)
                ? currentUser.investmentBalance
                : (currentUser.walletBalance || 0);
            const currentInvestmentUSD = Number((currentInvestmentUserCurr / rate).toFixed(2));

            let taskEarningsTransferUSD = 0;
            let investmentTransferUserCurr = 0;
            let investmentTransferUSD = 0;

            if (fundingSource === 'task_earnings') {
                if (currentTaskEarnings >= shortfallUSD) {
                    taskEarningsTransferUSD = shortfallUSD;
                } else {
                    taskEarningsTransferUSD = currentTaskEarnings;
                    const remainingUSD = Number((shortfallUSD - currentTaskEarnings).toFixed(2));
                    investmentTransferUserCurr = Number((remainingUSD * rate).toFixed(2));
                    investmentTransferUSD = remainingUSD;
                }
            } else if (fundingSource === 'investment') {
                if (currentInvestmentUSD >= shortfallUSD) {
                    investmentTransferUserCurr = Number((shortfallUSD * rate).toFixed(2));
                    investmentTransferUSD = shortfallUSD;
                } else {
                    investmentTransferUserCurr = currentInvestmentUserCurr;
                    investmentTransferUSD = currentInvestmentUSD;
                    const remainingUSD = Number((shortfallUSD - currentInvestmentUSD).toFixed(2));
                    taskEarningsTransferUSD = Math.min(currentTaskEarnings, remainingUSD);
                }
            } else {
                // Combined mode
                taskEarningsTransferUSD = Math.min(currentTaskEarnings, shortfallUSD);
                const remainingUSD = Math.max(0, Number((shortfallUSD - taskEarningsTransferUSD).toFixed(2)));
                investmentTransferUserCurr = Number((remainingUSD * rate).toFixed(2));
                investmentTransferUSD = remainingUSD;
            }

            const totalProvidedUSD = taskEarningsTransferUSD + investmentTransferUSD;
            if (totalProvidedUSD < shortfallUSD - 0.01) {
                alert(`Your combined available funds ($${(currentTaskEarnings + currentInvestmentUSD).toFixed(2)} USD) are insufficient for the shortfall of $${shortfallUSD.toFixed(2)} USD. Please deposit funds into your Investment Wallet.`);
                setIsTransferringFundsModal(false);
                return;
            }

            let updatedUser = { ...currentUser };

            // 1. Process Task Earnings Transfer if any
            if (taskEarningsTransferUSD > 0) {
                const resTE = await transferTaskEarningsToCampaignWallet({
                    userId: currentUser._id,
                    amountUSD: taskEarningsTransferUSD
                });
                updatedUser = resTE.user;
                if (resTE.transaction) {
                    dispatch({ type: 'ADD_TRANSACTION', payload: resTE.transaction });
                }
            }

            // 2. Process Investment Wallet Transfer if any
            if (investmentTransferUserCurr > 0) {
                const resInv = await transferWalletToCampaign({
                    userId: currentUser._id,
                    amountUserCurr: investmentTransferUserCurr,
                    amountUSD: investmentTransferUSD,
                    sourceWallet: 'Investment'
                });
                updatedUser = resInv.user;
                if (resInv.transaction) {
                    dispatch({ type: 'ADD_TRANSACTION', payload: resInv.transaction });
                }
            }

            dispatch({ type: 'UPDATE_USER', payload: updatedUser });

            // Close insufficient funds modal
            setInsufficientFundsModal(null);

            // Execute Campaign Creation
            const legacyRequireTextProof = requiredProofsList.some(p => p.type === 'text');
            const legacyTextProofInstruction = requiredProofsList.filter(p => p.type === 'text').map(p => p.instruction).join(' | ') || '';
            const legacyRequireUsername = requiredProofsList.some(p => p.type === 'username');
            const legacyUsernameInstruction = requiredProofsList.filter(p => p.type === 'username').map(p => p.instruction).join(' | ') || '';
            const legacyRequireUserId = requiredProofsList.some(p => p.type === 'userId');
            const legacyUserIdInstruction = requiredProofsList.filter(p => p.type === 'userId').map(p => p.instruction).join(' | ') || '';
            const legacyRequireEmail = requiredProofsList.some(p => p.type === 'email');
            const legacyEmailInstruction = requiredProofsList.filter(p => p.type === 'email').map(p => p.instruction).join(' | ') || '';
            const legacyRequireScreenshot = requiredProofsList.some(p => p.type === 'screenshot');
            const legacyScreenshotInstruction = requiredProofsList.filter(p => p.type === 'screenshot').map(p => p.instruction).join(' | ') || '';

            await executeTaskCreation(
                undefined, legacyRequireTextProof, legacyTextProofInstruction,
                legacyRequireUsername, legacyUsernameInstruction,
                legacyRequireUserId, legacyUserIdInstruction,
                legacyRequireEmail, legacyEmailInstruction,
                legacyRequireScreenshot, legacyScreenshotInstruction,
                investmentTransferUserCurr, (taskEarningsTransferUSD + investmentTransferUSD)
            );

        } catch (error) {
            alert(`Transfer and Launch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsTransferringFundsModal(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/') || /\.(heic|heif|webp|png|jpe?g|gif|bmp|tiff?)$/i.test(file.name);
        if (!isImage) {
            alert('Please select a valid image file (PNG, JPG, WEBP, GIF, BMP, HEIC, etc.).');
            e.target.value = '';
            return;
        }
        const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1000;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setProofImage(dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleDisputeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/') || /\.(heic|heif|webp|png|jpe?g|gif|bmp|tiff?)$/i.test(file.name);
        if (!isImage) {
            alert('Please select a valid image file (PNG, JPG, WEBP, GIF, BMP, HEIC, etc.).');
            e.target.value = '';
            return;
        }
        const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1000;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setDisputeProofImage(dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleDynamicImageUpload = (proofId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/') || /\.(heic|heif|webp|png|jpe?g|gif|bmp|tiff?)$/i.test(file.name);
        if (!isImage) {
            alert('Please select a valid image file (PNG, JPG, WEBP, GIF, BMP, HEIC, etc.).');
            e.target.value = '';
            return;
        }
        const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1000;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setSubmittedProofsValues(prev => ({ ...prev, [proofId]: dataUrl }));
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];
    const allowedCurrency = currentUser.currency || (currentUser.country === 'Pakistan' ? 'PKR' : europeanCountries.includes(currentUser.country) ? 'EUR' : 'USD');

    // Currency Converter State
    const [convertAmount, setConvertAmount] = useState<number>(10);
    const [fromCurrency] = useState<string>('USD');
    const [toCurrency, setToCurrency] = useState<string>(allowedCurrency);
    const [conversionResult, setConversionResult] = useState<any>(null);
    const [isConverting, setIsConverting] = useState(false);

    if (!currentUser) return null;

    const config = settings?.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10, campaignFeeEnabled: false, campaignFeeAmount: 1.00 };
    const isEnabled = settings?.isUserTaskEnabled ?? true;

    // Entire setup in USD for tasks
    const safeTargetQty = typeof targetQuantity === 'number' ? targetQuantity : (targetQuantity === '' || targetQuantity === undefined || targetQuantity === null ? 0 : Number(targetQuantity));
    const safeRewardPerTask = typeof rewardPerTask === 'number' ? rewardPerTask : (rewardPerTask === '' || rewardPerTask === undefined || rewardPerTask === null ? 0 : Number(rewardPerTask));
    const subtotal = (isNaN(safeTargetQty) ? 0 : safeTargetQty) * (isNaN(safeRewardPerTask) ? 0 : safeRewardPerTask); // in USD
    const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
    const totalBudgetUSD = Number((subtotal + adminCommission).toFixed(2));
    const campaignFeeUSD = config.campaignFeeEnabled ? (config.campaignFeeAmount || 0) : 0;
    const grandTotalUSD = Number((totalBudgetUSD + campaignFeeUSD).toFixed(2));

    const DEFAULT_PRESETS = {
        youtube: {
            subscriber: { minPayout: 0.02, minSlots: 50 },
            comments: { minPayout: 0.04, minSlots: 10 },
            likes: { minPayout: 0.01, minSlots: 10 },
            watchTimeTiers: [
                { duration: '5 Seconds', minPayout: 0.005, minSlots: 100 },
                { duration: '10 Seconds', minPayout: 0.010, minSlots: 100 },
                { duration: '15 Seconds', minPayout: 0.015, minSlots: 100 },
                { duration: '30 Seconds', minPayout: 0.020, minSlots: 50 },
                { duration: '1 Minute', minPayout: 0.040, minSlots: 50 },
                { duration: '5 Minutes', minPayout: 0.150, minSlots: 20 },
            ]
        },
        facebook: {
            likeFollow: { minPayout: 0.02, minSlots: 50 },
            videoLike: { minPayout: 0.01, minSlots: 50 },
            comments: { minPayout: 0.03, minSlots: 10 },
            watchTimeTiers: [
                { duration: '30 Seconds', minPayout: 0.01, minSlots: 100 },
                { duration: '1 Minute', minPayout: 0.02, minSlots: 50 },
                { duration: '3 Minutes', minPayout: 0.05, minSlots: 50 },
            ]
        },
        instagram: {
            profileFollow: { minPayout: 0.015, minSlots: 50 },
            postLike: { minPayout: 0.008, minSlots: 100 },
            reelView: { minPayout: 0.005, minSlots: 100 },
            comments: { minPayout: 0.03, minSlots: 10 },
        },
        google: {
            reviews: { minPayout: 0.20, minSlots: 5 }
        },
        paidSignUp: {
            simpleSignUp: { minPayout: 0.10, minSlots: 10 },
            activePlanPurchase: { minPayout: 0.50, minSlots: 5 }
        }
    };

    const presets = settings?.taskCategoryPresets || DEFAULT_PRESETS;

    // Get list of all categories from database presets
    const availableCategories = Object.keys(presets).map(key => {
        const cat = presets[key];
        const displayName = cat.displayName || (
            key === 'youtube' ? 'YouTube' :
            key === 'facebook' ? 'Facebook' :
            key === 'instagram' ? 'Instagram' :
            key === 'google' ? 'Google' :
            key === 'paidSignUp' ? 'Website' :
            key.charAt(0).toUpperCase() + key.slice(1)
        );
        return { key, displayName };
    });

    // Append "Other" catch-all if not present
    if (!availableCategories.some(c => c.key === 'other')) {
        availableCategories.push({ key: 'other', displayName: 'Other' });
    }

    // Find the preset key matching the selected category
    const activePresetKey = Object.keys(presets).find(k => 
        k.toLowerCase() === category.toLowerCase() || 
        (presets[k]?.displayName && presets[k].displayName.toLowerCase() === category.toLowerCase())
    ) || 'youtube';
    
    const activeCategoryConfig = presets[activePresetKey];
    const activeWatchTimeTiers = (activeCategoryConfig?.watchTimeTiers || []).filter((tier: any) => tier.enabled !== false);

    // Get subType options dynamically for this category
    const availableSubTypes = Object.keys(activeCategoryConfig || {}).filter(k => {
        if (k === 'enabled' || k === 'displayName' || k === 'watchTimeTiers') return false;
        return typeof activeCategoryConfig[k] === 'object' && activeCategoryConfig[k] !== null;
    }).map(subKey => {
        const subConf = activeCategoryConfig[subKey];
        const displayName = subConf?.displayName || (
            subKey === 'subscriber' ? 'Subscribe' :
            subKey === 'likes' ? 'Like' :
            subKey === 'comments' ? 'Comment' :
            subKey === 'likeFollow' ? 'Follow' :
            subKey === 'videoLike' ? 'Like' :
            subKey === 'profileFollow' ? 'Follow' :
            subKey === 'postLike' ? 'Like' :
            subKey === 'reelView' ? 'Watch Time' :
            subKey === 'reviews' ? 'Review' :
            subKey === 'simpleSignUp' ? 'Sign-up' :
            subKey === 'activePlanPurchase' ? 'Other' :
            subKey.charAt(0).toUpperCase() + subKey.slice(1)
        );
        return { key: subKey, displayName };
    });

    // If watchTimeTiers exists, add "Watch Time" option
    const hasWatchTimeTiers = activeCategoryConfig?.watchTimeTiers && Array.isArray(activeCategoryConfig.watchTimeTiers);
    if (hasWatchTimeTiers && !availableSubTypes.some(s => s.displayName === 'Watch Time')) {
        availableSubTypes.push({ key: 'watchTimeTiers', displayName: 'Watch Time' });
    }

    // Append "Other" catch-all subtype if not present
    if (!availableSubTypes.some(s => s.key === 'other')) {
        availableSubTypes.push({ key: 'other', displayName: 'Other' });
    }

    const getSelectionLimits = () => {
        let minPayout = config.minRewardAmount;
        let minSlots = config.minQuantity;
        let isPresetFound = false;
        let presetName = '';

        if (activeCategoryConfig) {
            // Find if there is a matching subcategory based on selected subType displayName or subKey
            const subKey = Object.keys(activeCategoryConfig).find(k => {
                if (k === 'enabled' || k === 'displayName') return false;
                if (k === 'watchTimeTiers') {
                    return subType === 'Watch Time';
                }
                const subConf = activeCategoryConfig[k];
                const subDisp = subConf?.displayName || k;
                return k.toLowerCase() === subType.toLowerCase() || subDisp.toLowerCase() === subType.toLowerCase() ||
                    (k === 'subscriber' && subType === 'Subscribe') ||
                    (k === 'likes' && subType === 'Like') ||
                    (k === 'comments' && subType === 'Comment') ||
                    (k === 'likeFollow' && subType === 'Follow') ||
                    (k === 'videoLike' && subType === 'Like') ||
                    (k === 'profileFollow' && subType === 'Follow') ||
                    (k === 'postLike' && subType === 'Like') ||
                    (k === 'reelView' && subType === 'Watch Time') ||
                    (k === 'reviews' && subType === 'Review') ||
                    (k === 'simpleSignUp' && subType === 'Sign-up') ||
                    (k === 'activePlanPurchase' && subType === 'Other');
            });

            if (subKey === 'watchTimeTiers') {
                const tiers = activeCategoryConfig.watchTimeTiers || [];
                const selectedTier = tiers[watchTimeTierIndex] || tiers[0];
                if (selectedTier) {
                    minPayout = selectedTier.minPayout;
                    minSlots = selectedTier.minSlots;
                    presetName = `${category} Watch Time (${selectedTier.duration})`;
                    isPresetFound = true;
                }
            } else if (subKey) {
                const subConfig = activeCategoryConfig[subKey];
                minPayout = subConfig.minPayout ?? config.minRewardAmount;
                minSlots = subConfig.minSlots ?? config.minQuantity;
                presetName = `${category} ${subConfig.displayName || subKey.charAt(0).toUpperCase() + subKey.slice(1)}`;
                isPresetFound = true;
            }
        }

        return { minPayout, minSlots, isPresetFound, presetName };
    };

    useEffect(() => {
        const { minPayout, minSlots } = getSelectionLimits();
        setTargetQuantity(minSlots);
        setRewardPerTask(minPayout);
    }, [category, subType, watchTimeTierIndex, settings]);

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});

        if (!isEnabled) {
            setValidationNoticeModal({
                isOpen: true,
                title: 'Task Submissions Disabled',
                messages: ['• User task submissions are currently disabled by the administrator.'],
            });
            return;
        }

        const errors: {
            title?: string;
            link?: string;
            targetQuantity?: string;
            rewardPerTask?: string;
            proofs?: string;
            proofInstructions?: Record<string, string>;
        } = {};
        const errorMessages: string[] = [];
        let firstErrorFieldId = '';

        // Validate Campaign Title
        if (!title || !title.trim()) {
            errors.title = 'Campaign Title is required.';
            errorMessages.push('• Campaign Title is missing.');
            if (!firstErrorFieldId) firstErrorFieldId = 'campaign-title-field';
        }

        // Validate Target Link
        if (!link || !link.trim()) {
            errors.link = 'Target Link / URL is required.';
            errorMessages.push('• Target Link / URL is missing.');
            if (!firstErrorFieldId) firstErrorFieldId = 'campaign-link-field';
        } else {
            const urlPattern = /^(https?:\/\/)?([\w.-]+)+[\w\-_~:/?#[\]@!$&'()*+,;=.]+$/i;
            if (!urlPattern.test(link.trim())) {
                errors.link = 'Target Link / URL must be a valid web address (e.g. https://example.com).';
                errorMessages.push('• Target Link / URL format is invalid.');
                if (!firstErrorFieldId) firstErrorFieldId = 'campaign-link-field';
            }
        }

        const { minPayout, minSlots, presetName } = getSelectionLimits();

        // Validate Target Quantity
        const submittedQty = targetQuantity === '' || targetQuantity === undefined || targetQuantity === null ? 0 : Number(targetQuantity);
        if (isNaN(submittedQty) || submittedQty < minSlots) {
            errors.targetQuantity = `Target quantity (${submittedQty}) is below required minimum of ${minSlots} slots for ${presetName || 'this campaign'}.`;
            errorMessages.push(`• Target quantity (${submittedQty} slots) is below required minimum of ${minSlots} slots.`);
            if (!firstErrorFieldId) firstErrorFieldId = 'campaign-quantity-field';
        }

        // Validate Reward Per Task
        const submittedReward = rewardPerTask === '' || rewardPerTask === undefined || rewardPerTask === null ? 0 : Number(rewardPerTask);
        if (isNaN(submittedReward) || submittedReward < minPayout) {
            errors.rewardPerTask = `Reward per task ($${submittedReward < 0 ? 0 : submittedReward.toFixed(3)}) is below required minimum of $${minPayout.toFixed(3)} USD for ${presetName || 'this campaign'}.`;
            errorMessages.push(`• Reward per task ($${submittedReward < 0 ? '0.000' : submittedReward.toFixed(3)} USD) is below required minimum of $${minPayout.toFixed(3)} USD.`);
            if (!firstErrorFieldId) firstErrorFieldId = 'campaign-reward-field';
        }

        // Validate Required Proofs (Module A)
        if (requiredProofsList.length === 0) {
            errors.proofs = 'Please configure at least one required proof requirement (Module A).';
            errorMessages.push('• No required proof criteria configured (Module A). Please add at least one proof requirement.');
            if (!firstErrorFieldId) firstErrorFieldId = 'campaign-proofs-container';
        } else {
            const proofInstErrors: Record<string, string> = {};
            requiredProofsList.forEach((item) => {
                if (!item.instruction || !item.instruction.trim()) {
                    proofInstErrors[item.id] = `Instruction is required for proof criterion: "${item.label}".`;
                    errorMessages.push(`• Instruction missing for proof criterion: "${item.label}".`);
                    if (!firstErrorFieldId) firstErrorFieldId = `proof-instruction-${item.id}`;
                }
            });
            if (Object.keys(proofInstErrors).length > 0) {
                errors.proofInstructions = proofInstErrors;
            }
        }

        if (errorMessages.length > 0) {
            setFieldErrors(errors);
            setValidationNoticeModal({
                isOpen: true,
                title: 'Campaign Form Validation Notice',
                messages: errorMessages,
                firstErrorFieldId
            });

            if (firstErrorFieldId) {
                setTimeout(() => {
                    const el = document.getElementById(firstErrorFieldId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const inputEl = el.querySelector('input, textarea, select') || el;
                        if ('focus' in inputEl && typeof inputEl.focus === 'function') {
                            (inputEl as HTMLElement).focus();
                        }
                    }
                }, 100);
            }
            return;
        }

        let finalTitle = title;
        if (subType === 'Watch Time') {
            const tiers = activeCategoryConfig?.watchTimeTiers || [];
            const selectedTier = tiers[watchTimeTierIndex] || tiers[0];
            if (selectedTier && !title.includes(selectedTier.duration)) {
                finalTitle = `${title} (${selectedTier.duration} Watch Time)`;
            }
        }

        const legacyRequireTextProof = requiredProofsList.some(p => p.type === 'text' || p.type === 'manual');
        const legacyTextProofInstruction = requiredProofsList.filter(p => p.type === 'text' || p.type === 'manual').map(p => p.instruction).join(' | ') || '';

        const legacyRequireUsername = requiredProofsList.some(p => p.type === 'username');
        const legacyUsernameInstruction = requiredProofsList.filter(p => p.type === 'username').map(p => p.instruction).join(' | ') || '';

        const legacyRequireUserId = requiredProofsList.some(p => p.type === 'userId');
        const legacyUserIdInstruction = requiredProofsList.filter(p => p.type === 'userId').map(p => p.instruction).join(' | ') || '';

        const legacyRequireEmail = requiredProofsList.some(p => p.type === 'email');
        const legacyEmailInstruction = requiredProofsList.filter(p => p.type === 'email').map(p => p.instruction).join(' | ') || '';

        const legacyRequireScreenshot = requiredProofsList.some(p => p.type === 'screenshot');
        const legacyScreenshotInstruction = requiredProofsList.filter(p => p.type === 'screenshot').map(p => p.instruction).join(' | ') || '';

        // Check if Task Wallet has sufficient funds in USD
        const userCurr = currentUser.currency || 'USD';
        const rate = rates[userCurr] || 1;
        let budgetInUserCurr = Number((grandTotalUSD * rate).toFixed(2));
        const campaignWalletUSD = availableCampaignWalletUSD;

        if (campaignWalletUSD < grandTotalUSD) {
            const shortfallUSD = Number((grandTotalUSD - campaignWalletUSD).toFixed(2));
            const shortfallUserCurr = Number((shortfallUSD * rate).toFixed(2));
            const availableInvestmentUserCurr = (currentUser.investmentBalance !== undefined && currentUser.investmentBalance !== null && currentUser.investmentBalance > 0)
                ? currentUser.investmentBalance
                : (currentUser.walletBalance || 0);
            const availableInvestmentUSD = Number((availableInvestmentUserCurr / rate).toFixed(2));

            setManualTransferAmount(shortfallUserCurr);
            setInsufficientFundsModal({
                isOpen: true,
                requiredAmountUSD: grandTotalUSD,
                requiredAmountUserCurr: budgetInUserCurr,
                availableTaskWalletUSD: campaignWalletUSD,
                availableInvestmentUserCurr: availableInvestmentUserCurr,
                availableInvestmentUSD: availableInvestmentUSD,
                availableTaskEarningsUSD: netAvailableTaskEarningsUSD,
                userCurrency: userCurr,
                shortfallUSD: shortfallUSD,
                shortfallUserCurr: shortfallUserCurr
            });
            return;
        }

        await executeTaskCreation(finalTitle, legacyRequireTextProof, legacyTextProofInstruction, legacyRequireUsername, legacyUsernameInstruction, legacyRequireUserId, legacyUserIdInstruction, legacyRequireEmail, legacyEmailInstruction, legacyRequireScreenshot, legacyScreenshotInstruction);
    };

    const executeTaskCreation = async (
        finalTitleArg?: string,
        requireTextProofArg?: boolean,
        textProofInstructionArg?: string,
        requireUsernameArg?: boolean,
        usernameInstructionArg?: string,
        requireUserIdArg?: boolean,
        userIdInstructionArg?: string,
        requireEmailArg?: boolean,
        emailInstructionArg?: string,
        requireScreenshotArg?: boolean,
        screenshotInstructionArg?: string,
        transferredUserCurrArg?: number,
        transferredUSDArg?: number
    ) => {
        if (!currentUser) return;

        const pTitle = finalTitleArg || (title.trim() ? title.trim() : `${category} - ${subType}`);
        const pReqText = requireTextProofArg !== undefined ? requireTextProofArg : requiredProofsList.some(p => p.type === 'text');
        const pTextInst = textProofInstructionArg !== undefined ? textProofInstructionArg : requiredProofsList.filter(p => p.type === 'text').map(p => p.instruction).join(' | ') || '';
        const pReqUser = requireUsernameArg !== undefined ? requireUsernameArg : requiredProofsList.some(p => p.type === 'username');
        const pUserInst = usernameInstructionArg !== undefined ? usernameInstructionArg : requiredProofsList.filter(p => p.type === 'username').map(p => p.instruction).join(' | ') || '';
        const pReqUid = requireUserIdArg !== undefined ? requireUserIdArg : requiredProofsList.some(p => p.type === 'userId');
        const pUidInst = userIdInstructionArg !== undefined ? userIdInstructionArg : requiredProofsList.filter(p => p.type === 'userId').map(p => p.instruction).join(' | ') || '';
        const pReqEmail = requireEmailArg !== undefined ? requireEmailArg : requiredProofsList.some(p => p.type === 'email');
        const pEmailInst = emailInstructionArg !== undefined ? emailInstructionArg : requiredProofsList.filter(p => p.type === 'email').map(p => p.instruction).join(' | ') || '';
        const pReqShot = requireScreenshotArg !== undefined ? requireScreenshotArg : requiredProofsList.some(p => p.type === 'screenshot');
        const pShotInst = screenshotInstructionArg !== undefined ? screenshotInstructionArg : requiredProofsList.filter(p => p.type === 'screenshot').map(p => p.instruction).join(' | ') || '';

        setIsSubmitting(true);
        try {
            const result = await createUserTask({
                userId: currentUser._id,
                category,
                subType,
                title: pTitle,
                description,
                link,
                targetQuantity: Number(targetQuantity),
                rewardPerTask: Number(rewardPerTask), // in USD
                requireTextProof: pReqText,
                textProofInstruction: pTextInst,
                requireUsername: pReqUser,
                usernameInstruction: pUserInst,
                requireUserId: pReqUid,
                userIdInstruction: pUidInst,
                requireEmail: pReqEmail,
                emailInstruction: pEmailInst,
                requireScreenshot: pReqShot,
                screenshotInstruction: pShotInst,
                requiredProofs: requiredProofsList
            });
            dispatch({ type: 'ADD_USER_TASK', payload: result.task });
            dispatch({ type: 'UPDATE_USER', payload: result.user });

            // Trigger non-financial GA4 campaign_created event (Phase P20-A)
            seoAnalytics.trackCampaignCreated(result.task?.category || category);

            // Dispatch transaction so history tracks campaign creation immediately
            const userCurr = currentUser.currency || 'USD';
            const rate = rates[userCurr] || 1;
            dispatch({
                type: 'ADD_TRANSACTION',
                payload: {
                    _id: 'trx_camp_' + Date.now(),
                    userId: currentUser._id,
                    userName: currentUser.username || currentUser.fullName,
                    currency: 'USD',
                    type: 'Campaign Creation',
                    amount: -(result.task.totalBudget || grandTotalUSD),
                    exchangeRate: rate,
                    description: `Created Campaign: ${result.task.title} (${result.task.targetQuantity} slots @ $${(Number(result.task.rewardPerTask) || 0).toFixed(2)}/task)`,
                    status: 'Approved',
                    date: new Date().toISOString()
                }
            });

            // Clear form
            setTitle('');
            setDescription('');
            setLink('');

            // Show success modal with OK button
            setFundingSuccessModal({
                isOpen: true,
                transferredUserCurr: transferredUserCurrArg || 0,
                transferredUSD: transferredUSDArg || 0,
                userCurrency: userCurr,
                newTaskWalletUSD: result.user.taskWalletBalance || 0
            });
        } catch (error) {
            alert(`Failed to launch campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProofSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTaskForProof) return;

        if (!proofAgreed) {
            return alert("WARNING: If you submit incorrect proof or do not complete the task properly, your account may be banned and your balance may be deducted. Please check the warning confirmation agreement checkbox to proceed.");
        }

        const proofsToSubmit: Array<{ id: string; type: string; label: string; value: string }> = [];
        let finalProofText = proofText;
        let finalProofUsername = proofUsername;
        let finalProofUserIdVal = proofUserIdVal;
        let finalProofEmail = proofEmail;
        let finalProofImage = proofImage;

        if (selectedTaskForProof.requiredProofs && Array.isArray(selectedTaskForProof.requiredProofs) && selectedTaskForProof.requiredProofs.length > 0) {
            for (const req of selectedTaskForProof.requiredProofs) {
                const val = (submittedProofsValues[req.id] || '').trim();
                if (!val) {
                    return alert(`Please provide required proof: "${req.label}"\nInstruction: ${req.instruction}`);
                }
                proofsToSubmit.push({
                    id: req.id,
                    type: req.type,
                    label: req.label,
                    value: val
                });
            }

            // Populate legacy fields with first occurrence for backwards compatibility
            const firstText = proofsToSubmit.find(p => p.type === 'text' || p.type === 'manual')?.value;
            const firstUsername = proofsToSubmit.find(p => p.type === 'username')?.value;
            const firstUserId = proofsToSubmit.find(p => p.type === 'userId')?.value;
            const firstEmail = proofsToSubmit.find(p => p.type === 'email')?.value;
            const firstScreenshot = proofsToSubmit.find(p => p.type === 'screenshot')?.value;

            if (firstText) finalProofText = firstText;
            if (firstUsername) finalProofUsername = firstUsername;
            if (firstUserId) finalProofUserIdVal = firstUserId;
            if (firstEmail) finalProofEmail = firstEmail;
            if (firstScreenshot) finalProofImage = firstScreenshot;
        } else {
            if (selectedTaskForProof.requireTextProof && !proofText.trim()) return alert(selectedTaskForProof.textProofInstruction || 'Text proof is required.');
            if (selectedTaskForProof.requireUsername && !proofUsername.trim()) return alert(selectedTaskForProof.usernameInstruction || 'Username is required.');
            if (selectedTaskForProof.requireUserId && !proofUserIdVal.trim()) return alert(selectedTaskForProof.userIdInstruction || 'User ID is required.');
            if (selectedTaskForProof.requireEmail && !proofEmail.trim()) return alert(selectedTaskForProof.emailInstruction || 'Email is required.');
            if (selectedTaskForProof.requireScreenshot && !proofImage) return alert(selectedTaskForProof.screenshotInstruction || 'Screenshot image is required.');
            
            if (!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail && !selectedTaskForProof.requireScreenshot) {
                if (!proofText.trim() && !proofImage) return alert('Please provide proof text or screenshot.');
            }
        }

        setIsSubmittingProof(true);
        try {
            const submission = await submitUserTaskProof(selectedTaskForProof._id, {
                userId: currentUser._id,
                proofText: finalProofText,
                proofUsername: finalProofUsername,
                proofUserIdVal: finalProofUserIdVal,
                proofEmail: finalProofEmail,
                proofImage: finalProofImage,
                submittedProofs: proofsToSubmit
            });
            dispatch({ type: 'ADD_USER_TASK_SUBMISSION', payload: submission });
            
            // Trigger non-financial GA4 submit_task_proof event (Phase P20-A)
            seoAnalytics.trackSubmitTaskProof(selectedTaskForProof._id, selectedTaskForProof.category);

            alert('Proof submitted successfully! Awaiting campaign creator review for USD reward.');
            setSelectedTaskForProof(null);
            setProofText('');
            setProofUsername('');
            setProofUserIdVal('');
            setProofEmail('');
            setProofImage('');
            setSubmittedProofsValues({});
            setActiveTab('browse');
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingProof(false);
        }
    };

    const handleRunConversion = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = Number(convertAmount);
        if (isNaN(amt) || amt <= 0) {
            alert('Please enter a valid amount greater than 0.');
            return;
        }
        if ((currentUser.taskWalletBalance || 0) < amt) {
            alert('You do not have enough amount for conversion.');
            return;
        }
        setIsConverting(true);
        try {
            const res = await convertUserCurrency({
                userId: currentUser._id,
                amount: amt,
                fromCurrency,
                toCurrency
            });
            setConversionResult(res);
            if (res && res.user) {
                dispatch({ type: 'UPDATE_USER', payload: res.user });
            }
        } catch (error) {
            alert(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsConverting(false);
        }
    };

    const handleDisputeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubmissionForDispute) return;
        setIsSubmittingDispute(true);
        try {
            const formData = new FormData();
            formData.append('description', disputeDescription || `Dispute for task submission: ${selectedSubmissionForDispute.taskTitle}`);

            if (disputeProofImage) {
                if (disputeProofImage.startsWith('data:')) {
                    const arr = disputeProofImage.split(',');
                    const mimeMatch = arr[0].match(/:(.*?);/);
                    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], { type: mime });
                    formData.append('proof', blob, 'dispute_proof.jpg');
                } else {
                    formData.append('proofUrl', disputeProofImage);
                }
            }
            
            const dispute = await openTaskDispute(selectedSubmissionForDispute._id, formData);
            
            const isEscalation = selectedSubmissionForDispute.disputeStage === 'RejectedByCreator';
            const nextDisputeStage = isEscalation ? 'Escalated' : 'CreatorReview';

            // Dispatch locally so the UI updates without requiring page reload
            dispatch({
                type: 'UPDATE_USER_TASK_SUBMISSION',
                payload: {
                    ...selectedSubmissionForDispute,
                    status: 'Disputed',
                    disputeOpened: true,
                    disputeId: dispute._id,
                    disputeStage: nextDisputeStage,
                    disputeReason: disputeDescription,
                    disputeProofUrl: dispute?.proofUrl || disputeProofImage
                }
            });

            if (dispute) {
                dispatch({ type: 'ADD_DISPUTE', payload: dispute });
            }

            if (isEscalation) {
                alert('Dispute successfully escalated to the Admin! The Admin will review the chat and make a final decision.');
            } else {
                const disputeReviewDays = settings?.systemLimits?.disputeReviewTimeoutDays ?? 3;
                alert(`Dispute raised successfully! The creator has been notified and has ${disputeReviewDays} days to review it.`);
            }
            setSelectedSubmissionForDispute(null);
            setDisputeDescription('');
            setDisputeProofImage('');
        } catch (error) {
            alert(`Failed to submit dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const mySubmittedTasks = userTasks.filter(t => t.userId?.toString() === currentUser._id?.toString());
    const mySubmissions = userTaskSubmissions.filter(s => s.workerId?.toString() === currentUser._id?.toString());
    
    // Submissions made by workers for campaigns created by current user
    const campaignSubmissions = userTaskSubmissions.filter(s => 
        mySubmittedTasks.some(t => t._id?.toString() === s.taskId?.toString())
    );

    const getCampaignFin = (t: any) => {
        const subtotal = Number(((t?.targetQuantity || 1) * (t?.rewardPerTask || 0)).toFixed(2));
        const commissionPercent = settings?.userTaskConfig?.commissionPercent ?? 10;
        const adminCommission = Number(t?.adminCommission ?? (subtotal * (commissionPercent / 100)).toFixed(2));
        const slotsAndCommissionBudget = Number(t?.totalBudget ?? (subtotal + adminCommission).toFixed(2));
        const defaultCreationFee = settings?.userTaskConfig?.campaignFeeEnabled ? (settings?.userTaskConfig?.campaignFeeAmount || 0) : 0;
        const campaignCreationFee = Number((t?.baseFeeCharged ?? t?.campaignFeeUSD ?? t?.baseCampaignFee ?? defaultCreationFee).toFixed(2));
        const grandTotalLaunchCost = Number((slotsAndCommissionBudget + campaignCreationFee).toFixed(2));
        return {
            subtotal,
            adminCommission,
            slotsAndCommissionBudget,
            campaignCreationFee,
            grandTotalLaunchCost
        };
    };

    const taskWalletUSD = availableCampaignWalletUSD;
    const userCurr = currentUser?.currency || 'USD';
    const userCurrRate = rates[userCurr] || 1;

    const totalMySpent = mySubmittedTasks.reduce((acc, t) => acc + getCampaignFin(t).grandTotalLaunchCost, 0).toFixed(2);
    const campaignPurchasesUSD = Number(totalMySpent) || 0;

    const activeCampaignEscrowUSD = mySubmittedTasks
        .filter(t => t.status === 'Approved' || t.status === 'Active' || t.status === 'On Hold')
        .reduce((acc, t) => acc + getCampaignFin(t).grandTotalLaunchCost, 0);

    const totalCreationFeesUSD = mySubmittedTasks
        .reduce((acc, t) => acc + getCampaignFin(t).campaignCreationFee, 0);

    // Campaign Wallet calculations matching Work & Earn Hub Dashboard
    const totalHubDepositsBase = (state.deposits || [])
        .filter(d => d.userId?.toString() === userIdStr && (d.status === 'Approved' || d.status === 'Paid') && ((d as any).isHub || (d as any).isTaskWallet || d.userNotes?.toLowerCase().includes('hub') || d.userNotes?.toLowerCase().includes('task') || d.userNotes?.toLowerCase().includes('campaign')))
        .reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalHubDepositsUSD = totalHubDepositsBase / (exchangeRate || 1);

    const investmentTransferSumUSD = (state.transactions || []).reduce((sum, trx) => {
        if (trx.userId?.toString() !== userIdStr) return sum;
        if (trx.status === 'Rejected' || trx.status === 'Cancelled') return sum;

        const typeLower = (trx.type || '').toLowerCase();
        const descLower = (trx.description || '').toLowerCase();

        const isInvestmentToTask = 
            typeLower === 'investment to task wallet transfer' ||
            typeLower.includes('investment to task') ||
            typeLower.includes('investment to campaign') ||
            typeLower.includes('investment wallet') ||
            descLower.includes('from investment wallet') ||
            descLower.includes('from investment module') ||
            descLower.includes('investment to task') ||
            descLower.includes('investment to campaign') ||
            descLower.includes('investment wallet to task wallet') ||
            (typeLower.includes('transfer') && descLower.includes('investment') && (descLower.includes('task') || descLower.includes('work') || descLower.includes('campaign')));

        if (isInvestmentToTask) {
            const rawAmt = trx.amountUSD && Math.abs(trx.amountUSD) > 0
                ? Math.abs(trx.amountUSD)
                : Math.abs((trx.amount || 0) / (trx.exchangeRate || exchangeRate || 1));
            return sum + rawAmt;
        }
        return sum;
    }, 0);

    const depositAndInvestmentUSD = Number((investmentTransferSumUSD + totalHubDepositsUSD).toFixed(2));

    // 2. Transfer from Task Earnings to Campaign Wallet
    const fundsUsedForCampaignUSD = (state.transactions || []).reduce((sum, t) => {
        if (t.userId?.toString() !== userIdStr) return sum;
        if (t.status === 'Rejected' || t.status === 'Cancelled') return sum;

        const typeLower = (t.type || '').toLowerCase();
        const descLower = (t.description || '').toLowerCase();

        const isInvestmentTransfer = 
            typeLower.includes('investment to task') ||
            typeLower.includes('investment to campaign') ||
            typeLower.includes('investment wallet') ||
            descLower.includes('from investment wallet') ||
            descLower.includes('from investment module') ||
            descLower.includes('investment to task') ||
            descLower.includes('investment to campaign') ||
            descLower.includes('investment wallet to task wallet');

        const isCampaignTransferFromTaskEarnings = 
            !isInvestmentTransfer && (
                typeLower.includes('task reward transfer') ||
                (typeLower.includes('campaign') && (typeLower.includes('task') || descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                (descLower.includes('campaign') && (descLower.includes('task earnings') || descLower.includes('task wallet') || descLower.includes('converted') || descLower.includes('transferred')))
            );

        if (isCampaignTransferFromTaskEarnings) {
            let amtUSD = 0;
            if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                amtUSD = Math.abs(t.amountUSD);
            } else if (t.currency && t.currency !== 'USD') {
                const amtBase = Math.abs(t.amount || 0);
                amtUSD = (t.exchangeRate || exchangeRate || 1) > 0 ? amtBase / (t.exchangeRate || exchangeRate || 1) : amtBase / (exchangeRate || 1);
            } else {
                amtUSD = Math.abs(t.amount || 0);
            }
            return sum + amtUSD;
        }
        return sum;
    }, 0);

    const taskEarningsTransferredUSD = Number(fundsUsedForCampaignUSD.toFixed(2));

    // 3. Total Funding Transferred In
    const totalTransferredInUSD = Number((depositAndInvestmentUSD + taskEarningsTransferredUSD).toFixed(2));

    // 5. Remaining Available Campaign Balance
    let availableTransferBalanceUSD = Math.max(0, Number((totalTransferredInUSD - campaignPurchasesUSD).toFixed(2)));
    if (availableCampaignWalletUSD > availableTransferBalanceUSD) {
        availableTransferBalanceUSD = Number(availableCampaignWalletUSD.toFixed(2));
    }

    // Alias constants for compatibility with audit log & analytics modals
    const transferredInUSD = totalTransferredInUSD;
    const remainingTransferredBalanceUSD = availableTransferBalanceUSD;
    const directDepositUSD = totalHubDepositsUSD;
    const investmentTransferUSD = investmentTransferSumUSD;
    const taskRewardUSD = taskEarningsTransferredUSD;
    const otherCreditsUSD = 0;

    const handleToggleCampaignStatus = async (task: any) => {
        // Verify ownership & authorization
        const isOwner = task.userId?.toString() === currentUser._id?.toString();
        const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
        if (!isOwner && !isAdmin) {
            alert("You are not authorized to modify this campaign.");
            return;
        }

        const isCurrentlyActive = task.status === 'Approved' || task.status === 'Active';
        const isCurrentlyPaused = task.status === 'On Hold';

        // Validate state before proceeding
        if (isCurrentlyPaused) {
            if (!window.confirm("Are you sure you want to resume this campaign?")) return;
        } else if (isCurrentlyActive) {
            if (!window.confirm("Are you sure you want to pause this campaign?")) return;
        } else {
            alert("Unable to pause campaign.");
            return;
        }

        const nextStatus = isCurrentlyActive ? 'On Hold' : 'Approved';

        try {
            const res = await updateUserTaskStatus(task._id, { status: nextStatus });
            const finalTask = res?.data?.task || res?.data || res?.task || (res?._id ? res : task);
            dispatch({ type: 'UPDATE_USER_TASK', payload: finalTask });
            
            // Keep selectedCampaignForDetail in sync if currently viewing it
            if (selectedCampaignForDetail && selectedCampaignForDetail._id === task._id) {
                setSelectedCampaignForDetail(finalTask);
            }

            if (isCurrentlyActive) {
                // Automatically switch to 'paused' filter so the user immediately sees the paused campaign
                setMyCampaignFilter('paused');
                setMyCampaignsPage(1);
                setCampaignNotice({
                    type: 'success',
                    text: '✅ Campaign paused successfully.',
                    subtext: 'This campaign has been moved to the Paused Campaigns list.'
                });
            } else {
                // Automatically switch to 'approved' filter when resumed
                setMyCampaignFilter('approved');
                setMyCampaignsPage(1);
                setCampaignNotice({
                    type: 'success',
                    text: '✅ Campaign resumed successfully.',
                    subtext: 'This campaign is now active and visible to workers.'
                });
            }
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleSubmitCampaignForReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCampaignForReview) return;
        setIsSubmittingReview(true);
        try {
            const res = await updateUserTaskStatus(selectedCampaignForReview._id, {
                reviewRequested: true,
                userReviewMessage: reviewExplanation
            });
            const updatedTask = res?.task || (res?._id ? res : null);
            const updatedUser = res?.user || null;

            if (updatedTask) {
                dispatch({ type: 'UPDATE_USER_TASK', payload: updatedTask });
                if (selectedCampaignForDetail && selectedCampaignForDetail._id === selectedCampaignForReview._id) {
                    setSelectedCampaignForDetail(updatedTask);
                }
            }
            if (updatedUser) {
                dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            }

            alert("Campaign successfully submitted to Admin for one-time review!");
            setSelectedCampaignForReview(null);
            setReviewExplanation('');
        } catch (error) {
            alert(`Failed to submit for review: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleDeleteCampaign = async (taskId: string): Promise<boolean> => {
        try {
            await deleteUserTask(taskId);
            dispatch({ type: 'DELETE_USER_TASK', payload: taskId });
            alert("Campaign deleted and remaining budget refunded successfully!");
            return true;
        } catch (error) {
            alert(`Failed to delete campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    };

    const handleBulkApprove = async (subIds: string[]) => {
        if (subIds.length === 0) return alert("No submissions selected.");
        setIsSubmitting(true);
        let successCount = 0;
        let failCount = 0;
        for (const id of subIds) {
            try {
                const res = await updateSubmissionStatus(id, { status: 'Approved' });
                const updatedSub = res?.data || res;
                dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updatedSub });
                if (res?.task) {
                    dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
                }
                successCount++;
            } catch (error) {
                console.error(`Failed to approve submission ${id}:`, error);
                failCount++;
            }
        }
        setIsSubmitting(false);
        setSelectedSubmissions({});
        alert(`Bulk approval complete! ${successCount} approved, ${failCount} failed.`);
    };

    const handleBulkReject = async (subIds: string[], reason: string) => {
        if (subIds.length === 0) return alert("No submissions selected.");
        if (!reason.trim()) return alert("Rejection reason is required.");
        setIsSubmitting(true);
        let successCount = 0;
        let failCount = 0;
        for (const id of subIds) {
            try {
                const res = await updateSubmissionStatus(id, { 
                    status: 'Rejected', 
                    rejectionReason: reason,
                    adminNotes: reason
                });
                const updatedSub = res?.data || res;
                dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updatedSub });
                if (res?.task) {
                    dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
                }
                successCount++;
            } catch (error) {
                console.error(`Failed to reject submission ${id}:`, error);
                failCount++;
            }
        }
        setIsSubmitting(false);
        setRejectingSubId(null);
        setRejectionFeedback('');
        setSelectedSubmissions({});
        alert(`Bulk rejection complete! ${successCount} rejected, ${failCount} failed.`);
    };

    const handleSingleReject = async (subId: string, reason: string): Promise<boolean> => {
        if (!reason.trim()) {
            alert("Rejection reason is required.");
            return false;
        }
        setIsSubmitting(true);
        try {
            const res = await updateSubmissionStatus(subId, { 
                status: 'Rejected', 
                rejectionReason: reason,
                adminNotes: reason
            });
            const updatedSub = res?.data || res;
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updatedSub });
            if (res?.task) {
                dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
            }
            alert("Submission rejected successfully!");
            setRejectingSubId(null);
            setRejectionFeedback('');
            // Also update local selected worker submission if open
            if (selectedWorkerSubmissionForDetails?._id === subId) {
                setSelectedWorkerSubmissionForDetails(updatedSub);
            }
            return true;
        } catch (error) {
            alert(`Failed to reject submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApproveSubmission = async (subId: string): Promise<boolean> => {
        setIsSubmitting(true);
        try {
            const res = await updateSubmissionStatus(subId, { status: 'Approved' });
            const updatedSub = res?.data || res;
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updatedSub });
            if (res?.task) {
                dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
            }
            if (selectedWorkerSubmissionForDetails?._id === subId) {
                setSelectedWorkerSubmissionForDetails(updatedSub);
            }
            alert("Submission approved and rewarded successfully!");
            return true;
        } catch (error) {
            alert(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectSubmission = async (subId: string): Promise<boolean> => {
        setRejectingSubId(subId);
        setRejectionFeedback('');
        return true;
    };

    const browseableTasks = userTasks.filter(t => {
        const isApproved = t.status === 'Approved' || t.status === 'Paid';
        const isNotMine = t.userId?.toString() !== currentUser._id?.toString();
        const hasSlots = t.currentCompletions < t.targetQuantity;
        const alreadySubmitted = userTaskSubmissions.some(s => {
            const matchTask = s.taskId?.toString() === t._id?.toString();
            const wId = typeof s.workerId === 'object' ? (s.workerId as any)?._id : s.workerId;
            const uId = typeof (s as any).userId === 'object' ? (s as any).userId?._id : (s as any).userId;
            const matchUser = (wId && wId.toString() === currentUser._id?.toString()) ||
                              (uId && uId.toString() === currentUser._id?.toString()) ||
                              (s.workerName && currentUser.username && s.workerName === currentUser.username);
            return matchTask && matchUser;
        });
        return isApproved && isNotMine && hasSlots && !alreadySubmitted;
    });
    const pendingSubmissions = mySubmissions.filter(s => s.status === 'Pending');
    const completedSubmissions = mySubmissions.filter(s => s.status === 'Approved');

    // 1. Browse Tab Filtration & Pagination
    const filteredBrowseableTasks = browseableTasks
        .filter(t => {
            const matchesSearch = browseSearch === '' || 
                (t.title && t.title.toLowerCase().includes(browseSearch.toLowerCase())) || 
                (t.description && t.description.toLowerCase().includes(browseSearch.toLowerCase()));
            const matchesCategory = browseCategory === 'All' || t.category === browseCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            if (browseSort === 'reward-desc') {
                return (b.rewardPerTask || 0) - (a.rewardPerTask || 0);
            }
            if (browseSort === 'reward-asc') {
                return (a.rewardPerTask || 0) - (b.rewardPerTask || 0);
            }
            if (browseSort === 'quantity-desc') {
                return (b.targetQuantity || 0) - (a.targetQuantity || 0);
            }
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

    const totalBrowsePages = Math.max(1, Math.ceil(filteredBrowseableTasks.length / browseItemsPerPage));
    const paginatedBrowseTasks = filteredBrowseableTasks.slice(
        (browsePage - 1) * browseItemsPerPage,
        browsePage * browseItemsPerPage
    );

    // 2. My Campaigns Tab Filtration & Pagination
    const filteredMyCampaignsList = mySubmittedTasks
        .filter(t => {
            const matchesSearch = myCampaignsSearch === '' || 
                (t.title && t.title.toLowerCase().includes(myCampaignsSearch.toLowerCase())) || 
                (t.description && t.description.toLowerCase().includes(myCampaignsSearch.toLowerCase()));
            
            let matchesStatus = true;
            if (myCampaignFilter === 'pending') matchesStatus = t.status === 'Pending';
            else if (myCampaignFilter === 'approved') matchesStatus = (t.status === 'Approved' || t.status === 'Active') && t.currentCompletions < t.targetQuantity;
            else if (myCampaignFilter === 'paused') matchesStatus = t.status === 'On Hold';
            else if (myCampaignFilter === 'completed') matchesStatus = t.status === 'Completed' || t.currentCompletions >= t.targetQuantity;
            else if (myCampaignFilter === 'rejected') matchesStatus = t.status === 'Rejected';

            return matchesSearch && matchesStatus;
        });

    const totalMyCampaignsPages = Math.max(1, Math.ceil(filteredMyCampaignsList.length / myCampaignsItemsPerPage));
    const paginatedMyCampaigns = filteredMyCampaignsList.slice(
        (myCampaignsPage - 1) * myCampaignsItemsPerPage,
        myCampaignsPage * myCampaignsItemsPerPage
    );

    // 3. Pending Submissions Tab Filtration & Pagination
    const filteredPendingSubmissions = pendingSubmissions
        .filter(s => {
            const titleMatch = s.taskTitle && s.taskTitle.toLowerCase().includes(pendingSearch.toLowerCase());
            const proofMatch = s.proofText && s.proofText.toLowerCase().includes(pendingSearch.toLowerCase());
            return pendingSearch === '' || titleMatch || proofMatch;
        });

    const totalPendingPages = Math.max(1, Math.ceil(filteredPendingSubmissions.length / pendingItemsPerPage));
    const paginatedPendingSubmissions = filteredPendingSubmissions.slice(
        (pendingPage - 1) * pendingItemsPerPage,
        pendingPage * pendingItemsPerPage
    );

    // 4. Completed Submissions Tab Filtration & Pagination
    const filteredCompletedSubmissions = mySubmissions
        .filter(s => {
            if (historyStatusFilter === 'All') return true;
            if (historyStatusFilter === 'Approved') return s.status === 'Approved' || s.status === 'Paid';
            if (historyStatusFilter === 'Pending') return s.status === 'Pending';
            if (historyStatusFilter === 'Rejected') return s.status === 'Rejected';
            if (historyStatusFilter === 'Disputed') return s.status === 'Disputed' || Boolean(s.disputeOpened);
            return s.status === historyStatusFilter;
        })
        .filter(s => {
            const titleMatch = s.taskTitle && s.taskTitle.toLowerCase().includes(completedSearch.toLowerCase());
            const proofMatch = (s.proofText && s.proofText.toLowerCase().includes(completedSearch.toLowerCase())) ||
                               (s.proofUsername && s.proofUsername.toLowerCase().includes(completedSearch.toLowerCase())) ||
                               (s.proofUserIdVal && s.proofUserIdVal.toLowerCase().includes(completedSearch.toLowerCase()));
            return completedSearch === '' || titleMatch || proofMatch;
        });

    const totalCompletedPages = Math.max(1, Math.ceil(filteredCompletedSubmissions.length / completedItemsPerPage));
    const paginatedCompletedSubmissions = filteredCompletedSubmissions.slice(
        (completedPage - 1) * completedItemsPerPage,
        completedPage * completedItemsPerPage
    );

    // 5. Review Proofs Tab Filtration & Pagination
    const filteredReviewCampaignSubmissions = campaignSubmissions
        .filter(s => {
            if (reviewFilter === 'All') return true;
            if (reviewFilter === 'Disputed') return s.status === 'Disputed';
            return s.status === reviewFilter;
        })
        .filter(s => {
            if (reviewSearch === '') return true;
            const workerMatch = s.workerName && s.workerName.toLowerCase().includes(reviewSearch.toLowerCase());
            const taskMatch = s.taskTitle && s.taskTitle.toLowerCase().includes(reviewSearch.toLowerCase());
            const textProofMatch = s.proofText && s.proofText.toLowerCase().includes(reviewSearch.toLowerCase());
            return workerMatch || taskMatch || textProofMatch;
        });

    const totalReviewPages = Math.max(1, Math.ceil(filteredReviewCampaignSubmissions.length / reviewItemsPerPage));
    const paginatedReviewSubmissions = filteredReviewCampaignSubmissions.slice(
        (reviewPage - 1) * reviewItemsPerPage,
        reviewPage * reviewItemsPerPage
    );

    const hasAccess = canUserAccessTasks(currentUser, settings);

    if (!hasAccess) {
        return (
            <div className="max-w-4xl mx-auto py-16 px-4">
                <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-12 shadow-2xl border dark:border-gray-700 text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl mx-auto flex items-center justify-center text-3xl font-black">
                        🔒
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Earn Cash & Gigs Hub Locked</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto font-medium leading-relaxed">
                        {settings.userTaskNotificationEnabled !== false 
                            ? (settings.userTaskNotificationMessage || 'Want to earn extra rewards? Activate the required investment plan to unlock the Earn Cash & Gigs Hub and start earning today!')
                            : 'Access to the Earn Cash & Gigs Hub is restricted by the administrator.'}
                    </p>
                    <div className="pt-4 flex flex-wrap justify-center gap-4">
                        <Link to="/member/plans">
                            <Button variant="primary" className="px-8 py-3.5 rounded-2xl shadow-lg">
                                View Investment Plans & Activate
                            </Button>
                        </Link>
                        <Link to="/member">
                            <Button variant="secondary" className="px-8 py-3.5 rounded-2xl">
                                Back to Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-8 max-w-7xl mx-auto pb-20">
            {/* Header */}
            {!hideHeaderAndTabs && (
                <div className="bg-[#0f172a] p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
                        <div>
                            <h1 className="text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight">Earn Cash & Gigs Hub (USD)</h1>
                            <p className="mt-1 text-blue-100/70 font-semibold uppercase text-[10px] md:text-xs tracking-wider ml-1">Create USD campaigns, complete tasks with proof, and convert currency</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full lg:flex lg:flex-wrap lg:w-auto">
                            {[
                                { id: 'browse', label: 'Available Tasks', count: browseableTasks.length, icon: '📋' },
                                { id: 'pending-payment', label: 'Pending Review', count: pendingSubmissions.length, icon: '⏳' },
                                { id: 'completed-tasks', label: 'Submitted Task History', count: mySubmissions.length, icon: '📜' },
                                { id: 'submit', label: 'Create Campaign', icon: '🚀' },
                                { id: 'my-tasks', label: 'My Campaigns', count: mySubmittedTasks.length, icon: '📂' },
                                { id: 'review-proofs', label: 'Review Proofs', count: campaignSubmissions.filter(s => s.status === 'Pending').length, icon: '👁️' },
                                { id: 'converter', label: 'Converter', icon: '🔄' },
                            ].map((tab, idx) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id as any);
                                        if (tab.id === 'submit') {
                                            seoAnalytics.trackCampaignCreateStarted();
                                        }
                                    }}
                                    className={`flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-wider transition-all duration-300 select-none ${
                                        idx === 6 ? 'col-span-2 lg:col-span-1' : ''
                                    } ${
                                        activeTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 scale-[1.02]'
                                            : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
                                    }`}
                                >
                                    <span className="text-xs md:text-sm">{tab.icon}</span>
                                    <span className="truncate">{tab.label}</span>
                                    {tab.count !== undefined && (
                                        <span className={`ml-1 text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                            activeTab === tab.id ? 'bg-blue-800 text-blue-200' : 'bg-white/10 text-gray-400'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Top Balance Widget & Quick Actions */}
            {!hideHeaderAndTabs && (
                <div className="bg-gradient-to-r from-blue-950 to-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] text-white shadow-xl flex flex-col lg:flex-row justify-between items-center gap-4 md:gap-6 border border-blue-500/15">
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row items-center sm:gap-6 w-full lg:w-auto">
                        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                            <div className="w-8 h-8 md:w-12 md:h-12 shrink-0 bg-blue-600/20 rounded-xl md:rounded-2xl flex items-center justify-center text-sm md:text-xl font-black text-emerald-400 border border-blue-500/30 shadow-inner">
                                💲
                            </div>
                            <div>
                                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-blue-300 block leading-none mb-0.5 md:mb-1">Campaign Balance</span>
                                <span className="text-xs md:text-2xl font-black tracking-tight text-white block">
                                    ${availableCampaignWalletUSD.toFixed(2)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                            <div className="w-8 h-8 md:w-12 md:h-12 shrink-0 bg-emerald-600/20 rounded-xl md:rounded-2xl flex items-center justify-center text-sm md:text-xl font-black text-emerald-400 border border-emerald-500/30 shadow-inner">
                                💳
                            </div>
                            <div>
                                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-400 block leading-none mb-0.5 md:mb-1">MLM Balance</span>
                                <span className="text-xs md:text-2xl font-black tracking-tight text-white block truncate">
                                    {(currentUser.walletBalance || 0).toFixed(2)} {currentUser.currency || 'USD'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4 w-full lg:w-auto justify-end">
                        <div className="text-right hidden sm:block">
                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Registered Currency</span>
                            <span className="text-sm font-black text-emerald-400">{currentUser.currency || 'USD'}</span>
                        </div>
                        <Button 
                            variant="primary" 
                            onClick={() => setShowConvertModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 md:px-6 md:py-3.5 rounded-xl md:rounded-2xl shadow-lg flex items-center gap-1.5 transition-transform hover:scale-105 w-full sm:w-auto justify-center text-[10px] md:text-sm"
                        >
                            <span>Convert & Transfer to Main Wallet</span>
                            <span>⚡</span>
                        </Button>
                    </div>
                </div>
            )}

            {!isEnabled && (
                <div className="bg-red-500/10 border-2 border-red-500/30 text-red-600 dark:text-red-400 p-6 rounded-3xl font-bold text-center">
                    User task submissions are currently disabled by the administrator.
                </div>
            )}

            {/* TAB 1: CREATE CAMPAIGN */}
            {activeTab === 'submit' && isEnabled && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl border dark:border-gray-700">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">Create USD Task Campaign</h3>
                        
                        <form onSubmit={handleCreateCampaign} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Category / Platform</label>
                                    <select 
                                        value={category} 
                                        onChange={(e) => {
                                            const catVal = e.target.value;
                                            setCategory(catVal);
                                            
                                            // Pre-adjust subType for the newly selected category
                                            const newPresetKey = Object.keys(presets).find(k => 
                                                k.toLowerCase() === catVal.toLowerCase() || 
                                                (presets[k]?.displayName && presets[k].displayName.toLowerCase() === catVal.toLowerCase())
                                            ) || 'youtube';
                                            const newCategoryConfig = presets[newPresetKey];
                                            if (newCategoryConfig) {
                                                const newSubKeys = Object.keys(newCategoryConfig).filter(k => {
                                                    if (k === 'enabled' || k === 'displayName' || k === 'watchTimeTiers') return false;
                                                    if (newCategoryConfig[k]?.enabled === false) return false;
                                                    return typeof newCategoryConfig[k] === 'object' && newCategoryConfig[k] !== null;
                                                });
                                                if (newSubKeys.length > 0) {
                                                    const firstSubPreset = newCategoryConfig[newSubKeys[0]];
                                                    setSubType(firstSubPreset?.displayName || newSubKeys[0].charAt(0).toUpperCase() + newSubKeys[0].slice(1));
                                                } else if (newCategoryConfig.watchTimeTiers && newCategoryConfig.watchTimeTiers.some((t: any) => t.enabled !== false)) {
                                                    setSubType('Watch Time');
                                                } else {
                                                    setSubType('Other');
                                                }
                                            } else {
                                                setSubType('Other');
                                            }
                                        }}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    >
                                        {availableCategories.map(cat => (
                                            <option key={cat.key} value={cat.displayName}>{cat.displayName}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Action / SubType</label>
                                    <select 
                                        value={subType} 
                                        onChange={(e) => setSubType(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    >
                                        {availableSubTypes.map(sub => (
                                            <option key={sub.key} value={sub.displayName}>{sub.displayName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {subType === 'Watch Time' && activeWatchTimeTiers.length > 0 && (
                                <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border border-blue-100 dark:border-gray-700 space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-black uppercase text-blue-600 dark:text-blue-400">Select Watch Time Duration Tier</label>
                                    <select
                                        value={watchTimeTierIndex}
                                        onChange={(e) => setWatchTimeTierIndex(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-950 border border-blue-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold text-sm"
                                    >
                                        {activeWatchTimeTiers.map((tier: any, idx: number) => {
                                            const originalIdx = (activeCategoryConfig?.watchTimeTiers || []).findIndex((t: any) => t.duration === tier.duration);
                                            return (
                                                <option key={idx} value={originalIdx !== -1 ? originalIdx : idx}>
                                                    {tier.duration} (Min Amount: ${tier.minPayout} | Min Slots: {tier.minSlots})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}

                            <div id="campaign-title-field">
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Campaign Title</label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: undefined }));
                                    }}
                                    placeholder="e.g. Website Sign-up & Verify Email"
                                    className={`w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border text-gray-900 dark:text-white font-medium transition-all ${
                                        fieldErrors.title 
                                            ? 'border-2 border-red-500 ring-2 ring-red-500/30 bg-red-50/50 dark:bg-red-950/20' 
                                            : 'dark:border-gray-700'
                                    }`}
                                />
                                {fieldErrors.title && (
                                    <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                                        <span>⚠️</span> {fieldErrors.title}
                                    </p>
                                )}
                            </div>

                            <div id="campaign-link-field">
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Target Link / URL</label>
                                <input 
                                    type="url" 
                                    value={link} 
                                    onChange={(e) => {
                                        setLink(e.target.value);
                                        if (fieldErrors.link) setFieldErrors(prev => ({ ...prev, link: undefined }));
                                    }}
                                    placeholder="https://example.com/signup"
                                    className={`w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border text-gray-900 dark:text-white font-medium transition-all ${
                                        fieldErrors.link 
                                            ? 'border-2 border-red-500 ring-2 ring-red-500/30 bg-red-50/50 dark:bg-red-950/20' 
                                            : 'dark:border-gray-700'
                                    }`}
                                />
                                {fieldErrors.link && (
                                    <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                                        <span>⚠️</span> {fieldErrors.link}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Description & Proof Instructions</label>
                                <textarea 
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Provide clear instructions for workers (e.g. Sign up with email, submit your username and screenshot)"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                ></textarea>
                            </div>

                            {(() => {
                                const limits = getSelectionLimits();
                                const qtyVal = targetQuantity === '' || targetQuantity === undefined || targetQuantity === null ? 0 : Number(targetQuantity);
                                const isQtyBelowMin = isNaN(qtyVal) || qtyVal < limits.minSlots;
                                const qtyErrText = fieldErrors.targetQuantity || (isQtyBelowMin ? `Entered quantity (${qtyVal} slots) is below the required minimum of ${limits.minSlots} slots.` : null);

                                const rewardVal = rewardPerTask === '' || rewardPerTask === undefined || rewardPerTask === null ? 0 : Number(rewardPerTask);
                                const isRewardBelowMin = isNaN(rewardVal) || rewardVal < limits.minPayout;
                                const rewardErrText = fieldErrors.rewardPerTask || (isRewardBelowMin ? `Entered reward ($${rewardVal < 0 ? '0.000' : rewardVal.toFixed(3)}) is below the required minimum of $${limits.minPayout.toFixed(3)} USD.` : null);

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div id="campaign-quantity-field">
                                            <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                Target Quantity (Min {limits.minSlots})
                                            </label>
                                            <input 
                                                type="number" 
                                                min={limits.minSlots}
                                                value={targetQuantity} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTargetQuantity(val === '' ? '' as any : Number(val));
                                                    if (fieldErrors.targetQuantity) setFieldErrors(prev => ({ ...prev, targetQuantity: undefined }));
                                                }}
                                                placeholder={`Min ${limits.minSlots} slots`}
                                                className={`w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border text-gray-900 dark:text-white font-medium transition-all ${
                                                    qtyErrText 
                                                        ? 'border-2 border-red-500 ring-2 ring-red-500/30 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-200' 
                                                        : 'dark:border-gray-700'
                                                }`}
                                            />
                                            {qtyErrText && (
                                                <div className="mt-2 p-3 rounded-xl bg-red-100/90 dark:bg-red-950/60 border border-red-300 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs font-bold flex items-start gap-2 shadow-sm animate-in fade-in slide-in-from-top-1">
                                                    <span className="text-base leading-none shrink-0">⚠️</span>
                                                    <div className="flex-1">
                                                        <span className="font-extrabold uppercase tracking-wider block text-[10px] text-red-600 dark:text-red-400">Below Minimum Requirement</span>
                                                        {qtyErrText}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div id="campaign-reward-field">
                                            <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                Reward Per Task (Min ${limits.minPayout.toFixed(3)} USD)
                                            </label>
                                            <input 
                                                type="number" 
                                                step="0.001"
                                                min={limits.minPayout}
                                                value={rewardPerTask} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setRewardPerTask(val === '' ? '' as any : Number(val));
                                                    if (fieldErrors.rewardPerTask) setFieldErrors(prev => ({ ...prev, rewardPerTask: undefined }));
                                                }}
                                                placeholder={`Min $${limits.minPayout.toFixed(3)}`}
                                                className={`w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border text-gray-900 dark:text-white font-medium transition-all ${
                                                    rewardErrText 
                                                        ? 'border-2 border-red-500 ring-2 ring-red-500/30 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-200' 
                                                        : 'dark:border-gray-700'
                                                }`}
                                            />
                                            {rewardErrText && (
                                                <div className="mt-2 p-3 rounded-xl bg-red-100/90 dark:bg-red-950/60 border border-red-300 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs font-bold flex items-start gap-2 shadow-sm animate-in fade-in slide-in-from-top-1">
                                                    <span className="text-base leading-none shrink-0">⚠️</span>
                                                    <div className="flex-1">
                                                        <span className="font-extrabold uppercase tracking-wider block text-[10px] text-red-600 dark:text-red-400">Below Minimum Requirement</span>
                                                        {rewardErrText}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Module A: Dynamic Proof Requirements Form Builder */}
                            <div id="campaign-proofs-container" className={`space-y-4 pt-6 border-t rounded-2xl p-3 transition-all ${
                                fieldErrors.proofs ? 'border-2 border-red-500 bg-red-50/30 dark:bg-red-950/20' : 'border-gray-100 dark:border-gray-700'
                            }`}>
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Configure Required Proofs (Module A)</h4>
                                {fieldErrors.proofs && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in">
                                        <span>⚠️</span> {fieldErrors.proofs}
                                    </div>
                                )}
                                
                                <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-black uppercase text-gray-400">Add Required Proof Type:</span>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    addProofType('screenshot', 'Screenshot / Image');
                                                    if (fieldErrors.proofs) setFieldErrors(prev => ({ ...prev, proofs: undefined }));
                                                }}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-blue-600 dark:text-blue-400">+</span> 📸 Screenshot / Image
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    addProofType('text', 'Text Proof');
                                                    if (fieldErrors.proofs) setFieldErrors(prev => ({ ...prev, proofs: undefined }));
                                                }}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+</span> 📝 Text Proof
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    addProofType('username', 'Username');
                                                    if (fieldErrors.proofs) setFieldErrors(prev => ({ ...prev, proofs: undefined }));
                                                }}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-purple-600 dark:text-purple-400">+</span> 👤 Username
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    addProofType('userId', 'User ID');
                                                    if (fieldErrors.proofs) setFieldErrors(prev => ({ ...prev, proofs: undefined }));
                                                }}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-amber-600 dark:text-amber-400">+</span> 🆔 User ID
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    addProofType('email', 'Email');
                                                    if (fieldErrors.proofs) setFieldErrors(prev => ({ ...prev, proofs: undefined }));
                                                }}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-rose-600 dark:text-rose-400">+</span> 📧 Email
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-2xl border dark:border-gray-700 shadow-inner">
                                        <input
                                            type="text"
                                            id="custom-proof-manual-input"
                                            placeholder="Or enter manual entry name (e.g. Profile URL)..."
                                            className="flex-1 bg-transparent border-none text-xs font-medium focus:ring-0 px-2 text-gray-900 dark:text-white"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = (e.currentTarget as HTMLInputElement).value.trim();
                                                    if (val) {
                                                        addProofType('manual', val);
                                                        (e.currentTarget as HTMLInputElement).value = '';
                                                        if (fieldErrors.proofs) setFieldErrors(prev => ({ ...prev, proofs: undefined }));
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const el = document.getElementById('custom-proof-manual-input') as HTMLInputElement;
                                                const val = el?.value.trim();
                                                if (val) {
                                                    addProofType('manual', val);
                                                    el.value = '';
                                                    if (fieldErrors.proofs) setFieldErrors(prev => ({ ...prev, proofs: undefined }));
                                                } else {
                                                    alert("Please enter a label for manual entry proof.");
                                                }
                                            }}
                                            className="px-4 py-2 text-xs font-black rounded-xl bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 hover:scale-105 transition-all flex items-center gap-1 shrink-0"
                                        >
                                            <span className="font-bold">+</span> Add Manual Entry
                                        </button>
                                    </div>

                                    {/* Configured Proofs List */}
                                    <div className="space-y-3 pt-2">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active Proof Requirements list:</span>
                                        {requiredProofsList.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic text-center py-4 bg-white dark:bg-gray-800 rounded-2xl border border-dashed dark:border-gray-700">
                                                No proofs configured yet. Please add at least one required proof above.
                                            </p>
                                        ) : (
                                            requiredProofsList.map((proof, index) => (
                                                <div key={proof.id} id={`proof-instruction-${proof.id}`} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 shadow-sm space-y-2.5 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                                #{index + 1}
                                                            </span>
                                                            <span className="text-xs font-black text-gray-900 dark:text-white">
                                                                {proof.type === 'screenshot' ? '📸' : 
                                                                 proof.type === 'text' ? '📝' : 
                                                                 proof.type === 'username' ? '👤' : 
                                                                 proof.type === 'userId' ? '🆔' : 
                                                                 proof.type === 'email' ? '📧' : '✍️'} {proof.label}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeProofItem(proof.id)}
                                                            className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition-colors"
                                                        >
                                                            <span>🗑️</span> Remove
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={proof.instruction}
                                                        onChange={(e) => {
                                                            updateProofInstruction(proof.id, e.target.value);
                                                            if (fieldErrors.proofInstructions?.[proof.id]) {
                                                                setFieldErrors(prev => {
                                                                    const copy = { ...prev.proofInstructions };
                                                                    delete copy[proof.id];
                                                                    return { ...prev, proofInstructions: copy };
                                                                });
                                                            }
                                                        }}
                                                        placeholder={`Instruction for worker (e.g. Enter your ${proof.label.toLowerCase()})`}
                                                        className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${
                                                            fieldErrors.proofInstructions?.[proof.id]
                                                                ? 'border-2 border-red-500 ring-2 ring-red-500/30 bg-red-50/50 dark:bg-red-950/20'
                                                                : 'dark:border-gray-700'
                                                        }`}
                                                    />
                                                    {fieldErrors.proofInstructions?.[proof.id] && (
                                                        <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1 animate-in fade-in">
                                                            <span>⚠️</span> {fieldErrors.proofInstructions[proof.id]}
                                                        </p>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Base Creation Fee Notice Banner above launch campaign button */}
                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs space-y-1.5">
                                <div className="flex justify-between items-center font-black text-amber-900 dark:text-amber-300">
                                    <span className="flex items-center gap-1.5">
                                        <span>🏷️</span> Base Campaign Creation Fee:
                                    </span>
                                    <span className="font-mono text-sm font-bold text-amber-700 dark:text-amber-400">
                                        ${campaignFeeUSD.toFixed(2)} USD
                                    </span>
                                </div>
                                <p className="text-amber-800 dark:text-amber-300/90 text-[11px] leading-relaxed font-medium">
                                    ℹ️ <strong>Note:</strong> The base creation fee is a one-time fee for campaign creation. You can pause, resume, or reuse this campaign anytime without paying this fee again!
                                </p>
                            </div>

                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full py-4 text-base md:text-lg font-black shadow-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white">
                                🚀 Launch Campaign — Total: ${grandTotalUSD.toFixed(2)} USD
                            </Button>
                        </form>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-[#0f172a] text-white rounded-[2.5rem] p-8 md:p-10 shadow-xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl font-bold uppercase tracking-tight text-blue-400 mb-6">Campaign Summary (USD)</h3>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Target Completions</span>
                                    <span className="font-bold">{targetQuantity} users</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Reward / Task</span>
                                    <span className="font-bold">{(typeof rewardPerTask === 'number' ? rewardPerTask : Number(rewardPerTask) || 0).toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Subtotal Rewards</span>
                                    <span className="font-bold">{subtotal.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Admin Commission ({config.commissionPercent}%)</span>
                                    <span className="font-bold">{adminCommission.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <div className="flex flex-col">
                                        <span className="text-gray-400">Base Creation Fee</span>
                                        <span className="text-[10px] text-amber-400/90 font-medium">One-time fee (Reuse campaign anytime without fee)</span>
                                    </div>
                                    <span className="font-bold text-amber-400">${campaignFeeUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-3 text-lg font-black text-emerald-400 border-t border-gray-700 mt-2">
                                    <span>Total Launch Amount</span>
                                    <span>${grandTotalUSD.toFixed(2)} USD</span>
                                </div>
                                {getSelectionLimits().isPresetFound && (
                                    <div className="mt-4 p-4 rounded-2xl bg-blue-950/40 border border-blue-900 text-xs space-y-2">
                                        <p className="font-bold text-blue-400 uppercase tracking-wider">🔒 Admin Verified Preset</p>
                                        <p className="text-gray-300">This task type is configured platform-wide:</p>
                                        <ul className="list-disc pl-4 text-gray-400 space-y-1">
                                            <li>Min Required Price: <strong>${getSelectionLimits().minPayout.toFixed(3)} USD</strong></li>
                                            <li>Min Required Slots: <strong>{getSelectionLimits().minSlots} users</strong></li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 p-6 bg-gray-900/60 rounded-3xl border border-gray-800">
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Funds will be deducted from your wallet balance in USD equivalent. When workers submit proof (screenshot, ID, or link), the campaign creator needs to approve the task and its proof. Only then will workers receive their USD rewards instantly!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: BROWSE & EARN TASKS */}
            {activeTab === 'browse' && (
                <div className="space-y-6">
                    {/* 1. Description / Detail Hero Summary Card (Topmost) */}
                    {!hideHeroBanner && (
                        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 md:p-8 rounded-[2rem] text-white shadow-xl space-y-6 border border-blue-400/20">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-3xl shrink-0 shadow-inner">
                                        📋
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Available Tasks</h3>
                                            <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                Active Jobs
                                            </span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-blue-100/90 mt-1 font-medium max-w-2xl leading-relaxed">
                                            Explore and complete active micro-tasks created by verified advertisers. Earn instant USD rewards credited directly to your Work & Earn task balance upon proof verification!
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 self-stretch sm:self-center shrink-0 justify-end">
                                    <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center w-full sm:w-auto">
                                        <span className="text-2xl md:text-3xl font-black block leading-none text-white">
                                            {filteredBrowseableTasks.length}
                                        </span>
                                        <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1 block">
                                            Jobs Available
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* How It Works - 4 Steps Banner */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-white/15">
                                <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
                                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider block">1. Pick a Task</span>
                                    <p className="text-[11px] text-blue-100/80 leading-tight">Choose from YouTube, Socials, Apps, or Web offers.</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
                                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider block">2. Read Rules</span>
                                    <p className="text-[11px] text-blue-100/80 leading-tight">Click 'View' to see target link and required proof format.</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
                                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider block">3. Submit Proof</span>
                                    <p className="text-[11px] text-blue-100/80 leading-tight">Complete task and upload screenshot or text details.</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
                                    <span className="text-xs font-black text-emerald-300 uppercase tracking-wider block">4. Get Paid USD</span>
                                    <p className="text-[11px] text-blue-100/80 leading-tight">Verified payouts credit directly to your Task Wallet.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Navigation Tabs (Available Jobs vs Other Tasks) - Placed below description card and above search bar */}
                    {!hideSubTabs && (
                        <div className="bg-slate-900/90 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl border border-slate-800 space-y-3 sm:space-y-4">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                                    <button
                                        type="button"
                                        onClick={() => setAvailableTasksSubTab('available_jobs')}
                                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                                            availableTasksSubTab === 'available_jobs'
                                                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                                                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                        }`}
                                    >
                                        <TaskIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        <span>Available Jobs</span>
                                        <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold font-mono ${
                                            availableTasksSubTab === 'available_jobs' ? 'bg-slate-950/80 text-amber-300' : 'bg-slate-950/60 text-slate-400'
                                        }`}>
                                            {filteredBrowseableTasks.length}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAvailableTasksSubTab('other_tasks')}
                                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                                            availableTasksSubTab === 'other_tasks'
                                                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                                                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                        }`}
                                    >
                                        <GlobeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        <span>Other Tasks</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Content Section: Other Tasks Card OR Available Jobs Search + List */}
                    {availableTasksSubTab === 'other_tasks' ? (
                        <OtherTasksCard hideHeader={false} />
                    ) : (
                        <div className="space-y-6">
                            {!hideHeaderAndTabs && (
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
                                            Available Tasks to Complete & Earn USD
                                            <span className="px-3 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-full text-xs font-mono font-bold">
                                                {filteredBrowseableTasks.length} Total
                                            </span>
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">Browse active micro-tasks approved by admin, follow instructions carefully, and earn rewards paid in USD.</p>
                                    </div>
                                </div>
                            )}

                            {/* Filter & Search Bar */}
                    <div className="bg-slate-950/80 p-4 md:p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                            <input 
                                type="text"
                                placeholder="Search task title or description..."
                                value={browseSearch}
                                onChange={(e) => {
                                    setBrowseSearch(e.target.value);
                                    setBrowsePage(1); // Reset page on filter change
                                    if (e.target.value.trim().length > 2) {
                                        seoAnalytics.trackSearchTasks('tasks');
                                    }
                                }}
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium focus:border-amber-500 focus:outline-none text-slate-200 placeholder:text-slate-500"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full md:flex md:items-center md:gap-3 md:w-auto">
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Show:</span>
                                <select 
                                    value={browseItemsPerPage}
                                    onChange={(e) => {
                                        setBrowseItemsPerPage(Number(e.target.value));
                                        setBrowsePage(1);
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] md:text-xs font-bold text-slate-200 focus:border-amber-500 focus:outline-none"
                                >
                                    <option value={10}>10 / page</option>
                                    <option value={15}>15 / page</option>
                                    <option value={30}>30 / page</option>
                                    <option value={50}>50 / page</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Cat:</span>
                                <select 
                                    value={browseCategory}
                                    onChange={(e) => {
                                        setBrowseCategory(e.target.value);
                                        setBrowsePage(1); // Reset page on filter change
                                        seoAnalytics.trackFilterTasks('category');
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] md:text-xs font-bold text-slate-200 focus:border-amber-500 focus:outline-none"
                                >
                                    {['All', 'YouTube', 'Facebook', 'Telegram', 'TikTok', 'Twitter', 'Instagram', 'Custom'].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sort:</span>
                                <select 
                                    value={browseSort}
                                    onChange={(e) => {
                                        setBrowseSort(e.target.value);
                                        setBrowsePage(1); // Reset page on filter change
                                        seoAnalytics.trackFilterTasks('sort');
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] md:text-xs font-bold text-slate-200 focus:border-amber-500 focus:outline-none"
                                >
                                    <option value="latest">⏱️ Latest</option>
                                    <option value="reward-desc">💰 High-Low</option>
                                    <option value="reward-asc">🪙 Low-High</option>
                                    <option value="quantity-desc">👥 Slots</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filteredBrowseableTasks.length === 0 ? (
                        <div className="bg-slate-950/80 rounded-2xl p-10 text-center text-slate-400 shadow-md border border-dashed border-slate-800 font-medium">
                            No active user task campaigns match your search filters. Check back soon!
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                {paginatedBrowseTasks.map(task => {
                                    const alreadySubmitted = mySubmissions.some(s => s.taskId.toString() === task._id.toString());
                                    const progressPercent = Math.min(100, Math.max(0, (task.currentCompletions / (task.targetQuantity || 1)) * 100));
                                    const spotsLeft = Math.max(0, task.targetQuantity - task.currentCompletions);

                                    return (
                                        <div key={task._id} className="bg-slate-950/80 rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800/80 hover:border-amber-500/50 transition-all group flex flex-col justify-between space-y-3.5">
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-[10px] uppercase tracking-wider truncate max-w-[120px]">
                                                        {task.category}
                                                    </span>
                                                    <span className="text-emerald-400 font-extrabold text-sm sm:text-base font-mono">
                                                        +${task.rewardPerTask} USD
                                                    </span>
                                                </div>

                                                <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-amber-300 transition-colors" title={task.title}>
                                                    {task.title}
                                                </h4>

                                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                                    {task.description}
                                                </p>
                                            </div>

                                            <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] sm:text-xs text-slate-400 flex items-center justify-between font-mono">
                                                        <span>Progress: <strong className="text-slate-200 font-bold">{task.currentCompletions}/{task.targetQuantity}</strong></span>
                                                        <span className="text-amber-400 font-bold">
                                                            {spotsLeft > 0 ? `${spotsLeft} left` : 'Full'}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800/50">
                                                        <div 
                                                            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                                                            style={{ width: `${progressPercent}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="pt-1">
                                                    {alreadySubmitted ? (
                                                        <span className="w-full py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 font-mono">
                                                            ✓ Submitted
                                                        </span>
                                                    ) : (
                                                        <button 
                                                            className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
                                                            onClick={() => {
                                                                setSelectedTaskForProof(task);
                                                                setProofStep(1); // Start at step 1 (View Details)
                                                                seoAnalytics.trackViewTask(task._id, task.category);
                                                                setProofText('');
                                                                setProofUsername('');
                                                                setProofUserIdVal('');
                                                                setProofEmail('');
                                                                setProofImage('');
                                                                setSubmittedProofsValues({});
                                                                setProofAgreed(false);
                                                            }}
                                                        >
                                                            <span>View Task & Start</span>
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {renderPagination(browsePage, totalBrowsePages, setBrowsePage)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {/* TAB 3: MY CAMPAIGNS */}
            {activeTab === 'my-tasks' && (() => {
                const activeCampaignsCount = mySubmittedTasks.filter(t => (t.status === 'Approved' || t.status === 'Active') && t.currentCompletions < t.targetQuantity).length;
                const pausedCampaignsCount = mySubmittedTasks.filter(t => t.status === 'On Hold').length;
                const pendingCampaignsCount = mySubmittedTasks.filter(t => t.status === 'Pending').length;
                const completedCampaignsCount = mySubmittedTasks.filter(t => t.status === 'Completed' || t.currentCompletions >= t.targetQuantity).length;
                const rejectedCampaignsCount = mySubmittedTasks.filter(t => t.status === 'Rejected').length;

                if (selectedCampaignForDetail) {
                    const task = selectedCampaignForDetail;
                    
                    // Filter submissions belonging to this task
                    const taskSubmissions = userTaskSubmissions.filter(s => s.taskId?.toString() === task._id?.toString());
                    
                    // Group by selected tab
                    const filteredSubmissions = taskSubmissions.filter(s => {
                        if (detailSubmissionTab === 'Pending') return s.status === 'Pending';
                        if (detailSubmissionTab === 'Approved') return s.status === 'Approved' || s.status === 'Paid';
                        if (detailSubmissionTab === 'Rejected') return s.status === 'Rejected' || s.status === 'Disputed';
                        return true;
                    });

                    // Count for badges on tabs
                    const pendingCount = taskSubmissions.filter(s => s.status === 'Pending').length;
                    const approvedCount = taskSubmissions.filter(s => s.status === 'Approved' || s.status === 'Paid').length;
                    const rejectedCount = taskSubmissions.filter(s => s.status === 'Rejected' || s.status === 'Disputed').length;

                    // Bulk selection array
                    const selectedIds = Object.keys(selectedSubmissions).filter(id => selectedSubmissions[id] && filteredSubmissions.some(s => s._id === id));
                    const isAllSelected = filteredSubmissions.length > 0 && filteredSubmissions.every(s => selectedSubmissions[s._id]);

                    return (
                        <div className="space-y-6">
                            {/* Notice Banner for Pause/Resume Feedback inside Detail View */}
                            {campaignNotice && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-md">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">
                                            {campaignNotice.text.includes('paused') ? '⏸️' : '▶️'}
                                        </span>
                                        <div>
                                            <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">
                                                {campaignNotice.text}
                                            </p>
                                            {campaignNotice.subtext && (
                                                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mt-0.5">
                                                    {campaignNotice.subtext}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCampaignNotice(null)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 font-bold text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border dark:border-gray-700 shadow-sm">
                                <div className="space-y-1">
                                    <button 
                                        onClick={() => setSelectedCampaignForDetail(null)}
                                        className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mb-2"
                                    >
                                        ← Back to My Campaigns
                                    </button>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                        Campaign Workspace Details
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium">Manage submissions, review proofs, reward workers, or delete this campaign.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {/* Pause/Play */}
                                    {(task.status === 'Approved' || task.status === 'Active' || task.status === 'On Hold') && (
                                        <button
                                            onClick={() => handleToggleCampaignStatus(task)}
                                            className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                                                task.status === 'Approved' || task.status === 'Active'
                                                    ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:hover:bg-yellow-900/30 dark:border-yellow-900/40'
                                                    : 'bg-green-50 hover:bg-green-100 text-green-600 border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40'
                                            }`}
                                        >
                                            {task.status === 'Approved' || task.status === 'Active' ? '⏸ Pause Campaign' : '▶ Resume Campaign'}
                                        </button>
                                    )}
                                    {/* Submit for review button */}
                                    {task.status === 'Rejected' && !task.resubmittedForReview && (
                                        <button
                                            onClick={() => {
                                                setSelectedCampaignForReview(task);
                                                setReviewExplanation('');
                                            }}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/10"
                                        >
                                            🔄 Submit for Review
                                        </button>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (await handleDeleteCampaign(task._id)) {
                                                setSelectedCampaignForDetail(null);
                                            }
                                        }}
                                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/10"
                                    >
                                        🗑 Delete Campaign
                                    </button>
                                </div>
                            </div>

                            {/* Campaign Info Grid (Dual-Panel Bento Layout) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Left Panel: Identity, URL Access & Core Instructions (Col span 2) */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="p-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-md text-xs">📋</span>
                                            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400">Campaign Details & Directives</h4>
                                        </div>

                                        <div className="space-y-3.5">
                                            {/* Campaign Title */}
                                            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/40">
                                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Campaign Title</span>
                                                <h4 className="text-sm font-black text-gray-900 dark:text-white mt-0.5 break-words">{task.title}</h4>
                                            </div>

                                            {/* Target URL with Visiting & Copying Actions */}
                                            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/40">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Campaign Landing URL / Target Link</span>
                                                    <span 
                                                        onClick={() => handleCopyCampaignLink(task.link)}
                                                        className="text-[10px] font-black text-blue-500 hover:underline cursor-pointer"
                                                    >
                                                        {copiedCampaignLink ? '✅ Copied!' : '📋 Copy URL'}
                                                    </span>
                                                </div>
                                                <p className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold break-all select-all">{task.link}</p>
                                                <div className="mt-2.5 flex gap-2">
                                                    <a 
                                                        href={task.link} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 rounded-xl text-xs font-bold transition-all"
                                                    >
                                                        🚀 Visit Landing Page
                                                    </a>
                                                    <button 
                                                        onClick={() => handleCopyCampaignLink(task.link)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/60 dark:hover:bg-gray-700 dark:border-gray-600 rounded-xl text-xs font-bold transition-all"
                                                    >
                                                        📋 {copiedCampaignLink ? 'Link Copied!' : 'Copy to Clipboard'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Complete Instructions & Description */}
                                            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/40">
                                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instructions to Workers</span>
                                                <div className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-2">
                                                    {task.description || 'No specific instructions provided.'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel: Budgets, Slots, Status & Proof Criteria */}
                                <div className="space-y-4">
                                    {/* Financials & Progress Box */}
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="p-1 bg-green-50 dark:bg-green-950/40 text-green-600 rounded-md text-xs">💸</span>
                                            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 font-mono">Financials & Slots</h4>
                                        </div>

                                        <div className="space-y-3 text-xs font-bold">
                                            {(() => {
                                                const fin = getCampaignFin(task);
                                                return (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                            <span className="text-gray-400 text-[10px] block font-medium uppercase">Rate Per Task</span>
                                                            <p className="font-black text-emerald-500 font-mono text-sm mt-0.5">+{task.rewardPerTask} USD</p>
                                                        </div>
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                            <span className="text-gray-400 text-[10px] block font-medium uppercase">Completed slots</span>
                                                            <p className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm mt-0.5">{task.currentCompletions} / {task.targetQuantity}</p>
                                                        </div>
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                            <span className="text-gray-400 text-[10px] block font-medium uppercase">Worker Rewards Budget</span>
                                                            <p className="font-bold text-gray-900 dark:text-white font-mono text-sm mt-0.5">${fin.subtotal.toFixed(2)} USD</p>
                                                        </div>
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                            <span className="text-gray-400 text-[10px] block font-medium uppercase">Admin Commission</span>
                                                            <p className="font-bold text-gray-900 dark:text-white font-mono text-sm mt-0.5">${fin.adminCommission.toFixed(2)} USD</p>
                                                        </div>
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                            <span className="text-gray-400 text-[10px] block font-medium uppercase">Slots + Commission Budget</span>
                                                            <p className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm mt-0.5">${fin.slotsAndCommissionBudget.toFixed(2)} USD</p>
                                                        </div>
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                            <span className="text-gray-400 text-[10px] block font-medium uppercase">Campaign Creation Fee</span>
                                                            <p className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-sm mt-0.5">${fin.campaignCreationFee.toFixed(2)} USD</p>
                                                        </div>
                                                        <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-900/50 col-span-2">
                                                            <span className="text-purple-600 dark:text-purple-300 text-[10px] block font-extrabold uppercase tracking-wider">Total Campaign Launch Cost</span>
                                                            <p className="font-black text-purple-700 dark:text-purple-200 font-mono text-base mt-0.5">${fin.grandTotalLaunchCost.toFixed(2)} USD</p>
                                                        </div>
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30 col-span-2">
                                                            <span className="text-gray-400 text-[10px] block font-medium uppercase">Created Date & Time</span>
                                                            <p className="font-bold text-gray-900 dark:text-white text-xs mt-0.5">
                                                                {task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className="pt-2 border-t dark:border-gray-700 flex justify-between items-center text-xs">
                                                <span className="text-gray-400 font-medium uppercase text-[10px]">Campaign Status</span>
                                                <div>
                                                    {task.status === 'Approved' ? (
                                                        <Badge variant="success">🟢 Active</Badge>
                                                    ) : task.status === 'On Hold' ? (
                                                        <Badge variant="warning">🟡 Paused</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">{task.status}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Proof Requirements Criteria */}
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="p-1 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 rounded-md text-xs">🔒</span>
                                            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400">Required Proof Criteria</h4>
                                        </div>

                                        <div className="space-y-3.5 text-xs">
                                            {/* Screenshot Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireScreenshot ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    {task.requireScreenshot ? '📸' : '📷'}
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Screenshot Proof
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireScreenshot ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireScreenshot ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireScreenshot && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.screenshotInstruction || 'Please upload screenshot proof of completion.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Text Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireTextProof ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    ✍
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Text Answer / Code
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireTextProof ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireTextProof ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireTextProof && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.textProofInstruction || 'Please enter confirmation text.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Username Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireUsername ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    👤
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Worker Username
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireUsername ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireUsername ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireUsername && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.usernameInstruction || 'Please provide your account username.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* User ID Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireUserId ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    🆔
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Platform User ID
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireUserId ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireUserId ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireUserId && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.userIdInstruction || 'Please provide your profile ID.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Email Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireEmail ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    ✉
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Email Address
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireEmail ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireEmail ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireEmail && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.emailInstruction || 'Please provide email address.'}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Campaign Status History Log */}
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="p-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-md text-xs">📜</span>
                                            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400">Campaign History Log</h4>
                                        </div>
                                        {task.history && Array.isArray(task.history) && task.history.length > 0 ? (
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                {task.history.slice().reverse().map((h: any, idx: number) => (
                                                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30 text-xs flex justify-between items-center">
                                                        <div>
                                                            <span className="font-bold text-gray-900 dark:text-white block">{h.action}</span>
                                                            <span className="text-[10px] text-gray-500">{h.details || `Status changed from ${h.previousStatus} to ${h.newStatus}`}</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">No historical status logs recorded yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Submissions Manager */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="p-6 border-b dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h4 className="font-black text-sm uppercase text-gray-900 dark:text-white tracking-tight">Worker Task Submissions</h4>
                                        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Click any worker row to inspect detailed screenshot and text proof, then approve/reject.</p>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl border dark:border-gray-700">
                                        {(['Pending', 'Approved', 'Rejected'] as const).map(tab => {
                                            const count = tab === 'Pending' ? pendingCount : tab === 'Approved' ? approvedCount : rejectedCount;
                                            return (
                                                <button
                                                    key={tab}
                                                    onClick={() => {
                                                        setDetailSubmissionTab(tab);
                                                        setSelectedSubmissions({});
                                                    }}
                                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                                        detailSubmissionTab === tab
                                                            ? 'bg-blue-600 text-white shadow-md'
                                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                                    }`}
                                                >
                                                    {tab === 'Pending' ? '⏳' : tab === 'Approved' ? '✅' : '❌'} {tab} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Bulk Action Bar if items are selected */}
                                {selectedIds.length > 0 && detailSubmissionTab === 'Pending' && (
                                    <div className="bg-blue-50 dark:bg-blue-950/40 border-b dark:border-blue-900/50 p-4 flex justify-between items-center animate-in slide-in-from-top duration-200">
                                        <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
                                            Selected <strong className="font-black">{selectedIds.length}</strong> submission(s)
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleBulkApprove(selectedIds)}
                                                className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-green-600/10"
                                            >
                                                ✔ Bulk Approve
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRejectingSubId('bulk');
                                                    setRejectionFeedback('');
                                                }}
                                                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/10"
                                            >
                                                ✖ Bulk Reject
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Submissions list */}
                                {filteredSubmissions.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500 font-medium text-xs">
                                        No {detailSubmissionTab.toLowerCase()} submissions found for this campaign.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 dark:bg-gray-900/30 text-gray-400 uppercase text-[10px] tracking-wider border-b dark:border-gray-700">
                                                    {detailSubmissionTab === 'Pending' && (
                                                        <th className="p-4 w-12 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isAllSelected}
                                                                onChange={(e) => {
                                                                    const val = e.target.checked;
                                                                    const updated = { ...selectedSubmissions };
                                                                    filteredSubmissions.forEach(s => {
                                                                        updated[s._id] = val;
                                                                    });
                                                                    setSelectedSubmissions(updated);
                                                                }}
                                                                className="rounded border-gray-300 dark:border-gray-700 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                            />
                                                        </th>
                                                    )}
                                                    <th className="p-4 w-16 text-center"># Sequence</th>
                                                    <th className="p-4">Worker Name</th>
                                                    <th className="p-4">Submitted At</th>
                                                    <th className="p-4">Submission Status</th>
                                                    <th className="p-4 text-right">Action Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium animate-in fade-in duration-200">
                                                {filteredSubmissions.map((sub, idx) => (
                                                    <tr 
                                                        key={sub._id} 
                                                        onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 cursor-pointer transition-colors"
                                                    >
                                                        {detailSubmissionTab === 'Pending' && (
                                                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!selectedSubmissions[sub._id]}
                                                                    onChange={(e) => {
                                                                        setSelectedSubmissions({
                                                                            ...selectedSubmissions,
                                                                            [sub._id]: e.target.checked
                                                                        });
                                                                    }}
                                                                    className="rounded border-gray-300 dark:border-gray-700 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="p-4 font-mono font-bold text-gray-400 text-center">{idx + 1}</td>
                                                        <td className="p-4 text-gray-900 dark:text-white font-bold">{sub.workerName}</td>
                                                        <td className="p-4 text-gray-500 text-xs">{new Date(sub.createdAt).toLocaleString()}</td>
                                                        <td className="p-4">
                                                            {(sub.isAutoApproved || sub.autoApproved || sub.approvalType === 'auto' || (sub.adminNotes && sub.adminNotes.toLowerCase().includes('auto-approved'))) ? (
                                                                <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-sm flex items-center gap-1 inline-flex">
                                                                    ⚡ Auto Approved
                                                                </span>
                                                            ) : sub.status === 'Approved' || sub.status === 'Paid' ? (
                                                                <Badge variant="success">Approved</Badge>
                                                            ) : sub.status === 'Pending' ? (
                                                                <Badge variant="warning">Pending Review</Badge>
                                                            ) : sub.status === 'Disputed' || sub.disputeOpened ? (
                                                                sub.disputeStage === 'Escalated' ? (
                                                                    <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-sm flex items-center gap-1 inline-flex">
                                                                        ⚖️ Disputed with Admin
                                                                    </span>
                                                                ) : (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-sm flex items-center gap-1 inline-flex">
                                                                            🤝 Disputed by Worker
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                                            ⏰ Auto-approves: {getRemainingTimeString(sub.disputeReviewDeadline || (sub.updatedAt || sub.createdAt ? new Date(new Date(sub.updatedAt || sub.createdAt).getTime() + (settings?.systemLimits?.disputeReviewTimeoutDays ?? 3) * 86400000) : null)) || '3 days'}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            ) : (
                                                                <Badge variant="danger">Rejected</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex justify-end gap-2">
                                                                {sub.status === 'Pending' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleApproveSubmission(sub._id)}
                                                                            className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                                        >
                                                                            ✔ Accept
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setRejectingSubId(sub._id);
                                                                                setRejectionFeedback('');
                                                                            }}
                                                                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:border-red-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                                        >
                                                                            ✖ Reject
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                                >
                                                                    👁 View Detail
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="space-y-6">
                        {/* ========================================================================= */}
                        {/* CAMPAIGN FUNDS & TRANSFER BALANCE SUMMARY CARD WITH BREAKDOWN & AMOUNT TRAIL */}
                        {/* ========================================================================= */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-xl border dark:border-gray-700/80 space-y-4 sm:space-y-6">
                            {/* Card Header & Quick Actions */}
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 pb-3.5 sm:pb-5 border-b border-gray-100 dark:border-gray-700/60">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                        <span className="p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl text-base sm:text-lg">
                                            📢
                                        </span>
                                        <h3 className="text-base sm:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                            Campaign Finances & Capital Overview
                                        </h3>
                                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-[10px] sm:text-[11px] rounded-lg sm:rounded-xl font-mono uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                                            Base = $ USD
                                        </span>
                                    </div>
                                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium pl-0.5">
                                        Complete audit of campaign capital, funding sources, active escrow, expenditures, and available balance.
                                    </p>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-stretch sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setShowTransferModal(true)}
                                        className="flex-1 sm:flex-none px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1"
                                    >
                                        <span>📥 Deposit / Transfer</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowConvertModal(true)}
                                        className="flex-1 sm:flex-none px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-1"
                                    >
                                        <span>🔄 Convert</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAnalyticsModal(true)}
                                        className="flex-1 sm:flex-none px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border border-purple-200 dark:border-purple-800 flex items-center justify-center gap-1"
                                    >
                                        <span>📊 Analytics</span>
                                    </button>
                                </div>
                            </div>

                            {/* Compact Mobile-Friendly Campaign Financial Metrics Grid */}
                            <div className="space-y-2 sm:space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-1.5 sm:gap-2">
                                    <span className="text-[11px] sm:text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-1">
                                        💳 Campaign Wallet & Funding Overview
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400">
                                        Synced with Work & Earn Hub
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                                    {/* Card 1: Transfer from Deposit & Investment */}
                                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/60 dark:to-teal-950/40 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-between shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] sm:text-[9px] font-black text-emerald-600 dark:text-emerald-300 uppercase tracking-wider leading-tight">Deposit & Investment</span>
                                            <span className="text-xs">📈</span>
                                        </div>
                                        <div className="text-sm sm:text-base md:text-lg font-black text-emerald-600 dark:text-emerald-300 font-mono mt-1 sm:mt-1.5">
                                            ${depositAndInvestmentUSD.toFixed(2)}
                                        </div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-emerald-600/80 dark:text-emerald-300/80 mt-0.5 sm:mt-1 truncate">
                                            To Campaign
                                        </div>
                                    </div>

                                    {/* Card 2: Transfer from Task Earnings */}
                                    <div className="bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 dark:from-purple-950/60 dark:to-fuchsia-950/40 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-purple-200 dark:border-purple-800/60 flex flex-col justify-between shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] sm:text-[9px] font-black text-purple-600 dark:text-purple-300 uppercase tracking-wider leading-tight">Task Earnings</span>
                                            <span className="text-xs">🔄</span>
                                        </div>
                                        <div className="text-sm sm:text-base md:text-lg font-black text-purple-600 dark:text-purple-300 font-mono mt-1 sm:mt-1.5">
                                            ${taskEarningsTransferredUSD.toFixed(2)}
                                        </div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-purple-600/80 dark:text-purple-300/80 mt-0.5 sm:mt-1 truncate">
                                            To Campaign
                                        </div>
                                    </div>

                                    {/* Card 3: Total Funding Transferred */}
                                    <div className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 dark:from-teal-950/60 dark:to-cyan-950/40 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-teal-200 dark:border-teal-800/60 flex flex-col justify-between shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] sm:text-[9px] font-black text-teal-600 dark:text-teal-300 uppercase tracking-wider leading-tight">Total Inflow</span>
                                            <span className="text-xs">📥</span>
                                        </div>
                                        <div className="text-sm sm:text-base md:text-lg font-black text-teal-600 dark:text-teal-300 font-mono mt-1 sm:mt-1.5">
                                            ${totalTransferredInUSD.toFixed(2)}
                                        </div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-teal-600/80 dark:text-teal-300/80 mt-0.5 sm:mt-1 truncate">
                                            Total Funding
                                        </div>
                                    </div>

                                    {/* Card 4: Used / Spent in Campaign */}
                                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-950/60 dark:to-orange-950/40 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-amber-200 dark:border-amber-800/60 flex flex-col justify-between shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] sm:text-[9px] font-black text-amber-600 dark:text-amber-300 uppercase tracking-wider leading-tight">Budget Deployed</span>
                                            <span className="text-xs">🛒</span>
                                        </div>
                                        <div className="text-sm sm:text-base md:text-lg font-black text-amber-600 dark:text-amber-300 font-mono mt-1 sm:mt-1.5">
                                            ${campaignPurchasesUSD.toFixed(2)}
                                        </div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-amber-600/80 dark:text-amber-300/80 mt-0.5 sm:mt-1 truncate">
                                            Used in Campaigns
                                        </div>
                                    </div>

                                    {/* Card 5: Remaining Available Campaign Balance */}
                                    <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-950/60 dark:to-blue-950/40 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-indigo-200 dark:border-indigo-800/60 flex flex-col justify-between shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] sm:text-[9px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-wider leading-tight">Remaining Funds</span>
                                            <span className="text-xs">💰</span>
                                        </div>
                                        <div className="text-sm sm:text-base md:text-lg font-black text-indigo-900 dark:text-indigo-100 font-mono mt-1 sm:mt-1.5">
                                            ${availableTransferBalanceUSD.toFixed(2)}
                                        </div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-indigo-600/80 dark:text-indigo-300/80 mt-0.5 sm:mt-1 truncate">
                                            Available Balance
                                        </div>
                                    </div>

                                    {/* Card 6: Live Escrow Reserved */}
                                    <div className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 dark:from-sky-950/60 dark:to-blue-950/40 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-sky-200 dark:border-sky-800/60 flex flex-col justify-between shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] sm:text-[9px] font-black text-sky-600 dark:text-sky-300 uppercase tracking-wider leading-tight">Escrow Reserved</span>
                                            <span className="text-xs">🛡️</span>
                                        </div>
                                        <div className="text-sm sm:text-base md:text-lg font-black text-sky-600 dark:text-sky-300 font-mono mt-1 sm:mt-1.5">
                                            ${activeCampaignEscrowUSD.toFixed(2)}
                                        </div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-sky-600/80 dark:text-sky-300/80 mt-0.5 sm:mt-1 truncate" title="Locked for active spots & review proofs">
                                            Locked for proofs
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Campaign Status Records Grid */}
                            <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
                                <div className="flex items-center justify-between flex-wrap gap-1.5 sm:gap-2">
                                    <span className="text-[11px] sm:text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-1">
                                        📂 My Created Task Campaigns Status
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400">
                                        {mySubmittedTasks.length} Total Campaigns
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5">
                                    {/* Status 1: Active / Running */}
                                    <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-lg sm:rounded-xl border border-emerald-500/20 flex flex-col justify-between">
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 truncate">Active / Running</span>
                                        <div className="text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 sm:mt-1">
                                            {mySubmittedTasks.filter(t => t.status === 'Approved' || t.status === 'Active' || t.status === 'Running').length}
                                        </div>
                                    </div>

                                    {/* Status 2: Paused / Non-Active */}
                                    <div className="p-2 sm:p-3 bg-amber-500/10 rounded-lg sm:rounded-xl border border-amber-500/20 flex flex-col justify-between">
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 truncate">Paused</span>
                                        <div className="text-sm sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5 sm:mt-1">
                                            {mySubmittedTasks.filter(t => t.status === 'Paused' || t.status === 'Inactive' || t.status === 'On Hold').length}
                                        </div>
                                    </div>

                                    {/* Status 3: Pending Approval */}
                                    <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg sm:rounded-xl border border-blue-500/20 flex flex-col justify-between">
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 truncate">Pending</span>
                                        <div className="text-sm sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5 sm:mt-1">
                                            {mySubmittedTasks.filter(t => t.status === 'Pending' || t.status === 'In Review').length}
                                        </div>
                                    </div>

                                    {/* Status 4: Approved */}
                                    <div className="p-2 sm:p-3 bg-teal-500/10 rounded-lg sm:rounded-xl border border-teal-500/20 flex flex-col justify-between">
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase text-teal-600 dark:text-teal-400 truncate">Approved</span>
                                        <div className="text-sm sm:text-lg font-black text-teal-600 dark:text-teal-400 font-mono mt-0.5 sm:mt-1">
                                            {mySubmittedTasks.filter(t => t.status === 'Approved').length}
                                        </div>
                                    </div>

                                    {/* Status 5: Completed */}
                                    <div className="p-2 sm:p-3 bg-purple-500/10 rounded-lg sm:rounded-xl border border-purple-500/20 flex flex-col justify-between">
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 truncate">Completed</span>
                                        <div className="text-sm sm:text-lg font-black text-purple-600 dark:text-purple-400 font-mono mt-0.5 sm:mt-1">
                                            {mySubmittedTasks.filter(t => t.status === 'Completed').length}
                                        </div>
                                    </div>

                                    {/* Status 6: Rejected / Deleted */}
                                    <div className="p-2 sm:p-3 bg-rose-500/10 rounded-lg sm:rounded-xl border border-rose-500/20 flex flex-col justify-between">
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase text-rose-600 dark:text-rose-400 truncate">Rejected</span>
                                        <div className="text-sm sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 sm:mt-1">
                                            {mySubmittedTasks.filter(t => t.status === 'Rejected' || t.status === 'Deleted').length}
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Notice Banner for Pause/Resume Feedback */}
                        {campaignNotice && (
                            <div className="p-2.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <span className="text-xl sm:text-2xl">
                                        {campaignNotice.text.includes('paused') ? '⏸️' : '▶️'}
                                    </span>
                                    <div>
                                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">
                                            {campaignNotice.text}
                                        </p>
                                        {campaignNotice.subtext && (
                                            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 font-medium mt-0.5">
                                                {campaignNotice.subtext}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    {myCampaignFilter !== 'paused' && campaignNotice.text.includes('paused') && (
                                        <button
                                            onClick={() => {
                                                setMyCampaignFilter('paused');
                                                setMyCampaignsPage(1);
                                            }}
                                            className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                                        >
                                            View Paused
                                        </button>
                                    )}
                                    {myCampaignFilter !== 'approved' && campaignNotice.text.includes('resumed') && (
                                        <button
                                            onClick={() => {
                                                setMyCampaignFilter('approved');
                                                setMyCampaignsPage(1);
                                            }}
                                            className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                                        >
                                            View Active
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setCampaignNotice(null)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 font-bold text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Filter & Search Bar */}
                        <div className="bg-white dark:bg-gray-800 p-2.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl shadow-md border dark:border-gray-700/60 space-y-2.5 sm:space-y-3.5">
                            {/* Row 1: Status Filters */}
                            <div className="flex flex-wrap gap-1 sm:gap-2 w-full">
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('all');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                                        myCampaignFilter === 'all'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    🌍 All ({mySubmittedTasks.length})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('pending');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                                        myCampaignFilter === 'pending'
                                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    ⏳ Pending ({pendingCampaignsCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('approved');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                                        myCampaignFilter === 'approved'
                                            ? 'bg-green-600 text-white shadow-md shadow-green-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    🟢 Active ({activeCampaignsCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('paused');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                                        myCampaignFilter === 'paused'
                                            ? 'bg-yellow-500 text-white shadow-md shadow-yellow-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    ⏸ Paused ({pausedCampaignsCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('completed');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                                        myCampaignFilter === 'completed'
                                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    🏆 Completed ({completedCampaignsCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('rejected');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                                        myCampaignFilter === 'rejected'
                                            ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    ❌ Rejected ({rejectedCampaignsCount})
                                </button>
                            </div>

                            {/* Row 2: Search & Per Page Filter */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700/60">
                                <div className="relative w-full sm:w-80">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                    <input 
                                        type="text"
                                        placeholder="Search campaign title..."
                                        value={myCampaignsSearch}
                                        onChange={(e) => {
                                            setMyCampaignsSearch(e.target.value);
                                            setMyCampaignsPage(1);
                                        }}
                                        className="w-full pl-8 pr-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
                                    <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Show:</span>
                                    <select 
                                        value={myCampaignsItemsPerPage}
                                        onChange={(e) => {
                                            setMyCampaignsItemsPerPage(Number(e.target.value));
                                            setMyCampaignsPage(1);
                                        }}
                                        className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-gray-200 cursor-pointer"
                                    >
                                        <option value={10}>10 per page</option>
                                        <option value={15}>15 per page</option>
                                        <option value={25}>25 per page</option>
                                        <option value={50}>50 per page</option>
                                        <option value={100}>100 per page</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {filteredMyCampaignsList.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center text-gray-500 shadow-md border dark:border-gray-700 font-medium text-xs sm:text-sm">
                                No task campaigns found matching this filter.
                            </div>
                        ) : (
                            <div className="space-y-3 sm:space-y-4">
                                {/* Mobile Compact Cards View (< md) */}
                                <div className="block md:hidden space-y-2">
                                    {paginatedMyCampaigns.map(task => {
                                        const fin = getCampaignFin(task);
                                        const taskUrl = task.link || (task as any).targetUrl || (task as any).url || '';
                                        const taskInstructions = task.description || (task as any).instructions || (task as any).proofInstructions || '';

                                        return (
                                            <div 
                                                key={task._id} 
                                                className="bg-white dark:bg-gray-800 rounded-xl p-2.5 sm:p-3 border border-gray-200/90 dark:border-gray-700/80 shadow-xs space-y-2"
                                            >
                                                {/* Header Row: Title & Status */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                        <div className="flex items-center gap-1 text-[9px] text-gray-400 font-semibold truncate">
                                                            <span>{task.category}</span>
                                                            <span>•</span>
                                                            <span>{task.subType}</span>
                                                        </div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white text-xs leading-snug line-clamp-1">
                                                            {task.title}
                                                        </h4>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {task.currentCompletions >= task.targetQuantity || task.status === 'Completed' ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                Completed
                                                            </span>
                                                        ) : task.status === 'Approved' || task.status === 'Active' ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800">
                                                                Active
                                                            </span>
                                                        ) : task.status === 'On Hold' ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800">
                                                                Paused
                                                            </span>
                                                        ) : task.status === 'Pending' ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                {task.reviewRequested ? 'Under Review' : 'Pending'}
                                                            </span>
                                                        ) : task.status === 'Rejected' ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                                                                Rejected
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                                {task.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Specs & Budget Strip */}
                                                <div className="flex items-center justify-between gap-1 text-[10px] bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-800 font-mono">
                                                    <div>
                                                        <span className="text-gray-400 font-sans">Budget: </span>
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">${fin.grandTotalLaunchCost.toFixed(2)} USD</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400 font-sans">Slots: </span>
                                                        <span className="text-gray-700 dark:text-gray-300 font-bold">{task.currentCompletions}/{task.targetQuantity}</span>
                                                    </div>
                                                </div>

                                                {/* Campaign URL Link */}
                                                {taskUrl && (
                                                    <div className="flex items-center gap-1.5 text-[9.5px] bg-blue-50/60 dark:bg-blue-950/30 px-2 py-1 rounded-lg border border-blue-100/80 dark:border-blue-900/40 min-w-0">
                                                        <span className="text-blue-600 dark:text-blue-400 font-black shrink-0 text-[8.5px] uppercase tracking-wider">URL:</span>
                                                        <a 
                                                            href={taskUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 dark:text-blue-400 font-medium truncate flex-1 hover:underline font-mono"
                                                            title={taskUrl}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {taskUrl}
                                                        </a>
                                                        <a
                                                            href={taskUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="shrink-0 text-blue-500 hover:text-blue-700 text-[10px] font-bold px-0.5"
                                                            title="Open URL in new tab"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            ↗
                                                        </a>
                                                    </div>
                                                )}

                                                {/* Campaign Instructions */}
                                                {taskInstructions && (
                                                    <div className="text-[9.5px] text-gray-600 dark:text-gray-300 bg-gray-50/80 dark:bg-gray-900/40 px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-800/80 leading-snug">
                                                        <span className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider text-[8px] mr-1">Instructions:</span>
                                                        <span className="line-clamp-2">{taskInstructions}</span>
                                                    </div>
                                                )}

                                                {/* Rejection notice if present */}
                                                {task.status === 'Rejected' && task.adminNotes && (
                                                    <p className="text-[9px] text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 p-1.5 rounded border border-red-100 dark:border-red-900/30 leading-tight">
                                                        Note: {task.adminNotes}
                                                    </p>
                                                )}

                                                {/* Actions Row */}
                                                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                                                    {(task.status === 'Approved' || task.status === 'Active' || task.status === 'On Hold') && (
                                                        <button
                                                            onClick={() => handleToggleCampaignStatus(task)}
                                                            className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider transition-all ${
                                                                task.status === 'Approved' || task.status === 'Active'
                                                                    ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/40 dark:text-yellow-400'
                                                                    : 'bg-green-50 hover:bg-green-100 text-green-600 border-green-200 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-400'
                                                            }`}
                                                        >
                                                            {task.status === 'Approved' || task.status === 'Active' ? '⏸ Pause' : '▶ Resume'}
                                                        </button>
                                                    )}

                                                    {task.status === 'Rejected' && !task.resubmittedForReview && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCampaignForReview(task);
                                                                setReviewExplanation('');
                                                            }}
                                                            className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider"
                                                        >
                                                            🔄 Review
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            setSelectedCampaignForDetail(task);
                                                            seoAnalytics.trackViewTask(task._id, task.category);
                                                            setDetailSubmissionTab('Pending');
                                                            setSelectedSubmissions({});
                                                        }}
                                                        className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider"
                                                    >
                                                        👁 Details
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteCampaign(task._id)}
                                                        className="px-2 py-0.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400 text-[9px] font-black uppercase tracking-wider"
                                                    >
                                                        🗑 Del
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop Table View (>= md) */}
                                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                    <th className="p-3.5 md:p-5">Campaign & Details</th>
                                                    <th className="p-3.5 md:p-5">Category</th>
                                                    <th className="p-3.5 md:p-5">Budget (USD)</th>
                                                    <th className="p-3.5 md:p-5">Progress</th>
                                                    <th className="p-3.5 md:p-5">Status</th>
                                                    <th className="p-3.5 md:p-5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                                {paginatedMyCampaigns.map(task => {
                                                    const taskUrl = task.link || (task as any).targetUrl || (task as any).url || '';
                                                    const taskInstructions = task.description || (task as any).instructions || (task as any).proofInstructions || '';

                                                    return (
                                                    <tr key={task._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                        <td className="p-3.5 md:p-5">
                                                            <div className="space-y-1 max-w-sm">
                                                                <div className="text-gray-900 dark:text-white font-bold text-sm leading-snug">{task.title}</div>
                                                                {taskUrl && (
                                                                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                                                                        <span className="text-[10px] font-extrabold uppercase text-gray-400">URL:</span>
                                                                        <a 
                                                                            href={taskUrl} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="hover:underline truncate max-w-xs inline-block font-mono text-[11px]"
                                                                            title={taskUrl}
                                                                        >
                                                                            {taskUrl}
                                                                        </a>
                                                                        <span className="text-[10px]">↗</span>
                                                                    </div>
                                                                )}
                                                                {taskInstructions && (
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-sm" title={taskInstructions}>
                                                                        <span className="text-[10px] font-bold uppercase text-gray-400 mr-1">Instructions:</span>
                                                                        {taskInstructions}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3.5 md:p-5 text-gray-500">{task.category} ({task.subType})</td>
                                                        <td className="p-3.5 md:p-5 font-mono">
                                                            {(() => {
                                                                const fin = getCampaignFin(task);
                                                                return (
                                                                    <div>
                                                                        <span className="text-emerald-500 font-bold block">${fin.grandTotalLaunchCost.toFixed(2)} USD</span>
                                                                        <span className="text-[10px] text-gray-400 block font-normal">
                                                                            (Budget: ${fin.slotsAndCommissionBudget.toFixed(2)} + Fee: ${fin.campaignCreationFee.toFixed(2)})
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="p-3.5 md:p-5 text-gray-500">{task.currentCompletions} / {task.targetQuantity}</td>
                                                        <td className="p-3.5 md:p-5">
                                                            <div className="space-y-1">
                                                                {task.currentCompletions >= task.targetQuantity || task.status === 'Completed' ? (
                                                                    <Badge variant="success">✅ Completed</Badge>
                                                                ) : task.status === 'Approved' || task.status === 'Active' ? (
                                                                    <Badge variant="success">🟢 Active</Badge>
                                                                ) : task.status === 'On Hold' ? (
                                                                    <Badge variant="warning">🟡 Paused</Badge>
                                                                ) : task.status === 'Pending' ? (
                                                                    task.reviewRequested ? (
                                                                        <Badge variant="warning">🔄 Under Review</Badge>
                                                                    ) : (
                                                                        <Badge variant="warning">⏳ Pending Approval</Badge>
                                                                    )
                                                                ) : task.status === 'Rejected' ? (
                                                                    <div className="flex flex-col gap-1 items-start">
                                                                        <Badge variant="danger">❌ Rejected</Badge>
                                                                        {task.resubmittedForReview ? (
                                                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Review Closed</span>
                                                                        ) : (
                                                                            <span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">Review Eligible</span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <Badge variant="danger">{task.status}</Badge>
                                                                )}
                                                                {task.status === 'Rejected' && task.adminNotes && (
                                                                    <p className="text-[10px] text-red-500 max-w-[150px] font-medium leading-tight mt-1">
                                                                        Reason: {task.adminNotes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3.5 md:p-5 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                {/* Pause / Play Button */}
                                                                {(task.status === 'Approved' || task.status === 'Active' || task.status === 'On Hold') && (
                                                                    <button
                                                                        onClick={() => handleToggleCampaignStatus(task)}
                                                                        title={task.status === 'Approved' || task.status === 'Active' ? "Pause Campaign" : "Resume Campaign"}
                                                                        className={`p-1.5 md:p-2 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center ${
                                                                            task.status === 'Approved' || task.status === 'Active'
                                                                                ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:hover:bg-yellow-900/30 dark:border-yellow-900/40 dark:text-yellow-400'
                                                                                : 'bg-green-50 hover:bg-green-100 text-green-600 border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40 dark:text-green-400'
                                                                        }`}
                                                                    >
                                                                        {task.status === 'Approved' || task.status === 'Active' ? '⏸ Pause' : '▶ Resume'}
                                                                    </button>
                                                                )}

                                                                {/* Submit for Review Button */}
                                                                {task.status === 'Rejected' && !task.resubmittedForReview && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedCampaignForReview(task);
                                                                            setReviewExplanation('');
                                                                        }}
                                                                        title="Submit Campaign for Admin Review"
                                                                        className="p-1.5 md:p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 dark:border-indigo-900/40 dark:text-indigo-400 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                                                                    >
                                                                        🔄 Review
                                                                    </button>
                                                                )}

                                                                {/* Detail Button */}
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedCampaignForDetail(task);
                                                                        seoAnalytics.trackViewTask(task._id, task.category);
                                                                        setDetailSubmissionTab('Pending');
                                                                        setSelectedSubmissions({});
                                                                    }}
                                                                    title="Campaign Workspace Details"
                                                                    className="p-1.5 md:p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 dark:text-blue-400 transition-all text-xs font-bold uppercase tracking-wider"
                                                                >
                                                                    👁 Detail
                                                                </button>

                                                                {/* Delete Button */}
                                                                <button
                                                                    onClick={() => handleDeleteCampaign(task._id)}
                                                                    title="Delete Campaign"
                                                                    className="p-1.5 md:p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:border-red-900/40 dark:text-red-400 transition-all text-xs font-bold uppercase tracking-wider"
                                                                >
                                                                    🗑 Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {renderPagination(myCampaignsPage, totalMyCampaignsPages, setMyCampaignsPage)}
                            </div>
                        )}
                    </div>
                );
            })()}

             {/* TAB: PENDING PAYMENT TASKS */}
            {activeTab === 'pending-payment' && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Pending Review Tasks & Proofs</h3>
                            <p className="text-xs text-gray-500 mt-1">Review proofs you have submitted that are currently awaiting review by the campaign creators.</p>
                        </div>
                        <div className="relative w-full md:w-72">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input 
                                type="text"
                                placeholder="Search pending tasks..."
                                value={pendingSearch}
                                onChange={(e) => {
                                    setPendingSearch(e.target.value);
                                    setPendingPage(1);
                                }}
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {filteredPendingSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No pending tasks found matching your search. Complete available tasks to await campaign creator review.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                <th className="p-3.5 md:p-5">Task</th>
                                                <th className="p-3.5 md:p-5">Proof Details</th>
                                                <th className="p-3.5 md:p-5">Pending Reward</th>
                                                <th className="p-3.5 md:p-5">Auto-Approval Timer</th>
                                                <th className="p-3.5 md:p-5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                            {paginatedPendingSubmissions.map(sub => {
                                                const autoApproveAt = sub.autoApproveAt || (sub.createdAt ? new Date(new Date(sub.createdAt).getTime() + (settings?.systemLimits?.approvalTimeoutDays ?? 3) * 86400000) : null);
                                                const remTime = autoApproveAt ? getRemainingTimeString(autoApproveAt) : null;

                                                return (
                                                    <tr 
                                                        key={sub._id} 
                                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 cursor-pointer transition-colors"
                                                        onClick={() => setSelectedSubmissionForDetails(sub)}
                                                        title="Click to view details"
                                                    >
                                                        <td className="p-3.5 md:p-5 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                        <td className="p-3.5 md:p-5 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                        <td className="p-3.5 md:p-5 font-mono text-orange-500 font-bold">+{sub.rewardAmount} USD</td>
                                                        <td className="p-3.5 md:p-5">
                                                            <span className="inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-lg border bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[11px] whitespace-nowrap shadow-sm">
                                                                ⏰ {remTime && remTime !== 'Expired' ? remTime : `${settings?.systemLimits?.approvalTimeoutDays ?? 3} days remaining`}
                                                            </span>
                                                        </td>
                                                        <td className="p-3.5 md:p-5 text-right">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedSubmissionForDetails(sub);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:border-blue-800/60 dark:text-blue-300 font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm"
                                                            >
                                                                👁 Details
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {renderPagination(pendingPage, totalPendingPages, setPendingPage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: COMPLETED TASKS */}
            {activeTab === 'completed-tasks' && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[2rem] shadow-md border dark:border-gray-700/60 animate-transition">
                        <div>
                            <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Submitted Task History</h3>
                            <p className="text-xs text-gray-500 mt-1">View all your task submissions, check their review status, and view details.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full sm:w-60">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                <input 
                                    type="text"
                                    placeholder="Search by title or proof..."
                                    value={completedSearch}
                                    onChange={(e) => {
                                        setCompletedSearch(e.target.value);
                                        setCompletedPage(1);
                                    }}
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                                <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider whitespace-nowrap">Status:</span>
                                <select 
                                    value={historyStatusFilter}
                                    onChange={(e) => {
                                        setHistoryStatusFilter(e.target.value as any);
                                        setCompletedPage(1);
                                    }}
                                    className="w-full sm:w-auto px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-gray-200"
                                >
                                    <option value="All">🌐 All History</option>
                                    <option value="Approved">✅ Completed</option>
                                    <option value="Pending">⏳ Pending</option>
                                    <option value="Rejected">❌ Rejected</option>
                                    <option value="Disputed">⚖️ Disputed</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filteredCompletedSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No submissions found matching your search and status filters.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                <th className="p-3.5 md:p-5">Task</th>
                                                <th className="p-3.5 md:p-5">Proof Details</th>
                                                <th className="p-3.5 md:p-5">Reward (USD)</th>
                                                <th className="p-3.5 md:p-5">Status</th>
                                                <th className="p-3.5 md:p-5">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                            {paginatedCompletedSubmissions.map(sub => (
                                                <tr 
                                                    key={sub._id} 
                                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 cursor-pointer transition-colors"
                                                    onClick={() => setSelectedSubmissionForDetails(sub)}
                                                    title="Click to view details"
                                                >
                                                    <td className="p-3.5 md:p-5 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                    <td className="p-3.5 md:p-5 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                    <td className={`p-3.5 md:p-5 font-mono font-bold ${
                                                        sub.status === 'Approved' ? 'text-emerald-500' :
                                                        sub.status === 'Rejected' ? 'text-red-500 line-through opacity-60' :
                                                        'text-orange-500'
                                                    }`}>
                                                        +{sub.rewardAmount} USD
                                                    </td>
                                                    <td className="p-3.5 md:p-5">
                                                        {renderDisputeStageBadge(sub)}
                                                    </td>
                                                    <td className="p-3.5 md:p-5" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2 justify-end mb-1">
                                                            <Button 
                                                                variant="secondary" 
                                                                className="text-[10px] md:text-xs py-1 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold uppercase tracking-wider shrink-0"
                                                                onClick={() => setSelectedSubmissionForDetails(sub)}
                                                            >
                                                                👁 Detail
                                                            </Button>
                                                        </div>
                                                        {sub.status === 'Rejected' ? (
                                                            (() => {
                                                                const isDisputeResolvedByAdmin = sub.disputeStage === 'Resolved' || sub.disputeStage === 'ResolvedByAdmin' || sub.disputeStage === 'Closed' || sub.disputeStage === 'Admin Rejected';
                                                                if (isDisputeResolvedByAdmin) {
                                                                    return (
                                                                        <span className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                                                            Dispute Resolved by Admin
                                                                        </span>
                                                                    );
                                                                }
                                                                const isLevel2 = sub.disputeStage === 'RejectedByCreator';
                                                                const isDeadlineExpired = isLevel2 
                                                                    ? (sub.secondDisputeDeadline ? new Date() > new Date(sub.secondDisputeDeadline) : false)
                                                                    : (sub.disputeDeadline ? new Date() > new Date(sub.disputeDeadline) : false);
                                                                
                                                                if (sub.disputeOpened) {
                                                                    return (
                                                                        <span className="text-[10px] md:text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                                                            {sub.disputeStage === 'Escalated' ? '⚖️ Disputed with Admin' : '🤝 Disputed with Creator'}
                                                                        </span>
                                                                    );
                                                                }
                                                                if (isDeadlineExpired) {
                                                                    const limitHours = isLevel2 
                                                                        ? (settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48)
                                                                        : (settings?.systemLimits?.disputeTimeLimitHours ?? 48);
                                                                    return <span className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Expired ({limitHours}h limit)</span>;
                                                                }

                                                                const targetDate = isLevel2 
                                                                    ? (sub.secondDisputeDeadline || (sub.updatedAt ? new Date(new Date(sub.updatedAt).getTime() + (settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48) * 3600000) : null))
                                                                    : (sub.disputeDeadline || (sub.rejectedAt ? new Date(new Date(sub.rejectedAt).getTime() + (settings?.systemLimits?.disputeTimeLimitHours ?? 48) * 3600000) : null));
                                                                const remStr = getRemainingTimeString(targetDate);

                                                                return (
                                                                    <div className="flex flex-col items-start md:items-end gap-1">
                                                                        {remStr && remStr !== 'Expired' && (
                                                                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                                                ⏰ {remStr}
                                                                            </span>
                                                                        )}
                                                                        <Button 
                                                                            variant="secondary" 
                                                                            className="text-[10px] md:text-xs py-1.5 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold uppercase tracking-wider"
                                                                            onClick={() => {
                                                                                setSelectedSubmissionForDispute(sub);
                                                                                setDisputeDescription('');
                                                                                setDisputeProofImage('');
                                                                            }}
                                                                        >
                                                                            {isLevel2 ? 'Escalate to Admin' : 'Raise Dispute'}
                                                                        </Button>
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : sub.status === 'Disputed' || sub.disputeOpened ? (
                                                            <div className="flex flex-col items-start md:items-end gap-0.5">
                                                                {sub.disputeStage === 'Escalated' ? (
                                                                    <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider">⚖️ In Admin Review</span>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">🤝 Creator Reviewing</span>
                                                                        <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400">⏰ Auto-approves: {getRemainingTimeString(sub.disputeReviewDeadline || (sub.updatedAt || sub.createdAt ? new Date(new Date(sub.updatedAt || sub.createdAt).getTime() + (settings?.systemLimits?.disputeReviewTimeoutDays ?? 3) * 86400000) : null)) || '3 days'}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 dark:text-gray-600 font-bold text-xs">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {renderPagination(completedPage, totalCompletedPages, setCompletedPage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: REVIEW PROOFS (CAMPAIGN OWNER REVIEW) */}
            {activeTab === 'review-proofs' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Review Worker Submissions</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                As the creator of these campaigns, you can inspect worker proofs and approve to release payments or reject them with a reason.
                            </p>
                        </div>
                        {/* Filter Sub-Tabs */}
                        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border dark:border-gray-700 w-full sm:w-auto justify-center sm:justify-start">
                                {(['All', 'Pending', 'Disputed', 'Approved', 'Rejected'] as const).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            setReviewFilter(status);
                                            setReviewPage(1);
                                        }}
                                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                            reviewFilter === status
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {status} ({
                                            status === 'All' 
                                                ? campaignSubmissions.length 
                                                : status === 'Disputed'
                                                    ? campaignSubmissions.filter(s => s.status === 'Disputed').length
                                                    : campaignSubmissions.filter(s => s.status === status).length
                                        })
                                    </button>
                                ))}
                            </div>

                            <div className="relative w-full sm:w-64">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                <input 
                                    type="text"
                                    placeholder="Search workers or tasks..."
                                    value={reviewSearch}
                                    onChange={(e) => {
                                        setReviewSearch(e.target.value);
                                        setReviewPage(1);
                                    }}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {filteredReviewCampaignSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No worker submissions found matching your search.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                <th className="p-3.5 md:p-5">Task Campaign</th>
                                                <th className="p-3.5 md:p-5">Worker Name</th>
                                                <th className="p-3.5 md:p-5">Proof details</th>
                                                <th className="p-3.5 md:p-5">Cost / Reward</th>
                                                <th className="p-3.5 md:p-5">Status</th>
                                                <th className="p-3.5 md:p-5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                            {paginatedReviewSubmissions.map(sub => (
                                                <tr 
                                                    key={sub._id} 
                                                    onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 cursor-pointer transition-colors"
                                                >
                                                    <td className="p-3.5 md:p-5">
                                                        <div className="font-bold text-gray-900 dark:text-white">{sub.taskTitle || 'Engagement Task'}</div>
                                                        <div className="text-[10px] uppercase font-bold text-blue-500 mt-1">{sub.taskCategory || 'Platform'}</div>
                                                    </td>
                                                    <td className="p-3.5 md:p-5">
                                                        <div className="font-bold text-gray-800 dark:text-gray-200">@{sub.workerName}</div>
                                                        <div className="text-[10px] font-mono text-gray-400">ID: {sub.workerId}</div>
                                                    </td>
                                                    <td className="p-3.5 md:p-5 text-sm text-gray-600 dark:text-gray-300">
                                                        <div className="flex flex-col gap-1 max-w-xs">
                                                            {sub.submittedProofs && Array.isArray(sub.submittedProofs) && sub.submittedProofs.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {sub.submittedProofs.map((item: any, idx: number) => {
                                                                        const isImg = item.type === 'screenshot' || item.type === 'file' || (item.value && (item.value.startsWith('data:') || item.value.startsWith('http')));
                                                                        return (
                                                                            <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                                {isImg ? '📸' : '✍'} {item.label}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {sub.proofText && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            ✍ Text Answer
                                                                        </span>
                                                                    )}
                                                                    {sub.proofUsername && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            👤 @{sub.proofUsername}
                                                                        </span>
                                                                    )}
                                                                    {sub.proofUserIdVal && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm font-mono">
                                                                            🆔 ID: {sub.proofUserIdVal}
                                                                        </span>
                                                                    )}
                                                                    {sub.proofEmail && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            ✉ Email
                                                                        </span>
                                                                    )}
                                                                    {sub.proofImage && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            📸 Screenshot
                                                                        </span>
                                                                    )}
                                                                    {!sub.proofText && !sub.proofUsername && !sub.proofUserIdVal && !sub.proofEmail && !sub.proofImage && (
                                                                        <span className="text-xs italic text-gray-400">No proofs submitted</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span className="text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-0.5 mt-1">
                                                                🔍 Click to inspect proofs & files
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 md:p-5 font-mono font-black text-emerald-500">
                                                        +{sub.rewardAmount} USD
                                                    </td>
                                                    <td className="p-3.5 md:p-5" onClick={(e) => e.stopPropagation()}>
                                                        <div className="space-y-1">
                                                            <Badge variant={sub.status === 'Approved' ? 'success' : sub.status === 'Pending' ? 'warning' : 'danger'}>
                                                                {sub.status}
                                                            </Badge>
                                                            {sub.status === 'Rejected' && sub.rejectionReason && (
                                                                <p className="text-[10px] text-red-500 max-w-[150px] line-clamp-2" title={sub.rejectionReason}>
                                                                    <strong>Reason:</strong> {sub.rejectionReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 md:p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                                            >
                                                                👁 Detail
                                                            </button>
                                                            {(sub.status === 'Pending' || (sub.status === 'Disputed' && sub.disputeStage === 'CreatorReview')) && (
                                                                <>
                                                                    <button
                                                                        className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                                                                        onClick={() => handleApproveSubmission(sub._id)}
                                                                    >
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:border-red-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                                                                        onClick={() => {
                                                                            setRejectingSubId(sub._id);
                                                                            setRejectionFeedback('');
                                                                        }}
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {renderPagination(reviewPage, totalReviewPages, setReviewPage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: CURRENCY CONVERTER & WITHDRAW */}
            {activeTab === 'converter' && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl border dark:border-gray-700 max-w-2xl mx-auto space-y-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Currency Converter & Withdrawal</h3>
                        <p className="text-sm text-gray-500">
                            Task earnings are in USD. Based on your registered country ({currentUser.country || 'Global'}), you can convert your USD balance directly into your country currency ({allowedCurrency}).
                        </p>
                    </div>

                    <form onSubmit={handleRunConversion} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-black uppercase text-gray-500">Amount (USD)</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const bal = Number(availableCampaignWalletUSD.toFixed(2));
                                            if (bal <= 0) {
                                                alert('You do not have enough amount for conversion.');
                                            } else {
                                                setConvertAmount(bal);
                                            }
                                        }}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1"
                                        title="Click to lookup and auto-fill available campaign balance"
                                    >
                                        🔍 Lookup: ${availableCampaignWalletUSD.toFixed(2)} USD
                                    </button>
                                </div>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    required
                                    value={convertAmount} 
                                    onChange={(e) => setConvertAmount(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">From Currency</label>
                                <input 
                                    type="text"
                                    disabled
                                    value="USD"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-500 mb-2">To Currency (Country Specific)</label>
                            <input 
                                type="text"
                                disabled
                                value={allowedCurrency}
                                className="w-full px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                {currentUser.country === 'Pakistan' ? 'Registered from Pakistan -> Converted to PKR.' : europeanCountries.includes(currentUser.country || '') ? 'Registered from Europe -> Converted to EUR.' : 'Converted to USD.'}
                            </p>
                        </div>

                        <Button type="submit" variant="primary" isLoading={isConverting} className="w-full py-4 text-lg">
                            Convert & Withdraw ({allowedCurrency})
                        </Button>
                    </form>

                    {conversionResult && (
                        <div className="mt-8 p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-3xl text-center space-y-2">
                            <p className="text-xs uppercase font-black text-blue-500 tracking-wider">Conversion Successful</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {(conversionResult.fromAmount ?? conversionResult.data?.fromAmount)} {(conversionResult.fromCurrency ?? conversionResult.data?.fromCurrency)} = <span className="text-emerald-500">{(conversionResult.toAmount ?? conversionResult.data?.toAmount)} {(conversionResult.toCurrency ?? conversionResult.data?.toCurrency)}</span>
                            </p>
                            <p className="text-xs text-gray-500">Converted using active platform exchange rates and credited to wallet.</p>
                        </div>
                    )}
                </div>
            )}

            {/* PROOF SUBMISSION MODAL */}
            {selectedTaskForProof && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6 my-8">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Task: {selectedTaskForProof.title}</h3>
                            <button onClick={() => setSelectedTaskForProof(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        {/* Professional Step Indicator */}
                        <div className="flex items-center justify-between mb-6 w-full max-w-xs mx-auto relative">
                            <div className="absolute top-[15px] left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-0"></div>
                            {[
                                { step: 1, label: 'Details' },
                                { step: 2, label: 'Submit Proof' }
                            ].map((s) => {
                                const isActive = proofStep === s.step;
                                const isCompleted = proofStep > s.step;
                                return (
                                    <div key={s.step} className="flex flex-col items-center relative z-10 flex-1">
                                        <div 
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                                                isActive 
                                                    ? 'bg-blue-600 text-white shadow-lg' 
                                                    : isCompleted 
                                                        ? 'bg-green-500 text-white' 
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-600'
                                            }`}
                                        >
                                            {isCompleted ? '✓' : s.step}
                                        </div>
                                        <span className={`text-[10px] mt-1.5 font-bold uppercase tracking-wider transition-colors duration-300 ${
                                            isActive 
                                                ? 'text-blue-600 dark:text-blue-400' 
                                                : isCompleted 
                                                    ? 'text-green-500' 
                                                    : 'text-gray-400'
                                        }`}>{s.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {proofStep === 1 ? (
                            /* STEP 1: DETAILS & OVERVIEW */
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700/60 text-sm">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Reward Pool</span>
                                        <span className="text-xl font-black text-emerald-500 font-mono">+{selectedTaskForProof.rewardPerTask} USD</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Platform</span>
                                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-1">
                                            {selectedTaskForProof.category} / {selectedTaskForProof.subType}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instructions &amp; Description</span>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700/60 max-h-48 overflow-y-auto">
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {selectedTaskForProof.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Required Proofs to Submit</span>
                                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-2.5">
                                        {selectedTaskForProof.requiredProofs && Array.isArray(selectedTaskForProof.requiredProofs) && selectedTaskForProof.requiredProofs.length > 0 ? (
                                            <div className="space-y-2 text-xs text-blue-800 dark:text-blue-300 font-bold">
                                                {selectedTaskForProof.requiredProofs.map((req: any, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">{req.label}</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{req.instruction || 'Please provide required input.'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-2 text-xs text-blue-800 dark:text-blue-300 font-bold">
                                                {selectedTaskForProof.requireTextProof && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Text Proof</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.textProofInstruction || 'Proof text or URL.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireUsername && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Username</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.usernameInstruction || 'Your profile username.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireUserId && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">User ID</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.userIdInstruction || 'Your platform unique ID.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireEmail && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Email Address</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.emailInstruction || 'Your registered email.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireScreenshot && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Screenshot Proof</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.screenshotInstruction || 'Upload a screenshot image.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail && !selectedTaskForProof.requireScreenshot && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Confirmation Proof</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">A screenshot or verification text.</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                                    <Button type="button" variant="secondary" onClick={() => setSelectedTaskForProof(null)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                                        Close
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="primary" 
                                        className="flex-[2] py-3 text-xs font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-center"
                                        onClick={() => {
                                            seoAnalytics.trackStartTask(selectedTaskForProof._id, selectedTaskForProof.category);
                                            if (selectedTaskForProof.link) {
                                                window.open(selectedTaskForProof.link, '_blank', 'noopener,noreferrer');
                                            }
                                            setProofStep(2);
                                        }}
                                    >
                                        Start Task &rarr;
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* STEP 2: PROOF SUBMISSION FORM */
                            <form onSubmit={handleProofSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {selectedTaskForProof.requiredProofs && Array.isArray(selectedTaskForProof.requiredProofs) && selectedTaskForProof.requiredProofs.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedTaskForProof.requiredProofs.map((req: any, index: number) => {
                                            const value = submittedProofsValues[req.id] || '';
                                            const isImage = req.type === 'screenshot';
                                            
                                            return (
                                                <div key={req.id || index} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700/60 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">
                                                            Proof Requirement #{index + 1}: {req.label}
                                                        </span>
                                                        <span className="text-xs text-red-500 font-bold">* Required</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                        👉 {req.instruction}
                                                    </p>
                                                    
                                                    {isImage ? (
                                                        <div className="space-y-2.5 pt-1">
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">1. Upload Image File (PNG/JPG)</span>
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*"
                                                                    onChange={(e) => handleDynamicImageUpload(req.id, e)}
                                                                    className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                                                />
                                                            </div>

                                                            <div className="space-y-1">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">2. Or Paste Image URL</span>
                                                                <input 
                                                                    type="url" 
                                                                    value={value.startsWith('data:') ? '' : value}
                                                                    onChange={(e) => setSubmittedProofsValues(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                                    placeholder="https://imgur.com/screenshot.png"
                                                                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs"
                                                                />
                                                            </div>

                                                            {value && (
                                                                <div className="relative w-24 h-24 rounded-xl overflow-hidden border shadow-sm mt-2">
                                                                    <img src={value} alt="Proof preview" className="w-full h-full object-cover" />
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setSubmittedProofsValues(prev => {
                                                                            const next = { ...prev };
                                                                            delete next[req.id];
                                                                            return next;
                                                                        })}
                                                                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type={req.type === 'email' ? 'email' : 'text'}
                                                            required
                                                            value={value}
                                                            onChange={(e) => setSubmittedProofsValues(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                            placeholder={`Enter your ${req.label.toLowerCase()}`}
                                                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <>
                                        {/* Legacy Proof Form (for old campaigns) */}
                                        {(selectedTaskForProof.requireTextProof || (!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail && !selectedTaskForProof.requireScreenshot)) && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.textProofInstruction || 'Proof Text / Comment / Link'}
                                                </label>
                                                <input 
                                                    type="text" 
                                                    required={selectedTaskForProof.requireTextProof}
                                                    value={proofText}
                                                    onChange={(e) => setProofText(e.target.value)}
                                                    placeholder="e.g. My Telegram/YouTube username @john_doe"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {selectedTaskForProof.requireUsername && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.usernameInstruction || 'Username'}
                                                </label>
                                                <input 
                                                    type="text" 
                                                    required={selectedTaskForProof.requireUsername}
                                                    value={proofUsername}
                                                    onChange={(e) => setProofUsername(e.target.value)}
                                                    placeholder="Enter your username"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {selectedTaskForProof.requireUserId && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.userIdInstruction || 'User ID'}
                                                </label>
                                                <input 
                                                    type="text" 
                                                    required={selectedTaskForProof.requireUserId}
                                                    value={proofUserIdVal}
                                                    onChange={(e) => setProofUserIdVal(e.target.value)}
                                                    placeholder="Enter your profile ID / User ID"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {selectedTaskForProof.requireEmail && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.emailInstruction || 'Email'}
                                                </label>
                                                <input 
                                                    type="email" 
                                                    required={selectedTaskForProof.requireEmail}
                                                    value={proofEmail}
                                                    onChange={(e) => setProofEmail(e.target.value)}
                                                    placeholder="Enter your registered email"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {(selectedTaskForProof.requireScreenshot || (!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail)) && (
                                            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                                                <label className="block text-xs font-black uppercase text-gray-500">
                                                    {selectedTaskForProof.screenshotInstruction || 'Screenshot / Image Proof'}
                                                </label>
                                                
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">1. Upload Image File (PNG/JPG)</span>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">2. Or Paste Image URL</span>
                                                    <input 
                                                        type="url" 
                                                        value={proofImage.startsWith('data:') ? '' : proofImage}
                                                        onChange={(e) => setProofImage(e.target.value)}
                                                        placeholder="https://imgur.com/screenshot.png"
                                                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs"
                                                    />
                                                </div>

                                                {proofImage && (
                                                    <div className="relative w-24 h-24 rounded-xl overflow-hidden border shadow-sm mt-2">
                                                        <img src={proofImage} alt="Proof preview" className="w-full h-full object-cover" />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setProofImage('')}
                                                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-2">
                                        <span className="text-sm">⚠️</span>
                                        <span>
                                            <strong>Warning Notice:</strong> If you submit incorrect proof or do not complete the task properly, your account may be banned and your balance may be deducted.
                                        </span>
                                    </p>
                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={proofAgreed}
                                            onChange={(e) => setProofAgreed(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                            I confirm I completed the task properly and agree to the terms.
                                        </span>
                                    </label>
                                </div>

                                <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                                    <Button type="button" variant="secondary" onClick={() => setProofStep(1)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                                        &larr; Back
                                    </Button>
                                    <Button type="submit" variant="primary" isLoading={isSubmittingProof} className="flex-[2] py-3 text-xs font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg">
                                        Submit Proof ✓
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* DISPUTE MODAL */}
            {selectedSubmissionForDispute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Raise Dispute: {selectedSubmissionForDispute.taskTitle}</h3>
                            <button onClick={() => setSelectedSubmissionForDispute(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-xs text-gray-600 dark:text-gray-300 space-y-2">
                            <p id="submission-timeline-notice" className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-100/50 dark:border-blue-900/30 shadow-sm">
                                <strong className="text-blue-900 dark:text-blue-300 font-extrabold uppercase tracking-wider block mb-1">⏱️ Proof Submission & Dispute Rules</strong>
                                When a worker submits proof, the creator has <strong className="text-blue-600 dark:text-blue-400 font-extrabold font-mono">{settings?.systemLimits?.approvalTimeoutDays ?? 3} days</strong> to review it. If left unreviewed, it will be auto-approved. If rejected, you have <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono">{settings?.systemLimits?.disputeTimeLimitHours ?? 48} hours</strong> to raise a dispute. The creator then has <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono">{settings?.systemLimits?.disputeReviewTimeoutDays ?? 3} days</strong> to review and resolve the dispute. If they reject your dispute, you can escalate it directly to the Admin within <strong className="text-rose-600 dark:text-rose-400 font-extrabold font-mono">{settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48} hours</strong>.
                            </p>
                            <p><strong className="text-gray-900 dark:text-white">Escrow & Booking:</strong> Upon submitting this dispute, the campaign creator's funds for this task are held in escrow, and your spot will remain locked/booked. No other worker can take your slot while the dispute is pending.</p>
                            <p><strong className="text-gray-900 dark:text-white">Reward at Stake:</strong> <span className="text-emerald-500 font-bold">+{selectedSubmissionForDispute.rewardAmount} USD</span></p>
                        </div>

                        <form onSubmit={handleDisputeSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Dispute Description & Reason</label>
                                <textarea 
                                    rows={3}
                                    required
                                    value={disputeDescription}
                                    onChange={(e) => setDisputeDescription(e.target.value)}
                                    placeholder="Explain why your task submission was correct and should be approved. Provide detailed context..."
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                ></textarea>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-black uppercase text-gray-500">Attach Screenshot / Image Proof</label>
                                
                                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">1. Upload Image (PNG/JPG/WEBP)</span>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleDisputeImageUpload}
                                            className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">2. Or Paste Image URL</span>
                                        <input 
                                            type="url" 
                                            value={disputeProofImage.startsWith('data:') ? '' : disputeProofImage}
                                            onChange={(e) => setDisputeProofImage(e.target.value)}
                                            placeholder="https://imgur.com/screenshot.png"
                                            className="w-full px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                    </div>

                                    {disputeProofImage && (
                                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border shadow-sm mt-2 bg-white dark:bg-gray-800">
                                            <img src={disputeProofImage} alt="Dispute preview" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => setDisputeProofImage('')}
                                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedSubmissionForDispute(null)} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSubmittingDispute} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Submit Dispute
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CAMPAIGN REVIEW RESUBMISSION MODAL */}
            {selectedCampaignForReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Submit for One-Time Review</h3>
                            <button onClick={() => setSelectedCampaignForReview(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-xs text-amber-800 dark:text-amber-400 space-y-2">
                            <p className="font-bold">⚠️ Review Submission Guidelines:</p>
                            <p>You are requesting a <strong>one-time, final review</strong> from the Admin for this campaign. Please ensure you have fixed any issues reported in the rejection reason below.</p>
                            <p>Upon resubmitting, the budget of <strong className="text-emerald-500">{(selectedCampaignForReview.totalBudget + (settings.userTaskConfig?.campaignFeeEnabled ? (settings.userTaskConfig?.campaignFeeAmount || 0) : 0)).toFixed(2)} USD</strong> {(settings.userTaskConfig?.campaignFeeEnabled && (settings.userTaskConfig?.campaignFeeAmount || 0) > 0) ? `(including a ${settings.userTaskConfig?.campaignFeeAmount.toFixed(2)} USD campaign creation fee)` : ''} will be deducted from your wallet to fund the active slots. If the Admin rejects the campaign again, this entire deducted amount (Base Fee + Budget) will be fully refunded to your balance.</p>
                        </div>

                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-xs space-y-1">
                            <p className="font-bold text-red-700 dark:text-red-400">Previous Rejection Reason:</p>
                            <p className="text-gray-700 dark:text-gray-300 italic font-medium">"{selectedCampaignForReview.adminNotes || 'No specific reason provided'}"</p>
                        </div>

                        <form onSubmit={handleSubmitCampaignForReview} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Message to Admin (Your explanation / proof of correction)</label>
                                <textarea 
                                    rows={4}
                                    required
                                    value={reviewExplanation}
                                    onChange={(e) => setReviewExplanation(e.target.value)}
                                    placeholder="Explain how you fixed the issue, or provide additional notes for the Admin to approve your campaign..."
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                ></textarea>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedCampaignForReview(null)} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSubmittingReview} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Send to Admin
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONVERT & TRANSFER TASK WALLET MODAL */}
            {showConvertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Task Wallet Conversion</h3>
                            <button onClick={() => setShowConvertModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Campaign Balance (USD):</span>
                                <span className="font-bold text-gray-900 dark:text-white">${availableCampaignWalletUSD.toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Base Currency:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentUser.currency || 'USD'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Exchange Rate:</span>
                                <span className="font-bold text-gray-900 dark:text-white">1 USD = {rates[currentUser.currency || 'USD'] || 1} {currentUser.currency || 'USD'}</span>
                            </div>
                            <div className="border-t dark:border-gray-700 pt-3 flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-gray-500">Converted Amount:</span>
                                <span className="text-lg font-black text-emerald-500">
                                    {(availableCampaignWalletUSD * (rates[currentUser.currency || 'USD'] || 1)).toFixed(2)} {currentUser.currency || 'USD'}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 text-center">
                            Funds will be transferred instantly to your Main MLM Balance and added to your transactions record.
                        </p>

                        <div className="flex gap-4 pt-2">
                            <Button type="button" variant="secondary" onClick={() => setShowConvertModal(false)} className="flex-1 py-3">
                                Cancel
                            </Button>
                            <Button 
                                type="button" 
                                variant="primary" 
                                isLoading={isTransferringTaskWallet} 
                                onClick={handleTransferTaskWallet}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700"
                            >
                                Instant Transfer
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCREENSHOT PREVIEW OVERLAY */}
            {selectedProofImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedProofImage(null)}>
                    <div className="max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-2xl relative overflow-auto space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-gray-900 dark:text-white">Proof Screenshot Preview</h4>
                            <button onClick={() => setSelectedProofImage(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-3xl font-black">&times;</button>
                        </div>
                        <img src={selectedProofImage} alt="Proof" className="max-w-full h-auto rounded-2xl mx-auto border dark:border-gray-700 shadow-lg" referrerPolicy="no-referrer" />
                    </div>
                </div>
            )}

            {/* SUBMISSION DETAILS MODAL */}
            {selectedSubmissionForDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border dark:border-gray-700/60 flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center pb-4 border-b dark:border-gray-700">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Submission Details</h3>
                                <p className="text-[10px] text-gray-500 font-mono">ID: {selectedSubmissionForDetails._id}</p>
                            </div>
                            <button onClick={() => setSelectedSubmissionForDetails(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl">&times;</button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                            {/* Task Info Section */}
                            {(() => {
                                const matchingTask = userTasks.find(t => t._id?.toString() === selectedSubmissionForDetails.taskId?.toString());
                                const taskDesc = selectedSubmissionForDetails.taskDescription || matchingTask?.description;
                                return (
                                    <div className="bg-blue-50/60 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 space-y-2">
                                        <div>
                                            <span className="text-[10px] uppercase font-black text-blue-600 dark:text-blue-400 block">Task Title</span>
                                            <h4 className="text-base font-bold text-gray-900 dark:text-white">{selectedSubmissionForDetails.taskTitle || matchingTask?.title || 'Engagement Task'}</h4>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Category: {selectedSubmissionForDetails.taskCategory || matchingTask?.category || 'Platform'}</span>
                                        </div>

                                        {taskDesc && (
                                            <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40">
                                                <span className="text-[10px] uppercase font-black text-gray-500 dark:text-gray-400 block mb-1">Task Description</span>
                                                <p className="text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900/80 p-3 rounded-xl border dark:border-gray-800 leading-relaxed whitespace-pre-line">
                                                    {taskDesc}
                                                </p>
                                            </div>
                                        )}

                                        {matchingTask?.link && (
                                            <div className="pt-1">
                                                <span className="text-[10px] uppercase font-black text-gray-500 dark:text-gray-400 block mb-0.5">Task Target Link</span>
                                                <a href={matchingTask.link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 underline font-semibold break-all flex items-center gap-1">
                                                    🔗 {matchingTask.link}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Status and Payment Information */}
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-700 space-y-3">
                                <h5 className="text-xs uppercase font-black text-gray-500">Payment & Status Details</h5>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Status</span>
                                        {renderDisputeStageBadge(selectedSubmissionForDetails)}
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Reward Amount</span>
                                        <span className="font-mono font-bold text-emerald-500 text-sm">+{selectedSubmissionForDetails.rewardAmount} USD</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Submitted On</span>
                                        <span className="text-gray-800 dark:text-gray-200 font-medium">
                                            {selectedSubmissionForDetails.createdAt ? new Date(selectedSubmissionForDetails.createdAt).toLocaleString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Wallet Destination</span>
                                        <span className="text-gray-800 dark:text-gray-200 font-medium">Available Task Balance</span>
                                    </div>
                                </div>

                                {selectedSubmissionForDetails.status === 'Approved' && (
                                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl font-medium mt-1">
                                        🎉 Payment of +${selectedSubmissionForDetails.rewardAmount} USD was fully credited to your Available Task Balance. You can convert and transfer it to your Main MLM balance at any time!
                                    </div>
                                )}

                                {selectedSubmissionForDetails.status === 'Pending' && (
                                    <div className="text-[11px] text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-2.5 rounded-xl font-medium mt-1">
                                        ⏳ The campaign creator is currently reviewing your proofs. Payout will occur instantly upon approval.
                                    </div>
                                )}

                                {selectedSubmissionForDetails.status === 'Rejected' && (
                                    <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 p-2.5 rounded-xl font-medium mt-1">
                                        ❌ This submission was rejected.
                                        {selectedSubmissionForDetails.rejectionReason && (
                                            <p className="mt-1 font-bold">Reason: {selectedSubmissionForDetails.rejectionReason}</p>
                                        )}
                                    </div>
                                )}

                                {renderDisputeTimerBox(selectedSubmissionForDetails, settings)}

                                {/* DISPUTE INFORMATION & EXTRA PROOF SUBMITTED BY WORKER */}
                                {(() => {
                                    const workerDispute = state.disputes?.find((d: any) => 
                                        String(d.submissionId) === String(selectedSubmissionForDetails._id) || 
                                        String(d._id) === String(selectedSubmissionForDetails.disputeId) || 
                                        String(d.referenceId) === String(selectedSubmissionForDetails._id)
                                    );
                                    const extraDisputeReason = selectedSubmissionForDetails.disputeReason || workerDispute?.description || workerDispute?.messages?.find((m: any) => m.sender === 'User' && m.message)?.message;
                                    const extraDisputeProof = selectedSubmissionForDetails.disputeProofUrl || workerDispute?.proofUrl || workerDispute?.messages?.find((m: any) => m.attachmentUrl)?.attachmentUrl;

                                    if (selectedSubmissionForDetails.status !== 'Disputed' && !selectedSubmissionForDetails.disputeOpened && !extraDisputeReason && !extraDisputeProof) {
                                        return null;
                                    }

                                    return (
                                        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl space-y-2.5 shadow-sm mt-2">
                                            <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/50 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-amber-500 text-white rounded-lg text-xs font-black">⚖️</span>
                                                    <h6 className="font-black text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                                        Your Dispute Statement & Extra Proof
                                                    </h6>
                                                </div>
                                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase rounded-full">
                                                    {selectedSubmissionForDetails.disputeStage || workerDispute?.status || 'Disputed'}
                                                </span>
                                            </div>

                                            {extraDisputeReason && (
                                                <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                                                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block mb-0.5">
                                                        Submitted Dispute Explanation
                                                    </span>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words leading-relaxed">
                                                        {extraDisputeReason}
                                                    </p>
                                                </div>
                                            )}

                                            {extraDisputeProof && (
                                                <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                                                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block mb-1">
                                                        📸 Attached Extra Dispute Proof Screenshot
                                                    </span>
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                        <div 
                                                            className="relative group w-28 h-28 rounded-xl overflow-hidden border border-amber-300 dark:border-amber-700 cursor-zoom-in shadow-md"
                                                            onClick={() => setSelectedProofImage(extraDisputeProof)}
                                                        >
                                                            <img 
                                                                src={extraDisputeProof} 
                                                                alt="Attached Dispute Proof" 
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                                                referrerPolicy="no-referrer" 
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <span className="text-white text-[10px] font-bold">🔍 View Full</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <a 
                                                                href={extraDisputeProof} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                            >
                                                                🔗 Open High-Res Proof
                                                            </a>
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                                                                This extra proof was submitted to creator and admin for review.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedSubmissionForDetails.disputeCreatorNotes && (
                                                <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40">
                                                    <span className="text-[10px] font-black uppercase text-red-500 block mb-0.5">
                                                        Creator Rejection Response Notes
                                                    </span>
                                                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                        {selectedSubmissionForDetails.disputeCreatorNotes}
                                                    </p>
                                                </div>
                                            )}

                                            <DisputeTimeline submission={selectedSubmissionForDetails} dispute={workerDispute} settings={settings} />
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Submitted Proofs Section */}
                            <div className="space-y-2">
                                <h5 className="text-xs uppercase font-black text-gray-500">Your Submitted Proofs</h5>
                                {selectedSubmissionForDetails.submittedProofs && Array.isArray(selectedSubmissionForDetails.submittedProofs) && selectedSubmissionForDetails.submittedProofs.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedSubmissionForDetails.submittedProofs.map((item: any, idx: number) => {
                                            const isImage = item.type === 'screenshot' || (item.value && (item.value.startsWith('data:') || item.value.startsWith('http')));
                                            return (
                                                <div key={item.id || idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700/60">
                                                    <span className="text-[10px] uppercase font-bold text-blue-500 block">{item.label}</span>
                                                    {isImage ? (
                                                        <div className="mt-2">
                                                            <div className="relative group w-24 h-24 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(item.value)}>
                                                                <img src={item.value} alt={item.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <span className="text-white text-lg">🔍</span>
                                                                </div>
                                                            </div>
                                                            <a href={item.value} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Original Screenshot</a>
                                                        </div>
                                                    ) : (
                                                        <p className="font-medium text-xs text-gray-800 dark:text-gray-200 mt-1 break-all">{item.value}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedSubmissionForDetails.proofText && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Text Proof</span>
                                                <p className="text-xs text-gray-800 dark:text-gray-200 mt-1 break-all">{selectedSubmissionForDetails.proofText}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofUsername && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Username</span>
                                                <p className="font-mono text-xs text-gray-800 dark:text-gray-200 mt-1">{selectedSubmissionForDetails.proofUsername}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofUserIdVal && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">User ID</span>
                                                <p className="font-mono text-xs text-gray-800 dark:text-gray-200 mt-1">{selectedSubmissionForDetails.proofUserIdVal}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofEmail && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Email Address</span>
                                                <p className="text-xs text-gray-800 dark:text-gray-200 mt-1">{selectedSubmissionForDetails.proofEmail}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofImage && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Screenshot Proof</span>
                                                <div className="mt-2">
                                                    <div className="relative group w-24 h-24 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(selectedSubmissionForDetails.proofImage)}>
                                                        <img src={selectedSubmissionForDetails.proofImage} alt="Screenshot Proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <span className="text-white text-lg">🔍</span>
                                                        </div>
                                                    </div>
                                                    <a href={selectedSubmissionForDetails.proofImage} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Original Screenshot</a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t dark:border-gray-700 flex justify-end">
                            <Button type="button" variant="secondary" onClick={() => setSelectedSubmissionForDetails(null)} className="px-5 py-2">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Rejection Reason Feedback */}
            {rejectingSubId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    {rejectingSubId === 'bulk' ? 'Bulk Reject Submissions' : 'Reject Proof Submission'}
                                </h4>
                                <button 
                                    onClick={() => setRejectingSubId(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl"
                                >
                                    &times;
                                </button>
                            </div>

                            <p className="text-xs text-gray-500 font-medium">
                                Please provide a detailed rejection reason. This reason will be instantly visible to the workers on their tasks history dashboard so they know why their proof was rejected.
                            </p>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Rejection Reason / Feedback</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="e.g. Invalid/unclear screenshot proof or incorrect username provided."
                                    value={rejectionFeedback}
                                    onChange={(e) => setRejectionFeedback(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={() => {
                                        setRejectingSubId(null);
                                        setRejectionFeedback('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <button
                                    type="button"
                                    disabled={isSubmitting || !rejectionFeedback.trim()}
                                    onClick={() => {
                                        if (rejectingSubId === 'bulk') {
                                            const filteredSubmissions = userTaskSubmissions.filter(s => s.taskId?.toString() === selectedCampaignForDetail?._id?.toString() && s.status === 'Pending');
                                            const selectedIds = Object.keys(selectedSubmissions).filter(id => selectedSubmissions[id] && filteredSubmissions.some(s => s._id === id));
                                            handleBulkReject(selectedIds, rejectionFeedback);
                                        } else {
                                            handleSingleReject(rejectingSubId, rejectionFeedback);
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/10"
                                >
                                    {isSubmitting ? 'Rejecting...' : 'Reject & Notify'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Detailed Worker Submission Viewer */}
            {selectedWorkerSubmissionForDetails && (() => {
                const sub = selectedWorkerSubmissionForDetails;
                const task = selectedCampaignForDetail || mySubmittedTasks.find(t => t._id?.toString() === sub.taskId?.toString());
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/10">
                                <div>
                                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block font-mono">Verification Workspace</span>
                                    <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-0.5">Worker: {sub.workerName}</h4>
                                </div>
                                <button 
                                    onClick={() => setSelectedWorkerSubmissionForDetails(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl font-bold"
                                >
                                    &times;
                                </button>
                            </div>

                            {/* Main Body - Split Layout */}
                            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs md:text-sm font-medium">
                                
                                {/* LEFT COLUMN: Campaign Guidelines Reference */}
                                <div className="space-y-4 border-b md:border-b-0 md:border-r dark:border-gray-700 pb-5 md:pb-0 md:pr-6">
                                    <div className="flex items-center gap-1.5">
                                        <span className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl text-xs">📋</span>
                                        <h5 className="font-black text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400">Campaign Reference Guidelines</h5>
                                    </div>

                                    {task ? (
                                        <div className="space-y-3.5 pt-1">
                                            {/* Campaign Title & Type */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                <span className="text-gray-400 text-[10px] block uppercase font-bold">Campaign Title</span>
                                                <p className="font-bold text-gray-900 dark:text-white mt-0.5 break-words">{task.title}</p>
                                                <p className="text-[10px] text-gray-400 font-semibold mt-1">Category: {task.category} ({task.subType})</p>
                                            </div>

                                            {/* Target URL */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="text-gray-400 text-[10px] uppercase font-bold">Campaign URL</span>
                                                    <span 
                                                        onClick={() => handleCopyCampaignLink(task.link)}
                                                        className="text-[10px] font-bold text-blue-500 hover:underline cursor-pointer"
                                                    >
                                                        {copiedCampaignLink ? '✅ Copied!' : '📋 Copy'}
                                                    </span>
                                                </div>
                                                <a href={task.link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-mono break-all font-bold text-xs">
                                                    🔗 {task.link}
                                                </a>
                                            </div>

                                            {/* Description & Instructions */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                <span className="text-gray-400 text-[10px] block uppercase font-bold">Instructions Given to Worker</span>
                                                <div className="text-gray-700 dark:text-gray-300 font-medium mt-1 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto pr-1 text-xs">
                                                    {task.description || 'No detailed instructions provided.'}
                                                </div>
                                            </div>

                                            {/* Required Proofs Setup */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30 space-y-2 text-xs">
                                                <span className="text-gray-400 text-[10px] block uppercase font-bold mb-1">Required Proof Criteria</span>
                                                
                                                {task.requireScreenshot && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">📸 Screenshot Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.screenshotInstruction || 'Please upload screenshot proof.'}</p>
                                                    </div>
                                                )}
                                                {task.requireTextProof && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">✍ Text Answer Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.textProofInstruction}</p>
                                                    </div>
                                                )}
                                                {task.requireUsername && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">👤 Username Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.usernameInstruction}</p>
                                                    </div>
                                                )}
                                                {task.requireUserId && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">🆔 Platform User ID Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.userIdInstruction}</p>
                                                    </div>
                                                )}
                                                {task.requireEmail && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">✉ Email Address Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.emailInstruction}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pricing Information */}
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 font-bold block uppercase text-[9px]">Rate Per Task</span>
                                                    <span className="font-black text-emerald-500 font-mono">+{task.rewardPerTask} USD</span>
                                                </div>
                                                <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 font-bold block uppercase text-[9px]">Total Campaign Budget</span>
                                                    <span className="font-bold text-gray-900 dark:text-white font-mono">${task.totalBudget} USD</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-gray-400 italic text-xs">Campaign information is unavailable.</div>
                                    )}
                                </div>

                                {/* RIGHT COLUMN: Worker's Submission */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="p-1.5 bg-green-50 dark:bg-green-950/40 text-green-600 rounded-xl text-xs">👤</span>
                                        <h5 className="font-black text-xs uppercase tracking-widest text-green-600 dark:text-green-400">Worker Submitted Evidence</h5>
                                    </div>

                                    {/* Worker Meta / Profile details */}
                                    <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border dark:border-gray-700/30 text-xs">
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Worker User ID</span>
                                            <p className="font-mono text-gray-900 dark:text-white font-bold break-all mt-0.5">{sub.workerId}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Submitted Date & Time</span>
                                            <p className="text-gray-900 dark:text-white font-bold mt-0.5">{new Date(sub.createdAt).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Submission Status</span>
                                            <div className="mt-1">
                                                {sub.status === 'Approved' || sub.status === 'Paid' ? (
                                                    <Badge variant="success">Approved & Paid</Badge>
                                                ) : sub.status === 'Pending' ? (
                                                    <Badge variant="warning">Awaiting Review</Badge>
                                                ) : sub.status === 'Disputed' || sub.disputeOpened ? (
                                                    <Badge variant="info">Disputed</Badge>
                                                ) : (
                                                    <Badge variant="danger">Rejected</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Earned Payout</span>
                                            <p className="font-black text-emerald-500 font-mono mt-0.5">+{task?.rewardPerTask || sub.rewardAmount} USD</p>
                                        </div>
                                    </div>

                                    {/* Rejection Feedback if Rejected */}
                                    {sub.status === 'Rejected' && sub.rejectionReason && (
                                        <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl text-xs">
                                            <span className="text-red-600 dark:text-red-400 font-black block uppercase text-[10px] tracking-wider mb-0.5">Rejection Feedback Provided</span>
                                            <p className="text-red-700 dark:text-red-300 font-bold">{sub.rejectionReason}</p>
                                        </div>
                                    )}

                                    {/* DISPUTE EVIDENCE & EXTRA PROOF SUBMITTED BY WORKER (CREATOR VIEW) */}
                                    {(() => {
                                        const creatorDispute = state.disputes?.find((d: any) => 
                                            String(d.submissionId) === String(sub._id) || 
                                            String(d._id) === String(sub.disputeId) || 
                                            String(d.referenceId) === String(sub._id)
                                        );
                                        const extraDisputeReason = sub.disputeReason || creatorDispute?.description || creatorDispute?.messages?.find((m: any) => m.sender === 'User' && m.message)?.message;
                                        const extraDisputeProof = sub.disputeProofUrl || creatorDispute?.proofUrl || creatorDispute?.messages?.find((m: any) => m.attachmentUrl)?.attachmentUrl;

                                        if (sub.status !== 'Disputed' && !sub.disputeOpened && !extraDisputeReason && !extraDisputeProof) {
                                            return null;
                                        }

                                        return (
                                            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl space-y-2.5 shadow-sm">
                                                <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/50 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="p-1 bg-amber-500 text-white rounded-lg text-xs font-black">⚖️</span>
                                                        <h6 className="font-black text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                                            Worker Dispute Statement & Extra Proof
                                                        </h6>
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase rounded-full">
                                                        {sub.disputeStage === 'Escalated' 
                                                            ? '⚖️ Disputed with Admin' 
                                                            : sub.disputeStage === 'RejectedByCreator'
                                                            ? '⚠️ You Rejected Dispute'
                                                            : '🤝 Disputed with You'}
                                                    </span>
                                                </div>

                                                {sub.disputeStage === 'Escalated' ? (
                                                    <div className="p-2.5 bg-purple-100/80 dark:bg-purple-950/60 rounded-xl border border-purple-300 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 font-medium">
                                                        ⚖️ <strong>Escalated to Platform Admin:</strong> The worker escalated this dispute after your rejection. Platform Admin will issue the final binding verdict.
                                                    </div>
                                                ) : (
                                                    <div className="p-2.5 bg-amber-100/80 dark:bg-amber-950/60 rounded-xl border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 font-medium flex items-center justify-between">
                                                        <span>⏰ <strong>Review Timeout:</strong></span>
                                                        <span className="font-bold text-amber-800 dark:text-amber-200">
                                                            {getRemainingTimeString(sub.disputeReviewDeadline || (sub.updatedAt || sub.createdAt ? new Date(new Date(sub.updatedAt || sub.createdAt).getTime() + (settings?.systemLimits?.disputeReviewTimeoutDays ?? 3) * 86400000) : null)) || `${settings?.systemLimits?.disputeReviewTimeoutDays ?? 3} days`} left (Auto-approves task if unacted)
                                                        </span>
                                                    </div>
                                                )}

                                                {extraDisputeReason && (
                                                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                                                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block mb-0.5">
                                                            Worker's Dispute Reason / Extra Explanation
                                                        </span>
                                                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words leading-relaxed">
                                                            {extraDisputeReason}
                                                        </p>
                                                    </div>
                                                )}

                                                {extraDisputeProof && (
                                                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                                                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block mb-1">
                                                            📸 Worker's Extra Dispute Proof Screenshot / File
                                                        </span>
                                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                            <div 
                                                                className="relative group w-32 h-32 rounded-xl overflow-hidden border border-amber-300 dark:border-amber-700 cursor-zoom-in shadow-md"
                                                                onClick={() => setSelectedProofImage(extraDisputeProof)}
                                                            >
                                                                <img 
                                                                    src={extraDisputeProof} 
                                                                    alt="Worker Dispute Extra Proof" 
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                                                    referrerPolicy="no-referrer" 
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <span className="text-white text-[10px] font-bold">🔍 Click to Expand</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <a 
                                                                    href={extraDisputeProof} 
                                                                    target="_blank" 
                                                                    rel="noreferrer" 
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                                >
                                                                    🔗 Open Full Resolution Proof
                                                                </a>
                                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                                                                    Please review this extra proof provided by the worker to resolve the dispute.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {sub.disputeCreatorNotes && (
                                                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40">
                                                        <span className="text-[10px] font-black uppercase text-red-500 block mb-0.5">
                                                            Your Previous Rejection Notes
                                                        </span>
                                                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                            {sub.disputeCreatorNotes}
                                                        </p>
                                                    </div>
                                                )}

                                                <DisputeTimeline submission={sub} dispute={creatorDispute} settings={settings} />
                                            </div>
                                        );
                                    })()}

                                    {/* Evidence inputs */}
                                    <div className="space-y-3.5 pt-1">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Submitted Proof Values</span>
                                        
                                        {sub.submittedProofs && Array.isArray(sub.submittedProofs) && sub.submittedProofs.length > 0 ? (
                                            <div className="space-y-3">
                                                {sub.submittedProofs.map((item: any, idx: number) => {
                                                    const isImage = item.type === 'file' || (typeof item.value === 'string' && (item.value.startsWith('http') && (item.value.includes('.png') || item.value.includes('.jpg') || item.value.includes('.jpeg') || item.value.includes('firebase') || item.value.includes('cloudinary'))));
                                                    return (
                                                        <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40 text-xs">
                                                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{item.label || `Proof #${idx + 1}`}</span>
                                                            {isImage ? (
                                                                <div className="mt-2">
                                                                    <div className="relative group w-32 h-32 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(item.value)}>
                                                                        <img src={item.value} alt={item.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <span className="text-white text-lg">🔍</span>
                                                                        </div>
                                                                    </div>
                                                                    <a href={item.value} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Full Screenshot</a>
                                                                </div>
                                                            ) : (
                                                                <p className="text-gray-900 dark:text-white font-bold mt-1 break-all">{item.value}</p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="space-y-3 text-xs">
                                                {sub.proofText && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Proof Text / Answer</span>
                                                        <p className="text-gray-900 dark:text-white font-bold mt-1 break-all">{sub.proofText}</p>
                                                    </div>
                                                )}
                                                {sub.proofUsername && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Username provided</span>
                                                        <p className="text-gray-900 dark:text-white font-bold font-mono mt-1">{sub.proofUsername}</p>
                                                    </div>
                                                )}
                                                {sub.proofUserIdVal && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Worker User ID</span>
                                                        <p className="text-gray-900 dark:text-white font-bold font-mono mt-1">{sub.proofUserIdVal}</p>
                                                    </div>
                                                )}
                                                {sub.proofEmail && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Email address</span>
                                                        <p className="text-gray-900 dark:text-white font-bold mt-1">{sub.proofEmail}</p>
                                                    </div>
                                                )}
                                                {sub.proofImage && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Screenshot Proof</span>
                                                        <div className="mt-2">
                                                            <div className="relative group w-32 h-32 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(sub.proofImage)}>
                                                                <img src={sub.proofImage} alt="Screenshot Proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <span className="text-white text-lg">🔍</span>
                                                                </div>
                                                            </div>
                                                            <a href={sub.proofImage} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Full Screenshot</a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer actions */}
                            <div className="p-5 border-t dark:border-gray-700 flex justify-between bg-gray-50/50 dark:bg-gray-900/10">
                                <Button type="button" variant="secondary" onClick={() => setSelectedWorkerSubmissionForDetails(null)}>
                                    Close Window
                                </Button>
                                {(sub.status === 'Pending' || (sub.status === 'Disputed' && sub.disputeStage === 'CreatorReview')) && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                const ok = await handleApproveSubmission(sub._id);
                                                if (ok) setSelectedWorkerSubmissionForDetails(null);
                                            }}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-green-600/10"
                                        >
                                            ✔ Accept & Pay
                                        </button>
                                        <button
                                            onClick={() => {
                                                setRejectingSubId(sub._id);
                                                setRejectionFeedback('');
                                                setSelectedWorkerSubmissionForDetails(null);
                                            }}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/10"
                                        >
                                            ✖ Reject Proof
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* INSUFFICIENT FUNDS / FUNDING COMPLETE MODAL */}
            {insufficientFundsModal && insufficientFundsModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    {insufficientFundsModal.fundingCompleted ? (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col space-y-5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl font-black shrink-0">
                                        🎉
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Campaign Funding Complete</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Your Task Wallet has been funded! You are ready to launch your campaign.</p>
                                    </div>
                                </div>
                                <button onClick={() => setInsufficientFundsModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl">&times;</button>
                            </div>

                            {/* Breakdown */}
                            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-3 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 dark:text-gray-400 uppercase font-bold">Updated Task Wallet Balance:</span>
                                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                        ${insufficientFundsModal.availableTaskWalletUSD.toFixed(2)} USD
                                    </span>
                                </div>
                                {insufficientFundsModal.lastTransferredUserCurr !== undefined && insufficientFundsModal.lastTransferredUserCurr > 0 && (
                                    <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                                        <span className="text-gray-500 dark:text-gray-400 uppercase font-bold">Amount Transferred:</span>
                                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                                            {insufficientFundsModal.lastTransferredUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency} (${insufficientFundsModal.lastTransferredUSD?.toFixed(2)} USD)
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                                    <span className="text-gray-500 dark:text-gray-400 uppercase font-bold">Campaign Cost:</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                                        ${insufficientFundsModal.requiredAmountUSD.toFixed(2)} USD ({insufficientFundsModal.requiredAmountUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency})
                                    </span>
                                </div>
                            </div>

                            <div className="pt-2 flex flex-col gap-2">
                                <Button
                                    variant="primary"
                                    onClick={handleLaunchCampaignFromModal}
                                    disabled={isSubmitting}
                                    className="w-full py-4 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 shadow-xl flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? 'Launching Campaign...' : '🚀 Launch Campaign Now'}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setInsufficientFundsModal(null)}
                                    className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-red-200 dark:border-red-900/50 flex flex-col space-y-5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center text-2xl font-black shrink-0">
                                        ⚠️
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Insufficient Campaign Wallet Balance</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Your Campaign Wallet balance is insufficient to launch this campaign. Transfer funds directly from your Task Earnings or Investment Module.</p>
                                    </div>
                                </div>
                                <button onClick={() => setInsufficientFundsModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl">&times;</button>
                            </div>

                            {/* Cost & Balance Breakdown */}
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-700/60 space-y-2.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 uppercase font-bold">Campaign Total Cost:</span>
                                    <span className="font-mono font-black text-gray-900 dark:text-white text-sm">
                                        ${insufficientFundsModal.requiredAmountUSD.toFixed(2)} USD ({insufficientFundsModal.requiredAmountUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency})
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t dark:border-gray-800">
                                    <span className="text-gray-500 uppercase font-bold">Current Campaign Wallet Balance:</span>
                                    <span className="font-mono font-bold text-red-500">
                                        ${insufficientFundsModal.availableTaskWalletUSD.toFixed(2)} USD
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t dark:border-gray-800">
                                    <span className="text-gray-500 uppercase font-bold">Available Task Earnings Balance:</span>
                                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                        ${(insufficientFundsModal.availableTaskEarningsUSD ?? currentUser.taskEarningsBalance ?? 0).toFixed(2)} USD
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t dark:border-gray-800">
                                    <span className="text-gray-500 uppercase font-bold">Available Investment Balance:</span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        {insufficientFundsModal.availableInvestmentUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency} (${insufficientFundsModal.availableInvestmentUSD.toFixed(2)} USD)
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t dark:border-gray-800 bg-amber-500/10 p-3 rounded-xl font-bold">
                                    <span className="text-amber-700 dark:text-amber-400 uppercase">Shortfall Required to Transfer:</span>
                                    <span className="font-mono text-amber-700 dark:text-amber-400 text-sm">
                                        {insufficientFundsModal.shortfallUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency} (${insufficientFundsModal.shortfallUSD.toFixed(2)} USD)
                                    </span>
                                </div>
                            </div>

                            {/* Select Funding Source */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                                    Select Funding Source Option:
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFundingSource('task_earnings');
                                        }}
                                        className={`p-3 rounded-xl border text-left flex flex-col transition-all ${
                                            fundingSource === 'task_earnings'
                                                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30'
                                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <span className="text-[11px] font-black uppercase text-gray-900 dark:text-white truncate">
                                            💼 Task Earnings
                                        </span>
                                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                                            ${(insufficientFundsModal.availableTaskEarningsUSD ?? currentUser.taskEarningsBalance ?? 0).toFixed(2)} USD
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFundingSource('investment');
                                        }}
                                        className={`p-3 rounded-xl border text-left flex flex-col transition-all ${
                                            fundingSource === 'investment'
                                                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30'
                                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <span className="text-[11px] font-black uppercase text-gray-900 dark:text-white truncate">
                                            🏦 Investment
                                        </span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                            {insufficientFundsModal.availableInvestmentUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFundingSource('combined');
                                        }}
                                        className={`p-3 rounded-xl border text-left flex flex-col transition-all ${
                                            fundingSource === 'combined'
                                                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30'
                                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <span className="text-[11px] font-black uppercase text-gray-900 dark:text-white truncate">
                                            🔀 Combined
                                        </span>
                                        <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                                            ${((insufficientFundsModal.availableTaskEarningsUSD ?? currentUser.taskEarningsBalance ?? 0) + insufficientFundsModal.availableInvestmentUSD).toFixed(2)} USD
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Automatic Notice & Pre-filled Deficit Calculations */}
                            {(() => {
                                const rate = rates[insufficientFundsModal.userCurrency] || 1;
                                const availTaskEarningsUSD = insufficientFundsModal.availableTaskEarningsUSD ?? currentUser.taskEarningsBalance ?? 0;
                                const availInvestmentUSD = insufficientFundsModal.availableInvestmentUSD ?? 0;
                                const availInvestmentUserCurr = insufficientFundsModal.availableInvestmentUserCurr ?? 0;
                                const shortfallUSD = insufficientFundsModal.shortfallUSD;
                                const shortfallUserCurr = insufficientFundsModal.shortfallUserCurr;

                                const isTaskEarningsDeficit = fundingSource === 'task_earnings' && availTaskEarningsUSD < shortfallUSD;
                                const remainingFromInvestmentUSD = isTaskEarningsDeficit ? Number((shortfallUSD - availTaskEarningsUSD).toFixed(2)) : 0;
                                const remainingFromInvestmentUserCurr = isTaskEarningsDeficit ? Number((remainingFromInvestmentUSD * rate).toFixed(2)) : 0;

                                const isInvestmentDeficit = fundingSource === 'investment' && availInvestmentUSD < shortfallUSD;
                                const remainingFromTaskEarningsUSD = isInvestmentDeficit ? Number((shortfallUSD - availInvestmentUSD).toFixed(2)) : 0;

                                const totalAvailableUSD = Number((availTaskEarningsUSD + availInvestmentUSD).toFixed(2));
                                const isCombinedSufficient = totalAvailableUSD >= shortfallUSD;

                                return (
                                    <div className="space-y-3">
                                        {/* Notice Message when Task Earnings is Insufficient */}
                                        {fundingSource === 'task_earnings' && isTaskEarningsDeficit && (
                                            <div className="bg-amber-50 dark:bg-amber-950/50 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                                                    <span className="text-base">⚠️</span>
                                                    <span>Task Earnings Balance Insufficient</span>
                                                </div>
                                                <p className="text-xs text-amber-900 dark:text-amber-200 font-semibold leading-relaxed">
                                                    "Your transfer balance is insufficient, so what remaining amount do you want to transfer from the investment module?"
                                                </p>
                                                <div className="bg-amber-100/70 dark:bg-amber-900/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1 text-[11px] font-mono">
                                                    <div className="flex justify-between">
                                                        <span>Task Earnings Contribution:</span>
                                                        <strong className="text-blue-600 dark:text-blue-400">${availTaskEarningsUSD.toFixed(2)} USD</strong>
                                                    </div>
                                                    <div className="flex justify-between pt-1 border-t border-amber-200/60 dark:border-amber-800/50">
                                                        <span>Auto Pre-filled from Investment:</span>
                                                        <strong className="text-emerald-700 dark:text-emerald-400 font-black">
                                                            {remainingFromInvestmentUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency} (${remainingFromInvestmentUSD.toFixed(2)} USD)
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Notice Message when Investment is Insufficient */}
                                        {fundingSource === 'investment' && isInvestmentDeficit && (
                                            <div className="bg-amber-50 dark:bg-amber-950/50 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                                                    <span className="text-base">⚠️</span>
                                                    <span>Investment Balance Insufficient</span>
                                                </div>
                                                <p className="text-xs text-amber-900 dark:text-amber-200 font-semibold leading-relaxed">
                                                    "Your transfer balance is insufficient, so what remaining amount do you want to transfer from Task Earnings?"
                                                </p>
                                                <div className="bg-amber-100/70 dark:bg-amber-900/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1 text-[11px] font-mono">
                                                    <div className="flex justify-between">
                                                        <span>Investment Module Contribution:</span>
                                                        <strong className="text-emerald-700 dark:text-emerald-400">{availInvestmentUserCurr.toFixed(2)} {insufficientFundsModal.userCurrency}</strong>
                                                    </div>
                                                    <div className="flex justify-between pt-1 border-t border-amber-200/60 dark:border-amber-800/50">
                                                        <span>Auto Pre-filled from Task Earnings:</span>
                                                        <strong className="text-blue-600 dark:text-blue-400 font-black">${remainingFromTaskEarningsUSD.toFixed(2)} USD</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Combined Split Mode Summary */}
                                        {fundingSource === 'combined' && (
                                            <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50 space-y-2 text-xs">
                                                <h4 className="font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                                    🔀 Automatic Multi-Wallet Split Funding
                                                </h4>
                                                <div className="space-y-1 font-mono text-[11px]">
                                                    <div className="flex justify-between">
                                                        <span>From Task Earnings:</span>
                                                        <strong className="text-blue-600 dark:text-blue-400">${Math.min(availTaskEarningsUSD, shortfallUSD).toFixed(2)} USD</strong>
                                                    </div>
                                                    <div className="flex justify-between pt-1 border-t dark:border-purple-900/50">
                                                        <span>From Investment Module:</span>
                                                        <strong className="text-emerald-600 dark:text-emerald-400">
                                                            {((shortfallUSD - Math.min(availTaskEarningsUSD, shortfallUSD)) * rate).toFixed(2)} {insufficientFundsModal.userCurrency} (${Math.max(0, shortfallUSD - availTaskEarningsUSD).toFixed(2)} USD)
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Sufficiency Status Badge */}
                                        {isCombinedSufficient ? (
                                            <div className="bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 font-medium flex items-center gap-2">
                                                <span className="text-emerald-600 dark:text-emerald-400 text-sm">✅</span>
                                                <span>Combined available balance (${totalAvailableUSD.toFixed(2)} USD) is sufficient to fund the required shortfall of ${shortfallUSD.toFixed(2)} USD.</span>
                                            </div>
                                        ) : (
                                            <div className="bg-red-50 dark:bg-red-950/50 p-3 rounded-xl border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
                                                <span className="text-red-500 text-sm">❌</span>
                                                <span>Combined available balance (${totalAvailableUSD.toFixed(2)} USD) is less than the required shortfall (${shortfallUSD.toFixed(2)} USD). Please deposit funds into your Investment Wallet.</span>
                                            </div>
                                        )}

                                        {/* Action Button: Transfer and Launch Campaign */}
                                        <div className="pt-2">
                                            <Button
                                                variant="primary"
                                                onClick={() => handleTransferAndLaunchCampaign()}
                                                disabled={isTransferringFundsModal || isSubmitting || !isCombinedSufficient}
                                                className="w-full py-4 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-400 shadow-xl flex items-center justify-center gap-2 text-white"
                                            >
                                                {isTransferringFundsModal || isSubmitting ? 'Transferring Funds & Launching Campaign...' : '🚀 Transfer and Launch Campaign'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-800">
                                <Link to="/member/deposit" className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1">
                                    💳 Deposit to Investment Balance &rarr;
                                </Link>
                                <Button
                                    variant="secondary"
                                    onClick={() => setInsufficientFundsModal(null)}
                                    className="py-2 px-4 text-xs font-bold uppercase"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* FUNDING & CAMPAIGN CREATION SUCCESS MODAL */}
            {fundingSuccessModal && fundingSuccessModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col space-y-5 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
                            🎉
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Campaign Created Successfully!</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                                {fundingSuccessModal.transferredUserCurr > 0 ? (
                                    <>Successfully transferred <strong className="text-emerald-600 dark:text-emerald-400">{fundingSuccessModal.transferredUserCurr.toFixed(2)} {fundingSuccessModal.userCurrency} (${fundingSuccessModal.transferredUSD.toFixed(2)} USD)</strong> from your Investment Module into your Campaign Wallet, and your campaign has been launched!</>
                                ) : (
                                    <>Your campaign has been successfully created and submitted for Admin approval. It is now live in your campaigns list.</>
                                )}
                            </p>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block mb-1">Remaining Campaign Wallet Balance:</span>
                            <span className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-300">
                                ${fundingSuccessModal.newTaskWalletUSD.toFixed(2)} USD
                            </span>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400">Click OK to view your campaign status in My Campaigns.</p>

                        <div className="pt-2">
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => {
                                    setFundingSuccessModal(null);
                                    setActiveTab('my-tasks');
                                }}
                                className="w-full py-3.5 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 shadow-lg"
                            >
                                OK
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* FORM VALIDATION NOTICE POPUP MODAL */}
            {validationNoticeModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-red-200 dark:border-red-900/50 flex flex-col space-y-5">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center text-2xl font-black shrink-0">
                                    ⚠️
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{validationNoticeModal.title}</h3>
                                    <p className="text-xs text-red-500 dark:text-red-400 font-bold mt-0.5">Please correct the highlighted fields below before launching your campaign.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setValidationNoticeModal(prev => ({ ...prev, isOpen: false }))}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="bg-red-50/60 dark:bg-red-950/40 p-4 rounded-2xl border border-red-200 dark:border-red-900/50 space-y-2 max-h-60 overflow-y-auto">
                            <p className="text-xs font-black uppercase text-red-700 dark:text-red-400">Missing / Incomplete Items:</p>
                            <ul className="space-y-1.5">
                                {validationNoticeModal.messages.map((msg, i) => (
                                    <li key={i} className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                                        {msg}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center">
                            The incomplete field has been highlighted in red on your form.
                        </p>

                        <div className="pt-2">
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => {
                                    const fieldId = validationNoticeModal.firstErrorFieldId;
                                    setValidationNoticeModal(prev => ({ ...prev, isOpen: false }));
                                    if (fieldId) {
                                        setTimeout(() => {
                                            const el = document.getElementById(fieldId);
                                            if (el) {
                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                const inputEl = el.querySelector('input, textarea, select') || el;
                                                if ('focus' in inputEl && typeof inputEl.focus === 'function') {
                                                    (inputEl as HTMLElement).focus();
                                                }
                                            }
                                        }, 150);
                                    }
                                }}
                                className="w-full py-3.5 text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white shadow-lg"
                            >
                                Got it — Fix Form Now
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 1. TRANSFER FUNDS TO CAMPAIGN WALLET MODAL */}
            {/* ========================================================================= */}
            {showTransferModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl font-black shrink-0">
                                    📥
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Transfer Funds to Campaign Wallet</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Top up your campaign balance from Main or Investment funds.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTransferModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Source Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">Select Transfer Direction / Source:</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTransferSource('Main')}
                                    className={`p-3 rounded-2xl border text-left transition-all ${
                                        transferSource === 'Main'
                                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                                >
                                    <span className="text-[9px] font-black uppercase block text-gray-400 truncate">💳 Main &rarr; Campaign</span>
                                    <span className="text-xs sm:text-sm font-black font-mono text-gray-900 dark:text-white mt-1 block truncate">
                                        ${((currentUser.walletBalance || 0) / (rates[currentUser.currency || 'USD'] || 1)).toFixed(2)} USD
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTransferSource('Investment')}
                                    className={`p-3 rounded-2xl border text-left transition-all ${
                                        transferSource === 'Investment'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                                >
                                    <span className="text-[9px] font-black uppercase block text-gray-400 truncate">📈 Invest &rarr; Campaign</span>
                                    <span className="text-xs sm:text-sm font-black font-mono text-gray-900 dark:text-white mt-1 block truncate">
                                        ${((currentUser.investmentBalance || 0) / (rates[currentUser.currency || 'USD'] || 1)).toFixed(2)} USD
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTransferSource('CampaignToMain')}
                                    className={`p-3 rounded-2xl border text-left transition-all ${
                                        transferSource === 'CampaignToMain'
                                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                                >
                                    <span className="text-[9px] font-black uppercase block text-purple-500 dark:text-purple-400 truncate">🔄 Campaign &rarr; Main</span>
                                    <span className="text-xs sm:text-sm font-black font-mono text-gray-900 dark:text-white mt-1 block truncate">
                                        ${availableCampaignWalletUSD.toFixed(2)} USD
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Transfer Amount Input */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">Transfer Amount ($ USD):</label>
                                <span className="text-[10px] font-bold text-gray-400">Base Currency = $ USD</span>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={transferInputAmount}
                                    onChange={(e) => setTransferInputAmount(e.target.value)}
                                    className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 font-mono font-black text-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Live Balance Impact Preview */}
                        {(() => {
                            const amtUSD = typeof transferInputAmount === 'number' ? transferInputAmount : parseFloat(transferInputAmount as string) || 0;
                            const rate = rates[currentUser.currency || 'USD'] || 1;
                            const currentCampaignWalletUSD = availableCampaignWalletUSD;

                            if (transferSource === 'CampaignToMain') {
                                const newCampaignWalletUSD = Math.max(0, currentCampaignWalletUSD - amtUSD);
                                const newMainUserCurr = (currentUser.walletBalance || 0) + (amtUSD * rate);

                                return (
                                    <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/40 space-y-2 text-xs">
                                        <div className="flex justify-between font-medium">
                                            <span className="text-gray-500 dark:text-gray-400">Campaign Wallet After Transfer:</span>
                                            <span className={`font-mono font-bold ${currentCampaignWalletUSD < amtUSD ? 'text-red-500' : 'text-purple-600 dark:text-purple-300'}`}>
                                                ${newCampaignWalletUSD.toFixed(2)} USD
                                            </span>
                                        </div>
                                        <div className="flex justify-between font-medium pt-1 border-t border-purple-200 dark:border-purple-800">
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">New Main Wallet Balance:</span>
                                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                {newMainUserCurr.toFixed(2)} {currentUser.currency || 'USD'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            } else {
                                const newCampaignWalletUSD = currentCampaignWalletUSD + amtUSD;
                                const sourceBalanceUSD = transferSource === 'Main' 
                                    ? (currentUser.walletBalance || 0) / rate 
                                    : (currentUser.investmentBalance || 0) / rate;
                                const newSourceBalanceUSD = Math.max(0, sourceBalanceUSD - amtUSD);

                                return (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border dark:border-gray-700 space-y-2 text-xs">
                                        <div className="flex justify-between font-medium">
                                            <span className="text-gray-500">Source Balance After Transfer:</span>
                                            <span className={`font-mono font-bold ${newSourceBalanceUSD < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                                ${newSourceBalanceUSD.toFixed(2)} USD
                                            </span>
                                        </div>
                                        <div className="flex justify-between font-medium pt-1 border-t border-gray-200 dark:border-gray-700">
                                            <span className="text-blue-600 dark:text-blue-400 font-bold">New Campaign Wallet Balance:</span>
                                            <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                                                ${newCampaignWalletUSD.toFixed(2)} USD
                                            </span>
                                        </div>
                                    </div>
                                );
                            }
                        })()}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowTransferModal(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-black uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const transferUSD = typeof transferInputAmount === 'number' ? transferInputAmount : parseFloat(transferInputAmount as string) || 0;
                                    if (transferUSD <= 0) return;

                                    const userCurr = currentUser.currency || 'USD';
                                    const rate = rates[userCurr] || 1;
                                    const transferInUserCurr = transferUSD * rate;

                                    if (transferSource === 'CampaignToMain') {
                                        const currentCampaignWalletUSD = availableCampaignWalletUSD;
                                        if (transferUSD > currentCampaignWalletUSD) {
                                            alert(`Insufficient funds in Campaign Wallet. Available: $${currentCampaignWalletUSD.toFixed(2)} USD`);
                                            return;
                                        }

                                        try {
                                            const res = await convertTaskWalletBalance({ userId: currentUser._id, amountUSD: transferUSD });
                                            dispatch({ type: 'UPDATE_USER', payload: res.user || res });
                                            alert(`Successfully transferred $${transferUSD.toFixed(2)} USD (${transferInUserCurr.toFixed(2)} ${userCurr}) from Campaign Wallet back to Main Wallet!`);
                                            setShowTransferModal(false);
                                        } catch (err: any) {
                                            alert(err.message || 'Transfer failed');
                                        }
                                    } else {
                                        const availableSourceUSD = transferSource === 'Main' 
                                            ? (currentUser.walletBalance || 0) / rate 
                                            : (currentUser.investmentBalance || 0) / rate;

                                        if (transferUSD > availableSourceUSD) {
                                            alert(`Insufficient funds in ${transferSource} Wallet. Available: $${availableSourceUSD.toFixed(2)} USD`);
                                            return;
                                        }

                                        try {
                                            const res = await transferWalletToCampaign({
                                                userId: currentUser._id,
                                                amountUserCurr: transferInUserCurr,
                                                amountUSD: transferUSD,
                                                sourceWallet: transferSource as 'Main' | 'Investment'
                                            });
                                            dispatch({ type: 'UPDATE_USER', payload: res.user });
                                            if (res.transaction) {
                                                dispatch({ type: 'ADD_TRANSACTION', payload: res.transaction });
                                            }
                                            setShowTransferModal(false);
                                        } catch (err: any) {
                                            alert(err.message || 'Transfer failed');
                                        }
                                    }
                                }}
                                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20"
                            >
                                Confirm & Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 2. CONVERT TASK EARNINGS MODAL */}
            {/* ========================================================================= */}
            {showConvertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl font-black shrink-0">
                                    🔄
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Convert Task Earnings</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Instantly convert earned gig rewards into campaign funds with 0% fee.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowConvertModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Available Task Earnings */}
                        <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex justify-between items-center">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Available Task Rewards Balance</span>
                                <p className="text-xl font-mono font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                                    ${netAvailableTaskEarningsUSD.toFixed(2)} USD
                                </p>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase">0% Conversion Fee</span>
                        </div>

                        {/* Convert Amount Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">Amount to Convert ($ USD):</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={convertInputAmount}
                                    onChange={(e) => setConvertInputAmount(e.target.value)}
                                    className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 font-mono font-black text-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConvertModal(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-black uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const convertUSD = typeof convertInputAmount === 'number' ? convertInputAmount : parseFloat(convertInputAmount as string) || 0;
                                    if (convertUSD <= 0) return;

                                    const taskEarningsUSD = netAvailableTaskEarningsUSD;
                                    if (convertUSD > taskEarningsUSD) {
                                        alert(`Insufficient Task Earnings. Available: $${taskEarningsUSD.toFixed(2)} USD`);
                                        return;
                                    }

                                    try {
                                        const res = await transferTaskEarningsToCampaignWallet({
                                            userId: currentUser._id,
                                            amountUSD: convertUSD
                                        });

                                        dispatch({ type: 'UPDATE_USER', payload: res.user });
                                        if (res.transaction) {
                                            dispatch({ type: 'ADD_TRANSACTION', payload: res.transaction });
                                        }
                                        setShowConvertModal(false);
                                    } catch (err: any) {
                                        alert(err.message || 'Conversion failed');
                                    }
                                }}
                                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20"
                            >
                                Convert & Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 3. CAMPAIGN FUNDS & WALLET ANALYTICS MODAL */}
            {/* ========================================================================= */}
            {showAnalyticsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 md:p-8 max-w-2xl w-full shadow-2xl border dark:border-gray-700 space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl font-black shrink-0">
                                    📊
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Campaign Wallet Analytics</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">In-depth efficiency, utilization, and campaign cost audit.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAnalyticsModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Metric 1 */}
                            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Wallet Utilization Rate</span>
                                <div className="text-xl font-mono font-black text-gray-900 dark:text-white mt-1">
                                    {transferredInUSD > 0 ? ((campaignPurchasesUSD / transferredInUSD) * 100).toFixed(1) : '0.0'}%
                                </div>
                                <div className="w-full bg-blue-200 dark:bg-blue-900 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, transferredInUSD > 0 ? (campaignPurchasesUSD / transferredInUSD) * 100 : 0)}%` }} />
                                </div>
                            </div>

                            {/* Metric 2 */}
                            <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Average Campaign Cost</span>
                                <div className="text-xl font-mono font-black text-purple-700 dark:text-purple-300 mt-1">
                                    ${mySubmittedTasks.length > 0 ? (campaignPurchasesUSD / mySubmittedTasks.length).toFixed(2) : '0.00'}
                                </div>
                            </div>
                            {/* Metric 3 */}
                            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Campaign Outlay</span>
                                <div className="text-xl font-mono font-black text-emerald-700 dark:text-emerald-300 mt-1">
                                    ${campaignPurchasesUSD.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t dark:border-gray-700 flex justify-end">
                            <button
                                onClick={() => setShowAnalyticsModal(false)}
                                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
                            >
                                Close Analytics
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTasksSubmit;
