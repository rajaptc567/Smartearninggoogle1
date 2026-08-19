import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedWorkerGuides: GuideItem[] = [
  {
    title: 'How to Complete Micro-Tasks Successfully',
    description: 'Learn step-by-step instructions on discovering gigs, capturing valid proof, and earning verified rewards.',
    to: '/knowledge-base/how-to-complete-micro-tasks',
    category: 'Workers',
    tag: 'Essential'
  },
  {
    title: 'Visual Task Proof Guide & Examples',
    description: 'Guidelines on uncropped screenshot formats, profile usernames, and avoiding proof rejections.',
    to: '/task-proof',
    category: 'Workers',
    tag: 'Proof Guide'
  },
  {
    title: 'How to Avoid Micro-Task Rejections',
    description: 'Top reasons why task submissions get rejected and how to maintain a 95%+ approval rating.',
    to: '/workers/how-to-avoid-task-rejection',
    category: 'Workers',
    tag: 'Quality'
  },
  {
    title: 'How to Discover & Filter Online Micro-Tasks',
    description: 'Finding high-converting tasks, matching device capabilities, and monitoring fresh campaign postings.',
    to: '/workers/how-to-find-tasks',
    category: 'Workers',
    tag: 'Discovery'
  },
  {
    title: 'Worker Account Security & Multi-Accounting Policy',
    description: 'Maintain healthy standing, device integrity, and prevent account flags under SmartExn rules.',
    to: '/workers/account-security',
    category: 'Workers',
    tag: 'Security'
  },
  {
    title: 'Two-Tier Dispute Resolution System',
    description: 'Direct creator negotiation and impartial admin arbitration workflows for rejected proof claims.',
    to: '/trust-and-safety/disputes',
    category: 'Trust & Safety',
    tag: 'Disputes'
  }
];

const workerFaqs = [
  {
    question: "How do I start completing tasks on SmartExn?",
    answer: "Create a free worker account, navigate to the available tasks catalog in your member area, select a campaign that matches your country and device, read the requirements carefully, complete the requested actions, and upload the required proof before the timer expires."
  },
  {
    question: "How are task proofs verified and when do I get paid?",
    answer: "The campaign creator reviews your submission against their instructions within their designated review window (typically 24–72 hours). Once verified and approved, reward funds are instantly released from platform escrow into your Task Earnings wallet."
  },
  {
    question: "What happens if a creator rejects my submission unfairly?",
    answer: "SmartExn provides a two-tier dispute resolution desk. You can initiate a Level-1 direct dispute with the creator with additional proof. If unresolved, you can escalate to Level-2 admin arbitration for impartial evidence review."
  },
  {
    question: "Are income or task availability guaranteed?",
    answer: "No. Task availability and reward amounts depend entirely on active advertiser campaigns, target demographics, and submission accuracy. SmartExn does not promise fixed hourly income or guaranteed employment."
  },
  {
    question: "What happens if my slot reservation timer expires?",
    answer: "When you start a task, a reservation slot is held for you. If you do not submit valid proof before the timer runs out, the slot automatically releases back to the general pool for other workers to claim."
  }
];

export const HowItWorksForWorkers: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/how-it-works-for-workers#webpage",
        "url": "https://smartexn.com/how-it-works-for-workers",
        "name": "How SmartExn Works for Workers | Tasks, Proof & Rewards",
        "description": "Comprehensive guide for task workers on SmartExn. Learn how to discover available micro-tasks, follow instructions, submit verifiable proof, and receive escrow rewards.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/how-it-works-for-workers#breadcrumb",
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
            "name": "How It Works for Workers",
            "item": "https://smartexn.com/how-it-works-for-workers"
          }
        ]
      },
      {
        "@type": "HowTo",
        "@id": "https://smartexn.com/how-it-works-for-workers#howto",
        "name": "How to Complete Tasks on SmartExn as a Worker",
        "description": "5-step workflow for discovering tasks, reading instructions, executing tasks, submitting proof, and receiving approved escrow rewards.",
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Find Available Tasks",
            "text": "Browse active crowdsourced campaigns and filter by category, difficulty, platform, or reward amount."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "Read Task Requirements",
            "text": "Inspect the creator's instructions, required links, target actions, and exact proof criteria."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "Complete the Task Correctly",
            "text": "Perform the digital actions accurately on the external platform."
          },
          {
            "@type": "HowToStep",
            "position": 4,
            "name": "Submit Verifiable Proof",
            "text": "Upload clean uncropped screenshots, handles, or confirmation codes through the task portal."
          },
          {
            "@type": "HowToStep",
            "position": 5,
            "name": "Creator Reviews Submission",
            "text": "The advertiser inspects proof and upon approval, escrow funds release directly to your earnings balance."
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/how-it-works-for-workers#faq",
        "mainEntity": workerFaqs.map(item => ({
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

  const stepsList = [
    {
      num: "01",
      title: "Find Available Tasks",
      desc: "Log in to your member workspace to browse active crowdsourced campaigns. Filter by category, difficulty, platform, or reward amount."
    },
    {
      num: "02",
      title: "Read Task Requirements",
      desc: "Carefully inspect the creator's instructions, required links, target actions, and exact proof criteria before starting the timer."
    },
    {
      num: "03",
      title: "Complete the Task Correctly",
      desc: "Perform the digital actions accurately on the external platform—such as testing a feature, following a profile, or completing a questionnaire."
    },
    {
      num: "04",
      title: "Submit Verifiable Proof",
      desc: "Upload clean uncropped screenshots, handles, or confirmation codes through the task portal before the reservation timer expires."
    },
    {
      num: "05",
      title: "Creator Reviews Submission",
      desc: "The advertiser inspects your proof for compliance. When approved (or upon automated timeout), escrow funds release directly to your earnings balance."
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="How SmartExn Works for Workers | Tasks, Proof & Rewards"
        description="Comprehensive guide for task workers on SmartExn. Learn how to discover available micro-tasks, follow instructions, submit verifiable proof, and receive escrow rewards."
        canonical="https://smartexn.com/how-it-works-for-workers"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="how-it-works-for-workers" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            
            {/* Breadcrumb pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
              <span>/</span>
              <span className="text-slate-200">For Workers</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              How SmartExn Works for Workers
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              A comprehensive guide to finding legitimate micro-tasks, understanding creator instructions, capturing acceptable proof, and earning verified rewards safely with escrow protection.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Create Free Worker Account
              </Link>
              <Link
                to="/task-proof"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base transition-all text-center"
              >
                Read Task Proof Guide
              </Link>
            </div>
          </div>
        </section>

        {/* Section 1: What Is SmartExn? */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
              Worker Introduction
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              What Is SmartExn?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              SmartExn is a transparent crowdsourcing platform connecting remote workers with digital advertisers, content creators, and businesses. As a worker, you have access to a live marketplace of micro-tasks—including social media engagement, app feedback, website visits, and surveys.
            </p>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Unlike unverified freelance platforms, every campaign on SmartExn is backed by 100% upfront escrow funding. This ensures that the budget required to pay your reward is locked before you begin work.
            </p>
          </div>
        </section>

        {/* Section 2: How Workers Find Available Tasks */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How Workers Find Available Tasks
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Once logged in to your member workspace, tasks are categorized and filterable to match your device and preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">📱</span>
                <h3 className="font-bold text-white text-base">Device Compatibility</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">Filter tasks by Mobile (Android / iOS) or Desktop depending on which device you are actively using.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">🏷️</span>
                <h3 className="font-bold text-white text-base">Task Categories</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">Select from social media follows, app testing, website navigation, surveys, or data verification tasks.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">⏱️</span>
                <h3 className="font-bold text-white text-base">Slot Availability & Timers</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">View real-time remaining slots, allocated completion windows, and verified reward payouts per task.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: How to Read Task Requirements */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              Accuracy & Instructions
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              How to Read Task Requirements
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Every campaign is created by an advertiser with explicit criteria. Before you click start, review the task details page carefully:
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                <span className="text-sky-400 font-bold">1.</span>
                <div>
                  <h3 className="font-bold text-white text-sm">Campaign Target Link</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Verify where the task takes place (e.g. YouTube video URL, Google Play Store app link, or registration page).</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                <span className="text-sky-400 font-bold">2.</span>
                <div>
                  <h3 className="font-bold text-white text-sm">Action Instructions</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Identify exactly what must be done (e.g. watch 2 minutes, subscribe to channel, or reach level 5 in an app).</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                <span className="text-sky-400 font-bold">3.</span>
                <div>
                  <h3 className="font-bold text-white text-sm">Required Proof Fields</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Check whether the creator requests screenshot uploads, profile usernames, completion codes, or direct URLs.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 & 5: How to Complete a Task & How to Submit Proof */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How to Complete a Task Correctly & Submit Proof
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Follow this sequential path to ensure 100% proof acceptance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stepsList.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-3 flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <span className="text-xs font-black font-mono text-amber-400 uppercase tracking-widest block mb-2">
                      Phase {step.num}
                    </span>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center pt-4">
              <Link
                to="/task-proof"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40 text-sm font-bold transition-all"
              >
                <span>Read Full Task Proof Submission Guide</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Section 6 & 7: How Proof Is Reviewed & When Rewards Become Available */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-xl font-bold">
                🔍
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                How Proof Is Reviewed
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                When you submit proof, it enters the campaign creator's review dashboard. Advertisers inspect the submitted images, usernames, or completion IDs against their external records.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Most campaigns have an automated verification window (e.g. 48–72 hours). If a creator does not review your submission before this window closes, the platform auto-approves your submission.
              </p>
            </div>

            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold">
                💰
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                When Rewards Become Available
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                The instant your submission is approved, funds held in campaign escrow are transferred directly into your Task Earnings balance.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                You can withdraw your accumulated task earnings through supported payment methods once you reach the platform minimum withdrawal threshold.
              </p>
            </div>
          </div>
        </section>

        {/* Section 8: Why a Task Submission May Be Rejected */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Why a Task Submission May Be Rejected
              </h2>
              <p className="text-slate-400 text-sm">
                Advertisers have the right to reject proofs that do not meet mandatory campaign requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
                <h3 className="font-bold text-red-400 text-sm">Incomplete Action</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Failing to finish all steps (e.g. downloading an app but not completing the tutorial).</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
                <h3 className="font-bold text-red-400 text-sm">Mismatched Username</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Submitting a handle that differs from the account that liked or subscribed.</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
                <h3 className="font-bold text-red-400 text-sm">Blurry / Cropped Proof</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Uploading low-resolution screenshots where timestamps or action buttons are obscured.</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
                <h3 className="font-bold text-red-400 text-sm">Duplicate Submissions</h3>
                <p className="text-slate-300 text-xs leading-relaxed">Attempting to upload previously used screenshots for new campaign slots.</p>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link
                to="/trust-and-safety"
                className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
              >
                <span>Learn How Dispute Resolution Protects You</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Section 9: Tips for Completing Tasks Successfully */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
              <span>💡</span> Tips for Completing Tasks Successfully
            </h2>
            <ul className="space-y-4 text-slate-300 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Read all instructions first:</strong> Never assume task steps based on previous campaigns; each creator has distinct criteria.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Take clear, unedited screenshots:</strong> Include the entire mobile or browser screen showing timestamps and user avatars.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Submit before the timer runs out:</strong> Once a slot expires, your unsubmitted work cannot be approved.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Keep honest records:</strong> Use genuine personal profiles to complete tasks to avoid fraud disqualification.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Earning Disclaimer */}
        <section className="py-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200/90 text-xs sm:text-sm leading-relaxed space-y-2">
            <h3 className="font-bold text-amber-300 text-base">Responsible Earnings Disclosure</h3>
            <p>
              Earnings vary depending on task availability, worker accuracy, campaign requirements, and advertiser verification. SmartExn does not promise fixed hourly income, employment, or guaranteed earnings. All tasks are completed on an independent, per-task basis.
            </p>
          </div>
        </section>

        {/* Section 10: Frequently Asked Questions */}
        <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 text-sm">
              Common questions from workers about completing tasks and receiving rewards.
            </p>
          </div>

          <div className="space-y-4">
            {workerFaqs.map((faq, idx) => {
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
            <Link to="/micro-tasks" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Explore Micro-Tasks</span>
              <span>→</span>
            </Link>
            <Link to="/paid-surveys" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Explore Paid Surveys</span>
              <span>→</span>
            </Link>
            <Link to="/faqs" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>View All FAQs</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Related Educational Guides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <RelatedGuides guides={relatedWorkerGuides} />
        </div>

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Start Completing Tasks Today
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Join our verified crowdsourced community and complete tasks with 100% escrow protection.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/how-it-works-for-workers', 'worker')}
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Create Free Worker Account
                </Link>
                <Link
                  to="/how-it-works"
                  onClick={() => seoAnalytics.trackWorkerCtaClick('General How It Works (Workers Bottom)', '/how-it-works-for-workers')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  General How It Works
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

export default HowItWorksForWorkers;
