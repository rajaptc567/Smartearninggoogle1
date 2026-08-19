import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const DataVerificationCampaigns: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What kind of data verification campaigns can I outsource on SmartExn?',
      a: 'Businesses outsource directory validation, contact info checking, e-commerce product categorization, image labeling for AI models, and duplicate database record deduplication.'
    },
    {
      q: 'How does SmartExn maintain high data accuracy?',
      a: 'You can insert known benchmark questions ("gold standard" ground truth items) and set up multi-worker consensus verification to cross-check answers across independent contributors.'
    },
    {
      q: 'Can I upload large datasets via CSV or API?',
      a: 'Yes. Advertisers can batch-import thousands of data items via standard CSV formatting or integrate directly through the campaign generation API.'
    },
    {
      q: 'How does escrow billing work for data verification batches?',
      a: 'Your total batch reward budget is reserved in platform escrow upon launch. Escrow releases funds continuously as individual data rows are verified and approved.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/advertise/data-verification-campaigns#webpage",
        "url": "https://smartexn.com/advertise/data-verification-campaigns",
        "name": "Crowdsourced Data Verification & Labeling Campaigns | SmartExn",
        "description": "Outsource data cleansing, classification, image labeling, and directory validation to a distributed human workforce with escrow protection on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/advertise/data-verification-campaigns#breadcrumb",
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
            "name": "Data Verification Campaigns",
            "item": "https://smartexn.com/advertise/data-verification-campaigns"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/advertise/data-verification-campaigns#faq",
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
        title="Crowdsourced Data Verification & Labeling Campaigns | SmartExn"
        description="Outsource data cleansing, classification, image labeling, and directory validation to a distributed human workforce with escrow protection on SmartExn."
        canonicalUrl="https://smartexn.com/advertise/data-verification-campaigns"
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
          <span className="text-sky-400 font-medium">Data Verification</span>
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
            Crowdsourced Data Verification & Annotation: Scalable Human-in-the-Loop Operations
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Cleanse databases, categorize e-commerce catalogs, and annotate machine learning datasets with an on-demand, verified human workforce.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Human Judgment for Complex Data Workflows
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            While artificial intelligence and automated algorithms excel at rapid processing, edge cases, unstructured text, and ambiguous visual classifications frequently result in errors. SmartExn provides scalable human-in-the-loop (HITL) data verification to maintain pristine database quality.
          </p>
        </section>

        {/* Capabilities */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. High-Volume Data Operations Capabilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Product Taxonomy & Tagging</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Structure large e-commerce catalogs into accurate category trees and assign high-relevance search keywords.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Directory & Contact Validation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verify phone numbers, street addresses, and operational status for global B2B and B2C directory databases.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">AI Training Dataset Annotation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Label bounding boxes, categorize image attributes, and annotate conversational text for model fine-tuning.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Content Moderation Auditing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Audit user-generated submissions against community guidelines to maintain platform compliance and safety.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Controls */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Quality Controls & Consensus Verification
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Ground-Truth Calibration:</strong> Automatically inject known test items to ensure worker accuracy stays above your designated threshold.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Consensus Cross-Validation:</strong> Assign critical data items to multiple independent workers to establish majority consensus.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Escrow Budget Security:</strong> Only approved and verified data rows deduct funds from your campaign escrow balance.</span>
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
            <Link to="/micro-tasks/data-verification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Guide to Data Verification
            </Link>
            <Link to="/advertise/crowdsourced-research" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Crowdsourced Research Campaigns
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
          <h2 className="text-xl sm:text-2xl font-black text-white">Outsource Data Verification Today</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Scale your human-in-the-loop operations with verified accuracy on SmartExn.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/advertise"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Start Batch Campaign
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
