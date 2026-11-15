
import React, { createContext, useReducer, ReactNode, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Status, Transfer, Settings, Notification, Log, PasswordResetRequest, Dispute, Task, HomepageContent, UserTask, UserTaskSubmission } from '../types';
import { 
    getUser, getUsers, getDeposits, getWithdrawals, getTransactions, getNotifications, getPaymentMethods,
    getInvestmentPlans, getRules, getSettings, getPublicSettings, getTransfers, getLogs, getPasswordResetRequests, getDisputes, getTasks, getUserTasks, getUserTaskSubmissions,
    getDataVersion
} from '../services/api';

interface AppState {
    users: User[];
    deposits: Deposit[];
    withdrawals: Withdrawal[];
    transfers: Transfer[];
    paymentMethods: PaymentMethod[];
    investmentPlans: InvestmentPlan[];
    transactions: Transaction[];
    rules: Rule[];
    tasks: Task[];
    userTasks: UserTask[];
    userTaskSubmissions: UserTaskSubmission[];
    settings: Settings;
    notifications: Notification[];
    logs: Log[];
    passwordResetRequests: PasswordResetRequest[];
    disputes: Dispute[];
    currentUser: User | null;
    isLoading: boolean;
    isSyncing: boolean;
    isTasksLoading: boolean;
}

const defaultHomepageContent: HomepageContent = {
    showHero: true,
    showFeatures: true,
    showMultiCurrency: true,
    showInvestmentPlans: true,
    showMLM: true,
    showPaymentMethods: true,
    showVideoSection: true,
    showFAQ: true,
    showCTA: true,
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
    paymentMethodsTitle: "Supported Payment Partners",
    paymentMethodsDesc: "We support a variety of secure payment gateways for your convenience.",
    paymentMethodsDisplayType: 'static',
    paymentMethodsColorStyle: 'color',
    ctaTitle: "Ready to Start Your Journey?",
    ctaDesc: "Join a community of forward-thinkers. Sign up today and unlock your earning potential."
};

const initialState: AppState = {
    users: [],
    deposits: [],
    withdrawals: [],
    transfers: [],
    paymentMethods: [],
    investmentPlans: [],
    transactions: [],
    rules: [],
    tasks: [],
    userTasks: [],
    userTaskSubmissions: [],
    settings: {
        isUserTransferEnabled: true,
        isTasksEnabled: true,
        transferConfig: {
            enabled: true,
            tiers: [],
            allowCrossCurrency: false
        },
        exchangeRates: {
            USD: 1,
            EUR: 0.92,
            PKR: 278.00,
        },
        restrictWithdrawalAmount: false,
        restrictDepositAmount: false,
        requirePlanMatchForCommission: false,
        requireActivePlanForCommission: false,
        oneTimeCommissionPerGroup: false,
        showRejectedCommissionTransaction: true,
        notifySponsorOnCommissionLimit: true,
        recurringCommissionConfigs: [],
        requireUplineEligibility: false,
        withdrawalFrequency: {
            enabled: false,
            value: 1,
            unit: 'days'
        },
        planSortType: 'price-asc',
        manualPlanOrder: [],
        tickerSpeed: 6,
        tickerContentSource: 'hybrid',
        tickerRealActivities: { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true },
        tickerDemoAmountRanges: {
            USD: { min: 50, max: 500 },
            EUR: { min: 50, max: 500 },
            PKR: { min: 5000, max: 50000 },
        },
        demoProfiles: [],
        homepageVideoUrl: '',
        homepageContent: defaultHomepageContent,
        featuredPlanIds: [],
        faqs: [],
        homepagePaymentLogos: [],
        isInitialPageLoaderEnabled: false,
        hubEnabled: true,
        hubMinDeposit: 5,
        hubMaxDeposit: 1000,
        hubMinWithdrawal: 1,
        hubMaxWithdrawal: 1000,
        hubAccessMode: 'all',
        hubAllowedUserIds: [],
        hubAllowedPlanIds: [],
        hubDepositMethods: [],
    },
    notifications: [],
    logs: [],
    passwordResetRequests: [],
    disputes: [],
    currentUser: null,
    isLoading: false,
    isSyncing: true,
    isTasksLoading: true,
};

type Action =
    | { type: 'SET_ALL_DATA'; payload: Partial<AppState> }
    | { type: 'SET_USERS'; payload: User[] }
    | { type: 'ADD_USER'; payload: User }
    | { type: 'UPDATE_USER'; payload: User }
    | { type: 'DELETE_USER'; payload: string }
    | { type: 'SET_DEPOSITS'; payload: Deposit[] }
    | { type: 'ADD_DEPOSIT'; payload: Deposit }
    | { type: 'UPDATE_DEPOSIT'; payload: Deposit }
    | { type: 'SET_WITHDRAWALS'; payload: Withdrawal[] }
    | { type: 'ADD_WITHDRAWAL'; payload: Withdrawal }
    | { type: 'UPDATE_WITHDRAWAL'; payload: Withdrawal }
    | { type: 'SET_PAYMENT_METHODS'; payload: PaymentMethod[] }
    | { type: 'ADD_PAYMENT_METHOD'; payload: PaymentMethod }
    | { type: 'UPDATE_PAYMENT_METHOD'; payload: PaymentMethod }
    | { type: 'DELETE_PAYMENT_METHOD'; payload: string }
    | { type: 'SET_INVESTMENT_PLANS'; payload: InvestmentPlan[] }
    | { type: 'ADD_INVESTMENT_PLAN'; payload: InvestmentPlan }
    | { type: 'UPDATE_INVESTMENT_PLAN'; payload: InvestmentPlan }
    | { type: 'DELETE_INVESTMENT_PLAN'; payload: string }
    | { type: 'SET_RULES'; payload: Rule[] }
    | { type: 'ADD_RULE'; payload: Rule }
    | { type: 'DELETE_RULE'; payload: string }
    | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
    | { type: 'ADD_TRANSACTION'; payload: Transaction }
    | { type: 'SET_SETTINGS', payload: Settings }
    | { type: 'UPDATE_SETTINGS', payload: Settings }
    | { type: 'SET_TRANSFERS'; payload: Transfer[] }
    | { type: 'ADD_TRANSFER'; payload: Transfer }
    | { type: 'UPDATE_TRANSFER'; payload: Transfer }
    | { type: 'SET_LOGS'; payload: Log[] }
    | { type: 'ADD_LOG'; payload: Log }
    | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'ADD_NOTIFICATION'; payload: Notification }
    | { type: 'UPDATE_NOTIFICATION'; payload: Notification }
    | { type: 'UPDATE_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'MARK_NOTIFICATIONS_AS_READ'; payload: Notification[] }
    | { type: 'DELETE_NOTIFICATIONS'; payload: string[] }
    | { type: 'SET_PASSWORD_RESET_REQUESTS'; payload: PasswordResetRequest[] }
    | { type: 'UPDATE_PASSWORD_RESET_REQUEST'; payload: PasswordResetRequest }
    | { type: 'DELETE_PASSWORD_RESET_REQUEST'; payload: string }
    | { type: 'SET_DISPUTES'; payload: Dispute[] }
    | { type: 'ADD_DISPUTE'; payload: Dispute }
    | { type: 'UPDATE_DISPUTE'; payload: Dispute }
    | { type: 'SET_TASKS'; payload: Task[] }
    | { type: 'ADD_TASK'; payload: Task }
    | { type: 'UPDATE_TASK'; payload: Task }
    | { type: 'DELETE_TASK'; payload: string }
    | { type: 'SET_USER_TASKS'; payload: UserTask[] }
    | { type: 'ADD_USER_TASK'; payload: UserTask }
    | { type: 'UPDATE_USER_TASK'; payload: UserTask }
    | { type: 'DELETE_USER_TASK'; payload: string }
    | { type: 'SET_USER_TASK_SUBMISSIONS'; payload: UserTaskSubmission[] }
    | { type: 'ADD_USER_TASK_SUBMISSION'; payload: UserTaskSubmission }
    | { type: 'UPDATE_USER_TASK_SUBMISSION'; payload: UserTaskSubmission }
    | { type: 'DELETE_USER_TASK_SUBMISSION'; payload: string }
    | { type: 'SET_CURRENT_USER'; payload: { user: User | null; token?: string } }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_IS_SYNCING'; payload: boolean }
    | { type: 'SET_IS_TASKS_LOADING'; payload: boolean };


export type SyncDatasetKey =
    | 'currentUser'
    | 'users'
    | 'deposits'
    | 'withdrawals'
    | 'transactions'
    | 'notifications'
    | 'paymentMethods'
    | 'investmentPlans'
    | 'rules'
    | 'settings'
    | 'transfers'
    | 'logs'
    | 'passwordResetRequests'
    | 'disputes'
    | 'tasks'
    | 'userTasks'
    | 'userTaskSubmissions';

export const isAdminSyncRole = (role?: string | null): boolean => {
    const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
    return normalized === 'admin' || normalized === 'super_admin';
};

export const isRetryableSyncError = (err: unknown): boolean => {
    if (!err) return true;
    if (typeof err === 'object' && err !== null) {
        const anyErr = err as { name?: string; status?: number; message?: string };
        if (anyErr.name === 'AbortError') return false;
        if (typeof anyErr.status === 'number') {
            if (anyErr.status >= 400 && anyErr.status < 500) {
                return false;
            }
            return anyErr.status >= 500 || anyErr.status === 0;
        }
        if (typeof anyErr.message === 'string') {
            if (/access denied|unauthorized|forbidden|\b401\b|\b403\b/i.test(anyErr.message)) {
                return false;
            }
        }
    }
    return true;
};

export const getAuthorizedSyncDatasets = (role?: string | null): SyncDatasetKey[] => {
    const common: SyncDatasetKey[] = [
        'settings',
        'notifications',
        'deposits',
        'withdrawals',
        'transactions',
        'paymentMethods',
        'investmentPlans',
        'rules',
        'transfers',
        'disputes',
        'tasks',
        'userTasks',
        'userTaskSubmissions'
    ];
    if (isAdminSyncRole(role)) {
        return ['users', 'logs', 'passwordResetRequests', ...common];
    }
    return ['currentUser', ...common];
};

const DATASET_SET_ACTION_MAP: Partial<Record<SyncDatasetKey, Action['type']>> = {
    users: 'SET_USERS',
    deposits: 'SET_DEPOSITS',
    withdrawals: 'SET_WITHDRAWALS',
    transactions: 'SET_TRANSACTIONS',
    notifications: 'SET_NOTIFICATIONS',
    paymentMethods: 'SET_PAYMENT_METHODS',
    investmentPlans: 'SET_INVESTMENT_PLANS',
    rules: 'SET_RULES',
    settings: 'SET_SETTINGS',
    transfers: 'SET_TRANSFERS',
    logs: 'SET_LOGS',
    passwordResetRequests: 'SET_PASSWORD_RESET_REQUESTS',
    disputes: 'SET_DISPUTES',
    tasks: 'SET_TASKS',
    userTasks: 'SET_USER_TASKS',
    userTaskSubmissions: 'SET_USER_TASK_SUBMISSIONS'
};

export const dataReducer = (state: AppState, action: Action): AppState => {
    const sanitizeSettings = (settings: Settings) => {
        if (!settings) return state.settings;
        const newSettings = { ...(state.settings || {}), ...settings };
        if (newSettings.exchangeRates && (newSettings.exchangeRates.PKR === 1 || !newSettings.exchangeRates.PKR)) {
            newSettings.exchangeRates.PKR = 278.00;
        }
        if (newSettings.exchangeRates && !newSettings.exchangeRates.EUR) newSettings.exchangeRates.EUR = 0.92;
        if (newSettings.exchangeRates && !newSettings.exchangeRates.USD) newSettings.exchangeRates.USD = 1;
        if (newSettings.isTasksEnabled === undefined) newSettings.isTasksEnabled = true;
        if (newSettings.showRejectedCommissionTransaction === undefined) newSettings.showRejectedCommissionTransaction = true;
        if (newSettings.notifySponsorOnCommissionLimit === undefined) newSettings.notifySponsorOnCommissionLimit = true;
        if (newSettings.restrictDepositAmount === undefined) newSettings.restrictDepositAmount = false;
        if (newSettings.faqs === undefined) newSettings.faqs = [];
        if (newSettings.homepagePaymentLogos === undefined) newSettings.homepagePaymentLogos = [];
        if (newSettings.isInitialPageLoaderEnabled === undefined) newSettings.isInitialPageLoaderEnabled = false;
        if (newSettings.hubEnabled === undefined) newSettings.hubEnabled = true;
        if (newSettings.hubMinDeposit === undefined) newSettings.hubMinDeposit = 5;
        if (newSettings.hubMaxDeposit === undefined) newSettings.hubMaxDeposit = 1000;
        if (newSettings.hubMinWithdrawal === undefined) newSettings.hubMinWithdrawal = 1;
        if (newSettings.hubMaxWithdrawal === undefined) newSettings.hubMaxWithdrawal = 1000;
        if (newSettings.hubAccessMode === undefined) newSettings.hubAccessMode = 'all';
        if (newSettings.hubAllowedUserIds === undefined) newSettings.hubAllowedUserIds = [];
        if (newSettings.hubAllowedPlanIds === undefined) newSettings.hubAllowedPlanIds = [];
        if (newSettings.hubDepositMethods === undefined) newSettings.hubDepositMethods = [];
        return newSettings;
    };

    let newState: AppState;

    switch (action.type) {
        case 'SET_ALL_DATA': {
            if (!action.payload) return state;
            const sanitizedPayload = { ...action.payload };
            if (sanitizedPayload.settings) {
                sanitizedPayload.settings = sanitizeSettings(sanitizedPayload.settings);
            }
            let updatedCurrentUser = state.currentUser;
            if (updatedCurrentUser && Array.isArray(sanitizedPayload.users)) {
                const freshUser = sanitizedPayload.users.find((u: any) => String(u._id) === String(updatedCurrentUser?._id));
                if (freshUser) {
                    updatedCurrentUser = freshUser;
                    try { localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser)); } catch (e) {}
                }
            }
            newState = { ...state, ...sanitizedPayload, currentUser: updatedCurrentUser };
            break;
        }

        case 'SET_CURRENT_USER': {
            const user = action.payload && typeof action.payload === 'object' && 'user' in action.payload ? (action.payload as any).user : action.payload;
            const token = action.payload && typeof action.payload === 'object' && 'token' in action.payload ? (action.payload as any).token : undefined;
            const prevUserId = state.currentUser?._id ? String(state.currentUser._id) : null;
            const nextUserId = user?._id ? String(user._id) : null;
            const isAccountChanged = prevUserId !== nextUserId;

            try {
                if (user) {
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    if (token) {
                        localStorage.setItem('authToken', token);
                    }
                } else {
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('app_cache');
                }
            } catch (error: any) {
                console.error("Could not access localStorage:", error.message);
            }

            if (!user || isAccountChanged) {
                newState = {
                    ...state,
                    users: [],
                    deposits: [],
                    withdrawals: [],
                    transfers: [],
                    paymentMethods: [],
                    rules: [],
                    transactions: [],
                    notifications: [],
                    logs: [],
                    passwordResetRequests: [],
                    disputes: [],
                    tasks: [],
                    userTasks: [],
                    userTaskSubmissions: [],
                    currentUser: user || null,
                    isSyncing: Boolean(user),
                    isTasksLoading: Boolean(user),
                };
            } else {
                newState = { ...state, currentUser: user || null };
            }
            break;
        }

        case 'SET_USERS': {
            const usersList = action.payload || [];
            let updatedCurrentUser = state.currentUser;
            if (updatedCurrentUser && Array.isArray(usersList)) {
                const freshUser = usersList.find((u: any) => String(u._id) === String(updatedCurrentUser?._id));
                if (freshUser) {
                    updatedCurrentUser = freshUser;
                    try { localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser)); } catch (e) {}
                }
            }
            newState = { ...state, users: usersList, currentUser: updatedCurrentUser };
            break;
        }
        case 'ADD_USER': newState = { ...state, users: [action.payload, ...state.users.filter(u => String(u._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_USER': {
            if (!action.payload) return state;
            const updatedUsers = state.users.map(u => String(u._id) === String(action.payload._id) ? { ...u, ...action.payload } : u);
            let updatedCurrentUser = state.currentUser;
            if (state.currentUser && String(state.currentUser._id) === String(action.payload._id)) {
                updatedCurrentUser = { ...state.currentUser, ...action.payload };
                try { localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser)); } catch (e) {}
            }
            newState = { ...state, users: updatedUsers, currentUser: updatedCurrentUser };
            break;
        }
        case 'DELETE_USER': newState = { ...state, users: state.users.filter(u => String(u._id) !== String(action.payload)) }; break;

        case 'SET_DEPOSITS': newState = { ...state, deposits: action.payload || [] }; break;
        case 'ADD_DEPOSIT': newState = { ...state, deposits: [action.payload, ...state.deposits.filter(d => String(d._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_DEPOSIT': newState = { ...state, deposits: state.deposits.map(d => String(d._id) === String(action.payload._id) ? action.payload : d) }; break;

        case 'SET_WITHDRAWALS': newState = { ...state, withdrawals: action.payload || [] }; break;
        case 'ADD_WITHDRAWAL': newState = { ...state, withdrawals: [action.payload, ...state.withdrawals.filter(w => String(w._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_WITHDRAWAL': newState = { ...state, withdrawals: state.withdrawals.map(w => String(w._id) === String(action.payload._id) ? action.payload : w) }; break;

        case 'SET_PAYMENT_METHODS': newState = { ...state, paymentMethods: action.payload || [] }; break;
        case 'ADD_PAYMENT_METHOD': newState = { ...state, paymentMethods: [action.payload, ...state.paymentMethods.filter(p => String(p._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_PAYMENT_METHOD': newState = { ...state, paymentMethods: state.paymentMethods.map(p => String(p._id) === String(action.payload._id) ? action.payload : p) }; break;
        case 'DELETE_PAYMENT_METHOD': newState = { ...state, paymentMethods: state.paymentMethods.filter(p => String(p._id) !== String(action.payload)) }; break;

        case 'SET_INVESTMENT_PLANS': newState = { ...state, investmentPlans: action.payload || [] }; break;
        case 'ADD_INVESTMENT_PLAN': newState = { ...state, investmentPlans: [action.payload, ...state.investmentPlans.filter(p => String(p._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_INVESTMENT_PLAN': newState = { ...state, investmentPlans: state.investmentPlans.map(p => String(p._id) === String(action.payload._id) ? action.payload : p) }; break;
        case 'DELETE_INVESTMENT_PLAN': newState = { ...state, investmentPlans: state.investmentPlans.filter(p => String(p._id) !== String(action.payload)) }; break;

        case 'SET_RULES': newState = { ...state, rules: action.payload || [] }; break;
        case 'ADD_RULE': newState = { ...state, rules: [action.payload, ...state.rules.filter(r => String(r._id) !== String(action.payload._id))] }; break;
        case 'DELETE_RULE': newState = { ...state, rules: state.rules.filter(r => String(r._id) !== String(action.payload)) }; break;
        
        case 'SET_TRANSFERS': newState = { ...state, transfers: action.payload || [] }; break;
        case 'ADD_TRANSFER': newState = { ...state, transfers: [action.payload, ...state.transfers.filter(t => String(t._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_TRANSFER': newState = { ...state, transfers: state.transfers.map(t => String(t._id) === String(action.payload._id) ? action.payload : t) }; break;

        case 'SET_TRANSACTIONS': newState = { ...state, transactions: action.payload || [] }; break;
        case 'ADD_TRANSACTION': newState = { ...state, transactions: [action.payload, ...state.transactions.filter(t => String(t._id) !== String(action.payload._id))] }; break;

        case 'SET_SETTINGS': newState = { ...state, settings: sanitizeSettings(action.payload) }; break;
        case 'UPDATE_SETTINGS': newState = { ...state, settings: sanitizeSettings(action.payload) }; break;

        case 'SET_LOGS': newState = { ...state, logs: action.payload || [] }; break;
        case 'ADD_LOG': newState = { ...state, logs: [action.payload, ...state.logs.filter(l => String(l._id) !== String(action.payload._id))] }; break;

        case 'SET_NOTIFICATIONS': newState = { ...state, notifications: action.payload || [] }; break;
        case 'ADD_NOTIFICATION': newState = { ...state, notifications: [action.payload, ...state.notifications.filter(n => String(n._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_NOTIFICATION':
            newState = { ...state, notifications: state.notifications.map(n => String(n._id) === String(action.payload._id) ? action.payload : n) };
            break;
        case 'UPDATE_NOTIFICATIONS':
            newState = { ...state, notifications: [...(action.payload || []), ...state.notifications] };
            break;
        case 'MARK_NOTIFICATIONS_AS_READ': newState = { ...state, notifications: action.payload || [] }; break;
        case 'DELETE_NOTIFICATIONS':
            newState = { ...state, notifications: state.notifications.filter(n => !(action.payload || []).map(id => String(id)).includes(String(n._id))) };
            break;

        case 'SET_PASSWORD_RESET_REQUESTS':
            newState = { ...state, passwordResetRequests: action.payload || [] };
            break;
        case 'UPDATE_PASSWORD_RESET_REQUEST':
            newState = { ...state, passwordResetRequests: state.passwordResetRequests.map(req => String(req._id) === String(action.payload._id) ? action.payload : req) };
            break;
        case 'DELETE_PASSWORD_RESET_REQUEST':
            newState = { ...state, passwordResetRequests: state.passwordResetRequests.filter(req => String(req._id) !== String(action.payload)) };
            break;

        case 'SET_DISPUTES': newState = { ...state, disputes: action.payload || [] }; break;
        case 'ADD_DISPUTE': newState = { ...state, disputes: [action.payload, ...state.disputes.filter(d => String(d._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_DISPUTE': newState = { ...state, disputes: state.disputes.map(d => String(d._id) === String(action.payload._id) ? action.payload : d) }; break;

        case 'SET_TASKS': newState = { ...state, tasks: action.payload || [] }; break;
        case 'ADD_TASK': newState = { ...state, tasks: [action.payload, ...state.tasks.filter(t => String(t._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_TASK': newState = { ...state, tasks: state.tasks.map(t => String(t._id) === String(action.payload._id) ? action.payload : t) }; break;
        case 'DELETE_TASK': newState = { ...state, tasks: state.tasks.filter(t => String(t._id) !== String(action.payload)) }; break;

        case 'SET_USER_TASKS': newState = { ...state, userTasks: action.payload || [] }; break;
        case 'ADD_USER_TASK': newState = { ...state, userTasks: [action.payload, ...state.userTasks.filter(t => String(t._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_USER_TASK': newState = { ...state, userTasks: state.userTasks.map(t => String(t._id) === String(action.payload._id) ? action.payload : t) }; break;
        case 'DELETE_USER_TASK': newState = { ...state, userTasks: state.userTasks.filter(t => String(t._id) !== String(action.payload)) }; break;

        case 'SET_USER_TASK_SUBMISSIONS': newState = { ...state, userTaskSubmissions: action.payload || [] }; break;
        case 'ADD_USER_TASK_SUBMISSION': newState = { ...state, userTaskSubmissions: [action.payload, ...state.userTaskSubmissions.filter(s => String(s._id) !== String(action.payload._id))] }; break;
        case 'UPDATE_USER_TASK_SUBMISSION': newState = { ...state, userTaskSubmissions: state.userTaskSubmissions.map(s => String(s._id) === String(action.payload._id) ? action.payload : s) }; break;
        case 'DELETE_USER_TASK_SUBMISSION': newState = { ...state, userTaskSubmissions: state.userTaskSubmissions.filter(s => String(s._id) !== String(action.payload)) }; break;

        case 'SET_LOADING':
            newState = { ...state, isLoading: action.payload };
            break;
        case 'SET_IS_SYNCING':
            newState = { ...state, isSyncing: action.payload };
            break;
        case 'SET_IS_TASKS_LOADING':
            newState = { ...state, isTasksLoading: action.payload };
            break;

        default:
            return state;
    }

    // --- OPTIMIZED CACHE PERSISTENCE ---
    // We only persist essential session info and settings.
    // Large arrays (users, transactions, logs) are NOT cached to prevent QuotaExceededError.
    try {
        const cacheData = {
            currentUser: newState.currentUser,
            settings: newState.settings
        };
        localStorage.setItem('app_cache', JSON.stringify(cacheData));
    } catch (e) {
        // Silently swallow storage errors to prevent UI crashes if local storage is full
        console.warn("Storage quota exceeded or restricted. Persistent settings may not be updated.");
    }

    return newState;
};

export const DataContext = createContext<{ 
    state: AppState; 
    dispatch: React.Dispatch<Action>;
    refreshSettings: () => Promise<Settings | null>;
    refreshData: (force?: boolean) => Promise<void>;
}>({
    state: initialState,
    dispatch: () => null,
    refreshSettings: async () => null,
    refreshData: async () => {},
});

const initializer = (initialState: AppState) => {
    try {
        const savedUser = localStorage.getItem('currentUser');
        const appCache = localStorage.getItem('app_cache');
        
        let initialData = { ...initialState };
        
        if (appCache && appCache !== 'undefined' && appCache !== 'null') {
            try {
                const parsedCache = JSON.parse(appCache);
                if (parsedCache) {
                    // Safe merge of cached settings and user info
                    initialData = { ...initialData, ...parsedCache };
                }
            } catch (e) {
                console.warn("Invalid app cache structure");
            }
        }

        if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser) {
                initialData.currentUser = parsedUser;
            }
        }

        const hasToken = typeof localStorage !== 'undefined' ? Boolean(localStorage.getItem('authToken')) : false;
        const hasAuthSession = Boolean(initialData.currentUser && hasToken);
        initialData.isSyncing = hasAuthSession;
        initialData.isTasksLoading = hasAuthSession;

        return initialData;
    } catch (error) {
        console.error("Could not parse data from localStorage", error);
    }
    return { ...initialState, isSyncing: false, isTasksLoading: false };
};

export interface SyncApiAdapters {
    getDataVersion: () => Promise<number | null>;
    getUser: (id: string) => Promise<User | null>;
    getUsers: () => Promise<User[]>;
    getDeposits: () => Promise<Deposit[]>;
    getWithdrawals: () => Promise<Withdrawal[]>;
    getTransactions: () => Promise<Transaction[]>;
    getNotifications: () => Promise<Notification[]>;
    getPaymentMethods: () => Promise<PaymentMethod[]>;
    getInvestmentPlans: () => Promise<InvestmentPlan[]>;
    getRules: () => Promise<Rule[]>;
    getSettings: () => Promise<Settings>;
    getTransfers: () => Promise<Transfer[]>;
    getLogs: () => Promise<Log[]>;
    getPasswordResetRequests: () => Promise<PasswordResetRequest[]>;
    getDisputes: () => Promise<Dispute[]>;
    getTasks: () => Promise<Task[]>;
    getUserTasks: () => Promise<UserTask[]>;
    getUserTaskSubmissions: () => Promise<UserTaskSubmission[]>;
}

const defaultSyncApiAdapters: SyncApiAdapters = {
    getDataVersion,
    getUser,
    getUsers,
    getDeposits,
    getWithdrawals,
    getTransactions,
    getNotifications,
    getPaymentMethods,
    getInvestmentPlans,
    getRules,
    getSettings,
    getTransfers,
    getLogs,
    getPasswordResetRequests,
    getDisputes,
    getTasks,
    getUserTasks,
    getUserTaskSubmissions,
};

export interface SyncRuntimeRefs {
    lastVersionRef: { current: number };
    hasCompletedAuthSyncRef: { current: boolean };
    isSyncingRef: { current: boolean };
    activeSyncPromiseRef: { current: Promise<void> | null };
    pendingForceRef: { current: boolean };
    syncSessionEpochRef: { current: number };
    activeUserIdRef: { current: string | null };
    datasetSeqRef: { current: Partial<Record<SyncDatasetKey, number>> };
    retryTimersRef: { current: Map<SyncDatasetKey, ReturnType<typeof setTimeout>> };
}

export interface ExecuteSyncPassOptions {
    force?: boolean;
    userId: string;
    role?: string | null;
    refs: SyncRuntimeRefs;
    dispatch: React.Dispatch<Action>;
    api?: SyncApiAdapters;
    isMounted?: () => boolean;
    hasAuthToken?: () => boolean;
    maxRetries?: number;
    retryBaseDelayMs?: number;
}

const fetchDatasetByKey = async (key: SyncDatasetKey, userId: string, api: SyncApiAdapters): Promise<any> => {
    switch (key) {
        case 'currentUser': return api.getUser(userId);
        case 'users': return api.getUsers();
        case 'deposits': return api.getDeposits();
        case 'withdrawals': return api.getWithdrawals();
        case 'transactions': return api.getTransactions();
        case 'notifications': return api.getNotifications();
        case 'paymentMethods': return api.getPaymentMethods();
        case 'investmentPlans': return api.getInvestmentPlans();
        case 'rules': return api.getRules();
        case 'settings': return api.getSettings();
        case 'transfers': return api.getTransfers();
        case 'logs': return api.getLogs();
        case 'passwordResetRequests': return api.getPasswordResetRequests();
        case 'disputes': return api.getDisputes();
        case 'tasks': return api.getTasks();
        case 'userTasks': return api.getUserTasks();
        case 'userTaskSubmissions': return api.getUserTaskSubmissions();
    }
};

export const executeMasterDataSyncPass = async ({
    force = false,
    userId,
    role,
    refs,
    dispatch,
    api = defaultSyncApiAdapters,
    isMounted = () => true,
    hasAuthToken = () => typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('authToken')),
    maxRetries = 3,
    retryBaseDelayMs = 1000
}: ExecuteSyncPassOptions): Promise<void> => {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId || !hasAuthToken()) {
        refs.isSyncingRef.current = false;
        dispatch({ type: 'SET_IS_SYNCING', payload: false });
        return;
    }

    const runSessionEpoch = refs.syncSessionEpochRef.current;

    const isRunValid = (): boolean => {
        return (
            isMounted() &&
            refs.syncSessionEpochRef.current === runSessionEpoch &&
            refs.activeUserIdRef.current === normalizedUserId &&
            hasAuthToken()
        );
    };

    if (!isRunValid()) {
        return;
    }

    if (force) {
        refs.pendingForceRef.current = true;
    }

    if (refs.activeSyncPromiseRef.current) {
        try {
            await refs.activeSyncPromiseRef.current;
        } catch (e) {}
        if (!isRunValid()) return;
        if (refs.pendingForceRef.current && !refs.activeSyncPromiseRef.current) {
            return executeMasterDataSyncPass({
                force: false,
                userId: normalizedUserId,
                role,
                refs,
                dispatch,
                api,
                isMounted,
                hasAuthToken,
                maxRetries,
                retryBaseDelayMs
            });
        }
        return refs.activeSyncPromiseRef.current || Promise.resolve();
    }

    const syncPromise = (async () => {
        refs.isSyncingRef.current = true;
        dispatch({ type: 'SET_IS_SYNCING', payload: true });

        try {
            const doForce = refs.pendingForceRef.current;
            refs.pendingForceRef.current = false;

            const isInitialSync = !refs.hasCompletedAuthSyncRef.current;
            let serverVersion: number | null = null;
            try {
                serverVersion = await api.getDataVersion();
            } catch {
                serverVersion = null;
            }

            if (!isRunValid()) {
                return;
            }

            let verifiedServerVersion: number | null = null;
            if (serverVersion === null) {
                // Version endpoint unavailable:
                // Passive checks skip safely without fabricating a version; initial or forced syncs continue.
                if (!doForce && !isInitialSync) {
                    return;
                }
            } else {
                if (!doForce && !isInitialSync && serverVersion <= refs.lastVersionRef.current) {
                    return;
                }
                verifiedServerVersion = serverVersion;
            }

            const datasetKeys = getAuthorizedSyncDatasets(role);
            const failedKeys = new Set<SyncDatasetKey>();
            let initialPassFinished = false;
            let tasksSettled = !datasetKeys.includes('tasks');
            let userTasksSettled = !datasetKeys.includes('userTasks');

            const maybeCompleteTasksLoading = () => {
                if (isInitialSync && tasksSettled && userTasksSettled && isRunValid()) {
                    dispatch({ type: 'SET_IS_TASKS_LOADING', payload: false });
                }
            };

            const runDatasetAttempt = async (key: SyncDatasetKey, seq: number, attempt: number): Promise<void> => {
                if (!isRunValid() || refs.datasetSeqRef.current[key] !== seq) {
                    return;
                }

                try {
                    const data = await fetchDatasetByKey(key, normalizedUserId, api);
                    if (!isRunValid() || refs.datasetSeqRef.current[key] !== seq) {
                        return;
                    }

                    if (key === 'currentUser') {
                        if (data && data._id && String(data._id) === normalizedUserId) {
                            dispatch({ type: 'UPDATE_USER', payload: data });
                        }
                    } else {
                        const actionType = DATASET_SET_ACTION_MAP[key];
                        if (actionType) {
                            dispatch({ type: actionType, payload: data } as Action);
                        }
                    }

                    failedKeys.delete(key);
                    if (initialPassFinished && failedKeys.size === 0 && verifiedServerVersion !== null && isRunValid()) {
                        refs.lastVersionRef.current = Math.max(refs.lastVersionRef.current, verifiedServerVersion);
                    }
                } catch (err) {
                    if (!isRunValid() || refs.datasetSeqRef.current[key] !== seq) {
                        return;
                    }

                    failedKeys.add(key);

                    if (isRetryableSyncError(err) && attempt < maxRetries) {
                        const existingTimer = refs.retryTimersRef.current.get(key);
                        if (existingTimer) {
                            clearTimeout(existingTimer);
                        }
                        const delay = Math.pow(2, attempt) * retryBaseDelayMs;
                        const timer = setTimeout(() => {
                            refs.retryTimersRef.current.delete(key);
                            if (!isRunValid() || refs.datasetSeqRef.current[key] !== seq) {
                                return;
                            }
                            void runDatasetAttempt(key, seq, attempt + 1);
                        }, delay);
                        refs.retryTimersRef.current.set(key, timer);
                    } else {
                        console.warn(`Sync dataset "${key}" failed without retry:`, err);
                    }
                } finally {
                    if (attempt === 0) {
                        if (key === 'tasks') {
                            tasksSettled = true;
                            maybeCompleteTasksLoading();
                        } else if (key === 'userTasks') {
                            userTasksSettled = true;
                            maybeCompleteTasksLoading();
                        }
                    }
                }
            };

            const initialPromises = datasetKeys.map(key => {
                const pendingTimer = refs.retryTimersRef.current.get(key);
                if (pendingTimer) {
                    clearTimeout(pendingTimer);
                    refs.retryTimersRef.current.delete(key);
                }
                const nextSeq = (refs.datasetSeqRef.current[key] || 0) + 1;
                refs.datasetSeqRef.current[key] = nextSeq;
                return runDatasetAttempt(key, nextSeq, 0);
            });

            await Promise.allSettled(initialPromises);
            initialPassFinished = true;

            if (!isRunValid()) {
                return;
            }

            refs.hasCompletedAuthSyncRef.current = true;
            if (isInitialSync) {
                tasksSettled = true;
                userTasksSettled = true;
                maybeCompleteTasksLoading();
            }

            if (failedKeys.size === 0 && verifiedServerVersion !== null) {
                refs.lastVersionRef.current = Math.max(refs.lastVersionRef.current, verifiedServerVersion);
            }
        } catch (err) {
            console.error("Flicker-free live sync payload retrieval failed:", err);
        } finally {
            if (refs.syncSessionEpochRef.current === runSessionEpoch) {
                refs.isSyncingRef.current = false;
                dispatch({ type: 'SET_IS_SYNCING', payload: false });
                if (refs.activeSyncPromiseRef.current === syncPromise) {
                    refs.activeSyncPromiseRef.current = null;
                }
            }
        }
    })();

    refs.activeSyncPromiseRef.current = syncPromise;
    await syncPromise;

    if (refs.pendingForceRef.current && isRunValid() && !refs.activeSyncPromiseRef.current) {
        return executeMasterDataSyncPass({
            force: false,
            userId: normalizedUserId,
            role,
            refs,
            dispatch,
            api,
            isMounted,
            hasAuthToken,
            maxRetries,
            retryBaseDelayMs
        });
    }
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState, initializer);
    const lastVersionRef = useRef<number>(0);
    const hasCompletedAuthSyncRef = useRef<boolean>(false);
    const isSyncingRef = useRef<boolean>(false);
    const stateRef = useRef<AppState>(state);
    const isMountedRef = useRef<boolean>(true);
    const activeSyncPromiseRef = useRef<Promise<void> | null>(null);
    const pendingForceRef = useRef<boolean>(false);
    const syncSessionEpochRef = useRef<number>(0);
    const currentUserId = state.currentUser?._id ? String(state.currentUser._id) : null;
    const activeUserIdRef = useRef<string | null>(currentUserId);
    const datasetSeqRef = useRef<Partial<Record<SyncDatasetKey, number>>>({});
    const retryTimersRef = useRef<Map<SyncDatasetKey, ReturnType<typeof setTimeout>>>(new Map());

    const clearAllRetryTimers = useCallback(() => {
        retryTimersRef.current.forEach(timer => clearTimeout(timer));
        retryTimersRef.current.clear();
    }, []);

    // Synchronously invalidate prior account session refs on logout or account switch
    if (activeUserIdRef.current !== currentUserId) {
        activeUserIdRef.current = currentUserId;
        syncSessionEpochRef.current += 1;
        hasCompletedAuthSyncRef.current = false;
        lastVersionRef.current = 0;
        pendingForceRef.current = false;
        activeSyncPromiseRef.current = null;
        datasetSeqRef.current = {};
        clearAllRetryTimers();
    }

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            syncSessionEpochRef.current += 1;
            clearAllRetryTimers();
        };
    }, [clearAllRetryTimers]);

    const masterDataSync = useCallback(async (force: boolean = false): Promise<void> => {
        const currentUser = stateRef.current.currentUser;
        if (!currentUser?._id) {
            isSyncingRef.current = false;
            dispatch({ type: 'SET_IS_SYNCING', payload: false });
            return;
        }
        return executeMasterDataSyncPass({
            force,
            userId: String(currentUser._id),
            role: currentUser.role,
            refs: {
                lastVersionRef,
                hasCompletedAuthSyncRef,
                isSyncingRef,
                activeSyncPromiseRef,
                pendingForceRef,
                syncSessionEpochRef,
                activeUserIdRef,
                datasetSeqRef,
                retryTimersRef
            },
            dispatch,
            isMounted: () => isMountedRef.current
        });
    }, []);

    const masterDataSyncRef = useRef<(force?: boolean) => Promise<void>>(masterDataSync);
    masterDataSyncRef.current = masterDataSync;

    const refreshSettings = async (): Promise<Settings | null> => {
        try {
            const fresh = await getSettings();
            if (fresh) {
                dispatch({ type: 'UPDATE_SETTINGS', payload: fresh });
                return fresh;
            }
        } catch (err) {
            console.warn("Failed to manually refresh settings:", err);
        }
        return null;
    };

    const refreshData = async (force: boolean = true) => {
        if (masterDataSyncRef.current) {
            await masterDataSyncRef.current(force);
        }
    };

    // Fast Public Handshake + Immediate Authenticated Sync
    useEffect(() => {
        let isEffectActive = true;
        const effectSessionEpoch = syncSessionEpochRef.current;

        const executeInitialLoad = async () => {
            const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
            const isLoggedIn = Boolean(token && currentUserId);

            // Phase 1: Ultra-fast critical public handshake (< 3 KB) - never blocks render
            try {
                const publicSettings = await getPublicSettings();

                if (isEffectActive && syncSessionEpochRef.current === effectSessionEpoch && publicSettings) {
                    dispatch({
                        type: 'SET_SETTINGS',
                        payload: publicSettings as any
                    });
                }
            } catch (err) {
                console.warn("Public settings handshake error:", err);
            } finally {
                if (isEffectActive) {
                    dispatch({ type: 'SET_LOADING', payload: false });
                }
            }

            if (!isEffectActive || syncSessionEpochRef.current !== effectSessionEpoch) {
                return;
            }

            if (!isLoggedIn) {
                dispatch({ type: 'SET_IS_SYNCING', payload: false });
                dispatch({ type: 'SET_IS_TASKS_LOADING', payload: false });
                return;
            }

            // Start authenticated sync immediately after public settings complete (no idle/timer delay)
            try {
                await masterDataSyncRef.current(true);
            } catch (bgError) {
                console.warn("Authenticated data load error:", bgError);
            }
        };

        void executeInitialLoad();

        return () => {
            isEffectActive = false;
        };
    }, [currentUserId]);

    // --- REAL-TIME LIVE SYNCHRONIZATION WITH SOCKET.IO ---
    useEffect(() => {
        if (!state.currentUser) return;

        const getSocketUrl = () => {
            try {
                // @ts-ignore
                if (typeof process !== 'undefined' && process.env) {
                    // @ts-ignore
                    const envUrl = process.env.REACT_APP_API_URL || process.env.VITE_API_URL;
                    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
                        return envUrl.trim().replace(/\/+$/, '');
                    }
                }
                
                if (typeof window !== 'undefined' && window.location && window.location.origin) {
                    return window.location.origin;
                }
            } catch (e) {}
            return '';
        };

        const socketUrl = getSocketUrl();
        const token = localStorage.getItem('authToken');

        // Connect with automatic reconnection controls optimized for Render free tier sleep cycles
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 3000,
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log(`Socket syncer successfully connected to server: ${socketUrl}`);
        });

        // Listen for the master real-time trigger event
        socket.on('DATA_CHANGED', () => {
            console.log('Real-time notification: DATA_CHANGED event received. Syncing states...');
            masterDataSync(true);
        });

        socket.on('connect_error', (error) => {
            console.warn("Connection difficulty detected. Socket-client will auto-retry.", error.message);
        });

        // Sync active data when tab is focused or became visible (different tabs/returned users)
        // Throttled to prevent spamming the backend (at most once every 15 seconds)
        let lastTabReturnTime = 0;
        const handleTabReturn = () => {
            if (document.visibilityState === 'visible' || !document.hidden) {
                const now = Date.now();
                if (now - lastTabReturnTime > 15000) {
                    lastTabReturnTime = now;
                    console.log('User returned to tab. Checking server version for new updates...');
                    masterDataSync(false); // Checks version first! Highly optimized.
                }
            }
        };

        window.addEventListener('focus', handleTabReturn);
        document.addEventListener('visibilitychange', handleTabReturn);

        return () => {
            console.log('Cleaning up active socket connection and focus listeners...');
            socket.disconnect();
            window.removeEventListener('focus', handleTabReturn);
            document.removeEventListener('visibilitychange', handleTabReturn);
        };
    }, [state.currentUser?._id, masterDataSync]);

    // --- CROSS-TAB AUTOMATIC LOGOUT AFTER 10-12 MINUTES OF INACTIVITY ---
    useEffect(() => {
        if (!state.currentUser) return;

        // Set initial activity time when user session is active
        localStorage.setItem('lastActivityTime', Date.now().toString());

        let lastWrite = 0;
        const handleUserActivity = () => {
            const now = Date.now();
            // Throttle storage writes to avoid unnecessary overhead
            if (now - lastWrite > 1500) {
                lastWrite = now;
                localStorage.setItem('lastActivityTime', now.toString());
            }
        };

        const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        activityEvents.forEach(eventType => {
            window.addEventListener(eventType, handleUserActivity, { passive: true });
        });

        const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes of inactivity

        const checkInactivity = () => {
            const storedTime = localStorage.getItem('lastActivityTime');
            if (!storedTime) return;

            const elapsedSinceActivity = Date.now() - Number(storedTime);
            if (elapsedSinceActivity >= INACTIVITY_LIMIT) {
                console.log("Inactivity limit exceeded (10 minutes). Logging out...");
                localStorage.setItem('inactivityLogout', 'true');
                dispatch({ type: 'SET_CURRENT_USER', payload: { user: null } });
                if (window.location.pathname.startsWith('/member') || window.location.pathname.startsWith('/admin')) {
                    window.location.href = '/login';
                }
            }
        };

        // Check inactivity status every 5 seconds
        const checkInterval = setInterval(checkInactivity, 5000);

        return () => {
            activityEvents.forEach(eventType => {
                window.removeEventListener(eventType, handleUserActivity);
            });
            clearInterval(checkInterval);
        };
    }, [state.currentUser]);

    // --- CROSS-TAB AUTHENTICATION STATE SYNCHRONIZATION ---
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'currentUser' || e.key === 'authToken') {
                const updatedUser = localStorage.getItem('currentUser');
                const token = localStorage.getItem('authToken');
                
                if (!updatedUser || !token) {
                    // Session destroyed on another tab, align state & log out immediately
                    console.log("Authentication credentials removed on another tab. Synchronizing logout...");
                    dispatch({ type: 'SET_CURRENT_USER', payload: { user: null } });
                    if (window.location.pathname.startsWith('/member') || window.location.pathname.startsWith('/admin')) {
                        window.location.href = '/login';
                    }
                } else {
                    // Session created / updated on another tab, align state & resume
                    try {
                        const user = JSON.parse(updatedUser);
                        if (user && user._id !== state.currentUser?._id) {
                            console.log("Authentication credentials updated in another tab. Aligning session...");
                            dispatch({ type: 'SET_CURRENT_USER', payload: { user, token } });
                        }
                    } catch (err) {}
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [state.currentUser?._id]);

    return (
        <div id="data-state-container">
            <DataContext.Provider value={{ state, dispatch, refreshSettings, refreshData }}>
                {children}
            </DataContext.Provider>
        </div>
    );
};
