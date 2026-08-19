import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const EscrowSecurity: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is the SmartExn Upfront Escrow System?',
      a: 'The SmartExn Upfront Escrow System requires advertisers to deposit 100% of their campaign reward budget into platform escrow before any task is published to workers. This guarantees that funds are fully backed and reserved for successful task completions.'
    },
    {
      q: 'When are funds released from escrow to the worker?',
      a: 'Funds are released immediately when the advertiser verifies and approves the submitted task proof, or automatically when the 72-hour review countdown expires.'
    },
    {
      q: 'What happens to the escrow budget if a task proof is rejected?',
      a: 'If a proof submission is rejected with valid cause, the reserved budget is not pocketed by the advertiser—it is restored to the active campaign slot pool so another worker can complete it.'
    },
    {
      q: 'Can an advertiser cancel a campaign and refund unspent escrow?',
      a: 'Yes. An advertiser may pause or cancel an active campaign at any time. Any unreserved, unallocated escrow funds are returned to their advertiser deposit balance.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/trust-and-safety/escrow#webpage",
        "url": "https://smartexn.com/trust-and-safety/escrow",
        "name": "100% Upfront Escrow Protection: Architecture & Security | SmartExn",
        "description": "Learn how SmartExn protects workers and advertisers through 100% upfront campaign escrow funding, automated review timers, and transparent ledger settlements.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/trust-and-safety/escrow#breadcrumb",
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
            "name": "Escrow Protection",
            "item": "https://smartexn.com/trust-and-safety/escrow"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/trust-and-safety/escrow#faq",
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
        title="100% Upfront Escrow Protection: Architecture & Security | SmartExn"
        description="Learn how SmartExn protects workers and advertisers through 100% upfront campaign escrow funding, automated review timers, and transparent ledger settlements."
        canonicalUrl="https://smartexn.com/trust-and-safety/escrow"
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
          <span className="text-sky-400 font-medium">Escrow Protection</span>
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
            100% Upfront Escrow Protection: Financial Integrity & Trust Architecture
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            How SmartExn eliminates payment default risks for workers while protecting advertiser capital through automated review timers, double-entry ledgers, and locked escrow reserves.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. The Problem with Unfunded Task Platforms
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Traditional online freelance and crowdsourcing portals often operate on post-payment billing models. If an employer’s payment fails, independent workers are left unpaid after having performed the requested work.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            SmartExn fundamentally eliminates this counterparty risk through our <strong>100% Upfront Escrow Requirement</strong>. No task campaign can be published without verified, pre-funded escrow backing.
          </p>
        </section>

        {/* The 4 Escrow Pillars */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. 4 Core Principles of the Escrow Engine
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Guaranteed Funding Upfront</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                100% of the campaign budget is deducted from the advertiser and locked in escrow before a task is visible to workers.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Slot Reservation Locking</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                When a worker starts a task, that exact reward amount is temporarily reserved, preventing over-allocation.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Automated Expiry Release</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                If an advertiser becomes inactive, SmartExn automatically approves pending submissions after 72 hours, releasing funds to the worker.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Immutable Ledger Accounting</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Every escrow lock, release, and refund is recorded on an append-only double-entry balance ledger with verifiable transaction IDs.
              </p>
            </div>
          </div>
        </section>

        {/* Protection for Advertisers */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. How Escrow Protects Advertisers
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Escrow protection is bidirectional. Advertisers are guaranteed that funds are never released without proof of completion. If a worker submits invalid, cropped, or fraudulent evidence, the advertiser can reject the proof, returning the slot allocation back to the campaign pool without losing budget.
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
            <Link to="/trust-and-safety/proof-verification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Proof Verification & Review Systems
            </Link>
            <Link to="/trust-and-safety/disputes" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Two-Tier Dispute Resolution & Arbitration Desk
            </Link>
            <Link to="/trust-and-safety/fraud-prevention" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Platform Fraud Prevention Architecture
            </Link>
            <Link to="/trust-and-safety" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Trust & Safety Center Overview
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border border-emerald-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Experience Zero-Risk Crowdsourcing</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Join the platform where every micro-task is 100% escrow-backed from start to finish.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20 whitespace-nowrap shrink-0"
            >
              Get Started Free
            </Link>
            <Link
              to="/trust-and-safety"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Trust & Safety Hub
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
