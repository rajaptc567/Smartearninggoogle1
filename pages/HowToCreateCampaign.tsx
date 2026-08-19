import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';

export const HowToCreateCampaign: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does escrow protection work for advertisers?',
      a: 'When you publish a campaign, the total budget for all requested worker slots is held securely in platform escrow. Funds are only distributed to workers whose submitted proof satisfies your stated criteria.'
    },
    {
      q: 'What happens to unused budget if my campaign ends early?',
      a: 'Any unallocated or unspent campaign funds are refunded back to your advertiser balance according to our platform refund policy.'
    },
    {
      q: 'How much time do I have to review worker submissions?',
      a: 'Advertisers are provided an explicit review window (typically 24 to 72 hours). Submissions left unreviewed past the deadline may be auto-approved to ensure fairness to workers.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": "https://smartexn.com/knowledge-base/how-to-create-a-campaign#article",
        "headline": "How to Create a Micro-Task Campaign on SmartExn",
        "description": "Step-by-step tutorial for businesses and creators on creating, funding, targeting, and managing micro-task campaigns on SmartExn.",
        "inLanguage": "en-US",
        "mainEntityOfPage": "https://smartexn.com/knowledge-base/how-to-create-a-campaign",
        "publisher": {
          "@type": "Organization",
          "@id": "https://smartexn.com/#organization",
          "name": "SmartExn",
          "url": "https://smartexn.com"
        }
      },
      {
        "@type": "HowTo",
        "@id": "https://smartexn.com/knowledge-base/how-to-create-a-campaign#howto",
        "name": "How to Create a Micro-Task Campaign on SmartExn",
        "description": "Step-by-step tutorial for businesses and creators on creating, funding, targeting, and managing micro-task campaigns on SmartExn.",
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Sign In to Your Account",
            "text": "Access your SmartExn dashboard and switch to the Advertiser Campaign Manager."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "Select Task Category",
            "text": "Choose from Social Engagement, Mobile App Feedback, Website Usability, or Custom Tasks."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "Define Requirements & Proof",
            "text": "Write clear, numbered instructions and specify exact verification proof criteria."
          },
          {
            "@type": "HowToStep",
            "position": 4,
            "name": "Configure Parameters & Fund Escrow",
            "text": "Set target slots, region, and lock required reward budget in platform escrow."
          },
          {
            "@type": "HowToStep",
            "position": 5,
            "name": "Review Submissions",
            "text": "Evaluate worker proof submissions within your review window and approve valid work."
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/knowledge-base/how-to-create-a-campaign#webpage",
        "url": "https://smartexn.com/knowledge-base/how-to-create-a-campaign",
        "name": "How to Create a Micro-Task Campaign on SmartExn | Knowledge Base",
        "description": "Step-by-step tutorial for businesses and creators on creating, funding, targeting, and managing micro-task campaigns on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/knowledge-base/how-to-create-a-campaign#breadcrumb",
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
            "name": "How to Create a Campaign",
            "item": "https://smartexn.com/knowledge-base/how-to-create-a-campaign"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/knowledge-base/how-to-create-a-campaign#faq",
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

  const steps = [
    {
      step: '01',
      title: 'Create or Sign In to Your Account',
      desc: 'Access your SmartExn dashboard and switch to or open the Advertiser Campaign Manager.'
    },
    {
      step: '02',
      title: 'Open Campaign Creation',
      desc: 'Click "Create Campaign" to initiate the structured campaign configuration workflow.'
    },
    {
      step: '03',
      title: 'Select Task Category & Type',
      desc: 'Choose from Social Engagement, Mobile App Feedback, Website Usability, Survey Research, or Custom Digital Tasks.'
    },
    {
      step: '04',
      title: 'Define Step-by-Step Requirements',
      desc: 'Write clear, numbered instructions outlining exactly what actions workers must perform (e.g. download app, reach specific screen, copy link).'
    },
    {
      step: '05',
      title: 'Specify Proof Requirements',
      desc: 'Define what constitutes valid completion: screenshot, public username/handle, transaction ID, or completion code.'
    },
    {
      step: '06',
      title: 'Configure Campaign Parameters',
      desc: 'Set the target geographic regions, device restrictions (mobile/desktop), and total target worker slots.'
    },
    {
      step: '07',
      title: 'Fund and Launch to Escrow',
      desc: 'Confirm the campaign budget. Total required funds are locked into SmartExn platform escrow before the campaign goes live.'
    },
    {
      step: '08',
      title: 'Workers Discover & Complete Tasks',
      desc: 'Qualified workers view your campaign, complete the instructions, and submit proof through their dashboard.'
    },
    {
      step: '09',
      title: 'Review Worker Submissions',
      desc: 'Evaluate submitted screenshots and handles in your dashboard. Approve authentic submissions or reject non-compliant ones with explanatory notes.'
    },
    {
      step: '10',
      title: 'Campaign Completion & Budget Reconciliation',
      desc: 'Once all slots are filled or when you choose to conclude the campaign, unspent escrow funds are returned to your account balance.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="How to Create a Micro-Task Campaign on SmartExn | Advertiser Guide"
        description="Step-by-step guide for advertisers: how to configure campaign steps, define proof requirements, allocate escrow budget, and review worker submissions."
        canonical="https://smartexn.com/knowledge-base/how-to-create-a-campaign"
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
              <span className="text-slate-300 truncate max-w-xs sm:max-w-md">How to Create a Campaign</span>
            </nav>

            <div className="flex items-center gap-3 pt-2">
              <span className="px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-bold uppercase">
                Advertiser Guide
              </span>
              <span className="text-xs text-slate-400">Updated August 2026</span>
              <span className="text-xs text-slate-400">• 5 min read</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              How to Create a Micro-Task Campaign on SmartExn
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              A complete walkthrough for brands, app developers, and marketing agencies. Learn how to launch verified crowdsourced campaigns with 100% escrow protection.
            </p>
          </div>
        </section>

        {/* Content Body */}
        <article className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Overview: Crowdsourced Campaign Lifecycle
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              SmartExn enables businesses to mobilize distributed workforces for digital tasks with guaranteed outcome-based pricing. Because all budgets are deposited into platform escrow before worker discovery, both advertisers and workers operate in a secure, transparent environment.
            </p>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              To learn more about campaign specifications and available categories, visit the{' '}
              <Link to="/campaigns" className="text-sky-400 font-semibold hover:underline">Campaigns Overview Hub</Link>{' '}
              and our{' '}
              <Link to="/advertise" className="text-sky-400 font-semibold hover:underline">For Advertisers Page</Link>.
            </p>
          </section>

          {/* 10-Step Workflow */}
          <section className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              The 10-Step Campaign Creation Workflow
            </h2>

            <div className="space-y-4">
              {steps.map((item) => (
                <div key={item.step} className="p-4 sm:p-5 rounded-2xl bg-[#0b1f36] border border-sky-500/20 flex flex-col sm:flex-row items-start gap-4">
                  <span className="px-3 py-1.5 rounded-xl bg-sky-950 border border-sky-500/30 text-sky-400 font-mono font-bold text-sm shrink-0">
                    Step {item.step}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Escrow & Refunds */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Escrow Protection & Refund Rules
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Advertisers only pay for submissions that satisfy the explicit criteria set during campaign creation. For full details on unspent balance reclaims, read our official{' '}
              <Link to="/refund-policy" className="text-sky-400 font-semibold hover:underline">Escrow & Refund Policy</Link>.
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
              Related Advertiser Guides
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Advertiser Overview →</span>
                <p className="text-xs text-slate-300">Learn why businesses hire remote workers on SmartExn.</p>
              </Link>
              <Link
                to="/knowledge-base/crowdsourced-workforce-guide"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Crowdsourced Workforce Guide →</span>
                <p className="text-xs text-slate-300">Understand distributed digital labor models.</p>
              </Link>
            </div>
          </section>

        </article>
      </main>

      <PublicFooter />
    </div>
  );
};

export default HowToCreateCampaign;
