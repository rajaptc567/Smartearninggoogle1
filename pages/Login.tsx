import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { login as apiLogin } from '../services/api';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { dispatch } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Inactivity notice check
    const [inactivityNotice, setInactivityNotice] = useState<boolean>(() => {
        const flag = localStorage.getItem('inactivityLogout') === 'true';
        if (flag) {
            localStorage.removeItem('inactivityLogout');
        }
        return flag;
    });
    
    // Secret interaction state for admin backdoor
    const [secretClicks, setSecretClicks] = useState(0);

    const handleSecretClick = () => {
        setSecretClicks(prev => {
            const newCount = prev + 1;
            if (newCount >= 5) {
                // Redirect to secure admin login after 5 clicks
                navigate('/secure-admin-login56');
                return 0;
            }
            return newCount;
        });
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const loginResult = await apiLogin(email, password);
            // FIX: apiLogin returns { token, data: User }. Map these to the expected payload structure { user, token }.
            dispatch({ type: 'SET_CURRENT_USER', payload: { user: loginResult.data, token: loginResult.token } });
            navigate('/member');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center select-none">
                    <h1 
                        className="text-3xl font-bold text-blue-600 dark:text-blue-400 cursor-default active:scale-95 transition-transform"
                        onClick={handleSecretClick}
                        title="Member Login"
                    >
                        SmartEarning
                    </h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Member Login</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to access your member dashboard.</p>
                </div>

                {inactivityNotice && (
                    <div className="p-4 text-sm text-amber-800 bg-amber-50 rounded-lg border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50 flex flex-col gap-1 shadow-sm" role="alert">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="font-bold text-amber-900 dark:text-amber-200">Session Expired</span>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">You have been logged out due to inactivity. Please log in again to continue.</p>
                    </div>
                )}

                {error && (
                    <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/50 dark:text-red-300" role="alert">
                        <span className="font-medium">Login failed:</span> {error}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleLogin}>
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
                        <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div className="flex items-center justify-end">
                        <div className="text-sm">
                            <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                                Forgot your password?
                            </Link>
                        </div>
                    </div>
                    
                    <div>
                        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </div>
                </form>
                <div className="text-sm text-center text-gray-600 dark:text-gray-400 space-y-2">
                    <p>
                        Don't have an account?{' '}
                        <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;