import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedHowItWorksGuides: GuideItem[] = [
  {
    title: 'How It Works for Workers: Complete Guide',
    description: 'Detailed walkthrough of discovering tasks, fulfilling instructions, capturing proof, and wallet crediting.',
    to: '/how-it-works-for-workers',
    category: 'Workers',
    tag: 'Worker Guide'
  },
  {
    title: 'How to Create a Micro-Task Campaign',
    description: 'Step-by-step walkthrough of campaign publishing, task requirements, escrow budget, and proof review.',
    to: '/knowledge-base/how-to-create-a-campaign',
    category: 'Advertisers',
    tag: 'Advertiser Setup'
  },
  {
    title: 'Visual Task Proof Guide & Examples',
    description: 'Guidelines on uncropped screenshot formats, profile usernames, and avoiding proof rejections.',
    to: '/task-proof',
    category: 'Workers',
    tag: 'Proof Criteria'
  },
  {
    title: '100% Upfront Escrow Protection Architecture',
    description: 'How SmartExn guarantees 100% funded campaign escrow, automated review timers, and double-entry settlements.',
    to: '/trust-and-safety/escrow',
    category: 'Trust & Safety',
    tag: 'Escrow'
  },
  {
    title: 'Two-Tier Dispute Resolution System',
    description: 'Direct creator negotiation and impartial admin arbitration workflows for rejected proof claims.',
    to: '/trust-and-safety/disputes',
    category: 'Arbitration',
    tag: 'Disputes'
  },
  {
    title: 'SmartExn Knowledge Base & Search Directory',
    description: 'Browse all educational articles, verification criteria, and optimization strategies.',
    to: '/knowledge-base',
    category: 'Knowledge Base',
    tag: 'Documentation'
  }
];

const howItWorksFaqs = [
  {
    question: "How do I start earning money with micro-tasks on SmartExn?",
    answer: "Create a free SmartExn account, navigate to the available tasks catalog, select a task that matches your preferences, read the instructions carefully, complete the requested actions, and upload the specified proof. Once the campaign creator verifies your proof, rewards are credited to your earnings wallet."
  },
  {
    question: "What types of proof are required when submitting a completed task?",
    answer: "Required proof depends on the campaign instructions defined by the creator. Common proofs include screenshots confirming completion (such as followed channels, app installs, or survey completion screens), profile usernames, or verification transaction codes."
  },
  {
    question: "How does SmartExn protect workers if a creator rejects valid proof?",
    answer: "SmartExn features a structured two-tier dispute protection system. If your proof is rejected, you can open a Level-1 direct dispute with the creator providing additional context. If unresolved, you can escalate to Level-2 admin arbitration, where our team reviews submitted evidence impartially."
  },
  {
    question: "How does Campaign Escrow work for advertisers?",
    answer: "When an advertiser posts a campaign, the total budget for all requested worker slots is held safely in escrow. Escrow funds are only released to workers as their submitted proofs are verified and approved. If a campaign is cancelled early, any remaining unspent escrow funds are immediately refunded to the advertiser's Campaign Wallet."
  },
  {
    question: "Are income or earnings guaranteed on SmartExn?",
    answer: "No. Task availability, complexity, and reward amounts vary based on active advertiser demand, geographic qualifications, and submission accuracy. SmartExn is a task execution marketplace and does not guarantee fixed hourly income."
  }
];

export const HowItWorks: React.FC = () => {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/how-it-works#webpage",
        "url": "https://smartexn.com/how-it-works",
        "name": "How SmartExn Works — Complete Tasks, Submit Proof & Earn Rewards",
        "description": "Step-by-step guide to completing online micro-tasks, surveys, and crowdsourced campaigns with verified escrow safety on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/how-it-works#breadcrumb",
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
            "name": "How It Works",
            "item": "https://smartexn.com/how-it-works"
          }
        ]
      },
      {
        "@type": "HowTo",
        "@id": "https://smartexn.com/how-it-works#howto",
        "name": "How to Complete Online Micro-Tasks on SmartExn",
        "description": "The 6-step lifecycle for discovering micro-tasks, following requirements, submitting proof, and receiving approved escrow rewards.",
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Choose a Task",
            "text": "Log in to your member workspace and browse the live task catalog. Filter by category, difficulty, platform, or reward amount to find tasks matching your device and skills."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "Read Requirements",
            "text": "Review required links, target actions, and mandatory proof criteria provided by the campaign creator before beginning work."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "Complete the Task",
            "text": "Execute the task precisely as outlined—such as following a social handle, testing an application feature, or completing an opinion survey."
          },
          {
            "@type": "HowToStep",
            "position": 4,
            "name": "Submit Proof",
            "text": "Capture clear screenshots, enter your handle or completion ID, and submit your proof package through the secure task portal."
          },
          {
            "@type": "HowToStep",
            "position": 5,
            "name": "Proof Review",
            "text": "The campaign creator reviews your submission within their designated verification window (typically 24–72 hours)."
          },
          {
            "@type": "HowToStep",
            "position": 6,
            "name": "Receive Reward When Approved",
            "text": "Upon approval (or automated timeout), funds are credited from campaign escrow directly into your Task Earnings wallet balance."
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/how-it-works#faq",
        "mainEntity": howItWorksFaqs.map(item => ({
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

  const steps = [
    {
      stepNumber: "01",
      title: "Choose a Task",
      desc: "Log in to your member workspace and browse the live task catalog. Filter by category, difficulty, platform, or reward amount to find tasks matching your device and skills."
    },
    {
      stepNumber: "02",
      title: "Read Requirements",
      desc: "Every campaign includes explicit requirements provided by the creator. Review required links, target actions, and mandatory proof criteria before beginning work."
    },
    {
      stepNumber: "03",
      title: "Complete the Task",
      desc: "Execute the task precisely as outlined—such as following a creator's social handle, testing an application feature, or completing an opinion survey questionnaire."
    },
    {
      stepNumber: "04",
      title: "Submit Proof",
      desc: "Capture clear screenshots, enter your handle or completion ID, and submit your proof package through the secure task submission portal before the timer expires."
    },
    {
      stepNumber: "05",
      title: "Proof Review",
      desc: "The campaign creator reviews your submission within their designated verification window (typically 24–72 hours) to verify compliance with task rules."
    },
    {
      stepNumber: "06",
      title: "Receive Reward When Approved",
      desc: "Upon creator approval (or automated platform timeout), funds are instantly credited from campaign escrow directly into your Task Earnings wallet balance."
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="How SmartExn Works — Complete Tasks, Submit Proof & Earn Rewards"
        description="Learn how SmartExn micro-tasks and crowdsourced campaigns work. Step-by-step guide for earners to find tasks, submit proof, and receive verified escrow rewards."
        canonical="https://smartexn.com/how-it-works"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="how-it-works" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            
            {/* Breadcrumb pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">How It Works</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              How SmartExn Works — <br className="hidden sm:inline" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-300 to-amber-300">
                Complete Tasks, Submit Proof & Earn Rewards
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              SmartExn is a transparent crowdsourcing ecosystem connecting task workers with verified business campaigns. Discover the simple 6-step lifecycle from task discovery to escrow payouts.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Start Earning Today
              </Link>
              <Link
                to="/advertise"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base transition-all text-center"
              >
                Post a Campaign for Workers
              </Link>
            </div>
          </div>
        </section>

        {/* What is SmartExn Overview */}
        <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="bg-gradient-to-br from-[#0c223c] to-[#08182b] rounded-3xl p-8 sm:p-12 border border-sky-500/20 shadow-xl space-y-6">
            <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
              Platform Architecture
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              What is SmartExn?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              SmartExn is an international online marketplace designed to facilitate rapid, proof-verified micro-tasks and crowdsourced engagement. Workers from across the globe log in to complete digital activities, while creators and companies publish campaigns with locked escrow budgets to ensure fair compensation and authentic results.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-sky-900/40 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-xl font-bold">✓</div>
                <h3 className="font-bold text-white text-base">Verified Proof Model</h3>
                <p className="text-slate-400 text-sm">Every completed action requires clear evidence such as screenshots or completion handles before rewards are disbursed.</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-sky-900/40 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">🔒</div>
                <h3 className="font-bold text-white text-base">100% Campaign Escrow</h3>
                <p className="text-slate-400 text-sm">Campaign budgets are locked at launch. Workers know rewards exist, and advertisers only pay for valid work.</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/60 border border-sky-900/40 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold">⚖️</div>
                <h3 className="font-bold text-white text-base">Two-Stage Dispute Desk</h3>
                <p className="text-slate-400 text-sm">Disagreements are resolved fairly through direct Level-1 creator negotiation and neutral Level-2 admin arbitration.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6-Step Worker Workflow */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How Workers Earn: The 6-Step Process
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Follow this straightforward sequence to select tasks, complete requirements, and collect approved rewards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {steps.map((item, idx) => (
                <div 
                  key={idx} 
                  className="bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400/50 rounded-2xl p-6 space-y-4 transition-all duration-200 hover:-translate-y-1 shadow-lg shadow-sky-950/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-amber-400 font-mono tracking-tighter">
                      {item.stepNumber}
                    </span>
                    <span className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400 text-xs font-bold">
                      Step
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Disputes & Rejections Section */}
        <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            <div className="space-y-6">
              <div className="inline-block px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                Fairness & Protection
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                What Happens If a Submission Is Rejected?
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Creators may reject a submission if instructions were not followed, proof was blurry, or information was missing. However, workers are never left without recourse.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <h3 className="font-bold text-sky-300 text-sm">1. Level-1 Creator Dispute</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    You can open a Level-1 dispute directly from your submission history, providing supplementary screenshots or clarifying proof details for the creator to reconsider.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <h3 className="font-bold text-amber-300 text-sm">2. Level-2 Admin Arbitration</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    If the creator rejects your dispute unfairly, you can escalate the case to the SmartExn administrative arbitration desk for independent evidence review and final resolution.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-6 shadow-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💡</span> Tips for 100% Task Approval
              </h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>Read completely:</strong> Read all instructions thoroughly before clicking on campaign links.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>High-resolution screenshots:</strong> Ensure proof images clearly show dates, usernames, and action confirmation.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>Accurate details:</strong> Enter exact profile handles or email addresses used to execute the task.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span><strong>Submit on time:</strong> Complete the work and upload your proof within the allocated reservation timer.</span>
                </li>
              </ul>

              <div className="pt-2">
                <Link
                  to="/micro-tasks"
                  className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
                >
                  <span>Explore Online Micro-Task Categories</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* Advertiser Workflow Section */}
        <section id="advertiser-workflow" className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
                For Businesses & Creators
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How Advertisers Launch Campaigns
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                SmartExn gives businesses, brands, and content creators immediate access to an active global workforce for verifiable digital execution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Stage 1</span>
                <h3 className="text-base font-bold text-white">Create & Configure</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Specify step-by-step instructions, target worker requirements, and required proof inputs (text and screenshots).</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Stage 2</span>
                <h3 className="text-base font-bold text-white">Fund via Escrow</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Deposit the required reward budget. All campaign funds are locked in platform escrow until proofs are approved.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Stage 3</span>
                <h3 className="text-base font-bold text-white">Review Proofs</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Inspect worker evidence in real time. Approve accurate work with one click or reject invalid submissions with feedback.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Stage 4</span>
                <h3 className="text-base font-bold text-white">Instant Refunds</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Cancel or stop campaigns at any time. Any unused escrow slots are immediately refunded to your Campaign Wallet.</p>
              </div>
            </div>

            <div className="text-center pt-4">
              <Link
                to="/advertise"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md transition-all"
              >
                <span>Learn More About Advertising on SmartExn</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Earning Disclaimer Callout */}
        <section className="py-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200/90 text-xs sm:text-sm leading-relaxed space-y-2">
            <h3 className="font-bold text-amber-300 text-base">Important Earnings & Participation Disclaimer</h3>
            <p>
              Earnings on SmartExn vary depending on task availability, worker accuracy, campaign requirements, geographic location, and advertiser proof verification. SmartExn provides a crowdsourced task execution platform and does not offer guaranteed income, employment contracts, or fixed hourly earnings. Users should carefully review campaign rules before starting work.
            </p>
          </div>
        </section>

        {/* FAQ Accordion Section */}
        <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Frequently Asked Questions About SmartExn
            </h2>
            <p className="text-slate-400 text-sm">
              Quick answers to common questions about earning rewards, submitting proofs, and launching campaigns.
            </p>
          </div>

          <div className="space-y-4">
            {howItWorksFaqs.map((faq, idx) => {
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
            <Link
              to="/how-it-works-for-workers"
              className="font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
            >
              <span>Worker Workflow Guide</span>
              <span>→</span>
            </Link>
            <Link
              to="/campaigns"
              className="font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
            >
              <span>Campaign System Guide</span>
              <span>→</span>
            </Link>
            <Link
              to="/task-proof"
              className="font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
            >
              <span>Task Proof Guidelines</span>
              <span>→</span>
            </Link>
            <Link
              to="/trust-and-safety"
              className="font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
            >
              <span>Trust & Safety Hub</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Related Educational Guides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <RelatedGuides guides={relatedHowItWorksGuides} />
        </div>

        {/* Bottom Conversion CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Ready to Experience Verified Task Rewards?
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Join thousands of global members completing micro-tasks or launch your first crowdsourced campaign in minutes.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/how-it-works', 'worker')}
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Create Free Worker Account
                </Link>
                <Link
                  to="/advertise"
                  onClick={() => seoAnalytics.trackAdvertiserCtaClick('Advertise Your Business (How It Works Bottom)', '/how-it-works')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  Advertise Your Business
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

export default HowItWorks;
