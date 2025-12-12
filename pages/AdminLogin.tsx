
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { login as apiLogin } from '../services/api';

const AdminLogin: React.FC = () => {
    const navigate = useNavigate();
    const { dispatch } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Attempt login via API
            const user = await apiLogin(email, password);
            
            // SECURITY CHECK: Ensure the user is actually the admin account.
            // We check username 'admin' OR the specific hardcoded master email.
            // This allows you to login even if your username is different, as long as the email matches.
            if (user.username !== 'admin' && user.email !== 'studio56.pk@gmail.com') {
                setError('Unauthorized access. This area is restricted to administrators.');
                // Log them out immediately if they aren't admin
                dispatch({ type: 'SET_CURRENT_USER', payload: null }); 
                return;
            }

            dispatch({ type: 'SET_CURRENT_USER', payload: user });
            navigate('/admin');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Invalid credentials';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Admin Panel Login</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Restricted Access: Authorized Personnel Only</p>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/50 dark:text-red-300" role="alert">
                        <span className="font-medium">Error:</span> {error}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Admin Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="studio56.pk@gmail.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
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
                        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Verifying...' : 'Secure Sign In'}
                        </Button>
                    </div>
                </form>
                 <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    <Link to="/login" className="font-medium text-gray-500 hover:text-gray-400">
                        Return to member login
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
