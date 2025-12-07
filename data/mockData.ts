
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Settings, Notification, Transfer, Log, Dispute, Status } from '../types';

export const mockUsers: User[] = [
    {
        _id: 'u1',
        username: 'admin',
        fullName: 'System Admin',
        email: 'admin@smartearning.com',
        phone: '1234567890',
        country: 'United States',
        currency: 'USD',
        walletBalance: 10000,
        activePlan: 'None',
        activePlans: [],
        status: Status.Active,
        registrationDate: new Date('2023-01-01').toISOString(),
        restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: true }
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
    },
    {
        _id: 'u3',
        username: 'john_doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+15550123456',
        country: 'United States',
        currency: 'USD',
        walletBalance: 150.50,
        activePlan: 'Starter USD',
        activePlans: [
             { planId: 'p1', planName: 'Starter USD', price: 50, purchaseDate: new Date('2023-05-15').toISOString() }
        ],
        status: Status.Active,
        registrationDate: new Date('2023-05-15').toISOString(),
        sponsor: 'admin'
    },
    {
        _id: 'usdok',
        username: 'usdok',
        fullName: 'USD Checkpoint User',
        email: 'usdok@check.point',
        phone: '+1000000000',
        country: 'United States',
        currency: 'USD',
        walletBalance: 1000,
        activePlan: 'USD OK Plan',
        activePlans: [
            { planId: 'p_usdok', planName: 'USD OK Plan', price: 100, purchaseDate: new Date().toISOString() }
        ],
        status: Status.Active,
        registrationDate: new Date().toISOString(),
        sponsor: 'admin'
    }
];

export const mockInvestmentPlans: InvestmentPlan[] = [
    {
        _id: 'p1',
        name: 'Starter USD',
        currency: 'USD',
        price: 50,
        durationDays: 30,
        minWithdraw: 10,
        description: 'Perfect for beginners starting their journey.',
        status: Status.Active,
        directReferralLimit: 0,
        directCommissions: [{ type: 'percentage', value: 5 }],
        indirectCommissions: [{ type: 'percentage', value: 1 }],
        commissionDeductions: { afterMaxPayout: {type: 'fixed', value: 0}, afterMaxEarning: {type: 'fixed', value: 0}, afterMaxDirect: {type: 'fixed', value: 0} },
        autoUpgrade: { enabled: false },
        holdPosition: { enabled: false, slots: [] }
    },
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
        autoUpgrade: { enabled: false },
        holdPosition: { enabled: false, slots: [] }
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
        autoUpgrade: { enabled: false },
        holdPosition: { enabled: false, slots: [] }
    },
    {
        _id: 'p_usdok',
        name: 'USD OK Plan',
        currency: 'USD',
        price: 100,
        durationDays: 30,
        minWithdraw: 10,
        description: 'Checkpoint plan to verify USD functionality.',
        status: Status.Active,
        directReferralLimit: 5,
        directCommissions: [{ type: 'percentage', value: 5 }],
        indirectCommissions: [],
        commissionDeductions: { afterMaxPayout: {type: 'fixed', value: 0}, afterMaxEarning: {type: 'fixed', value: 0}, afterMaxDirect: {type: 'fixed', value: 0} },
        autoUpgrade: { enabled: false },
        holdPosition: { enabled: false, slots: [] }
    }
];

export const mockPaymentMethods: PaymentMethod[] = [
    {
        _id: 'pm1',
        name: 'USDT (TRC20)',
        currency: 'USD',
        type: 'Deposit',
        accountTitle: 'Admin Wallet',
        accountNumber: 'T9x...WalletAddress',
        instructions: 'Send exact amount to the address.',
        minAmount: 10,
        maxAmount: 10000,
        feePercent: 1,
        status: 'Enabled'
    },
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
        _id: 'pm3',
        name: 'USDT Withdrawal',
        currency: 'USD',
        type: 'Withdrawal',
        accountTitle: 'Wallet',
        accountNumber: 'N/A',
        instructions: 'Provide your TRC20 address.',
        minAmount: 20,
        maxAmount: 5000,
        feePercent: 2,
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
    transferConfig: {
        enabled: true,
        tiers: [
            { minAmount: 1, maxAmount: 100, feeType: 'fixed', feeValue: 1, currency: 'USD', enabled: true },
            { minAmount: 100, maxAmount: 50000, feeType: 'fixed', feeValue: 50, currency: 'PKR', enabled: true }
        ],
        allowCrossCurrency: true
    },
    exchangeRates: { USD: 1, EUR: 0.92, PKR: 278.50 },
    restrictWithdrawalAmount: false,
    requirePlanMatchForCommission: false,
    requireActivePlanForCommission: false,
    oneTimeCommissionPerGroup: false,
    requireUplineEligibility: false,
    withdrawalFrequency: { enabled: false, value: 1, unit: 'days' },
    tickerSpeed: 6,
    featuredPlanIds: [],
    demoProfiles: [
        { _id: 'dp1', name: 'Alice', country: 'USA', currency: 'USD' },
        { _id: 'dp2', name: 'Bob', country: 'UK', currency: 'USD' },
        { _id: 'dp3', name: 'Ahmed', country: 'Pakistan', currency: 'PKR' },
        { _id: 'dp4', name: 'Checkpoint User', country: 'USA', currency: 'USD' }
    ],
    demoActivityTemplates: [
        { _id: 'dt1', template: '{name} from {country} just joined!', type: 'joined', enabled: true },
        { _id: 'dt2', template: '{name} withdrew {amount} successfully.', type: 'withdrawal', enabled: true }
    ],
    homepageVideoUrl: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1',
    homepageContent: {
        heroTitle: "Invest in Your Future",
        heroSubtitle: "Join the best platform today.",
        feature1Title: "Secure", feature1Desc: "Protected funds.",
        feature2Title: "Fast", feature2Desc: "Instant processing.",
        feature3Title: "Global", feature3Desc: "Worldwide access.",
        videoTitle: "Watch Intro", videoDesc: "See how it works.",
        multiCurrencyTitle: "Multi-Currency", multiCurrencyDesc: "USD, EUR, PKR support.",
        mlmTitle: "Earn More", mlmDesc: "Referral bonuses.",
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
    },
    {
        _id: 't_usdok', userId: 'usdok', userName: 'usdok', type: 'Deposit', amount: 1000, currency: 'USD',
        description: 'Initial Checkpoint Deposit', status: 'Approved', date: new Date().toISOString()
    }
];
export const mockNotifications: Notification[] = [
    {
        _id: 'n1', userId: 'u2', message: 'Welcome to SmartEarning!', read: false, date: new Date().toISOString()
    }
];
export const mockTransfers: Transfer[] = [];
export const mockRules: Rule[] = [];
export const mockLogs: Log[] = [];
export const mockPasswordResets: any[] = [];
export const mockDisputes: Dispute[] = [];
