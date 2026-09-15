// Survey Branching, Logic Evaluation, Check Question Validation, and Graph Cycle Engine

export interface SurveyLogicCondition {
    questionId: string;
    operator: 
        | 'equals' 
        | 'not_equals' 
        | 'contains' 
        | 'not_contains' 
        | 'greater_than' 
        | 'less_than' 
        | 'greater_equal' 
        | 'less_equal' 
        | 'between' 
        | 'answered' 
        | 'not_answered';
    value?: any;
    value2?: any; // For 'between' range
}

export interface SurveyLogicRule {
    id: string;
    description?: string;
    matchType: 'ALL' | 'ANY'; // AND / OR
    conditions: SurveyLogicCondition[];
    action: 
        | 'show_question' 
        | 'hide_question' 
        | 'skip_question' 
        | 'goto_question' 
        | 'goto_section' 
        | 'skip_section' 
        | 'end_survey' 
        | 'qualify' 
        | 'disqualify' 
        | 'show_message' 
        | 'warning' 
        | 'require_answer' 
        | 'make_optional';
    targetQuestionId?: string;
    targetSectionId?: string;
    message?: string;
    elseAction?: 
        | 'show_question' 
        | 'hide_question' 
        | 'skip_question' 
        | 'goto_question' 
        | 'goto_section' 
        | 'skip_section' 
        | 'end_survey' 
        | 'qualify' 
        | 'disqualify' 
        | 'show_message' 
        | 'warning' 
        | 'require_answer' 
        | 'make_optional';
    elseTargetQuestionId?: string;
    elseTargetSectionId?: string;
    elseMessage?: string;
}

export interface SurveySection {
    id: string;
    title: string;
    description?: string;
}

export interface SurveyQuestion {
    id: string;
    type: 'single_choice' | 'multiple_choice' | 'yes_no' | 'rating' | 'opinion_scale' | 'short_text' | 'long_text' | 'dropdown' | 'number' | 'top_n' | string;
    title: string;
    description?: string;
    required: boolean;
    options?: any[];
    allowOther?: boolean;
    validation?: {
        required?: boolean;
        minSelections?: number;
        maxSelections?: number;
        topN?: number;
        minLength?: number;
        maxLength?: number;
        minValue?: number;
        maxValue?: number;
        minRating?: number;
        maxRating?: number;
        customPattern?: string;
    };
    isAttentionCheck?: boolean;
    expectedAnswer?: string;
    minRating?: number;
    maxRating?: number;
    sectionId?: string;
    secondsLimit?: number;
    
    // Check Question Verification Fields
    isCheckQuestion?: boolean;
    sourceQuestionId?: string;
    checkComparisonMethod?: 'exact' | 'case_insensitive' | 'trim_spaces' | 'normalized' | 'numeric' | 'date' | string;
    checkFailureAction?: 'retry' | 'flag' | 'review' | 'disqualify' | 'reject' | string;
    maxCheckAttempts?: number;
    checkRetryMessage?: string;

    // Logic Rules attached to this question
    logicRules?: SurveyLogicRule[];
}

export interface SurveyConfigData {
    category: string;
    estimatedTimeMinutes: number;
    description?: string;
    questions: SurveyQuestion[];
    sections?: SurveySection[];
    consentDisclaimer?: string;
    approvalMode?: 'auto' | 'creator' | 'admin';
    globalLogicRules?: SurveyLogicRule[];
}

/**
 * Normalizes values for comparison (exact, case_insensitive, trim_spaces, normalized, numeric, date)
 */
export function normalizeValue(val: any, method: string = 'case_insensitive'): any {
    if (val === undefined || val === null) return '';
    const str = String(val);

    switch (method) {
        case 'exact':
            return str;
        case 'trim_spaces':
            return str.replace(/\s+/g, '');
        case 'numeric': {
            const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
            return isNaN(num) ? str.trim().toLowerCase() : num;
        }
        case 'date': {
            const parsed = Date.parse(str);
            if (!isNaN(parsed)) {
                const d = new Date(parsed);
                // Return YYYY-MM-DD
                return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            }
            // Standardize month names if parse fails
            const months: Record<string, string> = {
                jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            };
            let cleaned = str.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
            for (const [mName, mNum] of Object.entries(months)) {
                if (cleaned.includes(mName)) {
                    cleaned = cleaned.replace(new RegExp(mName + '[a-z]*', 'g'), mNum);
                    break;
                }
            }
            const parts = cleaned.match(/\d+/g);
            if (parts && parts.length >= 3) {
                // If year is 4 digits
                let y = parts.find(p => p.length === 4) || parts[parts.length - 1];
                let rest = parts.filter(p => p !== y);
                return `${y}-${rest.map(r => r.padStart(2, '0')).join('-')}`;
            }
            return str.trim().toLowerCase();
        }
        case 'normalized':
            // Strip diacritics, lowercase, trim spaces
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
        case 'case_insensitive':
        default:
            return str.trim().toLowerCase();
    }
}

/**
 * Verifies consistency between a check question and its source question
 */
export function verifyCheckQuestion(
    sourceVal: any,
    checkVal: any,
    method: 'exact' | 'case_insensitive' | 'trim_spaces' | 'normalized' | 'numeric' | 'date' | string = 'case_insensitive'
): { passed: boolean; normalizedSource: any; normalizedCheck: any } {
    if (sourceVal === undefined || sourceVal === null || sourceVal === '') {
        return { passed: false, normalizedSource: '', normalizedCheck: '' };
    }
    if (checkVal === undefined || checkVal === null || checkVal === '') {
        return { passed: false, normalizedSource: '', normalizedCheck: '' };
    }

    const nSource = normalizeValue(sourceVal, method);
    const nCheck = normalizeValue(checkVal, method);

    const passed = typeof nSource === 'number' && typeof nCheck === 'number'
        ? nSource === nCheck
        : String(nSource) === String(nCheck);

    return { passed, normalizedSource: nSource, normalizedCheck: nCheck };
}

/**
 * Evaluates a single logic condition against current survey responses
 */
export function evaluateCondition(condition: SurveyLogicCondition, responses: Record<string, any>): boolean {
    const rawVal = responses[condition.questionId];

    if (condition.operator === 'answered') {
        if (rawVal === undefined || rawVal === null || rawVal === '') return false;
        if (Array.isArray(rawVal) && rawVal.length === 0) return false;
        return true;
    }

    if (condition.operator === 'not_answered') {
        if (rawVal === undefined || rawVal === null || rawVal === '') return true;
        if (Array.isArray(rawVal) && rawVal.length === 0) return true;
        return false;
    }

    // For any value comparison, if question has not been answered yet, condition cannot match
    if (rawVal === undefined || rawVal === null || rawVal === '') return false;
    if (Array.isArray(rawVal) && rawVal.length === 0) return false;

    // Array / Multiple choice / Top-N response handling
    if (Array.isArray(rawVal)) {
        const normalizeItem = (v: any) => String(v !== undefined && v !== null ? v : '').trim().toLowerCase();
        const selectedSet = Array.from(new Set(rawVal.map(normalizeItem).filter(s => s.length > 0))).sort();
        const targetStr = normalizeItem(condition.value);

        // Helper to parse target into normalized array
        const parseTargetSet = (val: any): string[] => {
            if (Array.isArray(val)) {
                return Array.from(new Set(val.map(normalizeItem).filter(s => s.length > 0))).sort();
            }
            if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (Array.isArray(parsed)) {
                            return Array.from(new Set(parsed.map(normalizeItem).filter(s => s.length > 0))).sort();
                        }
                    } catch {
                        // ignore JSON parse error
                    }
                }
                if (trimmed.includes(',') || trimmed.includes(';') || trimmed.includes('|')) {
                    return Array.from(new Set(trimmed.split(/[,;|]+/).map(normalizeItem).filter(s => s.length > 0))).sort();
                }
                if (trimmed) {
                    return [normalizeItem(trimmed)];
                }
                return [];
            }
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                return [normalizeItem(val)];
            }
            return [];
        };

        const targetSet = parseTargetSet(condition.value);

        if (condition.operator === 'contains') {
            if (targetSet.length > 1) {
                return targetSet.every(t => selectedSet.includes(t));
            }
            return selectedSet.includes(targetStr);
        }
        if (condition.operator === 'not_contains') {
            if (targetSet.length > 1) {
                return !targetSet.some(t => selectedSet.includes(t));
            }
            return !selectedSet.includes(targetStr);
        }
        if (condition.operator === 'equals') {
            return selectedSet.length === targetSet.length && selectedSet.every((item, i) => item === targetSet[i]);
        }
        if (condition.operator === 'not_equals') {
            return !(selectedSet.length === targetSet.length && selectedSet.every((item, i) => item === targetSet[i]));
        }
    }

    const ansStr = String(rawVal).toLowerCase().trim();
    const condStr = String(condition.value !== undefined ? condition.value : '').toLowerCase().trim();

    // Numeric comparisons
    const numAns = parseFloat(ansStr);
    const numCond = parseFloat(condStr);
    const hasNumeric = !isNaN(numAns) && !isNaN(numCond);

    switch (condition.operator) {
        case 'equals':
            return hasNumeric ? numAns === numCond : ansStr === condStr;
        case 'not_equals':
            return hasNumeric ? numAns !== numCond : ansStr !== condStr;
        case 'contains':
            return ansStr.includes(condStr);
        case 'not_contains':
            return !ansStr.includes(condStr);
        case 'greater_than':
            return hasNumeric && numAns > numCond;
        case 'less_than':
            return hasNumeric && numAns < numCond;
        case 'greater_equal':
            return hasNumeric && numAns >= numCond;
        case 'less_equal':
            return hasNumeric && numAns <= numCond;
        case 'between': {
            const condStr2 = String(condition.value2 !== undefined ? condition.value2 : '').toLowerCase().trim();
            const numCond2 = parseFloat(condStr2);
            if (!hasNumeric || isNaN(numCond2)) return false;
            // Do not silently swap min/max
            if (numCond > numCond2) return false;
            return numAns >= numCond && numAns <= numCond2;
        }
        default:
            return false;
    }
}

/**
 * Evaluates a rule containing one or more conditions
 */
export function evaluateRule(
    rule: SurveyLogicRule,
    responses: Record<string, any>
): { matched: boolean; action: string; targetQuestionId?: string; targetSectionId?: string; message?: string } {
    if (!rule.conditions || rule.conditions.length === 0) {
        return { matched: false, action: '' };
    }

    let isMatch = false;
    if (rule.matchType === 'ANY') {
        isMatch = rule.conditions.some(c => evaluateCondition(c, responses));
    } else {
        // ALL
        isMatch = rule.conditions.every(c => evaluateCondition(c, responses));
    }

    if (isMatch) {
        return {
            matched: true,
            action: rule.action,
            targetQuestionId: rule.targetQuestionId,
            targetSectionId: rule.targetSectionId,
            message: rule.message
        };
    } else if (rule.elseAction) {
        // Only trigger elseAction if at least one question referenced in conditions has been answered
        const hasAnyResponse = rule.conditions.some(c => {
            const v = responses[c.questionId];
            return v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0);
        });

        if (hasAnyResponse) {
            return {
                matched: false,
                action: rule.elseAction,
                targetQuestionId: rule.elseTargetQuestionId,
                targetSectionId: rule.elseTargetSectionId,
                message: rule.elseMessage
            };
        }
    }

    return { matched: false, action: '' };
}

export interface CheckQuestionResult {
    passed: boolean;
    action: 'passed' | 'retry' | 'flag' | 'review' | 'disqualify' | 'reject';
    message?: string;
    attemptsLeft: number;
    isExhausted: boolean;
}

/**
 * Evaluates consistency of check questions with retry limits and failure action routing
 */
export function evaluateCheckQuestion(
    checkQ: SurveyQuestion,
    sourceVal: any,
    checkVal: any,
    currentAttempts: number = 1
): CheckQuestionResult {
    const method = checkQ.checkComparisonMethod || 'case_insensitive';
    const { passed } = verifyCheckQuestion(sourceVal, checkVal, method);

    const maxAttempts = checkQ.maxCheckAttempts || 1;
    const isExhausted = currentAttempts >= maxAttempts;
    const configuredAction = checkQ.checkFailureAction || 'retry';

    if (passed) {
        return {
            passed: true,
            action: 'passed',
            attemptsLeft: Math.max(0, maxAttempts - currentAttempts),
            isExhausted: false
        };
    }

    if (configuredAction === 'retry' && !isExhausted) {
        return {
            passed: false,
            action: 'retry',
            message: checkQ.checkRetryMessage || 'Your answer does not match what you provided earlier. Please verify and try again.',
            attemptsLeft: Math.max(0, maxAttempts - currentAttempts),
            isExhausted: false
        };
    }

    const finalAction = configuredAction === 'retry' ? 'disqualify' : configuredAction;
    return {
        passed: false,
        action: finalAction as any,
        message: finalAction === 'disqualify' || (configuredAction === 'retry' && isExhausted)
            ? 'Verification failed: Inconsistent response detected across verification check questions.'
            : finalAction === 'flag'
            ? 'Response flagged for quality review due to check question mismatch.'
            : finalAction === 'review'
            ? 'Response marked for creator manual audit due to check question mismatch.'
            : 'Response rejected due to check question mismatch.',
        attemptsLeft: 0,
        isExhausted: true
    };
}

/**
 * Evaluates attention trap check questions
 */
export function evaluateAttentionCheck(
    q: SurveyQuestion,
    answer: any
): { passed: boolean; message?: string } {
    if (!q.isAttentionCheck || !q.expectedAnswer) return { passed: true };

    const parseArrayValues = (val: any): string[] => {
        if (Array.isArray(val)) {
            return val.map(x => String(x).trim().toLowerCase()).filter(Boolean);
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        return parsed.map(x => String(x).trim().toLowerCase()).filter(Boolean);
                    }
                } catch {
                    // fall through
                }
            }
            if (trimmed.includes(',') || trimmed.includes(';') || trimmed.includes('|')) {
                return trimmed.split(/[,;|]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
            }
            if (trimmed) {
                return [trimmed.toLowerCase()];
            }
        }
        return [];
    };

    let passed = false;

    if (q.type === 'top_n') {
        // Order-aware deterministic comparison
        const expectedArr = parseArrayValues(q.expectedAnswer);
        const actualArr = parseArrayValues(answer);
        passed = expectedArr.length > 0 &&
            actualArr.length === expectedArr.length &&
            actualArr.every((v, i) => v === expectedArr[i]);
    } else if (q.type === 'multiple_choice' || Array.isArray(answer)) {
        // Set / order-agnostic comparison for normalized selected values
        const expectedArr = parseArrayValues(q.expectedAnswer);
        const actualArr = parseArrayValues(answer);
        if (expectedArr.length > 0 && actualArr.length === expectedArr.length) {
            const sortedExpected = [...expectedArr].sort();
            const sortedActual = [...actualArr].sort();
            passed = sortedExpected.every((v, i) => v === sortedActual[i]);
        } else {
            passed = false;
        }
    } else {
        // Keep current behavior for string / number / single-choice
        const expected = String(q.expectedAnswer).trim().toLowerCase();
        const actual = String(answer !== undefined && answer !== null ? answer : '').trim().toLowerCase();
        passed = expected === actual;
    }

    return {
        passed,
        message: passed ? undefined : 'Attention trap check failed. Inattentive response detected.'
    };
}

export interface SurveyFlowResult {
    visibleQuestions: SurveyQuestion[];
    hiddenQuestionIds: Set<string>;
    skippedQuestionIds: Set<string>;
    requiredMap: Record<string, boolean>;
    status: 'in_progress' | 'completed' | 'disqualified';
    disqualificationReason?: string;
    qualificationStatus: 'Completed' | 'Qualified' | 'Disqualified' | 'Standard';
    messages: { type: 'info' | 'warning'; text: string; questionId?: string }[];
}

/**
 * Helper to apply an evaluated rule action to survey flow state
 * Shared unified execution path for global rules, question rules, and their ELSE actions.
 */
export function applyRuleAction(
    res: { action: string; targetQuestionId?: string; targetSectionId?: string; message?: string },
    questions: SurveyQuestion[],
    fromIndex: number,
    state: {
        skipped: Set<string>;
        hidden: Set<string>;
        explicitShown: Set<string>;
        requiredMap: Record<string, boolean>;
        messages: { type: 'info' | 'warning'; text: string; questionId?: string }[];
        status: 'in_progress' | 'completed' | 'disqualified';
        disqualificationReason: string;
        qualificationStatus: 'Completed' | 'Qualified' | 'Disqualified' | 'Standard';
    },
    defaultSourceQuestionId?: string,
    isGlobal: boolean = false
): boolean {
    if (!res.action) return false;

    if (res.action === 'disqualify') {
        state.status = 'disqualified';
        state.qualificationStatus = 'Disqualified';
        state.disqualificationReason = res.message || (isGlobal ? 'Screened out by global criteria.' : 'Disqualified based on logic screening criteria.');
        const startSkip = fromIndex >= 0 ? fromIndex + 1 : 0;
        for (let j = startSkip; j < questions.length; j++) {
            state.skipped.add(questions[j].id);
        }
        return true;
    } else if (res.action === 'qualify') {
        state.qualificationStatus = 'Qualified';
    } else if (res.action === 'end_survey') {
        state.status = 'completed';
        const startSkip = fromIndex >= 0 ? fromIndex + 1 : 0;
        for (let j = startSkip; j < questions.length; j++) {
            state.skipped.add(questions[j].id);
        }
        return true;
    } else if (res.action === 'goto_question' && res.targetQuestionId) {
        const targetIdx = questions.findIndex(tq => tq.id === res.targetQuestionId);
        if (targetIdx > fromIndex) {
            const startSkip = fromIndex >= 0 ? fromIndex + 1 : 0;
            for (let j = startSkip; j < targetIdx; j++) {
                state.skipped.add(questions[j].id);
            }
        }
    } else if (res.action === 'goto_section' && res.targetSectionId) {
        const targetIdx = questions.findIndex(tq => tq.sectionId === res.targetSectionId);
        if (targetIdx > fromIndex) {
            const startSkip = fromIndex >= 0 ? fromIndex + 1 : 0;
            for (let j = startSkip; j < targetIdx; j++) {
                state.skipped.add(questions[j].id);
            }
        }
    } else if (res.action === 'skip_question') {
        if (res.targetQuestionId) {
            state.skipped.add(res.targetQuestionId);
        } else if (fromIndex + 1 < questions.length && fromIndex >= 0) {
            state.skipped.add(questions[fromIndex + 1].id);
        }
    } else if (res.action === 'skip_section' && res.targetSectionId) {
        questions.forEach(tq => {
            if (tq.sectionId === res.targetSectionId) {
                state.skipped.add(tq.id);
            }
        });
    } else if (res.action === 'show_question' && res.targetQuestionId) {
        state.explicitShown.add(res.targetQuestionId);
        state.hidden.delete(res.targetQuestionId);
        state.skipped.delete(res.targetQuestionId);
    } else if (res.action === 'hide_question' && res.targetQuestionId) {
        state.hidden.add(res.targetQuestionId);
    } else if (res.action === 'require_answer' && res.targetQuestionId) {
        state.requiredMap[res.targetQuestionId] = true;
    } else if (res.action === 'make_optional' && res.targetQuestionId) {
        state.requiredMap[res.targetQuestionId] = false;
    } else if (res.action === 'show_message' && res.message) {
        state.messages.push({ type: 'info', text: res.message, questionId: defaultSourceQuestionId });
    } else if (res.action === 'warning' && res.message) {
        state.messages.push({ type: 'warning', text: res.message, questionId: defaultSourceQuestionId });
    }

    return false;
}

/**
 * Single source of truth for full survey flow evaluation
 */
export function evaluateSurveyFlow(
    questions: SurveyQuestion[],
    sections: SurveySection[] = [],
    responses: Record<string, any> = {},
    globalRules: SurveyLogicRule[] = [],
    checkAttempts: Record<string, number> = {}
): SurveyFlowResult {
    const state = {
        skipped: new Set<string>(),
        hidden: new Set<string>(),
        explicitShown: new Set<string>(),
        requiredMap: {} as Record<string, boolean>,
        messages: [] as { type: 'info' | 'warning'; text: string; questionId?: string }[],
        status: 'in_progress' as 'in_progress' | 'completed' | 'disqualified',
        disqualificationReason: '',
        qualificationStatus: 'Standard' as 'Completed' | 'Qualified' | 'Disqualified' | 'Standard'
    };

    // Initialize requiredMap from questions
    questions.forEach(q => {
        state.requiredMap[q.id] = !!q.required;
    });

    // Evaluate global rules first if any
    if (globalRules && globalRules.length > 0) {
        for (const rule of globalRules) {
            if (state.status === 'disqualified' || state.status === 'completed') {
                break;
            }

            let fromIndex = -1;
            let sourceQuestionId: string | undefined = undefined;
            if (rule.conditions && rule.conditions.length > 0) {
                sourceQuestionId = rule.conditions[0]?.questionId;
                const indices = rule.conditions
                    .map(c => questions.findIndex(q => q.id === c.questionId))
                    .filter(idx => idx !== -1);
                if (indices.length > 0) {
                    fromIndex = Math.max(...indices);
                }
            }

            const res = evaluateRule(rule, responses);
            if (res.matched && res.action) {
                // 1. Global Logic rules (THEN action)
                const shouldBreak = applyRuleAction(res, questions, fromIndex, state, sourceQuestionId, true);
                if (shouldBreak) {
                    break;
                }
            } else if (!res.matched && res.action) {
                // 2. Global Logic ELSE actions
                const shouldBreak = applyRuleAction(res, questions, fromIndex, state, sourceQuestionId, true);
                if (shouldBreak) {
                    break;
                }
            }
        }
    }

    // Traverse questions in sequence
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        if (state.status === 'disqualified' || state.status === 'completed') {
            break;
        }

        // Backward compatibility for showIf
        if ((q as any).showIf) {
            const cond = Array.isArray((q as any).showIf) ? (q as any).showIf[0] : (q as any).showIf;
            if (cond && cond.questionId) {
                const isVisible = evaluateCondition(cond, responses);
                if (!isVisible) {
                    state.hidden.add(q.id);
                } else {
                    state.explicitShown.add(q.id);
                }
            }
        }

        // Check if question is answered
        const ans = responses[q.id];
        const hasAnswer = ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);

        if (!hasAnswer) {
            continue;
        }

        // Check Attention Check
        if (q.isAttentionCheck && q.expectedAnswer) {
            const att = evaluateAttentionCheck(q, ans);
            if (!att.passed) {
                state.qualificationStatus = 'Disqualified';
                state.status = 'disqualified';
                state.disqualificationReason = att.message || 'Attention trap failed.';
                for (let j = i + 1; j < questions.length; j++) state.skipped.add(questions[j].id);
                break;
            }
        }

        // Check Question Verification
        if (q.isCheckQuestion && q.sourceQuestionId) {
            const sourceAns = responses[q.sourceQuestionId];
            if (sourceAns !== undefined && sourceAns !== null && sourceAns !== '') {
                const currentAttempts = (checkAttempts && checkAttempts[q.id] !== undefined)
                    ? checkAttempts[q.id]
                    : 1;
                const checkRes = evaluateCheckQuestion(q, sourceAns, ans, currentAttempts);
                if (!checkRes.passed) {
                    if (checkRes.action === 'disqualify' || checkRes.action === 'reject') {
                        state.qualificationStatus = 'Disqualified';
                        state.status = 'disqualified';
                        state.disqualificationReason = checkRes.message || 'Verification check failed.';
                        for (let j = i + 1; j < questions.length; j++) state.skipped.add(questions[j].id);
                        break;
                    } else if (checkRes.action === 'flag' || checkRes.action === 'review') {
                        state.messages.push({ type: 'warning', text: checkRes.message || 'Check flagged for review.', questionId: q.id });
                    }
                }
            }
        }

        // Evaluate question logic rules
        const rulesToEval = [...(q.logicRules || [])];
        for (const rule of rulesToEval) {
            const res = evaluateRule(rule, responses);
            if (res.matched && res.action) {
                // 3. Question-level logic rules (THEN action)
                const shouldBreak = applyRuleAction(res, questions, i, state, q.id, false);
                if (shouldBreak) {
                    break;
                }
            } else if (!res.matched && res.action) {
                // 4. Question-level ELSE actions
                const shouldBreak = applyRuleAction(res, questions, i, state, q.id, false);
                if (shouldBreak) {
                    break;
                }
            }
        }
    }

    const visibleQuestions = questions.filter(q => {
        if (state.skipped.has(q.id)) return false;
        if (state.hidden.has(q.id) && !state.explicitShown.has(q.id)) return false;
        return true;
    });

    return {
        visibleQuestions,
        hiddenQuestionIds: state.hidden,
        skippedQuestionIds: state.skipped,
        requiredMap: state.requiredMap,
        status: state.status,
        disqualificationReason: state.disqualificationReason,
        qualificationStatus: state.qualificationStatus,
        messages: state.messages
    };
}

/**
 * Pipes previously answered values into text tokens (e.g. {{q_1}} or {{Q1}} or {{Favorite City}})
 */
export function pipeAnswersIntoText(
    template: string = '',
    responses: Record<string, any> = {},
    questions: SurveyQuestion[] = []
): string {
    if (!template || !template.includes('{{')) return template;

    return template.replace(/\{\{([^}]+)\}\}/g, (match, token) => {
        const cleaned = token.trim();
        // 1. Match by exact question ID
        if (responses[cleaned] !== undefined) {
            const val = responses[cleaned];
            return Array.isArray(val) ? val.join(', ') : String(val);
        }

        // 2. Match by Q1, Q2, Q3 (1-indexed)
        const qIndexMatch = cleaned.match(/^[qQ](\d+)$/);
        if (qIndexMatch) {
            const idx = parseInt(qIndexMatch[1], 10) - 1;
            if (questions[idx]) {
                const val = responses[questions[idx].id];
                if (val !== undefined && val !== null) {
                    return Array.isArray(val) ? val.join(', ') : String(val);
                }
            }
        }

        // 3. Match by question title (case-insensitive substring)
        const foundQ = questions.find(q => q.title.toLowerCase().includes(cleaned.toLowerCase()));
        if (foundQ && responses[foundQ.id] !== undefined) {
            const val = responses[foundQ.id];
            return Array.isArray(val) ? val.join(', ') : String(val);
        }

        return match; // Keep token if no replacement found
    });
}

/**
 * Validates survey configuration:
 * Checks for circular loops (cycles), broken targets, unreachable questions, and invalid check questions.
 */
export function validateSurveyLogic(
    questions: SurveyQuestion[],
    sections: SurveySection[] = [],
    globalLogicRules: SurveyLogicRule[] = []
): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const questionIds = new Set(questions.map(q => q.id));
    const sectionIds = new Set(sections.map(s => s.id));

    // 1. Validate Check Questions
    questions.forEach((q, idx) => {
        if (q.isCheckQuestion) {
            if (!q.sourceQuestionId) {
                errors.push(`Question ${idx + 1} ("${q.title || 'Untitled'}") is marked as Check Question but has no Source Question selected.`);
            } else if (!questionIds.has(q.sourceQuestionId)) {
                errors.push(`Question ${idx + 1} references a source question that no longer exists.`);
            } else {
                const sourceIdx = questions.findIndex(sq => sq.id === q.sourceQuestionId);
                if (sourceIdx >= idx) {
                    errors.push(`Check Question ${idx + 1} must appear AFTER its source question (Question ${sourceIdx + 1}).`);
                }
            }
        }
    });

    // 2. Validate Branching Rules Targets and Broken References
    const adjacencyList = new Map<string, string[]>();
    questions.forEach(q => adjacencyList.set(q.id, []));

    questions.forEach((q, idx) => {
        const rules = q.logicRules || [];
        rules.forEach((rule, rIdx) => {
            // Check condition question existence & between operator
            rule.conditions.forEach(cond => {
                if (!questionIds.has(cond.questionId)) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: Refers to deleted question ID "${cond.questionId}".`);
                }
                if (cond.operator === 'between') {
                    const min = parseFloat(String(cond.value !== undefined ? cond.value : ''));
                    const max = parseFloat(String(cond.value2 !== undefined ? cond.value2 : ''));
                    if (!isNaN(min) && !isNaN(max) && min > max) {
                        errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: "Between" operator minimum (${cond.value}) cannot be greater than maximum (${cond.value2}).`);
                    }
                }
            });

            // Check target question existence
            if (rule.action === 'goto_question' || rule.action === 'skip_question') {
                if (!rule.targetQuestionId) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: Action is "${rule.action}" but no target question is selected.`);
                } else if (!questionIds.has(rule.targetQuestionId)) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: Target question no longer exists.`);
                } else {
                    adjacencyList.get(q.id)?.push(rule.targetQuestionId);
                }
            }

            // Check target section existence
            if (rule.action === 'goto_section' || rule.action === 'skip_section') {
                if (!rule.targetSectionId) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: Action is "${rule.action}" but no target section is selected.`);
                } else if (!sectionIds.has(rule.targetSectionId)) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: Target section no longer exists.`);
                }
            }

            // Check ELSE target questions
            if (rule.elseAction === 'goto_question' || rule.elseAction === 'skip_question') {
                if (!rule.elseTargetQuestionId) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: ELSE action is "${rule.elseAction}" but no target question is selected.`);
                } else if (!questionIds.has(rule.elseTargetQuestionId)) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: ELSE target question no longer exists.`);
                } else {
                    adjacencyList.get(q.id)?.push(rule.elseTargetQuestionId);
                }
            }

            // Check ELSE target sections
            if (rule.elseAction === 'goto_section' || rule.elseAction === 'skip_section') {
                if (!rule.elseTargetSectionId) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: ELSE action is "${rule.elseAction}" but no target section is selected.`);
                } else if (!sectionIds.has(rule.elseTargetSectionId)) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: ELSE target section no longer exists.`);
                }
            }
        });

        // Natural forward progression edge if not last question
        if (idx < questions.length - 1) {
            adjacencyList.get(q.id)?.push(questions[idx + 1].id);
        }
    });

    // 2.5. Validate Global Logic Rules
    if (globalLogicRules && globalLogicRules.length > 0) {
        globalLogicRules.forEach((rule, rIdx) => {
            const ruleLabel = rule.description ? `Global Rule ${rIdx + 1} ("${rule.description}")` : `Global Rule ${rIdx + 1}`;

            // Check condition question IDs and between operator
            if (!rule.conditions || rule.conditions.length === 0) {
                warnings.push(`${ruleLabel}: Has no conditions defined.`);
            } else {
                rule.conditions.forEach(cond => {
                    if (!cond.questionId) {
                        errors.push(`${ruleLabel}: Condition has no question selected.`);
                    } else if (!questionIds.has(cond.questionId)) {
                        errors.push(`${ruleLabel}: Refers to deleted question ID "${cond.questionId}".`);
                    }

                    if (cond.operator === 'between') {
                        const min = parseFloat(String(cond.value !== undefined ? cond.value : ''));
                        const max = parseFloat(String(cond.value2 !== undefined ? cond.value2 : ''));
                        if (!isNaN(min) && !isNaN(max) && min > max) {
                            errors.push(`${ruleLabel}: "Between" operator minimum (${cond.value}) cannot be greater than maximum (${cond.value2}).`);
                        }
                    }
                });
            }

            // Check target question existence
            if (rule.action === 'goto_question' || rule.action === 'skip_question' || rule.action === 'show_question' || rule.action === 'hide_question' || rule.action === 'require_answer' || rule.action === 'make_optional') {
                if (!rule.targetQuestionId) {
                    errors.push(`${ruleLabel}: Action is "${rule.action}" but no target question is selected.`);
                } else if (!questionIds.has(rule.targetQuestionId)) {
                    errors.push(`${ruleLabel}: Target question no longer exists.`);
                } else if (rule.action === 'goto_question' || rule.action === 'skip_question') {
                    // Add cycle edges from condition question IDs to target question ID
                    rule.conditions.forEach(cond => {
                        if (cond.questionId && questionIds.has(cond.questionId)) {
                            adjacencyList.get(cond.questionId)?.push(rule.targetQuestionId!);
                        }
                    });
                }
            }

            // Check target section existence
            if (rule.action === 'goto_section' || rule.action === 'skip_section') {
                if (!rule.targetSectionId) {
                    errors.push(`${ruleLabel}: Action is "${rule.action}" but no target section is selected.`);
                } else if (!sectionIds.has(rule.targetSectionId)) {
                    errors.push(`${ruleLabel}: Target section no longer exists.`);
                }
            }

            // Check ELSE target questions
            if (rule.elseAction && (rule.elseAction === 'goto_question' || rule.elseAction === 'skip_question' || rule.elseAction === 'show_question' || rule.elseAction === 'hide_question' || rule.elseAction === 'require_answer' || rule.elseAction === 'make_optional')) {
                if (!rule.elseTargetQuestionId) {
                    errors.push(`${ruleLabel}: ELSE action is "${rule.elseAction}" but no target question is selected.`);
                } else if (!questionIds.has(rule.elseTargetQuestionId)) {
                    errors.push(`${ruleLabel}: ELSE target question no longer exists.`);
                } else if (rule.elseAction === 'goto_question' || rule.elseAction === 'skip_question') {
                    rule.conditions.forEach(cond => {
                        if (cond.questionId && questionIds.has(cond.questionId)) {
                            adjacencyList.get(cond.questionId)?.push(rule.elseTargetQuestionId!);
                        }
                    });
                }
            }

            // Check ELSE target sections
            if (rule.elseAction && (rule.elseAction === 'goto_section' || rule.elseAction === 'skip_section')) {
                if (!rule.elseTargetSectionId) {
                    errors.push(`${ruleLabel}: ELSE action is "${rule.elseAction}" but no target section is selected.`);
                } else if (!sectionIds.has(rule.elseTargetSectionId)) {
                    errors.push(`${ruleLabel}: ELSE target section no longer exists.`);
                }
            }
        });
    }

    // 3. Circular Loop Detection (Cycle Detection using DFS)
    const visited = new Map<string, 'WHITE' | 'GRAY' | 'BLACK'>();
    questions.forEach(q => visited.set(q.id, 'WHITE'));

    let hasCycle = false;
    function dfs(nodeId: string, path: string[]) {
        visited.set(nodeId, 'GRAY');
        const neighbors = adjacencyList.get(nodeId) || [];

        for (const next of neighbors) {
            if (visited.get(next) === 'GRAY') {
                hasCycle = true;
                const cycleNodes = [...path, nodeId, next]
                    .map(id => {
                        const qIndex = questions.findIndex(q => q.id === id);
                        return qIndex >= 0 ? `Q${qIndex + 1}` : id;
                    })
                    .join(' ➔ ');
                errors.push(`Circular jump loop detected in branching logic: ${cycleNodes}. A survey cannot loop backwards infinitely.`);
                return;
            }
            if (visited.get(next) === 'WHITE') {
                dfs(next, [...path, nodeId]);
            }
        }
        visited.set(nodeId, 'BLACK');
    }

    for (const q of questions) {
        if (visited.get(q.id) === 'WHITE') {
            dfs(q.id, []);
        }
    }

    // 4. Check Question Recommendation Check
    if (questions.length >= 10) {
        const checkCount = questions.filter(q => q.isCheckQuestion).length;
        if (checkCount === 0) {
            warnings.push('Your survey has reached 10+ questions. Adding at least one Check Question is recommended to detect bot scripts and inattentive responses.');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
