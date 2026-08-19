import React, { useState, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import { 
    ShieldCheck, 
    AlertTriangle, 
    Search, 
    CheckCircle2, 
    RefreshCw, 
    DollarSign, 
    FileText, 
    User, 
    Layers, 
    HelpCircle,
    ArrowRight,
    Sliders,
    Eye
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

export const AdminFinancialReconciliation: React.FC = () => {
    const { state, dispatch } = useData();
    const { users, transactions, userTasks, userTaskSubmissions, withdrawals, deposits } = state;

    const [selectedUserFilter, setSelectedUserFilter] = useState<string>('');
    const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'mismatch' | 'verified'>('all');
    const [selectedUserForDetail, setSelectedUserForDetail] = useState<any | null>(null);
    const [adjustmentModalUser, setAdjustmentModalUser] = useState<any | null>(null);
    const [adjustmentTargetWallet, setAdjustmentTargetWallet] = useState<'taskWalletBalance' | 'walletBalance' | 'taskEarningsBalance'>('taskWalletBalance');
    const [adjustmentAmount, setAdjustmentAmount] = useState<number | string>('');
    const [adjustmentReason, setAdjustmentReason] = useState<string>('');
    const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState<boolean>(false);
    const [adjustmentSuccessMsg, setAdjustmentSuccessMsg] = useState<string | null>(null);

    // Compute forensic financial reconciliation metrics for all users
    const userFinancialAudits = useMemo(() => {
        return (users || []).map(u => {
            const uId = u._id?.toString();

            // 1. Ledger Transactions
            const userTrxs = (transactions || []).filter(t => t.userId?.toString() === uId && t.status === 'Approved');

            // Lifetime Task Rewards (Worker Earnings)
            const approvedSubmissions = (userTaskSubmissions || []).filter(s => 
                (s.workerId?.toString() === uId || (s as any).userId?.toString() === uId) &&
                (s.status === 'Approved' || s.status === 'Paid' || s.status === 'Completed')
            );
            const totalSubmissionsEarnedUSD = approvedSubmissions.reduce((sum, s) => sum + (s.rewardAmount || 0), 0);

            // Standalone offerwall / task reward transactions
            const standaloneTrxEarningsUSD = userTrxs.filter(t => {
                const typeLower = (t.type || '').toLowerCase();
                const descLower = (t.description || '').toLowerCase();
                const isTaskReward = typeLower === 'task reward' || typeLower.includes('task reward') || descLower.includes('task reward');
                const isConversion = descLower.includes('converted') || descLower.includes('transferred');
                const isDup = approvedSubmissions.some(s => s._id?.toString() === t._id?.toString() || (t.submissionId && s._id?.toString() === t.submissionId.toString()));
                return isTaskReward && !isConversion && !isDup;
            }).reduce((sum, t) => sum + (t.amountUSD || t.amount || 0), 0);

            const calculatedLifetimeEarningsUSD = Number((totalSubmissionsEarnedUSD + standaloneTrxEarningsUSD).toFixed(2));

            // Converted from Task Earnings to Campaign Wallet
            const convertedToCampaignUSD = userTrxs.filter(t => {
                const typeLower = (t.type || '').toLowerCase();
                const descLower = (t.description || '').toLowerCase();
                return typeLower === 'task reward transfer' || (descLower.includes('converted') && descLower.includes('task earnings'));
            }).reduce((sum, t) => sum + Math.abs(t.amountUSD || t.amount || 0), 0);

            // Hub Withdrawals
            const hubWithdrawalsUSD = (withdrawals || []).filter(w => 
                w.userId?.toString() === uId && 
                (w.status === 'Approved' || w.status === 'Paid') &&
                (w.isHub || (w as any).isTaskWallet || w.userNotes?.toLowerCase().includes('hub'))
            ).reduce((sum, w) => sum + (w.amount || 0), 0);

            const expectedTaskEarningsUSD = Number(Math.max(0, calculatedLifetimeEarningsUSD - convertedToCampaignUSD - hubWithdrawalsUSD).toFixed(2));
            const actualTaskEarningsUSD = Number((u.taskEarningsBalance || 0).toFixed(2));
            const earningsDelta = Number((actualTaskEarningsUSD - expectedTaskEarningsUSD).toFixed(2));

            // Campaign funds ledger audit
            const campaignFundingTrxs = userTrxs.filter(t => {
                const typeLower = (t.type || '').toLowerCase();
                return typeLower.includes('investment to task') || typeLower.includes('task reward transfer');
            }).reduce((sum, t) => sum + Math.abs(t.amountUSD || t.amount || 0), 0);

            const campaignRefundsUSD = userTrxs.filter(t => {
                const typeLower = (t.type || '').toLowerCase();
                return typeLower === 'task refund' || typeLower.includes('task refund');
            }).reduce((sum, t) => sum + (t.amountUSD || t.amount || 0), 0);

            const campaignSpentUSD = userTrxs.filter(t => {
                const typeLower = (t.type || '').toLowerCase();
                return typeLower === 'task budget deduction' || typeLower === 'campaign creation';
            }).reduce((sum, t) => sum + Math.abs(t.amountUSD || t.amount || 0), 0);

            const actualCampaignWalletUSD = Number((u.taskWalletBalance || 0).toFixed(2));

            // Duplicate Claim Guard Audit
            const duplicateClaims = approvedSubmissions.filter(s => s.rewardClaimedCount && s.rewardClaimedCount > 1);

            const hasMismatch = Math.abs(earningsDelta) > 0.05 || duplicateClaims.length > 0;

            return {
                user: u,
                actualTaskEarningsUSD,
                expectedTaskEarningsUSD,
                earningsDelta,
                actualCampaignWalletUSD,
                calculatedLifetimeEarningsUSD,
                convertedToCampaignUSD,
                hubWithdrawalsUSD,
                campaignFundingTrxs,
                campaignRefundsUSD,
                campaignSpentUSD,
                duplicateClaimsCount: duplicateClaims.length,
                hasMismatch,
                status: hasMismatch ? 'Mismatch' : 'Verified'
            };
        });
    }, [users, transactions, userTasks, userTaskSubmissions, withdrawals, deposits]);

    const filteredAudits = useMemo(() => {
        return userFinancialAudits.filter(a => {
            if (auditStatusFilter === 'mismatch' && !a.hasMismatch) return false;
            if (auditStatusFilter === 'verified' && a.hasMismatch) return false;
            if (selectedUserFilter.trim()) {
                const term = selectedUserFilter.toLowerCase();
                const matchName = a.user.username?.toLowerCase().includes(term) || a.user.fullName?.toLowerCase().includes(term);
                const matchEmail = a.user.email?.toLowerCase().includes(term);
                const matchId = a.user._id?.toString().includes(term);
                return matchName || matchEmail || matchId;
            }
            return true;
        });
    }, [userFinancialAudits, auditStatusFilter, selectedUserFilter]);

    const handleOpenAdjustment = (user: any) => {
        setAdjustmentModalUser(user);
        setAdjustmentAmount('');
        setAdjustmentReason('');
        setAdjustmentSuccessMsg(null);
    };

    const handleExecuteAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustmentModalUser) return;
        const amt = Number(adjustmentAmount);
        if (isNaN(amt) || amt === 0) {
            alert('Please enter a valid non-zero adjustment amount (positive to credit, negative to deduct).');
            return;
        }
        if (!adjustmentReason.trim()) {
            alert('Auditing note/reason is required for every manual ledger adjustment.');
            return;
        }

        setIsSubmittingAdjustment(true);
        try {
            // Target specific wallet without destroying other balances
            const updatedUser = { ...adjustmentModalUser };
            const currentVal = Number((updatedUser[adjustmentTargetWallet] || 0).toFixed(2));
            const newVal = Number((currentVal + amt).toFixed(2));
            if (newVal < 0) {
                alert(`Adjustment would cause ${adjustmentTargetWallet} to drop below zero ($${newVal}). Operation aborted.`);
                setIsSubmittingAdjustment(false);
                return;
            }

            updatedUser[adjustmentTargetWallet] = newVal;

            // Log compensating transaction in the immutable ledger
            const compTrx = {
                _id: 'adj_' + Date.now(),
                userId: updatedUser._id,
                userName: updatedUser.username || updatedUser.fullName,
                currency: 'USD',
                type: 'Manual Financial Adjustment',
                amount: amt,
                amountUSD: amt,
                sourceWallet: amt > 0 ? 'System' : (adjustmentTargetWallet === 'taskEarningsBalance' ? 'TaskEarnings' : 'CampaignFunds'),
                destinationWallet: amt > 0 ? (adjustmentTargetWallet === 'taskEarningsBalance' ? 'TaskEarnings' : 'CampaignFunds') : 'System',
                description: `Admin Compensating Adjustment (${adjustmentTargetWallet}): ${adjustmentReason}`,
                status: 'Approved',
                date: new Date().toISOString()
            };

            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            dispatch({ type: 'ADD_TRANSACTION', payload: compTrx });

            setAdjustmentSuccessMsg(`Successfully adjusted ${adjustmentTargetWallet} by ${amt > 0 ? '+' : ''}$${amt.toFixed(2)} USD with compensating ledger entry!`);
            setTimeout(() => {
                setAdjustmentModalUser(null);
                setAdjustmentSuccessMsg(null);
            }, 2500);
        } catch (err) {
            alert(`Adjustment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingAdjustment(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 space-y-8 bg-slate-950 min-h-screen text-slate-100 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider border border-emerald-500/30">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Source-of-Funds & Ledger Reconciliation Audit</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2">
                        Financial Reconciliation Engine
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
                        Forensic integrity monitor: automatically computes expected worker earnings, campaign escrow allocations, refund restorations, and duplicate claim detections across the immutable ledger.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-800/80 px-4 py-3 rounded-2xl border border-slate-700 text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Accounts Monitored</span>
                        <span className="text-xl font-black text-white">{userFinancialAudits.length} Accounts</span>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by username, email, or user ID..."
                        value={selectedUserFilter}
                        onChange={(e) => setSelectedUserFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase shrink-0">Audit Filter:</span>
                    <select
                        value={auditStatusFilter}
                        onChange={(e) => setAuditStatusFilter(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">All Accounts ({userFinancialAudits.length})</option>
                        <option value="mismatch">Mismatches & Alerts ({userFinancialAudits.filter(a => a.hasMismatch).length})</option>
                        <option value="verified">Verified & In-Sync ({userFinancialAudits.filter(a => !a.hasMismatch).length})</option>
                    </select>
                </div>

                <div className="flex items-center justify-end text-xs text-slate-400 font-medium">
                    <span>Showing <strong className="text-white">{filteredAudits.length}</strong> audited accounts</span>
                </div>
            </div>

            {/* Reconciliation Table */}
            <div className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-black uppercase tracking-wider text-[10px]">
                                <th className="p-4">User Account</th>
                                <th className="p-4">Task Earnings (Actual / Expected)</th>
                                <th className="p-4">Campaign Funds (USD)</th>
                                <th className="p-4">Lifetime Worker Earned</th>
                                <th className="p-4">Duplicate Claims</th>
                                <th className="p-4">Audit Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                            {filteredAudits.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        No account records matched the current reconciliation filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredAudits.map((item) => (
                                    <tr key={item.user._id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 border border-slate-700">
                                                    {item.user.username?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white flex items-center gap-1.5">
                                                        <span>{item.user.username}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">({item.user.currency || 'USD'})</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">{item.user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-0.5">
                                                <div className="font-bold text-white">
                                                    Actual: ${item.actualTaskEarningsUSD.toFixed(2)} USD
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    Expected: ${item.expectedTaskEarningsUSD.toFixed(2)} USD
                                                </div>
                                                {Math.abs(item.earningsDelta) > 0.001 && (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${item.earningsDelta > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        Delta: {item.earningsDelta > 0 ? '+' : ''}${item.earningsDelta.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-blue-400">
                                                ${item.actualCampaignWalletUSD.toFixed(2)} USD
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-emerald-400">
                                                ${item.calculatedLifetimeEarningsUSD.toFixed(2)} USD
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {item.duplicateClaimsCount > 0 ? (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/30 flex items-center gap-1 w-fit">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    {item.duplicateClaimsCount} Duplicates
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 text-[10px]">0 Duplicates</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {item.hasMismatch ? (
                                                <Badge variant="warning">Mismatch Detected</Badge>
                                            ) : (
                                                <Badge variant="success">Verified In-Sync</Badge>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setSelectedUserForDetail(item)}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 transition-colors"
                                                >
                                                    Inspect
                                                </button>
                                                <button
                                                    onClick={() => handleOpenAdjustment(item.user)}
                                                    className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold text-[11px] border border-indigo-500/30 transition-colors flex items-center gap-1"
                                                >
                                                    <Sliders className="w-3 h-3" />
                                                    Adjust
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Inspect Detail Modal */}
            {selectedUserForDetail && (
                <Modal
                    isOpen={Boolean(selectedUserForDetail)}
                    onClose={() => setSelectedUserForDetail(null)}
                    title={`Forensic Ledger Inspection: ${selectedUserForDetail.user.username}`}
                >
                    <div className="space-y-6 text-xs text-slate-200">
                        <div className="grid grid-cols-2 gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">User Identity</span>
                                <span className="font-bold text-white text-sm">{selectedUserForDetail.user.username}</span>
                                <span className="text-[10px] text-slate-400 block">{selectedUserForDetail.user.email}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">User ID</span>
                                <span className="font-mono text-slate-300 text-[10px] break-all">{selectedUserForDetail.user._id}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Actual Task Earnings</span>
                                <span className="text-base font-black text-emerald-400">${selectedUserForDetail.actualTaskEarningsUSD.toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Expected Ledger Calc</span>
                                <span className="text-base font-black text-white">${selectedUserForDetail.expectedTaskEarningsUSD.toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Campaign Wallet</span>
                                <span className="text-base font-black text-blue-400">${selectedUserForDetail.actualCampaignWalletUSD.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-black text-slate-300 uppercase tracking-wider text-[11px]">Ledger Breakdown Audit</h4>
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Total Lifetime Worker Approvals:</span>
                                    <span className="font-bold text-emerald-400">+${selectedUserForDetail.calculatedLifetimeEarningsUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Converted Out to Campaign Wallet:</span>
                                    <span className="font-bold text-rose-400">-${selectedUserForDetail.convertedToCampaignUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Hub Withdrawals Deducted:</span>
                                    <span className="font-bold text-rose-400">-${selectedUserForDetail.hubWithdrawalsUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="border-t border-slate-800 pt-2 flex justify-between font-black text-white">
                                    <span>Net Reconciled Balance:</span>
                                    <span>${selectedUserForDetail.expectedTaskEarningsUSD.toFixed(2)} USD</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="secondary" onClick={() => setSelectedUserForDetail(null)}>
                                Close
                            </Button>
                            <Button 
                                variant="primary" 
                                onClick={() => {
                                    const usr = selectedUserForDetail.user;
                                    setSelectedUserForDetail(null);
                                    handleOpenAdjustment(usr);
                                }}
                            >
                                Execute Compensating Adjustment
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Manual Compensating Adjustment Modal */}
            {adjustmentModalUser && (
                <Modal
                    isOpen={Boolean(adjustmentModalUser)}
                    onClose={() => setAdjustmentModalUser(null)}
                    title={`Admin Compensating Ledger Adjustment: ${adjustmentModalUser.username}`}
                >
                    <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs">
                        {adjustmentSuccessMsg ? (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>{adjustmentSuccessMsg}</span>
                            </div>
                        ) : (
                            <>
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl space-y-1">
                                    <div className="font-bold flex items-center gap-1.5 text-xs">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span>Audited Compensating Entry Notice</span>
                                    </div>
                                    <p className="text-[11px] text-slate-300">
                                        Adjustments do not delete historical transactions. A new auditable ledger transaction of type <strong>"Manual Financial Adjustment"</strong> will be recorded with your specified justification.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Target Wallet</label>
                                    <select
                                        value={adjustmentTargetWallet}
                                        onChange={(e) => setAdjustmentTargetWallet(e.target.value as any)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="taskEarningsBalance">Task Earnings Wallet (Worker Rewards)</option>
                                        <option value="taskWalletBalance">Campaign Funds Wallet (Creator Ad Budget)</option>
                                        <option value="walletBalance">Main Investment Wallet</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                                        Adjustment Amount (USD, positive to credit, negative to deduct)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 5.00 or -2.50"
                                        value={adjustmentAmount}
                                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                                        Audit Reason & Justification
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Specify the reason for this manual adjustment (e.g. dispute compensation, source error correction)..."
                                        value={adjustmentReason}
                                        onChange={(e) => setAdjustmentReason(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                        required
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                                    <Button variant="secondary" type="button" onClick={() => setAdjustmentModalUser(null)}>
                                        Cancel
                                    </Button>
                                    <Button variant="primary" type="submit" disabled={isSubmittingAdjustment}>
                                        {isSubmittingAdjustment ? 'Executing...' : 'Post Compensating Ledger Entry'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default AdminFinancialReconciliation;
