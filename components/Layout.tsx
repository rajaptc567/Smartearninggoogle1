
import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../hooks/useData';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state } = useData();
  const navigate = useNavigate();

  // SECURITY FIX: Depend on verified role instead of hardcoded strings
  const isAdmin = useMemo(() => {
      return state.currentUser?.role === 'admin';
  }, [state.currentUser]);

  useEffect(() => {
    // Check if users list is loaded to prevent premature redirection
    if (state.currentUser && !isAdmin) {
      navigate('/login', { replace: true });
    }
    if (!state.currentUser) {
      navigate('/secure-admin-login56', { replace: true });
    }
  }, [isAdmin, state.currentUser, navigate]);

  if (!isAdmin) {
      return (
          <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
              <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="font-bold uppercase tracking-widest text-xs">Verifying Admin Privileges...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
