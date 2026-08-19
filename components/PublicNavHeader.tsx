import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useData } from '../hooks/useData';

interface PublicNavHeaderProps {
  activePage?: string;
}

export const PublicNavHeader: React.FC<PublicNavHeaderProps> = ({ activePage }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useData();
  const { currentUser } = state;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Micro-Tasks', path: '/micro-tasks' },
    { label: 'Paid Surveys', path: '/paid-surveys' },
    { label: 'Task Proof', path: '/task-proof' },
    { label: 'For Advertisers', path: '/advertise' },
    { label: 'Campaigns', path: '/campaigns' },
    { label: 'Trust & Safety', path: '/trust-and-safety' },
    { label: 'FAQs', path: '/faqs' }
  ];

  const primaryDesktopLinks = [
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Micro-Tasks', path: '/micro-tasks' },
    { label: 'Paid Surveys', path: '/paid-surveys' },
    { label: 'Task Proof', path: '/task-proof' },
    { label: 'Knowledge Base', path: '/knowledge-base' },
    { label: 'Campaigns', path: '/campaigns' }
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    if (activePage && path.includes(activePage)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#07172b]/95 backdrop-blur-md border-b border-sky-500/20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          
          {/* Brand Wordmark (Single text element zone) */}
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer group shrink-0" title="SmartExn Home">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Smart<span className="text-sky-400">Exn</span><span className="text-amber-400 text-sm sm:text-base">.com</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main Navigation" className="hidden lg:flex items-center space-x-1 xl:space-x-2 text-xs xl:text-sm font-medium text-slate-200">
            {primaryDesktopLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-2.5 xl:px-3 py-2 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none ${
                  isActive(item.path)
                    ? 'text-sky-400 bg-sky-500/10 font-bold border border-sky-500/30 shadow-sm'
                    : 'hover:text-sky-300 hover:bg-slate-800/50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Primary Actions */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {currentUser ? (
              <button
                onClick={() => navigate('/member')}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all duration-200 active:scale-95 flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
              >
                <span>Dashboard</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl border border-sky-500/40 hover:bg-sky-500/10 text-sky-300 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-4 xl:px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
                >
                  Start Earning Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger & Quick Register */}
          <div className="lg:hidden flex items-center gap-2">
            {!currentUser && (
              <Link
                to="/register"
                className="sm:hidden px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-xs shadow focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none whitespace-nowrap"
              >
                Sign Up
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              className="p-2 rounded-xl bg-slate-800/90 text-slate-200 hover:text-white border border-slate-700 focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile Navigation"
          className="lg:hidden bg-[#0a1f38] border-b border-sky-500/30 px-4 pt-3 pb-6 space-y-4 text-slate-200 animate-fadeIn max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Navigation Menu</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
              aria-label="Close menu"
            >
              ✕ Close
            </button>
          </div>

          {/* Group 1: Workers */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 block">Workers</span>
            <Link
              to="/how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              How It Works
            </Link>
            <Link
              to="/how-it-works-for-workers"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              Guide for Workers
            </Link>
            <Link
              to="/micro-tasks"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              Online Micro-Tasks
            </Link>
            <Link
              to="/paid-surveys"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              Paid Surveys
            </Link>
            <Link
              to="/task-proof"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              Task Proof Guide
            </Link>
            <Link
              to="/knowledge-base"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-sky-400 font-semibold hover:bg-slate-800"
            >
              Knowledge Base Hub
            </Link>
          </div>

          {/* Group 2: Advertisers */}
          <div className="space-y-1 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 block">Advertisers & Businesses</span>
            <Link
              to="/advertise"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              For Advertisers Overview
            </Link>
            <Link
              to="/campaigns"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              Crowdsourced Campaigns
            </Link>
          </div>

          {/* Group 3: Trust & Help */}
          <div className="space-y-1 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 block">Trust & Help</span>
            <Link
              to="/trust-and-safety"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              Trust & Safety
            </Link>
            <Link
              to="/faqs"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              Knowledge Base FAQs
            </Link>
          </div>

          {/* Auth Actions */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-2">
            {currentUser ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/member');
                }}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-center text-sm shadow focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
              >
                Go to Member Dashboard
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center border border-sky-500/40 text-sky-300 font-semibold rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold rounded-xl text-center text-sm shadow-md focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
                >
                  Sign Up & Start Earning
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

export default PublicNavHeader;
