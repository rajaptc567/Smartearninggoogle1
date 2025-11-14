import React, { createContext, useReducer, ReactNode, useEffect } from 'react';
import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Rule, Status, Transfer, Settings, Notification } from '../types';
import { mockUsers, mockWithdrawals, mockPaymentMethods, mockInvestmentPlans, mockRules, mockTransfers } from '../data/mockData';
import { getUsers, getDeposits, getTransactions, getNotifications, markNotificationsAsRead } from '../services/api';

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
    currentUser: User | null;
}

const initialState: AppState = {
    users: [], // Will be loaded from API
    deposits: [], // Will be loaded from API
    withdrawals: mockWithdrawals, // Still mock for now
    transfers: mockTransfers, // Still mock for now
    paymentMethods: mockPaymentMethods, // Still mock for now
    investmentPlans: mockInvestmentPlans, // Still mock for now
    transactions: [], // Will be loaded from API
    rules: mockRules, // Still mock for now
    settings: {
        isUserTransferEnabled: true,
        restrictWithdrawalAmount: false,
    },
    notifications: [], // Will be loaded from API
    currentUser: null, // This will be hydrated from localStorage by the initializer
};

type Action =
    | { type: 'SET_USERS'; payload: User[] }
    | { type: 'ADD_USER'; payload: User }
    | { type: 'UPDATE_USER'; payload: User }
    | { type: 'SET_DEPOSITS'; payload: Deposit[] }
    | { type: 'ADD_DEPOSIT'; payload: Deposit }
    | { type: 'UPDATE_DEPOSIT'; payload: { deposit: Deposit; user: User } }
    | { type: 'ADD_WITHDRAWAL'; payload: Withdrawal }
    | { type: 'UPDATE_WITHDRAWAL'; payload: Withdrawal }
    | { type: 'ADD_PAYMENT_METHOD'; payload: PaymentMethod }
    | { type: 'UPDATE_PAYMENT_METHOD'; payload: PaymentMethod }
    | { type: 'DELETE_PAYMENT_METHOD'; payload: string }
    | { type: 'ADD_INVESTMENT_PLAN'; payload: InvestmentPlan }
    | { type: 'UPDATE_INVESTMENT_PLAN'; payload: InvestmentPlan }
    | { type: 'DELETE_INVESTMENT_PLAN'; payload: string }
    | { type: 'ADD_RULE'; payload: Rule }
    | { type: 'DELETE_RULE'; payload: string }
    | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
    | { type: 'ADD_TRANSACTION'; payload: Transaction }
    | { type: 'MANUAL_WALLET_ADJUSTMENT'; payload: { userId: string; amount: number; description: string }}
    | { type: 'PURCHASE_PLAN'; payload: { userId: string; planId: string } }
    | { type: 'UPDATE_SETTINGS', payload: Partial<Settings> }
    | { type: 'ADD_TRANSFER'; payload: Omit<Transfer, '_id' | 'status' | 'date'> }
    | { type: 'UPDATE_TRANSFER'; payload: Transfer }
    | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'ADD_NOTIFICATION'; payload: Notification }
    | { type: 'MARK_NOTIFICATIONS_AS_READ'; payload: Notification[] }
    | { type: 'SET_CURRENT_USER'; payload: User | null };


const dataReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        // AUTH ACTIONS
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

        // NOTIFICATION ACTIONS
        case 'SET_NOTIFICATIONS':
            return { ...state, notifications: action.payload };
        case 'ADD_NOTIFICATION':
            return { ...state, notifications: [action.payload, ...state.notifications] };
        case 'MARK_NOTIFICATIONS_AS_READ':
            return { ...state, notifications: action.payload };
           
        // USER ACTIONS
        case 'SET_USERS':
            return { ...state, users: action.payload };
        case 'ADD_USER':
            return { ...state, users: [...state.users, action.payload] };
        case 'UPDATE_USER': {
            const updatedUsers = state.users.map(u => u._id === action.payload._id ? action.payload : u);
            let updatedCurrentUser = state.currentUser;
            if (state.currentUser?._id === action.payload._id) {
                updatedCurrentUser = action.payload;
                 try {
                    localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
                } catch (error) { console.error("Could not access localStorage:", error); }
            }
            return { ...state, users: updatedUsers, currentUser: updatedCurrentUser };
        }

        // DEPOSIT ACTIONS
        case 'SET_DEPOSITS':
            return { ...state, deposits: action.payload };
        case 'ADD_DEPOSIT':
            // Simply adds the new deposit. Backend handles notifications and pending commissions.
            return { ...state, deposits: [action.payload, ...state.deposits] };
        case 'UPDATE_DEPOSIT': {
            const { deposit: updatedDeposit, user: updatedUser } = action.payload;
            // Update the specific deposit
            const updatedDeposits = state.deposits.map(d => d._id === updatedDeposit._id ? updatedDeposit : d);
            // Update the user involved
            const updatedUsers = state.users.map(u => u._id === updatedUser._id ? updatedUser : u);
            // Check if the current user was the one updated
            const updatedCurrentUser = state.currentUser?._id === updatedUser._id ? updatedUser : state.currentUser;
            
            // It's better to refetch transactions and notifications to ensure consistency
            // but for a quicker UI update, we can just update what we know has changed.
            return {
                ...state,
                deposits: updatedDeposits,
                users: updatedUsers,
                currentUser: updatedCurrentUser,
            };
        }

        // TRANSACTION ACTIONS
        case 'SET_TRANSACTIONS':
            return { ...state, transactions: action.payload };

        // WITHDRAWAL ACTIONS (Still mock)
        case 'ADD_WITHDRAWAL': {
             const newWithdrawal = action.payload;
             const updatedUsers = state.users.map(u => u._id === newWithdrawal.userId ? { ...u, walletBalance: u.walletBalance - newWithdrawal.amount } : u);
             const newTransaction: Transaction = { _id: `TRN${Date.now()}`, userId: newWithdrawal.userId, userName: newWithdrawal.userName, type: 'Withdrawal Request', amount: -newWithdrawal.amount, date: new Date().toISOString().split('T')[0], description: `Pending Withdrawal #${newWithdrawal._id}`, status: 'Pending' };
             
             return {
                 ...state,
                 withdrawals: [newWithdrawal, ...state.withdrawals],
                 users: updatedUsers,
                 transactions: [newTransaction, ...state.transactions],
                 currentUser: updatedUsers.find(u => u._id === state.currentUser?._id) || state.currentUser
             }
        }
        case 'UPDATE_WITHDRAWAL': {
            return {
                ...state,
                withdrawals: state.withdrawals.map(w => w._id === action.payload._id ? action.payload : w),
            };
        }

        // OTHER MOCK ACTIONS
        case 'ADD_PAYMENT_METHOD':
            return { ...state, paymentMethods: [action.payload, ...state.paymentMethods] };
        case 'UPDATE_PAYMENT_METHOD':
            return { ...state, paymentMethods: state.paymentMethods.map(p => p._id === action.payload._id ? action.payload : p) };
        case 'DELETE_PAYMENT_METHOD':
            return { ...state, paymentMethods: state.paymentMethods.filter(p => p._id !== action.payload) };
        case 'ADD_INVESTMENT_PLAN':
            return { ...state, investmentPlans: [action.payload, ...state.investmentPlans] };
        case 'UPDATE_INVESTMENT_PLAN':
            return { ...state, investmentPlans: state.investmentPlans.map(p => p._id === action.payload._id ? action.payload : p) };
        case 'DELETE_INVESTMENT_PLAN':
            return { ...state, investmentPlans: state.investmentPlans.filter(p => p._id !== action.payload) };
        case 'PURCHASE_PLAN': {
            const { userId, planId } = action.payload;
            const user = state.users.find(u => u._id === userId);
            const plan = state.investmentPlans.find(p => p._id === planId);
            if (!user || !plan || user.walletBalance < plan.price) {
                alert('Purchase failed. Insufficient funds or plan not found.');
                return state;
            }
            const updatedUser = { ...user, walletBalance: user.walletBalance - plan.price, activePlan: plan.name };
            const newTransaction: Transaction = { _id: `TRN${Date.now()}`, userId: userId, userName: user.username, type: 'Plan Purchase', amount: -plan.price, date: new Date().toISOString().split('T')[0], description: `Purchased ${plan.name}`, status: 'Approved' };
            const updatedUsers = state.users.map(u => u._id === userId ? updatedUser : u);
            alert(`${plan.name} purchased successfully!`);
            return { ...state, users: updatedUsers, transactions: [newTransaction, ...state.transactions], currentUser: updatedUsers.find(u => u._id === state.currentUser?._id) || state.currentUser };
        }
        case 'ADD_RULE':
            return { ...state, rules: [action.payload, ...state.rules] };
        case 'DELETE_RULE':
            return { ...state, rules: state.rules.filter(r => r._id !== action.payload) };
        case 'MANUAL_WALLET_ADJUSTMENT': {
            const { userId, amount, description } = action.payload;
            const user = state.users.find(u => u._id === userId);
            if (!user) return state;
            const newUsers = state.users.map(u => u._id === userId ? { ...u, walletBalance: u.walletBalance + amount } : u );
            const newTransaction: Transaction = { _id: `TRN${Date.now()}`, userId: userId, userName: user.username, type: amount > 0 ? 'Manual Credit' : 'Manual Debit', amount: amount, date: new Date().toISOString().split('T')[0], description: description, status: 'Approved' };
            return { ...state, users: newUsers, transactions: [newTransaction, ...state.transactions], currentUser: newUsers.find(u => u._id === state.currentUser?._id) || state.currentUser };
        }
        case 'UPDATE_SETTINGS':
            return { ...state, settings: { ...state.settings, ...action.payload } };
        case 'ADD_TRANSFER': {
            const { senderId, recipientId, amount, senderName, recipientName } = action.payload;
            const sender = state.users.find(u => u._id === senderId);
            if (!sender || sender.walletBalance < amount) {
                alert('Action failed: Sender not found or insufficient balance.');
                return state;
            }
            const newTransfer: Transfer = { ...action.payload, _id: `TRF${Date.now()}`, status: Status.Pending, date: new Date().toISOString().split('T')[0] };
            const updatedUsers = state.users.map(u => u._id === senderId ? { ...u, walletBalance: u.walletBalance - amount } : u);
            const newTransaction: Transaction = { _id: `TRN${Date.now()}`, userId: senderId, userName: sender.username, type: 'Transfer Request', amount: -amount, date: newTransfer.date, description: `Transfer to ${recipientName} #${newTransfer._id}`, status: 'Pending' };
            return { ...state, transfers: [newTransfer, ...state.transfers], users: updatedUsers, transactions: [newTransaction, ...state.transactions], currentUser: updatedUsers.find(u => u._id === state.currentUser?._id) || state.currentUser };
        }
        case 'UPDATE_TRANSFER': {
            const updatedTransfer = action.payload;
            return { ...state, transfers: state.transfers.map(t => t._id === updatedTransfer._id ? updatedTransfer : t) };
        }

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
            try {
                const [users, deposits, transactions, notifications] = await Promise.all([
                    getUsers(),
                    getDeposits(),
                    getTransactions(),
                    getNotifications()
                ]);
                dispatch({ type: 'SET_USERS', payload: users });
                dispatch({ type: 'SET_DEPOSITS', payload: deposits });
                dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
                dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                // Optionally show an error message to the user
            }
        };

        fetchInitialData();
    }, []);

    return (
        <DataContext.Provider value={{ state, dispatch }}>
            {children}
        </DataContext.Provider>
    );
};