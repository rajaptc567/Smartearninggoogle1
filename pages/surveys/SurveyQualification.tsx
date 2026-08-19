import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const SurveyQualification: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is survey qualification?',
      a: 'Survey qualification is the process where market researchers match survey opportunities with specific respondent demographics (such as age, location, occupation, or consumer habits) to ensure survey data is scientifically valid.'
    },
    {
      q: 'Why does keeping an accurate profile improve qualification rates?',
      a: 'When your profile information is accurate, the SmartExn survey router can match you directly with campaigns targeted at your demographic segment, reducing the likelihood of encountering screen-out questions.'
    },
    {
      q: 'Can I change my answers to qualify for more surveys?',
      a: 'No. Consistency is strictly monitored by market research validation algorithms. Inconsistent answers across surveys will trigger quality flags and reduce future survey invitations.'
    },
    {
      q: 'Why do surveys ask the same screening questions repeatedly?',
      a: 'Each individual advertiser or market research panel operates independently and must verify eligibility directly according to their specific research methodology.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/paid-surveys/survey-qualification#webpage",
        "url": "https://smartexn.com/paid-surveys/survey-qualification",
        "name": "Survey Qualification & Demographic Matching Guide | SmartExn",
        "description": "Learn how survey qualification works on SmartExn. Understand demographic screening, profile accuracy, quota matching, and maximizing survey invitations.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/paid-surveys/survey-qualification#breadcrumb",
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
            "name": "Survey Qualification",
            "item": "https://smartexn.com/paid-surveys/survey-qualification"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/paid-surveys/survey-qualification#faq",
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
        title="Survey Qualification & Demographic Matching Guide | SmartExn"
        description="Learn how survey qualification works on SmartExn. Understand demographic screening, profile accuracy, quota matching, and maximizing survey invitations."
        canonicalUrl="https://smartexn.com/paid-surveys/survey-qualification"
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
          <span className="text-sky-400 font-medium">Survey Qualification</span>
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
            Survey Qualification: Demographic Screening, Profiles & Matching Criteria
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Understand how market research panels select respondents, why demographic pre-screeners are used, and how maintaining accurate profile traits optimizes survey access.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Demographic Targeting Matters
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Market research studies require representative samples. A video game publisher might specifically need opinions from console gamers aged 18–34, while a financial institution might require feedback from small business owners who manage enterprise payroll.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            When you enter a survey on SmartExn, initial screener questions check whether your background matches the advertiser's target sample criteria.
          </p>
        </section>

        {/* Best Practices */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Best Practices for High Qualification
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Consistent Demographics</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Always provide the same birth year, household size, and location across studies to prevent identity consistency flags.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Honest Category Selection</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Do not claim ownership of products you do not actually use; specialized follow-up questions quickly identify unverified claims.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Device Matching</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Ensure you take desktop-optimized surveys on a computer and mobile-friendly questionnaires on a smartphone.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Prompt Participation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                High-demand demographic quotas fill up quickly; opening available survey invitations promptly increases completion rates.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. What Happens During a Screen-Out?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            If your demographic profile does not match a particular study, the survey system automatically redirects you back to the survey hub so you can choose another active study. A screen-out does not affect your account standing or rating.
          </p>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Eligibility Disclaimer
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            No platform can guarantee 100% survey qualification. Availability and qualification rates fluctuate daily based on advertiser study criteria. Rewards are released upon valid survey completion.
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
            <Link to="/paid-surveys/survey-screen-outs" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Understanding Survey Screen-Outs & Quotas
            </Link>
            <Link to="/paid-surveys/attention-checks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Attention Checks Protect Data Quality
            </Link>
            <Link to="/paid-surveys/survey-rewards" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Survey Reward Calculation & Payout Guide
            </Link>
            <Link to="/paid-surveys/how-online-surveys-work" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Online Surveys Work
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Explore Open Surveys</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Browse available online surveys currently open for matching demographic profiles.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/paid-surveys"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Paid Surveys
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Register Free
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
