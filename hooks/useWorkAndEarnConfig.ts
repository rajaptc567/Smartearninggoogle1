import { useState, useEffect, useMemo } from 'react';
import { WorkAndEarnModuleConfig } from '../types/workAndEarnEditor';
import { getWorkAndEarnConfig } from '../services/workAndEarnConfigService';
import { useData } from './useData';

export function useWorkAndEarnConfig(): WorkAndEarnModuleConfig {
    const { state } = useData();
    const serverConfig = state?.settings?.workAndEarnConfig;
    const [localRevision, setLocalRevision] = useState(0);

    useEffect(() => {
        const handleUpdate = () => {
            setLocalRevision(r => r + 1);
        };

        window.addEventListener('workAndEarnConfigUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);

        return () => {
            window.removeEventListener('workAndEarnConfigUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, []);

    return useMemo(() => {
        return getWorkAndEarnConfig(serverConfig);
    }, [serverConfig, localRevision]);
}
