import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const DataVerificationTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What are data verification and categorization micro-tasks?',
      a: 'Data verification tasks require workers to check, cross-reference, or categorize digital information. Examples include verifying business phone numbers, matching product categories, checking address accuracy, or tagging images for machine learning datasets.'
    },
    {
      q: 'How are data verification tasks checked for accuracy?',
      a: 'Advertisers frequently use ground-truth benchmark questions and cross-validation (matching your responses against other independent workers). Maintaining high accuracy is required to remain eligible for high-tier data tasks.'
    },
    {
      q: 'What skills are needed for data verification micro-tasks?',
      a: 'Attention to detail, reading comprehension, and basic search skills are the primary requirements. Guidelines are provided with each campaign explaining exact classification criteria.'
    },
    {
      q: 'Why do data verification submissions fail?',
      a: 'Submissions fail when workers rush through tasks without reading instructions, guess answers to known benchmark items, or submit incomplete text fields.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/micro-tasks/data-verification#webpage",
        "url": "https://smartexn.com/micro-tasks/data-verification",
        "name": "Data Verification & Categorization Micro-Tasks: Accuracy & Guidelines | SmartExn",
        "description": "Learn how data verification and classification micro-tasks work on SmartExn. Understand accuracy benchmarks, workflow steps, and reward validation.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/micro-tasks/data-verification#breadcrumb",
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
            "name": "Data Verification",
            "item": "https://smartexn.com/micro-tasks/data-verification"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/micro-tasks/data-verification#faq",
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
        title="Data Verification & Categorization Micro-Tasks: Accuracy & Guidelines | SmartExn"
        description="Learn how data verification and classification micro-tasks work on SmartExn. Understand accuracy benchmarks, workflow steps, and reward validation."
        canonicalUrl="https://smartexn.com/micro-tasks/data-verification"
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
          <span className="text-sky-400 font-medium">Data Verification</span>
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
            Data Verification & Categorization Micro-Tasks: Quality & Accuracy Standards
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Understand how online data cleansing, categorization, and verification tasks function on SmartExn, and discover best practices for maintaining high accuracy ratings.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. What Are Data Verification Tasks?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Businesses and data science teams manage enormous amounts of digital information that require human judgment to ensure accuracy. Common tasks include checking whether a company directory listing is active, categorizing e-commerce merchandise into structured taxonomies, and reviewing image tags for visual clarity.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Because data tasks are modular and clearly defined, they allow workers to complete short, discrete verification checks efficiently from any computer or mobile device.
          </p>
        </section>

        {/* Workflow */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Common Types of Data Tasks
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Directory & Contact Checks</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verifying that public company websites, business hours, and contact details match official search listings.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Product Categorization</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Matching product titles to relevant department categories (e.g. classifying "Wireless Headphones" under Electronics &gt; Audio).
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Content Tagging & Moderation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Tagging visual assets or filtering user submissions based on safety and relevance guidelines provided by the advertiser.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Text Matching & OCR Audit</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Comparing scanned text or invoice numbers against database entries to correct minor typographical discrepancies.
              </p>
            </div>
          </div>
        </section>

        {/* Accuracy Standards */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Accuracy Scoring & Quality Checks
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Read guideline edge cases:</strong> Instructions often clarify how to handle unusual entries (such as defunct websites or rebranded businesses).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Maintain consistent attention:</strong> Randomly distributed calibration items verify that responses are carefully considered rather than automated.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Do not rush through batches:</strong> Submitting answers faster than a human could reasonably read will trigger anti-speeder detection flags.</span>
            </li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Task Volume & Reward Notice
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Data verification batches are commissioned by third-party advertisers. SmartExn does not provide fixed hourly wages or guaranteed batch volumes. Rewards are locked in escrow and distributed upon task verification.
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
            <Link to="/micro-tasks/research-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Online Market & Research Micro-Tasks
            </Link>
            <Link to="/micro-tasks/proof-based-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Proof-Based Task Requirements & Validation
            </Link>
            <Link to="/advertise/data-verification-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Launching Data Verification Campaigns as an Advertiser
            </Link>
            <Link to="/knowledge-base/why-tasks-get-rejected" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Avoid Task Rejections & Errors
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Explore Data & Verification Tasks</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Browse available data entry, categorization, and verification campaigns open right now on SmartExn.
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
              Create Account
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
