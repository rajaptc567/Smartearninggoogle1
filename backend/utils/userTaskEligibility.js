/**
 * User Task Audience Targeting & Worker Eligibility Evaluator
 * 
 * Foundation helper for worker segmentation on UserTask campaigns and surveys.
 * 
 * Rules:
 * - Empty or missing targeting means "No audience restriction" (unrestricted -> eligible).
 * - Country, currency, and gender checks are case-insensitive and safe against malformed types.
 * - When an age boundary (minAge or maxAge) is configured, the user's age is calculated from dateOfBirth.
 * - If an age restriction is configured but the user's dateOfBirth is missing, unparseable,
 *   or invalid, the user is safely rejected (ineligible) because eligibility cannot be verified.
 * - Non-finite, negative, or invalid age boundary configurations (e.g. minAge > maxAge) fail-safe
 *   and evaluate to false without throwing unhandled runtime exceptions.
 */

export const calculateUserAge = (dateOfBirth, referenceDate = new Date()) => {
    if (!dateOfBirth) return null;
    const dob = (dateOfBirth instanceof Date) ? dateOfBirth : new Date(dateOfBirth);
    const dobTime = dob.getTime();
    if (isNaN(dobTime)) return null;

    const ref = (referenceDate instanceof Date) ? referenceDate : new Date(referenceDate);
    if (isNaN(ref.getTime())) return null;

    if (dob > ref) return null;

    let age = ref.getFullYear() - dob.getFullYear();
    const monthDiff = ref.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
        age--;
    }

    return (typeof age === 'number' && Number.isFinite(age) && age >= 0) ? age : null;
};

const parseAgeLimit = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    if (!Number.isFinite(num) || isNaN(num) || num < 0) {
        return 'INVALID';
    }
    return num;
};

const evaluateCondition = (actualValue, operator, expectedValue) => {
    const op = String(operator || 'equals').trim().toLowerCase();
    const hasActual = actualValue !== undefined && actualValue !== null && actualValue !== '';

    if (!hasActual) {
        if (op === 'not_equals' || op === 'not_contains' || op === 'not_in') return true;
        return false;
    }

    const actStr = String(actualValue).trim().toLowerCase();
    const expStr = expectedValue !== undefined && expectedValue !== null ? String(expectedValue).trim().toLowerCase() : '';

    switch (op) {
        case 'equals':
            if (Array.isArray(actualValue)) {
                return actualValue.some(v => String(v).trim().toLowerCase() === expStr);
            }
            return actStr === expStr || (Number(actualValue) === Number(expectedValue) && !isNaN(Number(actualValue)));
        
        case 'not_equals':
            if (Array.isArray(actualValue)) {
                return !actualValue.some(v => String(v).trim().toLowerCase() === expStr);
            }
            return actStr !== expStr && (Number(actualValue) !== Number(expectedValue) || isNaN(Number(actualValue)));

        case 'contains':
            if (Array.isArray(actualValue)) {
                return actualValue.some(v => String(v).trim().toLowerCase().includes(expStr));
            }
            return actStr.includes(expStr);

        case 'not_contains':
            if (Array.isArray(actualValue)) {
                return !actualValue.some(v => String(v).trim().toLowerCase().includes(expStr));
            }
            return !actStr.includes(expStr);

        case 'in':
            if (Array.isArray(expectedValue)) {
                return expectedValue.map(v => String(v).trim().toLowerCase()).includes(actStr);
            }
            return actStr === expStr;

        case 'not_in':
            if (Array.isArray(expectedValue)) {
                return !expectedValue.map(v => String(v).trim().toLowerCase()).includes(actStr);
            }
            return actStr !== expStr;

        default:
            return false;
    }
};

/**
 * Evaluates whether a worker/user satisfies the targeting constraints of a UserTask.
 * Pure function: performs no database queries or network requests.
 * 
 * @param {Object} user - The user object containing country, currency, gender, dateOfBirth, status, customFields
 * @param {Object} userTask - The UserTask or survey object containing optional targeting
 * @param {Object} [context] - Optional preloaded data (e.g. submissions) for advanced evaluation
 * @returns {boolean} True if the user is eligible to view/participate in the task
 */
export const isUserEligibleForUserTask = (user, userTask, context = {}) => {
    if (!user) return false;

    const targeting = userTask?.targeting;
    if (!targeting || typeof targeting !== 'object') {
        return true;
    }

    const { countries, currencies, genders, minAge, maxAge, selectedUserIds, accountStatus, completionRules, profileRules, surveyAnswerRules } = targeting;

    // 1. Country Targeting
    if (Array.isArray(countries) && countries.length > 0) {
        const cleanCountries = countries
            .filter(c => typeof c === 'string' && c.trim().length > 0)
            .map(c => c.trim().toLowerCase());

        if (cleanCountries.length > 0) {
            const userCountry = typeof user.country === 'string' ? user.country.trim().toLowerCase() : '';
            if (!userCountry || !cleanCountries.includes(userCountry)) {
                return false;
            }
        }
    }

    // 2. Currency Targeting
    if (Array.isArray(currencies) && currencies.length > 0) {
        const cleanCurrencies = currencies
            .filter(c => typeof c === 'string' && c.trim().length > 0)
            .map(c => c.trim().toUpperCase());

        if (cleanCurrencies.length > 0) {
            const userCurrency = typeof user.currency === 'string' ? user.currency.trim().toUpperCase() : '';
            if (!userCurrency || !cleanCurrencies.includes(userCurrency)) {
                return false;
            }
        }
    }

    // 3. Gender Targeting
    if (Array.isArray(genders) && genders.length > 0) {
        const cleanGenders = genders
            .filter(g => typeof g === 'string' && g.trim().length > 0)
            .map(g => g.trim().toLowerCase());

        if (cleanGenders.length > 0) {
            const userGender = typeof user.gender === 'string' ? user.gender.trim().toLowerCase() : '';
            if (!userGender || !cleanGenders.includes(userGender)) {
                return false;
            }
        }
    }

    // 4. Age Boundaries (minAge / maxAge)
    const parsedMinAge = parseAgeLimit(minAge);
    const parsedMaxAge = parseAgeLimit(maxAge);

    if (parsedMinAge === 'INVALID' || parsedMaxAge === 'INVALID') {
        return false;
    }

    if (parsedMinAge !== null && parsedMaxAge !== null && parsedMinAge > parsedMaxAge) {
        return false;
    }

    const hasAgeRestriction = parsedMinAge !== null || parsedMaxAge !== null;

    if (hasAgeRestriction) {
        const userAge = calculateUserAge(user.dateOfBirth);
        if (userAge === null) {
            return false;
        }

        if (parsedMinAge !== null && userAge < parsedMinAge) {
            return false;
        }

        if (parsedMaxAge !== null && userAge > parsedMaxAge) {
            return false;
        }
    }

    // 5. Selected Users Targeting
    if (Array.isArray(selectedUserIds) && selectedUserIds.length > 0) {
        const userIdStr = String(user._id || user.id || '');
        const cleanSelected = selectedUserIds.map(id => String(id).trim());
        if (!userIdStr || !cleanSelected.includes(userIdStr)) {
            return false;
        }
    }

    // 6. Account Status Targeting
    const statusRule = String(accountStatus || 'any').trim().toLowerCase();
    if (statusRule === 'active' && user.status !== 'Active') {
        return false;
    }
    if (statusRule === 'inactive' && user.status === 'Active') {
        return false;
    }

    // 7. Completion Rules (AND logic)
    if (Array.isArray(completionRules) && completionRules.length > 0) {
        const submissions = Array.isArray(context.submissions) ? context.submissions : [];
        for (const rule of completionRules) {
            const targetTaskId = String(rule.taskId || '');
            const mustBeCompleted = Boolean(rule.completed);

            const matchingSub = submissions.find(s => {
                const sTaskId = String(s.taskId || s.task?._id || '');
                const isMatchTask = sTaskId === targetTaskId;
                const isSuccessful = s.status === 'Approved' || s.status === 'Paid' || s.status === 'Completed' || s.paid === true || s.rewardClaimed === true;
                return isMatchTask && isSuccessful;
            });

            const hasCompleted = Boolean(matchingSub);
            if (mustBeCompleted && !hasCompleted) return false;
            if (!mustBeCompleted && hasCompleted) return false;
        }
    }

    // 8. Profile Rules (AND logic)
    if (Array.isArray(profileRules) && profileRules.length > 0) {
        const customFields = user.customFields || {};
        for (const rule of profileRules) {
            const fieldKey = String(rule.fieldKey || '').trim();
            if (!fieldKey) continue;

            const attrObj = customFields[fieldKey];
            const attrVal = (attrObj && typeof attrObj === 'object' && 'value' in attrObj) ? attrObj.value : attrObj;

            const matches = evaluateCondition(attrVal, rule.operator, rule.value);
            if (!matches) return false;
        }
    }

    // 9. Survey Answer Rules (AND logic)
    if (Array.isArray(surveyAnswerRules) && surveyAnswerRules.length > 0) {
        const submissions = Array.isArray(context.submissions) ? context.submissions : [];
        for (const rule of surveyAnswerRules) {
            const targetTaskId = String(rule.taskId || '');
            const questionId = String(rule.questionId || '');
            if (!targetTaskId || !questionId) continue;

            const sub = submissions.find(s => String(s.taskId || s.task?._id || '') === targetTaskId);
            const surveyResponses = Array.isArray(sub?.surveyResponses) ? sub.surveyResponses : [];
            const resp = surveyResponses.find(r => String(r?.questionId || '') === questionId);
            const respVal = resp ? resp.value : undefined;

            const matches = evaluateCondition(respVal, rule.operator, rule.value);
            if (!matches) return false;
        }
    }

    return true;
};

export default isUserEligibleForUserTask;
