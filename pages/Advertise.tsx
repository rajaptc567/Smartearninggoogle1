import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedAdvertiserGuides: GuideItem[] = [
  {
    title: 'How to Create a Micro-Task Campaign on SmartExn',
    description: 'Step-by-step walkthrough of campaign publishing, task requirements, escrow budget, and proof review.',
    to: '/knowledge-base/how-to-create-a-campaign',
    category: 'Advertisers',
    tag: 'Essential'
  },
  {
    title: 'What Is a Crowdsourced Workforce?',
    description: 'How distributed micro-task workforces power social engagement, QA testing, surveys, and app growth.',
    to: '/knowledge-base/crowdsourced-workforce-guide',
    category: 'Advertisers',
    tag: 'Enterprise'
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
    tag: 'Social Growth'
  },
  {
    title: '100% Upfront Escrow Protection Architecture',
    description: 'How SmartExn guarantees 100% funded campaign escrow, automated review timers, and double-entry settlements.',
    to: '/trust-and-safety/escrow',
    category: 'Trust & Safety',
    tag: 'Escrow'
  },
  {
    title: 'Proof Verification & Perceptual Hashing (pHash)',
    description: 'Learn how automated duplicate detection and manual review ensure authentic campaign deliverables.',
    to: '/trust-and-safety/proof-verification',
    category: 'Trust & Safety',
    tag: 'Verification'
  }
];

const advertiserFaqs = [
  {
    question: "What types of campaigns can businesses run on SmartExn?",
    answer: "Businesses and creators can launch campaigns for social media engagement (follows, likes, shares, comments), mobile application testing and reviews, website feedback, user survey responses, content interaction, and custom digital tasks requiring verified proof."
  },
  {
    question: "How does Campaign Escrow protect my advertising budget?",
    answer: "When you publish a campaign, the total reward budget is held securely in platform escrow. Funds are never disbursed prematurely; they are only released to workers when you review and approve their submitted proof. If you stop or cancel a campaign, 100% of unused escrow slot funds are instantly refunded to your Campaign Wallet."
  },
  {
    question: "What control do I have over worker proof submissions?",
    answer: "You have complete control to inspect submitted evidence, including text inputs, usernames, and high-resolution screenshots. You can approve valid submissions with a single click or reject incomplete work while providing feedback."
  },
  {
    question: "Can I target specific geographic regions or worker criteria?",
    answer: "Yes, you can configure campaign parameters to target specific regions, specify device/platform requirements (desktop, Android, iOS), and set mandatory steps to ensure only qualified workers participate."
  },
  {
    question: "Does SmartExn guarantee specific sales, viral traffic, or organic rankings?",
    answer: "No. SmartExn connects you with participating human workers to perform specific, requested tasks. While workers execute your defined actions, SmartExn does not guarantee algorithmic ranking changes, third-party platform virality, or commercial sales conversion."
  }
];

export const Advertise: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/advertise#webpage",
        "url": "https://smartexn.com/advertise",
        "name": "Hire a Crowdsourced Workforce & Launch Micro-Task Campaigns | SmartExn",
        "description": "Reach an active global task-based workforce with SmartExn. Launch crowdsourced campaigns for social media engagement, app feedback, website testing, and verified digital tasks with 100% escrow protection.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/advertise#breadcrumb",
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
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/advertise#faq",
        "mainEntity": advertiserFaqs.map(item => ({
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

  const campaignCategories = [
    {
      icon: "📱",
      title: "Mobile App Testing & Reviews",
      desc: "Distribute your iOS or Android app to real users to test onboarding, report bugs, and gather valuable early feedback."
    },
    {
      icon: "📣",
      title: "Social Media Engagement",
      desc: "Promote YouTube videos, Twitter/X posts, Telegram groups, and Instagram content through real human interactions."
    },
    {
      icon: "🌐",
      title: "Website Navigation & Testing",
      desc: "Ensure your landing pages, sign-up funnels, and web applications function seamlessly across different browsers and devices."
    },
    {
      icon: "📊",
      title: "Market Research & Surveys",
      desc: "Gather authentic consumer feedback, survey responses, and product sentiment from a diverse international demographic."
    },
    {
      icon: "✍️",
      title: "Content & Community Growth",
      desc: "Stimulate discussion on discussion forums, Discord communities, and blog comment sections with active participants."
    },
    {
      icon: "🔍",
      title: "Data Collection & Verification",
      desc: "Crowdsource search evaluation, business listing checks, image tagging, and light data categorization tasks at scale."
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="Hire a Crowdsourced Workforce & Launch Micro-Task Campaigns | SmartExn"
        description="Reach an active global task-based workforce with SmartExn. Launch crowdsourced campaigns for social media engagement, app feedback, website testing, and verified digital tasks with 100% escrow protection."
        canonical="https://smartexn.com/advertise"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="advertise" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.18),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            
            {/* Breadcrumb pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-xs font-semibold text-blue-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">For Advertisers</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              Hire a Crowdsourced Workforce & <br className="hidden sm:inline" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-300">
                Launch Micro-Task Campaigns
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Launch targeted crowdsourced campaigns for digital engagement, app testing, surveys, and content distribution with 100% campaign escrow safety. You only pay for verified worker proof.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-base shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Create a Campaign
              </Link>
              <Link
                to="/how-it-works"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base transition-all text-center"
              >
                Learn How It Works
              </Link>
            </div>
          </div>
        </section>

        {/* 4 Core Value Pillars */}
        <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Why Businesses & Creators Choose SmartExn
            </h2>
            <p className="text-slate-400 text-sm">
              SmartExn eliminates wasted advertising spend by tying every dollar directly to authentic human execution and verifiable evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-[#0b1f36] border border-sky-500/20 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-2xl font-bold">
                🔒
              </div>
              <h3 className="text-xl font-bold text-white">100% Escrow Guarantee</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Your campaign budget remains locked in platform escrow. Rewards are only deducted when you inspect submitted proofs and approve valid submissions.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#0b1f36] border border-sky-500/20 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl font-bold">
                📸
              </div>
              <h3 className="text-xl font-bold text-white">Mandatory Proof Verification</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Require workers to provide screenshot evidence, usernames, or completion confirmation codes before submissions can enter your review queue.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#0b1f36] border border-sky-500/20 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-white">Instant Unused Slot Refunds</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Need to pause or stop a campaign early? All remaining uncompleted slots are immediately credited back to your Campaign Wallet with zero penalty.
              </p>
            </div>
          </div>
        </section>

        {/* Step-by-Step Campaign Creation Process */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
                Campaign Lifecycle
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How to Launch a Campaign on SmartExn
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Publish your campaign in four simple stages from configuration to verified results.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="p-6 sm:p-8 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center text-sm">1</span>
                  <h3 className="text-lg font-bold text-white">Define Clear Task Instructions</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Provide unambiguous step-by-step instructions. State exactly what link to visit, what action to perform (e.g. subscribe, download, review), and any guidelines workers must follow.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center text-sm">2</span>
                  <h3 className="text-lg font-bold text-white">Set Proof & Verification Fields</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Specify what evidence workers must upload to prove completion. Enable screenshot uploads, require profile handles, or ask for confirmation transaction codes.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center text-sm">3</span>
                  <h3 className="text-lg font-bold text-white">Fund Slots via Campaign Wallet</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Choose your reward per task and set the number of worker slots. The total budget is calculated transparently and held in escrow upon launch.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center text-sm">4</span>
                  <h3 className="text-lg font-bold text-white">Review & Approve Submissions</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  As workers finish, review proofs directly from your campaign dashboard. Approve valid submissions to disburse rewards, or reject non-compliant submissions with clear notes.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Campaign Categories Grid */}
        <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Suitable Campaign Types for Your Goals
            </h2>
            <p className="text-slate-400 text-sm">
              Discover popular crowdsourced task formats that businesses and marketing teams run on SmartExn.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaignCategories.map((cat, idx) => (
              <div
                key={idx}
                className="bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400/50 rounded-2xl p-6 space-y-3 transition-all duration-200 hover:-translate-y-1"
              >
                <div className="text-3xl">{cat.icon}</div>
                <h3 className="text-lg font-bold text-white">{cat.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{cat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Advertising Policy & Escrow Guarantee Box */}
        <section className="py-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 rounded-3xl bg-[#0d233e] border border-sky-500/30 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <h3 className="text-lg font-bold text-white">SmartExn Advertiser Escrow & Refund Policy</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              We believe in complete budget transparency. When you launch a campaign, your funds are dedicated solely to that campaign's worker rewards. You are never billed for rejected non-compliant submissions. If you conclude a campaign before all slots are fulfilled, 100% of remaining unspent escrow funds are immediately returned to your Campaign Wallet.
            </p>
            <div className="pt-2">
              <Link
                to="/refund-policy"
                className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
              >
                <span>Read Full Campaign Escrow & Refund Policy</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Advertiser FAQ Accordion */}
        <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Advertiser Frequently Asked Questions
            </h2>
            <p className="text-slate-400 text-sm">
              Clear answers regarding campaign creation, proof verification, escrow security, and refund handling.
            </p>
          </div>

          <div className="space-y-4">
            {advertiserFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-start justify-between gap-4 font-bold text-white hover:text-sky-400 transition-colors"
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
            <Link to="/campaigns" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Explore Campaign Categories</span>
              <span>→</span>
            </Link>
            <Link to="/refund-policy" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Campaign Escrow & Refund Policy</span>
              <span>→</span>
            </Link>
            <Link to="/trust-and-safety" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Trust & Safety Protocols</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Related Educational Guides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <RelatedGuides guides={relatedAdvertiserGuides} />
        </div>

        {/* Bottom CTA Banner */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Launch Your First Campaign with SmartExn
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Reach thousands of active workers ready to execute your digital tasks with guaranteed escrow security.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/advertise', 'advertiser')}
                  className="px-8 py-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-sm shadow-lg transition-all"
                >
                  Create Advertiser Account
                </Link>
                <Link
                  to="/faqs"
                  onClick={() => seoAnalytics.trackNavClick('Explore Knowledge Base (Advertise Bottom)', '/faqs', 'footer')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  Explore Knowledge Base
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

export default Advertise;
