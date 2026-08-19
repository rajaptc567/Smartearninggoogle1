import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const CrowdsourcedResearch: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is crowdsourced research on SmartExn?',
      a: 'Crowdsourced research allows businesses to deploy distributed online search queries to gather factual information—such as competitor pricing, regional retail availability, public registry numbers, and industry contacts.'
    },
    {
      q: 'How does crowdsourced research compare to web scraping?',
      a: 'Web scrapers often break on complex UI structures, get blocked by anti-bot protections, or fail to find deep directory information. Human researchers navigate nuanced web structures accurately and evaluate context.'
    },
    {
      q: 'What proof can I require from online researchers?',
      a: 'You can require deep-link source URLs, full-page screenshots showing the data in context, and structured text entries matching your required schema.'
    },
    {
      q: 'How does escrow protection work for research campaigns?',
      a: '100% of your campaign funds are locked in escrow upon launch. You only disburse payments for submissions that provide verifiable source links and accurate answers.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/advertise/crowdsourced-research#webpage",
        "url": "https://smartexn.com/advertise/crowdsourced-research",
        "name": "Crowdsourced Web & Market Research Campaigns | SmartExn",
        "description": "Deploy crowdsourced web research and competitive intelligence gathering campaigns on SmartExn. Collect verified pricing, directory data, and market facts with escrow safety.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/advertise/crowdsourced-research#breadcrumb",
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
            "name": "Crowdsourced Research",
            "item": "https://smartexn.com/advertise/crowdsourced-research"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/advertise/crowdsourced-research#faq",
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
        title="Crowdsourced Web & Market Research Campaigns | SmartExn"
        description="Deploy crowdsourced web research and competitive intelligence gathering campaigns on SmartExn. Collect verified pricing, directory data, and market facts with escrow safety."
        canonicalUrl="https://smartexn.com/advertise/crowdsourced-research"
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
          <span className="text-sky-400 font-medium">Crowdsourced Research</span>
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
            Crowdsourced Web Research: Fast, Verified Market Intelligence at Scale
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Harness a global network of online researchers to gather competitor pricing, audit local directories, compile lead databases, and verify public records.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Human Intelligence Over Broken Automation
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Gathering nuanced business information across hundreds of localized websites, public portals, and specialized directories is difficult to automate reliably. SmartExn distributes structured research parameters to qualified human researchers who locate, verify, and cross-reference data points with speed.
          </p>
        </section>

        {/* Use Cases */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. High-Impact Research Use Cases
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Retail Price Auditing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Track dynamic competitor pricing, discount promotional codes, and shipping fees across regional e-commerce stores.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Public Record Verification</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Locate official business license numbers, patent filings, or corporate filings in public municipal registries.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Directory & Contact Sourcing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Find verified public emails, press contacts, and executive details from corporate about pages and newsrooms.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Local Footprint Checks</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verify whether regional franchises, distributors, or repair service providers are active in specific postal codes.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Controls */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Quality Controls & Escrow Protection
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Source Link Verification:</strong> Require direct deep-links and screenshots for every data point submitted.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Custom Schema Inputs:</strong> Design structured submission forms to ensure returned data matches your exact database columns.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Full Escrow Protection:</strong> Approve and pay only for verified, high-accuracy research findings.</span>
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
            <Link to="/micro-tasks/research-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Guide to Research Tasks
            </Link>
            <Link to="/advertise/data-verification-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Data Verification & Labeling Campaigns
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
          <h2 className="text-xl sm:text-2xl font-black text-white">Launch a Crowdsourced Research Campaign</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Gather market intelligence with verified human accuracy on SmartExn today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/advertise"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Start Campaign
            </Link>
            <Link
              to="/campaigns"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Browse Live Campaigns
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
