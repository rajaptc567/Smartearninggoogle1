
import { User, Deposit, Transaction, Notification, Withdrawal, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, UserRestrictions, Currency, Task } from '../types';

/**
 * SMART API CONFIGURATION
 * Dynamically detects the environment to point to the correct backend.
 */
function getApiBaseUrl() {
  const hostname = window.location.hostname;
  
  // Detect if we are in a local or cloud development environment
  const isDevelopment = 
    hostname === 'localhost' || 
    hostname === '127.0.0.1' || 
    hostname.includes('webcontainer.io') || 
    hostname.includes('stackblitz.io') || 
    hostname.includes('gitpod.io') ||
    hostname.includes('preview.aistudiocdn.com');

  if (isDevelopment) {
    // In local dev, we default to the standard Node.js port
    return 'http://localhost:5000/api/v1';
  }
  
  // Production URL
  return 'https://smartearning-api.onrender.com/api/v1';
}

export function getUploadsBaseUrl() {
    const hostname = window.location.hostname;
    const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('webcontainer.io');
    
    return isDevelopment ? 'http://localhost:5000' : 'https://smartearning-api.onrender.com';
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

/**
 * ROBUST RESPONSE HANDLER
 * Differentiates between actual API errors and network connectivity issues.
 */
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
         // Handle Render.com "Service Unavailable" or "Waking Up" HTML pages
         if (text.includes('Service Unavailable') || response.status === 503 || response.status === 502) {
             throw new Error("Backend server is currently waking up or under maintenance. Please try again in 30 seconds.");
         }
         throw new Error(`Connection Error: Server returned non-JSON response (${response.status}).`);
    }
};

/**
 * WRAPPED FETCH
 * Catches the low-level 'Failed to fetch' error and provides user-friendly feedback.
 */
const safeFetch = async (url: string, options?: RequestInit) => {
    try {
        const response = await fetch(url, options);
        return await handleResponse(response);
    } catch (err: any) {
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
            console.error("API Connectivity Error:", err);
            throw new Error("Could not connect to the SmartEarning API. Ensure the backend server is running and accessible.");
        }
        throw err;
    }
};

// --- [Sync API Functions] ---
export const getDataVersion = async (): Promise<number> => {
    try {
        const result = await safeFetch(`${API_BASE_URL}/settings/version`);
        return result.version;
    } catch (e) {
        return 0; 
    }
};

// --- [User API Functions] ---
export const getUsers = async (): Promise<User[]> => {
    const result = await safeFetch(`${API_BASE_URL}/users`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createUser = async (userData: Partial<User>): Promise<User> => {
    const result = await safeFetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(userData),
    });
    return result.data;
};

export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    const result = await safeFetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(userData),
    });
    return result.data;
};

export const bulkUpdateUserRestrictions = async (payload: any): Promise<{ message: string }> => {
    return await safeFetch(`${API_BASE_URL}/users/bulk-restrictions`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
};

export const createBulkDummyUsers = async (payload: any): Promise<{ count: number; message: string }> => {
    return await safeFetch(`${API_BASE_URL}/users/bulk-dummy`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
};

export const deleteUser = async (id: string): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

export const bulkDeleteUsers = async (ids: string[]): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/users/bulk`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ ids }),
    });
    return result.data;
};

export const login = async (email: string, password: string): Promise<{ token: string; data: User }> => {
    const result = await safeFetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    return { token: result.token, data: result.data };
};

export const adjustUserWallet = async (id: string, adjustmentData: any): Promise<{ user: User; transaction: Transaction }> => {
    const result = await safeFetch(`${API_BASE_URL}/users/${id}/adjust-wallet`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(adjustmentData),
    });
    return result.data;
};

export const purchasePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const result = await safeFetch(`${API_BASE_URL}/users/${userId}/purchase-plan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId }),
    });
    return result.data;
};

export const adminActivatePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const result = await safeFetch(`${API_BASE_URL}/users/${userId}/activate-plan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId }),
    });
    return result.data;
};

export const userRequestPasswordReset = async (email: string): Promise<void> => {
    await safeFetch(`${API_BASE_URL}/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
};

export const adminInitiatePasswordReset = async (userId: string): Promise<{ resetToken: string }> => {
    const result = await safeFetch(`${API_BASE_URL}/users/${userId}/admin-reset-password`, {
        method: 'POST',
        headers: getHeaders()
    });
    return result.data;
};

export const verifyResetToken = async (token: string): Promise<void> => {
    await safeFetch(`${API_BASE_URL}/verify-reset-token/${token}`, {
        method: 'POST'
    });
};

export const resetPasswordWithToken = async (token: string, password: string): Promise<void> => {
    await safeFetch(`${API_BASE_URL}/reset-password/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
};

// --- [Deposit API Functions] ---
export const getDeposits = async (): Promise<Deposit[]> => {
    const result = await safeFetch(`${API_BASE_URL}/deposits`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createDeposit = async (formData: FormData): Promise<{ deposit: Deposit; transaction: Transaction }> => {
    const result = await safeFetch(`${API_BASE_URL}/deposits`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    return result.data;
};

export const updateDeposit = async (id: string, updateData: any): Promise<{ deposit: Deposit; user: User }> => {
    const result = await safeFetch(`${API_BASE_URL}/deposits/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    return result.data;
};

// --- [Withdrawal API Functions] ---
export const getWithdrawals = async (): Promise<Withdrawal[]> => {
    const result = await safeFetch(`${API_BASE_URL}/withdrawals`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createWithdrawal = async (withdrawalData: Partial<Withdrawal>): Promise<{ withdrawal: Withdrawal; user: User; transaction: Transaction }> => {
    const result = await safeFetch(`${API_BASE_URL}/withdrawals`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(withdrawalData),
    });
    return result.data;
};

export const updateWithdrawal = async (id: string, updateData: any): Promise<{ withdrawal: Withdrawal; user: User }> => {
    const result = await safeFetch(`${API_BASE_URL}/withdrawals/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    return result.data;
};

// --- [Transaction API Functions] ---
export const getTransactions = async (): Promise<Transaction[]> => {
    const result = await safeFetch(`${API_BASE_URL}/transactions`, {
        headers: getHeaders()
    });
    return result.data;
};

// --- [Notification API Functions] ---
export const getNotifications = async (): Promise<Notification[]> => {
    const result = await safeFetch(`${API_BASE_URL}/notifications`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createNotification = async (notifData: any): Promise<{ count: number; data: Notification[] }> => {
    return await safeFetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(notifData),
    });
};

export const sendAdminNotification = createNotification;

export const updateNotification = async (id: string, updateData: Partial<Notification>): Promise<Notification> => {
    const result = await safeFetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    return result.data;
};

export const deleteNotification = async (id: string): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

export const markNotificationsAsRead = async (userId: string): Promise<Notification[]> => {
    const result = await safeFetch(`${API_BASE_URL}/notifications/read/${userId}`, {
        method: 'PUT',
        headers: getHeaders()
    });
    return result.data;
};

export const markNotificationPopupAsShown = async (id: string): Promise<Notification[]> => {
    const result = await safeFetch(`${API_BASE_URL}/notifications/popup-shown/${id}`, {
        method: 'PUT',
        headers: getHeaders()
    });
    return result.data;
};

// --- [Payment Method API Functions] ---
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const result = await safeFetch(`${API_BASE_URL}/payment-methods`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createPaymentMethod = async (formData: FormData): Promise<PaymentMethod> => {
    const result = await safeFetch(`${API_BASE_URL}/payment-methods`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    return result.data;
};

export const updatePaymentMethod = async (id: string, formData: FormData): Promise<PaymentMethod> => {
    const result = await safeFetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'PUT',
        headers: getHeaders(true),
        body: formData,
    });
    return result.data;
};

export const deletePaymentMethod = async (id: string): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

// --- [Investment Plan API Functions] ---
export const getInvestmentPlans = async (): Promise<InvestmentPlan[]> => {
    const result = await safeFetch(`${API_BASE_URL}/investment-plans`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createInvestmentPlan = async (planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const result = await safeFetch(`${API_BASE_URL}/investment-plans`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(planData),
    });
    return result.data;
};

export const updateInvestmentPlan = async (id: string, planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const result = await safeFetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(planData),
    });
    return result.data;
};

export const deleteInvestmentPlan = async (id: string): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

// --- [Rule API Functions] ---
export const getRules = async (): Promise<Rule[]> => {
    const result = await safeFetch(`${API_BASE_URL}/rules`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createRule = async (ruleData: any): Promise<Rule> => {
    const result = await safeFetch(`${API_BASE_URL}/rules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(ruleData),
    });
    return result.data;
};

export const updateRule = async (id: string, ruleData: any): Promise<Rule> => {
    const result = await safeFetch(`${API_BASE_URL}/rules/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(ruleData),
    });
    return result.data;
};

export const deleteRule = async (id: string): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/rules/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

// --- [Settings API Functions] ---
export const getSettings = async (): Promise<Settings> => {
    const result = await safeFetch(`${API_BASE_URL}/settings`, {
        headers: getHeaders()
    });
    return result.data;
};

export const updateSettings = async (settingsData: Partial<Settings>): Promise<Settings> => {
    const result = await safeFetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settingsData),
    });
    return result.data;
};

// --- [Transfer API Functions] ---
export const getTransfers = async (): Promise<Transfer[]> => {
    const result = await safeFetch(`${API_BASE_URL}/transfers`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createTransfer = async (transferData: any): Promise<{ transfer: Transfer; user: User; transaction: Transaction }> => {
    const result = await safeFetch(`${API_BASE_URL}/transfers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(transferData),
    });
    return result.data;
};

export const updateTransfer = async (id: string, updateData: any): Promise<{ transfer: Transfer; sender: User; recipient: User; transaction: Transaction }> => {
    const result = await safeFetch(`${API_BASE_URL}/transfers/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
    });
    return result.data;
};

// --- [Log API Functions] ---
export const getLogs = async (): Promise<Log[]> => {
    const result = await safeFetch(`${API_BASE_URL}/logs`, {
        headers: getHeaders()
    });
    return result.data;
};

export const clearLogs = async (): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/logs`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

// --- [Password Reset Request API Functions] ---
export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
    const result = await safeFetch(`${API_BASE_URL}/password-reset-requests`, {
        headers: getHeaders()
    });
    return result.data;
};

export const deletePasswordResetRequest = async (id: string): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/password-reset-requests/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

// --- [Dispute API Functions] ---
export const getDisputes = async (): Promise<Dispute[]> => {
    const result = await safeFetch(`${API_BASE_URL}/disputes`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createDispute = async (formData: FormData): Promise<Dispute> => {
    const result = await safeFetch(`${API_BASE_URL}/disputes`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    return result.data;
};

export const updateDispute = async (id: string, formDataOrData: any): Promise<Dispute> => {
    const isFormData = formDataOrData instanceof FormData;
    return await safeFetch(`${API_BASE_URL}/disputes/${id}`, {
        method: 'PUT',
        headers: getHeaders(isFormData),
        body: isFormData ? formDataOrData : JSON.stringify(formDataOrData),
    });
};

export const markDisputeAsRead = async (id: string, role: 'admin' | 'user'): Promise<Dispute> => {
    return await safeFetch(`${API_BASE_URL}/disputes/${id}/read`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role }),
    });
};

// --- [Task API Functions] ---
export const getTasks = async (): Promise<Task[]> => {
    const result = await safeFetch(`${API_BASE_URL}/tasks`, {
        headers: getHeaders()
    });
    return result.data;
};

export const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    const result = await safeFetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(taskData),
    });
    return result.data;
};

export const updateTask = async (id: string, taskData: Partial<Task>): Promise<Task> => {
    const result = await safeFetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(taskData),
    });
    return result.data;
};

export const deleteTask = async (id: string): Promise<{}> => {
    const result = await safeFetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return result.data;
};

export const completeTask = async (taskId: string, userId: string, proof?: File): Promise<User> => {
    const formData = new FormData();
    formData.append('userId', userId);
    if (proof) {
        formData.append('proof', proof);
    }
    
    const result = await safeFetch(`${API_BASE_URL}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });
    return result.data;
};

export const getPendingTaskVerifications = async (): Promise<any[]> => {
    const result = await safeFetch(`${API_BASE_URL}/tasks/pending-verifications`, {
        headers: getHeaders()
    });
    return result.data;
};

export const verifyTask = async (userId: string, taskId: string, status: 'Approved' | 'Rejected', adminNotes: string): Promise<User> => {
    const result = await safeFetch(`${API_BASE_URL}/tasks/verify/${userId}/${taskId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status, adminNotes }),
    });
    return result.data;
};
