import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const HowOnlineSurveysWork: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How do market research surveys function on SmartExn?',
      a: 'Independent market research firms and advertisers sponsor online surveys on SmartExn to gather consumer feedback on products, brands, and public services. Survey participants answer questionnaires matching their demographic profile.'
    },
    {
      q: 'Why do surveys ask screening questions at the beginning?',
      a: 'Screeners help researchers ensure they are interviewing individuals who match their target study criteria—such as specific age groups, employment sectors, technology usage habits, or geographic locations.'
    },
    {
      q: 'How are survey rewards calculated and paid?',
      a: 'Survey rewards reflect the Length of Interview (LOI) and study complexity. When an advertiser launches a survey campaign, 100% of the rewards budget is placed into SmartExn escrow and disbursed upon valid questionnaire completion.'
    },
    {
      q: 'Does every user qualify for every survey?',
      a: 'No. Surveys target specific demographic quotas. If a survey is seeking 500 parents who own a hybrid vehicle, respondents who do not meet those criteria will be screened out.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/paid-surveys/how-online-surveys-work#webpage",
        "url": "https://smartexn.com/paid-surveys/how-online-surveys-work",
        "name": "How Online Paid Surveys Work: Market Research, Panels & Rewards | SmartExn",
        "description": "Educational guide on how online paid surveys work. Learn about market research questionnaires, demographic screening, quotas, and verified reward payouts.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/paid-surveys/how-online-surveys-work#breadcrumb",
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
            "name": "How Online Surveys Work",
            "item": "https://smartexn.com/paid-surveys/how-online-surveys-work"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/paid-surveys/how-online-surveys-work#faq",
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
        title="How Online Paid Surveys Work: Market Research, Panels & Rewards | SmartExn"
        description="Educational guide on how online paid surveys work. Learn about market research questionnaires, demographic screening, quotas, and verified reward payouts."
        canonicalUrl="https://smartexn.com/paid-surveys/how-online-surveys-work"
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
          <span className="text-sky-400 font-medium">How Online Surveys Work</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Survey Authority</span>
            <span>•</span>
            <span>5 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            How Online Paid Surveys Work: Market Research, Qualification & Escrow Payouts
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            An in-depth explanation of how digital market research studies operate, why demographic screeners exist, how attention checks maintain data integrity, and how rewards are disbursed.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. The Purpose of Market Research Surveys
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Before launching a new consumer product, rebranding a logo, or making major changes to digital services, organizations require candid feedback from real people. Rather than guessing what their target market wants, companies commission structured surveys on SmartExn.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            SmartExn provides the infrastructure that enables verified respondents to share thoughtful feedback in exchange for escrow-backed compensation.
          </p>
        </section>

        {/* Survey Stages */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. The 4 Stages of an Online Survey
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Demographic Screener</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Initial questions checking age, region, employment, or device type to ensure alignment with researcher targets.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Core Questionnaire</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Multiple-choice questions, rating scales, and short open-ended prompts regarding preferences and brand perceptions.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Quality & Attention Checks</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Embedded logic questions (e.g. "Select option 3 to confirm you are reading") to filter automated bots or speeders.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Completion & Escrow Crediting</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Reaching the final thank-you screen and submitting your completion code or confirmation link releases the escrow reward.
              </p>
            </div>
          </div>
        </section>

        {/* Qualification & Screen-Outs */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Understanding Qualifications & Quotas
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Market research studies have finite sample sizes called <strong>quotas</strong>. For example, if a study needs 200 participants from urban areas and that quota is filled, later participants will receive a screen-out message. This is standard across the global market research industry.
          </p>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Earnings & Availability Transparency
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Survey availability varies based on researcher demand, demographic eligibility, and active quotas. SmartExn does not guarantee daily survey qualification or fixed earnings. All rewards are held in escrow and released upon valid survey completion.
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
            <Link to="/paid-surveys/survey-screen-outs" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Understanding Survey Screen-Outs & Quotas
            </Link>
            <Link to="/paid-surveys/attention-checks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Attention Checks & Quality Standards in Surveys
            </Link>
            <Link to="/knowledge-base/online-paid-surveys-guide" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → SmartExn Paid Surveys Knowledge Guide
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Browse Live Online Surveys</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Discover active market research studies and opinion polls currently matching your profile.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/paid-surveys"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Explore Paid Surveys
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
