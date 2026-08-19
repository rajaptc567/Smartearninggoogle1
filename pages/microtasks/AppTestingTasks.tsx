import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const AppTestingTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What do mobile app testing tasks involve on SmartExn?',
      a: 'App testing tasks involve installing mobile applications (Android/iOS) from official app stores, performing specific test actions such as account registration, navigating core features, reporting user interface issues or crashes, and submitting verification screenshots.'
    },
    {
      q: 'Are app testing tasks safe for my device?',
      a: 'SmartExn strictly enforces that all application testing campaigns link exclusively to official, verified app distribution channels (such as the Google Play Store or Apple App Store). Campaigns asking for direct APK sideloading or unofficial installer downloads are prohibited.'
    },
    {
      q: 'How do I submit valid proof for app testing tasks?',
      a: 'Valid proof typically includes a screenshot of the installed app open on your home screen or internal profile page with your registered user ID clearly visible, plus any written feedback requested by the developer.'
    },
    {
      q: 'Can I uninstall the app immediately after submitting proof?',
      a: 'Advertisers frequently require users to keep the application active for a retention window (e.g. 24 to 48 hours) to verify engagement metrics. Always check the campaign instructions before removing an app.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/micro-tasks/app-testing#webpage",
        "url": "https://smartexn.com/micro-tasks/app-testing",
        "name": "Mobile App Testing Micro-Tasks: Installation, UX Feedback & Proof Guidelines | SmartExn",
        "description": "Discover how app testing micro-tasks work on SmartExn. Learn requirements for Android and iOS testing, submitting clean feedback proofs, and earning rewards.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/micro-tasks/app-testing#breadcrumb",
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
            "name": "App Testing Tasks",
            "item": "https://smartexn.com/micro-tasks/app-testing"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/micro-tasks/app-testing#faq",
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
        title="Mobile App Testing Micro-Tasks: Installation, UX Feedback & Proof Guidelines | SmartExn"
        description="Discover how app testing micro-tasks work on SmartExn. Learn requirements for Android and iOS testing, submitting clean feedback proofs, and earning rewards."
        canonicalUrl="https://smartexn.com/micro-tasks/app-testing"
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
          <span className="text-sky-400 font-medium">App Testing</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Micro-Task Authority</span>
            <span>•</span>
            <span>5 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Mobile App Testing Micro-Tasks: Quality Assurance, Feedback & Proof Standards
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Everything you need to know about testing smartphone applications on SmartExn—from device eligibility and user interface feedback to verified screenshot submissions.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. How App Testing Gigs Work
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Software developers and indie studios require real-world testing across hundreds of different smartphone models, screen resolutions, and operating system versions before launching major updates. SmartExn connects these developers with an active global testing workforce.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            As an app tester, your role is to download the app through official store links, follow specific user journey steps (such as completing onboarding, testing search filters, or trying a game tutorial), and report on performance.
          </p>
        </section>

        {/* Requirements & Devices */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Device Requirements & Preparation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Android Requirements</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Most Android campaigns require Android OS 10.0+ with an active Google Play account in good standing. Avoid emulators or virtual machines unless explicitly permitted.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">iOS Requirements</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                iOS tasks generally operate through Apple TestFlight or official App Store links on iPhone/iPad devices running iOS 15.0 or newer.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Quality Standards for Constructive Feedback
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Be descriptive:</strong> When asked for feedback, state what worked well and note any lag, visual misalignment, or confusing menu options.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Capture the in-app profile view:</strong> Your screenshot must prove you actually reached the required milestone or registered screen.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Do not use recycled images:</strong> Each submission is verified for uniqueness. Reusing images from previous campaigns will result in immediate rejection and account penalties.</span>
            </li>
          </ul>
        </section>

        {/* Availability & Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Campaign Availability Disclaimer
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            App testing opportunities depend on active developer testing cycles and geographic targeting. SmartExn does not guarantee daily testing quota. Rewards are escrow-backed and released upon advertiser validation or automated timeout.
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
            <Link to="/micro-tasks/website-testing" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Website Testing Tasks & User Experience Reviews
            </Link>
            <Link to="/micro-tasks/proof-based-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Proof-Based Task Requirements & Validation
            </Link>
            <Link to="/advertise/app-testing-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Launching an App Testing Campaign as an Advertiser
            </Link>
            <Link to="/knowledge-base/why-tasks-get-rejected" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Preventing Rejections in Mobile Testing Gigs
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Explore Open App Testing Campaigns</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Discover available mobile testing and quality assurance tasks currently open for your device.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Open Tasks
            </Link>
            <Link
              to="/task-proof"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              View Proof Guidelines
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
