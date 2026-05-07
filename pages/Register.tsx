import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { User, Status, countries } from '../types';
import { createUser as apiCreateUser } from '../services/api';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useData();

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
    const [isSponsorFromUrl, setIsSponsorFromUrl] = useState(false);
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);

    useEffect(() => {
        // Parse sponsor from URL hash for HashRouter compatibility
        const hash = window.location.hash;
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            const searchParams = new URLSearchParams(hash.substring(queryIndex));
            const sponsorUsername = searchParams.get('sponsor');

            if (sponsorUsername) {
                setFormData(prev => ({ ...prev, sponsor: sponsorUsername }));
                setIsSponsorFromUrl(true);
            }
        }
    }, []);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCountrySelect = (countryName: string) => {
        setFormData(prev => ({ ...prev, country: countryName }));
        setIsCountryDropdownOpen(false);
    };

    // Filter countries based on input
    const filteredCountries = countries.filter(c => 
        c.toLowerCase().includes(formData.country.toLowerCase())
    );

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        // Client-side validation to check if sponsor exists, if one is provided
        if (formData.sponsor) {
            const sponsorExists = state.users.some(user => user.username.toLowerCase() === formData.sponsor.toLowerCase());
            if (!sponsorExists) {
                alert(`Sponsor with username "${formData.sponsor}" does not exist. Please check the username or leave it blank.`);
                return;
            }
        }
        
        const newUserPayload: Partial<User> = {
            ...formData,
            status: Status.Active,
        };

        try {
            const createdUser = await apiCreateUser(newUserPayload);

            // Add the new user to the global state
            dispatch({ type: 'ADD_USER', payload: createdUser });
            
            // Set the new user as the currently logged-in user
            // FIX: SET_CURRENT_USER expects payload as { user: User | null; token?: string }.
            dispatch({ type: 'SET_CURRENT_USER', payload: { user: createdUser } });

            alert('Registration successful! Redirecting to your dashboard...');
            navigate('/member');

        } catch (error) {
            console.error("Registration failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Registration failed: ${errorMessage}`);
        }
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
                           <input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                           <label htmlFor="username"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">User Name</label>
                           <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                     </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                        <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="phone"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                         <div>
                            <label htmlFor="whatsapp"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp Number</label>
                            <input id="whatsapp" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                     </div>
                      <div className="relative">
                        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
                        <input
                            type="text"
                            id="country"
                            name="country"
                            value={formData.country}
                            onChange={(e) => { handleChange(e); setIsCountryDropdownOpen(true); }}
                            onFocus={() => setIsCountryDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsCountryDropdownOpen(false), 200)}
                            placeholder="Type to search or enter country"
                            className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            autoComplete="off"
                            required
                        />
                        {isCountryDropdownOpen && filteredCountries.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredCountries.map(c => (
                                    <li 
                                        key={c}
                                        className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer text-sm dark:text-gray-200"
                                        onMouseDown={() => handleCountrySelect(c)} // Use onMouseDown to trigger before onBlur
                                    >
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                     <div>
                        <label htmlFor="sponsor"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sponsor Username (Optional)</label>
                        <input 
                            id="sponsor" 
                            name="sponsor" 
                            type="text" 
                            value={formData.sponsor} 
                            onChange={handleChange} 
                            readOnly={isSponsorFromUrl}
                            className={`w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${isSponsorFromUrl && 'cursor-not-allowed bg-gray-100 dark:bg-gray-700/50'}`}
                        />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
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