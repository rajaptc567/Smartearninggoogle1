
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
        tickerSpeed: 6,
        tickerContentSource: 'hybrid',
        tickerRealActivities: { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true },
        tickerDemoAmountRanges: {
            USD: { min: 50, max: 500 },
            EUR: { min: 50, max: 500 },
            PKR: { min: 5000, max: 50000 },
        },
        demoProfiles: [
            {"_id":"1","name":"John S.","country":"United States","currency":"USD"},
            {"_id":"2","name":"Maria G.","country":"Germany","currency":"EUR"},
            {"_id":"3","name":"Ali K.","country":"Pakistan","currency":"PKR"},
            {"_id":"4","name":"Emily R.","country":"Canada","currency":"USD"},
            {"_id":"5","name":"Fatima Z.","country":"Pakistan","currency":"PKR"},
            {"_id":"6","name":"Lucas M.","country":"France","currency":"EUR"},
            {"_id":"7","name":"Michael B.","country":"United Kingdom","currency":"USD"},
            {"_id":"8","name":"Ahmed R.","country":"Pakistan","currency":"PKR"},
            {"_id":"9","name":"Sophia L.","country":"Australia","currency":"USD"},
            {"_id":"10","name":"Aisha M.","country":"Pakistan","currency":"PKR"},
            {"_id":"11","name":"Daniel K.","country":"Germany","currency":"EUR"},
            {"_id":"12","name":"Olivia C.","country":"United States","currency":"USD"},
            {"_id":"13","name":"Hassan J.","country":"Pakistan","currency":"PKR"},
            {"_id":"14","name":"Chloe T.","country":"France","currency":"EUR"},
            {"_id":"15","name":"William D.","country":"Canada","currency":"USD"},
            {"_id":"16","name":"Zainab A.","country":"Pakistan","currency":"PKR"},
            {"_id":"17","name":"James W.","country":"United Kingdom","currency":"USD"},
            {"_id":"18","name":"Bilal Q.","country":"Pakistan","currency":"PKR"},
            {"_id":"19","name":"Mia S.","country":"Australia","currency":"USD"},
            {"_id":"20","name":"Laura B.","country":"Germany","currency":"EUR"},
            {"_id":"21","name":"David J.","country":"United States","currency":"USD"},
            {"_id":"22","name":"Usman G.","country":"Pakistan","currency":"PKR"},
            {"_id":"23","name":"Arthur R.","country":"France","currency":"EUR"},
            {"_id":"24","name":"Charlotte N.","country":"Canada","currency":"USD"},
            {"_id":"25","name":"Sana I.","country":"Pakistan","currency":"PKR"},
            {"_id":"26","name":"Harry P.","country":"United Kingdom","currency":"USD"},
            {"_id":"27","name":"Omer S.","country":"Pakistan","currency":"PKR"},
            {"_id":"28","name":"Amelia T.","country":"Australia","currency":"USD"},
            {"_id":"29","name":"Jonas F.","country":"Germany","currency":"EUR"},
            {"_id":"30","name":"Ava M.","country":"United States","currency":"USD"},
            {"_id":"31","name":"Imran H.","country":"Pakistan","currency":"PKR"},
            {"_id":"32","name":"Manon L.","country":"France","currency":"EUR"},
            {"_id":"33","name":"Noah W.","country":"Canada","currency":"USD"},
            {"_id":"34","name":"Maryam B.","country":"Pakistan","currency":"PKR"},
            {"_id":"35","name":"George C.","country":"United Kingdom","currency":"USD"},
            {"_id":"36","name":"Saad A.","country":"Pakistan","currency":"PKR"},
            {"_id":"37","name":"Isla H.","country":"Australia","currency":"USD"},
            {"_id":"38","name":"Finn S.","country":"Germany","currency":"EUR"},
            {"_id":"39","name":"Liam P.","country":"United States","currency":"USD"},
            {"_id":"40","name":"Khadija N.","country":"Pakistan","currency":"PKR"},
            {"_id":"41","name":"Louis B.","country":"France","currency":"EUR"},
            {"_id":"42","name":"Emma G.","country":"Canada","currency":"USD"},
            {"_id":"43","name":"Ayesha T.","country":"Pakistan","currency":"PKR"},
            {"_id":"44","name":"Thomas H.","country":"United Kingdom","currency":"USD"},
            {"_id":"45","name":"Fahad M.","country":"Pakistan","currency":"PKR"},
            {"_id":"46","name":"Grace W.","country":"Australia","currency":"USD"},
            {"_id":"47","name":"Leon K.","country":"Germany","currency":"EUR"},
            {"_id":"48","name":"Benjamin T.","country":"United States","currency":"USD"},
            {"_id":"49","name":"Hamza Y.","country":"Pakistan","currency":"PKR"},
            {"_id":"50","name":"Camille D.","country":"France","currency":"EUR"},
            {"_id":"51","name":"Logan R.","country":"Canada","currency":"USD"},
            {"_id":"52","name":"Rabia S.","country":"Pakistan","currency":"PKR"},
            {"_id":"53","name":"Oscar E.","country":"United Kingdom","currency":"USD"},
            {"_id":"54","name":"Talha J.","country":"Pakistan","currency":"PKR"},
            {"_id":"55","name":"Ruby K.","country":"Australia","currency":"USD"},
            {"_id":"56","name":"Elias V.","country":"Germany","currency":"EUR"},
            {"_id":"57","name":"Henry A.","country":"United States","currency":"USD"},
            {"_id":"58","name":"Waqas F.","country":"Pakistan","currency":"PKR"},
            {"_id":"59","name":"Jules V.","country":"France","currency":"EUR"},
            {"_id":"60","name":"Hannah B.","country":"Canada","currency":"USD"},
            {"_id":"61","name":"Nida K.","country":"Pakistan","currency":"PKR"},
            {"_id":"62","name":"Freddie M.","country":"United Kingdom","currency":"USD"},
            {"_id":"63","name":"Yasir I.","country":"Pakistan","currency":"PKR"},
            {"_id":"64","name":"Zoe P.","country":"Australia","currency":"USD"},
            {"_id":"65","name":"Paul W.","country":"Germany","currency":"EUR"},
            {"_id":"66","name":"Alexander M.","country":"United States","currency":"USD"},
            {"_id":"67","name":"Danish Z.","country":"Pakistan","currency":"PKR"},
            {"_id":"68","name":"Adam M.","country":"France","currency":"EUR"},
            {"_id":"69","name":"Lily S.","country":"Canada","currency":"USD"},
            {"_id":"70","name":"Aqsa R.","country":"Pakistan","currency":"PKR"},
            {"_id":"71","name":"Alfie J.","country":"United Kingdom","currency":"USD"},
            {"_id":"72","name":"Kamran A.","country":"Pakistan","currency":"PKR"},
            {"_id":"73","name":"Chloe W.","country":"Australia","currency":"USD"},
            {"_id":"74","name":"Felix H.","country":"Germany","currency":"EUR"},
            {"_id":"75","name":"Samuel H.","country":"United States","currency":"USD"},
            {"_id":"76","name":"Salman B.","country":"Pakistan","currency":"PKR"},
            {"_id":"77","name":"Lea P.","country":"France","currency":"EUR"},
            {"_id":"78","name":"Evelyn L.","country":"Canada","currency":"USD"},
            {"_id":"79","name":"Saima N.","country":"Pakistan","currency":"PKR"},
            {"_id":"80","name":"Jacob R.","country":"United Kingdom","currency":"USD"},
            {"_id":"81","name":"Arslan Q.","country":"Pakistan","currency":"PKR"},
            {"_id":"82","name":"Ivy G.","country":"Australia","currency":"USD"},
            {"_id":"83","name":"Maximilian S.","country":"Germany","currency":"EUR"},
            {"_id":"84","name":"Jackson L.","country":"United States","currency":"USD"},
            {"_id":"85","name":"Rizwan T.","country":"Pakistan","currency":"PKR"},
            {"_id":"86","name":"Enzo C.","country":"France","currency":"EUR"},
            {"_id":"87","name":"Abigail F.","country":"Canada","currency":"USD"},
            {"_id":"88","name":"Hina J.","country":"Pakistan","currency":"PKR"},
            {"_id":"89","name":"Charlie G.","country":"United Kingdom","currency":"USD"},
            {"_id":"90","name":"Noman S.","country":"Pakistan","currency":"PKR"},
            {"_id":"91","name":"Matilda R.","country":"Australia","currency":"USD"},
            {"_id":"92","name":"Lina M.","country":"Germany","currency":"EUR"},
            {"_id":"93","name":"Sebastian C.","country":"United States","currency":"USD"},
            {"_id":"94","name":"Junaid I.","country":"Pakistan","currency":"PKR"},
            {"_id":"95","name":"Raphael G.","country":"France","currency":"EUR"},
            {"_id":"96","name":"Sofia D.","country":"Canada","currency":"USD"},
            {"_id":"97","name":"Farah K.","country":"Pakistan","currency":"PKR"},
            {"_id":"98","name":"Leo D.","country":"United Kingdom","currency":"USD"},
            {"_id":"99","name":"Adnan H.","country":"Pakistan","currency":"PKR"},
            {"_id":"100","name":"Ella J.","country":"Australia","currency":"USD"}
        ],
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
    | { type: 'DELETE_NOTIFICATIONS'; payload: string[] }
    | { type: 'SET_PASSWORD_RESET_REQUESTS'; payload: PasswordResetRequest[] }
    | { type: 'DELETE_PASSWORD_RESET_REQUEST'; payload: string }
    | { type: 'SET_DISPUTES'; payload: Dispute[] }
    | { type: 'ADD_DISPUTE'; payload: Dispute }
    | { type: 'UPDATE_DISPUTE'; payload: Dispute }
    | { type: 'SET_CURRENT_USER'; payload: User | null };


const dataReducer = (state: AppState, action: Action): AppState => {
    // Sanitization helper
    const sanitizeSettings = (settings: Settings) => {
        const newSettings = { ...settings };
        // FORCE PKR rate to 278 if it's currently 1 (default/uninitialized state)
        if (newSettings.exchangeRates && (newSettings.exchangeRates.PKR === 1 || !newSettings.exchangeRates.PKR)) {
            newSettings.exchangeRates.PKR = 278.00;
        }
        // Ensure defaults for others if missing
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
        case 'SET_SETTINGS': return { ...state, settings: sanitizeSettings(action.payload) };
        case 'UPDATE_SETTINGS': return { ...state, settings: sanitizeSettings(action.payload) };

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
        case 'DELETE_NOTIFICATIONS':
            return { ...state, notifications: state.notifications.filter(n => !action.payload.includes(n._id)) };


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
                    investmentPlans, rules, settings, transfers, logs, passwordResetRequests, disputes
                ] = await Promise.all([
                    getUsers(), getDeposits(), getWithdrawals(), getTransactions(), getNotifications(), getPaymentMethods(),
                    getInvestmentPlans(), getRules(), getSettings(), getTransfers(), getLogs(), getPasswordResetRequests(), getDisputes()
                ]);
                
                dispatch({ 
                    type: 'SET_ALL_DATA', 
                    payload: { 
                        users, deposits, withdrawals, transactions, notifications, paymentMethods, 
                        investmentPlans, rules, settings, transfers, logs, passwordResetRequests, disputes 
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
