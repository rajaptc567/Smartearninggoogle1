import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { userRequestPasswordReset } from '../services/api';
import { SEOHead } from '../components/SEOHead';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await userRequestPasswordReset(email);
            setSubmitted(true);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            // Even if there's an error, we can still show the "submitted" message to prevent email enumeration.
            // The backend handles this securely.
            setSubmitted(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4">
            <SEOHead 
                title="Forgot Password | SmartExn" 
                robots="noindex, nofollow" 
                canonical="https://smartexn.com/forgot-password" 
            />
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <Link to="/" className="inline-flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-sky-500 rounded-lg flex items-center justify-center text-white">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">Smart<span className="text-sky-500">Exn</span></span>
                    </Link>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Forgot Password</h2>
                </div>

                {submitted ? (
                    <div className="text-center">
                        <div className="p-4 text-sm text-blue-700 bg-blue-100 rounded-md dark:bg-blue-900/50 dark:text-blue-300" role="alert">
                            <p className="font-semibold">Request Sent</p>
                            <p className="mt-1">
                                If an account with that email exists, a request has been sent to our administration team. Please check your email or WhatsApp to reset your password.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                            Please enter your email address to request a password reset from an administrator.
                        </p>
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Sending Request...' : 'Request Reset from Admin'}
                                </Button>
                            </div>
                        </form>
                    </>
                )}

                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                        Back to Login
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;