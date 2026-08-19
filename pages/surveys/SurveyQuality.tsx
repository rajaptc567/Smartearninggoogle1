import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const SurveyQuality: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Why do market research platforms monitor response quality?',
      a: 'Market research data is analyzed statistically to identify consumer trends. If responses contain gibberish text, contradictory answers, or automated bot submissions, the data becomes unscientific. Monitoring ensures only reliable human responses are retained.'
    },
    {
      q: 'What is "straight-lining" in a survey?',
      a: '"Straight-lining" is the habit of selecting the identical answer option (e.g. all 3s or all "Neutral") straight down a grid of questions without reading. Automated algorithms easily detect this pattern and flag the submission as low-quality.'
    },
    {
      q: 'How should I answer open-ended text questions?',
      a: 'Provide thoughtful, complete sentences that directly address the prompt (e.g. explaining what you liked about a product feature) rather than typing one-word placeholders like "good" or "nice".'
    },
    {
      q: 'How does high response quality benefit my account?',
      a: 'Maintaining a high quality score grants your account priority access to higher-tier, specialized research studies and premium survey campaigns.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/paid-surveys/survey-quality#webpage",
        "url": "https://smartexn.com/paid-surveys/survey-quality",
        "name": "Survey Quality & Response Integrity Standards | SmartExn",
        "description": "Learn how survey quality algorithms evaluate responses on SmartExn. Understand straight-lining detection, open-ended standards, and maintaining high trust.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/paid-surveys/survey-quality#breadcrumb",
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
            "name": "Paid Surveys",
            "item": "https://smartexn.com/paid-surveys"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Survey Quality",
            "item": "https://smartexn.com/paid-surveys/survey-quality"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/paid-surveys/survey-quality#faq",
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
        title="Survey Quality & Response Integrity Standards | SmartExn"
        description="Learn how survey quality algorithms evaluate responses on SmartExn. Understand straight-lining detection, open-ended standards, and maintaining high trust."
        canonicalUrl="https://smartexn.com/paid-surveys/survey-quality"
        schema={schemaData}
      />
      <PublicNavHeader activePage="paid-surveys" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/paid-surveys" className="hover:text-sky-400 transition-colors">Paid Surveys</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">Survey Quality</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Survey Authority</span>
            <span>•</span>
            <span>4 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Survey Response Quality: Integrity Guidelines, Open-Ended Prompts & Trust Scores
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Understand how modern market research platforms evaluate response quality, avoid automated filters, and maintain an elite trust standing on SmartExn.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Response Quality Matters
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Leading academic institutions, global market researchers, and consumer brands rely on SmartExn participants for authentic human sentiment. To maintain high partnership standards, automated quality algorithms continuously evaluate incoming submissions for validity.
          </p>
        </section>

        {/* The 4 Quality Pillars */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. The 4 Pillars of High-Quality Responses
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Authentic Open-Ended Text</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Write genuine, legible sentences explaining your reasoning. Avoid copy-pasting text or inserting unrelated characters.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Natural Pacing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Spend realistic reading time on each question screen rather than rapid-clicking through pages.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Variable Scale Selection</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Evaluate each row independently; avoid straight-lining or creating geometric zig-zag patterns across rating grids.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Device & IP Stability</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Complete surveys from your standard home residential or mobile connection; avoid public proxy or VPN connections.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Account Standing & Priority Access
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Participants who consistently deliver thoughtful answers and pass attention checks build a strong internal reputation score. High-reputation accounts are prioritized for specialized, higher-reward research studies.
          </p>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Quality Assurance Notice
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Researchers reserve the right to disqualify submissions containing gibberish or automated patterns. SmartExn does not provide fixed hourly wages. All legitimate completions are protected by upfront escrow funding.
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
            <Link to="/paid-surveys/attention-checks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Attention Checks Protect Data Quality
            </Link>
            <Link to="/paid-surveys/survey-qualification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Survey Qualification & Demographic Profiling
            </Link>
            <Link to="/workers/how-to-avoid-task-rejection" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Avoid Task Rejections on SmartExn
            </Link>
            <Link to="/paid-surveys/how-online-surveys-work" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Online Paid Surveys Work
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Participate in High-Trust Research</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Join thousands of active contributors providing verified feedback on SmartExn.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/paid-surveys"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Explore Surveys
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
