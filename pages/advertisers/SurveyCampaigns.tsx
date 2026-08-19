import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const SurveyCampaigns: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How do I publish a market research survey campaign on SmartExn?',
      a: 'Advertisers can integrate survey redirect links (supporting dynamic tracking variables like {worker_id} and {session_id}), specify demographic screening criteria, and allocate reward budgets held in platform escrow.'
    },
    {
      q: 'How do completion callbacks work?',
      a: 'SmartExn supports secure server-to-server (S2S) postback URLs and client-side completion redirect codes to automatically verify when a respondent successfully reaches the final survey thank-you screen.'
    },
    {
      q: 'What demographic filters can I apply to my survey sample?',
      a: 'You can filter participants by country, language, age bracket, gender, employment status, household income, and specific consumer interests.'
    },
    {
      q: 'Are screened-out respondents charged to my campaign budget?',
      a: 'No. You are only charged for complete, verified survey responses that satisfy your full questionnaire requirements and pass quality checks.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/advertise/survey-campaigns#webpage",
        "url": "https://smartexn.com/advertise/survey-campaigns",
        "name": "Market Research & Survey Campaigns: Consumer Insights at Scale | SmartExn",
        "description": "Deploy consumer opinion surveys and market research studies on SmartExn. Gather verified demographic insights with secure postbacks and escrow safety.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/advertise/survey-campaigns#breadcrumb",
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
            "name": "Survey Campaigns",
            "item": "https://smartexn.com/advertise/survey-campaigns"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/advertise/survey-campaigns#faq",
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
        title="Market Research & Survey Campaigns: Consumer Insights at Scale | SmartExn"
        description="Deploy consumer opinion surveys and market research studies on SmartExn. Gather verified demographic insights with secure postbacks and escrow safety."
        canonicalUrl="https://smartexn.com/advertise/survey-campaigns"
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
          <span className="text-sky-400 font-medium">Survey Campaigns</span>
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
            Market Research & Survey Campaigns: Precision Demographics & Verified Sentiment
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Acquire actionable consumer feedback, validate product-market fit, and conduct quantitative opinion polling with authenticated global respondents.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Scientific Market Research Infrastructure
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Market intelligence firms, consulting agencies, and consumer brands require accurate, high-integrity survey sample data. SmartExn combines precision demographic routing, automated attention check filtering, and server-to-server tracking to ensure dependable research results.
          </p>
        </section>

        {/* Features */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Survey Campaign Features & Integrations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">S2S Postback Integration</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Connect external survey platforms (Qualtrics, SurveyMonkey, Decipher, Typeform) via secure postback URLs.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Demographic Quota Management</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Set strict quota caps per demographic segment to ensure balanced and representative sample sizes.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Speeder & Bot Prevention</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Automatic exclusion of fast-clicking respondents, proxy IP connections, and automated scripts.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Cost-Per-Complete (CPC) Model</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Pay strictly for fully qualified completes; disqualified screen-outs incur zero cost to your budget.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Controls */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Escrow Security & Budget Governance
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            All survey campaign budgets are held in smart escrow. Funds are disbursed on a strictly verified completion basis, giving researchers total budget certainty and transparency across every study.
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
            <Link to="/paid-surveys/how-online-surveys-work" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Online Paid Surveys Work
            </Link>
            <Link to="/advertise/crowdsourced-research" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Crowdsourced Web Research Campaigns
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
          <h2 className="text-xl sm:text-2xl font-black text-white">Launch Your Survey Campaign</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Gather verified consumer insights from targeted demographics worldwide.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/advertise"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Start Survey Campaign
            </Link>
            <Link
              to="/paid-surveys"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              View Survey Hub
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
