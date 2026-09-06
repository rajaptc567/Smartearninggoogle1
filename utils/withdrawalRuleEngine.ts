import { User, Withdrawal, UserTask, UserTaskSubmission, InvestmentPlan, WorkAndEarnWithdrawalRule, RuleEvaluationLog, WorkAndEarnPayoutTierConfig } from '../types';

export const DEFAULT_WITHDRAWAL_RULES: WorkAndEarnWithdrawalRule[] = [
    {
        id: 'rule_second_withdrawal_plan',
        name: 'Second Withdrawal Requires Investment',
        description: 'Blocks the 2nd withdrawal attempt unless the user has at least one active Investment Plan.',
        ruleType: 'investment_plan_requirement',
        enabled: true,
        priority: 1,
        isMandatory: true,
        targetUserGroup: 'all',
        triggerConfig: {
            withdrawalNumber: 2,
        },
        requirementConfig: {
            requireActiveInvestmentPlan: true,
            planSelectionType: 'any',
            minPlanAmountUSD: 0
        },
        notificationConfig: {
            title: 'Investment Plan Required',
            message: 'To continue with your next withdrawal, you must first activate an eligible Investment Plan in the Investment Module.',
            primaryActionButtonText: 'View Investment Plans',
            primaryActionUrl: '/member/plans',
            secondaryActionButtonText: 'Transfer Balance',
            secondaryActionUrl: '/member/transfer'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

export interface RuleEvaluationResult {
    passed: boolean;
    blockedByRule: WorkAndEarnWithdrawalRule | null;
    logs: RuleEvaluationLog[];
    summaryMessage?: string;
    currentAttemptNumber: number;
}

export const evaluateWithdrawalRules = (
    user: User,
    rules: WorkAndEarnWithdrawalRule[] = [],
    withdrawals: Withdrawal[] = [],
    userTasks: UserTask[] = [],
    userTaskSubmissions: UserTaskSubmission[] = [],
    allUsers: User[] = [],
    investmentPlans: InvestmentPlan[] = [],
    payoutConfig?: WorkAndEarnPayoutTierConfig
): RuleEvaluationResult => {
    const logs: RuleEvaluationLog[] = [];
    const activeRules = (rules && rules.length > 0 ? rules : DEFAULT_WITHDRAWAL_RULES)
        .filter(r => r.enabled)
        .sort((a, b) => a.priority - b.priority);

    // 1. Calculate user statistics
    const userWithdrawals = withdrawals.filter(w => w.userId?.toString() === user._id?.toString());
    const nonRejectedWithdrawals = userWithdrawals.filter(w => w.status !== 'Rejected');
    const currentAttemptNumber = nonRejectedWithdrawals.length + 1;
    const successfulWithdrawalsCount = userWithdrawals.filter(w => w.status === 'Approved').length;

    // Check 1.1: Withdrawal Request Frequency Limit
    if (payoutConfig && payoutConfig.enabled && (payoutConfig.withdrawalFrequencyLimitHours ?? 0) > 0) {
        if (nonRejectedWithdrawals.length > 0) {
            const sortedWithdrawals = [...nonRejectedWithdrawals].sort((a, b) => {
                const bTime = new Date((b as any).createdAt || b.date || Date.now()).getTime();
                const aTime = new Date((a as any).createdAt || a.date || Date.now()).getTime();
                return bTime - aTime;
            });
            const lastW = sortedWithdrawals[0];
            const lastTime = new Date((lastW as any).createdAt || lastW.date || Date.now()).getTime();
            const elapsedMs = Date.now() - lastTime;
            const requiredMs = (payoutConfig.withdrawalFrequencyLimitHours || 24) * 3600 * 1000;

            if (elapsedMs < requiredMs) {
                const remainingMs = requiredMs - elapsedMs;
                const remHours = Math.floor(remainingMs / (3600 * 1000));
                const remMins = Math.ceil((remainingMs % (3600 * 1000)) / (60 * 1000));
                
                return {
                    passed: false,
                    blockedByRule: null,
                    logs,
                    summaryMessage: `⏱️ Withdrawal Frequency Limit: You can submit a withdrawal request once every ${payoutConfig.withdrawalFrequencyLimitHours} hours. Next available request in ${remHours}h ${remMins}m.`,
                    currentAttemptNumber
                };
            }
        }
    }

    // Check 1.2: Plan-Based Amount Limits (Require Active Plan Check)
    const userActivePlans = (user.activePlans || []).filter(ap => {
        const apStatus = (ap as any).status;
        const apExpiry = (ap as any).expiryDate;
        if (apStatus && apStatus !== 'Active') return false;
        if (apExpiry && new Date(apExpiry).getTime() < Date.now()) return false;
        return true;
    });

    if (payoutConfig && payoutConfig.enabled && payoutConfig.planBasedAmountLimitsEnabled && payoutConfig.requireActivePlanToWithdraw) {
        const userHasAnyActivePlan = userActivePlans.length > 0 || ((user as any).activeInvestmentPlans && (user as any).activeInvestmentPlans.length > 0) || Boolean(user.activePlan);
        if (!userHasAnyActivePlan) {
            return {
                passed: false,
                blockedByRule: null,
                logs,
                summaryMessage: `💎 Plan-Based Withdrawal Limit: An active Investment Plan is required to submit a withdrawal request under the active policy. Please activate a plan in the Investment Module.`,
                currentAttemptNumber
            };
        }
    }

    const taskSubmissions = userTaskSubmissions.filter(s => 
        (s.workerId?.toString() === user._id?.toString() || s.workerName === user.username) &&
        (s.status === 'Approved' || s.status === 'Paid')
    );
    const completedTasksCount = taskSubmissions.length;
    
    let taskEarningsUSD = (user.taskWalletBalance || 0);
    taskSubmissions.forEach(s => {
        taskEarningsUSD += (s.rewardAmount || 0);
    });

    const createdCampaignsCount = userTasks.filter(t => 
        (t as any).creatorId?.toString() === user._id?.toString() || (t as any).creatorName === user.username || t.userId?.toString() === user._id?.toString() || t.userName === user.username
    ).length;

    const userRegistrationDate = (user as any).createdAt || user.registrationDate || new Date().toISOString();
    const accountAgeDays = Math.floor(
        (Date.now() - new Date(userRegistrationDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const activeReferralsCount = allUsers.filter(u => 
        (u as any).referredBy?.toString() === user._id?.toString() || (u as any).sponsorUsername === user.username || u.sponsor === user.username
    ).length;

    const nowIso = new Date().toISOString();

    for (const rule of activeRules) {
        // Date Window Check
        if (rule.effectiveDate && new Date(rule.effectiveDate).getTime() > Date.now()) {
            continue;
        }
        if (rule.expiryDate && new Date(rule.expiryDate).getTime() < Date.now()) {
            continue;
        }

        // Target User Group Check
        if (rule.targetUserGroup === 'specific_users') {
            const allowedUsers = rule.targetUserIds || [];
            if (!allowedUsers.includes(user._id) && !allowedUsers.includes(user.username)) {
                continue;
            }
        } else if (rule.targetUserGroup === 'no_active_plan') {
            if (userActivePlans.length > 0) {
                continue;
            }
        }

        // Trigger Evaluation Check
        const tc = rule.triggerConfig || {};
        let triggerApplies = false;

        // Trigger: Specific withdrawal ordinal number (e.g. 2nd withdrawal)
        if (tc.withdrawalNumber !== undefined && tc.withdrawalNumber > 0) {
            if (currentAttemptNumber === tc.withdrawalNumber) {
                triggerApplies = true;
            }
        }
        // Trigger: Nth frequency (e.g. every 2nd withdrawal)
        else if (tc.nthFrequency !== undefined && tc.nthFrequency > 0) {
            if (currentAttemptNumber % tc.nthFrequency === 0) {
                triggerApplies = true;
            }
        }
        // Trigger: Cumulative successful withdrawals threshold
        else if (tc.minSuccessfulWithdrawals !== undefined) {
            if (successfulWithdrawalsCount >= tc.minSuccessfulWithdrawals) {
                triggerApplies = true;
            }
        }
        // Default trigger: Always applies
        else {
            triggerApplies = true;
        }

        if (!triggerApplies) {
            continue;
        }

        // Condition Check (Must meet all specified requirements)
        let requirementMet = true;
        let failReason = '';
        const rc = rule.requirementConfig || {};

        if (rule.ruleType === 'investment_plan_requirement' || rc.requireActiveInvestmentPlan) {
            if (userActivePlans.length === 0) {
                requirementMet = false;
                failReason = 'No active Investment Plan found on account.';
            } else {
                // Check selection type requirements
                if (rc.planSelectionType === 'min_amount' && rc.minPlanAmountUSD && rc.minPlanAmountUSD > 0) {
                    const hasQualifyingAmount = userActivePlans.some(ap => (ap.price || 0) >= (rc.minPlanAmountUSD || 0));
                    if (!hasQualifyingAmount) {
                        requirementMet = false;
                        failReason = `Requires active plan with minimum amount of $${rc.minPlanAmountUSD}.`;
                    }
                } else if (rc.planSelectionType === 'selected' && rc.requiredPlanIds && rc.requiredPlanIds.length > 0) {
                    const hasSelectedPlan = userActivePlans.some(ap => rc.requiredPlanIds?.includes(ap.planId || (ap as any)._id));
                    if (!hasSelectedPlan) {
                        requirementMet = false;
                        failReason = 'Does not have any of the required specific Investment Plans.';
                    }
                } else if (rc.planSelectionType === 'category' && rc.requiredPlanCategory) {
                    const hasCategoryPlan = userActivePlans.some(ap => {
                        const matchingPlanDef = investmentPlans.find(ip => ip._id === ap.planId);
                        const planCategory = (matchingPlanDef as any)?.category || (matchingPlanDef as any)?.planCategory;
                        return planCategory?.toLowerCase() === rc.requiredPlanCategory?.toLowerCase();
                    });
                    if (!hasCategoryPlan) {
                        requirementMet = false;
                        failReason = `Requires active plan in category "${rc.requiredPlanCategory}".`;
                    }
                }
            }
        }

        if (rule.ruleType === 'kyc_requirement' || rc.requireKycVerification) {
            const isKycOk = user.isVerified || (user as any).isKycVerified || (user as any).kycStatus === 'Approved';
            if (!isKycOk) {
                requirementMet = false;
                failReason = 'KYC verification required before proceeding with withdrawal.';
            }
        }

        if (rule.ruleType === 'minimum_referral_requirement') {
            const minRefs = tc.minReferrals || 1;
            if (activeReferralsCount < minRefs) {
                requirementMet = false;
                failReason = `Requires at least ${minRefs} direct referrals. Current: ${activeReferralsCount}.`;
            }
        }

        if (rule.ruleType === 'account_age_requirement') {
            const minDays = tc.minAccountAgeDays || 1;
            if (accountAgeDays < minDays) {
                requirementMet = false;
                failReason = `Requires account age of at least ${minDays} days. Current: ${accountAgeDays} days.`;
            }
        }

        if (rule.ruleType === 'manual_admin_approval_requirement' || rc.requireManualAdminApproval) {
            requirementMet = false;
            failReason = 'This withdrawal tier requires manual admin review and pre-approval.';
        }

        // Record log
        logs.push({
            id: `log_${rule.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId: user._id,
            username: user.username,
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            status: requirementMet ? 'PASSED' : 'BLOCKED',
            details: requirementMet ? `Attempt #${currentAttemptNumber}: All requirements satisfied.` : `Attempt #${currentAttemptNumber}: ${failReason}`,
            timestamp: nowIso
        });

        // If a mandatory rule is violated, block immediately
        if (!requirementMet && rule.isMandatory) {
            return {
                passed: false,
                blockedByRule: rule,
                logs,
                summaryMessage: rule.notificationConfig?.message || failReason || 'Withdrawal requirement not met.',
                currentAttemptNumber
            };
        }
    }

    return {
        passed: true,
        blockedByRule: null,
        logs,
        currentAttemptNumber
    };
};

export const DEFAULT_PAYOUT_TIER_CONFIG: WorkAndEarnPayoutTierConfig = {
    enabled: true,
    mode: 'sequence',
    minWithdrawalLimitUSD: 1,
    maxWithdrawalLimitUSD: 1000,
    dailyWithdrawalLimitUSD: 500,
    withdrawalFrequencyLimitHours: 24,
    planBasedAmountLimitsEnabled: false,
    requireActivePlanToWithdraw: false,
    useBaseCurrencyPayouts: true,
    hideUSDInUserCurrencyDisplay: true,
    payoutLayoutColumns: 3,
    payoutLayoutColumnsMobile: 2,
    mountInvestmentPlans: true,
    linkedPlanIds: [],
    onlyShowRunningPlanAmount: false,
    sequenceSteps: [
        { stepNumber: 1, amountUSD: 5, label: "1st Withdrawal ($5)", requiredMilestoneUSD: 5 },
        { stepNumber: 2, amountUSD: 10, label: "2nd Withdrawal ($10)", requiredMilestoneUSD: 10 },
        { stepNumber: 3, amountUSD: 15, label: "3rd Withdrawal ($15)", requiredMilestoneUSD: 15 }
    ],
    manualPayoutAmountsUSD: [2.5, 5, 10, 15, 25, 50],
    allowMilestoneWithdrawalWithoutSequence: true
};

export interface PayoutOptionItem {
    amount: number;         // Amount in user's currency
    amountUSD: number;      // Amount in USD
    label: string;          // Formatted label
    source: 'plan' | 'sequence' | 'milestone' | 'manual';
    planName?: string;
    stepNumber?: number;
    isCurrentRunningPlan?: boolean;
    requiresActivePlan?: boolean;
}

export const getPayoutOptionsForUser = (
    user: User,
    payoutConfig?: WorkAndEarnPayoutTierConfig,
    rules: WorkAndEarnWithdrawalRule[] = [],
    investmentPlans: InvestmentPlan[] = [],
    userWithdrawalCount: number = 0,
    exchangeRate: number = 1
): PayoutOptionItem[] => {
    const config = payoutConfig && payoutConfig.enabled ? payoutConfig : DEFAULT_PAYOUT_TIER_CONFIG;
    if (!config.enabled) return [];

    const options: PayoutOptionItem[] = [];
    const userCurr = (user.currency || 'USD').toUpperCase();
    const rate = (exchangeRate && exchangeRate > 0) ? exchangeRate : 1;

    // Helper to format/create plan option without cross-currency conversion
    const buildPlanOption = (
        plan: InvestmentPlan,
        isRunning: boolean,
        requiresActivePlan: boolean
    ): PayoutOptionItem => {
        const planCurr = (plan.currency || 'USD').toUpperCase();
        const isSameCurrency = planCurr === userCurr;
        
        let localAmt: number;
        let usdAmt: number;

        if (isSameCurrency) {
            // Plan is created directly in user's base currency (e.g., PKR plan price is 5,000 PKR)
            localAmt = plan.price;
            usdAmt = userCurr !== 'USD' ? (rate > 0 ? plan.price / rate : plan.price) : plan.price;
        } else {
            // Cross-currency fallback if needed
            localAmt = userCurr !== 'USD' ? Math.round(plan.price * rate) : plan.price;
            usdAmt = plan.price;
        }

        const displayLabel = `${localAmt.toLocaleString()} ${userCurr} (${plan.name})`;

        return {
            amount: localAmt,
            amountUSD: Number(usdAmt.toFixed(2)),
            label: displayLabel,
            source: 'plan',
            planName: plan.name,
            isCurrentRunningPlan: isRunning,
            requiresActivePlan
        };
    };

    // Filter investment plans to ONLY active plans that match user's base currency
    const activePlansInUserCurrency = investmentPlans.filter(p => {
        const isStatusActive = p.status === 'Active' || (p.status as any) === 'Active' || (p as any).enabled !== false;
        const planCurr = (p.currency || 'USD').toUpperCase();
        return isStatusActive && planCurr === userCurr;
    });

    // Identify user's active running plans
    const userActivePlanEntries = (user.activePlans || [])
        .concat((user as any).activeInvestmentPlans || [])
        .concat(user.activePlan ? [{ planId: user.activePlan, planName: user.activePlan, price: 0, purchaseDate: new Date().toISOString() }] : []);

    const userRunningPlanIds = new Set(userActivePlanEntries.map((ap: any) => ap.planId?.toString()).filter(Boolean));
    const userRunningPlanNames = new Set(userActivePlanEntries.map((ap: any) => (ap.planName || ap.name)?.toString()).filter(Boolean));

    // Running plans matching user's base currency
    const runningActivePlansInUserCurrency = activePlansInUserCurrency.filter(p => 
        userRunningPlanIds.has(p._id?.toString()) || userRunningPlanNames.has(p.name)
    );

    const userHasActivePlan = runningActivePlansInUserCurrency.length > 0 || userRunningPlanIds.size > 0 || userRunningPlanNames.size > 0;
    const requiresActivePlan = config.requireActivePlanToWithdraw === true && !userHasActivePlan;

    const isRunningPlanOnlyMode = config.mode === 'running_plan_only' || config.onlyShowRunningPlanAmount === true;

    // 1. MODE: Running Investment Plan Amount Only OR Plan-Based Amount Limits
    if (isRunningPlanOnlyMode || config.planBasedAmountLimitsEnabled) {
        const targetPlans = activePlansInUserCurrency.length > 0 
            ? activePlansInUserCurrency 
            : investmentPlans.filter(p => p.status === 'Active' || (p.status as any) === 'Active' || (p as any).enabled !== false);

        targetPlans.forEach(plan => {
            const isRunning = userRunningPlanIds.has(plan._id?.toString()) || userRunningPlanNames.has(plan.name);
            options.push(buildPlanOption(plan, isRunning, requiresActivePlan));
        });
    } 
    // 2. MODE: Sequential Payout Progression
    else if (config.mode === 'sequence') {
        const steps = config.sequenceSteps && config.sequenceSteps.length > 0 
            ? config.sequenceSteps 
            : DEFAULT_PAYOUT_TIER_CONFIG.sequenceSteps;
        
        const stepIdx = Math.min(userWithdrawalCount, (steps?.length || 1) - 1);
        const currentStep = steps?.[stepIdx];
        if (currentStep) {
            const amtUSD = currentStep.amountUSD;
            const amtLocal = userCurr !== 'USD' ? Math.round(amtUSD * rate) : amtUSD;
            const label = currentStep.label || (userCurr !== 'USD' ? `${amtLocal.toLocaleString()} ${userCurr}` : `$${amtUSD} USD`);
            options.push({
                amount: amtLocal,
                amountUSD: amtUSD,
                label,
                source: 'sequence',
                stepNumber: currentStep.stepNumber
            });
        }
    } 
    // 4. MODE: Milestones Choice / Hybrid
    else {
        if (config.mountInvestmentPlans) {
            activePlansInUserCurrency.forEach(plan => {
                const isRunning = runningActivePlansInUserCurrency.some(rp => rp._id === plan._id);
                options.push(buildPlanOption(plan, isRunning, false));
            });
        }

        const manualAmts = config.manualPayoutAmountsUSD || DEFAULT_PAYOUT_TIER_CONFIG.manualPayoutAmountsUSD || [];
        manualAmts.forEach(amtUSD => {
            const localAmt = userCurr !== 'USD' ? Math.round(amtUSD * rate) : amtUSD;
            options.push({
                amount: localAmt,
                amountUSD: amtUSD,
                label: userCurr !== 'USD' ? `${localAmt.toLocaleString()} ${userCurr}` : `$${amtUSD} USD`,
                source: 'milestone'
            });
        });
    }

    if (options.length === 0) {
        const fallbackAmounts = (config.manualPayoutAmountsUSD && config.manualPayoutAmountsUSD.length > 0)
            ? config.manualPayoutAmountsUSD
            : (DEFAULT_PAYOUT_TIER_CONFIG.manualPayoutAmountsUSD || [5, 10, 15, 25]);
            
        fallbackAmounts.forEach(amtUSD => {
            const localAmt = userCurr !== 'USD' ? Math.round(amtUSD * rate) : amtUSD;
            options.push({
                amount: localAmt,
                amountUSD: amtUSD,
                label: userCurr !== 'USD' ? `${localAmt.toLocaleString()} ${userCurr}` : `$${amtUSD} USD`,
                source: 'milestone'
            });
        });
    }

    const uniqueMap = new Map<number, PayoutOptionItem>();
    options.forEach(opt => {
        if (!uniqueMap.has(opt.amount)) {
            uniqueMap.set(opt.amount, opt);
        }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.amount - b.amount);
};
