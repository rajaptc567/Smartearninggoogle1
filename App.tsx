import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useData } from './hooks/useData';
import { FullPageLoader } from './components/ui/LoadingCircle';
import { UserPopupModal } from './components/UserPopupModal';
import { SeoAnalyticsTracker } from './components/SeoAnalyticsTracker';
import { ModulePageGuard } from './components/ModulePageGuard';

// Public Critical Entry Point - Kept eagerly imported for instant First Contentful Paint / Hero render
import HomePage from './pages/HomePage';

// Lazy-loaded Admin Layout and Panels
const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const Deposits = lazy(() => import('./pages/Deposits'));
const Withdrawals = lazy(() => import('./pages/Withdrawals'));
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'));
const InvestmentPlans = lazy(() => import('./pages/InvestmentPlans'));
const PlanEquivalency = lazy(() => import('./pages/PlanEquivalency'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Rules = lazy(() => import('./pages/Rules'));
const SponsorCommissionRules = lazy(() => import('./pages/SponsorCommissionRules'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Logs = lazy(() => import('./pages/Logs'));
const Transfers = lazy(() => import('./pages/Transfers'));
const PasswordResets = lazy(() => import('./pages/PasswordResets'));
const AdminDisputes = lazy(() => import('./pages/AdminDisputes'));
const SentMessages = lazy(() => import('./pages/SentMessages'));
const TickerSettings = lazy(() => import('./pages/TickerSettings'));
const AdminProfile = lazy(() => import('./pages/AdminProfile'));
const AdminTasks = lazy(() => import('./pages/AdminTasks'));
const AdminUserTasks = lazy(() => import('./pages/AdminUserTasks'));
const AdminTaskCategories = lazy(() => import('./pages/AdminTaskCategories'));
const AdminWorkAndEarnEditor = lazy(() => import('./pages/admin/AdminWorkAndEarnEditor'));
const AdminWithdrawalRules = lazy(() => import('./pages/AdminWithdrawalRules'));
const AdminTemplates = lazy(() => import('./pages/AdminTemplates'));
const AdminNotifications = lazy(() => import('./pages/AdminNotifications'));
const AdminFinancialReconciliation = lazy(() => import('./pages/admin/AdminFinancialReconciliation'));
const AdminSeoIntelligence = lazy(() => import('./pages/admin/AdminSeoIntelligence'));

// Lazy-loaded Public Knowledge & Static Pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Advertise = lazy(() => import('./pages/Advertise'));
const MicroTasks = lazy(() => import('./pages/MicroTasks'));
const PaidSurveys = lazy(() => import('./pages/PaidSurveys'));
const HowItWorksForWorkers = lazy(() => import('./pages/HowItWorksForWorkers'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const TrustAndSafety = lazy(() => import('./pages/TrustAndSafety'));
const TaskProofGuide = lazy(() => import('./pages/TaskProofGuide'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const HowToCompleteMicroTasks = lazy(() => import('./pages/HowToCompleteMicroTasks'));
const KnowledgeTaskProof = lazy(() => import('./pages/KnowledgeTaskProof'));
const WhyTasksGetRejected = lazy(() => import('./pages/WhyTasksGetRejected'));
const OnlinePaidSurveysGuide = lazy(() => import('./pages/OnlinePaidSurveysGuide'));
const HowToCreateCampaign = lazy(() => import('./pages/HowToCreateCampaign'));
const CrowdsourcedWorkforceGuide = lazy(() => import('./pages/CrowdsourcedWorkforceGuide'));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

// Cluster 1: Micro-Tasks Subtopics
const SocialMediaTasks = lazy(() => import('./pages/microtasks/SocialMediaTasks').then(m => ({ default: m.SocialMediaTasks })));
const AppTestingTasks = lazy(() => import('./pages/microtasks/AppTestingTasks').then(m => ({ default: m.AppTestingTasks })));
const WebsiteTestingTasks = lazy(() => import('./pages/microtasks/WebsiteTestingTasks').then(m => ({ default: m.WebsiteTestingTasks })));
const DataVerificationTasks = lazy(() => import('./pages/microtasks/DataVerificationTasks').then(m => ({ default: m.DataVerificationTasks })));
const ResearchTasks = lazy(() => import('./pages/microtasks/ResearchTasks').then(m => ({ default: m.ResearchTasks })));
const ProofBasedTasks = lazy(() => import('./pages/microtasks/ProofBasedTasks').then(m => ({ default: m.ProofBasedTasks })));

// Cluster 2: Survey Authority Subtopics
const HowOnlineSurveysWork = lazy(() => import('./pages/surveys/HowOnlineSurveysWork').then(m => ({ default: m.HowOnlineSurveysWork })));
const SurveyQualification = lazy(() => import('./pages/surveys/SurveyQualification').then(m => ({ default: m.SurveyQualification })));
const SurveyScreenOuts = lazy(() => import('./pages/surveys/SurveyScreenOuts').then(m => ({ default: m.SurveyScreenOuts })));
const AttentionChecks = lazy(() => import('./pages/surveys/AttentionChecks').then(m => ({ default: m.AttentionChecks })));
const SurveyRewards = lazy(() => import('./pages/surveys/SurveyRewards').then(m => ({ default: m.SurveyRewards })));
const SurveyQuality = lazy(() => import('./pages/surveys/SurveyQuality').then(m => ({ default: m.SurveyQuality })));

// Cluster 3: Worker Education Subtopics
const HowToFindTasks = lazy(() => import('./pages/workers/HowToFindTasks').then(m => ({ default: m.HowToFindTasks })));
const HowToSubmitProof = lazy(() => import('./pages/workers/HowToSubmitProof').then(m => ({ default: m.HowToSubmitProof })));
const HowToAvoidTaskRejection = lazy(() => import('./pages/workers/HowToAvoidTaskRejection').then(m => ({ default: m.HowToAvoidTaskRejection })));
const TaskCompletionTips = lazy(() => import('./pages/workers/TaskCompletionTips').then(m => ({ default: m.TaskCompletionTips })));
const WorkerAccountSecurity = lazy(() => import('./pages/workers/WorkerAccountSecurity').then(m => ({ default: m.WorkerAccountSecurity })));
const RewardAndWithdrawalGuide = lazy(() => import('./pages/workers/RewardAndWithdrawalGuide').then(m => ({ default: m.RewardAndWithdrawalGuide })));

// Cluster 4: Advertiser Authority Subtopics
const SocialMediaCampaigns = lazy(() => import('./pages/advertisers/SocialMediaCampaigns').then(m => ({ default: m.SocialMediaCampaigns })));
const AppTestingCampaigns = lazy(() => import('./pages/advertisers/AppTestingCampaigns').then(m => ({ default: m.AppTestingCampaigns })));
const WebsiteTestingCampaigns = lazy(() => import('./pages/advertisers/WebsiteTestingCampaigns').then(m => ({ default: m.WebsiteTestingCampaigns })));
const SurveyCampaigns = lazy(() => import('./pages/advertisers/SurveyCampaigns').then(m => ({ default: m.SurveyCampaigns })));
const DataVerificationCampaigns = lazy(() => import('./pages/advertisers/DataVerificationCampaigns').then(m => ({ default: m.DataVerificationCampaigns })));
const CrowdsourcedResearch = lazy(() => import('./pages/advertisers/CrowdsourcedResearch').then(m => ({ default: m.CrowdsourcedResearch })));

// Cluster 5: Trust & Safety Subtopics
const EscrowSecurity = lazy(() => import('./pages/trust/EscrowSecurity').then(m => ({ default: m.EscrowSecurity })));
const ProofVerificationSystem = lazy(() => import('./pages/trust/ProofVerificationSystem').then(m => ({ default: m.ProofVerificationSystem })));
const FraudPreventionArchitecture = lazy(() => import('./pages/trust/FraudPreventionArchitecture').then(m => ({ default: m.FraudPreventionArchitecture })));
const DisputeResolutionSystem = lazy(() => import('./pages/trust/DisputeResolutionSystem').then(m => ({ default: m.DisputeResolutionSystem })));
const EnterpriseAccountSecurity = lazy(() => import('./pages/trust/EnterpriseAccountSecurity').then(m => ({ default: m.EnterpriseAccountSecurity })));

// Lazy-loaded Member Area Components
const UserLayout = lazy(() => import('./components/UserLayout'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const DepositFunds = lazy(() => import('./pages/user/DepositFunds'));
const WithdrawFunds = lazy(() => import('./pages/user/WithdrawFunds'));
const UserInvestmentPlans = lazy(() => import('./pages/user/UserInvestmentPlans'));
const Transactions = lazy(() => import('./pages/user/Transactions'));
const Referrals = lazy(() => import('./pages/user/Referrals'));
const Profile = lazy(() => import('./pages/user/Profile'));
const TransferFunds = lazy(() => import('./pages/user/TransferFunds'));
const ActivePlans = lazy(() => import('./pages/user/ActivePlans'));
const UserDisputes = lazy(() => import('./pages/user/UserDisputes'));
const Messages = lazy(() => import('./pages/user/Messages'));
const UserTasks = lazy(() => import('./pages/user/UserTasks'));
const UserTasksSubmit = lazy(() => import('./pages/user/UserTasksSubmit'));
const HubFaqs = lazy(() => import('./pages/user/HubFaqs'));
const HubLegal = lazy(() => import('./pages/user/HubLegal'));
const WorkAndEarnHistory = lazy(() => import('./pages/user/WorkAndEarnHistory'));

// Backward compatibility redirector for legacy hash-based URLs (e.g. /#/how-it-works -> /how-it-works)
const HashToPathRedirector: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.startsWith('#/')) {
        const cleanPath = window.location.hash.substring(1);
        try {
          window.history.replaceState(null, '', cleanPath);
        } catch (e) {}
        navigate(cleanPath, { replace: true });
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [navigate]);
  return null;
};

// Non-blocking, lightweight route loading indicator
const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-8 bg-slate-900/50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs uppercase tracking-widest font-semibold text-slate-400">Loading...</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const { state } = useData();
  const [introFinished, setIntroFinished] = useState(false);

  const showGlobalLoader = state.settings.isInitialPageLoaderEnabled === true && state.isLoading;

  return (
    <>
      {showGlobalLoader && (!introFinished || state.isLoading) && (
        <FullPageLoader 
          isDataLoading={state.isLoading} 
          onFinished={() => setIntroFinished(true)} 
        />
      )}
      <BrowserRouter>
        <HashToPathRedirector />
        <SeoAnalyticsTracker />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/advertise" element={<Advertise />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/micro-tasks" element={<MicroTasks />} />
            <Route path="/paid-surveys" element={<PaidSurveys />} />
            <Route path="/how-it-works-for-workers" element={<HowItWorksForWorkers />} />
            <Route path="/task-proof" element={<TaskProofGuide />} />
            <Route path="/trust-and-safety" element={<TrustAndSafety />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="/knowledge-base/how-to-complete-micro-tasks" element={<HowToCompleteMicroTasks />} />
            <Route path="/knowledge-base/task-proof-guide" element={<KnowledgeTaskProof />} />
            <Route path="/knowledge-base/why-tasks-get-rejected" element={<WhyTasksGetRejected />} />
            <Route path="/knowledge-base/online-paid-surveys-guide" element={<OnlinePaidSurveysGuide />} />
            <Route path="/knowledge-base/how-to-create-a-campaign" element={<HowToCreateCampaign />} />
            <Route path="/knowledge-base/crowdsourced-workforce-guide" element={<CrowdsourcedWorkforceGuide />} />

            {/* Micro-Tasks Cluster */}
            <Route path="/micro-tasks/social-media-tasks" element={<SocialMediaTasks />} />
            <Route path="/micro-tasks/app-testing" element={<AppTestingTasks />} />
            <Route path="/micro-tasks/website-testing" element={<WebsiteTestingTasks />} />
            <Route path="/micro-tasks/data-verification" element={<DataVerificationTasks />} />
            <Route path="/micro-tasks/research-tasks" element={<ResearchTasks />} />
            <Route path="/micro-tasks/proof-based-tasks" element={<ProofBasedTasks />} />

            {/* Paid Surveys Cluster */}
            <Route path="/paid-surveys/how-online-surveys-work" element={<HowOnlineSurveysWork />} />
            <Route path="/paid-surveys/survey-qualification" element={<SurveyQualification />} />
            <Route path="/paid-surveys/survey-screen-outs" element={<SurveyScreenOuts />} />
            <Route path="/paid-surveys/attention-checks" element={<AttentionChecks />} />
            <Route path="/paid-surveys/survey-rewards" element={<SurveyRewards />} />
            <Route path="/paid-surveys/survey-quality" element={<SurveyQuality />} />

            {/* Worker Education Cluster */}
            <Route path="/workers/how-to-find-tasks" element={<HowToFindTasks />} />
            <Route path="/workers/how-to-submit-proof" element={<HowToSubmitProof />} />
            <Route path="/workers/how-to-avoid-task-rejection" element={<HowToAvoidTaskRejection />} />
            <Route path="/workers/task-completion-tips" element={<TaskCompletionTips />} />
            <Route path="/workers/account-security" element={<WorkerAccountSecurity />} />
            <Route path="/workers/reward-and-withdrawal-guide" element={<RewardAndWithdrawalGuide />} />

            {/* Advertiser Authority Cluster */}
            <Route path="/advertise/social-media-campaigns" element={<SocialMediaCampaigns />} />
            <Route path="/advertise/app-testing-campaigns" element={<AppTestingCampaigns />} />
            <Route path="/advertise/website-testing-campaigns" element={<WebsiteTestingCampaigns />} />
            <Route path="/advertise/survey-campaigns" element={<SurveyCampaigns />} />
            <Route path="/advertise/data-verification-campaigns" element={<DataVerificationCampaigns />} />
            <Route path="/advertise/crowdsourced-research" element={<CrowdsourcedResearch />} />

            {/* Trust & Safety Cluster */}
            <Route path="/trust-and-safety/escrow" element={<EscrowSecurity />} />
            <Route path="/trust-and-safety/proof-verification" element={<ProofVerificationSystem />} />
            <Route path="/trust-and-safety/fraud-prevention" element={<FraudPreventionArchitecture />} />
            <Route path="/trust-and-safety/disputes" element={<DisputeResolutionSystem />} />
            <Route path="/trust-and-safety/account-security" element={<EnterpriseAccountSecurity />} />

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
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="deposits" element={<Deposits />} />
              <Route path="withdrawals" element={<Withdrawals />} />
              <Route path="transfers" element={<Transfers />} />
              <Route path="password-resets" element={<PasswordResets />} />
              <Route path="payment-methods" element={<PaymentMethods />} />
              <Route path="investment-plans" element={<InvestmentPlans />} />
              <Route path="plan-equivalency" element={<PlanEquivalency />} />
              <Route path="tasks" element={<AdminTasks />} />
              <Route path="user-tasks" element={<AdminUserTasks />} />
              <Route path="task-categories" element={<AdminTaskCategories />} />
              <Route path="work-and-earn-editor" element={<AdminWorkAndEarnEditor />} />
              <Route path="withdrawal-rules" element={<AdminWithdrawalRules />} />
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
              <Route path="reconciliation" element={<AdminFinancialReconciliation />} />
              <Route path="seo-intelligence" element={<AdminSeoIntelligence />} />
            </Route>

            {/* User Member Area Routes */}
            <Route path="/member" element={<UserLayout />}>
              <Route index element={<UserDashboard />} />
              <Route path="dashboard" element={<UserDashboard />} />
              <Route path="work-and-earn" element={<UserDashboard />} />
              <Route path="dashboard-hub" element={<UserDashboard />} />
              <Route path="deposit" element={<ModulePageGuard category="investment" pageId="deposit"><DepositFunds /></ModulePageGuard>} />
              <Route path="withdraw" element={<ModulePageGuard category="investment" pageId="withdraw"><WithdrawFunds /></ModulePageGuard>} />
              <Route path="transfer" element={<ModulePageGuard category="investment" pageId="transfer"><TransferFunds /></ModulePageGuard>} />
              <Route path="plans" element={<ModulePageGuard category="investment" pageId="plans"><UserInvestmentPlans /></ModulePageGuard>} />
              <Route path="active-plans" element={<ModulePageGuard category="investment" pageId="activePlans"><ActivePlans /></ModulePageGuard>} />
              <Route path="tasks" element={<ModulePageGuard category="investment" pageId="tasks"><UserTasks /></ModulePageGuard>} />
              <Route path="user-tasks" element={<ModulePageGuard category="workAndEarn" pageId="userTasks"><UserTasksSubmit /></ModulePageGuard>} />
              <Route path="available-tasks" element={<ModulePageGuard category="workAndEarn" pageId="availableTasks"><UserTasksSubmit initialTab="browse" hideHeaderAndTabs={true} /></ModulePageGuard>} />
              <Route path="pending-reviews" element={<ModulePageGuard category="workAndEarn" pageId="pendingReviews"><UserTasksSubmit initialTab="pending-payment" hideHeaderAndTabs={true} /></ModulePageGuard>} />
              <Route path="tasks-history" element={<ModulePageGuard category="workAndEarn" pageId="tasksHistory"><UserTasksSubmit initialTab="completed-tasks" hideHeaderAndTabs={true} /></ModulePageGuard>} />
              <Route path="create-campaign" element={<ModulePageGuard category="workAndEarn" pageId="createCampaign"><UserTasksSubmit initialTab="submit" hideHeaderAndTabs={true} /></ModulePageGuard>} />
              <Route path="my-campaigns" element={<ModulePageGuard category="workAndEarn" pageId="myCampaigns"><UserTasksSubmit initialTab="my-tasks" hideHeaderAndTabs={true} /></ModulePageGuard>} />
              <Route path="review-proofs" element={<ModulePageGuard category="workAndEarn" pageId="reviewProofs"><UserTasksSubmit initialTab="review-proofs" hideHeaderAndTabs={true} /></ModulePageGuard>} />
              <Route path="hub-faqs" element={<ModulePageGuard category="workAndEarn" pageId="hubFaqs"><HubFaqs /></ModulePageGuard>} />
              <Route path="hub-legal" element={<ModulePageGuard category="workAndEarn" pageId="hubLegal"><HubLegal /></ModulePageGuard>} />
              <Route path="work-history" element={<ModulePageGuard category="workAndEarn" pageId="workHistory"><WorkAndEarnHistory /></ModulePageGuard>} />
              <Route path="transactions" element={<ModulePageGuard category="investment" pageId="transactions"><Transactions /></ModulePageGuard>} />
              <Route path="referrals" element={<ModulePageGuard category="investment" pageId="referrals"><Referrals /></ModulePageGuard>} />
              <Route path="disputes" element={<UserDisputes />} />
              <Route path="messages" element={<Messages />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <WhatsAppFloatingButton />
        <UserPopupModal />
      </BrowserRouter>
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
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-emerald-500 rounded-full shadow-2xl hover:bg-emerald-600 active:bg-emerald-700 transition-all duration-300 hover:scale-110 group cursor-pointer"
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
