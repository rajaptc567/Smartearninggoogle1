
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Settings, Notification, Transfer, Log, Dispute, Status } from '../types';

export const mockUsers: User[] = [
    {
        _id: 'u1',
        username: 'admin',
        fullName: 'System Admin',
        email: 'studio56.pk@gmail.com',
        phone: '1234567890',
        country: 'Pakistan',
        currency: 'PKR',
        walletBalance: 100000,
        activePlan: 'None',
        activePlans: [],
        status: Status.Active,
        registrationDate: new Date('2023-01-01').toISOString(),
        // Added missing login and purchase properties to match UserRestrictions type
        restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: true, login: false, purchase: false }
    },
    {
        _id: 'u2',
        username: 'ali_khan',
        fullName: 'Ali Khan',
        email: 'ali@example.pk',
        phone: '+923001234567',
        country: 'Pakistan',
        currency: 'PKR',
        walletBalance: 50000,
        activePlan: 'Pro PKR',
        activePlans: [
            { planId: 'p2', planName: 'Pro PKR', price: 15000, purchaseDate: new Date('2023-06-15').toISOString() }
        ],
        status: Status.Active,
        registrationDate: new Date('2023-06-10').toISOString(),
        sponsor: 'admin'
    }
];

export const mockInvestmentPlans: InvestmentPlan[] = [
    {
        _id: 'p2',
        name: 'Pro PKR',
        currency: 'PKR',
        price: 15000,
        durationDays: 60,
        minWithdraw: 2000,
        description: 'High return plan specifically for PKR users.',
        status: Status.Active,
        directReferralLimit: 0,
        directCommissions: [{ type: 'percentage', value: 7 }],
        indirectCommissions: [{ type: 'percentage', value: 2 }, { type: 'percentage', value: 1 }],
        commissionDeductions: { afterMaxPayout: {type: 'fixed', value: 0}, afterMaxEarning: {type: 'fixed', value: 0}, afterMaxDirect: {type: 'fixed', value: 0} },
        // FIX: Removed holdPosition as it doesn't exist in type InvestmentPlan
        autoUpgrade: { enabled: false }
    },
    {
        _id: 'p3',
        name: 'Elite EUR',
        currency: 'EUR',
        price: 500,
        durationDays: 90,
        minWithdraw: 50,
        description: 'Elite plan for European investors.',
        status: Status.Active,
        directReferralLimit: 0,
        directCommissions: [{ type: 'percentage', value: 10 }],
        indirectCommissions: [{ type: 'percentage', value: 3 }, { type: 'percentage', value: 2 }],
        commissionDeductions: { afterMaxPayout: {type: 'fixed', value: 0}, afterMaxEarning: {type: 'fixed', value: 0}, afterMaxDirect: {type: 'fixed', value: 0} },
        // FIX: Removed holdPosition as it doesn't exist in type InvestmentPlan
        autoUpgrade: { enabled: false }
    }
];

export const mockPaymentMethods: PaymentMethod[] = [
    {
        _id: 'pm2',
        name: 'Easypaisa / JazzCash',
        currency: 'PKR',
        type: 'Deposit',
        accountTitle: 'Ali Agent',
        accountNumber: '03001234567',
        instructions: 'Send amount and upload screenshot.',
        minAmount: 1000,
        maxAmount: 500000,
        feePercent: 0,
        status: 'Enabled'
    },
    {
        _id: 'pm4',
        name: 'Bank Transfer PKR',
        currency: 'PKR',
        type: 'Withdrawal',
        accountTitle: 'Any Bank',
        accountNumber: 'IBAN',
        instructions: 'Provide full IBAN.',
        minAmount: 2000,
        maxAmount: 100000,
        feePercent: 0,
        status: 'Enabled'
    }
];

export const mockSettings: Settings = {
    isUserTransferEnabled: true,
    // FIX: Added required property isTasksEnabled
    isTasksEnabled: true,
    transferConfig: {
        enabled: true,
        tiers: [
            { minAmount: 100, maxAmount: 50000, feeType: 'fixed', feeValue: 50, currency: 'PKR', enabled: true }
        ],
        allowCrossCurrency: true
    },
    exchangeRates: { EUR: 300.00, PKR: 1, USD: 280.00 },
    restrictWithdrawalAmount: false,
    requirePlanMatchForCommission: false,
    requireActivePlanForCommission: false,
    oneTimeCommissionPerGroup: false,
    // Added missing properties showRejectedCommissionTransaction and notifySponsorOnCommissionLimit
    showRejectedCommissionTransaction: true,
    notifySponsorOnCommissionLimit: true,
    // Added missing required property recurringCommissionConfigs
    recurringCommissionConfigs: [],
    requireUplineEligibility: false,
    withdrawalFrequency: { enabled: false, value: 1, unit: 'days' },
    tickerSpeed: 6,
    tickerContentSource: 'hybrid',
    featuredPlanIds: [],
    demoProfiles: [
        { _id: 'dp1', name: 'Maria', country: 'Germany', currency: 'EUR' },
        { _id: 'dp2', name: 'Bob', country: 'France', currency: 'EUR' },
        { _id: 'dp3', name: 'Ahmed', country: 'Pakistan', currency: 'PKR' }
    ],
    demoActivityTemplates: [
        { _id: 'dt1', template: '{name} from {country} just joined!', type: 'joined', enabled: true },
        { _id: 'dt2', template: '{name} withdrew {amount} successfully.', type: 'withdrawal', enabled: true }
    ],
    homepageVideoUrl: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1',
    homepageContent: {
        // Added missing visibility booleans
        showHero: true,
        showFeatures: true,
        showMultiCurrency: true,
        showInvestmentPlans: true,
        showMLM: true,
        showPaymentMethods: true,
        showVideoSection: true,
        showFAQ: true,
        showCTA: true,
        heroTitle: "Invest in Your Future",
        heroSubtitle: "Join the best platform today.",
        feature1Title: "Secure", feature1Desc: "Protected funds.",
        feature2Title: "Fast", feature2Desc: "Instant processing.",
        feature3Title: "Global", feature3Desc: "Worldwide access.",
        videoTitle: "Watch Intro", videoDesc: "See how it works.",
        multiCurrencyTitle: "Multi-Currency", multiCurrencyDesc: "EUR, PKR support.",
        mlmTitle: "Earn More", mlmDesc: "Referral bonuses.",
        // Added missing payment methods display properties
        paymentMethodsTitle: "Secure Payments",
        paymentMethodsDesc: "We support multiple gateways.",
        paymentMethodsDisplayType: 'static',
        paymentMethodsColorStyle: 'color',
        ctaTitle: "Join Now", ctaDesc: "Start earning."
    }
};

export const mockDeposits: Deposit[] = [
    {
        _id: 'd1', userId: 'u2', userName: 'Ali Khan', method: 'Easypaisa', amount: 15000, currency: 'PKR',
        transactionId: 'TRX123456', status: Status.Approved, date: new Date('2023-06-15').toISOString()
    }
];
export const mockWithdrawals: Withdrawal[] = [];
export const mockTransactions: Transaction[] = [
    {
        _id: 't1', userId: 'u2', userName: 'Ali Khan', type: 'Deposit', amount: 15000, currency: 'PKR',
        description: 'Approved Deposit #d1', status: 'Approved', date: new Date('2023-06-15').toISOString()
    },
    {
        _id: 't2', userId: 'u2', userName: 'Ali Khan', type: 'Plan Purchase', amount: -15000, currency: 'PKR',
        description: 'Purchased Pro PKR plan', status: 'Approved', date: new Date('2023-06-15').toISOString()
    }
];
export const mockNotifications: Notification[] = [
    {
        _id: 'n1', userId: 'u2', message: 'Welcome to SmartEarning!', read: false, date: new Date().toISOString(),
        senderType: 'System', isPopup: false, popupShown: false
    }
];
export const mockTransfers: Transfer[] = [];
export const mockRules: Rule[] = [];
export const mockLogs: Log[] = [];
export const mockPasswordResets: any[] = [];
export const mockDisputes: Dispute[] = [];
