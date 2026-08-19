import { WorkAndEarnModuleConfig, defaultWorkAndEarnConfig } from '../types/workAndEarnEditor';

const STORAGE_KEY = 'smartearning_work_and_earn_config';

export function getWorkAndEarnConfig(): WorkAndEarnModuleConfig {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                ...defaultWorkAndEarnConfig,
                ...parsed,
                submenus: {
                    ...defaultWorkAndEarnConfig.submenus,
                    ...(parsed.submenus || {})
                }
            };
        }
    } catch (e) {
        console.error('Error reading Work & Earn configuration:', e);
    }
    return defaultWorkAndEarnConfig;
}

export function saveWorkAndEarnConfig(config: WorkAndEarnModuleConfig): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        // Dispatch custom event so reactive components can update instantly
        window.dispatchEvent(new Event('workAndEarnConfigUpdated'));
    } catch (e) {
        console.error('Error saving Work & Earn configuration:', e);
    }
}

export function resetWorkAndEarnConfig(): WorkAndEarnModuleConfig {
    try {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event('workAndEarnConfigUpdated'));
    } catch (e) {
        console.error('Error resetting Work & Earn configuration:', e);
    }
    return defaultWorkAndEarnConfig;
}
