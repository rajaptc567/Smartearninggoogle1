import { User, Deposit, Withdrawal, Transaction, Notification, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, Status } from '../types';

export const mockUsers: User[] = [
    {
        _id: 'u1',
        username: 'admin',
        fullName: 'System Admin',
        email: 'admin@smartearning.com',
        phone: '1234567890',
        country: 'United States',
        currency: 'USD',
        walletBalance: 0,
        activePlan: 'None',
        activePlans: [],
        registrationDate: new Date().toISOString(),
        status: Status.Active,
        restrictions: {
            deposit: false,
            withdrawal: false,
            transfer: false,
            earning: false,
            dispute: false,
            excludeFromTicker: true
        }
    }
];

export const mockDeposits: Deposit[] = [];
export const mockWithdrawals: Withdrawal[] = [];
export const mockTransactions: Transaction[] = [];
export const mockNotifications: Notification[] = [];
export const mockPaymentMethods: PaymentMethod[] = [];
export const mockInvestmentPlans: InvestmentPlan[] = [];
export const mockRules: Rule[] = [];
export const mockTransfers: Transfer[] = [];
export const mockLogs: Log[] = [];
export const mockPasswordResets: PasswordResetRequest[] = [];
export const mockDisputes: Dispute[] = [];

export const mockSettings: Settings = {
    isUserTransferEnabled: true,
    transferConfig: {
        enabled: true,
        tiers: [],
        allowCrossCurrency: false
    },
    exchangeRates: {
        USD: 1,
        EUR: 0.92,
        PKR: 278.50,
    },
    restrictWithdrawalAmount: false,
    requirePlanMatchForCommission: false,
    requireActivePlanForCommission: false,
    oneTimeCommissionPerGroup: false,
    recurringCommissionPlanIds: [],
    requireUplineEligibility: false,
    withdrawalFrequency: {
        enabled: false,
        value: 1,
        unit: 'days'
    },
    demoProfiles: [],
    demoActivityTemplates: [],
    tickerSpeed: 6,
    tickerContentSource: 'hybrid',
    tickerRealActivities: {
        deposits: true,
        withdrawals: true,
        registrations: true,
        commissions: true,
        transfers: true,
        planPurchases: true
    },
    tickerDemoAmountRanges: {
        USD: { min: 50, max: 500 },
        EUR: { min: 50, max: 500 },
        PKR: { min: 5000, max: 50000 },
    },
    planEquivalencyGroups: [],
    featuredPlanIds: [],
    homepageVideoUrl: "https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1",
    homepageContent: {
        heroTitle: "Invest in Your Future, Grow Your Network",
        heroSubtitle: "SmartEarning provides a secure platform to manage your investments and leverage your network for greater earning potential.",
        feature1Title: "Secure Investments",
        feature1Desc: "Your funds and data are protected with industry-standard security measures.",
        feature2Title: "Powerful MLM System",
        feature2Desc: "Earn commissions not just from your referrals, but from their referrals too.",
        feature3Title: "Real-Time Tracking",
        feature3Desc: "Monitor your earnings, network growth, and transactions with our intuitive dashboard.",
        videoTitle: "See How It Works",
        videoDesc: "Discover the power of our platform in this short overview. Watch how you can leverage your network to achieve your financial goals.",
        multiCurrencyTitle: "Global Reach, Local Convenience",
        multiCurrencyDesc: "Our platform is built for a global audience. Invest, earn, and withdraw in the currency that works for you.",
        mlmTitle: "Understanding Our Earning System",
        mlmDesc: "Our platform uses a Multi-Level Marketing (MLM) structure, which allows you to earn commissions from multiple levels of your network.",
        ctaTitle: "Ready to Start Your Journey?",
        ctaDesc: "Join a community of forward-thinkers. Sign up today and unlock your earning potential."
    }
};
