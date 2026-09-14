import React, { useState } from 'react';
import { SurveyConfig, SurveyQuestion } from '../../types';
import {
    CheckCircle2,
    RotateCcw,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    Star,
    Sparkles
} from 'lucide-react';

interface SurveyPreviewProps {
    config: SurveyConfig;
    onReset?: () => void;
}

export const SurveyPreview: React.FC<SurveyPreviewProps> = ({ config }) => {
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const questions: SurveyQuestion[] = config.questions || [];

    // Evaluate conditional visibility for question
    const isQuestionVisible = (q: SurveyQuestion): boolean => {
        if (!q.showIf) return true;
        const condition = Array.isArray(q.showIf) ? q.showIf[0] : q.showIf;
        if (!condition || !condition.questionId) return true;

        const sourceAns = responses[condition.questionId];
        const targetVal = String(condition.value || '').trim().toLowerCase();

        if (condition.operator === 'answered') {
            return sourceAns !== undefined && sourceAns !== null && sourceAns !== '';
        }

        if (Array.isArray(sourceAns)) {
            if (condition.operator === 'contains') {
                return sourceAns.some(item => String(item).toLowerCase().includes(targetVal));
            }
            if (condition.operator === 'not_contains') {
                return !sourceAns.some(item => String(item).toLowerCase().includes(targetVal));
            }
            return sourceAns.map(s => String(s).toLowerCase()).includes(targetVal);
        }

        const sourceStr = String(sourceAns || '').trim().toLowerCase();
        if (condition.operator === 'equals') {
            return sourceStr === targetVal;
        }
        if (condition.operator === 'not_equals') {
            return sourceStr !== targetVal;
        }
        if (condition.operator === 'contains') {
            return sourceStr.includes(targetVal);
        }
        return true;
    };

    const visibleQuestions = questions.filter(isQuestionVisible);

    const handleSingleChoice = (qId: string, val: string) => {
        setResponses(prev => ({ ...prev, [qId]: val }));
    };

    const handleMultiChoice = (qId: string, val: string, max?: number) => {
        setResponses(prev => {
            const current: string[] = Array.isArray(prev[qId]) ? [...prev[qId]] : [];
            const exists = current.includes(val);
            if (exists) {
                return { ...prev, [qId]: current.filter(item => item !== val) };
            }
            if (max && current.length >= max) {
                return prev; // Enforce max selections
            }
            return { ...prev, [qId]: [...current, val] };
        });
    };

    const handleTopNSelect = (qId: string, val: string, topN: number = 3) => {
        setResponses(prev => {
            const current: string[] = Array.isArray(prev[qId]) ? [...prev[qId]] : [];
            const index = current.indexOf(val);
            if (index >= 0) {
                // Remove
                return { ...prev, [qId]: current.filter(item => item !== val) };
            }
            if (current.length >= topN) {
                // Replace last or reject
                return prev;
            }
            return { ...prev, [qId]: [...current, val] };
        });
    };

    const handleReset = () => {
        setResponses({});
        setOtherTexts({});
        setValidationErrors({});
    };

    return (
        <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl max-w-3xl mx-auto">
            {/* Live Preview Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Live Simulator
                        </span>
                        <span className="text-xs text-slate-400">
                            Estimated time: ~{config.estimatedTimeMinutes || 5} min
                        </span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-1">
                        {config.title || 'Untitled Survey Questionnaire'}
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Answers
                </button>
            </div>

            {config.description && (
                <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                    {config.description}
                </p>
            )}

            {/* Questions List */}
            <div className="space-y-6">
                {visibleQuestions.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs italic bg-slate-900/30 rounded-2xl border border-slate-900">
                        No visible questions to display. Add questions in the builder tab.
                    </div>
                ) : (
                    visibleQuestions.map((q, idx) => {
                        const currentAnswer = responses[q.id];
                        const opts = (q.options || []).map(opt => typeof opt === 'string' ? { id: opt, text: opt, value: opt } : opt);

                        return (
                            <div
                                key={q.id || idx}
                                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4 hover:border-slate-700/80 transition-all"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
                                            Question {idx + 1} of {visibleQuestions.length}
                                        </span>
                                        <h4 className="text-sm font-bold text-white leading-snug">
                                            {q.title || `Question ${idx + 1}`}
                                            {q.required && <span className="text-amber-500 ml-1">*</span>}
                                        </h4>
                                        {q.description && (
                                            <p className="text-xs text-slate-400 mt-1">{q.description}</p>
                                        )}
                                    </div>
                                    {q.type === 'top_n' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                                            Select Top {q.validation?.topN || 3}
                                        </span>
                                    )}
                                </div>

                                {/* Single Choice */}
                                {q.type === 'single_choice' && (
                                    <div className="space-y-2">
                                        {opts.map((opt) => (
                                            <label
                                                key={opt.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                                    currentAnswer === opt.value
                                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                                                        : 'bg-slate-950/40 border-slate-800/70 text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`preview_${q.id}`}
                                                    checked={currentAnswer === opt.value}
                                                    onChange={() => handleSingleChoice(q.id, opt.value || opt.text)}
                                                    className="w-4 h-4 text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                                />
                                                <span>{opt.text}</span>
                                            </label>
                                        ))}

                                        {/* Other Option */}
                                        {q.allowOther && (
                                            <div className="pt-1">
                                                <label
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                                        currentAnswer === 'Other'
                                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                                                            : 'bg-slate-950/40 border-slate-800/70 text-slate-300 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`preview_${q.id}`}
                                                        checked={currentAnswer === 'Other'}
                                                        onChange={() => handleSingleChoice(q.id, 'Other')}
                                                        className="w-4 h-4 text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                                    />
                                                    <span>Other</span>
                                                </label>
                                                {currentAnswer === 'Other' && (
                                                    <input
                                                        type="text"
                                                        value={otherTexts[q.id] || ''}
                                                        onChange={(e) => setOtherTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                        placeholder={q.otherPlaceholder || 'Please specify your answer...'}
                                                        className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Multiple Choice */}
                                {q.type === 'multiple_choice' && (
                                    <div className="space-y-2">
                                        {opts.map((opt) => {
                                            const isChecked = Array.isArray(currentAnswer) && currentAnswer.includes(opt.value || opt.text);
                                            return (
                                                <label
                                                    key={opt.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                                        isChecked
                                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                                                            : 'bg-slate-950/40 border-slate-800/70 text-slate-300 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleMultiChoice(q.id, opt.value || opt.text, q.validation?.maxSelections)}
                                                        className="w-4 h-4 rounded text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                                    />
                                                    <span>{opt.text}</span>
                                                </label>
                                            );
                                        })}

                                        {q.allowOther && (
                                            <div className="pt-1">
                                                <label
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                                        Array.isArray(currentAnswer) && currentAnswer.includes('Other')
                                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                                                            : 'bg-slate-950/40 border-slate-800/70 text-slate-300 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={Array.isArray(currentAnswer) && currentAnswer.includes('Other')}
                                                        onChange={() => handleMultiChoice(q.id, 'Other', q.validation?.maxSelections)}
                                                        className="w-4 h-4 rounded text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                                    />
                                                    <span>Other</span>
                                                </label>
                                                {Array.isArray(currentAnswer) && currentAnswer.includes('Other') && (
                                                    <input
                                                        type="text"
                                                        value={otherTexts[q.id] || ''}
                                                        onChange={(e) => setOtherTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                        placeholder={q.otherPlaceholder || 'Please specify your answer...'}
                                                        className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Top-N Ranking */}
                                {q.type === 'top_n' && (
                                    <div className="space-y-2">
                                        <p className="text-[11px] text-amber-300/80 mb-2">
                                            Click items in order of preference to rank your Top {q.validation?.topN || 3}:
                                        </p>
                                        {opts.map((opt) => {
                                            const selectedList: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
                                            const rankIdx = selectedList.indexOf(opt.value || opt.text);
                                            const isSelected = rankIdx >= 0;

                                            return (
                                                <div
                                                    key={opt.id}
                                                    onClick={() => handleTopNSelect(q.id, opt.value || opt.text, q.validation?.topN || 3)}
                                                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                                                            : 'bg-slate-950/40 border-slate-800/70 text-slate-300 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <span>{opt.text}</span>
                                                    {isSelected ? (
                                                        <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                                                            #{rankIdx + 1}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 uppercase font-mono">
                                                            Tap to rank
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Short Text */}
                                {q.type === 'short_text' && (
                                    <input
                                        type="text"
                                        value={currentAnswer || ''}
                                        onChange={(e) => setResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        placeholder="Type your answer here..."
                                        maxLength={q.validation?.maxLength || 150}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                                    />
                                )}

                                {/* Long Text */}
                                {q.type === 'long_text' && (
                                    <div className="space-y-1">
                                        <textarea
                                            rows={3}
                                            value={currentAnswer || ''}
                                            onChange={(e) => setResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                                            placeholder="Write your feedback in detail..."
                                            maxLength={q.validation?.maxLength || 2000}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 leading-relaxed"
                                        />
                                        <div className="text-right text-[10px] text-slate-500 font-mono">
                                            {(currentAnswer || '').length} / {q.validation?.maxLength || 2000} chars
                                        </div>
                                    </div>
                                )}

                                {/* Dropdown */}
                                {q.type === 'dropdown' && (
                                    <select
                                        value={currentAnswer || ''}
                                        onChange={(e) => setResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="">-- Choose an option --</option>
                                        {opts.map((opt) => (
                                            <option key={opt.id} value={opt.value || opt.text}>
                                                {opt.text}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* Yes / No */}
                                {q.type === 'yes_no' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        {['Yes', 'No'].map((choice) => (
                                            <button
                                                key={choice}
                                                type="button"
                                                onClick={() => setResponses(prev => ({ ...prev, [q.id]: choice }))}
                                                className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                                                    currentAnswer === choice
                                                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                                                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                {choice}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Rating */}
                                {q.type === 'rating' && (
                                    <div className="flex items-center gap-2 pt-1">
                                        {Array.from({ length: q.maxRating || 5 }).map((_, rIdx) => {
                                            const starVal = rIdx + 1;
                                            const isFilled = (Number(currentAnswer) || 0) >= starVal;
                                            return (
                                                <button
                                                    key={starVal}
                                                    type="button"
                                                    onClick={() => setResponses(prev => ({ ...prev, [q.id]: starVal }))}
                                                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                                                >
                                                    <Star
                                                        className={`w-6 h-6 transition-colors ${
                                                            isFilled
                                                                ? 'text-amber-400 fill-amber-400'
                                                                : 'text-slate-700 hover:text-slate-500'
                                                        }`}
                                                    />
                                                </button>
                                            );
                                        })}
                                        {currentAnswer && (
                                            <span className="text-xs font-mono font-bold text-amber-400 ml-2">
                                                {currentAnswer} / {q.maxRating || 5}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Answered State Summary */}
            <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs flex justify-between items-center text-slate-400 font-mono">
                <span>
                    Answered: <strong className="text-white">{Object.keys(responses).length}</strong> / {visibleQuestions.length} visible questions
                </span>
                <span className="text-emerald-400 font-bold">
                    ✓ Simulator Active
                </span>
            </div>
        </div>
    );
};
