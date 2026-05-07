import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { login as apiLogin } from '../services/api';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch, refreshData } = useData();
    const { currentUser } = state;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Redirect if already logged in
    React.useEffect(() => {
        if (currentUser) {
            navigate('/member');
        }
    }, [currentUser, navigate]);
    
    // Secret interaction state for admin backdoor
    const [secretClicks, setSecretClicks] = useState(0);

    const handleSecretClick = () => {
        const newCount = secretClicks + 1;
        if (newCount >= 5) {
            setSecretClicks(0);
            navigate('/secure-admin-login56');
        } else {
            setSecretClicks(newCount);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const loginResult = await apiLogin(email, password);
            // FIX: apiLogin returns { token, data: User }. Map these to the expected payload structure { user, token }.
            dispatch({ type: 'SET_CURRENT_USER', payload: { user: loginResult.data, token: loginResult.token } });
            
            // Trigger an immediate data refresh with the new token
            refreshData();
            
            navigate('/member');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-white rounded-3xl shadow-2xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <div className="text-center select-none">
                    <h1 
                        className="text-4xl font-black text-blue-600 dark:text-blue-400 cursor-default active:scale-95 transition-transform tracking-tighter uppercase"
                        onClick={handleSecretClick}
                        title="Member Login"
                    >
                        SmartEarning
                    </h1>
                    <h2 className="mt-4 text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Member Login</h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">Sign in to access your member dashboard.</p>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/50 dark:text-red-300" role="alert">
                        <span className="font-medium">Login failed:</span> {error}
                    </div>
                )}

                <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 ml-1">Email address</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
                            placeholder="name@example.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 ml-1">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
                            placeholder="••••••••"
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