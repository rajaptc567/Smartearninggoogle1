import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';

export const WhyTasksGetRejected: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Will my account be banned if a single task is rejected?',
      a: 'No. An occasional rejection due to minor errors or missing details does not trigger account action. However, repeated low-quality submissions, fake proofs, or automated bot usage will lead to account restrictions.'
    },
    {
      q: 'Can I re-submit proof if my first attempt was rejected?',
      a: 'Re-submission depends on the campaign configuration and whether remaining open slots exist. Some campaigns allow workers to provide corrected evidence, while others do not.'
    },
    {
      q: 'Can I dispute an unfair rejection?',
      a: 'Yes. If an advertiser rejects valid proof that meets all stated instructions, you can open a dispute through our Level-1 direct communication channel or escalate to Level-2 administrative arbitration.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/knowledge-base/why-tasks-get-rejected#webpage",
        "url": "https://smartexn.com/knowledge-base/why-tasks-get-rejected",
        "name": "Why Micro-Task Submissions Get Rejected | SmartExn Knowledge Base",
        "description": "An objective guide explaining why task proofs get rejected by advertisers and how to ensure your submissions meet verification standards.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/knowledge-base/why-tasks-get-rejected#breadcrumb",
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
            "name": "Why Micro-Task Submissions Get Rejected",
            "item": "https://smartexn.com/knowledge-base/why-tasks-get-rejected"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/knowledge-base/why-tasks-get-rejected#faq",
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

  const rejectionReasons = [
    {
      title: 'Incomplete Task Execution',
      desc: 'Stopping before reaching the required milestone (e.g. creating an account but skipping email verification, or watching 30 seconds instead of the full requested 2 minutes).'
    },
    {
      title: 'Incorrect Proof Type',
      desc: 'Submitting a text message when the campaign explicitly demanded a full-screen screenshot, or vice-versa.'
    },
    {
      title: 'Missing or Cropped Screenshot',
      desc: 'Uploading blank images, broken files, or heavily cropped screenshots that omit critical context such as timestamps, profile photos, or active state.'
    },
    {
      title: 'Wrong Username or Handle',
      desc: 'Typing an incorrect handle, omitting the required prefix, or using an account different from the one depicted in the evidence.'
    },
    {
      title: 'Duplicate Submission',
      desc: 'Reusing identical screenshot files, transaction identifiers, or response codes across multiple campaigns or accounts.'
    },
    {
      title: 'Invalid or Inaccessible URL',
      desc: 'Submitting broken URLs, private posts, or localhost links that the advertiser cannot open to confirm the action.'
    },
    {
      title: 'Failure to Follow Sequence Instructions',
      desc: 'Skipping intermediate instructions (such as liking before sharing, or browsing 3 specific internal pages).'
    },
    {
      title: 'Low-Quality or Obscured Evidence',
      desc: 'Providing blurry, low-resolution, or illegible photos of device screens where account names and dates cannot be discerned.'
    },
    {
      title: 'Unmet Campaign Eligibility Requirements',
      desc: 'Submitting from an unpermitted country, unsupported OS version, or using an existing registered account on a campaign designated for new signups only.'
    },
    {
      title: 'Fraudulent or Automated Activity',
      desc: 'Utilizing automated script bots, headless browsers, or disposable temporary emails on tasks requiring genuine human engagement.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="Why Micro-Task Submissions Get Rejected | SmartExn Guide"
        description="Learn the top reasons micro-task proofs get rejected by advertisers, how to prevent verification failures, and how the dispute desk operates."
        canonical="https://smartexn.com/knowledge-base/why-tasks-get-rejected"
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
              <span className="text-slate-300 truncate max-w-xs sm:max-w-md">Why Tasks Get Rejected</span>
            </nav>

            <div className="flex items-center gap-3 pt-2">
              <span className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase">
                Worker Knowledge
              </span>
              <span className="text-xs text-slate-400">Updated August 2026</span>
              <span className="text-xs text-slate-400">• 4 min read</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Why Micro-Task Submissions Get Rejected
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              An objective breakdown of why task submissions fail verification, how advertisers evaluate submitted evidence, and how you can maintain a flawless approval rate.
            </p>
          </div>
        </section>

        {/* Content Body */}
        <article className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Understanding the Review Process
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              When an advertiser creates a campaign on SmartExn, they lock the full reward budget into escrow. Because advertisers pay for verified outcomes, they review submissions against the explicit criteria defined during campaign launch. A submission is rejected when the evidence provided fails to prove that the requested actions were completed authentically.
            </p>
          </section>

          {/* 10 Core Reasons Grid */}
          <section className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Top 10 Causes of Task Rejection
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rejectionReasons.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-8">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Rejections & Disputes */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Disputes and Appeal Guidelines
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Advertisers are required to review submissions honestly and in good faith. If you believe your submission met all guidelines but was wrongly marked as rejected, SmartExn provides access to a structured{' '}
              <Link to="/trust-and-safety" className="text-sky-400 font-semibold hover:underline">Dispute System</Link>:
            </p>
            <div className="space-y-3 pl-2 text-sm text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <strong className="text-white block mb-1">Level-1 Direct Communication:</strong>
                Initiate a dispute thread with the advertiser to provide clarifying notes or updated proof links directly within your dashboard.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <strong className="text-white block mb-1">Level-2 Moderation Arbitration:</strong>
                If an agreement cannot be reached, platform moderators can inspect the original campaign instructions and your proof to make an impartial determination.
              </div>
            </div>
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
                to="/knowledge-base/task-proof-guide"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Task Proof Guide →</span>
                <p className="text-xs text-slate-300">Format proof to pass advertiser scrutiny.</p>
              </Link>
              <Link
                to="/knowledge-base/how-to-complete-micro-tasks"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">How to Complete Micro-Tasks →</span>
                <p className="text-xs text-slate-300">Master the complete step-by-step task flow.</p>
              </Link>
              <Link
                to="/trust-and-safety"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Trust & Safety Hub →</span>
                <p className="text-xs text-slate-300">Read our escrow and arbitration policies.</p>
              </Link>
            </div>
          </section>

        </article>
      </main>

      <PublicFooter />
    </div>
  );
};

export default WhyTasksGetRejected;
