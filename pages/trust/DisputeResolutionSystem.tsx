import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const DisputeResolutionSystem: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is the SmartExn Two-Tier Dispute Resolution System?',
      a: 'The Two-Tier Dispute Desk is a structured arbitration process. Level 1 allows the worker and advertiser to directly clarify instructions and share supplemental proof. If unresolved within 48 hours, either party can escalate to Level 2 for binding administrative arbitration.'
    },
    {
      q: 'How long do I have to open a dispute after a task rejection?',
      a: 'Workers have 48 hours following an advertiser rejection notification to open a Level-1 direct clarification request from their dashboard.'
    },
    {
      q: 'What evidence is reviewed during Level-2 platform arbitration?',
      a: 'An impartial SmartExn arbitrator examines the original campaign requirements, the worker’s uploaded screenshots and handles, the creator’s rejection explanation, and direct communication history before issuing a binding ruling.'
    },
    {
      q: 'Are there penalties for frivolous disputes?',
      a: 'Yes. Users or advertisers who repeatedly submit false claims, forged evidence, or abuse the arbitration system will face trust score reductions and platform restrictions.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/trust-and-safety/disputes#webpage",
        "url": "https://smartexn.com/trust-and-safety/disputes",
        "name": "Two-Tier Dispute Resolution Desk & Arbitration System | SmartExn",
        "description": "Learn how the SmartExn Two-Tier Dispute Resolution Desk protects workers and advertisers through structured clarification and impartial administrative arbitration.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/trust-and-safety/disputes#breadcrumb",
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
            "name": "Dispute Resolution",
            "item": "https://smartexn.com/trust-and-safety/disputes"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/trust-and-safety/disputes#faq",
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
        title="Two-Tier Dispute Resolution Desk & Arbitration System | SmartExn"
        description="Learn how the SmartExn Two-Tier Dispute Resolution Desk protects workers and advertisers through structured clarification and impartial administrative arbitration."
        canonicalUrl="https://smartexn.com/trust-and-safety/disputes"
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
          <span className="text-sky-400 font-medium">Dispute Resolution</span>
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
            Two-Tier Dispute Resolution Desk: Transparent Arbitration & Fair Outcomes
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            How SmartExn ensures fair treatment for both contributors and campaign creators through structured direct clarification and impartial administrative arbitration.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Transparent Dispute Resolution Is Essential
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            In any freelance or micro-task marketplace, honest misunderstandings can arise—such as an advertiser overlooking a valid username or a worker accidentally submitting a slightly cropped screenshot. Rather than allowing unilateral rejections without recourse, SmartExn provides an open dispute desk.
          </p>
        </section>

        {/* The Two Tiers */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. The Two-Tier Arbitration Framework
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 space-y-3">
              <div className="inline-block px-2.5 py-1 bg-sky-950 border border-sky-800/60 text-sky-400 text-xs font-bold rounded">
                Tier 1: Direct Clarification
              </div>
              <h3 className="text-base font-bold text-white">Direct Peer-to-Peer Resolution</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                The worker and advertiser have a 48-hour direct communication window to clarify requirements, provide uncropped screenshots, or rectify typos. Over 70% of misunderstandings are resolved amicably in Tier 1.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 space-y-3">
              <div className="inline-block px-2.5 py-1 bg-emerald-950 border border-emerald-800/60 text-emerald-400 text-xs font-bold rounded">
                Tier 2: Administrator Arbitration
              </div>
              <h3 className="text-base font-bold text-white">Impartial Platform Ruling</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                If the parties cannot agree, either side can escalate to a senior SmartExn compliance moderator. The arbitrator reviews all timestamps, campaign instructions, and uploaded proofs to deliver a final, binding decision.
              </p>
            </div>
          </div>
        </section>

        {/* Escrow Locks during Disputes */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Escrow Fund Locking During Active Disputes
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            When a dispute is opened, the exact campaign escrow allocation is locked in an arbitration escrow vault. Neither the advertiser nor the worker can withdraw the funds until the dispute is resolved. If the arbitrator rules in favor of the worker, the funds are instantly released to their Task Earnings.
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
            <Link to="/workers/how-to-avoid-task-rejection" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Worker Guide to Avoiding Rejections
            </Link>
            <Link to="/trust-and-safety" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → SmartExn Trust & Safety Overview
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border border-emerald-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Fairness for Every Participant</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Work and advertise with the confidence of transparent dispute protection.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20 whitespace-nowrap shrink-0"
            >
              Explore Tasks
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
