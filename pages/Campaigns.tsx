import React from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedCampaignGuides: GuideItem[] = [
  {
    title: 'How to Create a Micro-Task Campaign',
    description: 'Step-by-step walkthrough of campaign publishing, task requirements, escrow budget, and proof review.',
    to: '/knowledge-base/how-to-create-a-campaign',
    category: 'Advertisers',
    tag: 'Essential'
  },
  {
    title: 'Advertise on SmartExn: Enterprise & Creator Solutions',
    description: 'Overview of distributed workforce scaling, pricing structures, and targeting features.',
    to: '/advertise',
    category: 'Advertisers',
    tag: 'Overview'
  },
  {
    title: 'Mobile App Testing & QA Campaigns',
    description: 'Collect real-device feedback, bug reports, and UX reviews across global device ecosystems.',
    to: '/advertise/app-testing-campaigns',
    category: 'Advertisers',
    tag: 'App Testing'
  },
  {
    title: 'Social Media Engagement Campaigns',
    description: 'Scale authentic channel subscriptions, community growth, and verified post engagement.',
    to: '/advertise/social-media-campaigns',
    category: 'Advertisers',
    tag: 'Social'
  },
  {
    title: 'Market Research & Consumer Survey Campaigns',
    description: 'Acquire verified consumer insights from targeted demographic segments with S2S postback tracking.',
    to: '/advertise/survey-campaigns',
    category: 'Advertisers',
    tag: 'Surveys'
  },
  {
    title: '100% Upfront Escrow Protection Architecture',
    description: 'How SmartExn guarantees 100% funded campaign escrow, automated review timers, and double-entry settlements.',
    to: '/trust-and-safety/escrow',
    category: 'Trust & Safety',
    tag: 'Escrow'
  }
];

export const Campaigns: React.FC = () => {
  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/campaigns#webpage",
        "url": "https://smartexn.com/campaigns",
        "name": "Crowdsourced Micro-Task Campaigns | SmartExn",
        "description": "Launch crowdsourced micro-task campaigns on SmartExn. Connect with a global workforce for social engagement, app testing, website testing, and digital tasks.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/campaigns#breadcrumb",
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
            "name": "Campaigns",
            "item": "https://smartexn.com/campaigns"
          }
        ]
      }
    ]
  };

  const campaignSteps = [
    {
      num: "01",
      title: "Define Campaign Objective",
      desc: "Specify your task title, category, destination URL, and step-by-step instructions for remote workers."
    },
    {
      num: "02",
      title: "Set Proof Requirements",
      desc: "Specify exact verification criteria—such as uncropped screenshots, usernames/handles, or confirmation IDs."
    },
    {
      num: "03",
      title: "Fund Campaign via Escrow",
      desc: "Set your per-task reward and total worker slots. Funds are locked securely in platform escrow and only released upon proof approval."
    },
    {
      num: "04",
      title: "Review Submissions",
      desc: "Inspect worker submissions in your advertiser dashboard. Approve valid work or request revisions with feedback."
    }
  ];

  const categories = [
    {
      title: "Social Media Tasks",
      desc: "Channel subscriptions, page follows, post likes, genuine comments, and community group joins on major networks."
    },
    {
      title: "App Testing & Feedback",
      desc: "Mobile app installations, usability testing across diverse smartphone models, onboarding evaluations, and store feedback."
    },
    {
      title: "Website Testing & Navigation",
      desc: "Page load verification, UX exploration, user journey audits, and testing browser compatibility across global regions."
    },
    {
      title: "Search & Research Tasks",
      desc: "Directory verifications, public web research, organic search discovery tests, and competitor listing checks."
    },
    {
      title: "Data Verification",
      desc: "Categorization of digital assets, checking contact information, verifying public records, and content tagging."
    },
    {
      title: "Survey & Questionnaire Tasks",
      desc: "Gathering targeted consumer insights, demographic opinion polls, and market research studies."
    },
    {
      title: "Proof-Based Digital Tasks",
      desc: "Custom marketing workflows requiring specific text confirmation codes, form submissions, or newsletter signups."
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="Crowdsourced Micro-Task Campaigns | SmartExn"
        description="Launch crowdsourced micro-task campaigns on SmartExn. Connect with a global workforce for social engagement, app testing, website testing, and digital tasks."
        canonical="https://smartexn.com/campaigns"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="campaigns" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            {/* Breadcrumb pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">Campaigns</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              Crowdsourced Micro-Task Campaigns with SmartExn
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Scale your online presence, test applications across real devices, and gather authentic digital engagement with thousands of verified independent task workers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-base shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Create a Campaign
              </Link>
              <Link
                to="/advertise"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base transition-all text-center"
              >
                For Advertisers Overview
              </Link>
            </div>
          </div>
        </section>

        {/* Section 1: What Is a Crowdsourced Campaign? */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
              Overview
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              What Is a Crowdsourced Campaign?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              A crowdsourced campaign divides a large digital objective—such as user testing, engagement, or data categorization—into discrete micro-tasks completed by distributed remote workers.
            </p>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              On SmartExn, you specify your exact target actions, provide verification guidelines, and deposit budget into platform escrow. You only pay for approved, verified submissions that satisfy your campaign parameters.
            </p>
          </div>
        </section>

        {/* Section 2: How Campaign Publishing Works */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How Campaign Publishing Works
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Publishing and managing a crowdsourced campaign on SmartExn follows a transparent 4-stage lifecycle.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {campaignSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-3 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <span className="w-10 h-10 rounded-xl bg-sky-600/30 border border-sky-500/40 text-sky-400 font-black text-lg flex items-center justify-center mb-3">
                      {step.num}
                    </span>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3 & 4: Choose Requirements & Set Rewards/Budget */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Choose Your Campaign Requirements
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Provide clear, numbered instructions so workers know exactly what to do. You can restrict tasks to specific device types (Mobile vs Desktop) and define required proof formats (screenshots, URLs, usernames).
              </p>
            </div>

            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Set Task Rewards and Campaign Budget
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Determine the reward amount per successful submission and the total number of worker slots needed. Total campaign budget is securely held in escrow, guaranteeing workers that funds exist before they begin.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5, 6, 7: Execution, Proof Review, & Completion */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="space-y-6">
              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-2">
                <h2 className="text-lg sm:text-xl font-bold text-sky-300">
                  Workers Complete Required Actions
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  When your campaign goes live, workers reserve available slots and execute your instructions. Each worker has a time limit to finish the action and upload proof.
                </p>
              </div>

              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-2">
                <h2 className="text-lg sm:text-xl font-bold text-sky-300">
                  Review Worker Proof
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Submissions appear in your advertiser management area. Review the attached proof against your campaign guidelines. You can approve valid entries with one click or reject non-compliant submissions with specific feedback.
                </p>
              </div>

              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-2">
                <h2 className="text-lg sm:text-xl font-bold text-sky-300">
                  Campaign Completion and Unused Funds
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Once all target slots are completed—or if you choose to pause or close the campaign early—any remaining, unspent escrow funds are immediately returned to your account balance in accordance with our <Link to="/refund-policy" className="underline hover:text-white">Escrow & Refund Policy</Link>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: Campaign Categories */}
        <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Campaign Categories
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              SmartExn supports a versatile range of digital campaigns tailored to modern growth and testing needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3"
              >
                <h3 className="text-lg font-bold text-white">{cat.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{cat.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-sky-950/60 rounded-2xl border border-sky-800/60 text-center text-xs text-sky-200/90 max-w-3xl mx-auto">
            <span className="font-bold text-sky-300">Category Availability:</span> Active task categories and worker volumes fluctuate based on real-time campaign demand and regional distribution.
          </div>
        </section>

        {/* Related Educational Guides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <RelatedGuides guides={relatedCampaignGuides} />
        </div>

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Launch Your First Campaign on SmartExn
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Set your budget, define your tasks, and connect with a verified crowdsourced workforce.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/campaigns', 'advertiser')}
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Create a Campaign
                </Link>
                <Link
                  to="/trust-and-safety"
                  onClick={() => seoAnalytics.trackNavClick('Trust & Safety Details (Campaigns Bottom)', '/trust-and-safety', 'footer')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  Trust & Safety Details
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

export default Campaigns;
