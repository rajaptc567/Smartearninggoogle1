import { useEffect, useMemo } from 'react';
import { scheduleOtherTasksPrefetch } from '../services/providerPlacementService';

export interface UseOtherTasksPrefetchOptions {
    enabled: boolean;
    userId?: string | null;
    tabIds: string[];
    freshTtlMs?: number;
}

/**
 * Schedules low-priority background prefetch of Other Tasks placements ONLY AFTER
 * the caller signals that the currently active page's own required data has
 * finished loading and at least one animation frame has painted so the page is visibly usable.
 */
export function useOtherTasksPrefetch({
    enabled,
    userId,
    tabIds,
    freshTtlMs = 30000
}: UseOtherTasksPrefetchOptions): void {
    const tabKey = useMemo(
        () => Array.from(new Set((tabIds || []).map(id => (id ? String(id).trim() : '')).filter(Boolean))).join('|'),
        [tabIds]
    );

    useEffect(() => {
        if (!enabled || !userId || !tabKey) {
            return;
        }

        let isEffectActive = true;
        let rafId: number | null = null;
        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
        let cancelPrefetch: (() => void) | null = null;

        const normalizedTabIds = tabKey.split('|').filter(Boolean);

        const startPrefetch = () => {
            if (!isEffectActive) return;
            cancelPrefetch = scheduleOtherTasksPrefetch({
                userId,
                tabIds: normalizedTabIds,
                isCancelled: () => !isEffectActive,
                freshTtlMs
            });
        };

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                startPrefetch();
            });
        } else {
            fallbackTimer = setTimeout(() => {
                fallbackTimer = null;
                startPrefetch();
            }, 50);
        }

        return () => {
            isEffectActive = false;
            if (rafId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (fallbackTimer !== null) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            if (cancelPrefetch) {
                cancelPrefetch();
                cancelPrefetch = null;
            }
        };
    }, [enabled, userId, tabKey, freshTtlMs]);
}
