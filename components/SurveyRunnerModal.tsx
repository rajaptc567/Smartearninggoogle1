import React, { useState, useEffect, useRef } from 'react';
import { UserTask, formatCurrency } from '../types';
import Button from './ui/Button';
import {
    Clock,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    Star,
    ArrowRight,
    ArrowLeft,
    Check,
    HelpCircle,
    X,
    Award,
    Bookmark,
    RotateCcw
} from 'lucide-react';
import { submitUserTaskProof } from '../services/api';
import {
    SurveyQuestion,
    verifyCheckQuestion,
    evaluateRule,
    pipeAnswersIntoText
} from '../lib/surveyLogicEngine';

export interface NormalizedSurveyOption {
    id: string;
    text: string;
    value: string;
}

export function normalizeSurveyOption(opt: any, index: number): NormalizedSurveyOption {
    if (typeof opt === 'string') {
        const trimmed = opt.trim();
        return {
            id: trimmed || `opt_${index}`,
            text: opt,
            value: opt
        };
    }
    if (typeof opt === 'number' || typeof opt === 'boolean') {
        const str = String(opt);
        return {
            id: `opt_${index}_${str}`,
            text: str,
            value: str
        };
    }
    if (typeof opt === 'object' && opt !== null) {
        const text = typeof opt.text === 'string'
            ? opt.text
            : (typeof opt.label === 'string'
                ? opt.label
                : (typeof opt.title === 'string'
                    ? opt.title
                    : (opt.value !== undefined && opt.value !== null
                        ? String(opt.value)
                        : `Option ${index + 1}`)));

        const value = opt.value !== undefined && opt.value !== null
            ? String(opt.value)
            : text;

        const id = opt.id !== undefined && opt.id !== null && String(opt.id).trim() !== ''
            ? String(opt.id)
            : (value ? `opt_${index}_${value}` : `opt_${index}`);

        return { id, text, value };
    }
    const fallback = `Option ${index + 1}`;
    return {
        id: `opt_${index}`,
        text: fallback,
        value: fallback
    };
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    onClose: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class SurveyRunnerErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = { hasError: false, error: null };
    public props: ErrorBoundaryProps;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.props = props;
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('SurveyRunner encountered an uncaught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-850 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 text-center space-y-4">
                        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white">
                            Survey Question Notice
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                            A display issue occurred while rendering this survey question. Your progress has been safely preserved.
                        </p>
                        <div className="pt-2">
                            <Button size="sm" variant="secondary" onClick={this.props.onClose} className="rounded-xl px-5">
                                Close & Return to Dashboard
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export interface SurveyRunnerModalProps {
    task: UserTask;
    currentUserId: string;
    onClose: () => void;
    onCompleted: () => void;
}

const SurveyRunnerModalInner: React.FC<SurveyRunnerModalProps> = ({
    task,
    currentUserId,
    onClose,
    onCompleted
}) => {
    if (task?.status === 'On Hold') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-800 text-center">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                        ⏸️
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Campaign Paused</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                        This survey campaign is currently paused (&ldquo;On Hold&rdquo;) by the administrator and is not accepting submissions at this time.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:opacity-90 transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Stages: 'intro' | 'active' | 'submitting' | 'success' | 'speed_warning' | 'disqualified'
    const [stage, setStage] = useState<'intro' | 'active' | 'submitting' | 'success' | 'speed_warning' | 'disqualified'>('intro');
    const [consentAgreed, setConsentAgreed] = useState(false);

    // Questions from surveyConfig
    const surveyConfig = task.surveyConfig || {};
    const rawQuestions: any[] = Array.isArray(surveyConfig.questions) ? surveyConfig.questions : [];
    const questions: SurveyQuestion[] = rawQuestions.filter(q => q && typeof q === 'object' && q.id);

    // Worker responses: { [questionId: string]: any }
    const [responses, setResponses] = useState<{ [key: string]: any }>({});
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

    // Path History navigation stack for non-linear backtracking
    const [pathHistory, setPathHistory] = useState<number[]>([]);
    const [answeredPath, setAnsweredPath] = useState<string[]>([]);
    const [skippedQuestions, setSkippedQuestions] = useState<string[]>([]);

    // Check Questions runtime state
    const [checkAttempts, setCheckAttempts] = useState<Record<string, number>>({});
    const [checkQuestionResults, setCheckQuestionResults] = useState<Array<{
        checkQuestionId: string;
        checkQuestionTitle?: string;
        sourceQuestionId: string;
        originalAnswer?: any;
        verificationAnswer?: any;
        comparisonMethod?: string;
        result: 'PASS' | 'FAIL';
        failureAction?: string;
        timestamp?: Date;
    }>>([]);
    const [checkWarning, setCheckWarning] = useState<string | null>(null);

    // Qualification Status
    const [qualificationStatus, setQualificationStatus] = useState<'Completed' | 'Qualified' | 'Disqualified'>('Completed');
    const [disqualificationReason, setDisqualificationReason] = useState<string>('You do not meet the qualification criteria for this survey.');

    // Timer
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const timerRef = useRef<any>(null);

    // Error message & draft banner
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [hasDraftToResume, setHasDraftToResume] = useState(false);

    const draftStorageKey = `survey_worker_progress_${task._id}_${currentUserId}`;

    // Estimated minutes and min allowed seconds
    const estimatedMinutes = task.surveyEstimatedMinutes || Number(surveyConfig.estimatedTimeMinutes) || 5;
    const minAllowedSeconds = Math.max(15, Math.floor(estimatedMinutes * 60 * 0.25));

    // Check for saved progress on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(draftStorageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.responses && Object.keys(parsed.responses).length > 0) {
                    setHasDraftToResume(true);
                }
            }
        } catch (e) {
            console.error('Failed reading worker draft', e);
        }
    }, [draftStorageKey]);

    const resumeDraft = () => {
        try {
            const saved = localStorage.getItem(draftStorageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                setResponses(parsed.responses || {});
                setActiveQuestionIndex(parsed.activeQuestionIndex || 0);
                setPathHistory(parsed.pathHistory || []);
                setAnsweredPath(parsed.answeredPath || []);
                setSecondsElapsed(parsed.secondsElapsed || 0);
                setHasDraftToResume(false);
                setStage('active');
            }
        } catch (e) {
            console.error('Error resuming draft', e);
        }
    };

    const discardDraft = () => {
        localStorage.removeItem(draftStorageKey);
        setHasDraftToResume(false);
    };

    const saveAndContinueLater = () => {
        try {
            localStorage.setItem(draftStorageKey, JSON.stringify({
                responses,
                activeQuestionIndex,
                pathHistory,
                answeredPath,
                secondsElapsed,
                updatedAt: new Date().toISOString()
            }));
            alert('Survey progress saved! You can resume this survey anytime.');
            onClose();
        } catch (e) {
            console.error('Failed to save progress', e);
        }
    };

    useEffect(() => {
        if (stage === 'active') {
            timerRef.current = setInterval(() => {
                setSecondsElapsed(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [stage]);

    // Handle answer update
    const handleAnswer = (questionId: string, val: any) => {
        setResponses(prev => ({
            ...prev,
            [questionId]: val
        }));
        setCheckWarning(null);
    };

    // Current question
    const activeIndex = Math.max(0, Math.min(activeQuestionIndex, questions.length > 0 ? questions.length - 1 : 0));
    const currentQ: SurveyQuestion | undefined = questions[activeIndex];

    // Check if current question is answered
    const isCurrentQuestionAnswered = () => {
        if (!currentQ) return true;
        if (!currentQ.required) return true;
        const ans = responses[currentQ.id];
        if (ans === undefined || ans === null || ans === '') return false;
        if (Array.isArray(ans)) {
            if (ans.length === 0) return false;
            if (currentQ.type === 'top_n') {
                const minN = currentQ.validation?.topN || 1;
                const availableOptsCount = (currentQ.options || []).length;
                const targetCount = Math.min(minN, availableOptsCount);
                return ans.length >= targetCount;
            }
        }
        return true;
    };

    // Evaluate Next Navigation with Branching Logic & Check Question Validation
    const handleNextQuestion = () => {
        if (!currentQ) return;

        // 1. Validate required answer
        if (currentQ.required && !isCurrentQuestionAnswered()) {
            setErrorMessage('Please provide an answer to continue.');
            return;
        }
        setErrorMessage(null);

        // 2. Check Question Verification at Runtime
        if (currentQ.isCheckQuestion && currentQ.sourceQuestionId) {
            const sourceAns = responses[currentQ.sourceQuestionId];
            const checkAns = responses[currentQ.id];
            const compMethod = currentQ.checkComparisonMethod || 'case_insensitive';
            const verifyResult = verifyCheckQuestion(sourceAns, checkAns, compMethod);

            const curAttempts = (checkAttempts[currentQ.id] || 0) + 1;
            setCheckAttempts(prev => ({ ...prev, [currentQ.id]: curAttempts }));

            const maxAttempts = currentQ.maxCheckAttempts || 2;
            const failureAction = currentQ.checkFailureAction || 'flag';

            if (!verifyResult.passed) {
                // Check failed
                const attemptsRemaining = maxAttempts - curAttempts;

                if (failureAction === 'retry' && attemptsRemaining > 0) {
                    // Show non-revealing warning and require user to retry
                    const msg = currentQ.checkRetryMessage || 
                        `Your answer does not match the information provided earlier. Please verify and try again. (${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining)`;
                    setCheckWarning(msg);
                    return; // Prevent advancing!
                }

                // Attempts exhausted or action is immediate
                const newCheckRecord = {
                    checkQuestionId: currentQ.id,
                    checkQuestionTitle: currentQ.title,
                    sourceQuestionId: currentQ.sourceQuestionId,
                    originalAnswer: sourceAns,
                    verificationAnswer: checkAns,
                    comparisonMethod: compMethod,
                    result: 'FAIL' as const,
                    failureAction,
                    timestamp: new Date()
                };
                setCheckQuestionResults(prev => [...prev.filter(r => r.checkQuestionId !== currentQ.id), newCheckRecord]);

                if (failureAction === 'disqualify') {
                    const reason = 'Your responses did not meet consistency verification standards.';
                    setQualificationStatus('Disqualified');
                    setDisqualificationReason(reason);
                    performScreenoutSubmission(reason);
                    return;
                }
            } else {
                // Check passed
                const passRecord = {
                    checkQuestionId: currentQ.id,
                    checkQuestionTitle: currentQ.title,
                    sourceQuestionId: currentQ.sourceQuestionId,
                    originalAnswer: sourceAns,
                    verificationAnswer: checkAns,
                    comparisonMethod: compMethod,
                    result: 'PASS' as const,
                    failureAction,
                    timestamp: new Date()
                };
                setCheckQuestionResults(prev => [...prev.filter(r => r.checkQuestionId !== currentQ.id), passRecord]);
                setCheckWarning(null);
            }
        }

        // Record question in answered path
        if (!answeredPath.includes(currentQ.id)) {
            setAnsweredPath(prev => [...prev, currentQ.id]);
        }

        // 3. Evaluate Branching Rules for Current Question
        let nextTargetIndex: number | null = null;
        let earlyFinish = false;

        if (currentQ.logicRules && currentQ.logicRules.length > 0) {
            for (const rule of currentQ.logicRules) {
                const evaluated = evaluateRule(rule, responses);
                if (evaluated.action) {
                    if (evaluated.action === 'disqualify') {
                        const reason = evaluated.message || 'Based on your response, you do not meet the criteria for this survey.';
                        setQualificationStatus('Disqualified');
                        setDisqualificationReason(reason);
                        performScreenoutSubmission(reason);
                        return;
                    }

                    if (evaluated.action === 'end_survey') {
                        earlyFinish = true;
                        break;
                    }

                    if (evaluated.action === 'goto_question' && evaluated.targetQuestionId) {
                        const targetIdx = questions.findIndex(q => q.id === evaluated.targetQuestionId);
                        if (targetIdx !== -1 && targetIdx > activeQuestionIndex) {
                            // Record skipped questions between current and target
                            const newlySkipped = questions
                                .slice(activeQuestionIndex + 1, targetIdx)
                                .map(q => q.id);
                            setSkippedQuestions(prev => Array.from(new Set([...prev, ...newlySkipped])));

                            nextTargetIndex = targetIdx;
                            break;
                        }
                    }

                    if (evaluated.action === 'skip_question') {
                        const targetIdx = activeQuestionIndex + 2;
                        if (targetIdx < questions.length) {
                            setSkippedQuestions(prev => Array.from(new Set([...prev, questions[activeQuestionIndex + 1]?.id || ''])));
                            nextTargetIndex = targetIdx;
                            break;
                        } else {
                            earlyFinish = true;
                            break;
                        }
                    }

                    if (evaluated.action === 'goto_section' && evaluated.targetSectionId) {
                        const secIdx = questions.findIndex(q => q.sectionId === evaluated.targetSectionId);
                        if (secIdx !== -1) {
                            nextTargetIndex = secIdx;
                            break;
                        }
                    }
                }
            }
        }

        if (earlyFinish) {
            handleSubmitSurvey();
            return;
        }

        // Determine destination index
        const resolvedNextIndex = nextTargetIndex !== null ? nextTargetIndex : activeQuestionIndex + 1;

        if (resolvedNextIndex >= questions.length) {
            // Reached survey completion
            handleSubmitSurvey();
        } else {
            // Push current question index to navigation history stack
            setPathHistory(prev => [...prev, activeQuestionIndex]);
            setActiveQuestionIndex(resolvedNextIndex);
            setCheckWarning(null);
        }
    };

    // Handle Previous Question using Navigation Stack
    const handlePreviousQuestion = () => {
        if (pathHistory.length === 0) return;
        const newHistory = [...pathHistory];
        const previousIndex = newHistory.pop()!;
        setPathHistory(newHistory);
        setActiveQuestionIndex(previousIndex);
        setCheckWarning(null);
    };

    // Submit Survey Responses
    const handleSubmitSurvey = async () => {
        // Anti-speeding verification check
        if (secondsElapsed < minAllowedSeconds) {
            setStage('speed_warning');
            return;
        }

        performSubmission();
    };

    const performScreenoutSubmission = async (reason: string) => {
        setStage('submitting');
        setErrorMessage(null);

        const formattedResponses = questions
            .filter(q => !skippedQuestions.includes(q.id) && responses[q.id] !== undefined)
            .map(q => ({
                questionId: q.id,
                questionTitle: q.title,
                type: q.type,
                value: responses[q.id] !== undefined ? responses[q.id] : null
            }));

        try {
            await submitUserTaskProof(task._id, {
                userId: currentUserId,
                surveyResponses: formattedResponses,
                surveyCompletionTimeSeconds: secondsElapsed,
                surveyQualificationStatus: 'Disqualified',
                consentAgreed: true,
                checkQuestionResults,
                answeredPath,
                skippedQuestions,
                proofText: `Survey screener disqualified in ${secondsElapsed} seconds. Reason: ${reason}`
            });

            localStorage.removeItem(draftStorageKey);
            if (timerRef.current) clearInterval(timerRef.current);
            setStage('disqualified');
        } catch (err: any) {
            console.error('Screenout submission error:', err);
            setStage('disqualified');
        }
    };

    const performSubmission = async () => {
        setStage('submitting');
        setErrorMessage(null);

        // Format responses array
        const formattedResponses = questions
            .filter(q => !skippedQuestions.includes(q.id))
            .map(q => ({
                questionId: q.id,
                questionTitle: q.title,
                type: q.type,
                value: responses[q.id] !== undefined ? responses[q.id] : null
            }));

        try {
            await submitUserTaskProof(task._id, {
                userId: currentUserId,
                surveyResponses: formattedResponses,
                surveyCompletionTimeSeconds: secondsElapsed,
                surveyQualificationStatus: qualificationStatus,
                consentAgreed: true,
                checkQuestionResults,
                answeredPath,
                skippedQuestions,
                proofText: `Survey completed in ${secondsElapsed} seconds. (${formattedResponses.length} answered questions)`
            });

            // Clean up saved draft
            localStorage.removeItem(draftStorageKey);

            if (timerRef.current) clearInterval(timerRef.current);
            setStage('success');
        } catch (err: any) {
            setStage('active');
            setErrorMessage(err.message || 'Failed to submit survey responses. Please try again.');
        }
    };

    const formatTimer = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-850 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800 flex justify-between items-center">
                    <div>
                        <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                            Interactive Survey Task
                        </span>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-xs sm:max-w-md">
                            {task.title}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        {stage === 'active' && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full text-xs font-mono font-bold">
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                {formatTimer(secondsElapsed)}
                            </div>
                        )}
                        {stage === 'active' && (
                            <button
                                type="button"
                                onClick={saveAndContinueLater}
                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                                title="Save & Continue Later"
                            >
                                <Bookmark className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    {/* Error Toast */}
                    {errorMessage && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center justify-between">
                            <span>{errorMessage}</span>
                            <button onClick={() => setErrorMessage(null)} className="text-xs font-bold underline">Dismiss</button>
                        </div>
                    )}

                    {/* Resume Draft Banner */}
                    {hasDraftToResume && stage === 'intro' && (
                        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                    You have an unfinished response saved from an earlier session.
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={discardDraft}
                                    className="px-2 py-1 text-gray-400 hover:text-gray-600 font-semibold"
                                >
                                    Discard
                                </button>
                                <Button size="sm" variant="primary" onClick={resumeDraft} className="text-xs py-1">
                                    Resume
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 1. INTRO / CONSENT SCREEN */}
                    {stage === 'intro' && (
                        <div className="space-y-6 text-center py-2">
                            {/* Icon badge */}
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                <ShieldCheck className="w-9 h-9" />
                            </div>

                            {/* Headings */}
                            <div className="space-y-2">
                                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-[11px] font-black uppercase tracking-wider">
                                    Quality Verified Research
                                </span>
                                <h4 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                    {task.title || 'Required Survey Participation'}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
                                    {task.description || 'Please read each question carefully and provide honest responses to earn your task reward.'}
                                </p>
                            </div>

                            {/* Rewards & Details Badge Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                                <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider block">
                                        Reward Credit
                                    </span>
                                    <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                                        {formatCurrency(task.rewardPerTask)}
                                    </div>
                                </div>
                                <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/60 shadow-xs">
                                    <span className="text-[10px] text-blue-800 dark:text-blue-300 font-bold uppercase tracking-wider block">
                                        Estimated Time
                                    </span>
                                    <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 mt-0.5">
                                        ~{estimatedMinutes} Min
                                    </div>
                                </div>
                                <div className="p-3.5 bg-purple-50/80 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800/60 shadow-xs col-span-2 sm:col-span-1">
                                    <span className="text-[10px] text-purple-800 dark:text-purple-300 font-bold uppercase tracking-wider block">
                                        Questions
                                    </span>
                                    <div className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-400 mt-0.5">
                                        {questions.length} Total
                                    </div>
                                </div>
                            </div>

                            {/* Quality Notice */}
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded-xl text-left space-y-1.5 shadow-xs">
                                <span className="font-bold flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    Quality Checkpoints & Attention Verification
                                </span>
                                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-normal">
                                    Responses are verified for attentiveness and logical consistency. Submissions completed with random click patterns or failed consistency checks may be disqualified.
                                </p>
                            </div>

                            {/* Empty questions notice if misconfigured */}
                            {questions.length === 0 && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-left text-xs text-red-700 dark:text-red-300 space-y-1">
                                    <span className="font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                        Configuration Notice
                                    </span>
                                    <p className="leading-relaxed">
                                        This survey currently has no active questions configured. Please contact support or the campaign owner to activate questions.
                                    </p>
                                </div>
                            )}

                            {/* Consent Checkbox Box */}
                            {questions.length > 0 && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-left">
                                    <label className="flex items-start gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={consentAgreed}
                                            onChange={e => setConsentAgreed(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer"
                                        />
                                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                                            I agree to participate in this survey, confirm that my answers will be accurate and honest, and understand that rewards are credited upon quality verification.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* Start / Close Button */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                                {questions.length === 0 ? (
                                    <Button
                                        variant="secondary"
                                        onClick={onClose}
                                        className="w-full sm:w-64 py-3 rounded-xl"
                                    >
                                        Close & Return to Dashboard
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        disabled={!consentAgreed}
                                        onClick={() => setStage('active')}
                                        className="w-full sm:w-64 py-3 rounded-xl shadow-lg font-bold text-xs flex items-center justify-center gap-2"
                                    >
                                        Start Survey Now <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 2. ACTIVE QUESTION SCREEN WITH DEFENSIVE GUARDS */}
                    {stage === 'active' && !currentQ && (
                        <div className="py-12 text-center space-y-4">
                            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-7 h-7" />
                            </div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                {questions.length === 0 ? 'No Survey Questions Available' : 'End of Questions'}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-300 max-w-sm mx-auto leading-relaxed">
                                {questions.length === 0
                                    ? 'This survey does not currently have any active questions configured.'
                                    : 'You have reached the end of the available questions.'}
                            </p>
                            <div className="pt-2 flex justify-center gap-3">
                                {questions.length > 0 && (
                                    <Button size="sm" variant="secondary" onClick={() => setActiveQuestionIndex(0)}>
                                        Review from Start
                                    </Button>
                                )}
                                <Button size="sm" variant="primary" onClick={questions.length > 0 ? handleSubmitSurvey : onClose}>
                                    {questions.length > 0 ? 'Submit Responses' : 'Close Survey'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {stage === 'active' && currentQ && (() => {
                        const safeTitle = typeof currentQ.title === 'string' ? currentQ.title : String(currentQ.title || 'Question');
                        const safeDescription = typeof currentQ.description === 'string' ? currentQ.description : (currentQ.description ? String(currentQ.description) : '');
                        const pipedTitle = pipeAnswersIntoText(safeTitle, responses, questions);
                        const pipedDescription = safeDescription ? pipeAnswersIntoText(safeDescription, responses, questions) : '';
                        const normalizedOptions: NormalizedSurveyOption[] = (currentQ.options || []).map((opt: any, idx: number) =>
                            normalizeSurveyOption(opt, idx)
                        );

                        return (
                            <div className="space-y-5">
                                {/* Progress bar */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 font-medium">
                                        <span>Question {activeIndex + 1} of {questions.length}</span>
                                        <span>{Math.min(100, Math.round(((activeIndex + 1) / questions.length) * 100))}% Complete</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, ((activeIndex + 1) / questions.length) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Check Warning Notification if Retry triggered */}
                                {checkWarning && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <span>{checkWarning}</span>
                                    </div>
                                )}

                                {/* Question Box with Answer Piping */}
                                <div className="p-4 sm:p-5 bg-gray-50/80 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                                    <div>
                                        <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-snug">
                                            {pipedTitle}
                                            {currentQ.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                                        </h4>
                                        {pipedDescription && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                                {pipedDescription}
                                            </p>
                                        )}
                                    </div>

                                    {/* Dynamic Interactive Question Options */}
                                    <div className="pt-2">
                                        {/* Single Choice Radio */}
                                        {currentQ.type === 'single_choice' && (
                                            <div className="space-y-2">
                                                {normalizedOptions.map((optData) => {
                                                    const currentAns = responses[currentQ.id];
                                                    const isSelected = currentAns !== undefined && currentAns !== null && (
                                                        currentAns === optData.value ||
                                                        currentAns === optData.text ||
                                                        currentAns === optData.id
                                                    );
                                                    return (
                                                        <div
                                                            key={optData.id}
                                                            onClick={() => handleAnswer(currentQ.id, optData.value)}
                                                            className={`p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                                                                isSelected
                                                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200'
                                                            }`}
                                                        >
                                                            <span className="leading-snug">{optData.text}</span>
                                                            <div className={`w-4 h-4 rounded-full border shrink-0 ml-3 flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-400 dark:border-gray-500'}`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {currentQ.allowOther && (
                                                    <div className="pt-1.5">
                                                        <div
                                                            onClick={() => handleAnswer(currentQ.id, 'Other')}
                                                            className={`p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                                                                responses[currentQ.id] === 'Other'
                                                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200'
                                                            }`}
                                                        >
                                                            <span>Other (specify below)</span>
                                                            <div className={`w-4 h-4 rounded-full border shrink-0 ml-3 flex items-center justify-center ${responses[currentQ.id] === 'Other' ? 'border-blue-600 bg-blue-600' : 'border-gray-400 dark:border-gray-500'}`}>
                                                                {responses[currentQ.id] === 'Other' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                        </div>
                                                        {responses[currentQ.id] === 'Other' && (
                                                            <input
                                                                type="text"
                                                                value={responses[`${currentQ.id}_other`] || ''}
                                                                onChange={e => handleAnswer(`${currentQ.id}_other`, e.target.value)}
                                                                placeholder={currentQ.otherPlaceholder || 'Please provide details...'}
                                                                className="mt-2 w-full text-xs border rounded-xl p-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Multiple Choice Checkboxes */}
                                        {currentQ.type === 'multiple_choice' && (
                                            <div className="space-y-2">
                                                {normalizedOptions.map((optData) => {
                                                    const currentList: any[] = Array.isArray(responses[currentQ.id]) ? responses[currentQ.id] : [];
                                                    const isChecked = currentList.some(item =>
                                                        item === optData.value || item === optData.text || item === optData.id
                                                    );
                                                    return (
                                                        <div
                                                            key={optData.id}
                                                            onClick={() => {
                                                                const updated = isChecked
                                                                    ? currentList.filter(item =>
                                                                        item !== optData.value && item !== optData.text && item !== optData.id
                                                                    )
                                                                    : [...currentList, optData.value];
                                                                handleAnswer(currentQ.id, updated);
                                                            }}
                                                            className={`p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                                                                isChecked
                                                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200'
                                                            }`}
                                                        >
                                                            <span className="leading-snug">{optData.text}</span>
                                                            <div className={`w-4 h-4 rounded border shrink-0 ml-3 flex items-center justify-center ${isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400 dark:border-gray-500'}`}>
                                                                {isChecked && <Check className="w-3 h-3" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {currentQ.allowOther && (
                                                    <div className="pt-1.5">
                                                        {(() => {
                                                            const currentList: any[] = Array.isArray(responses[currentQ.id]) ? responses[currentQ.id] : [];
                                                            const isChecked = currentList.includes('Other');
                                                            return (
                                                                <>
                                                                    <div
                                                                        onClick={() => {
                                                                            const updated = isChecked
                                                                                ? currentList.filter(item => item !== 'Other')
                                                                                : [...currentList, 'Other'];
                                                                            handleAnswer(currentQ.id, updated);
                                                                        }}
                                                                        className={`p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                                                                            isChecked
                                                                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200'
                                                                        }`}
                                                                    >
                                                                        <span>Other (specify below)</span>
                                                                        <div className={`w-4 h-4 rounded border shrink-0 ml-3 flex items-center justify-center ${isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400 dark:border-gray-500'}`}>
                                                                            {isChecked && <Check className="w-3 h-3" />}
                                                                        </div>
                                                                    </div>
                                                                    {isChecked && (
                                                                        <input
                                                                            type="text"
                                                                            value={responses[`${currentQ.id}_other`] || ''}
                                                                            onChange={e => handleAnswer(`${currentQ.id}_other`, e.target.value)}
                                                                            placeholder={currentQ.otherPlaceholder || 'Please provide details...'}
                                                                            className="mt-2 w-full text-xs border rounded-xl p-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                                                        />
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Dropdown */}
                                        {currentQ.type === 'dropdown' && (
                                            <select
                                                value={responses[currentQ.id] || ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                className="w-full text-xs border rounded-xl p-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            >
                                                <option value="">-- Select an option --</option>
                                                {normalizedOptions.map((optData) => (
                                                    <option key={optData.id} value={optData.value}>
                                                        {optData.text}
                                                    </option>
                                                ))}
                                            </select>
                                        )}

                                        {/* Top N Ranking */}
                                        {currentQ.type === 'top_n' && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                    Select up to {currentQ.validation?.topN || 3} items in order of priority:
                                                </p>
                                                <div className="space-y-2">
                                                    {normalizedOptions.map((optData) => {
                                                        const rankedList: any[] = Array.isArray(responses[currentQ.id]) ? responses[currentQ.id] : [];
                                                        const rankIdx = rankedList.findIndex(item =>
                                                            item === optData.value || item === optData.text || item === optData.id
                                                        );
                                                        const isSelected = rankIdx >= 0;
                                                        const topLimit = currentQ.validation?.topN || 3;

                                                        return (
                                                            <div
                                                                key={optData.id}
                                                                onClick={() => {
                                                                    let updated = [...rankedList];
                                                                    if (isSelected) {
                                                                        updated = updated.filter(item =>
                                                                            item !== optData.value && item !== optData.text && item !== optData.id
                                                                        );
                                                                    } else if (updated.length < topLimit) {
                                                                        updated.push(optData.value);
                                                                    }
                                                                    handleAnswer(currentQ.id, updated);
                                                                }}
                                                                className={`p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                                                                    isSelected
                                                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                                                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200'
                                                                }`}
                                                            >
                                                                <span className="leading-snug">{optData.text}</span>
                                                                {isSelected ? (
                                                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 ml-3">
                                                                        #{rankIdx + 1}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono shrink-0 ml-3">
                                                                        Tap to rank
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Yes / No Binary */}
                                        {currentQ.type === 'yes_no' && (
                                            <div className="grid grid-cols-2 gap-3">
                                                {['Yes', 'No'].map(choice => {
                                                    const isSelected = responses[currentQ.id] === choice;
                                                    return (
                                                        <button
                                                            key={choice}
                                                            type="button"
                                                            onClick={() => handleAnswer(currentQ.id, choice)}
                                                            className={`py-3 px-4 rounded-xl border font-bold text-xs transition flex items-center justify-center gap-2 ${
                                                                isSelected
                                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200'
                                                            }`}
                                                        >
                                                            {choice === 'Yes' ? '👍 Yes' : '👎 No'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Star Rating (1-5) */}
                                        {currentQ.type === 'rating' && (
                                            <div className="flex justify-center items-center gap-2 py-3">
                                                {[1, 2, 3, 4, 5].map(star => {
                                                    const isFilled = Number(responses[currentQ.id] || 0) >= star;
                                                    return (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => handleAnswer(currentQ.id, star)}
                                                            className="p-1.5 transform hover:scale-125 transition"
                                                        >
                                                            <Star
                                                                className={`w-8 h-8 ${
                                                                    isFilled
                                                                        ? 'text-amber-400 fill-amber-400'
                                                                        : 'text-gray-300 dark:text-gray-600'
                                                                }`}
                                                            />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Opinion Scale (0-10) */}
                                        {currentQ.type === 'opinion_scale' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 font-semibold px-1">
                                                    <span>0 - Not likely</span>
                                                    <span>10 - Extremely likely</span>
                                                </div>
                                                <div className="flex flex-wrap justify-between gap-1">
                                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                                                        const isSelected = responses[currentQ.id] === val;
                                                        return (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                onClick={() => handleAnswer(currentQ.id, val)}
                                                                className={`w-9 h-9 rounded-xl border text-xs font-bold transition flex items-center justify-center ${
                                                                    isSelected
                                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200'
                                                                }`}
                                                            >
                                                                {val}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Short Text */}
                                        {currentQ.type === 'short_text' && (
                                            <input
                                                type="text"
                                                value={responses[currentQ.id] || ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                placeholder="Type your response here..."
                                                className="w-full text-xs border rounded-xl p-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            />
                                        )}

                                        {/* Long Text */}
                                        {currentQ.type === 'long_text' && (
                                            <textarea
                                                rows={4}
                                                value={responses[currentQ.id] || ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                placeholder="Type your detailed thoughts, feedback or opinions..."
                                                className="w-full text-xs border rounded-xl p-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            />
                                        )}

                                        {/* Number */}
                                        {currentQ.type === 'number' && (
                                            <input
                                                type="number"
                                                value={responses[currentQ.id] ?? ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                placeholder="Enter number..."
                                                className="w-full text-xs border rounded-xl p-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            />
                                        )}

                                        {/* Fallback for unrecognized types */}
                                        {!['single_choice', 'multiple_choice', 'dropdown', 'top_n', 'yes_no', 'rating', 'opinion_scale', 'short_text', 'long_text', 'number'].includes(currentQ.type) && (
                                            <input
                                                type="text"
                                                value={responses[currentQ.id] || ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                placeholder="Type your response here..."
                                                className="w-full text-xs border rounded-xl p-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Step Navigation Buttons */}
                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        type="button"
                                        disabled={pathHistory.length === 0}
                                        onClick={handlePreviousQuestion}
                                        className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Previous
                                    </button>

                                    <Button
                                        variant="primary"
                                        disabled={!isCurrentQuestionAnswered()}
                                        onClick={handleNextQuestion}
                                        className="rounded-xl px-6 text-xs font-bold"
                                    >
                                        {activeIndex < questions.length - 1 ? (
                                            <>Next Question <ArrowRight className="w-3.5 h-3.5 ml-1" /></>
                                        ) : (
                                            <>Submit Survey <Check className="w-4 h-4 ml-1" /></>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 3. DISQUALIFIED SCREEN */}
                    {stage === 'disqualified' && (
                        <div className="py-8 text-center space-y-4">
                            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-7 h-7" />
                            </div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                Survey Screenout Notice
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                                {disqualificationReason}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Thank you for your participation. If configured by the survey administrator, a screening micro-reward has been credited to your Task Earnings balance.
                            </p>
                            <div className="pt-3">
                                <Button size="sm" variant="secondary" onClick={() => { onCompleted(); onClose(); }}>
                                    Return to Task Dashboard
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 4. SPEED WARNING MODAL */}
                    {stage === 'speed_warning' && (
                        <div className="p-6 text-center space-y-4">
                            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                                <Clock className="w-7 h-7 animate-bounce" />
                            </div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                Speed Verification Warning
                            </h4>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                You completed this {estimatedMinutes}-minute survey in only {secondsElapsed} seconds. To ensure data validity, our anti-speeding engine asks that you review your answers carefully before final submission.
                            </p>
                            <div className="flex justify-center gap-3 pt-2">
                                <Button size="sm" variant="secondary" onClick={() => setStage('active')}>
                                    Review Answers
                                </Button>
                                <Button size="sm" variant="primary" onClick={performSubmission}>
                                    Confirm and Submit Anyway
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 5. SUBMITTING SCREEN */}
                    {stage === 'submitting' && (
                        <div className="py-16 text-center space-y-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                Transmitting and Verifying Responses...
                            </h4>
                            <p className="text-xs text-gray-500">
                                Validating attention checks, consistency checks, and recording completion status.
                            </p>
                        </div>
                    )}

                    {/* 6. SUCCESS SCREEN */}
                    {stage === 'success' && (
                        <div className="py-8 text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                                <Award className="w-9 h-9" />
                            </div>

                            <div className="space-y-1">
                                <h4 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    Survey Completed Successfully!
                                </h4>
                                <p className="text-xs text-gray-500">
                                    Your responses have been verified and recorded.
                                </p>
                            </div>

                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl max-w-sm mx-auto space-y-1">
                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                                    Reward: {formatCurrency(task.rewardPerTask)}
                                </span>
                                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block">
                                    Credited to your Task Earnings balance upon approval!
                                </span>
                            </div>

                            <div className="pt-3">
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        onCompleted();
                                        onClose();
                                    }}
                                    className="px-8 py-2.5 rounded-xl text-xs font-bold"
                                >
                                    Done & Return to Tasks
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SurveyRunnerModal: React.FC<SurveyRunnerModalProps> = (props) => {
    return (
        <SurveyRunnerErrorBoundary onClose={props.onClose}>
            <SurveyRunnerModalInner {...props} />
        </SurveyRunnerErrorBoundary>
    );
};

export default SurveyRunnerModal;
