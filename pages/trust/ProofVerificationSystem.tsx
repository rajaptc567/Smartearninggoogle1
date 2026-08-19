import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const ProofVerificationSystem: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does SmartExn verify task proof authenticity?',
      a: 'SmartExn uses structured verification combining upload formatting checks, image validation, custom required fields (such as account usernames or survey IDs), and manual advertiser inspection.'
    },
    {
      q: 'What happens if a worker submits a duplicate screenshot?',
      a: 'Submitting duplicate, cropped, or reused screenshots violates platform rules. Advertisers reject such proofs, and repetitive duplicate submissions result in account penalties or restrictions.'
    },
    {
      q: 'Can advertisers customize the required proof fields?',
      a: 'Yes. Campaign creators can require specific screenshot milestones, mandatory account handles, confirmation URLs, or response text questions.'
    },
    {
      q: 'What happens if a proof submission is disputed?',
      a: 'Submissions subject to dispute are locked in platform review. An impartial SmartExn moderator evaluates the original campaign brief, worker submission, and creator comments to issue a final decision.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/trust-and-safety/proof-verification#webpage",
        "url": "https://smartexn.com/trust-and-safety/proof-verification",
        "name": "Proof Verification Standards & Submission Integrity | SmartExn",
        "description": "Learn how SmartExn maintains proof authenticity through structured submission guidelines, duplicate prevention, custom validation fields, and advertiser review.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/trust-and-safety/proof-verification#breadcrumb",
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
            "name": "Proof Verification",
            "item": "https://smartexn.com/trust-and-safety/proof-verification"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/trust-and-safety/proof-verification#faq",
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
        title="Proof Verification Standards & Submission Integrity | SmartExn"
        description="Learn how SmartExn maintains proof authenticity through structured submission guidelines, duplicate prevention, custom validation fields, and advertiser review."
        canonicalUrl="https://smartexn.com/trust-and-safety/proof-verification"
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
          <span className="text-sky-400 font-medium">Proof Verification</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/50 text-xs font-semibold text-emerald-400">
            <span>Trust & Safety Architecture</span>
            <span>•</span>
            <span>4 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Proof Verification Architecture: Standards & Submission Integrity
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            How SmartExn combines clear proof requirements, duplicate prevention policies, custom required fields, and advertiser review workflows to maintain high marketplace trust.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. The Importance of Proof Authentication
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            In micro-tasking marketplaces, maintaining genuine work quality requires robust verification. Clear proof guidelines ensure that advertisers receive genuine outcomes while honest workers receive guaranteed payouts upon completion.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            SmartExn provides structured submission workflows with required screenshot attachments, mandatory user handles, and custom validation fields before submissions are queued for advertiser review.
          </p>
        </section>

        {/* Verification Pipeline */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. The 4-Stage Verification Workflow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Submission & File Format Validation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verifies file types, dimensions, and ensures submissions meet required image and text criteria prior to advertiser review.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Slot Timing & Reservation Window</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Ensures the task was reserved and completed within the designated campaign timer, preventing stale submissions.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Required Handle & Confirmation Matching</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Cross-checks worker handles, survey completion codes, or confirmation URLs with the specific task requirements.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Advertiser Inspection & Escrow Release</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Provides campaign creators with visual inspection tools, rejection feedback options, and one-click escrow reward release.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Transparency & Dispute Protection
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            All submitted proof artifacts and comments remain accessible in platform review history. In the event of a dispute, both parties can reference the original submission during impartial administrative arbitration.
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
            <Link to="/trust-and-safety/fraud-prevention" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Fraud Prevention & Sybil Attack Defense
            </Link>
            <Link to="/trust-and-safety/disputes" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Two-Tier Dispute Desk & Arbitration
            </Link>
            <Link to="/task-proof" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Visual Task Proof Requirements & Examples
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border border-emerald-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Verified Proof. Guaranteed Outcomes.</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Experience the internet's most transparent, fraud-resistant micro-task platform.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/task-proof"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20 whitespace-nowrap shrink-0"
            >
              Review Proof Standards
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
