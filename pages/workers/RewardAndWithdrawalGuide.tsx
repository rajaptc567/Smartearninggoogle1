import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const RewardAndWithdrawalGuide: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How do Task Earnings move to my available withdrawal balance?',
      a: 'When an advertiser approves your task proof or when a 72-hour review timer auto-approves, the reward is transferred from escrow directly into your Task Earnings wallet balance.'
    },
    {
      q: 'What withdrawal methods are available on SmartExn?',
      a: 'SmartExn supports multiple withdrawal channels including direct crypto transfers (USDT, BTC, LTC), verified e-wallets, and regional payment rails depending on your jurisdiction.'
    },
    {
      q: 'How long do withdrawals take to process?',
      a: 'Standard automated withdrawals are processed within 1 to 24 hours following routine security checks. High-reputation accounts benefit from priority batch processing.'
    },
    {
      q: 'Are there minimum withdrawal thresholds?',
      a: 'Yes, minimum withdrawal thresholds exist to minimize network transaction fees. You can view the current threshold for your chosen payment method in the Withdrawal section of your dashboard.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/workers/reward-and-withdrawal-guide#webpage",
        "url": "https://smartexn.com/workers/reward-and-withdrawal-guide",
        "name": "Worker Rewards & Withdrawal Guide: Payouts, Thresholds & Timelines | SmartExn",
        "description": "Comprehensive guide to SmartExn worker rewards: understanding task earnings, escrow disbursement, withdrawal thresholds, payment methods, and processing times.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/workers/reward-and-withdrawal-guide#breadcrumb",
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
            "name": "For Workers",
            "item": "https://smartexn.com/how-it-works-for-workers"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Reward & Withdrawal Guide",
            "item": "https://smartexn.com/workers/reward-and-withdrawal-guide"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/workers/reward-and-withdrawal-guide#faq",
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
        title="Worker Rewards & Withdrawal Guide: Payouts, Thresholds & Timelines | SmartExn"
        description="Comprehensive guide to SmartExn worker rewards: understanding task earnings, escrow disbursement, withdrawal thresholds, payment methods, and processing times."
        canonicalUrl="https://smartexn.com/workers/reward-and-withdrawal-guide"
        schema={schemaData}
      />
      <PublicNavHeader activePage="how-it-works" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/how-it-works-for-workers" className="hover:text-sky-400 transition-colors">For Workers</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">Rewards & Withdrawals</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Worker Education</span>
            <span>•</span>
            <span>5 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Worker Rewards & Withdrawal Guide: Balances, Thresholds & Payout Timelines
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Everything you need to know about how your micro-task rewards are credited from escrow, how wallet balances operate, and how to execute secure withdrawals.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Escrow-Protected Reward Crediting
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            SmartExn operates on a strictly funded escrow architecture. Before any campaign appears in the task marketplace, the advertiser must deposit the full reward budget upfront. This guarantees that whenever you submit valid proof, funds are already reserved and ready to be credited to your account.
          </p>
        </section>

        {/* The 4 Stages */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. The Journey from Task Submission to Withdrawal
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Task Submission</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                You submit your screenshot and proof text. The status enters "Under Review" with a live advertiser review timer.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Approval & Escrow Release</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                The advertiser approves the proof (or the 72-hour timer expires), releasing the reward into your Task Earnings.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Withdrawal Request</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Once reaching the minimum threshold, request a payout to your designated crypto or e-wallet address.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Payout Confirmation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                The transaction is broadcast and confirmed on-chain or through the payment network, with full ledger receipt.
              </p>
            </div>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Supported Payout Rails & Thresholds
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            SmartExn supports low-fee, high-speed payment options to accommodate international contributors. Details regarding specific network fees, minimum amounts, and estimated transaction confirmation times are clearly displayed in your dashboard Withdrawal terminal.
          </p>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Earnings & Financial Disclaimer
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Earnings represent task-specific rewards funded by independent advertisers. SmartExn does not offer fixed wages, employment contracts, or guaranteed yields. Withdrawals are subject to standard network verification.
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
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → 100% Upfront Escrow Protection System
            </Link>
            <Link to="/workers/account-security" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Account Security & Wallet Safety
            </Link>
            <Link to="/workers/how-to-avoid-task-rejection" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Avoid Task Rejections
            </Link>
            <Link to="/how-it-works-for-workers" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Complete How It Works for Workers Manual
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Start Earning Escrow-Backed Rewards</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Join thousands of active contributors earning verified payouts on SmartExn today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Open Tasks
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Register Free
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
