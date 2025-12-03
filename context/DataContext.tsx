
import React, { createContext, useReducer, ReactNode, useEffect } from 'react';
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Status, Transfer, Settings, Notification, Log, PasswordResetRequest, Dispute } from '../types';
import { 
    getUsers, getDeposits, getWithdrawals, getTransactions, getNotifications, getPaymentMethods, 
    getInvestmentPlans, getRules, getSettings, getTransfers, getLogs, getPasswordResetRequests, getDisputes 
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
    settings: Settings;
    notifications: Notification[];
    logs: Log[];
    passwordResetRequests: PasswordResetRequest[];
    disputes: Dispute[];
    currentUser: User | null;
}

const defaultHomepageContent = {
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
    settings: {
        isUserTransferEnabled: true,
        transferConfig: {
            enabled: true,
            tiers: []
        },
        exchangeRates: {
            USD: 278.50,
            EUR: 256.22,
            PKR: 1,
        },
        restrictWithdrawalAmount: false,
        requirePlanMatchForCommission: false,
        requireActivePlanForCommission: false,
        oneTimeCommissionPerGroup: false,
        requireUplineEligibility: false,
        withdrawalFrequency: {
            enabled: false,
            value: 1,
            unit: 'days'
        },
        tickerContentSource: 'hybrid',
        homepageVideoUrl: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1',
        homepageContent: defaultHomepageContent,
        featuredPlanIds: [],
    },
    notifications: [],
    logs: [],
    passwordResetRequests: [],
    disputes: [],
    currentUser: null,
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
    | { type: 'UPDATE_NOTIFICATIONS'; payload: Notification[] } // Batch update
    | { type: 'MARK_NOTIFICATIONS_AS_READ'; payload: Notification[] }
    | { type: 'SET_PASSWORD_RESET_REQUESTS'; payload: PasswordResetRequest[] }
    | { type: 'DELETE_PASSWORD_RESET_REQUEST'; payload: string }
    | { type: 'SET_DISPUTES'; payload: Dispute[] }
    | { type: 'ADD_DISPUTE'; payload: Dispute }
    | { type: 'UPDATE_DISPUTE'; payload: Dispute }
    | { type: 'SET_CURRENT_USER'; payload: User | null };


const dataReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'SET_ALL_DATA':
            return { ...state, ...action.payload };

        // AUTH
        case 'SET_CURRENT_USER':
            try {
                if (action.payload) {
                    localStorage.setItem('currentUser', JSON.stringify(action.payload));
                } else {
                    localStorage.removeItem('currentUser');
                }
            } catch (error) {
                console.error("Could not access localStorage:", error);
            }
            return { ...state, currentUser: action.payload };

        // USERS
        case 'SET_USERS': return { ...state, users: action.payload };
        case 'ADD_USER': return { ...state, users: [...state.users, action.payload] };
        case 'UPDATE_USER': {
            const updatedUsers = state.users.map(u => u._id === action.payload._id ? action.payload : u);
            let updatedCurrentUser = state.currentUser;
            if (state.currentUser?._id === action.payload._id) {
                updatedCurrentUser = action.payload;
                try { localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser)); } catch (e) {}
            }
            return { ...state, users: updatedUsers, currentUser: updatedCurrentUser };
        }
        case 'DELETE_USER': return { ...state, users: state.users.filter(u => u._id !== action.payload) };

        // DEPOSITS
        case 'SET_DEPOSITS': return { ...state, deposits: action.payload };
        case 'ADD_DEPOSIT': return { ...state, deposits: [action.payload, ...state.deposits] };
        case 'UPDATE_DEPOSIT': return { ...state, deposits: state.deposits.map(d => d._id === action.payload._id ? action.payload : d) };

        // WITHDRAWALS
        case 'SET_WITHDRAWALS': return { ...state, withdrawals: action.payload };
        case 'ADD_WITHDRAWAL': return { ...state, withdrawals: [action.payload, ...state.withdrawals] };
        case 'UPDATE_WITHDRAWAL': return { ...state, withdrawals: state.withdrawals.map(w => w._id === action.payload._id ? action.payload : w) };

        // PAYMENT METHODS
        case 'SET_PAYMENT_METHODS': return { ...state, paymentMethods: action.payload };
        case 'ADD_PAYMENT_METHOD': return { ...state, paymentMethods: [action.payload, ...state.paymentMethods] };
        case 'UPDATE_PAYMENT_METHOD': return { ...state, paymentMethods: state.paymentMethods.map(p => p._id === action.payload._id ? action.payload : p) };
        case 'DELETE_PAYMENT_METHOD': return { ...state, paymentMethods: state.paymentMethods.filter(p => p._id !== action.payload) };

        // INVESTMENT PLANS
        case 'SET_INVESTMENT_PLANS': return { ...state, investmentPlans: action.payload };
        case 'ADD_INVESTMENT_PLAN': return { ...state, investmentPlans: [action.payload, ...state.investmentPlans] };
        case 'UPDATE_INVESTMENT_PLAN': return { ...state, investmentPlans: state.investmentPlans.map(p => p._id === action.payload._id ? action.payload : p) };
        case 'DELETE_INVESTMENT_PLAN': return { ...state, investmentPlans: state.investmentPlans.filter(p => p._id !== action.payload) };

        // RULES
        case 'SET_RULES': return { ...state, rules: action.payload };
        case 'ADD_RULE': return { ...state, rules: [action.payload, ...state.rules] };
        case 'DELETE_RULE': return { ...state, rules: state.rules.filter(r => r._id !== action.payload) };
        
        // TRANSFERS
        case 'SET_TRANSFERS': return { ...state, transfers: action.payload };
        case 'ADD_TRANSFER': return { ...state, transfers: [action.payload, ...state.transfers] };
        case 'UPDATE_TRANSFER': return { ...state, transfers: state.transfers.map(t => t._id === action.payload._id ? action.payload : t) };

        // TRANSACTIONS
        case 'SET_TRANSACTIONS': return { ...state, transactions: action.payload };
        case 'ADD_TRANSACTION': return { ...state, transactions: [action.payload, ...state.transactions] };

        // SETTINGS
        case 'SET_SETTINGS': return { ...state, settings: action.payload };
        case 'UPDATE_SETTINGS': return { ...state, settings: action.payload };

        // LOGS
        case 'SET_LOGS': return { ...state, logs: action.payload };
        case 'ADD_LOG': return { ...state, logs: [action.payload, ...state.logs] };

        // NOTIFICATIONS
        case 'SET_NOTIFICATIONS': return { ...state, notifications: action.payload };
        case 'ADD_NOTIFICATION': return { ...state, notifications: [action.payload, ...state.notifications] };
        case 'UPDATE_NOTIFICATION':
            return { ...state, notifications: state.notifications.map(n => n._id === action.payload._id ? action.payload : n) };
        case 'UPDATE_NOTIFICATIONS': // Handles bulk creation response
            return { ...state, notifications: [...action.payload, ...state.notifications] };
        case 'MARK_NOTIFICATIONS_AS_READ': return { ...state, notifications: action.payload };

        // PASSWORD RESETS
        case 'SET_PASSWORD_RESET_REQUESTS':
            return { ...state, passwordResetRequests: action.payload };
        case 'DELETE_PASSWORD_RESET_REQUEST':
            return { ...state, passwordResetRequests: state.passwordResetRequests.filter(req => req._id !== action.payload) };

        // DISPUTES
        case 'SET_DISPUTES': return { ...state, disputes: action.payload };
        case 'ADD_DISPUTE': return { ...state, disputes: [action.payload, ...state.disputes] };
        case 'UPDATE_DISPUTE': return { ...state, disputes: state.disputes.map(d => d._id === action.payload._id ? action.payload : d) };

        default:
            return state;
    }
};

export const DataContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> }>({
    state: initialState,
    dispatch: () => null,
});

const initializer = (initialState: AppState) => {
    try {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            return { ...initialState, currentUser: JSON.parse(savedUser) as User };
        }
    } catch (error) {
        console.error("Could not parse user from localStorage", error);
        localStorage.removeItem('currentUser');
    }
    return initialState;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState, initializer);

    useEffect(() => {
        const fetchInitialData = async () => {
            const defaultSettings: Settings = {
                isUserTransferEnabled: true,
                transferConfig: { enabled: true, tiers: [] },
                exchangeRates: {
                    USD: 278.50,
                    EUR: 256.22,
                    PKR: 1,
                },
                restrictWithdrawalAmount: false,
                requirePlanMatchForCommission: false,
                requireActivePlanForCommission: false,
                oneTimeCommissionPerGroup: false,
                requireUplineEligibility: false,
                withdrawalFrequency: { enabled: false, value: 1, unit: 'days' },
                tickerContentSource: 'hybrid',
                homepageVideoUrl: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1',
                homepageContent: defaultHomepageContent,
                featuredPlanIds: [],
            };

            // Helper to safely fetch individual data points without crashing the entire app
            async function safeFetch<T>(fn: () => Promise<T>, fallbackValue: T): Promise<T> {
                try {
                    return await fn();
                } catch (error: any) {
                    console.warn(`Failed to fetch data (using fallback):`, error);
                    return fallbackValue;
                }
            }

            // Fetch core data in parallel, handling individual failures gracefully
            const [
                users, deposits, withdrawals, transactions, notifications, 
                paymentMethods, investmentPlans, rules, settings, transfers, logs,
                passwordResetRequests, disputes
            ] = await Promise.all([
                safeFetch(getUsers, []),
                safeFetch(getDeposits, []),
                safeFetch(getWithdrawals, []),
                safeFetch(getTransactions, []),
                safeFetch(getNotifications, []),
                safeFetch(getPaymentMethods, []),
                safeFetch(getInvestmentPlans, []),
                safeFetch(getRules, []),
                safeFetch(getSettings, defaultSettings),
                safeFetch(getTransfers, []),
                safeFetch(getLogs, []),
                safeFetch(getPasswordResetRequests, []),
                safeFetch(getDisputes, [])
            ]);

            dispatch({ 
                type: 'SET_ALL_DATA', 
                payload: {
                    users: users,
                    deposits: deposits,
                    withdrawals: withdrawals,
                    transactions: transactions,
                    notifications: notifications,
                    paymentMethods: paymentMethods,
                    investmentPlans: investmentPlans,
                    rules: rules,
                    settings: { ...defaultSettings, ...settings }, // Merge fetched settings with defaults
                    transfers: transfers,
                    logs: logs,
                    passwordResetRequests: passwordResetRequests,
                    disputes: disputes
                }
            });
        };

        fetchInitialData();
    }, []);

    return (
        <DataContext.Provider value={{ state, dispatch }}>
            {children}
        </DataContext.Provider>
    );
};
