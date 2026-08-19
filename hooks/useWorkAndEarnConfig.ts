import { useState, useEffect } from 'react';
import { WorkAndEarnModuleConfig } from '../types/workAndEarnEditor';
import { getWorkAndEarnConfig } from '../services/workAndEarnConfigService';

export function useWorkAndEarnConfig(): WorkAndEarnModuleConfig {
    const [config, setConfig] = useState<WorkAndEarnModuleConfig>(getWorkAndEarnConfig());

    useEffect(() => {
        const handleUpdate = () => {
            setConfig(getWorkAndEarnConfig());
        };

        window.addEventListener('workAndEarnConfigUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);

        return () => {
            window.removeEventListener('workAndEarnConfigUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, []);

    return config;
}
