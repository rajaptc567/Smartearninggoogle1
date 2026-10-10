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
    pipeAnswersIntoText,
    evaluateSurveyFlow,
    evaluateCheckQuestion,
    evaluateAttentionCheck
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
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
                        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                            Survey Question Notice
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
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

    if (task?.status === 'On Hold') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Campaign Paused</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                        This survey campaign is currently paused (&ldquo;On Hold&rdquo;) by the administrator and is not accepting submissions at this time.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold uppercase text-xs tracking-wider rounded-xl hover:opacity-90 transition-all shadow-md"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Handle answer update
    const handleAnswer = (questionId: string, val: any) => {
        setResponses(prev => ({
            ...prev,
            [questionId]: val
        }));
        setCheckWarning(null);
    };

    // Single source of truth logic evaluation via surveyLogicEngine
    const flowResult = evaluateSurveyFlow(
        questions,
        surveyConfig.sections || [],
        responses,
        surveyConfig.globalLogicRules || [],
        checkAttempts
    );

    // Current question
    const activeIndex = Math.max(0, Math.min(activeQuestionIndex, questions.length > 0 ? questions.length - 1 : 0));
    const currentQ: SurveyQuestion | undefined = questions[activeIndex];

    // Ensure active question is always a visible question in active stage
    useEffect(() => {
        if (stage === 'active' && questions.length > 0 && flowResult.visibleQuestions.length > 0) {
            const isVisible = currentQ && flowResult.visibleQuestions.some(vq => vq.id === currentQ.id);
            if (!isVisible) {
                let targetIdx = questions.findIndex((q, idx) => idx >= activeQuestionIndex && flowResult.visibleQuestions.some(vq => vq.id === q.id));
                if (targetIdx === -1) {
                    targetIdx = questions.findIndex(q => flowResult.visibleQuestions.some(vq => vq.id === q.id));
                }
                if (targetIdx !== -1 && targetIdx !== activeQuestionIndex) {
                    setActiveQuestionIndex(targetIdx);
                }
            }
        }
    }, [stage, activeQuestionIndex, currentQ, flowResult.visibleQuestions, questions]);

    // Check if current question is required dynamically
    const isCurrentQuestionRequired = () => {
        if (!currentQ) return false;
        return flowResult.requiredMap[currentQ.id] !== undefined
            ? flowResult.requiredMap[currentQ.id]
            : Boolean(currentQ.required || currentQ.validation?.required);
    };

    // Check if current question is answered
    const isCurrentQuestionAnswered = () => {
        if (!currentQ) return true;
        const req = isCurrentQuestionRequired();
        const ans = responses[currentQ.id];
        const hasAns = ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);
        if (req && !hasAns) return false;
        if (hasAns && Array.isArray(ans)) {
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
        if (isCurrentQuestionRequired() && !isCurrentQuestionAnswered()) {
            setErrorMessage('Please provide an answer to continue.');
            return;
        }

        const ans = responses[currentQ.id];
        const hasAns = ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);

        // 1.5. Validate answer constraints if answered
        if (hasAns) {
            if (currentQ.type === 'top_n' && Array.isArray(ans)) {
                const minN = currentQ.validation?.topN || 1;
                const availableOptsCount = (currentQ.options || []).length;
                const targetCount = Math.min(minN, availableOptsCount);
                if (ans.length < targetCount) {
                    setErrorMessage(`Please rank at least ${targetCount} item(s) to continue.`);
                    return;
                }
            } else if (currentQ.type === 'multiple_choice' && Array.isArray(ans)) {
                if (currentQ.validation?.minSelections && ans.length < currentQ.validation.minSelections) {
                    setErrorMessage(`Please select at least ${currentQ.validation.minSelections} choices.`);
                    return;
                }
                if (currentQ.validation?.maxSelections && ans.length > currentQ.validation.maxSelections) {
                    setErrorMessage(`Please select at most ${currentQ.validation.maxSelections} choices.`);
                    return;
                }
            } else if ((currentQ.type === 'short_text' || currentQ.type === 'long_text') && typeof ans === 'string') {
                if (currentQ.validation?.minLength && ans.trim().length < currentQ.validation.minLength) {
                    setErrorMessage(`Must be at least ${currentQ.validation.minLength} characters.`);
                    return;
                }
            } else if (currentQ.type === 'number') {
                const num = Number(ans);
                if (isNaN(num)) {
                    setErrorMessage('Please enter a valid number.');
                    return;
                }
                if (currentQ.validation?.minValue !== undefined && num < currentQ.validation.minValue) {
                    setErrorMessage(`Value must be at least ${currentQ.validation.minValue}.`);
                    return;
                }
                if (currentQ.validation?.maxValue !== undefined && num > currentQ.validation.maxValue) {
                    setErrorMessage(`Value must be at most ${currentQ.validation.maxValue}.`);
                    return;
                }
            }

            if (ans === 'Other' || (Array.isArray(ans) && ans.includes('Other'))) {
                const otherVal = responses[`${currentQ.id}_other`];
                if (!otherVal || !String(otherVal).trim()) {
                    setErrorMessage('Please specify details for "Other".');
                    return;
                }
            }
        }

        setErrorMessage(null);

        // 2. Check Question Verification at Runtime
        if (currentQ.isCheckQuestion && currentQ.sourceQuestionId) {
            const sourceAns = responses[currentQ.sourceQuestionId];
            const checkAns = responses[currentQ.id];
            const curAttempts = (checkAttempts[currentQ.id] || 0) + 1;
            setCheckAttempts(prev => ({ ...prev, [currentQ.id]: curAttempts }));

            const checkRes = evaluateCheckQuestion(currentQ, sourceAns, checkAns, curAttempts);

            const newCheckRecord = {
                checkQuestionId: currentQ.id,
                checkQuestionTitle: currentQ.title,
                sourceQuestionId: currentQ.sourceQuestionId,
                originalAnswer: sourceAns,
                verificationAnswer: checkAns,
                comparisonMethod: currentQ.checkComparisonMethod || 'case_insensitive',
                result: checkRes.passed ? ('PASS' as const) : ('FAIL' as const),
                failureAction: currentQ.checkFailureAction || 'flag',
                timestamp: new Date()
            };
            setCheckQuestionResults(prev => [...prev.filter(r => r.checkQuestionId !== currentQ.id), newCheckRecord]);

            if (!checkRes.passed) {
                if (checkRes.action === 'retry') {
                    const msg = currentQ.checkRetryMessage || checkRes.message || 'Your answer does not match the information provided earlier. Please verify and try again.';
                    setCheckWarning(msg);
                    return; // Prevent advancing on retry!
                } else if (checkRes.action === 'disqualify' || checkRes.action === 'reject') {
                    const reason = checkRes.message || 'Verification check failed: Inconsistent response detected across verification check questions.';
                    setQualificationStatus('Disqualified');
                    setDisqualificationReason(reason);
                    performScreenoutSubmission(reason);
                    return;
                }
            } else {
                setCheckWarning(null);
            }
        }

        // 2.5. Attention Check Verification
        if (currentQ.isAttentionCheck && currentQ.expectedAnswer) {
            const att = evaluateAttentionCheck(currentQ, responses[currentQ.id]);
            if (!att.passed) {
                const reason = att.message || 'Attention trap verification failed.';
                setQualificationStatus('Disqualified');
                setDisqualificationReason(reason);
                performScreenoutSubmission(reason);
                return;
            }
        }

        // 3. Record question in answered path
        if (hasAns && !answeredPath.includes(currentQ.id)) {
            setAnsweredPath(prev => [...prev, currentQ.id]);
        }

        // 4. Authoritative Flow Evaluation via shared surveyLogicEngine
        const updatedFlow = evaluateSurveyFlow(
            questions,
            surveyConfig.sections || [],
            responses,
            surveyConfig.globalLogicRules || [],
            checkAttempts
        );

        if (updatedFlow.status === 'disqualified') {
            const reason = updatedFlow.disqualificationReason || 'Based on your response, you do not meet the criteria for this survey.';
            setQualificationStatus('Disqualified');
            setDisqualificationReason(reason);
            performScreenoutSubmission(reason);
            return;
        }

        if (updatedFlow.status === 'completed') {
            handleSubmitSurvey();
            return;
        }

        // 5. Determine next visible destination index
        let nextTargetIndex: number | null = null;
        for (let j = activeIndex + 1; j < questions.length; j++) {
            if (updatedFlow.visibleQuestions.some(vq => vq.id === questions[j].id)) {
                nextTargetIndex = j;
                break;
            }
        }

        if (nextTargetIndex === null) {
            // Reached survey completion
            handleSubmitSurvey();
        } else {
            // Push current question index to navigation history stack
            setPathHistory(prev => [...prev, activeIndex]);
            setActiveQuestionIndex(nextTargetIndex);
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
        setErrorMessage(null);
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

        const finalFlow = evaluateSurveyFlow(
            questions,
            surveyConfig.sections || [],
            responses,
            surveyConfig.globalLogicRules || [],
            checkAttempts
        );

        const visibleList = finalFlow.visibleQuestions;
        const visibleIds = new Set(visibleList.map(q => q.id));

        const formattedResponses = visibleList
            .filter(q => responses[q.id] !== undefined)
            .map(q => ({
                questionId: q.id,
                questionTitle: q.title,
                type: q.type,
                value: responses[q.id],
                otherValue: responses[`${q.id}_other`] || undefined
            }));

        const finalSkippedQuestions = questions
            .filter(q => !visibleIds.has(q.id))
            .map(q => q.id);

        const finalAnsweredPath = visibleList
            .filter(q => responses[q.id] !== undefined && responses[q.id] !== null && responses[q.id] !== '')
            .map(q => q.id);

        try {
            await submitUserTaskProof(task._id, {
                userId: currentUserId,
                surveyResponses: formattedResponses,
                surveyCompletionTimeSeconds: secondsElapsed,
                surveyQualificationStatus: 'Disqualified',
                consentAgreed: true,
                checkQuestionResults,
                answeredPath: finalAnsweredPath,
                skippedQuestions: finalSkippedQuestions,
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

        const finalFlow = evaluateSurveyFlow(
            questions,
            surveyConfig.sections || [],
            responses,
            surveyConfig.globalLogicRules || [],
            checkAttempts
        );

        const visibleList = finalFlow.visibleQuestions;
        const visibleIds = new Set(visibleList.map(q => q.id));

        // Format responses array from authoritative visible questions
        const formattedResponses = visibleList.map(q => ({
            questionId: q.id,
            questionTitle: q.title,
            type: q.type,
            value: responses[q.id] !== undefined ? responses[q.id] : null,
            otherValue: responses[`${q.id}_other`] || undefined
        }));

        const finalSkippedQuestions = questions
            .filter(q => !visibleIds.has(q.id))
            .map(q => q.id);

        const finalAnsweredPath = visibleList
            .filter(q => responses[q.id] !== undefined && responses[q.id] !== null && responses[q.id] !== '')
            .map(q => q.id);

        const finalQualificationStatus = finalFlow.status === 'disqualified'
            ? 'Disqualified'
            : (finalFlow.qualificationStatus === 'Qualified' ? 'Qualified' : qualificationStatus);

        try {
            await submitUserTaskProof(task._id, {
                userId: currentUserId,
                surveyResponses: formattedResponses,
                surveyCompletionTimeSeconds: secondsElapsed,
                surveyQualificationStatus: finalQualificationStatus,
                consentAgreed: true,
                checkQuestionResults,
                answeredPath: finalAnsweredPath,
                skippedQuestions: finalSkippedQuestions,
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[88vh]">
                {/* Header */}
                <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                    <div>
                        <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                            Interactive Survey Task
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                            {task.title}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {stage === 'active' && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full text-xs font-mono font-bold shadow-2xs">
                                <Clock className="w-3.5 h-3.5 animate-pulse text-blue-500" />
                                {formatTimer(secondsElapsed)}
                            </div>
                        )}
                        {stage === 'active' && (
                            <button
                                type="button"
                                onClick={saveAndContinueLater}
                                className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Save & Continue Later"
                            >
                                <Bookmark className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Error Toast */}
                    {errorMessage && (
                        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl text-xs flex items-center justify-between shadow-xs">
                            <span className="font-medium">{errorMessage}</span>
                            <button onClick={() => setErrorMessage(null)} className="text-xs font-bold underline ml-2 shrink-0">Dismiss</button>
                        </div>
                    )}

                    {/* Resume Draft Banner */}
                    {hasDraftToResume && stage === 'intro' && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs">
                            <div className="flex items-center gap-2.5">
                                <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    You have an unfinished response saved from an earlier session.
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={discardDraft}
                                    className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold transition-colors"
                                >
                                    Discard
                                </button>
                                <Button size="sm" variant="primary" onClick={resumeDraft} className="text-xs py-1.5 px-4 rounded-xl shadow-xs">
                                    Resume
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 1. INTRO / CONSENT SCREEN */}
                    {stage === 'intro' && (
                        <div className="space-y-6 text-center py-2">
                            {/* Icon badge */}
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                <ShieldCheck className="w-9 h-9" />
                            </div>

                            {/* Headings */}
                            <div className="space-y-2">
                                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 rounded-full text-[11px] font-black uppercase tracking-wider">
                                    Quality Verified Research
                                </span>
                                <h4 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                    {task.title || 'Required Survey Participation'}
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
                                    {task.description || 'Please read each question carefully and provide honest responses to earn your task reward.'}
                                </p>
                            </div>

                            {/* Rewards & Details Badge Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-w-lg mx-auto text-left">
                                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
                                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider block">
                                        Reward Credit
                                    </span>
                                    <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                                        {formatCurrency(task.rewardPerTask)}
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 shadow-xs">
                                    <span className="text-[10px] text-blue-800 dark:text-blue-300 font-bold uppercase tracking-wider block">
                                        Estimated Time
                                    </span>
                                    <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 mt-0.5">
                                        ~{estimatedMinutes} Min
                                    </div>
                                </div>
                                <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs col-span-2 sm:col-span-1">
                                    <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-bold uppercase tracking-wider block">
                                        Questions
                                    </span>
                                    <div className="text-base sm:text-lg font-black text-indigo-700 dark:text-indigo-400 mt-0.5">
                                        {questions.length} Total
                                    </div>
                                </div>
                            </div>

                            {/* Quality Notice */}
                            <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-left space-y-1.5 shadow-xs">
                                <span className="font-bold flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    Quality Checkpoints & Attention Verification
                                </span>
                                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-normal">
                                    Responses are verified for attentiveness and logical consistency. Submissions completed with random click patterns or failed consistency checks may be disqualified.
                                </p>
                            </div>

                            {/* Empty questions notice if misconfigured */}
                            {questions.length === 0 && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-left text-xs text-red-700 dark:text-red-300 space-y-1">
                                    <span className="font-bold flex items-center gap-2">
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
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-left shadow-xs">
                                    <label className="flex items-start gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={consentAgreed}
                                            onChange={e => setConsentAgreed(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-blue-600"
                                        />
                                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
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
                                        className="w-full sm:w-64 py-3.5 rounded-xl font-semibold"
                                    >
                                        Close & Return to Dashboard
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        disabled={!consentAgreed}
                                        onClick={() => setStage('active')}
                                        className="w-full sm:w-64 py-3.5 rounded-xl shadow-lg font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
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
                            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                <AlertTriangle className="w-7 h-7" />
                            </div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                {questions.length === 0 ? 'No Survey Questions Available' : 'End of Questions'}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                                {questions.length === 0
                                    ? 'This survey does not currently have any active questions configured.'
                                    : 'You have reached the end of the available questions.'}
                            </p>
                            <div className="pt-2 flex justify-center gap-3">
                                {questions.length > 0 && (
                                    <Button size="sm" variant="secondary" onClick={() => setActiveQuestionIndex(0)} className="rounded-xl px-4">
                                        Review from Start
                                    </Button>
                                )}
                                <Button size="sm" variant="primary" onClick={questions.length > 0 ? handleSubmitSurvey : onClose} className="rounded-xl px-5">
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

                        const currentVisibleIdx = flowResult.visibleQuestions.findIndex(vq => vq.id === currentQ.id);
                        const totalVisible = flowResult.visibleQuestions.length > 0 ? flowResult.visibleQuestions.length : questions.length;
                        const displayQNum = currentVisibleIdx >= 0 ? currentVisibleIdx + 1 : activeIndex + 1;
                        const progressPct = Math.min(100, Math.round((displayQNum / totalVisible) * 100));
                        const hasNextVisible = questions
                            .slice(activeIndex + 1)
                            .some(q => flowResult.visibleQuestions.some(vq => vq.id === q.id));
                        const currentMessages = flowResult.messages.filter(m => !m.questionId || m.questionId === currentQ.id);

                        return (
                            <div className="space-y-5">
                                {/* Progress bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
                                        <span>Question {displayQNum} of {totalVisible}</span>
                                        <span className="font-mono">{progressPct}% Complete</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                                        <div
                                            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 shadow-2xs"
                                            style={{ width: `${progressPct}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Check Warning Notification if Retry triggered */}
                                {checkWarning && (
                                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-2xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5 shadow-xs">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <span className="font-medium leading-relaxed">{checkWarning}</span>
                                    </div>
                                )}

                                {/* Rule Messages if applicable */}
                                {currentMessages.map((msg, mIdx) => (
                                    <div key={mIdx} className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 shadow-xs ${
                                        msg.type === 'warning'
                                            ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                                            : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                                    }`}>
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span className="font-medium leading-relaxed">{msg.text}</span>
                                    </div>
                                ))}

                                {/* Question Box with Answer Piping */}
                                <div className="p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
                                    <div>
                                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                                            {pipedTitle}
                                            {isCurrentQuestionRequired() && <span className="text-red-500 ml-1 font-bold">*</span>}
                                        </h4>
                                        {pipedDescription && (
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                                                {pipedDescription}
                                            </p>
                                        )}
                                    </div>

                                    {/* Dynamic Interactive Question Options */}
                                    <div className="pt-1">
                                        {/* Single Choice Radio */}
                                        {currentQ.type === 'single_choice' && (
                                            <div className="space-y-2.5">
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
                                                            className={`p-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-between ${
                                                                isSelected
                                                                    ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 text-blue-900 dark:text-blue-200 shadow-sm'
                                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            <span className="leading-snug">{optData.text}</span>
                                                            <div className={`w-4.5 h-4.5 rounded-full border shrink-0 ml-3 flex items-center justify-center transition-colors ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {currentQ.allowOther && (
                                                    <div className="pt-1">
                                                        <div
                                                            onClick={() => handleAnswer(currentQ.id, 'Other')}
                                                            className={`p-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-between ${
                                                                responses[currentQ.id] === 'Other'
                                                                    ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 text-blue-900 dark:text-blue-200 shadow-sm'
                                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            <span>Other (specify below)</span>
                                                            <div className={`w-4.5 h-4.5 rounded-full border shrink-0 ml-3 flex items-center justify-center transition-colors ${responses[currentQ.id] === 'Other' ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                                                                {responses[currentQ.id] === 'Other' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                        </div>
                                                        {responses[currentQ.id] === 'Other' && (
                                                            <input
                                                                type="text"
                                                                value={responses[`${currentQ.id}_other`] || ''}
                                                                onChange={e => handleAnswer(`${currentQ.id}_other`, e.target.value)}
                                                                placeholder={currentQ.otherPlaceholder || 'Please provide details...'}
                                                                className="mt-2.5 w-full text-xs border rounded-xl p-3.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-2xs"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Multiple Choice Checkboxes */}
                                        {currentQ.type === 'multiple_choice' && (
                                            <div className="space-y-2.5">
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
                                                            className={`p-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-between ${
                                                                isChecked
                                                                    ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 text-blue-900 dark:text-blue-200 shadow-sm'
                                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            <span className="leading-snug">{optData.text}</span>
                                                            <div className={`w-4.5 h-4.5 rounded border shrink-0 ml-3 flex items-center justify-center transition-colors ${isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                                                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {currentQ.allowOther && (
                                                    <div className="pt-1">
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
                                                                        className={`p-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-between ${
                                                                            isChecked
                                                                                ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 text-blue-900 dark:text-blue-200 shadow-sm'
                                                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                                                        }`}
                                                                    >
                                                                        <span>Other (specify below)</span>
                                                                        <div className={`w-4.5 h-4.5 rounded border shrink-0 ml-3 flex items-center justify-center transition-colors ${isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                                                                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                                        </div>
                                                                    </div>
                                                                    {isChecked && (
                                                                        <input
                                                                            type="text"
                                                                            value={responses[`${currentQ.id}_other`] || ''}
                                                                            onChange={e => handleAnswer(`${currentQ.id}_other`, e.target.value)}
                                                                            placeholder={currentQ.otherPlaceholder || 'Please provide details...'}
                                                                            className="mt-2.5 w-full text-xs border rounded-xl p-3.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-2xs"
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
                                                className="w-full text-xs border rounded-xl p-3.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs transition-all"
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
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                    Select up to {currentQ.validation?.topN || 3} items in order of priority:
                                                </p>
                                                <div className="space-y-2.5">
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
                                                                className={`p-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center justify-between ${
                                                                    isSelected
                                                                        ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 text-blue-900 dark:text-blue-200 shadow-sm'
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                                                }`}
                                                            >
                                                                <span className="leading-snug">{optData.text}</span>
                                                                {isSelected ? (
                                                                    <span className="w-5.5 h-5.5 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 ml-3 shadow-2xs">
                                                                        #{rankIdx + 1}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0 ml-3">
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
                                            <div className="grid grid-cols-2 gap-3.5">
                                                {['Yes', 'No'].map(choice => {
                                                    const isSelected = responses[currentQ.id] === choice;
                                                    return (
                                                        <button
                                                            key={choice}
                                                            type="button"
                                                            onClick={() => handleAnswer(currentQ.id, choice)}
                                                            className={`py-3.5 px-4 rounded-xl border font-bold text-xs transition-all duration-150 flex items-center justify-center gap-2 shadow-2xs ${
                                                                isSelected
                                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.01]'
                                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
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
                                            <div className="flex justify-center items-center gap-2.5 py-4">
                                                {[1, 2, 3, 4, 5].map(star => {
                                                    const isFilled = Number(responses[currentQ.id] || 0) >= star;
                                                    return (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => handleAnswer(currentQ.id, star)}
                                                            className="p-2 transform hover:scale-125 transition-transform"
                                                        >
                                                            <Star
                                                                className={`w-8 h-8 transition-colors ${
                                                                    isFilled
                                                                        ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                                                                        : 'text-slate-300 dark:text-slate-600'
                                                                }`}
                                                            />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Opinion Scale (0-10) */}
                                        {currentQ.type === 'opinion_scale' && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold px-1">
                                                    <span>0 - Not likely</span>
                                                    <span>10 - Extremely likely</span>
                                                </div>
                                                <div className="flex flex-wrap justify-between gap-1.5">
                                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                                                        const isSelected = responses[currentQ.id] === val;
                                                        return (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                onClick={() => handleAnswer(currentQ.id, val)}
                                                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border text-xs font-bold transition-all duration-150 flex items-center justify-center shadow-2xs ${
                                                                    isSelected
                                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
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
                                                className="w-full text-xs border rounded-xl p-3.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-2xs"
                                            />
                                        )}

                                        {/* Long Text */}
                                        {currentQ.type === 'long_text' && (
                                            <textarea
                                                rows={4}
                                                value={responses[currentQ.id] || ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                placeholder="Type your detailed thoughts, feedback or opinions..."
                                                className="w-full text-xs border rounded-xl p-3.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-2xs"
                                            />
                                        )}

                                        {/* Number */}
                                        {currentQ.type === 'number' && (
                                            <input
                                                type="number"
                                                value={responses[currentQ.id] ?? ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                placeholder="Enter number..."
                                                className="w-full text-xs border rounded-xl p-3.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-2xs"
                                            />
                                        )}

                                        {/* Fallback for unrecognized types */}
                                        {!['single_choice', 'multiple_choice', 'dropdown', 'top_n', 'yes_no', 'rating', 'opinion_scale', 'short_text', 'long_text', 'number'].includes(currentQ.type) && (
                                            <input
                                                type="text"
                                                value={responses[currentQ.id] || ''}
                                                onChange={e => handleAnswer(currentQ.id, e.target.value)}
                                                placeholder="Type your response here..."
                                                className="w-full text-xs border rounded-xl p-3.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-2xs"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Step Navigation Buttons */}
                                <div className="flex justify-between items-center pt-3">
                                    <button
                                        type="button"
                                        disabled={pathHistory.length === 0}
                                        onClick={handlePreviousQuestion}
                                        className="px-4.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Previous
                                    </button>

                                    <Button
                                        variant="primary"
                                        disabled={!isCurrentQuestionAnswered()}
                                        onClick={handleNextQuestion}
                                        className="rounded-xl px-6 py-2.5 text-xs font-bold shadow-md transition-transform active:scale-[0.98]"
                                    >
                                        {hasNextVisible ? (
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
                            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Survey Screenout Notice
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                                {disqualificationReason}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Thank you for your participation. If configured by the survey administrator, a screening micro-reward has been credited to your Task Earnings balance.
                            </p>
                            <div className="pt-3">
                                <Button size="sm" variant="secondary" onClick={() => { onCompleted(); onClose(); }} className="rounded-xl px-6 font-semibold">
                                    Return to Task Dashboard
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 4. SPEED WARNING MODAL */}
                    {stage === 'speed_warning' && (
                        <div className="p-4 text-center space-y-4">
                            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                <Clock className="w-8 h-8 animate-bounce text-amber-600 dark:text-amber-400" />
                            </div>
                            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Speed Verification Warning
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                                You completed this {estimatedMinutes}-minute survey in only {secondsElapsed} seconds. To ensure data validity, our anti-speeding engine asks that you review your answers carefully before final submission.
                            </p>
                            <div className="flex justify-center gap-3 pt-2">
                                <Button size="sm" variant="secondary" onClick={() => setStage('active')} className="rounded-xl px-4">
                                    Review Answers
                                </Button>
                                <Button size="sm" variant="primary" onClick={performSubmission} className="rounded-xl px-5 shadow-sm">
                                    Confirm and Submit Anyway
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 5. SUBMITTING SCREEN */}
                    {stage === 'submitting' && (
                        <div className="py-16 text-center space-y-3.5">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                Transmitting and Verifying Responses...
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Validating attention checks, consistency checks, and recording completion status.
                            </p>
                        </div>
                    )}

                    {/* 6. SUCCESS SCREEN */}
                    {stage === 'success' && (
                        <div className="py-8 text-center space-y-5">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm animate-bounce">
                                <Award className="w-9 h-9" />
                            </div>

                            <div className="space-y-1.5">
                                <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">
                                    Survey Completed Successfully!
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Your responses have been verified and recorded.
                                </p>
                            </div>

                            <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl max-w-sm mx-auto space-y-1 shadow-xs">
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
                                    className="px-8 py-3 rounded-xl text-xs font-bold shadow-md transition-transform active:scale-[0.98]"
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
