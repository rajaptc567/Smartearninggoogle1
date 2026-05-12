
import React, { createContext, useReducer, ReactNode, useEffect, useRef } from 'react';
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Status, Transfer, Settings, Notification, Log, PasswordResetRequest, Dispute, Task, HomepageContent } from '../types';
import { 
    getUsers, getDeposits, getWithdrawals, getTransactions, getNotifications, getPaymentMethods, 
    getInvestmentPlans, getRules, getSettings, getTransfers, getLogs, getPasswordResetRequests, getDisputes, getTasks,
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
    settings: Settings;
    notifications: Notification[];
    logs: Log[];
    passwordResetRequests: PasswordResetRequest[];
    disputes: Dispute[];
    currentUser: User | null;
    isLoading: boolean;
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
        homepageVideoUrl: '',
        homepageContent: defaultHomepageContent,
        featuredPlanIds: [],
        faqs: [],
        homepagePaymentLogos: [],
    },
    notifications: [],
    logs: [],
    passwordResetRequests: [],
    disputes: [],
    currentUser: null,
    isLoading: true,
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
    | { type: 'DELETE_PASSWORD_RESET_REQUEST'; payload: string }
    | { type: 'SET_DISPUTES'; payload: Dispute[] }
    | { type: 'ADD_DISPUTE'; payload: Dispute }
    | { type: 'UPDATE_DISPUTE'; payload: Dispute }
    | { type: 'SET_TASKS'; payload: Task[] }
    | { type: 'ADD_TASK'; payload: Task }
    | { type: 'UPDATE_TASK'; payload: Task }
    | { type: 'DELETE_TASK'; payload: string }
    | { type: 'SET_CURRENT_USER'; payload: { user: User | null; token?: string } }
    | { type: 'SET_LOADING'; payload: boolean };


const dataReducer = (state: AppState, action: Action): AppState => {
    const sanitizeSettings = (settings: Settings) => {
        if (!settings) return state.settings;
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
        if (newSettings.faqs === undefined) newSettings.faqs = [];
        if (newSettings.homepagePaymentLogos === undefined) newSettings.homepagePaymentLogos = [];
        return newSettings;
    };

    let newState: AppState;

    switch (action.type) {
        case 'SET_ALL_DATA':
            if (!action.payload) return state;
            const sanitizedPayload = { ...action.payload };
            if (sanitizedPayload.settings) {
                sanitizedPayload.settings = sanitizeSettings(sanitizedPayload.settings);
            }
            newState = { ...state, ...sanitizedPayload };
            break;

        case 'SET_CURRENT_USER':
            try {
                if (action.payload && action.payload.user) {
                    localStorage.setItem('currentUser', JSON.stringify(action.payload.user));
                    if (action.payload.token) {
                        localStorage.setItem('authToken', action.payload.token);
                    }
                } else {
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('app_cache');
                }
            } catch (error: any) {
                console.error("Could not access localStorage:", error.message);
            }
            newState = { ...state, currentUser: action.payload?.user || null };
            break;

        case 'SET_USERS': newState = { ...state, users: action.payload || [] }; break;
        case 'ADD_USER': newState = { ...state, users: [...state.users, action.payload] }; break;
        case 'UPDATE_USER': {
            if (!action.payload) return state;
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

        case 'SET_DEPOSITS': newState = { ...state, deposits: action.payload || [] }; break;
        case 'ADD_DEPOSIT': newState = { ...state, deposits: [action.payload, ...state.deposits] }; break;
        case 'UPDATE_DEPOSIT': newState = { ...state, deposits: state.deposits.map(d => d._id === action.payload._id ? action.payload : d) }; break;

        case 'SET_WITHDRAWALS': newState = { ...state, withdrawals: action.payload || [] }; break;
        case 'ADD_WITHDRAWAL': newState = { ...state, withdrawals: [action.payload, ...state.withdrawals] }; break;
        case 'UPDATE_WITHDRAWAL': newState = { ...state, withdrawals: state.withdrawals.map(w => w._id === action.payload._id ? action.payload : w) }; break;

        case 'SET_PAYMENT_METHODS': newState = { ...state, paymentMethods: action.payload || [] }; break;
        case 'ADD_PAYMENT_METHOD': newState = { ...state, paymentMethods: [action.payload, ...state.paymentMethods] }; break;
        case 'UPDATE_PAYMENT_METHOD': newState = { ...state, paymentMethods: state.paymentMethods.map(p => p._id === action.payload._id ? action.payload : p) }; break;
        case 'DELETE_PAYMENT_METHOD': newState = { ...state, paymentMethods: state.paymentMethods.filter(p => p._id !== action.payload) }; break;

        case 'SET_INVESTMENT_PLANS': newState = { ...state, investmentPlans: action.payload || [] }; break;
        case 'ADD_INVESTMENT_PLAN': newState = { ...state, investmentPlans: [action.payload, ...state.investmentPlans] }; break;
        case 'UPDATE_INVESTMENT_PLAN': newState = { ...state, investmentPlans: state.investmentPlans.map(p => p._id === action.payload._id ? action.payload : p) }; break;
        case 'DELETE_INVESTMENT_PLAN': newState = { ...state, investmentPlans: state.investmentPlans.filter(p => p._id !== action.payload) }; break;

        case 'SET_RULES': newState = { ...state, rules: action.payload || [] }; break;
        case 'ADD_RULE': newState = { ...state, rules: [action.payload, ...state.rules] }; break;
        case 'DELETE_RULE': newState = { ...state, rules: state.rules.filter(r => r._id !== action.payload) }; break;
        
        case 'SET_TRANSFERS': newState = { ...state, transfers: action.payload || [] }; break;
        case 'ADD_TRANSFER': newState = { ...state, transfers: [action.payload, ...state.transfers] }; break;
        case 'UPDATE_TRANSFER': newState = { ...state, transfers: state.transfers.map(t => t._id === action.payload._id ? action.payload : t) }; break;

        case 'SET_TRANSACTIONS': newState = { ...state, transactions: action.payload || [] }; break;
        case 'ADD_TRANSACTION': newState = { ...state, transactions: [action.payload, ...state.transactions] }; break;

        case 'SET_SETTINGS': newState = { ...state, settings: sanitizeSettings(action.payload) }; break;
        case 'UPDATE_SETTINGS': newState = { ...state, settings: sanitizeSettings(action.payload) }; break;

        case 'SET_LOGS': newState = { ...state, logs: action.payload || [] }; break;
        case 'ADD_LOG': newState = { ...state, logs: [action.payload, ...state.logs] }; break;

        case 'SET_NOTIFICATIONS': newState = { ...state, notifications: action.payload || [] }; break;
        case 'ADD_NOTIFICATION': newState = { ...state, notifications: [action.payload, ...state.notifications] }; break;
        case 'UPDATE_NOTIFICATION':
            newState = { ...state, notifications: state.notifications.map(n => n._id === action.payload._id ? action.payload : n) };
            break;
        case 'UPDATE_NOTIFICATIONS':
            newState = { ...state, notifications: [...(action.payload || []), ...state.notifications] };
            break;
        case 'MARK_NOTIFICATIONS_AS_READ': newState = { ...state, notifications: action.payload || [] }; break;
        case 'DELETE_NOTIFICATIONS':
            newState = { ...state, notifications: state.notifications.filter(n => !(action.payload || []).includes(n._id)) };
            break;

        case 'SET_PASSWORD_RESET_REQUESTS':
            newState = { ...state, passwordResetRequests: action.payload || [] };
            break;
        case 'DELETE_PASSWORD_RESET_REQUEST':
            newState = { ...state, passwordResetRequests: state.passwordResetRequests.filter(req => req._id !== action.payload) };
            break;

        case 'SET_DISPUTES': newState = { ...state, disputes: action.payload || [] }; break;
        case 'ADD_DISPUTE': newState = { ...state, disputes: [action.payload, ...state.disputes] }; break;
        case 'UPDATE_DISPUTE': newState = { ...state, disputes: state.disputes.map(d => d._id === action.payload._id ? action.payload : d) }; break;

        case 'SET_TASKS': newState = { ...state, tasks: action.payload || [] }; break;
        case 'ADD_TASK': newState = { ...state, tasks: [action.payload, ...state.tasks] }; break;
        case 'UPDATE_TASK': newState = { ...state, tasks: state.tasks.map(t => t._id === action.payload._id ? action.payload : t) }; break;
        case 'DELETE_TASK': newState = { ...state, tasks: state.tasks.filter(t => t._id !== action.payload) }; break;

        case 'SET_LOADING':
            newState = { ...state, isLoading: action.payload };
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

export const DataContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> }>({
    state: initialState,
    dispatch: () => null,
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
        
        return initialData;
    } catch (error) {
        console.error("Could not parse data from localStorage", error);
    }
    return initialState;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState, initializer);
    const lastVersionRef = useRef<number>(0);

    // Initial Data Fetch with AllSettled for Resilience
    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('authToken');
            const isLoggedIn = !!token;

            try {
                // Public data always fetched
                const publicPromises = [
                    getPaymentMethods(),
                    getInvestmentPlans(),
                    getSettings(),
                    getDataVersion()
                ];

                // Private data only fetched if logged in
                const privatePromises = isLoggedIn ? [
                    getUsers(), getDeposits(), getWithdrawals(), getTransactions(), getNotifications(), 
                    getRules(), getTransfers(), getLogs(), getPasswordResetRequests(), getDisputes(), getTasks()
                ] : [];

                const [publicResults, privateResults] = await Promise.all([
                    Promise.allSettled(publicPromises),
                    Promise.allSettled(privatePromises)
                ]);

                const getValue = (results: any[], idx: number, fallback: any) => 
                    (results[idx] && results[idx].status === 'fulfilled') ? (results[idx] as PromiseFulfilledResult<any>).value : fallback;

                const currentVersion = getValue(publicResults, 3, 0);
                lastVersionRef.current = currentVersion;

                dispatch({ 
                    type: 'SET_ALL_DATA', 
                    payload: { 
                        paymentMethods: getValue(publicResults, 0, []),
                        investmentPlans: getValue(publicResults, 1, []),
                        settings: getValue(publicResults, 2, state.settings),
                        users: getValue(privateResults, 0, []),
                        deposits: getValue(privateResults, 1, []),
                        withdrawals: getValue(privateResults, 2, []),
                        transactions: getValue(privateResults, 3, []),
                        notifications: getValue(privateResults, 4, []),
                        rules: getValue(privateResults, 5, []),
                        transfers: getValue(privateResults, 6, []),
                        logs: getValue(privateResults, 7, []),
                        passwordResetRequests: getValue(privateResults, 8, []),
                        disputes: getValue(privateResults, 9, []),
                        tasks: getValue(privateResults, 10, [])
                    } 
                });
                dispatch({ type: 'SET_LOADING', payload: false });
            } catch (error) {
                console.error("Critical error during initial data handshake:", error);
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        };

        fetchData();
    }, []);

    // --- REAL-TIME SYNC POLLING ---
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
                    const isAdmin = state.currentUser.username === 'admin' || state.currentUser.email === 'studio56.pk@gmail.com';
                    
                    if (isAdmin) {
                        lastVersionRef.current = serverVersion;
                        const results = await Promise.allSettled([
                            getUsers(), getDeposits(), getWithdrawals(), getTransactions(), getNotifications(), getPaymentMethods(),
                            getInvestmentPlans(), getRules(), getSettings(), getTransfers(), getLogs(), getPasswordResetRequests(), getDisputes(), getTasks()
                        ]);
                        
                        const getValue = (idx: number, fallback: any) => 
                            results[idx].status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<any>).value : fallback;

                        dispatch({ 
                            type: 'SET_ALL_DATA', 
                            payload: { 
                                users: getValue(0, []), deposits: getValue(1, []), withdrawals: getValue(2, []),
                                transactions: getValue(3, []), notifications: getValue(4, []), paymentMethods: getValue(5, []),
                                investmentPlans: getValue(6, []), rules: getValue(7, []), settings: getValue(8, state.settings),
                                transfers: getValue(9, []), logs: getValue(10, []), passwordResetRequests: getValue(11, []),
                                disputes: getValue(12, []), tasks: getValue(13, [])
                            } 
                        });
                    } else {
                        window.location.reload();
                    }
                }
            } catch (err) {
                // Silently ignore polling network errors
            }
        }, 5000); 

        return () => clearInterval(pollInterval);
    }, [state.currentUser]);

    return (
        <div id="data-state-container">
            <DataContext.Provider value={{ state, dispatch }}>
                {children}
            </DataContext.Provider>
        </div>
    );
};
