import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { User, Status, countries } from '../types';
import { createUser as apiCreateUser } from '../services/api';
import { SEOHead } from '../components/SEOHead';

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
        address: '',
        city: '',
        postalCode: '',
        telegram: '',
        gender: '',
        dateOfBirth: '',
    });
    const [isSponsorFromUrl, setIsSponsorFromUrl] = useState(false);
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, string>>({});

    const handleCustomFieldChange = (id: string, value: string) => {
        setCustomFieldsValues(prev => ({ ...prev, [id]: value }));
    };

    const signUpConfig = state.settings?.signUpConfig || {
        fullNameRule: 'required',
        phoneRule: 'required',
        whatsappRule: 'required',
        countryRule: 'required',
        sponsorRule: 'optional',
        addressRule: 'hidden',
        cityRule: 'hidden',
        postalCodeRule: 'hidden',
        telegramRule: 'hidden',
        genderRule: 'hidden',
        dateOfBirthRule: 'hidden',
        requireCountryCodeInPhone: false,
        requireCountryCodeInWhatsapp: false,
    };

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

        // 1. Dynamic Optional / Required checks based on settings
        if (signUpConfig.usernameRule === 'required' && !formData.username) {
            alert('User Name is required.');
            return;
        }
        if (signUpConfig.fullNameRule === 'required' && !formData.fullName) {
            alert('Full Name is required.');
            return;
        }
        if (signUpConfig.phoneRule === 'required' && !formData.phone) {
            alert('Mobile Number is required.');
            return;
        }
        if (signUpConfig.whatsappRule === 'required' && !formData.whatsapp) {
            alert('WhatsApp Number is required.');
            return;
        }
        if (signUpConfig.countryRule === 'required' && !formData.country) {
            alert('Country is required.');
            return;
        }
        if (signUpConfig.sponsorRule === 'required' && !formData.sponsor) {
            alert('Sponsor username is required.');
            return;
        }
        if (signUpConfig.addressRule === 'required' && !formData.address) {
            alert('Residential Address is required.');
            return;
        }
        if (signUpConfig.cityRule === 'required' && !formData.city) {
            alert('City is required.');
            return;
        }
        if (signUpConfig.postalCodeRule === 'required' && !formData.postalCode) {
            alert('Postal/Zip Code is required.');
            return;
        }
        if (signUpConfig.telegramRule === 'required' && !formData.telegram) {
            alert('Telegram username is required.');
            return;
        }
        if (signUpConfig.genderRule === 'required' && !formData.gender) {
            alert('Gender is required.');
            return;
        }
        if (signUpConfig.dateOfBirthRule === 'required' && !formData.dateOfBirth) {
            alert('Date of Birth is required.');
            return;
        }

        // Custom Fields validation
        const customFields = signUpConfig.customFields || [];
        for (const field of customFields) {
            const val = customFieldsValues[field.id];
            if (field.required) {
                if (field.type === 'checkbox') {
                    if (!val || val === 'false') {
                        alert(`${field.label} must be checked.`);
                        return;
                    }
                } else {
                    if (!val || !val.trim()) {
                        alert(`${field.label} is required.`);
                        return;
                    }
                }
            }
        }

        // 2. Client-side validation to check if sponsor exists, if one is provided
        if (formData.sponsor && signUpConfig.sponsorRule !== 'hidden') {
            const sponsorExists = state.users.some(user => user.username.toLowerCase() === formData.sponsor.toLowerCase());
            if (!sponsorExists) {
                alert(`Sponsor with username "${formData.sponsor}" does not exist. Please check the username or leave it blank.`);
                return;
            }
        }

        // 3. Country code validation for phone and whatsapp
        const validateCountryCode = (number: string): boolean => {
            const trimmed = number.trim();
            if (trimmed.startsWith('+')) {
                const digits = trimmed.replace(/\D/g, '');
                return digits.length >= 8;
            }
            if (trimmed.startsWith('00')) {
                const digits = trimmed.replace(/\D/g, '');
                return digits.length >= 10;
            }
            if (trimmed.startsWith('0')) {
                return false;
            }
            const digits = trimmed.replace(/\D/g, '');
            return digits.length >= 9;
        };

        if (signUpConfig.requireCountryCodeInPhone && formData.phone) {
            if (!validateCountryCode(formData.phone)) {
                alert('Please include your country code in your mobile number (e.g. +923001234567 or 923001234567, do not start with local "0").');
                return;
            }
        }

        if (signUpConfig.requireCountryCodeInWhatsapp && formData.whatsapp && signUpConfig.whatsappRule !== 'hidden') {
            if (!validateCountryCode(formData.whatsapp)) {
                alert('Please include your country code in your WhatsApp number (e.g. +923001234567 or 923001234567, do not start with local "0").');
                return;
            }
        }
        
        let finalUsername = formData.username;
        if (signUpConfig.usernameRule === 'hidden' || (signUpConfig.usernameRule === 'optional' && !formData.username)) {
            const emailPart = formData.email ? formData.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'user';
            const randomId = Math.floor(1000 + Math.random() * 9000);
            finalUsername = `${emailPart}${randomId}`.toLowerCase();
        }

        const newUserPayload: Partial<User> = {
            ...formData,
            username: finalUsername,
            customFields: customFieldsValues,
            status: Status.Active,
        };

        try {
            const createdUser = await apiCreateUser(newUserPayload);

            // Add the new user to the global state
            dispatch({ type: 'ADD_USER', payload: createdUser });
            
            // Set the new user as the currently logged-in user
            dispatch({ type: 'SET_CURRENT_USER', payload: { user: createdUser } });

            alert('Registration successful! Redirecting to your dashboard...');
            navigate('/member');

        } catch (error) {
            console.error("Registration failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Registration failed: ${errorMessage}`);
        }
    };

    const hasExtraFields = signUpConfig.addressRule !== 'hidden' || 
                           signUpConfig.cityRule !== 'hidden' || 
                           signUpConfig.postalCodeRule !== 'hidden' || 
                           signUpConfig.telegramRule !== 'hidden' || 
                           signUpConfig.genderRule !== 'hidden' || 
                           signUpConfig.dateOfBirthRule !== 'hidden';

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-4">
            <SEOHead 
                title="Create Account | SmartExn" 
                robots="noindex, nofollow" 
                canonical="https://smartexn.com/register" 
            />
            <div className={`w-full ${hasExtraFields ? 'max-w-2xl' : 'max-w-md'} p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800 transition-all duration-300`}>
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-sky-500 rounded-lg flex items-center justify-center text-white">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                Smart<span className="text-sky-500">Exn</span>
                            </span>
                        </Link>
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">
                        {signUpConfig.customTitle || 'Create Your Account'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Join us and start your earning journey today.</p>
                </div>
                <form className="space-y-4" onSubmit={handleRegister}>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {signUpConfig.fullNameRule !== 'hidden' && (
                           <div>
                              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Full Name {signUpConfig.fullNameRule === 'optional' ? '(Optional)' : ''}
                              </label>
                              <input 
                                  id="fullName" 
                                  name="fullName" 
                                  type="text" 
                                  value={formData.fullName} 
                                  onChange={handleChange} 
                                  required={signUpConfig.fullNameRule === 'required'} 
                                  className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                              />
                           </div>
                        )}
                        {signUpConfig.usernameRule !== 'hidden' && (
                           <div>
                              <label htmlFor="username"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  User Name {signUpConfig.usernameRule === 'optional' ? '(Optional)' : ''}
                              </label>
                              <input 
                                  id="username" 
                                  name="username" 
                                  type="text" 
                                  value={formData.username} 
                                  onChange={handleChange} 
                                  required={signUpConfig.usernameRule === 'required'} 
                                  className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                              />
                           </div>
                        )}
                     </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                        <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {signUpConfig.phoneRule !== 'hidden' && (
                           <div>
                               <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                   Mobile Number {signUpConfig.phoneRule === 'optional' ? '(Optional)' : ''}
                               </label>
                               <input 
                                   id="phone" 
                                   name="phone" 
                                   type="tel" 
                                   value={formData.phone} 
                                   onChange={handleChange} 
                                   placeholder={signUpConfig.requireCountryCodeInPhone ? "+923001234567" : ""}
                                   required={signUpConfig.phoneRule === 'required'} 
                                   className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                               />
                           </div>
                        )}
                        {signUpConfig.whatsappRule !== 'hidden' && (
                             <div>
                                <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    WhatsApp Number {signUpConfig.whatsappRule === 'optional' ? '(Optional)' : ''}
                                </label>
                                <input 
                                    id="whatsapp" 
                                    name="whatsapp" 
                                    type="tel" 
                                    value={formData.whatsapp} 
                                    onChange={handleChange} 
                                    placeholder={signUpConfig.requireCountryCodeInWhatsapp ? "+923001234567" : ""}
                                    required={signUpConfig.whatsappRule === 'required'} 
                                    className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                />
                            </div>
                        )}
                     </div>

                     {/* Dynamic Extra Fields Grid */}
                     {hasExtraFields && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4 mt-4">
                             {signUpConfig.addressRule !== 'hidden' && (
                                 <div>
                                     <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                         Residential Address {signUpConfig.addressRule === 'optional' ? '(Optional)' : ''}
                                     </label>
                                     <input 
                                         id="address" 
                                         name="address" 
                                         type="text" 
                                         value={formData.address} 
                                         onChange={handleChange} 
                                         required={signUpConfig.addressRule === 'required'}
                                         className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                     />
                                 </div>
                             )}

                             {signUpConfig.cityRule !== 'hidden' && (
                                 <div>
                                     <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                         City {signUpConfig.cityRule === 'optional' ? '(Optional)' : ''}
                                     </label>
                                     <input 
                                         id="city" 
                                         name="city" 
                                         type="text" 
                                         value={formData.city} 
                                         onChange={handleChange} 
                                         required={signUpConfig.cityRule === 'required'}
                                         className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                     />
                                 </div>
                             )}

                             {signUpConfig.postalCodeRule !== 'hidden' && (
                                 <div>
                                     <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                         Postal/Zip Code {signUpConfig.postalCodeRule === 'optional' ? '(Optional)' : ''}
                                     </label>
                                     <input 
                                         id="postalCode" 
                                         name="postalCode" 
                                         type="text" 
                                         value={formData.postalCode} 
                                         onChange={handleChange} 
                                         required={signUpConfig.postalCodeRule === 'required'}
                                         className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                     />
                                 </div>
                             )}

                             {signUpConfig.telegramRule !== 'hidden' && (
                                 <div>
                                     <label htmlFor="telegram" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                         Telegram Username {signUpConfig.telegramRule === 'optional' ? '(Optional)' : ''}
                                     </label>
                                     <div className="relative mt-1">
                                         <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-400">@</span>
                                         <input 
                                             id="telegram" 
                                             name="telegram" 
                                             type="text" 
                                             value={formData.telegram} 
                                             onChange={handleChange} 
                                             required={signUpConfig.telegramRule === 'required'}
                                             placeholder="username"
                                             className="w-full pl-8 pr-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                         />
                                     </div>
                                 </div>
                             )}

                             {signUpConfig.genderRule !== 'hidden' && (
                                 <div>
                                     <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                         Gender {signUpConfig.genderRule === 'optional' ? '(Optional)' : ''}
                                     </label>
                                     <select 
                                         id="gender" 
                                         name="gender" 
                                         value={formData.gender} 
                                         onChange={handleChange} 
                                         required={signUpConfig.genderRule === 'required'}
                                         className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     >
                                         <option value="">Select Gender</option>
                                         <option value="Male">Male</option>
                                         <option value="Female">Female</option>
                                         <option value="Other">Other</option>
                                     </select>
                                 </div>
                             )}

                             {signUpConfig.dateOfBirthRule !== 'hidden' && (
                                 <div>
                                     <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                         Date of Birth {signUpConfig.dateOfBirthRule === 'optional' ? '(Optional)' : ''}
                                     </label>
                                     <input 
                                         id="dateOfBirth" 
                                         name="dateOfBirth" 
                                         type="date" 
                                         value={formData.dateOfBirth} 
                                         onChange={handleChange} 
                                         required={signUpConfig.dateOfBirthRule === 'required'}
                                         className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                     />
                                 </div>
                             )}
                         </div>
                     )}

                     {signUpConfig.countryRule !== 'hidden' && (
                          <div className="relative">
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Country {signUpConfig.countryRule === 'optional' ? '(Optional)' : ''}
                            </label>
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
                                required={signUpConfig.countryRule === 'required'}
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
                     )}

                     {signUpConfig.sponsorRule !== 'hidden' && (
                         <div>
                            <label htmlFor="sponsor"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Sponsor Username {signUpConfig.sponsorRule === 'optional' ? '(Optional)' : ''}
                            </label>
                            <input 
                                id="sponsor" 
                                name="sponsor" 
                                type="text" 
                                value={formData.sponsor} 
                                onChange={handleChange} 
                                readOnly={isSponsorFromUrl}
                                required={signUpConfig.sponsorRule === 'required'}
                                className={`w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${isSponsorFromUrl && 'cursor-not-allowed bg-gray-100 dark:bg-gray-700/50'}`}
                            />
                        </div>
                     )}

                     {/* Dynamic Custom Fields Rendering */}
                     {signUpConfig.customFields && signUpConfig.customFields.length > 0 && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4 mt-4 md:col-span-2">
                             {signUpConfig.customFields.map((field: any) => (
                                 <div key={field.id} className={field.type === 'checkbox' ? 'md:col-span-2' : ''}>
                                     {field.type === 'checkbox' ? (
                                         <label className="flex items-center gap-2 mt-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                             <input 
                                                 type="checkbox"
                                                 id={field.id}
                                                 checked={customFieldsValues[field.id] === 'true'}
                                                 onChange={(e) => handleCustomFieldChange(field.id, e.target.checked ? 'true' : 'false')}
                                                 required={field.required}
                                                 className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                                             />
                                             <span>
                                                 {field.label} {field.required && <span className="text-red-500">*</span>}
                                             </span>
                                         </label>
                                     ) : field.type === 'select' ? (
                                         <div>
                                             <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                 {field.label} {field.required ? <span className="text-red-500">*</span> : '(Optional)'}
                                             </label>
                                             <select
                                                 id={field.id}
                                                 value={customFieldsValues[field.id] || ''}
                                                 onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                 required={field.required}
                                                 className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                             >
                                                 <option value="">Select Option</option>
                                                 {(field.options || '').split(',').map((opt: string) => {
                                                     const trimmedOpt = opt.trim();
                                                     return (
                                                         <option key={trimmedOpt} value={trimmedOpt}>
                                                             {trimmedOpt}
                                                         </option>
                                                     );
                                                 })}
                                             </select>
                                         </div>
                                     ) : (
                                         <div>
                                             <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                 {field.label} {field.required ? <span className="text-red-500">*</span> : '(Optional)'}
                                             </label>
                                             <input
                                                 type={field.type}
                                                 id={field.id}
                                                 value={customFieldsValues[field.id] || ''}
                                                 onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                 required={field.required}
                                                 className="w-full px-3 py-2 mt-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                             />
                                         </div>
                                     )}
                                 </div>
                             ))}
                         </div>
                     )}

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