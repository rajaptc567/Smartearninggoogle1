
import React, { createContext, useReducer, ReactNode, useEffect } from 'react';
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Status, Transfer, Settings, Notification, Log, PasswordResetRequest, Dispute, Task } from '../types';
import { 
    getUsers, getDeposits, getWithdrawals, getTransactions, getNotifications, getPaymentMethods, 
    getInvestmentPlans, getRules, getSettings, getTransfers, getLogs, getPasswordResetRequests, getDisputes, getTasks 
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
    tasks: Task[];
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
    tasks: [],
    settings: {
        isUserTransferEnabled: true,
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
        requirePlanMatchForCommission: false,
        requireActivePlanForCommission: false,
        oneTimeCommissionPerGroup: false,
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
    | { type: 'SET_CURRENT_USER'; payload: User | null };


const dataReducer = (state: AppState, action: Action): AppState => {
    const sanitizeSettings = (settings: Settings) => {
        const newSettings = { ...settings };
        if (newSettings.exchangeRates && (newSettings.exchangeRates.PKR === 1 || !newSettings.exchangeRates.PKR)) {
            newSettings.exchangeRates.PKR = 278.00;
        }
        if (newSettings.exchangeRates && !newSettings.exchangeRates.EUR) newSettings.exchangeRates.EUR = 0.92;
        if (newSettings.exchangeRates && !newSettings.exchangeRates.USD) newSettings.exchangeRates.USD = 1;
        return newSettings;
    };

    switch (action.type) {
        case 'SET_ALL_DATA':
            const sanitizedPayload = { ...action.payload };
            if (sanitizedPayload.settings) {
                sanitizedPayload.settings = sanitizeSettings(sanitizedPayload.settings);
            }
            return { ...state, ...sanitizedPayload };

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

        case 'SET_DEPOSITS': return { ...state, deposits: action.payload };
        case 'ADD_DEPOSIT': return { ...state, deposits: [action.payload, ...state.deposits] };
        case 'UPDATE_DEPOSIT': return { ...state, deposits: state.deposits.map(d => d._id === action.payload._id ? action.payload : d) };

        case 'SET_WITHDRAWALS': return { ...state, withdrawals: action.payload };
        case 'ADD_WITHDRAWAL': return { ...state, withdrawals: [action.payload, ...state.withdrawals] };
        case 'UPDATE_WITHDRAWAL': return { ...state, withdrawals: state.withdrawals.map(w => w._id === action.payload._id ? action.payload : w) };

        case 'SET_PAYMENT_METHODS': return { ...state, paymentMethods: action.payload };
        case 'ADD_PAYMENT_METHOD': return { ...state, paymentMethods: [action.payload, ...state.paymentMethods] };
        case 'UPDATE_PAYMENT_METHOD': return { ...state, paymentMethods: state.paymentMethods.map(p => p._id === action.payload._id ? action.payload : p) };
        case 'DELETE_PAYMENT_METHOD': return { ...state, paymentMethods: state.paymentMethods.filter(p => p._id !== action.payload) };

        case 'SET_INVESTMENT_PLANS': return { ...state, investmentPlans: action.payload };
        case 'ADD_INVESTMENT_PLAN': return { ...state, investmentPlans: [action.payload, ...state.investmentPlans] };
        case 'UPDATE_INVESTMENT_PLAN': return { ...state, investmentPlans: state.investmentPlans.map(p => p._id === action.payload._id ? action.payload : p) };
        case 'DELETE_INVESTMENT_PLAN': return { ...state, investmentPlans: state.investmentPlans.filter(p => p._id !== action.payload) };

        case 'SET_RULES': return { ...state, rules: action.payload };
        case 'ADD_RULE': return { ...state, rules: [action.payload, ...state.rules] };
        case 'DELETE_RULE': return { ...state, rules: state.rules.filter(r => r._id !== action.payload) };
        
        case 'SET_TRANSFERS': return { ...state, transfers: action.payload };
        case 'ADD_TRANSFER': return { ...state, transfers: [action.payload, ...state.transfers] };
        case 'UPDATE_TRANSFER': return { ...state, transfers: state.transfers.map(t => t._id === action.payload._id ? action.payload : t) };

        case 'SET_TRANSACTIONS': return { ...state, transactions: action.payload };
        case 'ADD_TRANSACTION': return { ...state, transactions: [action.payload, ...state.transactions] };

        case 'SET_SETTINGS': return { ...state, settings: sanitizeSettings(action.payload) };
        case 'UPDATE_SETTINGS': return { ...state, settings: sanitizeSettings(action.payload) };

        case 'SET_LOGS': return { ...state, logs: action.payload };
        case 'ADD_LOG': return { ...state, logs: [action.payload, ...state.logs] };

        case 'SET_NOTIFICATIONS': return { ...state, notifications: action.payload };
        case 'ADD_NOTIFICATION': return { ...state, notifications: [action.payload, ...state.notifications] };
        case 'UPDATE_NOTIFICATION':
            return { ...state, notifications: state.notifications.map(n => n._id === action.payload._id ? action.payload : n) };
        case 'UPDATE_NOTIFICATIONS':
            return { ...state, notifications: [...action.payload, ...state.notifications] };
        case 'MARK_NOTIFICATIONS_AS_READ': return { ...state, notifications: action.payload };
        case 'DELETE_NOTIFICATIONS':
            return { ...state, notifications: state.notifications.filter(n => !action.payload.includes(n._id)) };

        case 'SET_PASSWORD_RESET_REQUESTS':
            return { ...state, passwordResetRequests: action.payload };
        case 'DELETE_PASSWORD_RESET_REQUEST':
            return { ...state, passwordResetRequests: state.passwordResetRequests.filter(req => req._id !== action.payload) };

        case 'SET_DISPUTES': return { ...state, disputes: action.payload };
        case 'ADD_DISPUTE': return { ...state, disputes: [action.payload, ...state.disputes] };
        case 'UPDATE_DISPUTE': return { ...state, disputes: state.disputes.map(d => d._id === action.payload._id ? action.payload : d) };

        case 'SET_TASKS': return { ...state, tasks: action.payload };
        case 'ADD_TASK': return { ...state, tasks: [action.payload, ...state.tasks] };
        case 'UPDATE_TASK': return { ...state, tasks: state.tasks.map(t => t._id === action.payload._id ? action.payload : t) };
        case 'DELETE_TASK': return { ...state, tasks: state.tasks.filter(t => t._id !== action.payload) };

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
    }
    return initialState;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState, initializer);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [
                    users, deposits, withdrawals, transactions, notifications, paymentMethods, 
                    investmentPlans, rules, settings, transfers, logs, passwordResetRequests, disputes, tasks
                ] = await Promise.all([
                    getUsers(), getDeposits(), getWithdrawals(), getTransactions(), getNotifications(), getPaymentMethods(),
                    getInvestmentPlans(), getRules(), getSettings(), getTransfers(), getLogs(), getPasswordResetRequests(), getDisputes(), getTasks()
                ]);
                
                dispatch({ 
                    type: 'SET_ALL_DATA', 
                    payload: { 
                        users, deposits, withdrawals, transactions, notifications, paymentMethods, 
                        investmentPlans, rules, settings, transfers, logs, passwordResetRequests, disputes, tasks 
                    } 
                });
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            }
        };

        fetchData();
    }, []);

    return (
        <DataContext.Provider value={{ state, dispatch }}>
            {children}
        </DataContext.Provider>
    );
};
