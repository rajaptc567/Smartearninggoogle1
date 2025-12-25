
import React, { useState, useEffect } from 'react';
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
        currency: 'USD' as Currency,
    });
    const [isSponsorFromUrl, setIsSponsorFromUrl] = useState(false);
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);

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

    const getCurrencyForCountry = (countryName: string): Currency => {
        const lower = countryName.toLowerCase();
        if (lower === 'pakistan') return 'PKR';
        if (europeanCountries.some(c => c.toLowerCase() === lower)) return 'EUR';
        return 'USD';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'country') {
                updated.currency = getCurrencyForCountry(value);
            }
            return updated;
        });
    };

    const handleCountrySelect = (countryName: string) => {
        setFormData(prev => ({ 
            ...prev, 
            country: countryName,
            currency: getCurrencyForCountry(countryName)
        }));
        setIsCountryDropdownOpen(false);
    };

    const filteredCountries = countries.filter(c => 
        c.toLowerCase().includes(formData.country.toLowerCase())
    );

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

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
            dispatch({ type: 'ADD_USER', payload: createdUser });
            dispatch({ type: 'SET_CURRENT_USER', payload: createdUser });
            alert('Registration successful! Redirecting to your dashboard...');
            navigate('/member');
        } catch (error) {
            console.error("Registration failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Registration failed: ${errorMessage}`);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/30">S</div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">SmartEarning</h1>
                    <h2 className="mt-2 text-lg text-gray-500 dark:text-gray-400">Join the global network</h2>
                </div>
                <form className="space-y-4" onSubmit={handleRegister}>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="fullName" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
                           <input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                           <label htmlFor="username" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">User Name</label>
                           <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                     </div>
                    <div>
                        <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email address</label>
                        <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="phone" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mobile Number</label>
                            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                         <div>
                            <label htmlFor="whatsapp" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp</label>
                            <input id="whatsapp" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                     </div>
                      <div className="relative">
                        <label htmlFor="country" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Country</label>
                        <div className="relative">
                            <input
                                type="text"
                                id="country"
                                name="country"
                                value={formData.country}
                                onChange={(e) => { handleChange(e); setIsCountryDropdownOpen(true); }}
                                onFocus={() => setIsCountryDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsCountryDropdownOpen(false), 200)}
                                placeholder="Start typing country..."
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                autoComplete="off"
                                required
                            />
                            {formData.country && (
                                <div className="absolute right-3 top-2.5">
                                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm">
                                        {formData.currency}
                                    </span>
                                </div>
                            )}
                        </div>
                        {isCountryDropdownOpen && filteredCountries.length > 0 && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                                {filteredCountries.map(c => (
                                    <li 
                                        key={c}
                                        className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm dark:text-gray-200 border-b last:border-0 dark:border-gray-600 transition-colors"
                                        onMouseDown={() => handleCountrySelect(c)}
                                    >
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                     <div>
                        <label htmlFor="sponsor" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Sponsor (Optional)</label>
                        <input 
                            id="sponsor" 
                            name="sponsor" 
                            type="text" 
                            value={formData.sponsor} 
                            onChange={handleChange} 
                            readOnly={isSponsorFromUrl}
                            placeholder="Username of who referred you"
                            className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${isSponsorFromUrl && 'bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed opacity-80'}`}
                        />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Password</label>
                        <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="pt-4">
                        <Button type="submit" size="lg" className="w-full py-3 shadow-lg shadow-blue-500/20">
                            Create Account
                        </Button>
                    </div>
                </form>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    Already a member?{' '}
                    <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400">
                        Sign in here
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
