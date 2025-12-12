
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../hooks/useData';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    // SECURITY CHECK: Ensure user is logged in AND is authorized.
    // Allow if username is 'admin' OR if email is the master admin email.
    const isAdmin = state.currentUser && (
      state.currentUser.username === 'admin' || 
      state.currentUser.email === 'studio56.pk@gmail.com'
    );
    
    if (!isAdmin) {
      navigate('/secure-admin-login56', { replace: true });
    }
  }, [state.currentUser, navigate]);

  // Prevent rendering if not authorized (avoid flash of content)
  const isAdmin = state.currentUser && (
    state.currentUser.username === 'admin' || 
    state.currentUser.email === 'studio56.pk@gmail.com'
  );
  
  if (!isAdmin) {
      return null;
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
