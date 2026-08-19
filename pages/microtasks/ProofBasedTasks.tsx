import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const ProofBasedTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is a proof-based micro-task?',
      a: 'A proof-based micro-task is any campaign where reward disbursement depends on submitting verifiable evidence of completion—such as an uncropped screenshot, username, confirmation URL, or order reference code.'
    },
    {
      q: 'How are proof submissions verified by advertisers?',
      a: 'Advertisers access a dedicated verification dashboard where they review each worker submission. They compare the provided screenshots, IDs, or handles against their campaign requirements before clicking Approve or Reject.'
    },
    {
      q: 'What happens if an advertiser ignores my proof submission?',
      a: 'SmartExn operates automated review deadlines (typically 72 hours). If an advertiser fails to act on pending submissions before the review window expires, the system automatically approves the task and releases the escrow reward.'
    },
    {
      q: 'Can I dispute an unfair rejection?',
      a: 'Yes. SmartExn features a Two-Tier Dispute Desk. You can first open a Level-1 direct clarification with the campaign creator, or escalate to Level-2 impartial administrator arbitration if an agreement cannot be reached.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/micro-tasks/proof-based-tasks#webpage",
        "url": "https://smartexn.com/micro-tasks/proof-based-tasks",
        "name": "Proof-Based Micro-Tasks: Verification Standards, Review Timers & Escrow | SmartExn",
        "description": "Comprehensive guide to proof-based micro-tasks on SmartExn. Learn how evidence verification works, review countdowns, dispute processes, and escrow protection.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/micro-tasks/proof-based-tasks#breadcrumb",
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
            "name": "Proof-Based Tasks",
            "item": "https://smartexn.com/micro-tasks/proof-based-tasks"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/micro-tasks/proof-based-tasks#faq",
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
        title="Proof-Based Micro-Tasks: Verification Standards, Review Timers & Escrow | SmartExn"
        description="Comprehensive guide to proof-based micro-tasks on SmartExn. Learn how evidence verification works, review countdowns, dispute processes, and escrow protection."
        canonicalUrl="https://smartexn.com/micro-tasks/proof-based-tasks"
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
          <span className="text-sky-400 font-medium">Proof-Based Tasks</span>
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
            Proof-Based Micro-Tasks: Verification Workflows, Timers & Escrow Safety
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            A comprehensive manual explaining how proof validation works on SmartExn, including screenshot requirements, review timers, escrow safety, and dispute resolution.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. What Is Proof-Based Task Execution?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            In traditional freelance environments, workers risk delivering services without guaranteed payment. SmartExn eliminates this uncertainty by pairing proof-based validation with 100% upfront campaign escrow funding.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            When an advertiser creates a task, their campaign budget is locked in platform escrow. Once you submit accurate proof matching the advertiser's criteria, those funds are credited directly to your Task Earnings balance.
          </p>
        </section>

        {/* Categories of Proof */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Primary Categories of Proof Evidence
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Visual Screenshot Proof</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Uncropped full-screen capture showing the active state of an interaction (e.g. channel subscription, app profile view, or feedback submission).
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Profile Handles & Usernames</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                The exact social media handle, forum nickname, or registered email address used to complete the action.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Confirmation URLs</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                The destination URL of the final confirmation screen, post share link, or public comment link.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Reference Codes & Text Answers</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Specific confirmation numbers, survey completion codes, or short written answers requested by the campaign.
              </p>
            </div>
          </div>
        </section>

        {/* Verification Timeline */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Review Timers & Automated Protection
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Every submission triggers a platform review window (typically 24 to 72 hours). During this window, the campaign creator reviews your submission. If the advertiser approves, rewards are released instantly. If the advertiser becomes inactive, SmartExn's automated system releases the reward upon timer expiry.
          </p>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Escrow & Reward Terms
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Rewards are tied to individual campaign specifications and successful proof verification. SmartExn does not provide fixed hourly salaries or guarantee task volume. All rewards are held in secure escrow until validated.
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
            <Link to="/task-proof" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Visual Task Proof Requirements & Examples
            </Link>
            <Link to="/trust-and-safety/disputes" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Two-Tier Dispute Resolution & Arbitration Desk
            </Link>
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → 100% Upfront Escrow Protection System
            </Link>
            <Link to="/knowledge-base/why-tasks-get-rejected" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Top Reasons Why Proofs Get Rejected
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Ready to Submit Verified Proof?</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Explore live tasks with escrow-protected rewards available right now on SmartExn.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Micro-Tasks
            </Link>
            <Link
              to="/task-proof"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Proof Guidelines
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
