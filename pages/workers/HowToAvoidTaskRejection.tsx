import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const HowToAvoidTaskRejection: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is the most frequent cause of task rejections?',
      a: 'The most common cause is failing to follow specific campaign instructions—such as submitting the wrong username, missing a secondary milestone, or uploading a cropped screenshot that does not show the confirmation state.'
    },
    {
      q: 'What should I do if an advertiser rejects my submission unfairly?',
      a: 'You can open a Level-1 direct clarification from your dashboard to provide additional context or an updated screenshot. If unresolved after 48 hours, you can escalate the case to Level-2 SmartExn administrator arbitration.'
    },
    {
      q: 'Does a rejected task lower my account approval rate?',
      a: 'Yes. Your worker approval rate reflects the percentage of successfully approved tasks over your last 100 submissions. Keeping your rate above 90% unlocks high-tier tasks.'
    },
    {
      q: 'Can an advertiser reject tasks to steal free work?',
      a: 'No. SmartExn monitors advertiser rejection ratios closely. When an advertiser rejects a submission, the slot is restored to the campaign budget rather than refunded to the advertiser. Creators with abnormally high rejection rates are subject to audit and platform suspension.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/workers/how-to-avoid-task-rejection#webpage",
        "url": "https://smartexn.com/workers/how-to-avoid-task-rejection",
        "name": "How to Avoid Micro-Task Rejections on SmartExn | Worker Guidelines",
        "description": "Learn the most common causes of micro-task rejections on SmartExn, how to maintain a 95%+ approval rate, and how the dispute resolution desk works.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/workers/how-to-avoid-task-rejection#breadcrumb",
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
            "name": "Avoid Task Rejections",
            "item": "https://smartexn.com/workers/how-to-avoid-task-rejection"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/workers/how-to-avoid-task-rejection#faq",
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
        title="How to Avoid Micro-Task Rejections on SmartExn | Worker Guidelines"
        description="Learn the most common causes of micro-task rejections on SmartExn, how to maintain a 95%+ approval rate, and how the dispute resolution desk works."
        canonicalUrl="https://smartexn.com/workers/how-to-avoid-task-rejection"
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
          <span className="text-sky-400 font-medium">Avoid Task Rejections</span>
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
            How to Avoid Micro-Task Rejections: Quality Checklist & Best Practices
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Discover the top reasons why submissions are rejected by campaign creators, how to maintain a pristine approval score, and how to utilize the dispute resolution desk.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. The Value of a High Approval Rate
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Your worker approval score is one of your most valuable assets on SmartExn. High-rating workers gain access to premium campaigns, higher task reservation limits, and expedited withdrawal processing. Following a quick pre-submission checklist ensures your approval rate stays above 95%.
          </p>
        </section>

        {/* The 4 Common Errors */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Top 4 Reasons for Submissions Being Rejected
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Mismatched Account Handles</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Submitting a different username than the one visible in the attached screenshot, making it impossible for the creator to verify ownership.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Incomplete Campaign Milestones</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Stopping halfway through a multi-step task (e.g. creating an account but skipping email verification or tutorial completion).
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Cropped or Blurry Proof</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Uploading tight crops that omit timestamps, URL address bars, or necessary profile elements.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Expired Reservation Slot</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Letting the task reservation timer run down to zero before completing the upload submission.
              </p>
            </div>
          </div>
        </section>

        {/* Dispute Desk */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. What to Do If Unfairly Rejected: Two-Tier Dispute Desk
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            If an advertiser rejects your submission in error, SmartExn provides a structured resolution process:
          </p>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-sky-400 font-bold">1.</span>
              <span><strong>Level-1 Direct Clarification:</strong> Message the campaign creator directly with supplemental evidence or an uncropped screenshot.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-sky-400 font-bold">2.</span>
              <span><strong>Level-2 Platform Arbitration:</strong> If the creator does not respond or remains unreasonable, escalate to an impartial SmartExn moderator for final binding review.</span>
            </li>
          </ul>
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
            <Link to="/trust-and-safety/disputes" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Two-Tier Dispute Desk & Arbitration Process
            </Link>
            <Link to="/workers/how-to-submit-proof" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Submit Valid Proof as a Worker
            </Link>
            <Link to="/workers/task-completion-tips" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → High-Efficiency Task Completion Tips
            </Link>
            <Link to="/knowledge-base/why-tasks-get-rejected" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Detailed Rejection Prevention Guide
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Build a 95%+ Approval Rating</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Take on verified micro-tasks and grow your earning potential on SmartExn.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Open Tasks
            </Link>
            <Link
              to="/task-proof"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Review Proof Standards
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
