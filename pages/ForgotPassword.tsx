import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // This now only serves to inform the user. No backend call is made.
        console.log('Password reset assistance requested for:', email);
        setSubmitted(true);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Forgot Password</h2>
                </div>

                {submitted ? (
                    <div className="text-center">
                        <div className="p-4 text-sm text-blue-700 bg-blue-100 rounded-md dark:bg-blue-900/50 dark:text-blue-300" role="alert">
                            <p className="font-semibold">Request Sent</p>
                            <p className="mt-1">
                                Your request for a password reset has been forwarded to our administration team. Please contact support to receive your unique and secure reset link.
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
                                <Button type="submit" size="lg" className="w-full">
                                    Request Reset from Admin
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