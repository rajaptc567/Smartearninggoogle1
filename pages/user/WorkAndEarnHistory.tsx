import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import Modal from '../../components/ui/Modal';
import { LoadingCircle } from '../../components/ui/LoadingCircle';
import { 
    History as HistoryIcon,
    ArrowRightLeft as ConvertIcon,
    Layers as TaskIcon,
    FolderKanban as CampaignIcon,
    Download as DepositIcon,
    Upload as WithdrawalIcon,
    Search as SearchIcon,
    Calendar as CalendarIcon,
    ChevronRight as ChevronRightIcon,
    ArrowRight as ArrowRightIcon,
    CheckCircle2 as ApprovedIcon,
    Clock as PendingIcon,
    XCircle as RejectedIcon,
    DollarSign as DollarIcon,
    Wallet as WalletIcon,
    Shield as ShieldIcon,
    Tag as TagIcon,
    RotateCcw as RefundIcon,
    Award as RewardIcon
} from 'lucide-react';
import { formatCurrency } from '../../types';
import { openTaskDispute } from '../../services/api';
import { getRemainingTimeString, renderDisputeStageBadge, renderDisputeTimerBox } from './UserTasksSubmit';
import { DisputeTimeline } from '../../components/DisputeTimeline';

export type FilterTab = 'all' | 'campaign_purchases' | 'wallet_transfers' | 'task_rewards' | 'conversions' | 'deposits_withdrawals' | 'refunds';

export const isRefundItem = (item: HistoryUnifiedItem) => {
    const titleLower = (item.title || '').toLowerCase();
    const subTitleLower = (item.subTitle || '').toLowerCase();
    const typeLabelLower = (item.typeLabel || '').toLowerCase();
    const statusLower = (item.status || '').toLowerCase();
    const rawType = (item.rawItem?.type || '').toLowerCase();
    const rawDesc = (item.rawItem?.description || '').toLowerCase();
    const rawSubType = (item.rawItem?.subType || '').toLowerCase();

    return (
        typeLabelLower.includes('refund') ||
        titleLower.includes('refund') ||
        subTitleLower.includes('refund') ||
        rawType.includes('refund') ||
        rawDesc.includes('refund') ||
        rawDesc.includes('returned') ||
        rawSubType === 'refund' ||
        statusLower === 'refunded' ||
        statusLower === 'cancelled' ||
        statusLower === 'deleted' ||
        (item.itemType === 'campaign_purchase' && (statusLower === 'cancelled' || statusLower === 'deleted' || item.amountUSD > 0))
    );
};

export interface HistoryUnifiedItem {
    id: string;
    itemType: 'campaign_purchase' | 'wallet_transfer' | 'task_completed' | 'order_received' | 'conversion' | 'deposit' | 'withdrawal';
    typeLabel: string;
    title: string;
    subTitle: string;
    category?: string;
    amountUSD: number; // Signed USD amount (+ for credit, - for deduction)
    amountBase: number; // Signed Base currency amount
    currency: string;
    exchangeRate: number;
    status: string;
    date: string;
    rawItem: any;
    trxId: string;
    flow: string; // e.g. "Investment Wallet ➔ Task Wallet" or "Task Wallet ➔ YouTube Campaign Escrow"
    transferSource?: 'investment' | 'task_earnings' | 'campaign_to_main';
    remainingBalanceUSD: number; // Remaining Task Wallet balance in USD after transaction
    remainingBalanceBase: number; // Remaining Task Wallet balance in Base currency after transaction
    // Campaign specific details
    campaignPurchasedQty?: number;
    rewardPerTaskUSD?: number;
    subtotalUSD?: number;
    adminCommissionUSD?: number;
    slotsAndCommissionUSD?: number;
    creationFeeUSD?: number;
    totalCostUSD?: number;
    totalCostBase?: number;
    // Task specific details
    taskTitle?: string;
    taskLink?: string;
    workerName?: string;
    proofText?: string;
    proofUsername?: string;
    proofUserIdVal?: string;
    proofEmail?: string;
    proofImage?: string;
    rejectionReason?: string;
    disputeReason?: string;
    disputeStage?: string;
    disputeOpened?: boolean;
    disputeDeadline?: string;
    disputeId?: string;
    disputeReviewDeadline?: string;
    secondDisputeDeadline?: string;
    disputeCreatorNotes?: string;
    disputeProofUrl?: string;
    paymentMethod?: string;
    accountNumber?: string;
    rewardAmountUSD?: number;
    rewardAmountBase?: number;
}

const WorkAndEarnHistory: React.FC = () => {
    const { state } = useData();
    const navigate = useNavigate();
    const { currentUser, userTaskSubmissions, userTasks, transactions, deposits, withdrawals } = state;

    // Filters and search
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Modal state
    const [selectedItem, setSelectedItem] = useState<HistoryUnifiedItem | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [isDisputing, setIsDisputing] = useState(false);
    const [disputeSuccess, setDisputeSuccess] = useState<string | null>(null);
    const [copiedUrl, setCopiedUrl] = useState(false);

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl min-h-[400px]">
                <LoadingCircle text="Loading Work & Earn history records..." />
            </div>
        );
    }

    const settings = state.settings;
    const exchangeRate = settings.exchangeRates?.[currentUser.currency || 'USD'] || 1;
    const userCurr = currentUser.currency || 'USD';

    // Build unified history list
    const unifiedHistory = useMemo(() => {
        const list: HistoryUnifiedItem[] = [];
        const userIdStr = currentUser._id?.toString();
        const addedTrxIds = new Set<string>();

        // 1. Campaign Creations / Purchases (from userTasks created by user)
        (userTasks || [])
            .filter(t => t.userId?.toString() === userIdStr)
            .forEach(t => {
                const subtotalUSD = Number(((t.targetQuantity || 1) * (t.rewardPerTask || 0)).toFixed(2));
                const commissionPercent = state.settings?.userTaskConfig?.commissionPercent ?? 10;
                const adminCommissionUSD = Number((t.adminCommission ?? (subtotalUSD * (commissionPercent / 100))).toFixed(2));
                const slotsAndCommissionUSD = Number((t.totalBudget ?? (subtotalUSD + adminCommissionUSD)).toFixed(2));
                const defaultCreationFee = state.settings?.userTaskConfig?.campaignFeeEnabled ? (state.settings?.userTaskConfig?.campaignFeeAmount || 0) : 0;
                const creationFeeUSD = Number((t.baseFeeCharged ?? t.campaignFeeUSD ?? t.baseCampaignFee ?? defaultCreationFee).toFixed(2));
                const totalCost = Number(t.totalBudgetUSD || (slotsAndCommissionUSD + creationFeeUSD).toFixed(2));
                const itemTrxId = `trx_camp_${t._id}`;
                addedTrxIds.add(itemTrxId);
                
                list.push({
                    id: `camp_${t._id}`,
                    itemType: 'campaign_purchase',
                    typeLabel: 'Campaign Cost',
                    title: `Created Campaign: ${t.title}`,
                    subTitle: `${t.category} • ${t.targetQuantity || 1} workers requested at $${(t.rewardPerTask || 0).toFixed(2)} per task`,
                    category: t.category,
                    amountUSD: -totalCost,
                    amountBase: -(totalCost * exchangeRate),
                    currency: 'USD',
                    exchangeRate: exchangeRate,
                    status: t.status || 'Active',
                    date: t.createdAt || new Date().toISOString(),
                    rawItem: t,
                    trxId: itemTrxId,
                    flow: `Campaign Wallet ➔ Reserved Escrow (${t.category})`,
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0,
                    campaignPurchasedQty: t.targetQuantity || 1,
                    rewardPerTaskUSD: t.rewardPerTask || 0,
                    subtotalUSD,
                    adminCommissionUSD,
                    slotsAndCommissionUSD,
                    creationFeeUSD,
                    totalCostUSD: totalCost,
                    totalCostBase: totalCost * exchangeRate,
                    taskTitle: t.title,
                    taskLink: t.link
                });
            });

        // 2. Transfers from Investment Wallet or Task Earnings to Task Wallet / Campaign Wallet
        (transactions || [])
            .filter(t => t.userId?.toString() === userIdStr && (
                t.type === 'Investment To Task Wallet Transfer' || 
                t.type === 'Task Wallet Transfer' ||
                t.type === 'Task Reward Transfer' ||
                t.type === 'Main To Campaign Wallet Transfer' ||
                t.type === 'Task Earnings Transfer' ||
                t.type === 'Campaign Wallet To Main Transfer' ||
                t.description?.toLowerCase().includes('investment to task wallet') ||
                t.description?.toLowerCase().includes('investment to campaign') ||
                t.description?.toLowerCase().includes('task earnings wallet') ||
                t.description?.toLowerCase().includes('task earnings to campaign') ||
                t.description?.toLowerCase().includes('from investment module') ||
                t.description?.toLowerCase().includes('from task earnings') ||
                t.description?.toLowerCase().includes('campaign wallet')
            ))
            .forEach(t => {
                const txIdStr = String(t._id);
                if (addedTrxIds.has(txIdStr)) return;
                addedTrxIds.add(txIdStr);

                let transferUSD = 0;
                let transferBase = 0;

                if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                    transferUSD = Math.abs(t.amountUSD);
                    transferBase = t.amount ? Math.abs(t.amount) : transferUSD * exchangeRate;
                } else if (t.currency && t.currency !== 'USD') {
                    transferBase = Math.abs(t.amount || 0);
                    transferUSD = (t.exchangeRate || exchangeRate) > 0 ? transferBase / (t.exchangeRate || exchangeRate) : transferBase / exchangeRate;
                } else {
                    transferUSD = Math.abs(t.amount || 0);
                    transferBase = transferUSD * exchangeRate;
                }

                const typeStr = t.type || '';
                const descStr = (t.description || '').toLowerCase();

                let flow = 'Main Account ➔ Campaign Wallet';
                let title = 'Added Funds to Campaign Wallet';
                let subTitle = t.description || `Transferred $${transferUSD.toFixed(2)} USD from Main Account to Campaign Wallet`;
                let transferSource: 'investment' | 'task_earnings' | 'campaign_to_main' = 'investment';

                if (typeStr === 'Task Reward Transfer' || typeStr === 'Task Earnings Transfer' || descStr.includes('task earnings')) {
                    flow = 'Task Earnings ➔ Campaign Wallet';
                    title = 'Transferred Task Earnings to Campaign';
                    subTitle = t.description || `Transferred $${transferUSD.toFixed(2)} USD from earned rewards to Campaign Wallet`;
                    transferSource = 'task_earnings';
                } else if (typeStr === 'Main To Campaign Wallet Transfer' || descStr.includes('main to campaign') || descStr.includes('investment to campaign') || descStr.includes('investment module') || descStr.includes('from investment')) {
                    flow = 'Main Account ➔ Campaign Wallet';
                    title = 'Transferred Main Balance to Campaign';
                    subTitle = t.description || `Transferred $${transferUSD.toFixed(2)} USD from Main Balance to Campaign Wallet`;
                    transferSource = 'investment';
                } else if (typeStr === 'Campaign Wallet To Main Transfer' || descStr.includes('campaign wallet to main')) {
                    flow = 'Campaign Wallet ➔ Main Account';
                    title = 'Returned Campaign Funds to Main Balance';
                    subTitle = t.description || `Transferred $${transferUSD.toFixed(2)} USD from Campaign Wallet to Main Account`;
                    transferSource = 'campaign_to_main';
                }

                list.push({
                    id: txIdStr,
                    itemType: 'wallet_transfer',
                    typeLabel: 'Wallet Transfer',
                    title: title,
                    subTitle: subTitle,
                    amountUSD: transferUSD,
                    amountBase: transferBase,
                    currency: userCurr,
                    exchangeRate: t.exchangeRate || exchangeRate,
                    status: t.status || 'Approved',
                    date: t.date || new Date().toISOString(),
                    rawItem: t,
                    trxId: txIdStr,
                    flow: flow,
                    transferSource: transferSource,
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0
                });
            });

        // 3. Task Wallet Conversions to Main Balance
        (transactions || [])
            .filter(t => t.userId?.toString() === userIdStr && (
                t.type === 'Task Wallet Conversion' || 
                t.description?.toLowerCase().includes('task wallet conversion')
            ))
            .forEach(t => {
                const txIdStr = String(t._id);
                if (addedTrxIds.has(txIdStr)) return;
                addedTrxIds.add(txIdStr);

                let convUSD = 0;
                let convBase = 0;

                if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                    convUSD = Math.abs(t.amountUSD);
                    convBase = t.amount ? Math.abs(t.amount) : convUSD * exchangeRate;
                } else if (t.currency && t.currency !== 'USD') {
                    convBase = Math.abs(t.amount || 0);
                    convUSD = (t.exchangeRate || exchangeRate) > 0 ? convBase / (t.exchangeRate || exchangeRate) : convBase / exchangeRate;
                } else {
                    convUSD = Math.abs(t.amount || 0);
                    convBase = convUSD * exchangeRate;
                }

                list.push({
                    id: txIdStr,
                    itemType: 'conversion',
                    typeLabel: 'Earnings Converted',
                    title: 'Converted Task Earnings',
                    subTitle: t.description || `Transferred $${convUSD.toFixed(2)} USD from Task Earnings to Main Account`,
                    amountUSD: -convUSD,
                    amountBase: -convBase,
                    currency: userCurr,
                    exchangeRate: t.exchangeRate || exchangeRate,
                    status: t.status || 'Approved',
                    date: t.date || new Date().toISOString(),
                    rawItem: t,
                    trxId: txIdStr,
                    flow: 'Task Earnings ➔ Main Account Balance',
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0
                });
            });

        // 4. Task Completion Submissions & Rewards (earned or submitted by worker)
        (userTaskSubmissions || [])
            .filter(s => (
                s.workerId?.toString() === userIdStr || 
                s.userId?.toString() === userIdStr || 
                s.workerName === currentUser.username || 
                s.workerName === currentUser.fullName
            ))
            .forEach(s => {
                const subIdStr = String(s._id);
                const parentTask = (userTasks || []).find(t => String(t._id) === String(s.taskId));
                const rewardUSD = s.rewardAmount || parentTask?.rewardPerTask || 0;
                const subTrxId = `sub_reward_${subIdStr}`;

                // Find matching financial transaction for this submission
                const matchingTx = (transactions || []).find(t => 
                    t.userId?.toString() === userIdStr &&
                    (
                        String((t as any).submissionId) === subIdStr ||
                        (s.rewardTransactionId && String(t._id) === String(s.rewardTransactionId))
                    )
                );

                if (matchingTx) {
                    addedTrxIds.add(String(matchingTx._id));
                }
                addedTrxIds.add(subTrxId);
                addedTrxIds.add(subIdStr);
                if (s.rewardTransactionId) {
                    addedTrxIds.add(String(s.rewardTransactionId));
                }

                const displayDate = (s.status === 'Approved' || s.status === 'Paid') && matchingTx?.date 
                    ? matchingTx.date 
                    : (s.createdAt || new Date().toISOString());

                list.push({
                    id: `sub_${subIdStr}`,
                    itemType: 'task_completed',
                    typeLabel: s.status === 'Approved' || s.status === 'Paid' ? 'Task Earned' : `Task (${s.status})`,
                    title: `Task Completed: ${s.taskTitle || parentTask?.title || 'Micro Task'}`,
                    subTitle: parentTask?.category ? `Category: ${s.taskCategory || parentTask?.category}` : 'Task Work Submitted',
                    category: s.taskCategory || parentTask?.category,
                    amountUSD: s.status === 'Approved' || s.status === 'Paid' ? rewardUSD : 0,
                    amountBase: s.status === 'Approved' || s.status === 'Paid' ? rewardUSD * exchangeRate : 0,
                    currency: 'USD',
                    exchangeRate: exchangeRate,
                    status: s.status || 'Pending',
                    date: displayDate,
                    rawItem: s,
                    trxId: matchingTx?._id ? String(matchingTx._id) : subTrxId,
                    flow: 'Campaign Sponsor Escrow ➔ Task Balance',
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0,
                    taskTitle: s.taskTitle || parentTask?.title,
                    taskLink: parentTask?.link,
                    workerName: s.workerName || currentUser.fullName,
                    proofText: s.proofText,
                    proofUsername: s.proofUsername,
                    proofUserIdVal: s.proofUserIdVal,
                    proofEmail: s.proofEmail,
                    proofImage: s.proofImage,
                    rejectionReason: s.rejectionReason,
                    disputeReason: s.disputeReason,
                    disputeProofUrl: s.disputeProofUrl,
                    disputeStage: s.disputeStage,
                    disputeDeadline: s.disputeDeadline,
                    secondDisputeDeadline: s.secondDisputeDeadline,
                    disputeReviewDeadline: s.disputeReviewDeadline,
                    disputeCreatorNotes: s.disputeCreatorNotes,
                    disputeOpened: s.disputeOpened
                });
            });

        // 5. Standalone Task Rewards from Transactions table (e.g. manual admin credit or offerwall)
        (transactions || [])
            .filter(t => t.userId?.toString() === userIdStr && (
                t.type === 'Task Reward' ||
                t.type === 'Micro-Task' ||
                t.type === 'Task Completed'
            ))
            .forEach(t => {
                const txIdStr = String(t._id);
                const subIdStr = (t as any).submissionId ? String((t as any).submissionId) : null;

                if (addedTrxIds.has(txIdStr) || (subIdStr && addedTrxIds.has(subIdStr))) {
                    return; // Already merged with submission row
                }

                addedTrxIds.add(txIdStr);

                let rewardUSD = 0;
                let rewardBase = 0;

                if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                    rewardUSD = Math.abs(t.amountUSD);
                    rewardBase = t.amount ? Math.abs(t.amount) : rewardUSD * exchangeRate;
                } else if (t.currency && t.currency !== 'USD') {
                    rewardBase = Math.abs(t.amount || 0);
                    rewardUSD = (t.exchangeRate || exchangeRate) > 0 ? rewardBase / (t.exchangeRate || exchangeRate) : rewardBase / exchangeRate;
                } else {
                    rewardUSD = Math.abs(t.amount || 0);
                    rewardBase = rewardUSD * exchangeRate;
                }

                list.push({
                    id: txIdStr,
                    itemType: 'task_completed',
                    typeLabel: 'Task Earned',
                    title: t.description || 'Micro Task Reward Credited',
                    subTitle: `Earned $${rewardUSD.toFixed(2)} USD (${rewardBase.toFixed(2)} ${userCurr})`,
                    amountUSD: rewardUSD,
                    amountBase: rewardBase,
                    currency: userCurr,
                    exchangeRate: t.exchangeRate || exchangeRate,
                    status: t.status || 'Approved',
                    date: t.date || new Date().toISOString(),
                    rawItem: t,
                    trxId: txIdStr,
                    flow: 'Task Escrow ➔ Task Wallet',
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0
                });
            });

        // 6. Deposits in Task Hub
        (deposits || [])
            .filter(d => d.userId?.toString() === userIdStr && ((d as any).isHub || (d as any).isHubDeposit || d.userNotes?.toLowerCase().includes('hub') || d.userNotes?.toLowerCase().includes('task')))
            .forEach(d => {
                const depUSD = d.amountUSD || (d.currency === 'USD' ? d.amount : d.amount / exchangeRate);
                list.push({
                    id: d._id,
                    itemType: 'deposit',
                    typeLabel: 'Deposit',
                    title: `Deposit via ${d.paymentMethodName || d.method || 'Payment Gateway'}`,
                    subTitle: 'Work & Earn Hub Deposit',
                    amountUSD: depUSD,
                    amountBase: depUSD * exchangeRate,
                    currency: 'USD',
                    exchangeRate: exchangeRate,
                    status: d.status,
                    date: d.date,
                    rawItem: d,
                    trxId: d.transactionId || d._id,
                    flow: `Payment Gateway (${d.paymentMethodName || d.method || 'Gateway'}) ➔ Task Wallet`,
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0,
                    paymentMethod: d.paymentMethodName || d.method
                });
            });

        // 7. Withdrawals from Task Hub
        (withdrawals || [])
            .filter(w => w.userId?.toString() === userIdStr && ((w as any).isHub || (w as any).isHubWithdrawal || (w as any).isTaskWallet || w.userNotes?.toLowerCase().includes('task')))
            .forEach(w => {
                const withUSD = w.amountUSD || (w.currency === 'USD' ? w.amount : w.amount / exchangeRate);
                list.push({
                    id: w._id,
                    itemType: 'withdrawal',
                    typeLabel: 'Withdrawal',
                    title: `Payout via ${w.paymentMethodName || w.method || 'Payout Gateway'}`,
                    subTitle: 'Work & Earn Payout Withdrawal',
                    amountUSD: -withUSD,
                    amountBase: -withUSD * exchangeRate,
                    currency: 'USD',
                    exchangeRate: exchangeRate,
                    status: w.status,
                    date: w.date,
                    rawItem: w,
                    trxId: w._id,
                    flow: `Task Wallet ➔ Payout Gateway (${w.paymentMethodName || w.method || 'Payout'})`,
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0,
                    paymentMethod: w.paymentMethodName || w.method,
                    accountNumber: w.accountNumber
                });
            });

        // 8. Standalone Refund Transactions (Campaign Refunds, Withdrawal Refunds, Transfer Refunds)
        (transactions || [])
            .filter(t => t.userId?.toString() === userIdStr && (
                t.type?.toLowerCase().includes('refund') ||
                t.description?.toLowerCase().includes('refund') ||
                t.description?.toLowerCase().includes('returned') ||
                t.description?.toLowerCase().includes('campaign cancellation')
            ))
            .forEach(t => {
                const txIdStr = String(t._id);
                if (addedTrxIds.has(txIdStr)) return;
                addedTrxIds.add(txIdStr);

                let refUSD = 0;
                let refBase = 0;
                if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                    refUSD = Math.abs(t.amountUSD);
                    refBase = t.amount ? Math.abs(t.amount) : refUSD * exchangeRate;
                } else if (t.currency && t.currency !== 'USD') {
                    refBase = Math.abs(t.amount || 0);
                    refUSD = (t.exchangeRate || exchangeRate) > 0 ? refBase / (t.exchangeRate || exchangeRate) : refBase / exchangeRate;
                } else {
                    refUSD = Math.abs(t.amount || 0);
                    refBase = refUSD * exchangeRate;
                }

                list.push({
                    id: txIdStr,
                    itemType: 'campaign_purchase',
                    typeLabel: 'Refund Credited',
                    title: t.description || 'Refund Credited to Balance',
                    subTitle: `Refund of $${refUSD.toFixed(2)} USD credited back to balance`,
                    amountUSD: refUSD,
                    amountBase: refBase,
                    currency: userCurr,
                    exchangeRate: t.exchangeRate || exchangeRate,
                    status: t.status || 'Refunded',
                    date: t.date || new Date().toISOString(),
                    rawItem: t,
                    trxId: txIdStr,
                    flow: 'Escrow ➔ Wallet Balance (Refund)',
                    remainingBalanceUSD: 0,
                    remainingBalanceBase: 0
                });
            });

        // SORT CHRONOLOGICALLY OLDEST TO NEWEST TO COMPUTE RUNNING BALANCE
        list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Working backwards from current task wallet balance
        let currentRunningUSD = currentUser.taskWalletBalance || 0;
        for (let i = list.length - 1; i >= 0; i--) {
            list[i].remainingBalanceUSD = Number(currentRunningUSD.toFixed(2));
            list[i].remainingBalanceBase = Number((currentRunningUSD * exchangeRate).toFixed(2));
            currentRunningUSD = currentRunningUSD - list[i].amountUSD;
        }

        // Reverse back to NEWEST FIRST for display
        return list.reverse();
    }, [currentUser, userTaskSubmissions, userTasks, transactions, deposits, withdrawals, exchangeRate]);

    // Calculate Summary Stats
    const stats = useMemo(() => {
        let totalCampaignSpentUSD = 0;
        let totalTransferredInUSD = 0;
        let totalTaskEarningsTransferredInUSD = 0;
        let totalEarnedUSD = 0;
        let totalConvertedUSD = 0;
        let totalDepositsUSD = 0;
        let totalWithdrawalsUSD = 0;
        let totalRefundsUSD = 0;

        unifiedHistory.forEach(item => {
            if (isRefundItem(item)) {
                totalRefundsUSD += Math.abs(item.amountUSD);
            }
            if (item.itemType === 'campaign_purchase') {
                totalCampaignSpentUSD += Math.abs(item.amountUSD);
            } else if (item.itemType === 'wallet_transfer') {
                if (item.transferSource === 'task_earnings') {
                    totalTaskEarningsTransferredInUSD += Math.abs(item.amountUSD);
                } else if (item.transferSource === 'campaign_to_main') {
                    // Campaign to main transfer
                } else {
                    totalTransferredInUSD += Math.abs(item.amountUSD);
                }
            } else if (item.itemType === 'task_completed') {
                totalEarnedUSD += Math.abs(item.amountUSD);
            } else if (item.itemType === 'conversion') {
                totalConvertedUSD += Math.abs(item.amountUSD);
            } else if (item.itemType === 'deposit') {
                totalDepositsUSD += Math.abs(item.amountUSD);
            } else if (item.itemType === 'withdrawal') {
                totalWithdrawalsUSD += Math.abs(item.amountUSD);
            }
        });

        return {
            totalCampaignSpentUSD,
            totalTransferredInUSD,
            totalTaskEarningsTransferredInUSD,
            totalEarnedUSD,
            totalConvertedUSD,
            totalDepositsUSD,
            totalWithdrawalsUSD,
            totalRefundsUSD
        };
    }, [unifiedHistory]);

    // Filter items based on active tab, search term, status, date
    const filteredHistory = useMemo(() => {
        return unifiedHistory.filter(item => {
            // Tab filter
            if (activeTab === 'campaign_purchases' && item.itemType !== 'campaign_purchase') return false;
            if (activeTab === 'wallet_transfers' && item.itemType !== 'wallet_transfer') return false;
            if (activeTab === 'task_rewards' && item.itemType !== 'task_completed') return false;
            if (activeTab === 'conversions' && item.itemType !== 'conversion') return false;
            if (activeTab === 'deposits_withdrawals' && item.itemType !== 'deposit' && item.itemType !== 'withdrawal') return false;
            if (activeTab === 'refunds' && !isRefundItem(item)) return false;

            // Status filter
            if (statusFilter && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;

            // Date filters
            if (dateFrom) {
                const from = new Date(dateFrom);
                from.setHours(0, 0, 0, 0);
                if (new Date(item.date) < from) return false;
            }
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                if (new Date(item.date) > to) return false;
            }

            // Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchTitle = item.title?.toLowerCase().includes(term);
                const matchSubTitle = item.subTitle?.toLowerCase().includes(term);
                const matchId = item.id?.toLowerCase().includes(term) || item.trxId?.toLowerCase().includes(term);
                const matchFlow = item.flow?.toLowerCase().includes(term);
                const matchStatus = item.status?.toLowerCase().includes(term);
                const matchCategory = item.category?.toLowerCase().includes(term);
                if (!matchTitle && !matchSubTitle && !matchId && !matchFlow && !matchStatus && !matchCategory) {
                    return false;
                }
            }

            return true;
        });
    }, [unifiedHistory, activeTab, searchTerm, statusFilter, dateFrom, dateTo]);

    // Paginated list
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredHistory.slice(start, start + itemsPerPage);
    }, [filteredHistory, currentPage, itemsPerPage]);

    // Handle opening dispute
    const handleDisputeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || !disputeReason.trim()) return;

        setIsDisputing(true);
        setDisputeSuccess(null);
        try {
            await openTaskDispute(selectedItem.id, disputeReason);
            setDisputeSuccess('Dispute ticket opened successfully! Support team will review your proof.');
            setDisputeReason('');
        } catch (err) {
            alert(`Failed to open dispute: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsDisputing(false);
        }
    };

    const getItemBadgeStyle = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'approved':
            case 'completed':
            case 'paid':
            case 'active':
                return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
            case 'pending':
                return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
            case 'rejected':
                return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
            default:
                return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
        }
    };

    const getItemBorderHighlight = (item: HistoryUnifiedItem) => {
        if (item.disputeOpened || item.status === 'Disputed' || item.disputeStage === 'Escalated' || item.disputeStage === 'RejectedByCreator') {
            return 'border-l-[3.5px] border-l-amber-500 border-amber-200/90 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-500 shadow-[0_1px_8px_rgba(245,158,11,0.08)]';
        }
        if (item.status === 'Rejected') {
            return 'border-l-[3.5px] border-l-rose-500 border-rose-200/90 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-500 shadow-[0_1px_8px_rgba(244,63,94,0.08)]';
        }
        if (isRefundItem(item)) {
            return 'border-l-[3.5px] border-l-amber-500 border-amber-200/90 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-500 shadow-[0_1px_8px_rgba(245,158,11,0.08)]';
        }
        switch (item.itemType) {
            case 'task_completed':
                return 'border-l-[3.5px] border-l-emerald-500 border-emerald-200/80 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-[0_1px_8px_rgba(16,185,129,0.08)]';
            case 'campaign_purchase':
                return 'border-l-[3.5px] border-l-purple-500 border-purple-200/80 dark:border-purple-900/60 hover:border-purple-400 dark:hover:border-purple-500 shadow-[0_1px_8px_rgba(168,85,247,0.08)]';
            case 'wallet_transfer':
                return 'border-l-[3.5px] border-l-blue-500 border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 dark:hover:border-blue-500 shadow-[0_1px_8px_rgba(59,130,246,0.08)]';
            case 'conversion':
                return 'border-l-[3.5px] border-l-indigo-500 border-indigo-200/80 dark:border-indigo-900/60 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-[0_1px_8px_rgba(99,102,241,0.08)]';
            case 'deposit':
                return 'border-l-[3.5px] border-l-teal-500 border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 dark:hover:border-teal-500 shadow-[0_1px_8px_rgba(20,184,166,0.08)]';
            case 'withdrawal':
                return 'border-l-[3.5px] border-l-rose-500 border-rose-200/80 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-500 shadow-[0_1px_8px_rgba(244,63,94,0.08)]';
            default:
                return 'border-l-[3.5px] border-l-indigo-500 border-slate-200/90 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm';
        }
    };

    const getItemIcon = (itemObj: HistoryUnifiedItem | string) => {
        if (typeof itemObj === 'object' && isRefundItem(itemObj)) {
            return <RefundIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />;
        }
        const type = typeof itemObj === 'string' ? itemObj : itemObj.itemType;
        switch (type) {
            case 'campaign_purchase':
                return <CampaignIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />;
            case 'wallet_transfer':
                return <WalletIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />;
            case 'task_completed':
                return <TaskIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />;
            case 'conversion':
                return <ConvertIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />;
            case 'deposit':
                return <DepositIcon className="w-4 h-4 sm:w-5 sm:h-5 text-teal-500" />;
            case 'withdrawal':
                return <WithdrawalIcon className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />;
            default:
                return <HistoryIcon className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />;
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Clean Professional Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/60">
                        <HistoryIcon className="w-3.5 h-3.5" />
                        <span>Work & Earn Activity Ledger</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Work & Earn History
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        View detailed transaction logs, campaign records, task completions, and wallet activities.
                    </p>
                </div>

                {/* Compact Task Wallet Badge */}
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/70 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shrink-0">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <WalletIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                            Task Wallet
                        </span>
                        <div className="text-sm font-black text-slate-900 dark:text-white">
                            ${(currentUser.taskWalletBalance || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">USD</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Navigation Tabs - Responsive for Desktop & Mobile */}
            <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                {/* Mobile Dropdown & Quick Selector (Visible on small screens) */}
                <div className="sm:hidden space-y-1.5">
                    <div className="flex items-center justify-between px-1 pt-0.5 pb-0.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                            <TagIcon className="w-3 h-3 text-indigo-500" /> Filter Category
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                            {filteredHistory.length} records found
                        </span>
                    </div>
                    <div className="relative">
                        <select
                            value={activeTab}
                            onChange={(e) => {
                                setActiveTab(e.target.value as FilterTab);
                                setCurrentPage(1);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm pr-9"
                        >
                            {[
                                { id: 'all', label: 'All Activity', count: unifiedHistory.length },
                                { id: 'campaign_purchases', label: 'Campaign Purchases', count: unifiedHistory.filter(i => i.itemType === 'campaign_purchase' && !isRefundItem(i)).length },
                                { id: 'wallet_transfers', label: 'Wallet Transfers', count: unifiedHistory.filter(i => i.itemType === 'wallet_transfer' && !isRefundItem(i)).length },
                                { id: 'task_rewards', label: 'Task Rewards', count: unifiedHistory.filter(i => i.itemType === 'task_completed' && !isRefundItem(i)).length },
                                { id: 'conversions', label: 'Conversions', count: unifiedHistory.filter(i => i.itemType === 'conversion').length },
                                { id: 'deposits_withdrawals', label: 'Deposits / Payouts', count: unifiedHistory.filter(i => (i.itemType === 'deposit' || i.itemType === 'withdrawal') && !isRefundItem(i)).length },
                                { id: 'refunds', label: 'Refunds', count: unifiedHistory.filter(isRefundItem).length },
                            ].map(tab => (
                                <option key={tab.id} value={tab.id}>
                                    {tab.label} ({tab.count})
                                </option>
                            ))}
                        </select>
                        <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 rotate-90 pointer-events-none" />
                    </div>

                    {/* Horizontal Pill Strip for Quick Mobile Tapping */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-0.5 no-scrollbar -mx-1 px-1 scroll-smooth">
                        {[
                            { id: 'all', label: 'All', count: unifiedHistory.length, icon: HistoryIcon },
                            { id: 'campaign_purchases', label: 'Campaigns', count: unifiedHistory.filter(i => i.itemType === 'campaign_purchase' && !isRefundItem(i)).length, icon: CampaignIcon },
                            { id: 'wallet_transfers', label: 'Transfers', count: unifiedHistory.filter(i => i.itemType === 'wallet_transfer' && !isRefundItem(i)).length, icon: WalletIcon },
                            { id: 'task_rewards', label: 'Rewards', count: unifiedHistory.filter(i => i.itemType === 'task_completed' && !isRefundItem(i)).length, icon: TaskIcon },
                            { id: 'conversions', label: 'Conversions', count: unifiedHistory.filter(i => i.itemType === 'conversion').length, icon: ConvertIcon },
                            { id: 'deposits_withdrawals', label: 'Payouts', count: unifiedHistory.filter(i => (i.itemType === 'deposit' || i.itemType === 'withdrawal') && !isRefundItem(i)).length, icon: DepositIcon },
                            { id: 'refunds', label: 'Refunds', count: unifiedHistory.filter(isRefundItem).length, icon: RefundIcon },
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id as FilterTab);
                                        setCurrentPage(1);
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap transition-all shrink-0 ${
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <Icon className="w-3 h-3" />
                                    <span>{tab.label}</span>
                                    <span className={`text-[9px] px-1 py-0.1 rounded font-black ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Desktop Tabs View (Hidden on mobile) */}
                <div className="hidden sm:flex items-center gap-1 overflow-x-auto scrollbar-none">
                    {[
                        { id: 'all', label: 'All Activity', count: unifiedHistory.length, icon: HistoryIcon },
                        { id: 'campaign_purchases', label: 'Campaign Purchases', count: unifiedHistory.filter(i => i.itemType === 'campaign_purchase' && !isRefundItem(i)).length, icon: CampaignIcon },
                        { id: 'wallet_transfers', label: 'Wallet Transfers', count: unifiedHistory.filter(i => i.itemType === 'wallet_transfer' && !isRefundItem(i)).length, icon: WalletIcon },
                        { id: 'task_rewards', label: 'Task Rewards', count: unifiedHistory.filter(i => i.itemType === 'task_completed' && !isRefundItem(i)).length, icon: TaskIcon },
                        { id: 'conversions', label: 'Conversions', count: unifiedHistory.filter(i => i.itemType === 'conversion').length, icon: ConvertIcon },
                        { id: 'deposits_withdrawals', label: 'Deposits / Payouts', count: unifiedHistory.filter(i => (i.itemType === 'deposit' || i.itemType === 'withdrawal') && !isRefundItem(i)).length, icon: DepositIcon },
                        { id: 'refunds', label: 'Refunds', count: unifiedHistory.filter(isRefundItem).length, icon: RefundIcon },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id as FilterTab);
                                    setCurrentPage(1);
                                }}
                                className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                                    isActive 
                                        ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-600/20' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                    isActive 
                                        ? 'bg-white/20 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Search and Filters Control Bar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 sm:space-y-3.5">
                {/* Row 1: Search Bar (Left / Top) & Status + Show Per Page (Right / Bottom, Side-by-Side) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 items-center">
                    {/* Search bar */}
                    <div className="relative md:col-span-6 lg:col-span-7">
                        <SearchIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by campaign title, TRX ID, category..."
                            className="w-full pl-9 pr-12 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Status & Show per page Side-by-Side */}
                    <div className="grid grid-cols-2 gap-2 md:col-span-6 lg:col-span-5">
                        {/* Status filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="">All Statuses</option>
                            <option value="Approved">Approved / Completed</option>
                            <option value="Active">Active</option>
                            <option value="Pending">Pending Review</option>
                            <option value="Rejected">Rejected</option>
                        </select>

                        {/* Items per page */}
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="w-full py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value={10}>10 per page</option>
                            <option value={15}>15 per page</option>
                            <option value={30}>30 per page</option>
                            <option value={50}>50 per page</option>
                        </select>
                    </div>
                </div>

                {/* Row 2: Date range filter (From range to range) & Reset Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                        <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 text-[11px] sm:text-xs">
                            <CalendarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" /> Date Range:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full sm:w-auto items-center">
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 w-full">
                                <span className="text-slate-400 font-medium text-[10px] sm:text-[11px] shrink-0">From:</span>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => {
                                        setDateFrom(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full min-w-0 bg-transparent text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer p-0"
                                />
                            </div>
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 w-full">
                                <span className="text-slate-400 font-medium text-[10px] sm:text-[11px] shrink-0">To:</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => {
                                        setDateTo(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full min-w-0 bg-transparent text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer p-0"
                                />
                            </div>
                        </div>
                    </div>

                    {(dateFrom || dateTo || statusFilter || searchTerm) && (
                        <button
                            onClick={() => {
                                setDateFrom('');
                                setDateTo('');
                                setStatusFilter('');
                                setSearchTerm('');
                                setCurrentPage(1);
                            }}
                            className="self-end sm:self-auto text-[11px] sm:text-xs text-rose-500 hover:text-rose-600 font-bold underline transition-colors pt-0.5 sm:pt-0"
                        >
                            Reset All Filters
                        </button>
                    )}
                </div>
            </div>

            {/* History Feed List with Compact Cards & Highlighted Borders */}
            {paginatedItems.length > 0 ? (
                <div className="space-y-2 sm:space-y-2.5">
                    {paginatedItems.map(item => (
                        <div
                            key={item.id}
                            className={`bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border transition-all duration-200 flex flex-col gap-2 sm:gap-3 text-xs group hover:shadow-md ${getItemBorderHighlight(item)}`}
                        >
                            {/* Top Header Row: Title & Type on Left, Total Amount in Top-Right Corner */}
                            <div className="flex items-start justify-between gap-2 sm:gap-3 w-full">
                                <div className="flex items-start gap-2 sm:gap-2.5 min-w-0 flex-1">
                                    <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 shrink-0 text-slate-700 dark:text-slate-200 flex items-center justify-center mt-0.5 shadow-inner">
                                        {getItemIcon(item)}
                                    </div>

                                    <div className="space-y-0.5 min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1 text-[9px] sm:text-[10px]">
                                            <span className="font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                {item.typeLabel}
                                            </span>
                                            {item.category && (
                                                <span className="font-semibold text-slate-400 truncate max-w-[120px] sm:max-w-none">
                                                    • {item.category}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="font-black text-slate-900 dark:text-white text-xs sm:text-sm md:text-base leading-snug line-clamp-1 break-words">
                                            {item.title}
                                        </h3>
                                    </div>
                                </div>

                                {/* Prominent Total Amount in Top-Right Corner */}
                                <div className="text-right shrink-0 min-w-[65px] sm:min-w-[85px]">
                                    <div className={`font-black text-xs sm:text-base md:text-lg tracking-tight leading-tight ${
                                        item.amountUSD < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                        {item.amountUSD < 0 ? '-' : '+'}${Math.abs(item.amountUSD).toFixed(2)} <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">USD</span>
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                                        ≈ {Math.abs(item.amountBase).toFixed(2)} {userCurr}
                                    </div>
                                </div>
                            </div>

                            {/* Middle Specs & Details Info Box */}
                            {item.itemType === 'campaign_purchase' ? (
                                <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium bg-slate-50/80 dark:bg-slate-800/40 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800/80">
                                    <span>Date: <strong className="text-slate-700 dark:text-slate-200">{new Date(item.date).toLocaleDateString()}</strong></span>
                                    <span>•</span>
                                    <span>Slots: <strong className="text-purple-600 dark:text-purple-400 font-bold">{item.campaignPurchasedQty}</strong></span>
                                    <span>•</span>
                                    <span>Base Total: <strong className="text-purple-600 dark:text-purple-400 font-bold">{(item.totalCostBase || 0).toFixed(2)} {userCurr}</strong></span>
                                </div>
                            ) : item.subTitle ? (
                                <div className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/40 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800/80 font-medium line-clamp-1 sm:line-clamp-2">
                                    {item.subTitle}
                                </div>
                            ) : null}

                            {/* Bottom Footer Row: Status, TRX ID, Date, Remaining Balance, Details Button */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px]">
                                    <span className={`font-black px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg border uppercase tracking-wider ${getItemBadgeStyle(item.status)}`}>
                                        {item.disputeStage === 'Resolved' || item.disputeStage === 'Closed' || item.disputeStage === 'Admin Rejected'
                                            ? '⚖️ Dispute Resolved'
                                            : item.disputeStage === 'Escalated' 
                                            ? '⚖️ Disputed (Admin)' 
                                            : item.disputeStage === 'RejectedByCreator' 
                                            ? '⚠️ Creator Rejected' 
                                            : (item.status === 'Disputed' || item.disputeOpened) 
                                            ? '🤝 Disputed' 
                                            : item.status}
                                    </span>
                                    {(() => {
                                        const targetDate = item.disputeStage === 'RejectedByCreator'
                                            ? (item.secondDisputeDeadline || (item.date ? new Date(new Date(item.date).getTime() + (settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48) * 3600000) : null))
                                            : (item.status === 'Disputed' || item.disputeOpened)
                                            ? (item.disputeReviewDeadline || (item.date ? new Date(new Date(item.date).getTime() + (settings?.systemLimits?.disputeReviewTimeoutDays ?? 3) * 86400000) : null))
                                            : item.status === 'Rejected'
                                            ? (item.disputeDeadline || (item.date ? new Date(new Date(item.date).getTime() + (settings?.systemLimits?.disputeTimeLimitHours ?? 48) * 3600000) : null))
                                            : null;
                                        
                                        if (!targetDate) return null;
                                        const remStr = getRemainingTimeString(targetDate);
                                        if (!remStr || remStr === 'Expired') return null;

                                        return (
                                            <span className="font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg border bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800">
                                                ⏰ {remStr}
                                            </span>
                                        );
                                    })()}
                                    <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg border border-slate-200 dark:border-slate-700/80">
                                        ID: {item.trxId}
                                    </span>
                                    <span className="font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg whitespace-nowrap">
                                        Bal: ${item.remainingBalanceUSD.toFixed(2)}
                                    </span>
                                    <span className="text-slate-400 font-mono hidden md:inline-block">
                                        • {new Date(item.date).toLocaleString()}
                                    </span>
                                </div>

                                {/* Prominently Highlighted Details Button (Both Mobile & Desktop) */}
                                <button
                                    onClick={() => setSelectedItem(item)}
                                    className="ml-auto bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-[10px] sm:text-xs font-black px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-1.5 transition-all shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 border border-indigo-400/40 ring-1 sm:ring-2 ring-indigo-500/20 active:scale-95 shrink-0 cursor-pointer"
                                    title="View Full Details"
                                >
                                    <span>Details</span>
                                    <ChevronRightIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="pt-3 sm:pt-4 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">
                                Page <strong className="text-slate-900 dark:text-white">{currentPage}</strong> of <strong className="text-slate-900 dark:text-white">{totalPages}</strong> ({filteredHistory.length} total)
                            </span>

                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-800 dark:text-slate-200 text-xs"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-800 dark:text-slate-200 text-xs"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
                    <HistoryIcon className="w-12 h-12 mx-auto text-slate-400" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">No history records found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        There are no matching transaction or activity entries found for your selected filters or search terms.
                    </p>
                    <button
                        onClick={() => {
                            setActiveTab('all');
                            setSearchTerm('');
                            setStatusFilter('');
                            setDateFrom('');
                            setDateTo('');
                        }}
                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-2xl text-xs font-bold"
                    >
                        Reset All Filters
                    </button>
                </div>
            )}

            {/* FULL DETAILS MODAL */}
            {selectedItem && (() => {
                // Find linked campaign for campaign purchases, wallet transfers, task rewards, or completions
                const linkedCampaign = (() => {
                    if (selectedItem.itemType === 'campaign_purchase') {
                        if (selectedItem.rawItem && selectedItem.rawItem.title) return selectedItem.rawItem;
                        const cleanId = selectedItem.id.replace('camp_', '');
                        return userTasks.find(u => u._id === cleanId) || null;
                    }
                    const raw = selectedItem.rawItem || {};
                    const tId = selectedItem.taskId || raw.taskId || raw.campaignId || raw.userTaskId;
                    if (tId) {
                        const found = userTasks.find(u => u._id?.toString() === tId.toString());
                        if (found) return found;
                    }
                    if (selectedItem.itemType === 'wallet_transfer') {
                        const desc = (raw.description || selectedItem.subTitle || selectedItem.title || '').toLowerCase();
                        if (desc) {
                            const found = userTasks.find(u => u.title && desc.length > 2 && desc.includes(u.title.toLowerCase()));
                            if (found) return found;
                        }
                    }
                    const searchTitle = (selectedItem.taskTitle || raw.taskTitle || raw.description || selectedItem.subTitle || selectedItem.title || '').toLowerCase();
                    if (searchTitle && searchTitle.length > 2) {
                        const found = userTasks.find(u => u.title && (searchTitle.includes(u.title.toLowerCase()) || u.title.toLowerCase().includes(searchTitle)));
                        if (found) return found;
                    }
                    return null;
                })();

                const campaignTitle = linkedCampaign?.title || selectedItem.taskTitle || selectedItem.rawItem?.taskTitle || selectedItem.title || 'Campaign Task';
                const campaignDescription = linkedCampaign?.description || selectedItem.rawItem?.description;
                const campaignUrl = linkedCampaign?.link || selectedItem.taskLink || selectedItem.rawItem?.link || selectedItem.rawItem?.url || 'https://example.com/task';

                // Build proof criteria list
                const proofCriteriaList: string[] = [];
                if (linkedCampaign) {
                    if (linkedCampaign.requiredProofs && Array.isArray(linkedCampaign.requiredProofs) && linkedCampaign.requiredProofs.length > 0) {
                        linkedCampaign.requiredProofs.forEach((p: any) => {
                            proofCriteriaList.push(`${p.label || p.type.toUpperCase()}: ${p.instruction || 'Required'}`);
                        });
                    } else {
                        if (linkedCampaign.requireTextProof) proofCriteriaList.push(`Text Proof: ${linkedCampaign.textProofInstruction || 'Provide required text response'}`);
                        if (linkedCampaign.requireUsername) proofCriteriaList.push(`Username Proof: ${linkedCampaign.usernameInstruction || 'Provide platform username'}`);
                        if (linkedCampaign.requireUserId) proofCriteriaList.push(`User ID Proof: ${linkedCampaign.userIdInstruction || 'Provide platform user ID'}`);
                        if (linkedCampaign.requireEmail) proofCriteriaList.push(`Email Proof: ${linkedCampaign.emailInstruction || 'Provide registered email address'}`);
                        if (linkedCampaign.requireScreenshot) proofCriteriaList.push(`Screenshot Proof: ${linkedCampaign.screenshotInstruction || 'Upload proof screenshot'}`);
                    }
                } else if (selectedItem.rawItem) {
                    const raw = selectedItem.rawItem;
                    if (raw.requireTextProof) proofCriteriaList.push(`Text Proof: ${raw.textProofInstruction || 'Provide text proof'}`);
                    if (raw.requireUsername) proofCriteriaList.push(`Username Proof: ${raw.usernameInstruction || 'Provide username'}`);
                    if (raw.requireUserId) proofCriteriaList.push(`User ID Proof: ${raw.userIdInstruction || 'Provide user ID'}`);
                    if (raw.requireEmail) proofCriteriaList.push(`Email Proof: ${raw.emailInstruction || 'Provide email'}`);
                    if (raw.requireScreenshot) proofCriteriaList.push(`Screenshot Proof: ${raw.screenshotInstruction || 'Upload screenshot'}`);
                }

                if (proofCriteriaList.length === 0) {
                    proofCriteriaList.push('Text Proof: Submit text verification upon completion');
                    proofCriteriaList.push('Screenshot Proof: Upload screenshot showing task completion');
                }

                const workerInstructions = campaignDescription || linkedCampaign?.textProofInstruction || selectedItem.rawItem?.textProofInstruction || selectedItem.subTitle || 'Complete all requested task steps and submit required proof verification.';

                return (
                    <Modal 
                        isOpen={true} 
                        onClose={() => {
                            setSelectedItem(null);
                            setDisputeSuccess(null);
                            setCopiedUrl(false);
                        }} 
                        title="Transaction & Activity Details"
                    >
                        <div className="space-y-6 p-1">
                            {/* Header Box */}
                            <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-3 border border-slate-800">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                                        {selectedItem.typeLabel}
                                    </span>
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border shadow-sm ${
                                        selectedItem.status === 'Disputed' || selectedItem.disputeOpened
                                            ? selectedItem.disputeStage === 'Escalated'
                                                ? 'bg-purple-500/20 text-purple-300 border-purple-400/50'
                                                : selectedItem.disputeStage === 'RejectedByCreator'
                                                ? 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                                                : 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                                            : selectedItem.status === 'Approved' || selectedItem.status === 'Paid'
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                                            : selectedItem.status === 'Rejected'
                                            ? 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                                            : getItemBadgeStyle(selectedItem.status)
                                    }`}>
                                        {selectedItem.status === 'Disputed' || selectedItem.disputeOpened
                                            ? selectedItem.disputeStage === 'Escalated'
                                                ? '⚖️ Disputed (Level 2: Admin Review)'
                                                : selectedItem.disputeStage === 'RejectedByCreator'
                                                ? '⚠️ Creator Rejected Dispute'
                                                : '🤝 Disputed (Level 1: Creator Review)'
                                            : selectedItem.status === 'Approved' || selectedItem.status === 'Paid'
                                            ? '✅ Approved & Released'
                                            : selectedItem.status === 'Rejected'
                                            ? '❌ Rejected by Creator'
                                            : selectedItem.status}
                                    </span>
                                </div>

                                <h2 className="text-lg font-black tracking-tight">
                                    {selectedItem.title}
                                </h2>

                                <div className="flex items-baseline justify-between pt-2 border-t border-slate-800">
                                    <span className="text-xs text-slate-400">Transaction Amount:</span>
                                    <span className={`text-2xl font-black ${selectedItem.amountUSD < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {selectedItem.amountUSD < 0 ? '-' : '+'}${Math.abs(selectedItem.amountUSD).toFixed(2)} USD
                                    </span>
                                </div>
                            </div>

                            {/* Flow Diagram Box */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Fund Flow / Routing</span>
                                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <span>{selectedItem.flow}</span>
                                </div>
                            </div>

                            {/* Detail Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {/* Ref & Date */}
                                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-1 border border-slate-200 dark:border-slate-700/60">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Transaction ID (TRX ID)</span>
                                    <span className="block font-mono font-bold text-slate-900 dark:text-white break-all">{selectedItem.trxId}</span>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-1 border border-slate-200 dark:border-slate-700/60">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Transaction Timestamp</span>
                                    <span className="block font-medium text-slate-900 dark:text-white">{new Date(selectedItem.date).toLocaleString()}</span>
                                </div>

                                {/* Base Currency Value - Internal conversion rate hidden */}
                                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-1 border border-slate-200 dark:border-slate-700/60">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Base Currency Amount ({userCurr})</span>
                                    <span className="block font-black text-sm text-slate-900 dark:text-white">
                                        {Math.abs(selectedItem.amountBase).toFixed(2)} {userCurr}
                                    </span>
                                </div>

                                {/* Campaign Details if Campaign Purchase */}
                                {selectedItem.itemType === 'campaign_purchase' && (
                                    <div className="col-span-1 md:col-span-2 bg-purple-50 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50 space-y-2">
                                        <span className="text-[10px] font-extrabold uppercase text-purple-700 dark:text-purple-300 block tracking-wider">
                                            Campaign Purchase Specifications
                                        </span>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="col-span-2">
                                                <span className="text-slate-400 block text-[10px]">Campaign Name / Title:</span>
                                                <strong className="text-slate-900 dark:text-white text-sm">{selectedItem.rawItem?.title || selectedItem.taskTitle || selectedItem.title}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Category / Subtype:</span>
                                                <strong className="text-slate-900 dark:text-white">{selectedItem.category || selectedItem.rawItem?.category || 'Micro Task'} ({selectedItem.rawItem?.subType || 'General'})</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Purchased Target Slots:</span>
                                                <strong className="text-slate-900 dark:text-white">{selectedItem.campaignPurchasedQty} Slots ({selectedItem.rawItem?.currentCompletions || 0} Completed)</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Reward Per Task:</span>
                                                <strong className="text-slate-900 dark:text-white">${(Number(selectedItem.rewardPerTaskUSD) || 0).toFixed(2)} USD</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Worker Rewards Budget:</span>
                                                <strong className="text-slate-900 dark:text-white">${(selectedItem.subtotalUSD ?? ((selectedItem.campaignPurchasedQty || 1) * (selectedItem.rewardPerTaskUSD || 0))).toFixed(2)} USD</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Admin Commission:</span>
                                                <strong className="text-slate-900 dark:text-white">${(selectedItem.adminCommissionUSD ?? 0).toFixed(2)} USD</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Slots + Comm Budget:</span>
                                                <strong className="text-blue-600 dark:text-blue-300">${(selectedItem.slotsAndCommissionUSD ?? (selectedItem.rawItem?.totalBudget || 0)).toFixed(2)} USD</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Campaign Creation Fee:</span>
                                                <strong className="text-indigo-600 dark:text-indigo-300">${(selectedItem.creationFeeUSD ?? (selectedItem.rawItem?.baseFeeCharged ?? selectedItem.rawItem?.campaignFeeUSD ?? selectedItem.rawItem?.baseCampaignFee ?? 0)).toFixed(2)} USD</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Total Campaign Launch Cost USD:</span>
                                                <strong className="text-purple-600 dark:text-purple-300">${selectedItem.totalCostUSD?.toFixed(2)} USD</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Total Cost Base Currency:</span>
                                                <strong className="text-purple-600 dark:text-purple-300">{selectedItem.totalCostBase?.toFixed(2)} {userCurr}</strong>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Proof details if task submission */}
                                {selectedItem.proofText && (
                                    <div className="col-span-1 md:col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-1 border border-slate-200 dark:border-slate-700/60">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Worker Text Proof</span>
                                        <p className="p-2.5 bg-white dark:bg-slate-900 rounded-xl font-mono text-slate-800 dark:text-slate-200">{selectedItem.proofText}</p>
                                    </div>
                                )}

                                {selectedItem.proofUsername && (
                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-1 border border-slate-200 dark:border-slate-700/60">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Worker Username</span>
                                        <span className="block font-bold text-slate-900 dark:text-white">{selectedItem.proofUsername}</span>
                                    </div>
                                )}

                                {selectedItem.proofImage && (
                                    <div className="col-span-1 md:col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-700/60">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Proof Screenshot</span>
                                        <img src={selectedItem.proofImage} alt="Proof" className="max-h-60 rounded-xl object-contain border border-slate-200 dark:border-slate-700" />
                                    </div>
                                )}
                            </div>

                            {/* Campaign Details & Directives Section */}
                            {selectedItem.itemType !== 'deposit' && selectedItem.itemType !== 'withdrawal' && (selectedItem.itemType === 'campaign_purchase' || selectedItem.itemType === 'task_completed' || selectedItem.itemType === 'wallet_transfer' || linkedCampaign || campaignTitle) && (
                                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <div className="bg-indigo-50/70 dark:bg-slate-800/80 p-4 rounded-2xl border border-indigo-100 dark:border-slate-700 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <CampaignIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            <h3 className="font-black text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                                                Campaign Details & Directives
                                            </h3>
                                        </div>

                                        {/* Campaign Title */}
                                        {campaignTitle && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Campaign Title</span>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {campaignTitle}
                                                </p>
                                            </div>
                                        )}

                                        {/* Campaign Description */}
                                        {campaignDescription && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Campaign Description</span>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                                    {campaignDescription}
                                                </p>
                                            </div>
                                        )}

                                        {/* Campaign Landing URL / Target Link with Copy & Visit buttons */}
                                        {campaignUrl && (
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Campaign Landing URL / Target Link</span>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                                                    <p className="font-mono text-xs text-blue-600 dark:text-blue-400 break-all">
                                                        {campaignUrl}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(campaignUrl);
                                                                setCopiedUrl(true);
                                                                setTimeout(() => setCopiedUrl(false), 2000);
                                                            }}
                                                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                                        >
                                                            <span>📋 {copiedUrl ? 'Copied!' : 'Copy URL'}</span>
                                                        </button>
                                                        <a
                                                            href={campaignUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <span>🚀 Visit Landing Page</span>
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Instructions to Workers */}
                                        {workerInstructions && selectedItem.itemType !== 'campaign_purchase' && selectedItem.itemType !== 'wallet_transfer' && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Instructions to Workers</span>
                                                <div className="text-xs text-slate-800 dark:text-slate-200 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 font-medium">
                                                    {workerInstructions}
                                                </div>
                                            </div>
                                        )}

                                        {/* Required Proof Criteria */}
                                        {proofCriteriaList.length > 0 && selectedItem.itemType !== 'campaign_purchase' && selectedItem.itemType !== 'wallet_transfer' && (
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Required Proof Criteria</span>
                                                <div className="space-y-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                                    {proofCriteriaList.map((crit, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                                                            <span className="text-indigo-500 font-bold">•</span>
                                                            <span>{crit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* AUDIT & RESOLUTION RECORD SECTION ACCORDING TO CARD CATEGORY */}
                            {selectedItem.itemType === 'campaign_purchase' ? (
                                (() => {
                                    const isRefundOrDelete = selectedItem.status === 'Cancelled' || 
                                                             selectedItem.status === 'Deleted' || 
                                                             selectedItem.subType === 'refund' || 
                                                             selectedItem.amountUSD > 0 || 
                                                             selectedItem.title?.toLowerCase().includes('refund') ||
                                                             selectedItem.subTitle?.toLowerCase().includes('refund');

                                    if (isRefundOrDelete) {
                                        return (
                                            <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-slate-900 text-white shadow-lg space-y-3">
                                                <div className="flex items-center justify-between border-b border-amber-800/80 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="p-1 bg-amber-500/20 text-amber-300 rounded-lg text-sm">↩️</span>
                                                        <h4 className="font-black text-xs uppercase tracking-wider text-amber-200">
                                                            Campaign Refund & Deletion Audit
                                                        </h4>
                                                    </div>
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                                        ✅ Refund Credited to Wallet
                                                    </span>
                                                </div>
                                                <div className="space-y-2.5 text-xs text-slate-200">
                                                    <div className="bg-amber-950/60 p-3.5 rounded-xl border border-amber-800/60 space-y-2">
                                                        <p className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                                                            <span>ℹ️</span> Campaign Cancellation & Refund Reason
                                                        </p>
                                                        <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                            The user had submitted or created this campaign for approval to the admin. Before full completion or acceptance, the user deleted or canceled this campaign. As a result, a full refund of remaining campaign funds was processed.
                                                        </p>
                                                        <p className="text-xs text-amber-200 leading-relaxed font-medium pt-1.5 border-t border-amber-800/50">
                                                            <strong>Action Taken:</strong> User deleted/canceled campaign. The reserved escrow funds were released and refunded directly back into the user's campaign balance.
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                        <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                                                            <span className="text-slate-400 block text-[10px]">Refund Amount USD:</span>
                                                            <strong className="text-emerald-400">${Math.abs(selectedItem.amountUSD).toFixed(2)} USD</strong>
                                                        </div>
                                                        <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                                                            <span className="text-slate-400 block text-[10px]">Worker Proof Required:</span>
                                                            <strong className="text-slate-300">None (Campaign Refund)</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="p-4 rounded-2xl border border-purple-300 dark:border-purple-800/80 bg-slate-900 text-white shadow-lg space-y-3">
                                            <div className="flex items-center justify-between border-b border-purple-800/80 pb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <CampaignIcon className="w-5 h-5 text-purple-400" />
                                                    <h4 className="font-black text-xs uppercase tracking-wider text-purple-200">
                                                        Campaign Funding & Activation Audit
                                                    </h4>
                                                </div>
                                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-purple-500/20 text-purple-300 border border-purple-400/40">
                                                    ✅ Verified & Activated
                                                </span>
                                            </div>
                                            <div className="space-y-2.5 text-xs text-slate-200">
                                                <div className="bg-purple-950/60 p-3.5 rounded-xl border border-purple-800/60 space-y-2">
                                                    <p className="font-extrabold text-purple-300 text-xs flex items-center gap-1.5">
                                                        <span>⚡</span> How & Why Campaign Was Created
                                                    </p>
                                                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                        <strong>Purpose:</strong> Created campaign to recruit workers and promote target task URL.
                                                    </p>
                                                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                        <strong>How Executed:</strong> Deducted total launch cost of <strong>${Math.abs(selectedItem.amountUSD).toFixed(2)} USD</strong> from Campaign Wallet and reserved worker rewards in system escrow.
                                                    </p>
                                                    <p className="text-xs text-purple-200 leading-relaxed font-medium pt-1.5 border-t border-purple-800/50">
                                                        <strong>Note:</strong> Direct automated campaign creation verified by system. No worker task proof is required for campaign purchases.
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                    <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                                                        <span className="text-slate-400 block text-[10px]">Campaign Target Slots:</span>
                                                        <strong className="text-purple-300">{selectedItem.campaignPurchasedQty || 1} Worker Slots</strong>
                                                    </div>
                                                    <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                                                        <span className="text-slate-400 block text-[10px]">Reward Per Worker:</span>
                                                        <strong className="text-emerald-400">${(selectedItem.rewardPerTaskUSD || 0).toFixed(2)} USD</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : selectedItem.itemType === 'wallet_transfer' ? (
                                <div className="p-4 rounded-2xl border border-blue-300 dark:border-blue-800/80 bg-slate-900 text-white shadow-lg space-y-3">
                                    <div className="flex items-center justify-between border-b border-blue-800/80 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <WalletIcon className="w-5 h-5 text-blue-400" />
                                            <h4 className="font-black text-xs uppercase tracking-wider text-blue-200">
                                                Wallet Transfer Audit & Resolution Record
                                            </h4>
                                        </div>
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                            ✅ Admin Reviewed & Approved
                                        </span>
                                    </div>
                                    <div className="space-y-2.5 text-xs text-slate-200">
                                        <div className="bg-blue-950/60 p-3.5 rounded-xl border border-blue-800/60 space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-blue-800/50">
                                                <div>
                                                    <span className="text-blue-300 text-[10px] uppercase font-extrabold block">Transferred From:</span>
                                                    <strong className="text-white text-xs font-bold">
                                                        {selectedItem.transferSource === 'campaign_to_main' ? 'Campaign Wallet' : 'Main Account / Investment Wallet'}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span className="text-blue-300 text-[10px] uppercase font-extrabold block">Transferred To:</span>
                                                    <strong className="text-white text-xs font-bold">
                                                        {selectedItem.transferSource === 'campaign_to_main' ? 'Main Account Balance' : 'Campaign Wallet'}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="font-extrabold text-emerald-300 text-xs flex items-center gap-1.5">
                                                    <span>🎯</span> Purpose & Reason for Transfer
                                                </p>
                                                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                    <strong>Purpose:</strong> {selectedItem.transferSource === 'campaign_to_main' ? 'Returned unused campaign balance to main account.' : 'Funding campaign creation budget and micro-task worker reward allocations.'}
                                                </p>
                                                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                    <strong>Reason:</strong> User transferred <strong>${Math.abs(selectedItem.amountUSD).toFixed(2)} USD</strong> ({selectedItem.amountBase?.toFixed(2)} {userCurr}) for campaign budget management.
                                                </p>
                                                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                    <strong>How Transferred:</strong> Instant System Internal Wallet Protocol with automated ledger entry.
                                                </p>
                                            </div>

                                            <p className="text-xs text-blue-200 leading-relaxed font-medium pt-1.5 border-t border-blue-800/50">
                                                Whatever the case, the campaign creator has accepted it. Official admin review and approval is confirmed and shown to the user.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                                                <span className="text-slate-400 block text-[10px]">Campaign Creator:</span>
                                                <strong className="text-emerald-400">Accepted Transfer</strong>
                                            </div>
                                            <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                                                <span className="text-slate-400 block text-[10px]">Admin Resolution:</span>
                                                <strong className="text-blue-300">Reviewed & Approved Case</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : selectedItem.itemType === 'conversion' ? (
                                <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-slate-900 text-white shadow-lg space-y-3">
                                    <div className="flex items-center justify-between border-b border-amber-800/80 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <ConvertIcon className="w-5 h-5 text-amber-400" />
                                            <h4 className="font-black text-xs uppercase tracking-wider text-amber-200">
                                                Earnings Conversion Audit Record
                                            </h4>
                                        </div>
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                            ✅ Admin Reviewed & Approved
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-xs text-slate-200">
                                        <div className="bg-amber-950/60 p-3.5 rounded-xl border border-amber-800/60 space-y-1.5">
                                            <p className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                                                <span>🔄</span> Task Earnings Converted to Main Balance
                                            </p>
                                            <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                <strong>Reason:</strong> User converted Task Earnings of <strong>${Math.abs(selectedItem.amountUSD).toFixed(2)} USD</strong> into Main Account balance.
                                            </p>
                                            <p className="text-xs text-amber-200 leading-relaxed font-medium pt-1 border-t border-amber-800/50">
                                                Admin reviewed and verified system conversion authorization.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (selectedItem.itemType === 'deposit' || selectedItem.itemType === 'withdrawal') ? (
                                <div className="p-5 rounded-3xl border border-teal-300 dark:border-teal-800/80 bg-slate-900 text-white shadow-xl space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-800/80 pb-3">
                                        <div className="flex items-center gap-2">
                                            <DepositIcon className="w-5 h-5 text-teal-400" />
                                            <h4 className="font-black text-xs uppercase tracking-wider text-teal-200">
                                                {selectedItem.itemType === 'withdrawal' ? '💸 Payout / Withdrawal Audit Record' : '📥 Deposit Audit Record'}
                                            </h4>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border shadow-sm ${
                                            selectedItem.status === 'Approved' || selectedItem.status === 'Paid'
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                                                : selectedItem.status === 'Rejected'
                                                ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                                                : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                        }`}>
                                            {selectedItem.status === 'Approved' || selectedItem.status === 'Paid'
                                                ? '✅ Approved & Paid'
                                                : selectedItem.status === 'Rejected'
                                                ? '❌ Rejected by Admin'
                                                : '⏳ Pending Admin Processing'}
                                        </span>
                                    </div>

                                    {/* Detailed Payout & Gateway Breakdown Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-0.5">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">Account Holder Name</span>
                                            <p className="font-extrabold text-white">
                                                {selectedItem.rawItem?.accountName || selectedItem.rawItem?.userName || selectedItem.rawItem?.fullName || currentUser.fullName || currentUser.username}
                                            </p>
                                        </div>

                                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-0.5">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">Payment Method / Gateway</span>
                                            <p className="font-extrabold text-teal-300">
                                                {selectedItem.paymentMethod || selectedItem.rawItem?.paymentMethodName || selectedItem.rawItem?.method || 'Direct Payment Gateway'}
                                            </p>
                                        </div>

                                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-0.5">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">
                                                {selectedItem.itemType === 'withdrawal' ? 'Payout Destination Wallet / Account Number' : 'Deposit Source Wallet / Reference'}
                                            </span>
                                            <p className="font-mono font-extrabold text-amber-300 break-all">
                                                {selectedItem.accountNumber || selectedItem.rawItem?.accountNumber || selectedItem.rawItem?.walletNumber || selectedItem.rawItem?.accountNo || selectedItem.rawItem?.phoneNumber || 'N/A'}
                                            </p>
                                        </div>

                                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-0.5">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">Net Transaction Amount</span>
                                            <p className="font-mono font-black text-emerald-400 text-sm">
                                                ${Math.abs(selectedItem.amountUSD).toFixed(2)} USD ({Math.abs(selectedItem.amountBase).toFixed(2)} {userCurr})
                                            </p>
                                        </div>

                                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-0.5">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">Request Time</span>
                                            <p className="font-medium text-slate-200">
                                                {selectedItem.date ? new Date(selectedItem.date).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>

                                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-0.5">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">Processing / Paid Time</span>
                                            <p className="font-medium text-slate-200">
                                                {selectedItem.rawItem?.processedAt
                                                    ? new Date(selectedItem.rawItem.processedAt).toLocaleString()
                                                    : selectedItem.rawItem?.paidAt
                                                    ? new Date(selectedItem.rawItem.paidAt).toLocaleString()
                                                    : (selectedItem.status === 'Approved' || selectedItem.status === 'Paid') && selectedItem.rawItem?.updatedAt
                                                    ? new Date(selectedItem.rawItem.updatedAt).toLocaleString()
                                                    : selectedItem.status === 'Pending'
                                                    ? '⏳ Awaiting Processing'
                                                    : selectedItem.date
                                                    ? new Date(selectedItem.date).toLocaleString()
                                                    : 'N/A'}
                                            </p>
                                        </div>

                                        {/* User Instructions / Notes */}
                                        <div className="col-span-1 sm:col-span-2 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/70 space-y-1">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">Instructions / User Remarks</span>
                                            <p className="text-xs text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">
                                                {selectedItem.rawItem?.userNotes || selectedItem.rawItem?.instructions || selectedItem.rawItem?.notes || selectedItem.subTitle || 'Standard transfer request submitted through member workspace.'}
                                            </p>
                                        </div>

                                        {/* Admin Remarks & Reference ID */}
                                        {(selectedItem.rawItem?.adminNotes || selectedItem.rawItem?.txHash || selectedItem.rawItem?.referenceNumber) && (
                                            <div className="col-span-1 sm:col-span-2 bg-teal-950/60 p-3 rounded-2xl border border-teal-800/60 space-y-1">
                                                <span className="text-[10px] font-bold uppercase text-teal-300">Admin Processing Notes & TX Reference</span>
                                                {selectedItem.rawItem?.adminNotes && (
                                                    <p className="text-xs text-teal-100 font-medium">{selectedItem.rawItem.adminNotes}</p>
                                                )}
                                                {(selectedItem.rawItem?.txHash || selectedItem.rawItem?.referenceNumber) && (
                                                    <p className="text-[11px] font-mono font-bold text-teal-300 break-all">
                                                        Ref Hash: {selectedItem.rawItem?.txHash || selectedItem.rawItem?.referenceNumber}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Task Completed / Worker Submission Item */
                                <>
                                    {selectedItem.status === 'Approved' || selectedItem.status === 'Paid' ? (
                                        <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-slate-900 text-white shadow-lg space-y-3">
                                            <div className="flex items-center justify-between border-b border-emerald-800/80 pb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <RewardIcon className="w-5 h-5 text-emerald-400" />
                                                    <h4 className="font-black text-xs uppercase tracking-wider text-emerald-200">
                                                        Task Reward Audit & Approval Record
                                                    </h4>
                                                </div>
                                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                                    ✅ Campaign Creator Accepted
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-xs text-slate-200">
                                                <div className="bg-emerald-950/60 p-3.5 rounded-xl border border-emerald-800/60 space-y-1.5">
                                                    <p className="font-extrabold text-emerald-300 text-xs flex items-center gap-1.5">
                                                        <span>🎉</span> Task Reward Accepted
                                                    </p>
                                                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                                        Worker completed task requirements for <strong>"{selectedItem.taskTitle || selectedItem.title}"</strong>. Campaign creator reviewed and accepted the proof. Task reward of <strong>${Math.abs(selectedItem.amountUSD).toFixed(2)} USD</strong> was disbursed to worker's balance.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <DisputeTimeline 
                                            submission={selectedItem.rawItem || selectedItem} 
                                            dispute={(state.disputes || []).find((d: any) => 
                                                String(d.submissionId) === String(selectedItem.rawItem?._id || selectedItem.id?.replace('sub_', '')) ||
                                                String(d.userTaskId) === String(selectedItem.rawItem?.taskId || selectedItem.rawItem?.campaignId)
                                            )} 
                                            settings={settings} 
                                        />
                                    )}
                                </>
                            )}

                            {/* Open Dispute Form if Rejected and not resolved by Admin */}
                            {selectedItem.status?.toLowerCase() === 'rejected' && 
                             selectedItem.disputeStage !== 'Resolved' && 
                             selectedItem.disputeStage !== 'ResolvedByAdmin' && 
                             selectedItem.disputeStage !== 'Closed' && 
                             selectedItem.disputeStage !== 'Admin Rejected' && 
                             selectedItem.rawItem?.disputeStage !== 'Resolved' && (
                                <form onSubmit={handleDisputeSubmit} className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                                        <ShieldIcon className="w-4 h-4" /> Open Dispute Ticket for this Task
                                    </h4>
                                    {disputeSuccess ? (
                                        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-3 rounded-2xl text-xs font-bold border border-emerald-500/30">
                                            {disputeSuccess}
                                        </div>
                                    ) : (
                                        <>
                                            <textarea
                                                rows={2}
                                                value={disputeReason}
                                                onChange={(e) => setDisputeReason(e.target.value)}
                                                placeholder="Explain why you believe this rejection was incorrect..."
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            />
                                            <button
                                                type="submit"
                                                disabled={isDisputing || !disputeReason.trim()}
                                                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md disabled:opacity-50"
                                            >
                                                {isDisputing ? 'Submitting Dispute...' : 'Submit Dispute to Admin'}
                                            </button>
                                        </>
                                    )}
                                </form>
                            )}

                            {(selectedItem.disputeStage === 'Resolved' || selectedItem.disputeStage === 'Closed' || selectedItem.rawItem?.disputeStage === 'Resolved') && (
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center mt-4">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        ⚖️ Dispute has been resolved by Platform Admin.
                                    </span>
                                </div>
                            )}
                        </div>
                    </Modal>
                );
            })()}
        </div>
    );
};

export default WorkAndEarnHistory;
