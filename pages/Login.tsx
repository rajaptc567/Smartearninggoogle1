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
    const [isNetworkError, setIsNetworkError] = useState(false);
    
    /**
     * 🤫 SECRET BACKDOOR (CLIENT-SIDE)
     * Hardened by server-side verification in AdminLogin.tsx
     */
    const [secretClicks, setSecretClicks] = useState(0);

    const handleSecretClick = () => {
        setSecretClicks(prev => {
            const newCount = prev + 1;
            if (newCount >= 5) {
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
        setIsNetworkError(false);

        try {
            const loggedInUser = await apiLogin(email, password);
            dispatch({ type: 'SET_CURRENT_USER', payload: loggedInUser });
            navigate('/member');
        } catch (err) {
            /**
             * 📢 IMPROVED ERROR FEEDBACK
             * Extracts clean message from API response handler.
             */
            const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials and try again.';
            setError(errorMessage);
            
            // Detect if this is a network failure to offer Demo Mode
            if (errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('Failed to fetch') || errorMessage.includes('Technical Failure')) {
                setIsNetworkError(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLaunchDemo = () => {
        // Find the default admin user in mock data
        const demoUser = {
            _id: 'u1',
            username: 'admin',
            fullName: 'System Admin',
            email: 'studio56.pk@gmail.com',
            phone: '1234567890',
            country: 'Pakistan',
            currency: 'PKR',
            walletBalance: 100000,
            activePlan: 'None',
            activePlans: [],
            status: 'Active',
            registrationDate: new Date().toISOString(),
            role: 'admin'
        };
        dispatch({ type: 'SET_CURRENT_USER', payload: demoUser as any });
        navigate('/admin');
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center select-none">
                    <h1 
                        className="text-3xl font-bold text-blue-600 dark:text-blue-400 cursor-default active:scale-95 transition-transform"
                        onClick={handleSecretClick}
                        title="SmartEarning"
                    >
                        SmartEarning
                    </h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Member Login</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to access your member dashboard.</p>
                </div>

                {error && (
                    <div className="p-5 rounded-xl bg-[#2a0c0c] border border-red-900/50 text-[#f87171] shadow-2xl animate-fade-in" role="alert">
                        <div className="flex items-center gap-2 mb-3 font-black uppercase tracking-[0.2em] text-[10px] text-red-500">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>Authentication Error</span>
                        </div>
                        <p className="leading-relaxed text-xs font-semibold opacity-90">{error}</p>
                        
                        {isNetworkError && (
                            <div className="mt-5 pt-5 border-t border-red-900/30">
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#fbbf24] mb-4 flex items-center gap-2">
                                    <span className="text-base leading-none">⚠️</span> PLATFORM CLOUD CONNECTION LOST
                                </p>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="w-full bg-[#1e293b] border-0 text-white hover:bg-black py-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg"
                                    onClick={handleLaunchDemo}
                                >
                                    Enter Demo Mode (Local Cache)
                                </Button>
                                <p className="mt-3 text-[9px] text-gray-500 text-center font-bold uppercase tracking-widest opacity-60">Backend may be undergoing maintenance.</p>
                            </div>
                        )}
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
                        <Button type="submit" size="lg" className="w-full shadow-lg active:scale-[0.98] transition-all" disabled={isLoading}>
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Verifying...
                                </span>
                            ) : 'Sign In'}
                        </Button>
                    </div>
                </form>
                <div className="text-sm text-center text-gray-600 dark:text-gray-400 space-y-2">
                    <p>
                        Don't have an account?{' '}
                        <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                            Create Account
                        </Link>
                    </p>
                </div>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default Login;