export type PageExperienceMode = 'legacy' | 'new';
export type OtherTasksNavStyle = 'tabs' | 'icons' | 'cards';

export interface WorkAndEarnPageExperienceConfig {
    dashboardAvailableTasks: PageExperienceMode;
    otherTasks: PageExperienceMode;
    offerwall: PageExperienceMode;
    otherTasksNavStyle: OtherTasksNavStyle;
}

export const DEFAULT_PAGE_EXPERIENCE: Readonly<WorkAndEarnPageExperienceConfig> = Object.freeze({
    dashboardAvailableTasks: 'new',
    otherTasks: 'new',
    offerwall: 'new',
    otherTasksNavStyle: 'tabs'
});

/**
 * Coerces a single experience mode value safely to 'legacy' | 'new'.
 * Missing, null, undefined, or corrupt values default to 'new' (preview default)
 * while explicit 'legacy' or 'new' selections are always respected.
 */
export const normalizePageExperienceMode = (value: unknown): PageExperienceMode => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'legacy') return 'legacy';
        if (normalized === 'new') return 'new';
    }
    return 'new';
};

/**
 * Coerces Other Tasks integration navigation style safely to 'tabs' | 'icons' | 'cards'.
 * Defaults to 'tabs' unless explicitly configured as 'icons' or 'cards'.
 */
export const normalizeOtherTasksNavStyle = (value: unknown): OtherTasksNavStyle => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'icons') return 'icons';
        if (normalized === 'cards') return 'cards';
        if (normalized === 'tabs') return 'tabs';
    }
    return 'tabs';
};

/**
 * Validates whether a provider icon string is a safe image source (https/http URL,
 * safe root-relative path, or bounded raster PNG/JPEG/WEBP/GIF base64 data URI).
 * Strictly rejects SVG data URIs, javascript:, HTML tags, and oversized payloads.
 */
export const isSafeImageIcon = (icon?: string | null): boolean => {
    if (typeof icon !== 'string') return false;
    const trimmed = icon.trim();
    if (!trimmed) return false;
    if (/[<>]/.test(trimmed) || /\s/.test(trimmed)) return false;

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('data:image/svg+xml') || lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
        return false;
    }

    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
        return trimmed.length <= 280000;
    }

    if (lower.startsWith('https://') || lower.startsWith('http://')) {
        if (trimmed.length > 2048) return false;
        try {
            const parsed = new URL(trimmed);
            return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
            return false;
        }
    }

    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
        return trimmed.length <= 512 && !trimmed.includes(':');
    }

    return false;
};

/**
 * Resolves the authoritative Page Experience configuration strictly from backend Settings.
 * Never reads browser localStorage/sessionStorage so admin server decisions are single-source-of-truth.
 */
export const resolvePageExperience = (
    settings?: { workAndEarnPageExperience?: Partial<WorkAndEarnPageExperienceConfig> | null } | null
): WorkAndEarnPageExperienceConfig => {
    const raw =
        settings &&
        typeof settings === 'object' &&
        settings.workAndEarnPageExperience &&
        typeof settings.workAndEarnPageExperience === 'object' &&
        !Array.isArray(settings.workAndEarnPageExperience)
            ? settings.workAndEarnPageExperience
            : null;

    if (!raw) {
        return { ...DEFAULT_PAGE_EXPERIENCE };
    }

    return {
        dashboardAvailableTasks: normalizePageExperienceMode(raw.dashboardAvailableTasks),
        otherTasks: normalizePageExperienceMode(raw.otherTasks),
        offerwall: normalizePageExperienceMode(raw.offerwall),
        otherTasksNavStyle: normalizeOtherTasksNavStyle(raw.otherTasksNavStyle)
    };
};
