import React, { useState } from 'react';
import { SurveyConfig, SurveyQuestion } from '../../types';
import { QuestionEditor } from './QuestionEditor';
import { SurveyPreview } from './SurveyPreview';
import {
    Plus,
    Eye,
    Sliders,
    Save,
    CheckCircle2,
    Shield,
    Clock,
    Sparkles,
    Copy,
    Trash2,
    AlertCircle
} from 'lucide-react';

export interface SurveyBuilderProps {
    value?: SurveyConfig;
    onChange: (config: SurveyConfig) => void;
    onSave?: (config: SurveyConfig) => void;
    systemTemplates?: any[];
    systemQuestionBank?: any[];
    campaignId?: string;
}

const DEFAULT_SURVEY_CONFIG: SurveyConfig = {
    title: 'Market Research & User Feedback Survey',
    description: 'Please answer the following questions honestly to help us improve our platform.',
    estimatedTimeMinutes: 5,
    approvalMode: 'auto',
    consentRequired: true,
    consentText: 'I confirm that I am participating voluntarily and will provide genuine, thoughtful responses.',
    qualityRules: {
        minCompletionTimeSeconds: 45,
        flagFastCompletion: true,
        attentionCheckRequired: false,
        autoRejectOnFail: false
    },
    questions: [
        {
            id: 'q_initial_1',
            type: 'single_choice',
            title: 'How often do you use our digital platform?',
            required: true,
            options: [
                { id: 'opt_1', text: 'Daily', value: 'Daily' },
                { id: 'opt_2', text: 'Multiple times a week', value: 'Multiple times a week' },
                { id: 'opt_3', text: 'Rarely', value: 'Rarely' }
            ],
            allowOther: true,
            otherPlaceholder: 'Please describe your usage...'
        },
        {
            id: 'q_initial_2',
            type: 'top_n',
            title: 'Which features do you value most? (Select your Top 3)',
            required: true,
            options: [
                { id: 'opt_f1', text: 'Instant Withdrawals', value: 'Instant Withdrawals' },
                { id: 'opt_f2', text: 'Micro-Task Variety', value: 'Micro-Task Variety' },
                { id: 'opt_f3', text: 'Clean Mobile UI', value: 'Clean Mobile UI' },
                { id: 'opt_f4', text: 'Referral System', value: 'Referral System' },
                { id: 'opt_f5', text: 'Fast Support', value: 'Fast Support' }
            ],
            validation: {
                topN: 3,
                maxSelections: 3
            }
        },
        {
            id: 'q_initial_3',
            type: 'rating',
            title: 'How satisfied are you overall with your experience?',
            required: true,
            maxRating: 5
        },
        {
            id: 'q_initial_4',
            type: 'long_text',
            title: 'What improvement would make this platform even better for you?',
            description: 'Feel free to share suggestions, criticisms, or feature ideas.',
            required: false,
            validation: {
                minLength: 0,
                maxLength: 1000
            }
        }
    ]
};

export const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
    value,
    onChange,
    onSave,
    systemTemplates = [],
    systemQuestionBank = [],
    campaignId = 'default'
}) => {
    const config: SurveyConfig = value || DEFAULT_SURVEY_CONFIG;
    const [activeTab, setActiveTab] = useState<'builder' | 'preview' | 'settings'>('builder');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const questions: SurveyQuestion[] = config.questions || [];

    const updateConfig = (updated: SurveyConfig) => {
        onChange(updated);
    };

    const handleLoadTemplate = (templateId: string) => {
        const tmpl = systemTemplates.find(t => t.id === templateId || t._id === templateId);
        if (!tmpl) return;

        const mappedQuestions = (tmpl.questions || []).map((q: any, idx: number) => ({
            id: q.id || `q_${Date.now()}_${idx}`,
            type: q.type || 'single_choice',
            title: q.title || `Question ${idx + 1}`,
            description: q.description || '',
            required: q.required !== false,
            options: Array.isArray(q.options)
                ? q.options.map((opt: any, optIdx: number) =>
                    typeof opt === 'object' && opt !== null
                        ? { id: opt.id || `opt_${optIdx}`, text: opt.text || opt.value || '', value: opt.value || opt.text || '' }
                        : { id: `opt_${optIdx}`, text: String(opt), value: String(opt) }
                  )
                : [],
            allowOther: Boolean(q.allowOther),
            isAttentionCheck: Boolean(q.isAttentionCheck),
            expectedAnswer: q.expectedAnswer || '',
            minRating: q.minRating,
            maxRating: q.maxRating || 5,
            validation: q.validation || (q.type === 'top_n' ? { topN: 3, maxSelections: 3 } : undefined)
        }));

        const updated: SurveyConfig = {
            ...config,
            title: tmpl.name || tmpl.title || config.title,
            description: tmpl.description || config.description,
            estimatedTimeMinutes: tmpl.estimatedTimeMinutes || config.estimatedTimeMinutes || 5,
            questions: mappedQuestions
        };
        updateConfig(updated);
        setStatusMessage(`Loaded template: ${tmpl.name || tmpl.title}`);
        setTimeout(() => setStatusMessage(null), 3000);
    };

    // Question Operations
    const handleAddQuestion = (type: string = 'single_choice') => {
        const newQ: SurveyQuestion = {
            id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type,
            title: '',
            required: true,
            options: type === 'yes_no'
                ? [{ id: 'yes', text: 'Yes', value: 'Yes' }, { id: 'no', text: 'No', value: 'No' }]
                : [
                    { id: 'opt_1', text: 'Option 1', value: 'Option 1' },
                    { id: 'opt_2', text: 'Option 2', value: 'Option 2' },
                    { id: 'opt_3', text: 'Option 3', value: 'Option 3' }
                ],
            validation: type === 'top_n' ? { topN: 3, maxSelections: 3 } : undefined
        };

        const updatedQuestions = [...questions, newQ];
        updateConfig({
            ...config,
            questions: updatedQuestions
        });
    };

    const handleUpdateQuestion = (idx: number, updatedQ: SurveyQuestion) => {
        const updated = [...questions];
        updated[idx] = updatedQ;
        updateConfig({ ...config, questions: updated });
    };

    const handleDeleteQuestion = (idx: number) => {
        if (questions.length <= 1) {
            alert('Survey must contain at least one question.');
            return;
        }
        const updated = questions.filter((_, i) => i !== idx);
        updateConfig({ ...config, questions: updated });
    };

    const handleDuplicateQuestion = (idx: number) => {
        const target = questions[idx];
        const duplicated: SurveyQuestion = {
            ...JSON.parse(JSON.stringify(target)),
            id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: `${target.title} (Copy)`,
            showIf: undefined // Reset condition so it doesn't self-reference
        };
        const updated = [...questions];
        updated.splice(idx + 1, 0, duplicated);
        updateConfig({ ...config, questions: updated });
    };

    const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= questions.length) return;
        const updated = [...questions];
        const [moved] = updated.splice(idx, 1);
        updated.splice(targetIdx, 0, moved);
        updateConfig({ ...config, questions: updated });
    };

    const handleSaveClick = () => {
        if (onSave) {
            onSave(config);
        }
        setStatusMessage('Survey configuration saved successfully!');
        setTimeout(() => setStatusMessage(null), 3500);
    };

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('builder')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'builder'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <Sliders className="w-3.5 h-3.5" /> Questions ({questions.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('preview')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'preview'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5" /> Interactive Preview
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'settings'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <Shield className="w-3.5 h-3.5" /> Quality & Approval Settings
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {systemTemplates && systemTemplates.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <select
                                defaultValue=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleLoadTemplate(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                                className="bg-transparent text-xs text-amber-300 font-bold focus:outline-none cursor-pointer py-1"
                            >
                                <option value="" disabled className="bg-slate-900 text-slate-400">
                                    Load Template ({systemTemplates.length})...
                                </option>
                                {systemTemplates.map((t: any) => (
                                    <option key={t.id || t._id} value={t.id || t._id} className="bg-slate-900 text-white">
                                        {t.name || t.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {statusMessage && (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {statusMessage}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleSaveClick}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                        <Save className="w-3.5 h-3.5" /> Save Survey Config
                    </button>
                </div>
            </div>

            {/* TAB: BUILDER */}
            {activeTab === 'builder' && (
                <div className="space-y-6">
                    {/* Survey Global Metadata Card */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                            Survey Campaign Header & Estimation
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                    Survey Title
                                </label>
                                <input
                                    type="text"
                                    value={config.title || ''}
                                    onChange={(e) => updateConfig({ ...config, title: e.target.value })}
                                    placeholder="e.g. Consumer Feedback on New Features"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                    Est. Completion Time (Minutes)
                                </label>
                                <div className="relative">
                                    <Clock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                                    <input
                                        type="number"
                                        min={1}
                                        max={120}
                                        value={config.estimatedTimeMinutes || 5}
                                        onChange={(e) => updateConfig({
                                            ...config,
                                            estimatedTimeMinutes: Math.max(1, parseInt(e.target.value) || 1)
                                        })}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                                Welcome Note & Purpose Statement
                            </label>
                            <textarea
                                rows={2}
                                value={config.description || ''}
                                onChange={(e) => updateConfig({ ...config, description: e.target.value })}
                                placeholder="Explain to respondents why their feedback matters and how it will be used..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Questions List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                                Question Blocks ({questions.length})
                            </h4>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleAddQuestion('single_choice')}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Choice Question
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAddQuestion('top_n')}
                                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold flex items-center gap-1 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Top-N Ranking
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAddQuestion('rating')}
                                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold flex items-center gap-1 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Rating
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAddQuestion('long_text')}
                                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold flex items-center gap-1 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Text
                                </button>
                            </div>
                        </div>

                        {questions.map((q, idx) => (
                            <QuestionEditor
                                key={q.id || idx}
                                question={q}
                                allQuestions={questions}
                                questionIndex={idx}
                                onChange={(updated) => handleUpdateQuestion(idx, updated)}
                                onDelete={() => handleDeleteQuestion(idx)}
                                onDuplicate={() => handleDuplicateQuestion(idx)}
                                onMoveUp={() => handleMoveQuestion(idx, 'up')}
                                onMoveDown={() => handleMoveQuestion(idx, 'down')}
                                canMoveUp={idx > 0}
                                canMoveDown={idx < questions.length - 1}
                            />
                        ))}

                        {/* Add Question Floating Bar */}
                        <div className="p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/30 text-center space-y-3">
                            <span className="text-xs text-slate-400 font-bold block">
                                Expand Questionnaire with Additional Steps
                            </span>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {[
                                    { type: 'single_choice', label: 'Single Choice' },
                                    { type: 'multiple_choice', label: 'Multiple Choice' },
                                    { type: 'top_n', label: 'Top-N Ranking' },
                                    { type: 'short_text', label: 'Short Text' },
                                    { type: 'long_text', label: 'Long Feedback' },
                                    { type: 'yes_no', label: 'Yes/No' },
                                    { type: 'rating', label: 'Rating Stars' },
                                    { type: 'dropdown', label: 'Dropdown' }
                                ].map(item => (
                                    <button
                                        key={item.type}
                                        type="button"
                                        onClick={() => handleAddQuestion(item.type)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 text-xs font-semibold flex items-center gap-1 transition-all"
                                    >
                                        <Plus className="w-3 h-3" /> {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: PREVIEW */}
            {activeTab === 'preview' && (
                <SurveyPreview config={config} />
            )}

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 space-y-6 max-w-2xl mx-auto">
                    <h4 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Quality Control & Anti-Speeding Guard
                    </h4>

                    {/* Approval Mode */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase text-slate-300">
                            Submission Approval Mode
                        </label>
                        <select
                            value={config.approvalMode || 'auto'}
                            onChange={(e) => updateConfig({ ...config, approvalMode: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                        >
                            <option value="auto">⚡ Automatic Approval (If attention check & anti-speeding pass)</option>
                            <option value="creator">👤 Creator Review (Manual review by campaign owner)</option>
                            <option value="admin">🛡️ Admin Verification (Platform administrators review)</option>
                        </select>
                    </div>

                    {/* Minimum Completion Time */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase text-slate-300">
                            Anti-Speeding Minimum Time (Seconds)
                        </label>
                        <input
                            type="number"
                            min={10}
                            max={600}
                            value={config.qualityRules?.minCompletionTimeSeconds || 45}
                            onChange={(e) => updateConfig({
                                ...config,
                                qualityRules: {
                                    ...(config.qualityRules || {}),
                                    minCompletionTimeSeconds: Math.max(10, parseInt(e.target.value) || 10)
                                }
                            })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-amber-400"
                        />
                        <p className="text-[11px] text-slate-500">
                            Workers who submit faster than this threshold will be flagged or disqualified for speeding.
                        </p>
                    </div>

                    {/* Consent Requirement */}
                    <div className="space-y-3 pt-4 border-t border-slate-800">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={config.consentRequired !== false}
                                onChange={(e) => updateConfig({ ...config, consentRequired: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/20"
                            />
                            <span className="text-xs font-bold text-white">
                                Require Participant Voluntary Consent Before Starting
                            </span>
                        </label>

                        {config.consentRequired !== false && (
                            <textarea
                                rows={2}
                                value={config.consentText || ''}
                                onChange={(e) => updateConfig({ ...config, consentText: e.target.value })}
                                placeholder="Consent terms text..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
