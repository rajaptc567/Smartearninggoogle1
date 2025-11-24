import { 
    User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, 
    Transaction, Rule, Settings, Transfer, Log, Notification, 
    PasswordResetRequest, Dispute, UserRestrictions 
} from '../types';

// Define API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_BASE_URL = `${API_URL}/api/v1`;

export const getUploadsBaseUrl = () => `${API_URL}/uploads/`;

// Helper to handle response
const handleResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
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
        // If text response is successful (rare for this API), wrap it
        return { success: true, data: text };
    }
};

// --- AUTH & USERS ---

export const login = async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
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

export const getUsers = async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`);
    const result = await handleResponse(response);
    return result.data;
};

export const getUser = async (id: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`);
    const result = await handleResponse(response);
    return result.data;
};

export const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteUser = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
    });
    await handleResponse(response);
};

export const adjustUserWallet = async (id: string, data: { amount: number, description: string }): Promise<{ user: User, transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}/adjust-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const purchasePlan = async (userId: string, planId: string): Promise<{ user: User, transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/purchase-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const adminInitiatePasswordReset = async (userId: string): Promise<{ resetToken: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/admin-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await handleResponse(response);
    return result.data;
};

export const userRequestPasswordReset = async (email: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/users/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const verifyResetToken = async (token: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/users/verify-reset-token/${token}`, {
        method: 'POST',
    });
    const result = await handleResponse(response);
    return result.data;
};

export const resetPasswordWithToken = async (token: string, password: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/users/reset-password/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- DEPOSITS ---

export const getDeposits = async (): Promise<Deposit[]> => {
    const response = await fetch(`${API_BASE_URL}/deposits`);
    const result = await handleResponse(response);
    return result.data;
};

export const createDeposit = async (formData: FormData): Promise<{ deposit: Deposit, transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/deposits`, {
        method: 'POST',
        body: formData,
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateDeposit = async (id: string, data: { status: string, adminNotes?: string }): Promise<{ deposit: Deposit, user: User }> => {
    const response = await fetch(`${API_BASE_URL}/deposits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- WITHDRAWALS ---

export const getWithdrawals = async (): Promise<Withdrawal[]> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`);
    const result = await handleResponse(response);
    return result.data;
};

export const createWithdrawal = async (data: any): Promise<{ withdrawal: Withdrawal, user: User, transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateWithdrawal = async (id: string, data: any): Promise<{ withdrawal: Withdrawal, user: User }> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- TRANSACTIONS ---

export const getTransactions = async (): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE_URL}/transactions`);
    const result = await handleResponse(response);
    return result.data;
};

// --- NOTIFICATIONS ---

export const getNotifications = async (): Promise<Notification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications`);
    const result = await handleResponse(response);
    return result.data;
};

export const sendAdminNotification = async (data: { userId: string, subject: string, message: string, isPopup: boolean }): Promise<Notification> => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

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

// --- PAYMENT METHODS ---

export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`);
    const result = await handleResponse(response);
    return result.data;
};

export const createPaymentMethod = async (data: Partial<PaymentMethod>): Promise<PaymentMethod> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updatePaymentMethod = async (id: string, data: Partial<PaymentMethod>): Promise<PaymentMethod> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deletePaymentMethod = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
        method: 'DELETE',
    });
    await handleResponse(response);
};

// --- INVESTMENT PLANS ---

export const getInvestmentPlans = async (): Promise<InvestmentPlan[]> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans`);
    const result = await handleResponse(response);
    return result.data;
};

export const createInvestmentPlan = async (data: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateInvestmentPlan = async (id: string, data: Partial<InvestmentPlan>): Promise<InvestmentPlan> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteInvestmentPlan = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/investment-plans/${id}`, {
        method: 'DELETE',
    });
    await handleResponse(response);
};

// --- RULES ---

export const getRules = async (): Promise<Rule[]> => {
    const response = await fetch(`${API_BASE_URL}/rules`);
    const result = await handleResponse(response);
    return result.data;
};

export const createRule = async (data: Partial<Rule>): Promise<Rule> => {
    const response = await fetch(`${API_BASE_URL}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const deleteRule = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/rules/${id}`, {
        method: 'DELETE',
    });
    await handleResponse(response);
};

// --- TRANSFERS ---

export const getTransfers = async (): Promise<Transfer[]> => {
    const response = await fetch(`${API_BASE_URL}/transfers`);
    const result = await handleResponse(response);
    return result.data;
};

export const createTransfer = async (data: any): Promise<{ transfer: Transfer, user: User, transaction: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

export const updateTransfer = async (id: string, data: any): Promise<{ transfer: Transfer, sender?: User, recipient?: User, transaction?: Transaction }> => {
    const response = await fetch(`${API_BASE_URL}/transfers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- SETTINGS ---

export const getSettings = async (): Promise<Settings> => {
    const response = await fetch(`${API_BASE_URL}/settings`);
    const result = await handleResponse(response);
    return result.data;
};

export const updateSettings = async (data: Settings): Promise<Settings> => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};

// --- LOGS ---

export const getLogs = async (): Promise<Log[]> => {
    const response = await fetch(`${API_BASE_URL}/logs`);
    const result = await handleResponse(response);
    return result.data;
};

// --- PASSWORD RESET REQUESTS ---

export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
    const response = await fetch(`${API_BASE_URL}/password-reset-requests`);
    const result = await handleResponse(response);
    return result.data;
};

export const deletePasswordResetRequest = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/password-reset-requests/${id}`, {
        method: 'DELETE',
    });
    await handleResponse(response);
};

// --- DISPUTES ---

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

export const updateDispute = async (id: string, data: any): Promise<Dispute> => {
    const response = await fetch(`${API_BASE_URL}/disputes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await handleResponse(response);
    return result.data;
};
