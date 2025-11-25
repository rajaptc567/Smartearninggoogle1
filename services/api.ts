
// ... existing imports ...
import { User, Deposit, Transaction, Notification, Withdrawal, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, UserRestrictions } from '../types';

// The base URL of your backend API is determined at runtime.
// This allows the same code to work for both local development and live deployment.
function getApiBaseUrl() {
  const hostname = window.location.hostname;
  // Check if running on localhost for development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api/v1';
  }
  // Otherwise, use the live production URL
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


// A helper function to handle fetch responses.
const handleResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
            const error = (data && data.error) || response.statusText;
            throw new Error(error);
        }
        return data; // Return the full response object { success, data, count }
    } else {
         const text = await response.text();
         throw new Error(`Expected JSON, but got ${response.statusText}. Response: ${text.substring(0, 100)}...`);
    }
};

// ... [User API Functions kept as is] ...
export const getUsers = async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`);
    const result = await handleResponse(response);
    return result.data;
};

export const createUser = async (userData: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const bulkUpdateUserRestrictions = async (payload: {
    targetType: 'single' | 'plan' | 'all';
    targetIds: string[];
    restrictions: Partial<UserRestrictions>;
    action: 'enable' | 'disable' | 'toggle';
}): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/bulk-restrictions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const result = await handleResponse(response);
    return result;
};

export const deleteUser = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
    });
    const result = await handleResponse(response);
    return result.data;
};

export const login = async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const adjustUserWallet = async (id: string, adjustmentData: { amount: number; description: string }): Promise<{ user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}/adjust-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustmentData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const purchasePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/purchase-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const userRequestPasswordReset = async (email: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    await handleResponse(response);
};

export const adminInitiatePasswordReset = async (userId: string): Promise<{ resetToken: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/admin-reset-password`, {
        method: 'POST',
    });
    const result = await handleResponse(response);
    return result.data;
};

export const verifyResetToken = async (token: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/verify-reset-token/${token}`, {
        method: 'POST',
    });
    await handleResponse(response);
};

export const resetPasswordWithToken = async (token: string, password: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/reset-password/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    await handleResponse(response);
};

// --- Password Reset Request API Functions ---
export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
    const response = await fetch(`${API_BASE_URL}/password-reset-requests`);
    const result = await handleResponse(response);
    return result.data;
};

export const deletePasswordResetRequest = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/password-reset-requests/${id}`, {
        method: 'DELETE',
    });
    const result = await handleResponse(response);
    return result.data;
};


// --- Deposit API Functions ---

export const getDeposits = async (): Promise<Deposit[]> => {
    const response = await fetch(`${API_BASE_URL}/deposits`);
    const result = await handleResponse(response);
    return result.data;
};

export const createDeposit = async (formData: FormData): Promise<{deposit: Deposit, transaction: Transaction}> => {
    const response = await fetch(`${API_BASE_URL}/deposits`, {
        method: 'POST',
        body: formData, 
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateDeposit = async (id: string, updateData: Partial<Deposit>): Promise<{deposit: Deposit, user: User}> => {
    const response = await fetch(`${API_BASE_URL}/deposits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Withdrawal API Functions ---

export const getWithdrawals = async (): Promise<Withdrawal[]> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`);
    const result = await handleResponse(response);
    return result.data;
};

export const createWithdrawal = async (withdrawalData: Partial<Withdrawal>): Promise<{withdrawal: Withdrawal, user: User, transaction: Transaction}> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdrawalData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateWithdrawal = async (id: string, updateData: Partial<Withdrawal> & { p2pName?: string, p2pAccountTitle?: string, p2pAccountNumber?: string, p2pInstructions?: string }): Promise<{withdrawal: Withdrawal, user: User}> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
    });
    const result = await handleResponse(response);
    return result.data;
};


// --- Transaction API Functions ---

export const getTransactions = async (): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE_URL}/transactions`);
    const result = await handleResponse(response);
    return result.data;
};

// --- Notification API Functions ---

export const getNotifications = async (): Promise<Notification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications`);
    const result = await handleResponse(response);
    return result.data;
};

// Updated for Bulk Messaging
export const sendAdminNotification = async (data: { 
    userId?: string, 
    subject: string, 
    message: string, 
    isPopup: boolean,
    targetType?: 'single' | 'plan' | 'all',
    targetIds?: string[]
}): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
}

export const markNotificationsAsRead = async (userId: string): Promise<Notification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications/read/${userId}`, {
        method: 'PUT',
    });
    const result = await handleResponse(response);
    return result.data;
};

export const markNotificationPopupAsShown = async (id: string): Promise<Notification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications/popup-shown/${id}`, {
        method: 'PUT',
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Payment Method API Functions ---
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`);
    const result = await handleResponse(response);
    return result.data;
};

export const createPaymentMethod = async (methodData: Partial<PaymentMethod>): Promise<PaymentMethod> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(methodData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updatePaymentMethod = async (id: string, methodData: Partial<PaymentMethod>): Promise<PaymentMethod> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(methodData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deletePaymentMethod = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'DELETE',
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Investment Plan API Functions ---
export const getInvestmentPlans = async (): Promise<InvestmentPlan[]> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans`);
    const result = await handleResponse(response);
    return result.data;
};

export const createInvestmentPlan = async (planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateInvestmentPlan = async (id: string, planData: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteInvestmentPlan = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'DELETE',
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Rule API Functions ---
export const getRules = async (): Promise<Rule[]> => {
    const response = await fetch(`${API_BASE_URL}/rules`);
    const result = await handleResponse(response);
    return result.data;
};

export const createRule = async (ruleData: Partial<Rule>): Promise<Rule> => {
    const response = await fetch(`${API_BASE_URL}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteRule = async (id: string): Promise<{}> => {
    const response = await fetch(`${API_BASE_URL}/rules/${id}`, {
        method: 'DELETE',
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Settings API Functions ---
export const getSettings = async (): Promise<Settings> => {
    const response = await fetch(`${API_BASE_URL}/settings`);
    const result = await handleResponse(response);
    return result.data;
};

export const updateSettings = async (settingsData: Partial<Settings>): Promise<Settings> => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Transfer API Functions ---
export const getTransfers = async (): Promise<Transfer[]> => {
    const response = await fetch(`${API_BASE_URL}/transfers`);
    const result = await handleResponse(response);
    return result.data;
};

export const createTransfer = async (transferData: Partial<Transfer>): Promise<{ transfer: Transfer; user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferData),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateTransfer = async (id: string, updateData: Partial<Transfer>): Promise<{ transfer: Transfer; sender?: User; recipient?: User; transaction?: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/transfers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Log API Functions ---
export const getLogs = async (): Promise<Log[]> => {
    const response = await fetch(`${API_BASE_URL}/logs`);
    const result = await handleResponse(response);
    return result.data;
};

export const clearLogs = async (): Promise<[]> => {
    const response = await fetch(`${API_BASE_URL}/logs`, {
        method: 'DELETE',
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- Dispute API Functions ---
export const getDisputes = async (): Promise<Dispute[]> => {
    const response = await fetch(`${API_BASE_URL}/disputes`);
    const result = await handleResponse(response);
    return result.data;
};

export const createDispute = async (formData: FormData): Promise<Dispute> => {
    const response = await fetch(`${API_BASE_URL}/disputes`, {
        method: 'POST',
        body: formData,
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateDispute = async (id: string, data: { status?: string; newMessage?: string, sender?: string } | FormData): Promise<Dispute> => {
    const headers: HeadersInit = {};
    let body;

    if (data instanceof FormData) {
        body = data; // Browser sets multipart/form-data boundary
    } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}/disputes/${id}`, {
        method: 'PUT',
        headers,
        body,
    });
    const result = await handleResponse(response);
    return result.data;
};
