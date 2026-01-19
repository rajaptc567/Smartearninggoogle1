import { User, Deposit, Transaction, Notification, Withdrawal, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, UserRestrictions, Currency, Task } from '../types';
import { mockUsers } from '../data/mockData';

function getApiBaseUrl() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    return 'http://localhost:5000/api/v1';
  }
  return 'https://smartearning-api.onrender.com/api/v1';
}

export function getUploadsBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        return 'http://localhost:5000';
    }
    return 'https://smartearning-api.onrender.com';
}

const API_BASE_URL = getApiBaseUrl();

// 🛡️ SHARED NETWORK ERROR HANDLER
const isNetworkError = (error: any) => 
    !error || 
    (error instanceof Error && (
        error.name === 'TimeoutError' || 
        error.name === 'AbortError' ||
        error.message.toLowerCase().includes('failed to fetch') || 
        error.message.toLowerCase().includes('networkerror') ||
        error.message.toLowerCase().includes('load failed') ||
        error.message.includes('Technical Error') ||
        error.message.includes('unreachable')
    )) ||
    (error.status === 0);

/**
 * 🔒 SECURE WRAPPER
 */
const secureFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
        ...(options.headers || {}),
        'x-smartearning-request': 'true' // Neutralizes cookie-based CSRF attacks
    };
    return fetch(url, { ...options, headers });
};

const handleResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
            console.error(`[FRONTEND] API Error ${response.status}:`, data.error || response.statusText);
            const error = (data && data.error) || response.statusText;
            throw new Error(error);
        }
        return data; 
    } else {
         const text = await response.text();
         console.error(`[FRONTEND] Non-JSON Response (${response.status}):`, text.substring(0, 100));
         throw new Error(`SERVER_COLD`);
    }
};

export const getDataVersion = async (): Promise<number> => {
    const response = await secureFetch(`${API_BASE_URL}/settings/version`, { 
        credentials: 'include',
        signal: AbortSignal.timeout(5000)
    });
    const result = await handleResponse(response);
    return result.version;
};

export const getUsers = async (): Promise<User[]> => {
    const response = await secureFetch(`${API_BASE_URL}/users`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const getMe = async (): Promise<User> => {
    const response = await secureFetch(`${API_BASE_URL}/users/me`, { credentials: 'include', signal: AbortSignal.timeout(8000) });
    const result = await handleResponse(response);
    return result.data;
};

export const getDownline = async (username: string): Promise<any[]> => {
    const response = await secureFetch(`${API_BASE_URL}/users/downline/${username}`, { credentials: 'include', signal: AbortSignal.timeout(15000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createUser = async (userData: Partial<User>): Promise<User> => {
    const response = await secureFetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    const response = await secureFetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const bulkUpdateUserRestrictions = async (payload: any): Promise<{ message: string }> => {
    const response = await secureFetch(`${API_BASE_URL}/users/bulk-restrictions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result;
};

export const createBulkDummyUsers = async (payload: any): Promise<{ count: number; message: string }> => {
    const response = await secureFetch(`${API_BASE_URL}/users/bulk-dummy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result;
};

export const deleteUser = async (id: string): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const bulkDeleteUsers = async (ids: string[]): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/users/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

/**
 * 🔒 AUTH RESILIENCE
 */
export const login = async (email: string, password: string): Promise<User> => {
    const attemptLogin = async () => {
        const response = await secureFetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
            signal: AbortSignal.timeout(45000) 
        });
        const result = await handleResponse(response);
        return result.data;
    };

    try {
        return await attemptLogin();
    } catch (error) {
        console.error(`[FRONTEND] Login procedure failed:`, error.message);
        const isNetworkOrCold = isNetworkError(error) || error.message === 'SERVER_COLD';

        if (isNetworkOrCold) {
            // 🚀 COLD START MITIGATION: If network fails, try a simple GET ping to wake Render
            // then retry the login once after a small delay.
            try {
                console.warn("Attempting to wake secure server...");
                // mode: 'no-cors' allows pinging even if preflight fails initially
                await fetch(API_BASE_URL.replace('/api/v1', '/'), { mode: 'no-cors' });
                await new Promise(r => setTimeout(r, 2500));
                return await attemptLogin();
            } catch (retryError) {
                // Final fallback if retry fails
                const mockUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
                if (mockUser) {
                    console.warn("Secure server unreachable. Access granted via local vault.");
                    return { ...mockUser, isDemo: true } as any;
                }
                throw new Error("Secure server is currently waking up or unreachable. Please try again in 30 seconds.");
            }
        }
        throw error;
    }
};

export const logout = async (): Promise<void> => {
    try {
        const response = await secureFetch(`${API_BASE_URL}/users/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        await handleResponse(response);
    } catch (e) {
        console.warn("Server logout failed, clearing local session only.");
    }
};

export const adjustUserWallet = async (id: string, adjustmentData: any): Promise<{ user: User; transaction: Transaction }> => {
    const response = await secureFetch(`${API_BASE_URL}/users/${id}/adjust-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustmentData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const purchasePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const response = await secureFetch(`${API_BASE_URL}/users/${userId}/purchase-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const adminActivatePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const response = await secureFetch(`${API_BASE_URL}/users/${userId}/activate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const userRequestPasswordReset = async (email: string): Promise<void> => {
    const response = await secureFetch(`${API_BASE_URL}/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include'
    });
    await handleResponse(response);
};

export const adminInitiatePasswordReset = async (userId: string): Promise<{ resetToken: string }> => {
    const response = await secureFetch(`${API_BASE_URL}/users/${userId}/admin-reset-password`, { method: 'POST', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const verifyResetToken = async (token: string): Promise<void> => {
    const response = await secureFetch(`${API_BASE_URL}/verify-reset-token/${token}`, { method: 'POST', credentials: 'include' });
    await handleResponse(response);
};

export const resetPasswordWithToken = async (token: string, password: string): Promise<void> => {
    const response = await secureFetch(`${API_BASE_URL}/reset-password/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
    });
    await handleResponse(response);
};

export const getDeposits = async (): Promise<Deposit[]> => {
    const response = await secureFetch(`${API_BASE_URL}/deposits`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createDeposit = async (formData: FormData): Promise<{ deposit: Deposit; transaction: Transaction }> => {
    const response = await secureFetch(`${API_BASE_URL}/deposits`, { method: 'POST', body: formData, credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const updateDeposit = async (id: string, updateData: any): Promise<{ deposit: Deposit; user: User }> => {
    const response = await secureFetch(`${API_BASE_URL}/deposits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const getWithdrawals = async (): Promise<Withdrawal[]> => {
    const response = await secureFetch(`${API_BASE_URL}/withdrawals`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createWithdrawal = async (withdrawalData: Partial<Withdrawal>): Promise<{ withdrawal: Withdrawal; user: User; transaction: Transaction }> => {
    const response = await secureFetch(`${API_BASE_URL}/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdrawalData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateWithdrawal = async (id: string, updateData: any): Promise<{ withdrawal: Withdrawal; user: User }> => {
    const response = await secureFetch(`${API_BASE_URL}/withdrawals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const getTransactions = async (): Promise<Transaction[]> => {
    const response = await secureFetch(`${API_BASE_URL}/transactions`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const getNotifications = async (): Promise<Notification[]> => {
    const response = await secureFetch(`${API_BASE_URL}/notifications`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createNotification = async (notifData: any): Promise<{ count: number; data: Notification[] }> => {
    const response = await secureFetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifData),
        credentials: 'include'
    });
    return await handleResponse(response);
};

export const sendAdminNotification = createNotification;

export const updateNotification = async (id: string, updateData: Partial<Notification>): Promise<Notification> => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteNotification = async (id: string): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const markNotificationsAsRead = async (userId: string): Promise<Notification[]> => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/read/${userId}`, { method: 'PUT', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const markNotificationPopupAsShown = async (id: string): Promise<Notification[]> => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/popup-shown/${id}`, { method: 'PUT', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const response = await secureFetch(`${API_BASE_URL}/payment-methods`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createPaymentMethod = async (formData: FormData): Promise<PaymentMethod> => {
    const response = await secureFetch(`${API_BASE_URL}/payment-methods`, { method: 'POST', body: formData, credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const updatePaymentMethod = async (id: string, formData: FormData): Promise<PaymentMethod> => {
    const response = await secureFetch(`${API_BASE_URL}/payment-methods/${id}`, { method: 'PUT', body: formData, credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const deletePaymentMethod = async (id: string): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/payment-methods/${id}`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const getInvestmentPlans = async (): Promise<InvestmentPlan[]> => {
    const response = await secureFetch(`${API_BASE_URL}/investment-plans`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createInvestmentPlan = async (planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await secureFetch(`${API_BASE_URL}/investment-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateInvestmentPlan = async (id: string, planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await secureFetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteInvestmentPlan = async (id: string): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/investment-plans/${id}`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const getRules = async (): Promise<Rule[]> => {
    const response = await secureFetch(`${API_BASE_URL}/rules`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createRule = async (ruleData: any): Promise<Rule> => {
    const response = await secureFetch(`${API_BASE_URL}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateRule = async (id: string, ruleData: any): Promise<Rule> => {
    const response = await secureFetch(`${API_BASE_URL}/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteRule = async (id: string): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/rules/${id}`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const getSettings = async (): Promise<Settings> => {
    const response = await secureFetch(`${API_BASE_URL}/settings`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const updateSettings = async (settingsData: Partial<Settings>): Promise<Settings> => {
    const response = await secureFetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const getTransfers = async (): Promise<Transfer[]> => {
    const response = await secureFetch(`${API_BASE_URL}/transfers`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createTransfer = async (transferData: any): Promise<{ transfer: Transfer; user: User; transaction: Transaction }> => {
    const response = await secureFetch(`${API_BASE_URL}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateTransfer = async (id: string, updateData: any): Promise<{ transfer: Transfer; sender: User; recipient: User; transaction: Transaction }> => {
    const response = await secureFetch(`${API_BASE_URL}/transfers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const getLogs = async (): Promise<Log[]> => {
    const response = await secureFetch(`${API_BASE_URL}/logs`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const clearLogs = async (): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/logs`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
    const response = await secureFetch(`${API_BASE_URL}/password-reset-requests`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const deletePasswordResetRequest = async (id: string): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/password-reset-requests/${id}`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const getDisputes = async (): Promise<Dispute[]> => {
    const response = await secureFetch(`${API_BASE_URL}/disputes`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createDispute = async (formData: FormData): Promise<Dispute> => {
    const response = await secureFetch(`${API_BASE_URL}/disputes`, { method: 'POST', body: formData, credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const updateDispute = async (id: string, formDataOrData: any): Promise<Dispute> => {
    const isFormData = formDataOrData instanceof FormData;
    const response = await secureFetch(`${API_BASE_URL}/disputes/${id}`, {
        method: 'PUT',
        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        body: isFormData ? formDataOrData : JSON.stringify(formDataOrData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const markDisputeAsRead = async (id: string, role: 'admin' | 'user'): Promise<Dispute> => {
    const response = await secureFetch(`${API_BASE_URL}/disputes/${id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const getTasks = async (): Promise<Task[]> => {
    const response = await secureFetch(`${API_BASE_URL}/tasks`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    const response = await secureFetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateTask = async (id: string, taskData: Partial<Task>): Promise<Task> => {
    const response = await secureFetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteTask = async (id: string): Promise<{}> => {
    const response = await secureFetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE', credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const completeTask = async (taskId: string, userId: string, proof?: File): Promise<User> => {
    const formData = new FormData();
    formData.append('userId', userId);
    if (proof) formData.append('proof', proof);
    
    const response = await secureFetch(`${API_BASE_URL}/tasks/${taskId}/complete`, { method: 'POST', body: formData, credentials: 'include' });
    const result = await handleResponse(response);
    return result.data;
};

export const getPendingTaskVerifications = async (): Promise<any[]> => {
    const response = await secureFetch(`${API_BASE_URL}/tasks/pending-verifications`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    const result = await handleResponse(response);
    return result.data;
};

export const verifyTask = async (userId: string, taskId: string, status: 'Approved' | 'Rejected', adminNotes: string): Promise<User> => {
    const response = await secureFetch(`${API_BASE_URL}/tasks/verify/${userId}/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes }),
        credentials: 'include'
    });
    const result = await handleResponse(response);
    return result.data;
};