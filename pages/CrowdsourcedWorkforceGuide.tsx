import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';

export const CrowdsourcedWorkforceGuide: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What types of tasks are best suited for a crowdsourced workforce?',
      a: 'Crowdsourcing is ideal for high-volume, modular digital tasks requiring human perception, real-device software testing, localized content feedback, consumer surveys, and data validation.'
    },
    {
      q: 'How does SmartExn ensure quality from distributed workers?',
      a: 'Quality is enforced via required proof verification (screenshots, IDs, handles), escrow-backed compensation, dispute arbitration, and worker reputation scoring.'
    },
    {
      q: 'Can a crowdsourced campaign be targeted geographically?',
      a: 'Yes. Advertisers can specify target countries, regions, and device platforms (iOS, Android, Windows, Mac) when configuring campaign requirements.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/knowledge-base/crowdsourced-workforce-guide#webpage",
        "url": "https://smartexn.com/knowledge-base/crowdsourced-workforce-guide",
        "name": "What Is a Crowdsourced Workforce? | SmartExn Knowledge Base",
        "description": "Educational guide on crowdsourced digital workforces, distributed micro-tasks, proof-based workflows, benefits, and quality control.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/knowledge-base/crowdsourced-workforce-guide#breadcrumb",
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
            "name": "Knowledge Base",
            "item": "https://smartexn.com/knowledge-base"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "What Is a Crowdsourced Workforce?",
            "item": "https://smartexn.com/knowledge-base/crowdsourced-workforce-guide"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/knowledge-base/crowdsourced-workforce-guide#faq",
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
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="What Is a Crowdsourced Workforce? | SmartExn Guide"
        description="Comprehensive guide explaining distributed digital labor, micro-task crowdsourcing, enterprise use cases, quality control, and proof-based campaigns."
        canonical="https://smartexn.com/knowledge-base/crowdsourced-workforce-guide"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="knowledge-base" />

      <main className="flex-1">
        {/* Article Header */}
        <section className="py-12 sm:py-16 border-b border-sky-500/10 bg-gradient-to-b from-[#091e38] to-[#061325]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            
            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link to="/knowledge-base" className="hover:text-white transition-colors">Knowledge Base</Link>
              <span>/</span>
              <span className="text-slate-300 truncate max-w-xs sm:max-w-md">Crowdsourced Workforce</span>
            </nav>

            <div className="flex items-center gap-3 pt-2">
              <span className="px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-bold uppercase">
                Industry Insights
              </span>
              <span className="text-xs text-slate-400">Updated August 2026</span>
              <span className="text-xs text-slate-400">• 5 min read</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              What Is a Crowdsourced Workforce?
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              An in-depth look at distributed digital labor, proof-based micro-task campaigns, and how organizations leverage crowdsourcing for scalable, outcome-driven operations.
            </p>
          </div>
        </section>

        {/* Content Body */}
        <article className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Understanding Crowdsourced Digital Work
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              A crowdsourced workforce consists of a distributed network of remote participants who take on modular, independent digital tasks. Rather than hiring full-time staff or traditional consulting firms for repetitive workflows, organizations segment complex projects into micro-units distributed across hundreds or thousands of independent workers.
            </p>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              On SmartExn, this interaction is facilitated through structured, proof-based campaigns where rewards are locked into escrow and distributed exclusively upon validated completion. Read more on our{' '}
              <Link to="/how-it-works" className="text-sky-400 font-semibold hover:underline">How It Works Overview</Link>.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Key Benefits for Businesses & Creators
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 space-y-2">
                <span className="font-bold text-sky-400 text-sm">Outcome-Based Pricing</span>
                <p className="text-xs sm:text-sm text-slate-300">
                  Advertisers do not pay hourly retainers; budgets are disbursed only when verified proof meets campaign criteria.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 space-y-2">
                <span className="font-bold text-sky-400 text-sm">Rapid Parallel Execution</span>
                <p className="text-xs sm:text-sm text-slate-300">
                  Hundreds of workers can execute a task concurrently, compressing weeks of manual research or testing into hours.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 space-y-2">
                <span className="font-bold text-sky-400 text-sm">Diverse Real-World Devices</span>
                <p className="text-xs sm:text-sm text-slate-300">
                  Test applications across varied operating systems, network conditions, and browser versions without maintaining device labs.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 space-y-2">
                <span className="font-bold text-sky-400 text-sm">Flexible Scalability</span>
                <p className="text-xs sm:text-sm text-slate-300">
                  Scale campaigns up or down based on operational demand, seasonal promotions, or survey quotas.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Appropriate Use Cases vs. Limitations
            </h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <strong className="text-emerald-300 text-sm block">Ideal Use Cases:</strong>
                <ul className="text-xs sm:text-sm text-slate-300 list-disc list-inside space-y-1">
                  <li>Usability testing and bug reporting on web and mobile applications</li>
                  <li>Opinion surveys, sentiment analysis, and market research</li>
                  <li>Brand engagement, public content sharing, and community growth</li>
                  <li>Data categorization, image tagging, and content validation</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <strong className="text-slate-300 text-sm block">Not Suited For:</strong>
                <ul className="text-xs sm:text-sm text-slate-400 list-disc list-inside space-y-1">
                  <li>Proprietary software engineering requiring continuous codebase access</li>
                  <li>Long-form creative writing or dedicated executive consulting</li>
                  <li>Highly confidential internal workflows requiring non-disclosure agreements</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Quality Control and Verification
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              High data quality requires rigorous verification controls. SmartExn combines advertiser manual review, automatic deadline timeouts, duplicate detection, and two-tier dispute arbitration.
            </p>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              For practical steps on setting up your first crowdsourced campaign, read our guide on{' '}
              <Link to="/knowledge-base/how-to-create-a-campaign" className="text-sky-400 font-semibold hover:underline">How to Create a Campaign</Link>{' '}
              or explore our{' '}
              <Link to="/campaigns" className="text-sky-400 font-semibold hover:underline">Campaign Categories Hub</Link>.
            </p>
          </section>

          {/* FAQ Section */}
          <section className="space-y-6 pt-4 border-t border-slate-800">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="rounded-xl bg-[#0b1f36] border border-sky-500/20 overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between text-white font-bold text-sm sm:text-base focus:outline-none focus:bg-slate-800/50"
                      aria-expanded={isOpen}
                    >
                      <span>{faq.q}</span>
                      <span className="text-sky-400 font-mono text-lg">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-800/60 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Related Guides */}
          <section className="pt-8 border-t border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Related Guides
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                to="/knowledge-base/how-to-create-a-campaign"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Create Campaign Guide →</span>
                <p className="text-xs text-slate-300">Step-by-step campaign setup walkthrough.</p>
              </Link>
              <Link
                to="/campaigns"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Campaign Categories →</span>
                <p className="text-xs text-slate-300">Explore crowdsourced task configurations.</p>
              </Link>
              <Link
                to="/advertise"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">For Advertisers →</span>
                <p className="text-xs text-slate-300">Learn how businesses hire remote workforces.</p>
              </Link>
            </div>
          </section>

        </article>
      </main>

      <PublicFooter />
    </div>
  );
};

export default CrowdsourcedWorkforceGuide;
