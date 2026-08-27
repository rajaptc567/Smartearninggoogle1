import { WorkAndEarnModuleConfig } from './types/workAndEarnEditor';

export type Currency = 'USD' | 'EUR' | 'PKR';

export enum Status {
    Active = 'Active',
    Pending = 'Pending',
    Blocked = 'Blocked',
    Approved = 'Approved',
    Rejected = 'Rejected',
    Paid = 'Paid',
    Disabled = 'Disabled',
    Matching = 'Matching',
    Paused = 'Paused',
    Open = 'Open',
    Processing = 'Processing',
    Resolved = 'Resolved',
    Closed = 'Closed'
}

export interface CustomField {
    id: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox';
    required: boolean;
    options: string; // Comma-separated options for select
}

export interface UserRestrictions {
    deposit: boolean;
    withdrawal: boolean;
    transfer: boolean;
    earning: boolean;
    dispute: boolean;
    excludeFromTicker: boolean;
    login: boolean; 
    purchase: boolean;
}

export interface ActivePlan {
    planId: string;
    planName: string;
    price: number;
    purchaseDate: string;
}

export interface CompletedTask {
    taskId: string;
    proofUrl?: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    adminNotes?: string;
    completedAt: string;
    retryCount?: number;
}

export interface User {
    _id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    whatsapp?: string;
    country: string;
    currency: Currency;
    walletBalance: number;
    investmentBalance?: number;
    taskWalletBalance?: number;
    taskEarningsBalance?: number;
    referralEarningsUSD?: number;
    heldUpgradeBalance?: number;
    activePlan?: string;
    activePlans?: ActivePlan[];
    status: Status | 'Active' | 'Blocked' | 'Pending' | 'Paused';
    role?: 'admin' | 'user' | string;
    registrationDate: string;
    plannedActivationDate?: string;
    restrictions?: UserRestrictions;
    sponsor?: string;
    referralCode?: string;
    completedTasks?: CompletedTask[];
    isVerified?: boolean;
    emailVerified?: boolean;
    whatsappVerified?: boolean;
}

export interface PageStyling {
    title: string;
    subtitle: string;
    primaryColor: string;
    backgroundColor: string;
    cardBackgroundColor: string;
    textColor: string;
    accentColor: string;
    buttonText: string;
    buttonColor: string;
    fontSizeTitle: string;
    fontSizeBody: string;
    cardRounding: string;
    tabSize: 'sm' | 'md' | 'lg';
    mobileAdjustment: {
        fontSizeTitle: string;
        padding: string;
    }
}

export interface RecurringPlanConfig {
    planId: string;
    applyToAllPlans: boolean;
    targetPlanIds: string[];
    bypassDirect: boolean;
    bypassIndirect: boolean;
}

export interface DemoProfile {
    _id: string;
    name: string;
    country: string;
    currency: Currency;
}

export interface DemoActivityTemplate {
    _id: string;
    template: string;
    type: 'withdrawal' | 'transfer' | 'joined' | 'deposit' | 'plan' | 'commission';
    enabled: boolean;
}

export interface Notice {
    _id: string;
    message: string;
    targetType: 'all' | 'plan' | 'inactive' | 'manual';
    targetIds?: string[];
    style: 'sliding' | 'blinking' | 'static';
    speed?: 'slow' | 'normal' | 'fast';
    enabled: boolean;
    color: 'info' | 'success' | 'warning' | 'danger';
    startTime?: string;
    endTime?: string;
}

export interface CustomEarnSubTab {
    id: string;
    name: string;
    providerKey?: string;
    description?: string;
    icon?: string;
    badge?: string;
}

export interface CustomEarnTab {
    id: string;
    title: string;
    subTabs: CustomEarnSubTab[];
    enabled?: boolean;
}

export interface Settings {
    customEarnTabs?: CustomEarnTab[];
    proofControls?: {
        screenshotEnabled?: boolean;
        textEnabled?: boolean;
        maxScreenshotSizeMB?: number;
        allowedExtensions?: string[];
        minBudget?: number;
    };
    systemLimits?: {
        minWorkerSlots?: number;
        maxWorkerSlots?: number;
        approvalTimeoutDays?: number;
        disputeTimeLimitHours?: number;
        disputeReviewTimeoutDays?: number;
        secondDisputeTimeLimitHours?: number;
    };
    isUserTransferEnabled: boolean;
    isTasksEnabled: boolean; 
    transferConfig: {
        enabled: boolean;
        tiers: TransferFeeTier[];
        allowCrossCurrency: boolean;
    };
    exchangeRates: {
        USD: number;
        EUR: number;
        PKR: number;
    };
    uiCustomization?: {
        depositPage: PageStyling;
        withdrawPage: PageStyling;
        networkPage: PageStyling & { 
            highlightRingColor: string;
            slotCapLabel: string;
            depthLabel: string;
        };
    };
    restrictWithdrawalAmount: boolean;
    restrictDepositAmount: boolean;
    requirePlanMatchForCommission: boolean;
    requireActivePlanForCommission: boolean;
    oneTimeCommissionPerGroup: boolean;
    showRejectedCommissionTransaction: boolean;
    notifySponsorOnCommissionLimit: boolean;
    recurringCommissionConfigs: RecurringPlanConfig[];
    requireUplineEligibility: boolean;
    withdrawalFrequency: {
        enabled: boolean;
        value: number;
        unit: 'hours' | 'days' | 'weeks' | 'months';
    };
    planSortType?: 'price-asc' | 'price-desc' | 'manual';
    manualPlanOrder?: string[];
    tickerSpeed: number;
    tickerContentSource: 'hybrid' | 'real_only' | 'demo_only';
    tickerEnabled?: boolean;
    tickerPauseOnHover?: boolean;
    tickerStyle?: {
        backgroundColor?: string;
        textColor?: string;
        accentColor?: string;
    };
    tickerRealActivities?: {
        deposits: boolean;
        withdrawals: boolean;
        registrations: boolean;
        commissions: boolean;
        transfers: boolean;
        planPurchases: boolean;
    };
    tickerRealActivityConfig?: {
        minAmount: number;
        privacyMode: boolean;
        excludedCurrencies: Currency[];
    };
    tickerHiddenEventIds?: string[];
    tickerRealActivityTemplates?: {
        deposits: string[];
        withdrawals: string[];
        registrations: string[];
        commissions: string[];
        transfers: string[];
        planPurchases: string[];
    };
    tickerDemoAmountRanges?: {
        USD: { min: number; max: number };
        EUR: { min: number; max: number };
        PKR: { min: number; max: number };
    };
    planEquivalencyGroups?: PlanEquivalencyGroup[];
    demoProfiles?: DemoProfile[];
    demoActivityTemplates?: DemoActivityTemplate[];
    notices?: Notice[];
    faqs?: FaqItem[];
    homepageVideoUrl?: string;
    homepageContent?: HomepageContent;
    homepageVideoId?: string;
    homepagePaymentLogos?: HomepagePaymentLogo[];
    featuredPlanIds?: string[];
    isInitialPageLoaderEnabled?: boolean;
    dataVersion?: number;
    whatsappNumber?: string;
    whatsappFloatingEnabled?: boolean;
    whatsappDepositProofEnabled?: boolean;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    privacyPolicyTitle?: string;
    privacyPolicyUpdated?: string;
    privacyPolicyContent?: string;
    refundPolicyTitle?: string;
    refundPolicyUpdated?: string;
    refundPolicyContent?: string;
    termsOfUseTitle?: string;
    termsOfUseUpdated?: string;
    termsOfUseContent?: string;
    cookiePolicyTitle?: string;
    cookiePolicyUpdated?: string;
    cookiePolicyContent?: string;
    contactUsTitle?: string;
    contactUsUpdated?: string;
    contactUsContent?: string;
    
    // Contact Us Box Controls
    enableContactUsBox?: boolean; // Enable/disable Contact Us box completely
    enableContactViaEmail?: boolean; // Enable/disable Email contact option
    enableContactViaWhatsApp?: boolean; // Enable/disable WhatsApp contact option
    contactUsEmailAddress?: string; // Admin contact support email address
    contactUsWhatsAppNumber?: string; // Admin contact support WhatsApp number
    contactUsBoxTitle?: string; // Custom title for Contact Us Box
    contactUsBoxSubtitle?: string; // Custom subtitle for Contact Us Box
    aboutUsTitle?: string;
    aboutUsUpdated?: string;
    aboutUsContent?: string;
    antiFraudPolicyTitle?: string;
    antiFraudPolicyUpdated?: string;
    antiFraudPolicyContent?: string;
    withdrawalPolicyTitle?: string;
    withdrawalPolicyUpdated?: string;
    withdrawalPolicyContent?: string;
    disclaimerTitle?: string;
    disclaimerUpdated?: string;
    disclaimerContent?: string;
    dmcaPolicyTitle?: string;
    dmcaPolicyUpdated?: string;
    dmcaPolicyContent?: string;
    emailAutomationEnabled?: boolean;
    emailSenderAddress?: string;
    emailSenderPassword?: string;
    whatsappAutomationEnabled?: boolean;
    whatsappInstanceId?: string;
    whatsappToken?: string;
    autoWelcomeEnabled?: boolean;
    autoPasswordResetEnabled?: boolean;
    isUserTaskEnabled?: boolean;
    userDashboardVersion?: 'old' | 'compact';
    landingPageStyle?: 'standard' | 'smartexn';
    userTaskAccessMode?: 'all' | 'manual' | 'plan';
    userTaskAllowedUserIds?: string[];
    userTaskAllowedPlanIds?: string[];
    userTaskNotificationEnabled?: boolean;
    userTaskNotificationMessage?: string;
    userTaskConfig?: {
        minQuantity: number;
        minRewardAmount: number;
        commissionPercent: number;
        campaignFeeEnabled?: boolean;
        campaignFeeAmount?: number;
    };
    taskCategoryPresets?: any;
    userTaskProofLimits?: any;
    signUpConfig?: {
        customTitle?: string;
        fullNameRule?: 'required' | 'optional' | 'hidden';
        usernameRule?: 'required' | 'optional' | 'hidden';
        phoneRule?: 'required' | 'optional' | 'hidden';
        whatsappRule?: 'required' | 'optional' | 'hidden';
        countryRule?: 'required' | 'optional' | 'hidden';
        sponsorRule?: 'required' | 'optional' | 'hidden';
        
        addressRule?: 'required' | 'optional' | 'hidden';
        cityRule?: 'required' | 'optional' | 'hidden';
        postalCodeRule?: 'required' | 'optional' | 'hidden';
        telegramRule?: 'required' | 'optional' | 'hidden';
        genderRule?: 'required' | 'optional' | 'hidden';
        dateOfBirthRule?: 'required' | 'optional' | 'hidden';

        requireCountryCodeInPhone?: boolean;
        requireCountryCodeInWhatsapp?: boolean;
        customFields?: CustomField[];
    };
    hubEnabled?: boolean;
    hubMinDeposit?: number;
    hubMaxDeposit?: number;
    hubMinWithdrawal?: number;
    hubMaxWithdrawal?: number;
    hubAccessMode?: 'all' | 'manual' | 'plan';
    hubAllowedUserIds?: string[];
    hubAllowedPlanIds?: string[];
    hubDepositMethods?: string[];
    hubFaqs?: FaqItem[];
    hubPrivacyPolicyTitle?: string;
    hubPrivacyPolicyUpdated?: string;
    hubPrivacyPolicyContent?: string;
    hubTermsOfUseTitle?: string;
    hubTermsOfUseUpdated?: string;
    hubTermsOfUseContent?: string;
    hubRefundPolicyTitle?: string;
    hubRefundPolicyUpdated?: string;
    hubRefundPolicyContent?: string;
    hubCookiePolicyTitle?: string;
    hubCookiePolicyUpdated?: string;
    hubCookiePolicyContent?: string;
    hubContactUsTitle?: string;
    hubContactUsUpdated?: string;
    hubContactUsContent?: string;
    hubAboutUsTitle?: string;
    hubAboutUsUpdated?: string;
    hubAboutUsContent?: string;
    hubAntiFraudPolicyTitle?: string;
    hubAntiFraudPolicyUpdated?: string;
    hubAntiFraudPolicyContent?: string;
    hubWithdrawalPolicyTitle?: string;
    hubWithdrawalPolicyUpdated?: string;
    hubWithdrawalPolicyContent?: string;
    hubDisclaimerTitle?: string;
    hubDisclaimerUpdated?: string;
    hubDisclaimerContent?: string;
    hubDmcaPolicyTitle?: string;
    hubDmcaPolicyUpdated?: string;
    hubDmcaPolicyContent?: string;
    emailVerificationRequired?: boolean;
    whatsappVerificationRequired?: boolean;
    workAndEarnWithdrawalRules?: WorkAndEarnWithdrawalRule[];
    workAndEarnPayoutTierConfig?: WorkAndEarnPayoutTierConfig;
    ruleEvaluationLogs?: RuleEvaluationLog[];
    modulePagesConfig?: ModulePageControlsConfig;
    workAndEarnConfig?: WorkAndEarnModuleConfig;
}

export interface ModulePageControl {
    id: string;
    name: string;
    route: string;
    icon?: string;
    category: 'investment' | 'work_and_earn' | 'workAndEarn';
    menuLocation?: string;
    isEnabled: boolean;
    isHiddenInNav: boolean;
    disabledNotice?: string;
}

export interface ModulePageControlsConfig {
    investment: Record<string, ModulePageControl>;
    workAndEarn: Record<string, ModulePageControl>;
}

export interface PayoutSequenceStep {
    stepNumber: number;
    amountUSD: number;
    label?: string;
    requiredMilestoneUSD?: number;
}

export interface WorkAndEarnPayoutTierConfig {
    enabled: boolean;
    mode: 'sequence' | 'milestones_choice' | 'running_plan_only' | 'hybrid';
    
    // Limits & Frequency
    minWithdrawalLimitUSD?: number;
    maxWithdrawalLimitUSD?: number;
    dailyWithdrawalLimitUSD?: number;
    withdrawalFrequencyLimitHours?: number; // Minimum hours between withdrawal requests (e.g. 24 = once a day)

    // Plan-Based Amount Limits
    planBasedAmountLimitsEnabled: boolean; // Enable/disable restricting payouts to investment plan amounts
    requireActivePlanToWithdraw: boolean; // Is active plan strictly required to withdraw or optional

    // Currency settings
    useBaseCurrencyPayouts: boolean; // convert to user's local currency (PKR/INR/etc)
    hideUSDInUserCurrencyDisplay?: boolean; // Show clean local currency without USD secondary tag
    
    // Layout Grid Columns
    payoutLayoutColumns?: 2 | 3 | 4; // Desktop/Tablet layout columns
    payoutLayoutColumnsMobile?: 2 | 3 | 4; // Mobile layout columns
    
    // Mounted Plans integration
    mountInvestmentPlans: boolean;
    linkedPlanIds?: string[];
    onlyShowRunningPlanAmount: boolean; // Show only amount of currently running plan for the user based on base currency
    
    // Sequential payouts
    sequenceSteps: PayoutSequenceStep[]; // e.g. Step 1: $5, Step 2: $10, Step 3: $15
    
    // Milestone payout options (without sequence requirement)
    manualPayoutAmountsUSD: number[];
    allowMilestoneWithdrawalWithoutSequence: boolean;
    
    // Step 4 Withdrawal Investment Plan Pop-up
    enableInvestmentPlanPopupOnWithdrawal?: boolean;
}

export type WithdrawalRuleType = 
    | 'first_withdrawal'
    | 'second_withdrawal'
    | 'third_withdrawal'
    | 'every_nth_withdrawal'
    | 'after_x_total_earnings'
    | 'after_x_successful_withdrawals'
    | 'after_x_campaigns_completed'
    | 'after_x_tasks_completed'
    | 'account_age_requirement'
    | 'kyc_requirement'
    | 'investment_plan_requirement'
    | 'minimum_referral_requirement'
    | 'manual_admin_approval_requirement'
    | 'wallet_balance_requirement'
    | 'custom';

export interface WorkAndEarnWithdrawalRule {
    id: string;
    name: string;
    description?: string;
    ruleType: WithdrawalRuleType;
    enabled: boolean;
    priority: number;
    isMandatory: boolean;
    
    targetUserGroup: 'all' | 'specific_users' | 'no_active_plan';
    targetUserIds?: string[];
    
    effectiveDate?: string;
    expiryDate?: string;
    
    triggerConfig: {
        withdrawalNumber?: number;
        nthFrequency?: number;
        minTotalEarningsUSD?: number;
        minSuccessfulWithdrawals?: number;
        minCampaignsCompleted?: number;
        minTasksCompleted?: number;
        minAccountAgeDays?: number;
        minReferrals?: number;
        minWalletBalanceUSD?: number;
    };
    
    requirementConfig: {
        requireActiveInvestmentPlan?: boolean;
        planSelectionType?: 'any' | 'selected' | 'category' | 'min_amount';
        requiredPlanIds?: string[];
        requiredPlanCategory?: string;
        minPlanAmountUSD?: number;
        
        // Payout Tiers & Investment Plan Mounts
        linkedPlanIds?: string[];
        manualPayoutAmounts?: number[];
        payoutStepRule?: 'any_option' | 'higher_than_previous' | 'lower_than_previous' | 'exact_match';
        minPayoutThresholdUSD?: number;
        payoutCurrency?: string;
        allowUserSelectionFromMountedPlans?: boolean;
        
        requireKycVerification?: boolean;
        requireManualAdminApproval?: boolean;
        customConditionExpression?: string;
    };
    
    notificationConfig: {
        title: string;
        message: string;
        primaryActionButtonText: string;
        primaryActionUrl?: string;
        secondaryActionButtonText?: string;
        secondaryActionUrl?: string;
    };
    
    createdAt: string;
    updatedAt: string;
}

export interface RuleEvaluationLog {
    id: string;
    userId: string;
    username: string;
    ruleId: string;
    ruleName: string;
    ruleType: WithdrawalRuleType;
    status: 'PASSED' | 'BLOCKED' | 'WARNED';
    details: string;
    timestamp: string;
}

export interface Task {
    _id: string;
    title: string;
    description: string;
    link: string;
    type: 'Video' | 'Link' | 'Social' | 'Subscription';
    platform: 'YouTube' | 'Facebook' | 'Instagram' | 'Telegram' | 'TikTok' | 'X' | 'Other';
    action: 'Watch' | 'Follow' | 'Like' | 'Subscribe' | 'Comment' | 'Share';
    category?: string;
    priority: number;
    frequency: 'Once' | 'Daily' | 'Weekly' | 'Custom';
    cooldownHours?: number;
    videoDurationType?: 'Full' | 'Specific';
    videoDurationValue?: number;
    requireProof: boolean;
    proofInstructions?: string;
    isRequiredForWithdrawal: boolean;
    targetPlanIds: string[];
    targetCountries: string[];
    targetCurrencies: Currency[];
    minPlanValue: number;
    activeFrom?: string;
    activeTo?: string;
    maxGlobalCompletions: number;
    currentGlobalCompletions: number;
    status: 'Active' | 'Disabled' | 'Draft' | 'Archived';
    rewardAmount?: number;
    createdAt: string;
}

export interface UserTask {
    _id: string;
    userId: string;
    userName: string;
    category: 'Facebook' | 'YouTube' | 'WhatsApp' | 'Website' | 'Google' | 'Instagram' | 'Other' | string;
    subType: 'Comment' | 'Like' | 'Follow' | 'Subscribe' | 'Watch Time' | 'Sign-up' | 'Share' | 'Review' | 'Other' | string;
    title: string;
    description: string;
    link: string;
    targetQuantity: number;
    completedQuantity?: number;
    currentCompletions: number;
    rewardPerTask: number;
    totalBudget: number;
    totalBudgetUSD?: number;
    baseFeeCharged?: number;
    campaignFeeUSD?: number;
    baseCampaignFee?: number;
    adminCommission: number;
    currency: Currency;
    status: 'Pending' | 'Approved' | 'Rejected' | 'On Hold' | 'Paid' | 'Completed' | 'Active' | 'Running' | string;
    adminNotes?: string;
    userEmail?: string;
    reviewRequested?: boolean;
    resubmittedForReview?: boolean;
    userReviewMessage?: string;
    completedUsers?: string[];
    createdAt?: string;
    updatedAt?: string;
    date?: string;
    requireTextProof?: boolean;
    textProofInstruction?: string;
    requireUsername?: boolean;
    usernameInstruction?: string;
    requireUserId?: boolean;
    userIdInstruction?: string;
    requireEmail?: boolean;
    emailInstruction?: string;
    requireScreenshot?: boolean;
    screenshotInstruction?: string;
    requiredProofs?: Array<{ id: string; type: 'text' | 'username' | 'userId' | 'email' | 'screenshot' | 'manual'; label: string; instruction: string }>;
}

export interface UserTaskSubmission {
    _id: string;
    taskId: string;
    workerId: string;
    userId?: string;
    workerName: string;
    rewardTransactionId?: string;
    proofText: string;
    proofUsername?: string;
    proofUserIdVal?: string;
    proofEmail?: string;
    proofImage?: string;
    submittedProofs?: Array<{ id: string; type: 'text' | 'username' | 'userId' | 'email' | 'screenshot' | 'manual'; label: string; value: string }>;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Disputed' | 'Paid' | 'In Review' | 'Submitted' | 'Completed' | string;
    adminNotes?: string;
    rewardAmount: number;
    currency: Currency;
    createdAt?: string;
    updatedAt?: string;
    autoApproveAt?: string;
    isAutoApproved?: boolean;
    autoApproved?: boolean;
    approvalType?: string;
    taskTitle?: string;
    taskCategory?: string;
    rejectionReason?: string;
    rejectedAt?: string;
    disputeDeadline?: string;
    disputeOpened?: boolean;
    disputeId?: string;
    disputeReviewDeadline?: string;
    secondDisputeDeadline?: string;
    disputeStage?: 'None' | 'Submitted' | 'Rejected' | 'CreatorReview' | 'RejectedByCreator' | 'Escalated' | 'AdminReview' | 'Resolved';
    disputeCreatorNotes?: string;
    disputeReason?: string;
    disputeProofUrl?: string;
}

export interface Deposit {
    _id: string;
    userId: string;
    userName: string;
    method: string;
    amount: number;
    amountUSD?: number;
    paymentMethodName?: string;
    currency: Currency;
    transactionId: string;
    senderAccountTitle?: string;
    receiptUrl?: string;
    status: Status | 'Pending' | 'Approved' | 'Rejected';
    date: string;
    createdAt?: string;
    adminNotes?: string;
    userNotes?: string;
    confirmationAnswers?: Record<string, string>;
    matchedWithdrawalId?: string;
}

export interface Withdrawal {
    _id: string;
    userId: string;
    userName: string;
    method: string;
    paymentMethod?: string;
    amount: number;
    amountUSD?: number;
    paymentMethodName?: string;
    currency: Currency;
    fee: number;
    finalAmount: number;
    accountTitle: string;
    accountNumber: string;
    status: Status | 'Pending' | 'Approved' | 'Paid' | 'Rejected' | 'Matching' | string;
    date: string;
    createdAt?: string;
    adminNotes?: string;
    userNotes?: string;
    matchRemainingAmount?: number;
    matchedDepositIds?: Deposit[];
}

export interface PaymentMethod {
    _id: string;
    name: string;
    currency: Currency;
    type: 'Deposit' | 'Withdrawal';
    accountTitle: string;
    accountNumber: string;
    instructions?: string;
    minAmount: number;
    maxAmount: number;
    feePercent: number;
    status: 'Enabled' | 'Disabled';
    logoUrl?: string;
    qrCodeUrl?: string;
    p2pWithdrawalId?: string;
    customFields?: { title: string; value: string }[];
    confirmationFields?: {
        label: string;
        placeholder?: string;
        type?: 'text' | 'number' | 'email';
        required?: boolean;
    }[];
    customLabels?: {
        providerLabel?: string;
        accountTitleLabel?: string;
        accountNumberLabel?: string;
    };
    howToDeposit?: {
        enabled: boolean;
        showBeforePayment?: boolean;
        dropdownMode?: boolean;
        steps: {
            title: string;
            description: string;
            imageUrl?: string;
        }[];
    };
    gatewayMode?: 'manual' | 'paynow';
    gatewayTitle?: string;
    gatewayDescription?: string;
    payNowUrl?: string;
    payNowButtonText?: string;
    isPopupViewEnabled?: boolean;
    popupViewTitle?: string;
    popupViewInstructions?: string;
}

export type CommissionType = 'percentage' | 'fixed';

export interface Commission {
    type: CommissionType;
    value: number;
    disabledLevels?: number[]; 
    heldLevels?: number[];
    holdForUpgrade?: boolean;
}

export interface InvestmentPlan {
    _id: string;
    name: string;
    currency: Currency;
    price: number;
    durationDays: number;
    minWithdraw: number;
    description: string;
    status: Status | 'Active' | 'Disabled';
    directReferralLimit: number;
    directCommissions: Commission[];
    indirectCommissions: Commission[];
    commissionDeductions?: {
        afterMaxPayout: Commission;
        afterMaxEarning: Commission;
        afterMaxDirect: Commission;
    };
    autoUpgrade?: {
        enabled: boolean;
        toPlanId?: string;
        type?: 'auto' | 'manual';
    };
    customFeatures?: string[];
    displayConfig?: {
        showDuration: boolean;
        showMinWithdraw: boolean;
        showDirectReferrals: boolean;
        showDirectCommission: boolean;
        showIndirectCommission: boolean;
    };
}

export interface Transaction {
    _id: string;
    userId: string;
    userName: string;
    type: string;
    amount: number;
    amountUSD?: number;
    currency: Currency;
    description: string;
    status?: string;
    date: string;
    level?: number;
    sourceUserId?: string;
    relatedPlanId?: string;
    originalAmount?: number;
    originalCurrency?: Currency;
    exchangeRate?: number;
}

export interface Rule {
    _id: string;
    targetPlanId: string;
    targetPlanName: string;
    requiredPlanIds: string[];
    requiredPlanNames: string[];
    minTotalEarnings?: number;
    maxTotalEarnings?: number;
    minDirectReferrals?: number;
    currency: Currency;
    isActive?: boolean;
}

export interface TransferFeeTier {
    minAmount: number;
    maxAmount: number;
    feeType: 'percentage' | 'fixed';
    feeValue: number;
    currency: Currency;
    enabled?: boolean;
}

export interface PlanEquivalencyGroup {
    _id: string;
    usdPlanId?: string;
    pkrPlanId?: string;
    eurPlanId?: string;
}

export interface FaqItem {
    question: string;
    answer: string;
    showOnHomepage?: boolean;
}

export interface HomepagePaymentLogo {
    name: string;
    logoUrl: string;
}

export interface SmartexnContent {
    heroTitle?: string;
    heroSubtitle?: string;
    heroStartBtn?: string;
    heroPublishBtn?: string;
    dashboardPreviewImage?: string;
    mobilePreviewImage?: string;
    howItWorksTitle?: string;
    step1Title?: string;
    step1Desc?: string;
    step2Title?: string;
    step2Desc?: string;
    step3Title?: string;
    step3Desc?: string;
    step4Title?: string;
    step4Desc?: string;
    oppsTitle?: string;
    opp1Title?: string;
    opp1Desc?: string;
    opp2Title?: string;
    opp2Desc?: string;
    opp3Title?: string;
    opp3Desc?: string;
    opp4Title?: string;
    opp4Desc?: string;
    bizTitle?: string;
    bizPoint1Title?: string;
    bizPoint1Desc?: string;
    bizPoint2Title?: string;
    bizPoint2Desc?: string;
    bizPoint3Title?: string;
    bizPoint3Desc?: string;
    bizPoint4Title?: string;
    bizPoint4Desc?: string;
    footerCopyright?: string;
}

export interface HomepageContent {
    smartexnContent?: SmartexnContent;
    showHero: boolean;
    showFeatures: boolean;
    showMultiCurrency: boolean;
    showInvestmentPlans: boolean;
    showMLM: boolean;
    showPaymentMethods: boolean;
    showVideoSection: boolean;
    showFAQ: boolean;
    showCTA: boolean;
    heroTitle: string;
    heroSubtitle: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
    videoTitle: string;
    videoDesc: string;
    multiCurrencyTitle: string;
    multiCurrencyDesc: string;
    mlmTitle: string;
    mlmDesc: string;
    paymentMethodsTitle: string;
    paymentMethodsDesc: string;
    paymentMethodsDisplayType: 'static' | 'sliding' | 'pulsing';
    paymentMethodsColorStyle: 'color' | 'grayscale';
    ctaTitle: string;
    ctaDesc: string;
}

export interface Notification {
    _id: string;
    userId: string;
    senderType: 'Admin' | 'System';
    subject?: string;
    message: string;
    isPopup: boolean;
    popupShown: boolean;
    read: boolean;
    imageUrl?: string;
    displayTrigger?: string;
    frequency?: string;
    actionButtonText?: string;
    actionButtonLink?: string;
    date: string;
}

export interface Transfer {
    _id: string;
    senderId: string;
    senderName: string;
    recipientId: string;
    recipientName: string;
    amount: number;
    currency: Currency;
    fee?: number;
    totalDeducted?: number;
    status: Status | 'Pending' | 'Approved' | 'Rejected';
    date: string;
    adminNotes?: string;
}

export interface Log {
    _id: string;
    action: string;
    affectedUser?: string;
    details?: string;
    performedBy: string;
    timestamp: string;
}

export interface PasswordResetRequest {
    _id: string;
    userId: string;
    userEmail: string;
    userName: string;
    status: 'Pending' | 'Handled';
    requestDate: string;
    process?: string;
    sendType?: 'None' | 'Automatic' | 'Manual';
    channel?: string;
    sentAt?: string;
    resetToken?: string;
    resetLink?: string;
    handledAt?: string;
}

export interface Message {
    sender: 'User' | 'Admin' | 'System';
    message: string;
    date: string;
    attachmentUrl?: string;
}

export interface Dispute {
    _id: string;
    userId: string;
    userName: string;
    type: 'Deposit' | 'Withdrawal' | 'Transfer' | 'UserTask';
    referenceId: string;
    description: string;
    proofUrl?: string;
    status: Status | 'Open' | 'Processing' | 'Resolved' | 'Closed';
    adminResponse: string;
    messages: Message[];
    adminUnread: boolean;
    userUnread: boolean;
    date: string;
}

export const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    PKR: 'Rs',
};

export const formatCurrency = (amount: number | undefined | null, currency: string = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) {
        const symbol = currencySymbols[currency] || currency || '$';
        return `${symbol} 0`;
    }
    const symbol = currencySymbols[currency] || currency;
    const fractionDigits = amount % 1 === 0 ? 0 : 2;
    return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
};

export const countries = [
    "United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Italy", "Spain", "Pakistan", "India", "China", "Japan", "Brazil", "Russia", "Mexico", "Indonesia", "Turkey", "Saudi Arabia", "United Arab Emirates", "South Africa", "Nigeria", "Egypt", "Bangladesh", "Vietnam", "Thailand", "Malaysia", "Singapore", "New Zealand", "Netherlands", "Belgium", "Switzerland", "Sweden", "Norway", "Denmark", "Finland", "Poland", "Austria", "Greece", "Portugal", "Ireland", "Czech Republic", "Hungary", "Romania"
];

export interface Template {
    _id: string;
    key: string;
    name: string;
    type: 'email' | 'whatsapp';
    subject: string;
    body: string;
    isEnabled: boolean;
    graphicTheme: 'default' | 'minimalist' | 'cosmic' | 'emerald_success' | 'coral_danger';
    createdAt?: string;
    updatedAt?: string;
}

export interface TemplateLog {
    _id: string;
    userId?: string;
    username: string;
    userEmail?: string;
    userPhone?: string;
    templateKey: string;
    templateName: string;
    type: 'email' | 'whatsapp';
    recipient: string;
    subject?: string;
    body: string;
    status: 'Success' | 'Failed';
    error?: string;
    sentBy: 'System' | 'Admin';
    date?: string;
    createdAt?: string;
}