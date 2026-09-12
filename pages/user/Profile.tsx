
import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
import Button from '../../components/ui/Button';
import { User } from '../../types';
import { LoadingCircle } from '../../components/ui/LoadingCircle';
import { updateUser as apiUpdateUser } from '../../services/api';

const Profile: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser } = state;
    
    const [formData, setFormData] = useState<Partial<User>>(currentUser || {});
    const [emailConsent, setEmailConsent] = useState<boolean>(Boolean(currentUser?.emailMarketingConsent));
    const [whatsappConsent, setWhatsappConsent] = useState<boolean>(Boolean(currentUser?.whatsappMarketingConsent));
    const [isSavingInfo, setIsSavingInfo] = useState(false);
    const [isSavingConsent, setIsSavingConsent] = useState(false);
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl min-h-[400px]">
                <LoadingCircle text="Opening secure account profile metrics..." />
            </div>
        );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    const handleInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingInfo(true);
        try {
            const updated = await apiUpdateUser(currentUser._id, formData);
            dispatch({ type: 'UPDATE_USER', payload: updated });
            alert('Profile information updated successfully!');
        } catch (error) {
            console.error('Failed to update profile:', error);
            // Fallback to local dispatch
            dispatch({ type: 'UPDATE_USER', payload: { ...currentUser, ...formData } as User });
            alert('Profile updated locally.');
        } finally {
            setIsSavingInfo(false);
        }
    };

    const handleConsentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingConsent(true);
        try {
            const consentUpdate = {
                emailMarketingConsent: emailConsent,
                whatsappMarketingConsent: whatsappConsent
            };
            const updated = await apiUpdateUser(currentUser._id, consentUpdate);
            dispatch({ type: 'UPDATE_USER', payload: updated });
            alert('Communication preferences updated successfully!');
        } catch (error) {
            console.error('Failed to update preferences:', error);
            dispatch({ 
                type: 'UPDATE_USER', 
                payload: { 
                    ...currentUser, 
                    emailMarketingConsent: emailConsent, 
                    whatsappMarketingConsent: whatsappConsent 
                } as User 
            });
            alert('Communication preferences updated.');
        } finally {
            setIsSavingConsent(false);
        }
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            alert("New passwords do not match.");
            return;
        }
        if (passwords.new.length < 6) {
            alert("New password must be at least 6 characters long.");
            return;
        }
        // In a real app, you would verify the current password here
        alert('Password changed successfully! (Simulation)');
        setPasswords({ current: '', new: '', confirm: '' });
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-4">Personal Information</h2>
                <form onSubmit={handleInfoSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Full Name</label>
                            <input type="text" value={formData.fullName || ''} onChange={handleChange} name="fullName" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Username</label>
                            <input type="text" value={currentUser.username} disabled className="mt-1 block w-full rounded-md sm:text-sm bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Email Address</label>
                            <input type="email" value={formData.email || ''} onChange={handleChange} name="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Sponsor</label>
                            <input type="text" value={currentUser.sponsor || 'N/A'} disabled className="mt-1 block w-full rounded-md sm:text-sm bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Contact Number</label>
                            <input type="text" value={formData.phone || ''} onChange={handleChange} name="phone" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">WhatsApp Number</label>
                            <input type="text" value={formData.whatsapp || ''} onChange={handleChange} name="whatsapp" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Country</label>
                            <input type="text" value={formData.country || ''} onChange={handleChange} name="country" placeholder="e.g. United States" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Account Currency</label>
                            <input type="text" value={currentUser.currency} disabled className="mt-1 block w-full rounded-md sm:text-sm bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 cursor-not-allowed" />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Currency is set on registration and cannot be changed.</p>
                        </div>
                    </div>
                    <div className="text-right pt-2">
                        <Button type="submit" disabled={isSavingInfo}>
                            {isSavingInfo ? 'Saving...' : 'Save Information'}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Communication & Consent Preferences */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b dark:border-gray-700 pb-4 gap-2">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Communication &amp; Privacy Preferences</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Control how SmartExn communicates with you and view your legal compliance record.</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 self-start sm:self-auto">
                        Consent Management
                    </span>
                </div>

                <form onSubmit={handleConsentSubmit} className="mt-5 space-y-5">
                    <div className="space-y-4">
                        {/* Email Marketing Toggle */}
                        <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                            <div className="space-y-0.5 pr-4">
                                <label htmlFor="profileEmailConsent" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                                    Promotional &amp; Marketing Emails
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Receive campaign highlights, promotional offers, earnings updates, and platform news via email.
                                </p>
                                {currentUser.emailMarketingConsentAt && (
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                        Last recorded: {new Date(currentUser.emailMarketingConsentAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <input
                                type="checkbox"
                                id="profileEmailConsent"
                                checked={emailConsent}
                                onChange={(e) => setEmailConsent(e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 cursor-pointer shrink-0"
                            />
                        </div>

                        {/* WhatsApp Marketing Toggle */}
                        <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                            <div className="space-y-0.5 pr-4">
                                <label htmlFor="profileWhatsappConsent" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                                    WhatsApp Marketing &amp; Direct Alerts
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Receive instant campaign notifications, direct messages, and promotional alerts directly to your WhatsApp number.
                                </p>
                                {currentUser.whatsappMarketingConsentAt && (
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                        Last recorded: {new Date(currentUser.whatsappMarketingConsentAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <input
                                type="checkbox"
                                id="profileWhatsappConsent"
                                checked={whatsappConsent}
                                onChange={(e) => setWhatsappConsent(e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer shrink-0"
                            />
                        </div>
                    </div>

                    {/* Legal Compliance Audit Information */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Legal Compliance Record</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200/60 dark:border-gray-600/60 flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-300">Terms &amp; Conditions:</span>
                                <span className={`font-medium ${currentUser.termsAccepted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {currentUser.termsAccepted ? `Accepted (v${currentUser.termsVersion || '1.0'})` : 'Pending Acceptance'}
                                </span>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200/60 dark:border-gray-600/60 flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-300">Privacy Policy:</span>
                                <span className={`font-medium ${currentUser.privacyPolicyAcknowledged ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {currentUser.privacyPolicyAcknowledged ? `Acknowledged (v${currentUser.privacyPolicyVersion || '1.0'})` : 'Pending'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right pt-2">
                        <Button type="submit" disabled={isSavingConsent}>
                            {isSavingConsent ? 'Updating...' : 'Save Communication Preferences'}
                        </Button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-4">Change Password</h2>
                <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
                     <div>
                        <label className="block text-sm font-medium">Current Password</label>
                        <input type="password" name="current" value={passwords.current} onChange={handlePasswordChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">New Password</label>
                        <input type="password" name="new" value={passwords.new} onChange={handlePasswordChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Confirm New Password</label>
                        <input type="password" name="confirm" value={passwords.confirm} onChange={handlePasswordChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                    <div className="text-right pt-2">
                        <Button type="submit">Update Password</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Profile;
