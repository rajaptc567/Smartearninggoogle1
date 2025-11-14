import { User } from '../types';

// The base URL of your backend API.
// In development, this points to your local server.
// When you deploy, you'll set an environment variable (e.g., VITE_API_URL on Vercel)
// to your live Render backend URL.
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// A helper function to handle fetch responses.
const handleResponse = async (response: Response) => {
    const data = await response.json();
    if (!response.ok) {
        const error = (data && data.error) || response.statusText;
        throw new Error(error);
    }
    return data.data;
};

// --- User API Functions ---

/**
 * Fetches all users from the backend.
 * @returns {Promise<User[]>} A promise that resolves to an array of users.
 */
export const getUsers = async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/users`);
    return handleResponse(response);
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
    return handleResponse(response);
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

// --- TODO: Add API functions for other resources ---
// e.g., getDeposits, updateDeposit, etc.
