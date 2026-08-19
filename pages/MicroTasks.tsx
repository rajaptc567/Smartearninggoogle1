import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedMicroTaskGuides: GuideItem[] = [
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
    title: 'Mobile App Testing & Feedback Gigs',
    description: 'Test mobile builds from official stores, verify onboarding, and submit bug feedback.',
    to: '/micro-tasks/app-testing',
    category: 'Workers',
    tag: 'Specialization'
  },
  {
    title: 'Social Media Engagement Micro-Tasks',
    description: 'Requirements for channel follows, video interaction, and valid proof submissions.',
    to: '/micro-tasks/social-media-tasks',
    category: 'Workers',
    tag: 'Social'
  },
  {
    title: 'Escrow Protection & Worker Security',
    description: 'How 100% upfront campaign escrow guarantees payment for every approved submission.',
    to: '/trust-and-safety/escrow',
    category: 'Trust & Safety',
    tag: 'Escrow'
  }
];

const microTasksFaqs = [
  {
    question: "What exactly is an online micro-task?",
    answer: "An online micro-task is a small, specific digital assignment—such as following a social profile, testing a website layout, evaluating a mobile app, or answering a short survey—that can be completed within a few minutes in exchange for a verified monetary reward."
  },
  {
    question: "How do SmartExn micro-task workflows work for earners?",
    answer: "The process follows four simple steps: browse an available task in your dashboard, read the specific instructions provided by the campaign creator, complete the required actions, and submit your verifiable proof before the reservation timer expires. Once verified, rewards credit to your earnings balance."
  },
  {
    question: "What types of proof might I need to submit?",
    answer: "Proof requirements vary by campaign. Common proofs include clear full-screen screenshots showing timestamps, exact profile usernames/handles, verification URLs, or transaction/reference IDs. Always follow the campaign's exact proof instructions."
  },
  {
    question: "Why might a campaign creator reject my task submission?",
    answer: "Common rejection reasons include incomplete actions, blurry or invalid screenshots, mismatched usernames, missing required answers, submitting duplicate proofs, or failing to follow specific instructions. You can dispute unfair rejections through our two-tier arbitration process."
  },
  {
    question: "How do rewards work, and is income guaranteed?",
    answer: "Rewards vary by task and campaign based on complexity and creator budgets. SmartExn does not guarantee fixed hourly income or guaranteed earnings. Work is compensated per approved task."
  },
  {
    question: "What equipment do I need to start completing tasks?",
    answer: "You only need a smartphone, tablet, or computer with an active internet connection, basic digital literacy, and the ability to follow instructions carefully. Registration is completely free."
  }
];

export const MicroTasks: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/micro-tasks#webpage",
        "url": "https://smartexn.com/micro-tasks",
        "name": "Online Micro-Tasks & Gigs — Complete Simple Tasks | SmartExn",
        "description": "Discover online micro-tasks, digital gigs, app testing, social tasks and research opportunities on SmartExn. Complete campaign requirements and submit valid proof for review.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/micro-tasks#breadcrumb",
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
            "name": "Online Micro-Tasks",
            "item": "https://smartexn.com/micro-tasks"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/micro-tasks#faq",
        "mainEntity": microTasksFaqs.map(item => ({
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

  const fourSteps = [
    {
      num: "1",
      title: "Browse an Available Task",
      desc: "Log in to your workspace and select tasks that match your device, country, and interests from the live catalog."
    },
    {
      num: "2",
      title: "Read Task Requirements",
      desc: "Carefully review all step-by-step instructions, link targets, and requested proof formats before beginning."
    },
    {
      num: "3",
      title: "Complete the Required Action",
      desc: "Perform the designated digital action accurately—such as following a channel, testing an app, or visiting a page."
    },
    {
      num: "4",
      title: "Submit Valid Proof for Review",
      desc: "Upload clean screenshots and input required handles or codes to submit your work before the slot timer expires."
    }
  ];

  const taskCategories = [
    {
      icon: "👍",
      title: "Social Media Engagement",
      desc: "Follow verified creators on YouTube, TikTok, Instagram, Twitter/X, and join community channels."
    },
    {
      icon: "🌐",
      title: "Website Visits & Navigation",
      desc: "Explore newly launched websites, test usability, check page loading, and verify navigation menus."
    },
    {
      icon: "📱",
      title: "App Testing & Feedback",
      desc: "Download mobile applications, test onboarding experiences, and provide constructive usability feedback."
    },
    {
      icon: "🔍",
      title: "Search & Research Tasks",
      desc: "Find specific information online, check directory listings, or perform keyword discovery searches."
    },
    {
      icon: "💬",
      title: "Content Interaction",
      desc: "Watch informative video clips, leave genuine comments on articles, and share public campaign posts."
    },
    {
      icon: "🏷️",
      title: "Data Verification & Tagging",
      desc: "Categorize image assets, verify public contact details, and audit simple digital data records."
    },
    {
      icon: "📑",
      title: "Proof-Based Digital Tasks",
      desc: "Complete customized advertiser campaigns requiring specific verification questions or form confirmations."
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="Online Micro-Tasks & Gigs — Complete Simple Tasks | SmartExn"
        description="Discover online micro-tasks, digital gigs, app testing, social tasks and research opportunities on SmartExn. Complete campaign requirements and submit valid proof for review."
        canonical="https://smartexn.com/micro-tasks"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="micro-tasks" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            
            {/* Breadcrumb pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">Online Micro-Tasks</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              Online Micro-Tasks & Gigs — <br className="hidden sm:inline" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-300 to-amber-300">
                Complete Simple Tasks on SmartExn
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Discover legitimate crowdsourced micro-tasks and digital gigs you can complete from home or on your mobile device. Submit valid proof of work and receive verified rewards with platform escrow security.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                Start Completing Tasks Free
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

        {/* Section 1: What Are Online Micro-Tasks? */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
              Overview
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              What Are Online Micro-Tasks?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Online micro-tasks are discrete, bite-sized digital activities that can be completed in a few minutes using a smartphone or computer. These tasks help creators, mobile app publishers, and businesses gain authentic feedback, improve search visibility, and test user experiences across diverse devices.
            </p>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Instead of long-term contracts, micro-tasks allow you to work flexibly at your own pace. You choose which campaigns to participate in, execute the step-by-step instructions, upload verification evidence, and earn rewards upon proof approval.
            </p>
          </div>
        </section>

        {/* Section 2: How SmartExn Micro-Tasks Work (4-Step Workflow) */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
                Simple Execution
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How SmartExn Micro-Tasks Work
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Completing tasks on SmartExn follows a transparent four-step sequence from discovery to verified payout.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {fourSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400/50 rounded-2xl p-6 space-y-3 transition-all duration-200 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-sky-600/30 border border-sky-500/40 text-sky-400 font-black text-lg flex items-center justify-center mb-3">
                      {step.num}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{step.desc}</p>
                  </div>
                  <span className="text-[11px] text-sky-400 font-semibold pt-2">Step {step.num} of 4</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Types of Micro-Tasks */}
        <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Types of Micro-Tasks
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              SmartExn supports a broad variety of digital gigs across social networks, mobile apps, and web services.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {taskCategories.map((cat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400/40 space-y-3 transition-all"
              >
                <span className="text-2xl p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 inline-block">{cat.icon}</span>
                <h3 className="text-lg font-bold text-white pt-1">{cat.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{cat.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-sky-950/60 rounded-2xl border border-sky-800/60 text-center text-xs text-sky-200/90 max-w-3xl mx-auto">
            <span className="font-bold text-sky-300">Availability Note:</span> Available tasks depend on active campaigns and advertiser requirements. Task categories and volumes fluctuate based on real-time advertiser budgets and regional criteria.
          </div>
        </section>

        {/* Section 4: How Task Proof Works */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How Task Proof Works
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                To guarantee fairness and prevent fraud, campaign creators define specific proof criteria. When you complete a task, you will be prompted to provide verifiable evidence before submitting your slot.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">📸</span>
                <h3 className="font-bold text-white text-base">Full Screenshots</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Uncropped screenshots showing channel subscriptions, likes, confirmation screens, and device timestamps.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">👤</span>
                <h3 className="font-bold text-white text-base">Usernames & Handles</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Your exact social media username, handle, or registered email used to perform the requested action.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">🔗</span>
                <h3 className="font-bold text-white text-base">Verification URLs</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Direct links to published comments, shared social posts, or review profiles where work is publicly visible.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">🔢</span>
                <h3 className="font-bold text-white text-base">Reference IDs & Answers</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Survey completion codes, transaction reference IDs, or specific text answers requested by the creator.</p>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 max-w-2xl mx-auto">
              Proof requirements vary by campaign. Always review the creator's requested proof fields before beginning your task.
            </p>
          </div>
        </section>

        {/* Section 5: Why Tasks Can Be Rejected */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-4 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Why Tasks Can Be Rejected
            </h2>
            <p className="text-slate-400 text-sm">
              Understanding common rejection causes helps you maintain a high approval rating and earn rewards consistently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span> Incomplete Action or Missing Steps
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Skipping required steps—such as not watching a required video duration or un-subscribing immediately—violates campaign terms.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span> Blurry or Invalid Screenshots
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Submitting cropped images, incorrect screenshots, or low-resolution files that do not clearly show the completed action.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span> Incorrect Username or Handle
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Entering a profile name that does not match the account that performed the action on the external platform.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span> Duplicate Submissions
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Attempting to submit the same proof multiple times or using multiple accounts for single-slot campaigns.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2 md:col-span-2">
              <h3 className="font-bold text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span> Suspicious or Fraudulent Activity
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Using automated bots, fake screenshot generators, or unauthorized proxy services. SmartExn strictly prohibits fraudulent submissions to protect our community.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              to="/how-it-works"
              className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
            >
              <span>Learn How to Dispute an Unfair Rejection</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Section 6: How Rewards Work & Disclaimer */}
        <section className="py-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200/90 text-xs sm:text-sm leading-relaxed space-y-3">
            <h2 className="text-lg font-bold text-amber-300">
              How Rewards Work
            </h2>
            <p>
              Rewards vary by task and campaign. SmartExn does not guarantee fixed hourly income or guaranteed earnings. Every task displays its exact reward amount and requirements before you choose to accept it. Once your submitted proof is reviewed and approved by the campaign creator (or verified by automated timeout), the specified reward is credited directly to your Task Earnings balance.
            </p>
            <p className="text-xs text-amber-300/80">
              Task earnings can be withdrawn to supported payout methods subject to platform verification and minimum withdrawal thresholds. See our <Link to="/terms-of-use" className="underline hover:text-white">Terms of Use</Link> and <Link to="/refund-policy" className="underline hover:text-white">Escrow Policy</Link> for complete details.
            </p>
          </div>
        </section>

        {/* Section 7: Frequently Asked Questions */}
        <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 text-sm">
              Answers to common inquiries about completing micro-tasks, submitting proof, and getting paid.
            </p>
          </div>

          <div className="space-y-4">
            {microTasksFaqs.map((faq, idx) => {
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
            <Link to="/task-proof" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Task Proof Guide</span>
              <span>→</span>
            </Link>
            <Link to="/how-it-works-for-workers" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Worker Workflow Guide</span>
              <span>→</span>
            </Link>
            <Link to="/paid-surveys" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Explore Paid Surveys</span>
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
          <RelatedGuides guides={relatedMicroTaskGuides} />
        </div>

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Ready to Start Completing Tasks?
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Join our international community of earners and complete simple micro-tasks for verified rewards.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/micro-tasks', 'worker')}
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/advertise"
                  onClick={() => seoAnalytics.trackAdvertiserCtaClick('For Advertisers', '/micro-tasks')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  For Advertisers
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

export default MicroTasks;
