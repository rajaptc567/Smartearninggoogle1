
import { User, Deposit, Transaction, Notification, Withdrawal, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, UserRestrictions, Currency, Status } from '../types';

const API_BASE_URL = 'http://localhost:5000/api/v1';
const BASE_URL = 'http://localhost:5000';

export function getUploadsBaseUrl() {
    return BASE_URL;
}

// Generic Request Helper
async function request<T>(endpoint: string, method: string = 'GET', body?: any, isFormData: boolean = false): Promise<T> {
    const headers: HeadersInit = {};
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
        method,
        headers,
    };

    if (body) {
        config.body = isFormData ? body : JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'API Request Failed');
        }

        return result.data;
    } catch (error) {
        console.error(`API Request failed for ${endpoint}:`, error);
        throw error;
    }
}

// --- USERS ---
export const getUsers = () => request<User[]>('/users');
export const getUser = (id: string) => request<User>(`/users/${id}`);
export const createUser = (userData: Partial<User>) => request<User>('/users', 'POST', userData);
export const updateUser = (id: string, userData: Partial<User>) => request<User>(`/users/${id}`, 'PUT', userData);
export const deleteUser = (id: string) => request(`/users/${id}`, 'DELETE');
export const login = (email: string, password: string) => request<User>('/users/login', 'POST', { email, password });
export const adjustUserWallet = (id: string, data: { amount: number; description: string }) => request<{ user: User; transaction: Transaction }>(`/users/${id}/adjust-wallet`, 'POST', data);
export const purchasePlan = (userId: string, planId: string) => request<{ user: User; transaction: Transaction }>(`/users/${userId}/purchase-plan`, 'POST', { planId });
export const adminInitiatePasswordReset = (id: string) => request<{ resetToken: string }>(`/users/${id}/admin-reset-password`, 'POST');
export const userRequestPasswordReset = (email: string) => request<{ message: string }>('/users/request-password-reset', 'POST', { email });
export const verifyResetToken = (token: string) => request<string>(`/users/verify-reset-token/${token}`, 'POST');
export const resetPasswordWithToken = (token: string, password: string) => request<{ message: string }>(`/users/reset-password/${token}`, 'PUT', { password });
export const bulkUpdateUserRestrictions = (payload: any) => request<{ message: string }>('/users/bulk-restrictions', 'PUT', payload);

// --- DEPOSITS ---
export const getDeposits = () => request<Deposit[]>('/deposits');
export const getDeposit = (id: string) => request<Deposit>(`/deposits/${id}`);
export const createDeposit = (formData: FormData) => request<{ deposit: Deposit; transaction: Transaction }>('/deposits', 'POST', formData, true);
export const updateDeposit = (id: string, data: Partial<Deposit>) => request<{ deposit: Deposit; user: User }>(`/deposits/${id}`, 'PUT', data);
export const deleteDeposit = (id: string) => request(`/deposits/${id}`, 'DELETE');

// --- WITHDRAWALS ---
export const getWithdrawals = () => request<Withdrawal[]>('/withdrawals');
export const getWithdrawal = (id: string) => request<Withdrawal>(`/withdrawals/${id}`);
export const createWithdrawal = (data: Partial<Withdrawal>) => request<{ withdrawal: Withdrawal; user: User; transaction: Transaction }>('/withdrawals', 'POST', data);
export const updateWithdrawal = (id: string, data: Partial<Withdrawal>) => request<{ withdrawal: Withdrawal; user: User }>(`/withdrawals/${id}`, 'PUT', data);
export const deleteWithdrawal = (id: string) => request(`/withdrawals/${id}`, 'DELETE');

// --- TRANSACTIONS ---
export const getTransactions = () => request<Transaction[]>('/transactions');

// --- NOTIFICATIONS ---
export const getNotifications = () => request<Notification[]>('/notifications');
export const sendAdminNotification = (data: any) => request<{ count: number; data: Notification[] }>('/notifications', 'POST', data);
export const updateNotification = (id: string, data: any) => request<Notification>(`/notifications/${id}`, 'PUT', data);
export const markNotificationsAsRead = (userId: string) => request<Notification[]>(`/notifications/read/${userId}`, 'PUT');
export const markNotificationPopupAsShown = (id: string) => request<Notification[]>(`/notifications/popup-shown/${id}`, 'PUT');

// --- PAYMENT METHODS ---
export const getPaymentMethods = () => request<PaymentMethod[]>('/payment-methods');
export const createPaymentMethod = (data: any) => request<PaymentMethod>('/payment-methods', 'POST', data);
export const updatePaymentMethod = (id: string, data: any) => request<PaymentMethod>(`/payment-methods/${id}`, 'PUT', data);
export const deletePaymentMethod = (id: string) => request(`/payment-methods/${id}`, 'DELETE');

// --- INVESTMENT PLANS ---
export const getInvestmentPlans = () => request<InvestmentPlan[]>('/investment-plans');
export const createInvestmentPlan = (data: any) => request<InvestmentPlan>('/investment-plans', 'POST', data);
export const updateInvestmentPlan = (id: string, data: any) => request<InvestmentPlan>(`/investment-plans/${id}`, 'PUT', data);
export const deleteInvestmentPlan = (id: string) => request(`/investment-plans/${id}`, 'DELETE');

// --- RULES ---
export const getRules = () => request<Rule[]>('/rules');
export const createRule = (data: any) => request<Rule>('/rules', 'POST', data);
export const deleteRule = (id: string) => request(`/rules/${id}`, 'DELETE');

// --- SETTINGS ---
export const getSettings = () => request<Settings>('/settings');
export const updateSettings = (data: any) => request<Settings>('/settings', 'PUT', data);

// --- TRANSFERS ---
export const getTransfers = () => request<Transfer[]>('/transfers');
export const createTransfer = (data: any) => request<{ transfer: Transfer; user: User; transaction: Transaction }>('/transfers', 'POST', data);
export const updateTransfer = (id: string, data: any) => request<{ transfer: Transfer; sender?: User; recipient?: User; transaction?: Transaction }>(`/transfers/${id}`, 'PUT', data);

// --- LOGS ---
export const getLogs = () => request<Log[]>('/logs');
export const clearLogs = () => request<[]>('/logs', 'DELETE');

// --- PASSWORD RESET REQUESTS ---
export const getPasswordResetRequests = () => request<PasswordResetRequest[]>('/password-reset-requests');
export const deletePasswordResetRequest = (id: string) => request(`/password-reset-requests/${id}`, 'DELETE');

// --- DISPUTES ---
export const getDisputes = () => request<Dispute[]>('/disputes');
export const createDispute = (data: FormData) => request<Dispute>('/disputes', 'POST', data, true);
export const updateDispute = (id: string, data: any) => request<Dispute>(`/disputes/${id}`, 'PUT', data, data instanceof FormData);
export const markDisputeAsRead = (id: string, role: string) => request<Dispute>(`/disputes/${id}/read`, 'PUT', { role });
