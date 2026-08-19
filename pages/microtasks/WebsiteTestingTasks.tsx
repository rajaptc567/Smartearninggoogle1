import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const WebsiteTestingTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What do website testing micro-tasks involve?',
      a: 'Website testing tasks require testers to visit specific web pages, test user flows (such as registration forms, search filters, or checkout simulators), check responsive design across browsers, and report usability observations or broken links.'
    },
    {
      q: 'Do I need technical web development skills to participate?',
      a: 'No technical coding knowledge is needed. Advertisers are looking for feedback from ordinary everyday web users to ensure their websites are intuitive, fast-loading, and easy to navigate.'
    },
    {
      q: 'What proof is required for website testing tasks?',
      a: 'Proof typically includes the final confirmation URL or page screenshot after completing the user flow, along with short written answers answering specific verification questions provided in the campaign brief.'
    },
    {
      q: 'How are rewards processed for website testing gigs?',
      a: 'When an advertiser launches a campaign, 100% of the rewards budget is placed into SmartExn escrow. Once your submission is verified, rewards are instantly released to your Task Earnings balance.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/micro-tasks/website-testing#webpage",
        "url": "https://smartexn.com/micro-tasks/website-testing",
        "name": "Website UX & Feature Testing Micro-Tasks: Instructions & Guidelines | SmartExn",
        "description": "Learn how website testing tasks work on SmartExn. Understand navigation tests, responsiveness checks, form verification, and proof guidelines.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/micro-tasks/website-testing#breadcrumb",
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
            "name": "Micro-Tasks",
            "item": "https://smartexn.com/micro-tasks"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Website Testing",
            "item": "https://smartexn.com/micro-tasks/website-testing"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/micro-tasks/website-testing#faq",
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
        title="Website UX & Feature Testing Micro-Tasks: Instructions & Guidelines | SmartExn"
        description="Learn how website testing tasks work on SmartExn. Understand navigation tests, responsiveness checks, form verification, and proof guidelines."
        canonicalUrl="https://smartexn.com/micro-tasks/website-testing"
        schema={schemaData}
      />
      <PublicNavHeader activePage="micro-tasks" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/micro-tasks" className="hover:text-sky-400 transition-colors">Micro-Tasks</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">Website Testing</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Micro-Task Authority</span>
            <span>•</span>
            <span>4 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Website UX & Usability Testing Micro-Tasks: Testing Guide & Quality Standards
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Understand how businesses evaluate web usability, test digital landing pages, and verify user experience through SmartExn crowdsourced testing tasks.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. What Is Website Usability Testing?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            When businesses build new web portals, e-commerce stores, or SaaS applications, they need real feedback from diverse browser environments. Website testing micro-tasks on SmartExn give independent testers the opportunity to explore live web properties, test functionality, and verify that navigation paths work without friction.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Tasks can range from a quick 2-minute visit to test mobile menu responsiveness to 5-minute exploratory tests checking form validation or search functionality.
          </p>
        </section>

        {/* Workflow */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Typical Testing Process
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Verify Browser Requirements</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Check whether the advertiser requires Chrome, Safari, Firefox, or Edge, and whether mobile or desktop browsing is specified.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Navigate the User Path</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Follow the specified user journey—such as searching for a product, testing a filter, or clicking through to an article.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Record Observations</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Note any broken buttons, formatting issues, or slow load times to provide genuinely helpful feedback.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Submit Proof & URL</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Submit the destination landing URL and uncropped screenshot showing the test milestone.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Quality Standards & Avoiding Rejections
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Show the browser address bar:</strong> Including the full URL in your screenshot verifies you were on the correct advertiser page.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Stay on page for the required duration:</strong> If the campaign specifies a minimum browsing time (e.g. 60 seconds), do not bounce immediately.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Do not use ad-blockers if requested:</strong> Some testing campaigns verify ad placements; disabling ad blockers during the test ensures accurate review.</span>
            </li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Availability & Payout Terms
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Website testing micro-tasks are released dynamically as advertisers publish new test campaigns. SmartExn does not promise fixed hourly compensation or guaranteed daily work. All rewards are held in platform escrow until verified.
          </p>
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
              → Mobile App Testing Micro-Tasks & Feedback
            </Link>
            <Link to="/micro-tasks/data-verification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Data Categorization & Verification Tasks
            </Link>
            <Link to="/advertise/website-testing-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Create a Website Testing Campaign as an Advertiser
            </Link>
            <Link to="/task-proof" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Visual Task Proof Requirements Guide
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Start Browsing Live Website Gigs</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Find active website testing and digital verification tasks available now on SmartExn.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Explore Micro-Tasks
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Sign Up Free
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
