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
    activePlan?: string;
    activePlans?: ActivePlan[];
    status: Status | 'Active' | 'Blocked' | 'Pending' | 'Paused';
    registrationDate: string;
    plannedActivationDate?: string;
    restrictions?: UserRestrictions;
    sponsor?: string;
    completedTasks?: CompletedTask[];
    isVerified?: boolean;
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

export interface Settings {
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
    emailAutomationEnabled?: boolean;
    emailSenderAddress?: string;
    emailSenderPassword?: string;
    whatsappAutomationEnabled?: boolean;
    whatsappInstanceId?: string;
    whatsappToken?: string;
    autoWelcomeEnabled?: boolean;
    autoPasswordResetEnabled?: boolean;
    isUserTaskEnabled?: boolean;
    userTaskAccessMode?: 'all' | 'manual' | 'plan';
    userTaskAllowedUserIds?: string[];
    userTaskAllowedPlanIds?: string[];
    userTaskNotificationEnabled?: boolean;
    userTaskNotificationMessage?: string;
    userTaskConfig?: {
        minQuantity: number;
        minRewardAmount: number;
        commissionPercent: number;
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
    category: 'Facebook' | 'YouTube' | 'WhatsApp' | 'Website' | 'Google' | 'Instagram' | 'Other';
    subType: 'Comment' | 'Like' | 'Follow' | 'Subscribe' | 'Watch Time' | 'Sign-up' | 'Share' | 'Review' | 'Other';
    title: string;
    description: string;
    link: string;
    targetQuantity: number;
    currentCompletions: number;
    rewardPerTask: number;
    totalBudget: number;
    adminCommission: number;
    currency: Currency;
    status: 'Pending' | 'Approved' | 'Rejected' | 'On Hold' | 'Paid' | 'Completed';
    adminNotes?: string;
    reviewRequested?: boolean;
    resubmittedForReview?: boolean;
    userReviewMessage?: string;
    completedUsers?: string[];
    createdAt?: string;
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
    workerName: string;
    proofText: string;
    proofUsername?: string;
    proofUserIdVal?: string;
    proofEmail?: string;
    proofImage?: string;
    submittedProofs?: Array<{ id: string; type: 'text' | 'username' | 'userId' | 'email' | 'screenshot' | 'manual'; label: string; value: string }>;
    status: 'Pending' | 'Approved' | 'Rejected';
    adminNotes?: string;
    rewardAmount: number;
    currency: Currency;
    createdAt?: string;
    taskTitle?: string;
    taskCategory?: string;
}

export interface Deposit {
    _id: string;
    userId: string;
    userName: string;
    method: string;
    amount: number;
    currency: Currency;
    transactionId: string;
    senderAccountTitle?: string;
    receiptUrl?: string;
    status: Status | 'Pending' | 'Approved' | 'Rejected';
    date: string;
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
    amount: number;
    currency: Currency;
    fee: number;
    finalAmount: number;
    accountTitle: string;
    accountNumber: string;
    status: Status | 'Pending' | 'Approved' | 'Paid' | 'Rejected' | 'Matching';
    date: string;
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

export interface HomepageContent {
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