import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const ResearchTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What do online research micro-tasks entail on SmartExn?',
      a: 'Online research tasks involve finding publicly available information on the web based on clear parameters. Examples include finding competitor pricing on public store sites, locating official business registration numbers, finding relevant industry directories, or verifying local business hours.'
    },
    {
      q: 'What kind of proof is required for research tasks?',
      a: 'Proof usually requires providing the source webpage URL where the information was discovered, a screenshot of the data point in context, and accurately formatted text entries in the submission form.'
    },
    {
      q: 'How long do I have to complete a research task?',
      a: 'Each research campaign specifies a reservation countdown timer (typically 15 to 45 minutes) once you reserve a slot, allowing sufficient time to locate accurate sources without slot hoarding.'
    },
    {
      q: 'What happens if the requested information is not publicly available?',
      a: 'If a specific company or data point does not exist or has closed down, instructions often provide an option to indicate "Not Available / Defunct" along with proof of your search query.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/micro-tasks/research-tasks#webpage",
        "url": "https://smartexn.com/micro-tasks/research-tasks",
        "name": "Market & Online Research Micro-Tasks: Search Guide & Proof Standards | SmartExn",
        "description": "Learn how online research and market data collection micro-tasks work on SmartExn. Understand source verification, proof submission, and quality guidelines.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/micro-tasks/research-tasks#breadcrumb",
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
            "name": "Research Tasks",
            "item": "https://smartexn.com/micro-tasks/research-tasks"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/micro-tasks/research-tasks#faq",
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
        title="Market & Online Research Micro-Tasks: Search Guide & Proof Standards | SmartExn"
        description="Learn how online research and market data collection micro-tasks work on SmartExn. Understand source verification, proof submission, and quality guidelines."
        canonicalUrl="https://smartexn.com/micro-tasks/research-tasks"
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
          <span className="text-sky-400 font-medium">Research Tasks</span>
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
            Market & Web Research Micro-Tasks: Sourcing, Quality & Verification Guide
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Discover how businesses utilize crowdsourced researchers on SmartExn to gather public market data, find competitive pricing, and verify online sources.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Understanding Web Research Gigs
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Market research micro-tasks involve collecting factual, publicly accessible information from the internet. When companies want to compare regional pricing, compile lists of industry associations, or cross-check public registry data, they deploy discrete research queries on SmartExn.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Unlike automated web scrapers that frequently get blocked by security filters, human researchers can navigate complex directories, solve basic navigations, and verify source reliability with precision.
          </p>
        </section>

        {/* Workflow */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Common Research Scenarios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Competitive Price Auditing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Finding live shelf prices, discount codes, or promotional bundles for specific SKUs across retail e-commerce sites.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Business Directory Validation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Searching public government registries or chamber of commerce lists to verify official business entity names.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Academic & Industry Sourcing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Locating publicly available whitepapers, press releases, or news announcements covering industry trends.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Local Service Checks</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Verifying whether local medical clinics, restaurants, or repair shops are currently operating in a designated area.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Quality Standards for Sourcing
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Provide direct deep-links:</strong> Always submit the exact URL of the specific page where the data is located, rather than a generic home page.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Cross-check numbers:</strong> Ensure phone numbers, prices, or addresses do not contain typos before hitting submit.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Do not use paywalled or unauthorized databases:</strong> All research must rely solely on open, public web sources.</span>
            </li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Availability & Disclaimers
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Market research micro-tasks are published according to advertiser demand. SmartExn does not promise fixed daily earnings or guaranteed task allocations. Verified submissions are rewarded from locked escrow funds.
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
            <Link to="/micro-tasks/data-verification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Data Verification & Categorization Tasks
            </Link>
            <Link to="/micro-tasks/proof-based-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Proof-Based Task Guidelines
            </Link>
            <Link to="/advertise/crowdsourced-research" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Launching Crowdsourced Research Campaigns
            </Link>
            <Link to="/knowledge-base/task-proof-guide" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Submit Valid Proof on SmartExn
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Browse Active Research Opportunities</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Explore currently open web research, price comparison, and directory verification campaigns.
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
              Sign Up Free
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
