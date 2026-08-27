import { WorkAndEarnModuleConfig, defaultWorkAndEarnConfig } from '../types/workAndEarnEditor';

const STORAGE_KEY = 'smartearning_work_and_earn_config';

export function getWorkAndEarnConfig(serverConfig?: WorkAndEarnModuleConfig | null): WorkAndEarnModuleConfig {
    if (serverConfig && typeof serverConfig === 'object') {
        const mergedSubmenus = { ...defaultWorkAndEarnConfig.submenus };
        if (serverConfig.submenus) {
            (Object.keys(defaultWorkAndEarnConfig.submenus) as (keyof typeof defaultWorkAndEarnConfig.submenus)[]).forEach(key => {
                if (serverConfig.submenus[key]) {
                    mergedSubmenus[key] = {
                        ...defaultWorkAndEarnConfig.submenus[key],
                        ...serverConfig.submenus[key],
                        visibleColumns: {
                            ...defaultWorkAndEarnConfig.submenus[key].visibleColumns,
                            ...(serverConfig.submenus[key].visibleColumns || {})
                        }
                    };
                }
            });
        }
        return {
            ...defaultWorkAndEarnConfig,
            ...serverConfig,
            submenus: mergedSubmenus
        };
    }

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const mergedSubmenus = { ...defaultWorkAndEarnConfig.submenus };
            if (parsed.submenus) {
                (Object.keys(defaultWorkAndEarnConfig.submenus) as (keyof typeof defaultWorkAndEarnConfig.submenus)[]).forEach(key => {
                    if (parsed.submenus[key]) {
                        mergedSubmenus[key] = {
                            ...defaultWorkAndEarnConfig.submenus[key],
                            ...parsed.submenus[key],
                            visibleColumns: {
                                ...defaultWorkAndEarnConfig.submenus[key].visibleColumns,
                                ...(parsed.submenus[key].visibleColumns || {})
                            }
                        };
                    }
                });
            }
            return {
                ...defaultWorkAndEarnConfig,
                ...parsed,
                submenus: mergedSubmenus
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
