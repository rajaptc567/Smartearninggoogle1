
import { User, Deposit, Transaction, Notification, Withdrawal, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, UserRestrictions, Currency, Task } from '../types';

function getApiBaseUrl() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api/v1';
  }
  return 'https://smartearning-api.onrender.com/api/v1';
}

export function getUploadsBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://smartearning-api.onrender.com';
}

const API_BASE_URL = getApiBaseUrl();

/**
 * GLOBAL FETCH WRAPPER
 * This function handles all API communication. 
 * It ensures 'credentials: include' is applied to every request, 
 * which is mandatory for HttpOnly cookie-based authentication.
 */
async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Explicitly merge options while forcing credentials to 'include'
    const fetchOptions: RequestInit = {
        ...options,
        credentials: 'include', // Ensure cookies are sent/received cross-origin
        headers: {
            // Default to JSON unless sending FormData
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...options.headers,
        }
    };

    try {
        const response = await fetch(url, fetchOptions);
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || response.statusText);
            }
            return data;
        } else {
            const text = await response.text();
            if (!response.ok) {
                throw new Error(text || response.statusText);
            }
            return text;
        }
    } catch (error) {
        // Log the specific endpoint that failed to help with debugging
        console.error(`API Call Failed [${endpoint}]:`, error);
        throw error;
    }
}

// --- [Sync API Functions] ---
export const getDataVersion = async (): Promise<number> => {
    try {
        const result = await apiFetch('/settings/version');
        return result.version || 0;
    } catch (e) {
        return 0;
    }
};

// --- [User API Functions] ---
export const getUsers = async (): Promise<User[]> => {
    const result = await apiFetch('/users');
    return result.data;
};

export const createUser = async (userData: Partial<User>): Promise<User> => {
    const result = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(userData),
    });
    return result.data;
};

export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    const result = await apiFetch(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
    });
    return result.data;
};

export const bulkUpdateUserRestrictions = async (payload: any): Promise<{ message: string }> => {
    return await apiFetch('/users/bulk-restrictions', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
};

export const createBulkDummyUsers = async (payload: any): Promise<{ count: number; message: string }> => {
    return await apiFetch('/users/bulk-dummy', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const deleteUser = async (id: string): Promise<{}> => {
    const result = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    return result.data;
};

export const bulkDeleteUsers = async (ids: string[]): Promise<{}> => {
    const result = await apiFetch('/users/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
    });
    return result.data;
};

export const login = async (email: string, password: string): Promise<User> => {
    const result = await apiFetch('/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    return result.data;
};

export const adjustUserWallet = async (id: string, adjustmentData: any): Promise<{ user: User; transaction: Transaction }> => {
    const result = await apiFetch(`/users/${id}/adjust-wallet`, {
        method: 'POST',
        body: JSON.stringify(adjustmentData),
    });
    return result.data;
};

export const purchasePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const result = await apiFetch(`/users/${userId}/purchase-plan`, {
        method: 'POST',
        body: JSON.stringify({ planId }),
    });
    return result.data;
};

export const adminActivatePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const result = await apiFetch(`/users/${userId}/activate-plan`, {
        method: 'POST',
        body: JSON.stringify({ planId }),
    });
    return result.data;
};

export const userRequestPasswordReset = async (email: string): Promise<void> => {
    await apiFetch('/users/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
};

export const adminInitiatePasswordReset = async (userId: string): Promise<{ resetToken: string }> => {
    const result = await apiFetch(`/users/${userId}/admin-reset-password`, {
        method: 'POST',
    });
    return result.data;
};

export const verifyResetToken = async (token: string): Promise<void> => {
    await apiFetch(`/users/verify-reset-token/${token}`, { method: 'POST' });
};

export const resetPasswordWithToken = async (token: string, password: string): Promise<void> => {
    await apiFetch(`/users/reset-password/${token}`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
    });
};

// --- [Deposit API Functions] ---
export const getDeposits = async (): Promise<Deposit[]> => {
    const result = await apiFetch('/deposits');
    return result.data;
};

export const createDeposit = async (formData: FormData): Promise<{ deposit: Deposit; transaction: Transaction }> => {
    const result = await apiFetch('/deposits', {
        method: 'POST',
        body: formData,
    });
    return result.data;
};

export const updateDeposit = async (id: string, updateData: any): Promise<{ deposit: Deposit; user: User }> => {
    const result = await apiFetch(`/deposits/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
    });
    return result.data;
};

// --- [Withdrawal API Functions] ---
export const getWithdrawals = async (): Promise<Withdrawal[]> => {
    const result = await apiFetch('/withdrawals');
    return result.data;
};

export const createWithdrawal = async (withdrawalData: Partial<Withdrawal>): Promise<{ withdrawal: Withdrawal; user: User; transaction: Transaction }> => {
    const result = await apiFetch('/withdrawals', {
        method: 'POST',
        body: JSON.stringify(withdrawalData),
    });
    return result.data;
};

export const updateWithdrawal = async (id: string, updateData: any): Promise<{ withdrawal: Withdrawal; user: User }> => {
    const result = await apiFetch(`/withdrawals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
    });
    return result.data;
};

// --- [Transaction API Functions] ---
export const getTransactions = async (): Promise<Transaction[]> => {
    const result = await apiFetch('/transactions');
    return result.data;
};

// --- [Notification API Functions] ---
export const getNotifications = async (): Promise<Notification[]> => {
    const result = await apiFetch('/notifications');
    return result.data;
};

export const createNotification = async (notifData: any): Promise<{ count: number; data: Notification[] }> => {
    return await apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify(notifData),
    });
};

export const sendAdminNotification = createNotification;

export const updateNotification = async (id: string, updateData: Partial<Notification>): Promise<Notification> => {
    const result = await apiFetch(`/notifications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
    });
    return result.data;
};

export const deleteNotification = async (id: string): Promise<{}> => {
    const result = await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
    return result.data;
};

export const markNotificationsAsRead = async (userId: string): Promise<Notification[]> => {
    const result = await apiFetch(`/notifications/read/${userId}`, { method: 'PUT' });
    return result.data;
};

export const markNotificationPopupAsShown = async (id: string): Promise<Notification[]> => {
    const result = await apiFetch(`/notifications/popup-shown/${id}`, { method: 'PUT' });
    return result.data;
};

// --- [Payment Method API Functions] ---
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const result = await apiFetch('/payment-methods');
    return result.data;
};

export const createPaymentMethod = async (formData: FormData): Promise<PaymentMethod> => {
    const result = await apiFetch('/payment-methods', {
        method: 'POST',
        body: formData,
    });
    return result.data;
};

export const updatePaymentMethod = async (id: string, formData: FormData): Promise<PaymentMethod> => {
    const result = await apiFetch(`/payment-methods/${id}`, {
        method: 'PUT',
        body: formData,
    });
    return result.data;
};

export const deletePaymentMethod = async (id: string): Promise<{}> => {
    const result = await apiFetch(`/payment-methods/${id}`, { method: 'DELETE' });
    return result.data;
};

// --- [Investment Plan API Functions] ---
export const getInvestmentPlans = async (): Promise<InvestmentPlan[]> => {
    const result = await apiFetch('/investment-plans');
    return result.data;
};

export const createInvestmentPlan = async (planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const result = await apiFetch('/investment-plans', {
        method: 'POST',
        body: JSON.stringify(planData),
    });
    return result.data;
};

export const updateInvestmentPlan = async (id: string, planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const result = await apiFetch(`/investment-plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(planData),
    });
    return result.data;
};

export const deleteInvestmentPlan = async (id: string): Promise<{}> => {
    const result = await apiFetch(`/investment-plans/${id}`, { method: 'DELETE' });
    return result.data;
};

// --- [Rule API Functions] ---
export const getRules = async (): Promise<Rule[]> => {
    const result = await apiFetch('/rules');
    return result.data;
};

export const createRule = async (ruleData: any): Promise<Rule> => {
    const result = await apiFetch('/rules', {
        method: 'POST',
        body: JSON.stringify(ruleData),
    });
    return result.data;
};

export const updateRule = async (id: string, ruleData: any): Promise<Rule> => {
    const result = await apiFetch(`/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(ruleData),
    });
    return result.data;
};

export const deleteRule = async (id: string): Promise<{}> => {
    const result = await apiFetch(`/rules/${id}`, { method: 'DELETE' });
    return result.data;
};

// --- [Settings API Functions] ---
export const getSettings = async (): Promise<Settings> => {
    const result = await apiFetch('/settings');
    return result.data;
};

export const updateSettings = async (settingsData: Partial<Settings>): Promise<Settings> => {
    const result = await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsData),
    });
    return result.data;
};

// --- [Transfer API Functions] ---
export const getTransfers = async (): Promise<Transfer[]> => {
    const result = await apiFetch('/transfers');
    return result.data;
};

export const createTransfer = async (transferData: any): Promise<{ transfer: Transfer; user: User; transaction: Transaction }> => {
    const result = await apiFetch('/transfers', {
        method: 'POST',
        body: JSON.stringify(transferData),
    });
    return result.data;
};

export const updateTransfer = async (id: string, updateData: any): Promise<{ transfer: Transfer; sender: User; recipient: User; transaction: Transaction }> => {
    const result = await apiFetch(`/transfers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
    });
    return result.data;
};

// --- [Log API Functions] ---
export const getLogs = async (): Promise<Log[]> => {
    const result = await apiFetch('/logs');
    return result.data;
};

export const clearLogs = async (): Promise<{}> => {
    const result = await apiFetch('/logs', { method: 'DELETE' });
    return result.data;
};

// --- [Password Reset Request API Functions] ---
export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
    const result = await apiFetch('/password-reset-requests');
    return result.data;
};

export const deletePasswordResetRequest = async (id: string): Promise<{}> => {
    const result = await apiFetch(`/password-reset-requests/${id}`, { method: 'DELETE' });
    return result.data;
};

// --- [Dispute API Functions] ---
export const getDisputes = async (): Promise<Dispute[]> => {
    const result = await apiFetch('/disputes');
    return result.data;
};

export const createDispute = async (formData: FormData): Promise<Dispute> => {
    const result = await apiFetch('/disputes', {
        method: 'POST',
        body: formData,
    });
    return result.data;
};

export const updateDispute = async (id: string, formDataOrData: any): Promise<Dispute> => {
    const result = await apiFetch(`/disputes/${id}`, {
        method: 'PUT',
        body: formDataOrData instanceof FormData ? formDataOrData : JSON.stringify(formDataOrData),
    });
    return result.data;
};

export const markDisputeAsRead = async (id: string, role: 'admin' | 'user'): Promise<Dispute> => {
    const result = await apiFetch(`/disputes/${id}/read`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
    });
    return result.data;
};

// --- [Task API Functions] ---
export const getTasks = async (): Promise<Task[]> => {
    const result = await apiFetch('/tasks');
    return result.data;
};

export const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    const result = await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
    });
    return result.data;
};

export const updateTask = async (id: string, taskData: Partial<Task>): Promise<Task> => {
    const result = await apiFetch(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(taskData),
    });
    return result.data;
};

export const deleteTask = async (id: string): Promise<{}> => {
    const result = await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    return result.data;
};

export const completeTask = async (taskId: string, userId: string, proof?: File): Promise<User> => {
    const formData = new FormData();
    formData.append('userId', userId);
    if (proof) {
        formData.append('proof', proof);
    }
    
    const result = await apiFetch(`/tasks/${taskId}/complete`, {
        method: 'POST',
        body: formData,
    });
    return result.data;
};

export const getPendingTaskVerifications = async (): Promise<any[]> => {
    const result = await apiFetch('/tasks/pending-verifications');
    return result.data;
};

export const verifyTask = async (userId: string, taskId: string, status: 'Approved' | 'Rejected', adminNotes: string): Promise<User> => {
    const result = await apiFetch(`/tasks/verify/${userId}/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status, adminNotes }),
    });
    return result.data;
};
