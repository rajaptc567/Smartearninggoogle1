import { CustomEarnTab } from '../types';
import { getEffectiveModulePageControl } from '../data/modulePagesDefaults';

/**
 * Returns the list of visible custom earn main tabs based on:
 * 1. tab.enabled !== false
 * 2. not hidden in navigation (isHiddenInNav !== true)
 * 3. if it represents 'other_tasks', it respects modulePagesConfig.workAndEarn.otherTasks (isEnabled & !isHiddenInNav)
 * 4. must have at least one enabled subtab
 */
export function getVisibleEarnTabs(
    customEarnTabs: CustomEarnTab[] | undefined | null,
    modulePagesConfig?: any
): CustomEarnTab[] {
    if (!Array.isArray(customEarnTabs) || customEarnTabs.length === 0) {
        return [];
    }

    const otherTasksControl = getEffectiveModulePageControl(modulePagesConfig, 'workAndEarn', 'otherTasks');

    return customEarnTabs.filter(tab => {
        if (!tab) return false;
        if (tab.enabled === false) return false;
        if ((tab as any).isHiddenInNav === true) return false;

        // If this tab represents "Other Tasks", check otherTasksControl
        const isOther = tab.id === 'other_tasks' || tab.title?.toLowerCase().includes('other');
        if (isOther) {
            if (!otherTasksControl.isEnabled || otherTasksControl.isHiddenInNav) {
                return false;
            }
        }

        // Must have at least one enabled sub-tab
        const activeSubTabs = (tab.subTabs || []).filter(st => st && st.enabled !== false);
        if (activeSubTabs.length === 0) {
            return false;
        }

        return true;
    });
}
