import { User, Deposit, Withdrawal } from '../types';

// The base URL of your backend API is determined at runtime.
// This allows the same code to work for both local development and live deployment.
function getApiBaseUrl() {
  // In this environment, the backend and frontend are served from the same origin.
  // We use a relative path, and the server is configured to proxy requests
  // starting with /api/v1 to the backend service. This avoids CORS issues
  // and works seamlessly in both development and production.
  return '/api/v1';
}

const API_BASE_URL = getApiBaseUrl();


// A helper function to handle fetch responses.
const handleResponse = async (response: Response) => {
    // The backend now returns the raw object with `_id` from Mongo.
    // The frontend type uses `_id` so we don't need the `id` virtual anymore.
    const data = await response.json();
    if (!response.ok) {
        const error = (data && data.error) || response.statusText;
        throw new Error(error);
    }
    return data.data;
};

// A helper to format date strings from the backend
const formatDate = (isoString: string) => new Date(isoString).toISOString().split('T')[0];

// --- Auth API Functions ---

/**
 * Logs in a user.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<User>} A promise that resolves to the logged-in user.
 */
export const login = async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(response);
    return { ...data, registrationDate: formatDate(data.registrationDate) };
};


// --- User API Functions ---

/**
 * Fetches all users from the backend.
 * @returns {Promise<User[]>} A promise that resolves to an array of users.
 */
export const getUsers = async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`);
    const data = await handleResponse(response);
    // Format registrationDate for consistency
    return data.map((user: any) => ({ ...user, registrationDate: formatDate(user.registrationDate) }));
};

/**
 * Creates a new user.
 * @param {Partial<User>} userData - The data for the new user.
 * @returns {Promise<User>} A promise that resolves to the newly created user.
 */
export const createUser = async (userData: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
    });
    const data = await handleResponse(response);
    return { ...data, registrationDate: formatDate(data.registrationDate) };
};

/**
 * Updates an existing user.
 * @param {string} id - The ID of the user to update.
 * @param {Partial<User>} userData - The updated data for the user.
 * @returns {Promise<User>} A promise that resolves to the updated user.
 */
export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
    });
    return handleResponse(response);
};

/**
 * Deletes a user.
 * @param {string} id - The ID of the user to delete.
 * @returns {Promise<any>} A promise that resolves when the user is deleted.
 */
export const deleteUser = async (id: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
    });
    return handleResponse(response);
};


// --- Deposit API Functions ---

export const getDeposits = async (): Promise<Deposit[]> => {
    const response = await fetch(`${API_BASE_URL}/deposits`);
    const data = await handleResponse(response);
    return data.map((d: any) => ({ ...d, date: formatDate(d.date) }));
};

export const createDeposit = async (depositData: Partial<Deposit>): Promise<Deposit> => {
    const response = await fetch(`${API_BASE_URL}/deposits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depositData),
    });
    const data = await handleResponse(response);
    return { ...data, date: formatDate(data.date) };
};

export const updateDeposit = async (id: string, depositData: Partial<Deposit>): Promise<Deposit> => {
    const response = await fetch(`${API_BASE_URL}/deposits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depositData),
    });
    return handleResponse(response);
};

// --- Withdrawal API Functions ---

export const getWithdrawals = async (): Promise<Withdrawal[]> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`);
    const data = await handleResponse(response);
    return data.map((w: any) => ({ ...w, date: formatDate(w.date) }));
};

export const createWithdrawal = async (withdrawalData: Partial<Withdrawal>): Promise<Withdrawal> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdrawalData),
    });
    const data = await handleResponse(response);
    return { ...data, date: formatDate(data.date) };
};

export const updateWithdrawal = async (id: string, withdrawalData: Partial<Withdrawal>): Promise<Withdrawal> => {
    const response = await fetch(`${API_BASE_URL}/withdrawals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdrawalData),
    });
    return handleResponse(response);
};

// --- Helper Functions ---

/**
 * Converts a File object to a base64 encoded string.
 * @param {File} file - The file to convert.
 * @returns {Promise<string>} A promise that resolves with the base64 data URL.
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};