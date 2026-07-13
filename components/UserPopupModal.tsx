import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { markNotificationPopupAsShown } from '../services/api';
import { Notification } from '../types';

export const UserPopupModal: React.FC = () => {
    const { state, dispatch } = useData();
    const { notifications, currentUser } = state;
    const navigate = useNavigate();
    const location = useLocation();

    const [activePopup, setActivePopup] = useState<Notification | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Register global close function for any HTML snippet referencing closeSmartexnPopup()
    useEffect(() => {
        (window as any).closeSmartexnPopup = () => {
            handleDismiss();
        };
        return () => {
            delete (window as any).closeSmartexnPopup;
        };
    }, [activePopup, isVisible]);

    // Find the first eligible popup notification that hasn't been shown yet or matches every_visit/login
    useEffect(() => {
        // Do not show popup modals to admin users in the admin panel
        if (currentUser?.role === 'admin' || location.pathname.startsWith('/admin')) {
            setActivePopup(null);
            setIsVisible(false);
            return;
        }

        const isHomepage = location.pathname === '/';
        
        const eligiblePopups = notifications.filter(n => {
            if (!n.isPopup) return false;
            
            // Check if dismissed in this session already
            const sessionDismissed = sessionStorage.getItem(`dismissed_popup_${n._id}`);
            if (sessionDismissed === 'true') return false;

            // Check target user or broadcast
            const isForUser = currentUser && n.userId === currentUser._id;
            const isForGuestOrHomepage = isHomepage; // Broadcast or homepage popups
            
            if (!isForUser && !isForGuestOrHomepage) return false;

            const trigger = n.displayTrigger || 'login';
            const freq = n.frequency || 'once_per_user';

            if (freq === 'every_visit') return !sessionDismissed;
            if (trigger === 'login' && currentUser) return !n.popupShown;
            if (trigger === 'homepage' && isHomepage) return !n.popupShown;

            return !n.popupShown;
        });

        if (eligiblePopups.length > 0) {
            const popup = eligiblePopups[0];
            setActivePopup(popup);

            const trigger = popup.displayTrigger || 'login';
            let delayMs = 0;

            if (trigger === 'delay_30s') delayMs = 30000;
            else if (trigger === 'delay_2m') delayMs = 120000;
            else if (trigger === 'delay_10m') delayMs = 600000;

            if (delayMs > 0) {
                const timer = setTimeout(() => {
                    setIsVisible(true);
                }, delayMs);
                return () => clearTimeout(timer);
            } else {
                setIsVisible(true);
            }
        } else {
            setActivePopup(null);
            setIsVisible(false);
        }
    }, [notifications, currentUser, location.pathname]);

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isVisible) {
                handleDismiss();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, activePopup]);

    const handleDismiss = async () => {
        if (!activePopup) return;
        try {
            if (activePopup._id) {
                sessionStorage.setItem(`dismissed_popup_${activePopup._id}`, 'true');
                const updatedList = await markNotificationPopupAsShown(activePopup._id);
                dispatch({ type: 'SET_NOTIFICATIONS', payload: updatedList });
            }
            setIsVisible(false);
            setActivePopup(null);
        } catch (err) {
            console.error('Failed to mark popup as shown:', err);
            if (activePopup?._id) {
                sessionStorage.setItem(`dismissed_popup_${activePopup._id}`, 'true');
            }
            setIsVisible(false);
            setActivePopup(null);
        }
    };

    const handleActionClick = () => {
        if (!activePopup || !activePopup.actionButtonLink) return;
        const link = activePopup.actionButtonLink;
        handleDismiss();
        if (link.startsWith('http')) {
            window.open(link, '_blank');
        } else {
            navigate(link);
        }
    };

    if (!isVisible || !activePopup) return null;

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={handleDismiss}
        >
            <div 
                className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 max-w-lg w-full overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                
                {/* Optional Banner Image */}
                {activePopup.imageUrl && (
                    <div className="relative w-full h-52 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <img 
                            src={activePopup.imageUrl} 
                            alt={activePopup.subject || 'Announcement'} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <button 
                            onClick={handleDismiss}
                            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="p-8 space-y-5">
                    {!activePopup.imageUrl && (
                        <div className="flex justify-between items-start">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                Announcement
                            </span>
                            <button 
                                onClick={handleDismiss}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {activePopup.subject && (
                        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                            {activePopup.subject}
                        </h3>
                    )}

                    {/* Rich HTML Description with rendered-html styling */}
                    <div 
                        className="rendered-html text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-72 overflow-y-auto pr-2 custom-scrollbar"
                        dangerouslySetInnerHTML={{ __html: activePopup.message }}
                    />

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                        {activePopup.actionButtonText && activePopup.actionButtonLink && (
                            <button
                                onClick={handleActionClick}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition-all text-sm uppercase tracking-wider text-center"
                            >
                                {activePopup.actionButtonText}
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className={`${activePopup.actionButtonText && activePopup.actionButtonLink ? 'sm:w-auto px-6' : 'w-full'} bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3.5 rounded-2xl transition-all text-xs uppercase tracking-widest text-center`}
                        >
                            Got it / Dismiss
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
