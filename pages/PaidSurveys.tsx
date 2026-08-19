import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedSurveyGuides: GuideItem[] = [
  {
    title: 'How Online Paid Surveys Work',
    description: 'Understand the market research ecosystem, survey routers, and how opinion studies compensate respondents.',
    to: '/paid-surveys/how-online-surveys-work',
    category: 'Surveys',
    tag: 'Methodology'
  },
  {
    title: 'Survey Qualification & Demographic Matching',
    description: 'Learn how profile matching works and how maintaining an updated demographic profile increases qualification.',
    to: '/paid-surveys/survey-qualification',
    category: 'Surveys',
    tag: 'Qualification'
  },
  {
    title: 'Understanding Survey Screen-Outs & Quotas',
    description: 'Why screen-outs occur, demographic quotas, and actionable strategies to minimize disqualifications.',
    to: '/paid-surveys/survey-screen-outs',
    category: 'Surveys',
    tag: 'Screen-Outs'
  },
  {
    title: 'Passing Attention Checks & Quality Traps',
    description: 'How to spot trap questions, consistency verifications, and speeder traps in market research questionnaires.',
    to: '/paid-surveys/attention-checks',
    category: 'Surveys',
    tag: 'Quality'
  },
  {
    title: 'Survey Rewards & Payout Structures',
    description: 'How survey incentives are calculated, credited to your wallet, and disbursed upon completion.',
    to: '/paid-surveys/survey-rewards',
    category: 'Surveys',
    tag: 'Rewards'
  },
  {
    title: 'Online Paid Surveys Comprehensive Guide',
    description: 'Complete educational manual for participating in opinion studies and maximizing survey eligibility.',
    to: '/knowledge-base/online-paid-surveys-guide',
    category: 'Knowledge Base',
    tag: 'Complete Guide'
  }
];

const surveyFaqs = [
  {
    question: "What are paid online surveys on SmartExn?",
    answer: "Paid online surveys are research questionnaires published by creators and market research organizations. Participants answer questions regarding consumer habits, digital products, and brand opinions in return for monetary wallet rewards upon valid completion."
  },
  {
    question: "How do survey tasks work from start to finish?",
    answer: "You select an available survey task from your dashboard, complete the initial demographic screener, answer all research questions thoughtfully, and reach the final confirmation page. The reward is then verified and credited to your earnings wallet."
  },
  {
    question: "Why was I disqualified or screened out of a survey?",
    answer: "Researchers require specific target audiences (such as specific age groups, regions, or product owners). When initial screener answers indicate you are not part of the target study quota, the survey ends early to protect research integrity. Disqualification is a standard part of market research."
  },
  {
    question: "What are survey quality and attention checks?",
    answer: "To prevent automated bots and random clicking, survey creators embed attention-check questions (e.g. 'Select purple for this answer'). Failing an attention check or answering inconsistently can disqualify your submission."
  },
  {
    question: "How do survey rewards and availability work?",
    answer: "Reward amounts and survey availability vary based on active advertiser campaigns, demographic eligibility, and research volume. SmartExn does not guarantee fixed daily surveys or guaranteed income."
  },
  {
    question: "How do I withdraw my earnings from completed surveys?",
    answer: "Verified rewards from approved surveys accumulate in your Task Earnings balance. You can withdraw your earnings using supported payment methods once you reach the minimum withdrawal threshold."
  }
];

export const PaidSurveys: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/paid-surveys#webpage",
        "url": "https://smartexn.com/paid-surveys",
        "name": "Paid Online Surveys & Opinion Tasks | SmartExn",
        "description": "Participate in online surveys, opinion questionnaires and research tasks on SmartExn. Survey availability and rewards vary by campaign and eligibility.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/paid-surveys#breadcrumb",
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
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/paid-surveys#faq",
        "mainEntity": surveyFaqs.map(item => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
          }
        }))
      }
    ]
  };

  const surveySteps = [
    {
      num: "1",
      title: "Select an Available Survey",
      desc: "Browse current questionnaire campaigns in your task catalog that match your language and location."
    },
    {
      num: "2",
      title: "Complete Demographic Screener",
      desc: "Answer brief introductory questions to determine if your profile matches the researcher's target audience."
    },
    {
      num: "3",
      title: "Provide Thoughtful Feedback",
      desc: "Answer all questionnaire sections honestly and pay close attention to embedded attention-check questions."
    },
    {
      num: "4",
      title: "Submit Confirmation & Get Rewarded",
      desc: "Reach the official completion screen to register your submission and receive verified reward credit in your wallet."
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="Paid Online Surveys & Opinion Tasks | SmartExn"
        description="Participate in online surveys, opinion questionnaires and research tasks on SmartExn. Survey availability and rewards vary by campaign and eligibility."
        canonical="https://smartexn.com/paid-surveys"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="paid-surveys" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            
            {/* Breadcrumb pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">Paid Surveys</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              Paid Online Surveys & <br className="hidden sm:inline" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-300 to-amber-300">
                Opinion Tasks on SmartExn
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Share your authentic feedback on consumer products, software tools, and market trends. Participate in paid questionnaires and opinion research tasks for verified rewards.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Start Taking Surveys Free
              </Link>
              <Link
                to="/micro-tasks"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base transition-all text-center"
              >
                Explore Online Micro-Tasks
              </Link>
            </div>
          </div>
        </section>

        {/* Section 1: What Are Online Paid Surveys? */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
              Research Overview
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              What Are Online Paid Surveys?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Online paid surveys are structured questionnaires conducted by businesses, researchers, and marketing agencies to collect consumer insights. Organizations need genuine feedback from real people to refine new products, understand media consumption habits, and evaluate brand messaging before making commercial investments.
            </p>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              On SmartExn, registered members can access survey campaigns and opinion tasks. When you qualify for a study and provide valid, complete responses, you receive reward compensation credited directly to your platform earnings wallet.
            </p>
          </div>
        </section>

        {/* Section 2: How Survey Tasks Work */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How Survey Tasks Work
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Participating in opinion studies on SmartExn follows a four-step lifecycle.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {surveySteps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400/50 rounded-2xl p-6 space-y-3 transition-all duration-200 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 font-black text-lg flex items-center justify-center mb-3">
                      {step.num}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{step.desc}</p>
                  </div>
                  <span className="text-[11px] text-amber-400 font-semibold pt-2">Step {step.num} of 4</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Survey Qualification */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              Eligibility & Demographics
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Survey Qualification
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Every market research study is commissioned for a specific target audience. For instance, a coffee brand may only need feedback from daily coffee drinkers in specific metropolitan areas, while an enterprise software company may require insights from IT managers.
            </p>
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="font-bold text-sky-300 text-sm">Understanding Screening & Disqualification:</h3>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                When you begin a survey, you will typically answer brief screener questions. If your answers indicate you do not match the study's demographic, geographic, or behavioral requirements, the survey will conclude early. <strong>SmartExn does not promise or guarantee that every user will qualify for every survey.</strong> Screen-outs are an inherent and normal part of legitimate market research.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Why Survey Responses Matter */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Why Survey Responses Matter
              </h2>
              <p className="text-slate-300 text-sm sm:text-base">
                Your opinions shape real-world products, mobile experiences, and public services.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">💡</span>
                <h3 className="font-bold text-white text-base">Product Innovation</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">Brands use questionnaire data to design features, adjust pricing, and fix usability issues before releasing products.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">📊</span>
                <h3 className="font-bold text-white text-base">Consumer Insights</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">Market analysts study consumer preferences to understand changing shopping patterns and emerging digital technologies.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">🌍</span>
                <h3 className="font-bold text-white text-base">Global Representation</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">By participating, you ensure international consumers from diverse regions are represented in major product decisions.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Survey Quality & Attention Checks */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              Data Integrity
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Survey Quality & Attention Checks
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Research partners maintain rigorous data quality algorithms. To ensure participants read questions carefully rather than clicking randomly, surveys routinely include quality verification mechanisms:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <h4 className="font-bold text-emerald-400 text-sm">Attention Check Questions</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Specific instructions embedded inside questions (such as "Please choose Agree Strongly for this question to confirm attention").</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <h4 className="font-bold text-emerald-400 text-sm">Response Consistency</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Algorithms cross-check answers across multiple screens to verify honesty and prevent contradictions.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <h4 className="font-bold text-emerald-400 text-sm">Completion Time Auditing</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Surveys have minimum completion time baselines; rushing through questions without reading can lead to disqualification.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <h4 className="font-bold text-emerald-400 text-sm">No Proxies or VPNs</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Using VPN or proxy connections triggers fraud detection firewalls and prevents survey access.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6 & 7: Survey Rewards & Availability */}
        <section className="py-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200/90 text-xs sm:text-sm leading-relaxed space-y-4">
            <div>
              <h2 className="text-lg font-bold text-amber-300 mb-1">
                Survey Rewards
              </h2>
              <p>
                Reward amounts and availability vary by task, provider, and campaign. Longer questionnaires requiring specialized demographic knowledge offer higher compensation, while short opinion polls offer smaller rewards.
              </p>
            </div>

            <div className="pt-2 border-t border-amber-900/50">
              <h2 className="text-lg font-bold text-amber-300 mb-1">
                Survey Availability
              </h2>
              <p>
                Survey availability depends on active advertiser campaigns and eligible user demographics. SmartExn does not claim or guarantee daily survey availability, fixed survey volumes, or guaranteed passive income. Surveys provide a flexible, supplemental way to earn rewards in your spare time.
              </p>
            </div>
          </div>
        </section>

        {/* Section 8: Frequently Asked Questions */}
        <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 text-sm">
              Common questions regarding online surveys, screening criteria, and reward payouts on SmartExn.
            </p>
          </div>

          <div className="space-y-4">
            {surveyFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-start justify-between gap-4 font-bold text-white hover:text-sky-400 transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
                  >
                    <span className="text-base sm:text-lg leading-snug">{faq.question}</span>
                    <span className="text-xl text-sky-400 font-bold shrink-0">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-slate-300 text-sm leading-relaxed border-t border-sky-900/40 pt-4">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center pt-4 flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/how-it-works-for-workers" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>How It Works for Workers</span>
              <span>→</span>
            </Link>
            <Link to="/trust-and-safety" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Trust & Safety Hub</span>
              <span>→</span>
            </Link>
            <Link to="/micro-tasks" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Explore Online Micro-Tasks</span>
              <span>→</span>
            </Link>
            <Link to="/faqs" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Knowledge Base FAQs</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Related Educational Guides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <RelatedGuides guides={relatedSurveyGuides} />
        </div>

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Start Earning Rewards with Online Surveys
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Sign up today to access opinion questionnaires, micro-tasks, and crowdsourced campaigns.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/paid-surveys', 'worker')}
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/how-it-works"
                  onClick={() => seoAnalytics.trackWorkerCtaClick('How It Works (Surveys Bottom)', '/paid-surveys')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  How It Works
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default PaidSurveys;
