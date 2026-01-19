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
    const isAdmin = state.currentUser && (
      state.currentUser.username === 'admin' || 
      state.currentUser.email === 'studio56.pk@gmail.com'
    );
    
    if (!isAdmin) {
      navigate('/secure-admin-login56', { replace: true });
    }
  }, [state.currentUser, navigate]);

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
        
        {state.isOffline && (
            <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-1.5 px-4 text-center animate-pulse z-[60]">
                ⚠️ Secure Database Unreachable - Showing Cached System State
                <button onClick={() => window.location.reload()} className="ml-4 underline hover:text-red-200">Retry Connection</button>
            </div>
        )}

        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;