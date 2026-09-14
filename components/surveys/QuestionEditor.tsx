import React from 'react';
import { SurveyQuestion, SurveyOption, SurveyCondition } from '../../types';
import {
    Trash2,
    Plus,
    CheckCircle2,
    HelpCircle,
    Sliders,
    GitBranch,
    Shield,
    Star,
    X,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

interface QuestionEditorProps {
    question: SurveyQuestion;
    allQuestions: SurveyQuestion[];
    questionIndex: number;
    onChange: (updated: SurveyQuestion) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
}

const QUESTION_TYPES = [
    { value: 'single_choice', label: 'Single Choice (Radio)', icon: '🔘' },
    { value: 'multiple_choice', label: 'Multiple Choice (Checkboxes)', icon: '☑️' },
    { value: 'top_n', label: 'Top-N Selection / Ranking', icon: '🏆' },
    { value: 'short_text', label: 'Short Text Response', icon: '✍️' },
    { value: 'long_text', label: 'Long Text / Feedback', icon: '📝' },
    { value: 'dropdown', label: 'Dropdown Selection', icon: '🔽' },
    { value: 'yes_no', label: 'Yes / No Binary Choice', icon: '⚖️' },
    { value: 'rating', label: 'Rating Scale (Stars)', icon: '⭐' }
];

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
    question,
    allQuestions,
    questionIndex,
    onChange,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown
}) => {
    const rawOptions = question.options || [];
    const normalizedOptions: SurveyOption[] = rawOptions.map((opt, idx) => {
        if (typeof opt === 'string') {
            return { id: `opt_${idx}`, text: opt, value: opt, isOther: opt.toLowerCase().includes('other') };
        }
        return opt;
    });

    const isChoiceType = ['single_choice', 'multiple_choice', 'top_n', 'dropdown'].includes(question.type);
    const previousQuestions = allQuestions.slice(0, questionIndex);

    // Option manipulation
    const handleAddOption = () => {
        const newOpt: SurveyOption = {
            id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            text: `Option ${normalizedOptions.length + 1}`,
            value: `Option ${normalizedOptions.length + 1}`
        };
        onChange({
            ...question,
            options: [...normalizedOptions, newOpt]
        });
    };

    const handleOptionChange = (idx: number, text: string) => {
        const updated = [...normalizedOptions];
        updated[idx] = { ...updated[idx], text, value: text };
        onChange({ ...question, options: updated });
    };

    const handleRemoveOption = (idx: number) => {
        const updated = normalizedOptions.filter((_, i) => i !== idx);
        onChange({ ...question, options: updated });
    };

    const handleToggleOther = () => {
        const nextAllowOther = !question.allowOther;
        onChange({
            ...question,
            allowOther: nextAllowOther,
            otherPlaceholder: nextAllowOther ? (question.otherPlaceholder || 'Please specify...') : undefined
        });
    };

    // Conditional ShowIf Logic
    const currentCondition: SurveyCondition = (Array.isArray(question.showIf) ? question.showIf[0] : question.showIf) || {
        questionId: '',
        operator: 'equals',
        value: ''
    };

    const hasConditionalLogic = Boolean(currentCondition.questionId);

    const handleToggleConditional = () => {
        if (hasConditionalLogic) {
            onChange({ ...question, showIf: undefined });
        } else if (previousQuestions.length > 0) {
            onChange({
                ...question,
                showIf: {
                    questionId: previousQuestions[0].id,
                    operator: 'equals',
                    value: 'Other'
                }
            });
        }
    };

    return (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-5 transition-all hover:border-slate-700 shadow-md">
            {/* Header / Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                        Q{questionIndex + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {QUESTION_TYPES.find(t => t.value === question.type)?.label || question.type}
                    </span>
                    {question.required && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Required
                        </span>
                    )}
                    {hasConditionalLogic && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                            <GitBranch className="w-3 h-3" /> Conditional
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={!canMoveUp}
                        title="Move Up"
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                        <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={!canMoveDown}
                        title="Move Down"
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                        <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onDuplicate}
                        title="Duplicate Question"
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-semibold"
                    >
                        Duplicate
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        title="Delete Question"
                        className="p-1.5 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 hover:bg-red-900/40 text-xs"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Core Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Type Selection */}
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Question Type
                    </label>
                    <select
                        value={question.type}
                        onChange={(e) => {
                            const newType = e.target.value;
                            const defaultOpts = (newType === 'yes_no')
                                ? [{ id: 'yes', text: 'Yes', value: 'Yes' }, { id: 'no', text: 'No', value: 'No' }]
                                : normalizedOptions.length > 0 ? normalizedOptions : [
                                    { id: 'opt_1', text: 'Option 1', value: 'Option 1' },
                                    { id: 'opt_2', text: 'Option 2', value: 'Option 2' }
                                ];
                            onChange({
                                ...question,
                                type: newType,
                                options: defaultOpts,
                                validation: newType === 'top_n' ? { ...(question.validation || {}), topN: 3 } : question.validation
                            });
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                        {QUESTION_TYPES.map(t => (
                            <option key={t.value} value={t.value}>
                                {t.icon} {t.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Required Toggle */}
                <div className="flex items-center justify-between md:justify-start gap-4 md:pt-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) => onChange({ ...question, required: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/20"
                        />
                        <span className="text-xs font-bold text-slate-200">Required Response</span>
                    </label>

                    {/* Attention Trap Check */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={Boolean(question.isAttentionCheck)}
                            onChange={(e) => onChange({ ...question, isAttentionCheck: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/20"
                        />
                        <span className="text-xs font-bold text-slate-400 hover:text-slate-200">Attention Trap</span>
                    </label>
                </div>

                {/* Top-N / Min-Max Validation Config for choice types */}
                {question.type === 'top_n' && (
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                            Max Items to Select (Top N)
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={Math.max(1, normalizedOptions.length)}
                            value={question.validation?.topN || 3}
                            onChange={(e) => onChange({
                                ...question,
                                validation: {
                                    ...(question.validation || {}),
                                    topN: Math.max(1, parseInt(e.target.value) || 1),
                                    maxSelections: Math.max(1, parseInt(e.target.value) || 1)
                                }
                            })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                        />
                    </div>
                )}

                {question.type === 'multiple_choice' && (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Min Selections
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={question.validation?.minSelections || 0}
                                onChange={(e) => onChange({
                                    ...question,
                                    validation: {
                                        ...(question.validation || {}),
                                        minSelections: parseInt(e.target.value) || 0
                                    }
                                })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Max Selections
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={question.validation?.maxSelections || normalizedOptions.length}
                                onChange={(e) => onChange({
                                    ...question,
                                    validation: {
                                        ...(question.validation || {}),
                                        maxSelections: parseInt(e.target.value) || normalizedOptions.length
                                    }
                                })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-200"
                            />
                        </div>
                    </div>
                )}

                {question.type === 'rating' && (
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Max Stars (Scale)
                        </label>
                        <select
                            value={question.maxRating || 5}
                            onChange={(e) => onChange({
                                ...question,
                                maxRating: parseInt(e.target.value) || 5,
                                validation: { ...(question.validation || {}), maxRating: parseInt(e.target.value) || 5 }
                            })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200"
                        >
                            <option value={5}>5 Stars (1 to 5)</option>
                            <option value={10}>10 Stars (1 to 10)</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Question Title & Description */}
            <div className="space-y-3">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Question Title / Prompt <span className="text-amber-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={question.title}
                        onChange={(e) => onChange({ ...question, title: e.target.value })}
                        placeholder="e.g. Which of the following features do you use most frequently?"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Optional Helper Instructions / Context
                    </label>
                    <input
                        type="text"
                        value={question.description || ''}
                        onChange={(e) => onChange({ ...question, description: e.target.value })}
                        placeholder="e.g. Please select up to 3 choices in order of preference."
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700 placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* Attention Check Trap configuration */}
            {question.isAttentionCheck && (
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/50 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                        <Shield className="w-4 h-4" /> Attention Verification Check
                    </div>
                    <p className="text-[11px] text-slate-400">
                        Respondents who fail to select the exact expected answer will be flagged or disqualified.
                    </p>
                    <div className="pt-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Exact Expected Correct Answer
                        </label>
                        <input
                            type="text"
                            value={question.expectedAnswer || ''}
                            onChange={(e) => onChange({ ...question, expectedAnswer: e.target.value })}
                            placeholder="e.g. Option 2 or Yes"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                    </div>
                </div>
            )}

            {/* Options Management (for Choice types) */}
            {isChoiceType && (
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                            Answer Choices ({normalizedOptions.length})
                        </label>
                        <button
                            type="button"
                            onClick={handleAddOption}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Choice
                        </button>
                    </div>

                    <div className="space-y-2">
                        {normalizedOptions.map((opt, idx) => (
                            <div key={opt.id || idx} className="flex items-center gap-2">
                                <span className="w-5 text-center text-xs font-mono text-slate-500">
                                    {idx + 1}.
                                </span>
                                <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                                    placeholder={`Choice ${idx + 1}`}
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
                                />
                                {normalizedOptions.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOption(idx)}
                                        className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                        title="Remove choice"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* "Other (Please Specify)" Toggle */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={Boolean(question.allowOther)}
                                onChange={handleToggleOther}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/20"
                            />
                            <span className="text-xs font-bold text-slate-300">
                                Allow "Other" with text specification
                            </span>
                        </label>

                        {question.allowOther && (
                            <div className="flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    value={question.otherPlaceholder || ''}
                                    onChange={(e) => onChange({ ...question, otherPlaceholder: e.target.value })}
                                    placeholder="Placeholder (e.g. Please specify your answer...)"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 placeholder:text-slate-600"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Text length rules for short_text / long_text */}
            {(question.type === 'short_text' || question.type === 'long_text') && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Min Characters
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={question.validation?.minLength || 0}
                            onChange={(e) => onChange({
                                ...question,
                                validation: {
                                    ...(question.validation || {}),
                                    minLength: parseInt(e.target.value) || 0
                                }
                            })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Max Characters
                        </label>
                        <input
                            type="number"
                            min={10}
                            value={question.validation?.maxLength || (question.type === 'short_text' ? 150 : 2000)}
                            onChange={(e) => onChange({
                                ...question,
                                validation: {
                                    ...(question.validation || {}),
                                    maxLength: parseInt(e.target.value) || (question.type === 'short_text' ? 150 : 2000)
                                }
                            })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200"
                        />
                    </div>
                </div>
            )}

            {/* Conditional Branching / ShowIf Rules */}
            <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={handleToggleConditional}
                        disabled={previousQuestions.length === 0}
                        className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${
                            hasConditionalLogic
                                ? 'text-purple-400 hover:text-purple-300'
                                : previousQuestions.length > 0
                                    ? 'text-slate-400 hover:text-slate-200'
                                    : 'text-slate-600 cursor-not-allowed'
                        }`}
                    >
                        <GitBranch className="w-3.5 h-3.5" />
                        {hasConditionalLogic ? 'Conditional Logic: Active (Click to remove)' : '+ Add Conditional Display Rule (showIf)'}
                    </button>
                    {previousQuestions.length === 0 && (
                        <span className="text-[10px] text-slate-500 italic">Available on Question 2+</span>
                    )}
                </div>

                {hasConditionalLogic && previousQuestions.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/40 space-y-3">
                        <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                            Show this question ONLY when:
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {/* Source Question */}
                            <select
                                value={currentCondition.questionId}
                                onChange={(e) => onChange({
                                    ...question,
                                    showIf: { ...currentCondition, questionId: e.target.value }
                                })}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                            >
                                {previousQuestions.map((pq, idx) => (
                                    <option key={pq.id} value={pq.id}>
                                        Q{idx + 1}: {pq.title.slice(0, 30)}...
                                    </option>
                                ))}
                            </select>

                            {/* Operator */}
                            <select
                                value={currentCondition.operator || 'equals'}
                                onChange={(e) => onChange({
                                    ...question,
                                    showIf: { ...currentCondition, operator: e.target.value }
                                })}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                            >
                                <option value="equals">Equals (is)</option>
                                <option value="not_equals">Does not equal</option>
                                <option value="contains">Contains / Selected</option>
                                <option value="not_contains">Does not contain</option>
                                <option value="answered">Is Answered</option>
                            </select>

                            {/* Target value */}
                            <input
                                type="text"
                                value={currentCondition.value || ''}
                                onChange={(e) => onChange({
                                    ...question,
                                    showIf: { ...currentCondition, value: e.target.value }
                                })}
                                placeholder="Target value (e.g. Other)"
                                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
