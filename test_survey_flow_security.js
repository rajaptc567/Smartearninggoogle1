import assert from 'node:assert/strict';
import { evaluateSurveyFlow, evaluateCheckQuestion, evaluateCondition, evaluateRule } from './lib/surveyLogicEngine.ts';

console.log('Running comprehensive survey flow security regression suite...');

// 1. Normal survey without branching
{
    const questions = [
        { id: 'q1', title: 'Q1', type: 'text', required: true },
        { id: 'q2', title: 'Q2', type: 'yes_no', required: true }
    ];
    const result = evaluateSurveyFlow(questions, [], { q1: 'hello', q2: 'yes' }, []);
    assert.strictEqual(result.visibleQuestions.length, 2);
    assert.strictEqual(result.status, 'in_progress');
    assert.strictEqual(result.qualificationStatus, 'Standard');
    console.log('Test 1 (Normal survey) passed.');
}

// 2. Branching survey with skipped question and fabricated client answer
{
    const questions = [
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
    const responses = { q1: 'no', q2: 'fabricated answer', q3: 'end' };
    const result = evaluateSurveyFlow(questions, [], responses, []);
    assert.ok(result.skippedQuestionIds.has('q2'), 'q2 should be skipped');
    assert.strictEqual(result.effectiveResponses['q2'], undefined, 'q2 answer should not be in effectiveResponses');
    console.log('Test 2 (Branching & fabricated answer isolation) passed.');
}

// 3. Hidden question answers cannot influence showIf or qualification
{
    const questions = [
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
        {
            id: 'q2',
            title: 'Q2',
            type: 'text',
            showIf: { questionId: 'q1', operator: 'equals', value: 'yes' }
        },
        { id: 'q3', title: 'Q3', type: 'text' }
    ];
    const responses = { q1: 'no', q2: 'should not influence', q3: 'ok' };
    const result = evaluateSurveyFlow(questions, [], responses, []);
    assert.ok(result.hiddenQuestionIds.has('q2') || !result.visibleQuestions.some(q => q.id === 'q2'));
    assert.strictEqual(result.effectiveResponses['q2'], undefined);
    console.log('Test 3 (Hidden question isolation) passed.');
}

// 4. Check-question validation with skipped/hidden source question
{
    const checkQ = {
        id: 'q_check',
        title: 'Confirm',
        type: 'text',
        isCheckQuestion: true,
        sourceQuestionId: 'q1'
    };
    const checkRes = evaluateCheckQuestion(checkQ, undefined, 'some val', 1);
    assert.strictEqual(checkRes.passed, false);
    console.log('Test 4 (Check-question unreachable source validation) passed.');
}

// 5. Missing/unanswered values do not accidentally trigger value-comparison rules
{
    const condition = { questionId: 'q1', operator: 'equals', value: 'yes' };
    const resTrue = evaluateCondition(condition, { q1: undefined });
    assert.strictEqual(resTrue, false, 'Undefined answer must not match equals');

    const resEmpty = evaluateCondition(condition, { q1: '' });
    assert.strictEqual(resEmpty, false, 'Empty answer must not match equals');
    console.log('Test 5 (Missing value safeguard) passed.');
}

// 6. Supported operators (not_equals, not_answered) behavior
{
    const condNotEq = { questionId: 'q1', operator: 'not_equals', value: 'yes' };
    assert.strictEqual(evaluateCondition(condNotEq, { q1: 'no' }), true);
    assert.strictEqual(evaluateCondition(condNotEq, { q1: 'yes' }), false);

    const condNotAns = { questionId: 'q1', operator: 'not_answered' };
    assert.strictEqual(evaluateCondition(condNotAns, { q1: undefined }), true);
    assert.strictEqual(evaluateCondition(condNotAns, { q1: 'answered' }), false);
    console.log('Test 6 (Supported operators verification) passed.');
}

// 7. Multi-condition global rules with unreached / skipped questions (no premature trigger)
{
    const questions = [
        { id: 'q1', title: 'Q1', type: 'yes_no' },
        { id: 'q2', title: 'Q2', type: 'yes_no' },
        { id: 'q3', title: 'Q3', type: 'yes_no' }
    ];
    const globalRules = [
        {
            id: 'rule1',
            matchType: 'ALL',
            conditions: [
                { questionId: 'q1', operator: 'equals', value: 'yes' },
                { questionId: 'q3', operator: 'equals', value: 'yes' }
            ],
            action: 'disqualify'
        }
    ];
    // At q1, q3 is not yet reached (i = 0 < fromIndex = 2)
    const result = evaluateSurveyFlow(questions, [], { q1: 'yes', q2: 'no' }, globalRules);
    assert.strictEqual(result.status, 'in_progress', 'Global rule must not trigger before q3 is reached');
    console.log('Test 7 (Multi-condition global rule timing) passed.');
}

// 8. Attention check failure action
{
    const attentionQ = {
        id: 'q_att',
        title: 'Trap',
        type: 'text',
        isAttentionCheck: true,
        expectedAnswer: 'blue'
    };
    const questions = [
        attentionQ,
        { id: 'q2', title: 'Q2', type: 'text' }
    ];
    const result = evaluateSurveyFlow(questions, [], { q_att: 'red', q2: 'test' }, []);
    assert.strictEqual(result.status, 'disqualified');
    assert.strictEqual(result.qualificationStatus, 'Disqualified');
    console.log('Test 8 (Attention check disqualification) passed.');
}

// 9. ANY global rule matches early without waiting for later unreached condition
{
    const questions = [
        { id: 'q1', title: 'Q1', type: 'yes_no' },
        { id: 'q2', title: 'Q2', type: 'yes_no' },
        { id: 'q3', title: 'Q3', type: 'yes_no' }
    ];
    const globalRules = [
        {
            id: 'ruleAny',
            matchType: 'ANY',
            conditions: [
                { questionId: 'q1', operator: 'equals', value: 'yes' },
                { questionId: 'q3', operator: 'equals', value: 'yes' }
            ],
            action: 'disqualify'
        }
    ];
    // At q1, q1 matches 'yes', q3 is at index 2 (unreached). ANY should trigger immediately at q1 (i=0).
    const result = evaluateSurveyFlow(questions, [], { q1: 'yes' }, globalRules);
    assert.strictEqual(result.status, 'disqualified', 'ANY global rule must trigger immediately when q1 matches without waiting for q3');
    console.log('Test 9 (ANY global rule early match) passed.');
}

// 10. ALL rule triggers when all conditions match at or after fromIndex
{
    const questions = [
        { id: 'q1', title: 'Q1', type: 'yes_no' },
        { id: 'q2', title: 'Q2', type: 'yes_no' },
        { id: 'q3', title: 'Q3', type: 'yes_no' }
    ];
    const globalRules = [
        {
            id: 'ruleAll',
            matchType: 'ALL',
            conditions: [
                { questionId: 'q1', operator: 'equals', value: 'yes' },
                { questionId: 'q3', operator: 'equals', value: 'yes' }
            ],
            action: 'disqualify'
        }
    ];
    const result = evaluateSurveyFlow(questions, [], { q1: 'yes', q2: 'no', q3: 'yes' }, globalRules);
    assert.strictEqual(result.status, 'disqualified', 'ALL rule must trigger when all conditions match');
    console.log('Test 10 (ALL rule matching) passed.');
}

// 11. ELSE action does not execute prematurely and triggers at the correct evaluation point when conditions do not match
{
    const questions = [
        { id: 'q1', title: 'Q1', type: 'yes_no' },
        { id: 'q2', title: 'Q2', type: 'yes_no' },
        { id: 'q3', title: 'Q3', type: 'yes_no' }
    ];
    const globalRules = [
        {
            id: 'ruleElse',
            matchType: 'ALL',
            conditions: [
                { questionId: 'q1', operator: 'equals', value: 'yes' },
                { questionId: 'q3', operator: 'equals', value: 'yes' }
            ],
            action: 'disqualify',
            elseAction: 'qualify'
        }
    ];
    // At q1, else must not trigger prematurely before q3 is reached. At q3, conditions do not match (q3 is 'no'), so elseAction ('qualify') triggers.
    const result = evaluateSurveyFlow(questions, [], { q1: 'yes', q2: 'no', q3: 'no' }, globalRules);
    assert.strictEqual(result.qualificationStatus, 'Qualified', 'ELSE action must trigger once evaluation completes and conditions do not match');
    console.log('Test 11 (ELSE action timing and execution) passed.');
}

// 12. Hidden or skipped fabricated answers cannot incorrectly trigger a global rule
{
    const questions = [
        {
            id: 'q1',
            title: 'Q1',
            type: 'yes_no',
            logicRules: [{
                id: 'rJump',
                matchType: 'ALL',
                conditions: [{ questionId: 'q1', operator: 'equals', value: 'no' }],
                action: 'goto_question',
                targetQuestionId: 'q3'
            }]
        },
        { id: 'q2', title: 'Q2', type: 'yes_no' },
        { id: 'q3', title: 'Q3', type: 'text' }
    ];
    const globalRules = [
        {
            id: 'ruleQ2',
            matchType: 'ALL',
            conditions: [{ questionId: 'q2', operator: 'equals', value: 'yes' }],
            action: 'disqualify'
        }
    ];
    // q1 is 'no', jumping to q3, skipping q2. Client submits fabricated q2 answer.
    const result = evaluateSurveyFlow(questions, [], { q1: 'no', q2: 'yes', q3: 'ok' }, globalRules);
    assert.ok(result.skippedQuestionIds.has('q2'), 'q2 should be skipped');
    assert.strictEqual(result.status, 'in_progress', 'Fabricated answer on skipped q2 must not trigger global rule');
    console.log('Test 12 (Skipped fabricated answer isolation from global rules) passed.');
}

console.log('All comprehensive survey flow security regression tests passed successfully!');
