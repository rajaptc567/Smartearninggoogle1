import { evaluateSurveyFlow, evaluateCheckQuestion } from './lib/surveyLogicEngine.ts';

console.log('Running comprehensive survey flow security tests...');

// Test 1: Normal survey without branching
const questions1 = [
    { id: 'q1', title: 'Q1', type: 'text', required: true },
    { id: 'q2', title: 'Q2', type: 'yes_no', required: true }
];
const result1 = evaluateSurveyFlow(questions1, [], { q1: 'hello', q2: 'yes' }, []);
console.assert(result1.visibleQuestions.length === 2, 'Test 1 failed: Should show 2 questions');
console.assert(result1.status === 'in_progress', 'Test 1 status failed');
console.log('Test 1 passed.');

// Test 2: Branching survey with skipped question and fabricated client answer
const questions2 = [
    {
        id: 'q1',
        title: 'Q1',
        type: 'yes_no',
        logicRules: [{
            id: 'r1',
            matchType: 'ALL',
            conditions: [{ questionId: 'q1', operator: 'equals', value: 'no' }],
            action: 'goto_question',
            targetQuestionId: 'q3'
        }]
    },
    { id: 'q2', title: 'Q2', type: 'text' },
    { id: 'q3', title: 'Q3', type: 'text' }
];
// Client submits answer for q2 even though q1='no' skipped q2 via goto_question q3
const responses2 = { q1: 'no', q2: 'fabricated answer', q3: 'end' };
const result2 = evaluateSurveyFlow(questions2, [], responses2, []);
if (result2.skippedQuestionIds.has('q2') && result2.effectiveResponses['q2'] === undefined) {
    console.log('Test 2 passed.');
} else {
    console.error('Test 2 failed:', result2);
    process.exit(1);
}

// Test 3: Check-question validation with source question skipped / hidden
const checkQ = {
    id: 'q_check',
    title: 'Confirm',
    type: 'text',
    isCheckQuestion: true,
    sourceQuestionId: 'q1'
};
const checkRes = evaluateCheckQuestion(checkQ, undefined, 'some val', 1);
if (checkRes.passed === false) {
    console.log('Test 3 passed.');
} else {
    console.error('Test 3 failed:', checkRes);
    process.exit(1);
}

// Test 4: Global rules with operators and unreached questions (not triggering prematurely)
const questions4 = [
    { id: 'q1', title: 'Q1', type: 'yes_no' },
    { id: 'q2', title: 'Q2', type: 'yes_no' },
    { id: 'q3', title: 'Q3', type: 'yes_no' }
];
const globalRules4 = [
    {
        id: 'rule1',
        matchType: 'ALL',
        conditions: [{ questionId: 'q3', operator: 'not_equals', value: 'yes' }],
        action: 'disqualify'
    }
];
const result4 = evaluateSurveyFlow(questions4, [], { q1: 'yes' }, globalRules4);
if (result4.status === 'in_progress') {
    console.log('Test 4 passed.');
} else {
    console.error('Test 4 failed:', result4);
    process.exit(1);
}

console.log('All survey flow security tests passed successfully!');
