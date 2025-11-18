import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { verifyResetToken, resetPasswordWithToken as apiResetPassword } from '../services/api';

type ResetStatus = 'verifying' | 'invalid' | 'ready' | 'expired' | 'success';

const ResetPassword = () => {
    const [token, setToken] = useState<string | null>(null);
    const [status, setStatus] = useState<ResetStatus>('verifying');
    const [timer, setTimer] = useState(600); // 10 minutes in seconds

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Parse token from URL hash, deferred to avoid race conditions with router
    useEffect(() => {
        const timerId = setTimeout(() => {
            const hash = window.location.hash;
            const match = hash.match(/[\?&]token=([^&]*)/);
            const parsedToken = match ? match[1] : null;

            if (parsedToken) {
                setToken(parsedToken);
            } else {
                setStatus('invalid');
            }
        }, 0); // Defer execution until after initial render flow

        return () => clearTimeout(timerId); // Cleanup
    }, []); // Run only once on mount

    // 2. Verify token with backend once token is parsed
    useEffect(() => {
        if (token) {
            const verify = async () => {
                try {
                    await verifyResetToken(token);
                    setStatus('ready');
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                    setError(errorMessage);
                    setStatus('invalid');
                }
            };
            verify();
        }
    }, [token]);

    // 3. Start countdown timer once status is 'ready'
    useEffect(() => {
        if (status === 'ready') {
            const interval = setInterval(() => {
                setTimer((prevTimer) => {
                    if (prevTimer <= 1) {
                        clearInterval(interval);
                        setStatus('expired');
                        return 0;
                    }
                    return prevTimer - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [status]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            setError("Invalid or missing reset token.");
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
        
        try {
            await apiResetPassword(token, password);
            setStatus('success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const renderContent = () => {
        switch (status) {
            case 'verifying':
                return <p className="text-center">Verifying reset link...</p>;
            case 'invalid':
                return (
                    <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/50 dark:text-red-300">
                        <strong>Error:</strong> {error || 'This reset link is invalid or has expired.'} Please request a new one.
                    </div>
                );
            case 'expired':
                return (
                    <div className="p-3 text-sm text-yellow-700 bg-yellow-100 rounded-md dark:bg-yellow-900/50 dark:text-yellow-300">
                        <strong>Session Expired:</strong> Your 10-minute window to reset the password has expired. Please contact an admin for a new link.
                    </div>
                );
             case 'success':
                return (
                    <div className="p-3 text-sm text-green-700 bg-green-100 rounded-md dark:bg-green-900/50 dark:text-green-300" role="alert">
                        <p>Your password has been reset successfully! You can now log in with your new password.</p>
                         <Link to="/login" className="font-bold underline mt-2 inline-block">
                            Go to Login
                        </Link>
                    </div>
                );
            case 'ready':
                return (
                    <>
                        <div className="text-center p-2 mb-4 rounded-md bg-blue-50 dark:bg-blue-900/50">
                            <p className="font-semibold">Time remaining to reset password:</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatTime(timer)}</p>
                        </div>
                        <form className="space-y-6" onSubmit={handleSubmit}>
                             <div>
                                <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                <input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                            </div>
                             <div>
                                <label htmlFor="confirmPassword"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                                <input id="confirmPassword" name="confirmPassword" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                            </div>
                            <div>
                                <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Resetting...' : 'Reset Password'}
                                </Button>
                            </div>
                        </form>
                    </>
                );
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Reset Your Password</h2>
                </div>

                {error && status !== 'invalid' && (
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
