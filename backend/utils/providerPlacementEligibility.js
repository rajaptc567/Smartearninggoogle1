import { createHash } from 'node:crypto';

/**
 * Evaluates whether a user falls within a placement's deterministic rollout percentage cohort.
 * Same user + placement + salt always yields the exact same percentage bucket (0-99).
 */
export const isUserInRollout = (userId, placementId, rolloutSalt, percentage) => {
    const pct = Number(percentage);
    if (isNaN(pct) || pct <= 0) return false;
    if (pct >= 100) return true;
    if (!userId) return false;

    const hashInput = `${String(userId).trim()}:${String(placementId || '').trim()}:${String(rolloutSalt || '').trim()}`;
    const hashHex = createHash('sha256').update(hashInput).digest('hex').substring(0, 8);
    const bucket = parseInt(hashHex, 16) % 100; // 0 - 99
    return bucket < pct;
};

/**
 * Pure evaluator for Provider Placement Eligibility.
 * Checks User Targeting, Country Targeting, and Deterministic Rollout.
 */
export const evaluatePlacementEligibility = (user, placement) => {
    if (!placement || placement.placementEnabled !== true) {
        return { eligible: false, reason: 'PLACEMENT_DISABLED' };
    }

    if (!user) {
        return { eligible: false, reason: 'UNAUTHENTICATED' };
    }

    const userIdStr = String(user._id || user.id || '').trim();

    // 1. User Targeting
    const targetingMode = placement.targetingMode || 'all';
    if (targetingMode === 'selected_users') {
        const selectedArr = Array.isArray(placement.selectedUserIds)
            ? placement.selectedUserIds.map(id => String(id._id || id).trim())
            : [];
        if (!userIdStr || !selectedArr.includes(userIdStr)) {
            return { eligible: false, reason: 'USER_NOT_SELECTED' };
        }
    } else if (targetingMode === 'test_users') {
        const testArr = Array.isArray(placement.testUserIds)
            ? placement.testUserIds.map(id => String(id._id || id).trim())
            : [];
        if (!userIdStr || !testArr.includes(userIdStr)) {
            return { eligible: false, reason: 'USER_NOT_TEST_USER' };
        }
    }

    // 2. Country Targeting
    const allowed = Array.isArray(placement.allowedCountries)
        ? placement.allowedCountries.map(c => String(c || '').trim().toUpperCase()).filter(Boolean)
        : [];
    const excluded = Array.isArray(placement.excludedCountries)
        ? placement.excludedCountries.map(c => String(c || '').trim().toUpperCase()).filter(Boolean)
        : [];

    const hasCountryTargeting = allowed.length > 0 || excluded.length > 0;
    const userCountry = typeof user.country === 'string' ? user.country.trim().toUpperCase() : '';

    if (hasCountryTargeting) {
        // Fail-closed: missing or invalid user country rejects placement when country filters apply
        if (!userCountry) {
            return { eligible: false, reason: 'MISSING_USER_COUNTRY' };
        }

        // Exclusion takes precedence
        if (excluded.length > 0 && excluded.includes(userCountry)) {
            return { eligible: false, reason: 'EXCLUDED_COUNTRY' };
        }

        // Allowlist check
        if (allowed.length > 0 && !allowed.includes(userCountry)) {
            return { eligible: false, reason: 'COUNTRY_NOT_ALLOWED' };
        }
    }

    // 3. Deterministic Rollout
    const rolloutPct = placement.rolloutPercentage !== undefined ? placement.rolloutPercentage : 100;
    if (!isUserInRollout(userIdStr, placement._id, placement.rolloutSalt, rolloutPct)) {
        return { eligible: false, reason: 'OUTSIDE_ROLLOUT_COHORT' };
    }

    return { eligible: true, reason: 'ELIGIBLE' };
};

export default evaluatePlacementEligibility;
