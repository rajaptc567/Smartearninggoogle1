import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { AdminSurveyTemplate, formatCurrency } from '../types';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { 
    SurveyBuilder, 
    SurveyConfigData 
} from '../components/SurveyBuilder';
import {
    getAdminSurveyTemplates,
    createAdminSurveyTemplate,
    updateAdminSurveyTemplate,
    toggleAdminSurveyTemplateEnabled,
    duplicateAdminSurveyTemplate,
    deleteAdminSurveyTemplate,
    resetDefaultAdminSurveyTemplates,
    createUserTask
} from '../services/api';
import {
    FileText,
    Plus,
    Edit3,
    Eye,
    Copy,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Play,
    RotateCcw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    DollarSign,
    Layers,
    Search,
    Filter,
    ShieldAlert,
    Check,
    X,
    Sparkles,
    ShieldCheck,
    ArrowRight,
    Settings,
    HelpCircle
} from 'lucide-react';

export const AdminSurveyTemplates: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings } = state;

    // List state
    const [templates, setTemplates] = useState<AdminSurveyTemplate[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // Modals
    const [previewTemplate, setPreviewTemplate] = useState<AdminSurveyTemplate | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<AdminSurveyTemplate | null>(null);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [usingTemplate, setUsingTemplate] = useState<AdminSurveyTemplate | null>(null);

    // Form state for Create / Edit
    const [formName, setFormName] = useState<string>('');
    const [formDescription, setFormDescription] = useState<string>('');
    const [formCategory, setFormCategory] = useState<string>('Member Intelligence & Experience');
    const [formEstimatedMinutes, setFormEstimatedMinutes] = useState<number>(5);
    const [formRewardMode, setFormRewardMode] = useState<'no_reward' | 'fixed' | 'custom'>('no_reward');
    const [formRewardAmount, setFormRewardAmount] = useState<number>(0);
    const [formRewardCurrency, setFormRewardCurrency] = useState<string>('USD');
    const [formRequirementMode, setFormRequirementMode] = useState<'optional' | 'mandatory_all' | 'mandatory_before_withdrawal'>('optional');
    const [formRecompletionPolicy, setFormRecompletionPolicy] = useState<'never' | 'on_version_change' | 'every_x_days'>('never');
    const [formRecompletionDays, setFormRecompletionDays] = useState<number>(30);
    const [formSurveyConfig, setFormSurveyConfig] = useState<SurveyConfigData>({
        title: '',
        description: '',
        category: 'Member Intelligence & Experience',
        estimatedTimeMinutes: 5,
        questions: [],
        sections: []
    });
    const [isSubmittingForm, setIsSubmittingForm] = useState<boolean>(false);

    // Form state for "Use Template" (Direct Survey Campaign Launcher)
    const [campaignTitle, setCampaignTitle] = useState<string>('');
    const [campaignDescription, setCampaignDescription] = useState<string>('');
    const [campaignWorkersNeeded, setCampaignWorkersNeeded] = useState<number>(50);
    const [campaignRewardPerTask, setCampaignRewardPerTask] = useState<number>(0.25);
    const [campaignSurveyConfig, setCampaignSurveyConfig] = useState<SurveyConfigData>({
        questions: [],
        sections: []
    });
    const [isLaunchingCampaign, setIsLaunchingCampaign] = useState<boolean>(false);

    // Fetch templates on mount
    const fetchTemplates = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAdminSurveyTemplates();
            setTemplates(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load admin survey templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    // Auto-clear success message
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // Filtered templates list
    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            if (filterStatus === 'enabled' && !t.enabled) return false;
            if (filterStatus === 'disabled' && t.enabled) return false;
            if (filterCategory !== 'all' && t.category !== filterCategory) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const nameMatch = t.name.toLowerCase().includes(q);
                const descMatch = (t.description || '').toLowerCase().includes(q);
                const catMatch = (t.category || '').toLowerCase().includes(q);
                return nameMatch || descMatch || catMatch;
            }
            return true;
        });
    }, [templates, filterStatus, filterCategory, searchQuery]);

    // Category options
    const categories = useMemo(() => {
        const set = new Set<string>();
        templates.forEach(t => {
            if (t.category) set.add(t.category);
        });
        return Array.from(set);
    }, [templates]);

    // Handle Enable/Disable Toggle
    const handleToggleEnabled = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const updated = await toggleAdminSurveyTemplateEnabled(id);
            setTemplates(prev => prev.map(t => t._id === id ? updated : t));
            setSuccessMessage(`Template "${updated.name}" is now ${updated.enabled ? 'Enabled' : 'Disabled'}.`);
        } catch (err: any) {
            alert(err.message || 'Failed to update template status');
        }
    };

    // Handle Duplicate
    const handleDuplicate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const duplicated = await duplicateAdminSurveyTemplate(id);
            setTemplates(prev => [duplicated, ...prev]);
            setSuccessMessage(`Template duplicated as "${duplicated.name}".`);
        } catch (err: any) {
            alert(err.message || 'Failed to duplicate template');
        }
    };

    // Handle Delete
    const handleDelete = async (template: AdminSurveyTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        if (template.isMasterDefault) {
            alert('The factory Master Member Survey Template cannot be deleted. You can disable it instead.');
            return;
        }
        if (!window.confirm(`Are you sure you want to permanently delete "${template.name}"?`)) {
            return;
        }
        try {
            await deleteAdminSurveyTemplate(template._id);
            setTemplates(prev => prev.filter(t => t._id !== template._id));
            setSuccessMessage(`Template "${template.name}" deleted successfully.`);
        } catch (err: any) {
            alert(err.message || 'Failed to delete template');
        }
    };

    // Handle Reset / Restore Master Default
    const handleResetMasterDefault = async () => {
        if (!window.confirm('Restore the Master Member Profile, Experience & Preferences Survey to its factory defaults?')) {
            return;
        }
        try {
            await resetDefaultAdminSurveyTemplates();
            await fetchTemplates();
            setSuccessMessage('Master Member Survey Template restored to default successfully.');
        } catch (err: any) {
            alert(err.message || 'Failed to restore master default');
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (template: AdminSurveyTemplate) => {
        setEditingTemplate(template);
        setFormName(template.name);
        setFormDescription(template.description || '');
        setFormCategory(template.category || 'Member Intelligence & Experience');
        setFormEstimatedMinutes(template.estimatedTimeMinutes || 5);
        setFormRewardMode(template.rewardConfig?.mode || 'no_reward');
        setFormRewardAmount(template.rewardConfig?.amount || 0);
        setFormRewardCurrency(template.rewardConfig?.currency || 'USD');
        setFormRequirementMode(template.requirementConfig?.mode || 'optional');
        setFormRecompletionPolicy(template.recompletionPolicy?.policy || 'never');
        setFormRecompletionDays(template.recompletionPolicy?.intervalDays || 30);
        setFormSurveyConfig(template.surveyConfig ? JSON.parse(JSON.stringify(template.surveyConfig)) : { questions: [], sections: [] });
    };

    // Open Create Modal
    const handleOpenCreate = () => {
        setIsCreating(true);
        setFormName('');
        setFormDescription('');
        setFormCategory('Member Intelligence & Experience');
        setFormEstimatedMinutes(5);
        setFormRewardMode('no_reward');
        setFormRewardAmount(0);
        setFormRewardCurrency('USD');
        setFormRequirementMode('optional');
        setFormRecompletionPolicy('never');
        setFormRecompletionDays(30);
        setFormSurveyConfig({
            title: '',
            description: '',
            category: 'Member Intelligence & Experience',
            estimatedTimeMinutes: 5,
            questions: [
                {
                    id: 'q1_intro',
                    type: 'single_choice',
                    title: 'Welcome to this survey. Do you wish to continue?',
                    required: true,
                    options: ['Yes', 'No']
                }
            ],
            sections: [
                { id: 'sec_1', title: 'General Questions', description: 'Primary section' }
            ]
        });
    };

    // Save Create or Edit
    const handleSaveTemplateForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            alert('Template name is required.');
            return;
        }
        if (!formSurveyConfig.questions || formSurveyConfig.questions.length === 0) {
            alert('At least one survey question is required.');
            return;
        }

        setIsSubmittingForm(true);
        try {
            const payload: any = {
                name: formName.trim(),
                description: formDescription.trim(),
                category: formCategory.trim(),
                estimatedTimeMinutes: Number(formEstimatedMinutes) || 5,
                rewardConfig: {
                    mode: formRewardMode,
                    amount: formRewardMode === 'fixed' ? Number(formRewardAmount) : 0,
                    currency: formRewardCurrency
                },
                requirementConfig: {
                    mode: formRequirementMode
                },
                recompletionPolicy: {
                    policy: formRecompletionPolicy,
                    intervalDays: Number(formRecompletionDays) || 30
                },
                surveyConfig: {
                    ...formSurveyConfig,
                    title: formName.trim(),
                    description: formDescription.trim(),
                    category: formCategory.trim(),
                    estimatedTimeMinutes: Number(formEstimatedMinutes) || 5
                }
            };

            if (editingTemplate) {
                const updated = await updateAdminSurveyTemplate(editingTemplate._id, payload);
                setTemplates(prev => prev.map(t => t._id === updated._id ? updated : t));
                setEditingTemplate(null);
                setSuccessMessage(`Template "${updated.name}" updated successfully.`);
            } else {
                const created = await createAdminSurveyTemplate(payload);
                setTemplates(prev => [created, ...prev]);
                setIsCreating(false);
                setSuccessMessage(`Template "${created.name}" created successfully.`);
            }
        } catch (err: any) {
            alert(err.message || 'Failed to save template');
        } finally {
            setIsSubmittingForm(false);
        }
    };

    // Open "Use Template" Modal
    const handleOpenUseTemplate = (template: AdminSurveyTemplate) => {
        setUsingTemplate(template);
        setCampaignTitle(template.name);
        setCampaignDescription(template.description || 'Please complete all survey questions thoughtfully to help improve our platform.');
        setCampaignWorkersNeeded(50);
        const isFree = template.rewardConfig?.mode === 'no_reward';
        const initialReward = isFree ? 0 : (template.rewardConfig?.amount !== undefined ? template.rewardConfig.amount : 0.25);
        setCampaignRewardPerTask(initialReward);
        setCampaignSurveyConfig(template.surveyConfig ? JSON.parse(JSON.stringify(template.surveyConfig)) : { questions: [], sections: [] });
    };

    // Handle Launch Campaign from Template
    const handleLaunchCampaignFromTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!usingTemplate) return;

        if (!campaignTitle.trim()) {
            alert('Campaign title is required.');
            return;
        }

        const safeReward = Number(campaignRewardPerTask);
        if (isNaN(safeReward) || safeReward < 0) {
            alert('Reward per submission cannot be negative.');
            return;
        }

        if (campaignWorkersNeeded <= 0) {
            alert('Workers needed must be at least 1.');
            return;
        }

        setIsLaunchingCampaign(true);
        try {
            // Reusing existing SmartExn createUserTask flow with authoritative admin research bypass
            const isZeroReward = safeReward === 0;
            const totalBudget = isZeroReward ? 0 : Number((safeReward * campaignWorkersNeeded).toFixed(2));

            const userTaskPayload = {
                title: campaignTitle.trim(),
                description: campaignDescription.trim(),
                category: 'Surveys',
                taskCategory: 'Surveys',
                subType: usingTemplate.category || 'Opinion Poll',
                rewardPerTask: safeReward,
                workersNeeded: Number(campaignWorkersNeeded),
                totalBudget: totalBudget,
                isSurvey: true,
                isSurveyCampaign: true,
                isAdminResearchSurvey: true,
                sourceAdminSurveyTemplateId: usingTemplate._id,
                publishNow: true,
                surveyCategory: usingTemplate.category || 'General Opinion Poll',
                surveyEstimatedMinutes: usingTemplate.estimatedTimeMinutes || 5,
                surveyQuestionsCount: campaignSurveyConfig.questions?.length || 0,
                surveyApprovalMode: (campaignSurveyConfig as any).approvalMode || 'auto',
                surveyConfig: {
                    ...campaignSurveyConfig,
                    title: campaignTitle.trim(),
                    description: campaignDescription.trim()
                },
                proofRequirements: [
                    {
                        type: 'text',
                        label: 'Survey Completion Confirmation',
                        instruction: 'Complete the integrated survey questionnaire. Answers are recorded automatically.',
                        required: true
                    }
                ],
                proofControls: {
                    allowedTypes: ['text'],
                    minTextLength: 1
                }
            };

            const createdTask = await createUserTask(userTaskPayload);
            dispatch({ type: 'ADD_USER_TASK', payload: createdTask });
            setUsingTemplate(null);
            setSuccessMessage(`Survey campaign "${campaignTitle}" created and published successfully as an Admin Research Survey!`);
        } catch (err: any) {
            alert(err.message || 'Failed to create campaign from template');
        } finally {
            setIsLaunchingCampaign(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Stats Banner */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border dark:border-gray-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-xs font-black uppercase rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                            Admin-Only Namespace
                        </span>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            Admin Survey Templates
                        </h1>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                        Isolated survey template library for administrators. Create, preview, configure, and launch member intelligence surveys, demographic studies, and withdrawal feedback polls without exposing templates to normal users.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button 
                        variant="secondary" 
                        onClick={handleResetMasterDefault}
                        className="text-xs font-bold flex items-center gap-1.5"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore Factory Master
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handleOpenCreate}
                        className="text-xs font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Create Template
                    </Button>
                </div>
            </div>

            {/* Notifications */}
            {successMessage && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}
            {error && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search templates..."
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                        <Filter className="w-3.5 h-3.5" />
                        <span className="font-bold">Status:</span>
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="p-2 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-300"
                    >
                        <option value="all">All Statuses ({templates.length})</option>
                        <option value="enabled">Enabled Only ({templates.filter(t => t.enabled).length})</option>
                        <option value="disabled">Disabled Only ({templates.filter(t => !t.enabled).length})</option>
                    </select>

                    {categories.length > 0 && (
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="p-2 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-300"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Template Grid */}
            {loading ? (
                <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs font-bold text-gray-500">Loading admin survey templates...</p>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 space-y-3">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto" />
                    <h3 className="text-base font-bold text-gray-800 dark:text-white">No Admin Survey Templates Found</h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                        {searchQuery ? 'No templates match your search query.' : 'Click "Restore Factory Master" to seed the default SmartExn Member Survey Template.'}
                    </p>
                    <Button variant="primary" onClick={handleResetMasterDefault} className="text-xs">
                        Restore Factory Master
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredTemplates.map(template => {
                        const questionCount = template.surveyConfig?.questions?.length || 0;
                        const sectionCount = template.surveyConfig?.sections?.length || 0;
                        const isMaster = template.isMasterDefault === true;

                        return (
                            <div 
                                key={template._id}
                                className={`rounded-3xl border p-5 flex flex-col justify-between transition-all bg-white dark:bg-gray-800 ${
                                    isMaster 
                                        ? 'border-indigo-400 dark:border-indigo-600/80 shadow-indigo-500/5 shadow-lg' 
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                                <div className="space-y-3.5">
                                    {/* Top Bar Badges */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {isMaster && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-indigo-500 text-white flex items-center gap-1 shadow-sm">
                                                    <Sparkles className="w-3 h-3" /> Master Default
                                                </span>
                                            )}
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                v{template.version}
                                            </span>
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                                                {template.category || 'General'}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => handleToggleEnabled(template._id, e)}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                                                template.enabled 
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                            }`}
                                        >
                                            {template.enabled ? (
                                                <>
                                                    <ToggleRight className="w-3.5 h-3.5" /> Enabled
                                                </>
                                            ) : (
                                                <>
                                                    <ToggleLeft className="w-3.5 h-3.5" /> Disabled
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Title & Description */}
                                    <div>
                                        <h3 className="text-base font-black text-gray-900 dark:text-white leading-snug line-clamp-2">
                                            {template.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-3 leading-relaxed">
                                            {template.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    {/* Metrics / Details Pills */}
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t dark:border-gray-750 text-[11px]">
                                        <div className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Structure</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">
                                                {questionCount} Questions {sectionCount > 0 && `• ${sectionCount} Sec`}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Est. Time</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-gray-400" /> {template.estimatedTimeMinutes || 5} min
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Reward Mode</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                {template.rewardConfig?.mode === 'no_reward' && 'No Reward'}
                                                {template.rewardConfig?.mode === 'fixed' && `Fixed: $${(template.rewardConfig?.amount || 0).toFixed(2)}`}
                                                {template.rewardConfig?.mode === 'custom' && 'Custom'}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Requirement</span>
                                            <span className="font-bold text-amber-600 dark:text-amber-400 truncate block">
                                                {template.requirementConfig?.mode === 'optional' && 'Optional'}
                                                {template.requirementConfig?.mode === 'mandatory_all' && 'Mandatory (All)'}
                                                {template.requirementConfig?.mode === 'mandatory_before_withdrawal' && 'Pre-Withdrawal'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons Footer */}
                                <div className="mt-5 pt-3.5 border-t dark:border-gray-750 flex items-center justify-between gap-1.5 flex-wrap">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setPreviewTemplate(template)}
                                            title="Preview Questions & Logic"
                                            className="px-2.5 py-1 text-xs font-bold"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleOpenEdit(template)}
                                            title="Edit Template"
                                            className="px-2.5 py-1 text-xs font-bold"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={(e) => handleDuplicate(template._id, e)}
                                            title="Duplicate Template"
                                            className="px-2.5 py-1 text-xs font-bold"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                        {!isMaster && (
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={(e) => handleDelete(template, e)}
                                                title="Delete Template"
                                                className="px-2.5 py-1 text-xs font-bold text-rose-500 hover:text-white"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </div>

                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleOpenUseTemplate(template)}
                                        className="text-xs font-black uppercase tracking-wider flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        <Play className="w-3 h-3 fill-white" /> Use Template
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* PREVIEW MODAL */}
            {previewTemplate && (
                <Modal isOpen={true} onClose={() => setPreviewTemplate(null)}>
                    <div className="p-6 max-w-4xl max-h-[85vh] overflow-y-auto space-y-6">
                        <div className="flex items-start justify-between border-b dark:border-gray-700 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                        Preview Mode
                                    </span>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">
                                        {previewTemplate.name}
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{previewTemplate.description}</p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setPreviewTemplate(null)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Metadata Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-700">
                            <div>
                                <span className="text-[10px] font-bold uppercase text-gray-400 block">Category</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{previewTemplate.category}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase text-gray-400 block">Est. Time</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{previewTemplate.estimatedTimeMinutes} min</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase text-gray-400 block">Reward Mode</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                    {previewTemplate.rewardConfig?.mode} {previewTemplate.rewardConfig?.amount > 0 && `($${previewTemplate.rewardConfig.amount})`}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase text-gray-400 block">Requirement</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">{previewTemplate.requirementConfig?.mode}</span>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
                                Questions & Logic Rules ({previewTemplate.surveyConfig?.questions?.length || 0})
                            </h3>

                            {previewTemplate.surveyConfig?.sections?.map((sec: any) => {
                                const sectionQuestions = (previewTemplate.surveyConfig?.questions || []).filter((q: any) => q.sectionId === sec.id);

                                return (
                                    <div key={sec.id} className="border dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800/80">
                                        <div className="bg-gray-100 dark:bg-gray-750 px-4 py-2.5 border-b dark:border-gray-700">
                                            <h4 className="text-xs font-black text-gray-800 dark:text-white uppercase">{sec.title}</h4>
                                            {sec.description && <p className="text-[11px] text-gray-500">{sec.description}</p>}
                                        </div>

                                        <div className="p-4 space-y-3.5">
                                            {sectionQuestions.map((q: any, idx: number) => (
                                                <div key={q.id || idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-800 text-xs space-y-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-bold text-indigo-500">#{q.id}</span>
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                                {q.type}
                                                            </span>
                                                            {q.required && (
                                                                <span className="text-rose-500 font-bold text-[10px] uppercase">*Required</span>
                                                            )}
                                                            {q.profileMapping?.enabled && (
                                                                <span className="text-emerald-500 font-bold text-[10px] uppercase">
                                                                    D2 Profile: {q.profileMapping.fieldKey}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {q.showIf && (
                                                            <span className="text-amber-500 font-bold text-[10px] uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                                Conditional Show
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="font-bold text-gray-900 dark:text-white">{q.title}</p>

                                                    {/* Options list */}
                                                    {Array.isArray(q.options) && q.options.length > 0 && (
                                                        <div className="pl-2 border-l-2 border-gray-300 dark:border-gray-700 space-y-1">
                                                            {q.options.map((opt: any, optIdx: number) => (
                                                                <div key={optIdx} className="text-gray-600 dark:text-gray-300 text-[11px]">
                                                                    • {typeof opt === 'string' ? opt : opt.label || opt.text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Logic Rules */}
                                                    {Array.isArray(q.logicRules) && q.logicRules.length > 0 && (
                                                        <div className="bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/20 text-[11px] text-indigo-400 space-y-1">
                                                            <span className="font-bold uppercase text-[10px] block">Branching Rules:</span>
                                                            {q.logicRules.map((rule: any, rIdx: number) => (
                                                                <div key={rIdx}>
                                                                    Rule {rIdx + 1}: Action &rarr; <strong className="text-indigo-300">{rule.action}</strong>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                            <Button variant="primary" onClick={() => {
                                const current = previewTemplate;
                                setPreviewTemplate(null);
                                handleOpenUseTemplate(current);
                            }}>
                                Use This Template
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* CREATE / EDIT TEMPLATE MODAL */}
            {(isCreating || editingTemplate) && (
                <Modal isOpen={true} onClose={() => { setIsCreating(false); setEditingTemplate(null); }}>
                    <div className="p-6 max-w-5xl max-h-[90vh] overflow-y-auto space-y-6">
                        <div className="flex items-start justify-between border-b dark:border-gray-700 pb-4">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    {isCreating ? 'Create Admin Survey Template' : `Edit Template: ${editingTemplate?.name}`}
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Configure template attributes, default reward parameters, requirement contracts, and custom questionnaire flow.
                                </p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => { setIsCreating(false); setEditingTemplate(null); }}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <form onSubmit={handleSaveTemplateForm} className="space-y-6">
                            {/* General Template Meta */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-700">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Template Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Member UX & Preferences Survey"
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Category</label>
                                    <input
                                        type="text"
                                        value={formCategory}
                                        onChange={(e) => setFormCategory(e.target.value)}
                                        placeholder="e.g. Demographics, Product Feedback"
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Description</label>
                                    <textarea
                                        rows={2}
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        placeholder="Brief summary of survey objective and target audience..."
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Est. Minutes</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={formEstimatedMinutes}
                                        onChange={(e) => setFormEstimatedMinutes(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Reward & Requirement Configuration (Phase 1 Controls) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-700">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Reward Mode</label>
                                    <select
                                        value={formRewardMode}
                                        onChange={(e) => setFormRewardMode(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="no_reward">No Reward (Default)</option>
                                        <option value="fixed">Fixed Reward</option>
                                        <option value="custom">Custom Reward</option>
                                    </select>
                                    {formRewardMode === 'fixed' && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={formRewardAmount}
                                                onChange={(e) => setFormRewardAmount(Number(e.target.value))}
                                                placeholder="0.25"
                                                className="w-24 px-3 py-1.5 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                            />
                                            <span className="text-xs font-bold text-gray-500">USD</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Requirement Mode</label>
                                    <select
                                        value={formRequirementMode}
                                        onChange={(e) => setFormRequirementMode(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="optional">Optional (Default)</option>
                                        <option value="mandatory_all">Mandatory for all users</option>
                                        <option value="mandatory_before_withdrawal">Mandatory before withdrawal</option>
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Data contract stored safely. Withdrawal enforcement remains OFF in Phase 1.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Re-Completion Policy</label>
                                    <select
                                        value={formRecompletionPolicy}
                                        onChange={(e) => setFormRecompletionPolicy(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="never">Never (Once Only)</option>
                                        <option value="on_version_change">On Survey Version Change</option>
                                        <option value="every_x_days">Every X Days</option>
                                    </select>
                                    {formRecompletionPolicy === 'every_x_days' && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={1}
                                                max={365}
                                                value={formRecompletionDays}
                                                onChange={(e) => setFormRecompletionDays(Number(e.target.value))}
                                                className="w-20 px-3 py-1.5 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                            />
                                            <span className="text-xs font-bold text-gray-500">Days</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Full Interactive Survey Builder */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                    Survey Questions & Logic Flow
                                </label>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                                    <SurveyBuilder
                                        value={formSurveyConfig}
                                        onChange={(updated) => setFormSurveyConfig(updated)}
                                    />
                                </div>
                            </div>

                            {/* Submit & Cancel */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-gray-700">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => { setIsCreating(false); setEditingTemplate(null); }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={isSubmittingForm}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {isCreating ? 'Create Template' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}

            {/* "USE TEMPLATE" (LAUNCH CAMPAIGN) MODAL */}
            {usingTemplate && (
                <Modal isOpen={true} onClose={() => setUsingTemplate(null)}>
                    <div className="p-6 max-w-5xl max-h-[90vh] overflow-y-auto space-y-6">
                        <div className="flex items-start justify-between border-b dark:border-gray-700 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                        Use Template Flow
                                    </span>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                        Launch Survey Campaign: {usingTemplate.name}
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Reusing existing SmartExn survey engine. Customize title, reward, budget, and review questions before publishing live to workers.
                                </p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setUsingTemplate(null)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <form onSubmit={handleLaunchCampaignFromTemplate} className="space-y-6">
                            {/* Campaign Parameters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-700">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Campaign Title *</label>
                                    <input
                                        type="text"
                                        required
                                        value={campaignTitle}
                                        onChange={(e) => setCampaignTitle(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Category</label>
                                    <input
                                        type="text"
                                        disabled
                                        value="Surveys (Paid Survey Campaign)"
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-xs font-bold text-gray-400"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Instructions for Respondents</label>
                                    <textarea
                                        rows={2}
                                        value={campaignDescription}
                                        onChange={(e) => setCampaignDescription(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                                            Survey Reward Mode & Pricing
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setCampaignRewardPerTask(0)}
                                                className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all ${
                                                    Number(campaignRewardPerTask) === 0
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                No Reward / Free ($0.00)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (Number(campaignRewardPerTask) === 0) setCampaignRewardPerTask(0.10);
                                                }}
                                                className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all ${
                                                    Number(campaignRewardPerTask) > 0
                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                Custom Reward
                                            </button>
                                        </div>
                                    </div>

                                    {/* Preset Quick Pills */}
                                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 mr-1">Presets:</span>
                                        {[
                                            { label: 'Free ($0.00)', val: 0 },
                                            { label: '$0.01', val: 0.01 },
                                            { label: '$0.05', val: 0.05 },
                                            { label: '$0.10', val: 0.10 },
                                            { label: '$0.25', val: 0.25 },
                                            { label: '$0.50', val: 0.50 },
                                            { label: '$1.00', val: 1.00 }
                                        ].map(preset => (
                                            <button
                                                key={preset.val}
                                                type="button"
                                                onClick={() => setCampaignRewardPerTask(preset.val)}
                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                                                    Number(campaignRewardPerTask) === preset.val
                                                        ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-400 font-black'
                                                        : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                                        Reward per Worker ($ USD) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={campaignRewardPerTask}
                                        onChange={(e) => setCampaignRewardPerTask(Math.max(0, Number(e.target.value)))}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold font-mono"
                                    />
                                    <span className="text-[10px] text-gray-400 mt-1 block">
                                        {Number(campaignRewardPerTask) === 0
                                            ? 'Zero reward internal study. Normal minimums bypassed.'
                                            : 'Custom admin reward. Normal minimum complexity calculation bypassed.'}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Target Workers (Max Responses) *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        value={campaignWorkersNeeded}
                                        onChange={(e) => setCampaignWorkersNeeded(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                    />
                                    <span className="text-[10px] text-gray-400 mt-1 block">
                                        Target completion responses.
                                    </span>
                                </div>

                                <div className={`p-3 rounded-xl border flex flex-col justify-center ${
                                    Number(campaignRewardPerTask) === 0
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                                        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                                }`}>
                                    <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block">Total Campaign Budget</span>
                                    <span className={`text-base font-black font-mono ${
                                        Number(campaignRewardPerTask) === 0
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                        ${(Number(campaignRewardPerTask) * campaignWorkersNeeded).toFixed(2)} USD
                                    </span>
                                    <span className="text-[10px] text-gray-500 mt-0.5">
                                        {Number(campaignRewardPerTask) === 0
                                            ? 'Zero financial liability'
                                            : 'Admin budget allocation'}
                                    </span>
                                </div>
                            </div>

                            {/* Fine-tune Questionnaire with Existing SurveyBuilder */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                    Customize Questions & Branching Logic Before Launching
                                </label>
                                <p className="text-[11px] text-gray-400">
                                    The template pre-filled the starting questions below. You can customize wording, options, branching rules, or add new questions.
                                </p>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                                    <SurveyBuilder
                                        value={campaignSurveyConfig}
                                        onChange={(updated) => setCampaignSurveyConfig(updated)}
                                    />
                                </div>
                            </div>

                            {/* Submit & Cancel */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-gray-700">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setUsingTemplate(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={isLaunchingCampaign}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                                >
                                    <Play className="w-3.5 h-3.5 fill-white" /> Launch Live Survey Campaign
                                </Button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminSurveyTemplates;
