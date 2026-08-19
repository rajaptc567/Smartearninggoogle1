import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { seoAnalytics } from '../services/seoAnalytics';

export const MobileStickyActionBar: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useData();
  const { currentUser } = state;

  const handleBrowseTasks = () => {
    seoAnalytics.trackWorkerCtaClick('Browse Tasks (Mobile Sticky Bar)', window.location.pathname);
    if (currentUser) {
      navigate('/member/tasks');
    } else {
      navigate('/login');
    }
  };

  const handleCreateCampaign = () => {
    seoAnalytics.trackAdvertiserCtaClick('Create Campaign (Mobile Sticky Bar)', window.location.pathname);
    if (currentUser) {
      navigate('/member/create-campaign');
    } else {
      navigate('/login');
    }
  };

  return (
    <aside
      aria-label="Quick Actions"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#07172b]/95 backdrop-blur-md border-t border-sky-500/30 p-3 sm:p-4 lg:hidden shadow-2xl flex items-center justify-between gap-3"
    >
      <button
        onClick={handleBrowseTasks}
        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm text-center shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
      >
        <svg className="w-4 h-4 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span>Browse Tasks</span>
      </button>

      <button
        onClick={handleCreateCampaign}
        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm text-center shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
      >
        <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
        </svg>
        <span>Create Campaign</span>
      </button>
    </aside>
  );
};

export default MobileStickyActionBar;
