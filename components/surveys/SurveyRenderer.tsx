import React, { useState, useEffect, useRef } from 'react';
import { SurveyConfig, SurveyQuestion, SurveyAnswer, SurveyOption } from '../../types';
import {
    CheckCircle2,
    AlertCircle,
    Clock,
    Shield,
    Star,
    ChevronRight,
    ChevronLeft,
    Check,
    X,
    Send,
    FileText
} from 'lucide-react';

interface SurveyRendererProps {
    config: SurveyConfig;
    taskTitle?: string;
    rewardAmount?: number;
    currency?: string;
    onSubmit: (result: {
        responses: SurveyAnswer[];
        completionTimeSeconds: number;
        consentAgreed: boolean;
        answeredPath: string[];
        skippedQuestions: string[];
        qualificationStatus: string;
        attentionCheckPassed: boolean;
    }) => Promise<void> | void;
    onCancel?: () => void;
    isSubmitting?: boolean;
}

export const SurveyRenderer: React.FC<SurveyRendererProps> = ({
    config,
    taskTitle,
    rewardAmount,
    currency = 'USD',
    onSubmit,
    onCancel,
    isSubmitting = false
}) => {
    // Timer state
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const timerRef = useRef<any>(null);

    // Consent state
    const [hasAgreedConsent, setHasAgreedConsent] = useState<boolean>(!config.consentRequired);

    // Answers state: questionId -> value
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submissionAttempted, setSubmissionAttempted] = useState<boolean>(false);

    // Start timer on mount
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const questions: SurveyQuestion[] = config.questions || [];

    // Evaluate conditional visibility for question
    const isQuestionVisible = (q: SurveyQuestion): boolean => {
        if (!q.showIf) return true;
        const condition = Array.isArray(q.showIf) ? q.showIf[0] : q.showIf;
        if (!condition || !condition.questionId) return true;

        const sourceAns = answers[condition.questionId];
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

    // Calculate progress
    const answeredCount = visibleQuestions.filter(q => {
        const ans = answers[q.id];
        if (ans === undefined || ans === null || ans === '') return false;
        if (Array.isArray(ans) && ans.length === 0) return false;
        return true;
    }).length;

    const progressPercentage = visibleQuestions.length > 0
        ? Math.round((answeredCount / visibleQuestions.length) * 100)
        : 100;

    // Answer handlers
    const handleSingleChoice = (qId: string, val: string) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
        if (errors[qId]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[qId];
                return next;
            });
        }
    };

    const handleMultipleChoice = (qId: string, val: string, max?: number) => {
        setAnswers(prev => {
            const current: string[] = Array.isArray(prev[qId]) ? [...prev[qId]] : [];
            const exists = current.includes(val);
            if (exists) {
                return { ...prev, [qId]: current.filter(item => item !== val) };
            }
            if (max && current.length >= max) {
                return prev;
            }
            return { ...prev, [qId]: [...current, val] };
        });
        if (errors[qId]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[qId];
                return next;
            });
        }
    };

    const handleTopNSelect = (qId: string, val: string, topN: number = 3) => {
        setAnswers(prev => {
            const current: string[] = Array.isArray(prev[qId]) ? [...prev[qId]] : [];
            const index = current.indexOf(val);
            if (index >= 0) {
                return { ...prev, [qId]: current.filter(item => item !== val) };
            }
            if (current.length >= topN) {
                return prev;
            }
            return { ...prev, [qId]: [...current, val] };
        });
        if (errors[qId]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[qId];
                return next;
            });
        }
    };

    // Validation
    const validateAll = (): boolean => {
        const newErrors: Record<string, string> = {};

        visibleQuestions.forEach(q => {
            const ans = answers[q.id];
            const isAnswered = ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);

            if (q.required && !isAnswered) {
                newErrors[q.id] = 'This question is required.';
                return;
            }

            if (isAnswered) {
                // Multiple choice min/max
                if (q.type === 'multiple_choice' && Array.isArray(ans)) {
                    if (q.validation?.minSelections && ans.length < q.validation.minSelections) {
                        newErrors[q.id] = `Please select at least ${q.validation.minSelections} choices.`;
                    } else if (q.validation?.maxSelections && ans.length > q.validation.maxSelections) {
                        newErrors[q.id] = `Please select at most ${q.validation.maxSelections} choices.`;
                    }
                }

                // Top N
                if (q.type === 'top_n' && Array.isArray(ans)) {
                    const reqTopN = q.validation?.topN || 3;
                    if (q.required && ans.length < reqTopN && (q.options || []).length >= reqTopN) {
                        newErrors[q.id] = `Please rank your top ${reqTopN} choices.`;
                    }
                }

                // Short / Long text length
                if ((q.type === 'short_text' || q.type === 'long_text') && typeof ans === 'string') {
                    if (q.validation?.minLength && ans.trim().length < q.validation.minLength) {
                        newErrors[q.id] = `Must be at least ${q.validation.minLength} characters.`;
                    }
                }

                // "Other" specification
                if (ans === 'Other' || (Array.isArray(ans) && ans.includes('Other'))) {
                    if (!otherAnswers[q.id] || otherAnswers[q.id].trim() === '') {
                        newErrors[q.id] = 'Please provide details for "Other".';
                    }
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        setSubmissionAttempted(true);
        if (!validateAll()) {
            return;
        }

        // Check Attention Check questions
        let attentionCheckPassed = true;
        let qualificationStatus = 'Completed';

        const responsesList: SurveyAnswer[] = visibleQuestions.map(q => {
            const val = answers[q.id];
            const otherVal = otherAnswers[q.id];
            let isCheck = Boolean(q.isAttentionCheck);
            let checkPassed: boolean | undefined = undefined;

            if (isCheck && q.expectedAnswer) {
                const expected = q.expectedAnswer.trim().toLowerCase();
                const actual = String(val || '').trim().toLowerCase();
                checkPassed = actual === expected;
                if (!checkPassed) {
                    attentionCheckPassed = false;
                    qualificationStatus = 'Disqualified';
                }
            }

            return {
                questionId: q.id,
                questionTitle: q.title,
                questionType: q.type,
                value: val,
                otherValue: otherVal,
                selectedOptions: Array.isArray(val) ? val : undefined,
                textValue: typeof val === 'string' ? val : undefined,
                ratingValue: typeof val === 'number' ? val : undefined,
                timeSpentSeconds: elapsedSeconds,
                isAttentionCheck: isCheck,
                passedCheck: checkPassed
            };
        });

        const answeredPath = visibleQuestions.map(q => q.id);
        const skippedQuestions = questions
            .filter(q => !visibleQuestions.some(vq => vq.id === q.id))
            .map(q => q.id);

        await onSubmit({
            responses: responsesList,
            completionTimeSeconds: elapsedSeconds,
            consentAgreed: hasAgreedConsent,
            answeredPath,
            skippedQuestions,
            qualificationStatus,
            attentionCheckPassed
        });
    };

    // Consent Check Screen
    if (config.consentRequired && !hasAgreedConsent) {
        return (
            <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 max-w-2xl mx-auto shadow-2xl">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white">Participant Consent Notice</h3>
                        <p className="text-xs text-slate-400">Please review before participating</p>
                    </div>
                </div>

                <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-3">
                    <p className="font-semibold text-white">
                        {config.title || taskTitle || 'Survey Feedback Participation'}
                    </p>
                    <p>
                        {config.consentText ||
                            'Your responses will be collected anonymously for research and service quality analysis. Please ensure you answer thoughtfully and genuinely. Speeding or random selections may lead to disqualification.'}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" /> ~{config.estimatedTimeMinutes || 5} Minutes
                        </span>
                        {rewardAmount && (
                            <span className="text-emerald-400 font-bold">
                                Reward: +{rewardAmount} {currency}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setHasAgreedConsent(true)}
                        className="flex-1 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
                    >
                        I Agree & Begin Survey
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-950/95 border border-slate-800 rounded-3xl p-5 md:p-8 space-y-6 max-w-3xl mx-auto shadow-2xl">
            {/* Header / Timer & Progress */}
            <div className="space-y-3 border-b border-slate-800/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Survey Questionnaire
                            </span>
                            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400" /> {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                        <h2 className="text-base md:text-lg font-black text-white mt-1">
                            {config.title || taskTitle || 'Survey Feedback'}
                        </h2>
                    </div>

                    {rewardAmount && (
                        <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black font-mono">
                            +{rewardAmount} {currency}
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-400">
                        <span>Progress ({answeredCount} of {visibleQuestions.length} answered)</span>
                        <span className="text-amber-400">{progressPercentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Questions List */}
            <div className="space-y-6">
                {visibleQuestions.map((q, idx) => {
                    const currentAnswer = answers[q.id];
                    const error = errors[q.id];
                    const opts: SurveyOption[] = (q.options || []).map(opt =>
                        typeof opt === 'string' ? { id: opt, text: opt, value: opt } : opt
                    );

                    return (
                        <div
                            key={q.id || idx}
                            className={`p-5 md:p-6 rounded-2xl border transition-all ${
                                error
                                    ? 'bg-red-950/20 border-red-900/50 shadow-md'
                                    : currentAnswer !== undefined && currentAnswer !== ''
                                        ? 'bg-slate-900/80 border-slate-700/60'
                                        : 'bg-slate-900/40 border-slate-800/80'
                            }`}
                        >
                            {/* Question Title & Description */}
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
                                        Question {idx + 1}
                                    </span>
                                    <h3 className="text-sm md:text-base font-bold text-white leading-snug">
                                        {q.title}
                                        {q.required && <span className="text-amber-500 ml-1">*</span>}
                                    </h3>
                                    {q.description && (
                                        <p className="text-xs text-slate-400 mt-1">{q.description}</p>
                                    )}
                                </div>
                                {q.type === 'top_n' && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                                        Top {q.validation?.topN || 3}
                                    </span>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                                </div>
                            )}

                            {/* Question Inputs */}
                            {/* Single Choice */}
                            {q.type === 'single_choice' && (
                                <div className="space-y-2">
                                    {opts.map((opt) => (
                                        <label
                                            key={opt.id}
                                            className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                                currentAnswer === opt.value
                                                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name={`render_${q.id}`}
                                                checked={currentAnswer === opt.value}
                                                onChange={() => handleSingleChoice(q.id, opt.value || opt.text)}
                                                className="w-4 h-4 text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                            />
                                            <span className="flex-1">{opt.text}</span>
                                        </label>
                                    ))}

                                    {q.allowOther && (
                                        <div className="pt-1">
                                            <label
                                                className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                                    currentAnswer === 'Other'
                                                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`render_${q.id}`}
                                                    checked={currentAnswer === 'Other'}
                                                    onChange={() => handleSingleChoice(q.id, 'Other')}
                                                    className="w-4 h-4 text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                                />
                                                <span className="flex-1">Other</span>
                                            </label>
                                            {currentAnswer === 'Other' && (
                                                <input
                                                    type="text"
                                                    value={otherAnswers[q.id] || ''}
                                                    onChange={(e) => setOtherAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                    placeholder={q.otherPlaceholder || 'Please specify details...'}
                                                    className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
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
                                                className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleMultipleChoice(q.id, opt.value || opt.text, q.validation?.maxSelections)}
                                                    className="w-4 h-4 rounded text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                                />
                                                <span className="flex-1">{opt.text}</span>
                                            </label>
                                        );
                                    })}

                                    {q.allowOther && (
                                        <div className="pt-1">
                                            <label
                                                className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                                    Array.isArray(currentAnswer) && currentAnswer.includes('Other')
                                                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={Array.isArray(currentAnswer) && currentAnswer.includes('Other')}
                                                    onChange={() => handleMultipleChoice(q.id, 'Other', q.validation?.maxSelections)}
                                                    className="w-4 h-4 rounded text-amber-500 border-slate-700 bg-slate-900 focus:ring-0"
                                                />
                                                <span className="flex-1">Other</span>
                                            </label>
                                            {Array.isArray(currentAnswer) && currentAnswer.includes('Other') && (
                                                <input
                                                    type="text"
                                                    value={otherAnswers[q.id] || ''}
                                                    onChange={(e) => setOtherAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                    placeholder={q.otherPlaceholder || 'Please specify details...'}
                                                    className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Top-N Ranking */}
                            {q.type === 'top_n' && (
                                <div className="space-y-2">
                                    <p className="text-xs text-amber-300/80 mb-2">
                                        Tap items in order of priority to select your Top {q.validation?.topN || 3}:
                                    </p>
                                    {opts.map((opt) => {
                                        const selectedList: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
                                        const rankIdx = selectedList.indexOf(opt.value || opt.text);
                                        const isSelected = rankIdx >= 0;

                                        return (
                                            <div
                                                key={opt.id}
                                                onClick={() => handleTopNSelect(q.id, opt.value || opt.text, q.validation?.topN || 3)}
                                                className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                                    isSelected
                                                        ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                                                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
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
                                    onChange={(e) => {
                                        setAnswers(prev => ({ ...prev, [q.id]: e.target.value }));
                                        if (errors[q.id]) setErrors(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                    }}
                                    placeholder="Type your response here..."
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
                                        onChange={(e) => {
                                            setAnswers(prev => ({ ...prev, [q.id]: e.target.value }));
                                            if (errors[q.id]) setErrors(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                        }}
                                        placeholder="Write your detailed answer..."
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
                                    onChange={(e) => {
                                        setAnswers(prev => ({ ...prev, [q.id]: e.target.value }));
                                        if (errors[q.id]) setErrors(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                    }}
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
                                            onClick={() => {
                                                setAnswers(prev => ({ ...prev, [q.id]: choice }));
                                                if (errors[q.id]) setErrors(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                            }}
                                            className={`py-3.5 rounded-xl border text-xs font-bold transition-all ${
                                                currentAnswer === choice
                                                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
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
                                                onClick={() => {
                                                    setAnswers(prev => ({ ...prev, [q.id]: starVal }));
                                                    if (errors[q.id]) setErrors(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                                }}
                                                className="p-1 transition-transform hover:scale-125 focus:outline-none"
                                            >
                                                <Star
                                                    className={`w-7 h-7 transition-colors ${
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
                                            {currentAnswer} / {q.maxRating || 5} Stars
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 md:flex-initial px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <span>Submitting Survey Responses...</span>
                    ) : (
                        <>
                            <Send className="w-4 h-4" /> Complete & Submit Survey
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
