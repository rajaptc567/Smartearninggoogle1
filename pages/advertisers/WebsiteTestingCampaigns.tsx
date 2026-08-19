import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const WebsiteTestingCampaigns: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What types of website testing campaigns can I run on SmartExn?',
      a: 'Advertisers can deploy website navigation tests, landing page conversion tests, multi-browser responsiveness checks, form validation tests, and search filter audits.'
    },
    {
      q: 'How do I ensure testers actually spend time reviewing my website?',
      a: 'You can set minimum on-page time requirements, specify secondary interaction milestones (such as clicking specific links or completing a search), and require full-screen screenshot proof showing the active session.'
    },
    {
      q: 'How does SmartExn prevent automated traffic scripts?',
      a: 'Every tester is an authenticated platform member. Automated bots, headless browsers, and datacenter proxy connections are blocked by our multi-layer security infrastructure.'
    },
    {
      q: 'What proof can I require from website testers?',
      a: 'You can require screenshot proof of the final page visited, the exact destination URL, and custom written feedback answering specific usability questions.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/advertise/website-testing-campaigns#webpage",
        "url": "https://smartexn.com/advertise/website-testing-campaigns",
        "name": "Website UX & Traffic Testing Campaigns: Usability at Scale | SmartExn",
        "description": "Deploy crowdsourced website usability testing, landing page audits, and multi-browser UX testing campaigns with verified human contributors on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/advertise/website-testing-campaigns#breadcrumb",
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
            "name": "Website Testing Campaigns",
            "item": "https://smartexn.com/advertise/website-testing-campaigns"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/advertise/website-testing-campaigns#faq",
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
        title="Website UX & Traffic Testing Campaigns: Usability at Scale | SmartExn"
        description="Deploy crowdsourced website usability testing, landing page audits, and multi-browser UX testing campaigns with verified human contributors on SmartExn."
        canonicalUrl="https://smartexn.com/advertise/website-testing-campaigns"
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
          <span className="text-sky-400 font-medium">Website Testing</span>
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
            Crowdsourced Website Testing Campaigns: Usability, Conversion & QA at Scale
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Validate website navigation, test landing page conversion funnels, and verify cross-browser compatibility with real human visitors across desktop and mobile devices.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Crowdsourced Website Usability Matters
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Before launching digital advertising campaigns or redesigning an e-commerce storefront, identifying user drop-off points, broken navigation links, and confusing copy is essential for maximizing return on ad spend.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            SmartExn enables digital marketers, e-commerce managers, and web agencies to commission hundreds of verified user visits within hours.
          </p>
        </section>

        {/* Campaign Types */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Common Website Testing Use Cases
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Funnel & Form Validation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Test lead generation forms, registration wizards, and shopping cart flows to uncover input validation errors.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Cross-Browser Usability</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verify that layouts, mobile menus, and sticky navigation bars render cleanly across Chrome, Safari, Firefox, and Edge.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Search & Filter Testing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Test product catalog filters, search autocomplete, and category sorting on complex e-commerce portals.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Landing Page Clarity Reviews</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Collect qualitative feedback on headline clarity, value proposition comprehension, and call-to-action visibility.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Controls */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Verification Controls & Escrow Protection
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Manual & Automated Inspection:</strong> Review proof URLs and full-screen screenshots before releasing escrow funds.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Geographic Filtering:</strong> Limit website visits to specific country or regional IP ranges matching your commercial market.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>No Wasted Ad Spend:</strong> Rejected submissions return the allocated slot directly back to your active campaign pool.</span>
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
            <Link to="/micro-tasks/website-testing" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Guide to Website Testing
            </Link>
            <Link to="/advertise/app-testing-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Mobile App Testing Campaigns
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
          <h2 className="text-xl sm:text-2xl font-black text-white">Create a Website Testing Campaign</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Audit your web usability and optimize conversions with verified human testers today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/advertise"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Start Campaign
            </Link>
            <Link
              to="/campaigns"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Browse Active Campaigns
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
