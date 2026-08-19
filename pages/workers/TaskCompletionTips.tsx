import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const TaskCompletionTips: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How can I complete micro-tasks faster without sacrificing quality?',
      a: 'Organize your workspace by grouping similar tasks (e.g. completing all social media tasks together, followed by research tasks), using keyboard shortcuts for taking screenshots, and verifying instructions before starting.'
    },
    {
      q: 'Is it better to focus on micro-tasks or online surveys?',
      a: 'Many successful contributors use a hybrid approach: they check for high-reward surveys during peak morning and afternoon hours, and work on consistent micro-tasks during other times.'
    },
    {
      q: 'Can I use browser extensions to help with micro-tasks?',
      a: 'Standard screenshot extensions and clipboard managers are allowed. Automated clickers, macros, bots, or auto-fill scripts are strictly prohibited and will lead to an immediate ban.'
    },
    {
      q: 'What is the best way to keep track of pending task reviews?',
      a: 'Your SmartExn Worker Dashboard provides a real-time "Under Review" tab with live countdown timers showing when each advertiser must review your work.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/workers/task-completion-tips#webpage",
        "url": "https://smartexn.com/workers/task-completion-tips",
        "name": "Micro-Task Completion Tips & Efficiency Guide | SmartExn",
        "description": "Discover actionable tips for completing micro-tasks and surveys efficiently on SmartExn. Learn time management, screenshot shortcuts, and workflow strategies.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/workers/task-completion-tips#breadcrumb",
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
            "name": "Completion Tips",
            "item": "https://smartexn.com/workers/task-completion-tips"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/workers/task-completion-tips#faq",
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
        title="Micro-Task Completion Tips & Efficiency Guide | SmartExn"
        description="Discover actionable tips for completing micro-tasks and surveys efficiently on SmartExn. Learn time management, screenshot shortcuts, and workflow strategies."
        canonicalUrl="https://smartexn.com/workers/task-completion-tips"
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
          <span className="text-sky-400 font-medium">Completion Tips</span>
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
            Micro-Task Completion Tips: Speed, Accuracy & Efficiency Best Practices
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Maximize your productivity and maintain a high approval rating on SmartExn with these proven workflow habits, organization techniques, and quality shortcuts.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. The Compound Advantage of Workflow Efficiency
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            In micro-tasking, your effective hourly return depends on two variables: your task completion speed and your approval rate. Workers who streamline their screenshot routines and avoid rejections earn significantly more per hour spent on the platform.
          </p>
        </section>

        {/* 4 Key Habits */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. 4 Habits of Highly Productive Workers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Master Native Screenshot Shortcuts</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Use <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Win+Shift+S</kbd> on Windows or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Cmd+Shift+4</kbd> on Mac to capture and paste proof in seconds.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Batch by Task Category</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Working through 5 social media tasks in one session is faster than constantly switching between different task categories.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Verify First, Execute Second</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Read the proof requirements before clicking the campaign link so you know exactly what screenshot to capture at the end.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Keep a Clean Text Snippet File</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Save your standard public social usernames in a local notepad for instant copy-pasting into task proof text boxes.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Balance Speed with Strict Accuracy
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Never sacrifice quality for speed. An extra 10 seconds spent double-checking your uploaded screenshot and username spelling protects your approval rate and prevents time-consuming dispute escalations.
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
            <Link to="/workers/how-to-find-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Find Tasks on SmartExn
            </Link>
            <Link to="/workers/how-to-avoid-task-rejection" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Avoid Task Rejections
            </Link>
            <Link to="/workers/reward-and-withdrawal-guide" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Rewards & Withdrawal Policy
            </Link>
            <Link to="/micro-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Browse Live Tasks Catalog
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Put These Tips Into Practice</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Browse currently available tasks and streamline your workflow today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Tasks
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
