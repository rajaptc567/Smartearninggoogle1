import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { resetPasswordWithToken as apiResetPassword } from '../services/api';

const ResetPassword = () => {
    const [token, setToken] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(true);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        // This logic runs once after the component mounts.
        // It manually parses the token from the URL hash, which is more stable
        // in some environments than using router hooks that can cause race conditions.
        const hash = window.location.hash;
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            const queryString = hash.substring(queryIndex + 1);
            const params = new URLSearchParams(queryString);
            setToken(params.get('token'));
        }
        setIsVerifying(false);
    }, []); // Empty dependency array ensures this runs only once.

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            setError("Invalid or missing reset token. Please use the link provided by the administrator.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await apiResetPassword(token, password);
            setSuccess("Your password has been reset successfully! You can now log in with your new password.");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        if (isVerifying) {
            return (
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>Verifying reset link...</p>
                </div>
            );
        }

        if (success) {
            return (
                <div className="p-3 text-sm text-green-700 bg-green-100 rounded-md dark:bg-green-900/50 dark:text-green-300" role="alert">
                    <p>{success}</p>
                     <Link to="/login" className="font-bold underline">
                        Go to Login
                    </Link>
                </div>
            );
        }
        
        if (!token) {
             return (
                <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/50 dark:text-red-300">
                    <strong>Error:</strong> No reset token found. This page can only be accessed via a special link from an administrator.
                </div>
            );
        }

        return (
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                 <div>
                    <label htmlFor="confirmPassword"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div>
                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </Button>
                </div>
            </form>
        );
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Reset Your Password</h2>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/50 dark:text-red-300" role="alert">
                        <span className="font-medium">Error:</span> {error}
                    </div>
                )}
                
                {renderContent()}

                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                        Back to Login
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default ResetPassword;
