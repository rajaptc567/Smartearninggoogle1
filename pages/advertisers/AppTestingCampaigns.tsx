import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const AppTestingCampaigns: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How do app testing campaigns work on SmartExn?',
      a: 'Advertisers link to their official Google Play Store, Apple App Store, or TestFlight app listings and define testing milestones (such as completing onboarding, testing a checkout flow, or verifying device performance). Real testers complete the actions and submit verification screenshots.'
    },
    {
      q: 'Can I request testing on specific mobile hardware and OS versions?',
      a: 'Yes. You can target specific mobile operating systems (Android 10+, iOS 15+) and geographic regions to test app performance across diverse global device ecosystems.'
    },
    {
      q: 'How does escrow protect my app testing budget?',
      a: 'Your total testing budget is locked in platform escrow when the campaign is created. Funds are only deducted and credited to workers when you review and approve their test proof.'
    },
    {
      q: 'Can I collect written qualitative UX feedback alongside screenshots?',
      a: 'Yes. You can configure custom text proof prompts asking testers to describe their user experience, note any UI layout bugs, or rate app responsiveness.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/advertise/app-testing-campaigns#webpage",
        "url": "https://smartexn.com/advertise/app-testing-campaigns",
        "name": "Mobile App Testing Campaigns: QA & UX Feedback at Scale | SmartExn",
        "description": "Launch crowdsourced mobile application testing campaigns on SmartExn. Collect real-device QA feedback, bug reports, and UX reviews with escrow-backed safety.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/advertise/app-testing-campaigns#breadcrumb",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://smartexn.com/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "For Advertisers",
            "item": "https://smartexn.com/advertise"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "App Testing Campaigns",
            "item": "https://smartexn.com/advertise/app-testing-campaigns"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/advertise/app-testing-campaigns#faq",
        "mainEntity": faqs.map(faq => ({
          "@type": "Question",
          "name": faq.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.a
          }
        }))
      }
    ]
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <SEOHead
        title="Mobile App Testing Campaigns: QA & UX Feedback at Scale | SmartExn"
        description="Launch crowdsourced mobile application testing campaigns on SmartExn. Collect real-device QA feedback, bug reports, and UX reviews with escrow-backed safety."
        canonicalUrl="https://smartexn.com/advertise/app-testing-campaigns"
        schema={schemaData}
      />
      <PublicNavHeader activePage="advertise" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/advertise" className="hover:text-sky-400 transition-colors">For Advertisers</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">App Testing Campaigns</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Advertiser Authority</span>
            <span>•</span>
            <span>4 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Mobile App Testing Campaigns: Real-Device Quality Assurance & User Feedback
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Deploy your iOS and Android apps to a global testing community. Uncover device-specific crashes, validate user flows, and optimize onboarding retention before public launch.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Real-World Testing on Hundreds of Device Models
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Emulators and automated test scripts cannot replicate real user behavior or catch subtle visual glitches across different OEM screen sizes, low-memory conditions, and regional network speeds. SmartExn allows mobile developers and product managers to test on live consumer devices worldwide.
          </p>
        </section>

        {/* Capabilities */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. App Testing Capabilities & Use Cases
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">First-Time User Onboarding</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Observe whether new users can successfully register, complete tutorials, and reach the core value screen without confusion.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Payment & Checkout Testing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verify sandbox in-app purchases, coupon redemptions, and regional payment gateway displays.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Feature Rollout QA</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Stress-test major new updates across a broad sample of Android and iOS releases before general distribution.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Qualitative UX Feedback</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Gather written impressions regarding navigation intuitiveness, visual design, and performance responsiveness.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Controls */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Escrow Protection & Review Controls
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Official Stores Only:</strong> SmartExn requires links to official Play Store, App Store, or verified TestFlight distributions.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Custom Review Window:</strong> Take up to 72 hours to review submitted screenshots and feedback before approving escrow payouts.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Restored Budget on Rejection:</strong> Rejected submissions return the allocated slot directly back to your active campaign balance.</span>
            </li>
          </ul>
        </section>

        {/* FAQs */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-5 py-4 text-left font-semibold text-sm sm:text-base text-slate-200 flex items-center justify-between gap-4 hover:text-sky-300 transition-colors"
                  aria-expanded={openFaq === idx}
                >
                  <span>{faq.q}</span>
                  <span className="text-sky-400 text-lg">{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Related Guides */}
        <section className="border-t border-slate-800 pt-8 space-y-4">
          <h3 className="text-base font-bold text-white">Related Guides & Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <Link to="/micro-tasks/app-testing" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Guide to App Testing Tasks
            </Link>
            <Link to="/advertise/website-testing-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Website UX & Traffic Testing Campaigns
            </Link>
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → 100% Upfront Escrow Protection System
            </Link>
            <Link to="/advertise" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → SmartExn Advertiser Portal Overview
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Deploy an App Testing Campaign</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Get instant feedback from real device owners and ensure a bug-free launch today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/advertise"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Create Campaign
            </Link>
            <Link
              to="/campaigns"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              View Active Campaigns
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
