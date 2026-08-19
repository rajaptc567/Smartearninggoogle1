import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';

export const OnlinePaidSurveysGuide: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Why was I screened out of a survey after answering a few questions?',
      a: 'Market research studies require specific demographics (such as purchasing habits, industry roles, or regions). If your responses do not match the target cohort or if the quota for your demographic has already been met, you will be disqualified early.'
    },
    {
      q: 'How often are new surveys available?',
      a: 'Survey availability fluctuates daily based on active market research studies, your geographic region, and partner provider inventories.'
    },
    {
      q: 'Do I get paid if I get screened out?',
      a: 'Generally, full survey rewards are only issued upon complete, valid study submissions. Some providers may award minor disqualification credits depending on partner policies.'
    },
    {
      q: 'Are my personal survey answers shared with advertisers?',
      a: 'Responses are collected in aggregate and anonymized by research partners to generate statistical insights. Personal identifiers are never sold.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/knowledge-base/online-paid-surveys-guide#webpage",
        "url": "https://smartexn.com/knowledge-base/online-paid-surveys-guide",
        "name": "Online Paid Surveys: How Survey Tasks Work | SmartExn Knowledge Base",
        "description": "Comprehensive guide explaining survey demographics, screening questions, study quotas, attention checks, and reward crediting.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/knowledge-base/online-paid-surveys-guide#breadcrumb",
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
            "name": "Online Paid Surveys Guide",
            "item": "https://smartexn.com/knowledge-base/online-paid-surveys-guide"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/knowledge-base/online-paid-surveys-guide#faq",
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
        title="Online Paid Surveys: How Survey Tasks Work | SmartExn Guide"
        description="Learn how market research surveys operate, including demographic qualification, quota management, attention checks, and reward crediting."
        canonical="https://smartexn.com/knowledge-base/online-paid-surveys-guide"
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
              <span className="text-slate-300 truncate max-w-xs sm:max-w-md">Online Paid Surveys Guide</span>
            </nav>

            <div className="flex items-center gap-3 pt-2">
              <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase">
                Market Research
              </span>
              <span className="text-xs text-slate-400">Updated August 2026</span>
              <span className="text-xs text-slate-400">• 4 min read</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Online Paid Surveys: How Survey Tasks Work
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              An educational overview of online market research, demographic screening, quality controls, and the mechanics of survey reward crediting.
            </p>
          </div>
        </section>

        {/* Content Body */}
        <article className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              What Are Online Paid Surveys?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Online paid surveys are quantitative market research instruments published by consumer brands, academic researchers, and consulting firms. Organizations commission surveys to gauge sentiment on consumer products, software usability, advertising campaigns, and emerging lifestyle trends.
            </p>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Through platforms like SmartExn and integrated market research partners, respondents are compensated when they provide thorough, authentic feedback that meets the study parameters. Explore our overview on the{' '}
              <Link to="/paid-surveys" className="text-sky-400 font-semibold hover:underline">Paid Surveys Overview Page</Link>.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Qualification Questions & Demographic Screening
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Before reaching the core questions, almost every survey presents initial screening questions regarding your age group, country/region, household decision-making role, or professional background.
            </p>
            <div className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 text-sm text-slate-300 space-y-2">
              <strong className="text-white block">Why Disqualifications (Screen-Outs) Occur:</strong>
              <p className="text-xs sm:text-sm">
                If a study is researching automotive owners in a specific state and your profile indicates you do not own a vehicle, the survey software terminates the session to avoid gathering irrelevant data. This is a standard industry practice across all market research networks.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Study Quotas & Attention Checks
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Researchers place constraints called <em>quotas</em> to ensure balanced sample representations (e.g. 500 respondents split evenly across age brackets). Once a demographic quota is filled, further respondents from that group are screened out.
            </p>
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs sm:text-sm text-amber-200 space-y-2">
              <strong className="text-amber-300 block">⚠️ Attention Verification Checks:</strong>
              <p>
                To filter out automated scripts and rushed clicking, surveys embed trap questions such as: <em>&quot;Please select the color blue below to show you are reading&quot;</em> or <em>&quot;Select Strongly Disagree for this statement&quot;</em>. Failing an attention check will instantly invalidate your response.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Response Quality & Reward Crediting
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              When a survey session reaches the official completion page, the research partner registers a successful status callback. Rewards are credited directly to your SmartExn Task Earnings balance in accordance with the campaign terms.
            </p>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              For complete details on how wallet allocations and balance releases function, review our{' '}
              <Link to="/how-it-works-for-workers" className="text-sky-400 font-semibold hover:underline">Worker Workflow Guide</Link>.
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
                to="/paid-surveys"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Paid Surveys Hub →</span>
                <p className="text-xs text-slate-300">Explore market research opportunities.</p>
              </Link>
              <Link
                to="/how-it-works-for-workers"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Worker Guide →</span>
                <p className="text-xs text-slate-300">Learn about wallets, tasks, and reviews.</p>
              </Link>
              <Link
                to="/faqs"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Knowledge Base FAQs →</span>
                <p className="text-xs text-slate-300">Common questions regarding survey completions.</p>
              </Link>
            </div>
          </section>

        </article>
      </main>

      <PublicFooter />
    </div>
  );
};

export default OnlinePaidSurveysGuide;
