import { User, Deposit, Transaction, Notification, Withdrawal, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, UserRestrictions, Currency, Task } from '../types';

// Production configuration: Uses environment variable for backend routing with robust fallbacks.
const getBaseUrl = (): string => {
    // 1. Check process.env.REACT_APP_API_URL or VITE_API_URL (which will be injected by vite.config.ts if set)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        const envUrl = process.env.REACT_APP_API_URL || process.env.VITE_API_URL;
        if (envUrl) return envUrl;
    }
    
    // 2. Check window.location to see if we can fallback to localhost for development
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:5000'; // Default local backend port
        }
    }

    return 'https://smartearning-api.onrender.com';
};

const BASE_URL = getBaseUrl();

function getApiBaseUrl() {
  return `${BASE_URL}/api/v1`;
}

export function getUploadsBaseUrl() {
    return BASE_URL;
}

const API_BASE_URL = getApiBaseUrl();

// Helper to get Auth Headers
const getHeaders = (isMultipart = false) => {
    const headers: any = {};
    if (!isMultipart) {
        headers['Content-Type'] = 'application/json';
    }
    
    const token = localStorage.getItem('authToken');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const handleResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
            const error = (data && data.error) || response.statusText;
            throw new Error(error);
        }
        return data; 
    } else {
         const text = await response.text();
         throw new Error(`Expected JSON, but got ${response.statusText}. Response: ${text.substring(0, 100)}...`);
    }
};

// --- [Sync API Functions] ---
export const getDataVersion = async (): Promise<number> => {
    try {
        const response = await fetch(`${API_BASE_URL}/settings/version`);
        const result = await handleResponse(response);
        return result.version;
    } catch (e) {
        return 0; 
    }
};

// --- [User API Functions] ---
export const getUsers = async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createUser = async (userData: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(userData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(userData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const bulkUpdateUserRestrictions = async (payload: any): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/bulk-restrictions`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
    const result = await handleResponse(response);
    return result;
};

export const createBulkDummyUsers = async (payload: any): Promise<{ count: number; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/bulk-dummy`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
    const result = await handleResponse(response);
    return result;
};

export const deleteUser = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const bulkDeleteUsers = async (ids: string[]): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/users/bulk`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ ids }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const login = async (email: string, password: string): Promise<{ token: string; data: User }> => {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const result = await handleResponse(response);
    return { token: result.token, data: result.data };
};

export const adjustUserWallet = async (id: string, adjustmentData: any): Promise<{ user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}/adjust-wallet`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(adjustmentData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const purchasePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/purchase-plan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const adminActivatePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/activate-plan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const userRequestPasswordReset = async (email: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    await handleResponse(response);
};

export const adminInitiatePasswordReset = async (userId: string): Promise<{ resetToken: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/admin-reset-password`, {
        method: 'POST',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const verifyResetToken = async (token: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/verify-reset-token/${token}`, {
        method: 'POST'
    });
    await handleResponse(response);
};

export const resetPasswordWithToken = async (token: string, password: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/reset-password/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    await handleResponse(response);
};

// --- [Deposit API Functions] ---
export const getDeposits = async (): Promise<Deposit[]> => {
    const response = await fetch(`${API_BASE_URL}/deposits`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createDeposit = async (formData: FormData): Promise<{ deposit: Deposit; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/deposits`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateDeposit = async (id: string, updateData: any): Promise<{ deposit: Deposit; user: User }> => {
    const response = await fetch(`${API_BASE_URL}/deposits/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Withdrawal API Functions] ---
export const getWithdrawals = async (): Promise<Withdrawal[]> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createWithdrawal = async (withdrawalData: Partial<Withdrawal>): Promise<{ withdrawal: Withdrawal; user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(withdrawalData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateWithdrawal = async (id: string, updateData: any): Promise<{ withdrawal: Withdrawal; user: User }> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Transaction API Functions] ---
export const getTransactions = async (): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE_URL}/transactions`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Notification API Functions] ---
export const getNotifications = async (): Promise<Notification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createNotification = async (notifData: any): Promise<{ count: number; data: Notification[] }> => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(notifData),
    });
    return await handleResponse(response);
};

export const sendAdminNotification = createNotification;

export const updateNotification = async (id: string, updateData: Partial<Notification>): Promise<Notification> => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteNotification = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const markNotificationsAsRead = async (userId: string): Promise<Notification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications/read/${userId}`, {
        method: 'PUT',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const markNotificationPopupAsShown = async (id: string): Promise<Notification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications/popup-shown/${id}`, {
        method: 'PUT',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Payment Method API Functions] ---
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createPaymentMethod = async (formData: FormData): Promise<PaymentMethod> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updatePaymentMethod = async (id: string, formData: FormData): Promise<PaymentMethod> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'PUT',
        headers: getHeaders(true),
        body: formData,
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deletePaymentMethod = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Investment Plan API Functions] ---
export const getInvestmentPlans = async (): Promise<InvestmentPlan[]> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createInvestmentPlan = async (planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(planData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateInvestmentPlan = async (id: string, planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(planData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteInvestmentPlan = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Rule API Functions] ---
export const getRules = async (): Promise<Rule[]> => {
    const response = await fetch(`${API_BASE_URL}/rules`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createRule = async (ruleData: any): Promise<Rule> => {
    const response = await fetch(`${API_BASE_URL}/rules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(ruleData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateRule = async (id: string, ruleData: any): Promise<Rule> => {
    const response = await fetch(`${API_BASE_URL}/rules/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(ruleData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteRule = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/rules/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Settings API Functions] ---
export const getSettings = async (): Promise<Settings> => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateSettings = async (settingsData: Partial<Settings>): Promise<Settings> => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settingsData),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Transfer API Functions] ---
export const getTransfers = async (): Promise<Transfer[]> => {
    const response = await fetch(`${API_BASE_URL}/transfers`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createTransfer = async (transferData: any): Promise<{ transfer: Transfer; user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/transfers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(transferData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateTransfer = async (id: string, updateData: any): Promise<{ transfer: Transfer; sender: User; recipient: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/transfers/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Log API Functions] ---
export const getLogs = async (): Promise<Log[]> => {
    const response = await fetch(`${API_BASE_URL}/logs`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const clearLogs = async (): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/logs`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Password Reset Request API Functions] ---
export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
    const response = await fetch(`${API_BASE_URL}/password-reset-requests`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deletePasswordResetRequest = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/password-reset-requests/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Dispute API Functions] ---
export const getDisputes = async (): Promise<Dispute[]> => {
    const response = await fetch(`${API_BASE_URL}/disputes`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createDispute = async (formData: FormData): Promise<Dispute> => {
    const response = await fetch(`${API_BASE_URL}/disputes`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateDispute = async (id: string, formDataOrData: any): Promise<Dispute> => {
    const isFormData = formDataOrData instanceof FormData;
    const response = await fetch(`${API_BASE_URL}/disputes/${id}`, {
        method: 'PUT',
        headers: getHeaders(isFormData),
        body: isFormData ? formDataOrData : JSON.stringify(formDataOrData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const markDisputeAsRead = async (id: string, role: 'admin' | 'user'): Promise<Dispute> => {
    const response = await fetch(`${API_BASE_URL}/disputes/${id}/read`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role }),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- [Task API Functions] ---
export const getTasks = async (): Promise<Task[]> => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(taskData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateTask = async (id: string, taskData: Partial<Task>): Promise<Task> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(taskData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteTask = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const completeTask = async (taskId: string, userId: string, proof?: File): Promise<User> => {
    const formData = new FormData();
    formData.append('userId', userId);
    if (proof) {
        formData.append('proof', proof);
    }
    
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    const result = await handleResponse(response);
    return result.data;
};

export const getPendingTaskVerifications = async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/tasks/pending-verifications`, {
        headers: getHeaders()
    });
    const result = await handleResponse(response);
    return result.data;
};

export const verifyTask = async (userId: string, taskId: string, status: 'Approved' | 'Rejected', adminNotes: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/tasks/verify/${userId}/${taskId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status, adminNotes }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const sendCustomAdminMessage = async (msgData: { toEmail?: string; toPhone?: string; subject?: string; messageText: string }): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/send-custom-message`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(msgData)
    });
    return await handleResponse(response);
};