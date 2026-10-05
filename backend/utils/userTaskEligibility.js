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

/**
 * Calculates a user's chronological age in integer years given their date of birth.
 * 
 * @param {string|Date} dateOfBirth - User's date of birth
 * @param {Date} [referenceDate] - Comparison timestamp (defaults to current time)
 * @returns {number|null} Age in full completed years, or null if date is missing/invalid/future
 */
export const calculateUserAge = (dateOfBirth, referenceDate = new Date()) => {
    if (!dateOfBirth) return null;
    const dob = (dateOfBirth instanceof Date) ? dateOfBirth : new Date(dateOfBirth);
    const dobTime = dob.getTime();
    if (isNaN(dobTime)) return null;

    const ref = (referenceDate instanceof Date) ? referenceDate : new Date(referenceDate);
    if (isNaN(ref.getTime())) return null;

    // Date of birth cannot be in the future
    if (dob > ref) return null;

    let age = ref.getFullYear() - dob.getFullYear();
    const monthDiff = ref.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
        age--;
    }

    return (typeof age === 'number' && Number.isFinite(age) && age >= 0) ? age : null;
};

/**
 * Validates an age limit specification.
 * Returns:
 * - null if unconfigured (null, undefined, '')
 * - number if valid non-negative finite integer
 * - 'INVALID' if value is malformed (negative, NaN, non-finite, etc.)
 */
const parseAgeLimit = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    if (!Number.isFinite(num) || isNaN(num) || num < 0) {
        return 'INVALID';
    }
    return num;
};

/**
 * Evaluates whether a worker/user satisfies the targeting constraints of a UserTask.
 * Pure function: performs no database queries or network requests.
 * 
 * @param {Object} user - The user object containing country, currency, gender, dateOfBirth
 * @param {Object} userTask - The UserTask or survey object containing optional targeting
 * @returns {boolean} True if the user is eligible to view/participate in the task
 */
export const isUserEligibleForUserTask = (user, userTask) => {
    // A null/undefined user cannot satisfy targeting rules
    if (!user) return false;

    // If task is missing or has no targeting configuration, audience is unrestricted
    const targeting = userTask?.targeting;
    if (!targeting || typeof targeting !== 'object') {
        return true;
    }

    const { countries, currencies, genders, minAge, maxAge } = targeting;

    // 1. Country Targeting
    // If countries array is configured with one or more non-empty strings, user's country must match
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
    // If currencies array is configured with one or more non-empty strings, user's currency must match
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
    // If genders array is configured with one or more non-empty strings, user's gender must match
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

    // Fail-safe against malformed age configurations
    if (parsedMinAge === 'INVALID' || parsedMaxAge === 'INVALID') {
        return false;
    }

    // If both minAge and maxAge are configured, minAge must not exceed maxAge
    if (parsedMinAge !== null && parsedMaxAge !== null && parsedMinAge > parsedMaxAge) {
        return false;
    }

    const hasAgeRestriction = parsedMinAge !== null || parsedMaxAge !== null;

    if (hasAgeRestriction) {
        // Calculate user age from dateOfBirth
        const userAge = calculateUserAge(user.dateOfBirth);

        // When an age restriction exists, a missing, invalid, or future DOB cannot be verified
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

    // All configured targeting criteria passed (or were unconfigured)
    return true;
};

export default isUserEligibleForUserTask;
