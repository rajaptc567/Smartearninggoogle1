import React, { useState, useEffect } from 'react';
import { getSurveyCampaignAnalytics } from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import {
    Download,
    BarChart3,
    Clock,
    Shield,
    CheckCircle2,
    XCircle,
    Users,
    FileSpreadsheet,
    FileCode,
    RefreshCw,
    AlertCircle,
    Star
} from 'lucide-react';

interface SurveyAnalyticsModalProps {
    taskId: string;
    isOpen: boolean;
    onClose: () => void;
    campaignTitle?: string;
}

export const SurveyAnalyticsModal: React.FC<SurveyAnalyticsModalProps> = ({
    taskId,
    isOpen,
    onClose,
    campaignTitle
}) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

    const fetchAnalytics = async () => {
        if (!taskId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getSurveyCampaignAnalytics(taskId);
            setData(res);
            if (res.questions && res.questions.length > 0) {
                setSelectedQuestionId(res.questions[0].id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load survey analytics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && taskId) {
            fetchAnalytics();
        }
    }, [isOpen, taskId]);

    // CSV Export
    const handleExportCSV = () => {
        if (!data || !data.rawSubmissions || data.rawSubmissions.length === 0) {
            alert('No submissions available to export.');
            return;
        }

        const questions = data.questions || [];
        const questionHeaders = questions.map((q: any) => `"${(q.title || '').replace(/"/g, '""')}"`);

        const headers = [
            'Submission ID',
            'Worker Name',
            'Status',
            'Qualification Status',
            'Completion Time (Seconds)',
            'Reward USD',
            'Date Submitted',
            ...questionHeaders
        ];

        const rows = data.rawSubmissions.map((sub: any) => {
            const subResponses = sub.responses || [];
            const questionAnswers = questions.map((q: any) => {
                const r = subResponses.find((ans: any) => ans.questionId === q.id);
                if (!r || r.value === undefined || r.value === null) return '""';
                let valStr = '';
                if (Array.isArray(r.value)) {
                    valStr = r.value.join('; ');
                } else {
                    valStr = String(r.value);
                }
                if (r.otherValue) {
                    valStr += ` (Other: ${r.otherValue})`;
                }
                return `"${valStr.replace(/"/g, '""')}"`;
            });

            return [
                `"${sub.id || ''}"`,
                `"${(sub.workerName || '').replace(/"/g, '""')}"`,
                `"${sub.status || ''}"`,
                `"${sub.qualificationStatus || ''}"`,
                sub.completionTimeSeconds || 0,
                sub.rewardAmount || 0,
                `"${sub.createdAt ? new Date(sub.createdAt).toISOString() : ''}"`,
                ...questionAnswers
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `survey_export_${taskId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // JSON Export
    const handleExportJSON = () => {
        if (!data) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `survey_export_${taskId}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Survey Results & Intelligence Analytics">
            <div className="space-y-6 max-h-[85vh] overflow-y-auto p-1 text-slate-200">
                {/* Header info */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
                    <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block">
                            Campaign Survey Dashboard
                        </span>
                        <h3 className="text-base font-black text-white">
                            {data?.task?.title || campaignTitle || 'Survey Campaign'}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchAnalytics}
                            disabled={loading}
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Refresh Analytics"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCSV}
                            disabled={!data || !data.rawSubmissions || data.rawSubmissions.length === 0}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Export CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportJSON}
                            disabled={!data}
                            className="px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                        >
                            <FileCode className="w-4 h-4" /> Export JSON
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-16 text-center space-y-3">
                        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-xs text-slate-400">Aggregating respondent analytics and distributions...</p>
                    </div>
                ) : error ? (
                    <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-2xl text-red-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                ) : !data ? (
                    <div className="p-12 text-center text-xs text-slate-500 italic">
                        No survey response data found.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Metrics Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Submissions</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-black text-white font-mono">
                                        {data.metrics?.totalSubmissions || 0}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">
                                        / {data.task?.targetQuantity || '∞'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Completed / Approved</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-black text-emerald-400 font-mono">
                                        {data.metrics?.completedSubmissions || data.metrics?.approvedSubmissions || 0}
                                    </span>
                                    <span className="text-xs text-emerald-500 font-bold">
                                        ({data.metrics?.completionRate || 0}%)
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Avg. Completion Time</span>
                                <div className="flex items-baseline gap-1.5 mt-1">
                                    <Clock className="w-4 h-4 text-amber-400" />
                                    <span className="text-xl font-black text-amber-400 font-mono">
                                        {data.metrics?.averageCompletionTimeSeconds ? `${Math.floor(data.metrics.averageCompletionTimeSeconds / 60)}m ${data.metrics.averageCompletionTimeSeconds % 60}s` : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Attention Checks Passed</span>
                                <div className="flex items-baseline gap-1.5 mt-1">
                                    <Shield className="w-4 h-4 text-purple-400" />
                                    <span className="text-xl font-black text-purple-400 font-mono">
                                        {data.metrics?.attentionPassedCount || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Question Selector Tabs */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                                Question Breakdown & Distribution ({data.questions?.length || 0})
                            </h4>

                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                {(data.questions || []).map((q: any) => (
                                    <button
                                        key={q.id}
                                        type="button"
                                        onClick={() => setSelectedQuestionId(q.id)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                            selectedQuestionId === q.id
                                                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <span className="w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-mono">
                                            {q.order}
                                        </span>
                                        <span>{q.title ? q.title.slice(0, 24) : `Question ${q.order}`}...</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Selected Question Detail View */}
                        {(() => {
                            const q = (data.questions || []).find((item: any) => item.id === selectedQuestionId) || data.questions?.[0];
                            if (!q) return null;

                            const isTextType = q.type === 'short_text' || q.type === 'long_text';
                            const counts: Record<string, number> = q.counts || {};
                            const totalAnswers = q.totalAnswers || 0;

                            return (
                                <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4">
                                    <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                                        <div>
                                            <span className="text-[10px] font-mono font-bold uppercase text-amber-400">
                                                Question {q.order} • {q.type}
                                            </span>
                                            <h4 className="text-sm font-bold text-white mt-0.5">
                                                {q.title}
                                            </h4>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-slate-300">
                                            {totalAnswers} Answers
                                        </span>
                                    </div>

                                    {/* Average score for rating */}
                                    {q.type === 'rating' && q.average !== null && (
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                                            <div className="flex items-center gap-1 text-amber-400">
                                                <Star className="w-5 h-5 fill-amber-400" />
                                                <span className="text-lg font-black font-mono">{q.average}</span>
                                                <span className="text-xs text-amber-300/80 font-bold">/ 5.0 Average Rating</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Choice / Top-N / Rating Distribution Bars */}
                                    {!isTextType && (
                                        <div className="space-y-2.5">
                                            {Object.keys(counts).length === 0 ? (
                                                <p className="text-xs text-slate-500 italic py-4 text-center">
                                                    No responses recorded for this question yet.
                                                </p>
                                            ) : (
                                                Object.entries(counts).map(([optionKey, count]) => {
                                                    const pct = totalAnswers > 0 ? Math.round(((count as number) / totalAnswers) * 100) : 0;
                                                    return (
                                                        <div key={optionKey} className="space-y-1">
                                                            <div className="flex justify-between text-xs font-semibold">
                                                                <span className="text-slate-300">{optionKey}</span>
                                                                <span className="font-mono text-slate-400">
                                                                    <strong className="text-white">{count as number}</strong> ({pct}%)
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                    {/* Text Responses Table */}
                                    {isTextType && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                                                Respondent Text Submissions ({q.recentAnswers?.length || 0})
                                            </span>
                                            {(!q.recentAnswers || q.recentAnswers.length === 0) ? (
                                                <p className="text-xs text-slate-500 italic py-4 text-center">
                                                    No text answers submitted yet.
                                                </p>
                                            ) : (
                                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                    {q.recentAnswers.map((ans: any, aIdx: number) => (
                                                        <div key={aIdx} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1">
                                                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                                                                <span className="font-bold text-slate-400">{ans.workerName}</span>
                                                                <span>{ans.submittedAt ? new Date(ans.submittedAt).toLocaleDateString() : ''}</span>
                                                            </div>
                                                            <p className="text-slate-200 break-words leading-relaxed">
                                                                {ans.value}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </Modal>
    );
};
