import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const HowToFindTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How do I find new micro-tasks on SmartExn?',
      a: 'Log into your SmartExn dashboard and open the Micro-Tasks directory. You can filter active campaigns by category (such as Social Media, App Testing, Surveys, or Research) and sort by reward or completion time.'
    },
    {
      q: 'Why are some tasks marked as "0 Slots Available"?',
      a: 'Advertisers fund campaigns with a fixed budget representing a specific number of completions. When all slots are reserved by active workers, the task enters a completed or pending review state until the advertiser adds more budget.'
    },
    {
      q: 'What is a slot reservation timer?',
      a: 'When you click "Start Task", SmartExn temporarily locks a slot for you for a set time (e.g. 15 to 30 minutes). This guarantees that your slot cannot be taken by someone else while you complete the action.'
    },
    {
      q: 'Are new tasks added daily?',
      a: 'Yes. Independent businesses, developers, and creators publish new campaigns throughout the day as their marketing and testing schedules require.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": "https://smartexn.com/workers/how-to-find-tasks#article",
        "headline": "How to Find & Select Available Micro-Tasks on SmartExn",
        "description": "Comprehensive guide for SmartExn workers on discovering new tasks, using category filters, managing reservation timers, and evaluating campaign payouts.",
        "inLanguage": "en-US",
        "mainEntityOfPage": "https://smartexn.com/workers/how-to-find-tasks",
        "publisher": {
          "@type": "Organization",
          "@id": "https://smartexn.com/#organization",
          "name": "SmartExn",
          "url": "https://smartexn.com"
        }
      },
      {
        "@type": "HowTo",
        "@id": "https://smartexn.com/workers/how-to-find-tasks#howto",
        "name": "How to Find High-Yield Micro-Tasks on SmartExn",
        "description": "Step-by-step method to filter, select, reserve, and complete micro-tasks efficiently.",
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Navigate to Task Directory",
            "text": "Open your dashboard and access the active micro-tasks catalog."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "Apply Device and Category Filters",
            "text": "Filter by Android, iOS, or Desktop to see compatible campaigns."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "Check Remaining Slots and Payout",
            "text": "Evaluate reward versus estimated time and confirm available quota."
          },
          {
            "@type": "HowToStep",
            "position": 4,
            "name": "Lock Slot and Complete Promptly",
            "text": "Click Start Task to reserve your spot and complete before the timer expires."
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/workers/how-to-find-tasks#webpage",
        "url": "https://smartexn.com/workers/how-to-find-tasks",
        "name": "How to Find & Select High-Value Micro-Tasks on SmartExn | Worker Guide",
        "description": "Comprehensive guide for SmartExn workers on discovering new tasks, using category filters, managing reservation timers, and evaluating campaign payouts.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/workers/how-to-find-tasks#breadcrumb",
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
            "name": "For Workers",
            "item": "https://smartexn.com/how-it-works-for-workers"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "How to Find Tasks",
            "item": "https://smartexn.com/workers/how-to-find-tasks"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/workers/how-to-find-tasks#faq",
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
        title="How to Find & Select High-Value Micro-Tasks on SmartExn | Worker Guide"
        description="Comprehensive guide for SmartExn workers on discovering new tasks, using category filters, managing reservation timers, and evaluating campaign payouts."
        canonicalUrl="https://smartexn.com/workers/how-to-find-tasks"
        schema={schemaData}
      />
      <PublicNavHeader activePage="how-it-works" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/how-it-works-for-workers" className="hover:text-sky-400 transition-colors">For Workers</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">How to Find Tasks</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Worker Education</span>
            <span>•</span>
            <span>4 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            How to Find & Select Available Micro-Tasks on SmartExn
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            A practical guide to navigating the task marketplace, filtering active campaigns by device and category, managing reservation timers, and maximizing task efficiency.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Navigating the Task Marketplace
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            The SmartExn task catalog features hundreds of live campaigns funded by independent advertisers. Because tasks range from 30-second social interactions to 10-minute app testing reviews, selecting campaigns that match your device and schedule is key to high productivity.
          </p>
        </section>

        {/* Filtering Strategies */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Effective Filtering & Sorting Strategies
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Filter by Device Type</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Filter by Android, iOS, or Desktop to immediately eliminate campaigns that are incompatible with your current device.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Evaluate Estimated Time vs. Reward</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Compare the estimated completion time against the reward value to select tasks that offer high effective hourly returns.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Check Slot Capacity</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Prioritize campaigns with substantial remaining slot counts to ensure your reservation is secure before beginning.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Review Creator Approval Rate</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Look at the advertiser's historical approval rate to identify creators with clear instructions and quick review windows.
              </p>
            </div>
          </div>
        </section>

        {/* Reservation Timers */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. How the Slot Reservation Timer Protects You
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            When you click to start a task, SmartExn reserves an open slot exclusively for your account. A visible countdown timer indicates how long you have to execute the instructions and upload proof. If you need more time, ensure you submit before the timer reaches zero to prevent slot forfeiture.
          </p>
        </section>

        {/* Disclaimers */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Task Volume Notice
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Campaign availability is driven entirely by advertiser demand. SmartExn does not promise guaranteed daily task volume or fixed income. All rewards are held in escrow and released upon valid proof approval.
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
            <Link to="/workers/how-to-submit-proof" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Submit Valid Proof as a Worker
            </Link>
            <Link to="/workers/how-to-avoid-task-rejection" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Avoid Task Rejections
            </Link>
            <Link to="/workers/task-completion-tips" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → High-Efficiency Task Completion Tips
            </Link>
            <Link to="/micro-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Browse Online Micro-Tasks Catalog
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Start Browsing Tasks Today</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Find active micro-tasks and surveys available for your device on SmartExn right now.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Explore Micro-Tasks
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Create Account
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
