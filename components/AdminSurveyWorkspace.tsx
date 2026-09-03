import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { formatCurrency, UserTask, UserTaskSubmission } from '../types';
import Button from './ui/Button';
import Badge from './ui/Badge';
import {
    BarChart3,
    FileText,
    ListChecks,
    FolderPlus,
    HelpCircle,
    DollarSign,
    Clock,
    Target,
    ShieldAlert,
    Settings,
    CheckCircle2,
    XCircle,
    Eye,
    Plus,
    Trash2,
    Edit3,
    Download,
    Search,
    Filter,
    Layers,
    AlertTriangle,
    Save,
    RotateCcw,
    Sliders,
    TrendingUp,
    Users,
    Activity,
    Award
} from 'lucide-react';
import { updateSettings, getUserTasks, getUserTaskSubmissions, updateSubmissionStatus, updateUserTaskStatus, getSurveyCampaignAnalytics } from '../services/api';

interface AdminSurveyWorkspaceProps {
    onConfigChange?: () => void;
}

export const AdminSurveyWorkspace: React.FC<AdminSurveyWorkspaceProps> = ({ onConfigChange }) => {
    const { state, dispatch } = useData();
    const { settings, userTasks: storeTasks = [] } = state;

    // Active Tab in Workspace (1 to 12)
    const [activeSection, setActiveSection] = useState<string>('dashboard');
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Live Data
    const [tasks, setTasks] = useState<UserTask[]>([]);
    const [submissions, setSubmissions] = useState<UserTaskSubmission[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Survey Config Local State
    const [masterEnabled, setMasterEnabled] = useState<boolean>(settings.surveyCampaignsEnabled !== false);
    const [surveyConfig, setSurveyConfig] = useState<any>(settings.surveyConfig || {});

    // Detail/Inspect Modal
    const [selectedCampaignForAnalytics, setSelectedCampaignForAnalytics] = useState<string | null>(null);
    const [analyticsData, setAnalyticsData] = useState<any | null>(null);
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
    const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<any | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

    // Template Modal State
    const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
    const [templateForm, setTemplateForm] = useState<any>({
        id: '',
        name: '',
        category: 'Satisfaction Survey',
        description: '',
        estimatedTimeMinutes: 5,
        questions: []
    });

    // Question Bank Modal State
    const [isEditingQuestionBank, setIsEditingQuestionBank] = useState<boolean>(false);
    const [questionBankForm, setQuestionBankForm] = useState<any>({
        id: '',
        category: 'General',
        type: 'single_choice',
        title: '',
        options: ['Option 1', 'Option 2'],
        isAttentionCheck: false,
        expectedAnswer: '',
        tags: []
    });

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    useEffect(() => {
        if (settings) {
            setMasterEnabled(settings.surveyCampaignsEnabled !== false);
            setSurveyConfig(settings.surveyConfig ? JSON.parse(JSON.stringify(settings.surveyConfig)) : {});
        }
    }, [settings]);

    // Fetch live user tasks and submissions
    const loadLiveData = async () => {
        setIsLoadingData(true);
        try {
            const [fetchedTasks, fetchedSubs] = await Promise.all([
                getUserTasks().catch(() => storeTasks),
                getUserTaskSubmissions().catch(() => [])
            ]);
            setTasks(fetchedTasks || []);
            setSubmissions(fetchedSubs || []);
        } catch (err) {
            console.error("Failed to load survey data", err);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        loadLiveData();
    }, []);

    // Filter survey tasks and survey submissions
    const surveyTasks = useMemo(() => {
        return tasks.filter(t => t.isSurvey || String(t.category || '').toLowerCase() === 'survey');
    }, [tasks]);

    const surveySubmissions = useMemo(() => {
        return submissions.filter(s => {
            const t = tasks.find(tsk => String(tsk._id) === String(s.taskId));
            return s.surveyResponses?.length || (t && (t.isSurvey || String(t.category || '').toLowerCase() === 'survey'));
        });
    }, [submissions, tasks]);

    // Quick Metrics
    const metrics = useMemo(() => {
        const totalCampaigns = surveyTasks.length;
        const totalTargetResponses = surveyTasks.reduce((acc, t) => acc + (t.targetQuantity || 0), 0);
        const totalCompletedResponses = surveySubmissions.filter(s => s.status === 'Approved' || s.surveyQualificationStatus === 'Completed').length;
        const totalPaidRewards = surveySubmissions
            .filter(s => s.paid || s.status === 'Approved')
            .reduce((acc, s) => acc + (s.rewardAmount || 0), 0);
        
        let sumDuration = 0;
        let countDuration = 0;
        let attentionPassed = 0;
        surveySubmissions.forEach(s => {
            if (s.surveyCompletionTimeSeconds && s.surveyCompletionTimeSeconds > 0) {
                sumDuration += s.surveyCompletionTimeSeconds;
                countDuration++;
            }
            if (s.attentionCheckPassed !== false) {
                attentionPassed++;
            }
        });
        const avgTimeSeconds = countDuration > 0 ? Math.round(sumDuration / countDuration) : 0;
        const passRate = surveySubmissions.length > 0 ? Math.round((attentionPassed / surveySubmissions.length) * 100) : 100;

        return {
            totalCampaigns,
            totalTargetResponses,
            totalCompletedResponses,
            totalPaidRewards,
            avgTimeSeconds,
            passRate,
            activeCount: surveyTasks.filter(t => t.status === 'Approved' || t.status === 'Running' || t.status === 'Active').length,
            pendingReviewCount: surveySubmissions.filter(s => s.status === 'Pending').length
        };
    }, [surveyTasks, surveySubmissions]);

    // Save All Survey Settings
    const handleSaveAll = async () => {
        setIsSaving(true);
        setToastMessage(null);
        try {
            const updatedSettings = {
                ...settings,
                surveyCampaignsEnabled: masterEnabled,
                surveyConfig: surveyConfig
            };

            const response = await updateSettings(updatedSettings);
            if (response) {
                dispatch({ type: 'UPDATE_SETTINGS', payload: response });
                setToastMessage({ type: 'success', text: 'Survey Configuration and rules saved successfully!' });
                if (onConfigChange) onConfigChange();
            } else {
                setToastMessage({ type: 'error', text: 'Failed to update survey configuration.' });
            }
        } catch (err: any) {
            setToastMessage({ type: 'error', text: err.message || 'Error saving settings.' });
        } finally {
            setIsSaving(false);
        }
    };

    // View Analytics for a campaign
    const handleViewAnalytics = async (taskId: string) => {
        setSelectedCampaignForAnalytics(taskId);
        setIsLoadingAnalytics(true);
        try {
            const data = await getSurveyCampaignAnalytics(taskId);
            setAnalyticsData(data);
        } catch (err) {
            console.error("Failed to load analytics", err);
        } finally {
            setIsLoadingAnalytics(false);
        }
    };

    // Review submission handler
    const handleReviewSubmission = async (subId: string, status: 'Approved' | 'Rejected') => {
        try {
            await updateSubmissionStatus(subId, {
                status,
                adminNotes: reviewNotes || `Reviewed by Administrator: ${status}`,
                rejectionReason: status === 'Rejected' ? (reviewNotes || 'Does not meet survey response quality standards') : undefined
            });
            setToastMessage({ type: 'success', text: `Submission marked as ${status}` });
            setSelectedSubmissionForReview(null);
            setReviewNotes('');
            loadLiveData();
        } catch (err: any) {
            setToastMessage({ type: 'error', text: err.message || 'Failed to update submission' });
        }
    };

    // Export responses to CSV
    const exportSubmissionsToCSV = () => {
        if (!surveySubmissions.length) return alert("No responses to export.");
        const headers = ["SubmissionID", "TaskTitle", "WorkerName", "Status", "Reward", "CompletionSeconds", "Qualification", "AttentionCheck", "Date"];
        const rows = surveySubmissions.map(s => [
            s._id,
            `"${(s.taskTitle || '').replace(/"/g, '""')}"`,
            `"${(s.workerName || '').replace(/"/g, '""')}"`,
            s.status,
            s.rewardAmount,
            s.surveyCompletionTimeSeconds || 0,
            s.surveyQualificationStatus || 'Completed',
            s.attentionCheckPassed ? 'PASSED' : 'FAILED',
            s.createdAt ? new Date(s.createdAt).toISOString() : ''
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `survey_submissions_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Navigation sections definition
    const sections = [
        { id: 'dashboard', label: '1. Overview Dashboard', icon: BarChart3 },
        { id: 'templates', label: '2. Survey Templates', icon: FileText },
        { id: 'campaigns', label: '3. Survey Campaigns', icon: Layers },
        { id: 'questionBank', label: '4. Question Bank', icon: HelpCircle },
        { id: 'questionTypes', label: '5. Question Types', icon: ListChecks },
        { id: 'pricing', label: '6. Pricing / Rates', icon: DollarSign },
        { id: 'timeRules', label: '7. Completion Time Rules', icon: Clock },
        { id: 'targeting', label: '8. Targeting Rules', icon: Target },
        { id: 'qualification', label: '9. Qualification Rules', icon: ShieldAlert },
        { id: 'settings', label: '10. Survey Settings', icon: Settings },
        { id: 'moderation', label: '11. Review / Moderation', icon: CheckCircle2 },
        { id: 'reports', label: '12. Reports & Analytics', icon: TrendingUp },
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
            {/* Header with Master Switch and Save Button */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-purple-50/60 dark:from-gray-800 dark:to-gray-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-sm">
                            <ListChecks className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                Survey & Opinion Polls Master Workspace
                                <Badge variant={masterEnabled ? 'success' : 'danger'}>
                                    {masterEnabled ? 'Active' : 'Disabled'}
                                </Badge>
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Full 12-module control suite for survey campaigns, dynamic questionnaires, rates, and automated verification.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <label className="relative inline-flex items-center cursor-pointer mr-2">
                        <input
                            type="checkbox"
                            checked={masterEnabled}
                            onChange={(e) => setMasterEnabled(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        <span className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {masterEnabled ? 'Campaigns Enabled' : 'Campaigns Disabled'}
                        </span>
                    </label>

                    <Button
                        variant="primary"
                        onClick={handleSaveAll}
                        isLoading={isSaving}
                        className="shadow-sm"
                    >
                        <Save className="w-4 h-4 mr-1.5" />
                        Save All Survey Changes
                    </Button>
                </div>
            </div>

            {/* Notification Toast */}
            {toastMessage && (
                <div className={`mx-6 mt-4 p-4 rounded-lg flex items-center justify-between text-sm ${
                    toastMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200'
                }`}>
                    <span>{toastMessage.text}</span>
                    <button onClick={() => setToastMessage(null)} className="text-xs font-bold underline ml-4">Dismiss</button>
                </div>
            )}

            {/* Main Tabs Navigation */}
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-850 px-4 flex flex-wrap gap-1 overflow-x-auto">
                {sections.map(s => {
                    const Icon = s.icon;
                    const isActive = activeSection === s.id;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                                isActive
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 rounded-t-lg'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                            {s.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Body */}
            <div className="p-6">
                {/* 1. OVERVIEW DASHBOARD */}
                {activeSection === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Total Survey Tasks</span>
                                    <Layers className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalCampaigns}</div>
                                <div className="text-xs text-gray-500 mt-1">{metrics.activeCount} Active / Approved</div>
                            </div>

                            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed Responses</span>
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalCompletedResponses}</div>
                                <div className="text-xs text-gray-500 mt-1">{metrics.pendingReviewCount} Pending Review</div>
                            </div>

                            <div className="p-4 bg-purple-50/60 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Worker Payouts</span>
                                    <DollarSign className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(metrics.totalPaidRewards)}</div>
                                <div className="text-xs text-gray-500 mt-1">Paid directly to workers</div>
                            </div>

                            <div className="p-4 bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Avg Duration & Quality</span>
                                    <Clock className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                                    {metrics.avgTimeSeconds > 0 ? `${Math.floor(metrics.avgTimeSeconds / 60)}m ${metrics.avgTimeSeconds % 60}s` : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">{metrics.passRate}% Attention Check Pass Rate</div>
                            </div>
                        </div>

                        {/* Recent Surveys List */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Survey Campaigns</h3>
                                <Button size="sm" variant="secondary" onClick={() => setActiveSection('campaigns')}>
                                    View All ({surveyTasks.length})
                                </Button>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {surveyTasks.slice(0, 5).map(task => (
                                    <div key={task._id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-gray-50/60 dark:hover:bg-gray-750">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-900 dark:text-white text-sm">{task.title}</span>
                                                <Badge variant={task.status === 'Approved' ? 'success' : task.status === 'Pending' ? 'warning' : 'secondary'}>
                                                    {task.status}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                                                <span>Sub-type: {task.subType || 'General'}</span>
                                                <span>•</span>
                                                <span>Estimated: {task.surveyEstimatedMinutes || 5} mins</span>
                                                <span>•</span>
                                                <span>Reward: {formatCurrency(task.rewardPerTask)}</span>
                                                <span>•</span>
                                                <span>Slots: {task.currentCompletions || 0} / {task.targetQuantity}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => handleViewAnalytics(task._id)}>
                                                <BarChart3 className="w-3.5 h-3.5 mr-1" /> Analytics
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {surveyTasks.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 text-sm">
                                        No survey campaigns created yet. Users can start creating surveys from the Work & Earn page.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. SURVEY TEMPLATES */}
                {activeSection === 'templates' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Pre-Designed Survey Templates</h3>
                                <p className="text-xs text-gray-500">Templates available for advertisers to pre-populate questions instantly.</p>
                            </div>
                            <Button size="sm" variant="primary" onClick={() => {
                                setTemplateForm({
                                    id: `tmpl_${Date.now()}`,
                                    name: '',
                                    category: 'Satisfaction Survey',
                                    description: '',
                                    estimatedTimeMinutes: 5,
                                    questions: [
                                        { id: 'q1', type: 'single_choice', title: 'Example Question 1?', required: true, options: ['Option A', 'Option B'] }
                                    ]
                                });
                                setIsEditingTemplate(true);
                            }}>
                                <Plus className="w-4 h-4 mr-1" /> New Template
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(surveyConfig.templates || []).map((tmpl: any, index: number) => (
                                <div key={tmpl.id || index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/40 dark:bg-gray-800/50 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-sm text-gray-900 dark:text-white">{tmpl.name}</h4>
                                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{tmpl.category}</span>
                                            </div>
                                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                ~{tmpl.estimatedTimeMinutes || 4} mins
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">{tmpl.description || 'No description'}</p>
                                        
                                        <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                Questions ({tmpl.questions?.length || 0}):
                                            </span>
                                            <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                                {(tmpl.questions || []).slice(0, 3).map((q: any, qi: number) => (
                                                    <li key={qi} className="truncate">• {q.title} <span className="text-gray-400">({q.type})</span></li>
                                                ))}
                                                {(tmpl.questions || []).length > 3 && (
                                                    <li className="text-gray-400 italic">+ {(tmpl.questions || []).length - 3} more questions</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => {
                                            setTemplateForm(JSON.parse(JSON.stringify(tmpl)));
                                            setIsEditingTemplate(true);
                                        }}>
                                            <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => {
                                            if (window.confirm(`Delete template "${tmpl.name}"?`)) {
                                                setSurveyConfig((prev: any) => ({
                                                    ...prev,
                                                    templates: (prev.templates || []).filter((t: any) => t.id !== tmpl.id)
                                                }));
                                            }
                                        }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Template Modal */}
                        {isEditingTemplate && (
                            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
                                <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white">
                                            {templateForm.id ? 'Edit Survey Template' : 'New Survey Template'}
                                        </h3>
                                        <button onClick={() => setIsEditingTemplate(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                                            <input
                                                type="text"
                                                value={templateForm.name}
                                                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                                                className="w-full text-sm border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                placeholder="e.g. Brand Perception Audit"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                                <input
                                                    type="text"
                                                    value={templateForm.category}
                                                    onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                                                    className="w-full text-sm border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Estimated Minutes</label>
                                                <input
                                                    type="number"
                                                    value={templateForm.estimatedTimeMinutes}
                                                    onChange={e => setTemplateForm({ ...templateForm, estimatedTimeMinutes: Number(e.target.value) })}
                                                    className="w-full text-sm border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                            <textarea
                                                value={templateForm.description}
                                                onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })}
                                                className="w-full text-sm border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                rows={2}
                                            />
                                        </div>

                                        {/* Questions Editor */}
                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Questions ({templateForm.questions?.length || 0})</span>
                                                <Button size="sm" variant="secondary" onClick={() => {
                                                    const newQ = {
                                                        id: `q_${Date.now()}`,
                                                        type: 'single_choice',
                                                        title: 'New Question Title',
                                                        required: true,
                                                        options: ['Option 1', 'Option 2']
                                                    };
                                                    setTemplateForm({
                                                        ...templateForm,
                                                        questions: [...(templateForm.questions || []), newQ]
                                                    });
                                                }}>
                                                    <Plus className="w-3 h-3 mr-1" /> Add Question
                                                </Button>
                                            </div>

                                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                                {(templateForm.questions || []).map((q: any, qIdx: number) => (
                                                    <div key={q.id || qIdx} className="p-3 bg-gray-50 dark:bg-gray-750 border rounded-lg text-xs space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold">Q{qIdx + 1}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setTemplateForm({
                                                                        ...templateForm,
                                                                        questions: templateForm.questions.filter((_: any, idx: number) => idx !== qIdx)
                                                                    });
                                                                }}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={q.title}
                                                            onChange={e => {
                                                                const updated = [...templateForm.questions];
                                                                updated[qIdx].title = e.target.value;
                                                                setTemplateForm({ ...templateForm, questions: updated });
                                                            }}
                                                            className="w-full border p-1.5 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                            placeholder="Question Prompt"
                                                        />
                                                        <div className="flex gap-2">
                                                            <select
                                                                value={q.type}
                                                                onChange={e => {
                                                                    const updated = [...templateForm.questions];
                                                                    updated[qIdx].type = e.target.value;
                                                                    setTemplateForm({ ...templateForm, questions: updated });
                                                                }}
                                                                className="border p-1 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                                            >
                                                                <option value="single_choice">Single Choice</option>
                                                                <option value="multiple_choice">Multiple Choice</option>
                                                                <option value="yes_no">Yes / No</option>
                                                                <option value="rating">Rating (Stars)</option>
                                                                <option value="opinion_scale">Opinion Scale (1-10)</option>
                                                                <option value="short_text">Short Text</option>
                                                                <option value="long_text">Long Text</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                                        <Button variant="secondary" onClick={() => setIsEditingTemplate(false)}>Cancel</Button>
                                        <Button variant="primary" onClick={() => {
                                            if (!templateForm.name.trim()) return alert("Template name is required");
                                            setSurveyConfig((prev: any) => {
                                                const existing = prev.templates || [];
                                                const idx = existing.findIndex((t: any) => t.id === templateForm.id);
                                                let updated = [...existing];
                                                if (idx >= 0) {
                                                    updated[idx] = templateForm;
                                                } else {
                                                    updated.push(templateForm);
                                                }
                                                return { ...prev, templates: updated };
                                            });
                                            setIsEditingTemplate(false);
                                        }}>
                                            Save Template to State
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. SURVEY CAMPAIGNS */}
                {activeSection === 'campaigns' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search surveys..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="text-xs border rounded-lg px-2.5 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="Approved">Approved / Active</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>
                            <Button size="sm" variant="secondary" onClick={loadLiveData}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
                            </Button>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-750 text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[10px] font-semibold border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="py-3 px-4">Title & Sub-type</th>
                                        <th className="py-3 px-4">Creator</th>
                                        <th className="py-3 px-4">Progress</th>
                                        <th className="py-3 px-4">Reward / Payout</th>
                                        <th className="py-3 px-4">Est. Time</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {surveyTasks
                                        .filter(t => {
                                            if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
                                            if (searchQuery) {
                                                const matchTitle = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase());
                                                const matchUser = (t.userName || '').toLowerCase().includes(searchQuery.toLowerCase());
                                                return matchTitle || matchUser;
                                            }
                                            return true;
                                        })
                                        .map(task => (
                                            <tr key={task._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-gray-900 dark:text-white">{task.title}</div>
                                                    <div className="text-[11px] text-gray-500">{task.subType || 'General Survey'}</div>
                                                </td>
                                                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                                    {task.userName || 'User'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="bg-blue-600 h-2 rounded-full"
                                                                style={{
                                                                    width: `${task.targetQuantity > 0 ? Math.min(100, Math.round((task.currentCompletions / task.targetQuantity) * 100)) : 0}%`
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[11px] font-medium">
                                                            {task.currentCompletions || 0}/{task.targetQuantity}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(task.rewardPerTask)}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                                    {task.surveyEstimatedMinutes || 5} mins
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant={task.status === 'Approved' || task.status === 'Active' ? 'success' : task.status === 'Pending' ? 'warning' : 'secondary'}>
                                                        {task.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <Button size="sm" variant="secondary" onClick={() => handleViewAnalytics(task._id)}>
                                                        <BarChart3 className="w-3.5 h-3.5 mr-1" /> Results
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    {surveyTasks.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-gray-500">
                                                No survey campaigns found matching current criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. QUESTION BANK */}
                {activeSection === 'questionBank' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Pre-Approved Question Bank</h3>
                                <p className="text-xs text-gray-500">Curated questions and attention check checks available to advertisers.</p>
                            </div>
                            <Button size="sm" variant="primary" onClick={() => {
                                setQuestionBankForm({
                                    id: `qb_${Date.now()}`,
                                    category: 'General',
                                    type: 'single_choice',
                                    title: '',
                                    options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'],
                                    isAttentionCheck: false,
                                    expectedAnswer: '',
                                    tags: ['feedback']
                                });
                                setIsEditingQuestionBank(true);
                            }}>
                                <Plus className="w-4 h-4 mr-1" /> Add Bank Question
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(surveyConfig.questionBank || []).map((q: any) => (
                                <div key={q.id} className="p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/40 dark:bg-gray-800/40 space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                                {q.category || 'General'}
                                            </span>
                                            {q.isAttentionCheck && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Attention Check
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSurveyConfig((prev: any) => ({
                                                    ...prev,
                                                    questionBank: (prev.questionBank || []).filter((item: any) => item.id !== q.id)
                                                }));
                                            }}
                                            className="text-gray-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <h4 className="font-semibold text-xs text-gray-900 dark:text-white">{q.title}</h4>

                                    <div className="text-[11px] text-gray-500 flex flex-wrap gap-1 items-center">
                                        <span className="font-medium text-gray-600 dark:text-gray-400">Type:</span> {q.type}
                                        {q.expectedAnswer && (
                                            <span className="ml-2 text-emerald-600 font-medium">Expected: "{q.expectedAnswer}"</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Question Bank Modal */}
                        {isEditingQuestionBank && (
                            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-5 space-y-3">
                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">Add Question to Question Bank</h3>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Question Prompt</label>
                                        <input
                                            type="text"
                                            value={questionBankForm.title}
                                            onChange={e => setQuestionBankForm({ ...questionBankForm, title: e.target.value })}
                                            className="w-full text-xs border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="Enter question text..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-semibold mb-1">Category</label>
                                            <input
                                                type="text"
                                                value={questionBankForm.category}
                                                onChange={e => setQuestionBankForm({ ...questionBankForm, category: e.target.value })}
                                                className="w-full text-xs border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold mb-1">Type</label>
                                            <select
                                                value={questionBankForm.type}
                                                onChange={e => setQuestionBankForm({ ...questionBankForm, type: e.target.value })}
                                                className="w-full text-xs border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            >
                                                <option value="single_choice">Single Choice</option>
                                                <option value="multiple_choice">Multiple Choice</option>
                                                <option value="yes_no">Yes / No</option>
                                                <option value="rating">Rating</option>
                                                <option value="opinion_scale">Opinion Scale</option>
                                                <option value="long_text">Long Text</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <input
                                            type="checkbox"
                                            id="qb_attn"
                                            checked={questionBankForm.isAttentionCheck}
                                            onChange={e => setQuestionBankForm({ ...questionBankForm, isAttentionCheck: e.target.checked })}
                                        />
                                        <label htmlFor="qb_attn" className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                            Is Attention Check Question (Anti-Bot / Quality trap)
                                        </label>
                                    </div>
                                    {questionBankForm.isAttentionCheck && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-1">Expected Answer</label>
                                            <input
                                                type="text"
                                                value={questionBankForm.expectedAnswer}
                                                onChange={e => setQuestionBankForm({ ...questionBankForm, expectedAnswer: e.target.value })}
                                                className="w-full text-xs border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                placeholder="e.g. Strongly Agree"
                                            />
                                        </div>
                                    )}
                                    <div className="flex justify-end gap-2 pt-2 border-t">
                                        <Button size="sm" variant="secondary" onClick={() => setIsEditingQuestionBank(false)}>Cancel</Button>
                                        <Button size="sm" variant="primary" onClick={() => {
                                            if (!questionBankForm.title.trim()) return alert("Question title required");
                                            setSurveyConfig((prev: any) => ({
                                                ...prev,
                                                questionBank: [...(prev.questionBank || []), questionBankForm]
                                            }));
                                            setIsEditingQuestionBank(false);
                                        }}>
                                            Add to Bank
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 5. QUESTION TYPES */}
                {activeSection === 'questionTypes' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Supported Survey Question Types</h3>
                            <p className="text-xs text-gray-500">Configure enabled question formats and responsive rendering engines.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                                { id: 'single_choice', name: 'Single Choice (Radio)', icon: '🔘', desc: 'Select one option from a list' },
                                { id: 'multiple_choice', name: 'Multiple Choice (Checkboxes)', icon: '☑️', desc: 'Select multiple applicable options' },
                                { id: 'yes_no', name: 'Yes / No Binary', icon: '⚖️', desc: 'Fast binary response with thumbs or switches' },
                                { id: 'rating', name: 'Rating Scale (1-5 Stars)', icon: '⭐', desc: 'Star rating or numerical satisfaction score' },
                                { id: 'opinion_scale', name: 'Opinion / NPS Scale (0-10)', icon: '🔟', desc: 'Standard Net Promoter Score indicator' },
                                { id: 'short_text', name: 'Short Text Input', icon: '✏️', desc: 'Single-line responses, names, emails, values' },
                                { id: 'long_text', name: 'Long Text / Essay', icon: '📝', desc: 'Multi-line feedback, suggestions, reviews' },
                                { id: 'dropdown', name: 'Dropdown Selector', icon: '🔽', desc: 'Compact select menu for extensive lists' },
                                { id: 'number', name: 'Numerical / Amount', icon: '🔢', desc: 'Strict numeric quantities, ages, counts' },
                                { id: 'ranking', name: 'Drag & Drop Ranking', icon: '📶', desc: 'Reorder preferences from highest to lowest' },
                                { id: 'matrix', name: 'Matrix / Likert Grid', icon: '▦', desc: 'Evaluate multiple statements against one scale' }
                            ].map(qt => (
                                <div key={qt.id} className="p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/40 flex items-start gap-3">
                                    <span className="text-2xl">{qt.icon}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-xs text-gray-900 dark:text-white">{qt.name}</h4>
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                Active
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">{qt.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 6. PRICING / RATES */}
                {activeSection === 'pricing' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Survey Pricing & Rate Matrix</h3>
                            <p className="text-xs text-gray-500">Define base platform fees, worker rewards, question-count surcharges, and margins.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Base Advertiser Rate ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={surveyConfig.rateRules?.baseReward ?? 0.10}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setSurveyConfig((prev: any) => ({
                                            ...prev,
                                            rateRules: { ...(prev.rateRules || {}), baseReward: val }
                                        }));
                                    }}
                                    className="w-full text-base font-bold border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <span className="text-[11px] text-gray-500 mt-1 block">Minimum fee per response charged to campaign creator</span>
                            </div>

                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Worker Payout ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={surveyConfig.rateRules?.workerReward ?? 0.08}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setSurveyConfig((prev: any) => ({
                                            ...prev,
                                            rateRules: { ...(prev.rateRules || {}), workerReward: val }
                                        }));
                                    }}
                                    className="w-full text-base font-bold border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <span className="text-[11px] text-gray-500 mt-1 block">Amount credited to worker upon approval</span>
                            </div>

                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Platform Margin / Fee ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={surveyConfig.rateRules?.platformFee ?? 0.02}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setSurveyConfig((prev: any) => ({
                                            ...prev,
                                            rateRules: { ...(prev.rateRules || {}), platformFee: val }
                                        }));
                                    }}
                                    className="w-full text-base font-bold border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <span className="text-[11px] text-gray-500 mt-1 block">Retained platform commission per response</span>
                            </div>
                        </div>

                        {/* Question Count Price Adjustments */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                    Question Count Pricing Tiers (Complexity Fee)
                                </h4>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {(surveyConfig.rateRules?.questionTiers || []).map((qt: any, idx: number) => (
                                    <div key={qt.id || idx} className="p-3 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">{qt.range}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-500">Price Adjustment:</span>
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-gray-900 dark:text-white">+$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={qt.priceAdjustment}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setSurveyConfig((prev: any) => {
                                                            const updated = [...(prev.rateRules?.questionTiers || [])];
                                                            updated[idx].priceAdjustment = val;
                                                            return { ...prev, rateRules: { ...prev.rateRules, questionTiers: updated } };
                                                        });
                                                    }}
                                                    className="w-20 border rounded p-1 text-right dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. COMPLETION TIME RULES */}
                {activeSection === 'timeRules' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Survey Duration Tiers & Anti-Speeding Rules</h3>
                            <p className="text-xs text-gray-500">Time requirements matching the standard Task Configurator duration structure.</p>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-750 font-semibold border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="p-3">Duration Tier</th>
                                        <th className="p-3">Min Payout ($)</th>
                                        <th className="p-3">Min Slots</th>
                                        <th className="p-3">Enabled</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {(surveyConfig.rateRules?.timeTiers || []).map((tt: any, idx: number) => (
                                        <tr key={tt.id || idx}>
                                            <td className="p-3 font-semibold">{tt.duration}</td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={tt.workerReward}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setSurveyConfig((prev: any) => {
                                                            const updated = [...(prev.rateRules?.timeTiers || [])];
                                                            updated[idx].workerReward = val;
                                                            return { ...prev, rateRules: { ...prev.rateRules, timeTiers: updated } };
                                                        });
                                                    }}
                                                    className="w-24 border rounded p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    value={tt.minSlots}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value) || 1;
                                                        setSurveyConfig((prev: any) => {
                                                            const updated = [...(prev.rateRules?.timeTiers || [])];
                                                            updated[idx].minSlots = val;
                                                            return { ...prev, rateRules: { ...prev.rateRules, timeTiers: updated } };
                                                        });
                                                    }}
                                                    className="w-20 border rounded p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={tt.enabled !== false}
                                                    onChange={e => {
                                                        setSurveyConfig((prev: any) => {
                                                            const updated = [...(prev.rateRules?.timeTiers || [])];
                                                            updated[idx].enabled = e.target.checked;
                                                            return { ...prev, rateRules: { ...prev.rateRules, timeTiers: updated } };
                                                        });
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                <Clock className="w-4 h-4" /> Anti-Speeding Threshold Ratio
                            </h4>
                            <p className="text-xs text-amber-800 dark:text-amber-300">
                                If a worker finishes the survey in less than this fraction of estimated duration, it will be flagged or rejected to ensure genuine answers.
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0.1"
                                    max="0.8"
                                    value={surveyConfig.securityRules?.minCompletionTimeRatio ?? 0.3}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0.3;
                                        setSurveyConfig((prev: any) => ({
                                            ...prev,
                                            securityRules: { ...(prev.securityRules || {}), minCompletionTimeRatio: val }
                                        }));
                                    }}
                                    className="w-24 border rounded p-1 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    ({Math.round((surveyConfig.securityRules?.minCompletionTimeRatio ?? 0.3) * 100)}% of estimated duration)
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 8. TARGETING RULES */}
                {activeSection === 'targeting' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Audience Targeting Matrix</h3>
                            <p className="text-xs text-gray-500">Permit creators to restrict survey participation by country, device, or age.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750 space-y-2">
                                <span className="font-bold text-xs text-gray-900 dark:text-white">Targeting Options Allowed</span>
                                <div className="space-y-2 text-xs">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={surveyConfig.allowedCustomizations?.allowUserChangeTargeting !== false}
                                            onChange={e => setSurveyConfig((prev: any) => ({
                                                ...prev,
                                                allowedCustomizations: { ...(prev.allowedCustomizations || {}), allowUserChangeTargeting: e.target.checked }
                                            }))}
                                        />
                                        <span>Allow Country & Region Targeting</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={surveyConfig.allowedCustomizations?.allowUserChangeResponsesCount !== false}
                                            onChange={e => setSurveyConfig((prev: any) => ({
                                                ...prev,
                                                allowedCustomizations: { ...(prev.allowedCustomizations || {}), allowUserChangeResponsesCount: e.target.checked }
                                            }))}
                                        />
                                        <span>Allow Device Filtering (Mobile vs Desktop)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750 space-y-2">
                                <span className="font-bold text-xs text-gray-900 dark:text-white">Targeting Surcharge</span>
                                <p className="text-xs text-gray-500">Added to advertiser cost per response when specific audience targeting is configured.</p>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm">+$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={surveyConfig.rateRules?.targetingPremium ?? 0.05}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setSurveyConfig((prev: any) => ({
                                                ...prev,
                                                rateRules: { ...(prev.rateRules || {}), targetingPremium: val }
                                            }));
                                        }}
                                        className="w-24 border rounded p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 9. QUALIFICATION RULES */}
                {activeSection === 'qualification' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Screener & Qualification Policies</h3>
                            <p className="text-xs text-gray-500">Control behavior when workers answer screening questions or fail attention traps.</p>
                        </div>

                        <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750 space-y-3 text-xs">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={surveyConfig.securityRules?.allowAttentionChecks !== false}
                                    onChange={e => setSurveyConfig((prev: any) => ({
                                        ...prev,
                                        securityRules: { ...(prev.securityRules || {}), allowAttentionChecks: e.target.checked }
                                    }))}
                                />
                                <span className="font-semibold">Auto-Fail Submissions on Failed Attention Check</span>
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={surveyConfig.rateRules?.allowScreeningReward === true}
                                        onChange={e => setSurveyConfig((prev: any) => ({
                                            ...prev,
                                            rateRules: { ...(prev.rateRules || {}), allowScreeningReward: e.target.checked }
                                        }))}
                                    />
                                    <span className="font-semibold">Credit Micro-Reward on Screenout / Disqualification</span>
                                </label>
                                {surveyConfig.rateRules?.allowScreeningReward === true && (
                                    <div className="ml-6 flex items-center gap-2 pt-1">
                                        <span className="text-gray-600 dark:text-gray-300">Reward Amount ($):</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            max="5.00"
                                            value={surveyConfig.rateRules?.screeningRewardAmount ?? surveyConfig.rateRules?.qualificationReward ?? 0.01}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value) || 0;
                                                setSurveyConfig((prev: any) => ({
                                                    ...prev,
                                                    rateRules: { 
                                                        ...(prev.rateRules || {}), 
                                                        screeningRewardAmount: val,
                                                        qualificationReward: val 
                                                    }
                                                }));
                                            }}
                                            className="w-24 border rounded p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-right"
                                        />
                                        <span className="text-[11px] text-gray-500">Credited to worker Task Earnings balance on screening disqualification</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 10. SURVEY SETTINGS */}
                {activeSection === 'settings' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Global Survey Settings & Guardrails</h3>
                            <p className="text-xs text-gray-500">Security flags, terms disclaimer, and fraud prevention settings.</p>
                        </div>

                        <div className="space-y-3">
                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750 flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold text-xs text-gray-900 dark:text-white">Enforce 1 Response Per Worker</h4>
                                    <p className="text-xs text-gray-500">Prevents a single user from taking the same survey more than once.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={surveyConfig.securityRules?.enforceOneResponsePerUser !== false}
                                    onChange={e => setSurveyConfig((prev: any) => ({
                                        ...prev,
                                        securityRules: { ...(prev.securityRules || {}), enforceOneResponsePerUser: e.target.checked }
                                    }))}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                            </div>

                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750 flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold text-xs text-gray-900 dark:text-white">Enforce Anti-Speeding Validation</h4>
                                    <p className="text-xs text-gray-500">Rejects submissions made faster than the minimum duration threshold.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={surveyConfig.securityRules?.enforceAntiSpeeding !== false}
                                    onChange={e => setSurveyConfig((prev: any) => ({
                                        ...prev,
                                        securityRules: { ...(prev.securityRules || {}), enforceAntiSpeeding: e.target.checked }
                                    }))}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                            </div>

                            <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-750 space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-900 dark:text-white">
                                    Default Participant Consent Statement
                                </label>
                                <textarea
                                    value={surveyConfig.defaultConsentText || ''}
                                    onChange={e => setSurveyConfig((prev: any) => ({
                                        ...prev,
                                        defaultConsentText: e.target.value
                                    }))}
                                    rows={2}
                                    className="w-full text-xs border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 11. REVIEW / MODERATION */}
                {activeSection === 'moderation' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Survey Response Moderation</h3>
                                <p className="text-xs text-gray-500">Audit submitted survey answers, completion speed, and attention check passes.</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={exportSubmissionsToCSV}>
                                <Download className="w-3.5 h-3.5 mr-1" /> Export All Responses CSV
                            </Button>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-750 font-semibold border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase text-[10px]">
                                    <tr>
                                        <th className="p-3">Worker</th>
                                        <th className="p-3">Survey Title</th>
                                        <th className="p-3">Duration</th>
                                        <th className="p-3">Attention Check</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {surveySubmissions.slice(0, 20).map(sub => (
                                        <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                                            <td className="p-3 font-semibold">{sub.workerName || 'Worker'}</td>
                                            <td className="p-3 truncate max-w-xs">{sub.taskTitle || 'Survey'}</td>
                                            <td className="p-3">
                                                {sub.surveyCompletionTimeSeconds ? `${sub.surveyCompletionTimeSeconds}s` : 'N/A'}
                                            </td>
                                            <td className="p-3">
                                                {sub.attentionCheckPassed !== false ? (
                                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600 font-bold flex items-center gap-1">
                                                        <XCircle className="w-3.5 h-3.5" /> Failed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <Badge variant={sub.status === 'Approved' ? 'success' : sub.status === 'Pending' ? 'warning' : 'danger'}>
                                                    {sub.status}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button size="sm" variant="secondary" onClick={() => setSelectedSubmissionForReview(sub)}>
                                                    <Eye className="w-3.5 h-3.5 mr-1" /> View Answers
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {surveySubmissions.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-gray-500">
                                                No survey submissions recorded yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Inspect Submission Answers Modal */}
                        {selectedSubmissionForReview && (
                            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                                            Survey Answers: {selectedSubmissionForReview.workerName}
                                        </h4>
                                        <button onClick={() => setSelectedSubmissionForReview(null)}>✕</button>
                                    </div>

                                    <div className="text-xs space-y-1">
                                        <p><strong>Task:</strong> {selectedSubmissionForReview.taskTitle}</p>
                                        <p><strong>Completion Duration:</strong> {selectedSubmissionForReview.surveyCompletionTimeSeconds}s</p>
                                        <p><strong>Status:</strong> {selectedSubmissionForReview.status}</p>
                                    </div>

                                    <div className="border-t pt-2 space-y-3">
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Answers ({selectedSubmissionForReview.surveyResponses?.length || 0}):</span>
                                        <div className="space-y-2 max-h-56 overflow-y-auto">
                                            {(selectedSubmissionForReview.surveyResponses || []).map((resp: any, ri: number) => (
                                                <div key={ri} className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                                                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{resp.questionTitle || `Question ${ri + 1}`}</div>
                                                    <div className="text-blue-600 dark:text-blue-400 font-medium">
                                                        {Array.isArray(resp.value) ? resp.value.join(', ') : String(resp.value)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedSubmissionForReview.status === 'Pending' && (
                                        <div className="border-t pt-3 space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Admin review notes / rejection reason (optional)"
                                                value={reviewNotes}
                                                onChange={e => setReviewNotes(e.target.value)}
                                                className="w-full text-xs border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="danger" onClick={() => handleReviewSubmission(selectedSubmissionForReview._id, 'Rejected')}>
                                                    Reject Submission
                                                </Button>
                                                <Button size="sm" variant="success" onClick={() => handleReviewSubmission(selectedSubmissionForReview._id, 'Approved')}>
                                                    Approve & Pay Reward
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 12. REPORTS & ANALYTICS */}
                {activeSection === 'reports' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Survey Campaign Analytics & Results</h3>
                                <p className="text-xs text-gray-500">Interactive statistical summaries, answer frequency charts, and aggregates.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedCampaignForAnalytics || ''}
                                    onChange={e => {
                                        if (e.target.value) handleViewAnalytics(e.target.value);
                                    }}
                                    className="text-xs border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="">-- Select a Survey Campaign --</option>
                                    {surveyTasks.map(t => (
                                        <option key={t._id} value={t._id}>{t.title} ({t.currentCompletions || 0} responses)</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {isLoadingAnalytics && (
                            <div className="py-12 text-center text-gray-500 text-sm">
                                Loading survey results and statistical graphs...
                            </div>
                        )}

                        {analyticsData && !isLoadingAnalytics && (
                            <div className="space-y-6">
                                {/* Top Stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-750 border rounded-lg">
                                        <span className="text-[10px] uppercase font-bold text-gray-500">Total Responses</span>
                                        <div className="text-xl font-bold mt-0.5">{analyticsData.metrics?.totalSubmissions || 0}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-750 border rounded-lg">
                                        <span className="text-[10px] uppercase font-bold text-gray-500">Approved</span>
                                        <div className="text-xl font-bold mt-0.5 text-emerald-600">{analyticsData.metrics?.approvedSubmissions || 0}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-750 border rounded-lg">
                                        <span className="text-[10px] uppercase font-bold text-gray-500">Avg Duration</span>
                                        <div className="text-xl font-bold mt-0.5">{analyticsData.metrics?.averageCompletionTimeSeconds || 0}s</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-750 border rounded-lg">
                                        <span className="text-[10px] uppercase font-bold text-gray-500">Pass Rate</span>
                                        <div className="text-xl font-bold mt-0.5 text-blue-600">
                                            {analyticsData.metrics?.totalSubmissions > 0
                                                ? Math.round(((analyticsData.metrics?.attentionPassedCount || 0) / analyticsData.metrics?.totalSubmissions) * 100)
                                                : 100}%
                                        </div>
                                    </div>
                                </div>

                                {/* Question Answers Breakdown */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">Question Breakdowns</h4>
                                    {(analyticsData.questions || []).map((q: any) => (
                                        <div key={q.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/40 dark:bg-gray-800/40 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-xs font-bold text-blue-600">Q{q.order}:</span>
                                                    <h5 className="font-semibold text-xs text-gray-900 dark:text-white inline ml-1.5">{q.title}</h5>
                                                </div>
                                                <span className="text-[11px] text-gray-500">{q.totalAnswers} answers</span>
                                            </div>

                                            {/* Choice counts visualization */}
                                            {q.counts && Object.keys(q.counts).length > 0 && (
                                                <div className="space-y-2 pt-1">
                                                    {Object.entries(q.counts).map(([option, count]: [string, any]) => {
                                                        const pct = q.totalAnswers > 0 ? Math.round((count / q.totalAnswers) * 100) : 0;
                                                        return (
                                                            <div key={option} className="space-y-1">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="font-medium text-gray-700 dark:text-gray-300">{option}</span>
                                                                    <span className="text-gray-500">{count} ({pct}%)</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Numeric Average */}
                                            {q.average !== null && (
                                                <div className="pt-2 text-xs text-emerald-600 font-bold">
                                                    Average Score: {q.average} / 5
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!selectedCampaignForAnalytics && !isLoadingAnalytics && (
                            <div className="py-12 text-center text-gray-500 text-sm">
                                Please select a Survey Campaign above to view detailed response analysis.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
