import React from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-sky-500 selection:text-slate-950">
      <SEOHead
        title="404 — Page Not Found | SmartExn"
        description="The requested page could not be found on SmartExn. Return to our homepage or explore our micro-tasks, campaigns, and knowledge base."
        canonical=""
        robots="noindex, nofollow"
      />
      <PublicNavHeader activeRoute="none" />

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-2xl w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-950/60 border border-sky-800/40 text-sky-400 font-black text-3xl mb-6 shadow-xl">
            404
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Page Not Found
          </h1>

          <p className="text-slate-400 text-base sm:text-lg mb-8 leading-relaxed max-w-md mx-auto">
            The page you are looking for might have been moved, had its URL updated, or is temporarily unavailable.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              to="/"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 text-center"
            >
              Back to Homepage
            </Link>
            <Link
              to="/knowledge-base"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-sm transition-colors text-center"
            >
              Search Knowledge Base
            </Link>
          </div>

          {/* Structured public navigation hub */}
          <div className="pt-8 border-t border-slate-800/80 text-left">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4 text-center">
              Explore Popular Hubs & Resource Guides
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
              <Link to="/micro-tasks" className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-colors">
                <span className="font-semibold text-white block mb-0.5">Micro-Tasks</span>
                <span className="text-slate-400 text-[11px]">Browse open tasks & gigs</span>
              </Link>
              <Link to="/paid-surveys" className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-colors">
                <span className="font-semibold text-white block mb-0.5">Paid Surveys</span>
                <span className="text-slate-400 text-[11px]">Market research studies</span>
              </Link>
              <Link to="/how-it-works" className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-colors">
                <span className="font-semibold text-white block mb-0.5">How It Works</span>
                <span className="text-slate-400 text-[11px]">Step-by-step workflow</span>
              </Link>
              <Link to="/advertise" className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-colors">
                <span className="font-semibold text-white block mb-0.5">For Advertisers</span>
                <span className="text-slate-400 text-[11px]">Launch targeted campaigns</span>
              </Link>
              <Link to="/task-proof" className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-colors">
                <span className="font-semibold text-white block mb-0.5">Proof Guidelines</span>
                <span className="text-slate-400 text-[11px]">Valid submission specs</span>
              </Link>
              <Link to="/trust-and-safety" className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-colors">
                <span className="font-semibold text-white block mb-0.5">Trust & Escrow</span>
                <span className="text-slate-400 text-[11px]">Platform security standards</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};
