import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { DEFAULT_NOTIFICATION_RULES, NotificationEventRule } from '../services/notificationService';
import { updateSettings } from '../services/api';
import Button from './ui/Button';

export const AdminNotificationRulesManager: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings } = state;

    const [rules, setRules] = useState<Record<string, NotificationEventRule>>(() => {
        return settings.notificationRules || DEFAULT_NOTIFICATION_RULES;
    });

    const [selectedRuleKey, setSelectedRuleKey] = useState<string>('TASK_PROOF_SUBMITTED');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
    const [isSaving, setIsSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState('');

    const currentRule = rules[selectedRuleKey] || DEFAULT_NOTIFICATION_RULES[selectedRuleKey];

    const ruleKeys = Object.keys(rules);

    const filteredRuleKeys = ruleKeys.filter(key => {
        if (selectedCategoryFilter === 'All') return true;
        return rules[key].category === selectedCategoryFilter;
    });

    const handleToggleRuleChannel = (key: string, channel: 'inAppEnabled' | 'emailEnabled' | 'whatsappEnabled') => {
        setRules(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [channel]: !prev[key][channel]
            }
        }));
    };

    const handleUpdateRuleField = (key: string, field: keyof NotificationEventRule, value: any) => {
        setRules(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const handleSaveRules = async () => {
        setIsSaving(true);
        setSavedMessage('');
        try {
            const updatedSettings = await updateSettings({
                ...settings,
                notificationRules: rules
            });
            dispatch({ type: 'SET_SETTINGS', payload: updatedSettings });
            setSavedMessage('Notification rules & email/WhatsApp templates saved successfully!');
            setTimeout(() => setSavedMessage(''), 4000);
        } catch (error) {
            console.error('Failed to save notification rules:', error);
            alert('Failed to save notification rules.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetDefaults = () => {
        if (window.confirm('Reset all notification channels and templates to system default defaults?')) {
            setRules(DEFAULT_NOTIFICATION_RULES);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span>📲</span> Notification Channels & Message Templates Engine
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Configure granular Email, WhatsApp, and In-App Bell notifications for every event across Work & Earn, Investment, and Disputes modules.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={handleResetDefaults}>Reset Defaults</Button>
                    <Button onClick={handleSaveRules} disabled={isSaving}>
                        {isSaving ? 'Saving Changes...' : 'Save Notification Rules'}
                    </Button>
                </div>
            </div>

            {savedMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm font-bold animate-fade-in flex items-center gap-2">
                    <span>✅</span> {savedMessage}
                </div>
            )}

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Category:</span>
                {['All', 'Work & Earn', 'Investment', 'Disputes', 'Finance'].map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            selectedCategoryFilter === cat
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Event Selector List */}
                <div className="lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Notification Events ({filteredRuleKeys.length})
                    </h4>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {filteredRuleKeys.map(key => {
                            const r = rules[key];
                            const isSelected = selectedRuleKey === key;
                            return (
                                <div
                                    key={key}
                                    onClick={() => setSelectedRuleKey(key)}
                                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                                        isSelected
                                            ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500 shadow-sm'
                                            : 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/80 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                                            {r.category}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                            <span className={`px-1.5 py-0.5 rounded ${r.inAppEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                                                🔔 Bell
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded ${r.emailEnabled ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                                                ✉️ Email
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded ${r.whatsappEnabled ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                                                💬 WA
                                            </span>
                                        </div>
                                    </div>
                                    <h5 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                                        {r.eventName}
                                    </h5>
                                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                                        {r.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Event Rule Detail Editor */}
                {currentRule && (
                    <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-5">
                        <div className="border-b dark:border-gray-700 pb-4">
                            <div className="flex items-center justify-between">
                                <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-black rounded-lg">
                                    {currentRule.category} Module Event
                                </span>
                                <span className="text-xs font-mono text-gray-400">Key: {currentRule.id}</span>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mt-2">
                                {currentRule.eventName}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {currentRule.description}
                            </p>
                        </div>

                        {/* Channel Toggles */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentRule.inAppEnabled}
                                    onChange={() => handleToggleRuleChannel(selectedRuleKey, 'inAppEnabled')}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <div>
                                    <span className="text-xs font-extrabold text-gray-800 dark:text-white block">In-App Bell</span>
                                    <span className="text-[10px] text-gray-500">Inbox & Popups</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentRule.emailEnabled}
                                    onChange={() => handleToggleRuleChannel(selectedRuleKey, 'emailEnabled')}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <div>
                                    <span className="text-xs font-extrabold text-gray-800 dark:text-white block">Email Direct</span>
                                    <span className="text-[10px] text-gray-500">Send HTML Email</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentRule.whatsappEnabled}
                                    onChange={() => handleToggleRuleChannel(selectedRuleKey, 'whatsappEnabled')}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <div>
                                    <span className="text-xs font-extrabold text-gray-800 dark:text-white block">WhatsApp Message</span>
                                    <span className="text-[10px] text-gray-500">Send WA Trigger</span>
                                </div>
                            </label>
                        </div>

                        {/* Dynamic Placeholders Helper */}
                        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
                            <strong className="block font-black uppercase text-[10px] tracking-wider mb-1">Available Placeholders for this template:</strong>
                            <div className="flex flex-wrap gap-1.5">
                                {currentRule.placeholders?.map(p => (
                                    <span key={p} className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded font-mono text-[11px] font-bold">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Email Subject Template */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                                Email Subject Line
                            </label>
                            <input
                                type="text"
                                value={currentRule.emailSubject}
                                onChange={(e) => handleUpdateRuleField(selectedRuleKey, 'emailSubject', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 px-3.5 py-2 text-sm font-medium"
                            />
                        </div>

                        {/* Email Body HTML Template */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                                Email HTML Body Template
                            </label>
                            <textarea
                                rows={6}
                                value={currentRule.emailBody}
                                onChange={(e) => handleUpdateRuleField(selectedRuleKey, 'emailBody', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 p-3 text-xs font-mono"
                            />
                        </div>

                        {/* WhatsApp Text Template */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                                WhatsApp Formatted Text Template
                            </label>
                            <textarea
                                rows={4}
                                value={currentRule.whatsappTemplate}
                                onChange={(e) => handleUpdateRuleField(selectedRuleKey, 'whatsappTemplate', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 p-3 text-xs font-mono"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
