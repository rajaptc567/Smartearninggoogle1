import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { User, Status } from '../types';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { dispatch } = useData();

    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        email: '',
        phone: '',
        whatsapp: '',
        country: '',
        sponsor: '',
        password: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        
        const newUser: User = {
            _id: String(Date.now()),
            ...formData,
            walletBalance: 0,
            activePlan: 'None',
            registrationDate: new Date().toISOString().split('T')[0],
            status: Status.Active,
        };

        // Add the new user to the global state
        dispatch({ type: 'ADD_USER', payload: newUser });
        
        // Set the new user as the currently logged-in user
        dispatch({ type: 'SET_CURRENT_USER', payload: newUser });

        alert('Registration successful! Redirecting to your dashboard...');
        navigate('/member');
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 py-12">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Create Your Account</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Join us and start your earning journey today.</p>
                </div>
                <form className="space-y-4" onSubmit={handleRegister}>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="fullName"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                           <input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                           <label htmlFor="username"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">User Name</label>
                           <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                     </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                        <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="phone"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                         <div>
                            <label htmlFor="whatsapp"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp Number</label>
                            <input id="whatsapp" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                     </div>
                      <div>
                        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Country (Optional)</label>
                        <input id="country" name="country" type="text" value={formData.country} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div>
                        <label htmlFor="sponsor"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sponsor Username</label>
                        <input id="sponsor" name="sponsor" type="text" value={formData.sponsor} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="pt-4">
                        <Button type="submit" size="lg" className="w-full">
                            Create Account
                        </Button>
                    </div>
                </form>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;