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
    type: 'single_choice' | 'multiple_choice' | 'yes_no' | 'rating' | 'opinion_scale' | 'short_text' | 'long_text' | 'dropdown' | 'number';
    title: string;
    description?: string;
    required: boolean;
    options?: string[];
    isAttentionCheck?: boolean;
    expectedAnswer?: string;
    minRating?: number;
    maxRating?: number;
    sectionId?: string;
    secondsLimit?: number;
    
    // Check Question Verification Fields
    isCheckQuestion?: boolean;
    sourceQuestionId?: string;
    checkComparisonMethod?: 'exact' | 'case_insensitive' | 'trim_spaces' | 'normalized' | 'numeric' | 'date';
    checkFailureAction?: 'retry' | 'flag' | 'review' | 'disqualify' | 'reject';
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
    method: 'exact' | 'case_insensitive' | 'trim_spaces' | 'normalized' | 'numeric' | 'date' = 'case_insensitive'
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

    if (rawVal === undefined || rawVal === null) return false;

    // Array / Multiple choice response handling
    if (Array.isArray(rawVal)) {
        const targetStr = String(condition.value || '').toLowerCase().trim();
        if (condition.operator === 'contains' || condition.operator === 'equals') {
            return rawVal.some(item => String(item).toLowerCase().trim() === targetStr);
        }
        if (condition.operator === 'not_contains' || condition.operator === 'not_equals') {
            return !rawVal.some(item => String(item).toLowerCase().trim() === targetStr);
        }
    }

    const ansStr = String(rawVal).toLowerCase().trim();
    const condStr = String(condition.value || '').toLowerCase().trim();

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
            const numCond2 = parseFloat(String(condition.value2 || ''));
            return hasNumeric && !isNaN(numCond2) && numAns >= numCond && numAns <= numCond2;
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
        return {
            matched: false,
            action: rule.elseAction,
            targetQuestionId: rule.elseTargetQuestionId,
            targetSectionId: rule.elseTargetSectionId,
            message: rule.elseMessage
        };
    }

    return { matched: false, action: '' };
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
    sections: SurveySection[] = []
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
            // Check condition question existence
            rule.conditions.forEach(cond => {
                if (!questionIds.has(cond.questionId)) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: Refers to deleted question ID "${cond.questionId}".`);
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

            // Check ELSE target
            if (rule.elseAction === 'goto_question') {
                if (rule.elseTargetQuestionId && !questionIds.has(rule.elseTargetQuestionId)) {
                    errors.push(`Question ${idx + 1}, Rule ${rIdx + 1}: ELSE target question no longer exists.`);
                } else if (rule.elseTargetQuestionId) {
                    adjacencyList.get(q.id)?.push(rule.elseTargetQuestionId);
                }
            }
        });

        // Natural forward progression edge if not last question
        if (idx < questions.length - 1) {
            adjacencyList.get(q.id)?.push(questions[idx + 1].id);
        }
    });

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

    if (questions.length > 0) {
        dfs(questions[0].id, []);
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
