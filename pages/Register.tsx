
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { User, Status, countries, Currency } from '../types';
import { createUser as apiCreateUser } from '../services/api';

const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];

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
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
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

    // Helper to determine currency based on country
    const detectedCurrency = useMemo((): Currency => {
        const c = formData.country.trim().toLowerCase();
        if (!c) return 'USD';
        if (c === 'pakistan') return 'PKR';
        if (europeanCountries.some(ec => ec.toLowerCase() === c)) return 'EUR';
        return 'USD';
    }, [formData.country]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCountrySelect = (countryName: string) => {
        setFormData(prev => ({ ...prev, country: countryName }));
        setIsCountryDropdownOpen(false);
    };

    const filteredCountries = countries.filter(c => 
        c.toLowerCase().includes(formData.country.toLowerCase())
    );

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (formData.sponsor) {
            const sponsorExists = state.users.some(user => user.username.toLowerCase() === formData.sponsor.toLowerCase());
            if (!sponsorExists) {
                alert(`Sponsor with username "${formData.sponsor}" does not exist.`);
                setIsSubmitting(false);
                return;
            }
        }
        
        // Explicitly include currency in the payload to match backend expectation
        const newUserPayload: Partial<User> = {
            ...formData,
            currency: detectedCurrency,
            status: Status.Active,
        };

        try {
            const createdUser = await apiCreateUser(newUserPayload);
            dispatch({ type: 'ADD_USER', payload: createdUser });
            dispatch({ type: 'SET_CURRENT_USER', payload: createdUser });
            navigate('/member');
        } catch (error) {
            console.error("Registration failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Registration failed: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 py-12">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">Create Your Account</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Join our global network of investors.</p>
                </div>
                <form className="space-y-4" onSubmit={handleRegister}>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                           <input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                           <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">User Name</label>
                           <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                     </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                        <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                         <div>
                            <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp</label>
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
                            placeholder="Type to search..."
                            className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            autoComplete="off"
                            required
                        />
                        {isCountryDropdownOpen && filteredCountries.length > 0 && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredCountries.map(c => (
                                    <li 
                                        key={c}
                                        className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer text-sm dark:text-gray-200"
                                        onMouseDown={() => handleCountrySelect(c)}
                                    >
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {formData.country && (
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-gray-400">Assigned Currency:</span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded border ${detectedCurrency === 'PKR' ? 'bg-teal-50 text-teal-700 border-teal-200' : detectedCurrency === 'EUR' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                    {detectedCurrency}
                                </span>
                            </div>
                        )}
                    </div>
                     <div>
                        <label htmlFor="sponsor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sponsor Username</label>
                        <input 
                            id="sponsor" 
                            name="sponsor" 
                            type="text" 
                            value={formData.sponsor} 
                            onChange={handleChange} 
                            readOnly={isSponsorFromUrl}
                            placeholder="Optional"
                            className={`w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${isSponsorFromUrl && 'cursor-not-allowed bg-gray-100 dark:bg-gray-700/50'}`}
                        />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div className="pt-4">
                        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating Account...' : 'Create Account'}
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
