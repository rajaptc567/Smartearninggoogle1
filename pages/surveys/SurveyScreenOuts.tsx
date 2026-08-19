import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const SurveyScreenOuts: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is a survey screen-out?',
      a: 'A screen-out occurs when a participant answers an initial screening question that indicates they do not meet the study eligibility requirements (such as not using a specific brand or living outside a target metropolitan area).'
    },
    {
      q: 'What does "quota full" mean?',
      a: '"Quota full" means that while you matched the target demographic, the researcher has already collected the required number of completed responses for that demographic segment.'
    },
    {
      q: 'Does a screen-out penalize my SmartExn account?',
      a: 'No. Screen-outs and quota limits are normal occurrences in market research and have no negative impact on your account standing, trust score, or eligibility for other tasks.'
    },
    {
      q: 'Can I re-enter a survey after being screened out?',
      a: 'Once a survey records a screen-out for your session, that specific survey instance cannot be retaken. You can immediately return to the survey feed to select a different study.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/paid-surveys/survey-screen-outs#webpage",
        "url": "https://smartexn.com/paid-surveys/survey-screen-outs",
        "name": "Understanding Survey Screen-Outs & Quotas: Educational Guide | SmartExn",
        "description": "Learn why survey screen-outs occur, what quota full means, and how to navigate demographic screening effectively on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/paid-surveys/survey-screen-outs#breadcrumb",
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
            "name": "Survey Screen-Outs",
            "item": "https://smartexn.com/paid-surveys/survey-screen-outs"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/paid-surveys/survey-screen-outs#faq",
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
        title="Understanding Survey Screen-Outs & Quotas: Educational Guide | SmartExn"
        description="Learn why survey screen-outs occur, what quota full means, and how to navigate demographic screening effectively on SmartExn."
        canonicalUrl="https://smartexn.com/paid-surveys/survey-screen-outs"
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
          <span className="text-sky-400 font-medium">Survey Screen-Outs</span>
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
            Understanding Survey Screen-Outs & Quotas: Why They Occur & What to Expect
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            A transparent guide explaining demographic screen-outs, quota limits, researcher sample sizes, and how to optimize your time when taking online surveys.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Screen-Outs Are Part of Market Research
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Unlike general micro-tasks where any worker can follow a standard set of steps, market research surveys require precise audience demographics. If an automaker wants feedback on electric vehicle charging networks, they cannot use answers from respondents who do not drive.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Screen-out questions are positioned at the very start of a questionnaire to quickly determine fit without taking up unnecessary time.
          </p>
        </section>

        {/* The 3 Reasons */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. The 3 Primary Types of Screen-Outs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Demographic Mismatch</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                You do not match the specific criteria required (e.g. industry role, parent status, or purchase history).
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Quota Full</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                You match the criteria, but the study has already reached its target number of participants for that group.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Quality Flag</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Answering contradictory demographic answers compared to prior profile entries triggered an automated exclusion.
              </p>
            </div>
          </div>
        </section>

        {/* What to Do */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Recommended Strategy for Survey Participants
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Answer pre-screeners honestly:</strong> Trying to guess "what the researcher wants to hear" often leads to mid-survey disqualifications.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Move on quickly:</strong> If screened out, simply click back to the survey catalog and select the next available study.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Participate early:</strong> New surveys published early in the week or morning hours tend to have open quotas across all demographics.</span>
            </li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Platform Notice
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Screen-outs are determined by third-party research criteria and quotas. SmartExn does not guarantee qualification for all listed surveys. Rewards are disbursed exclusively upon full, verified questionnaire completion.
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
            <Link to="/paid-surveys/survey-qualification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Survey Qualification & Demographic Profiling
            </Link>
            <Link to="/paid-surveys/attention-checks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Attention Checks in Online Surveys
            </Link>
            <Link to="/paid-surveys/survey-rewards" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Survey Rewards Are Calculated
            </Link>
            <Link to="/paid-surveys/how-online-surveys-work" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Online Paid Surveys Work
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Explore Available Surveys</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Browse our current catalog of research studies and find surveys open for your profile today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/paid-surveys"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Surveys
            </Link>
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Explore Micro-Tasks
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
