
import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import UserSidebar from './UserSidebar';
import UserHeader from './UserHeader';
import { useData } from '../hooks/useData';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { markNotificationPopupAsShown } from '../services/api';

const UserLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, dispatch } = useData();
  const { currentUser, notifications } = state;
  const navigate = useNavigate();

  // Popup State
  const [popupNotification, setPopupNotification] = useState<any | null>(null);

  useEffect(() => {
    // This acts as a route guard. If no user is logged in, redirect to the login page.
    if (!state.currentUser) {
      navigate('/login', { replace: true });
    }
  }, [state.currentUser, navigate]);

  // Check for unread POPUP notifications
  useEffect(() => {
      if (currentUser && notifications.length > 0) {
          // Find the first notification that is marked as a popup and hasn't been shown yet
          const popup = notifications.find(n => 
              n.userId === currentUser._id && 
              n.isPopup === true && 
              n.popupShown === false
          );
          
          if (popup) {
              setPopupNotification(popup);
          } else {
              setPopupNotification(null);
          }
      }
  }, [currentUser, notifications]);

  const handleClosePopup = async () => {
      if (popupNotification) {
          try {
              // Mark as shown in backend
              const updatedNotifications = await markNotificationPopupAsShown(popupNotification._id);
              dispatch({ type: 'SET_NOTIFICATIONS', payload: updatedNotifications });
              setPopupNotification(null);
          } catch (error) {
              console.error("Failed to mark popup as shown", error);
              setPopupNotification(null); // Close locally anyway to not block user
          }
      }
  };
  
  // Don't render the layout if there's no user, to prevent children from
  // rendering with null data before the redirect happens.
  if (!state.currentUser) {
    return null; 
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <UserSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <UserHeader setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Popup Modal */}
      {popupNotification && (
          <Modal isOpen={true} onClose={handleClosePopup}>
              <div className="p-6 max-w-md text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
                      <svg className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {popupNotification.subject || 'Important Message'}
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap">
                      {popupNotification.message}
                  </div>
                  <Button onClick={handleClosePopup} className="w-full">
                      Acknowledge & Close
                  </Button>
              </div>
          </Modal>
      )}
    </div>
  );
};

export default UserLayout;