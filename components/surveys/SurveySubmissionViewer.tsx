import React from 'react';
import { UserTaskSubmission, SurveyAnswer } from '../../types';
import {
    CheckCircle2,
    XCircle,
    Clock,
    Shield,
    Star,
    AlertTriangle,
    FileText,
    Check,
    X,
    User,
    Calendar,
    Hash
} from 'lucide-react';

interface SurveySubmissionViewerProps {
    submission: UserTaskSubmission;
    surveyConfig?: any;
}

export const SurveySubmissionViewer: React.FC<SurveySubmissionViewerProps> = ({
    submission,
    surveyConfig
}) => {
    const responses: SurveyAnswer[] = submission.surveyResponses || [];
    const completionSeconds = submission.surveyCompletionTimeSeconds || 0;
    const formattedMinutes = Math.floor(completionSeconds / 60);
    const formattedSecs = completionSeconds % 60;

    return (
        <div className="space-y-6 text-slate-200">
            {/* Survey Meta Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Completion Time</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-mono font-bold text-white text-xs">
                            {completionSeconds > 0 ? `${formattedMinutes}m ${formattedSecs}s` : 'N/A'}
                        </span>
                    </div>
                </div>

                <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Quality Score</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-mono font-bold text-emerald-400 text-xs">
                            {submission.qualityScore !== undefined ? `${submission.qualityScore}%` : '100%'}
                        </span>
                    </div>
                </div>

                <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Attention Check</span>
                    <div className="mt-0.5">
                        {submission.attentionCheckPassed === false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1">
                                <X className="w-3 h-3" /> Failed
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Passed
                            </span>
                        )}
                    </div>
                </div>

                <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Survey Version</span>
                    <span className="font-mono font-bold text-amber-400 text-xs mt-0.5 block">
                        v{submission.surveyVersion || 1}
                    </span>
                </div>
            </div>

            {/* Quality Flags (if any) */}
            {submission.qualityFlags && submission.qualityFlags.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Quality Flags Detected:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {submission.qualityFlags.map((flag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-amber-500/20 text-amber-300">
                                {flag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Questionnaire Responses Breakdown */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Survey Question Responses ({responses.length})
                    </h4>
                    {submission.consentAgreed && (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Voluntary Consent Verified
                        </span>
                    )}
                </div>

                {responses.length === 0 ? (
                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-xs text-slate-500 italic">
                        No direct survey response records stored in this submission.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {responses.map((resp, idx) => {
                            const val = resp.value;
                            const isArray = Array.isArray(val);
                            const hasOther = Boolean(resp.otherValue);

                            return (
                                <div
                                    key={resp.questionId || idx}
                                    className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-2.5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] font-mono font-bold uppercase text-amber-400">
                                                Q{idx + 1} • {resp.questionType || 'Question'}
                                            </span>
                                            <h5 className="text-xs font-bold text-white leading-snug">
                                                {resp.questionTitle || `Question ${idx + 1}`}
                                            </h5>
                                        </div>

                                        {resp.isAttentionCheck && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                resp.passedCheck !== false
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                                {resp.passedCheck !== false ? 'Check: PASS' : 'Check: FAIL'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Answer Display */}
                                    <div className="pt-1">
                                        {/* Multiple Choices / Top N (Array) */}
                                        {isArray ? (
                                            <div className="space-y-1.5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(val as string[]).map((item, itemIdx) => (
                                                        <span
                                                            key={itemIdx}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1.5"
                                                        >
                                                            {resp.questionType === 'top_n' && (
                                                                <strong className="font-mono text-[10px] text-amber-400">#{itemIdx + 1}</strong>
                                                            )}
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                                {hasOther && (
                                                    <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1">
                                                        <span className="text-amber-400 font-bold">Other specification: </span>
                                                        {resp.otherValue}
                                                    </div>
                                                )}
                                            </div>
                                        ) : resp.questionType === 'rating' ? (
                                            /* Star Rating */
                                            <div className="flex items-center gap-1.5">
                                                {Array.from({ length: 5 }).map((_, starIdx) => (
                                                    <Star
                                                        key={starIdx}
                                                        className={`w-4 h-4 ${
                                                            (Number(val) || 0) >= starIdx + 1
                                                                ? 'text-amber-400 fill-amber-400'
                                                                : 'text-slate-700'
                                                        }`}
                                                    />
                                                ))}
                                                <span className="font-mono font-bold text-amber-400 text-xs ml-1.5">
                                                    {val} / 5 Stars
                                                </span>
                                            </div>
                                        ) : (
                                            /* Single Value / Text */
                                            <div className="space-y-1">
                                                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-medium text-white break-words">
                                                    {val !== undefined && val !== null && val !== '' ? String(val) : <span className="text-slate-500 italic">No answer</span>}
                                                </div>
                                                {hasOther && (
                                                    <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                                        <span className="text-amber-400 font-bold">Other details: </span>
                                                        {resp.otherValue}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
