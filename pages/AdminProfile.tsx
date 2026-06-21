
import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import Button from '../components/ui/Button';
import { User } from '../types';
import { updateUser } from '../services/api';
import { LoadingCircle } from '../components/ui/LoadingCircle';

const AdminProfile: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser } = state;
    
    const [formData, setFormData] = useState<Partial<User>>({
        email: currentUser?.email || '',
        fullName: currentUser?.fullName || '',
    });
    
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [isSaving, setIsSaving] = useState(false);

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl min-h-[400px]">
                <LoadingCircle text="Retrieving admin credentials..." />
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
        setIsSaving(true);
        try {
            const updatedUser = await updateUser(currentUser._id, formData);
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
            dispatch({ type: 'SET_CURRENT_USER', payload: updatedUser }); // Update current session
            alert('Admin profile updated successfully! If you changed your email, please use the new email to login next time.');
        } catch (error) {
            console.error(error);
            alert('Failed to update profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            alert("New passwords do not match.");
            return;
        }
        if (passwords.new.length < 6) {
            alert("New password must be at least 6 characters long.");
            return;
        }
        
        setIsSaving(true);
        try {
            // Update user with new password - backend handles hashing
            const updatedUser = await updateUser(currentUser._id, { password: passwords.new } as any);
            // Don't update global state with password field included (though backend strips it usually)
            // Just notify user
            alert('Password changed successfully! Please login again with your new password next time.');
            setPasswords({ new: '', confirm: '' });
        } catch (error) {
            console.error(error);
            alert('Failed to change password.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Admin Settings</h1>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-4">Account Information</h2>
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-800 dark:text-blue-200 rounded-md">
                    <strong>Important:</strong> You can update your email address here. This will update your login credentials for the admin panel immediately.
                </div>
                <form onSubmit={handleInfoSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Admin Name</label>
                            <input type="text" value={formData.fullName} onChange={handleChange} name="fullName" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                            <input type="text" value={currentUser.username} disabled className="mt-1 block w-full rounded-md sm:text-sm bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 cursor-not-allowed text-gray-500" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                            <input type="email" value={formData.email} onChange={handleChange} name="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        </div>
                    </div>
                    <div className="text-right pt-2">
                        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Info'}</Button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-4">Change Password</h2>
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 text-sm text-yellow-800 dark:text-yellow-200 rounded-md">
                    <strong>Note:</strong> Changing your password will take effect immediately. Please remember it for your next login.
                </div>
                <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                        <input type="password" name="new" value={passwords.new} onChange={handlePasswordChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                        <input type="password" name="confirm" value={passwords.confirm} onChange={handlePasswordChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                    <div className="text-right pt-2">
                        <Button type="submit" disabled={isSaving} variant="danger">{isSaving ? 'Updating...' : 'Update Password'}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminProfile;
