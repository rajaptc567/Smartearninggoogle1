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

    // Inactivity notice check
    const [inactivityNotice, setInactivityNotice] = useState<boolean>(() => {
        const flag = localStorage.getItem('inactivityLogout') === 'true';
        if (flag) {
            localStorage.removeItem('inactivityLogout');
        }
        return flag;
    });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Attempt login via API
            // FIX: apiLogin returns { token, data: User }. Access username and email through result.data.
            const loginResult = await apiLogin(email, password);
            
            // SECURITY CHECK: Ensure the user is actually the admin account.
            // FIX: Property 'username' and 'email' exist on loginResult.data, not on loginResult itself.
            if (loginResult.data.username !== 'admin' && loginResult.data.email !== 'studio56.pk@gmail.com') {
                setError('Unauthorized access. This area is restricted to administrators.');
                // Log them out immediately if they aren't admin
                // FIX: Ensure payload matches { user: User | null; token?: string }.
                dispatch({ type: 'SET_CURRENT_USER', payload: { user: null } }); 
                return;
            }

            // FIX: Ensure payload matches { user: User | null; token?: string }.
            dispatch({ type: 'SET_CURRENT_USER', payload: { user: loginResult.data, token: loginResult.token } });
            navigate('/admin');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Invalid credentials';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0f172a]">
            <div className="w-full max-w-md p-8 space-y-6 bg-[#111827] rounded-xl shadow-2xl border border-gray-800/50">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-blue-500 tracking-tight">SmartEarning</h1>
                    <h2 className="mt-4 text-2xl font-bold text-white">Admin Panel Login</h2>
                    <p className="mt-2 text-sm text-gray-400">Restricted Access: Authorized Personnel Only</p>
                </div>

                {inactivityNotice && (
                    <div className="p-4 text-sm text-amber-300 bg-amber-950/40 rounded-lg border border-amber-900/40 flex flex-col gap-1 shadow-md animate-shake" role="alert">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="font-bold text-amber-200">Session Expired</span>
                        </div>
                        <p className="text-xs text-gray-300 font-medium">You have been logged out due to inactivity. Please sign in again to resume administrative operations.</p>
                    </div>
                )}

                {error && (
                    <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg animate-shake" role="alert">
                        <span className="font-bold">Error:</span> {error}
                    </div>
                )}

                <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Admin Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            className="w-full px-4 py-3 bg-[#1e293b]/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••"
                            className="w-full px-4 py-3 bg-[#1e293b]/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="pt-2">
                        <Button type="submit" size="lg" className="w-full py-4 text-lg font-black bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 border-0" disabled={isLoading}>
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Verifying...
                                </span>
                            ) : 'Secure Sign In'}
                        </Button>
                    </div>
                </form>
                 <p className="text-sm text-center">
                    <Link to="/login" className="text-gray-500 hover:text-gray-300 font-medium transition-colors">
                        Return to member login
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;