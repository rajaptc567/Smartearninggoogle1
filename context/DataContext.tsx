import React, { createContext, useReducer, ReactNode, useEffect, useRef, useState } from 'react';
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Status, Transfer, Settings, Notification, Log, PasswordResetRequest, Dispute, Task, HomepageContent } from '../types';
import { 
    getUsers, getDeposits, getWithdrawals, getTransactions, getNotifications, getPaymentMethods, 
    getInvestmentPlans, getRules, getSettings, getTransfers, getLogs, getPasswordResetRequests, getDisputes, getTasks,
    getDataVersion, getMe
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
    settings: Settings;
    notifications: Notification[];
    logs: Log[];
    passwordResetRequests: PasswordResetRequest[];
    disputes: Dispute[];
    currentUser: User | null;
    isOffline?: boolean;
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
        homepageVideoUrl: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1',
        homepageContent: defaultHomepageContent,
        featuredPlanIds: [],
    },
    notifications: [],
    logs: [],
    passwordResetRequests: [],
    disputes: [],
    currentUser: null,
    isOffline: false
};

type Action =
    | { type: 'SET_ALL_DATA'; payload: Partial<AppState> }
    | { type: 'SET_OFFLINE_STATE'; payload: boolean }
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
    | { type: 'DELETE_PASSWORD_RESET_REQUEST'; payload: string }
    | { type: 'SET_DISPUTES'; payload: Dispute[] }
    | { type: 'ADD_DISPUTE'; payload: Dispute }
    | { type: 'UPDATE_DISPUTE'; payload: Dispute }
    | { type: 'SET_TASKS'; payload: Task[] }
    | { type: 'ADD_TASK'; payload: Task }
    | { type: 'UPDATE_TASK'; payload: Task }
    | { type: 'DELETE_TASK'; payload: string }
    | { type: 'SET_CURRENT_USER'; payload: User | null };


const dataReducer = (state: AppState, action: Action): AppState => {
    const sanitizeSettings = (settings: Settings) => {
        const newSettings = { ...settings };
        if (newSettings.exchangeRates && (newSettings.exchangeRates.PKR === 1 || !newSettings.exchangeRates.PKR)) {
            newSettings.exchangeRates.PKR = 278.00;
        }
        if (newSettings.exchangeRates && !newSettings.exchangeRates.EUR) newSettings.exchangeRates.EUR = 0.92;
        if (newSettings.exchangeRates && !newSettings.exchangeRates.USD) newSettings.exchangeRates.USD = 1;
        if (newSettings.isTasksEnabled === undefined) newSettings.isTasksEnabled = true;
        if (newSettings.showRejectedCommissionTransaction === undefined) newSettings.showRejectedCommissionTransaction = true;
        if (newSettings.notifySponsorOnCommissionLimit === undefined) newSettings.notifySponsorOnCommissionLimit = true;
        if (newSettings.restrictDepositAmount === undefined) newSettings.restrictDepositAmount = false;
        return newSettings;
    };

    let newState: AppState;

    switch (action.type) {
        case 'SET_OFFLINE_STATE':
            return { ...state, isOffline: action.payload };

        case 'SET_ALL_DATA':
            const sanitizedPayload = { ...action.payload };
            if (sanitizedPayload.settings) {
                sanitizedPayload.settings = sanitizeSettings(sanitizedPayload.settings);
            }
            newState = { ...state, ...sanitizedPayload, isOffline: false };
            break;

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
            newState = { ...state, currentUser: action.payload };
            break;

        case 'SET_USERS': newState = { ...state, users: action.payload }; break;
        case 'ADD_USER': newState = { ...state, users: [...state.users, action.payload] }; break;
        case 'UPDATE_USER': {
            const updatedUsers = state.users.map(u => u._id === action.payload._id ? action.payload : u);
            let updatedCurrentUser = state.currentUser;
            if (state.currentUser?._id === action.payload._id) {
                updatedCurrentUser = action.payload;
                try { localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser)); } catch (e) {}
            }
            newState = { ...state, users: updatedUsers, currentUser: updatedCurrentUser };
            break;
        }
        case 'DELETE_USER': newState = { ...state, users: state.users.filter(u => u._id !== action.payload) }; break;

        case 'SET_DEPOSITS': newState = { ...state, deposits: action.payload }; break;
        case 'ADD_DEPOSIT': newState = { ...state, deposits: [action.payload, ...state.deposits] }; break;
        case 'UPDATE_DEPOSIT': newState = { ...state, deposits: state.deposits.map(d => d._id === action.payload._id ? action.payload : d) }; break;

        case 'SET_WITHDRAWALS': newState = { ...state, withdrawals: action.payload }; break;
        case 'ADD_WITHDRAWAL': newState = { ...state, withdrawals: [action.payload, ...state.withdrawals] }; break;
        case 'UPDATE_WITHDRAWAL': newState = { ...state, withdrawals: state.withdrawals.map(w => w._id === action.payload._id ? action.payload : w) }; break;

        case 'SET_PAYMENT_METHODS': newState = { ...state, paymentMethods: action.payload }; break;
        case 'ADD_PAYMENT_METHOD': newState = { ...state, paymentMethods: [action.payload, ...state.paymentMethods] }; break;
        case 'UPDATE_PAYMENT_METHOD': newState = { ...state, paymentMethods: state.paymentMethods.map(p => p._id === action.payload._id ? action.payload : p) }; break;
        case 'DELETE_PAYMENT_METHOD': newState = { ...state, paymentMethods: state.paymentMethods.filter(p => p._id !== action.payload) }; break;

        case 'SET_INVESTMENT_PLANS': newState = { ...state, investmentPlans: action.payload }; break;
        case 'ADD_INVESTMENT_PLAN': newState = { ...state, investmentPlans: [action.payload, ...state.investmentPlans] }; break;
        case 'UPDATE_INVESTMENT_PLAN': newState = { ...state, investmentPlans: state.investmentPlans.map(p => p._id === action.payload._id ? action.payload : p) }; break;
        case 'DELETE_INVESTMENT_PLAN': newState = { ...state, investmentPlans: state.investmentPlans.filter(p => p._id !== action.payload) }; break;

        case 'SET_RULES': newState = { ...state, rules: action.payload }; break;
        case 'ADD_RULE': newState = { ...state, rules: [action.payload, ...state.rules] }; break;
        case 'DELETE_RULE': newState = { ...state, rules: state.rules.filter(r => r._id !== action.payload) }; break;
        
        case 'SET_TRANSFERS': newState = { ...state, transfers: action.payload }; break;
        case 'ADD_TRANSFER': newState = { ...state, transfers: [action.payload, ...state.transfers] }; break;
        case 'UPDATE_TRANSFER': newState = { ...state, transfers: state.transfers.map(t => t._id === action.payload._id ? action.payload : t) }; break;

        case 'SET_TRANSACTIONS': newState = { ...state, transactions: action.payload }; break;
        case 'ADD_TRANSACTION': newState = { ...state, transactions: [action.payload, ...state.transactions] }; break;

        case 'SET_SETTINGS': newState = { ...state, settings: sanitizeSettings(action.payload) }; break;
        case 'UPDATE_SETTINGS': newState = { ...state, settings: sanitizeSettings(action.payload) }; break;

        case 'SET_LOGS': newState = { ...state, logs: action.payload }; break;
        case 'ADD_LOG': newState = { ...state, logs: [action.payload, ...state.logs] }; break;

        case 'SET_NOTIFICATIONS': newState = { ...state, notifications: action.payload }; break;
        case 'ADD_NOTIFICATION': newState = { ...state, notifications: [action.payload, ...state.notifications] }; break;
        case 'UPDATE_NOTIFICATION':
            newState = { ...state, notifications: state.notifications.map(n => n._id === action.payload._id ? action.payload : n) };
            break;
        case 'UPDATE_NOTIFICATIONS':
            newState = { ...state, notifications: [...action.payload, ...state.notifications] };
            break;
        case 'MARK_NOTIFICATIONS_AS_READ': newState = { ...state, notifications: action.payload }; break;
        case 'DELETE_NOTIFICATIONS':
            newState = { ...state, notifications: state.notifications.filter(n => !action.payload.includes(n._id)) };
            break;

        case 'SET_PASSWORD_RESET_REQUESTS':
            newState = { ...state, passwordResetRequests: action.payload };
            break;
        case 'DELETE_PASSWORD_RESET_REQUEST':
            newState = { ...state, passwordResetRequests: state.passwordResetRequests.filter(req => req._id !== action.payload) };
            break;

        case 'SET_DISPUTES': newState = { ...state, disputes: action.payload }; break;
        case 'ADD_DISPUTE': newState = { ...state, disputes: [action.payload, ...state.disputes] }; break;
        case 'UPDATE_DISPUTE': newState = { ...state, disputes: state.disputes.map(d => d._id === action.payload._id ? action.payload : d) }; break;

        case 'SET_TASKS': newState = { ...state, tasks: action.payload }; break;
        case 'ADD_TASK': newState = { ...state, tasks: [action.payload, ...state.tasks] }; break;
        case 'UPDATE_TASK': newState = { ...state, tasks: state.tasks.map(t => t._id === action.payload._id ? action.payload : t) }; break;
        case 'DELETE_TASK': newState = { ...state, tasks: state.tasks.filter(t => t._id !== action.payload) }; break;

        default:
            return state;
    }

    return newState;
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
    }
    return initialState;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState, initializer);
    const lastVersionRef = useRef<number>(0);

    const fetchData = async () => {
        if (!state.currentUser) return;

        try {
            // 🛡️ SYNC USER IDENTITY (Mandatory Server Check)
            const freshUser = await getMe();
            dispatch({ type: 'SET_CURRENT_USER', payload: freshUser });

            const isAdmin = freshUser.role === 'admin' || freshUser.role === 'superadmin';

            // 🛡️ DATA FETCHING: Transactions, Deposits, Withdrawals, Transfers are now Role-Aware on Backend.
            // Everyone can fetch them, but users only get their OWN records.
            const commonDataPromise = Promise.all([
                getTransactions(), 
                getNotifications(), 
                getPaymentMethods(),
                getInvestmentPlans(), 
                getRules(), 
                getSettings(), 
                getDisputes(), 
                getTasks(),
                getDeposits(),    // Fetching owned/all
                getWithdrawals(),  // Fetching owned/all
                getTransfers(),    // Fetching owned/all
                getDataVersion()
            ]);

            let adminDataPromise = Promise.resolve([[], [], []]);
            if (isAdmin) {
                adminDataPromise = Promise.all([
                    getUsers(), getLogs(), getPasswordResetRequests()
                ]);
            }

            const [commonData, adminData] = await Promise.all([commonDataPromise, adminDataPromise]);
            
            const [
                transactions, notifications, paymentMethods, 
                investmentPlans, rules, settings, disputes, tasks,
                deposits, withdrawals, transfers,
                currentVersion
            ] = commonData;

            const [
                users, logs, passwordResetRequests
            ] = adminData;
            
            lastVersionRef.current = currentVersion;

            dispatch({ 
                type: 'SET_ALL_DATA', 
                payload: { 
                    transactions, notifications, paymentMethods, 
                    investmentPlans, rules, settings, disputes, tasks,
                    deposits, withdrawals, transfers,
                    users, logs, passwordResetRequests
                } 
            });
            dispatch({ type: 'SET_OFFLINE_STATE', payload: false });
        } catch (error) {
            console.error("Data fetch failed:", error.message);
            dispatch({ type: 'SET_OFFLINE_STATE', payload: true });

            if (error.message.includes('401') || error.message.includes('authorized') || error.message.includes('identity unknown')) {
                dispatch({ type: 'SET_CURRENT_USER', payload: null });
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, [state.currentUser?._id]); 

    useEffect(() => {
        const pollInterval = setInterval(async () => {
            if (!state.currentUser) return;

            try {
                const serverVersion = await getDataVersion();
                
                if (lastVersionRef.current === 0) {
                    lastVersionRef.current = serverVersion;
                    return;
                }

                if (serverVersion > lastVersionRef.current) {
                    fetchData();
                }
                dispatch({ type: 'SET_OFFLINE_STATE', payload: false });
            } catch (err) {
                dispatch({ type: 'SET_OFFLINE_STATE', payload: true });
                if (err.message.includes('401')) {
                    dispatch({ type: 'SET_CURRENT_USER', payload: null });
                }
            }
        }, 15000); 

        return () => clearInterval(pollInterval);
    }, [state.currentUser]);

    return (
        <DataContext.Provider value={{ state, dispatch }}>
            {children}
        </DataContext.Provider>
    );
};