import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const FraudPreventionArchitecture: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does SmartExn prevent automated scripts and abuse?',
      a: 'SmartExn combines session monitoring, submission rate-limiting, proxy detection, proof validation checks, and manual moderation review.'
    },
    {
      q: 'What is multi-accounting prevention?',
      a: 'SmartExn strictly prohibits individual users from operating multiple accounts to claim duplicate rewards or exhaust task slots. Duplicate accounts are flagged and subject to suspension.'
    },
    {
      q: 'What happens to accounts flagged for suspicious activity?',
      a: 'Flagged accounts are placed in temporary review. Pending withdrawals and tasks are audited by administrators, and confirmed abusive accounts face termination.'
    },
    {
      q: 'Can users access SmartExn over VPNs or proxy connections?',
      a: 'Using public proxies or shared VPN services can trigger verification checks. We recommend accessing SmartExn from your standard residential or mobile internet connection.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/trust-and-safety/fraud-prevention#webpage",
        "url": "https://smartexn.com/trust-and-safety/fraud-prevention",
        "name": "Platform Fraud Prevention & Anti-Abuse Standards | SmartExn",
        "description": "Learn how SmartExn prevents bot automation, duplicate submissions, and fraudulent activity through proactive platform security policies and review workflows.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/trust-and-safety/fraud-prevention#breadcrumb",
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
            "name": "Trust & Safety",
            "item": "https://smartexn.com/trust-and-safety"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Fraud Prevention",
            "item": "https://smartexn.com/trust-and-safety/fraud-prevention"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/trust-and-safety/fraud-prevention#faq",
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
        title="Platform Fraud Prevention & Anti-Abuse Standards | SmartExn"
        description="Learn how SmartExn prevents bot automation, duplicate submissions, and fraudulent activity through proactive platform security policies and review workflows."
        canonicalUrl="https://smartexn.com/trust-and-safety/fraud-prevention"
        schema={schemaData}
      />
      <PublicNavHeader activePage="trust-and-safety" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/trust-and-safety" className="hover:text-sky-400 transition-colors">Trust & Safety</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">Fraud Prevention</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/50 text-xs font-semibold text-emerald-400">
            <span>Trust & Safety Architecture</span>
            <span>•</span>
            <span>5 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Fraud Prevention Standards: Bot Defense & Anti-Abuse Policies
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            An overview of the verification layers, session policies, and manual moderation workflows that keep the SmartExn marketplace secure and trustworthy.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Defending Market Integrity
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            For crowdsourced micro-tasks and market research surveys to deliver real commercial value, the underlying workforce must consist exclusively of genuine human contributors. SmartExn deploys verification layers to filter abusive activity and enforce single-account policies.
          </p>
        </section>

        {/* Defense Layers */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. 4 Pillars of Platform Protection
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Session & IP Integrity</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Monitors session activity to detect known proxy connections, suspicious logins, and automated scripting attempts.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Rate Limiting & Velocity Controls</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Enforces realistic task reservation and completion cooldown timers to prevent macro spam and robotic submissions.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Submission Quality Validation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verifies submitted proofs against required task fields and prevents duplicate image uploads from being accepted.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Manual & Dispute Review</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Allows advertisers and administrators to inspect proof details and mediate disputes with full transparency.
              </p>
            </div>
          </div>
        </section>

        {/* Sybil Attack Protection */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Multi-Account Restriction Policy
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            SmartExn strictly prohibits multi-accounting. Account registrations and withdrawal destinations are monitored for shared patterns, and detected duplicate accounts are restricted to protect campaign budgets for genuine contributors.
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
          <h3 className="text-base font-bold text-white">Related Trust & Safety Topics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → 100% Upfront Escrow Protection System
            </Link>
            <Link to="/trust-and-safety/proof-verification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Proof Verification Architecture & pHash
            </Link>
            <Link to="/trust-and-safety/account-security" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Enterprise Infrastructure & Account Security
            </Link>
            <Link to="/trust-and-safety" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → SmartExn Trust & Safety Hub
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border border-emerald-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Experience a Protected Marketplace</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Join the verified platform engineered with industry-leading fraud prevention.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20 whitespace-nowrap shrink-0"
            >
              Sign Up Free
            </Link>
            <Link
              to="/trust-and-safety"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Trust & Safety Overview
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
