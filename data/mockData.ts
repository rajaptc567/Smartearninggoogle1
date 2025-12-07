
import { User, Deposit, Withdrawal, Transaction, Notification, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, Status } from '../types';

export const mockUsers: User[] = [];
export const mockInvestmentPlans: InvestmentPlan[] = [];
export const mockPaymentMethods: PaymentMethod[] = [];
export const mockSettings: Settings = {
    isUserTransferEnabled: true,
    transferConfig: {
        enabled: true,
        tiers: [],
        allowCrossCurrency: false
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
    demoProfiles: [],
    demoActivityTemplates: [],
    homepageVideoUrl: '',
    homepageContent: {
        heroTitle: "", heroSubtitle: "", feature1Title: "", feature1Desc: "", feature2Title: "", feature2Desc: "", feature3Title: "", feature3Desc: "", videoTitle: "", videoDesc: "", multiCurrencyTitle: "", multiCurrencyDesc: "", mlmTitle: "", mlmDesc: "", ctaTitle: "", ctaDesc: ""
    }
};
export const mockDeposits: Deposit[] = [];
export const mockWithdrawals: Withdrawal[] = [];
export const mockTransactions: Transaction[] = [];
export const mockNotifications: Notification[] = [];
export const mockTransfers: Transfer[] = [];
export const mockRules: Rule[] = [];
export const mockLogs: Log[] = [];
export const mockPasswordResets: any[] = [];
export const mockDisputes: Dispute[] = [];
