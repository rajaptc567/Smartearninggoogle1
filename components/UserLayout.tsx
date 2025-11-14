import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import UserSidebar from './UserSidebar';
import UserHeader from './UserHeader';
import { useData } from '../hooks/useData';

const UserLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    // This acts as a route guard. If no user is logged in, redirect to the login page.
    if (!state.currentUser) {
      navigate('/login', { replace: true });
    }
  }, [state.currentUser, navigate]);
  
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
    </div>
  );
};

export default UserLayout;