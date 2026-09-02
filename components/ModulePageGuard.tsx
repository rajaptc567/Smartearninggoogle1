import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { getEffectiveModulePageControl } from '../data/modulePagesDefaults';

interface ModulePageGuardProps {
    pageId: string;
    category: 'investment' | 'workAndEarn';
    children: React.ReactNode;
}

export const ModulePageGuard: React.FC<ModulePageGuardProps> = ({ pageId, category, children }) => {
    const { state } = useData();
    const navigate = useNavigate();
    const { settings, currentUser } = state;

    const currentMode = (typeof window !== 'undefined' ? localStorage.getItem('dashboard_mode') : null) as 'work_and_earn' | 'investment' | null || 'work_and_earn';

    // Determine effective category based on user's current module context
    const effectiveCategory = (category === 'workAndEarn' && currentMode === 'investment' && pageId === 'userTasks')
        ? 'investment'
        : category;

    const pageControl = getEffectiveModulePageControl(settings?.modulePagesConfig, effectiveCategory, pageId);
    const workAndEarnControl = getEffectiveModulePageControl(settings?.modulePagesConfig, 'workAndEarn', pageId);
    const investmentControl = getEffectiveModulePageControl(settings?.modulePagesConfig, 'investment', pageId);

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'manager' || currentUser?.role === 'accountant';

    // Legacy sync checks
    let isLegacyEnabled = true;
    if (category === 'investment' || effectiveCategory === 'investment') {
        if (pageId === 'transfer' && (settings?.isUserTransferEnabled === false || settings?.transferConfig?.enabled === false)) isLegacyEnabled = false;
        if (pageId === 'tasks' && settings?.isTasksEnabled === false) isLegacyEnabled = false;
        if (pageId === 'userTasks' && settings?.isUserTaskEnabled === false) isLegacyEnabled = false;
    } 
    if (category === 'workAndEarn' || effectiveCategory === 'workAndEarn') {
        if (settings?.hubEnabled === false) isLegacyEnabled = false;
        if ((pageId === 'availableTasks' || pageId === 'createCampaign' || pageId === 'userTasks') && settings?.isUserTaskEnabled === false) isLegacyEnabled = false;
    }

    let isEffectivelyEnabled = pageControl.isEnabled && isLegacyEnabled;
    if (pageId === 'userTasks') {
        if (currentMode === 'investment' && investmentControl && !investmentControl.isEnabled) {
            isEffectivelyEnabled = false;
        } else if (workAndEarnControl && !workAndEarnControl.isEnabled) {
            isEffectivelyEnabled = false;
        }
    }

    if (!isEffectivelyEnabled) {
        if (isAdmin) {
            return (
                <div>
                    <div className="mb-4 p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between text-xs text-amber-200">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🛡️</span>
                            <span>
                                <strong className="font-bold text-amber-100 uppercase tracking-wide">Admin Preview Mode:</strong> This page is currently <strong>disabled</strong> for normal users. You can see it because you are logged in as Administrator.
                            </span>
                        </div>
                        <button
                            onClick={() => navigate('/admin/settings')}
                            className="px-3 py-1 bg-amber-500/30 hover:bg-amber-500/40 text-amber-100 rounded-xl font-bold transition-all shrink-0"
                        >
                            Open Settings
                        </button>
                    </div>
                    {children}
                </div>
            );
        }

        return (
            <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-lg bg-gray-900/90 border border-gray-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
                        <span className="text-3xl sm:text-4xl">{pageControl.icon || '🔒'}</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        Page Temporarily Disabled
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
                        {pageControl.name}
                    </h2>

                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6 bg-gray-950/60 p-4 rounded-2xl border border-gray-800/80">
                        {pageControl.disabledNotice || 'This page is currently disabled by the system administrator. Please check back later or reach out to support if you have questions.'}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/member')}
                            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all transform active:scale-95"
                        >
                            Return to Dashboard
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/member/disputes?module=${category === 'workAndEarn' ? 'Work%20%26%20Earn' : 'Investment'}`)}
                            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs sm:text-sm border border-gray-700 transition-all"
                        >
                            Contact Support
                        </button>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-800/60 text-[11px] text-gray-500 font-medium">
                        Module: <span className="text-gray-400 font-semibold">{category === 'workAndEarn' ? 'Work & Earn Hub' : 'Investment System'}</span>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
