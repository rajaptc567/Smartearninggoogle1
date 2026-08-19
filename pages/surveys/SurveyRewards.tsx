import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const SurveyRewards: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How are survey rewards calculated on SmartExn?',
      a: 'Survey rewards are calculated based on the estimated Length of Interview (LOI), topic complexity, and specialized demographic targeting requirements set by the researcher.'
    },
    {
      q: 'When are survey rewards credited to my account?',
      a: 'Upon reaching the final confirmation screen and registering a completion code or automated callback, rewards are credited directly from campaign escrow into your Task Earnings wallet balance.'
    },
    {
      q: 'Do I get paid if I get screened out after answering a few questions?',
      a: 'If a screen-out occurs during the initial screening questions, no reward is disbursed because the study data cannot be utilized by the researcher. Short pre-screeners take 30 to 60 seconds.'
    },
    {
      q: 'Are survey earnings subject to withdrawal minimums?',
      a: 'Yes. Once credited to your Task Earnings balance, funds can be withdrawn through any supported payment method according to platform minimum payout thresholds.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/paid-surveys/survey-rewards#webpage",
        "url": "https://smartexn.com/paid-surveys/survey-rewards",
        "name": "Survey Rewards Calculation & Payout Guide | SmartExn",
        "description": "Learn how online survey rewards are calculated, credited via escrow, and transferred to your wallet balance on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/paid-surveys/survey-rewards#breadcrumb",
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
            "name": "Survey Rewards",
            "item": "https://smartexn.com/paid-surveys/survey-rewards"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/paid-surveys/survey-rewards#faq",
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
        title="Survey Rewards Calculation & Payout Guide | SmartExn"
        description="Learn how online survey rewards are calculated, credited via escrow, and transferred to your wallet balance on SmartExn."
        canonicalUrl="https://smartexn.com/paid-surveys/survey-rewards"
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
          <span className="text-sky-400 font-medium">Survey Rewards</span>
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
            Survey Rewards & Payout Guide: Valuation, Escrow Crediting & Wallet Balances
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            A comprehensive breakdown of how survey rewards are determined by length of interview, how escrow protections guarantee payouts, and how earnings are credited.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. How Survey Compensation Works
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Market research studies offer financial incentives commensurate with the time and effort required to provide detailed opinions. SmartExn guarantees that 100% of the advertiser's reward budget is pre-funded into escrow before a questionnaire is listed publicly.
          </p>
        </section>

        {/* Factors */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Primary Factors Influencing Survey Value
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Length of Interview (LOI)</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Surveys taking 15–20 minutes offer significantly higher reward amounts than quick 3-minute pulse polls.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Specialized Audience</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Surveys targeting rare professional fields (e.g. IT directors, physicians, or business owners) carry premium compensation.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Study Complexity</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Surveys incorporating video evaluations, prototype reviews, or detailed open-ended prompts offer higher rewards.
              </p>
            </div>
          </div>
        </section>

        {/* Escrow Crediting */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Escrow Crediting & Wallet Balances
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Once you submit your completed survey questionnaire, the platform records your verified completion. The reward is transferred from the campaign escrow directly into your <strong>Task Earnings</strong> balance, where it becomes eligible for withdrawal according to standard platform payout rules.
          </p>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Earnings Disclaimer
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            SmartExn does not provide fixed hourly wages or guarantee a set number of available surveys per day. Rewards are disbursed exclusively upon valid completion of eligible research studies.
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
            <Link to="/workers/reward-and-withdrawal-guide" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Reward & Withdrawal Policies
            </Link>
            <Link to="/paid-surveys/survey-qualification" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Survey Qualification & Demographic Profiling
            </Link>
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → 100% Upfront Escrow Protection System
            </Link>
            <Link to="/paid-surveys/how-online-surveys-work" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How Online Paid Surveys Work
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Start Taking Online Surveys</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Browse open questionnaires and earn escrow-backed rewards on SmartExn today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/paid-surveys"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Surveys
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
