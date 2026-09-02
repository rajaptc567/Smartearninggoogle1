import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileStickyActionBar } from './MobileStickyActionBar';
import { SupportOfficeCard } from './SupportOfficeCard';
import { useData } from '../hooks/useData';

export const PublicFooter: React.FC = () => {
  const [showContactModal, setShowContactModal] = useState(false);
  const { settings } = useData();

  return (
    <>
      <footer className="bg-[#07172b] text-slate-300 border-t border-sky-950/80 pt-16 pb-24 lg:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Top Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
            
            {/* Column 1: Brand Summary */}
            <div className="lg:col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-2.5 group" title="SmartExn Home">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-2xl font-black tracking-tight text-white">
                  Smart<span className="text-sky-400">Exn</span><span className="text-amber-400 text-base sm:text-lg">.com</span>
                </span>
              </Link>

              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                SmartExn is an international online marketplace connecting task earners with businesses and creators. Complete verified micro-tasks, surveys, and digital gigs with 100% campaign escrow safety.
              </p>

              <div className="pt-2 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/60 border border-sky-800/40 text-xs text-sky-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Escrow Protected & Dispute Supported</span>
                </div>

                {/* UK Customer Support Office */}
                {settings?.showUkSupportOfficeInFooter !== false && settings?.homepageContent?.showUkSupportOfficeInFooter !== false && (
                  <SupportOfficeCard variant="compact" theme="dark" className="max-w-sm" />
                )}
              </div>
            </div>

            {/* Column 2: Earners & Workers */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">For Workers</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link to="/how-it-works" className="hover:text-sky-400 transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link to="/how-it-works-for-workers" className="hover:text-sky-400 transition-colors">
                    Guide for Workers
                  </Link>
                </li>
                <li>
                  <Link to="/micro-tasks" className="hover:text-sky-400 transition-colors">
                    Online Micro-Tasks
                  </Link>
                </li>
                <li>
                  <Link to="/paid-surveys" className="hover:text-sky-400 transition-colors">
                    Paid Surveys
                  </Link>
                </li>
                <li>
                  <Link to="/task-proof" className="hover:text-sky-400 transition-colors">
                    Task Proof Guide
                  </Link>
                </li>
                <li>
                  <Link to="/knowledge-base" className="hover:text-sky-400 transition-colors font-semibold text-sky-400">
                    Knowledge Base Hub
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-amber-300 transition-colors font-semibold text-amber-400">
                    Create Free Account
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Businesses & Advertisers */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">For Advertisers</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link to="/advertise" className="hover:text-sky-400 transition-colors font-medium text-sky-300">
                    Advertise Overview
                  </Link>
                </li>
                <li>
                  <Link to="/campaigns" className="hover:text-sky-400 transition-colors">
                    Crowdsourced Campaigns
                  </Link>
                </li>
                <li>
                  <Link to="/refund-policy" className="hover:text-sky-400 transition-colors">
                    Campaign Escrow Rules
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-sky-400 transition-colors">
                    Create Campaign
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Trust & Policies */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Trust & Legal</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link to="/trust-and-safety" className="hover:text-sky-400 transition-colors">
                    Trust & Safety
                  </Link>
                </li>
                <li>
                  <Link to="/faqs" className="hover:text-sky-400 transition-colors">
                    Knowledge Base & FAQs
                  </Link>
                </li>
                <li>
                  <Link to="/terms-of-use" className="hover:text-sky-400 transition-colors">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link to="/privacy-policy" className="hover:text-sky-400 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/refund-policy" className="hover:text-sky-400 transition-colors">
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <button onClick={() => setShowContactModal(true)} className="hover:text-sky-400 transition-colors text-left">
                    Contact Support
                  </button>
                </li>
              </ul>
            </div>

          </div>

          {/* Earnings & Risk Disclosure Box */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-2">
            <p className="font-semibold text-slate-300">Platform Earning & Participation Notice:</p>
            <p>
              Earnings vary depending on task availability, worker accuracy, campaign requirements, geographic region, and advertiser proof verification. SmartExn is a crowdsourced task platform; it does not offer or guarantee fixed income, hourly wage employment, or guaranteed earnings. All task rewards are released only upon valid verification of submitted proof.
            </p>
          </div>

          {/* Bottom Bar: Copyright */}
          <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© 2026 SmartExn.com. All rights reserved. Global Micro-Task & Crowdsourcing Network.</p>
            <div className="flex items-center gap-6">
              <Link to="/terms-of-use" className="hover:text-slate-400 transition-colors">Terms</Link>
              <Link to="/privacy-policy" className="hover:text-slate-400 transition-colors">Privacy</Link>
              <Link to="/refund-policy" className="hover:text-slate-400 transition-colors">Refunds</Link>
              <Link to="/trust-and-safety" className="hover:text-slate-400 transition-colors">Trust</Link>
              <Link to="/faqs" className="hover:text-slate-400 transition-colors">Help</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky CTA Bar */}
      <MobileStickyActionBar />

      {/* Quick Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0b1f36] border border-sky-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full text-slate-100 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">SmartExn Support</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Have a question about a campaign, dispute, or account verification? Our support desk responds to queries within 24 hours.
            </p>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Official Support Email:</span>
                <a href="mailto:smartexn.com@gmail.com" className="font-mono text-sky-400 font-bold hover:underline">
                  smartexn.com@gmail.com
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone/WhatsApp:</span>
                <a href="https://wa.me/447846775662" target="_blank" rel="noopener noreferrer" className="font-mono text-emerald-400 font-bold hover:underline">
                  +447846775662
                </a>
              </div>
              <div className="pt-1 border-t border-slate-800">
                <span className="text-slate-400 block mb-0.5 font-semibold">Customer Support Office (UK):</span>
                <span className="text-slate-300 leading-snug block">
                  71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Response Window:</span>
                <span className="text-slate-200">24 – 48 Hours</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-3">
              <Link
                to="/faqs"
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
              >
                Visit Help Center
              </Link>
              <button
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PublicFooter;
