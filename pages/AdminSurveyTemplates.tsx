import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { AdminSurveyTemplate, formatCurrency, User } from '../types';
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
    createUserTask,
    updateSettings,
    addAdminCampaignFunds,
    resumeAdminCampaign,
    pauseAdminCampaign,
    getUsers
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
    Pause,
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
    HelpCircle,
    Users,
    Activity,
    Wallet,
    TrendingUp,
    History
} from 'lucide-react';
import { UserTask } from '../types';

export const AdminSurveyTemplates: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings, userTasks } = state;

    // View tab state: 'templates' or 'campaigns'
    const [activeTab, setActiveTab] = useState<'templates' | 'campaigns'>('templates');

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
    const [launchRequirementMode, setLaunchRequirementMode] = useState<'optional' | 'mandatory_all' | 'mandatory_targeted' | 'mandatory_before_withdrawal'>('optional');
    const [launchMandatoryDisplayBehavior, setLaunchMandatoryDisplayBehavior] = useState<'popup_only' | 'highlighted_only' | 'both'>('popup_only');
    const [launchRecompletionPolicy, setLaunchRecompletionPolicy] = useState<'never' | 'interval'>('never');
    const [launchRecompletionIntervalDays, setLaunchRecompletionIntervalDays] = useState<number>(30);
    const [launchAudienceMode, setLaunchAudienceMode] = useState<'all' | 'selected' | 'active' | 'inactive' | 'advanced'>('all');
    const [launchSelectedUserIds, setLaunchSelectedUserIds] = useState<string>('');
    const [launchCountries, setLaunchCountries] = useState<string>('');
    const [launchCurrencies, setLaunchCurrencies] = useState<string>('');
    const [launchGenders, setLaunchGenders] = useState<string>('');
    const [launchMinAge, setLaunchMinAge] = useState<string>('');
    const [launchMaxAge, setLaunchMaxAge] = useState<string>('');
    const [launchAccountStatus, setLaunchAccountStatus] = useState<'any' | 'active' | 'inactive'>('any');

    // Searchable User Selector State
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [userSearchQuery, setUserSearchQuery] = useState<string>('');
    const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
    const [showManualIdInput, setShowManualIdInput] = useState<boolean>(false);

    const [launchResponseLimitMode, setLaunchResponseLimitMode] = useState<'unlimited' | 'limited'>('unlimited');
    const [campaignWorkersNeeded, setCampaignWorkersNeeded] = useState<number>(50);
    const [campaignRewardPerTask, setCampaignRewardPerTask] = useState<number>(0.25);
    const [campaignInitialFundingUSD, setCampaignInitialFundingUSD] = useState<number>(50);
    const [campaignLowBalanceThreshold, setCampaignLowBalanceThreshold] = useState<number>(10);
    const [setAsMandatoryWithdrawal, setSetAsMandatoryWithdrawal] = useState<boolean>(false);
    const [campaignSurveyConfig, setCampaignSurveyConfig] = useState<SurveyConfigData>({
        questions: [],
        sections: []
    });
    const [isLaunchingCampaign, setIsLaunchingCampaign] = useState<boolean>(false);

    // Campaign Funding Management Modals
    const [fundingModalTask, setFundingModalTask] = useState<UserTask | null>(null);
    const [fundingIdempotencyKey, setFundingIdempotencyKey] = useState<string>('');
    const [addFundsAmount, setAddFundsAmount] = useState<number>(50);
    const [isAddingFunds, setIsAddingFunds] = useState<boolean>(false);
    const [historyModalTask, setHistoryModalTask] = useState<UserTask | null>(null);

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

    // Sync available platform workers for searchable user selector
    useEffect(() => {
        if (state.users && state.users.length > 0) {
            setAvailableUsers(state.users);
        } else {
            getUsers().then(u => {
                if (Array.isArray(u)) setAvailableUsers(u);
            }).catch(() => {});
        }
    }, [state.users]);

    // Parse selected user IDs list
    const selectedUserIdsList = useMemo(() => {
        return launchSelectedUserIds
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean);
    }, [launchSelectedUserIds]);

    // Map of user ID to User document for fast chip lookup
    const userMap = useMemo(() => {
        const map = new Map<string, User>();
        for (const u of availableUsers) {
            if (u._id) map.set(String(u._id), u);
            if ((u as any).id) map.set(String((u as any).id), u);
        }
        return map;
    }, [availableUsers]);

    // Filter available users for searchable dropdown
    const filteredUsers = useMemo(() => {
        if (!userSearchQuery.trim()) {
            return availableUsers.slice(0, 8);
        }
        const q = userSearchQuery.toLowerCase();
        return availableUsers
            .filter(u => 
                u.username?.toLowerCase().includes(q) ||
                u.fullName?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                String(u._id).includes(q)
            )
            .slice(0, 15);
    }, [availableUsers, userSearchQuery]);

    // Toggle user selection
    const toggleSelectUser = (user: User) => {
        const id = String(user._id || (user as any).id);
        const currentList = launchSelectedUserIds
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean);
        let updated: string[];
        if (currentList.includes(id)) {
            updated = currentList.filter(uId => uId !== id);
        } else {
            updated = [...currentList, id];
        }
        setLaunchSelectedUserIds(updated.join(', '));
    };

    // Remove single user ID
    const removeSelectedUserId = (id: string) => {
        const currentList = launchSelectedUserIds
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean);
        const updated = currentList.filter(uId => uId !== id);
        setLaunchSelectedUserIds(updated.join(', '));
    };

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
        setFormSurveyConfig(template.surveyConfig ? JSON.parse(JSON.stringify(template.surveyConfig)) : { questions: [], sections: [] });
    };

    // Open Create Modal
    const handleOpenCreate = () => {
        setIsCreating(true);
        setFormName('');
        setFormDescription('');
        setFormCategory('Member Intelligence & Experience');
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

        // Validate Reward Configuration
        let safeRewardAmount = 0;

        setIsSubmittingForm(true);
        try {
            const payload: any = {
                name: formName.trim(),
                description: formDescription.trim(),
                category: formCategory.trim(),
                estimatedTimeMinutes: 5,
                rewardConfig: {
                    mode: 'no_reward',
                    amount: 0,
                    currency: 'USD'
                },
                requirementConfig: {
                    mode: 'optional'
                },
                recompletionPolicy: {
                    policy: 'never',
                    intervalDays: 30
                },
                surveyConfig: {
                    ...formSurveyConfig,
                    title: formName.trim(),
                    description: formDescription.trim(),
                    category: formCategory.trim(),
                    estimatedTimeMinutes: 5
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
        const isFree = template.rewardConfig?.mode === 'no_reward';
        const initialReward = isFree ? 0 : (template.rewardConfig?.amount !== undefined && Number.isFinite(Number(template.rewardConfig.amount)) ? Number(template.rewardConfig.amount) : 0.25);
        setCampaignRewardPerTask(initialReward);
        const reqMode = (template.requirementConfig?.mode || 'optional') as any;
        setLaunchRequirementMode(reqMode);
        setLaunchMandatoryDisplayBehavior(template.requirementConfig?.mandatoryDisplayBehavior || 'popup_only');
        setLaunchRecompletionPolicy(template.recompletionPolicy?.policy || 'never');
        setLaunchRecompletionIntervalDays(template.recompletionPolicy?.intervalDays || 30);
        setSetAsMandatoryWithdrawal(reqMode === 'mandatory_before_withdrawal');
        setLaunchResponseLimitMode('unlimited');
        setCampaignWorkersNeeded(50);
        setCampaignInitialFundingUSD(initialReward > 0 ? Number((initialReward * 50).toFixed(2)) : 0);
        setCampaignLowBalanceThreshold(10);
        
        const tmplTargeting = (template as any).targeting;
        if (reqMode === 'mandatory_all') {
            setLaunchAudienceMode('all');
        } else if (reqMode === 'mandatory_targeted') {
            if (tmplTargeting?.accountStatus === 'active') {
                setLaunchAudienceMode('active');
            } else if (tmplTargeting?.accountStatus === 'inactive') {
                setLaunchAudienceMode('inactive');
            } else if (Array.isArray(tmplTargeting?.selectedUserIds) && tmplTargeting.selectedUserIds.length > 0) {
                setLaunchAudienceMode('selected');
            } else {
                setLaunchAudienceMode('advanced');
            }
        } else {
            setLaunchAudienceMode('all');
        }

        setLaunchSelectedUserIds(Array.isArray(tmplTargeting?.selectedUserIds) ? tmplTargeting.selectedUserIds.join(', ') : '');
        setLaunchCountries(Array.isArray(tmplTargeting?.countries) ? tmplTargeting.countries.join(', ') : '');
        setLaunchCurrencies(Array.isArray(tmplTargeting?.currencies) ? tmplTargeting.currencies.join(', ') : '');
        setLaunchGenders(Array.isArray(tmplTargeting?.genders) ? tmplTargeting.genders.join(', ') : '');
        setLaunchMinAge(tmplTargeting?.minAge !== null && tmplTargeting?.minAge !== undefined ? String(tmplTargeting.minAge) : '');
        setLaunchMaxAge(tmplTargeting?.maxAge !== null && tmplTargeting?.maxAge !== undefined ? String(tmplTargeting.maxAge) : '');
        setLaunchAccountStatus(tmplTargeting?.accountStatus || 'any');
        setUserSearchQuery('');
        setShowUserDropdown(false);
        setShowManualIdInput(false);
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

        const isUnlimited = launchResponseLimitMode === 'unlimited';
        const isZeroReward = safeReward === 0;
        let totalBudget = 0;
        let initialFundingUSD = 0;

        if (isUnlimited) {
            if (isZeroReward) {
                totalBudget = 0;
                initialFundingUSD = 0;
            } else {
                initialFundingUSD = Number(campaignInitialFundingUSD);
                if (isNaN(initialFundingUSD) || initialFundingUSD <= 0) {
                    alert('Please specify a positive initial funding budget for this paid unlimited survey.');
                    return;
                }
                totalBudget = initialFundingUSD;
            }
        } else {
            if (campaignWorkersNeeded <= 0) {
                alert('Workers needed must be at least 1.');
                return;
            }
            totalBudget = isZeroReward ? 0 : Number((safeReward * campaignWorkersNeeded).toFixed(2));
        }

        setIsLaunchingCampaign(true);
        try {
            // Determine effective requirement mode with backward compatibility
            const isMandatoryWithdrawal = launchRequirementMode === 'mandatory_before_withdrawal' || Boolean(setAsMandatoryWithdrawal);
            const effectiveRequirementMode = isMandatoryWithdrawal
                ? 'mandatory_before_withdrawal'
                : launchRequirementMode;
            const isMandatoryForAll = effectiveRequirementMode === 'mandatory_all';
            const isMandatoryTargeted = effectiveRequirementMode === 'mandatory_targeted';

            // Build targeting payload
            let targetingPayload: any = undefined;
            if (isMandatoryForAll) {
                // Mandatory for All: applies dynamically to all eligible platform workers (never static snapshot)
                targetingPayload = undefined;
            } else if (launchAudienceMode === 'selected') {
                const selectedIds = launchSelectedUserIds
                    .split(/[\n,]+/)
                    .map(s => s.trim())
                    .filter(Boolean);
                if (isMandatoryTargeted && selectedIds.length === 0) {
                    alert('Mandatory for Targeted Users requires selecting at least one user.');
                    setIsLaunchingCampaign(false);
                    return;
                }
                targetingPayload = { selectedUserIds: selectedIds };
            } else if (launchAudienceMode === 'active') {
                targetingPayload = { accountStatus: 'active' };
            } else if (launchAudienceMode === 'inactive') {
                targetingPayload = { accountStatus: 'inactive' };
            } else if (launchAudienceMode === 'advanced') {
                const tmplTargeting = (usingTemplate as any).targeting || {};
                targetingPayload = {
                    countries: launchCountries ? launchCountries.split(',').map(s => s.trim()).filter(Boolean) : [],
                    currencies: launchCurrencies ? launchCurrencies.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [],
                    genders: launchGenders ? launchGenders.split(',').map(s => s.trim()).filter(Boolean) : [],
                    minAge: launchMinAge === '' ? null : Number(launchMinAge),
                    maxAge: launchMaxAge === '' ? null : Number(launchMaxAge),
                    accountStatus: launchAccountStatus,
                    completionRules: tmplTargeting.completionRules || [],
                    profileRules: tmplTargeting.profileRules || [],
                    surveyAnswerRules: tmplTargeting.surveyAnswerRules || []
                };

                if (isMandatoryTargeted) {
                    const hasRule = 
                        targetingPayload.countries.length > 0 ||
                        targetingPayload.currencies.length > 0 ||
                        targetingPayload.genders.length > 0 ||
                        targetingPayload.minAge !== null ||
                        targetingPayload.maxAge !== null ||
                        targetingPayload.accountStatus === 'active' ||
                        targetingPayload.accountStatus === 'inactive' ||
                        (targetingPayload.completionRules && targetingPayload.completionRules.length > 0) ||
                        (targetingPayload.profileRules && targetingPayload.profileRules.length > 0) ||
                        (targetingPayload.surveyAnswerRules && targetingPayload.surveyAnswerRules.length > 0);
                    if (!hasRule) {
                        alert('Mandatory for Targeted Users requires at least one targeting rule (e.g. country, account status, age range, etc.).');
                        setIsLaunchingCampaign(false);
                        return;
                    }
                }
            } else {
                // 'all'
                targetingPayload = undefined;
            }

            const userTaskPayload = {
                title: campaignTitle.trim(),
                description: campaignDescription.trim(),
                category: 'Surveys',
                taskCategory: 'Surveys',
                subType: usingTemplate.category || 'Opinion Poll',
                rewardPerTask: safeReward,
                isUnlimitedResponses: isUnlimited,
                initialFundingUSD: isUnlimited ? initialFundingUSD : undefined,
                lowBalanceThresholdPercent: campaignLowBalanceThreshold,
                workersNeeded: isUnlimited ? 0 : Number(campaignWorkersNeeded),
                targetQuantity: isUnlimited ? 0 : Number(campaignWorkersNeeded),
                totalBudget: totalBudget,
                isSurvey: true,
                isSurveyCampaign: true,
                isAdminResearchSurvey: true,
                requirementMode: effectiveRequirementMode,
                recompletionPolicy: {
                    policy: launchRecompletionPolicy,
                    intervalDays: launchRecompletionPolicy === 'interval' ? Number(launchRecompletionIntervalDays) : 30
                },
                mandatoryDisplayBehavior: (effectiveRequirementMode === 'mandatory_all' || effectiveRequirementMode === 'mandatory_targeted') ? launchMandatoryDisplayBehavior : 'popup_only',
                isMandatoryForAllUsers: isMandatoryForAll,
                sourceAdminSurveyTemplateId: usingTemplate._id,
                publishNow: true,
                targeting: targetingPayload,
                surveyCategory: usingTemplate.category || 'General Opinion Poll',
                surveyEstimatedMinutes: usingTemplate.estimatedTimeMinutes || 5,
                surveyQuestionsCount: campaignSurveyConfig.questions?.length || 0,
                surveyApprovalMode: (campaignSurveyConfig as any).approvalMode || 'auto',
                surveyConfig: {
                    ...campaignSurveyConfig,
                    title: campaignTitle.trim(),
                    description: campaignDescription.trim()
                },
                requiredProofs: [
                    {
                        type: 'text',
                        label: 'Survey Completion Confirmation',
                        instruction: 'Complete the integrated survey questionnaire. Answers are recorded automatically.',
                        required: true
                    }
                ],
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

            const result: any = await createUserTask(userTaskPayload);
            const createdTask: any = result?.task || result;
            dispatch({ type: 'ADD_USER_TASK', payload: createdTask });
            if (result?.user) dispatch({ type: 'UPDATE_USER', payload: result.user });
            if (result?.settings) dispatch({ type: 'UPDATE_SETTINGS', payload: result.settings });

            let mandatoryActivatedSuccessfully = false;
            let mandatoryErrorMessage: string | null = null;

            // If selected to be mandatory withdrawal requirement, safely update System Settings with the new UserTask ID using partial payload
            if (isMandatoryWithdrawal && createdTask?._id) {
                try {
                    const partialSettingsPayload = {
                        mandatoryWithdrawalRequirement: {
                            enabled: true,
                            requiredTaskId: String(createdTask._id),
                            requiredTaskVersion: Number(createdTask.surveyVersion || createdTask.surveyConfig?.version || 1),
                            requirementType: 'survey' as const
                        }
                    };
                    const settingsRes = await updateSettings(partialSettingsPayload);
                    dispatch({ type: 'UPDATE_SETTINGS', payload: settingsRes });
                    mandatoryActivatedSuccessfully = true;
                } catch (sErr: any) {
                    console.error('Failed to update mandatory withdrawal requirement setting on launch:', sErr);
                    mandatoryErrorMessage = sErr?.message || 'Settings update failed';
                }
            }

            setUsingTemplate(null);
            if (isMandatoryWithdrawal) {
                if (mandatoryActivatedSuccessfully) {
                    setSuccessMessage(`Survey campaign "${campaignTitle}" created, published, and successfully activated as the Mandatory Withdrawal Requirement!`);
                } else {
                    alert(`Survey was created successfully, but the Mandatory Withdrawal Requirement could not be activated (${mandatoryErrorMessage || 'Settings save failed'}). Please configure it manually from Task Settings.`);
                    setSuccessMessage(`Survey campaign "${campaignTitle}" created successfully. (Notice: Mandatory Withdrawal activation failed. Configure manually from Task Settings.)`);
                }
            } else if (isMandatoryForAll) {
                setSuccessMessage(`Survey campaign "${campaignTitle}" created and published as a Platform-Wide Mandatory Requirement for all users!`);
            } else if (isMandatoryTargeted) {
                setSuccessMessage(`Survey campaign "${campaignTitle}" created and published as a Mandatory Requirement for targeted users!`);
            } else {
                setSuccessMessage(`Survey campaign "${campaignTitle}" created and published successfully as an Admin Research Survey!`);
            }
        } catch (err: any) {
            alert(err.message || 'Failed to create campaign from template');
        } finally {
            setIsLaunchingCampaign(false);
        }
    };

    // Campaign Action Handlers
    const handleAddFundsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fundingModalTask) return;
        if (addFundsAmount <= 0) {
            alert('Please enter a valid positive amount.');
            return;
        }

        const keyToSend = fundingIdempotencyKey || `admin_fund_${fundingModalTask._id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        if (!fundingIdempotencyKey) {
            setFundingIdempotencyKey(keyToSend);
        }

        setIsAddingFunds(true);
        try {
            const res = await addAdminCampaignFunds(fundingModalTask._id, addFundsAmount, keyToSend);
            dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
            if (res.settings) dispatch({ type: 'UPDATE_SETTINGS', payload: res.settings });
            setSuccessMessage(`Successfully added $${addFundsAmount.toFixed(2)} USD to campaign "${fundingModalTask.title}"!`);
            setFundingModalTask(null);
            setFundingIdempotencyKey('');
        } catch (err: any) {
            alert(err.message || 'Failed to add funds.');
        } finally {
            setIsAddingFunds(false);
        }
    };

    const handleResumeCampaign = async (task: UserTask) => {
        try {
            const res = await resumeAdminCampaign(task._id);
            dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
            setSuccessMessage(`Campaign "${task.title}" has been resumed!`);
        } catch (err: any) {
            alert(err.message || 'Failed to resume campaign.');
        }
    };

    const handlePauseCampaign = async (task: UserTask) => {
        try {
            const res = await pauseAdminCampaign(task._id);
            dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
            setSuccessMessage(`Campaign "${task.title}" has been paused.`);
        } catch (err: any) {
            alert(err.message || 'Failed to pause campaign.');
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
                                                {template.rewardConfig?.mode === 'custom' && `Custom: $${(template.rewardConfig?.amount || 0).toFixed(2)}`}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Requirement</span>
                                            <span className="font-bold text-amber-600 dark:text-amber-400 truncate block">
                                                {template.requirementConfig?.mode === 'optional' && 'Optional'}
                                                {template.requirementConfig?.mode === 'mandatory_all' && 'Mandatory (All)'}
                                                {template.requirementConfig?.mode === 'mandatory_targeted' && 'Mandatory (Targeted)'}
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
                                    {previewTemplate.rewardConfig?.mode === 'no_reward' && 'No Reward ($0.00)'}
                                    {previewTemplate.rewardConfig?.mode === 'fixed' && `Fixed ($${(previewTemplate.rewardConfig?.amount || 0).toFixed(2)})`}
                                    {previewTemplate.rewardConfig?.mode === 'custom' && `Custom ($${(previewTemplate.rewardConfig?.amount || 0).toFixed(2)})`}
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
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                        Use Template Flow
                                    </span>
                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                        Requirement: {usingTemplate.requirementConfig?.mode === 'mandatory_all' ? 'Mandatory for All Users' : usingTemplate.requirementConfig?.mode === 'mandatory_targeted' ? 'Mandatory for Targeted Users' : usingTemplate.requirementConfig?.mode === 'mandatory_before_withdrawal' ? 'Pre-Withdrawal' : 'Optional'}
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

                                {/* Requirement Mode Section (Phase 2) */}
                                <div className="md:col-span-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                                                Requirement Mode *
                                            </label>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400">
                                            Determines Work &amp; Earn access gating
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                        {/* A. Optional */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLaunchRequirementMode('optional');
                                                setSetAsMandatoryWithdrawal(false);
                                            }}
                                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                launchRequirementMode === 'optional' && !setAsMandatoryWithdrawal
                                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                                        Optional
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                        Voluntary
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                                                    Normal survey. Does not block normal Work &amp; Earn access.
                                                </p>
                                            </div>
                                            {launchRequirementMode === 'optional' && !setAsMandatoryWithdrawal && (
                                                <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                                                    <Check className="w-3 h-3" /> Selected
                                                </div>
                                            )}
                                        </button>

                                        {/* B. Mandatory for All Users */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLaunchRequirementMode('mandatory_all');
                                                setLaunchAudienceMode('all');
                                                setSetAsMandatoryWithdrawal(false);
                                            }}
                                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                launchRequirementMode === 'mandatory_all' && !setAsMandatoryWithdrawal
                                                    ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 shadow-sm ring-1 ring-amber-500'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">
                                                        Mandatory (All)
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                                                        Platform-Wide
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                                                    Applies dynamically to all eligible platform workers (current and future).
                                                </p>
                                            </div>
                                            {launchRequirementMode === 'mandatory_all' && !setAsMandatoryWithdrawal && (
                                                <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400">
                                                    <Check className="w-3 h-3" /> Selected
                                                </div>
                                            )}
                                        </button>

                                        {/* C. Mandatory for Targeted Users */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLaunchRequirementMode('mandatory_targeted');
                                                if (launchAudienceMode === 'all') {
                                                    setLaunchAudienceMode('selected');
                                                }
                                                setSetAsMandatoryWithdrawal(false);
                                            }}
                                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                launchRequirementMode === 'mandatory_targeted' && !setAsMandatoryWithdrawal
                                                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 shadow-sm ring-1 ring-purple-500'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-black text-purple-900 dark:text-purple-200 uppercase tracking-tight">
                                                        Mandatory (Targeted)
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100">
                                                        Targeted Gate
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                                                    Only users matching selected targeting rules are required. Non-matching users are not affected.
                                                </p>
                                            </div>
                                            {launchRequirementMode === 'mandatory_targeted' && !setAsMandatoryWithdrawal && (
                                                <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-purple-600 dark:text-purple-400">
                                                    <Check className="w-3 h-3" /> Selected
                                                </div>
                                            )}
                                        </button>

                                        {/* D. Mandatory Before Withdrawal */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLaunchRequirementMode('mandatory_before_withdrawal');
                                                setSetAsMandatoryWithdrawal(true);
                                            }}
                                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                launchRequirementMode === 'mandatory_before_withdrawal' || setAsMandatoryWithdrawal
                                                    ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 shadow-sm ring-1 ring-rose-500'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-tight">
                                                        Pre-Withdrawal
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100">
                                                        Withdrawal Gate
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                                                    Preserves withdrawal-specific requirement. Does not block normal Work &amp; Earn access.
                                                </p>
                                            </div>
                                            {(launchRequirementMode === 'mandatory_before_withdrawal' || setAsMandatoryWithdrawal) && (
                                                <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-rose-600 dark:text-rose-400">
                                                    <Check className="w-3 h-3" /> Selected
                                                </div>
                                            )}
                                        </button>
                                    </div>

                                    {(launchRequirementMode === 'mandatory_all' || launchRequirementMode === 'mandatory_targeted') && (
                                        <div className="mt-3 p-3.5 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                                            <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                                                Mandatory Display Behavior *
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {[
                                                    { id: 'popup_only', label: 'Popup Only', desc: 'Modal popup when pending' },
                                                    { id: 'highlighted_only', label: 'Highlighted Only', desc: 'Highlighted list task, no popup' },
                                                    { id: 'both', label: 'Both', desc: 'Popup + Highlighted list task' }
                                                ].map(b => (
                                                    <button
                                                        key={b.id}
                                                        type="button"
                                                        onClick={() => setLaunchMandatoryDisplayBehavior(b.id as any)}
                                                        className={`p-2.5 rounded-xl border text-left transition-all ${
                                                            launchMandatoryDisplayBehavior === b.id
                                                                ? 'bg-amber-500/20 border-amber-500 text-amber-900 dark:text-amber-200 font-bold shadow-sm'
                                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        <div className="text-xs font-black uppercase">{b.label}</div>
                                                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{b.desc}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Target Audience Section */}
                                <div className="md:col-span-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                                                Target Audience
                                            </label>
                                        </div>

                                        {/* Audience Mode Buttons */}
                                        {launchRequirementMode === 'mandatory_all' ? (
                                            <span className="px-2.5 py-1 text-[11px] font-black uppercase rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                All Users (Dynamic Platform-Wide)
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {launchRequirementMode !== 'mandatory_targeted' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setLaunchAudienceMode('all')}
                                                        className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all ${
                                                            launchAudienceMode === 'all'
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        All Users
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setLaunchAudienceMode('selected')}
                                                    className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all ${
                                                        launchAudienceMode === 'selected'
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    Selected Users
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLaunchAudienceMode('active')}
                                                    className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all ${
                                                        launchAudienceMode === 'active'
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    Active Users
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLaunchAudienceMode('inactive')}
                                                    className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all ${
                                                        launchAudienceMode === 'inactive'
                                                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    Inactive Users
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLaunchAudienceMode('advanced')}
                                                    className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all ${
                                                        launchAudienceMode === 'advanced'
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    Advanced Targeting
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 1. All Users (Mandatory All or Normal All) */}
                                    {(launchRequirementMode === 'mandatory_all' || launchAudienceMode === 'all') && (
                                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-indigo-900 dark:text-indigo-300">
                                            <p className="font-bold flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5" /> All Users Targeting:
                                            </p>
                                            <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                                                {launchRequirementMode === 'mandatory_all'
                                                    ? 'Applies dynamically to all eligible platform workers (current and future). Does not create a static user snapshot or require selected user IDs.'
                                                    : 'Available to all eligible platform workers without demographic restrictions. No restrictive targeting object will be attached.'}
                                            </p>
                                        </div>
                                    )}

                                    {/* 2. Selected Users - Searchable Selector */}
                                    {launchRequirementMode !== 'mandatory_all' && launchAudienceMode === 'selected' && (
                                        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                                                    Search &amp; Select Workers
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowManualIdInput(!showManualIdInput)}
                                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                                >
                                                    {showManualIdInput ? 'Hide Raw ID Entry' : 'Direct ID / Bulk Paste'}
                                                </button>
                                            </div>

                                            {/* Search input with live autocomplete dropdown */}
                                            <div className="relative">
                                                <div className="relative flex items-center">
                                                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        value={userSearchQuery}
                                                        onChange={(e) => {
                                                            setUserSearchQuery(e.target.value);
                                                            setShowUserDropdown(true);
                                                        }}
                                                        onFocus={() => setShowUserDropdown(true)}
                                                        placeholder="Search workers by username, full name, or email..."
                                                        className="w-full pl-9 pr-8 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    {userSearchQuery && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setUserSearchQuery('')}
                                                            className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Autocomplete Dropdown */}
                                                {showUserDropdown && (
                                                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50">
                                                        <div className="p-1.5 flex items-center justify-between text-[10px] font-bold text-gray-400 bg-gray-50/80 dark:bg-gray-900/50">
                                                            <span>Found {filteredUsers.length} workers</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowUserDropdown(false)}
                                                                className="hover:text-gray-600 dark:hover:text-gray-200"
                                                            >
                                                                Close
                                                            </button>
                                                        </div>
                                                        {filteredUsers.length === 0 ? (
                                                            <div className="p-3 text-center text-xs text-gray-500">
                                                                No matching workers found.
                                                            </div>
                                                        ) : (
                                                            filteredUsers.map(u => {
                                                                const uId = String(u._id || (u as any).id);
                                                                const isSelected = selectedUserIdsList.includes(uId);
                                                                return (
                                                                    <div
                                                                        key={uId}
                                                                        onClick={() => toggleSelectUser(u)}
                                                                        className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                                                            isSelected
                                                                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100/70'
                                                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-black text-[10px] flex items-center justify-center shrink-0">
                                                                                {(u.username || 'U')[0].toUpperCase()}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                                                                                        @{u.username}
                                                                                    </span>
                                                                                    {u.fullName && (
                                                                                        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                                                            {u.fullName}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                                                                    {u.email && <span className="truncate">{u.email}</span>}
                                                                                    {u.country && <span>• {u.country}</span>}
                                                                                    {u.status && (
                                                                                        <span className={`font-bold ${u.status === 'Active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                                            • {u.status}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="shrink-0">
                                                                            {isSelected ? (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                                                                                    <Check className="w-3 h-3" /> Added
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-600 hover:text-white transition-colors">
                                                                                    + Add
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Selected Chips */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black uppercase text-gray-600 dark:text-gray-400">
                                                        Selected Workers ({selectedUserIdsList.length})
                                                    </span>
                                                    {selectedUserIdsList.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setLaunchSelectedUserIds('')}
                                                            className="text-[10px] font-bold text-rose-500 hover:underline"
                                                        >
                                                            Clear All
                                                        </button>
                                                    )}
                                                </div>

                                                {selectedUserIdsList.length === 0 ? (
                                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-center text-xs text-gray-400">
                                                        No workers selected yet. Search above to add specific users.
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                        {selectedUserIdsList.map(id => {
                                                            const u = userMap.get(id);
                                                            return (
                                                                <span
                                                                    key={id}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                                                                >
                                                                    <span>@{u?.username || id.slice(-6)}</span>
                                                                    {u?.fullName && (
                                                                        <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">
                                                                            ({u.fullName})
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeSelectedUserId(id)}
                                                                        className="hover:text-rose-500 transition-colors ml-0.5"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Manual ID Input fallback */}
                                            {showManualIdInput && (
                                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                                                    <label className="block text-[10px] font-bold uppercase text-gray-500">
                                                        Direct User IDs (Comma or Newline separated)
                                                    </label>
                                                    <textarea
                                                        rows={2}
                                                        value={launchSelectedUserIds}
                                                        onChange={(e) => setLaunchSelectedUserIds(e.target.value)}
                                                        placeholder="64abc123456..., 64def789012..."
                                                        className="w-full px-2.5 py-1.5 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 3. Active Users */}
                                    {launchRequirementMode !== 'mandatory_all' && launchAudienceMode === 'active' && (
                                        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-300 space-y-1">
                                            <div className="flex items-center gap-1.5 font-bold">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                Target Audience: Active Accounts Only
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Automatically targets workers with an active account status (<code className="px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-mono text-[10px]">targeting.accountStatus = "active"</code>). Inactive or suspended accounts will not be affected.
                                            </p>
                                        </div>
                                    )}

                                    {/* 4. Inactive Users */}
                                    {launchRequirementMode !== 'mandatory_all' && launchAudienceMode === 'inactive' && (
                                        <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-300 space-y-1">
                                            <div className="flex items-center gap-1.5 font-bold">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                Target Audience: Inactive Accounts Only
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Automatically targets workers with an inactive account status (<code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-mono text-[10px]">targeting.accountStatus = "inactive"</code>). Active accounts will not be affected.
                                            </p>
                                        </div>
                                    )}

                                    {/* 5. Advanced Targeting Form */}
                                    {launchRequirementMode !== 'mandatory_all' && launchAudienceMode === 'advanced' && (
                                        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1">
                                                        Countries (ISO Codes)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={launchCountries}
                                                        onChange={(e) => setLaunchCountries(e.target.value)}
                                                        placeholder="e.g. US, PK, IN, GB (comma-separated)"
                                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1">
                                                        Currencies
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={launchCurrencies}
                                                        onChange={(e) => setLaunchCurrencies(e.target.value)}
                                                        placeholder="e.g. USD, EUR, PKR (comma-separated)"
                                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs uppercase"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1">
                                                        Gender
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={launchGenders}
                                                        onChange={(e) => setLaunchGenders(e.target.value)}
                                                        placeholder="e.g. Male, Female (comma-separated)"
                                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1">
                                                        Account Status
                                                    </label>
                                                    <select
                                                        value={launchAccountStatus}
                                                        onChange={(e) => setLaunchAccountStatus(e.target.value as 'any' | 'active' | 'inactive')}
                                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                                    >
                                                        <option value="any">Any Status (Active or Inactive)</option>
                                                        <option value="active">Active Only</option>
                                                        <option value="inactive">Inactive Only</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1">
                                                        Minimum Age
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={13}
                                                        max={120}
                                                        value={launchMinAge}
                                                        onChange={(e) => setLaunchMinAge(e.target.value)}
                                                        placeholder="e.g. 18 (leave blank for none)"
                                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-black uppercase text-gray-600 dark:text-gray-300 mb-1">
                                                        Maximum Age
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={13}
                                                        max={120}
                                                        value={launchMaxAge}
                                                        onChange={(e) => setLaunchMaxAge(e.target.value)}
                                                        placeholder="e.g. 65 (leave blank for none)"
                                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-gray-500 block">
                                                Filters are applied dynamically by the server targeting engine. Leaving a field blank means no restriction is applied for that criteria.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-3">
                                    <div className="mb-3">
                                        <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1">
                                            Est. Minutes *
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={usingTemplate?.estimatedTimeMinutes || 5}
                                            readOnly
                                            className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-xs font-bold text-gray-500"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-1 block">
                                            Estimated time based on template configuration.
                                        </span>
                                    </div>

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

                            {/* Re-Completion Policy */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700 space-y-3">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1">
                                        Re-Completion Policy
                                    </label>
                                    <select
                                        value={launchRecompletionPolicy}
                                        onChange={(e) => setLaunchRecompletionPolicy(e.target.value as 'never' | 'interval')}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                    >
                                        <option value="never">Never (Once Only)</option>
                                        <option value="interval">Allow Re-Completion After Interval</option>
                                    </select>
                                </div>
                                {launchRecompletionPolicy === 'interval' && (
                                    <div>
                                        <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-300 mb-1">
                                            Re-completion Interval (Days)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={launchRecompletionIntervalDays}
                                            onChange={(e) => setLaunchRecompletionIntervalDays(Number(e.target.value))}
                                            className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold font-mono"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Mandatory Withdrawal Requirement Toggle */}
                            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <span className="text-xs font-black uppercase text-amber-900 dark:text-amber-300 block">
                                            Set as Active Mandatory Withdrawal Requirement
                                        </span>
                                        <p className="text-[11px] text-amber-800/80 dark:text-amber-400 mt-0.5">
                                            When enabled, members cannot withdraw Work &amp; Earn funds until they have completed and obtained an Approved submission for this survey.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input 
                                            type="checkbox" 
                                            checked={setAsMandatoryWithdrawal || launchRequirementMode === 'mandatory_before_withdrawal'} 
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setSetAsMandatoryWithdrawal(checked);
                                                if (checked) {
                                                    setLaunchRequirementMode('mandatory_before_withdrawal');
                                                } else if (launchRequirementMode === 'mandatory_before_withdrawal') {
                                                    setLaunchRequirementMode('optional');
                                                }
                                            }}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                                    </label>
                                </div>

                                {(setAsMandatoryWithdrawal || launchRequirementMode === 'mandatory_before_withdrawal') && (
                                    <div className="p-3 bg-white/90 dark:bg-gray-900/90 rounded-xl border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
                                        <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            Single Active Requirement Model:
                                        </p>
                                        <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                                            Only one Mandatory Withdrawal Requirement can be active at a time. Activating this survey will replace the currently active requirement.
                                        </p>
                                        {settings?.mandatoryWithdrawalRequirement?.enabled && settings.mandatoryWithdrawalRequirement.requiredTaskId && (
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2">
                                                <span>Currently Active Prerequisite:</span>
                                                <span className="font-mono font-bold text-gray-700 dark:text-gray-300 truncate max-w-[240px]">
                                                    ID {String(settings.mandatoryWithdrawalRequirement.requiredTaskId)} (v{settings.mandatoryWithdrawalRequirement.requiredTaskVersion || 1})
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
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
