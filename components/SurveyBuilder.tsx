import React, { useState, useEffect, useMemo, useRef } from 'react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import {
    Plus,
    Trash2,
    MoveUp,
    MoveDown,
    Eye,
    Edit3,
    AlertTriangle,
    HelpCircle,
    CheckCircle2,
    Sparkles,
    Star,
    Layers,
    Copy,
    GitBranch,
    ShieldCheck,
    CheckSquare,
    Play,
    RotateCcw,
    FolderPlus,
    Clock,
    Save,
    Check,
    X,
    ArrowRight,
    ArrowDown,
    AlertCircle,
    Workflow,
    BookOpen
} from 'lucide-react';
import {
    SurveyQuestion,
    SurveyConfigData,
    SurveyLogicRule,
    SurveyLogicCondition,
    SurveySection,
    validateSurveyLogic,
    verifyCheckQuestion,
    evaluateRule,
    pipeAnswersIntoText
} from '../lib/surveyLogicEngine';
import { SMARTEXN_SURVEY_TEMPLATES } from '../lib/surveyTemplates';
import { SurveyHelpModal } from './surveys/SurveyHelpModal';
import { SurveyPreview } from './surveys/SurveyPreview';

export type { SurveyQuestion, SurveyConfigData, SurveyLogicRule, SurveyLogicCondition, SurveySection };

interface SurveyBuilderProps {
    value: SurveyConfigData;
    onChange: (updated: SurveyConfigData) => void;
    systemTemplates?: any[];
    systemQuestionBank?: any[];
    campaignId?: string;
}

export const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
    value,
    onChange,
    systemTemplates = [],
    systemQuestionBank = [],
    campaignId = 'default'
}) => {
    // Primary Tab Mode
    const [activeTab, setActiveTab] = useState<'editor' | 'flow' | 'validator' | 'simulator' | 'preview'>('editor');
    
    // Modal states
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [editingLogicForQId, setEditingLogicForQId] = useState<string | null>(null);
    const [editingSectionModal, setEditingSectionModal] = useState(false);

    // Autosave state
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [hasDraft, setHasDraft] = useState(false);
    const draftKey = `survey_draft_${campaignId}`;

    // Test Simulator State
    const [simulatorResponses, setSimulatorResponses] = useState<Record<string, any>>({});
    const [simulatorActiveQIndex, setSimulatorActiveQIndex] = useState(0);
    const [simulatorLog, setSimulatorLog] = useState<string[]>([]);
    const [simulatorDisqualified, setSimulatorDisqualified] = useState(false);
    const [simulatorCompleted, setSimulatorCompleted] = useState(false);

    // Dismiss check question recommendation
    const [dismissedRecommendation, setDismissedRecommendation] = useState(false);

    // Check for draft in localStorage on mount
    useEffect(() => {
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const parsed = JSON.parse(savedDraft);
                if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                    setHasDraft(true);
                }
            }
        } catch (e) {
            console.error('Failed reading draft', e);
        }
    }, [draftKey]);

    // Autosave whenever value changes
    useEffect(() => {
        setSaveStatus('saving');
        const timer = setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify(value));
                setSaveStatus('saved');
            } catch (e) {
                console.error('Failed to autosave survey draft', e);
                setSaveStatus('unsaved');
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [value, draftKey]);

    const recoverDraft = () => {
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const parsed = JSON.parse(savedDraft);
                onChange(parsed);
                setHasDraft(false);
            }
        } catch (e) {
            console.error('Error recovering draft', e);
        }
    };

    const clearDraft = () => {
        localStorage.removeItem(draftKey);
        setHasDraft(false);
    };

    // Calculate dynamic estimated minutes based on questions and question types
    const calculateEstimatedMinutes = (questions: SurveyQuestion[]): number => {
        let totalSeconds = 0;
        for (const q of questions) {
            if (q.secondsLimit && q.secondsLimit > 0) {
                totalSeconds += q.secondsLimit;
            } else {
                switch (q.type) {
                    case 'single_choice':
                    case 'yes_no':
                        totalSeconds += 15;
                        break;
                    case 'multiple_choice':
                    case 'dropdown':
                        totalSeconds += 20;
                        break;
                    case 'rating':
                    case 'opinion_scale':
                        totalSeconds += 12;
                        break;
                    case 'number':
                    case 'short_text':
                        totalSeconds += 25;
                        break;
                    case 'long_text':
                        totalSeconds += 60;
                        break;
                    default:
                        totalSeconds += 30;
                }
            }
        }
        return Math.max(1, Math.ceil(totalSeconds / 60));
    };

    const updateQuestions = (newQuestions: SurveyQuestion[]) => {
        const estMinutes = calculateEstimatedMinutes(newQuestions);
        onChange({
            ...value,
            questions: newQuestions,
            estimatedTimeMinutes: estMinutes
        });
    };

    const addQuestion = (type: SurveyQuestion['type'] = 'single_choice') => {
        const newQ: SurveyQuestion = {
            id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type,
            title: '',
            required: true,
            options: ['Option 1', 'Option 2', 'Option 3'],
            isAttentionCheck: false,
            expectedAnswer: '',
            isCheckQuestion: false,
            checkComparisonMethod: 'case_insensitive',
            checkFailureAction: 'flag',
            maxCheckAttempts: 2,
            logicRules: []
        };
        updateQuestions([...value.questions, newQ]);
    };

    const duplicateQuestion = (index: number) => {
        const source = value.questions[index];
        const copy: SurveyQuestion = {
            ...JSON.parse(JSON.stringify(source)),
            id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            title: `${source.title} (Copy)`
        };
        const updated = [...value.questions];
        updated.splice(index + 1, 0, copy);
        updateQuestions(updated);
    };

    const removeQuestion = (index: number) => {
        if (value.questions.length <= 1) {
            alert('A survey campaign must contain at least one question.');
            return;
        }
        const removedId = value.questions[index].id;
        // Clean up any logic rules or check questions referring to this question
        const filtered = value.questions
            .filter((_, i) => i !== index)
            .map(q => {
                let updated = { ...q };
                if (updated.sourceQuestionId === removedId) {
                    updated.sourceQuestionId = undefined;
                    updated.isCheckQuestion = false;
                }
                if (updated.logicRules && updated.logicRules.length > 0) {
                    updated.logicRules = updated.logicRules.filter(
                        r => r.targetQuestionId !== removedId && r.conditions.every(c => c.questionId !== removedId)
                    );
                }
                return updated;
            });
        updateQuestions(filtered);
    };

    const moveQuestion = (index: number, direction: 'up' | 'down') => {
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= value.questions.length) return;
        const copy = [...value.questions];
        const temp = copy[index];
        copy[index] = copy[target];
        copy[target] = temp;
        updateQuestions(copy);
    };

    const updateQuestionField = (index: number, field: keyof SurveyQuestion, val: any) => {
        const copy = [...value.questions];
        copy[index] = { ...copy[index], [field]: val };
        updateQuestions(copy);
    };

    // Add recommended Check Question linking to an earlier question
    const addRecommendedCheckQuestion = () => {
        if (value.questions.length === 0) return;
        const firstChoiceQ = value.questions.find(q => !q.isCheckQuestion && !q.isAttentionCheck) || value.questions[0];
        const newCheckQ: SurveyQuestion = {
            id: `q_check_${Date.now()}`,
            type: firstChoiceQ.type === 'single_choice' || firstChoiceQ.type === 'dropdown' ? firstChoiceQ.type : 'short_text',
            title: `To verify response consistency, please re-confirm your answer to: "${firstChoiceQ.title || 'Question 1'}"`,
            description: 'Please answer accurately as previously stated to pass quality verification.',
            required: true,
            options: firstChoiceQ.options ? [...firstChoiceQ.options] : undefined,
            isCheckQuestion: true,
            sourceQuestionId: firstChoiceQ.id,
            checkComparisonMethod: firstChoiceQ.type === 'number' ? 'numeric' : 'case_insensitive',
            checkFailureAction: 'retry',
            maxCheckAttempts: 2,
            checkRetryMessage: 'Your answer does not match the answer provided earlier. Please verify and try again.',
            logicRules: []
        };
        updateQuestions([...value.questions, newCheckQ]);
        setDismissedRecommendation(true);
    };

    // Sections management
    const sections: SurveySection[] = value.sections || [];
    const addSection = (title: string = 'New Section') => {
        const newSec: SurveySection = {
            id: `sec_${Date.now()}`,
            title,
            description: 'Section description or instructions'
        };
        onChange({
            ...value,
            sections: [...sections, newSec]
        });
    };

    const removeSection = (secId: string) => {
        const updatedSecs = sections.filter(s => s.id !== secId);
        // Unset sectionId on any questions belonging to this section
        const updatedQs = value.questions.map(q => q.sectionId === secId ? { ...q, sectionId: undefined } : q);
        onChange({
            ...value,
            sections: updatedSecs,
            questions: updatedQs
        });
    };

    // Validation Report
    const validationResult = useMemo(() => {
        return validateSurveyLogic(value.questions, value.sections || []);
    }, [value.questions, value.sections]);

    // Check Question Recommendation Flag
    const showCheckRecommendation = useMemo(() => {
        if (dismissedRecommendation) return false;
        if (value.questions.length < 10) return false;
        const checkQCount = value.questions.filter(q => q.isCheckQuestion).length;
        return checkQCount === 0;
    }, [value.questions, dismissedRecommendation]);

    // Simulator Runner Logic
    const startSimulator = () => {
        setSimulatorResponses({});
        setSimulatorActiveQIndex(0);
        setSimulatorLog([`Started test simulator with ${value.questions.length} questions.`]);
        setSimulatorDisqualified(false);
        setSimulatorCompleted(false);
    };

    const handleSimulatorAnswer = (qId: string, answer: any) => {
        const updated = { ...simulatorResponses, [qId]: answer };
        setSimulatorResponses(updated);
        setSimulatorLog(prev => [...prev, `Answered Question ${simulatorActiveQIndex + 1}: "${answer}"`]);
    };

    const handleSimulatorNext = () => {
        const currentQ = value.questions[simulatorActiveQIndex];
        if (!currentQ) return;

        // Check if question has rules
        let nextIndex = simulatorActiveQIndex + 1;
        let triggeredAction = '';

        if (currentQ.logicRules && currentQ.logicRules.length > 0) {
            for (const rule of currentQ.logicRules) {
                const evalResult = evaluateRule(rule, simulatorResponses);
                if (evalResult.action) {
                    triggeredAction = evalResult.action;
                    setSimulatorLog(prev => [
                        ...prev,
                        `Triggered Rule [${evalResult.action}] (matched: ${evalResult.matched})`
                    ]);

                    if (evalResult.action === 'goto_question' && evalResult.targetQuestionId) {
                        const targetIdx = value.questions.findIndex(q => q.id === evalResult.targetQuestionId);
                        if (targetIdx !== -1) {
                            nextIndex = targetIdx;
                            setSimulatorLog(prev => [...prev, `Jumped to Question ${targetIdx + 1}`]);
                            break;
                        }
                    } else if (evalResult.action === 'end_survey') {
                        setSimulatorCompleted(true);
                        setSimulatorLog(prev => [...prev, `Survey completed early via rule.`]);
                        return;
                    } else if (evalResult.action === 'disqualify') {
                        setSimulatorDisqualified(true);
                        setSimulatorLog(prev => [...prev, `Participant disqualified via survey logic rule!`]);
                        return;
                    }
                }
            }
        }

        // Check question verification check
        if (currentQ.isCheckQuestion && currentQ.sourceQuestionId) {
            const sourceAns = simulatorResponses[currentQ.sourceQuestionId];
            const checkAns = simulatorResponses[currentQ.id];
            const checkRes = verifyCheckQuestion(sourceAns, checkAns, currentQ.checkComparisonMethod);
            if (checkRes.passed) {
                setSimulatorLog(prev => [...prev, `Check Question PASSED! Matches source answer.`]);
            } else {
                setSimulatorLog(prev => [
                    ...prev,
                    `Check Question FAILED! (Method: ${currentQ.checkComparisonMethod}, Action: ${currentQ.checkFailureAction})`
                ]);
                if (currentQ.checkFailureAction === 'disqualify') {
                    setSimulatorDisqualified(true);
                    return;
                }
            }
        }

        if (nextIndex >= value.questions.length) {
            setSimulatorCompleted(true);
            setSimulatorLog(prev => [...prev, `Survey flow reached END successfully!`]);
        } else {
            setSimulatorActiveQIndex(nextIndex);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3.5 sm:p-5 space-y-3.5 sm:space-y-5 max-w-full overflow-hidden">
            {/* Header controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-gray-200 dark:border-gray-700 pb-3 sm:pb-4">
                <div className="min-w-0 w-full lg:w-auto">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <span className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg shrink-0">
                            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                            Interactive Survey & Logic Builder
                        </h3>
                        <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                            saveStatus === 'saved'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200'
                        }`}>
                            <Save className="w-3 h-3" />
                            {saveStatus === 'saved' ? 'Autosaved' : 'Saving...'}
                        </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                        Questions: <span className="font-bold text-gray-800 dark:text-gray-200">{value.questions.length}</span> • Estimated Duration: <span className="font-bold text-blue-600">{value.estimatedTimeMinutes} mins</span>
                        {sections.length > 0 && <span> • Sections: <span className="font-bold text-amber-500">{sections.length}</span></span>}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto justify-end">
                    {/* Utility actions (Draft recovery, Templates, Question Bank, How to Build Help) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                        {hasDraft && (
                            <button
                                type="button"
                                onClick={recoverDraft}
                                className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1"
                                title="Recover unsaved local draft"
                            >
                                <RotateCcw className="w-3 h-3" /> Recover
                            </button>
                        )}
                        {(systemTemplates.length > 0 || SMARTEXN_SURVEY_TEMPLATES.length > 0) && (
                            <button
                                type="button"
                                onClick={() => setShowTemplateModal(true)}
                                className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg flex items-center gap-1 border border-amber-500/30"
                            >
                                <Sparkles className="w-3.5 h-3.5" /> Template
                            </button>
                        )}
                        {systemQuestionBank.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowBankModal(true)}
                                className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
                            >
                                <HelpCircle className="w-3.5 h-3.5" /> Bank
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowHelpModal(true)}
                            className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-1 border border-emerald-500/30 transition"
                            title="How to Build a Survey Guide & Reference"
                        >
                            <BookOpen className="w-3.5 h-3.5" /> How to Build?
                        </button>
                    </div>

                    {/* Navigation Tabs - Responsive Scroll Container */}
                    <div className="w-full sm:w-auto max-w-full overflow-x-auto custom-scrollbar py-0.5 overscroll-x-contain">
                        <div className="inline-flex min-w-max sm:min-w-0 bg-gray-100 dark:bg-gray-700/80 p-1 rounded-xl text-xs font-semibold gap-0.5 sm:gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('editor')}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap font-bold ${
                                    activeTab === 'editor' 
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/60 dark:border-gray-600' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <Edit3 className="w-3.5 h-3.5 shrink-0" /> <span>Editor</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('flow')}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap font-bold ${
                                    activeTab === 'flow' 
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/60 dark:border-gray-600' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <Workflow className="w-3.5 h-3.5 shrink-0" /> <span>Flow Map</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('validator')}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap font-bold ${
                                    activeTab === 'validator' 
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/60 dark:border-gray-600' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> <span>Validation</span>
                                {!validationResult.valid && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-0.5 shrink-0 animate-pulse" />
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('simulator');
                                    startSimulator();
                                }}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap font-bold ${
                                    activeTab === 'simulator' 
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/60 dark:border-gray-600' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <Play className="w-3.5 h-3.5 shrink-0" /> <span>Test Flow</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('preview')}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap font-bold ${
                                    activeTab === 'preview' 
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/60 dark:border-gray-600' 
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <Eye className="w-3.5 h-3.5 shrink-0" /> <span>Preview</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Check Question Frequency Recommendation Banner */}
            {showCheckRecommendation && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                        <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="font-bold text-gray-900 dark:text-white block text-sm">
                                Recommended Verification Check Interval Reached
                            </span>
                            <p className="text-gray-600 dark:text-gray-300 mt-0.5">
                                Your survey contains {value.questions.length} questions. Adding a consistency Check Question automatically verifies that respondents are reading carefully and protects against spam.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => setDismissedRecommendation(true)}
                            className="px-3 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-semibold"
                        >
                            Dismiss
                        </button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={addRecommendedCheckQuestion}
                            className="rounded-lg text-xs"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Check Question
                        </Button>
                    </div>
                </div>
            )}

            {/* TAB 1: FLOW MAP VIEW */}
            {activeTab === 'flow' && (
                <div className="p-6 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-6">
                    <div className="flex justify-between items-center pb-2 border-b dark:border-gray-700">
                        <div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                <Workflow className="w-4 h-4 text-blue-600" /> Interactive Survey Branching Map
                            </h4>
                            <p className="text-xs text-gray-500">
                                Visual representation of respondent navigation pathways and conditional branching forks.
                            </p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setActiveTab('editor')}>
                            Return to Editor
                        </Button>
                    </div>

                    <div className="space-y-3 max-w-xl mx-auto">
                        {/* START NODE */}
                        <div className="p-3 bg-emerald-600 text-white font-bold rounded-xl text-center text-xs shadow-sm flex items-center justify-center gap-2">
                            <span>🚀 START: Participant Begins Survey</span>
                        </div>
                        <div className="flex justify-center text-gray-400">
                            <ArrowDown className="w-5 h-5 animate-pulse" />
                        </div>

                        {/* QUESTIONS FLOW NODES */}
                        {value.questions.map((q, idx) => {
                            const hasRules = q.logicRules && q.logicRules.length > 0;
                            return (
                                <div key={q.id} className="space-y-2">
                                    <div className={`p-4 rounded-xl border shadow-sm space-y-2 ${
                                        q.isCheckQuestion
                                            ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/20'
                                            : q.isAttentionCheck
                                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/20'
                                            : 'border-slate-800 bg-slate-950/60 text-slate-200'
                                    }`}>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                                                    Q{idx + 1}
                                                </span>
                                                <span className="font-bold text-gray-900 dark:text-white truncate max-w-xs">
                                                    {q.title || 'Untitled Question'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-gray-400">
                                                {q.type}
                                            </span>
                                        </div>

                                        {/* Question tags */}
                                        <div className="flex gap-2 text-[10px]">
                                            {q.isCheckQuestion && (
                                                <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 font-bold flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3" /> Check Question (Source: Q{value.questions.findIndex(sq => sq.id === q.sourceQuestionId) + 1})
                                                </span>
                                            )}
                                            {q.isAttentionCheck && (
                                                <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Attention Trap
                                                </span>
                                            )}
                                        </div>

                                        {/* Branch Rules Rendering */}
                                        {hasRules && (
                                            <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-xs space-y-1 mt-1">
                                                <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide flex items-center gap-1">
                                                    <GitBranch className="w-3 h-3" /> Conditional Branch Paths:
                                                </span>
                                                {q.logicRules!.map((r, ri) => (
                                                    <div key={r.id || ri} className="text-[11px] text-gray-700 dark:text-gray-300 flex items-center gap-1 font-mono">
                                                        <span>➔ IF ({r.conditions.map(c => `${c.operator} "${c.value}"`).join(' & ')})</span>
                                                        <span className="font-bold text-blue-600">
                                                            {r.action === 'goto_question' ? `GOTO Q${value.questions.findIndex(tq => tq.id === r.targetQuestionId) + 1}` : r.action}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {idx < value.questions.length - 1 && (
                                        <div className="flex justify-center text-gray-400">
                                            <ArrowDown className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div className="flex justify-center text-gray-400">
                            <ArrowDown className="w-5 h-5 animate-pulse" />
                        </div>
                        {/* END NODE */}
                        <div className="p-3 bg-blue-600 text-white font-bold rounded-xl text-center text-xs shadow-sm">
                            🏁 FINISH: Submission Verified & Reward Credited
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: LOGIC VALIDATOR */}
            {activeTab === 'validator' && (
                <div className="p-5 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-5">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
                        <div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-blue-600" /> Survey Logic & Flow Audit
                            </h4>
                            <p className="text-xs text-gray-500">
                                Automatic detection of circular loops, unreachable questions, deleted references, and broken targets.
                            </p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setActiveTab('editor')}>
                            Return to Editor
                        </Button>
                    </div>

                    {validationResult.valid ? (
                        <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-2">
                            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                            <h5 className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                                All Survey Logic & Branching Pathways are Valid!
                            </h5>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
                                No infinite loops, unreachable nodes, or broken target questions detected. The survey is ready for campaign launch.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl space-y-3 text-xs">
                            <div className="flex items-center gap-2 text-red-800 dark:text-red-200 font-bold">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span>Found {validationResult.errors.length} Branching Error(s) to Resolve:</span>
                            </div>
                            <ul className="list-disc pl-5 space-y-1.5 text-red-700 dark:text-red-300">
                                {validationResult.errors.map((err, i) => (
                                    <li key={i} className="font-semibold">{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validationResult.warnings.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                <span>Quality Warnings ({validationResult.warnings.length}):</span>
                            </div>
                            <ul className="list-disc pl-5 space-y-1 text-amber-700 dark:text-amber-300">
                                {validationResult.warnings.map((warn, i) => (
                                    <li key={i}>{warn}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: TEST SIMULATOR */}
            {activeTab === 'simulator' && (
                <div className="p-6 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-5">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
                        <div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                <Play className="w-4 h-4 text-emerald-600" /> Interactive Flow Simulator
                            </h4>
                            <p className="text-xs text-gray-500">
                                Test branching paths, check questions, and disqualification logic before publishing.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={startSimulator}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Test
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setActiveTab('editor')}>
                                Return to Editor
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Simulation Screen */}
                        <div className="md:col-span-2 p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                            {simulatorDisqualified ? (
                                <div className="py-8 text-center space-y-3">
                                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                                        <X className="w-6 h-6" />
                                    </div>
                                    <h5 className="font-bold text-base text-red-600">Respondent Disqualified</h5>
                                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                        The respondent failed a critical screening rule or attention trap and was disqualified according to your logic settings.
                                    </p>
                                    <Button size="sm" variant="primary" onClick={startSimulator}>
                                        Restart Test
                                    </Button>
                                </div>
                            ) : simulatorCompleted ? (
                                <div className="py-8 text-center space-y-3">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                        <Check className="w-6 h-6" />
                                    </div>
                                    <h5 className="font-bold text-base text-emerald-600">Survey Completed Successfully!</h5>
                                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                        Participant reached the end of the survey path with all rules validated.
                                    </p>
                                    <Button size="sm" variant="primary" onClick={startSimulator}>
                                        Test Another Path
                                    </Button>
                                </div>
                            ) : value.questions[simulatorActiveQIndex] ? (
                                (() => {
                                    const currentQ = value.questions[simulatorActiveQIndex];
                                    const currentVal = simulatorResponses[currentQ.id];
                                    const pipedTitle = pipeAnswersIntoText(currentQ.title, simulatorResponses, value.questions);

                                    return (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-xs text-gray-500">
                                                <span>Question {simulatorActiveQIndex + 1} of {value.questions.length}</span>
                                                <span className="font-bold text-blue-600">{currentQ.type}</span>
                                            </div>

                                            <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl space-y-1">
                                                <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {pipedTitle}
                                                </h5>
                                                {currentQ.description && (
                                                    <p className="text-xs text-gray-500">{currentQ.description}</p>
                                                )}
                                            </div>

                                            {/* Options renderer */}
                                            <div className="space-y-2">
                                                {['single_choice', 'dropdown'].includes(currentQ.type) && (
                                                    <div className="space-y-1.5">
                                                        {(currentQ.options || []).map((opt, oi) => {
                                                            const optVal = typeof opt === 'string' ? opt : opt.value || opt.text || '';
                                                            const optText = typeof opt === 'string' ? opt : opt.text || opt.value || '';
                                                            return (
                                                                <div
                                                                    key={oi}
                                                                    onClick={() => handleSimulatorAnswer(currentQ.id, optVal)}
                                                                    className={`p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                                                                        currentVal === optVal
                                                                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                                                                    }`}
                                                                >
                                                                    {optText}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {currentQ.type === 'multiple_choice' && (
                                                    <div className="space-y-1.5">
                                                        {(() => {
                                                            const selectedList: string[] = Array.isArray(currentVal) ? currentVal : [];
                                                            const opts = (currentQ.options || []).map(o => typeof o === 'string' ? o : o.value || o.text || '');
                                                            if (currentQ.allowOther && !opts.includes('Other')) {
                                                                opts.push('Other');
                                                            }

                                                            return opts.map((optText, oi) => {
                                                                const isChecked = selectedList.includes(optText);
                                                                return (
                                                                    <label
                                                                        key={oi}
                                                                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                                                                            isChecked
                                                                                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                                                                        }`}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => {
                                                                                if (isChecked) {
                                                                                    handleSimulatorAnswer(currentQ.id, selectedList.filter(item => item !== optText));
                                                                                } else {
                                                                                    if (currentQ.validation?.maxSelections && selectedList.length >= currentQ.validation.maxSelections) {
                                                                                        return;
                                                                                    }
                                                                                    handleSimulatorAnswer(currentQ.id, [...selectedList, optText]);
                                                                                }
                                                                            }}
                                                                            className="rounded text-blue-600 focus:ring-0"
                                                                        />
                                                                        <span>{optText}</span>
                                                                    </label>
                                                                );
                                                            });
                                                        })()}
                                                        {(currentQ.validation?.minSelections || currentQ.validation?.maxSelections) && (
                                                            <p className="text-[11px] text-gray-500 font-medium">
                                                                {currentQ.validation.minSelections ? `Min: ${currentQ.validation.minSelections} choices` : ''}
                                                                {currentQ.validation.minSelections && currentQ.validation.maxSelections ? ' • ' : ''}
                                                                {currentQ.validation.maxSelections ? `Max: ${currentQ.validation.maxSelections} choices` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {currentQ.type === 'top_n' && (
                                                    <div className="space-y-1.5">
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                                            Click items to rank top {currentQ.validation?.topN || 3}:
                                                        </p>
                                                        {(() => {
                                                            const topNLimit = currentQ.validation?.topN || 3;
                                                            const selectedList: string[] = Array.isArray(currentVal) ? currentVal : [];
                                                            const opts = (currentQ.options || []).map(o => typeof o === 'string' ? o : o.value || o.text || '');

                                                            return opts.map((optText, oi) => {
                                                                const rankIdx = selectedList.indexOf(optText);
                                                                const isRanked = rankIdx >= 0;

                                                                return (
                                                                    <div
                                                                        key={oi}
                                                                        onClick={() => {
                                                                            if (isRanked) {
                                                                                handleSimulatorAnswer(currentQ.id, selectedList.filter(item => item !== optText));
                                                                            } else {
                                                                                if (selectedList.length >= topNLimit) {
                                                                                    return;
                                                                                }
                                                                                handleSimulatorAnswer(currentQ.id, [...selectedList, optText]);
                                                                            }
                                                                        }}
                                                                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                                                                            isRanked
                                                                                ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                                                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                                                                        }`}
                                                                    >
                                                                        <span>{optText}</span>
                                                                        {isRanked ? (
                                                                            <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] flex items-center justify-center">
                                                                                #{rankIdx + 1}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-gray-400 uppercase font-mono">
                                                                                Tap to rank
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                )}

                                                {currentQ.type === 'yes_no' && (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {['Yes', 'No'].map(choice => (
                                                            <button
                                                                key={choice}
                                                                type="button"
                                                                onClick={() => handleSimulatorAnswer(currentQ.id, choice)}
                                                                className={`py-2.5 rounded-lg border text-xs font-bold ${
                                                                    currentVal === choice
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'border-gray-200 dark:border-gray-700'
                                                                }`}
                                                            >
                                                                {choice === 'Yes' ? '👍 Yes' : '👎 No'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {currentQ.type === 'rating' && (
                                                    <div className="flex gap-2 justify-center py-2">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => handleSimulatorAnswer(currentQ.id, star)}
                                                                className="p-1 text-amber-400"
                                                            >
                                                                <Star className={`w-6 h-6 ${(currentVal || 0) >= star ? 'fill-amber-400' : 'text-gray-300'}`} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {currentQ.type === 'opinion_scale' && (
                                                    <div className="space-y-2 pt-1">
                                                        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                                                            {Array.from({ length: 11 }).map((_, scaleVal) => {
                                                                const isSelected = currentVal !== undefined && currentVal !== '' && Number(currentVal) === scaleVal;
                                                                return (
                                                                    <button
                                                                        key={scaleVal}
                                                                        type="button"
                                                                        onClick={() => handleSimulatorAnswer(currentQ.id, scaleVal)}
                                                                        className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                                                                            isSelected
                                                                                ? 'bg-blue-600 text-white border-blue-600 shadow font-black'
                                                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                                        }`}
                                                                    >
                                                                        {scaleVal}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 font-semibold px-0.5">
                                                            <span>0 - Not at all likely</span>
                                                            <span>10 - Extremely likely</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {currentQ.type === 'number' && (
                                                    <div className="space-y-1">
                                                        <input
                                                            type="number"
                                                            value={currentVal !== undefined && currentVal !== null ? currentVal : ''}
                                                            min={currentQ.validation?.minValue}
                                                            max={currentQ.validation?.maxValue}
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                                                handleSimulatorAnswer(currentQ.id, val);
                                                            }}
                                                            placeholder="Enter numeric value..."
                                                            className="w-full text-xs border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
                                                        />
                                                        {(currentQ.validation?.minValue !== undefined || currentQ.validation?.maxValue !== undefined) && (
                                                            <div className="text-[10px] text-gray-500 font-mono">
                                                                Allowed range: {currentQ.validation.minValue !== undefined ? currentQ.validation.minValue : '-∞'} to {currentQ.validation.maxValue !== undefined ? currentQ.validation.maxValue : '+∞'}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {['short_text', 'long_text'].includes(currentQ.type) && (
                                                    <input
                                                        type="text"
                                                        value={currentVal || ''}
                                                        onChange={e => handleSimulatorAnswer(currentQ.id, e.target.value)}
                                                        placeholder="Type answer to test..."
                                                        className="w-full text-xs border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                    />
                                                )}
                                            </div>

                                            <div className="pt-3 border-t flex justify-end">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={currentVal === undefined || currentVal === '' || (Array.isArray(currentVal) && currentVal.length === 0)}
                                                    onClick={handleSimulatorNext}
                                                    className="rounded-lg text-xs"
                                                >
                                                    Next Question <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : null}
                        </div>

                        {/* Simulator Execution Log */}
                        <div className="p-4 bg-gray-900 text-gray-200 rounded-2xl font-mono text-[11px] space-y-2 max-h-96 overflow-y-auto border border-gray-800 shadow-inner">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block border-b border-gray-800 pb-1">
                                Execution Trace Log:
                            </span>
                            {simulatorLog.map((log, li) => (
                                <div key={li} className="text-gray-300">
                                    <span className="text-blue-400">[{li + 1}]</span> {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: PREVIEW MODE */}
            {activeTab === 'preview' && (
                <div className="py-2 max-w-4xl mx-auto">
                    <SurveyPreview config={value as any} />
                </div>
            )}

            {/* TAB 0: PRIMARY QUESTION EDITOR */}
            {activeTab === 'editor' && (
                <div className="space-y-5">
                    {/* Section Management Ribbon */}
                    <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-300">Survey Sections:</span>
                            {sections.length === 0 ? (
                                <span className="text-slate-500">Single Linear Survey (No Sections)</span>
                            ) : (
                                <div className="flex gap-1.5 flex-wrap">
                                    {sections.map((s, si) => (
                                        <span key={s.id} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded font-bold flex items-center gap-1">
                                            {si + 1}. {s.title}
                                            <button
                                                type="button"
                                                onClick={() => removeSection(s.id)}
                                                className="hover:text-red-500 font-bold ml-1"
                                                title="Delete Section"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => addSection(`Section ${sections.length + 1}`)}
                            className="text-xs font-semibold text-amber-500 hover:text-amber-400 flex items-center gap-1"
                        >
                            <FolderPlus className="w-3.5 h-3.5" /> + Add Section
                        </button>
                    </div>

                    {/* Question List */}
                    <div className="space-y-4">
                        {value.questions.map((q, idx) => (
                            <div
                                key={q.id}
                                className={`p-4 rounded-xl border transition-all ${
                                    q.isCheckQuestion
                                        ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/20 dark:bg-indigo-950/20'
                                        : q.isAttentionCheck
                                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20'
                                        : 'border-slate-800 bg-slate-950/60 text-slate-200'
                                }`}
                            >
                                {/* Question Top Row */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                                            {idx + 1}
                                        </span>

                                        <select
                                            value={q.type}
                                            onChange={e => updateQuestionField(idx, 'type', e.target.value)}
                                            className="text-xs font-semibold border rounded-lg px-2.5 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            <option value="single_choice">🔘 Single Choice (Radio)</option>
                                            <option value="multiple_choice">☑️ Multiple Choice (Checkboxes)</option>
                                            <option value="yes_no">⚖️ Yes / No</option>
                                            <option value="rating">⭐ Rating (1-5 Stars)</option>
                                            <option value="opinion_scale">🔟 Opinion Scale (0-10 NPS)</option>
                                            <option value="short_text">✏️ Short Text</option>
                                            <option value="long_text">📝 Long Text / Feedback</option>
                                            <option value="dropdown">🔽 Dropdown Selection</option>
                                            <option value="number">🔢 Number</option>
                                            <option value="top_n">🔢 Top-N / Ranking</option>
                                        </select>

                                        {/* Section tag */}
                                        {sections.length > 0 && (
                                            <select
                                                value={q.sectionId || ''}
                                                onChange={e => updateQuestionField(idx, 'sectionId', e.target.value || undefined)}
                                                className="text-xs border rounded-lg px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-amber-500 dark:text-amber-400 font-semibold"
                                            >
                                                <option value="">-- No Section --</option>
                                                {sections.map(s => (
                                                    <option key={s.id} value={s.id}>{s.title}</option>
                                                ))}
                                            </select>
                                        )}

                                        {q.isCheckQuestion && (
                                            <span className="text-[10px] uppercase font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded flex items-center gap-1">
                                                <ShieldCheck className="w-3 h-3" /> Consistency Check
                                            </span>
                                        )}

                                        {q.isAttentionCheck && (
                                            <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" /> Attention Trap
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons: Duplicate, Up, Down, Delete */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => duplicateQuestion(idx)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition"
                                            title="Duplicate Question"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => moveQuestion(idx, 'up')}
                                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                            title="Move Up"
                                        >
                                            <MoveUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === value.questions.length - 1}
                                            onClick={() => moveQuestion(idx, 'down')}
                                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                            title="Move Down"
                                        >
                                            <MoveDown className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeQuestion(idx)}
                                            className="p-1 text-red-500 hover:text-red-700 ml-2"
                                            title="Delete Question"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Question Title and Description */}
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Enter your question prompt here (e.g. How often do you buy online?)"
                                        value={q.title}
                                        onChange={e => updateQuestionField(idx, 'title', e.target.value)}
                                        className="w-full text-sm font-semibold border rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />

                                    <input
                                        type="text"
                                        placeholder="Optional description, instruction, or piping token like {{q1}}..."
                                        value={q.description || ''}
                                        onChange={e => updateQuestionField(idx, 'description', e.target.value)}
                                        className="w-full text-xs border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-gray-600"
                                    />
                                </div>

                                {/* Options for Choices and Dropdown */}
                                {['single_choice', 'multiple_choice', 'dropdown', 'top_n'].includes(q.type) && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                                                Answer Options:
                                            </span>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={q.allowOther || false}
                                                    onChange={e => updateQuestionField(idx, 'allowOther', e.target.checked)}
                                                    className="rounded text-amber-500"
                                                />
                                                <span className="font-semibold text-gray-600 dark:text-gray-400">Include "Other (specify)" option</span>
                                            </label>
                                        </div>
                                        {(q.options || []).map((opt, oi) => (
                                            <div key={oi} className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 w-4">{oi + 1}.</span>
                                                <input
                                                    type="text"
                                                    value={typeof opt === 'string' ? opt : opt.text || opt.value || ''}
                                                    onChange={e => {
                                                        const updatedOpts = [...(q.options || [])];
                                                        updatedOpts[oi] = e.target.value;
                                                        updateQuestionField(idx, 'options', updatedOpts);
                                                    }}
                                                    className="flex-1 text-xs border rounded-lg p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const updatedOpts = (q.options || []).filter((_, i) => i !== oi);
                                                        updateQuestionField(idx, 'options', updatedOpts);
                                                    }}
                                                    className="text-gray-400 hover:text-red-500 text-xs px-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updatedOpts = [...(q.options || []), `Option ${(q.options || []).length + 1}`];
                                                updateQuestionField(idx, 'options', updatedOpts);
                                            }}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 pt-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Another Option
                                        </button>
                                    </div>
                                )}

                                {/* Number Configuration */}
                                {q.type === 'number' && (
                                    <div className="mt-3 p-3 bg-gray-50/80 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-wrap items-center gap-4 text-xs">
                                        <span className="font-bold text-gray-700 dark:text-gray-300">Numeric Bounds:</span>
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-gray-600 dark:text-gray-400">Min Value:</label>
                                            <input
                                                type="number"
                                                placeholder="No min"
                                                value={q.validation?.minValue ?? ''}
                                                onChange={e => {
                                                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                                                    updateQuestionField(idx, 'validation', { ...(q.validation || {}), minValue: val });
                                                }}
                                                className="w-24 border rounded p-1 dark:bg-gray-800 dark:text-white font-mono"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-gray-600 dark:text-gray-400">Max Value:</label>
                                            <input
                                                type="number"
                                                placeholder="No max"
                                                value={q.validation?.maxValue ?? ''}
                                                onChange={e => {
                                                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                                                    updateQuestionField(idx, 'validation', { ...(q.validation || {}), maxValue: val });
                                                }}
                                                className="w-24 border rounded p-1 dark:bg-gray-800 dark:text-white font-mono"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Opinion Scale Configuration */}
                                {q.type === 'opinion_scale' && (
                                    <div className="mt-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                                        <span>Standard Net Promoter Score (NPS) Scale: <strong>0 (Not at all likely)</strong> to <strong>10 (Extremely likely)</strong></span>
                                        <span className="text-[10px] font-mono font-bold bg-amber-200/50 dark:bg-amber-900/50 px-2 py-0.5 rounded">11 Buttons (0-10)</span>
                                    </div>
                                )}

                                {/* Rating Configuration */}
                                {q.type === 'rating' && (
                                    <div className="mt-3 p-3 bg-gray-50/80 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center gap-3 text-xs">
                                        <label className="font-semibold text-gray-700 dark:text-gray-300">Max Stars:</label>
                                        <select
                                            value={q.maxRating || 5}
                                            onChange={e => updateQuestionField(idx, 'maxRating', parseInt(e.target.value) || 5)}
                                            className="border rounded p-1 dark:bg-gray-800 dark:text-white font-semibold"
                                        >
                                            <option value={5}>5 Stars (Default)</option>
                                            <option value={7}>7 Stars</option>
                                            <option value={10}>10 Stars</option>
                                        </select>
                                    </div>
                                )}

                                {/* Check Question Configuration Panel */}
                                {q.isCheckQuestion && (
                                    <div className="mt-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-3 text-xs">
                                        <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-800 pb-2">
                                            <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                                Consistency Check Question Settings
                                            </span>
                                            <span className="text-[10px] text-indigo-600 font-semibold">
                                                Automated Verification
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* Source Question */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Source Question to Verify Against:
                                                </label>
                                                <select
                                                    value={q.sourceQuestionId || ''}
                                                    onChange={e => updateQuestionField(idx, 'sourceQuestionId', e.target.value)}
                                                    className="w-full border rounded-lg p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs font-semibold"
                                                >
                                                    <option value="">-- Choose Preceding Question --</option>
                                                    {value.questions
                                                        .filter((sq, sqIdx) => sqIdx < idx && sq.id !== q.id)
                                                        .map((sq, sqIdx) => (
                                                            <option key={sq.id} value={sq.id}>
                                                                Q{sqIdx + 1}: {sq.title.slice(0, 40) || 'Untitled'}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>

                                            {/* Comparison Mode */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Comparison Mode:
                                                </label>
                                                <select
                                                    value={q.checkComparisonMethod || 'case_insensitive'}
                                                    onChange={e => updateQuestionField(idx, 'checkComparisonMethod', e.target.value)}
                                                    className="w-full border rounded-lg p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                                >
                                                    <option value="case_insensitive">Case Insensitive (Default)</option>
                                                    <option value="exact">Exact Match (Strict)</option>
                                                    <option value="trim_spaces">Trim Extra Spaces</option>
                                                    <option value="normalized">Normalized (Ignore Accents/Punctuation)</option>
                                                    <option value="numeric">Numeric (e.g. 25 == 25.0)</option>
                                                    <option value="date">Date Normalization (e.g. 04 May 1999 == 1999-05-04)</option>
                                                </select>
                                            </div>

                                            {/* Failure Action */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Failure Action:
                                                </label>
                                                <select
                                                    value={q.checkFailureAction || 'flag'}
                                                    onChange={e => updateQuestionField(idx, 'checkFailureAction', e.target.value)}
                                                    className="w-full border rounded-lg p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                                >
                                                    <option value="retry">Retry (Allow respondent to verify answer)</option>
                                                    <option value="flag">Flag (Mark submission with quality flag)</option>
                                                    <option value="review">Review (Require manual approval)</option>
                                                    <option value="disqualify">Disqualify (Screen out participant)</option>
                                                    <option value="reject">Reject (Auto-reject submission)</option>
                                                </select>
                                            </div>

                                            {/* Max Attempts */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Maximum Attempts allowed:
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="5"
                                                    value={q.maxCheckAttempts || 2}
                                                    onChange={e => updateQuestionField(idx, 'maxCheckAttempts', parseInt(e.target.value) || 2)}
                                                    className="w-full border rounded-lg p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Non-revealing Retry Warning Message:
                                            </label>
                                            <input
                                                type="text"
                                                value={q.checkRetryMessage || ''}
                                                onChange={e => updateQuestionField(idx, 'checkRetryMessage', e.target.value)}
                                                placeholder="e.g. Your answer does not match the information provided earlier. Please verify and try again."
                                                className="w-full border rounded-lg p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Attention Check Configuration Panel */}
                                {q.isAttentionCheck && (
                                    <div className="mt-2 p-3 bg-amber-100/70 dark:bg-amber-900/30 rounded-xl text-xs space-y-1.5 border border-amber-200 dark:border-amber-800">
                                        <label className="font-bold text-amber-900 dark:text-amber-200 block">
                                            Expected Correct Answer for Attention Trap:
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Strongly Agree or the exact trap option"
                                            value={q.expectedAnswer || ''}
                                            onChange={e => updateQuestionField(idx, 'expectedAnswer', e.target.value)}
                                            className="w-full border border-amber-300 dark:border-amber-700 rounded p-1.5 dark:bg-gray-800 dark:text-white text-xs font-semibold"
                                        />
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                            Participants who select any answer other than this will be flagged or rejected for bot-like behavior.
                                        </p>
                                    </div>
                                )}

                                {/* Logic Rules Panel for this Question */}
                                {q.logicRules && q.logicRules.length > 0 && (
                                    <div className="mt-3 p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2.5 text-xs">
                                        <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                            <GitBranch className="w-3.5 h-3.5 text-blue-600" />
                                            Conditional Branch Rules ({q.logicRules.length})
                                        </span>

                                        <div className="space-y-2.5">
                                            {q.logicRules.map((rule, rIdx) => {
                                                const condQId = rule.conditions?.[0]?.questionId || q.id;
                                                const sourceQ = value.questions.find(sq => sq.id === condQId) || q;
                                                const operator = rule.conditions?.[0]?.operator || 'equals';
                                                const condVal = rule.conditions?.[0]?.value !== undefined ? rule.conditions[0].value : '';

                                                const isChoiceType = ['single_choice', 'multiple_choice', 'dropdown', 'top_n'].includes(sourceQ.type);
                                                const sourceOptions: string[] = (sourceQ.options || []).map(o => (typeof o === 'string' ? o : o.text || o.value || ''));
                                                if (sourceQ.allowOther && !sourceOptions.includes('Other')) {
                                                    sourceOptions.push('Other');
                                                }

                                                return (
                                                    <div key={rule.id || rIdx} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5 shadow-sm">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-[11px] text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                                                Rule {rIdx + 1}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = (q.logicRules || []).filter((_, i) => i !== rIdx);
                                                                    updateQuestionField(idx, 'logicRules', updated);
                                                                }}
                                                                className="text-red-500 hover:text-red-700 text-xs font-semibold"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>

                                                        {/* Condition Row */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-blue-600">IF Question</span>
                                                            <select
                                                                value={condQId}
                                                                onChange={e => {
                                                                    const newQId = e.target.value;
                                                                    const copyRules = [...(q.logicRules || [])];
                                                                    if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                        copyRules[rIdx].conditions = [{ questionId: newQId, operator: 'equals', value: '' }];
                                                                    } else {
                                                                        copyRules[rIdx].conditions[0].questionId = newQId;
                                                                        copyRules[rIdx].conditions[0].value = '';
                                                                    }
                                                                    updateQuestionField(idx, 'logicRules', copyRules);
                                                                }}
                                                                className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white font-medium text-xs max-w-[190px]"
                                                            >
                                                                {value.questions.map((itemQ, itemIdx) => (
                                                                    <option key={itemQ.id} value={itemQ.id}>
                                                                        {itemQ.id === q.id ? `Current (Q${idx + 1})` : `Q${itemIdx + 1}: ${itemQ.title ? itemQ.title.slice(0, 20) : 'Untitled'}`}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            <select
                                                                value={operator}
                                                                onChange={e => {
                                                                    const copyRules = [...(q.logicRules || [])];
                                                                    if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                        copyRules[rIdx].conditions = [{ questionId: condQId, operator: e.target.value as any, value: '' }];
                                                                    } else {
                                                                        copyRules[rIdx].conditions[0].operator = e.target.value as any;
                                                                    }
                                                                    updateQuestionField(idx, 'logicRules', copyRules);
                                                                }}
                                                                className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white text-xs"
                                                            >
                                                                <option value="equals">Equals</option>
                                                                <option value="not_equals">Does Not Equal</option>
                                                                <option value="contains">Contains</option>
                                                                <option value="not_contains">Does Not Contain</option>
                                                                <option value="greater_than">Greater Than (&gt;)</option>
                                                                <option value="less_than">Less Than (&lt;)</option>
                                                                <option value="answered">Is Answered</option>
                                                            </select>

                                                            {operator === 'answered' ? (
                                                                <span className="text-[11px] text-gray-500 italic bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                                    (Any answer)
                                                                </span>
                                                            ) : isChoiceType ? (
                                                                <select
                                                                    value={condVal}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                            copyRules[rIdx].conditions = [{ questionId: condQId, operator: operator, value: e.target.value }];
                                                                        } else {
                                                                            copyRules[rIdx].conditions[0].value = e.target.value;
                                                                        }
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white max-w-[170px] text-xs font-semibold"
                                                                >
                                                                    <option value="">-- Choose Option --</option>
                                                                    {sourceOptions.map((optVal, optI) => (
                                                                        <option key={optI} value={optVal}>
                                                                            {optVal}
                                                                        </option>
                                                                    ))}
                                                                    {condVal && !sourceOptions.includes(condVal) && (
                                                                        <option value={condVal}>{condVal} (Custom)</option>
                                                                    )}
                                                                </select>
                                                            ) : sourceQ.type === 'yes_no' ? (
                                                                <select
                                                                    value={condVal}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                            copyRules[rIdx].conditions = [{ questionId: condQId, operator: operator, value: e.target.value }];
                                                                        } else {
                                                                            copyRules[rIdx].conditions[0].value = e.target.value;
                                                                        }
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white text-xs font-semibold"
                                                                >
                                                                    <option value="">-- Select Yes / No --</option>
                                                                    <option value="Yes">Yes</option>
                                                                    <option value="No">No</option>
                                                                </select>
                                                            ) : sourceQ.type === 'rating' ? (
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max={sourceQ.maxRating || 5}
                                                                    step="1"
                                                                    placeholder="Rating (1-5)"
                                                                    value={condVal}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                            copyRules[rIdx].conditions = [{ questionId: condQId, operator: operator, value: e.target.value }];
                                                                        } else {
                                                                            copyRules[rIdx].conditions[0].value = e.target.value;
                                                                        }
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white w-24 text-xs font-mono"
                                                                />
                                                            ) : sourceQ.type === 'opinion_scale' ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="10"
                                                                    step="1"
                                                                    placeholder="Scale (0-10)"
                                                                    value={condVal}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                            copyRules[rIdx].conditions = [{ questionId: condQId, operator: operator, value: e.target.value }];
                                                                        } else {
                                                                            copyRules[rIdx].conditions[0].value = e.target.value;
                                                                        }
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white w-24 text-xs font-mono"
                                                                />
                                                            ) : sourceQ.type === 'number' ? (
                                                                <input
                                                                    type="number"
                                                                    min={sourceQ.validation?.minValue}
                                                                    max={sourceQ.validation?.maxValue}
                                                                    placeholder="Number..."
                                                                    value={condVal}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                            copyRules[rIdx].conditions = [{ questionId: condQId, operator: operator, value: e.target.value }];
                                                                        } else {
                                                                            copyRules[rIdx].conditions[0].value = e.target.value;
                                                                        }
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white w-28 text-xs font-mono"
                                                                />
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Value..."
                                                                    value={condVal}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        if (!copyRules[rIdx].conditions || !copyRules[rIdx].conditions[0]) {
                                                                            copyRules[rIdx].conditions = [{ questionId: condQId, operator: operator, value: e.target.value }];
                                                                        } else {
                                                                            copyRules[rIdx].conditions[0].value = e.target.value;
                                                                        }
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white w-28 text-xs"
                                                                />
                                                            )}

                                                            <span className="font-bold text-amber-500">THEN</span>
                                                            <select
                                                                value={rule.action}
                                                                onChange={e => {
                                                                    const copyRules = [...(q.logicRules || [])];
                                                                    copyRules[rIdx].action = e.target.value as any;
                                                                    updateQuestionField(idx, 'logicRules', copyRules);
                                                                }}
                                                                className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white font-semibold text-xs"
                                                            >
                                                                <option value="goto_question">Jump to Question</option>
                                                                <option value="skip_question">Skip Next Question</option>
                                                                <option value="end_survey">End Survey Early</option>
                                                                <option value="disqualify">Disqualify Respondent</option>
                                                                <option value="goto_section">Jump to Section</option>
                                                            </select>

                                                            {rule.action === 'goto_question' && (
                                                                <select
                                                                    value={rule.targetQuestionId || ''}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        copyRules[rIdx].targetQuestionId = e.target.value;
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white text-xs"
                                                                >
                                                                    <option value="">-- Target Question --</option>
                                                                    {value.questions
                                                                        .filter(tq => tq.id !== q.id)
                                                                        .map((tq, ti) => (
                                                                            <option key={tq.id} value={tq.id}>
                                                                                Q{ti + 1}: {tq.title ? tq.title.slice(0, 30) : 'Untitled'}
                                                                            </option>
                                                                        ))}
                                                                </select>
                                                            )}

                                                            {rule.action === 'goto_section' && (
                                                                <select
                                                                    value={rule.targetSectionId || ''}
                                                                    onChange={e => {
                                                                        const copyRules = [...(q.logicRules || [])];
                                                                        copyRules[rIdx].targetSectionId = e.target.value;
                                                                        updateQuestionField(idx, 'logicRules', copyRules);
                                                                    }}
                                                                    className="border rounded-lg p-1.5 dark:bg-gray-700 dark:text-white text-xs"
                                                                >
                                                                    <option value="">-- Target Section --</option>
                                                                    {sections.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.title}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Bottom Toggles and Logic Button */}
                                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={q.required}
                                                onChange={e => updateQuestionField(idx, 'required', e.target.checked)}
                                                className="rounded text-blue-600"
                                            />
                                            <span className="font-semibold text-gray-700 dark:text-gray-300">Required</span>
                                        </label>

                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={q.isCheckQuestion || false}
                                                onChange={e => {
                                                    const isChecked = e.target.checked;
                                                    const copy = [...value.questions];
                                                    copy[idx].isCheckQuestion = isChecked;
                                                    if (isChecked && !copy[idx].sourceQuestionId) {
                                                        const firstEarlier = value.questions.slice(0, idx)[0];
                                                        copy[idx].sourceQuestionId = firstEarlier ? firstEarlier.id : undefined;
                                                    }
                                                    updateQuestions(copy);
                                                }}
                                                className="rounded text-indigo-600"
                                            />
                                            <span className="font-semibold text-indigo-800 dark:text-indigo-300">
                                                Verification Check Question
                                            </span>
                                        </label>

                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={q.isAttentionCheck || false}
                                                onChange={e => updateQuestionField(idx, 'isAttentionCheck', e.target.checked)}
                                                className="rounded text-amber-600"
                                            />
                                            <span className="font-semibold text-amber-800 dark:text-amber-400">
                                                Attention Trap
                                            </span>
                                        </label>
                                    </div>

                                    {/* Add Logic Rule Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newRule: SurveyLogicRule = {
                                                id: `rule_${Date.now()}`,
                                                matchType: 'ALL',
                                                conditions: [
                                                    { questionId: q.id, operator: 'equals', value: '' }
                                                ],
                                                action: 'goto_question'
                                            };
                                            const updated = [...(q.logicRules || []), newRule];
                                            updateQuestionField(idx, 'logicRules', updated);
                                        }}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800"
                                    >
                                        <GitBranch className="w-3.5 h-3.5" /> + Branch Logic Rule
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Next Question CTA */}
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => addQuestion('single_choice')}
                            className="w-full py-3.5 border-2 border-dashed border-blue-300 dark:border-blue-800 hover:border-blue-500 rounded-xl font-bold text-xs text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 transition hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                        >
                            <Plus className="w-4 h-4" /> Add Next Question
                        </button>
                    </div>
                </div>
            )}

            {/* Template Selection Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" /> Choose Survey Template
                            </h4>
                            <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-3">
                            {(systemTemplates && systemTemplates.length > 0 ? systemTemplates : SMARTEXN_SURVEY_TEMPLATES).map((tmpl: any, i: number) => (
                                <div
                                    key={tmpl.id || i}
                                    onClick={() => {
                                        if (!tmpl.questions || tmpl.questions.length === 0) return;
                                        onChange({
                                            ...value,
                                            category: tmpl.category || value.category,
                                            description: tmpl.description || value.description,
                                            estimatedTimeMinutes: tmpl.estimatedTimeMinutes || calculateEstimatedMinutes(tmpl.questions),
                                            questions: JSON.parse(JSON.stringify(tmpl.questions)),
                                            approvalMode: tmpl.approvalMode || value.approvalMode
                                        });
                                        setShowTemplateModal(false);
                                    }}
                                    className="p-3.5 border border-gray-200 dark:border-slate-800 rounded-xl hover:border-amber-500 hover:bg-amber-500/10 cursor-pointer transition"
                                >
                                    <div className="flex justify-between items-start">
                                        <h5 className="font-bold text-xs text-gray-900 dark:text-white">{tmpl.title || tmpl.name}</h5>
                                        <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                            {tmpl.questions?.length || 0} questions
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-1">{tmpl.description || tmpl.category}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Question Bank Modal */}
            {showBankModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-indigo-600" /> Insert from Question Bank
                            </h4>
                            <button onClick={() => setShowBankModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-2.5">
                            {systemQuestionBank.map((qb: any, qi: number) => (
                                <div
                                    key={qb.id || qi}
                                    onClick={() => {
                                        const newQ: SurveyQuestion = {
                                            id: `q_${Date.now()}_${qi}`,
                                            type: qb.type || 'single_choice',
                                            title: qb.title,
                                            required: true,
                                            options: qb.options ? [...qb.options] : ['Strongly Agree', 'Agree', 'Disagree'],
                                            isAttentionCheck: Boolean(qb.isAttentionCheck),
                                            expectedAnswer: qb.expectedAnswer || '',
                                            isCheckQuestion: Boolean(qb.isCheckQuestion),
                                            logicRules: []
                                        };
                                        updateQuestions([...value.questions, newQ]);
                                        setShowBankModal(false);
                                    }}
                                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 cursor-pointer transition text-xs"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-gray-900 dark:text-white">{qb.title}</span>
                                        <span className="text-[10px] text-blue-600 font-bold">{qb.type}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1">Category: {qb.category || 'General'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Help & Documentation Modal */}
            <SurveyHelpModal
                isOpen={showHelpModal}
                onClose={() => setShowHelpModal(false)}
            />
        </div>
    );
};
