import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { WorkAndEarnWithdrawalRule, WithdrawalRuleType, RuleEvaluationLog, WorkAndEarnPayoutTierConfig } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { updateSettings } from '../services/api';
import { DEFAULT_WITHDRAWAL_RULES, DEFAULT_PAYOUT_TIER_CONFIG } from '../utils/withdrawalRuleEngine';
import { useNavigate } from 'react-router-dom';

const RULE_TYPE_OPTIONS: { type: WithdrawalRuleType; label: string; description: string; defaultIcon: string }[] = [
    { type: 'investment_plan_requirement', label: '11. Investment Plan Requirement', description: 'Requires an active eligible Investment Plan before withdrawing.', defaultIcon: '💎' },
    { type: 'first_withdrawal', label: '1. First Withdrawal', description: 'Triggers on user\'s 1st withdrawal attempt.', defaultIcon: '🥇' },
    { type: 'second_withdrawal', label: '2. Second Withdrawal', description: 'Triggers on user\'s 2nd withdrawal attempt.', defaultIcon: '🥈' },
    { type: 'third_withdrawal', label: '3. Third Withdrawal', description: 'Triggers on user\'s 3rd withdrawal attempt.', defaultIcon: '🥉' },
    { type: 'every_nth_withdrawal', label: '4. Every Nth Withdrawal', description: 'Triggers periodically on every Nth withdrawal (e.g. every 5th).', defaultIcon: '🔄' },
    { type: 'after_x_total_earnings', label: '5. After X Total Earnings', description: 'Triggers when total task/hub earnings reach minimum USD.', defaultIcon: '💵' },
    { type: 'after_x_successful_withdrawals', label: '6. After X Successful Withdrawals', description: 'Triggers when approved withdrawals reach minimum threshold.', defaultIcon: '✅' },
    { type: 'after_x_campaigns_completed', label: '7. After X Campaigns Created/Completed', description: 'Triggers when user completes or posts X campaigns.', defaultIcon: '🚀' },
    { type: 'after_x_tasks_completed', label: '8. After X Tasks Completed', description: 'Triggers when user completes X micro-tasks.', defaultIcon: '📋' },
    { type: 'account_age_requirement', label: '9. Account Age Requirement', description: 'Requires account age to be at least X days old.', defaultIcon: '⏳' },
    { type: 'kyc_requirement', label: '10. KYC Requirement', description: 'Requires verified identity (KYC Approved) before withdrawal.', defaultIcon: '🪪' },
    { type: 'minimum_referral_requirement', label: '12. Minimum Referral Requirement', description: 'Requires a minimum number of direct active referrals.', defaultIcon: '👥' },
    { type: 'manual_admin_approval_requirement', label: '13. Manual Admin Approval Requirement', description: 'Blocks automated processing and requires manual admin review.', defaultIcon: '🛡️' },
    { type: 'wallet_balance_requirement', label: '14. Wallet Balance Requirement', description: 'Triggers based on minimum main wallet or task wallet balance.', defaultIcon: '👛' },
    { type: 'custom', label: '15. Custom Rule (Future-Ready)', description: 'Generic custom condition rule for specialized business logic.', defaultIcon: '⚙️' }
];

const AdminWithdrawalRules: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings, investmentPlans = [] } = state;
    const navigate = useNavigate();

    // Local rules state from settings or default
    const [rules, setRules] = useState<WorkAndEarnWithdrawalRule[]>(() => {
        return settings.workAndEarnWithdrawalRules && settings.workAndEarnWithdrawalRules.length > 0 
            ? settings.workAndEarnWithdrawalRules 
            : DEFAULT_WITHDRAWAL_RULES;
    });

    // Local Payout Tier Config state
    const [payoutConfig, setPayoutConfig] = useState<WorkAndEarnPayoutTierConfig>(() => {
        return settings.workAndEarnPayoutTierConfig || DEFAULT_PAYOUT_TIER_CONFIG;
    });

    // Local text state for custom milestone payout amounts input
    const [manualPayoutInput, setManualPayoutInput] = useState<string>(() => {
        const initial = settings.workAndEarnPayoutTierConfig?.manualPayoutAmountsUSD || DEFAULT_PAYOUT_TIER_CONFIG.manualPayoutAmountsUSD || [];
        return initial.join(', ');
    });

    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Synchronize local states when settings load from API
    useEffect(() => {
        if (settings.workAndEarnWithdrawalRules && settings.workAndEarnWithdrawalRules.length > 0) {
            setRules(settings.workAndEarnWithdrawalRules);
        }
        if (settings.workAndEarnPayoutTierConfig) {
            setPayoutConfig(settings.workAndEarnPayoutTierConfig);
            setManualPayoutInput((settings.workAndEarnPayoutTierConfig.manualPayoutAmountsUSD || []).join(', '));
        }
    }, [settings.workAndEarnWithdrawalRules, settings.workAndEarnPayoutTierConfig]);

    // Modal Editor State
    const [editingRule, setEditingRule] = useState<WorkAndEarnWithdrawalRule | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'rules' | 'payout_tiers' | 'logs'>('rules');

    // Rule Logs state
    const evaluationLogs: RuleEvaluationLog[] = settings.ruleEvaluationLogs || [];

    const handleSaveRules = async (rulesToSave = rules, configToSave = payoutConfig) => {
        setIsSaving(true);
        try {
            const updatedSettings = await updateSettings({
                ...settings,
                workAndEarnWithdrawalRules: rulesToSave,
                workAndEarnPayoutTierConfig: configToSave
            });
            dispatch({ type: 'UPDATE_SETTINGS', payload: updatedSettings });
            setSuccessMessage("✅ Work & Earn withdrawal rules & payout tier configurations updated successfully!");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (error) {
            alert(`Failed to save rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenCreateModal = () => {
        const newRule: WorkAndEarnWithdrawalRule = {
            id: 'rule_' + Date.now(),
            name: 'New Conditional Rule',
            description: 'Custom withdrawal condition rule.',
            ruleType: 'second_withdrawal',
            enabled: true,
            priority: rules.length + 1,
            isMandatory: true,
            targetUserGroup: 'all',
            triggerConfig: {
                withdrawalNumber: 2
            },
            requirementConfig: {
                requireActiveInvestmentPlan: true,
                planSelectionType: 'any',
                minPlanAmountUSD: 0
            },
            notificationConfig: {
                title: 'Investment Plan Required',
                message: 'To continue with your next withdrawal, you must first activate an eligible Investment Plan in the Investment Module.',
                primaryActionButtonText: 'View Investment Plans',
                primaryActionUrl: '/member/plans',
                secondaryActionButtonText: 'Transfer Balance',
                secondaryActionUrl: '/member/transfer'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setEditingRule(newRule);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (rule: WorkAndEarnWithdrawalRule) => {
        setEditingRule(JSON.parse(JSON.stringify(rule)));
        setIsModalOpen(true);
    };

    const handleSaveRuleModal = () => {
        if (!editingRule) return;
        if (!editingRule.name.trim()) {
            return alert('Please enter a rule name.');
        }

        const existingIdx = rules.findIndex(r => r.id === editingRule.id);
        let nextRules: WorkAndEarnWithdrawalRule[];
        if (existingIdx >= 0) {
            nextRules = [...rules];
            nextRules[existingIdx] = { ...editingRule, updatedAt: new Date().toISOString() };
        } else {
            nextRules = [...rules, { ...editingRule, updatedAt: new Date().toISOString() }];
        }

        nextRules.sort((a, b) => a.priority - b.priority);
        setRules(nextRules);
        setIsModalOpen(false);
        setEditingRule(null);
        handleSaveRules(nextRules);
    };

    const handleDeleteRule = (id: string) => {
        if (!window.confirm("Are you sure you want to delete this withdrawal rule?")) return;
        const nextRules = rules.filter(r => r.id !== id);
        setRules(nextRules);
        handleSaveRules(nextRules);
    };

    const handleToggleRule = (id: string) => {
        const nextRules = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r);
        setRules(nextRules);
        handleSaveRules(nextRules);
    };

    const handleMovePriority = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === rules.length - 1) return;

        const targetIdx = direction === 'up' ? index - 1 : index + 1;
        const nextRules = [...rules];
        const temp = nextRules[index];
        nextRules[index] = nextRules[targetIdx];
        nextRules[targetIdx] = temp;

        // Re-assign priorities sequentially
        nextRules.forEach((r, idx) => {
            r.priority = idx + 1;
        });

        setRules(nextRules);
        handleSaveRules(nextRules);
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-300">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-0 pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-full">
                                Work & Earn Module
                            </span>
                            <span className="text-xs font-bold text-slate-400">Rules Engine v2.0</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
                            Withdrawal Rules Engine
                        </h1>
                        <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                            Configure dynamic eligibility criteria for Work & Earn payout requests. Set up trigger conditions, require active Investment Plans, specify custom user notifications, and prioritize active rules.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button 
                            onClick={handleOpenCreateModal}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 px-6 rounded-2xl shadow-xl shadow-emerald-500/20 uppercase tracking-wider text-xs transition-transform active:scale-95 flex items-center gap-2"
                        >
                            <span>➕ Add New Rule</span>
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleSaveRules()}
                            isLoading={isSaving}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-black py-3.5 px-6 rounded-2xl text-xs uppercase tracking-wider"
                        >
                            <span>💾 Save All</span>
                        </Button>
                    </div>
                </div>

                {/* Sub-Tabs */}
                <div className="flex flex-wrap gap-3 mt-8 border-t border-slate-800 pt-6">
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'rules'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>📋 Active Rules ({rules.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('payout_tiers')}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'payout_tiers'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                : 'bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>🎯 Payout Tiers & Sequences</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'logs'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>📜 Evaluation Logs ({evaluationLogs.length})</span>
                    </button>
                </div>
            </div>

            {successMessage && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-sm font-bold animate-in fade-in">
                    {successMessage}
                </div>
            )}

            {/* TAB 1: RULES MANAGEMENT */}
            {activeTab === 'rules' && (
                <div className="space-y-6">
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Configured Rules</span>
                            <div className="text-2xl font-black text-gray-900 dark:text-white">{rules.length}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Enabled Active Rules</span>
                            <div className="text-2xl font-black text-emerald-600">{rules.filter(r => r.enabled).length}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-500">Mandatory Blocking Rules</span>
                            <div className="text-2xl font-black text-red-600">{rules.filter(r => r.isMandatory).length}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Investment Required Rules</span>
                            <div className="text-2xl font-black text-blue-600">
                                {rules.filter(r => r.ruleType === 'investment_plan_requirement' || r.requirementConfig?.requireActiveInvestmentPlan).length}
                            </div>
                        </div>
                    </div>

                    {/* Rules List */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Configured Rules Priority Stack</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Rules execute strictly in order of priority (Priority 1 runs first).</p>
                            </div>
                            <Button 
                                onClick={handleOpenCreateModal}
                                className="text-xs py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                            >
                                ➕ Add Rule
                            </Button>
                        </div>

                        {rules.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 font-medium">
                                No withdrawal rules defined yet. Click "Add New Rule" above to create one.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {rules.map((rule, index) => {
                                    const optionInfo = RULE_TYPE_OPTIONS.find(o => o.type === rule.ruleType);
                                    const icon = optionInfo?.defaultIcon || '⚡';

                                    return (
                                        <div 
                                            key={rule.id} 
                                            className={`p-6 rounded-2xl border transition-all ${
                                                rule.enabled 
                                                    ? 'bg-gray-50/50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 hover:border-indigo-500' 
                                                    : 'bg-gray-100/50 dark:bg-gray-900/10 border-dashed border-gray-300 dark:border-gray-800 opacity-60'
                                            }`}
                                        >
                                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                                                
                                                {/* Left Section: Priority, Name, Info */}
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className="flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-3 py-2 min-w-[56px] text-center">
                                                        <span className="text-[9px] font-black uppercase text-indigo-500">Priority</span>
                                                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">#{rule.priority}</span>
                                                    </div>

                                                    <div className="space-y-1.5 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-xl">{icon}</span>
                                                            <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{rule.name}</h4>
                                                            <Badge variant={rule.enabled ? 'success' : 'danger'}>
                                                                {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                                                            </Badge>
                                                            {rule.isMandatory && (
                                                                <span className="text-[9px] font-black uppercase bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                                                                    Mandatory Block
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                            {rule.description || optionInfo?.description}
                                                        </p>

                                                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                                            <span className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-md font-mono">
                                                                Type: {rule.ruleType}
                                                            </span>
                                                            <span className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-md font-mono">
                                                                Target: {rule.targetUserGroup}
                                                            </span>
                                                            {rule.triggerConfig?.withdrawalNumber && (
                                                                <span className="bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-bold">
                                                                    Trigger: Withdrawal #{rule.triggerConfig.withdrawalNumber}
                                                                </span>
                                                            )}
                                                            {rule.requirementConfig?.requireActiveInvestmentPlan && (
                                                                <span className="bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md font-bold">
                                                                    Requires Active Investment Plan
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Section: Priority Adjust, Toggle & Action Buttons */}
                                                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-200 dark:border-gray-800">
                                                    
                                                    {/* Priority Reorder Buttons */}
                                                    <div className="flex items-center bg-gray-200 dark:bg-gray-800 rounded-xl p-1 gap-1">
                                                        <button 
                                                            disabled={index === 0}
                                                            onClick={() => handleMovePriority(index, 'up')}
                                                            className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-xs font-bold disabled:opacity-30"
                                                            title="Move Up Priority"
                                                        >
                                                            ⬆️
                                                        </button>
                                                        <button 
                                                            disabled={index === rules.length - 1}
                                                            onClick={() => handleMovePriority(index, 'down')}
                                                            className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-xs font-bold disabled:opacity-30"
                                                            title="Move Down Priority"
                                                        >
                                                            ⬇️
                                                        </button>
                                                    </div>

                                                    {/* Enable / Disable Switch */}
                                                    <button
                                                        onClick={() => handleToggleRule(rule.id)}
                                                        className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                                                            rule.enabled
                                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                                                                : 'bg-gray-200 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700'
                                                        }`}
                                                    >
                                                        {rule.enabled ? 'Enabled' : 'Disabled'}
                                                    </button>

                                                    <Button 
                                                        onClick={() => handleOpenEditModal(rule)}
                                                        className="text-xs py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                                                    >
                                                        ✏️ Edit
                                                    </Button>

                                                    <button
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                        title="Delete Rule"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: MOUNTED PLAN PAYOUT TIERS & SEQUENCES */}
            {activeTab === 'payout_tiers' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Feature Overview Header */}
                    <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-emerald-500/30 shadow-xl space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🎯</span>
                                <div>
                                    <h2 className="text-lg font-black uppercase tracking-wider text-emerald-400">Mounted Plan Payout Tiers & Sequences</h2>
                                    <p className="text-xs text-slate-300 max-w-2xl">Configure base currency withdrawal limits, mount prices from Investment Module plans, or set step-by-step payout sequences ($5, $10, $15) for Work & Earn users.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-700/80">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={payoutConfig.enabled}
                                        onChange={(e) => setPayoutConfig({ ...payoutConfig, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                                <span className="text-xs font-black uppercase text-emerald-300">{payoutConfig.enabled ? 'Tiers Active' : 'Tiers Disabled'}</span>
                            </div>
                        </div>
                    </div>

                    {!payoutConfig.enabled ? (
                        <div className="p-8 bg-amber-500/10 border border-amber-500/30 rounded-3xl text-center space-y-3">
                            <span className="text-3xl">⚠️</span>
                            <h3 className="text-base font-black uppercase text-amber-600 dark:text-amber-400">Payout Tiers & Sequences Are Disabled</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                Standard global withdrawal minimums/maximums will apply. Toggle "Tiers Active" above to configure custom payout progression, plan-based limits, and frequency controls.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* 2-Column Options Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                
                                {/* CARD 1: Payout Operating Mode */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border dark:border-gray-700 shadow-md space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b dark:border-gray-700">
                                        <span className="text-xl">⚙️</span>
                                        <div>
                                            <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">1. Payout Operating Mode</h3>
                                            <p className="text-[11px] text-gray-500">Select how withdrawal options are presented to prevent logical conflicts.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setPayoutConfig({ ...payoutConfig, mode: 'sequence', onlyShowRunningPlanAmount: false })}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                                                    payoutConfig.mode === 'sequence'
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-200 shadow-md'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:border-indigo-300'
                                                }`}
                                            >
                                                <span className="text-2xl mt-0.5">🔢</span>
                                                <div>
                                                    <span className="font-black text-xs uppercase block text-indigo-600 dark:text-indigo-300">Sequential Payout Progression</span>
                                                    <span className="text-[11px] opacity-80 block">Requires sequential payouts step-by-step (e.g., 1st: $5, 2nd: $10, 3rd: $15).</span>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPayoutConfig({ ...payoutConfig, mode: 'running_plan_only', onlyShowRunningPlanAmount: true })}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                                                    payoutConfig.mode === 'running_plan_only' || payoutConfig.onlyShowRunningPlanAmount
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-200 shadow-md ring-2 ring-indigo-500/20'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:border-indigo-300'
                                                }`}
                                            >
                                                <span className="text-2xl mt-0.5">💎</span>
                                                <div className="space-y-1">
                                                    <span className="font-black text-xs uppercase block text-indigo-600 dark:text-indigo-300">Running Investment Plan Amount Only</span>
                                                    <span className="text-[11px] opacity-80 block leading-normal">
                                                        Users in Work & Earn will see active investment plans matching their base currency (e.g. PKR users see active PKR plans only). Other currency plans are excluded without converting. Only their running plan amount in base currency is shown for withdrawal.
                                                    </span>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPayoutConfig({ ...payoutConfig, mode: 'milestones_choice', onlyShowRunningPlanAmount: false })}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                                                    payoutConfig.mode === 'milestones_choice'
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-200 shadow-md'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:border-indigo-300'
                                                }`}
                                            >
                                                <span className="text-2xl mt-0.5">🏆</span>
                                                <div>
                                                    <span className="font-black text-xs uppercase block text-indigo-600 dark:text-indigo-300">Milestones & Mounted Plans Choice</span>
                                                    <span className="text-[11px] opacity-80 block">Users can reach specific milestones or plan payout points and withdraw freely without sequence enforcement.</span>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPayoutConfig({ ...payoutConfig, mode: 'hybrid', onlyShowRunningPlanAmount: false })}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                                                    payoutConfig.mode === 'hybrid'
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-200 shadow-md'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:border-indigo-300'
                                                }`}
                                            >
                                                <span className="text-2xl mt-0.5">🔀</span>
                                                <div>
                                                    <span className="font-black text-xs uppercase block text-indigo-600 dark:text-indigo-300">Hybrid Progression & Milestones</span>
                                                    <span className="text-[11px] opacity-80 block">Combines step-by-step sequence progression with custom milestone amounts and mounted investment plan tiers.</span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* CARD: Step 4 Withdrawal Investment Plan Pop-Up Control */}
                                <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-gray-800 p-6 rounded-3xl border border-amber-300 dark:border-amber-800 shadow-md space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-800/60">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">💎</span>
                                            <div>
                                                <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">Step 4 Investment Plan Pop-Up Settings</h3>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Controls the pop-up modal shown to users on Step 4 of the withdrawal workflow.</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                            payoutConfig.enableInvestmentPlanPopupOnWithdrawal !== false
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                        }`}>
                                            {payoutConfig.enableInvestmentPlanPopupOnWithdrawal !== false ? '● Enabled' : '○ Disabled'}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer p-3.5 bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-sm">
                                            <input 
                                                type="checkbox"
                                                checked={payoutConfig.enableInvestmentPlanPopupOnWithdrawal !== false}
                                                onChange={(e) => setPayoutConfig({ ...payoutConfig, enableInvestmentPlanPopupOnWithdrawal: e.target.checked })}
                                                className="rounded text-amber-600 focus:ring-amber-500 w-5 h-5 cursor-pointer"
                                            />
                                            <div>
                                                <span className="text-xs font-black uppercase text-gray-900 dark:text-white block">
                                                    Show Investment Plan Pop-Up on Step 4 Withdrawal
                                                </span>
                                                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                                                    When enabled, users reaching Step 4 will see a pop-up with a matching currency plan (USD, PKR, EUR, etc.), referral income benefits, "View All Plans", "Direct Plan Purchase", and "Proceed to Withdraw".
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* CARD: Withdrawal Option Layout Grid Columns Configuration */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border dark:border-gray-700 shadow-md space-y-6">
                                    <div className="flex items-center justify-between pb-2 border-b dark:border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📊</span>
                                            <div>
                                                <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">Withdrawal Amount Options Column Layout</h3>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Configure separate grid column layouts for Mobile devices and Desktop/Tablet screens (2, 3, or 4 columns).</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                                📱 Mobile: {payoutConfig.payoutLayoutColumnsMobile || 2} Cols
                                            </span>
                                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                                                💻 Desktop: {payoutConfig.payoutLayoutColumns || 3} Cols
                                            </span>
                                        </div>
                                    </div>

                                    {/* SECTION 1: MOBILE LAYOUT COLUMNS */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                                📱 Mobile Screen Layout (Smartphones & Small Displays)
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-bold">2, 3, or 4 Columns</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {[2, 3, 4].map((cols) => {
                                                const isSelected = (payoutConfig.payoutLayoutColumnsMobile || 2) === cols;
                                                return (
                                                    <button
                                                        key={`mobile-${cols}`}
                                                        type="button"
                                                        onClick={() => setPayoutConfig({ ...payoutConfig, payoutLayoutColumnsMobile: cols as 2 | 3 | 4 })}
                                                        className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                                                            isSelected
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-200 shadow-md ring-2 ring-indigo-500/20'
                                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:border-indigo-300'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-black text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300">{cols} Columns Mobile</span>
                                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                    isSelected ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-transparent'
                                                                }`}>✓</span>
                                                            </div>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                                                                {cols === 2 && "2 columns on mobile (Recommended for best tap targets)."}
                                                                {cols === 3 && "3 columns on mobile for compact layout."}
                                                                {cols === 4 && "4 tight columns on mobile screens."}
                                                            </p>
                                                        </div>

                                                        <div className="p-2.5 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 space-y-1">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase block text-center">Mobile Preview ({cols} cols)</span>
                                                            <div className={`grid ${cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-1`}>
                                                                {Array.from({ length: cols * 2 }).map((_, i) => (
                                                                    <div key={i} className={`h-6 rounded text-[9px] font-black flex items-center justify-center ${
                                                                        isSelected ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                                    }`}>
                                                                        $10
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* SECTION 2: DESKTOP / TABLET LAYOUT COLUMNS */}
                                    <div className="space-y-3 pt-2 border-t dark:border-gray-700">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                                                💻 Desktop & Tablet Screen Layout
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-bold">2, 3, or 4 Columns</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {[2, 3, 4].map((cols) => {
                                                const isSelected = (payoutConfig.payoutLayoutColumns || 3) === cols;
                                                return (
                                                    <button
                                                        key={`desktop-${cols}`}
                                                        type="button"
                                                        onClick={() => setPayoutConfig({ ...payoutConfig, payoutLayoutColumns: cols as 2 | 3 | 4 })}
                                                        className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                                                            isSelected
                                                            ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-600 text-teal-950 dark:text-teal-200 shadow-md ring-2 ring-teal-500/20'
                                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:border-teal-300'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-black text-xs uppercase tracking-wider text-teal-700 dark:text-teal-300">{cols} Columns Desktop</span>
                                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                    isSelected ? 'bg-teal-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-transparent'
                                                                }`}>✓</span>
                                                            </div>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                                                                {cols === 2 && "Display choices in 2 large columns on desktop."}
                                                                {cols === 3 && "Display choices in 3 balanced columns on desktop."}
                                                                {cols === 4 && "Display choices in 4 compact columns on desktop."}
                                                            </p>
                                                        </div>

                                                        <div className="p-2.5 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 space-y-1">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase block text-center">Desktop Preview ({cols} cols)</span>
                                                            <div className={`grid ${cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-1`}>
                                                                {Array.from({ length: cols * 2 }).map((_, i) => (
                                                                    <div key={i} className={`h-6 rounded text-[9px] font-black flex items-center justify-center ${
                                                                        isSelected ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                                    }`}>
                                                                        $10
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* CARD 2: Base Currency, Frequency & Plan-Based Amount Limits */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border dark:border-gray-700 shadow-md space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b dark:border-gray-700">
                                        <span className="text-xl">💱</span>
                                        <div>
                                            <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">2. Currency, Frequency & Plan-Based Limits</h3>
                                            <p className="text-[11px] text-gray-500">Configure local currency conversions, submission frequencies, and plan-based limits.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                            <input 
                                                type="checkbox"
                                                checked={payoutConfig.useBaseCurrencyPayouts}
                                                onChange={(e) => setPayoutConfig({ ...payoutConfig, useBaseCurrencyPayouts: e.target.checked })}
                                                className="rounded text-emerald-600 w-4 h-4"
                                            />
                                            <span>Automatically convert payouts to user's base currency (PKR/INR/NGN/etc.) based on exchange rate</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800">
                                            <input 
                                                type="checkbox"
                                                checked={payoutConfig.hideUSDInUserCurrencyDisplay ?? true}
                                                onChange={(e) => setPayoutConfig({ ...payoutConfig, hideUSDInUserCurrencyDisplay: e.target.checked })}
                                                className="rounded text-indigo-600 w-4 h-4"
                                            />
                                            <span>Display clean local currency amounts (e.g. "1,400 PKR") without secondary USD tags</span>
                                        </label>

                                        {/* PLAN-BASED AMOUNT LIMITS SECTION */}
                                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-amber-900 dark:text-amber-200">
                                                    <input 
                                                        type="checkbox"
                                                        checked={payoutConfig.planBasedAmountLimitsEnabled ?? false}
                                                        onChange={(e) => setPayoutConfig({ ...payoutConfig, planBasedAmountLimitsEnabled: e.target.checked })}
                                                        className="rounded text-amber-600 w-4 h-4"
                                                    />
                                                    <span>ENABLE PLAN-BASED AMOUNT LIMITS</span>
                                                </label>
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                                                    {payoutConfig.planBasedAmountLimitsEnabled ? 'Active' : 'Disabled'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-amber-800 dark:text-amber-300">
                                                When enabled, users can only submit withdrawals matching the prices of investment plans enabled in their specific currency.
                                            </p>

                                            {payoutConfig.planBasedAmountLimitsEnabled && (
                                                <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-2">
                                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">Active Investment Plan Requirement:</label>
                                                    <div className="flex flex-col sm:flex-row gap-3">
                                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer">
                                                            <input 
                                                                type="radio"
                                                                name="requireActivePlanOption"
                                                                checked={payoutConfig.requireActivePlanToWithdraw === true}
                                                                onChange={() => setPayoutConfig({ ...payoutConfig, requireActivePlanToWithdraw: true })}
                                                                className="text-amber-600"
                                                            />
                                                            <span>Require Active Investment Plan to Withdraw</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer">
                                                            <input 
                                                                type="radio"
                                                                name="requireActivePlanOption"
                                                                checked={payoutConfig.requireActivePlanToWithdraw !== true}
                                                                onChange={() => setPayoutConfig({ ...payoutConfig, requireActivePlanToWithdraw: false })}
                                                                className="text-amber-600"
                                                            />
                                                            <span>Activate Plan Optional (Allow matching plan amounts without active plan)</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* WITHDRAWAL FREQUENCY LIMIT SECTION */}
                                        <div className="space-y-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                                ⏱️ Withdrawal Request Frequency Limit (Hours):
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="number"
                                                    value={payoutConfig.withdrawalFrequencyLimitHours ?? 24}
                                                    onChange={(e) => setPayoutConfig({ ...payoutConfig, withdrawalFrequencyLimitHours: Math.max(0, Number(e.target.value)) })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold"
                                                    placeholder="e.g. 24 for once per 24 hours"
                                                />
                                                <span className="text-xs font-bold text-gray-500 whitespace-nowrap">
                                                    {payoutConfig.withdrawalFrequencyLimitHours === 0 ? 'No Limit' : `Every ${payoutConfig.withdrawalFrequencyLimitHours} hrs`}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-400">
                                                Set to 24 to allow 1 withdrawal request per day, or 0 to disable frequency restrictions.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Min Limit ($ USD):</label>
                                                <input 
                                                    type="number"
                                                    value={payoutConfig.minWithdrawalLimitUSD ?? 1}
                                                    onChange={(e) => setPayoutConfig({ ...payoutConfig, minWithdrawalLimitUSD: Number(e.target.value) })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Max Limit ($ USD):</label>
                                                <input 
                                                    type="number"
                                                    value={payoutConfig.maxWithdrawalLimitUSD ?? 1000}
                                                    onChange={(e) => setPayoutConfig({ ...payoutConfig, maxWithdrawalLimitUSD: Number(e.target.value) })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Daily Hub Limit ($ USD):</label>
                                            <input 
                                                type="number"
                                                value={payoutConfig.dailyWithdrawalLimitUSD ?? 500}
                                                onChange={(e) => setPayoutConfig({ ...payoutConfig, dailyWithdrawalLimitUSD: Number(e.target.value) })}
                                                className="w-full px-3.5 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* CARD 3: Step-by-Step Payout Sequences Builder (SHOWN ONLY IN SEQUENCE OR HYBRID MODES) */}
                                {(payoutConfig.mode === 'sequence' || payoutConfig.mode === 'hybrid') && (
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border dark:border-gray-700 shadow-md space-y-4 lg:col-span-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b dark:border-gray-700 gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🪜</span>
                                                <div>
                                                    <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">3. Step-by-Step Payout Sequences (1st: $5, 2nd: $10, 3rd: $15)</h3>
                                                    <p className="text-[11px] text-gray-500">Configure sequence steps so users unlock progressive payout amounts as they complete withdrawals.</p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => {
                                                    const steps = payoutConfig.sequenceSteps || [];
                                                    const nextStepNum = steps.length + 1;
                                                    const lastAmt = steps.length > 0 ? steps[steps.length - 1].amountUSD : 5;
                                                    const nextAmt = lastAmt + 5;
                                                    setPayoutConfig({
                                                        ...payoutConfig,
                                                        sequenceSteps: [
                                                            ...steps,
                                                            { stepNumber: nextStepNum, amountUSD: nextAmt, label: `${nextStepNum}th Withdrawal ($${nextAmt})` }
                                                        ]
                                                    });
                                                }}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase self-start sm:self-auto"
                                            >
                                                ➕ Add Sequence Step
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {(payoutConfig.sequenceSteps || []).map((step, idx) => {
                                                const pkrAmt = Math.round(step.amountUSD * (settings.exchangeRates?.PKR || 278));
                                                return (
                                                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700 space-y-3 relative">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">Step #{step.stepNumber} Payout</span>
                                                            {payoutConfig.sequenceSteps.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const filtered = payoutConfig.sequenceSteps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 }));
                                                                        setPayoutConfig({ ...payoutConfig, sequenceSteps: filtered });
                                                                    }}
                                                                    className="text-red-500 hover:text-red-700 font-bold text-xs"
                                                                >
                                                                    ✕ Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-500 block mb-1">Payout Amount ($ USD):</label>
                                                            <input 
                                                                type="number"
                                                                value={step.amountUSD}
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    const updated = [...payoutConfig.sequenceSteps];
                                                                    updated[idx] = { ...updated[idx], amountUSD: val, label: step.label || `Step ${step.stepNumber} ($${val})` };
                                                                    setPayoutConfig({ ...payoutConfig, sequenceSteps: updated });
                                                                }}
                                                                className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                                            />
                                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-1">~{pkrAmt.toLocaleString()} PKR base currency</span>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-500 block mb-1">Display Label:</label>
                                                            <input 
                                                                type="text"
                                                                value={step.label || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...payoutConfig.sequenceSteps];
                                                                    updated[idx] = { ...updated[idx], label: e.target.value };
                                                                    setPayoutConfig({ ...payoutConfig, sequenceSteps: updated });
                                                                }}
                                                                placeholder={`e.g. Withdrawal #${step.stepNumber} ($${step.amountUSD})`}
                                                                className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* CARD 4: Mounted Investment Plans & Milestones (SHOWN ONLY IN MILESTONES_CHOICE OR HYBRID MODES) */}
                                {(payoutConfig.mode === 'milestones_choice' || payoutConfig.mode === 'hybrid') && (
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border dark:border-gray-700 shadow-md space-y-4 lg:col-span-2">
                                        <div className="flex items-center gap-2 pb-2 border-b dark:border-gray-700">
                                            <span className="text-xl">🏔️</span>
                                            <div>
                                                <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">4. Mounted Investment Plans & Milestone Amounts</h3>
                                                <p className="text-[11px] text-gray-500">Mount investment plan prices directly as payout options or set custom milestone targets.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Mounted Plans Checklist */}
                                            <div className="space-y-3">
                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200">
                                                    <input 
                                                        type="checkbox"
                                                        checked={payoutConfig.mountInvestmentPlans}
                                                        onChange={(e) => setPayoutConfig({ ...payoutConfig, mountInvestmentPlans: e.target.checked })}
                                                        className="rounded text-indigo-600"
                                                    />
                                                    <span>Mount Investment Plan prices as Payout Tiers</span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                                                    <input 
                                                        type="checkbox"
                                                        checked={payoutConfig.enableInvestmentPlanPopupOnWithdrawal !== false}
                                                        onChange={(e) => setPayoutConfig({ ...payoutConfig, enableInvestmentPlanPopupOnWithdrawal: e.target.checked })}
                                                        className="rounded text-amber-600 focus:ring-amber-500"
                                                    />
                                                    <span>💎 Show Investment Plan Pop-up on Step 4 Withdrawal</span>
                                                </label>

                                                {payoutConfig.mountInvestmentPlans && (
                                                    <div className="space-y-2">
                                                        <span className="text-[11px] font-bold text-gray-500 block">Select specific plans to mount:</span>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                                                            {investmentPlans.map(plan => {
                                                                const currentLinked = payoutConfig.linkedPlanIds || [];
                                                                const isChecked = currentLinked.length === 0 || currentLinked.includes(plan._id);
                                                                const pkrVal = Math.round((plan.price || 0) * (settings.exchangeRates?.PKR || 278));
                                                                return (
                                                                    <label key={plan._id} className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                                                        <input 
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                let next: string[];
                                                                                if (currentLinked.length === 0) {
                                                                                    next = e.target.checked ? [plan._id] : investmentPlans.map(p => p._id).filter(id => id !== plan._id);
                                                                                } else {
                                                                                    next = e.target.checked 
                                                                                        ? [...currentLinked, plan._id]
                                                                                        : currentLinked.filter(id => id !== plan._id);
                                                                                }
                                                                                setPayoutConfig({ ...payoutConfig, linkedPlanIds: next });
                                                                            }}
                                                                            className="rounded text-emerald-600"
                                                                        />
                                                                        <div>
                                                                            <span className="font-bold block text-gray-800 dark:text-gray-200">{plan.name}</span>
                                                                            <span className="text-[10px] text-emerald-600 font-bold">${plan.price} USD (~{pkrVal.toLocaleString()} PKR)</span>
                                                                        </div>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Custom Milestones */}
                                            <div className="space-y-3">
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    Custom Milestone Payout Amounts ($ USD, comma separated):
                                                </label>
                                                <input 
                                                    type="text"
                                                    value={manualPayoutInput}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setManualPayoutInput(val);
                                                        const parsed = val.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
                                                        setPayoutConfig({ ...payoutConfig, manualPayoutAmountsUSD: parsed });
                                                    }}
                                                    className="w-full px-4 py-3 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-mono font-bold"
                                                    placeholder="e.g. 2.5, 5, 10, 15, 25, 50"
                                                />
                                                <p className="text-[11px] text-gray-500">
                                                    These milestone payout options will be displayed to users in their base currency.
                                                </p>

                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200 pt-2">
                                                    <input 
                                                        type="checkbox"
                                                        checked={payoutConfig.allowMilestoneWithdrawalWithoutSequence}
                                                        onChange={(e) => setPayoutConfig({ ...payoutConfig, allowMilestoneWithdrawalWithoutSequence: e.target.checked })}
                                                        className="rounded text-indigo-600"
                                                    />
                                                    <span>Allow milestone withdrawal without strict sequence enforcement</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* RUNNING PLAN ONLY INFORMATIONAL BOX */}
                                {payoutConfig.mode === 'running_plan_only' && (
                                    <div className="p-6 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-3xl lg:col-span-2 space-y-2">
                                        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black text-xs uppercase">
                                            <span>💎 Running Plan Mode Active</span>
                                        </div>
                                        <p className="text-xs text-indigo-900 dark:text-indigo-200">
                                            The system is configured to present users with payout amounts strictly matching their currently active investment plan price. Secondary sequence steps and custom milestones are automatically hidden to prevent conflict.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Save Action Bar */}
                            <div className="flex justify-end pt-4 border-t dark:border-gray-800">
                                <Button
                                    onClick={() => handleSaveRules(rules, payoutConfig)}
                                    isLoading={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-8 rounded-2xl text-xs uppercase tracking-wider shadow-xl shadow-emerald-500/20"
                                >
                                    <span>💾 Save Payout Tier Configurations</span>
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* TAB 3: EVALUATION LOGS */}
            {activeTab === 'logs' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border dark:border-gray-700 space-y-4">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Recent Withdrawal Rule Evaluations</h3>
                    
                    {evaluationLogs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 font-medium">
                            No evaluation logs recorded yet. Rule evaluations will automatically be logged here whenever users initiate withdrawal requests.
                        </div>
                    ) : (
                        <div className="divide-y dark:divide-gray-700">
                            {evaluationLogs.slice().reverse().map(log => (
                                <div key={log.id} className="py-3 flex justify-between items-center text-xs">
                                    <div>
                                        <span className="font-bold text-gray-900 dark:text-white">User: {log.username}</span>
                                        <p className="text-gray-500 text-[11px]">{log.ruleName} ({log.ruleType}) — {log.details}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <Badge variant={log.status === 'PASSED' ? 'success' : 'danger'}>
                                            {log.status}
                                        </Badge>
                                        <div className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* RULE EDITING / CREATION MODAL */}
            {isModalOpen && editingRule && (
                <Modal isOpen={true} onClose={() => setIsModalOpen(false)}>
                    <div className="p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
                        <div className="border-b dark:border-gray-700 pb-4">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                {editingRule.id ? 'Edit Withdrawal Rule' : 'Create Withdrawal Rule'}
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">Configure eligibility triggers, investment plan requirements, and custom modal display texts.</p>
                        </div>

                        <div className="space-y-6">
                            {/* Section 1: Basic Info */}
                            <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-800">
                                <h4 className="text-xs font-black uppercase text-indigo-500 tracking-wider">1. Basic Rule Configuration</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Rule Name *</label>
                                        <input 
                                            type="text" 
                                            value={editingRule.name}
                                            onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold"
                                            placeholder="e.g. Second Withdrawal Requires Investment"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Priority (1 = Highest)</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={editingRule.priority}
                                            onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
                                            className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                    <input 
                                        type="text" 
                                        value={editingRule.description || ''}
                                        onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                                        placeholder="Internal notes about why this rule is enabled."
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-6 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={editingRule.enabled}
                                            onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                                            className="w-4 h-4 text-emerald-600 rounded"
                                        />
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Rule Enabled</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={editingRule.isMandatory}
                                            onChange={(e) => setEditingRule({ ...editingRule, isMandatory: e.target.checked })}
                                            className="w-4 h-4 text-red-600 rounded"
                                        />
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Mandatory Block (Blocks withdrawal if failed)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Section 2: Rule Type & Triggers */}
                            <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-800">
                                <h4 className="text-xs font-black uppercase text-indigo-500 tracking-wider">2. Rule Type & Trigger Criteria</h4>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Select Rule Type *</label>
                                    <select
                                        value={editingRule.ruleType}
                                        onChange={(e) => setEditingRule({ ...editingRule, ruleType: e.target.value as WithdrawalRuleType })}
                                        className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold"
                                    >
                                        {RULE_TYPE_OPTIONS.map(opt => (
                                            <option key={opt.type} value={opt.type}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Dynamic Trigger Parameters */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Trigger Withdrawal Number</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={editingRule.triggerConfig?.withdrawalNumber ?? 2}
                                            onChange={(e) => setEditingRule({
                                                ...editingRule,
                                                triggerConfig: { ...editingRule.triggerConfig, withdrawalNumber: Number(e.target.value) }
                                            })}
                                            className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono"
                                            placeholder="e.g. 2 for 2nd withdrawal"
                                        />
                                        <span className="text-[10px] text-gray-400">Specifies exact withdrawal attempt (e.g. 2 = 2nd withdrawal).</span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Target User Group</label>
                                        <select
                                            value={editingRule.targetUserGroup}
                                            onChange={(e) => setEditingRule({ ...editingRule, targetUserGroup: e.target.value as any })}
                                            className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                        >
                                            <option value="all">All Registered Members</option>
                                            <option value="no_active_plan">Members with NO Active Plan</option>
                                            <option value="specific_users">Specific User IDs</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Requirements (e.g. Investment Plan Requirements) */}
                            <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-800">
                                <h4 className="text-xs font-black uppercase text-indigo-500 tracking-wider">3. Requirement Details (Investment Plan Configuration)</h4>

                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={editingRule.requirementConfig?.requireActiveInvestmentPlan ?? true}
                                            onChange={(e) => setEditingRule({
                                                ...editingRule,
                                                requirementConfig: { ...editingRule.requirementConfig, requireActiveInvestmentPlan: e.target.checked }
                                            })}
                                            className="w-4 h-4 text-purple-600 rounded"
                                        />
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Require Active Investment Plan</span>
                                    </label>

                                    {editingRule.requirementConfig?.requireActiveInvestmentPlan && (
                                        <div className="space-y-4 pl-6 border-l-2 border-purple-500/30 pt-2">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Plan Acceptance Criteria</label>
                                                <select
                                                    value={editingRule.requirementConfig?.planSelectionType || 'any'}
                                                    onChange={(e) => setEditingRule({
                                                        ...editingRule,
                                                        requirementConfig: { ...editingRule.requirementConfig, planSelectionType: e.target.value as any }
                                                    })}
                                                    className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                                >
                                                    <option value="any">Accept ANY Active Investment Plan</option>
                                                    <option value="min_amount">Require Minimum Plan Investment Amount ($)</option>
                                                    <option value="selected">Require Specific Selected Plan(s)</option>
                                                    <option value="category">Require Plan in Specific Category</option>
                                                </select>
                                            </div>

                                            {editingRule.requirementConfig?.planSelectionType === 'min_amount' && (
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Required Minimum Plan Price ($ USD)</label>
                                                    <input 
                                                        type="number"
                                                        value={editingRule.requirementConfig?.minPlanAmountUSD || 10}
                                                        onChange={(e) => setEditingRule({
                                                            ...editingRule,
                                                            requirementConfig: { ...editingRule.requirementConfig, minPlanAmountUSD: Number(e.target.value) }
                                                        })}
                                                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono"
                                                    />
                                                </div>
                                            )}

                                            {editingRule.requirementConfig?.planSelectionType === 'selected' && (
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Select Qualifying Investment Plans:</label>
                                                    <div className="max-h-36 overflow-y-auto space-y-1 bg-white dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700">
                                                        {investmentPlans.map(plan => {
                                                            const currentSelected = editingRule.requirementConfig?.requiredPlanIds || [];
                                                            const isChecked = currentSelected.includes(plan._id);
                                                            return (
                                                                <label key={plan._id} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => {
                                                                            const next = e.target.checked 
                                                                                ? [...currentSelected, plan._id]
                                                                                : currentSelected.filter(id => id !== plan._id);
                                                                            setEditingRule({
                                                                                ...editingRule,
                                                                                requirementConfig: { ...editingRule.requirementConfig, requiredPlanIds: next }
                                                                            });
                                                                        }}
                                                                        className="rounded"
                                                                    />
                                                                    <span>{plan.name} (${plan.price})</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 4: Custom User Notification Modal Config */}
                            <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-800">
                                <h4 className="text-xs font-black uppercase text-indigo-500 tracking-wider">4. Custom User Modal & Action Buttons Configuration</h4>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Modal Dialog Title *</label>
                                        <input 
                                            type="text"
                                            value={editingRule.notificationConfig?.title || 'Investment Plan Required'}
                                            onChange={(e) => setEditingRule({
                                                ...editingRule,
                                                notificationConfig: { ...editingRule.notificationConfig, title: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                            placeholder="e.g. Investment Plan Required"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Modal Explanation Message *</label>
                                        <textarea 
                                            rows={3}
                                            value={editingRule.notificationConfig?.message || ''}
                                            onChange={(e) => setEditingRule({
                                                ...editingRule,
                                                notificationConfig: { ...editingRule.notificationConfig, message: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                                            placeholder="e.g. To continue with your next withdrawal, you must first activate an eligible Investment Plan."
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Primary Button Text</label>
                                            <input 
                                                type="text"
                                                value={editingRule.notificationConfig?.primaryActionButtonText || 'View Investment Plans'}
                                                onChange={(e) => setEditingRule({
                                                    ...editingRule,
                                                    notificationConfig: { ...editingRule.notificationConfig, primaryActionButtonText: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Secondary Button Text (Optional)</label>
                                            <input 
                                                type="text"
                                                value={editingRule.notificationConfig?.secondaryActionButtonText || 'Transfer Balance'}
                                                onChange={(e) => setEditingRule({
                                                    ...editingRule,
                                                    notificationConfig: { ...editingRule.notificationConfig, secondaryActionButtonText: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Live Modal Preview Card */}
                                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-3">
                                    <div className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">👁️ Live User Dialog Preview</div>
                                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-3">
                                        <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto text-xl">
                                            💎
                                        </div>
                                        <h5 className="text-base font-black text-white">{editingRule.notificationConfig?.title || 'Investment Plan Required'}</h5>
                                        <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                                            {editingRule.notificationConfig?.message || 'To continue with your next withdrawal, you must first activate an eligible Investment Plan.'}
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                                            <button type="button" className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase">
                                                {editingRule.notificationConfig?.primaryActionButtonText || 'View Investment Plans'}
                                            </button>
                                            {editingRule.notificationConfig?.secondaryActionButtonText && (
                                                <button type="button" className="bg-slate-800 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs uppercase">
                                                    {editingRule.notificationConfig?.secondaryActionButtonText}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Footer */}
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveRuleModal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                                Save Rule Configuration
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminWithdrawalRules;
