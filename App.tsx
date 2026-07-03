
import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useData } from './hooks/useData';
import { FullPageLoader } from './components/ui/LoadingCircle';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Deposits from './pages/Deposits';
import Withdrawals from './pages/Withdrawals';
import PaymentMethods from './pages/PaymentMethods';
import InvestmentPlans from './pages/InvestmentPlans';
import PlanEquivalency from './pages/PlanEquivalency';
import Wallet from './pages/Wallet';
import Rules from './pages/Rules';
import SponsorCommissionRules from './pages/SponsorCommissionRules';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Transfers from './pages/Transfers';
import PasswordResets from './pages/PasswordResets';
import AdminDisputes from './pages/AdminDisputes';
import SentMessages from './pages/SentMessages';
import TickerSettings from './pages/TickerSettings';
import AdminProfile from './pages/AdminProfile';
import AdminTasks from './pages/AdminTasks';
import AdminTemplates from './pages/AdminTemplates';
import AdminNotifications from './pages/AdminNotifications';

// Public facing components
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FaqPage from './pages/FaqPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RefundPolicy from './pages/RefundPolicy';
import TermsOfUse from './pages/TermsOfUse';

// User facing components
import UserLayout from './components/UserLayout';
import UserDashboard from './pages/UserDashboard';
import DepositFunds from './pages/user/DepositFunds';
import WithdrawFunds from './pages/user/WithdrawFunds';
import UserInvestmentPlans from './pages/user/UserInvestmentPlans';
import Transactions from './pages/user/Transactions';
import Referrals from './pages/user/Referrals';
import Profile from './pages/user/Profile';
import TransferFunds from './pages/user/TransferFunds';
import ActivePlans from './pages/user/ActivePlans';
import UserDisputes from './pages/user/UserDisputes';
import Messages from './pages/user/Messages';
import UserTasks from './pages/user/UserTasks';


const App: React.FC = () => {
  const { state } = useData();
  const [introFinished, setIntroFinished] = useState(false);

  const showGlobalLoader = state.settings.isInitialPageLoaderEnabled !== false;

  return (
    <>
      {showGlobalLoader && (!introFinished || state.isLoading) && (
        <FullPageLoader 
          isDataLoading={state.isLoading} 
          onFinished={() => setIntroFinished(true)} 
        />
      )}
      <HashRouter>
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/faqs" element={<FaqPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/terms-of-use" element={<TermsOfUse />} />
        <Route path="/secure-admin-login56" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Admin Panel Routes */}
        <Route path="/admin" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="deposits" element={<Deposits />} />
          <Route path="withdrawals" element={<Withdrawals />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="password-resets" element={<PasswordResets />} />
          <Route path="payment-methods" element={<PaymentMethods />} />
          <Route path="investment-plans" element={<InvestmentPlans />} />
          <Route path="plan-equivalency" element={<PlanEquivalency />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="rules" element={<Rules />} />
          <Route path="sponsor-commission-rules" element={<SponsorCommissionRules />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="ticker-settings" element={<TickerSettings />} />
          <Route path="logs" element={<Logs />} />
          <Route path="disputes" element={<AdminDisputes />} />
          <Route path="sent-messages" element={<SentMessages />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="notifications" element={<AdminNotifications />} />
        </Route>

        {/* User Member Area Routes */}
        <Route path="/member" element={<UserLayout />}>
          <Route index element={<UserDashboard />} />
          <Route path="deposit" element={<DepositFunds />} />
          <Route path="withdraw" element={<WithdrawFunds />} />
          <Route path="transfer" element={<TransferFunds />} />
          <Route path="plans" element={<UserInvestmentPlans />} />
          <Route path="active-plans" element={<ActivePlans />} />
          <Route path="tasks" element={<UserTasks />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="referrals" element={<Referrals />} />
          <Route path="disputes" element={<UserDisputes />} />
          <Route path="messages" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
      <WhatsAppFloatingButton />
    </HashRouter>
  </>
  );
};

const WhatsAppFloatingButton: React.FC = () => {
    const { state } = useData();
    const location = useLocation();
    
    const whatsappNumber = state.settings?.whatsappNumber;
    const whatsappFloatingEnabled = state.settings?.whatsappFloatingEnabled;
    if (!whatsappNumber || whatsappFloatingEnabled === false) return null;
    
    // Hide floating widget on admin pages
    if (location.pathname.startsWith('/admin')) return null;
    
    const cleaned = whatsappNumber.replace(/[^0-9]/g, '');
    if (!cleaned) return null;
    
    const url = `https://wa.me/${cleaned}`;
    
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-emerald-500 rounded-full shadow-2xl hover:bg-emerald-600 active:bg-emerald-700 transition-all duration-300 hover:scale-110 group cursor-pointer"
            aria-label="Contact support on WhatsApp"
            style={{ boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)' }}
        >
            {/* WhatsApp Icon */}
            <svg className="w-7 h-7 md:w-8 md:h-8 text-white fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.63-1.019-5.101-2.871-6.955C16.6 1.93 14.124.912 11.493.912c-5.438 0-9.863 4.42-9.866 9.865-.001 1.745.457 3.447 1.328 4.966L1.93 21.054l5.428-1.424-.711-.476zm11.01-6.17c-.31-.156-1.84-.908-2.126-1.012-.287-.104-.496-.156-.705.156-.209.312-.81 1.012-.992 1.22-.183.208-.365.234-.675.078-.31-.156-1.31-.48-2.493-1.537-.92-.818-1.54-1.83-1.72-2.14-.18-.31-.019-.477.136-.631.14-.139.31-.362.465-.544.155-.181.206-.31.31-.518.104-.208.052-.389-.026-.544-.078-.156-.705-1.7-.966-2.327-.254-.61-.514-.528-.705-.528-.183 0-.391-.012-.6-.012s-.548.078-.835.39c-.287.313-1.096 1.072-1.096 2.614 0 1.54 1.121 3.03 1.277 3.238.156.208 2.207 3.37 5.348 4.729.747.323 1.33.516 1.784.66.751.238 1.436.204 1.977.123.602-.09 1.84-.753 2.1-1.443.26-.69.26-1.282.182-1.403-.078-.12-.286-.19-.597-.346z" />
            </svg>
            
            {/* Tooltip on Hover */}
            <span className="absolute right-14 md:right-16 scale-0 transition-all duration-200 origin-right group-hover:scale-100 bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-200 font-bold text-[10px] uppercase tracking-wider py-2 px-3 rounded-xl whitespace-nowrap shadow-xl">
                Chat on WhatsApp
            </span>
        </a>
    );
};

export default App;
