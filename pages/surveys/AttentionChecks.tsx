import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const AttentionChecks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is an attention check in an online survey?',
      a: 'An attention check (also called a trap question or quality validation item) is a question specifically designed to test whether a respondent is reading the instructions carefully rather than clicking randomly or using automated software.'
    },
    {
      q: 'What are common examples of attention check questions?',
      a: 'Examples include questions that state: "To demonstrate you are reading, please select ‘Strongly Disagree’ for this row", or "What is 2 + 3? Type the word ‘five’ in the box below."'
    },
    {
      q: 'What happens if I fail an attention check?',
      a: 'Failing an attention check immediately terminates the survey session without reward, and the response is discarded to prevent corrupting the researcher’s statistical dataset.'
    },
    {
      q: 'Does failing an attention check ban my SmartExn account?',
      a: 'A single accidental failure will not ban your account, but a consistent pattern of failed attention checks will lower your quality score and restrict future survey opportunities.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/paid-surveys/attention-checks#webpage",
        "url": "https://smartexn.com/paid-surveys/attention-checks",
        "name": "Attention Checks in Paid Surveys: Quality Standards & Traps Guide | SmartExn",
        "description": "Learn how attention checks and quality validation questions work in online paid surveys. Understand trap formats, avoiding disqualification, and maintaining high trust.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/paid-surveys/attention-checks#breadcrumb",
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
            "name": "Attention Checks",
            "item": "https://smartexn.com/paid-surveys/attention-checks"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/paid-surveys/attention-checks#faq",
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
        title="Attention Checks in Paid Surveys: Quality Standards & Traps Guide | SmartExn"
        description="Learn how attention checks and quality validation questions work in online paid surveys. Understand trap formats, avoiding disqualification, and maintaining high trust."
        canonicalUrl="https://smartexn.com/paid-surveys/attention-checks"
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
          <span className="text-sky-400 font-medium">Attention Checks</span>
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
            Attention Checks in Online Paid Surveys: How Quality Validation Protects Data
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Understand why market researchers embed quality traps, instruction checks, and consistency questions, and learn how careful reading guarantees valid completions.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. The Importance of Data Integrity
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Market research studies often guide multi-million dollar corporate decisions. If responses are submitted by users rushing through without reading, the resulting data is useless to researchers. Attention checks ensure that only thoughtful, human responses make it into final reports.
          </p>
        </section>

        {/* Common Formats */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Common Types of Attention Checks
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Direct Instruction Prompts</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                A question with a long paragraph ending with: <em>"Regardless of your actual opinion, please select ‘Somewhat Agree’ for this question."</em>
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Factual Logic Checks</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Basic universal knowledge questions such as <em>"Which of the following is a fruit? (A) Brick, (B) Apple, (C) Chair."</em>
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Speeder Traps (Page Timers)</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Tracking the time spent on a page; answering a 20-item matrix grid in 3 seconds triggers an automated speeder disqualification.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Consistency Verification</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Asking for your age or marital status at the beginning, and repeating the question in a different format near the end.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. How to Pass Every Attention Check
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Read the entire prompt:</strong> Never assume you know what a matrix question is asking based on the first few words.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Take a steady pace:</strong> Allow at least 3–5 seconds per question row to reflect genuine human reading speed.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Do not straight-line answers:</strong> Selecting the same radio button down an entire grid will trigger automated pattern filters.</span>
            </li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Survey Quality Notice
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Attention checks are built into external researcher questionnaires. SmartExn does not control specific trap placement. Successful completion and escrow release require adhering to survey reading instructions.
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
            <Link to="/paid-surveys/survey-quality" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → High-Quality Survey Response Guidelines
            </Link>
            <Link to="/paid-surveys/survey-qualification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Survey Qualification & Demographic Profiling
            </Link>
            <Link to="/paid-surveys/survey-screen-outs" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Understanding Survey Screen-Outs & Quotas
            </Link>
            <Link to="/paid-surveys/how-online-surveys-work" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Online Paid Surveys Work
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Browse Live Market Research Surveys</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Take verified online surveys and earn rewards credited directly into your escrow-backed balance.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/paid-surveys"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Open Surveys
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Create Free Account
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
