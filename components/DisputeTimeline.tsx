import React from 'react';
import { UserTaskSubmission, Dispute, Settings } from '../types';
import { Clock, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Scale, User, Image as ImageIcon, Calendar, Check, Info, Shield, ArrowRight } from 'lucide-react';

interface DisputeTimelineProps {
    submission?: UserTaskSubmission | any;
    dispute?: Dispute | any;
    settings?: Settings | any;
    isAdmin?: boolean;
}

export const formatDateTime = (dateVal?: string | Date | null): string => {
    if (!dateVal) return 'N/A';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        return 'N/A';
    }
};

export const getRemainingTimeFormatted = (targetDate?: string | Date | null): { text: string; isExpired: boolean; days: number; hours: number; minutes: number } => {
    if (!targetDate) return { text: 'N/A', isExpired: true, days: 0, hours: 0, minutes: 0 };
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    if (diff <= 0) return { text: 'Expired (Window Closed)', isExpired: true, days: 0, hours: 0, minutes: 0 };

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    let text = '';
    if (days > 0) text += `${days}d `;
    if (hours > 0 || days > 0) text += `${hours}h `;
    text += `${minutes}m remaining`;

    return { text, isExpired: false, days, hours, minutes };
};

export const DisputeTimeline: React.FC<DisputeTimelineProps> = ({ submission, dispute, settings, isAdmin = false }) => {
    if (!submission && !dispute) return null;

    const sub = submission || {};
    const disp = dispute || {};

    const status = sub.status || disp.status || 'Pending';

    const isEscalated = sub.disputeStage === 'Escalated' || disp.type === 'UserTask' || (disp.status && disp.status !== 'None' && disp.status !== 'Resolved');
    
    const isResolved = status === 'Approved' || status === 'Paid' || disp.status === 'Resolved' || sub.disputeStage === 'Resolved';
    const hasVerdict = Boolean(disp.verdict && disp.verdict !== 'None');
    const isApprovedByAdmin = disp.verdict === 'ReleaseToWorker' || disp.verdict === 'SplitPayout' || ((status === 'Paid' || status === 'Approved') && isResolved);

    const disputeStage = isResolved 
        ? 'Resolved'
        : isEscalated 
        ? 'Escalated' 
        : (sub.disputeStage === 'RejectedByCreator' 
            ? 'RejectedByCreator' 
            : (sub.disputeStage || (sub.disputeOpened || status === 'Disputed' ? 'CreatorReview' : 'None')));

    // Dates
    const submittedAt = sub.createdAt || disp.createdAt;
    const rejectedAt = sub.rejectedAt || sub.updatedAt;
    const workerDisputedAt = sub.disputeOpenedAt || disp.date || sub.updatedAt;
    const creatorReviewedAt = sub.creatorReviewedAt || (disputeStage === 'RejectedByCreator' || disputeStage === 'Escalated' ? sub.updatedAt : null);
    const escalatedAt = sub.escalatedAt || (disputeStage === 'Escalated' ? (disp.date || sub.updatedAt) : null);
    const resolvedAt = sub.resolvedAt || (isResolved ? (disp.updatedAt || sub.updatedAt) : null);

    // Time Limits
    const disputeReviewDeadline = sub.disputeReviewDeadline || (submittedAt ? new Date(new Date(submittedAt).getTime() + (settings?.systemLimits?.disputeReviewTimeoutDays ?? 3) * 86400000) : null);
    const secondDisputeDeadline = sub.secondDisputeDeadline || (creatorReviewedAt ? new Date(new Date(creatorReviewedAt).getTime() + (settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48) * 3600000) : null);
    
    // Admin Review Timeout (default 3 days if escalated)
    const adminTimeoutDays = settings?.systemLimits?.adminReviewTimeoutDays ?? 3;
    const adminReviewDeadline = escalatedAt 
        ? new Date(new Date(escalatedAt).getTime() + adminTimeoutDays * 86400000)
        : (disp.date ? new Date(new Date(disp.date).getTime() + adminTimeoutDays * 86400000) : null);

    const adminTimer = getRemainingTimeFormatted(adminReviewDeadline);
    const creatorTimer = getRemainingTimeFormatted(disputeReviewDeadline);
    const secondDisputeTimer = getRemainingTimeFormatted(secondDisputeDeadline);

    // Calculate Exact Step Progress (1 to 5)
    let currentStepNumber = 1;
    let completedStepsCount = 1;
    let currentActionHolder = 'Campaign Creator (Initial Review)';

    if (isResolved) {
        currentStepNumber = 5;
        completedStepsCount = 5;
        currentActionHolder = 'None (Case Resolved)';
    } else if (disputeStage === 'Escalated') {
        currentStepNumber = 4;
        completedStepsCount = 3; // Steps 1, 2, 3 completed
        currentActionHolder = 'Platform Admin (Level 2 Review)';
    } else if (disputeStage === 'RejectedByCreator') {
        currentStepNumber = 4;
        completedStepsCount = 3;
        currentActionHolder = 'Worker (Can Escalate to Admin)';
    } else if (disputeStage === 'CreatorReview' || status === 'Disputed' || sub.disputeOpened) {
        currentStepNumber = 3;
        completedStepsCount = 2; // Steps 1, 2 completed
        currentActionHolder = 'Campaign Creator (Level 1 Review)';
    } else if (status === 'Rejected') {
        currentStepNumber = 2;
        completedStepsCount = 2; // Steps 1, 2 completed
        currentActionHolder = 'Worker (Can Open Dispute)';
    } else {
        currentStepNumber = 1;
        completedStepsCount = 1;
        currentActionHolder = 'Campaign Creator (Initial Review)';
    }

    const remainingStepsCount = 5 - completedStepsCount;
    const progressPercentage = Math.round((completedStepsCount / 5) * 100);

    return (
        <div className="space-y-5 my-4">
            {/* STAGE & STATUS SUMMARY BANNER */}
            <div className="p-4 rounded-2xl border bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <Scale className="w-5 h-5 text-amber-400" />
                            <h4 className="font-black text-sm uppercase tracking-wider text-amber-300">
                                Dispute Audit & Resolution Record
                            </h4>
                        </div>
                        <p className="text-[11px] text-slate-300">
                            Transparent audit log tracking review deadlines, action holders, and binding rules.
                        </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border shadow-sm ${
                        disputeStage === 'Escalated' 
                            ? 'bg-purple-500/20 text-purple-300 border-purple-400/50' 
                            : disputeStage === 'RejectedByCreator' 
                            ? 'bg-rose-500/20 text-rose-300 border-rose-400/50' 
                            : disputeStage === 'CreatorReview' 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400/50' 
                            : isResolved
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                            : 'bg-slate-700/50 text-slate-300 border-slate-600'
                    }`}>
                        {disputeStage === 'Escalated' 
                            ? '🏛️ Level 2: Under Admin Review' 
                            : disputeStage === 'RejectedByCreator' 
                            ? '⚠️ Creator Rejected Dispute' 
                            : disputeStage === 'CreatorReview' 
                            ? '🤝 Level 1: Under Creator Review' 
                            : isResolved 
                            ? '✅ Case Resolved' 
                            : status}
                    </span>
                </div>

                {/* CURRENT ACTION HOLDER BANNER */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70 text-xs">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-slate-300">Current Action Holder:</span>
                        <strong className={`px-2 py-0.5 rounded text-xs font-black ${
                            disputeStage === 'Escalated'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                                : disputeStage === 'CreatorReview'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                : isResolved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                        }`}>
                            {currentActionHolder}
                        </strong>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                        Step {currentStepNumber} of 5
                    </span>
                </div>

                {/* ACTIVE ADMIN REVIEW TIMER IN-BETWEEN BOX (ONLY WHEN ESCALATED TO ADMIN) */}
                {disputeStage === 'Escalated' && !isResolved && (
                    <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-extrabold text-purple-300">
                                    <Clock className="w-4 h-4 text-purple-400 animate-pulse" />
                                    <span>LEVEL 2: PLATFORM ADMIN REVIEW DEADLINE</span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-0.5">
                                    Expected Admin resolution deadline: <strong className="text-white font-mono">{formatDateTime(adminReviewDeadline)}</strong>
                                </p>
                            </div>
                            <div className="px-3 py-1.5 rounded-lg bg-purple-400/20 border border-purple-400/50 text-right shrink-0">
                                <span className="text-[10px] uppercase tracking-wider text-purple-300 font-bold block">Remaining Admin Limit</span>
                                <span className={`text-xs font-black font-mono ${adminTimer.isExpired ? 'text-rose-400' : 'text-purple-200'}`}>
                                    {adminTimer.text}
                                </span>
                            </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-800/50 text-[11px] text-purple-200 leading-relaxed">
                            💡 <strong>Binding Time Limit Rule:</strong> This dispute is with Platform Admin for final review. If the Admin does not complete the review before the deadline, <strong>the system will automatically approve your task reward and release the payment to your wallet balance!</strong>
                        </div>
                    </div>
                )}

                {/* CREATOR REVIEW TIMER BOX (ONLY WHEN UNDER CREATOR REVIEW) */}
                {disputeStage === 'CreatorReview' && !isResolved && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                                    <span>LEVEL 1: CAMPAIGN CREATOR REVIEW DEADLINE</span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-0.5">
                                    Campaign creator must review and resolve by: <strong className="text-white font-mono">{formatDateTime(disputeReviewDeadline)}</strong>
                                </p>
                            </div>
                            <div className="px-3 py-1.5 rounded-lg bg-amber-400/20 border border-amber-400/50 text-right shrink-0">
                                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block">Auto-Approves In</span>
                                <span className="text-xs font-black font-mono text-amber-200">
                                    {creatorTimer.text}
                                </span>
                            </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/50 text-[11px] text-amber-200 leading-relaxed">
                            💡 <strong>Binding Time Limit Rule:</strong> This dispute is currently under review by the Campaign Creator. If the creator ignores or fails to review it before the deadline, <strong>the system will automatically approve your task and credit your task payment!</strong>
                        </div>
                    </div>
                )}
            </div>

            {/* AUDIT TIMELINE CHRONOLOGY WITH STEP PROGRESS BAR */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                
                {/* STEP PROGRESS HEADER & BAR */}
                <div className="space-y-2.5 border-b dark:border-slate-800 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            Complete Review & Action Timeline
                        </h5>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/60">
                                Step {currentStepNumber} of 5
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                ({completedStepsCount} Completed • {remainingStepsCount} Remaining)
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
                        <div 
                            className="bg-gradient-to-r from-indigo-500 via-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>

                    {/* 5-Step Horizontal Pills */}
                    <div className="grid grid-cols-5 gap-1 pt-1 text-[10px] font-extrabold text-center">
                        <div className={`p-1 rounded ${completedStepsCount >= 1 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            1. Submitted
                        </div>
                        <div className={`p-1 rounded ${completedStepsCount >= 2 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            2. Rejection
                        </div>
                        <div className={`p-1 rounded ${currentStepNumber === 3 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 animate-pulse' : completedStepsCount >= 3 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            3. Creator Review
                        </div>
                        <div className={`p-1 rounded ${currentStepNumber === 4 ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/40 animate-pulse' : completedStepsCount >= 4 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            4. Admin Review
                        </div>
                        <div className={`p-1 rounded ${isResolved ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            5. Resolution
                        </div>
                    </div>
                </div>

                {/* STEP CHRONOLOGY LIST */}
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300 dark:before:bg-slate-700">
                    
                    {/* STEP 1: PROOF SUBMITTED BY WORKER */}
                    <div className="relative">
                        <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shadow-md">
                            1
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-blue-500" />
                                    Step 1: Task Proof Submitted by Worker ({sub.workerName || 'Worker'})
                                </span>
                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                                    📅 {formatDateTime(submittedAt)}
                                </span>
                            </div>
                            {sub.proofText && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-900/40 p-2 rounded border border-slate-100 dark:border-slate-800 mt-1">
                                    "{sub.proofText}"
                                </p>
                            )}
                        </div>
                    </div>

                    {/* STEP 2: CREATOR INITIAL REJECTION */}
                    {(sub.rejectionReason || sub.rejectedAt || status === 'Rejected' || disputeStage !== 'None') && (
                        <div className="relative">
                            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black shadow-md">
                                2
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                    <span className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                        Step 2: Task Submission Rejected by Campaign Creator
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200/50">
                                        📅 {formatDateTime(rejectedAt)}
                                    </span>
                                </div>
                                <div className="text-xs text-rose-800 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 p-2 rounded border border-rose-100 dark:border-rose-900/40 font-medium">
                                    <strong>Creator Rejection Reason:</strong> {sub.rejectionReason || 'No specific reason provided.'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: WORKER OPENED DISPUTE WITH CREATOR (LEVEL 1) */}
                    {(sub.disputeReason || sub.disputeOpened || disputeStage !== 'None') && (
                        <div className="relative">
                            <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black shadow-md ${
                                currentStepNumber === 3 ? 'bg-amber-500 animate-pulse' : 'bg-amber-600'
                            }`}>
                                3
                            </div>
                            <div className={`p-3.5 rounded-xl border shadow-sm space-y-2 ${
                                currentStepNumber === 3 
                                    ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60' 
                                    : 'bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900/50'
                            }`}>
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                    <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                        Step 3: Dispute Opened with Creator (Level 1 Review)
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/50">
                                        📅 {formatDateTime(workerDisputedAt)}
                                    </span>
                                </div>
                                {sub.disputeReason && (
                                    <p className="text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 p-2 rounded border border-amber-200/60 dark:border-amber-800/40">
                                        <strong>Worker Dispute Explanation:</strong> "{sub.disputeReason}"
                                    </p>
                                )}
                                {sub.disputeProofUrl && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                                        <a href={sub.disputeProofUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-bold">
                                            View Worker Dispute Attachment Screenshot ↗
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: LEVEL 2 ESCALATION TO PLATFORM ADMIN */}
                    {(disputeStage === 'Escalated' || disputeStage === 'RejectedByCreator' || disp.status === 'Open' || disp.status === 'Processing') && (
                        <div className="relative">
                            <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black shadow-md ${
                                currentStepNumber === 4 ? 'bg-purple-600 animate-pulse' : 'bg-purple-700'
                            }`}>
                                4
                            </div>
                            <div className={`p-3.5 rounded-xl border shadow-md space-y-2 ${
                                currentStepNumber === 4
                                    ? 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700/60'
                                    : 'bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-800'
                            }`}>
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                    <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                                        <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
                                        Step 4: Escalated to Platform Admin (Level 2 Review)
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200">
                                        📅 {formatDateTime(escalatedAt || disp.date || sub.updatedAt)}
                                    </span>
                                </div>
                                <p className="text-xs text-purple-800 dark:text-purple-300 bg-white/80 dark:bg-slate-900/80 p-2 rounded border border-purple-200/60 dark:border-purple-800/40">
                                    Dispute submitted to Platform Admin for final binding verification. Escrow funds remain locked until decision.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: FINAL DECISION & PAYMENT RELEASE */}
                    {(isResolved || disp.status === 'Resolved' || hasVerdict) && (
                        <div className="relative">
                            <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black shadow-md ${
                                isApprovedByAdmin ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}>
                                5
                            </div>
                            <div className={`p-4 rounded-xl border shadow-md space-y-2 ${
                                isApprovedByAdmin 
                                    ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
                                    : 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                            }`}>
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                    <span className="font-black flex items-center gap-1 text-sm uppercase tracking-wider">
                                        {isApprovedByAdmin ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                Step 5: Final Resolution — Approved & Task Payment Disbursed
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="w-4 h-4 text-rose-600" />
                                                Step 5: Final Resolution — Rejected & Refunded to Creator
                                            </>
                                        )}
                                    </span>
                                    <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 border font-bold">
                                        📅 Date: {formatDateTime(resolvedAt || disp.updatedAt || sub.updatedAt)}
                                    </span>
                                </div>

                                {disp.verdict && disp.verdict !== 'None' && (
                                    <div className="text-xs font-bold mt-1">
                                        Official Verdict: <span className="underline uppercase tracking-wide">{disp.verdict}</span>
                                    </div>
                                )}

                                {(disp.adminResponse || sub.adminNotes) && (
                                    <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border text-xs text-slate-800 dark:text-slate-200 font-medium">
                                        <strong>Admin Official Notes:</strong> "{disp.adminResponse || sub.adminNotes}"
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

