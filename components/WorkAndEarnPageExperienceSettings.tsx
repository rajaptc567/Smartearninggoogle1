import React, { useState, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { updateSettings } from '../services/api';
import {
    WorkAndEarnPageExperienceConfig,
    PageExperienceMode,
    OtherTasksNavStyle,
    resolvePageExperience
} from '../utils/pageExperienceHelper';

interface ExperienceOptionMeta {
    key: 'dashboardAvailableTasks' | 'otherTasks' | 'offerwall';
    title: string;
    subtitle: string;
    legacyDescription: string;
    newDescription: string;
}

const EXPERIENCE_SECTIONS: ExperienceOptionMeta[] = [
    {
        key: 'dashboardAvailableTasks',
        title: 'Dashboard – Available Tasks',
        subtitle: 'Controls the Available Jobs section on the Work & Earn User Dashboard.',
        legacyDescription:
            'Legacy Experience: Displays only SmartExn internal micro-tasks with original layout and zero external provider navigation cards.',
        newDescription:
            'New Provider Navigation Experience: Shows eligible external provider cards horizontally below the tab bar while keeping SmartExn internal tasks always visible beneath.'
    },
    {
        key: 'otherTasks',
        title: 'Other Tasks',
        subtitle: 'Controls provider discovery, SELECT ALL behavior, and iframe viewing in Other Tasks.',
        legacyDescription:
            'Legacy Experience: Displays the standard card grid where each partner card is launched manually on click.',
        newDescription:
            'New Provider Navigation Experience: Displays SELECT ALL + per-provider tabs. SELECT ALL renders all eligible providers vertically; single tabs isolate one provider.'
    },
    {
        key: 'offerwall',
        title: 'Offerwall',
        subtitle: 'Controls layout presentation on the main Multi-Network Offerwall Hub.',
        legacyDescription:
            'Legacy Experience: Displays the classic uniform grid and standard category/badge labels.',
        newDescription:
            'New Provider Navigation Experience: Enables mobile horizontal swipe navigation strip and verified offer availability indicators.'
    }
];

export const WorkAndEarnPageExperienceSettings: React.FC<{ className?: string }> = ({
    className = ''
}) => {
    const { state, dispatch } = useData();
    const serverResolved = resolvePageExperience(state?.settings);

    const [draft, setDraft] = useState<WorkAndEarnPageExperienceConfig>(() => ({
        ...serverResolved
    }));
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        setDraft(resolvePageExperience(state?.settings));
    }, [
        state?.settings?.workAndEarnPageExperience?.dashboardAvailableTasks,
        state?.settings?.workAndEarnPageExperience?.otherTasks,
        state?.settings?.workAndEarnPageExperience?.offerwall,
        state?.settings?.workAndEarnPageExperience?.otherTasksNavStyle
    ]);

    const hasUnsavedChanges =
        draft.dashboardAvailableTasks !== serverResolved.dashboardAvailableTasks ||
        draft.otherTasks !== serverResolved.otherTasks ||
        draft.offerwall !== serverResolved.offerwall ||
        draft.otherTasksNavStyle !== serverResolved.otherTasksNavStyle;

    const handleModeChange = (
        key: 'dashboardAvailableTasks' | 'otherTasks' | 'offerwall',
        mode: PageExperienceMode
    ) => {
        setDraft(prev => ({
            ...prev,
            [key]: mode
        }));
        setFeedback(null);
    };

    const handleNavStyleChange = (style: OtherTasksNavStyle) => {
        setDraft(prev => ({
            ...prev,
            otherTasksNavStyle: style
        }));
        setFeedback(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setFeedback(null);
        try {
            const updated = await updateSettings({
                workAndEarnPageExperience: { ...draft }
            } as any);
            if (updated) {
                dispatch({ type: 'SET_SETTINGS', payload: updated });
            }
            setFeedback({
                type: 'success',
                text: 'Work & Earn Page Experience settings saved to database and applied live.'
            });
            setTimeout(() => setFeedback(null), 5000);
        } catch (err: any) {
            setFeedback({
                type: 'error',
                text: err?.message || 'Failed to save Page Experience settings.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetAllLegacy = () => {
        setDraft(prev => ({
            ...prev,
            dashboardAvailableTasks: 'legacy',
            otherTasks: 'legacy',
            offerwall: 'legacy',
            otherTasksNavStyle: 'tabs'
        }));
        setFeedback(null);
    };

    return (
        <section
            aria-label="Work & Earn Page Experience Settings"
            className={`bg-slate-900/95 border border-slate-700/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 ${className}`}
        >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-black uppercase tracking-wider border border-amber-500/20">
                        Work & Earn → Page Experience Settings
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                        Work & Earn → Page Experience Settings
                    </h3>
                    <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        Independently switch each user-facing earning surface between the classic{' '}
                        <strong className="text-slate-200">Legacy Experience</strong> and the{' '}
                        <strong className="text-amber-300">New Provider Navigation Experience</strong> (default).
                        Changes persist in the backend database and apply immediately without altering provider credentials, postbacks, or tasks.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={handleResetAllLegacy}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all disabled:opacity-50"
                    >
                        Reset All to Legacy
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                        data-testid="save-page-experience-btn"
                        className="px-5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>
                                {hasUnsavedChanges ? 'Save Experience Settings*' : 'Save Experience Settings'}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {feedback && (
                <div
                    role="status"
                    className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border ${
                        feedback.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                >
                    <span>{feedback.text}</span>
                    <button
                        type="button"
                        onClick={() => setFeedback(null)}
                        className="font-black hover:text-white px-2"
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {EXPERIENCE_SECTIONS.map(section => {
                    const currentMode = draft[section.key];
                    const isNew = currentMode === 'new';

                    return (
                        <div
                            key={section.key}
                            data-testid={`experience-card-${section.key}`}
                            className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4"
                        >
                            <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-sm font-black text-white leading-snug">
                                        {section.title}
                                    </h4>
                                    <span
                                        className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full shrink-0 border ${
                                            isNew
                                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                    >
                                        {isNew ? 'New Mode (Default)' : 'Legacy Mode'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    {section.subtitle}
                                </p>
                            </div>

                            <div
                                role="radiogroup"
                                aria-label={`${section.title} experience mode`}
                                className="space-y-2.5"
                            >
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={!isNew}
                                    data-testid={`exp-${section.key}-legacy`}
                                    onClick={() => handleModeChange(section.key, 'legacy')}
                                    className={`w-full text-left p-3 rounded-xl border transition-all space-y-1 ${
                                        !isNew
                                            ? 'bg-blue-950/40 border-blue-500/60 ring-1 ring-blue-500/30 text-white'
                                            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-extrabold">
                                            Legacy Experience
                                        </span>
                                        <span
                                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                                !isNew ? 'border-blue-400' : 'border-slate-600'
                                            }`}
                                        >
                                            {!isNew && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            )}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        {section.legacyDescription}
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={isNew}
                                    data-testid={`exp-${section.key}-new`}
                                    onClick={() => handleModeChange(section.key, 'new')}
                                    className={`w-full text-left p-3 rounded-xl border transition-all space-y-1 ${
                                        isNew
                                            ? 'bg-amber-950/35 border-amber-500/60 ring-1 ring-amber-500/30 text-white'
                                            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-extrabold">
                                            New Provider Navigation Experience
                                        </span>
                                        <span
                                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                                isNew ? 'border-amber-400' : 'border-slate-600'
                                            }`}
                                        >
                                            {isNew && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            )}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        {section.newDescription}
                                    </p>
                                </button>
                            </div>

                            {section.key === 'otherTasks' && (
                                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                                            Integration Display Style
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-semibold">
                                            {isNew ? 'Active in New Mode' : 'Applies in New Mode'}
                                        </span>
                                    </div>
                                    <div
                                        role="radiogroup"
                                        aria-label="Other Tasks Integration Display Style"
                                        className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                                    >
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={draft.otherTasksNavStyle !== 'icons' && draft.otherTasksNavStyle !== 'cards'}
                                            data-testid="exp-otherTasksNavStyle-tabs"
                                            onClick={() => handleNavStyleChange('tabs')}
                                            className={`p-2.5 rounded-xl border text-left transition-all ${
                                                draft.otherTasksNavStyle !== 'icons' && draft.otherTasksNavStyle !== 'cards'
                                                    ? 'bg-amber-500/15 border-amber-500/60 text-white'
                                                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                                            }`}
                                        >
                                            <div className="text-[11px] font-extrabold">Tabs Bar (Default)</div>
                                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                                SELECT ALL + provider name tabs
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={draft.otherTasksNavStyle === 'icons'}
                                            data-testid="exp-otherTasksNavStyle-icons"
                                            onClick={() => handleNavStyleChange('icons')}
                                            className={`p-2.5 rounded-xl border text-left transition-all ${
                                                draft.otherTasksNavStyle === 'icons'
                                                    ? 'bg-amber-500/15 border-amber-500/60 text-white'
                                                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                                            }`}
                                        >
                                            <div className="text-[11px] font-extrabold">Provider Icons Bar</div>
                                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                                SELECT ALL + clickable icon tiles
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={draft.otherTasksNavStyle === 'cards'}
                                            data-testid="exp-otherTasksNavStyle-cards"
                                            onClick={() => handleNavStyleChange('cards')}
                                            className={`p-2.5 rounded-xl border text-left transition-all ${
                                                draft.otherTasksNavStyle === 'cards'
                                                    ? 'bg-amber-500/15 border-amber-500/60 text-white'
                                                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                                            }`}
                                        >
                                            <div className="text-[11px] font-extrabold">Provider Cards Bar</div>
                                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                                SELECT ALL + rich provider cards
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default WorkAndEarnPageExperienceSettings;
